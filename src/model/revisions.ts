import { newId } from "./ids";
import type {
  ActivityEvent,
  AppState,
  Board,
  BoardList,
  Card,
  EntityKind,
  Label,
  Revision,
  Trashable,
  Workspace,
} from "./types";

export function ancestryFromRevisions(
  revisions: Revision[],
  existing: Record<string, string[]> = {},
): Record<string, string[]> {
  const ancestry = { ...existing };
  for (const revision of revisions)
    ancestry[revision.id] ??= revision.parentIds ?? (revision.parentId ? [revision.parentId] : []);
  return ancestry;
}

export function recordRevision(state: AppState, kind: EntityKind, entityId: string, deviceId: string): AppState {
  return recordRevisions(state, [{ kind, id: entityId }], deviceId);
}

const revisionLimit = 30;

/** Records revisions for many entities in one pass: linear in the state size however many entities change. */
export function recordRevisions(
  state: AppState,
  refs: Array<{ kind: EntityKind; id: string }>,
  deviceId: string,
): AppState {
  if (!refs.length) return state;
  const collections: Record<EntityKind, Array<Workspace | Board | BoardList | Card | Label>> = {
    workspace: state.workspaces,
    board: state.boards,
    list: state.lists,
    label: state.labels,
    card: state.cards,
  };
  const lookups = new Map<EntityKind, Map<string, Workspace | Board | BoardList | Card | Label>>();
  const find = (kind: EntityKind, id: string) => {
    let lookup = lookups.get(kind);
    if (!lookup) {
      lookup = new Map(collections[kind].map((item) => [item.id, item]));
      lookups.set(kind, lookup);
    }
    return lookup.get(id);
  };
  const revisionById = new Map(state.revisions.map((item) => [item.id, item]));
  let lastByKey: Map<string, string> | undefined;
  const heads = { ...state.heads };
  const ancestry = { ...state.ancestry };
  const revisions = [...state.revisions];
  const activity: ActivityEvent[] = [...(state.activity ?? [])];
  const touched = new Set<string>();
  for (const { kind, id: entityId } of refs) {
    const entity = find(kind, entityId);
    if (!entity) continue;
    const key = `${kind}:${entityId}`;
    let parent = heads[key];
    if (!parent) {
      lastByKey ??= new Map(state.revisions.map((item) => [`${item.entityKind}:${item.entityId}`, item.id]));
      parent = lastByKey.get(key) ?? "";
    }
    const previous = parent ? revisionById.get(parent)?.snapshot : undefined;
    const revision: Revision = {
      id: newId(12),
      parentIds: parent ? [parent] : [],
      entityKind: kind,
      entityId,
      createdAt: new Date().toISOString(),
      deviceId,
      snapshot: structuredClone(entity),
    };
    revisions.push(revision);
    revisionById.set(revision.id, revision);
    ancestry[revision.id] = revision.parentIds ?? [];
    heads[key] = revision.id;
    touched.add(key);
    const currentBoardId =
      kind === "board" ? entityId : kind === "workspace" ? undefined : (entity as BoardList | Card | Label).boardId;
    const previousBoardId =
      kind === "board"
        ? entityId
        : kind === "workspace"
          ? undefined
          : (previous as BoardList | Card | Label | undefined)?.boardId;
    const name = entity.name;
    const label =
      kind === "workspace"
        ? "Workspace"
        : kind === "board"
          ? "Board"
          : kind === "list"
            ? "List"
            : kind === "label"
              ? "Label"
              : "Card";
    const oldCard = kind === "card" ? (previous as Card | undefined) : undefined;
    const newCard = kind === "card" ? (entity as Card) : undefined;
    const oldComments = new Set(oldCard?.comments.map((comment) => comment.id) ?? []);
    const addedComments = newCard?.comments.filter((comment) => !oldComments.has(comment.id)) ?? [];
    const commentOnly = Boolean(
      oldCard &&
        addedComments.length &&
        JSON.stringify({ ...oldCard, comments: newCard?.comments }) === JSON.stringify(newCard),
    );
    const labelDeletionChanged =
      kind === "label" && Boolean((previous as Label | undefined)?.deleted) !== Boolean((entity as Label).deleted);
    const summary = !previous
      ? `${label} “${name}” created`
      : previousBoardId && currentBoardId !== previousBoardId
        ? `${label} “${name}” moved to another board`
        : previous.name !== name
          ? `${label} renamed: “${name}”`
          : labelDeletionChanged
            ? `${label} “${name}” ${(entity as Label).deleted ? "deleted" : "restored"}`
            : (entity as Trashable).deletedAt !== (previous as Trashable).deletedAt
              ? `${label} “${name}” ${(entity as Trashable).deletedAt ? "moved to Trash" : "restored from Trash"}`
              : "archived" in previous && "archived" in entity && previous.archived !== entity.archived
                ? `${label} “${name}” ${entity.archived ? "archived" : "restored"}`
                : `${label} “${name}” changed`;
    if (!commentOnly && currentBoardId)
      activity.push({
        id: revision.id,
        entityKind: kind,
        entityId,
        boardId: currentBoardId,
        previousBoardId,
        createdAt: revision.createdAt,
        deviceId,
        summary,
        category: "change",
      });
    for (const comment of addedComments)
      activity.push({
        id: `comment:${comment.id}`,
        entityKind: kind,
        entityId,
        boardId: currentBoardId,
        createdAt: comment.createdAt,
        deviceId,
        summary: `${comment.author}: ${comment.text}`,
        category: "comment",
      });
  }
  if (!touched.size) return state;
  // Keep the newest `revisionLimit` revisions of every entity that just got a new one.
  const counts = new Map<string, number>();
  for (const item of revisions) {
    const key = `${item.entityKind}:${item.entityId}`;
    if (touched.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const excess = new Map(
    [...counts].filter(([, total]) => total > revisionLimit).map(([key, total]) => [key, total - revisionLimit]),
  );
  const kept = excess.size
    ? revisions.filter((item) => {
        const key = `${item.entityKind}:${item.entityId}`;
        const drop = excess.get(key);
        if (!drop) return true;
        excess.set(key, drop - 1);
        return false;
      })
    : revisions;
  return { ...state, revisions: kept, activity, heads, ancestry };
}

export function restoreRevision(state: AppState, revision: Revision, deviceId: string): AppState {
  const key =
    revision.entityKind === "workspace"
      ? "workspaces"
      : revision.entityKind === "board"
        ? "boards"
        : revision.entityKind === "list"
          ? "lists"
          : revision.entityKind === "label"
            ? "labels"
            : "cards";
  const collection = state[key] as Array<{ id: string }>;
  const restored = collection.filter((item) => item.id !== revision.entityId);
  restored.push(structuredClone(revision.snapshot));
  return recordRevision({ ...state, [key]: restored }, revision.entityKind, revision.entityId, deviceId);
}
