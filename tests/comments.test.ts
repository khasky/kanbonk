import { describe, expect, it } from "vitest";
import {
  cloneCard,
  commentThreads,
  copyComments,
  emptyState,
  removeComment,
  replyCount,
  threadOrder,
  type AppState,
  type Card,
  type Comment,
} from "../src/model";
import { cardActivityFeed } from "../src/model/activity";
import { boardScope, cardFieldText } from "../src/export/exportData";
import { exportTrelloJson } from "../src/trello/formats";
import { parseTrelloBoard } from "../src/trello/import";

const comment = (id: string, createdAt: string, parentId?: string): Comment => ({
  id,
  text: id,
  author: `Author ${id}`,
  createdAt,
  ...(parentId ? { parentId } : {}),
});

// a ── b ── d (deeper)
//   └─ c
// e (a reply to a comment that is gone)
const comments = [
  comment("c", "2026-01-04", "a"),
  comment("a", "2026-01-01"),
  comment("d", "2026-01-05", "b"),
  comment("b", "2026-01-02", "a"),
  comment("e", "2026-01-03", "gone"),
];

function boardWith(cardComments: Comment[]): AppState {
  const card: Card = {
    id: "card",
    boardId: "board",
    listId: "list",
    name: "Card",
    description: "",
    position: 1,
    labelIds: [],
    checklists: [],
    comments: cardComments,
    attachments: [],
  };
  return {
    ...emptyState(),
    workspaces: [{ id: "ws", name: "W" }],
    boards: [{ id: "board", workspaceId: "ws", name: "B", description: "", background: "#000000", starred: false }],
    lists: [{ id: "list", boardId: "board", name: "L", position: 1 }],
    cards: [card],
  };
}

describe("comment threads", () => {
  it("puts replies under the comment they answer, oldest first, and keeps orphans as threads", () => {
    const threads = commentThreads(comments);
    expect(threads.map((thread) => thread.comment.id)).toEqual(["a", "e"]);
    expect(threads[0].replies.map((thread) => thread.comment.id)).toEqual(["b", "c"]);
    expect(threads[0].replies[0].replies.map((thread) => thread.comment.id)).toEqual(["d"]);
    expect(replyCount(threads[0])).toBe(3);
    expect(threadOrder(comments).map(({ comment, depth }) => `${comment.id}${depth}`)).toEqual([
      "a0",
      "b1",
      "d2",
      "c1",
      "e0",
    ]);
  });

  it("keeps comments that answer each other in a loop", () => {
    const loop = [comment("x", "2026-01-01", "y"), comment("y", "2026-01-02", "x")];
    expect(threadOrder(loop).map(({ comment }) => comment.id)).toEqual(["x", "y"]);
  });

  it("shows threads newest first in the card's activity", () => {
    const feed = cardActivityFeed(emptyState(), { id: "card", comments } as Card, false);
    expect(feed.map((item) => item.id)).toEqual(["e", "a"]);
  });

  it("keeps a deleted comment with replies as a placeholder until its replies go", () => {
    let next = removeComment(comments, "b");
    expect(next.find((item) => item.id === "b")).toMatchObject({ deleted: true, text: "" });
    expect(replyCount(commentThreads(next)[0])).toBe(2);
    next = removeComment(next, "d");
    expect(next.map((item) => item.id).sort()).toEqual(["a", "c", "e"]);
  });

  it("copies threads with new ids, replies pointing at the copies", () => {
    let n = 0;
    const copies = copyComments(comments, () => `new${n++}`);
    const byText = new Map(copies.map((item) => [item.text, item]));
    expect(byText.get("b")?.parentId).toBe(byText.get("a")?.id);
    expect(byText.get("e")?.parentId).toBeUndefined();
    const cloned = cloneCard(boardWith(comments), "card");
    const copy = cloned.state.cards.find((card) => card.id === cloned.cardId)!;
    expect(threadOrder(copy.comments).map(({ comment, depth }) => `${comment.text}${depth}`)).toEqual([
      "a0",
      "b1",
      "d2",
      "c1",
      "e0",
    ]);
  });

  it("indents replies in exported cells and leaves deleted comments out", () => {
    const state = boardWith(removeComment(comments, "b"));
    const text = cardFieldText(boardScope(state, "board", false)!, state.cards[0], "comments");
    expect(text.split("\n\n").map((line) => line.replace(/ \(.*?\)/, ""))).toEqual([
      "Author a: a",
      "    ↳ Author d: d",
      "  ↳ Author c: c",
      "Author e: e",
    ]);
  });

  it("exports replies as plain Trello comments and imports the threads back", () => {
    const state = boardWith(removeComment(comments, "c"));
    const json = exportTrelloJson(state, "board") as { actions: Array<Record<string, unknown>> };
    const exported = json.actions.filter((action) => action.type === "commentCard");
    expect(exported.map((action) => (action.data as { text: string }).text).sort()).toEqual(["a", "b", "d", "e"]);

    const imported = parseTrelloBoard(json, "ws").cards[0].comments;
    expect(threadOrder(imported).map(({ comment, depth }) => `${comment.text}${depth}`)).toEqual([
      "a0",
      "b1",
      "d2",
      "e0",
    ]);

    // Trello's own export has no replies: every comment is a thread of its own.
    for (const action of exported) delete (action.data as Record<string, unknown>).kanbonkReplyTo;
    const flat = parseTrelloBoard(json, "ws").cards[0].comments;
    expect(flat.every((item) => item.parentId === undefined)).toBe(true);
    expect(commentThreads(flat)).toHaveLength(4);
  });
});
