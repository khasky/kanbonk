import { afterEach, describe, expect, it, vi } from "vitest";
import { validState } from "../src/backup/backup";
import { type AppState, type Board, boardCardAges, type Card, cardAge, emptyState, recordRevision } from "../src/model";

const day = 86_400_000;
const start = Date.parse("2026-11-01T09:00:00.000Z");
const card = (id: string, change: Partial<Card> = {}): Card => ({
  id,
  boardId: "b1",
  listId: "l1",
  name: id,
  description: "",
  position: 1,
  labelIds: [],
  checklists: [],
  comments: [],
  attachments: [],
  ...change,
});
const board = (cardAging?: Board["cardAging"]): Board => ({
  id: "b1",
  workspaceId: "w1",
  name: "Board",
  description: "",
  background: "#0c66e4",
  starred: false,
  cardAging,
});

describe("card aging", () => {
  afterEach(() => vi.useRealTimers());

  it("ages a card a step after 1, 2 and 4 weeks", () => {
    const at = new Date(start).toISOString();
    expect([0, 6.9, 7, 13.9, 14, 27.9, 28, 400].map((days) => cardAge(at, start + days * day))).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3,
    ]);
    expect(cardAge(undefined, start)).toBe(0);
    expect(cardAge("not a date", start)).toBe(0);
  });

  it("ages cards from their last change, only on a board that ages them, and never templates", () => {
    vi.useFakeTimers({ now: start });
    let state: AppState = {
      ...emptyState(),
      boards: [board("pirate")],
      cards: [
        card("old"),
        card("edited"),
        card("made", { createdAt: new Date(start + 10 * day).toISOString() }),
        card("template", { isTemplate: true }),
        card("elsewhere", { boardId: "b2" }),
      ],
    };
    for (const id of ["old", "edited", "template", "elsewhere"]) state = recordRevision(state, "card", id, "laptop");
    vi.setSystemTime(start + 20 * day);
    state = recordRevision(state, "card", "edited", "laptop");

    const now = start + 30 * day;
    // "old" last changed 30 days ago, "edited" 10, "made" (no revision) was made 20 days ago.
    expect([...boardCardAges(state, "b1", now)]).toEqual([
      ["old", 3],
      ["edited", 1],
      ["made", 2],
    ]);
    expect(boardCardAges({ ...state, boards: [board()] }, "b1", now).size).toBe(0);
  });

  it("keeps the setting in backups", () => {
    const state = { ...emptyState(), boards: [board("regular")] };
    expect(validState(state as unknown as Record<string, unknown>)).toBe(true);
    const broken = { ...state, boards: [{ ...board(), cardAging: "sepia" }] };
    expect(validState(broken as unknown as Record<string, unknown>)).toBe(false);
  });
});
