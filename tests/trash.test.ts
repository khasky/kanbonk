import { expect, it } from "vitest";
import { emptyState, recordRevision, type AppState, type Card } from "../src/model";
import { mergeStates } from "../src/sync/sync";
import {
  dependentsOf,
  emptyTrash,
  moveToTrash,
  purgeExpired,
  purgeFromTrash,
  restoreFromTrash,
  trashDaysLeft,
  trashEntries,
  trashImpact,
  visibleState,
} from "../src/model/trash";

const card = (id: string, listId: string, extra: Partial<Card> = {}): Card => ({
  id,
  boardId: "b1",
  listId,
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

function sample(): AppState {
  let state: AppState = {
    ...emptyState(),
    workspaces: [{ id: "w1", name: "W" }],
    boards: [{ id: "b1", workspaceId: "w1", name: "B", description: "", background: "#000", starred: false }],
    lists: [
      { id: "l1", boardId: "b1", name: "L1", position: 1 },
      { id: "l2", boardId: "b1", name: "L2", position: 2 },
    ],
    cards: [
      card("c1", "l1"),
      card("c2", "l1"),
      card("c3", "l2", {
        checklists: [
          { id: "k", name: "Dependencies", items: [{ id: "i", name: "c1", checked: false, linkedCardId: "c1" }] },
        ],
      }),
    ],
  };
  for (const id of ["c1", "c2", "c3"]) state = recordRevision(state, "card", id, "d");
  return state;
}

it("trashes a list with its cards and hides them from the visible state", () => {
  const state = moveToTrash(sample(), "list", "l1", "d", { now: "2026-11-15T00:00:00.000Z" });
  const visible = visibleState(state);
  expect(visible.lists.map((item) => item.id)).toEqual(["l2"]);
  expect(visible.cards.map((item) => item.id)).toEqual(["c3"]);
  expect(trashEntries(state, "card").map((item) => [item.id, item.withParent])).toEqual([
    ["c1", true],
    ["c2", true],
  ]);
  expect(trashEntries(state, "list").map((item) => item.id)).toEqual(["l1"]);
});

it("reports dependent cards and can trash them together", () => {
  const state = sample();
  expect(dependentsOf(state, "c1").map((item) => item.id)).toEqual(["c3"]);
  expect(trashImpact(state, "card", "c1").dependents.map((item) => item.dependent.id)).toEqual(["c3"]);
  const trashed = moveToTrash(state, "card", "c1", "d", { withDependents: true });
  expect(visibleState(trashed).cards.map((item) => item.id)).toEqual(["c2"]);
});

it("restores through the dependency chain: parents, batch members and prerequisites", () => {
  let state = moveToTrash(sample(), "card", "c1", "d");
  state = moveToTrash(state, "board", "b1", "d");
  expect(visibleState(state).boards).toHaveLength(0);
  // Restoring c3 brings back its board and list (ancestors) and its deleted prerequisite c1.
  const { state: restored, restored: refs } = restoreFromTrash(state, "card", "c3", "d");
  const visible = visibleState(restored);
  expect(visible.boards.map((item) => item.id)).toEqual(["b1"]);
  expect(visible.cards.map((item) => item.id).sort()).toEqual(["c1", "c3"]);
  expect(refs.map((item) => `${item.kind}:${item.id}`).sort()).toEqual([
    "board:b1",
    "card:c1",
    "card:c3",
    "list:l1",
    "list:l2",
  ]);
  // c2 was deleted in the board batch and stays in the trash.
  expect(trashEntries(restored, "card").map((item) => item.id)).toEqual(["c2"]);
});

it("restoring a board restores only what was deleted with it", () => {
  let state = moveToTrash(sample(), "card", "c2", "d");
  state = moveToTrash(state, "board", "b1", "d");
  const restored = restoreFromTrash(state, "board", "b1", "d").state;
  expect(
    visibleState(restored)
      .cards.map((item) => item.id)
      .sort(),
  ).toEqual(["c1", "c3"]);
});

it("purges permanently, unlinks dependencies and propagates the purge through sync", () => {
  const base = sample();
  const purged = purgeFromTrash(moveToTrash(base, "card", "c1", "d"), "card", "c1", "d", "2026-11-15T00:00:00.000Z");
  expect(purged.cards.map((item) => item.id)).toEqual(["c2", "c3"]);
  expect(purged.cards.find((item) => item.id === "c3")!.checklists[0].items).toEqual([]);
  expect(purged.revisions.some((item) => item.entityId === "c1")).toBe(false);
  const merged = mergeStates(base, purged).state;
  expect(merged.cards.some((item) => item.id === "c1")).toBe(false);
  expect(merged.tombstones?.["card:c1"]).toBe("2026-11-15T00:00:00.000Z");
});

it("empties the whole trash", () => {
  const state = emptyTrash(moveToTrash(sample(), "list", "l2", "d"), "d");
  expect(state.lists.map((item) => item.id)).toEqual(["l1"]);
  expect(state.cards.map((item) => item.id)).toEqual(["c1", "c2"]);
  expect(trashEntries(state)).toEqual([]);
});

it("purges items 30 days after deletion and reports days left", () => {
  const day = 86_400_000;
  const deleted = Date.parse("2026-10-01T00:00:00.000Z");
  let state = moveToTrash(sample(), "list", "l1", "d", { now: new Date(deleted).toISOString() });
  state = moveToTrash(state, "card", "c3", "d", { now: new Date(deleted + 20 * day).toISOString() });
  expect(trashDaysLeft(new Date(deleted).toISOString(), deleted + 29.5 * day)).toBe(1);
  expect(purgeExpired(state, "d", deleted + 29 * day)).toBe(state);
  const purged = purgeExpired(state, "d", deleted + 30 * day);
  expect(purged.lists.map((item) => item.id)).toEqual(["l2"]);
  expect(purged.cards.map((item) => item.id)).toEqual(["c3"]);
  expect(purged.tombstones?.["card:c1"]).toBeDefined();
  expect(trashEntries(purged).map((item) => item.id)).toEqual(["c3"]);
});
