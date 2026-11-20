import type { AppState } from "./model";

// The project was called Listva. Data written under that name (local storage, backups, sync bundles,
// states from devices that have not migrated yet) is renamed here to the Kanbonk identifiers.

export const legacyPrefix = "listva-";

const renamedIds = new Map([
  ["listva-inbox", "kanbonk-inbox"],
  ["listva-inbox-list", "kanbonk-inbox-list"],
  ["listva-inbox-workspace", "kanbonk-inbox-workspace"],
  ["listva-personal-workspace", "kanbonk-personal-workspace"],
]);

const entityKey = /^(workspace|board|list|card|label):(.*)$/;

/** Renames a legacy entity ID, bare or as a "<kind>:<id>" key of heads and tombstones. */
function renameId(value: string): string {
  const key = value.match(entityKey);
  if (key) return renamedIds.has(key[2]) ? `${key[1]}:${renamedIds.get(key[2])}` : value;
  return renamedIds.get(value) ?? value;
}

function renameDeep(value: unknown): unknown {
  if (typeof value === "string") return renameId(value);
  if (Array.isArray(value)) return value.map(renameDeep);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [renameId(key), renameDeep(item)]));
  return value;
}

function hasLegacyIds(state: AppState): boolean {
  const legacy = (id: string) => renameId(id) !== id;
  return [state.workspaces, state.boards, state.lists].some((items) => items.some((item) => legacy(item.id)))
    || state.revisions.some((revision) => legacy(revision.entityId))
    || Object.keys(state.heads ?? {}).some(legacy)
    || Object.keys(state.tombstones ?? {}).some(legacy);
}

/** Returns the state with legacy entity IDs renamed everywhere they are referenced; the same object when there are none. */
export function migrateLegacyState<T extends AppState>(state: T): T {
  return hasLegacyIds(state) ? renameDeep(state) as T : state;
}

/** Moves "listva-*" keys to "kanbonk-*", renaming entity IDs inside the values; an existing new key wins. */
export function migrateLegacyStorage(storage: Storage = localStorage): void {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => key?.startsWith(legacyPrefix) === true);
  for (const key of keys) {
    const target = `kanbonk-${key.slice(legacyPrefix.length)}`;
    const value = storage.getItem(key);
    if (value !== null && storage.getItem(target) === null) {
      let renamed: string;
      try { renamed = JSON.stringify(renameDeep(JSON.parse(value))); }
      catch { renamed = renameId(value); }
      storage.setItem(target, renamed);
    }
    storage.removeItem(key);
  }
}
