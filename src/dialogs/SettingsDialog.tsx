import { askConfirm } from "../ui/AskDialog";
import { Dialog } from "../ui/Modal";
import { useEffect, useState } from "react";
import type { AppState } from "../model";
import {
  backupFolder,
  defaultAutoBackup,
  lastAutoBackup,
  loadAutoBackupSettings,
  saveAutoBackupSettings,
  setBackupFolder,
  writeAutoBackup,
  type AutoBackupSettings,
  type BackupFrequency,
} from "../backup/autoBackup";
import {
  backupFolderLabel,
  backupFolderSupported,
  defaultBackupDestination,
  pickBackupFolder,
  platform,
  type BackupFolder,
} from "../lib/platform";
import { setTrashRetention, trashRetentionChoices, useTrashRetention } from "../lib/trashRetention";
import { Button } from "../ui/Button";
import { Checkbox, Input, Select } from "../ui/Field";
import { Hint } from "../ui/Hint";
import {
  dialogFooterClass,
  dialogListClass,
  dialogTitleClass,
  fieldLabelClass,
  optionLabelClass,
  plainReportClass,
} from "./dialogLook";

const optionClass = `${optionLabelClass} font-normal`;

const frequencies: Array<[BackupFrequency, string]> = [
  ["6h", "Every 6 hours"],
  ["day", "Every day"],
  ["week", "Every week"],
  ["off", "Off"],
];

/**
 * App settings: where, how often and how many automatic full backups (data and files) are kept outside the app, and
 * how long deleted items stay in the trash.
 */
export function SettingsDialog({ getState, onClose }: { getState: () => AppState; onClose: () => void }) {
  const [settings, setSettings] = useState<AutoBackupSettings>(defaultAutoBackup);
  const [folder, setFolder] = useState<BackupFolder>();
  const [defaultLabel, setDefaultLabel] = useState<string>();
  const [last, setLast] = useState<string>();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const retentionDays = useTrashRetention();

  useEffect(() => {
    void (async () => {
      setSettings(await loadAutoBackupSettings());
      setFolder(await backupFolder());
      setLast(await lastAutoBackup());
      setDefaultLabel((await defaultBackupDestination().catch(() => undefined))?.label);
    })();
  }, []);

  async function change(next: AutoBackupSettings) {
    setSettings(next);
    await saveAutoBackupSettings(next);
  }

  async function chooseFolder() {
    try {
      const picked = await pickBackupFolder();
      if (!picked) return;
      await setBackupFolder(picked);
      setFolder(picked);
      const next = { ...settings, target: "folder" as const };
      await change(next);
      const label = backupFolderLabel(picked);
      // Earlier backups are not moved: they stay where they were written.
      if (
        await askConfirm({
          title: `Write a backup to “${label}” now?`,
          message: "Earlier backups are not moved; they stay where they are.",
          confirm: "Back up now",
        })
      )
        await backupNow(next);
      else setStatus(`The next backup will be written to ${label}.`);
    } catch (cause) {
      setStatus(String(cause instanceof Error ? cause.message : cause));
    }
  }

  async function backupNow(current = settings) {
    setBusy(true);
    setStatus("Writing the backup…");
    try {
      setStatus(`Written to ${await writeAutoBackup(getState(), current, true)}`);
      setLast(await lastAutoBackup());
    } catch (cause) {
      setStatus(String(cause instanceof Error ? cause.message : cause));
    } finally {
      setBusy(false);
    }
  }

  const available = Boolean(defaultLabel) || backupFolderSupported;
  return (
    <Dialog label="Settings" onDismiss={busy ? undefined : onClose}>
      <h2 className={dialogTitleClass}>Settings</h2>
      <section className={dialogListClass}>
        <h3>Automatic backups</h3>
        {platform === "extension" && (
          <Hint>
            Boards and files live inside this browser extension. Removing the extension deletes them; automatic backups
            keep a copy outside the browser.
          </Hint>
        )}
        {available ? (
          <>
            <p>
              A full backup with all files is written as ZIP parts. To restore, choose all parts of one backup in ⋯ →
              Backup.
            </p>
            <label className={fieldLabelClass}>
              Frequency
              <Select
                value={settings.frequency}
                onChange={(event) => void change({ ...settings, frequency: event.target.value as BackupFrequency })}
              >
                {frequencies.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <fieldset className="m-0 grid gap-2 rounded-md border border-line px-3 pt-2 pb-3">
              <legend className="px-1 font-semibold">Location</legend>
              {defaultLabel && (
                <label className={optionClass}>
                  <Checkbox
                    type="radio"
                    name="backup-target"
                    checked={settings.target === "default"}
                    onChange={() => void change({ ...settings, target: "default" })}
                  />
                  <span className="wrap-anywhere">
                    Default: <strong>{defaultLabel}</strong>
                  </span>
                </label>
              )}
              {backupFolderSupported && (
                <label className={optionClass}>
                  <Checkbox
                    type="radio"
                    name="backup-target"
                    checked={settings.target === "folder"}
                    disabled={!folder}
                    onChange={() => void change({ ...settings, target: "folder" })}
                  />
                  <span className="wrap-anywhere">
                    Folder: <strong>{folder ? backupFolderLabel(folder) : "not chosen"}</strong>
                  </span>
                </label>
              )}
              {backupFolderSupported && (
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="justify-self-start"
                  onClick={() => void chooseFolder()}
                  disabled={busy}
                >
                  {folder ? "Choose another folder" : "Choose folder"}
                </Button>
              )}
              {platform === "web" && settings.target === "default" && (
                <Hint>
                  A web page cannot delete or replace files in Downloads: every backup is a new download. Choose a
                  folder to keep only the newest copies.
                </Hint>
              )}
            </fieldset>
            <label className={optionClass}>
              Keep the newest
              <Input
                size="sm"
                className="w-[72px]"
                type="number"
                min={1}
                max={100}
                value={settings.keep}
                onChange={(event) => {
                  const keep = Number(event.target.value);
                  if (Number.isInteger(keep) && keep >= 1 && keep <= 100) void change({ ...settings, keep });
                }}
              />{" "}
              backups
            </label>
            <Hint>
              Backups run while Kanbonk is open. Last backup:{" "}
              {last ? new Date(last).toLocaleString("en-US") : "none yet"}.
            </Hint>
            <Button
              type="button"
              variant="primary"
              onClick={() => void backupNow()}
              disabled={busy || (settings.target === "folder" && !folder)}
            >
              {busy ? "Please wait…" : "Back up now"}
            </Button>
          </>
        ) : (
          <p>Automatic backups to files are not available in this app. Use ⋯ → Backup or sync with another device.</p>
        )}
        {status && (
          <p className={plainReportClass} role="status">
            {status}
          </p>
        )}
      </section>
      <section className={dialogListClass}>
        <h3>Trash</h3>
        <label className={fieldLabelClass}>
          Delete items in the trash forever after
          <Select
            value={retentionDays ?? ""}
            disabled={retentionDays === undefined}
            onChange={(event) =>
              void setTrashRetention(Number(event.target.value)).catch((cause) => setStatus(String(cause)))
            }
          >
            {trashRetentionChoices.map((days) => (
              <option key={days} value={days}>
                {days} days
              </option>
            ))}
          </Select>
        </label>
        <Hint>
          This device deletes them; the deletion then syncs to your other devices, so the shortest period among them
          applies.
        </Hint>
      </section>
      <div className={dialogFooterClass}>
        <Button variant="secondary" size="lg" type="button" onClick={onClose} disabled={busy}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
