import { useState } from "react";
import { endDrag, startDrag, useDragState } from "../board/dragState";
import { CardCover } from "../card/CardCover";
import { CardStickers } from "../card/CardStickers";
import { formatDate, t } from "../i18n";
import { inboxBoardId } from "../model/inbox";
import { emptyBoardFilter, filterBoardCards, type AppState, type BoardFilter } from "../model";
import { Icon } from "../ui/Icon";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Field";
import { tileClass, tileMetaClass, tileMetaIconClass, tileMetaItemClass, tileNameClass } from "../board/tileLook";

const selectClass = "flex-[1_1_110px] max-phone:min-h-11";

export function InboxView({
  state,
  onCreate,
  onOpen,
}: {
  state: AppState;
  onCreate: (name: string) => void;
  onOpen: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const { drag, target } = useDragState();
  const [keyword, setKeyword] = useState("");
  const [due, setDue] = useState<BoardFilter["due"]>("any");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const cards = filterBoardCards(state, inboxBoardId, { ...emptyBoardFilter(), keyword, due }).sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name)
      : sort === "newest"
        ? b.position - a.position
        : a.position - b.position,
  );
  function addCard() {
    if (!draft.trim()) return;
    onCreate(draft);
    setDraft("");
  }
  return (
    <section
      className="inbox-view min-h-0 flex-1 overflow-auto bg-brand-soft p-4 text-ink"
      aria-label={t("panels.inbox")}
    >
      <header className="flex max-w-[760px] items-start justify-between gap-4">
        <div>
          <h1 className="mx-0 mt-0 mb-1.5 text-[17px]">{t("panels.inbox")}</h1>
          <p className="mx-0 mt-0 mb-4 text-[12px] leading-[1.4] text-ink-subtle">{t("panels.inboxIntro")}</p>
        </div>
      </header>
      <form
        className="mb-5 flex max-w-[760px] flex-col gap-2 max-phone:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          addCard();
        }}
      >
        <Input
          className="min-w-0 flex-1 max-phone:min-h-11"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("panels.addCard")}
          aria-label={t("panels.newInboxCard")}
          required
        />
        <Button variant="primary" type="submit" className="max-phone:min-h-11">
          {t("common.add")}
        </Button>
      </form>
      <div className="mb-3.5 flex max-w-[760px] flex-wrap gap-2">
        <Input
          size="sm"
          className="min-w-[150px] flex-1 max-phone:min-h-11"
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t("panels.searchInbox")}
          aria-label={t("panels.searchInbox")}
        />
        <Select
          size="sm"
          className={selectClass}
          value={due}
          onChange={(event) => setDue(event.target.value as BoardFilter["due"])}
          aria-label={t("panels.inboxDue")}
        >
          <option value="any">{t("panels.anyDue")}</option>
          <option value="overdue">{t("panels.overdue")}</option>
          <option value="next-week">{t("panels.nextWeekDue")}</option>
          <option value="none">{t("panels.noDue")}</option>
        </Select>
        <Select
          size="sm"
          className={selectClass}
          value={sort}
          onChange={(event) => setSort(event.target.value as typeof sort)}
          aria-label={t("panels.inboxSorting")}
        >
          <option value="newest">{t("panels.newestFirst")}</option>
          <option value="oldest">{t("panels.oldestFirst")}</option>
          <option value="name">{t("panels.byTitle")}</option>
        </Select>
      </div>
      <div className="grid max-w-[760px] gap-2">
        {cards.map((card) => (
          <button
            className={tileClass()}
            key={card.id}
            style={drag?.id === card.id && target ? { display: "none" } : undefined}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("text/kanbonk-card", card.id);
              startDrag(event.currentTarget, { kind: "card", id: card.id });
            }}
            onDragEnd={endDrag}
            onClick={() => onOpen(card.id)}
          >
            <CardCover card={card} />
            <CardStickers card={card} />
            <span className={tileNameClass()}>{card.name}</span>
            <span className={tileMetaClass()}>
              {card.dueAt && (
                <span className={tileMetaItemClass}>
                  <Icon name="clock" className={tileMetaIconClass} /> {formatDate(card.dueAt)}
                </span>
              )}
              {card.checklists.length > 0 && (
                <span className={tileMetaItemClass}>
                  ☑{" "}
                  {card.checklists.reduce((count, list) => count + list.items.filter((item) => item.checked).length, 0)}
                  /{card.checklists.reduce((count, list) => count + list.items.length, 0)}
                </span>
              )}
              {card.attachments.length > 0 && (
                <span className={tileMetaItemClass}>
                  <Icon name="clip" className={tileMetaIconClass} /> {card.attachments.length}
                </span>
              )}
            </span>
          </button>
        ))}
        {!cards.length && (
          <p className="p-[22px] text-center text-ink-muted">
            {keyword || due !== "any" ? t("panels.nothingFound") : t("panels.inboxEmpty")}
          </p>
        )}
      </div>
    </section>
  );
}
