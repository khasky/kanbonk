import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";

const host = process.argv[2] ?? "127.0.0.1";
const port = Number(process.argv[3] ?? 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid port");
const root = resolve(fileURLToPath(new URL("./dist/", import.meta.url)));
const rooms = new Map();
const sockets = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024, perMessageDeflate: false });
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = createServer(async (request, response) => {
  if (request.method !== "GET") {
    response.writeHead(405).end();
    return;
  }
  let pathname;
  try {
    pathname = new URL(request.url, "http://localhost").pathname;
  } catch {
    response.writeHead(400).end();
    return;
  }
  // Client-side routes (/w/…, /b/…, /c/…, /trash) have no file extension: serve the app shell.
  const filename = resolve(root, `.${pathname === "/" || !/\.[a-z0-9]+$/i.test(pathname) ? "/index.html" : pathname}`);
  if (!filename.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const file = await readFile(filename);
    const extension = filename.slice(filename.lastIndexOf("."));
    response
      .writeHead(200, {
        "Content-Type": types[extension] ?? "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      })
      .end(file);
  } catch (cause) {
    response.writeHead(cause.code === "ENOENT" ? 404 : 500).end();
  }
});

server.on("upgrade", (request, socket, head) => {
  let url;
  try {
    url = new URL(request.url, "http://localhost");
  } catch {
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    return;
  }
  const room = url.searchParams.get("room");
  if (url.pathname !== "/sync" || !/^[a-f0-9]{64}$/.test(room ?? "") || (rooms.get(room)?.size ?? 0) >= 2) {
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    return;
  }
  sockets.handleUpgrade(request, socket, head, (peer) => {
    const members = rooms.get(room) ?? new Set();
    members.add(peer);
    rooms.set(room, members);
    peer.on("message", (message, binary) => {
      if (binary) return;
      for (const other of members)
        if (other !== peer && other.readyState === WebSocket.OPEN) other.send(message, { binary: false });
    });
    peer.on("error", () => peer.terminate());
    peer.on("close", () => {
      members.delete(peer);
      if (!members.size) rooms.delete(room);
      else for (const other of members) if (other.readyState === WebSocket.OPEN) other.send('{"type":"peer-left"}');
    });
    if (members.size === 2) for (const member of members) member.send('{"type":"peer-ready"}');
  });
});

server.listen(port, host, () => process.stdout.write(`Kanbonk LAN: http://${host}:${server.address().port}/\n`));
