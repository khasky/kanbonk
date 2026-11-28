import { useMemo, useState } from "react";
import type { AppState, BoardList, Card } from "../model";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CalendarScale } from "../lib/router";
import {
  atDay,
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
import { Icon } from "../ui/Icon";
import { tileMetaIconClass, tileMetaItemClass } from "./tileLook";
import { Segmented, SegmentedTab } from "../ui/Segmented";
import { Button } from "../ui/Button";
import { DayButton } from "../ui/DayButton";
import { formatDate, type MessageKey, t } from "../i18n";
import { useWeekStart } from "../lib/weekStart";
import { CalendarDayPanel, CalendarSummaryPanel } from "./CalendarPanels";
import { CalendarPrintExport } from "./CalendarPrintExport";

/** Sunday to Saturday, as `Date.getDay()` numbers them. */
const weekdays: MessageKey[] = [
  "board.sun",
  "board.mon",
  "board.tue",
  "board.wed",
  "board.thu",
  "board.fri",
  "board.sat",
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
const barStart = { flush: "ml-0 rounded-l-none", own: "ml-1 rounded-l-md" };
const barEnd = { flush: "mr-0 rounded-r-none", own: "mr-1 rounded-r-md" };

/** A year view's chip of a card, or the "N more" link under them. */

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
  onOpenDay,
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
  onOpenDay: (day: Date) => void;
}) {
  const outside = (day: Date) => month !== undefined && day.getMonth() !== month;
  return (
    <div
      className={`grid grid-cols-[repeat(7,minmax(0,1fr))] gap-y-1 border-t border-line ${tall ? "min-h-[420px]" : "min-h-[110px] max-[761px]:min-h-20"}`}
      style={{ gridTemplateRows: `26px repeat(${Math.max(row.lanes, 1)}, auto) minmax(6px, 1fr)` }}
    >
      {row.days.map((day, index) => (
        <div
          key={dayKey(day)}
          data-day={dayKey(day)}
          className={`min-w-0 border-l border-line ${outside(day) ? "bg-surface-soft" : "bg-surface-sunken"}`}
          style={{ gridColumn: index + 1, gridRow: "1 / -1" }}
        >
          <DayButton
            look="label"
            today={dayKey(day) === today}
            outside={outside(day)}
            aria-label={t("calendar.openDay", { date: formatDate(day) })}
            title={t("calendar.openDay", { date: formatDate(day) })}
            onClick={() => onOpenDay(day)}
          >
            {day.getDate()}
          </DayButton>
        </div>
      ))}
      {row.segments.map((segment) => {
        const { card } = segment.item;
        const colors = labels.filter((label) => card.labelIds.includes(label.id) && label.color);
        return (
          <div
            key={card.id}
            className={`group relative z-1 flex min-w-0 touch-none flex-col gap-1 bg-white px-2 py-1.5 text-left text-[14px] leading-[18px] text-ink select-none max-[761px]:px-1 max-[761px]:py-1 max-[761px]:text-[12px] ${segment.continuesBefore ? barStart.flush : barStart.own} ${segment.continuesAfter ? barEnd.flush : barEnd.own} ${dragging === card.id ? "cursor-grabbing shadow-[0_2px_7px_#091e4255]" : "cursor-pointer shadow-tile-soft hover:shadow-[0_2px_7px_#091e4255]"}`}
            style={{
              gridColumn: `${segment.column + 1} / span ${segment.span}`,
              gridRow: segment.lane + 2,
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
            {colors.length > 0 && (
              <span className="flex flex-wrap gap-1" aria-hidden="true">
                {colors.map((label) => (
                  <span
                    key={label.id}
                    className="h-2 w-10 rounded-full"
                    style={{ background: label.color }}
                    title={label.name}
                  />
                ))}
              </span>
            )}
            <span className="flex min-w-0 items-center gap-1">
              <Button
                variant="text"
                className="calendar-bar-name min-w-0 flex-1 truncate"
                onClick={(event) => {
                  if (event.detail === 0) onOpen(card);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Delete") onDelete(card);
                }}
              >
                {card.name}
              </Button>
              {!segment.continuesAfter && (
                <Button
                  variant="icon"
                  className="flex-none p-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  aria-label={t("board.deleteCardOf", { name: card.name })}
                  title={t("common.delete")}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(card);
                  }}
                >
                  <Icon name="close" className="size-3.5" />
                </Button>
              )}
            </span>
            {card.description || card.attachments.length || card.comments.length || card.checklists.length ? (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-muted">
                {card.description && <Icon name="text" className={tileMetaIconClass} />}
                {card.attachments.length > 0 && (
                  <span className={tileMetaItemClass}>
                    <Icon name="clip" className={tileMetaIconClass} />
                    {card.attachments.length}
                  </span>
                )}
                {card.comments.length > 0 && (
                  <span className={tileMetaItemClass}>
                    <Icon name="message" className={tileMetaIconClass} />
                    {card.comments.length}
                  </span>
                )}
                {card.checklists.map((checklist) => (
                  <span key={checklist.id} className={tileMetaItemClass}>
                    <Icon name="check-square" className={tileMetaIconClass} />
                    {checklist.items.filter((entry) => entry.checked).length}/{checklist.items.length}
                  </span>
                ))}
              </span>
            ) : null}
            {!segment.continuesAfter && (
              <span
                className="absolute top-0 -right-0.5 bottom-0 w-2 cursor-ew-resize [@media(hover:none)]:w-3.5"
                aria-hidden="true"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onStartDrag(event, card, "end");
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BoardCalendar({
  state,
  boardName,
  cards,
  lists,
  scale,
  date,
  onNavigate,
  onOpen,
  onReschedule,
  onDelete,
  onCreateCard,
}: {
  state: AppState;
  boardName: string;
  cards: Card[];
  /** The board's lists, for a card added from the day panel. */
  lists: BoardList[];
  scale: CalendarScale;
  date?: string;
  onNavigate: (scale: CalendarScale, date?: string) => void;
  onOpen: (card: Card) => void;
  onReschedule: (card: Card, dates: { startAt?: string; dueAt?: string }) => void;
  onDelete: (card: Card) => void;
  onCreateCard: (listId: string, name: string, dueAt: string) => void;
}) {
  const weekStart = useWeekStart();
  const [openDay, setOpenDay] = useState<Date>();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement>();
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
  const { from, to } = calendarRange(scale, anchor, weekStart);
  const title =
    scale === "year"
      ? String(anchor.getFullYear())
      : scale === "month"
        ? t("board.monthTitle", { month: t(monthNames[anchor.getMonth()]), year: anchor.getFullYear() })
        : t("board.dateRange", { from: formatDate(from), to: formatDate(to) });
  const boardLabels = state.labels.filter((label) => !label.deleted);
  return (
    <section
      className="board-calendar mx-3 mt-0 mb-3 min-h-0 flex-1 overflow-auto rounded-[10px] bg-white p-3 text-ink"
      aria-label={t("board.boardCalendar")}
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        <div className="contents" data-print-skip>
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
        </div>
        <h2 className="mx-2 my-0 flex-1 text-[18px]">{title}</h2>
        <div className="contents" data-print-skip>
          <Button variant="secondary" onClick={() => setSummaryOpen(true)}>
            {t("calendar.summary")}
          </Button>
          <Button
            variant="secondary"
            aria-expanded={Boolean(exportAnchor)}
            onClick={(event) => setExportAnchor(exportAnchor ? undefined : event.currentTarget)}
          >
            {t("calendar.printExport")}
          </Button>
          <Segmented label={t("board.calendarScale")}>
            {(["week", "month", "year"] as const).map((item) => (
              <SegmentedTab key={item} selected={scale === item} onClick={() => onNavigate(item, date)}>
                {t(item === "week" ? "board.week" : item === "month" ? "board.month" : "board.year")}
              </SegmentedTab>
            ))}
          </Segmented>
        </div>
      </div>
      {scale === "year" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
          {monthNames.map((name, month) => {
            const monthItems = itemsInMonth(items, anchor.getFullYear(), month);
            return (
              <div className="flex min-h-[120px] flex-col gap-[3px] rounded-lg border border-line p-2" key={name}>
                <Button
                  variant="text"
                  className="py-0.5 font-bold"
                  onClick={() => onNavigate("month", dayKey(new Date(anchor.getFullYear(), month, 1)))}
                >
                  {t(name)} <small>{monthItems.length || ""}</small>
                </Button>
                {monthItems.slice(0, 8).map((item) => (
                  <Button key={item.card.id} variant="chip" onClick={() => onOpen(item.card)} title={item.card.name}>
                    <small>{item.start.getMonth() === month ? item.start.getDate() : "…"}</small>{" "}
                    <span className="calendar-bar-name">{item.card.name}</span>
                  </Button>
                ))}
                {monthItems.length > 8 && (
                  <Button
                    variant="link-quiet"
                    className="px-1.5 py-[3px]"
                    onClick={() => onNavigate("month", dayKey(new Date(anchor.getFullYear(), month, 1)))}
                  >
                    <small>{t("board.moreCount", { count: monthItems.length - 8 })}</small>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-[repeat(7,1fr)] py-1 text-[12px] font-bold text-ink-muted">
            {weekdays.map((_, index) => {
              const day = weekdays[(index + weekStart) % 7];
              return (
                <span key={day} className="pl-1.5">
                  {t(day)}
                </span>
              );
            })}
          </div>
          {(scale === "week"
            ? [layoutWeek(startOfWeek(anchor, weekStart), items)]
            : monthWeeks(anchor, items, weekStart)
          ).map((row) => (
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
              onOpenDay={setOpenDay}
            />
          ))}
        </div>
      )}
      <div data-print-skip>
        <Hint>{t("board.calendarHint")}</Hint>
      </div>
      {openDay && (
        <CalendarDayPanel
          day={openDay}
          items={baseItems}
          lists={lists}
          onOpen={(card) => {
            setOpenDay(undefined);
            onOpen(card);
          }}
          onCreate={(listId, name) => onCreateCard(listId, name, atDay(openDay))}
          onClose={() => setOpenDay(undefined)}
        />
      )}
      {summaryOpen && (
        <CalendarSummaryPanel
          cards={cards}
          lists={lists}
          onOpen={(card) => {
            setSummaryOpen(false);
            onOpen(card);
          }}
          onClose={() => setSummaryOpen(false)}
        />
      )}
      {exportAnchor && (
        <CalendarPrintExport
          state={state}
          cards={cards}
          from={from}
          to={to}
          fileName={`${boardName} ${title}`}
          anchor={exportAnchor}
          onClose={() => setExportAnchor(undefined)}
        />
      )}
    </section>
  );
}
