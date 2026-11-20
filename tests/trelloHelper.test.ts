import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";

describe("Trello browser helper", () => {
  it("exports board JSON and media in importable ZIP batches", async () => {
    const script = readFileSync(fileURLToPath(new URL("../public/trello-helper.js", import.meta.url)), "utf8");
    const board = { id: "board", name: "Example", idOrganization: "organization-1", cards: [{ attachments: [
      { id: "first", name: "same.png", url: "https://trello.com/1/first", isUpload: true },
      { id: "second", name: "same.png", url: "https://trello.com/1/second", isUpload: true },
      ...Array.from({ length: 19 }, (_, index) => ({ id: `extra-${index}`, name: `${index}.txt`, url: `https://trello.com/1/extra-${index}`, isUpload: true })),
    ] }] };
    const output: Blob[] = [];
    const context = {
      location: { hostname: "trello.com", pathname: "/b/example/board" },
      fetch: async (url: string | URL) => {
        if (String(url).endsWith(".json")) return { ok: true, json: async () => board };
        if (String(url).includes("/1/boards/board?")) return { ok: true, json: async () => ({ organization: { id: "organization-1", displayName: "Workspace" } }) };
        if (String(url).includes("/actions?")) return { ok: true, json: async () => String(url).includes("before=") ? [{ id: "older", type: "commentCard" }] : Array.from({ length: 1000 }, (_, index) => ({ id: `action-${index}`, type: "commentCard" })) };
        if (String(url).includes("/cards?")) return { ok: true, json: async () => board.cards.map((card) => ({ id: card.id, stickers: [] })) };
        return { ok: true, arrayBuffer: async () => new TextEncoder().encode(String(url).endsWith("first") ? "first file" : "second file").buffer };
      },
      Blob,
      TextEncoder,
      Uint8Array,
      URL: class extends URL { static createObjectURL(blob: Blob) { output.push(blob); return "blob:test"; } static revokeObjectURL() {} },
      document: { body: { append() {} }, createElement: () => ({ click() {}, remove() {} }) },
      console: { info() {}, warn() {} },
      setTimeout: () => 0,
    };
    await runInNewContext(script, context);
    expect(output).toHaveLength(2);
    const first = unzipSync(new Uint8Array(await output[0].arrayBuffer()));
    const second = unzipSync(new Uint8Array(await output[1].arrayBuffer()));
    const exported = JSON.parse(strFromU8(first["board.json"]));
    expect(exported).toMatchObject(board);
    expect(exported.kanbonkOrganizationName).toBe("Workspace");
    expect(exported.kanbonkCommentsComplete).toBe(true);
    expect(exported.kanbonkComments).toHaveLength(1001);
    expect(exported.kanbonkComments.at(-1).id).toBe("older");
    expect(strFromU8(first["attachments/first/same.png"])).toBe("first file");
    expect(strFromU8(first["attachments/second/same.png"])).toBe("second file");
    expect(Object.keys(first).filter((path) => path.startsWith("attachments/"))).toHaveLength(20);
    expect(Object.keys(second)).toEqual(["attachments/extra-18/18.txt"]);
  });

  it("packs a readable board background into the ZIP", async () => {
    const script = readFileSync(fileURLToPath(new URL("../public/trello-helper.js", import.meta.url)), "utf8");
    const output: Blob[] = [];
    const context = {
      location: { hostname: "trello.com", pathname: "/b/example/board" },
      fetch: async (url: string | URL) => String(url).endsWith(".json")
        ? { ok: true, json: async () => ({ id: "board-1", name: "Board", cards: [], prefs: { backgroundImage: "https://images.example.com/background.png" } }) }
        : String(url).includes("/actions?") ? { ok: true, json: async () => [] }
          : String(url).includes("/cards?") ? { ok: true, json: async () => [] }
          : { ok: true, headers: { get: () => "image/png" }, arrayBuffer: async () => new TextEncoder().encode("background bytes").buffer },
      Blob, TextEncoder, Uint8Array,
      URL: class extends URL { static createObjectURL(blob: Blob) { output.push(blob); return "blob:test"; } static revokeObjectURL() {} },
      document: { body: { append() {} }, createElement: () => ({ click() {}, remove() {} }) },
      console: { info() {}, warn() {} }, setTimeout: () => 0,
    };
    await runInNewContext(script, context);
    expect(output).toHaveLength(1);
    const entries = unzipSync(new Uint8Array(await output[0].arrayBuffer()));
    expect(strFromU8(entries["background/board-1/background.png"])).toBe("background bytes");
  });

  it("includes Trello sticker metadata and its image in the ZIP", async () => {
    const script = readFileSync(fileURLToPath(new URL("../public/trello-helper.js", import.meta.url)), "utf8");
    const output: Blob[] = [];
    const board = { id: "board-1", name: "Board", cards: [{ id: "card-1", attachments: [] }] };
    const sticker = { id: "sticker-1", image: "check", imageUrl: "https://d2k1ftgv7pobq7.cloudfront.net/images/stickers/check.png" };
    await runInNewContext(script, {
      location: { hostname: "trello.com", pathname: "/b/example/board" },
      fetch: async (url: string | URL) => String(url).endsWith(".json")
        ? { ok: true, json: async () => board }
        : String(url).includes("/actions?") ? { ok: true, json: async () => [] }
          : String(url).includes("/cards?") ? { ok: true, json: async () => [{ id: "card-1", stickers: [sticker] }] }
            : { ok: true, headers: { get: () => "image/png" }, arrayBuffer: async () => new TextEncoder().encode("sticker bytes").buffer },
      Blob, TextEncoder, Uint8Array,
      URL: class extends URL { static createObjectURL(blob: Blob) { output.push(blob); return "blob:test"; } static revokeObjectURL() {} },
      document: { body: { append() {} }, createElement: () => ({ click() {}, remove() {} }) },
      console: { info() {}, warn() {} }, setTimeout: () => 0,
    });
    const entries = unzipSync(new Uint8Array(await output[0].arrayBuffer()));
    expect(JSON.parse(strFromU8(entries["board.json"])).cards[0].stickers[0]).toMatchObject(sticker);
    expect(strFromU8(entries["stickers/sticker-1/image.png"])).toBe("sticker bytes");
  });
});
