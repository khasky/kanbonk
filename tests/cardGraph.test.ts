import { describe, expect, it } from "vitest";
import { type AppState, type Card, emptyState, linkDependency } from "../src/model";
import { cardGraph } from "../src/model/cardGraph";
import { allConnections, canConnect } from "../src/model/connections";

const card = (id: string, extra: Partial<Card> = {}): Card => ({
  id,
  boardId: "b1",
  listId: "l1",
  name: id.toUpperCase(),
  description: "",
  position: id.charCodeAt(0),
  labelIds: [],
  checklists: [],
  comments: [],
  attachments: [],
  ...extra,
});

function board(cards: Card[]): AppState {
  let state: AppState = {
    ...emptyState(),
    workspaces: [{ id: "w1", name: "W" }],
    boards: ["b1", "b2"].map((id) => ({
      id,
      workspaceId: "w1",
      name: id,
      description: "",
      background: "#0c66e4",
      starred: false,
    })),
    lists: [
      { id: "l1", boardId: "b1", name: "To do", position: 1 },
      { id: "l9", boardId: "b2", name: "Other", position: 1 },
    ],
    cards,
  };
  // a → b → c (b waits on a, c waits on b); d is a sub-card of a; x on another board waits on c.
  for (const [dependent, prerequisite] of [
    ["b", "a"],
    ["c", "b"],
    ["x", "c"],
  ])
    state = linkDependency(state, dependent, prerequisite);
  return state;
}

const cards = () => [
  card("a"),
  card("b"),
  card("c"),
  card("d", { parentCardId: "a" }),
  card("e"),
  card("x", { boardId: "b2", listId: "l9" }),
];
const own = new Set(["a", "b", "c", "d", "e"]);

describe("card graph", () => {
  it("collects dependency and parent links", () => {
    expect(
      allConnections(board(cards())).map((edge) => `${edge.from}${edge.kind === "parent" ? "/" : ">"}${edge.to}`),
    ).toEqual(expect.arrayContaining(["a>b", "b>c", "c>x", "a/d"]));
  });

  it("lays cards out in columns after what they wait on, with statuses and how many wait", () => {
    const graph = cardGraph(board(cards()), own, { linkedOnly: true });
    const node = (id: string) => graph.nodes.find((item) => item.card.id === id)!;
    expect(graph.nodes.map((item) => item.card.id).sort()).toEqual(["a", "b", "c", "d", "x"]);
    expect([node("a").x, node("b").x, node("c").x, node("x").x]).toEqual(
      [...[node("a").x, node("b").x, node("c").x, node("x").x]].sort((p, q) => p - q),
    );
    expect(node("b").x).toBeGreaterThan(node("a").x);
    expect(node("d").x).toBe(node("b").x);
    expect(node("x").external).toBe(true);
    expect(node("a")).toMatchObject({ status: "open", blocking: 3 });
    expect(node("b").status).toBe("blocked");
    expect(cardGraph(board(cards()), own).nodes.map((item) => item.card.id)).toContain("e");
  });

  it("stops blocking once the prerequisite is done or ticked off", () => {
    const done = board(cards().map((item) => (item.id === "a" ? { ...item, doneAt: "2026-01-01" } : item)));
    const graph = cardGraph(done, own);
    expect(graph.nodes.find((item) => item.card.id === "b")?.status).toBe("open");
    expect(graph.nodes.find((item) => item.card.id === "a")?.status).toBe("done");
    const ticked = board(cards());
    ticked.cards = ticked.cards.map((item) =>
      item.id === "c"
        ? {
            ...item,
            checklists: item.checklists.map((list) => ({
              ...list,
              items: list.items.map((entry) => ({ ...entry, checked: true })),
            })),
          }
        : item,
    );
    expect(cardGraph(ticked, own).nodes.find((item) => item.card.id === "c")?.status).toBe("open");
  });

  it("refuses duplicate links, loops and cross-board parents", () => {
    const state = board(cards());
    expect(canConnect(state, "blocks", "a", "e")).toBe(true);
    expect(canConnect(state, "blocks", "a", "b")).toBe(false);
    expect(canConnect(state, "blocks", "c", "a")).toBe(false);
    expect(canConnect(state, "blocks", "a", "a")).toBe(false);
    expect(canConnect(state, "parent", "a", "e")).toBe(true);
    expect(canConnect(state, "parent", "a", "d")).toBe(false);
    expect(canConnect(state, "parent", "d", "a")).toBe(false);
    expect(canConnect(state, "parent", "x", "e")).toBe(false);
  });
});
