import { describe, expect, it } from "vitest";
import { validState } from "../src/backup/backup";
import {
  type AppState,
  type Card,
  duplicateLabels,
  emptyState,
  labelUsage,
  mergeLabels,
  deleteLabels,
  unusedLabels,
} from "../src/model";

const task = (id: string, labelIds: string[], extra: Partial<Card> = {}): Card => ({
  id,
  boardId: "b",
  listId: "l",
  name: id,
  description: "",
  position: 1,
  labelIds,
  checklists: [],
  comments: [],
  attachments: [],
  ...extra,
});
const label = (id: string, name: string, boardId = "b") => ({ id, boardId, name, color: "#61bd4f" });

const base = (): AppState => ({
  ...emptyState(),
  boards: [
    {
      id: "b",
      workspaceId: "w",
      name: "B",
      description: "",
      background: "#0c66e4",
      starred: false,
      automationRules: [{ id: "r", listId: "l", action: "add-label", labelId: "rule" }],
      requiredFields: { labelIds: ["bug2"] },
    },
  ],
  lists: [{ id: "l", boardId: "b", name: "L", position: 1 }],
  labels: [
    label("bug1", "Bug"),
    label("bug2", " bug "),
    label("bug3", "BUG"),
    label("idle", "Idle"),
    label("rule", "Rule"),
    label("trashed", "Old"),
    label("template", "Template"),
    label("blank1", ""),
    label("blank2", ""),
    label("other", "Idle", "elsewhere"),
    { ...label("gone", "Gone"), deleted: true },
  ],
  cards: [
    task("a", ["bug1", "bug2"]),
    task("b", ["bug1"]),
    task("c", ["bug3"]),
    task("d", ["trashed"], { deletedAt: "2026-11-01T00:00:00.000Z" }),
    task("e", ["template"], { isTemplate: true }),
  ],
});
const ids = (labels: { id: string }[]) => labels.map((item) => item.id);

describe("label cleanup", () => {
  it("finds labels on no card and in no rule, counting templates and trashed cards as use", () => {
    expect(ids(unusedLabels(base(), "b")).sort()).toEqual(["blank1", "blank2", "idle"]);
    const usage = labelUsage(base(), "b");
    expect(usage.at(-1)).toMatchObject({ label: { id: "bug1" }, cards: 2 });
    expect(usage.find((item) => item.label.id === "rule")).toMatchObject({ cards: 0, inRules: true });
    expect(usage.some((item) => item.label.id === "gone" || item.label.id === "other")).toBe(false);
  });

  it("groups named labels that differ only in case or spaces, the most used first", () => {
    expect(duplicateLabels(base(), "b").map((group) => group.map((item) => item.label.id))).toEqual([
      ["bug1", "bug2", "bug3"],
    ]);
  });

  it("deletes labels into the trash", () => {
    const state = deleteLabels(base(), ["idle", "blank1"], "laptop");
    expect(state.labels.filter((item) => item.deleted).map((item) => item.id)).toEqual(["idle", "blank1", "gone"]);
    expect(unusedLabels(state, "b").map((item) => item.id)).toEqual(["blank2"]);
  });

  it("merges duplicates into the kept label on cards, rules and required fields", () => {
    const state = mergeLabels(base(), "bug3", ["bug1", "bug2"], "laptop");
    expect(state.cards.map((item) => item.labelIds)).toEqual([["bug3"], ["bug3"], ["bug3"], ["trashed"], ["template"]]);
    expect(state.boards[0].requiredFields?.labelIds).toEqual(["bug3"]);
    expect(state.labels.find((item) => item.id === "bug3")).toMatchObject({ name: "BUG" });
    expect(state.labels.find((item) => item.id === "bug3")?.deleted).toBeUndefined();
    expect(state.labels.filter((item) => ["bug1", "bug2"].includes(item.id)).every((item) => item.deleted)).toBe(true);
    expect(duplicateLabels(state, "b")).toEqual([]);
    expect(validState(state as unknown as Record<string, unknown>)).toBe(true);
    expect(mergeLabels(state, "bug3", ["bug3"], "laptop")).toBe(state);
  });
});
