import { describe, expect, it } from "vitest";
import { calendarCsv, calendarIcs, datedCards } from "../src/export/calendarFiles";
import { resolveWeekStart } from "../src/lib/weekStart";
import { type Card, emptyState } from "../src/model";
import {
  calendarItems,
  calendarRange,
  dayKey,
  daySections,
  dueSummary,
  monthWeeks,
  startOfWeek,
} from "../src/model/calendar";

const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).toISOString();
const card = (id: string, extra: Partial<Card> = {}): Card => ({
  id,
  boardId: "b",
  listId: "l",
  name: id,
  description: "",
  position: 1,
  labelIds: [],
  checklists: [],
  comments: [],
  attachments: [],
  createdAt: at(2026, 11, 2, 8),
  ...extra,
});
const ids = (cards: Card[]) => cards.map((item) => item.id);
const now = new Date(2026, 10, 20, 12);

describe("first day of the week", () => {
  it("starts weeks on Monday or Sunday", () => {
    const thursday = new Date(2026, 10, 26);
    expect(dayKey(startOfWeek(thursday))).toBe("2026-11-23");
    expect(dayKey(startOfWeek(thursday, 0))).toBe("2026-11-22");
    expect(dayKey(startOfWeek(new Date(2026, 10, 22), 0))).toBe("2026-11-22");
    expect(dayKey(calendarRange("week", thursday, 0).to)).toBe("2026-11-28");
    // November 2026 begins on a Sunday: a Sunday-first month has no row from October.
    expect(dayKey(monthWeeks(thursday, [], 0)[0].start)).toBe("2026-11-01");
    expect(dayKey(monthWeeks(thursday, [])[0].start)).toBe("2026-10-26");
  });

  it("follows the language unless Monday or Sunday is chosen", () => {
    expect([resolveWeekStart("auto", "en"), resolveWeekStart("auto", "ru"), resolveWeekStart("auto", "pt-BR")]).toEqual(
      [0, 1, 0],
    );
    expect([resolveWeekStart("monday", "en"), resolveWeekStart("sunday", "ru")]).toEqual([1, 0]);
  });
});

describe("day panel and summary", () => {
  const cards = [
    card("due", { startAt: at(2026, 11, 10), dueAt: at(2026, 11, 12) }),
    card("starts", { startAt: at(2026, 11, 12) }),
    card("running", { startAt: at(2026, 11, 11), dueAt: at(2026, 11, 14) }),
    card("ends", { startAt: at(2026, 11, 3), dueAt: at(2026, 11, 11) }),
    card("done", { dueAt: at(2026, 11, 18), doneAt: at(2026, 11, 17) }),
  ];

  it("splits a day's cards into due, starting and running through it", () => {
    const sections = daySections(calendarItems(emptyState(), cards), new Date(2026, 10, 12));
    expect([ids(sections.due), ids(sections.starts), ids(sections.ongoing)]).toEqual([
      ["due"],
      ["starts"],
      ["done", "running"],
    ]);
  });

  it("counts cards by due date", () => {
    const summary = dueSummary(cards, now);
    expect(ids(summary.withDue)).toEqual(["ends", "due", "running", "done"]);
    expect([ids(summary.done), ids(summary.overdue), ids(summary.upcoming), ids(summary.noDue)]).toEqual([
      ["done"],
      ["ends", "due", "running"],
      [],
      ["starts"],
    ]);
  });
});

describe("calendar files", () => {
  const state = {
    ...emptyState(),
    lists: [{ id: "l", boardId: "b", name: "Todo", position: 1 }],
    labels: [{ id: "red", boardId: "b", name: "Urgent", color: "#f00" }],
  };
  const cards = [
    card("range", { name: "Launch, phase 1", startAt: at(2026, 11, 10), dueAt: at(2026, 11, 12, 18) }),
    card("due", { name: "Report", dueAt: at(2026, 11, 25), labelIds: ["red"] }),
    card("created only"),
    card("later", { dueAt: at(2026, 12, 3) }),
  ];
  const november = datedCards(cards, new Date(2026, 10, 1), new Date(2026, 10, 30));

  it("takes the dated cards of the period, leaving out cards placed by their creation date", () => {
    expect(november.map((item) => item.card.id)).toEqual(["range", "due"]);
  });

  it("writes all-day iCalendar events that link back to the cards", () => {
    const ics = calendarIcs(november, (item) => `https://app/c/${item.id}`, new Date(Date.UTC(2026, 10, 20, 8)));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics).toContain("UID:range@kanbonk\r\nDTSTAMP:20261120T080000Z\r\nDTSTART;VALUE=DATE:20261110\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20261113\r\nSUMMARY:Launch\\, phase 1\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261125\r\nDTEND;VALUE=DATE:20261126\r\n");
    expect(ics).toContain("URL:https://app/c/due\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    const long = calendarIcs(
      datedCards(
        [card("x", { name: "й".repeat(60), dueAt: at(2026, 11, 5) })],
        new Date(2026, 10, 1),
        new Date(2026, 10, 30),
      ),
      () => "u",
    );
    const lines = long.split("\r\n");
    expect(lines.every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
    expect(lines.filter((line) => line.startsWith(" ")).length).toBeGreaterThan(0);
  });

  it("writes a CSV table with lists, labels, dates and status", () => {
    const rows = calendarCsv(state, november, now).split("\r\n");
    expect(rows[0]).toBe("Name,List,Labels,Start,Due,Status");
    expect(rows[1]).toMatch(/^"Launch, phase 1",Todo,,2026-11-10 09:00,2026-11-12 18:00,Overdue$/);
    expect(rows[2]).toBe("Report,Todo,Urgent,,2026-11-25 09:00,Upcoming");
  });
});
