import { transferCard } from "./cards";
import { newId } from "./ids";
import { recordRevision } from "./revisions";
import { trashSubCards } from "./trash";
import type { AppState, Card, CardDoneSettings } from "./types";

/**
 * A card is finished with its Done button: it gets `doneAt`, and its board's settings say what else happens to it, such
 * as going to a list of finished cards, on this board or another.
 */

/** The card marked done with the changes the settings make in place (all but the move). */
export function finishedCard(card: Card, settings: CardDoneSettings, now = new Date()): Card {
  const done: Card = { ...card, doneAt: card.doneAt ?? now.toISOString() };
  if (settings.checkItems)
    done.checklists = card.checklists.map((list) => ({
      ...list,
      items: list.items.map((item) => (item.checked ? item : { ...item, checked: true })),
    }));
  if (settings.clearDue) {
    done.dueAt = undefined;
    done.dueReminderMinutes = undefined;
  }
  if (settings.clearLabels) done.labelIds = [];
  if (settings.clearMembers) done.memberIds = undefined;
  if (settings.trash && !card.deletedAt) {
    done.deletedAt = now.toISOString();
    done.deletedBatch = newId();
  }
  return done;
}

/** The live list a finished card of the board goes to, unless the board trashes finished cards. */
export function doneList(state: AppState, settings: CardDoneSettings | undefined) {
  return settings?.listId && !settings.trash
    ? state.lists.find((list) => list.id === settings.listId && !list.deletedAt)
    : undefined;
}

/** Finishes the card under its board's settings, moving it to the board's list of finished cards if it has one. */
export function finishCard(state: AppState, cardId: string, deviceId: string, now = new Date()): AppState {
  const card = state.cards.find((item) => item.id === cardId && !item.deletedAt);
  if (!card || card.doneAt) return state;
  const settings = state.boards.find((board) => board.id === card.boardId)?.cardDone ?? {};
  const target = doneList(state, settings);
  const moved =
    target && target.id !== card.listId
      ? transferCard(state, cardId, target.id, false, cardId, settings.top).state
      : state;
  const next: AppState = {
    ...moved,
    cards: moved.cards.map((item) => (item.id === cardId ? finishedCard(item, settings, now) : item)),
  };
  return trashSubCards(recordRevision(next, "card", cardId, deviceId), cardId, deviceId);
}

/** Takes the done mark off the card; what finishing it changed stays. */
export function reopenCard(state: AppState, cardId: string, deviceId: string): AppState {
  if (!state.cards.some((card) => card.id === cardId && card.doneAt)) return state;
  return recordRevision(
    { ...state, cards: state.cards.map((card) => (card.id === cardId ? { ...card, doneAt: undefined } : card)) },
    "card",
    cardId,
    deviceId,
  );
}

/**
 * A card moved into a board's list of finished cards that marks cards moved there is finished; one moved out of it is
 * no longer done.
 */
export function applyDoneList(state: AppState, before: Card, after: Card): Card {
  if (before.listId === after.listId) return after;
  const marking = (listId: string) =>
    state.boards.find((board) => board.cardDone?.markInList && doneList(state, board.cardDone)?.id === listId);
  const into = marking(after.listId);
  if (into && !after.doneAt) return finishedCard(after, into.cardDone ?? {});
  if (!into && after.doneAt && marking(before.listId)) return { ...after, doneAt: undefined };
  return after;
}

export function isCardDoneSettings(value: unknown): value is CardDoneSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const settings = value as Record<string, unknown>;
  return (
    (settings.listId === undefined || typeof settings.listId === "string") &&
    ["top", "markInList", "checkItems", "clearDue", "clearLabels", "clearMembers", "trash", "quiet"].every(
      (key) => settings[key] === undefined || typeof settings[key] === "boolean",
    )
  );
}
