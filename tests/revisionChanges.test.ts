import { expect, it } from "vitest";
import type { Board, Card } from "../src/model";
import { revisionChanges, revisionSize } from "../src/panels/revisionChanges";

const card: Card = {
  id: "c1",
  boardId: "b1",
  listId: "l1",
  name: "Task",
  description: "",
  position: 1,
  labelIds: [],
  checklists: [],
  comments: [],
  attachments: [],
};
const comment = (id: string) => ({ id, text: "hi", author: "Me", createdAt: "2026-01-01T00:00:00.000Z" });

it("names the parts of an item that changed since the version before", () => {
  expect(revisionChanges(undefined, card)).toEqual(["Oldest kept version"]);
  expect(revisionChanges(card, { ...card, automationRunKeys: ["x"] })).toEqual(["No changes"]);
  expect(
    revisionChanges(card, {
      ...card,
      description: "More",
      comments: [comment("1"), comment("2")],
      dueAt: "2026-02-01",
    }),
  ).toEqual(["Description", "Dates", "Comments (+2)"]);
  expect(revisionChanges({ ...card, comments: [comment("1")] }, card)).toEqual(["Comments (−1)"]);
  expect(revisionChanges(card, { ...card, name: "Release" })).toEqual(["Title: “Task” → “Release”"]);
  expect(revisionChanges(card, { ...card, listId: "l2", position: 5 })).toEqual(["Moved"]);
  expect(revisionChanges(card, { ...card, position: 5 })).toEqual(["Position"]);
  expect(revisionChanges(card, { ...card, deletedAt: "2026-01-02" })).toEqual(["Moved to Trash"]);
  expect(revisionChanges({ ...card, deletedAt: "2026-01-02" }, card)).toEqual(["Restored from Trash"]);
  expect(revisionChanges(card, { ...card, futureField: 1 } as Card)).toEqual(["Other changes"]);
});

it("says which zones of a board were added, removed, renamed or recolored", () => {
  const board: Board = { id: "b1", workspaceId: "w", name: "Board", description: "", background: "", starred: false };
  const zones = [
    { id: "z1", name: "Dev", color: "#f00" },
    { id: "z2", name: "QA", color: "#0f0" },
  ];
  const after = [
    { id: "z1", name: "Development", color: "#00f" },
    { id: "z3", name: "Ops", color: "#0f0" },
  ];
  expect(revisionChanges({ ...board, zones }, { ...board, zones: after })).toEqual([
    "Zone “Dev” renamed to “Development”",
    "Zone “Development” color changed",
    "Zone “Ops” added",
    "Zone “QA” removed",
  ]);
});

it("gives the stored size of a version in KB", () => {
  expect(revisionSize({ ...card, description: "x".repeat(2048) })).toMatch(/^2\.\d KB$/);
});
