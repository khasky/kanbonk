import { describe, expect, it } from "vitest";
import { emptyState, recordRevision, type AppState, type Card } from "../src/model";
import {
  calendarItems,
  cardCreatedAt,
  dayKey,
  itemsInMonth,
  layoutWeek,
  monthWeeks,
  parseDay,
  startOfWeek,
} from "../src/calendar";
import { boardHref, parseRoute, trashHref } from "../src/router";
import { exportTrelloCsv, exportTrelloJson, parseCsv, parseTrelloCsv } from "../src/trello/formats";
import { parseTrelloBoard } from "../src/trello/import";
import { findDuplicates, mergeDuplicate, stems } from "../src/dedupe";
import { htmlToMarkdown, type MdNode } from "../src/htmlToMarkdown";
import { createSyncBundle, openSyncBundle, trustDevice } from "../src/devices";
import { retainSnapshots } from "../src/autoBackup";
import { visibleState } from "../src/trash";

const card = (id: string, extra: Partial<Card> = {}): Card => ({
  id,
  boardId: "b1",
  listId: "l1",
  name: id,
  description: "",
  position: 1,
  labelIds: [],
  completed: false,
  checklists: [],
  comments: [],
  attachments: [],
  ...extra,
});

describe("router", () => {
  it("parses application pages", () => {
    expect(parseRoute("/")).toEqual({ page: "home" });
    expect(parseRoute("/trash", "?type=cards")).toEqual({ page: "trash", kind: "card" });
    expect(parseRoute("/w/DMZD8gZ6")).toEqual({ page: "workspace", id: "DMZD8gZ6" });
    expect(parseRoute("/b/xFMshjkz/slug", "?view=calendar&scale=week&date=2026-11-15")).toEqual({
      page: "board",
      id: "xFMshjkz",
      view: "calendar",
      scale: "week",
      date: "2026-11-15",
    });
    expect(parseRoute("/c/G8nCPn9l", "", { backgroundHref: "/b/xFMshjkz?view=calendar" })).toEqual({
      page: "card",
      id: "G8nCPn9l",
      background: { page: "board", id: "xFMshjkz", view: "calendar", scale: "month", date: undefined },
    });
    expect(parseRoute("/c/G8nCPn9l")).toEqual({ page: "card", id: "G8nCPn9l", background: undefined });
    expect(parseRoute("/nope/x/y")).toEqual({ page: "not-found" });
    expect(trashHref("board")).toBe("/trash?type=boards");
    expect(boardHref("yaCtr8mP", { view: "calendar", scale: "year", date: "2026-01-01" })).toBe(
      "/b/yaCtr8mP?view=calendar&scale=year&date=2026-01-01",
    );
  });
});

describe("calendar", () => {
  it("uses start date or creation date and stretches to a later due date", () => {
    const state: AppState = {
      ...emptyState(),
      cards: [
        card("a", { createdAt: "2026-11-03T10:00:00", dueAt: "2026-11-05T10:00:00" }),
        card("b", { startAt: "2026-11-04T09:00:00", createdAt: "2026-10-01T00:00:00" }),
        card("c", { createdAt: "2026-11-06T00:00:00", dueAt: "2026-11-01T00:00:00" }),
        card("d", { sourceTrelloId: "5f5a6b000000000000000000" }),
      ],
    };
    const items = calendarItems(state, state.cards);
    const span = (id: string) => {
      const item = items.find((entry) => entry.card.id === id)!;
      return [dayKey(item.start), dayKey(item.end)];
    };
    expect(span("a")).toEqual(["2026-11-03", "2026-11-05"]);
    expect(span("b")).toEqual(["2026-11-04", "2026-11-04"]);
    expect(span("c")).toEqual(["2026-11-06", "2026-11-06"]);
    expect(cardCreatedAt(state, state.cards[3])).toBe("2020-09-10T18:05:52.000Z");
    const week = layoutWeek(startOfWeek(parseDay("2026-11-04")), items);
    expect(week.segments.map((segment) => [segment.item.card.id, segment.column, segment.span, segment.lane])).toEqual([
      ["a", 1, 3, 0],
      ["b", 2, 1, 1],
      ["c", 4, 1, 0],
    ]);
    expect(monthWeeks(parseDay("2026-11-15"), items)).toHaveLength(6);
    expect(itemsInMonth(items, 2026, 10).map((item) => item.card.id)).toEqual(["a", "b", "c"]);
  });

  it("falls back to the first revision when no creation date is stored", () => {
    const state = recordRevision({ ...emptyState(), cards: [card("x")] }, "card", "x", "d");
    expect(cardCreatedAt(state, state.cards[0])).toBe(state.revisions[0].createdAt);
  });
});

function board(): AppState {
  return {
    ...emptyState(),
    workspaces: [{ id: "w1", name: "Team" }],
    boards: [
      {
        id: "b1",
        workspaceId: "w1",
        name: "Marketing",
        description: "Description",
        background: "#0c66e4",
        starred: false,
        members: [{ id: "m1", name: "Anna" }],
      },
    ],
    lists: [
      { id: "l1", boardId: "b1", name: "To do", position: 1 },
      { id: "l2", boardId: "b1", name: "Done", position: 2 },
    ],
    labels: [{ id: "lab", boardId: "b1", name: "Important", color: "#f87168" }],
    cards: [
      card("c1", {
        name: 'Launch, "ads"',
        description: "line 1\nline 2",
        labelIds: ["lab"],
        memberIds: ["m1"],
        startAt: "2026-11-01T00:00:00.000Z",
        dueAt: "2026-11-10T00:00:00.000Z",
        createdAt: "2026-10-01T00:00:00.000Z",
        comments: [{ id: "cm", text: "Comment", author: "Anna", createdAt: "2026-10-02T00:00:00.000Z" }],
        checklists: [
          {
            id: "k1",
            name: "Steps",
            items: [
              { id: "i1", name: "One", checked: true },
              { id: "i2", name: "c2", checked: false, linkedCardId: "c2" },
            ],
          },
        ],
      }),
      card("c2", { listId: "l2", name: "Report", completed: true, archived: true }),
    ],
  };
}

describe("Trello formats", () => {
  it("exports Trello-shaped JSON that the Trello importer restores", () => {
    const json = exportTrelloJson(board(), "b1");
    const imported = parseTrelloBoard(JSON.parse(JSON.stringify(json)), "w9");
    expect(imported.board).toMatchObject({ name: "Marketing", description: "Description", background: "#0c66e4" });
    expect(imported.lists.map((list) => list.name)).toEqual(["To do", "Done"]);
    const first = imported.cards.find((item) => item.name === 'Launch, "ads"')!;
    expect(first).toMatchObject({
      description: "line 1\nline 2",
      startAt: "2026-11-01T00:00:00.000Z",
      dueAt: "2026-11-10T00:00:00.000Z",
      createdAt: "2026-10-01T00:00:00.000Z",
    });
    expect(first.comments.map((item) => [item.author, item.text])).toEqual([["Anna", "Comment"]]);
    expect(
      first.checklists[0].items.map((item) => [
        item.name.startsWith("https://trello.com/c/c2") ? "link" : item.name,
        item.checked,
      ]),
    ).toEqual([
      ["One", true],
      ["link", false],
    ]);
    expect(imported.labels).toMatchObject([{ name: "Important", color: "#f87168" }]);
    expect(imported.board.members?.map((member) => member.name)).toEqual(["Anna"]);
    expect(imported.cards.find((item) => item.name === "Report")).toMatchObject({ archived: true, completed: true });
  });

  it("exports Trello CSV columns and imports them back", () => {
    const csv = exportTrelloCsv(board(), "b1");
    const rows = parseCsv(csv);
    expect(rows[0].slice(0, 4)).toEqual(["Card ID", "Card Name", "Card URL", "Card Description"]);
    expect(rows[1][1]).toBe('Launch, "ads"');
    expect(rows[1][3]).toBe("line 1\nline 2");
    expect(rows[1][4]).toBe("Important (red)");
    const imported = parseTrelloCsv(csv, "w1");
    expect(imported.board.name).toBe("Marketing");
    expect(imported.lists.map((list) => list.name)).toEqual(["To do", "Done"]);
    expect(imported.cards[0]).toMatchObject({
      name: 'Launch, "ads"',
      dueAt: "2026-11-10T00:00:00.000Z",
      startAt: "2026-11-01T00:00:00.000Z",
      memberIds: [imported.board.members![0].id],
    });
    expect(imported.labels).toMatchObject([{ name: "Important", color: "#f87168" }]);
    expect(imported.cards[1]).toMatchObject({ archived: true, completed: true });
  });
});

describe("semantic dedupe", () => {
  it("finds inflected near-duplicates across boards and merges them", () => {
    const state: AppState = {
      ...board(),
      cards: [
        card("a", {
          name: "Prepare the report on the advertising campaign",
          description: "Expense summary",
          comments: [{ id: "x", text: "from a", author: "A", createdAt: "2026-01-01" }],
        }),
        card("b", {
          boardId: "b2",
          listId: "l9",
          name: "Preparing reports on advertising campaigns",
          description: "Expense summary",
        }),
        card("c", { boardId: "b2", listId: "l9", name: "Buy milk" }),
        card("d", { name: "Prepare the report on the advertising campaign" }),
        card("e", {
          boardId: "b3",
          listId: "l8",
          name: "Linked",
          checklists: [
            { id: "k", name: "Dependencies", items: [{ id: "i", name: "b", checked: false, linkedCardId: "b" }] },
          ],
        }),
      ],
    };
    expect(stems("Preparing the reports")).toEqual(["prepar", "report"]);
    const pairs = findDuplicates(state);
    expect(pairs.map((pair) => [pair.a.id, pair.b.id].sort().join("-"))).toEqual(
      expect.arrayContaining(["a-b", "b-d"]),
    );
    expect(pairs.some((pair) => [pair.a.id, pair.b.id].includes("c"))).toBe(false);
    expect(pairs.some((pair) => [pair.a.id, pair.b.id].sort().join("-") === "a-d")).toBe(false);
    const merged = mergeDuplicate(state, "b", "a", "dev");
    expect(merged.cards.find((item) => item.id === "b")!.comments.map((item) => item.text)).toEqual(["from a"]);
    expect(visibleState(merged).cards.some((item) => item.id === "a")).toBe(false);
    const relinked = mergeDuplicate(state, "a", "b", "dev");
    expect(relinked.cards.find((item) => item.id === "e")!.checklists[0].items[0].linkedCardId).toBe("a");
  });
});

function element(nodeName: string, children: MdNode[] = [], attributes: Record<string, string> = {}): MdNode {
  return {
    nodeType: 1,
    nodeName,
    textContent: children.map((child) => child.textContent).join(""),
    childNodes: children,
    getAttribute: (name) => attributes[name] ?? null,
  };
}
const text = (value: string): MdNode => ({ nodeType: 3, nodeName: "#text", textContent: value, childNodes: [] });

describe("visual markdown editing", () => {
  it("converts edited HTML back to Markdown", () => {
    const root = element("DIV", [
      element("H2", [text("Heading")]),
      element("P", [
        element("STRONG", [text("Important")]),
        text(" and "),
        element("A", [text("link")], { href: "https://example.org" }),
        text(" a_b"),
      ]),
      element("UL", [
        element("LI", [text("first")]),
        element("LI", [element("INPUT", [], { checked: "" }), text(" done")]),
      ]),
      element("OL", [element("LI", [text("step")])]),
      element("BLOCKQUOTE", [element("P", [text("quote")])]),
      element("PRE", [element("CODE", [text("let x = 1;\n")])]),
      text("tail"),
    ]);
    expect(htmlToMarkdown(root)).toBe(
      "## Heading\n\n**Important** and [link](https://example.org) a\\_b\n\n- first\n- [x] done\n\n1. step\n\n> quote\n\n```\nlet x = 1;\n```\n\ntail",
    );
  });
});

describe("devices", () => {
  it("encrypts a sync bundle for a trusted device and opens it with that device's code", async () => {
    const code = "ab".repeat(16);
    const files = new Map([["f1", new Blob(["hello"], { type: "text/plain" })]]);
    const state = {
      ...board(),
      cards: [
        card("c", { attachments: [{ id: "f1", name: "a.txt", mimeType: "text/plain", size: 5, status: "local" }] }),
      ],
    };
    const bundle = await createSyncBundle(state, code, { deviceId: "pc", name: "PC" }, async (id) => files.get(id));
    const bytes = new Uint8Array(await bundle.arrayBuffer());
    await expect(openSyncBundle(bytes, ["cd".repeat(16)])).rejects.toThrow("Trusted devices");
    const opened = await openSyncBundle(bytes, ["cd".repeat(16), code]);
    expect(opened.sender).toEqual({ deviceId: "pc", name: "PC" });
    expect(opened.state.cards[0].id).toBe("c");
    expect(await opened.files[0].blob.text()).toBe("hello");
    expect(opened.files[0].blob.type).toBe("text/plain");
    const devices = trustDevice([], { deviceId: "pc", name: "PC" }, code, "2026-11-15");
    expect(trustDevice(devices, { deviceId: "pc", name: "New PC" }, "bad", "2026-11-16")).toEqual([
      { deviceId: "pc", name: "New PC", code, pairedAt: "2026-11-15", lastSyncAt: "2026-11-16" },
    ]);
  });
});

describe("automatic backups", () => {
  it("keeps the 20 newest snapshots plus one per day", () => {
    const metas = Array.from({ length: 60 }, (_, index) => ({
      id: `s${index}`,
      createdAt: new Date(Date.UTC(2026, 10, 15) - index * 6 * 3600_000).toISOString(),
      hash: String(index),
      size: 1,
      cards: 0,
      boards: 0,
    }));
    const kept = retainSnapshots(metas);
    expect(kept.slice(0, 20).map((item) => item.id)).toEqual(metas.slice(0, 20).map((item) => item.id));
    expect(new Set(kept.map((item) => item.createdAt.slice(0, 10))).size).toBe(16);
    expect(kept.length).toBe(20 + 16 - 6);
  });
});
