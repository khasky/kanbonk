import { type CommentThread, commentThreads } from "./comments";
import type { ActivityEvent, AppState, Card } from "./index";

export type CardFeedItem =
  | { kind: "comment"; id: string; createdAt: string; thread: CommentThread }
  | { kind: "change"; id: string; createdAt: string; event: ActivityEvent };

export function cardChanges(state: AppState, cardId: string): ActivityEvent[] {
  return (state.activity ?? [])
    .filter((event) => event.entityKind === "card" && event.entityId === cardId && event.category === "change")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

/** The card's comment threads, newest first, with its changes mixed in when details are shown. */
export function cardActivityFeed(state: AppState, card: Card, showDetails: boolean): CardFeedItem[] {
  const comments: CardFeedItem[] = commentThreads(card.comments).map((thread) => ({
    kind: "comment",
    id: thread.comment.id,
    createdAt: thread.comment.createdAt,
    thread,
  }));
  const changes: CardFeedItem[] = showDetails
    ? cardChanges(state, card.id).map((event) => ({ kind: "change", id: event.id, createdAt: event.createdAt, event }))
    : [];
  return [...comments, ...changes].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
