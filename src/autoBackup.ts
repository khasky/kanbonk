import { sha256 } from "@noble/hashes/sha2.js";
import { newId, type AppState } from "./model";
import { createBackupParts } from "./backup";
import { listSnapshots, loadSetting, saveSetting, saveSnapshot, type SnapshotMeta } from "./storage";

export const autoBackupIntervalMs = 10 * 60 * 1000;
const recentKept = 20;
const dailyKept = 30;

/** Keeps the newest `recentKept` snapshots plus the newest snapshot of each of the last `dailyKept` days. */
export function retainSnapshots(metas: SnapshotMeta[]): SnapshotMeta[] {
  const sorted = [...metas].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const keep = new Set(sorted.slice(0, recentKept).map((item) => item.id));
  const days = new Set<string>();
  for (const item of sorted) {
    const day = item.createdAt.slice(0, 10);
    if (days.has(day)) continue;
    days.add(day);
    if (days.size > dailyKept) break;
    keep.add(item.id);
  }
  return sorted.filter((item) => keep.has(item.id));
}

function stateHash(json: string): string {
  return Array.from(sha256(new TextEncoder().encode(json)).slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Stores a local snapshot when the data changed since the newest one. Returns the new snapshot or undefined. */
export async function autoSnapshot(state: AppState, now = new Date()): Promise<SnapshotMeta | undefined> {
  const json = JSON.stringify(state);
  const hash = stateHash(json);
  const metas = await listSnapshots();
  const newest = [...metas].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (newest?.hash === hash) return undefined;
  const meta: SnapshotMeta = { id: newId(), createdAt: now.toISOString(), hash, size: json.length, cards: state.cards.length, boards: state.boards.length };
  await saveSnapshot(meta, json, retainSnapshots([...metas, meta]));
  return meta;
}

type DirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
};

export function folderBackupSupported(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

export async function chooseBackupFolder(): Promise<string> {
  const picker = (window as unknown as { showDirectoryPicker: (options: { mode: "readwrite"; id: string }) => Promise<DirectoryHandle> }).showDirectoryPicker;
  const handle = await picker({ mode: "readwrite", id: "kanbonk-backups" });
  await saveSetting("backup-folder", handle);
  return handle.name;
}

export async function backupFolderName(): Promise<string | undefined> {
  return (await loadSetting<DirectoryHandle>("backup-folder"))?.name;
}

export async function forgetBackupFolder(): Promise<void> {
  await saveSetting("backup-folder", undefined);
}

/** Writes a full ZIP backup (data + files) for today into the chosen folder, replacing today's earlier copy. */
export async function writeFolderBackup(state: AppState, interactive = false): Promise<string> {
  const handle = await loadSetting<DirectoryHandle>("backup-folder");
  if (!handle) throw new Error("No backup folder is selected.");
  let permission = await handle.queryPermission?.({ mode: "readwrite" }) ?? "granted";
  if (permission !== "granted" && interactive) permission = await handle.requestPermission?.({ mode: "readwrite" }) ?? "denied";
  if (permission !== "granted") throw new Error("Allow writing to the backup folder again.");
  const day = new Date().toISOString().slice(0, 10);
  let written = 0;
  for await (const part of createBackupParts(state)) {
    const file = await handle.getFileHandle(`kanbonk-auto-${day}-${part.index}of${part.total}.zip`, { create: true });
    const writable = await file.createWritable();
    await writable.write(part.blob);
    await writable.close();
    written++;
  }
  await saveSetting("backup-folder-last", new Date().toISOString());
  return `${handle.name}: ${written} ZIP`;
}

export async function lastFolderBackup(): Promise<string | undefined> {
  return loadSetting<string>("backup-folder-last");
}
