import type { ActivityEvent, AppState, Card, Comment } from "./index";

export type CardFeedItem =
  | { kind: "comment"; id: string; createdAt: string; comment: Comment }
  | { kind: "change"; id: string; createdAt: string; event: ActivityEvent };

export function cardChanges(state: AppState, cardId: string): ActivityEvent[] {
  return (state.activity ?? [])
    .filter((event) => event.entityKind === "card" && event.entityId === cardId && event.category === "change")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export function cardActivityFeed(state: AppState, card: Card, showDetails: boolean): CardFeedItem[] {
  const comments: CardFeedItem[] = card.comments.map((comment) => ({
    kind: "comment",
    id: comment.id,
    createdAt: comment.createdAt,
    comment,
  }));
  const changes: CardFeedItem[] = showDetails
    ? cardChanges(state, card.id).map((event) => ({ kind: "change", id: event.id, createdAt: event.createdAt, event }))
    : [];
  return [...comments, ...changes].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
