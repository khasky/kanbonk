import { type MouseEvent, useState } from "react";
import { formatDate, formatDateTime, type MessageKey, t } from "../i18n";
import type { Card } from "../model";
import { Button } from "../ui/Button";
import { Input, Select, Checkbox } from "../ui/Field";
import { Icon, type IconName } from "../ui/Icon";
import { pickerLabelClass } from "./cardLook";
import { startOfWeek } from "../model/calendar";
import { useWeekStart } from "../lib/weekStart";

const reminderOptions: Array<{ minutes: number; label: MessageKey; count?: number }> = [
  { minutes: 0, label: "card.atDueTime" },
  { minutes: 5, label: "card.minutesBefore", count: 5 },
  { minutes: 10, label: "card.minutesBefore", count: 10 },
  { minutes: 15, label: "card.minutesBefore", count: 15 },
  { minutes: 60, label: "card.hoursBefore", count: 1 },
  { minutes: 120, label: "card.hoursBefore", count: 2 },
  { minutes: 1440, label: "card.daysBefore", count: 1 },
  { minutes: 2880, label: "card.daysBefore", count: 2 },
  { minutes: 10080, label: "card.weeksBefore", count: 1 },
];

/** A week from its first day (0 for Sunday): 7 January 2024 was a Sunday. */
const weekdaysFrom = (first: number) => Array.from({ length: 7 }, (_, index) => new Date(2024, 0, 7 + first + index));

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayText(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function minutesOf(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function timeText(minutes: number) {
  const hours = Math.floor(minutes / 60);
  return `${hours % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

/** `M/D/YYYY` as a local day, or undefined for anything else (including days that do not exist). */
export function parseDay(text: string): Date | undefined {
  const match = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text);
  if (!match) return undefined;
  const [month, day, year] = [Number(match[1]) - 1, Number(match[2]), Number(match[3])];
  const date = new Date(year, month, day);
  return date.getMonth() === month && date.getDate() === day ? date : undefined;
}

/** `h:mm AM`/`h:mm PM` or 24-hour `H:mm` as minutes after midnight, or undefined. */
export function parseTime(text: string): number | undefined {
  const match = /^\s*(\d{1,2}):(\d{2})\s*([ap])?\.?\s*m?\.?\s*$/i.exec(text);
  if (!match) return undefined;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return undefined;
  if (match[3]) {
    if (hours < 1 || hours > 12) return undefined;
    hours = (hours % 12) + (match[3].toLowerCase() === "p" ? 12 : 0);
  } else if (hours > 23) return undefined;
  return hours * 60 + minutes;
}

function atMinutes(day: Date, minutes: number) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);
}

function MonthButton({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <Button variant="icon" type="button" className="size-8" onClick={onClick} aria-label={label}>
      <Icon name={icon} className="size-4" />
    </Button>
  );
}

function dayClass(selected: boolean, between: boolean, inMonth: boolean, today: boolean) {
  const look = selected
    ? "rounded-[3px] bg-brand font-semibold text-white hover:bg-brand-hover"
    : between
      ? "bg-brand-soft text-ink hover:bg-[#cce0ff]"
      : `rounded-[3px] bg-transparent hover:bg-surface-sunken ${today ? "font-semibold text-brand" : inMonth ? "text-ink" : "text-ink-faint"}`;
  return `relative h-8 cursor-pointer border-0 text-[14px] ${look}`;
}

/**
 * The dates popover: a month calendar, the start date, the due date and time and the due reminder. A day picked in the
 * calendar goes to the field last focused (the due date by default); **Save** applies the dates, **Remove** clears them.
 */
export function DatesForm({
  card,
  onChange,
  onClose,
  now = Date.now(),
}: {
  card: Card;
  onChange: (change: (card: Card) => Card) => void;
  onClose: () => void;
  now?: number;
}) {
  const today = startOfDay(new Date(now));
  const savedStart = card.startAt ? new Date(card.startAt) : undefined;
  const savedDue = card.dueAt ? new Date(card.dueAt) : undefined;
  const fresh = !savedStart && !savedDue;
  const [startOn, setStartOn] = useState(Boolean(savedStart));
  const [dueOn, setDueOn] = useState(Boolean(savedDue) || fresh);
  const [startInput, setStartInput] = useState(savedStart ? dayText(savedStart) : "");
  const [dueInput, setDueInput] = useState(
    dayText(savedDue ?? new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)),
  );
  const [timeInput, setTimeInput] = useState(timeText(savedDue ? minutesOf(savedDue) : 12 * 60));
  const [reminder, setReminder] = useState(card.dueReminderMinutes);
  const [target, setTarget] = useState<"start" | "due">(savedDue || fresh ? "due" : "start");
  const shownAt = savedDue ?? savedStart ?? today;
  const [month, setMonth] = useState(new Date(shownAt.getFullYear(), shownAt.getMonth(), 1));
  const weekStart = useWeekStart();

  const start = startOn ? parseDay(startInput) : undefined;
  const due = dueOn ? parseDay(dueInput) : undefined;
  const dueMinutes = dueOn ? parseTime(timeInput) : undefined;
  const startInvalid = startOn && !start;
  const dueInvalid = dueOn && !due;
  const timeInvalid = dueOn && dueMinutes === undefined;
  const reversed = Boolean(start && due && start > due);
  const valid = !startInvalid && !dueInvalid && !timeInvalid && !reversed;

  function pick(day: Date) {
    if (target === "start") {
      setStartOn(true);
      setStartInput(dayText(day));
    } else {
      setDueOn(true);
      setDueInput(dayText(day));
    }
  }

  function typed(text: string, set: (text: string) => void) {
    set(text);
    const day = parseDay(text);
    if (day) setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
  }

  function save() {
    // The start keeps the time of day it had: the popover edits only its day.
    const startAt = start ? atMinutes(start, savedStart ? minutesOf(savedStart) : 0).toISOString() : undefined;
    const dueAt = due && dueMinutes !== undefined ? atMinutes(due, dueMinutes).toISOString() : undefined;
    const dueReminderMinutes = dueAt ? reminder : undefined;
    if (
      startAt !== savedStart?.toISOString() ||
      dueAt !== savedDue?.toISOString() ||
      dueReminderMinutes !== card.dueReminderMinutes
    )
      onChange((item) => ({ ...item, startAt, dueAt, dueReminderMinutes }));
    onClose();
  }

  const first = startOfWeek(month, weekStart);
  const days = Array.from(
    { length: 42 },
    (_, index) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + index),
  );
  const shift = (months: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + months, 1));

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex items-center">
          <MonthButton icon="chevrons-left" label={t("card.previousYear")} onClick={() => shift(-12)} />
          <MonthButton icon="chevron-left" label={t("card.previousMonth")} onClick={() => shift(-1)} />
          <span className="flex-1 text-center text-[14px] font-semibold" aria-live="polite">
            {formatDateTime(month, { month: "long", year: "numeric" })}
          </span>
          <MonthButton icon="chevron-right" label={t("card.nextMonth")} onClick={() => shift(1)} />
          <MonthButton icon="chevrons-right" label={t("card.nextYear")} onClick={() => shift(12)} />
        </div>
        <div className="mt-1 grid grid-cols-7 gap-y-0.5" role="grid" aria-label={t("card.calendar")}>
          {weekdaysFrom(weekStart).map((weekday) => (
            <span key={weekday.getDay()} className="py-1 text-center text-[12px] font-semibold text-ink-subtle">
              {formatDate(weekday, { weekday: "short" })}
            </span>
          ))}
          {days.map((day) => {
            const time = day.getTime();
            const selected = time === start?.getTime() || time === due?.getTime();
            const between = Boolean(start && due && time > start.getTime() && time < due.getTime());
            const isToday = time === today.getTime();
            return (
              <button
                key={time}
                type="button"
                className={dayClass(selected, between, day.getMonth() === month.getMonth(), isToday)}
                onClick={() => pick(day)}
                aria-pressed={selected}
                aria-current={isToday ? "date" : undefined}
                aria-label={formatDate(day, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              >
                {day.getDate()}
                {isToday && !selected && (
                  <span className="absolute inset-x-2.5 bottom-1 h-0.5 rounded-full bg-brand" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className={pickerLabelClass}>
        {t("card.startDate")}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={startOn}
            onChange={(event) => {
              setStartOn(event.target.checked);
              if (event.target.checked) {
                setTarget("start");
                if (!parseDay(startInput)) setStartInput(dayText(due && due < today ? due : today));
              } else setTarget("due");
            }}
            aria-label={t("card.startDate")}
          />
          <Input
            size="sm"
            className="w-28 aria-invalid:border-danger"
            value={startOn ? startInput : ""}
            placeholder="M/D/YYYY"
            disabled={!startOn}
            onFocus={() => setTarget("start")}
            onChange={(event) => typed(event.target.value, setStartInput)}
            aria-invalid={startInvalid || reversed}
            aria-label={t("card.cardStartDate")}
          />
        </div>
      </div>
      <div className={pickerLabelClass}>
        {t("card.dueDate")}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={dueOn}
            onChange={(event) => {
              setDueOn(event.target.checked);
              setTarget(event.target.checked || !startOn ? "due" : "start");
            }}
            aria-label={t("card.dueDate")}
          />
          <Input
            size="sm"
            className="w-28 aria-invalid:border-danger"
            value={dueOn ? dueInput : ""}
            placeholder="M/D/YYYY"
            disabled={!dueOn}
            onFocus={() => setTarget("due")}
            onChange={(event) => typed(event.target.value, setDueInput)}
            aria-invalid={dueInvalid || reversed}
            aria-label={t("card.cardDueDate")}
          />
          <Input
            size="sm"
            className="w-24 aria-invalid:border-danger"
            value={dueOn ? timeInput : ""}
            placeholder="h:mm AM"
            disabled={!dueOn}
            onFocus={() => setTarget("due")}
            onChange={(event) => setTimeInput(event.target.value)}
            aria-invalid={timeInvalid}
            aria-label={t("card.cardDueTime")}
          />
        </div>
      </div>
      {reversed && <p className="m-0 text-[12px] text-danger">{t("card.startAfterDue")}</p>}
      <label className={pickerLabelClass}>
        {t("card.setReminder")}
        <Select
          size="sm"
          value={dueOn ? (reminder ?? "") : ""}
          onChange={(event) => setReminder(event.target.value === "" ? undefined : Number(event.target.value))}
          disabled={!dueOn}
          aria-label={t("card.cardDueReminder")}
        >
          <option value="">{t("card.none")}</option>
          {reminderOptions.map((option) => (
            <option key={option.minutes} value={option.minutes}>
              {t(option.label, option.count === undefined ? undefined : { count: option.count })}
            </option>
          ))}
          {reminder !== undefined && !reminderOptions.some((option) => option.minutes === reminder) && (
            <option value={reminder}>{t("card.minutesBefore", { count: reminder })}</option>
          )}
        </Select>
      </label>
      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={save} disabled={!valid}>
          {t("common.save")}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          disabled={fresh}
          onClick={() => {
            onChange((item) => ({ ...item, startAt: undefined, dueAt: undefined, dueReminderMinutes: undefined }));
            onClose();
          }}
        >
          {t("common.remove")}
        </Button>
      </div>
    </div>
  );
}

function shortDate(value: string) {
  return formatDateTime(value, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** The card's dates as one button that opens the dates popover; red once the due date has passed. */
export function DatesChip({
  card,
  expanded,
  onClick,
  now = Date.now(),
}: {
  card: Card;
  expanded: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  now?: number;
}) {
  const overdue = Boolean(card.dueAt && Date.parse(card.dueAt) < now);
  const text = [card.startAt && shortDate(card.startAt), card.dueAt && shortDate(card.dueAt)]
    .filter(Boolean)
    .join(" – ");
  return (
    <button
      className={
        overdue
          ? "flex h-8 items-center gap-2 rounded-sm border-0 bg-danger-soft px-3 font-medium text-danger hover:bg-[#ffd5d2] disabled:cursor-default disabled:hover:bg-danger-soft"
          : "flex h-8 items-center gap-2 rounded-sm border-0 bg-surface-sunken px-3 font-medium text-ink hover:bg-line disabled:cursor-default disabled:hover:bg-surface-sunken"
      }
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={t("card.datesLabel", { text })}
    >
      {text}
      {overdue && (
        <span className="rounded-[3px] bg-danger px-1 text-[12px] font-semibold text-white">{t("card.overdue")}</span>
      )}
    </button>
  );
}
