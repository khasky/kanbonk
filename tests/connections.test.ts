import { describe, expect, it } from "vitest";
import { type AppState, type Card, emptyState } from "../src/model";
import {
  allConnections,
  canConnect,
  cardConnections,
  connect,
  connectionBadges,
  disconnect,
  epicOf,
  subCardProgress,
} from "../src/model/connections";
import { mergeDuplicate } from "../src/model/dedupe";
import { emptyTrash, moveToTrash } from "../src/model/trash";

const card = (id: string, extra: Partial<Card> = {}): Card => ({
  id,
  boardId: "b1",
  listId: "l1",
  name: id.toUpperCase(),
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
  workspaces: [{ id: "w1", name: "W" }],
  boards: ["b1", "b2"].map((id) => ({
    id,
    workspaceId: "w1",
    name: `Board ${id}`,
    description: "",
    background: "#0c66e4",
    starred: false,
  })),
  lists: [
    { id: "l1", boardId: "b1", name: "To do", position: 1 },
    { id: "l2", boardId: "b2", name: "Other", position: 1 },
  ],
  cards,
});

// An epic with a sub-epic, which holds two sub-cards (one done); another card on board 2.
const cards = () => [
  card("epic", { isEpic: true }),
  card("sub", { isEpic: true, parentCardId: "epic" }),
  card("a", { parentCardId: "sub", doneAt: "2026-01-01" }),
  card("b", { parentCardId: "sub" }),
  card("c"),
  card("far", { boardId: "b2", listId: "l2" }),
];

const apply = (current: AppState, kind: Parameters<typeof connect>[1], from: string, to: string) =>
  connect(current, kind, from, to).state;

describe("card connections", () => {
  it("connects cards in every way and lists the links from both sides", () => {
    let next = state(cards());
    next = apply(next, "blocks", "c", "b");
    next = apply(next, "relates", "c", "far");
    next = apply(next, "duplicates", "far", "a");
    next = apply(next, "parent", "epic", "c");
    const of = (id: string) =>
      Object.fromEntries(
        Object.entries(cardConnections(next, id)).map(([group, items]) => [group, items.map((item) => item.card.id)]),
      );
    expect(of("c")).toMatchObject({ parent: ["epic"], blocks: ["b"], relates: ["far"] });
    expect(of("b")).toMatchObject({ parent: ["sub"], blockedBy: ["c"] });
    expect(of("far")).toMatchObject({ relates: ["c"], duplicates: ["a"] });
    expect(of("a")).toMatchObject({ duplicatedBy: ["far"] });
    expect(next.cards.find((item) => item.id === "b")?.checklists[0].items[0].linkedCardId).toBe("c");
  });

  it("refuses repeats, loops, reversed duplicates and parents on other boards", () => {
    let next = apply(state(cards()), "relates", "c", "far");
    next = apply(next, "duplicates", "a", "b");
    next = apply(next, "blocks", "a", "c");
    expect(canConnect(next, "relates", "far", "c")).toBe(false);
    expect(canConnect(next, "duplicates", "b", "a")).toBe(false);
    expect(canConnect(next, "blocks", "c", "a")).toBe(false);
    expect(canConnect(next, "parent", "far", "c")).toBe(false);
    expect(canConnect(next, "parent", "b", "epic")).toBe(false);
    expect(canConnect(next, "relates", "c", "c")).toBe(false);
    expect(connect(next, "relates", "far", "c")).toMatchObject({ changed: [] });
  });

  it("removes a link whichever card holds it", () => {
    let next = apply(state(cards()), "relates", "c", "far");
    next = apply(next, "parent", "epic", "c");
    next = apply(next, "blocks", "c", "b");
    for (const connection of allConnections(next)) {
      if (connection.from === "sub" || (connection.from === "epic" && connection.to === "sub")) continue;
      next = disconnect(next, connection).state;
    }
    expect(
      allConnections(next)
        .map((item) => `${item.kind}:${item.from}>${item.to}`)
        .sort(),
    ).toEqual(["parent:epic>sub", "parent:sub>a", "parent:sub>b"]);
    expect(next.cards.find((item) => item.id === "c")?.links).toBeUndefined();
  });

  it("counts sub-card progress at every level, finds the epic and badges the tiles", () => {
    const next = apply(state(cards()), "blocks", "c", "b");
    expect(subCardProgress(next, "epic")).toEqual({ done: 1, total: 3 });
    expect(subCardProgress(next, "sub")).toEqual({ done: 1, total: 2 });
    expect(epicOf(next, next.cards.find((item) => item.id === "a")!)?.id).toBe("sub");
    const badges = connectionBadges(next);
    expect(badges.get("b")).toMatchObject({ blockers: 1, connections: 2, epic: "SUB" });
    expect(badges.get("epic")).toMatchObject({ progress: { done: 1, total: 3 } });
    expect(badges.get("sub")?.epic).toBe("EPIC");
  });

  it("drops links to purged cards and moves links and sub-cards when merging duplicates", () => {
    let next = apply(state(cards()), "relates", "c", "far");
    next = apply(next, "duplicates", "b", "c");
    const merged = mergeDuplicate(next, "c", "sub", "dev");
    expect(merged.cards.find((item) => item.id === "b")).toMatchObject({ parentCardId: "c", links: [{ cardId: "c" }] });
    expect(merged.cards.find((item) => item.id === "b")?.deletedAt).toBeUndefined();
    const purged = emptyTrash(moveToTrash(next, "card", "far", "dev"), "dev");
    expect(purged.cards.find((item) => item.id === "c")?.links).toBeUndefined();
  });
});
