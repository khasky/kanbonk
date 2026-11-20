import { useMemo, useState } from "react";
import type { AppState, Card } from "../model";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CalendarScale } from "../router";
import {
  calendarItems,
  calendarRange,
  dayKey,
  daysBetween,
  itemsInMonth,
  layoutWeek,
  monthWeeks,
  parseDay,
  previewItem,
  rescheduleCard,
  shiftAnchor,
  startOfWeek,
  type CalendarDrag,
  type WeekRow,
} from "../calendar";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface CalendarDragState {
  cardId: string;
  mode: CalendarDrag;
  delta: number;
}

function dayAt(x: number, y: number): string | undefined {
  return document
    .elementsFromPoint(x, y)
    .map((element) => (element as HTMLElement).dataset?.day)
    .find(Boolean);
}

function CalendarWeek({
  row,
  month,
  today,
  labels,
  tall,
  dragging,
  onOpen,
  onStartDrag,
  onDelete,
}: {
  row: WeekRow;
  month?: number;
  today: string;
  labels: AppState["labels"];
  tall?: boolean;
  dragging?: string;
  onOpen: (card: Card) => void;
  onStartDrag: (event: ReactPointerEvent, card: Card, mode: CalendarDrag) => void;
  onDelete: (card: Card) => void;
}) {
  return (
    <div
      className={`calendar-week ${tall ? "tall" : ""}`}
      style={{ gridTemplateRows: `26px repeat(${Math.max(row.lanes, 1)}, auto) 1fr` }}
    >
      {row.days.map((day, index) => (
        <div
          key={dayKey(day)}
          data-day={dayKey(day)}
          className={`calendar-day ${month !== undefined && day.getMonth() !== month ? "outside" : ""} ${dayKey(day) === today ? "today" : ""}`}
          style={{ gridColumn: index + 1, gridRow: `1 / span ${row.lanes + 2}` }}
        >
          <span className="calendar-day-number">{day.getDate()}</span>
        </div>
      ))}
      {row.segments.map((segment) => {
        const { card } = segment.item;
        const color = labels.find((label) => card.labelIds.includes(label.id) && label.color)?.color;
        return (
          <div
            key={card.id}
            className={`calendar-bar ${segment.continuesBefore ? "cont-before" : ""} ${segment.continuesAfter ? "cont-after" : ""} ${card.completed ? "done" : ""} ${dragging === card.id ? "dragging" : ""}`}
            style={{
              gridColumn: `${segment.column + 1} / span ${segment.span}`,
              gridRow: segment.lane + 2,
              borderLeftColor: color,
            }}
            title={`${card.name} — ${segment.item.start.toLocaleDateString("en-US")}${segment.item.end > segment.item.start ? ` – ${segment.item.end.toLocaleDateString("en-US")}` : ""}`}
            onPointerDown={(event) => onStartDrag(event, card, "move")}
          >
            {!segment.continuesBefore && (
              <span
                className="calendar-resize start"
                aria-hidden="true"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onStartDrag(event, card, "start");
                }}
              />
            )}
            <button
              className="calendar-bar-name"
              onClick={(event) => {
                if (event.detail === 0) onOpen(card);
              }}
              onKeyDown={(event) => {
                if (event.key === "Delete") onDelete(card);
              }}
            >
              {card.completed ? "✓ " : ""}
              {card.name}
            </button>
            {!segment.continuesAfter && (
              <>
                <button
                  className="calendar-delete"
                  aria-label={`Delete card ${card.name}`}
                  title="Delete"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(card);
                  }}
                >
                  ×
                </button>
                <span
                  className="calendar-resize end"
                  aria-hidden="true"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onStartDrag(event, card, "end");
                  }}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BoardCalendar({
  state,
  cards,
  scale,
  date,
  onNavigate,
  onOpen,
  onReschedule,
  onDelete,
}: {
  state: AppState;
  cards: Card[];
  scale: CalendarScale;
  date?: string;
  onNavigate: (scale: CalendarScale, date?: string) => void;
  onOpen: (card: Card) => void;
  onReschedule: (card: Card, dates: { startAt?: string; dueAt?: string }) => void;
  onDelete: (card: Card) => void;
}) {
  const [drag, setDrag] = useState<CalendarDragState | null>(null);
  const anchor = date ? parseDay(date) : new Date();
  const today = dayKey(new Date());
  const baseItems = useMemo(() => calendarItems(state, cards), [state, cards]);
  const items = useMemo(
    () =>
      drag
        ? baseItems.map((item) => (item.card.id === drag.cardId ? previewItem(item, drag.mode, drag.delta) : item))
        : baseItems,
    [baseItems, drag],
  );
  function startDrag(event: ReactPointerEvent, card: Card, mode: CalendarDrag) {
    const item = baseItems.find((entry) => entry.card.id === card.id);
    const origin = dayAt(event.clientX, event.clientY);
    if (event.button !== 0 || !item || !origin) return;
    event.preventDefault();
    const startX = event.clientX,
      startY = event.clientY;
    let current: CalendarDragState = { cardId: card.id, mode, delta: 0 };
    let moved = false;
    setDrag(current);
    const move = (next: PointerEvent) => {
      moved ||= Math.abs(next.clientX - startX) + Math.abs(next.clientY - startY) > 4;
      const target = dayAt(next.clientX, next.clientY);
      if (!target) return;
      const delta = daysBetween(parseDay(origin), parseDay(target));
      if (delta !== current.delta) {
        current = { ...current, delta };
        setDrag(current);
      }
    };
    const finish = (commit: boolean) => () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      setDrag(null);
      if (!commit) return;
      if (current.delta !== 0) onReschedule(card, rescheduleCard(item, mode, current.delta));
      else if (!moved && mode === "move") onOpen(card);
    };
    const up = finish(true);
    const cancel = finish(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }
  const { from, to } = calendarRange(scale, anchor);
  const title =
    scale === "year"
      ? String(anchor.getFullYear())
      : scale === "month"
        ? `${monthNames[anchor.getMonth()]} ${anchor.getFullYear()}`
        : `${from.toLocaleDateString("en-US")} – ${to.toLocaleDateString("en-US")}`;
  const boardLabels = state.labels.filter((label) => !label.deleted);
  return (
    <section className="board-calendar" aria-label="Board calendar">
      <div className="calendar-toolbar">
        <button onClick={() => onNavigate(scale, dayKey(shiftAnchor(scale, anchor, -1)))} aria-label="Previous">
          ‹
        </button>
        <button onClick={() => onNavigate(scale, undefined)}>Today</button>
        <button onClick={() => onNavigate(scale, dayKey(shiftAnchor(scale, anchor, 1)))} aria-label="Next">
          ›
        </button>
        <h2>{title}</h2>
        <div className="segmented" role="tablist" aria-label="Calendar scale">
          {(["week", "month", "year"] as const).map((item) => (
            <button key={item} role="tab" aria-selected={scale === item} onClick={() => onNavigate(item, date)}>
              {item === "week" ? "Week" : item === "month" ? "Month" : "Year"}
            </button>
          ))}
        </div>
      </div>
      {scale === "year" ? (
        <div className="calendar-year">
          {monthNames.map((name, month) => {
            const monthItems = itemsInMonth(items, anchor.getFullYear(), month);
            return (
              <div className="calendar-year-month" key={name}>
                <button
                  className="calendar-year-title"
                  onClick={() => onNavigate("month", dayKey(new Date(anchor.getFullYear(), month, 1)))}
                >
                  {name} <small>{monthItems.length || ""}</small>
                </button>
                {monthItems.slice(0, 8).map((item) => (
                  <button
                    key={item.card.id}
                    className={`calendar-chip ${item.card.completed ? "done" : ""}`}
                    onClick={() => onOpen(item.card)}
                    title={item.card.name}
                  >
                    <small>{item.start.getMonth() === month ? item.start.getDate() : "…"}</small> {item.card.name}
                  </button>
                ))}
                {monthItems.length > 8 && (
                  <button
                    className="calendar-more"
                    onClick={() => onNavigate("month", dayKey(new Date(anchor.getFullYear(), month, 1)))}
                  >
                    {monthItems.length - 8} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`calendar-grid ${scale}`}>
          <div className="calendar-weekdays">
            {weekdays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          {(scale === "week" ? [layoutWeek(startOfWeek(anchor), items)] : monthWeeks(anchor, items)).map((row) => (
            <CalendarWeek
              key={dayKey(row.start)}
              row={row}
              month={scale === "month" ? anchor.getMonth() : undefined}
              today={today}
              labels={boardLabels}
              onOpen={onOpen}
              tall={scale === "week"}
              dragging={drag?.cardId}
              onStartDrag={startDrag}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
      <p className="hint">
        A card spans from its start date (or creation date) to its due date, if that is later. Drag a bar to another
        day, or drag its edge to change the start or due date; × moves the card to the trash.
      </p>
    </section>
  );
}
