import { describe, expect, it } from "vitest";
import { validState } from "../src/backup/backup";
import {
  type AppState,
  type Board,
  blockedMove,
  type Card,
  deleteLabel,
  emptyState,
  missingFields,
  type RequiredFields,
} from "../src/model";
import { missingFieldText, moveBlockedText } from "../src/model/requiredFieldsText";

const card = (change: Partial<Card> = {}): Card => ({
  id: "c1",
  boardId: "b1",
  listId: "todo",
  name: "Task",
  description: "",
  position: 1,
  labelIds: [],
  checklists: [],
  comments: [],
  attachments: [],
  ...change,
});
const board = (requiredFields?: RequiredFields): Board => ({
  id: "b1",
  workspaceId: "w1",
  name: "Board",
  description: "",
  background: "#0c66e4",
  starred: false,
  members: [{ id: "ann", name: "Ann" }],
  requiredFields,
});
const kinds = (item: Card, rules: RequiredFields) => missingFields(item, rules).map((entry) => entry.kind);

describe("required fields", () => {
  it("lists what a card lacks, in the order of the rules", () => {
    const all: RequiredFields = {
      description: true,
      members: true,
      startDate: true,
      dueDate: true,
      labels: true,
      checklists: true,
      checklistsDone: true,
    };
    expect(kinds(card(), all)).toEqual(["description", "members", "start", "due", "labels", "checklists"]);
    const filled = card({
      description: "Ready",
      memberIds: ["ann"],
      startAt: "2026-11-01T00:00:00.000Z",
      dueAt: "2026-11-02T00:00:00.000Z",
      labelIds: ["red"],
      checklists: [
        {
          id: "k",
          name: "QA",
          items: [
            { id: "i1", name: "a", checked: true },
            { id: "i2", name: "b", checked: false },
          ],
        },
      ],
    });
    expect(missingFields(filled, all)).toEqual([{ kind: "checklist-items", done: 1, total: 2 }]);
    expect(missingFields(card({ isTemplate: true }), all)).toEqual([]);
    expect(missingFields(card(), undefined)).toEqual([]);
  });

  it("checks specific members and labels, the description text and a checklist's name", () => {
    const rules: RequiredFields = {
      memberIds: ["ann"],
      labelIds: ["red", "blue"],
      descriptionRule: { op: "starts-with", text: " Goal: " },
      checklistName: "qa",
    };
    const item = card({ labelIds: ["blue"], description: "goal: ship it" });
    expect(missingFields(item, rules)).toEqual([
      { kind: "member", id: "ann" },
      { kind: "label", id: "red" },
      { kind: "checklist-name", name: "qa" },
    ]);
    expect(
      kinds(card({ description: "the goal: x" }), { descriptionRule: { op: "starts-with", text: "goal:" } }),
    ).toEqual(["description-text"]);
    expect(kinds(card({ description: "A GOAL" }), { descriptionRule: { op: "contains", text: "goal" } })).toEqual([]);
    expect(kinds(card({ description: "goal!" }), { descriptionRule: { op: "equals", text: "goal" } })).toEqual([
      "description-text",
    ]);
    expect(kinds(card({ checklists: [{ id: "k", name: " QA ", items: [] }] }), { checklistName: "qa" })).toEqual([]);
    const name = (id: string) => ({ ann: "Ann", red: "Red" })[id];
    expect(missingFields(item, rules).map((entry) => missingFieldText(entry, name))).toEqual([
      "Needs Ann",
      "Needs label Red",
      "No “qa” checklist",
    ]);
  });

  it("keeps an incomplete card in its list only when the board blocks moves", () => {
    const state = (rules: RequiredFields): AppState => ({ ...emptyState(), boards: [board(rules)], cards: [card()] });
    expect(blockedMove(state({ dueDate: true }), card(), "done")).toEqual([]);
    const blocking = state({ dueDate: true, memberIds: ["ann"], blockMoves: true });
    expect(blockedMove(blocking, card(), "todo")).toEqual([]);
    const missing = blockedMove(blocking, card(), "done");
    expect(moveBlockedText(blocking, card(), missing)).toBe(
      "“Task” stays in its list until it has its required fields: No due date, Needs Ann.",
    );
  });

  it("forgets a deleted label in the rules and keeps the rules in backups", () => {
    const state: AppState = {
      ...emptyState(),
      boards: [board({ labelIds: ["red", "blue"], dueDate: true })],
      labels: [{ id: "red", boardId: "b1", name: "Red", color: "#f00" }],
    };
    const next = deleteLabel(state, "red", "laptop");
    expect(next.boards[0].requiredFields).toEqual({ labelIds: ["blue"], dueDate: true });
    expect(next.revisions.map((item) => item.entityKind)).toEqual(["label", "board"]);
    expect(validState(next as unknown as Record<string, unknown>)).toBe(true);
    const broken = { ...next, boards: [board({ descriptionRule: { op: "near", text: "x" } } as never)] };
    expect(validState(broken as unknown as Record<string, unknown>)).toBe(false);
  });
});
