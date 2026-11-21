import type { AppState } from "./index";

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
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [renameId(key), renameDeep(item)]));
  return value;
}

function hasLegacyIds(state: AppState): boolean {
  const legacy = (id: string) => renameId(id) !== id;
  return (
    [state.workspaces, state.boards, state.lists].some((items) => items.some((item) => legacy(item.id))) ||
    state.revisions.some((revision) => legacy(revision.entityId)) ||
    Object.keys(state.heads ?? {}).some(legacy) ||
    Object.keys(state.tombstones ?? {}).some(legacy)
  );
}

/** Returns the state with legacy entity IDs renamed everywhere they are referenced; the same object when there are none. */
export function migrateLegacyState<T extends AppState>(state: T): T {
  return migrateArchived(hasLegacyIds(state) ? (renameDeep(state) as T) : state);
}

/** Moves "listva-*" keys to "kanbonk-*", renaming entity IDs inside the values; an existing new key wins. */
export function migrateLegacyStorage(storage: Storage = localStorage): void {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key): key is string => key?.startsWith(legacyPrefix) === true,
  );
  for (const key of keys) {
    const target = `kanbonk-${key.slice(legacyPrefix.length)}`;
    const value = storage.getItem(key);
    if (value !== null && storage.getItem(target) === null) {
      let renamed: string;
      try {
        renamed = JSON.stringify(renameDeep(JSON.parse(value)));
      } catch {
        renamed = renameId(value);
      }
      storage.setItem(target, renamed);
    }
    storage.removeItem(key);
  }
}

type Archivable = { id: string; archived?: boolean; deletedAt?: string; deletedBatch?: string };

/** Moves items archived by earlier versions (or closed in Trello) into the trash; the same array when there are none. */
function trashArchived<T extends Archivable>(items: T[], now: string): T[] {
  if (!items.some((item) => "archived" in item)) return items;
  return items.map((item) => {
    if (!("archived" in item)) return item;
    const { archived, ...rest } = item;
    return (archived && !rest.deletedAt ? { ...rest, deletedAt: now, deletedBatch: `archived-${item.id}` } : rest) as T;
  });
}

/**
 * Earlier versions could archive workspaces, boards, lists and cards. Archiving is gone: archived items move to the
 * trash, where they can be restored for 30 days. No revision is recorded, so devices that migrate the same item do
 * not conflict.
 */
export function migrateArchived<T extends AppState>(state: T, now = new Date().toISOString()): T {
  const workspaces = trashArchived(state.workspaces, now);
  const boards = trashArchived(state.boards, now);
  const lists = trashArchived(state.lists, now);
  const cards = trashArchived(state.cards, now);
  const rules = (boards as Array<(typeof boards)[number]>).some((board) =>
    board.automationRules?.some((rule) => (rule.action as string) === "archive"),
  );
  if (
    workspaces === state.workspaces &&
    boards === state.boards &&
    lists === state.lists &&
    cards === state.cards &&
    !rules
  )
    return state;
  return {
    ...state,
    workspaces,
    boards: rules
      ? boards.map((board) =>
          board.automationRules?.some((rule) => (rule.action as string) === "archive")
            ? {
                ...board,
                automationRules: board.automationRules.map((rule) =>
                  (rule.action as string) === "archive" ? { ...rule, action: "trash" as const } : rule,
                ),
              }
            : board,
        )
      : boards,
    lists,
    cards,
  };
}
