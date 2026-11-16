import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it, vi } from "vitest";
import { downloadTrelloAttachment, downloadTrelloComments, trelloBridgeAvailable } from "../src/trelloBridge";

afterEach(() => vi.unstubAllGlobals());

it("matches the browser extension ID and receives a downloaded file", async () => {
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL("../trello-bridge/manifest.json", import.meta.url)), "utf8"));
  const digest = createHash("sha256").update(Buffer.from(manifest.key, "base64")).digest().subarray(0, 16);
  const expectedId = Array.from(digest, (byte) => String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15))).join("");
  const sendMessage = vi.fn((_id: string, message: { type: string; offset?: number }, callback: (reply: unknown) => void) => {
    callback(message.type === "probe" ? { ok: true, status: 200 } : { ok: true, data: btoa("media"), mimeType: "text/plain", offset: message.offset, total: 5 });
  });
  vi.stubGlobal("chrome", { runtime: { sendMessage } });
  expect(await trelloBridgeAvailable()).toBe(true);
  expect(await (await downloadTrelloAttachment("https://trello.com/1/cards/a/attachments/b/download/c")).text()).toBe("media");
  expect(sendMessage.mock.calls.every(([id]) => id === expectedId)).toBe(true);
});

it("assembles a file from verified chunks", async () => {
  const chunks = ["part one", " and part two", "!"];
  const file = chunks.join("");
  const offsets = [0, chunks[0].length, chunks[0].length + chunks[1].length];
  const sendMessage = vi.fn((_id: string, message: { offset: number }, callback: (reply: unknown) => void) => {
    const index = offsets.indexOf(message.offset);
    callback({ ok: true, data: btoa(chunks[index]), mimeType: "text/plain", offset: message.offset, total: file.length });
  });
  vi.stubGlobal("chrome", { runtime: { sendMessage } });
  const blob = await downloadTrelloAttachment("https://trello.com/1/cards/a/attachments/b/download/c");
  expect(await blob.text()).toBe(file);
  expect(sendMessage.mock.calls.map(([, message]) => message.offset)).toEqual(offsets);
});

it("rejects a chunk with an unexpected offset", async () => {
  vi.stubGlobal("chrome", { runtime: { sendMessage: (_id: string, _message: unknown, callback: (reply: unknown) => void) => callback({ ok: true, data: btoa("wrong"), offset: 1, total: 5 }) } });
  await expect(downloadTrelloAttachment("https://trello.com/1/cards/a/attachments/b/download/c")).rejects.toThrow("invalid chunk");
});

it("reads every page of Trello comments", async () => {
  const first = Array.from({ length: 1000 }, (_, index) => ({ id: `action-${index}`, type: "commentCard" }));
  const last = [{ id: "action-last", type: "commentCard" }];
  const sendMessage = vi.fn((_id: string, message: { before: string }, callback: (reply: unknown) => void) => {
    callback(message.before ? { ok: true, actions: last, complete: true } : { ok: true, actions: first, complete: false, nextBefore: "action-999" });
  });
  vi.stubGlobal("chrome", { runtime: { sendMessage } });
  const actions = await downloadTrelloComments("a".repeat(24));
  expect(actions).toHaveLength(1001);
  expect(actions.at(-1)).toEqual(last[0]);
  expect(sendMessage.mock.calls.map(([, message]) => message.before)).toEqual(["", "action-999"]);
});

it("does not mark incomplete comment history as complete", async () => {
  vi.stubGlobal("chrome", { runtime: { sendMessage: (_id: string, _message: unknown, callback: (reply: unknown) => void) => callback({ ok: true, actions: [], complete: false }) } });
  await expect(downloadTrelloComments("a".repeat(24))).rejects.toThrow("continue exporting");
});

it("reports that direct import is unavailable without the extension", async () => {
  vi.stubGlobal("chrome", undefined);
  expect(await trelloBridgeAvailable()).toBe(false);
  await expect(downloadTrelloAttachment("https://trello.com/file")).rejects.toThrow("not installed");
});
