import { useMemo, useState } from "react";
import type { AppState, Card } from "../model";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CalendarScale } from "../lib/router";
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
} from "../model/calendar";
import { Hint } from "../ui/Hint";
import { Segmented, SegmentedTab } from "../ui/Segmented";
import { Button } from "../ui/Button";
import { formatDate, type MessageKey, t } from "../i18n";

const weekdays: MessageKey[] = [
  "board.mon",
  "board.tue",
  "board.wed",
  "board.thu",
  "board.fri",
  "board.sat",
  "board.sun",
];
const monthNames: MessageKey[] = [
  "board.january",
  "board.february",
  "board.march",
  "board.april",
  "board.may",
  "board.june",
  "board.july",
  "board.august",
  "board.september",
  "board.october",
  "board.november",
  "board.december",
];

/** A bar's sides: a bar that continues from the previous week or into the next one is flat and flush on that side. */
const barStart = { flush: "ml-0 rounded-l-none", own: "ml-[3px] rounded-l-sm" };
const barEnd = { flush: "mr-0 rounded-r-none", own: "mr-[3px] rounded-r-sm" };

/** A year view's chip of a card, or the "N more" link under them. */
const chipBase = `cursor-pointer rounded-sm border-0 px-1.5 py-[3px] text-left text-[12px] truncate`;

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
  const outside = (day: Date) => month !== undefined && day.getMonth() !== month;
  return (
    <div
      className={`grid grid-cols-[repeat(7,minmax(0,1fr))] gap-y-0.5 border-t border-line pb-1.5 ${tall ? "min-h-[420px]" : "min-h-[110px] max-[761px]:min-h-20"}`}
      style={{ gridTemplateRows: `26px repeat(${Math.max(row.lanes, 1)}, auto) 1fr` }}
    >
      {row.days.map((day, index) => (
        <div
          key={dayKey(day)}
          data-day={dayKey(day)}
          className={`min-w-0 border-l border-surface-sunken ${outside(day) ? "bg-surface-soft" : ""}`}
          style={{ gridColumn: index + 1, gridRow: `1 / span ${row.lanes + 2}` }}
        >
          <span
            className={`m-0.5 inline-block rounded-[10px] px-1.5 py-[3px] text-[12px] ${dayKey(day) === today ? "bg-brand text-white" : outside(day) ? "text-ink-faint" : ""}`}
          >
            {day.getDate()}
          </span>
        </div>
      ))}
      {row.segments.map((segment) => {
        const { card } = segment.item;
        const color = labels.find((label) => card.labelIds.includes(label.id) && label.color)?.color;
        return (
          <div
            key={card.id}
            className={`group relative z-1 flex min-w-0 touch-none items-center gap-1 overflow-hidden border-l-4 border-l-brand-light px-1.5 py-0.5 text-left text-[12px] text-ellipsis whitespace-nowrap text-ink select-none max-[761px]:px-[3px] max-[761px]:py-px max-[761px]:text-[11px] ${segment.continuesBefore ? barStart.flush : barStart.own} ${segment.continuesAfter ? barEnd.flush : barEnd.own} ${dragging === card.id ? "cursor-grabbing bg-[#cce0ff] shadow-[0_2px_6px_#091e4240]" : "cursor-pointer bg-brand-soft hover:bg-[#cce0ff]"}`}
            style={{
              gridColumn: `${segment.column + 1} / span ${segment.span}`,
              gridRow: segment.lane + 2,
              borderLeftColor: color,
            }}
            title={
              segment.item.end > segment.item.start
                ? t("board.barTitleRange", {
                    name: card.name,
                    from: formatDate(segment.item.start),
                    to: formatDate(segment.item.end),
                  })
                : t("board.barTitle", { name: card.name, date: formatDate(segment.item.start) })
            }
            onPointerDown={(event) => onStartDrag(event, card, "move")}
          >
            {!segment.continuesBefore && (
              <span
                className="absolute top-0 bottom-0 -left-1 w-2 cursor-ew-resize [@media(hover:none)]:w-3.5"
                aria-hidden="true"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onStartDrag(event, card, "start");
                }}
              />
            )}
            <button
              className="min-w-0 flex-1 cursor-[inherit] overflow-hidden border-0 bg-transparent p-0 text-left text-ellipsis whitespace-nowrap text-inherit"
              onClick={(event) => {
                if (event.detail === 0) onOpen(card);
              }}
              onKeyDown={(event) => {
                if (event.key === "Delete") onDelete(card);
              }}
            >
              {card.name}
            </button>
            {!segment.continuesAfter && (
              <>
                <button
                  className="flex-none cursor-pointer border-0 bg-transparent px-0.5 py-0 text-[14px] leading-none text-ink-subtle opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  aria-label={t("board.deleteCardOf", { name: card.name })}
                  title={t("common.delete")}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(card);
                  }}
                >
                  ×
                </button>
                <span
                  className="absolute top-0 -right-0.5 bottom-0 w-2 cursor-ew-resize [@media(hover:none)]:w-3.5"
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
        ? t("board.monthTitle", { month: t(monthNames[anchor.getMonth()]), year: anchor.getFullYear() })
        : t("board.dateRange", { from: formatDate(from), to: formatDate(to) });
  const boardLabels = state.labels.filter((label) => !label.deleted);
  return (
    <section
      className="mx-3 mt-0 mb-3 min-h-0 flex-1 overflow-auto rounded-[10px] bg-white p-3 text-ink"
      aria-label={t("board.boardCalendar")}
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        <Button
          variant="secondary"
          onClick={() => onNavigate(scale, dayKey(shiftAnchor(scale, anchor, -1)))}
          aria-label={t("board.previous")}
        >
          ‹
        </Button>
        <Button variant="secondary" onClick={() => onNavigate(scale, undefined)}>
          {t("board.today")}
        </Button>
        <Button
          variant="secondary"
          onClick={() => onNavigate(scale, dayKey(shiftAnchor(scale, anchor, 1)))}
          aria-label={t("board.next")}
        >
          ›
        </Button>
        <h2 className="mx-2 my-0 flex-1 text-[18px]">{title}</h2>
        <Segmented label={t("board.calendarScale")}>
          {(["week", "month", "year"] as const).map((item) => (
            <SegmentedTab key={item} selected={scale === item} onClick={() => onNavigate(item, date)}>
              {t(item === "week" ? "board.week" : item === "month" ? "board.month" : "board.year")}
            </SegmentedTab>
          ))}
        </Segmented>
      </div>
      {scale === "year" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
          {monthNames.map((name, month) => {
            const monthItems = itemsInMonth(items, anchor.getFullYear(), month);
            return (
              <div className="flex min-h-[120px] flex-col gap-[3px] rounded-lg border border-line p-2" key={name}>
                <button
                  className="cursor-pointer border-0 bg-transparent px-0 py-0.5 text-left font-bold text-ink"
                  onClick={() => onNavigate("month", dayKey(new Date(anchor.getFullYear(), month, 1)))}
                >
                  {t(name)} <small>{monthItems.length || ""}</small>
                </button>
                {monthItems.slice(0, 8).map((item) => (
                  <button
                    key={item.card.id}
                    className={`${chipBase} bg-brand-soft`}
                    onClick={() => onOpen(item.card)}
                    title={item.card.name}
                  >
                    <small>{item.start.getMonth() === month ? item.start.getDate() : "…"}</small> {item.card.name}
                  </button>
                ))}
                {monthItems.length > 8 && (
                  <button
                    className={`${chipBase} bg-transparent text-brand`}
                    onClick={() => onNavigate("month", dayKey(new Date(anchor.getFullYear(), month, 1)))}
                  >
                    {t("board.moreCount", { count: monthItems.length - 8 })}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-[repeat(7,1fr)] py-1 text-[12px] font-bold text-ink-muted">
            {weekdays.map((day) => (
              <span key={day} className="pl-1.5">
                {t(day)}
              </span>
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
      <Hint>{t("board.calendarHint")}</Hint>
    </section>
  );
}
