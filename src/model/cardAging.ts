import type { AppState, Card } from "./types";

/** How a board shows cards that have not changed for a while: faded, or yellowed and torn. */
export const cardAgingModes = ["regular", "pirate"] as const;
export type CardAgingMode = (typeof cardAgingModes)[number];

/** A card ages a step after 1, 2 and 4 weeks without a change. */
export const agingWeeks = [1, 2, 4] as const;
export type CardAge = 1 | 2 | 3;

/** When the card last changed: its newest revision, or when it was made. `revisionTime` finds a revision's time. */
export function lastChangedAt(
  state: AppState,
  card: Card,
  revisionTime: (id: string) => string | undefined,
): string | undefined {
  const head = state.heads[`card:${card.id}`];
  return (head && revisionTime(head)) || card.createdAt;
}

/** The card's age step at `now`, or 0 while it is fresh. */
export function cardAge(lastAt: string | undefined, now: number): CardAge | 0 {
  const changed = lastAt ? Date.parse(lastAt) : Number.NaN;
  if (!Number.isFinite(changed)) return 0;
  const weeks = (now - changed) / (7 * 86_400_000);
  return weeks >= agingWeeks[2] ? 3 : weeks >= agingWeeks[1] ? 2 : weeks >= agingWeeks[0] ? 1 : 0;
}

/** The age of every aging card of a board whose aging is on, by card id. */
export function boardCardAges(state: AppState, boardId: string, now: number): Map<string, CardAge> {
  const ages = new Map<string, CardAge>();
  if (!state.boards.some((board) => board.id === boardId && board.cardAging)) return ages;
  const revisionTimes = new Map(state.revisions.map((revision) => [revision.id, revision.createdAt]));
  for (const card of state.cards) {
    if (card.boardId !== boardId || card.isTemplate) continue;
    const age = cardAge(
      lastChangedAt(state, card, (id) => revisionTimes.get(id)),
      now,
    );
    if (age) ages.set(card.id, age);
  }
  return ages;
}
