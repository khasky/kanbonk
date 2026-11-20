import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { parseTrelloBoard, readTrelloExport, restoreTrelloAttachments } from "../src/trello/import";
import { saveAttachment } from "../src/storage";

vi.mock("../src/storage", () => ({
  saveAttachment: vi.fn(async () => {}),
  loadAttachment: vi.fn(async () => undefined),
}));

const source = readFileSync(fileURLToPath(new URL("../trello-import-extension/exporter.js", import.meta.url)), "utf8");

type Reply = { status?: number; body?: unknown; bytes?: string; type?: string };
type ExportResult = { parts: number; files: number; total: number; failures: string[]; warnings: string[] };

/** Runs the extension exporter against a fake Trello that answers by URL, collecting the saved ZIP parts. */
async function runExport(routes: (url: string) => Reply, partLimit?: number) {
  const context: Record<string, unknown> = {
    Blob,
    TextEncoder,
    Uint8Array,
    URL,
    Map,
    JSON,
    String,
    Number,
    Array,
    Date,
    Promise,
  };
  runInNewContext(source, context);
  const saved: Array<{ name: string; blob: Blob; files: Record<string, Uint8Array> }> = [];
  const fetch = async (url: string | URL) => {
    const reply = routes(String(url));
    const status = reply.status ?? 200;
    return {
      ok: status < 400,
      status,
      headers: { get: (name: string) => (name === "content-type" ? (reply.type ?? "") : null) },
      json: async () => reply.body,
      arrayBuffer: async () => new TextEncoder().encode(reply.bytes ?? "").buffer,
    };
  };
  const result = await (context.kanbonkExportBoard as (options: unknown) => Promise<ExportResult>)({
    fetch,
    shortLink: "abc123",
    partLimit,
    now: () => new Date("2026-11-20T10:00:00Z"),
    save: async (blob: Blob, name: string) => {
      saved.push({ name, blob, files: unzipSync(new Uint8Array(await blob.arrayBuffer())) });
    },
  });
  return { result, saved };
}

const attachment = (id: string, name: string, size: number) => ({
  id,
  name,
  bytes: size,
  isUpload: true,
  url: `https://trello.com/1/cards/card-1/attachments/${id}/download/${encodeURIComponent(name)}`,
});

function trello(
  board: Record<string, unknown>,
  files: Record<string, Reply> = {},
  extra: (url: string) => Reply | undefined = () => undefined,
) {
  return (url: string): Reply => {
    const handled = extra(url);
    if (handled) return handled;
    if (url === "/b/abc123.json") return { body: board };
    if (url.includes("/actions?")) return { body: [] };
    if (url.includes("/cards?"))
      return { body: (board.cards as Array<{ id: string }>).map((card) => ({ id: card.id, stickers: [] })) };
    const file = Object.entries(files).find(([key]) => url.includes(key));
    return file ? file[1] : { status: 404 };
  };
}

describe("Trello export extension", () => {
  beforeEach(() => {
    vi.mocked(saveAttachment)
      .mockReset()
      .mockImplementation(async () => {});
  });

  it("packs files into parts up to the limit and gives a larger file a part of its own", async () => {
    const files = [
      attachment("a1", "a.bin", 600),
      attachment("a2", "b.bin", 300),
      attachment("a3", "big.bin", 1500),
      attachment("a4", "c.bin", 200),
    ];
    const board = {
      id: "board-1",
      name: "Servers: Killing Floor",
      lists: [],
      cards: [{ id: "card-1", attachments: files }],
    };
    const { result, saved } = await runExport(
      trello(board, Object.fromEntries(files.map((file) => [file.id, { bytes: "x".repeat(file.bytes) }]))),
      1000,
    );
    const manifests = saved.map((part) => JSON.parse(strFromU8(part.files["kanbonk-export.json"])));
    expect(result).toMatchObject({ parts: saved.length, files: 4, total: 4, failures: [] });
    expect(saved.map((part) => part.name)).toEqual(
      saved.map(
        (_, index) =>
          `Servers_ Killing Floor - Kanbonk export - part ${index + 1}${index === saved.length - 1 ? " (last)" : ""}.zip`,
      ),
    );
    expect(manifests.map((item) => item.part)).toEqual(saved.map((_, index) => index + 1));
    expect(manifests.filter((item) => item.parts).map((item) => item.parts)).toEqual([saved.length]);
    expect(new Set(manifests.map((item) => item.exportId)).size).toBe(1);
    for (const part of saved) {
      const sizes = Object.entries(part.files)
        .filter(([path]) => path !== "kanbonk-export.json")
        .map(([, data]) => data.length);
      expect(sizes.length === 1 || sizes.reduce((sum, size) => sum + size, 0) <= 1000).toBe(true);
    }
    const all = Object.assign({}, ...saved.map((part) => part.files));
    expect(files.map((file) => all[`attachments/${file.id}/${file.name}`]?.length)).toEqual(
      files.map((file) => file.bytes),
    );
    expect(Object.keys(saved.find((part) => part.files["attachments/a3/big.bin"])!.files)).toEqual([
      "kanbonk-export.json",
      "attachments/a3/big.bin",
    ]);
  });

  it("keeps the full comment history, the workspace name, stickers and the background in the board", async () => {
    const sticker = {
      id: "sticker-1",
      image: "check",
      imageUrl: "https://d2k1ftgv7pobq7.cloudfront.net/images/stickers/check.png",
    };
    const board = {
      id: "board-1",
      name: "Board",
      idOrganization: "org-1",
      prefs: { backgroundImage: "https://images.example.com/background.png" },
      lists: [],
      cards: [{ id: "card-1", attachments: [] }],
    };
    const { saved } = await runExport(
      trello(board, {}, (url) => {
        if (url.includes("/1/boards/board-1?"))
          return { body: { organization: { id: "org-1", displayName: "Workspace" } } };
        if (url.includes("/actions?"))
          return {
            body: url.includes("before=")
              ? [{ id: "older", type: "commentCard" }]
              : Array.from({ length: 1000 }, (_, index) => ({ id: `action-${index}`, type: "commentCard" })),
          };
        if (url.includes("/cards?")) return { body: [{ id: "card-1", stickers: [sticker] }] };
        if (url.endsWith("check.png")) return { bytes: "sticker bytes", type: "image/png" };
        if (url.endsWith("background.png")) return { bytes: "background bytes", type: "image/png" };
      }),
    );
    expect(saved).toHaveLength(1);
    const exported = JSON.parse(strFromU8(saved[0].files["board.json"]));
    expect(exported).toMatchObject({ kanbonkOrganizationName: "Workspace", kanbonkCommentsComplete: true });
    expect(exported.kanbonkComments).toHaveLength(1001);
    expect(exported.cards[0].stickers[0]).toMatchObject(sticker);
    expect(strFromU8(saved[0].files["stickers/sticker-1/image.png"])).toBe("sticker bytes");
    expect(strFromU8(saved[0].files["background/board-1/background.png"])).toBe("background bytes");
  });

  it("lists files that could not be downloaded in the last part", async () => {
    const board = {
      id: "board-1",
      name: "Board",
      lists: [],
      cards: [{ id: "card-1", attachments: [attachment("ok", "ok.txt", 2), attachment("gone", "gone.txt", 4)] }],
    };
    const { result, saved } = await runExport(trello(board, { "/attachments/ok/": { bytes: "ok" } }));
    expect(result.failures).toEqual(["gone.txt: Error: HTTP 404"]);
    expect(strFromU8(saved.at(-1)!.files["failed-files.txt"])).toBe("gone.txt: Error: HTTP 404");
  });

  it("produces parts that Kanbonk imports together, with non-Latin file names", async () => {
    const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("./trello-board.json", import.meta.url)), "utf8"));
    fixture.cards[0].attachments = [
      { ...fixture.cards[0].attachments[0], name: "Отчёт.txt", bytes: 600 },
      { ...attachment("trello-attachment-2", "второй.txt", 700), isUpload: undefined },
    ];
    const { saved } = await runExport(
      trello(fixture, {
        "trello-attachment-1": { bytes: "1".repeat(600) },
        "trello-attachment-2": { bytes: "2".repeat(700) },
      }),
      1000,
    );
    expect(saved.length).toBeGreaterThan(1);
    expect(saved.flatMap((part) => Object.keys(part.files))).toContain("attachments/trello-attachment-1/Отчёт.txt");
    const parts = saved.map((part) => new File([part.blob], part.name));
    const exported = await readTrelloExport(parts);
    const imported = parseTrelloBoard(exported.json, "workspace-1");
    expect(await restoreTrelloAttachments(imported, parts)).toEqual([]);
    expect(imported.cards[0].attachments.map((item) => [item.name, item.status])).toEqual([
      ["Отчёт.txt", "local"],
      ["второй.txt", "local"],
    ]);
    await expect(readTrelloExport(parts.slice(0, -1))).rejects.toThrow("last part");
    await expect(readTrelloExport(parts.slice(1))).rejects.toThrow("missing: 1");
  });
});
