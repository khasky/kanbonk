import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  backupDue,
  backupFolder,
  backupsToDelete,
  defaultAutoBackup,
  loadAutoBackupSettings,
  writeAutoBackup,
} from "../src/autoBackup";
import { emptyState } from "../src/model";

const settings = new Map<string, unknown>();
vi.mock("../src/storage", () => ({
  loadSetting: async (key: string) => settings.get(key),
  saveSetting: async (key: string, value: unknown) => {
    if (value === undefined) settings.delete(key);
    else settings.set(key, value);
  },
  loadAttachment: async () => undefined,
  listSnapshots: async () => [],
  saveSnapshot: async () => {},
}));

const files = new Map<string, Blob>();
let currentPlatform = "extension";
vi.mock("../src/platform", () => ({
  get platform() {
    return currentPlatform;
  },
  defaultBackupDestination: async () => ({
    label: "Downloads/Kanbonk Backups",
    write: async (name: string, blob: Blob) => {
      files.set(name, blob);
    },
    list: async () => [...files.keys()],
    remove: async (name: string) => {
      files.delete(name);
    },
  }),
  folderDestination: async () => {
    throw new Error("not used");
  },
}));

describe("automatic backups", () => {
  beforeEach(() => {
    settings.clear();
    files.clear();
    currentPlatform = "extension";
  });

  it("is due after the chosen period and never when turned off", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    expect(backupDue({ ...defaultAutoBackup, frequency: "day" }, undefined, now)).toBe(true);
    expect(backupDue({ ...defaultAutoBackup, frequency: "day" }, "2026-11-19T13:00:00Z", now)).toBe(false);
    expect(backupDue({ ...defaultAutoBackup, frequency: "day" }, "2026-11-19T12:00:00Z", now)).toBe(true);
    expect(backupDue({ ...defaultAutoBackup, frequency: "6h" }, "2026-11-20T06:30:00Z", now)).toBe(false);
    expect(backupDue({ ...defaultAutoBackup, frequency: "week" }, "2026-11-14T12:00:00Z", now)).toBe(false);
    expect(backupDue({ ...defaultAutoBackup, frequency: "off" }, undefined, now)).toBe(false);
  });

  it("deletes backups beyond the newest complete ones and keeps an unfinished newer one", () => {
    const names = [
      "kanbonk-auto-2026-11-17-1of2.zip",
      "kanbonk-auto-2026-11-17-2of2.zip",
      "kanbonk-auto-2026-11-18T06-00-00Z-1of1.zip",
      "kanbonk-auto-2026-11-19T06-00-00Z-1of2.zip",
      "kanbonk-auto-2026-11-19T06-00-00Z-2of2.zip",
      "kanbonk-auto-2026-11-20T06-00-00Z-1of2.zip",
      "notes.txt",
    ];
    expect(backupsToDelete(names, 2)).toEqual(["kanbonk-auto-2026-11-17-1of2.zip", "kanbonk-auto-2026-11-17-2of2.zip"]);
    expect(backupsToDelete(names, 3)).toEqual([]);
    expect(backupsToDelete(names, 1)).toEqual([
      "kanbonk-auto-2026-11-18T06-00-00Z-1of1.zip",
      "kanbonk-auto-2026-11-17-1of2.zip",
      "kanbonk-auto-2026-11-17-2of2.zip",
    ]);
  });

  it("keeps using a folder chosen before these settings existed", async () => {
    const handle = { kind: "directory", name: "Backups" };
    settings.set("backup-folder", handle);
    expect(await backupFolder()).toEqual({ kind: "handle", handle });
    expect((await loadAutoBackupSettings()).target).toBe("folder");
    settings.clear();
    expect(await loadAutoBackupSettings()).toEqual(defaultAutoBackup);
  });

  it("does not start downloading backups in a web page until asked to", async () => {
    currentPlatform = "web";
    expect((await loadAutoBackupSettings()).frequency).toBe("off");
    settings.set("backup-folder", { kind: "directory", name: "Backups" });
    expect((await loadAutoBackupSettings()).frequency).toBe("day");
    settings.set("auto-backup", { frequency: "week", keep: 7, target: "default" });
    expect((await loadAutoBackupSettings()).frequency).toBe("week");
  });

  it("writes a backup to the default location and deletes the oldest beyond the limit", async () => {
    const keep = { ...defaultAutoBackup, keep: 2 };
    for (const day of ["18", "19", "20"])
      await writeAutoBackup(emptyState(), keep, false, new Date(`2026-11-${day}T06:00:00Z`));
    expect([...files.keys()].sort()).toEqual([
      "kanbonk-auto-2026-11-19T06-00-00Z-1of1.zip",
      "kanbonk-auto-2026-11-20T06-00-00Z-1of1.zip",
    ]);
    expect(settings.get("backup-folder-last")).toBe("2026-11-20T06:00:00.000Z");
    expect(await writeAutoBackup(emptyState(), keep, false, new Date("2026-11-21T06:00:00Z"))).toBe(
      "Downloads/Kanbonk Backups: 1 ZIP, 1 older file deleted.",
    );
  });
});
