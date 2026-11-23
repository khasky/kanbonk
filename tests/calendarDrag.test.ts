import { expect, it } from "vitest";
import { calendarItems, dayKey, previewItem, rescheduleCard } from "../src/model/calendar";
import { emptyState, type Card } from "../src/model";

const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).toISOString();
const card = (extra: Partial<Card>): Card => ({
  id: "c",
  boardId: "b",
  listId: "l",
  name: "c",
  description: "",
  position: 1,
  labelIds: [],
  checklists: [],
  comments: [],
  attachments: [],
  createdAt: at(2026, 11, 2, 8),
  ...extra,
});
const item = (extra: Partial<Card>) => calendarItems(emptyState(), [card(extra)])[0];
const day = (iso?: string) => iso && dayKey(new Date(iso));

it("moves start and due together, keeping the time of day", () => {
  const next = rescheduleCard(item({ startAt: at(2026, 11, 3), dueAt: at(2026, 11, 5, 18) }), "move", 2);
  expect([day(next.startAt), day(next.dueAt)]).toEqual(["2026-11-05", "2026-11-07"]);
  expect(new Date(next.dueAt!).getHours()).toBe(18);
});

it("gives a card without dates a start date from its creation day when moved", () => {
  const next = rescheduleCard(item({}), "move", 1);
  expect(day(next.startAt)).toBe("2026-11-03");
  expect(next.dueAt).toBeUndefined();
});

it("resizes the end, creating or removing a due date", () => {
  const single = item({ startAt: at(2026, 11, 3) });
  expect(day(rescheduleCard(single, "end", 3).dueAt)).toBe("2026-11-06");
  expect(rescheduleCard(single, "end", -2).dueAt).toBeUndefined();
  const ranged = item({ startAt: at(2026, 11, 3), dueAt: at(2026, 11, 6) });
  expect(day(rescheduleCard(ranged, "end", -5).dueAt)).toBe("2026-11-03");
});

it("resizes the start without passing the end", () => {
  const ranged = item({ startAt: at(2026, 11, 3), dueAt: at(2026, 11, 6) });
  expect(day(rescheduleCard(ranged, "start", -1).startAt)).toBe("2026-11-02");
  expect(day(rescheduleCard(ranged, "start", 10).startAt)).toBe("2026-11-06");
  const preview = previewItem(ranged, "start", 10);
  expect([dayKey(preview.start), dayKey(preview.end)]).toEqual(["2026-11-06", "2026-11-06"]);
});
