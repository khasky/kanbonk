import type { AppState, Card } from "./model";
import type { CalendarScale } from "./router";

const dayMs = 86_400_000;

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDay(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function dayIndex(date: Date): number {
  return Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) / dayMs);
}

/** Monday-based start of week. */
export function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

/** Creation time: explicit field, else the timestamp encoded in a Trello id, else the first local revision. */
export function cardCreatedAt(state: AppState, card: Card): string | undefined {
  if (card.createdAt) return card.createdAt;
  if (card.sourceTrelloId && /^[a-f0-9]{24}$/.test(card.sourceTrelloId)) return new Date(parseInt(card.sourceTrelloId.slice(0, 8), 16) * 1000).toISOString();
  return state.revisions.find((revision) => revision.entityKind === "card" && revision.entityId === card.id)?.createdAt;
}

export interface CalendarItem { card: Card; start: Date; end: Date }

/** A card spans from its start date (or creation date) to its due date when the due date is later. */
export function calendarItems(state: AppState, cards: Card[]): CalendarItem[] {
  return cards.flatMap((card) => {
    const startSource = card.startAt ?? cardCreatedAt(state, card);
    if (!startSource || !Number.isFinite(Date.parse(startSource))) return [];
    const startTime = new Date(startSource);
    const start = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());
    const dueTime = card.dueAt ? new Date(card.dueAt) : undefined;
    const due = dueTime && Number.isFinite(dueTime.getTime()) ? new Date(dueTime.getFullYear(), dueTime.getMonth(), dueTime.getDate()) : undefined;
    return [{ card, start, end: due && due > start ? due : start }];
  }).sort((a, b) => a.start.getTime() - b.start.getTime() || (b.end.getTime() - b.start.getTime()) - (a.end.getTime() - a.start.getTime()) || a.card.position - b.card.position);
}

export interface WeekSegment { item: CalendarItem; column: number; span: number; lane: number; continuesBefore: boolean; continuesAfter: boolean }
export interface WeekRow { start: Date; days: Date[]; segments: WeekSegment[]; lanes: number }

/** Lays out items crossing one week as bars, packing them into the lowest free lane. */
export function layoutWeek(weekStart: Date, items: CalendarItem[]): WeekRow {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const first = dayIndex(days[0]);
  const last = dayIndex(days[6]);
  const laneEnds: number[] = [];
  const segments: WeekSegment[] = [];
  for (const item of items) {
    const from = dayIndex(item.start);
    const to = dayIndex(item.end);
    if (to < first || from > last) continue;
    const column = Math.max(from, first) - first;
    const endColumn = Math.min(to, last) - first;
    let lane = laneEnds.findIndex((end) => end < column);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(endColumn); }
    else laneEnds[lane] = endColumn;
    segments.push({ item, column, span: endColumn - column + 1, lane, continuesBefore: from < first, continuesAfter: to > last });
  }
  return { start: weekStart, days, segments, lanes: laneEnds.length };
}

export function calendarRange(scale: CalendarScale, anchor: Date): { from: Date; to: Date } {
  if (scale === "week") { const from = startOfWeek(anchor); return { from, to: addDays(from, 6) }; }
  if (scale === "year") return { from: new Date(anchor.getFullYear(), 0, 1), to: new Date(anchor.getFullYear(), 11, 31) };
  return { from: new Date(anchor.getFullYear(), anchor.getMonth(), 1), to: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0) };
}

export function monthWeeks(anchor: Date, items: CalendarItem[]): WeekRow[] {
  const { from, to } = calendarRange("month", anchor);
  const rows: WeekRow[] = [];
  for (let start = startOfWeek(from); start <= to; start = addDays(start, 7)) rows.push(layoutWeek(start, items));
  return rows;
}

export function shiftAnchor(scale: CalendarScale, anchor: Date, direction: -1 | 1): Date {
  if (scale === "week") return addDays(anchor, 7 * direction);
  if (scale === "year") return new Date(anchor.getFullYear() + direction, anchor.getMonth(), 1);
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

/** Items overlapping a calendar month, for the year view. */
export function itemsInMonth(items: CalendarItem[], year: number, month: number): CalendarItem[] {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  return items.filter((item) => item.end >= from && item.start <= to);
}

export type CalendarDrag = "move" | "start" | "end";

/** Whole days between two calendar days. */
export function daysBetween(from: Date, to: Date): number {
  return dayIndex(to) - dayIndex(from);
}

/** Shifts an ISO time by whole local days, keeping the time of day. */
function shiftIso(iso: string, days: number): string {
  const date = new Date(iso);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()).toISOString();
}

/** Day `day` at the time of day of `time` (noon when there is none). */
function atDay(day: Date, time?: string): string {
  const source = time ? new Date(time) : undefined;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), source ? source.getHours() : 12, source ? source.getMinutes() : 0).toISOString();
}

/**
 * New start/due after dragging a calendar bar by `delta` days: "move" shifts both ends, "start"/"end" resize one end.
 * A card without a start date gets one (its displayed start is the creation date); the range never inverts.
 */
export function rescheduleCard(item: CalendarItem, mode: CalendarDrag, delta: number): { startAt?: string; dueAt?: string } {
  const { card } = item;
  const startAt = card.startAt ?? atDay(item.start);
  if (mode === "move") return { startAt: shiftIso(startAt, delta), dueAt: card.dueAt ? shiftIso(card.dueAt, delta) : undefined };
  const span = daysBetween(item.start, item.end);
  if (mode === "start") return { startAt: shiftIso(startAt, Math.min(delta, span)), dueAt: card.dueAt };
  const newSpan = Math.max(0, span + delta);
  if (!card.dueAt && newSpan === 0) return { startAt: card.startAt, dueAt: undefined };
  return { startAt: card.startAt, dueAt: atDay(new Date(item.start.getFullYear(), item.start.getMonth(), item.start.getDate() + newSpan), card.dueAt ?? startAt) };
}

/** The item as it would look after `rescheduleCard`, for a live preview while dragging. */
export function previewItem(item: CalendarItem, mode: CalendarDrag, delta: number): CalendarItem {
  const span = daysBetween(item.start, item.end);
  const shift = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  if (mode === "move") return { ...item, start: shift(item.start, delta), end: shift(item.end, delta) };
  if (mode === "start") return { ...item, start: shift(item.start, Math.min(delta, span)) };
  return { ...item, end: shift(item.start, Math.max(0, span + delta)) };
}
