import { Modal } from "../ui/Modal";
import { useState } from "react";
import { autoSnapshot } from "../backup/autoBackup";
import { createBackupParts, restoreBackup } from "../backup/backup";
import { type AppState, rememberStateIds } from "../model";
import { saveFile } from "../lib/platform";
import { loadSnapshot, type SnapshotMeta } from "../lib/storage";
import type { SyncConflict } from "../sync/sync";

/**
 * Manual ZIP backups and the automatic snapshots kept inside the app.
 * Snapshots and unresolved conflicts live in the caller: background snapshots add to the list while the dialog is
 * open, and conflicts stay open for a decision after the dialog is closed.
 */
export function BackupDialog({
  getState,
  beforeExport,
  onRestored,
  snapshots,
  onRefreshSnapshots,
  conflicts,
  onConflictsFound,
  onChooseConflict,
  onOpenSettings,
  onClose,
}: {
  getState: () => AppState;
  /** Resolves once pending saves are written, so the backup holds the latest data. */
  beforeExport: () => Promise<void>;
  onRestored: (state: AppState) => void;
  snapshots: SnapshotMeta[];
  onRefreshSnapshots: () => Promise<void>;
  conflicts: SyncConflict[];
  onConflictsFound: (conflicts: SyncConflict[]) => void;
  onChooseConflict: (conflict: SyncConflict, version: "local" | "remote") => void;
  onOpenSettings: () => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState("");

  async function exportBackup() {
    setBusy(true);
    setReport("");
    try {
      await beforeExport();
      let count = 0;
      let unavailable = 0;
      for await (const part of createBackupParts(getState())) {
        if (!(await saveFile(part.blob, part.name))) {
          setReport(`Saving canceled after ${count} parts.`);
          return;
        }
        count++;
        unavailable = part.unavailable;
        setReport(`Downloaded ${count} of ${part.total} parts.`);
      }
      setReport(
        `Backup downloaded: ${count} ZIP files.${unavailable ? ` Missing attachments: ${unavailable}; fetch them from Trello first.` : ""}`,
      );
    } catch (cause) {
      setReport(`Backup failed: ${String(cause)}`);
    } finally {
      setBusy(false);
    }
  }

  async function importBackup() {
    setBusy(true);
    setReport("");
    try {
      const restored = await restoreBackup(files, getState());
      onRestored(restored.state);
      onConflictsFound(restored.conflicts);
      setReport(
        `Files restored: ${restored.files}. Conflicts: ${restored.conflicts.length}.${restored.unavailable ? ` Attachments missing from the original backup: ${restored.unavailable}.` : ""}`,
      );
    } catch (cause) {
      setReport(`Restore failed: ${String(cause)}`);
    } finally {
      setBusy(false);
    }
  }

  async function restoreSnapshot(meta: SnapshotMeta) {
    const time = new Date(meta.createdAt).toLocaleString("en-US");
    if (
      !confirm(
        `Restore all data to the state from ${time}? The current state will be saved as a separate backup first.`,
      )
    )
      return;
    try {
      await autoSnapshot(getState());
      const snapshot = await loadSnapshot(meta.id);
      if (!snapshot) throw new Error("Backup not found.");
      rememberStateIds(snapshot);
      onRestored(snapshot);
      setReport("Data restored from the automatic backup.");
      await onRefreshSnapshots();
    } catch (cause) {
      setReport(`Restore failed: ${String(cause)}`);
    }
  }

  return (
    <Modal label="Backup" className="creation-dialog import-dialog" onDismiss={busy ? undefined : onClose}>
      <h2>Backup</h2>
      <p>
        Save all boards and available local files to ZIP. To restore, select all parts of one backup at once. Existing
        data is kept; conflicting changes will ask you to choose a version.
      </p>
      <button className="primary-button" onClick={exportBackup} disabled={busy}>
        {busy ? "Please wait…" : "Download backup"}
      </button>
      <label>
        Backup ZIP parts
        <input
          type="file"
          accept=".zip,application/zip"
          multiple
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        />
      </label>
      <button onClick={importBackup} disabled={busy || !files.length}>
        Restore from ZIP
      </button>
      <section className="auto-backups">
        <h3>Snapshots</h3>
        <p>
          Every 10 minutes, if anything changed, a snapshot of all data is saved inside the app (the last 20, plus one
          per day for 30 days). Full backups with files outside the app are set up in{" "}
          <button type="button" className="link-button" onClick={onOpenSettings}>
            Settings
          </button>
          .
        </p>
        <button onClick={() => void autoSnapshot(getState()).then(onRefreshSnapshots)}>Create snapshot now</button>
        {snapshots.length ? (
          <div className="snapshot-list">
            {snapshots.map((meta) => (
              <div className="panel-row" key={meta.id}>
                <span>
                  <strong>{new Date(meta.createdAt).toLocaleString("en-US")}</strong>
                  <small>
                    boards: {meta.boards}, cards: {meta.cards}, {Math.round(meta.size / 1024)} KB
                  </small>
                </span>
                <button onClick={() => void restoreSnapshot(meta)}>Restore</button>
              </div>
            ))}
          </div>
        ) : (
          <p>No snapshots yet.</p>
        )}
      </section>
      {report && (
        <p className="import-report" role="status">
          {report}
        </p>
      )}
      {conflicts.map((conflict) => (
        <div className="sync-conflict" key={`${conflict.kind}-${conflict.id}`}>
          <strong>Conflict: {conflict.local.name}</strong>
          <small>Choose a version of this item.</small>
          <div>
            <button onClick={() => onChooseConflict(conflict, "local")}>Current version</button>
            <button onClick={() => onChooseConflict(conflict, "remote")}>Backup version</button>
          </div>
        </div>
      ))}
      <div>
        <button onClick={onClose} disabled={busy}>
          Close
        </button>
      </div>
    </Modal>
  );
}
