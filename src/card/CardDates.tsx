import { localDateTime } from "../lib/format";
import type { Card } from "../model";
import { Input, Select } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { detailSectionClass, detailTitleClass } from "./cardLook";

const labelClass = "grid gap-[5px] text-ink-subtle";

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

/** Start and due dates, the due reminder and the repeat cadence. */
export function CardDates({ card, onChange }: { card: Card; onChange: (change: (card: Card) => Card) => void }) {
  return (
    <section className={detailSectionClass}>
      <h3 className={detailTitleClass}>
        <Icon name="clock" /> Dates
      </h3>
      <div className="ml-7 flex flex-wrap gap-3">
        <label className={labelClass}>
          Start date
          <Input
            size="sm"
            type="datetime-local"
            value={card.startAt ? localDateTime(card.startAt) : ""}
            onChange={(event) =>
              onChange((item) => ({
                ...item,
                startAt: event.target.value ? new Date(event.target.value).toISOString() : undefined,
              }))
            }
            aria-label="Card start date"
          />
        </label>
        <label className={labelClass}>
          Due date
          <Input
            size="sm"
            id={`due-${card.id}`}
            type="datetime-local"
            value={card.dueAt ? localDateTime(card.dueAt) : ""}
            onChange={(event) =>
              onChange((item) => ({
                ...item,
                dueAt: event.target.value ? new Date(event.target.value).toISOString() : undefined,
                dueReminderMinutes: event.target.value ? item.dueReminderMinutes : undefined,
                dueRepeat: event.target.value ? item.dueRepeat : undefined,
              }))
            }
            aria-label="Card due date"
          />
        </label>
        <label className={labelClass}>
          Reminder
          <Select
            size="sm"
            value={card.dueReminderMinutes ?? ""}
            onChange={(event) =>
              onChange((item) => ({
                ...item,
                dueReminderMinutes: event.target.value === "" ? undefined : Number(event.target.value),
              }))
            }
            disabled={!card.dueAt}
            aria-label="Card due date reminder"
          >
            <option value="">No reminder</option>
            {reminderOptions.map((option) => (
              <option key={option.minutes} value={option.minutes}>
                {option.label}
              </option>
            ))}
            {card.dueReminderMinutes !== undefined &&
              !reminderOptions.some((option) => option.minutes === card.dueReminderMinutes) && (
                <option value={card.dueReminderMinutes}>{card.dueReminderMinutes} minutes before</option>
              )}
          </Select>
        </label>
        <label className={labelClass}>
          Repeat
          <Select
            size="sm"
            value={card.dueRepeat?.cadence ?? ""}
            onChange={(event) => {
              const cadence = event.target.value as NonNullable<Card["dueRepeat"]>["cadence"] | "";
              onChange((item) => ({
                ...item,
                dueRepeat:
                  cadence && item.dueAt ? { cadence, anchor: localDateTime(item.dueAt).slice(0, 10) } : undefined,
              }));
            }}
            disabled={!card.dueAt}
            aria-label="Repeat card due date"
          >
            <option value="">Don't repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </Select>
        </label>
      </div>
    </section>
  );
}
