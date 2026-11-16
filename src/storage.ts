import { ancestryFromRevisions, emptyState, newId, rememberStateIds, type AppState } from "./model";

const databaseName = "listva";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 2);
    request.onupgradeneeded = () => {
      for (const name of storeNames) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const storeNames = ["app", "attachments", "backups", "settings"] as const;
type StoreName = typeof storeNames[number];

async function accessStore<T>(storeName: StoreName, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => { database.close(); resolve(result); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

export async function loadState(): Promise<AppState> {
  const state = await accessStore<AppState | undefined>("app", "readonly", (store) => store.get("state"));
  const loaded = state ? { ...state, activity: state.activity ?? [], heads: state.heads ?? {}, ancestry: ancestryFromRevisions(state.revisions, state.ancestry) } : emptyState();
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
  const key = "listva-device-id";
  let value = localStorage.getItem(key);
  if (!value) {
    value = newId();
    localStorage.setItem(key, value);
  }
  return value;
}

export function readLocalAuthor(): string {
  const saved = localStorage.getItem("listva-author-name")?.trim();
  return saved && saved.length <= 60 ? saved : `Member ${deviceId().slice(0, 6)}`;
}

export function saveLocalAuthor(value: string): string {
  const name = value.trim();
  if (!name || name.length > 60) throw new Error("Enter a name up to 60 characters long.");
  localStorage.setItem("listva-author-name", name);
  return name;
}

export interface SnapshotMeta { id: string; createdAt: string; hash: string; size: number; cards: number; boards: number }

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
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

export async function loadSnapshot(id: string): Promise<AppState | undefined> {
  const json = await accessStore<string | undefined>("backups", "readonly", (store) => store.get(`snapshot:${id}`));
  return json ? JSON.parse(json) as AppState : undefined;
}

export async function loadSetting<T>(key: string): Promise<T | undefined> {
  return accessStore<T | undefined>("settings", "readonly", (store) => store.get(key));
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  if (value === undefined) await accessStore("settings", "readwrite", (store) => store.delete(key));
  else await accessStore("settings", "readwrite", (store) => store.put(value, key));
}
