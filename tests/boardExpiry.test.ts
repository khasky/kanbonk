import { describe, expect, it } from "vitest";
import {
  type AppState,
  emptyState,
  expireBoards,
  expiredBoards,
  expiryFrom,
  extendBoard,
  lifetimeLeft,
} from "../src/model";
import { restoreFromTrash, visibleState } from "../src/model/trash";
import { exportTrelloJson } from "../src/trello/formats";
import { parseTrelloBoard } from "../src/trello/import";

const start = Date.parse("2026-11-28T10:00:00Z");
const hour = 3_600_000;

function boardFor(lifetime: { days: number; hours: number }): AppState {
  return {
    ...emptyState(),
    workspaces: [{ id: "ws", name: "W" }],
    boards: [
      {
        id: "board",
        workspaceId: "ws",
        name: "Sprint",
        description: "",
        background: "#147d86",
        starred: false,
        expiresAt: expiryFrom(lifetime, start),
      },
    ],
    lists: [{ id: "list", boardId: "board", name: "L", position: 1 }],
  };
}

describe("temporary boards", () => {
  it("counts the time left in whole hours, rounded up", () => {
    const expiresAt = expiryFrom({ days: 1, hours: 5 }, start);
    expect(lifetimeLeft(expiresAt, start)).toEqual({ days: 1, hours: 5 });
    expect(lifetimeLeft(expiresAt, start + 29 * hour - 1)).toEqual({ days: 0, hours: 1 });
    expect(lifetimeLeft(expiresAt, start + 30 * hour)).toEqual({ days: 0, hours: 0 });
  });

  it("moves a board to the trash with its lists when its time is up, and only then", () => {
    const state = boardFor({ days: 0, hours: 2 });
    expect(expireBoards(state, "device", start + hour)).toBe(state);
    const expired = expireBoards(state, "device", start + 2 * hour);
    expect(visibleState(expired).boards).toEqual([]);
    expect(expired.lists[0].deletedAt).toBeTruthy();
    expect(expiredBoards(expired).map((board) => board.id)).toEqual(["board"]);
  });

  it("extends an expired board for a new time or for good", () => {
    const expired = expireBoards(boardFor({ days: 0, hours: 1 }), "device", start + hour);
    const later = expiryFrom({ days: 3, hours: 0 }, start + hour);
    const extended = extendBoard(expired, "board", later, "device");
    expect(extended.boards[0]).toMatchObject({ expiresAt: later });
    expect(extended.boards[0].deletedAt).toBeUndefined();
    expect(extended.lists[0].deletedAt).toBeUndefined();
    expect(expiredBoards(extended)).toEqual([]);
    expect(extendBoard(expired, "board", undefined, "device").boards[0].expiresAt).toBeUndefined();
  });

  it("keeps a board restored from the trash for good, and leaves a board deleted early alone", () => {
    const expired = expireBoards(boardFor({ days: 0, hours: 1 }), "device", start + hour);
    const restored = restoreFromTrash(expired, "board", "board", "device").state;
    expect(restored.boards[0].expiresAt).toBeUndefined();
    expect(expireBoards(restored, "device", start + 10 * hour)).toBe(restored);
  });

  it("carries the expiry through the Trello JSON export and Kanbonk's import", () => {
    const state = boardFor({ days: 2, hours: 0 });
    expect(parseTrelloBoard(exportTrelloJson(state, "board"), "ws").board.expiresAt).toBe(state.boards[0].expiresAt);
  });
});
