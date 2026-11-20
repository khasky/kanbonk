import { sha256 } from "@noble/hashes/sha2.js";
import { newId, type AppState } from "./model";
import { createBackupParts } from "./backup";
import { listSnapshots, loadSetting, saveSetting, saveSnapshot, type SnapshotMeta } from "./storage";
import { defaultBackupDestination, folderDestination, platform, type BackupDestination, type BackupFolder } from "./platform";

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

export type BackupFrequency = "6h" | "day" | "week" | "off";
export interface AutoBackupSettings { frequency: BackupFrequency; keep: number; target: "default" | "folder" }
export const defaultAutoBackup: AutoBackupSettings = { frequency: "day", keep: 7, target: "default" };
const periods: Record<Exclude<BackupFrequency, "off">, number> = { "6h": 6 * 3600_000, day: 24 * 3600_000, week: 7 * 24 * 3600_000 };

export async function loadAutoBackupSettings(): Promise<AutoBackupSettings> {
  const saved = await loadSetting<Partial<AutoBackupSettings>>("auto-backup");
  // Before these settings existed, choosing a folder was the way to turn on daily backups.
  const target = saved?.target ?? (await backupFolder() ? "folder" : "default");
  // A web page can only add a new download each time, so there backups start only once the user asks for them.
  const unasked = platform === "web" && target === "default" ? "off" : defaultAutoBackup.frequency;
  const frequency = saved?.frequency && saved.frequency in { ...periods, off: 0 } ? saved.frequency : unasked;
  const keep = Number.isInteger(saved?.keep) && saved!.keep! >= 1 && saved!.keep! <= 100 ? saved!.keep! : defaultAutoBackup.keep;
  return { frequency, keep, target };
}

export async function saveAutoBackupSettings(settings: AutoBackupSettings): Promise<void> {
  await saveSetting("auto-backup", settings);
}

export async function backupFolder(): Promise<BackupFolder | undefined> {
  const saved = await loadSetting<BackupFolder | FileSystemDirectoryHandle>("backup-folder");
  if (!saved) return undefined;
  // Earlier versions stored the directory handle itself.
  return saved.kind === "handle" || saved.kind === "path" ? saved as BackupFolder : { kind: "handle", handle: saved as FileSystemDirectoryHandle };
}

export async function setBackupFolder(folder: BackupFolder | undefined): Promise<void> {
  await saveSetting("backup-folder", folder);
}

export async function lastAutoBackup(): Promise<string | undefined> {
  return loadSetting<string>("backup-folder-last");
}

export function backupDue(settings: AutoBackupSettings, last: string | undefined, now = new Date()): boolean {
  if (settings.frequency === "off") return false;
  return !last || now.getTime() - new Date(last).getTime() >= periods[settings.frequency];
}

const backupName = /^kanbonk-auto-(.+)-(\d+)of(\d+)\.zip$/;

/** Backup files beyond the newest `keep` complete backups; a backup is complete when all its ZIP parts are present. */
export function backupsToDelete(names: string[], keep: number): string[] {
  const groups = new Map<string, { parts: Set<number>; total: number; names: string[] }>();
  for (const name of names) {
    const match = name.match(backupName);
    if (!match) continue;
    const group = groups.get(match[1]) ?? { parts: new Set(), total: Number(match[3]), names: [] };
    group.parts.add(Number(match[2]));
    group.names.push(name);
    groups.set(match[1], group);
  }
  const stamps = [...groups.keys()].sort().reverse();
  const kept = stamps.filter((stamp) => groups.get(stamp)!.parts.size === groups.get(stamp)!.total).slice(0, keep);
  if (kept.length < keep) return [];
  const oldestKept = kept[kept.length - 1];
  return stamps.filter((stamp) => stamp < oldestKept).flatMap((stamp) => groups.get(stamp)!.names);
}

async function destination(settings: AutoBackupSettings, interactive: boolean): Promise<BackupDestination> {
  if (settings.target === "folder") {
    const folder = await backupFolder();
    if (!folder) throw new Error("No backup folder is chosen.");
    return folderDestination(folder, interactive);
  }
  const fallback = await defaultBackupDestination();
  if (!fallback) throw new Error("This app has no default backup location; choose a folder.");
  return fallback;
}

/** Writes a full ZIP backup (data and files) and deletes backups beyond the newest `keep`. Returns a short report. */
export async function writeAutoBackup(state: AppState, settings: AutoBackupSettings, interactive = false, now = new Date()): Promise<string> {
  const target = await destination(settings, interactive);
  const stamp = now.toISOString().slice(0, 19).replace(/:/g, "-") + "Z";
  let written = 0;
  for await (const part of createBackupParts(state)) {
    await target.write(`kanbonk-auto-${stamp}-${part.index}of${part.total}.zip`, part.blob);
    written++;
  }
  await saveSetting("backup-folder-last", now.toISOString());
  let removed = 0;
  if (target.list && target.remove) {
    for (const name of backupsToDelete(await target.list(), settings.keep)) { await target.remove(name); removed++; }
  }
  return `${target.label}: ${written} ZIP${removed ? `, ${removed} older ${removed === 1 ? "file" : "files"} deleted` : ""}.`;
}
