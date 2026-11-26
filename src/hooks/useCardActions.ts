import type { Dispatch, SetStateAction } from "react";
import type { TriageItem } from "../ai/ai";
import { applyCardButton, applyMoveRules } from "../model/automation";
import { trashSubCards } from "../model/trash";
import { inboxBoardId, inboxListId } from "../model/inbox";
import { moveBlockedText } from "../model/requiredFieldsText";
import { t } from "../i18n";
import {
  type AppState,
  blockedMove,
  type Card,
  convertChecklistItem,
  createCardFromTemplate,
  createSubCard,
  deleteLabel,
  updateLabel,
  linkDependency,
  type Member,
  newId,
  positionBefore,
  recordRevision,
  recordRevisions,
  transferCard,
  unlinkDependency,
} from "../model";
import { saveFile } from "../lib/platform";
import { loadAttachment, saveAttachment } from "../lib/storage";

const nextPosition = (cards: Card[], listId: string) =>
  Math.max(0, ...cards.filter((item) => item.listId === listId).map((item) => item.position)) + 1;

/**
 * Changes to cards and their labels, members, files and dependencies. Every change records a revision with this
 * device's id. Nothing here navigates or asks the user; callers do that.
 */
export function useCardActions({
  state,
  setState,
  deviceId,
  onError,
  onNotice,
}: {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  deviceId: string;
  onError: (message: string) => void;
  /** Tells why a card stayed in its list. */
  onNotice: (message: string) => void;
}) {
  /** Whether the card may go to the list; a board that keeps incomplete cards in their lists says what is missing. */
  function mayMove(card: Card, targetListId: string) {
    const missing = blockedMove(state, card, targetListId);
    if (missing.length) onNotice(moveBlockedText(state, card, missing));
    return !missing.length;
  }

  /** Applies a change to a card, then its move rules. */
  function updateCard(id: string, change: (item: Card) => Card) {
    const card = state.cards.find((item) => item.id === id);
    if (card && !mayMove(card, change(card).listId)) return;
    setState((current) =>
      trashSubCards(
        recordRevision(
          {
            ...current,
            cards: current.cards.map((item) => (item.id === id ? applyMoveRules(current, item, change(item)) : item)),
          },
          "card",
          id,
          deviceId,
        ),
        id,
        deviceId,
      ),
    );
  }

  function runCardButton(cardId: string, ruleId: string) {
    setState((current) => {
      const before = current.cards.find((item) => item.id === cardId);
      if (!before) return current;
      const after = applyCardButton(current, before, ruleId);
      return after === before
        ? current
        : trashSubCards(
            recordRevision(
              { ...current, cards: current.cards.map((item) => (item.id === cardId ? after : item)) },
              "card",
              cardId,
              deviceId,
            ),
            cardId,
            deviceId,
          );
    });
  }

  /**
   * Moves or copies a card to an open list, at its top or bottom or at `position`. Returns the id of the card in the
   * target list, or undefined.
   */
  function moveOrCopyCard(id: string, targetListId: string, copy: boolean, top = false, position?: number) {
    const targetList = state.lists.find((list) => list.id === targetListId && !list.deletedAt);
    const card = state.cards.find((item) => item.id === id);
    if (!targetList || (!copy && card && !mayMove(card, targetListId))) return undefined;
    const targetId = copy ? newId() : id;
    setState((current) => {
      const transferred = transferCard(current, id, targetListId, copy, targetId, top).state;
      if (position !== undefined)
        transferred.cards = transferred.cards.map((item) => (item.id === targetId ? { ...item, position } : item));
      const before = current.cards.find((item) => item.id === id);
      const cards =
        !copy && before
          ? transferred.cards.map((item) => (item.id === id ? applyMoveRules(current, before, item) : item))
          : transferred.cards;
      return trashSubCards(recordRevision({ ...transferred, cards }, "card", targetId, deviceId), targetId, deviceId);
    });
    return { targetId, boardId: targetList.boardId };
  }

  /** Adds a card, or a card template with `isTemplate`, at the end of a list on the board and returns its id. */
  function createCard(boardId: string, listId: string, name: string, isTemplate = false) {
    const created: Card = {
      id: newId(),
      boardId,
      listId,
      name,
      description: "",
      createdAt: new Date().toISOString(),
      position: nextPosition(state.cards, listId),
      labelIds: [],
      checklists: [],
      comments: [],
      attachments: [],
      ...(isTemplate ? { isTemplate } : {}),
    };
    setState((current) =>
      recordRevision({ ...current, cards: [...current.cards, created] }, "card", created.id, deviceId),
    );
    return created.id;
  }

  /** Puts a card at the end of another list. */
  /**
   * A card dropped into a list, before the card `beforeId` or at the end. From another board (such as the Inbox panel)
   * it takes this board's labels and members, like a move.
   */
  function dropCardAt(cardId: string, listId: string, beforeId?: string) {
    const card = state.cards.find((item) => item.id === cardId);
    const before = beforeId ? state.cards.find((item) => item.id === beforeId) : undefined;
    if (!card || card.id === beforeId) return;
    const position = before ? positionBefore(state.cards, cardId, before) : nextPosition(state.cards, listId);
    if (card.boardId !== state.lists.find((list) => list.id === listId)?.boardId)
      moveOrCopyCard(cardId, listId, false, false, position);
    else updateCard(cardId, (item) => ({ ...item, listId, position }));
  }

  /** Cards accepted from AI triage; the quoted source stays in the description so every card is traceable. */
  function createProposedCards(items: Array<TriageItem & { listId: string }>) {
    setState((current) => {
      const now = new Date().toISOString();
      const created: Card[] = items.map((item, index) => ({
        id: newId(),
        boardId: current.lists.find((list) => list.id === item.listId)?.boardId ?? "",
        listId: item.listId,
        name: item.title.trim(),
        description: `${item.description.trim()}\n\n> Source: ${item.source.replace(/\s+/g, " ").trim()}`,
        createdAt: now,
        dueAt: item.due ? new Date(`${item.due}T12:00:00`).toISOString() : undefined,
        position: nextPosition(current.cards, item.listId) + index,
        labelIds: [],
        checklists: [],
        comments: [],
        attachments: [],
      }));
      return recordRevisions(
        { ...current, cards: [...current.cards, ...created] },
        created.map((card) => ({ kind: "card" as const, id: card.id })),
        deviceId,
      );
    });
  }

  function createInboxCard(name: string) {
    const title = name.trim();
    if (!title) return;
    setState((current) => {
      const created: Card = {
        id: newId(),
        boardId: inboxBoardId,
        listId: inboxListId,
        name: title,
        description: "",
        createdAt: new Date().toISOString(),
        position: nextPosition(current.cards, inboxListId),
        labelIds: [],
        checklists: [],
        comments: [],
        attachments: [],
      };
      return recordRevision({ ...current, cards: [...current.cards, created] }, "card", created.id, deviceId);
    });
  }

  function addCardFromTemplate(templateId: string, listId: string, name: string) {
    const id = newId();
    try {
      setState((current) =>
        recordRevision(createCardFromTemplate(current, templateId, listId, name, id).state, "card", id, deviceId),
      );
    } catch (cause) {
      onError(String(cause));
    }
  }

  /** Creates a sub-card below its parent. */
  function addSubCard(parentId: string, name: string) {
    setState((current) => {
      const id = newId();
      return recordRevision(createSubCard(current, parentId, name, id), "card", id, deviceId);
    });
  }

  function addDependency(dependentId: string, prerequisiteId: string) {
    setState((current) => {
      const linked = linkDependency(current, dependentId, prerequisiteId);
      if (linked === current) return current;
      return recordRevision(recordRevision(linked, "card", dependentId, deviceId), "card", prerequisiteId, deviceId);
    });
  }

  function removeDependency(dependentId: string, prerequisiteId: string) {
    setState((current) => {
      const unlinked = unlinkDependency(current, dependentId, prerequisiteId);
      if (unlinked === current) return current;
      let next = unlinked;
      if (current.cards.some((item) => item.id === dependentId))
        next = recordRevision(next, "card", dependentId, deviceId);
      if (current.cards.some((item) => item.id === prerequisiteId))
        next = recordRevision(next, "card", prerequisiteId, deviceId);
      return next;
    });
  }

  function convertItem(cardId: string, checklistId: string, itemId: string) {
    const createdId = newId();
    setState((current) => {
      const converted = convertChecklistItem(current, cardId, checklistId, itemId, createdId);
      if (converted === current) return current;
      return recordRevision(recordRevision(converted, "card", cardId, deviceId), "card", createdId, deviceId);
    });
  }

  /** Adds someone who is not on the board yet to the board and to the card. */
  function addMember(card: Card, member: Member) {
    setState((current) => {
      let next = {
        ...current,
        boards: current.boards.map((item) =>
          item.id === card.boardId
            ? { ...item, members: [...(item.members ?? []).filter((entry) => entry.id !== member.id), member] }
            : item,
        ),
        cards: current.cards.map((item) =>
          item.id === card.id ? { ...item, memberIds: [...(item.memberIds ?? []), member.id] } : item,
        ),
      };
      next = recordRevision(next, "board", card.boardId, deviceId);
      return recordRevision(next, "card", card.id, deviceId);
    });
  }

  /** Creates a label on the card's board and puts it on the card. */
  function addLabel(card: Card, name: string, color: string) {
    const label = { id: newId(), boardId: card.boardId, name, color };
    setState((current) => {
      const next = recordRevision(
        {
          ...current,
          labels: [...current.labels, label],
          cards: current.cards.map((item) =>
            item.id === card.id ? { ...item, labelIds: [...item.labelIds, label.id] } : item,
          ),
        },
        "label",
        label.id,
        deviceId,
      );
      return recordRevision(next, "card", card.id, deviceId);
    });
  }

  function editLabel(boardId: string, id: string, name: string, color: string) {
    setState((current) =>
      current.labels.some((item) => item.id === id && item.boardId === boardId)
        ? updateLabel(current, id, name, color, deviceId)
        : current,
    );
  }

  function removeLabel(id: string) {
    setState((current) => deleteLabel(current, id, deviceId));
  }

  async function attachFiles(target: Card, files: File[]) {
    for (const file of files) {
      const id = newId();
      try {
        await saveAttachment(id, file);
        updateCard(target.id, (current) => ({
          ...current,
          attachments: [
            ...current.attachments,
            {
              id,
              name: file.name,
              mimeType: file.type,
              size: file.size,
              status: "local",
              addedAt: new Date().toISOString(),
            },
          ],
          cover: current.cover ?? (file.type.startsWith("image/") ? { attachmentId: id, size: "normal" } : undefined),
        }));
      } catch (cause) {
        onError(t("hooks.fileSaveFailed", { name: file.name, error: String(cause) }));
      }
    }
  }

  async function downloadAttachment(id: string, name: string) {
    try {
      const blob = await loadAttachment(id);
      if (!blob) {
        onError(t("hooks.fileUnavailable", { name }));
        return;
      }
      await saveFile(blob, name);
    } catch (cause) {
      onError(t("hooks.fileOpenFailed", { name, error: String(cause) }));
    }
  }

  return {
    updateCard,
    runCardButton,
    moveOrCopyCard,
    createCard,
    dropCardAt,
    createProposedCards,
    createInboxCard,
    addCardFromTemplate,
    addSubCard,
    addDependency,
    removeDependency,
    convertItem,
    addMember,
    addLabel,
    editLabel,
    removeLabel,
    attachFiles,
    downloadAttachment,
  };
}

export type CardActions = ReturnType<typeof useCardActions>;
