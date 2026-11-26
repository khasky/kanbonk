import { boardLabel, transferCard } from "./cards";
import { newId } from "./ids";
import { recordRevisions } from "./revisions";
import type { AppState, Card, EntityKind, Member } from "./types";

/**
 * Mirrors are real cards on any boards that share a `mirrorId`: a change to one goes to the others. They share the
 * content (title, description, dates, checklists, attachments, cover, comments), and the labels and members, mapped
 * to each mirror's board. Each keeps its own board, list and position.
 */

type Ref = { kind: EntityKind; id: string };

/** The other live cards that mirror the card. */
export function mirrorsOf(state: AppState, card: Card): Card[] {
  return card.mirrorId
    ? state.cards.filter((item) => item.mirrorId === card.mirrorId && item.id !== card.id && !item.deletedAt)
    : [];
}

/** What a mirror takes from the card that changed. */
const content = (card: Card) => ({
  name: card.name,
  description: card.description,
  startAt: card.startAt,
  dueAt: card.dueAt,
  dueReminderMinutes: card.dueReminderMinutes,
  checklists: card.checklists,
  attachments: card.attachments,
  cover: card.cover,
  comments: card.comments,
});

/**
 * Copies the card's content to its live mirrors, with its labels and members mapped to each mirror's board: a label
 * of the same link or name, made when missing, and the member added to the board when missing. Records nothing;
 * returns the entities it changed.
 */
function copyToMirrors(state: AppState, source: Card): { state: AppState; changed: Ref[] } {
  const targets = mirrorsOf(state, source);
  if (!targets.length) return { state, changed: [] };
  const labels = [...state.labels];
  let boards = state.boards;
  const changed: Ref[] = [];
  const sourceMembers = state.boards.find((board) => board.id === source.boardId)?.members ?? [];
  const cards = new Map<string, Card>();
  for (const target of targets) {
    const labelIds = source.labelIds.flatMap((id) => {
      const label = state.labels.find((item) => item.id === id && !item.deleted);
      if (!label) return [];
      const count = labels.length;
      const mapped = target.boardId === source.boardId ? label : boardLabel(labels, label, target.boardId);
      if (labels.length > count) changed.push({ kind: "label", id: mapped.id });
      return [mapped.id];
    });
    const members = (source.memberIds ?? []).flatMap((id) => {
      const member = sourceMembers.find((item) => item.id === id);
      return member ? [member] : [];
    });
    const targetMembers = boards.find((board) => board.id === target.boardId)?.members ?? [];
    const missing = members.filter((member) => !targetMembers.some((item) => item.id === member.id));
    if (missing.length) {
      boards = boards.map((board) =>
        board.id === target.boardId ? { ...board, members: [...targetMembers, ...missing] } : board,
      );
      changed.push({ kind: "board", id: target.boardId });
    }
    const next: Card = {
      ...target,
      ...structuredClone(content(source)),
      labelIds,
      // An empty list stays unset, so an unchanged mirror compares equal.
      memberIds: members.length || target.memberIds ? members.map((member: Member) => member.id) : undefined,
    };
    if (JSON.stringify(next) !== JSON.stringify(target)) {
      cards.set(target.id, next);
      changed.push({ kind: "card", id: target.id });
    }
  }
  if (!changed.length) return { state, changed };
  return {
    state: { ...state, labels, boards, cards: state.cards.map((card) => cards.get(card.id) ?? card) },
    changed,
  };
}

/**
 * Makes `copyId`, a mirror of the card, at the top or bottom of the list. The card and the mirror get revisions.
 */
export function mirrorCard(
  state: AppState,
  cardId: string,
  targetListId: string,
  deviceId: string,
  { top = false, copyId = newId() }: { top?: boolean; copyId?: string } = {},
): AppState {
  const source = state.cards.find((card) => card.id === cardId && !card.deletedAt);
  const linkId = source?.mirrorId ?? newId();
  const copied = transferCard(state, cardId, targetListId, true, copyId, top);
  const linked: AppState = {
    ...copied.state,
    cards: copied.state.cards.map((card) =>
      card.id === cardId || card.id === copied.cardId ? { ...card, mirrorId: linkId } : card,
    ),
  };
  const known = new Set(state.labels.map((label) => label.id));
  const synced = copyToMirrors(linked, linked.cards.find((card) => card.id === cardId)!);
  return recordRevisions(
    synced.state,
    [
      { kind: "card", id: cardId },
      { kind: "card", id: copied.cardId },
      ...synced.state.labels
        .filter((label) => !known.has(label.id))
        .map((label) => ({ kind: "label" as const, id: label.id })),
      ...synced.changed.filter((ref) => ref.kind === "board"),
    ],
    deviceId,
  );
}

/** Stops the card mirroring the others; the last one left is no mirror either. */
export function unlinkMirror(state: AppState, cardId: string, deviceId: string): AppState {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card?.mirrorId) return state;
  const rest = state.cards.filter((item) => item.mirrorId === card.mirrorId && item.id !== cardId);
  const unlinked = new Set([cardId, ...(rest.length === 1 ? [rest[0].id] : [])]);
  return recordRevisions(
    {
      ...state,
      cards: state.cards.map((item) => (unlinked.has(item.id) ? { ...item, mirrorId: undefined } : item)),
    },
    [...unlinked].map((id) => ({ kind: "card" as const, id })),
    deviceId,
  );
}

/**
 * Keeps mirrors alike after any change from `previous` to `next`, made here or merged from another device. In each
 * group with a changed card, the one changed last (by its newest revision) goes to the others, so an older edit merged
 * from another device does not undo a newer one. A card back from the trash takes the others' content instead of
 * bringing back its old one.
 */
export function syncMirrors(previous: AppState, next: AppState, deviceId: string): AppState {
  if (previous.cards === next.cards || !next.cards.some((card) => card.mirrorId)) return next;
  const before = new Map(previous.cards.map((card) => [card.id, card]));
  const groups = new Set<string>();
  const restored = new Set<string>();
  for (const card of next.cards) {
    const old = before.get(card.id);
    if (!card.mirrorId || card.deletedAt || old === card) continue;
    groups.add(card.mirrorId);
    if (old?.deletedAt) restored.add(card.id);
  }
  if (!groups.size) return next;
  const revisionTimes = new Map(next.revisions.map((revision) => [revision.id, revision.createdAt]));
  const changedAt = (card: Card) => revisionTimes.get(next.heads[`card:${card.id}`] ?? "") ?? "";
  // Changed last wins; of two changed in the same millisecond, the one changed by this step.
  const changedNow = (card: Card) => (before.get(card.id) === card ? 0 : 1);
  const latest = (cards: Card[]) =>
    cards.reduce((best, card) =>
      (changedAt(card).localeCompare(changedAt(best)) || changedNow(card) - changedNow(best)) > 0 ? card : best,
    );
  let state = next;
  const refs: Ref[] = [];
  for (const mirrorId of groups) {
    const candidates = next.cards.filter(
      (card) => card.mirrorId === mirrorId && !card.deletedAt && !restored.has(card.id),
    );
    if (!candidates.length) continue;
    const result = copyToMirrors(state, latest(candidates));
    state = result.state;
    refs.push(...result.changed);
  }
  return recordRevisions(state, refs, deviceId);
}
