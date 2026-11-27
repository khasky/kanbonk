import { useState } from "react";
import { formatDate, t } from "../i18n";
import type { BoardList, Card } from "../model";
import { type CalendarItem, daySections, dueSummary } from "../model/calendar";
import { dialogListClass, fieldLabelClass } from "../dialogs/dialogLook";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Field";
import { Hint } from "../ui/Hint";
import { SidePanel, submitWith } from "../ui/Modal";

/** A titled group of cards with its count, each card a button that opens it, with its list and due date. */
function CardGroup({
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
    <section className="mb-2 grid gap-1" aria-label={title}>
      <h3 className="m-0 flex items-center gap-2 text-[14px]">
        {title}
        <span className="font-normal text-ink-subtle">{cards.length}</span>
      </h3>
      {cards.length ? (
        <ul className="m-0 grid list-none gap-0.5 p-0">
          {cards.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-baseline gap-2 rounded-sm border-0 bg-transparent px-1 py-1 text-left text-ink hover:bg-surface-sunken"
                onClick={() => onOpen(card)}
              >
                <span className="min-w-0 flex-1 truncate">{card.name}</span>
                <span className="flex-none text-[12px] text-ink-subtle">
                  {[lists.get(card.listId)?.name, card.dueAt && formatDate(card.dueAt)].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[13px] text-ink-subtle">{t("calendar.noCards")}</p>
      )}
    </section>
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
  const [name, setName] = useState("");
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const byId = new Map(lists.map((list) => [list.id, list]));
  const { due, starts, ongoing } = daySections(items, day);
  const chosen = byId.has(listId) ? listId : lists[0]?.id;
  return (
    <SidePanel
      title={formatDate(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      onClose={onClose}
    >
      <div className={dialogListClass}>
        <CardGroup title={t("calendar.due")} cards={due} lists={byId} onOpen={onOpen} />
        <CardGroup title={t("calendar.starts")} cards={starts} lists={byId} onOpen={onOpen} />
        <CardGroup title={t("calendar.ongoing")} cards={ongoing} lists={byId} onOpen={onOpen} />
        {chosen && (
          <form
            className="grid gap-2 border-t border-line pt-3"
            aria-label={t("calendar.addCard")}
            onSubmit={submitWith(() => {
              if (!name.trim()) return;
              onCreate(chosen, name.trim());
              setName("");
            })}
          >
            <h3 className="m-0 text-[14px]">{t("calendar.addCard")}</h3>
            <label className={fieldLabelClass}>
              {t("calendar.cardName")}
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className={fieldLabelClass}>
              {t("calendar.list")}
              <Select value={chosen} onChange={(event) => setListId(event.target.value)}>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </Select>
            </label>
            <Button variant="primary" type="submit" disabled={!name.trim()} className="justify-self-start">
              {t("calendar.add")}
            </Button>
          </form>
        )}
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
        <CardGroup title={t("calendar.withDue")} cards={summary.withDue} lists={byId} onOpen={onOpen} />
        <CardGroup title={t("calendar.overdue")} cards={summary.overdue} lists={byId} onOpen={onOpen} />
        <CardGroup title={t("calendar.upcoming")} cards={summary.upcoming} lists={byId} onOpen={onOpen} />
        <CardGroup title={t("calendar.done")} cards={summary.done} lists={byId} onOpen={onOpen} />
        <CardGroup title={t("calendar.noDue")} cards={summary.noDue} lists={byId} onOpen={onOpen} />
      </div>
    </SidePanel>
  );
}
