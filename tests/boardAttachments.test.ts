import { describe, expect, it } from "vitest";
import { attachmentKind, boardAttachments, findAttachments, formatSize } from "../src/board/attachmentIndex";
import { parseRoute, boardHref } from "../src/lib/router";
import { type Attachment, type Card, emptyState } from "../src/model";

const file = (id: string, name: string, extra: Partial<Attachment> = {}): Attachment => ({
  id,
  name,
  mimeType: "",
  size: 1000,
  status: "local",
  ...extra,
});
const card = (id: string, listId: string, attachments: Attachment[]): Card => ({
  id,
  boardId: "b",
  listId,
  name: id,
  description: "",
  position: 1,
  labelIds: [],
  checklists: [],
  comments: [],
  attachments,
});

describe("board attachments", () => {
  it("tells the kind of an attachment", () => {
    const kinds = [
      file("1", "photo.JPG"),
      file("2", "clip.mp4", { mimeType: "video/mp4" }),
      file("3", "spec.pdf"),
      file("4", "notes.md"),
      file("5", "budget.xlsx"),
      file("6", "backup.zip"),
      file("7", "Site", { status: "link", sourceUrl: "https://example.com" }),
      file("8", "data.bin"),
    ].map(attachmentKind);
    expect(kinds).toEqual(["image", "video", "pdf", "document", "document", "archive", "link", "other"]);
  });

  const state = {
    ...emptyState(),
    lists: [
      { id: "todo", boardId: "b", name: "Todo", position: 1 },
      { id: "done", boardId: "b", name: "Done", position: 2 },
    ],
  };
  const cards = [
    card("Design", "todo", [
      file("a", "mockup.png", { size: 5000, addedAt: "2026-11-02T10:00:00.000Z" }),
      file("b", "brief.pdf", { size: 200, addedAt: "2026-11-05T10:00:00.000Z" }),
    ]),
    card("Release", "done", [file("c", "notes 10.txt", { size: 50 }), file("d", "notes 9.txt", { size: 70 })]),
  ];
  const items = boardAttachments(state, cards);
  const names = (options: Partial<Parameters<typeof findAttachments>[1]>) =>
    findAttachments(items, { query: "", kind: "", listId: "", sort: "newest", ...options }).map(
      (item) => item.attachment.name,
    );

  it("searches file, card and list names and filters by kind and list", () => {
    expect(items.map((item) => item.list?.name)).toEqual(["Todo", "Todo", "Done", "Done"]);
    expect(names({ query: "design PDF" })).toEqual(["brief.pdf"]);
    expect(names({ query: "done" })).toEqual(["notes 9.txt", "notes 10.txt"]);
    expect(names({ kind: "image" })).toEqual(["mockup.png"]);
    expect(names({ listId: "todo", kind: "document" })).toEqual([]);
  });

  it("sorts by date with undated ones last, by name, size and card", () => {
    expect(names({})).toEqual(["brief.pdf", "mockup.png", "notes 9.txt", "notes 10.txt"]);
    expect(names({ sort: "oldest" })).toEqual(["mockup.png", "brief.pdf", "notes 9.txt", "notes 10.txt"]);
    expect(names({ sort: "name" })).toEqual(["brief.pdf", "mockup.png", "notes 9.txt", "notes 10.txt"]);
    expect(names({ sort: "largest" })).toEqual(["mockup.png", "brief.pdf", "notes 9.txt", "notes 10.txt"]);
    expect(names({ sort: "card" })).toEqual(["brief.pdf", "mockup.png", "notes 9.txt", "notes 10.txt"]);
  });

  it("formats sizes and keeps the view in the address", () => {
    expect([formatSize(512), formatSize(1536), formatSize(5 * 1024 * 1024), formatSize(300 * 1024)]).toEqual([
      "512 B",
      "1.5 KB",
      "5.0 MB",
      "300 KB",
    ]);
    expect(boardHref("x", { view: "attachments" })).toBe("/b/x?view=attachments");
    expect(parseRoute("/b/x", "?view=attachments")).toMatchObject({ view: "attachments" });
    expect(parseRoute("/b/x", "?view=nope")).toMatchObject({ view: "lists" });
  });
});
