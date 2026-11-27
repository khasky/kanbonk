import type { Dispatch, SetStateAction } from "react";
import { boardColors } from "../board/BoardMenu";
import type { BoardCopyOptions } from "../dialogs/BoardCopyDialog";
import {
  type AppState,
  type AutomationRule,
  type Board,
  type BoardList,
  cardViewStats,
  copyBoard,
  copyList,
  moveListToBoard,
  newId,
  type ListSort,
  type Revision,
  recordRevision,
  recordRevisions,
  restoreRevision,
  sortListCards,
  setListPriority,
  type Priority,
} from "../model";
import { moveToTrash } from "../model/trash";
import { ensurePersonalWorkspace, personalWorkspaceId } from "../model/workspaces";
import { createZone, deleteZone, moveListToList, placeList, placeZone, updateZone } from "../model/zones";

/**
 * Changes to workspaces, boards, lists, zones and board automations. Every change records a revision with this
 * device's id. Functions that create something return its id so the caller can open it.
 */
export function useBoardActions({
  setState,
  deviceId,
}: {
  setState: Dispatch<SetStateAction<AppState>>;
  deviceId: string;
}) {
  function createWorkspace(name: string) {
    const workspace = { id: newId(), name };
    setState((current) =>
      recordRevision(
        { ...current, workspaces: [...current.workspaces, workspace] },
        "workspace",
        workspace.id,
        deviceId,
      ),
    );
    return workspace.id;
  }

  /** Creates a board in the workspace, or in the personal workspace when there is none. */
  function createBoard(name: string, workspaceId: string | undefined) {
    const targetWorkspaceId = workspaceId ?? personalWorkspaceId;
    const created: Board = {
      id: newId(),
      workspaceId: targetWorkspaceId,
      name,
      description: "",
      background: boardColors[0],
      members: [],
      starred: false,
    };
    setState((current) => {
      const next = ensurePersonalWorkspace(current, targetWorkspaceId, deviceId);
      if (!next.workspaces.some((item) => item.id === targetWorkspaceId && !item.deletedAt)) return current;
      return recordRevision({ ...next, boards: [...next.boards, created] }, "board", created.id, deviceId);
    });
    return created.id;
  }

  function copyBoardTo(boardId: string, options: BoardCopyOptions) {
    const id = newId();
    setState((current) => {
      const copied = copyBoard(current, boardId, options, id);
      return recordRevisions(
        copied.state,
        [
          { kind: "board", id },
          ...copied.listIds.map((listId) => ({ kind: "list" as const, id: listId })),
          ...copied.state.labels
            .filter((item) => item.boardId === id)
            .map((label) => ({ kind: "label" as const, id: label.id })),
          ...copied.cardIds.map((cardId) => ({ kind: "card" as const, id: cardId })),
        ],
        deviceId,
      );
    });
    return id;
  }

  function updateBoard(boardId: string, change: (item: Board) => Board) {
    setState((current) =>
      recordRevision(
        { ...current, boards: current.boards.map((item) => (item.id === boardId ? change(item) : item)) },
        "board",
        boardId,
        deviceId,
      ),
    );
  }

  function createList(boardId: string, name: string, position: number) {
    const created = { id: newId(), boardId, name, position };
    setState((current) =>
      recordRevision({ ...current, lists: [...current.lists, created] }, "list", created.id, deviceId),
    );
  }

  function updateList(id: string, change: (item: BoardList) => BoardList) {
    setState((current) =>
      recordRevision(
        { ...current, lists: current.lists.map((item) => (item.id === id ? change(item) : item)) },
        "list",
        id,
        deviceId,
      ),
    );
  }

  function moveList(id: string, targetId: string, after = false) {
    setState((current) => moveListToList(current, id, targetId, after, deviceId));
  }

  function copyListOnBoard(id: string) {
    const copyId = newId();
    setState((current) => {
      if (!current.lists.some((list) => list.id === id && !list.deletedAt)) return current;
      const copied = copyList(current, id, copyId);
      return recordRevisions(
        copied.state,
        [
          { kind: "list", id: copied.listId },
          ...copied.cardIds.map((cardId) => ({ kind: "card" as const, id: cardId })),
        ],
        deviceId,
      );
    });
  }

  /** Moves a list with its cards to the very start or end of a board, this one or another. */
  function moveListOnto(id: string, boardId: string, atStart: boolean) {
    setState((current) => {
      if (!current.lists.some((list) => list.id === id && !list.deletedAt)) return current;
      const sourceBoardId = current.lists.find((list) => list.id === id)!.boardId;
      const moved = moveListToBoard(current, id, boardId, atStart);
      const known = new Set(current.labels.map((label) => label.id));
      return recordRevisions(
        moved.state,
        [
          { kind: "list", id },
          ...moved.cardIds.map((cardId) => ({ kind: "card" as const, id: cardId })),
          ...moved.state.labels
            .filter((label) => !known.has(label.id))
            .map((label) => ({ kind: "label" as const, id: label.id })),
          ...(sourceBoardId === boardId
            ? []
            : [sourceBoardId, boardId].map((boardRef) => ({ kind: "board" as const, id: boardRef }))),
        ],
        deviceId,
      );
    });
  }

  /** Moves every open card of a list to the trash, each card on its own as when trashed one by one. */
  function trashListCards(listId: string) {
    setState((current) =>
      current.cards
        .filter((card) => card.listId === listId && !card.deletedAt)
        .reduce((next, card) => moveToTrash(next, "card", card.id, deviceId), current),
    );
  }

  function sortList(id: string, by: ListSort) {
    setState((current) => {
      const cards = sortListCards(current.cards, id, by, cardViewStats(current));
      const changed = cards.filter((card, index) => card.position !== current.cards[index].position);
      return recordRevisions(
        { ...current, cards },
        changed.map((card) => ({ kind: "card" as const, id: card.id })),
        deviceId,
      );
    });
  }

  /** Gives every card of the list the priority, or none with undefined. */
  function setPriorityOfList(id: string, priority: Priority | undefined) {
    setState((current) => setListPriority(current, id, priority, deviceId));
  }

  /** A dragged list dropped at `index` among the board's other lists, in a zone or outside zones. */
  function placeListAt(listId: string, index: number, zoneId: string | undefined) {
    setState((current) => placeList(current, listId, index, zoneId, deviceId));
  }

  /** A dragged zone dropped at `index` among the board's other zones and lists outside zones. */
  function placeZoneAt(boardId: string, zoneId: string, index: number) {
    setState((current) => placeZone(current, boardId, zoneId, index, deviceId));
  }

  /** Adds an empty zone at the end of the board; lists are dragged into it. */
  function addZone(boardId: string, name: string) {
    setState((current) => createZone(current, boardId, name, [], deviceId).state);
  }

  function changeZone(boardId: string, zoneId: string, change: { name?: string; color?: string }) {
    setState((current) => updateZone(current, boardId, zoneId, change, deviceId));
  }

  function removeZone(boardId: string, zoneId: string) {
    setState((current) => deleteZone(current, boardId, zoneId, deviceId));
  }

  function addAutomationRule(
    targetBoardId: string,
    listId: string,
    action: AutomationRule["action"],
    labelId?: string,
    trigger: NonNullable<AutomationRule["trigger"]> = "move",
    name?: string,
    leadMinutes = 0,
    targetListId?: string,
  ) {
    setState((current) => {
      const board = current.boards.find((item) => item.id === targetBoardId && !item.deletedAt);
      if (
        !board ||
        (trigger === "move" &&
          !current.lists.some((item) => item.id === listId && item.boardId === targetBoardId && !item.deletedAt)) ||
        (trigger === "button" && !name?.trim()) ||
        (trigger === "due" && ![0, 60, 1440, 10080].includes(leadMinutes))
      )
        return current;
      if (
        action === "add-label" &&
        !current.labels.some((item) => item.id === labelId && item.boardId === targetBoardId && !item.deleted)
      )
        return current;
      if (
        action === "move-to-list" &&
        !current.lists.some((item) => item.id === targetListId && item.boardId === targetBoardId && !item.deletedAt)
      )
        return current;
      const rule: AutomationRule = {
        id: newId(),
        listId: trigger === "move" ? listId : "",
        trigger,
        name: trigger === "button" ? name!.trim() : undefined,
        createdAt: trigger === "due" ? new Date().toISOString() : undefined,
        leadMinutes: trigger === "due" ? leadMinutes : undefined,
        action,
        labelId: action === "add-label" ? labelId : undefined,
        targetListId: action === "move-to-list" ? targetListId : undefined,
      };
      return recordRevision(
        {
          ...current,
          boards: current.boards.map((item) =>
            item.id === targetBoardId ? { ...item, automationRules: [...(item.automationRules ?? []), rule] } : item,
          ),
        },
        "board",
        targetBoardId,
        deviceId,
      );
    });
  }

  function removeAutomationRule(targetBoardId: string, ruleId: string) {
    setState((current) =>
      recordRevision(
        {
          ...current,
          boards: current.boards.map((item) =>
            item.id === targetBoardId
              ? { ...item, automationRules: (item.automationRules ?? []).filter((rule) => rule.id !== ruleId) }
              : item,
          ),
        },
        "board",
        targetBoardId,
        deviceId,
      ),
    );
  }

  function restore(revision: Revision) {
    setState((current) => restoreRevision(current, revision, deviceId));
  }

  return {
    createWorkspace,
    createBoard,
    copyBoardTo,
    updateBoard,
    createList,
    updateList,
    moveList,
    copyListOnBoard,
    moveListOnto,
    sortList,
    setPriorityOfList,
    trashListCards,
    placeListAt,
    placeZoneAt,
    addZone,
    changeZone,
    removeZone,
    addAutomationRule,
    removeAutomationRule,
    restore,
  };
}
export type BoardActions = ReturnType<typeof useBoardActions>;
