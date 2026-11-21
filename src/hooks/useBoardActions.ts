import type { Dispatch, SetStateAction } from "react";
import { boardColors } from "../board/BoardMenu";
import type { BoardCopyOptions } from "../dialogs/BoardCopyDialog";
import {
  type AppState,
  type AutomationRule,
  type Board,
  type BoardList,
  copyBoard,
  copyList,
  newId,
  type Revision,
  recordRevision,
  recordRevisions,
  restoreRevision,
  sortListCards,
} from "../model";
import { ensurePersonalWorkspace, personalWorkspaceId } from "../model/workspaces";
import { assignListToZone, createZone, deleteZone, moveListToList, moveZone, updateZone } from "../model/zones";

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

  function sortList(id: string, by: "name" | "due") {
    setState((current) => {
      const cards = sortListCards(current.cards, id, by);
      const changed = cards.filter((card, index) => card.position !== current.cards[index].position);
      return recordRevisions(
        { ...current, cards },
        changed.map((card) => ({ kind: "card" as const, id: card.id })),
        deviceId,
      );
    });
  }

  function moveZoneTo(boardId: string, zoneId: string, targetListId: string, after: boolean) {
    setState((current) => moveZone(current, boardId, zoneId, targetListId, after, deviceId));
  }

  /** Adds an empty zone at the end of the board; lists are dragged into it. */
  function addZone(boardId: string, name: string) {
    setState((current) => createZone(current, boardId, name, [], deviceId).state);
  }

  /** Puts a list into a zone, or takes it out of its zone when `zoneId` is undefined. */
  function setListZone(listId: string, zoneId: string | undefined) {
    setState((current) => assignListToZone(current, listId, zoneId, deviceId));
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
    trigger: "move" | "button" | "due" = "move",
    name?: string,
    leadMinutes = 0,
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
      const rule: AutomationRule = {
        id: newId(),
        listId: trigger === "move" ? listId : "",
        trigger,
        name: trigger === "button" ? name!.trim() : undefined,
        createdAt: trigger === "due" ? new Date().toISOString() : undefined,
        leadMinutes: trigger === "due" ? leadMinutes : undefined,
        action,
        labelId: action === "add-label" ? labelId : undefined,
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
    sortList,
    moveZoneTo,
    addZone,
    setListZone,
    changeZone,
    removeZone,
    addAutomationRule,
    removeAutomationRule,
    restore,
  };
}
export type BoardActions = ReturnType<typeof useBoardActions>;
