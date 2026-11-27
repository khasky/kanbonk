import { formatDate, t } from "../i18n";
import type { BoardList, Card } from "../model";
import { type CalendarItem, daySections, dueSummary } from "../model/calendar";
import { dialogListClass } from "../dialogs/dialogLook";
import { CardGroup } from "../ui/CardGroup";
import { Hint } from "../ui/Hint";
import { SidePanel } from "../ui/Modal";
import { NewCardForm } from "./NewCardForm";

/** A titled group of the calendar's cards, each with its list and due date. */
function CalendarGroup({
  title,
  cards,
  lists,
  onOpen,
}: {
  title: string;
  cards: Card[];
  lists: Map<string, BoardList>;
  onOpen: (card: Card) => void;
}) {
  return (
    <CardGroup
      title={title}
      cards={cards}
      note={(card) => [lists.get(card.listId)?.name, card.dueAt && formatDate(card.dueAt)].filter(Boolean).join(" · ")}
      empty={t("calendar.noCards")}
      onOpen={onOpen}
    />
  );
}

/** A day's cards (due, starting and running through it) and a form that adds a card due that day. */
export function CalendarDayPanel({
  day,
  items,
  lists,
  onOpen,
  onCreate,
  onClose,
}: {
  day: Date;
  items: CalendarItem[];
  lists: BoardList[];
  onOpen: (card: Card) => void;
  onCreate: (listId: string, name: string) => void;
  onClose: () => void;
}) {
  const byId = new Map(lists.map((list) => [list.id, list]));
  const { due, starts, ongoing } = daySections(items, day);
  return (
    <SidePanel
      title={formatDate(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      onClose={onClose}
    >
      <div className={dialogListClass}>
        <CalendarGroup title={t("calendar.due")} cards={due} lists={byId} onOpen={onOpen} />
        <CalendarGroup title={t("calendar.starts")} cards={starts} lists={byId} onOpen={onOpen} />
        <CalendarGroup title={t("calendar.ongoing")} cards={ongoing} lists={byId} onOpen={onOpen} />
        <NewCardForm
          title={t("calendar.addCard")}
          lists={lists}
          className="border-t border-line pt-3"
          onCreate={onCreate}
        />
      </div>
    </SidePanel>
  );
}

/** The cards counted by due date: with one, done, overdue, upcoming and without one. */
export function CalendarSummaryPanel({
  cards,
  lists,
  onOpen,
  onClose,
}: {
  cards: Card[];
  lists: BoardList[];
  onOpen: (card: Card) => void;
  onClose: () => void;
}) {
  const byId = new Map(lists.map((list) => [list.id, list]));
  const summary = dueSummary(cards, new Date());
  return (
    <SidePanel title={t("calendar.summary")} onClose={onClose}>
      <div className={dialogListClass}>
        <Hint>{t("calendar.summaryHint")}</Hint>
        <CalendarGroup title={t("calendar.withDue")} cards={summary.withDue} lists={byId} onOpen={onOpen} />
        <CalendarGroup title={t("calendar.overdue")} cards={summary.overdue} lists={byId} onOpen={onOpen} />
        <CalendarGroup title={t("calendar.upcoming")} cards={summary.upcoming} lists={byId} onOpen={onOpen} />
        <CalendarGroup title={t("calendar.done")} cards={summary.done} lists={byId} onOpen={onOpen} />
        <CalendarGroup title={t("calendar.noDue")} cards={summary.noDue} lists={byId} onOpen={onOpen} />
      </div>
    </SidePanel>
  );
}
