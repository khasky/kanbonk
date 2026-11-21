import { describe, expect, it } from "vitest";
import { applyCardButton, applyDueRules, applyMoveRules } from "../src/model/automation";
import { emptyState, type AppState, type Card } from "../src/model";

const card: Card = {
  id: "card",
  boardId: "board",
  listId: "todo",
  name: "Task",
  description: "",
  position: 1,
  labelIds: [],
  completed: false,
  checklists: [],
  comments: [],
  attachments: [],
};

function fixture(): AppState {
  return {
    ...emptyState(),
    boards: [
      {
        id: "board",
        workspaceId: "workspace",
        name: "Board",
        description: "",
        background: "#fff",
        starred: false,
        automationRules: [
          { id: "complete", listId: "done", action: "complete" },
          { id: "label", listId: "done", action: "add-label", labelId: "important" },
        ],
      },
    ],
    lists: [
      { id: "todo", boardId: "board", name: "Todo", position: 1 },
      { id: "done", boardId: "board", name: "Done", position: 2 },
    ],
    labels: [{ id: "important", boardId: "board", name: "Important", color: "#f00" }],
    cards: [card],
  };
}

describe("local move automation", () => {
  it("runs matching rules when a card enters a list", () => {
    const state = fixture();
    const moved = applyMoveRules(state, card, { ...card, listId: "done" });
    expect(moved).toMatchObject({ completed: true, labelIds: ["important"] });
    expect(applyMoveRules(state, card, { ...card, name: "Edited" })).toMatchObject({ completed: false, labelIds: [] });
    expect(applyMoveRules(state, moved, { ...moved, listId: "todo" })).toMatchObject({
      completed: true,
      labelIds: ["important"],
    });
  });

  it("moves to the trash on entry and ignores labels from another board", () => {
    const state = fixture();
    state.boards[0].automationRules = [
      { id: "trash", listId: "done", action: "trash" },
      { id: "foreign", listId: "done", action: "add-label", labelId: "foreign" },
    ];
    state.labels.push({ id: "foreign", boardId: "other", name: "Foreign", color: "#000" });
    const moved = applyMoveRules(state, card, { ...card, listId: "done" });
    expect(moved).toMatchObject({ labelIds: [] });
    expect(moved.deletedAt).toBeTruthy();
    expect(moved.deletedBatch).toBeTruthy();
  });

  it("moves the card's sub-cards to the trash with it, as deleting it by hand does", () => {
    const state = fixture();
    state.boards[0].automationRules = [{ id: "trash", listId: "", trigger: "due", action: "trash" }];
    state.cards = [
      { ...card, dueAt: "2026-11-16T12:00:00.000Z" },
      { ...card, id: "sub", parentCardId: "card", position: 2 },
    ];
    const next = applyDueRules(state, Date.parse("2026-11-16T12:00:01.000Z"), "device");
    const [parent, sub] = next.cards;
    expect(parent.deletedAt).toBeTruthy();
    expect(sub).toMatchObject({ deletedAt: parent.deletedAt, deletedBatch: parent.deletedBatch });
  });

  it("does not reapply a deleted label from an existing rule", () => {
    const state = fixture();
    state.labels[0].deleted = true;
    expect(applyMoveRules(state, card, { ...card, listId: "done" }).labelIds).toEqual([]);
  });

  it("runs a card button only when it is pressed on an active card of its board", () => {
    const state = fixture();
    state.boards[0].automationRules = [
      { id: "button", listId: "", trigger: "button", name: "Add important", action: "add-label", labelId: "important" },
    ];
    expect(applyMoveRules(state, card, { ...card, listId: "done" }).labelIds).toEqual([]);
    expect(applyCardButton(state, card, "button").labelIds).toEqual(["important"]);
    expect(applyCardButton(state, { ...card, boardId: "other" }, "button")).toEqual({ ...card, boardId: "other" });
    expect(applyCardButton(state, { ...card, deletedAt: "2026-01-01T00:00:00.000Z" }, "button")).toEqual({
      ...card,
      deletedAt: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("due date automation", () => {
  const due = "2026-11-16T12:00:00.000Z";
  const beforeDue = Date.parse(due) - 1;
  const afterDue = Date.parse(due) + 1;

  it("runs a day early once, including when the page opens after the trigger", () => {
    const state = fixture();
    state.cards[0] = { ...card, dueAt: due };
    state.boards[0].automationRules = [
      {
        id: "early",
        listId: "",
        trigger: "due",
        createdAt: "2026-11-14T12:00:00.000Z",
        leadMinutes: 1440,
        action: "add-label",
        labelId: "important",
      },
    ];
    const triggerTime = Date.parse(due) - 86_400_000;
    expect(applyDueRules(state, triggerTime - 1, "device")).toBe(state);
    const fired = applyDueRules(state, triggerTime + 60_000, "device");
    expect(fired.cards[0].labelIds).toEqual(["important"]);
    expect(applyDueRules(fired, afterDue, "device")).toBe(fired);
  });

  it("does not run an early rule created after its trigger time", () => {
    const state = fixture();
    state.cards[0] = { ...card, dueAt: due };
    state.boards[0].automationRules = [
      {
        id: "late",
        listId: "",
        trigger: "due",
        createdAt: "2026-11-15T12:01:00.000Z",
        leadMinutes: 1440,
        action: "archive",
      },
    ];
    expect(applyDueRules(state, afterDue, "device")).toBe(state);
  });

  it("runs at the due time once and keeps a card revision", () => {
    const state = fixture();
    state.boards[0].automationRules = [
      {
        id: "due-rule",
        listId: "",
        trigger: "due",
        createdAt: "2026-11-15T12:00:00.000Z",
        action: "add-label",
        labelId: "important",
      },
    ];
    state.cards[0] = { ...card, dueAt: due };
    expect(applyDueRules(state, beforeDue, "device")).toBe(state);
    const fired = applyDueRules(state, afterDue, "device");
    expect(fired.cards[0].labelIds).toEqual(["important"]);
    expect(fired.revisions.at(-1)?.snapshot).toMatchObject({ id: "card", labelIds: ["important"] });
    expect(applyDueRules(fired, afterDue + 60_000, "device")).toBe(fired);
  });

  it("catches up after reopening and does not run a rule created after the due time", () => {
    const state = fixture();
    state.cards[0] = { ...card, dueAt: due };
    state.boards[0].automationRules = [
      { id: "late-rule", listId: "", trigger: "due", createdAt: "2026-11-17T12:00:00.000Z", action: "trash" },
    ];
    expect(applyDueRules(state, afterDue + 2 * 86_400_000, "device")).toBe(state);
    state.boards[0].automationRules = [
      { ...state.boards[0].automationRules[0], id: "early-rule", createdAt: "2026-11-15T12:00:00.000Z" },
    ];
    expect(applyDueRules(state, afterDue + 2 * 86_400_000, "device").cards[0].deletedAt).toBeTruthy();
  });

  it("advances a recurring date once and can run at its next occurrence", () => {
    const state = fixture();
    state.cards[0] = { ...card, dueAt: due, dueRepeat: { cadence: "daily", anchor: "2026-11-16" } };
    state.boards[0].automationRules = [
      { id: "complete-due", listId: "", trigger: "due", createdAt: "2026-11-15T12:00:00.000Z", action: "complete" },
    ];
    const first = applyDueRules(state, afterDue, "device");
    expect(first.cards[0]).toMatchObject({ dueAt: "2026-11-17T12:00:00.000Z", completed: false });
    expect(applyDueRules(first, afterDue, "device")).toBe(first);
    const second = applyDueRules(first, Date.parse("2026-11-17T12:00:01.000Z"), "device");
    expect(second.cards[0]).toMatchObject({ dueAt: "2026-11-18T12:00:00.000Z", completed: false });
  });

  it("does not apply due rules during a move or to a completed card", () => {
    const state = fixture();
    state.boards[0].automationRules = [{ id: "due-rule", listId: "", trigger: "due", action: "trash" }];
    expect(applyMoveRules(state, card, { ...card, listId: "done" }).deletedAt).toBeUndefined();
    state.cards[0] = { ...card, dueAt: due, completed: true };
    expect(applyDueRules(state, afterDue, "device")).toBe(state);
  });
});
