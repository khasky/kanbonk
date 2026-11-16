import { sha256 } from "@noble/hashes/sha2.js";
import { applyTombstones } from "./trash";
import { ancestryFromRevisions, recordRevision, type AppState, type Board, type BoardList, type Card, type EntityKind, type Label, type Revision, type Workspace } from "./model";

export interface SyncConflict {
  kind: EntityKind;
  id: string;
  local: Workspace | Board | BoardList | Card | Label;
  remote: Workspace | Board | BoardList | Card | Label;
  localHeadId?: string;
  remoteHeadId?: string;
}

const collections = { workspace: "workspaces", board: "boards", list: "lists", card: "cards", label: "labels" } as const;

interface RevisionIndex { byId: Map<string, Revision>; lastByKey: Map<string, Revision> }
const revisionIndexes = new WeakMap<Revision[], RevisionIndex>();

/** Revision lookups by id and by entity, cached per revisions array so a merge is linear, not quadratic. */
function revisionIndex(revisions: Revision[]): RevisionIndex {
  let index = revisionIndexes.get(revisions);
  if (!index) {
    index = { byId: new Map(revisions.map((revision) => [revision.id, revision])), lastByKey: new Map(revisions.map((revision) => [`${revision.entityKind}:${revision.entityId}`, revision])) };
    revisionIndexes.set(revisions, index);
  }
  return index;
}

function head(state: AppState, kind: EntityKind, id: string): Revision | undefined {
  const index = revisionIndex(state.revisions);
  const headId = state.heads?.[`${kind}:${id}`];
  return (headId ? index.byId.get(headId) : undefined) ?? index.lastByKey.get(`${kind}:${id}`);
}

function descendsFrom(revision: Revision | undefined, ancestorId: string | undefined, ancestry: Record<string, string[]>): boolean {
  if (!revision || !ancestorId) return false;
  const pending = [revision.id];
  const visited = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    if (current === ancestorId) return true;
    visited.add(current);
    pending.push(...(ancestry[current] ?? []));
  }
  return false;
}

function recentRevisions(revisions: Revision[], heads: Record<string, string>, conflicts: SyncConflict[]): Revision[] {
  const protectedIds = new Set([...Object.values(heads), ...conflicts.flatMap((item) => [item.localHeadId, item.remoteHeadId])]);
  const groups = new Map<string, Revision[]>();
  for (const revision of revisions) {
    const key = `${revision.entityKind}:${revision.entityId}`;
    const group = groups.get(key) ?? [];
    group.push(revision);
    groups.set(key, group);
  }
  const retained = new Set<string>();
  for (const group of groups.values()) {
    group.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const selected = group.filter((revision) => protectedIds.has(revision.id));
    for (const revision of group) {
      if (selected.length >= 30) break;
      if (!protectedIds.has(revision.id)) selected.push(revision);
    }
    for (const revision of selected) retained.add(revision.id);
  }
  return revisions.filter((revision) => retained.has(revision.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function mergeStates(local: AppState, remote: AppState): { state: AppState; conflicts: SyncConflict[] } {
  const revisions = [...local.revisions];
  const revisionIds = new Set(revisions.map((item) => item.id));
  for (const revision of remote.revisions) if (!revisionIds.has(revision.id)) { revisions.push(revision); revisionIds.add(revision.id); }
  const ancestry = ancestryFromRevisions(revisions, { ...local.ancestry, ...remote.ancestry });
  const activity = [...(local.activity ?? [])];
  const activityIds = new Set(activity.map((item) => item.id));
  for (const item of remote.activity ?? []) if (!activityIds.has(item.id)) { activity.push(item); activityIds.add(item.id); }
  const tombstones = { ...remote.tombstones, ...local.tombstones };
  local = applyTombstones({ ...local, tombstones });
  remote = applyTombstones({ ...remote, tombstones });
  const state: AppState = { ...local, revisions, activity, heads: { ...local.heads }, ancestry, labels: [...local.labels] };
  const conflicts: SyncConflict[] = [];
  for (const kind of Object.keys(collections) as EntityKind[]) {
    const key = collections[kind];
    const localItems = local[key] as Array<{ id: string }>;
    const remoteItems = remote[key] as Array<{ id: string }>;
    const merged = new Map<string, Workspace | Board | BoardList | Card | Label>(localItems.map((item) => [item.id, item as Workspace | Board | BoardList | Card | Label]));
    for (const remoteItem of remoteItems) {
      const localItem = merged.get(remoteItem.id);
      if (!localItem) { merged.set(remoteItem.id, remoteItem as Workspace | Board | BoardList | Card | Label); if (remote.heads?.[`${kind}:${remoteItem.id}`]) state.heads[`${kind}:${remoteItem.id}`] = remote.heads[`${kind}:${remoteItem.id}`]; continue; }
      const localHead = head(local, kind, remoteItem.id);
      const remoteHead = head(remote, kind, remoteItem.id);
      if (JSON.stringify(localItem) === JSON.stringify(remoteItem)) {
        if (!localHead || !remoteHead) { if (remoteHead) state.heads[`${kind}:${remoteItem.id}`] = remoteHead.id; continue; }
        if (descendsFrom(remoteHead, localHead.id, ancestry)) { state.heads[`${kind}:${remoteItem.id}`] = remoteHead.id; continue; }
        if (descendsFrom(localHead, remoteHead.id, ancestry)) continue;
        const parentIds = [localHead.id, remoteHead.id].sort();
        const digest = sha256(new TextEncoder().encode(JSON.stringify([kind, remoteItem.id, parentIds])));
        const id = `merge-${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
        if (!revisionIds.has(id)) {
          revisions.push({ id, parentIds, entityKind: kind, entityId: remoteItem.id, createdAt: localHead.createdAt >= remoteHead.createdAt ? localHead.createdAt : remoteHead.createdAt, deviceId: "sync", snapshot: structuredClone(localItem) });
          revisionIds.add(id);
        }
        ancestry[id] = parentIds;
        state.heads[`${kind}:${remoteItem.id}`] = id;
        continue;
      }
      if (descendsFrom(remoteHead, localHead?.id, ancestry)) { merged.set(remoteItem.id, remoteItem as Workspace | Board | BoardList | Card | Label); if (remoteHead) state.heads[`${kind}:${remoteItem.id}`] = remoteHead.id; }
      else if (!descendsFrom(localHead, remoteHead?.id, ancestry)) conflicts.push({ kind, id: remoteItem.id, local: localItem, remote: remoteItem as Workspace | Board | BoardList | Card | Label, localHeadId: localHead?.id, remoteHeadId: remoteHead?.id });
    }
    (state as unknown as Record<string, unknown>)[key] = [...merged.values()];
  }
  state.revisions = recentRevisions(revisions.filter((revision) => !tombstones[`${revision.entityKind}:${revision.entityId}`]), state.heads, conflicts);
  return { state, conflicts };
}

export function chooseConflict(state: AppState, conflict: SyncConflict, choice: "local" | "remote", deviceId: string): AppState {
  const key = collections[conflict.kind];
  const selected = choice === "local" ? conflict.local : conflict.remote;
  const items = (state[key] as Array<{ id: string }>).filter((item) => item.id !== conflict.id);
  (items as Array<typeof selected>).push(selected);
  const selectedState = { ...state, [key]: items, heads: { ...state.heads, [`${conflict.kind}:${conflict.id}`]: (choice === "local" ? conflict.localHeadId : conflict.remoteHeadId) ?? "" } };
  const recorded = recordRevision(selectedState, conflict.kind, conflict.id, deviceId);
  const last = recorded.revisions[recorded.revisions.length - 1];
  const parentIds = [conflict.localHeadId, conflict.remoteHeadId].filter((id): id is string => Boolean(id));
  return { ...recorded, revisions: [...recorded.revisions.slice(0, -1), { ...last, parentIds }], ancestry: { ...recorded.ancestry, [last.id]: parentIds } };
}
