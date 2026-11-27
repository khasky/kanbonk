import { t } from "../i18n";
import { localDateTime } from "../lib/format";
import type { AppState, Card } from "../model";
import { dueStatus, localDay } from "../model/calendar";

/** A card with a start or due date, as the days it covers: from its start (or due) day to its due (or start) day. */
export interface DatedCard {
  card: Card;
  start: Date;
  end: Date;
}

/** The cards with a start or due date that overlap the days `from`–`to`, earliest first. */
export function datedCards(cards: Card[], from: Date, to: Date): DatedCard[] {
  return cards
    .flatMap((card) => {
      const start = localDay(card.startAt) ?? localDay(card.dueAt);
      if (!start) return [];
      const due = localDay(card.dueAt);
      const end = due && due > start ? due : start;
      return end >= from && start <= to ? [{ card, start, end }] : [];
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.card.position - b.card.position);
}

const icsDate = (date: Date) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

const icsText = (text: string) => text.replace(/[\\;,]/g, (match) => `\\${match}`).replace(/\r?\n/g, "\\n");

/** Folds a content line to 75 octets as RFC 5545 asks, without splitting a UTF-8 character. */
function fold(line: string): string {
  const parts: string[] = [];
  let part = "";
  let size = 0;
  for (const char of line) {
    const bytes = new TextEncoder().encode(char).length;
    if (size + bytes > (parts.length ? 74 : 75)) {
      parts.push(part);
      part = "";
      size = 0;
    }
    part += char;
    size += bytes;
  }
  parts.push(part);
  return parts.join("\r\n ");
}

/** An iCalendar file with an all-day event per card, linking back to it with `link`. */
export function calendarIcs(items: DatedCard[], link: (card: Card) => string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const events = items.flatMap(({ card, start, end }) => {
    const after = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
    const url = link(card);
    return [
      "BEGIN:VEVENT",
      `UID:${card.id}@kanbonk`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(start)}`,
      `DTEND;VALUE=DATE:${icsDate(after)}`,
      `SUMMARY:${icsText(card.name)}`,
      `DESCRIPTION:${icsText(url)}`,
      `URL:${url}`,
      "END:VEVENT",
    ];
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//kanbonk//calendar//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n")
    .concat("\r\n");
}

const csvCell = (text: string) => (/[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

/** Rows of text as CSV: cells quoted where needed, rows ended with CRLF. */
export const csvTable = (rows: string[][]) => rows.map((row) => row.map(csvCell).join(",")).join("\r\n");

const statusNames = {
  done: "calendar.done",
  overdue: "calendar.overdue",
  upcoming: "calendar.upcoming",
} as const;

/** A CSV table of the cards: name, list, labels, start, due and where the card stands against its due date. */
export function calendarCsv(state: AppState, items: DatedCard[], now = new Date()): string {
  const lists = new Map(state.lists.map((list) => [list.id, list.name]));
  const labels = new Map(state.labels.map((label) => [label.id, label.name || label.color]));
  const header = [
    t("calendar.csvName"),
    t("calendar.csvList"),
    t("calendar.csvLabels"),
    t("calendar.csvStart"),
    t("calendar.csvDue"),
    t("calendar.csvStatus"),
  ];
  const rows = items.map(({ card }) => {
    const status = dueStatus(card, now);
    return [
      card.name,
      lists.get(card.listId) ?? "",
      card.labelIds.flatMap((id) => labels.get(id) ?? []).join(", "),
      card.startAt ? localDateTime(card.startAt).replace("T", " ") : "",
      card.dueAt ? localDateTime(card.dueAt).replace("T", " ") : "",
      status ? t(statusNames[status]) : "",
    ];
  });
  return csvTable([header, ...rows]);
}
