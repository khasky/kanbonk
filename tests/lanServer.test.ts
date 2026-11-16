import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { expect, it } from "vitest";

function openSocket(url: string): Promise<WebSocket> {
  const socket = new WebSocket(url);
  return new Promise((resolve, reject) => {
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

function nextMessage(socket: WebSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    socket.once("message", (data) => resolve(data.toString()));
    socket.once("error", reject);
  });
}

it("relays messages only between the two members of one local room", async () => {
  const serverPath = fileURLToPath(new URL("../server.mjs", import.meta.url));
  const server = spawn(process.execPath, [serverPath, "127.0.0.1", "0"], { stdio: ["ignore", "pipe", "pipe"] });
  let first: WebSocket | undefined;
  let second: WebSocket | undefined;
  try {
    const port = await new Promise<number>((resolve, reject) => {
      server.stdout!.on("data", (chunk) => {
        const match = String(chunk).match(/127\.0\.0\.1:(\d+)/);
        if (match) resolve(Number(match[1]));
      });
      server.once("error", reject);
      server.once("exit", (code) => reject(new Error(`Local server exited: ${code}`)));
    });
    const room = "a".repeat(64);
    const url = `ws://127.0.0.1:${port}/sync?room=${room}`;
    first = await openSocket(url);
    const readyFirst = nextMessage(first);
    const secondSocket = new WebSocket(url);
    second = secondSocket;
    const readySecond = nextMessage(secondSocket);
    await new Promise<void>((resolve, reject) => {
      secondSocket.once("open", resolve);
      secondSocket.once("error", reject);
    });
    expect(JSON.parse(await readyFirst)).toEqual({ type: "peer-ready" });
    expect(JSON.parse(await readySecond)).toEqual({ type: "peer-ready" });
    const received = nextMessage(second);
    first.send(JSON.stringify({ nonce: "nonce", data: "encrypted-payload" }));
    expect(JSON.parse(await received)).toEqual({ nonce: "nonce", data: "encrypted-payload" });
    await expect(openSocket(url)).rejects.toThrow("400");
  } finally {
    first?.close();
    second?.close();
    server.kill();
  }
});
