import { Modal } from "../ui/Modal";
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
} from "../autoBackup";
import {
  backupFolderLabel,
  backupFolderSupported,
  defaultBackupDestination,
  pickBackupFolder,
  platform,
  type BackupFolder,
} from "../platform";

const frequencies: Array<[BackupFrequency, string]> = [
  ["6h", "Every 6 hours"],
  ["day", "Every day"],
  ["week", "Every week"],
  ["off", "Off"],
];

/** App settings: where, how often and how many automatic full backups (data and files) are kept outside the app. */
export function SettingsDialog({ getState, onClose }: { getState: () => AppState; onClose: () => void }) {
  const [settings, setSettings] = useState<AutoBackupSettings>(defaultAutoBackup);
  const [folder, setFolder] = useState<BackupFolder>();
  const [defaultLabel, setDefaultLabel] = useState<string>();
  const [last, setLast] = useState<string>();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

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
      await change({ ...settings, target: "folder" });
      await backupNow({ ...settings, target: "folder" });
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
    <Modal label="Settings" className="creation-dialog settings-dialog" onDismiss={busy ? undefined : onClose}>
      <h2>Settings</h2>
      <section className="auto-backups">
        <h3>Automatic backups</h3>
        {platform === "extension" && (
          <p className="hint">
            Boards and files live inside this browser extension. Removing the extension deletes them; automatic backups
            keep a copy outside the browser.
          </p>
        )}
        {available ? (
          <>
            <p>
              A full backup with all files is written as ZIP parts. To restore, choose all parts of one backup in ⋯ →
              Backup.
            </p>
            <label>
              Frequency
              <select
                value={settings.frequency}
                onChange={(event) => void change({ ...settings, frequency: event.target.value as BackupFrequency })}
              >
                {frequencies.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="backup-target">
              <legend>Location</legend>
              {defaultLabel && (
                <label className="settings-option">
                  <input
                    type="radio"
                    name="backup-target"
                    checked={settings.target === "default"}
                    onChange={() => void change({ ...settings, target: "default" })}
                  />
                  <span>
                    Default: <strong>{defaultLabel}</strong>
                  </span>
                </label>
              )}
              {backupFolderSupported && (
                <label className="settings-option">
                  <input
                    type="radio"
                    name="backup-target"
                    checked={settings.target === "folder"}
                    disabled={!folder}
                    onChange={() => void change({ ...settings, target: "folder" })}
                  />
                  <span>
                    Folder: <strong>{folder ? backupFolderLabel(folder) : "not chosen"}</strong>
                  </span>
                </label>
              )}
              {backupFolderSupported && (
                <button type="button" onClick={() => void chooseFolder()} disabled={busy}>
                  {folder ? "Choose another folder" : "Choose folder"}
                </button>
              )}
              {platform === "web" && settings.target === "default" && (
                <p className="hint">
                  A web page cannot delete or replace files in Downloads: every backup is a new download. Choose a
                  folder to keep only the newest copies.
                </p>
              )}
            </fieldset>
            <label className="settings-option">
              Keep the newest
              <input
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
            <p className="hint">
              Backups run while Kanbonk is open. Last backup:{" "}
              {last ? new Date(last).toLocaleString("en-US") : "none yet"}.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => void backupNow()}
              disabled={busy || (settings.target === "folder" && !folder)}
            >
              {busy ? "Please wait…" : "Back up now"}
            </button>
          </>
        ) : (
          <p>Automatic backups to files are not available in this app. Use ⋯ → Backup or sync with another device.</p>
        )}
        {status && (
          <p className="import-report" role="status">
            {status}
          </p>
        )}
      </section>
      <div>
        <button type="button" onClick={onClose} disabled={busy}>
          Close
        </button>
      </div>
    </Modal>
  );
}
