import { describe, expect, it } from "vitest";
import { applyDueRecurrence, nextDueDate } from "../src/repeatingDue";
import type { Card } from "../src/model";

const localDue = (year: number, month: number, day: number, hour = 9) =>
  new Date(year, month - 1, day, hour).toISOString();
const card: Card = {
  id: "card",
  boardId: "board",
  listId: "list",
  name: "Task",
  description: "",
  position: 1,
  labelIds: [],
  completed: false,
  checklists: [],
  comments: [],
  attachments: [],
  dueAt: localDue(2026, 3, 7),
  dueRepeat: { cadence: "daily", anchor: "2026-03-07" },
};

describe("repeating due dates", () => {
  it("keeps local time when a daily date crosses a clock change", () => {
    expect(nextDueDate(localDue(2026, 3, 7), { cadence: "daily", anchor: "2026-03-07" })).toBe(localDue(2026, 3, 8));
  });

  it("keeps the original weekday after the current due date is moved", () => {
    expect(nextDueDate(localDue(2026, 5, 14), { cadence: "weekly", anchor: "2026-05-13" })).toBe(localDue(2026, 5, 20));
  });

  it("handles the last day of short months and leap years", () => {
    const monthly = { cadence: "monthly" as const, anchor: "2027-01-31" };
    expect(nextDueDate(localDue(2027, 1, 31), monthly)).toBe(localDue(2027, 2, 28));
    expect(nextDueDate(localDue(2027, 2, 28), monthly)).toBe(localDue(2027, 3, 31));
    expect(nextDueDate(localDue(2028, 2, 29), { cadence: "yearly", anchor: "2028-02-29" })).toBe(localDue(2029, 2, 28));
  });

  it("resets completion and advances only on a new completion", () => {
    expect(applyDueRecurrence(card, { ...card, completed: true })).toMatchObject({
      completed: false,
      dueAt: localDue(2026, 3, 8),
    });
    expect(applyDueRecurrence({ ...card, completed: true }, { ...card, completed: true })).toMatchObject({
      completed: true,
      dueAt: card.dueAt,
    });
    expect(applyDueRecurrence(card, { ...card, name: "Edited" })).toMatchObject({
      completed: false,
      dueAt: card.dueAt,
    });
  });
});
