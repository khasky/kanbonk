import { describe, expect, it } from "vitest";
import { dueReminders, reminderSignature } from "../src/model/reminders";
import { emptyState, type AppState, type Card } from "../src/model";

const now = Date.parse("2026-11-15T12:00:00.000Z");
const dueAt = "2026-11-15T13:00:00.000Z";
const card: Card = {
  id: "card",
  boardId: "board",
  listId: "list",
  name: "Task",
  description: "",
  position: 1,
  labelIds: [],
  dueAt,
  dueReminderMinutes: 60,
  checklists: [],
  comments: [],
  attachments: [],
};

function fixture(): AppState {
  return {
    ...emptyState(),
    boards: [
      { id: "board", workspaceId: "workspace", name: "Board", description: "", background: "#fff", starred: false },
    ],
    lists: [{ id: "list", boardId: "board", name: "List", position: 1 }],
    cards: [card],
  };
}

describe("local due reminders", () => {
  it("shows a reminder when its scheduled time arrives", () => {
    const state = fixture();
    expect(dueReminders(state, now - 1, {})).toEqual([]);
    expect(dueReminders(state, now, {})).toEqual([card]);
    expect(dueReminders(state, now + 25 * 60 * 60 * 1000, {})).toEqual([]);
  });

  it("hides dismissed and unavailable cards", () => {
    const state = fixture();
    expect(dueReminders(state, now, { card: reminderSignature(card) })).toEqual([]);
    state.lists[0].deletedAt = "2026-01-01T00:00:00.000Z";
    expect(dueReminders(state, now, {})).toEqual([]);
  });

  it("shows a new reminder when the due date changes after dismissal", () => {
    const state = fixture();
    state.cards[0] = { ...card, dueAt: "2026-11-15T14:00:00.000Z", dueReminderMinutes: 120 };
    expect(dueReminders(state, now, { card: reminderSignature(card) })).toEqual([state.cards[0]]);
    state.cards[0] = { ...card, dueReminderMinutes: undefined };
    expect(dueReminders(state, now, {})).toEqual([]);
  });
});
