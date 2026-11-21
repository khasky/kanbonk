import { sha256 } from "@noble/hashes/sha2.js";
import { newId, type AppState } from "../model";
import { createBackupParts } from "./backup";
import { deviceId, listSnapshots, loadSetting, saveSetting, saveSnapshot, type SnapshotMeta } from "../lib/storage";
import {
  defaultBackupDestination,
  folderDestination,
  platform,
  type BackupDestination,
  type BackupFolder,
} from "../lib/platform";

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
  return Array.from(sha256(new TextEncoder().encode(json)).slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Stores a local snapshot when the data changed since the newest one. Returns the new snapshot or undefined. */
export async function autoSnapshot(state: AppState, now = new Date()): Promise<SnapshotMeta | undefined> {
  const json = JSON.stringify(state);
  const hash = stateHash(json);
  const metas = await listSnapshots();
  const newest = [...metas].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (newest?.hash === hash) return undefined;
  const meta: SnapshotMeta = {
    id: newId(),
    createdAt: now.toISOString(),
    hash,
    size: json.length,
    cards: state.cards.length,
    boards: state.boards.length,
  };
  await saveSnapshot(meta, json, retainSnapshots([...metas, meta]));
  return meta;
}

export type BackupFrequency = "6h" | "day" | "week" | "off";
export interface AutoBackupSettings {
  frequency: BackupFrequency;
  keep: number;
  target: "default" | "folder";
}
export const defaultAutoBackup: AutoBackupSettings = { frequency: "day", keep: 7, target: "default" };
const periods: Record<Exclude<BackupFrequency, "off">, number> = {
  "6h": 6 * 3600_000,
  day: 24 * 3600_000,
  week: 7 * 24 * 3600_000,
};

export async function loadAutoBackupSettings(): Promise<AutoBackupSettings> {
  const saved = await loadSetting<Partial<AutoBackupSettings>>("auto-backup");
  // Before these settings existed, choosing a folder was the way to turn on daily backups.
  const target = saved?.target ?? ((await backupFolder()) ? "folder" : "default");
  // A web page can only add a new download each time, so there backups start only once the user asks for them.
  const unasked = platform === "web" && target === "default" ? "off" : defaultAutoBackup.frequency;
  const frequency = saved?.frequency && saved.frequency in { ...periods, off: 0 } ? saved.frequency : unasked;
  const keep =
    Number.isInteger(saved?.keep) && saved!.keep! >= 1 && saved!.keep! <= 100 ? saved!.keep! : defaultAutoBackup.keep;
  return { frequency, keep, target };
}

export async function saveAutoBackupSettings(settings: AutoBackupSettings): Promise<void> {
  await saveSetting("auto-backup", settings);
}

export async function backupFolder(): Promise<BackupFolder | undefined> {
  const saved = await loadSetting<BackupFolder | FileSystemDirectoryHandle>("backup-folder");
  if (!saved) return undefined;
  // Earlier versions stored the directory handle itself.
  return saved.kind === "handle" || saved.kind === "path"
    ? (saved as BackupFolder)
    : { kind: "handle", handle: saved as FileSystemDirectoryHandle };
}

export async function setBackupFolder(folder: BackupFolder | undefined): Promise<void> {
  await saveSetting("backup-folder", folder);
}

export async function lastAutoBackup(): Promise<string | undefined> {
  return loadSetting<string>("backup-folder-last");
}

/** Postpones the due automatic backup by one period without writing it. */
export async function skipAutoBackup(now = new Date()): Promise<void> {
  await saveSetting("backup-skipped", now.toISOString());
}

/** The time the backup schedule counts from: the last written or the last skipped backup, whichever is newer. */
export async function lastAutoBackupOrSkip(): Promise<string | undefined> {
  const written = await lastAutoBackup();
  const skipped = await loadSetting<string>("backup-skipped");
  return !written || (skipped && skipped > written) ? skipped : written;
}

export function backupDue(settings: AutoBackupSettings, last: string | undefined, now = new Date()): boolean {
  if (settings.frequency === "off") return false;
  return !last || now.getTime() - new Date(last).getTime() >= periods[settings.frequency];
}

/**
 * Names the device in backup file names as `<platform>-<first 6 characters of the device id>`, so devices that share a
 * folder (or a synced cloud folder) tell their backups apart and never delete each other's.
 */
export function backupDevice(platformName: string, id: string): string {
  return `${platformName}-${id.replace(/[^A-Za-z0-9]/g, "").slice(0, 6)}`;
}

const backupName = /^kanbonk-auto-([a-z]+-[A-Za-z0-9]+)-(.+)-(\d+)of(\d+)\.zip$/;

/**
 * This device's backup files beyond its newest `keep` complete backups; a backup is complete when all its ZIP parts
 * are present. Files of other devices and other names are never returned.
 */
export function backupsToDelete(names: string[], keep: number, device: string): string[] {
  const groups = new Map<string, { parts: Set<number>; total: number; names: string[] }>();
  for (const name of names) {
    const match = name.match(backupName);
    if (!match || match[1] !== device) continue;
    const group = groups.get(match[2]) ?? { parts: new Set(), total: Number(match[4]), names: [] };
    group.parts.add(Number(match[3]));
    group.names.push(name);
    groups.set(match[2], group);
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
export async function writeAutoBackup(
  state: AppState,
  settings: AutoBackupSettings,
  interactive = false,
  now = new Date(),
): Promise<string> {
  const target = await destination(settings, interactive);
  const device = backupDevice(platform, deviceId());
  const stamp = `${now.toISOString().slice(0, 19).replace(/:/g, "-")}Z`;
  let written = 0;
  for await (const part of createBackupParts(state)) {
    await target.write(`kanbonk-auto-${device}-${stamp}-${part.index}of${part.total}.zip`, part.blob);
    written++;
  }
  await saveSetting("backup-folder-last", now.toISOString());
  let removed = 0;
  if (target.list && target.remove) {
    for (const name of backupsToDelete(await target.list(), settings.keep, device)) {
      await target.remove(name);
      removed++;
    }
  }
  return `${target.label}: ${written} ZIP${removed ? `, ${removed} older ${removed === 1 ? "file" : "files"} deleted` : ""}.`;
}
