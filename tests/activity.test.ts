import { expect, it } from "vitest";
import { cardActivityFeed, cardChanges } from "../src/activity";
import { emptyState, type ActivityEvent, type Card } from "../src/model";

it("shows only the selected card's changes in newest-first order", () => {
  const event = (
    id: string,
    cardId: string,
    category: ActivityEvent["category"],
    createdAt: string,
  ): ActivityEvent => ({
    id,
    entityKind: "card",
    entityId: cardId,
    boardId: "board",
    createdAt,
    deviceId: "trello",
    summary: id,
    category,
  });
  const state = {
    ...emptyState(),
    activity: [
      event("old", "card-1", "change", "2024-01-01"),
      event("comment", "card-1", "comment", "2025-01-01"),
      event("other", "card-2", "change", "2026-01-01"),
      event("new", "card-1", "change", "2025-02-01"),
    ],
  };
  expect(cardChanges(state, "card-1").map((item) => item.id)).toEqual(["new", "old"]);
  const card = {
    id: "card-1",
    comments: [{ id: "comment-1", author: "Author", text: "Text", createdAt: "2025-01-15" }],
  } as Card;
  expect(cardActivityFeed(state, card, false).map((item) => item.id)).toEqual(["comment-1"]);
  expect(cardActivityFeed(state, card, true).map((item) => item.id)).toEqual(["new", "comment-1", "old"]);
});
