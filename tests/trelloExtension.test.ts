import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";

it("relays only Trello attachment requests from Kanbonk localhost", async () => {
  let handle: (message: unknown, sender: { url: string }, reply: (value: unknown) => void) => boolean;
  const query = vi.fn(async () => [{ id: 1 }]);
  const sendMessage = vi.fn(async () => ({ ok: true, data: "bWVkaWE=", mimeType: "text/plain", offset: 0, total: 5 }));
  const source = readFileSync(fileURLToPath(new URL("../trello-import-extension/worker.js", import.meta.url)), "utf8");
  runInNewContext(source, { URL, chrome: { runtime: { onMessageExternal: { addListener: (listener: typeof handle) => { handle = listener; } } }, tabs: { query, sendMessage } } });
  const request = (url: string, sender = "http://localhost:1420/") => new Promise<unknown>((resolve) => {
    if (!handle({ type: "download", url, offset: 0 }, { url: sender }, resolve)) resolve(undefined);
  });
  const attachment = "https://trello.com/1/cards/card/attachments/file/download/media.txt";
  expect(await request(attachment, "https://example.com/")).toBeUndefined();
  expect(await request("https://example.com/private")).toMatchObject({ ok: false, error: expect.stringContaining("Invalid Trello attachment URL") });
  expect(query).not.toHaveBeenCalled();
  expect(await request(attachment)).toMatchObject({ ok: true, data: "bWVkaWE=" });
  expect(sendMessage).toHaveBeenCalledWith(1, { type: "download", url: attachment, offset: 0 });
  const comments = await new Promise<unknown>((resolve) => handle({ type: "comments", boardId: "a".repeat(24), before: "" }, { url: "http://localhost:1420/" }, resolve));
  expect(comments).toMatchObject({ ok: true });
  expect(sendMessage).toHaveBeenCalledWith(1, { type: "comments", boardId: "a".repeat(24), before: "" });
  const rejected = await new Promise<unknown>((resolve) => handle({ type: "comments", boardId: "invalid", before: "" }, { url: "http://localhost:1420/" }, resolve));
  expect(rejected).toMatchObject({ ok: false, error: expect.stringContaining("Invalid Trello history identifier") });
});

it("requests a page of comments from the authorized Trello tab", async () => {
  let handle: (message: unknown, sender: unknown, reply: (value: unknown) => void) => boolean;
  const actions = [{ id: "a".repeat(24), type: "commentCard" }];
  const fetch = vi.fn(async () => new Response(JSON.stringify(actions), { status: 200, headers: { "content-type": "application/json" } }));
  const source = readFileSync(fileURLToPath(new URL("../trello-import-extension/content.js", import.meta.url)), "utf8");
  runInNewContext(source, { chrome: { runtime: { onMessage: { addListener: (listener: typeof handle) => { handle = listener; } } } }, fetch, Uint8Array, btoa, String, Number, Response });
  const result = await new Promise<unknown>((resolve) => handle({ type: "comments", boardId: "b".repeat(24), before: "c".repeat(24) }, {}, resolve));
  expect(result).toMatchObject({ ok: true, actions, complete: true });
  expect(fetch).toHaveBeenCalledWith(`/1/boards/${"b".repeat(24)}/actions?filter=commentCard&limit=1000&before=${"c".repeat(24)}`, { credentials: "include" });
});

it("requests a bounded attachment range and validates the returned bytes", async () => {
  let handle: (message: unknown, sender: unknown, reply: (value: unknown) => void) => boolean;
  const fetch = vi.fn(async () => new Response("second", { status: 206, headers: { "content-type": "text/plain", "content-range": "bytes 5-10/11" } }));
  const source = readFileSync(fileURLToPath(new URL("../trello-import-extension/content.js", import.meta.url)), "utf8");
  runInNewContext(source, { chrome: { runtime: { onMessage: { addListener: (listener: typeof handle) => { handle = listener; } } } }, fetch, Uint8Array, btoa, String, Number, Response });
  const result = await new Promise<unknown>((resolve) => handle({ type: "download", url: "https://trello.com/file", offset: 5 }, {}, resolve));
  expect(result).toMatchObject({ ok: true, data: btoa("second"), offset: 5, total: 11 });
  expect(fetch).toHaveBeenCalledWith("https://trello.com/file", { credentials: "include", headers: { Range: "bytes=5-1048580" } });
});

it("rejects an incomplete Trello range response", async () => {
  let handle: (message: unknown, sender: unknown, reply: (value: unknown) => void) => boolean;
  const fetch = vi.fn(async () => new Response("short", { status: 206, headers: { "content-range": "bytes 0-9/10" } }));
  const source = readFileSync(fileURLToPath(new URL("../trello-import-extension/content.js", import.meta.url)), "utf8");
  runInNewContext(source, { chrome: { runtime: { onMessage: { addListener: (listener: typeof handle) => { handle = listener; } } } }, fetch, Uint8Array, btoa, String, Number, Response });
  const result = await new Promise<unknown>((resolve) => handle({ type: "download", url: "https://trello.com/file", offset: 0 }, {}, resolve));
  expect(result).toMatchObject({ ok: false, error: expect.stringContaining("incomplete attachment chunk") });
});

it("accepts a small attachment when Trello ignores the range request", async () => {
  let handle: (message: unknown, sender: unknown, reply: (value: unknown) => void) => boolean;
  const fetch = vi.fn(async () => new Response("small file", { status: 200, headers: { "content-type": "text/plain", "content-length": "10" } }));
  const source = readFileSync(fileURLToPath(new URL("../trello-import-extension/content.js", import.meta.url)), "utf8");
  runInNewContext(source, { chrome: { runtime: { onMessage: { addListener: (listener: typeof handle) => { handle = listener; } } } }, fetch, Uint8Array, btoa, String, Number, Response });
  const result = await new Promise<unknown>((resolve) => handle({ type: "download", url: "https://trello.com/file", offset: 0 }, {}, resolve));
  expect(result).toMatchObject({ ok: true, data: btoa("small file"), offset: 0, total: 10 });
});

it("directs large attachments without range support to ZIP", async () => {
  let handle: (message: unknown, sender: unknown, reply: (value: unknown) => void) => boolean;
  const fetch = vi.fn(async () => new Response("", { status: 200, headers: { "content-length": String(13 * 1024 * 1024) } }));
  const source = readFileSync(fileURLToPath(new URL("../trello-import-extension/content.js", import.meta.url)), "utf8");
  runInNewContext(source, { chrome: { runtime: { onMessage: { addListener: (listener: typeof handle) => { handle = listener; } } } }, fetch, Uint8Array, btoa, String, Number, Response });
  const result = await new Promise<unknown>((resolve) => handle({ type: "download", url: "https://trello.com/file", offset: 0 }, {}, resolve));
  expect(result).toMatchObject({ ok: false, error: expect.stringContaining("Use a ZIP") });
});
