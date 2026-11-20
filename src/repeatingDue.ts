import type { Card } from "./model";

function anchorDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : undefined;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function nextDueDate(dueAt: string, repeat: NonNullable<Card["dueRepeat"]>): string | undefined {
  const due = new Date(dueAt);
  const anchor = anchorDate(repeat.anchor);
  if (!Number.isFinite(due.getTime()) || !anchor) return undefined;
  const candidate = new Date(due);
  if (repeat.cadence === "daily") candidate.setDate(candidate.getDate() + 1);
  else if (repeat.cadence === "weekly")
    candidate.setDate(candidate.getDate() + ((anchor.getDay() - candidate.getDay() + 6) % 7) + 1);
  else if (repeat.cadence === "monthly") {
    const dateForMonth = (year: number, month: number) =>
      new Date(
        year,
        month,
        Math.min(anchor.getDate(), daysInMonth(year, month)),
        due.getHours(),
        due.getMinutes(),
        due.getSeconds(),
        due.getMilliseconds(),
      );
    const currentMonth = dateForMonth(due.getFullYear(), due.getMonth());
    return (currentMonth > due ? currentMonth : dateForMonth(due.getFullYear(), due.getMonth() + 1)).toISOString();
  } else if (repeat.cadence === "yearly") {
    const dateForYear = (year: number) =>
      new Date(
        year,
        anchor.getMonth(),
        Math.min(anchor.getDate(), daysInMonth(year, anchor.getMonth())),
        due.getHours(),
        due.getMinutes(),
        due.getSeconds(),
        due.getMilliseconds(),
      );
    const currentYear = dateForYear(due.getFullYear());
    return (currentYear > due ? currentYear : dateForYear(due.getFullYear() + 1)).toISOString();
  } else return undefined;
  return candidate.toISOString();
}

export function applyDueRecurrence(before: Card, after: Card): Card {
  if (before.completed || !after.completed || after.archived || !after.dueAt || !after.dueRepeat) return after;
  const dueAt = nextDueDate(after.dueAt, after.dueRepeat);
  return dueAt ? { ...after, completed: false, dueAt } : after;
}
