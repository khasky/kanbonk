import { expect, it } from "vitest";
import type { Card } from "../src/model";
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
  expect(revisionChanges(undefined, card)).toBe("Oldest kept version");
  expect(revisionChanges(card, { ...card, automationRunKeys: ["x"] })).toBe("No changes");
  expect(
    revisionChanges(card, {
      ...card,
      description: "More",
      comments: [comment("1"), comment("2")],
      dueAt: "2026-02-01",
    }),
  ).toBe("Description, Dates, Comments (+2)");
  expect(revisionChanges({ ...card, comments: [comment("1")] }, card)).toBe("Comments (−1)");
  expect(revisionChanges(card, { ...card, listId: "l2", position: 5 })).toBe("Moved");
  expect(revisionChanges(card, { ...card, position: 5 })).toBe("Position");
  expect(revisionChanges(card, { ...card, deletedAt: "2026-01-02" })).toBe("Moved to Trash");
  expect(revisionChanges({ ...card, deletedAt: "2026-01-02" }, card)).toBe("Restored from Trash");
  expect(revisionChanges(card, { ...card, futureField: 1 } as Card)).toBe("Other changes");
});

it("gives the stored size of a version in KB", () => {
  expect(revisionSize({ ...card, description: "x".repeat(2048) })).toMatch(/^2\.\d KB$/);
});
