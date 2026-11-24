import { type MouseEvent, useState } from "react";
import type { Card } from "../model";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Field";
import { Icon, type IconName } from "../ui/Icon";
import { pickerLabelClass } from "./cardLook";

const reminderOptions = [
  { minutes: 0, label: "At due time" },
  { minutes: 5, label: "5 minutes before" },
  { minutes: 10, label: "10 minutes before" },
  { minutes: 15, label: "15 minutes before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 120, label: "2 hours before" },
  { minutes: 1440, label: "1 day before" },
  { minutes: 2880, label: "2 days before" },
  { minutes: 10080, label: "1 week before" },
];

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
    <button
      type="button"
      className="grid size-8 place-items-center rounded-sm border-0 bg-transparent text-ink-subtle hover:bg-surface-sunken"
      onClick={onClick}
      aria-label={label}
    >
      <Icon name={icon} className="size-4" />
    </button>
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

  const first = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
  const days = Array.from(
    { length: 42 },
    (_, index) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + index),
  );
  const shift = (months: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + months, 1));

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex items-center">
          <MonthButton icon="chevrons-left" label="Previous year" onClick={() => shift(-12)} />
          <MonthButton icon="chevron-left" label="Previous month" onClick={() => shift(-1)} />
          <span className="flex-1 text-center text-[14px] font-semibold" aria-live="polite">
            {month.toLocaleString("en-US", { month: "long", year: "numeric" })}
          </span>
          <MonthButton icon="chevron-right" label="Next month" onClick={() => shift(1)} />
          <MonthButton icon="chevrons-right" label="Next year" onClick={() => shift(12)} />
        </div>
        <div className="mt-1 grid grid-cols-7 gap-y-0.5" role="grid" aria-label="Calendar">
          {weekdays.map((name) => (
            <span key={name} className="py-1 text-center text-[12px] font-semibold text-ink-subtle">
              {name}
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
                aria-label={day.toLocaleDateString("en-US", {
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
        Start date
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            className="m-0 size-4 accent-brand"
            checked={startOn}
            onChange={(event) => {
              setStartOn(event.target.checked);
              if (event.target.checked) {
                setTarget("start");
                if (!parseDay(startInput)) setStartInput(dayText(due && due < today ? due : today));
              } else setTarget("due");
            }}
            aria-label="Start date"
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
            aria-label="Card start date"
          />
        </div>
      </div>
      <div className={pickerLabelClass}>
        Due date
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            className="m-0 size-4 accent-brand"
            checked={dueOn}
            onChange={(event) => {
              setDueOn(event.target.checked);
              setTarget(event.target.checked || !startOn ? "due" : "start");
            }}
            aria-label="Due date"
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
            aria-label="Card due date"
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
            aria-label="Card due time"
          />
        </div>
      </div>
      {reversed && <p className="m-0 text-[12px] text-danger">The start date is after the due date.</p>}
      <label className={pickerLabelClass}>
        Set due date reminder
        <Select
          size="sm"
          value={dueOn ? (reminder ?? "") : ""}
          onChange={(event) => setReminder(event.target.value === "" ? undefined : Number(event.target.value))}
          disabled={!dueOn}
          aria-label="Card due date reminder"
        >
          <option value="">None</option>
          {reminderOptions.map((option) => (
            <option key={option.minutes} value={option.minutes}>
              {option.label}
            </option>
          ))}
          {reminder !== undefined && !reminderOptions.some((option) => option.minutes === reminder) && (
            <option value={reminder}>{reminder} minutes before</option>
          )}
        </Select>
      </label>
      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={save} disabled={!valid}>
          Save
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
          Remove
        </Button>
      </div>
    </div>
  );
}

function shortDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
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
          ? "flex h-8 items-center gap-2 rounded-sm border-0 bg-danger-soft px-3 font-medium text-danger hover:bg-[#ffd5d2]"
          : "flex h-8 items-center gap-2 rounded-sm border-0 bg-surface-sunken px-3 font-medium text-ink hover:bg-line"
      }
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={`Dates: ${text}`}
    >
      {text}
      {overdue && <span className="rounded-[3px] bg-danger px-1 text-[12px] font-semibold text-white">Overdue</span>}
    </button>
  );
}
