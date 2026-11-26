import { askConfirm } from "../ui/AskDialog";
import { type DragEvent, type ReactNode, useState } from "react";
import type { BoardViewData } from "../app/useBoardView";
import type { BoardActions } from "../hooks/useBoardActions";
import type { CardActions } from "../hooks/useCardActions";
import type { AppState, Board, BoardList, Zone } from "../model";
import { boardUnits, listDropIndex, zoneRuns } from "../model/zones";
import { Icon } from "../ui/Icon";
import type { TileActions } from "./CardTile";
import { type ListActions, ListColumn } from "./ListColumn";
import { ListMovePicker } from "./ListMovePicker";
import { readCollapsedLists, saveCollapsedLists } from "../lib/uiPreferences";
import { ZoneComposer, ZoneFrame } from "./ZoneFrame";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { t } from "../i18n";
import { addListClass, composeActionsClass, composeClass } from "./boardLook";
import { currentDrag, dragKind, dropTargetAt, endDrag, setDropTarget, useDragState } from "./dragState";

/** The id of the stand-in list that marks where a dragged list would land. `data-drop-slot` marks slots for tests. */
const slotListId = "\u0000drop";
const slotLook = "flex-none bg-[#0000003d]";

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
  const [collapsedLists, setCollapsedLists] = useState(readCollapsedLists);

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

  async function removeZone(zone: Zone) {
    if (
      await askConfirm({
        title: t("board.removeZoneTitle", { name: zone.name }),
        message: t("board.removeZoneMessage"),
        confirm: t("common.remove"),
        danger: true,
      })
    )
      boardActions.removeZone(board.id, zone.id);
  }

  async function copyList(listId: string) {
    const list = lists.find((item) => item.id === listId);
    const count = state.cards.filter((item) => item.listId === listId && !item.deletedAt).length;
    if (
      list &&
      (await askConfirm({
        title: t("board.copyListTitle", { name: list.name }),
        message: t("board.copyListMessage", { count }),
        confirm: t("common.copy"),
      }))
    )
      boardActions.copyListOnBoard(listId);
  }

  async function trashListCards(listId: string) {
    const list = lists.find((item) => item.id === listId);
    const count = state.cards.filter((item) => item.listId === listId && !item.deletedAt).length;
    if (
      list &&
      count &&
      (await askConfirm({
        title: t("board.trashAllCardsTitle", { name: list.name }),
        message: t("board.trashAllCardsMessage", { cards: t("common.cards", { count }) }),
        confirm: t("board.moveToTrash"),
        danger: true,
      }))
    )
      boardActions.trashListCards(listId);
  }

  const listActions: ListActions = {
    rename: (listId, name) => boardActions.updateList(listId, (item) => ({ ...item, name })),
    run: (listId, action) => {
      if (action === "move-left") moveListByOne(listId, -1);
      else if (action === "move-right") moveListByOne(listId, 1);
      else if (action === "copy") copyList(listId);
      else if (action === "delete") onDeleteList(listId);
      else if (action === "trash-cards") trashListCards(listId);
      else boardActions.sortList(listId, action);
    },
    setColor: (listId, color) => boardActions.updateList(listId, (item) => ({ ...item, color })),
    moveCards: (listId, targetListId) => {
      for (const item of state.cards
        .filter((card) => card.listId === listId && !card.deletedAt)
        .sort((a, b) => a.position - b.position))
        cardActions.moveOrCopyCard(item.id, targetListId, false);
    },
    toggleCollapsed: (listId) =>
      setCollapsedLists((current) => {
        const next = new Set(current);
        if (!next.delete(listId)) next.add(listId);
        saveCollapsedLists(next);
        return next;
      }),
    createTemplate: (listId, name) => tileActions.open(cardActions.createCard(board.id, listId, name, true)),
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
    movePicker: (list, close) => (
      <ListMovePicker
        list={list}
        state={state}
        onMove={(boardId, atStart) => {
          boardActions.moveListOnto(list.id, boardId, atStart);
          close();
        }}
      />
    ),
  };

  // While something is dragged over the board, its own element is hidden and a dark slot of its size stands where it
  // would land, so the lists and cards around it make room as in Trello.
  const { drag, target } = useDragState();
  const cardTarget = drag?.kind === "card" && target?.kind === "card" ? target : undefined;
  const listTarget = drag?.kind === "list" && target?.kind === "list" ? target : undefined;
  const zoneTarget = drag?.kind === "zone" && target?.kind === "zone" ? target : undefined;
  const draggedList = listTarget && lists.find((item) => item.id === drag?.id);
  let shownLists = lists;
  let emptyZoneSlot: string | undefined;
  if (draggedList && listTarget) {
    const others = lists.filter((item) => item.id !== draggedList.id);
    if (listTarget.index === undefined) emptyZoneSlot = listTarget.zoneId;
    else {
      const before = others[listDropIndex(others, listTarget.index, listTarget.zoneId)];
      const slot = { ...draggedList, id: slotListId, zoneId: listTarget.zoneId };
      shownLists = [...lists];
      shownLists.splice(before ? shownLists.indexOf(before) : shownLists.length, 0, slot);
    }
  }
  const listSlot = (key: string) => (
    <div
      key={key}
      className={`${slotLook} w-[272px] rounded-xl`}
      style={{ height: drag?.height }}
      aria-hidden
      data-drop-slot="list"
    />
  );
  // Over an empty zone the list stays in its place: hiding it would move the zone away from the pointer.
  const hiddenList = (list: BoardList) => list.id === draggedList?.id && !emptyZoneSlot;

  function dropOn(event: DragEvent<HTMLDivElement>) {
    const kind = dragKind(event.dataTransfer.types);
    const id = currentDrag().drag?.id;
    return kind && dropTargetAt(event.currentTarget, kind, id, event.clientX, event.clientY, event.target as Element);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    // The place shown while dragging wins: the layout under the pointer has already made room for it.
    const shown = currentDrag().target;
    const dropped = shown && shown.kind === dragKind(event.dataTransfer.types) ? shown : dropOn(event);
    endDrag();
    if (!dropped) return;
    event.preventDefault();
    const id = event.dataTransfer.getData(`text/kanbonk-${dropped.kind}`);
    if (!id) return;
    if (dropped.kind === "card") {
      const before = (cardsByList.get(dropped.listId) ?? []).filter((item) => item.id !== id)[dropped.index];
      cardActions.dropCardAt(id, dropped.listId, before?.id);
    } else if (dropped.kind === "list") {
      if (!lists.some((item) => item.id === id)) return;
      boardActions.placeListAt(id, dropped.index ?? lists.length, dropped.zoneId);
    } else boardActions.placeZoneAt(board.id, id, dropped.index);
  }

  function renderList(list: BoardList) {
    if (list.id === slotListId) return listSlot("list-slot");
    return (
      <ListColumn
        key={list.id}
        list={list}
        lists={lists}
        collapsed={collapsedLists.has(list.id)}
        cards={cardsByList.get(list.id) ?? []}
        labels={view.labelMap}
        members={board.members}
        cardById={view.cardById}
        subCardCounts={view.subCardCounts}
        cardViews={view.cardViews}
        missingByCard={view.missingByCard}
        tileActions={tileActions}
        templates={view.templates}
        composing={editingCardList === list.id}
        draft={draft}
        onDraft={setDraft}
        actions={listActions}
        hidden={hiddenList(list)}
        draggedCardId={cardTarget && drag?.id}
        cardSlot={cardTarget?.listId === list.id ? { index: cardTarget.index, height: drag?.height ?? 0 } : undefined}
      />
    );
  }

  function renderZone(zone: Zone, zoneLists: BoardList[], key: string) {
    return (
      <ZoneFrame
        key={key}
        zone={zone}
        dropping={emptyZoneSlot === zone.id}
        hidden={
          (zoneTarget !== undefined && zone.id === drag?.id) || (zoneLists.length > 0 && zoneLists.every(hiddenList))
        }
        cardCount={
          state.cards.filter(
            (item) => zoneLists.some((entry) => entry.id === item.listId) && filteredCardIds.has(item.id),
          ).length
        }
        onRename={(name) => boardActions.changeZone(board.id, zone.id, { name })}
        onColor={(color) => boardActions.changeZone(board.id, zone.id, { color })}
        onDelete={() => removeZone(zone)}
      >
        {zoneLists.length ? zoneLists.map(renderList) : undefined}
      </ZoneFrame>
    );
  }

  /** The board's zones and lists outside zones in order; during a zone drag, a slot of the zone's size among them. */
  function units() {
    const zoneSlot = (
      <div
        key="zone-slot"
        className={`${slotLook} rounded-[14px]`}
        style={{ width: drag?.width, height: drag?.height }}
        aria-hidden
        data-drop-slot="zone"
      />
    );
    const nodes: ReactNode[] = [];
    let index = 0;
    for (const unit of zoneRuns(shownLists, board.zones).flatMap((run) =>
      run.zone ? [run] : boardUnits(run.lists).map((single) => ({ zone: undefined, lists: single })),
    )) {
      if (!(zoneTarget && unit.zone?.id === drag?.id)) {
        if (index === zoneTarget?.index) nodes.push(zoneSlot);
        index++;
      }
      nodes.push(unit.zone ? renderZone(unit.zone, unit.lists, `zone-${unit.zone.id}`) : renderList(unit.lists[0]));
    }
    if (zoneTarget && zoneTarget.index >= index) nodes.push(zoneSlot);
    return nodes;
  }

  return (
    <div
      className="flex min-h-0 flex-1 items-start gap-3 overflow-x-auto px-3 pt-3.5 pb-5 max-phone:p-2"
      onDragOver={(event) => {
        const over = dropOn(event);
        setDropTarget(over || undefined);
        if (over) event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(undefined);
      }}
      onDrop={drop}
    >
      {units()}
      {(board.zones ?? [])
        .filter((zone) => !shownLists.some((item) => item.zoneId === zone.id))
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
              placeholder={t("board.listTitle")}
            />
            <div className={composeActionsClass}>
              <Button variant="primary" onClick={createList}>
                {t("board.addList")}
              </Button>
              <Button
                variant="icon"
                onClick={() => {
                  setEditingList(false);
                  setDraft("");
                }}
                aria-label={t("common.cancel")}
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
            <Icon name="plus" /> {t("board.addList")}
          </button>
        )}
        {!editingList && <ZoneComposer onCreate={(name) => boardActions.addZone(board.id, name)} />}
      </div>
    </div>
  );
}
