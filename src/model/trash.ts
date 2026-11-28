import { newId, recordRevisions, type AppState, type Board, type BoardList, type Card, type Workspace } from "./index";

export type TrashKind = "workspace" | "board" | "list" | "card";
type TrashEntity = Workspace | Board | BoardList | Card;
interface Ref {
  kind: TrashKind;
  id: string;
}

const collectionKey = { workspace: "workspaces", board: "boards", list: "lists", card: "cards" } as const;

function entity(state: AppState, ref: Ref): TrashEntity | undefined {
  return (state[collectionKey[ref.kind]] as TrashEntity[]).find((item) => item.id === ref.id);
}

function patch(state: AppState, refs: Ref[], change: (item: TrashEntity) => TrashEntity): AppState {
  const next = { ...state };
  for (const kind of Object.keys(collectionKey) as TrashKind[]) {
    const ids = new Set(refs.filter((ref) => ref.kind === kind).map((ref) => ref.id));
    if (!ids.size) continue;
    const key = collectionKey[kind];
    (next as unknown as Record<string, TrashEntity[]>)[key] = (state[key] as TrashEntity[]).map((item) =>
      ids.has(item.id) ? change(item) : item,
    );
  }
  return next;
}

function record(state: AppState, refs: Ref[], deviceId: string): AppState {
  return recordRevisions(state, refs, deviceId);
}

/** Sub-cards of the given cards, recursively. */
function subCardRefs(state: AppState, cardIds: string[]): Ref[] {
  const seen = new Set(cardIds);
  const refs: Ref[] = [];
  for (let frontier = cardIds; frontier.length; ) {
    const parents = new Set(frontier);
    frontier = state.cards
      .filter((card) => card.parentCardId && parents.has(card.parentCardId) && !seen.has(card.id))
      .map((card) => card.id);
    for (const id of frontier) {
      seen.add(id);
      refs.push({ kind: "card", id });
    }
  }
  return refs;
}

/** Children of an entity: workspace -> boards -> lists -> cards -> sub-cards. */
export function descendants(state: AppState, kind: TrashKind, id: string): Ref[] {
  if (kind === "card") return subCardRefs(state, [id]);
  if (kind === "list") {
    const cards = state.cards.filter((card) => card.listId === id).map((card) => card.id);
    return [...cards.map((card) => ({ kind: "card" as const, id: card })), ...subCardRefs(state, cards)];
  }
  if (kind === "board") {
    const cards = state.cards.filter((card) => card.boardId === id).map((card) => card.id);
    return [
      ...state.lists.filter((list) => list.boardId === id).map((list) => ({ kind: "list" as const, id: list.id })),
      ...cards.map((card) => ({ kind: "card" as const, id: card })),
      ...subCardRefs(state, cards),
    ];
  }
  return state.boards
    .filter((board) => board.workspaceId === id)
    .flatMap((board) => [{ kind: "board" as const, id: board.id }, ...descendants(state, "board", board.id)]);
}

function ancestors(state: AppState, kind: TrashKind, id: string, seen = new Set<string>()): Ref[] {
  if (kind === "workspace") return [];
  if (kind === "board") {
    const board = state.boards.find((item) => item.id === id);
    return board ? [{ kind: "workspace", id: board.workspaceId }] : [];
  }
  if (kind === "list") {
    const list = state.lists.find((item) => item.id === id);
    return list ? [{ kind: "board", id: list.boardId }, ...ancestors(state, "board", list.boardId)] : [];
  }
  const card = state.cards.find((item) => item.id === id);
  if (!card) return [];
  seen.add(card.id);
  const parent =
    card.parentCardId && !seen.has(card.parentCardId) && state.cards.some((item) => item.id === card.parentCardId)
      ? [{ kind: "card" as const, id: card.parentCardId }, ...ancestors(state, "card", card.parentCardId, seen)]
      : [];
  return [
    { kind: "list", id: card.listId },
    { kind: "board", id: card.boardId },
    ...ancestors(state, "board", card.boardId),
    ...parent,
  ];
}

/** Cards the given card depends on (linked checklist items). */
export function prerequisitesOf(state: AppState, cardId: string): string[] {
  const card = state.cards.find((item) => item.id === cardId);
  return [
    ...new Set(
      card?.checklists.flatMap((list) =>
        list.items.flatMap((item) => (item.linkedCardId ? [item.linkedCardId] : [])),
      ) ?? [],
    ),
  ];
}

/** Cards that depend on the given card. */
export function dependentsOf(state: AppState, cardId: string): Card[] {
  return state.cards.filter(
    (card) =>
      card.id !== cardId && card.checklists.some((list) => list.items.some((item) => item.linkedCardId === cardId)),
  );
}

export interface TrashImpact {
  cardIds: string[];
  /** Live cards outside the deletion that depend on a card being deleted. */
  dependents: Array<{ dependent: Card; prerequisite: Card }>;
}

export function trashImpact(state: AppState, kind: TrashKind, id: string): TrashImpact {
  const refs = [{ kind, id }, ...descendants(state, kind, id)];
  const cardIds = new Set(refs.filter((ref) => ref.kind === "card").map((ref) => ref.id));
  const dependents: TrashImpact["dependents"] = [];
  for (const cardId of cardIds) {
    const prerequisite = state.cards.find((card) => card.id === cardId)!;
    if (prerequisite.deletedAt) continue;
    for (const dependent of dependentsOf(state, cardId))
      if (!cardIds.has(dependent.id) && !dependent.deletedAt) dependents.push({ dependent, prerequisite });
  }
  return { cardIds: [...cardIds], dependents };
}

/** Soft-deletes an entity with its live descendants as one batch; optionally also trashes dependent cards (transitively). */
export function moveToTrash(
  state: AppState,
  kind: TrashKind,
  id: string,
  deviceId: string,
  options: { withDependents?: boolean; now?: string } = {},
): AppState {
  if (!entity(state, { kind, id }) || entity(state, { kind, id })!.deletedAt) return state;
  const deletedAt = options.now ?? new Date().toISOString();
  const deletedBatch = newId();
  const refs: Ref[] = [{ kind, id }, ...descendants(state, kind, id)];
  if (options.withDependents) {
    const seen = new Set(refs.map((ref) => `${ref.kind}:${ref.id}`));
    for (let index = 0; index < refs.length; index++) {
      if (refs[index].kind !== "card") continue;
      for (const dependent of dependentsOf(state, refs[index].id)) {
        if (seen.has(`card:${dependent.id}`)) continue;
        seen.add(`card:${dependent.id}`);
        refs.push({ kind: "card", id: dependent.id });
      }
    }
  }
  const live = refs.filter((ref) => !entity(state, ref)?.deletedAt);
  return record(
    patch(state, live, (item) => ({ ...item, deletedAt, deletedBatch })),
    live,
    deviceId,
  );
}

/** When a card is in the trash, moves its sub-cards that are not there yet into the same batch. */
export function trashSubCards(state: AppState, cardId: string, deviceId: string): AppState {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card?.deletedAt) return state;
  const live = subCardRefs(state, [cardId]).filter((ref) => !entity(state, ref)?.deletedAt);
  if (!live.length) return state;
  const { deletedAt, deletedBatch } = card;
  return record(
    patch(state, live, (item) => ({ ...item, deletedAt, deletedBatch })),
    live,
    deviceId,
  );
}

export interface RestoreResult {
  state: AppState;
  restored: Ref[];
}

/**
 * Restores an entity from trash together with everything deleted in the same batch,
 * every deleted ancestor (so it becomes reachable) and, for cards, deleted prerequisites.
 */
export function restoreFromTrash(state: AppState, kind: TrashKind, id: string, deviceId: string): RestoreResult {
  const toRestore = new Map<string, Ref>();
  const visit = (ref: Ref) => {
    const target = entity(state, ref);
    const key = `${ref.kind}:${ref.id}`;
    if (!target?.deletedAt || toRestore.has(key)) return;
    toRestore.set(key, ref);
    for (const ancestor of ancestors(state, ref.kind, ref.id)) {
      const parent = entity(state, ancestor);
      if (parent?.deletedAt && !toRestore.has(`${ancestor.kind}:${ancestor.id}`))
        toRestore.set(`${ancestor.kind}:${ancestor.id}`, ancestor);
    }
    for (const child of descendants(state, ref.kind, ref.id))
      if (entity(state, child)?.deletedBatch === target.deletedBatch) visit(child);
    const cards = [ref, ...descendants(state, ref.kind, ref.id)].filter(
      (item) => item.kind === "card" && toRestore.has(`card:${item.id}`),
    );
    for (const card of cards)
      for (const prerequisite of prerequisitesOf(state, card.id)) visit({ kind: "card", id: prerequisite });
  };
  visit({ kind, id });
  const restored = [...toRestore.values()];
  if (!restored.length) return { state, restored };
  const next = patch(state, restored, (item) => {
    const { deletedAt, deletedBatch: _deletedBatch, ...rest } = item;
    // A temporary board whose time ran out comes back for good, or it would go straight back to the trash.
    if ("expiresAt" in rest && typeof rest.expiresAt === "string" && deletedAt && deletedAt >= rest.expiresAt)
      rest.expiresAt = undefined;
    return rest as TrashEntity;
  });
  return { state: record(next, restored, deviceId), restored };
}

/** Permanently removes an entity and its descendants; leaves tombstones so the purge syncs, and unlinks dependencies. */
export function purgeFromTrash(
  state: AppState,
  kind: TrashKind,
  id: string,
  deviceId: string,
  now = new Date().toISOString(),
): AppState {
  if (!entity(state, { kind, id })) return state;
  const refs = [{ kind, id }, ...descendants(state, kind, id)];
  return purgeRefs(state, refs, deviceId, now);
}

export function emptyTrash(state: AppState, deviceId: string, now = new Date().toISOString()): AppState {
  const refs: Ref[] = [];
  for (const kind of Object.keys(collectionKey) as TrashKind[]) {
    for (const item of state[collectionKey[kind]] as TrashEntity[])
      if (item.deletedAt) refs.push({ kind, id: item.id }, ...descendants(state, kind, item.id));
  }
  return refs.length ? purgeRefs(state, refs, deviceId, now) : state;
}

/** Items stay in the trash this many days by default, then are purged for good; Settings can change it. */
export const trashRetentionDays = 30;
const dayMs = 86_400_000;

export function trashDaysLeft(deletedAt: string, now = Date.now(), days = trashRetentionDays): number {
  return Math.max(0, Math.ceil((Date.parse(deletedAt) + days * dayMs - now) / dayMs));
}

/** Purges everything that has been in the trash longer than the retention period of `days`. */
export function purgeExpired(state: AppState, deviceId: string, now = Date.now(), days = trashRetentionDays): AppState {
  const cutoff = now - days * dayMs;
  const refs: Ref[] = [];
  for (const kind of Object.keys(collectionKey) as TrashKind[]) {
    for (const item of state[collectionKey[kind]] as TrashEntity[])
      if (item.deletedAt && Date.parse(item.deletedAt) <= cutoff)
        refs.push({ kind, id: item.id }, ...descendants(state, kind, item.id));
  }
  return refs.length ? purgeRefs(state, refs, deviceId, new Date(now).toISOString()) : state;
}

function purgeRefs(state: AppState, refs: Ref[], deviceId: string, now: string): AppState {
  const keys = new Set(refs.map((ref) => `${ref.kind}:${ref.id}`));
  const purgedCards = new Set(refs.filter((ref) => ref.kind === "card").map((ref) => ref.id));
  const purgedBoards = new Set(refs.filter((ref) => ref.kind === "board").map((ref) => ref.id));
  const tombstones = { ...state.tombstones };
  for (const key of keys) tombstones[key] = now;
  for (const label of state.labels) if (purgedBoards.has(label.boardId)) tombstones[`label:${label.id}`] = now;
  let next = applyTombstones({ ...state, tombstones });
  const unlinked: string[] = [];
  next = {
    ...next,
    cards: next.cards.map((card) => {
      const orphan = Boolean(card.parentCardId && purgedCards.has(card.parentCardId));
      const links =
        orphan ||
        card.checklists.some((list) =>
          list.items.some((item) => item.linkedCardId && purgedCards.has(item.linkedCardId)),
        ) ||
        card.attachments.some((item) => item.linkedCardId && purgedCards.has(item.linkedCardId)) ||
        card.links?.some((item) => purgedCards.has(item.cardId));
      if (!links) return card;
      const kept = card.links?.filter((item) => !purgedCards.has(item.cardId));
      unlinked.push(card.id);
      return {
        ...card,
        parentCardId: orphan ? undefined : card.parentCardId,
        checklists: card.checklists.map((list) => ({
          ...list,
          items: list.items.filter((item) => !item.linkedCardId || !purgedCards.has(item.linkedCardId)),
        })),
        attachments: card.attachments.filter((item) => !item.linkedCardId || !purgedCards.has(item.linkedCardId)),
        links: kept?.length ? kept : undefined,
      };
    }),
  };
  return recordRevisions(
    next,
    unlinked.map((id) => ({ kind: "card" as const, id })),
    deviceId,
  );
}

/** Drops entities, revisions and heads that have a tombstone. */
export function applyTombstones(state: AppState): AppState {
  const tombstones = state.tombstones ?? {};
  if (!Object.keys(tombstones).length) return state;
  const alive = (kind: string) => (item: { id: string }) => !tombstones[`${kind}:${item.id}`];
  const heads = Object.fromEntries(Object.entries(state.heads).filter(([key]) => !tombstones[key]));
  return {
    ...state,
    workspaces: state.workspaces.filter(alive("workspace")),
    boards: state.boards.filter(alive("board")),
    lists: state.lists.filter(alive("list")),
    cards: state.cards.filter(alive("card")),
    labels: state.labels.filter(alive("label")),
    revisions: state.revisions.filter((revision) => !tombstones[`${revision.entityKind}:${revision.entityId}`]),
    heads,
  };
}

/** State without trashed entities and anything under a trashed parent; used for rendering. */
export function visibleState(state: AppState): AppState {
  const hiddenWorkspaces = new Set(state.workspaces.filter((item) => item.deletedAt).map((item) => item.id));
  const hiddenBoards = new Set(
    state.boards.filter((item) => item.deletedAt || hiddenWorkspaces.has(item.workspaceId)).map((item) => item.id),
  );
  const hiddenLists = new Set(
    state.lists.filter((item) => item.deletedAt || hiddenBoards.has(item.boardId)).map((item) => item.id),
  );
  const anyCard = state.cards.some((item) => item.deletedAt);
  if (!hiddenWorkspaces.size && !hiddenBoards.size && !hiddenLists.size && !anyCard) return state;
  return {
    ...state,
    workspaces: state.workspaces.filter((item) => !hiddenWorkspaces.has(item.id)),
    boards: state.boards.filter((item) => !hiddenBoards.has(item.id)),
    lists: state.lists.filter((item) => !hiddenLists.has(item.id)),
    cards: state.cards.filter(
      (item) => !item.deletedAt && !hiddenBoards.has(item.boardId) && !hiddenLists.has(item.listId),
    ),
    labels: state.labels.filter((item) => !hiddenBoards.has(item.boardId)),
  };
}

export interface TrashEntry {
  kind: TrashKind;
  id: string;
  name: string;
  deletedAt: string;
  context: string;
  withParent: boolean;
}

export function trashEntries(state: AppState, kind?: TrashKind): TrashEntry[] {
  const workspaceName = (id: string) => state.workspaces.find((item) => item.id === id)?.name ?? "";
  const board = (id: string) => state.boards.find((item) => item.id === id);
  const list = (id: string) => state.lists.find((item) => item.id === id);
  const entries: TrashEntry[] = [];
  const parentBatch = (ref: Ref, batch?: string) =>
    ancestors(state, ref.kind, ref.id).some((parent) => batch && entity(state, parent)?.deletedBatch === batch);
  const add = (entryKind: TrashKind, item: TrashEntity, context: string) => {
    if (!item.deletedAt || (kind && kind !== entryKind)) return;
    entries.push({
      kind: entryKind,
      id: item.id,
      name: item.name,
      deletedAt: item.deletedAt,
      context,
      withParent: parentBatch({ kind: entryKind, id: item.id }, item.deletedBatch),
    });
  };
  for (const item of state.workspaces) add("workspace", item, "");
  for (const item of state.boards) add("board", item, workspaceName(item.workspaceId));
  for (const item of state.lists) add("list", item, board(item.boardId)?.name ?? "");
  for (const item of state.cards)
    add("card", item, [board(item.boardId)?.name, list(item.listId)?.name].filter(Boolean).join(" / "));
  return entries.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}
