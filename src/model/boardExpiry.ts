import { recordRevision } from "./revisions";
import { moveToTrash, restoreFromTrash } from "./trash";
import type { AppState, Board } from "./types";

/** How long a temporary board lives. */
export interface Lifetime {
  days: number;
  hours: number;
}

const hourMs = 3_600_000;

export function lifetimeMs(lifetime: Lifetime): number {
  return (lifetime.days * 24 + lifetime.hours) * hourMs;
}

/** When a board made temporary now for `lifetime` moves to the trash. */
export function expiryFrom(lifetime: Lifetime, now = Date.now()): string {
  return new Date(now + lifetimeMs(lifetime)).toISOString();
}

/** The time a board has left, in whole hours rounded up; zero once it is up. */
export function lifetimeLeft(expiresAt: string, now = Date.now()): Lifetime {
  const hours = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / hourMs));
  return { days: Math.floor(hours / 24), hours: hours % 24 };
}

/** Moves every live temporary board whose time is up to the trash, with its lists and cards. */
export function expireBoards(state: AppState, deviceId: string, now = Date.now()): AppState {
  let next = state;
  for (const board of state.boards)
    if (!board.deletedAt && board.expiresAt && Date.parse(board.expiresAt) <= now)
      next = moveToTrash(next, "board", board.id, deviceId, { now: new Date(now).toISOString() });
  return next;
}

/** Boards in the trash because their time was up (not because someone deleted them earlier). */
export function expiredBoards(state: AppState): Board[] {
  return state.boards.filter(
    (board) => board.deletedAt && board.expiresAt && Date.parse(board.deletedAt) >= Date.parse(board.expiresAt),
  );
}

/**
 * Brings a board back from the trash with a new lifetime (`expiresAt`), or for good without one. A live board only
 * gets the new lifetime.
 */
export function extendBoard(
  state: AppState,
  boardId: string,
  expiresAt: string | undefined,
  deviceId: string,
): AppState {
  const restored = restoreFromTrash(state, "board", boardId, deviceId).state;
  if (!restored.boards.some((board) => board.id === boardId)) return state;
  return recordRevision(
    {
      ...restored,
      boards: restored.boards.map((board) => (board.id === boardId ? { ...board, expiresAt } : board)),
    },
    "board",
    boardId,
    deviceId,
  );
}
