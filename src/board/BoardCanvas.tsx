import { useState } from "react";
import type { BoardViewData } from "../app/useBoardView";
import type { BoardActions } from "../hooks/useBoardActions";
import type { CardActions } from "../hooks/useCardActions";
import type { AppState, Board, BoardList, Zone } from "../model";
import { zoneRuns } from "../model/zones";
import { Icon } from "../ui/Icon";
import type { TileActions } from "./CardTile";
import { type ListActions, ListColumn } from "./ListColumn";
import { ZoneComposer, ZoneFrame } from "./ZoneFrame";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { addListClass, composeActionsClass, composeClass } from "./boardLook";

/**
 * The lists view of a board: lists grouped into zone frames, empty zones, and the column that adds a list or a zone.
 * It owns the new-list and new-card composers.
 */
export function BoardCanvas({
  state,
  board,
  view,
  tileActions,
  boardActions,
  cardActions,
  onDeleteList,
}: {
  state: AppState;
  board: Board;
  view: BoardViewData;
  tileActions: TileActions;
  boardActions: BoardActions;
  cardActions: CardActions;
  onDeleteList: (listId: string) => void;
}) {
  const { lists, cardsByList, filteredCardIds } = view;
  const [editingList, setEditingList] = useState(false);
  const [editingCardList, setEditingCardList] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function createList() {
    if (!draft.trim()) return;
    boardActions.createList(board.id, draft.trim(), Math.max(0, ...lists.map((item) => item.position)) + 1);
    setDraft("");
    setEditingList(false);
  }

  function createCard(listId: string) {
    if (!draft.trim()) return;
    cardActions.createCard(board.id, listId, draft.trim());
    setDraft("");
    setEditingCardList(null);
  }

  function moveListByOne(id: string, direction: -1 | 1) {
    const index = lists.findIndex((item) => item.id === id);
    const target = lists[index + direction];
    if (target) boardActions.moveList(id, target.id, direction === 1);
  }

  function removeZone(zone: Zone) {
    if (confirm(`Remove zone “${zone.name}”? Lists and cards will stay on the board.`))
      boardActions.removeZone(board.id, zone.id);
  }

  const listActions: ListActions = {
    rename: (listId, name) => boardActions.updateList(listId, (item) => ({ ...item, name })),
    run: (listId, action) => {
      if (action === "name" || action === "due") boardActions.sortList(listId, action);
      else if (action === "move-left") moveListByOne(listId, -1);
      else if (action === "move-right") moveListByOne(listId, 1);
      else if (action === "copy") boardActions.copyListOnBoard(listId);
      else if (action === "delete") onDeleteList(listId);
    },
    dropZone: (zoneId, targetListId, after) => boardActions.moveZoneTo(board.id, zoneId, targetListId, after),
    dropList: boardActions.moveList,
    dropCard: cardActions.dropCardInList,
    startCard: (listId) => {
      setEditingCardList(listId);
      setEditingList(false);
      setDraft("");
    },
    cancelCard: () => {
      setEditingCardList(null);
      setDraft("");
    },
    createCard,
    createFromTemplate: cardActions.addCardFromTemplate,
  };

  function renderList(list: BoardList) {
    return (
      <ListColumn
        key={list.id}
        list={list}
        cards={cardsByList.get(list.id) ?? []}
        labels={view.labelMap}
        members={board.members}
        cardById={view.cardById}
        tileActions={tileActions}
        templates={view.templates}
        composing={editingCardList === list.id}
        draft={draft}
        onDraft={setDraft}
        actions={listActions}
      />
    );
  }

  function renderZone(zone: Zone, zoneLists: BoardList[], key: string) {
    return (
      <ZoneFrame
        key={key}
        zone={zone}
        cardCount={
          state.cards.filter(
            (item) => zoneLists.some((entry) => entry.id === item.listId) && filteredCardIds.has(item.id),
          ).length
        }
        onRename={(name) => boardActions.changeZone(board.id, zone.id, { name })}
        onColor={(color) => boardActions.changeZone(board.id, zone.id, { color })}
        onDelete={() => removeZone(zone)}
        onDropList={(listId) => boardActions.setListZone(listId, zone.id)}
      >
        {zoneLists.length ? zoneLists.map(renderList) : undefined}
      </ZoneFrame>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 items-start gap-3 overflow-x-auto px-3 pt-3.5 pb-5 max-phone:p-2">
      {zoneRuns(lists, board.zones).map((run) =>
        run.zone
          ? renderZone(run.zone, run.lists, `zone-${run.zone.id}-${run.lists[0].id}`)
          : run.lists.map(renderList),
      )}
      {(board.zones ?? [])
        .filter((zone) => !lists.some((item) => item.zoneId === zone.id))
        .map((zone) => renderZone(zone, [], `zone-${zone.id}`))}
      <div className="add-list-column grid w-[272px] flex-none gap-1 rounded-xl bg-[#ffffff42] p-1.5">
        {editingList ? (
          <div className={composeClass}>
            <Input
              className="w-full"
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createList();
              }}
              placeholder="List title"
            />
            <div className={composeActionsClass}>
              <Button variant="primary" onClick={createList}>
                Add a list
              </Button>
              <Button
                variant="icon"
                onClick={() => {
                  setEditingList(false);
                  setDraft("");
                }}
                aria-label="Cancel"
              >
                <Icon name="close" />
              </Button>
            </div>
          </div>
        ) : (
          <button
            className={addListClass}
            onClick={() => {
              setEditingList(true);
              setEditingCardList(null);
              setDraft("");
            }}
          >
            <Icon name="plus" /> Add a list
          </button>
        )}
        {!editingList && <ZoneComposer onCreate={(name) => boardActions.addZone(board.id, name)} />}
      </div>
    </div>
  );
}
