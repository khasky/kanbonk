#!/usr/bin/env node
// Kanbonk MCP server: a headless trusted device for AI agents. Build first: npm run build:mcp
//
// Environment:
//   KANBONK_MCP_DIR     where the agent keeps its data (default ~/.kanbonk-mcp)
//   KANBONK_SYNC_URL    LAN relay address, e.g. http://192.168.1.10:4173 (npm run serve:lan)
//   KANBONK_SYNC_CODE   pairing code: in the app, Sync → Wi-Fi/LAN → "Create code", then "Connect with code"
//   KANBONK_DEVICE_NAME name shown in the app's trust prompt (default "AI agent (MCP)")
// Everything goes over stdio as MCP; logs go to stderr.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAgent } from "../dist-mcp/agent.js";

const dir = process.env.KANBONK_MCP_DIR || join(homedir(), ".kanbonk-mcp");
const files = join(dir, "files");
await mkdir(files, { recursive: true });
const log = (message) => process.stderr.write(`[kanbonk-mcp] ${message}\n`);

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch (cause) { if (cause.code === "ENOENT") return undefined; throw cause; }
}
/** Write to a temp file and rename, so a crash never leaves a half-written state. */
async function writeJson(path, value) {
  await writeFile(`${path}.tmp`, JSON.stringify(value));
  await rename(`${path}.tmp`, path);
}

const devicePath = join(dir, "device.json");
const device = (await readJson(devicePath)) ?? { deviceId: randomUUID() };
await writeJson(devicePath, device);
const safeId = (id) => { if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`bad file id ${id}`); return id; };

const agent = await createAgent({
  self: { deviceId: device.deviceId, name: process.env.KANBONK_DEVICE_NAME || "AI agent (MCP)" },
  sync: process.env.KANBONK_SYNC_URL && process.env.KANBONK_SYNC_CODE ? { url: process.env.KANBONK_SYNC_URL, code: process.env.KANBONK_SYNC_CODE } : undefined,
  log,
  store: {
    load: () => readJson(join(dir, "state.json")),
    save: (state) => writeJson(join(dir, "state.json"), state),
    loadFile: async (id) => {
      try {
        const meta = (await readJson(join(files, `${safeId(id)}.json`))) ?? {};
        return new Blob([await readFile(join(files, safeId(id)))], { type: meta.type ?? "application/octet-stream" });
      } catch (cause) { if (cause.code === "ENOENT") return undefined; throw cause; }
    },
    saveFile: async (id, blob) => {
      await writeFile(join(files, safeId(id)), new Uint8Array(await blob.arrayBuffer()));
      await writeJson(join(files, `${safeId(id)}.json`), { type: blob.type });
    },
  },
});
log(`data in ${dir}`);
await agent.server.connect(new StdioServerTransport());
const stop = () => { agent.close(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
