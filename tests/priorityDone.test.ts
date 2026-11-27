import { describe, expect, it } from "vitest";
import { validState } from "../src/backup/backup";
import { applyMoveRules } from "../src/model/automation";
import {
  type AppState,
  type Board,
  type Card,
  emptyBoardFilter,
  emptyState,
  filterBoardCards,
  finishCard,
  mirrorCard,
  reopenCard,
  setListPriority,
  sortListCards,
  syncMirrors,
} from "../src/model";

const board = (id: string, extra: Partial<Board> = {}): Board => ({
  id,
  workspaceId: "w1",
  name: id,
  description: "",
  background: "#0c66e4",
  starred: false,
  members: [{ id: "ann", name: "Ann" }],
  ...extra,
});
const task = (id: string, extra: Partial<Card> = {}): Card => ({
  id,
  boardId: "team",
  listId: "todo",
  name: id,
  description: "",
  position: 1,
  labelIds: [],
  checklists: [],
  comments: [],
  attachments: [],
  ...extra,
});
const base = (done?: Board["cardDone"]): AppState => ({
  ...emptyState(),
  boards: [board("team", { cardDone: done }), board("archive")],
  lists: [
    { id: "todo", boardId: "team", name: "Todo", position: 1 },
    { id: "finished", boardId: "team", name: "Finished", position: 2 },
    { id: "old", boardId: "archive", name: "Old", position: 1 },
  ],
  labels: [{ id: "red", boardId: "team", name: "Urgent", color: "#f00" }],
  cards: [
    task("a", {
      labelIds: ["red"],
      memberIds: ["ann"],
      dueAt: "2026-12-01T10:00:00.000Z",
      dueReminderMinutes: 60,
      checklists: [{ id: "k", name: "Steps", items: [{ id: "i", name: "One", checked: false }] }],
    }),
    task("b", { position: 2 }),
  ],
});
const card = (state: AppState, id: string) => state.cards.find((item) => item.id === id)!;
const now = new Date("2026-11-26T12:00:00.000Z");

describe("priority", () => {
  it("sorts a list by priority either way with cards without one last, filters and sets a whole list", () => {
    const priorities: Card["priority"][] = ["low", undefined, "critical", "medium", "high"];
    const cards = priorities.map((priority, index) => task(`c${index}`, { priority, position: index + 1 }));
    const order = (by: "priority-high" | "priority-low") =>
      sortListCards(cards, "todo", by)
        .sort((a, b) => a.position - b.position)
        .map((item) => item.priority ?? "none");
    expect(order("priority-high")).toEqual(["critical", "high", "medium", "low", "none"]);
    expect(order("priority-low")).toEqual(["low", "medium", "high", "critical", "none"]);

    const state = { ...emptyState(), boards: [board("team")], cards };
    const filtered = (priority: "high" | "none") =>
      filterBoardCards(state, "team", { ...emptyBoardFilter(), priority }).map((item) => item.id);
    expect(filtered("high")).toEqual(["c4"]);
    expect(filtered("none")).toEqual(["c1"]);

    const all = setListPriority(base(), "todo", "high", "laptop");
    expect(all.cards.map((item) => item.priority)).toEqual(["high", "high"]);
    expect(all.revisions).toHaveLength(2);
    expect(setListPriority(all, "todo", "high", "laptop")).toBe(all);
    expect(setListPriority(all, "todo", undefined, "laptop").cards.every((item) => !item.priority)).toBe(true);
  });

  it("goes to mirrors and is checked in backups", () => {
    const mirrored = mirrorCard(base(), "a", "old", "laptop", { copyId: "copy" });
    const state = syncMirrors(mirrored, setListPriority(mirrored, "todo", "critical", "laptop"), "laptop");
    expect(card(state, "copy").priority).toBe("critical");
    expect(validState(state as unknown as Record<string, unknown>)).toBe(true);
    const broken = { ...state, cards: [{ ...card(state, "a"), priority: "urgent" }] };
    expect(validState(broken as unknown as Record<string, unknown>)).toBe(false);
  });
});

describe("card done", () => {
  it("only marks a card done on a board without settings, and reopens it", () => {
    const state = finishCard(base(), "a", "laptop", now);
    expect(card(state, "a")).toMatchObject({ doneAt: now.toISOString(), listId: "todo", labelIds: ["red"] });
    expect(state.revisions).toHaveLength(1);
    expect(finishCard(state, "a", "laptop", now)).toBe(state);
    expect(card(reopenCard(state, "a", "laptop"), "a").doneAt).toBeUndefined();
  });

  it("moves a finished card to another board's list and changes it as the board says", () => {
    const state = finishCard(
      base({ listId: "old", top: true, checkItems: true, clearDue: true, clearLabels: true, clearMembers: true }),
      "a",
      "laptop",
      now,
    );
    const done = card(state, "a");
    expect(done).toMatchObject({ boardId: "archive", listId: "old", labelIds: [], doneAt: now.toISOString() });
    expect([done.dueAt, done.dueReminderMinutes, done.memberIds]).toEqual([undefined, undefined, undefined]);
    expect(done.checklists[0].items[0].checked).toBe(true);
    expect(validState(state as unknown as Record<string, unknown>)).toBe(true);
  });

  it("trashes a finished card when the board says so", () => {
    const state = finishCard(base({ listId: "finished", trash: true }), "a", "laptop", now);
    expect(card(state, "a")).toMatchObject({ listId: "todo", doneAt: now.toISOString() });
    expect(card(state, "a").deletedAt).toBeDefined();
  });

  it("finishes a card moved into the done list by hand and reopens one moved out", () => {
    const state = base({ listId: "finished", markInList: true, checkItems: true });
    const before = card(state, "a");
    const moved = applyMoveRules(state, before, { ...before, listId: "finished" });
    expect(moved.doneAt).toBeDefined();
    expect(moved.checklists[0].items[0].checked).toBe(true);
    expect(applyMoveRules(state, moved, { ...moved, listId: "todo" }).doneAt).toBeUndefined();
    // Without `markInList` a move changes nothing.
    const plain = base({ listId: "finished" });
    expect(applyMoveRules(plain, before, { ...before, listId: "finished" }).doneAt).toBeUndefined();
    const broken = { ...state, boards: [board("team", { cardDone: { trash: "yes" } as never })] };
    expect(validState(broken as unknown as Record<string, unknown>)).toBe(false);
  });
});
