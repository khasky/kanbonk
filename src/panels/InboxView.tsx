import { connectionBadges } from "../model/connections";
import { useMemo, useState } from "react";
import { CardTile } from "../board/CardTile";
import { currentDrag, dragKind, endDrag, useDragState } from "../board/dragState";
import { t } from "../i18n";
import { inboxBoardId } from "../model/inbox";
import { cardViewStats, emptyBoardFilter, filterBoardCards, type AppState, type BoardFilter } from "../model";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Field";

const selectClass = "flex-[1_1_110px] max-phone:min-h-11";

/**
 * The Inbox: a form for new cards, a search, a due filter and a sort, and its cards as the same tiles as on a board.
 * A card dragged from a board and dropped here moves into the Inbox.
 */
export function InboxView({
  state,
  onCreate,
  onOpen,
  onDropCard,
}: {
  state: AppState;
  onCreate: (name: string) => void;
  onOpen: (id: string) => void;
  onDropCard: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [dropping, setDropping] = useState(false);
  const labels = useMemo(
    () => new Map(state.labels.filter((item) => !item.deleted).map((item) => [item.id, item])),
    [state.labels],
  );
  const cardById = useMemo(() => new Map(state.cards.map((item) => [item.id, item])), [state.cards]);
  const cardViews = useMemo(() => cardViewStats(state), [state]);
  const connectionInfo = useMemo(() => connectionBadges(state), [state]);
  const tileActions = useMemo(() => ({ open: onOpen }), [onOpen]);
  /** Whether the card being dragged comes from a board, so it can be dropped here. */
  const fromBoard = (types: readonly string[]) =>
    dragKind(types) === "card" && cardById.get(currentDrag().drag?.id ?? "")?.boardId !== inboxBoardId;
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
      className={`inbox-view min-h-0 flex-1 overflow-auto p-4 text-ink ${dropping ? "bg-[#cce0ff] outline-2 -outline-offset-2 outline-brand outline-dashed" : "bg-brand-soft"}`}
      aria-label={t("panels.inbox")}
      onDragOver={(event) => {
        if (!fromBoard(event.dataTransfer.types)) return;
        event.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={(event) => {
        setDropping(false);
        if (!fromBoard(event.dataTransfer.types)) return;
        event.preventDefault();
        const id = event.dataTransfer.getData("text/kanbonk-card");
        endDrag();
        if (id) onDropCard(id);
      }}
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
          <CardTile
            key={card.id}
            card={card}
            labels={labels}
            parentName={card.parentCardId ? cardById.get(card.parentCardId)?.name : undefined}
            subCardCount={connectionInfo.get(card.id)?.progress?.total}
            subCardsDone={connectionInfo.get(card.id)?.progress?.done}
            blockers={connectionInfo.get(card.id)?.blockers}
            linkCount={connectionInfo.get(card.id)?.connections}
            epicName={connectionInfo.get(card.id)?.epic}
            viewCount={cardViews.get(card.id)?.total}
            lastViewedAt={cardViews.get(card.id)?.lastAt}
            actions={tileActions}
            hidden={drag?.id === card.id && Boolean(target)}
          />
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
