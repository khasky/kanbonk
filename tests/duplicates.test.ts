import { describe, expect, it } from "vitest";
import { type AppState, type Card, emptyState } from "../src/model";
import {
  editDistance,
  findBoardDuplicates,
  type MatchLevel,
  mergeDuplicate,
  mergeParts,
  pairKey,
  titleMatch,
  titleWords,
} from "../src/model/dedupe";
import { visibleState } from "../src/model/trash";

const card = (id: string, name: string, extra: Partial<Card> = {}): Card => ({
  id,
  boardId: "b1",
  listId: "l1",
  name,
  description: "",
  position: 1,
  labelIds: [],
  checklists: [],
  comments: [],
  attachments: [],
  ...extra,
});

const state = (cards: Card[]): AppState => ({
  ...emptyState(),
  workspaces: [{ id: "w1", name: "Team" }],
  boards: ["b1", "b2"].map((id) => ({
    id,
    workspaceId: "w1",
    name: id,
    description: "",
    background: "#0c66e4",
    starred: false,
    members:
      id === "b1"
        ? [{ id: "m1", name: "Ann" }]
        : [
            { id: "m1", name: "Ann" },
            { id: "m2", name: "Bob" },
          ],
  })),
  lists: [
    { id: "l1", boardId: "b1", name: "To do", position: 1 },
    { id: "l2", boardId: "b1", name: "Doing", position: 2 },
    { id: "l9", boardId: "b2", name: "Other", position: 1 },
  ],
  labels: [
    { id: "red1", boardId: "b1", name: "Urgent", color: "red" },
    { id: "blue1", boardId: "b1", name: "Ops", color: "blue" },
    { id: "red2", boardId: "b2", name: "Urgent", color: "red" },
    { id: "green2", boardId: "b2", name: "Later", color: "green" },
  ],
  cards,
});

const pairs = (cards: Card[], level: MatchLevel, extra: { sameList?: boolean; ignored?: Set<string> } = {}) =>
  findBoardDuplicates(state(cards), "b1", { level, ...extra }).map((pair) => [
    [pair.keep.id, pair.drop.id].sort().join("-"),
    pair.reason,
  ]);

describe("title matching", () => {
  it("ignores capitals, accents and punctuation", () => {
    expect(titleWords("Café — Déjà-vu, ÉTÉ!")).toEqual(["cafe", "deja", "vu", "ete"]);
    expect(titleMatch("Pay the café bill!", "pay THE cafe bill")).toEqual({ reason: "same", score: 1 });
  });

  it("tells word order, typos and extra words apart", () => {
    expect(titleMatch("Login bug fix", "Fix login bug")?.reason).toBe("order");
    expect(titleMatch("Invoce Acme", "Invoice Acme")?.reason).toBe("typo");
    expect(titleMatch("Acme invoce", "Invoice Acme")?.reason).toBe("typo");
    expect(titleMatch("Send invoice Acme today", "Send invoice Acme")?.reason).toBe("extra");
  });

  it("does not take different numbers or short words for typos", () => {
    expect(titleMatch("Task 1", "Task 2")).toBeUndefined();
    expect(titleMatch("Buy cat", "Buy car")).toBeUndefined();
    expect(titleMatch("Release notes", "Release plans")).toBeUndefined();
    expect(titleMatch("Bug", "Bug fix")).toBeUndefined();
  });

  it("measures edit distance and stops past the limit", () => {
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("kitten", "sitting", 1)).toBe(2);
  });
});

describe("board duplicates", () => {
  const cards = [
    card("a", "Invoice Acme"),
    card("b", "invoice: ACME", { listId: "l2" }),
    card("c", "Invoce Acme"),
    card("d", "Acme invoice"),
    card("e", "Send the invoice to Acme today"),
    card("f", "Buy milk"),
    card("g", "Invoice Acme", { boardId: "b2", listId: "l9" }),
    card("h", "Invoice Acme", { isTemplate: true }),
    card("i", "Invoice Acme", { deletedAt: "2026-01-01" }),
  ];

  it("finds more pairs at each looser level, with the closest reason", () => {
    expect(pairs(cards, "strict")).toEqual([["a-b", "same"]]);
    const normal = pairs(cards, "normal");
    expect(normal).toEqual(
      expect.arrayContaining([
        ["a-b", "same"],
        ["a-d", "order"],
        ["b-d", "order"],
        ["a-c", "typo"],
        ["b-c", "typo"],
        ["c-d", "typo"],
      ]),
    );
    expect(normal).toHaveLength(6);
    expect(pairs(cards, "loose")).toEqual(expect.arrayContaining([["a-e", "extra"]]));
    expect(pairs(cards, "loose").some(([key]) => key.includes("f") || key.includes("g"))).toBe(false);
  });

  it("pairs only cards in the same list on request, and skips dismissed pairs", () => {
    expect(pairs(cards, "strict", { sameList: true })).toEqual([]);
    expect(pairs(cards, "normal", { ignored: new Set([pairKey("a", "b")]) }).map(([key]) => key)).not.toContain("a-b");
  });

  it("finds cards whose text says the same at the loose level", () => {
    const text = "Collect the quarterly expense receipts from the travel team and file them";
    const others = ["Plan the offsite", "Fix the login page", "Order new laptops", "Write release notes"];
    const similar = [
      card("x", "Collect the travel receipts", { description: text }),
      card("y", "Travel receipts to file", { description: text }),
      ...others.map((name, index) => card(`o${index}`, name)),
    ];
    expect(pairs(similar, "normal")).toEqual([]);
    expect(pairs(similar, "loose")).toEqual([["x-y", "similar"]]);
  });

  it("keeps the fuller card", () => {
    const [pair] = findBoardDuplicates(
      state([card("a", "Invoice Acme"), card("b", "Invoice Acme", { description: "Due Friday" })]),
      "b1",
    );
    expect([pair.keep.id, pair.drop.id]).toEqual(["b", "a"]);
  });
});

describe("merging duplicates", () => {
  const keep = card("k", "Invoice Acme", {
    labelIds: ["red1"],
    memberIds: ["m1"],
    comments: [{ id: "c1", text: "first", author: "A", createdAt: "2026-01-01" }],
  });
  const drop = card("d", "Invoce Acme", {
    boardId: "b2",
    listId: "l9",
    description: "Net 30",
    labelIds: ["red2", "green2"],
    memberIds: ["m1", "m2"],
    dueAt: "2026-02-01",
    comments: [{ id: "c2", text: "second", author: "B", createdAt: "2026-01-02" }],
    checklists: [{ id: "k1", name: "Steps", items: [] }],
  });

  it("lists what moves: labels by name and colour, members on the kept board", () => {
    const parts = mergeParts(state([keep, drop]), keep, drop);
    expect(parts).toMatchObject({
      description: "Net 30",
      comments: [{ id: "c2" }],
      checklists: [{ id: "k1" }],
      labelIds: [],
      memberIds: [],
      dates: true,
    });
    const sameBoard = { ...drop, boardId: "b1", listId: "l1", labelIds: ["blue1", "red1"] };
    expect(mergeParts(state([keep, sameBoard]), keep, sameBoard)).toMatchObject({
      labelIds: ["blue1"],
      memberIds: ["m2"],
    });
  });

  it("moves the content, links both cards with comments and trashes the duplicate", () => {
    const sameBoard = { ...drop, boardId: "b1", listId: "l1", labelIds: ["blue1"] };
    const merged = mergeDuplicate(
      state([keep, sameBoard]),
      "k",
      "d",
      "dev",
      { author: "Ann", kept: "Merged with [Invoce Acme](/c/d).", dropped: "Merged into [Invoice Acme](/c/k)." },
      "2026-03-01T00:00:00.000Z",
    );
    const kept = merged.cards.find((item) => item.id === "k")!;
    expect(kept.description).toBe("Net 30");
    expect(kept.labelIds).toEqual(["red1", "blue1"]);
    expect(kept.memberIds).toEqual(["m1", "m2"]);
    expect(kept.dueAt).toBe("2026-02-01");
    expect(kept.checklists.map((item) => item.id)).toEqual(["k1"]);
    expect(kept.comments.map((item) => item.text)).toEqual(["first", "second", "Merged with [Invoce Acme](/c/d)."]);
    expect(kept.comments[2]).toMatchObject({ author: "Ann", authorDeviceId: "dev" });
    const dropped = merged.cards.find((item) => item.id === "d")!;
    expect(dropped.deletedAt).toBeTruthy();
    expect(dropped.comments.at(-1)?.text).toBe("Merged into [Invoice Acme](/c/k).");
    expect(visibleState(merged).cards.map((item) => item.id)).toEqual(["k"]);
  });
});
