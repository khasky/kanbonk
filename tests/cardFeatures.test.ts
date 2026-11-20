import { expect, it } from "vitest";
import {
  cloneCard,
  createSubCard,
  emptyState,
  parentCandidates,
  subCards,
  type AppState,
  type Card,
} from "../src/model";
import { readableTextColor } from "../src/labels";
import { moveToTrash, purgeFromTrash, restoreFromTrash, visibleState } from "../src/trash";

const card = (id: string, position: number, extra: Partial<Card> = {}): Card => ({
  id,
  boardId: "b1",
  listId: "l1",
  name: id,
  description: "",
  position,
  labelIds: [],
  completed: false,
  checklists: [{ id: `k-${id}`, name: "K", items: [{ id: `i-${id}`, name: "x", checked: true }] }],
  comments: [],
  attachments: [],
  ...extra,
});

function sample(): AppState {
  return {
    ...emptyState(),
    workspaces: [{ id: "w1", name: "W" }],
    boards: [{ id: "b1", workspaceId: "w1", name: "B", description: "", background: "#000", starred: false }],
    lists: [
      { id: "l1", boardId: "b1", name: "L1", position: 1 },
      { id: "l2", boardId: "b1", name: "L2", position: 2 },
    ],
    cards: [
      card("a", 1),
      card("b", 2),
      card("child", 3, { parentCardId: "a" }),
      card("grand", 1, { parentCardId: "child", listId: "l2" }),
    ],
  };
}

it("clones a card right below the original with a Clone suffix", () => {
  const { state, cardId } = cloneCard(sample(), "a", "copy");
  const clone = state.cards.find((item) => item.id === cardId)!;
  expect(clone.name).toBe("a - Clone");
  expect(clone.listId).toBe("l1");
  const order = state.cards
    .filter((item) => item.listId === "l1")
    .sort((x, y) => x.position - y.position)
    .map((item) => item.id);
  expect(order).toEqual(["a", "copy", "b", "child"]);
  expect(clone.checklists[0].id).not.toBe("k-a");
  expect(clone.checklists[0].items[0].checked).toBe(true);
});

it("adds one more Clone suffix each time the same card is cloned again", () => {
  let state = sample();
  for (const id of ["c1", "c2", "c3"]) state = cloneCard(state, "a", id).state;
  expect(["c1", "c2", "c3"].map((id) => state.cards.find((item) => item.id === id)!.name)).toEqual([
    "a - Clone",
    "a - Clone - Clone",
    "a - Clone - Clone - Clone",
  ]);
});

it("lists sub-cards and excludes descendants from parent candidates", () => {
  const state = sample();
  expect(subCards(state, "a").map((item) => item.id)).toEqual(["child"]);
  expect(parentCandidates(state, "a").map((item) => item.id)).toEqual(["b"]);
});

it("trashes sub-cards with the parent and restores the parent chain for a sub-card", () => {
  const trashed = moveToTrash(sample(), "card", "a", "d");
  expect(visibleState(trashed).cards.map((item) => item.id)).toEqual(["b"]);
  const restored = restoreFromTrash(trashed, "card", "grand", "d");
  expect(restored.restored.map((item) => item.id).sort()).toEqual(["a", "child", "grand"]);
  const purged = purgeFromTrash(trashed, "card", "a", "d");
  expect(purged.cards.map((item) => item.id)).toEqual(["b"]);
});

it("creates a sub-card below the parent and its siblings", () => {
  const state = createSubCard(sample(), "a", "new", "s2");
  expect(state.cards.find((item) => item.id === "s2")?.parentCardId).toBe("a");
  const order = state.cards
    .filter((item) => item.listId === "l1")
    .sort((x, y) => x.position - y.position)
    .map((item) => item.id);
  expect(order).toEqual(["a", "b", "child", "s2"]);
});

it("picks readable text for custom colours", () => {
  expect(readableTextColor("#123456")).toBe("#ffffff");
  expect(readableTextColor("#ffd700")).toBe("#172b4d");
});
