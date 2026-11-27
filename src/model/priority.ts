import { recordRevisions } from "./revisions";
import type { AppState, Card, Priority } from "./types";

/** From the most urgent to the least. */
export const priorities: Priority[] = ["critical", "high", "medium", "low"];

/** The color of each priority on tiles, chips and in the overview. */
export const priorityColors: Record<Priority, string> = {
  critical: "#c9372c",
  high: "#fca700",
  medium: "#eed12b",
  low: "#579dff",
};

export const isPriority = (value: unknown): value is Priority => priorities.includes(value as Priority);

/** 0 for critical up to 3 for low; a card without a priority comes after them all. */
export const priorityRank = (card: Card) => (card.priority ? priorities.indexOf(card.priority) : priorities.length);

/** Gives every live card of the list the priority, or none with undefined; changed cards get revisions. */
export function setListPriority(
  state: AppState,
  listId: string,
  priority: Priority | undefined,
  deviceId: string,
): AppState {
  const changed = state.cards.filter((card) => card.listId === listId && !card.deletedAt && card.priority !== priority);
  if (!changed.length) return state;
  const ids = new Set(changed.map((card) => card.id));
  return recordRevisions(
    { ...state, cards: state.cards.map((card) => (ids.has(card.id) ? { ...card, priority } : card)) },
    changed.map((card) => ({ kind: "card" as const, id: card.id })),
    deviceId,
  );
}
