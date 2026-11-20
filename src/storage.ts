import { ancestryFromRevisions, emptyState, newId, rememberStateIds, type AppState } from "./model";
import { migrateLegacyState } from "./legacy";

const databaseName = "kanbonk";
const legacyDatabaseName = "listva";

// "app" comes last: the copy of a legacy database counts as finished once the state is in place.
const storeNames = ["attachments", "backups", "settings", "app"] as const;
type StoreName = (typeof storeNames)[number];

/** Opens a database; with existingOnly, resolves undefined instead of creating a missing one. */
function open(name: string, existingOnly = false): Promise<IDBDatabase | undefined> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 2);
    request.onupgradeneeded = (event) => {
      if (existingOnly && event.oldVersion === 0) {
        request.transaction?.abort();
        return;
      }
      for (const store of storeNames)
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      existingOnly && request.error?.name === "AbortError" ? resolve(undefined) : reject(request.error);
  });
}

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function put(database: IDBDatabase, store: StoreName, key: IDBValidKey, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(store, "readwrite");
    transaction.objectStore(store).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/** Copies the database the app used under its old name, record by record, then deletes it. */
async function adoptLegacyDatabase(): Promise<void> {
  const legacy = await open(legacyDatabaseName, true);
  if (!legacy) return;
  const target = (await open(databaseName))!;
  try {
    const copied = await settle(target.transaction("app").objectStore("app").getKey("state"));
    if (copied === undefined) {
      for (const store of storeNames) {
        for (const key of await settle(legacy.transaction(store).objectStore(store).getAllKeys())) {
          await put(target, store, key, await settle(legacy.transaction(store).objectStore(store).get(key)));
        }
      }
    }
  } finally {
    legacy.close();
    target.close();
  }
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(legacyDatabaseName);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

let adoption: Promise<void> | undefined;

async function openDatabase(): Promise<IDBDatabase> {
  // A failed copy rejects every access, so the app never writes to the new database before the old data is in it.
  await (adoption ??= adoptLegacyDatabase().catch((cause) => {
    adoption = undefined;
    throw cause;
  }));
  return (await open(databaseName))!;
}

async function accessStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export async function loadState(): Promise<AppState> {
  const state = await accessStore<AppState | undefined>("app", "readonly", (store) => store.get("state"));
  const loaded = state
    ? migrateLegacyState({
        ...state,
        activity: state.activity ?? [],
        heads: state.heads ?? {},
        ancestry: ancestryFromRevisions(state.revisions, state.ancestry),
      })
    : emptyState();
  rememberStateIds(loaded);
  return loaded;
}

export async function saveState(state: AppState): Promise<void> {
  await accessStore("app", "readwrite", (store) => store.put(state, "state"));
}

export async function saveAttachment(id: string, blob: Blob): Promise<void> {
  await accessStore("attachments", "readwrite", (store) => store.put(blob, id));
}

export async function loadAttachment(id: string): Promise<Blob | undefined> {
  return accessStore<Blob | undefined>("attachments", "readonly", (store) => store.get(id));
}

export function deviceId(): string {
  const key = "kanbonk-device-id";
  let value = localStorage.getItem(key);
  if (!value) {
    value = newId();
    localStorage.setItem(key, value);
  }
  return value;
}

export function readLocalAuthor(): string {
  const saved = localStorage.getItem("kanbonk-author-name")?.trim();
  return saved && saved.length <= 60 ? saved : `Member ${deviceId().slice(0, 6)}`;
}

export function saveLocalAuthor(value: string): string {
  const name = value.trim();
  if (!name || name.length > 60) throw new Error("Enter a name up to 60 characters long.");
  localStorage.setItem("kanbonk-author-name", name);
  return name;
}

export interface SnapshotMeta {
  id: string;
  createdAt: string;
  hash: string;
  size: number;
  cards: number;
  boards: number;
}

export async function listSnapshots(): Promise<SnapshotMeta[]> {
  const metas = await accessStore<SnapshotMeta[] | undefined>("backups", "readonly", (store) => store.get("index"));
  return metas ?? [];
}

export async function saveSnapshot(meta: SnapshotMeta, json: string, keep: SnapshotMeta[]): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("backups", "readwrite");
    const store = transaction.objectStore("backups");
    const previous = new Set<string>();
    const request = store.get("index");
    request.onsuccess = () => {
      for (const item of (request.result as SnapshotMeta[] | undefined) ?? []) previous.add(item.id);
      const kept = new Set(keep.map((item) => item.id));
      for (const id of previous) if (!kept.has(id)) store.delete(`snapshot:${id}`);
      store.put(json, `snapshot:${meta.id}`);
      store.put(keep, "index");
    };
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export async function loadSnapshot(id: string): Promise<AppState | undefined> {
  const json = await accessStore<string | undefined>("backups", "readonly", (store) => store.get(`snapshot:${id}`));
  return json ? migrateLegacyState(JSON.parse(json) as AppState) : undefined;
}

export async function loadSetting<T>(key: string): Promise<T | undefined> {
  return accessStore<T | undefined>("settings", "readonly", (store) => store.get(key));
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  if (value === undefined) await accessStore("settings", "readwrite", (store) => store.delete(key));
  else await accessStore("settings", "readwrite", (store) => store.put(value, key));
}
