import { useState } from "react";
import { t } from "../i18n";
import { type AppState, type Card, positionAt } from "../model";
import { inboxBoardId, inboxWorkspaceId } from "../model/inbox";
import { Button } from "../ui/Button";
import { Select } from "../ui/Field";

const tabClass =
  "-mb-px cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-0 pt-1 pb-1.5 text-[14px] text-ink-subtle aria-selected:border-brand aria-selected:text-brand";
const labelClass = "grid gap-1.5 text-[14px] font-bold text-ink";
/** Its options are styled in styles/index.css, where browsers allow it. */
const selectClass = "move-select w-full min-w-0";

function sortedLists(state: AppState, boardId: string) {
  return state.lists
    .filter((item) => item.boardId === boardId && !item.deletedAt)
    .sort((a, b) => a.position - b.position);
}

/** A position dropdown: 1 to the number of places in the list, the card's own place marked as current. */
function PositionSelect({
  card,
  state,
  listId,
  value,
  onChange,
  label,
}: {
  card: Card;
  state: AppState;
  listId: string;
  value: number;
  onChange: (index: number) => void;
  label?: string;
}) {
  const others = state.cards.filter((item) => item.listId === listId && item.id !== card.id && !item.deletedAt);
  const current = listId === card.listId ? currentIndex(state, card) : -1;
  return (
    <Select
      className={selectClass}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label={label}
    >
      {Array.from({ length: others.length + 1 }, (_, index) => (
        <option key={index} value={index} data-current={index === current ? t("card.current") : undefined}>
          {index + 1}
        </option>
      ))}
    </Select>
  );
}

function currentIndex(state: AppState, card: Card) {
  return state.cards
    .filter((item) => item.listId === card.listId && !item.deletedAt)
    .sort((a, b) => a.position - b.position)
    .findIndex((item) => item.id === card.id);
}

/**
 * Moves the card to a place in the Inbox or in a list of any open board, as Trello's "Move card": a tab for each, a
 * board grouped by workspace, a list and a position, the card's current ones marked.
 */
export function MovePicker({
  card,
  state,
  onMove,
}: {
  card: Card;
  state: AppState;
  /** `position` is the card's position value in the target list. */
  onMove: (listId: string, position: number) => void;
}) {
  const inInbox = card.boardId === inboxBoardId;
  const [tab, setTab] = useState<"inbox" | "board">(inInbox ? "inbox" : "board");
  const boards = state.boards.filter(
    (item) => item.id !== inboxBoardId && !item.deletedAt && sortedLists(state, item.id).length,
  );
  const workspaces = state.workspaces.filter(
    (item) => item.id !== inboxWorkspaceId && !item.deletedAt && boards.some((board) => board.workspaceId === item.id),
  );
  const [boardId, setBoardId] = useState(inInbox ? (boards[0]?.id ?? "") : card.boardId);
  const [listId, setListId] = useState(inInbox ? (sortedLists(state, boardId)[0]?.id ?? "") : card.listId);
  const inboxListId = sortedLists(state, inboxBoardId)[0]?.id ?? "";
  const start = (target: string) => (target === card.listId ? currentIndex(state, card) : 0);
  const [index, setIndex] = useState(start(inInbox ? inboxListId : card.listId));
  const targetListId = tab === "inbox" ? inboxListId : listId;

  function choose(nextTab: "inbox" | "board", nextList: string) {
    setTab(nextTab);
    setIndex(start(nextList));
  }
  function move() {
    if (targetListId === card.listId && index === currentIndex(state, card)) onMove(card.listId, card.position);
    else onMove(targetListId, positionAt(state.cards, targetListId, card.id, index));
  }

  return (
    <div className="grid gap-4">
      <div className="flex gap-6 border-b border-line" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "inbox"}
          className={tabClass}
          onClick={() => choose("inbox", inboxListId)}
        >
          {t("layout.inbox")}
        </button>
        <button role="tab" aria-selected={tab === "board"} className={tabClass} onClick={() => choose("board", listId)}>
          {t("card.board")}
        </button>
      </div>
      {tab === "inbox" ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[14px] text-ink">{t("card.selectPosition")}</span>
          <div className="w-[115px]">
            <PositionSelect
              card={card}
              state={state}
              listId={inboxListId}
              value={index}
              onChange={setIndex}
              label={t("card.position")}
            />
          </div>
        </div>
      ) : (
        <>
          <h5 className="m-0 text-[12px] font-semibold text-ink-subtle">{t("card.selectDestination")}</h5>
          <label className={labelClass}>
            {t("card.board")}
            <Select
              className={selectClass}
              value={boardId}
              onChange={(event) => {
                const id = event.target.value;
                const first = id === card.boardId ? card.listId : (sortedLists(state, id)[0]?.id ?? "");
                setBoardId(id);
                setListId(first);
                setIndex(start(first));
              }}
            >
              {workspaces.map((workspace) => (
                <optgroup key={workspace.id} label={workspace.name}>
                  {boards
                    .filter((item) => item.workspaceId === workspace.id)
                    .map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        data-current={item.id === card.boardId ? t("card.current") : undefined}
                      >
                        {item.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
          </label>
          <div className="grid grid-cols-[1fr_115px] gap-3">
            <label className={labelClass}>
              {t("card.list")}
              <Select
                className={selectClass}
                value={listId}
                onChange={(event) => {
                  setListId(event.target.value);
                  setIndex(start(event.target.value));
                }}
              >
                {sortedLists(state, boardId).map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                    data-current={item.id === card.listId ? t("card.current") : undefined}
                  >
                    {item.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className={labelClass}>
              {t("card.position")}
              <PositionSelect card={card} state={state} listId={listId} value={index} onChange={setIndex} />
            </label>
          </div>
        </>
      )}
      <Button variant="primary" onClick={move} disabled={!targetListId}>
        {t("common.move")}
      </Button>
    </div>
  );
}
