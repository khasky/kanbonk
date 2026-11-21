import { Dialog } from "../ui/Modal";
import { useState } from "react";
import { autoSnapshot } from "../backup/autoBackup";
import { createBackupParts, restoreBackup } from "../backup/backup";
import { type AppState, rememberStateIds } from "../model";
import { saveFile } from "../lib/platform";
import { loadSnapshot, type SnapshotMeta } from "../lib/storage";
import type { SyncConflict } from "../sync/sync";
import { Button } from "../ui/Button";
import { FileButton } from "../ui/FileButton";
import { PanelRow, PanelRowNote, PanelRowText } from "../ui/PanelRow";
import { ConflictChoice } from "./ConflictChoice";
import {
  dialogFooterClass,
  dialogIntroClass,
  dialogListClass,
  dialogTitleClass,
  fieldLabelClass,
  reportClass,
} from "./dialogLook";

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
    <Dialog label="Backup" className="max-h-[calc(100dvh-96px)] overflow-auto" onDismiss={busy ? undefined : onClose}>
      <h2 className={dialogTitleClass}>Backup</h2>
      <p className={dialogIntroClass}>
        Save all boards and available local files to ZIP. To restore, select all parts of one backup at once. Existing
        data is kept; conflicting changes will ask you to choose a version.
      </p>
      <Button variant="primary" onClick={exportBackup} disabled={busy}>
        {busy ? "Please wait…" : "Download backup"}
      </Button>
      <div className={`${fieldLabelClass} my-3.5`}>
        Backup ZIP parts
        <FileButton size="lg" accept=".zip,application/zip" multiple placeholder="No files chosen" onFiles={setFiles}>
          Choose files
        </FileButton>
      </div>
      <Button variant="secondary" size="lg" onClick={importBackup} disabled={busy || !files.length}>
        Restore from ZIP
      </Button>
      <section className={dialogListClass}>
        <h3>Snapshots</h3>
        <p>
          Every 10 minutes, if anything changed, a snapshot of all data is saved inside the app (the last 20, plus one
          per day for 30 days). Full backups with files outside the app are set up in{" "}
          <Button type="button" variant="link" onClick={onOpenSettings}>
            Settings
          </Button>
          .
        </p>
        <Button
          variant="secondary"
          size="lg"
          className="self-start"
          onClick={() => void autoSnapshot(getState()).then(onRefreshSnapshots)}
        >
          Create snapshot now
        </Button>
        {snapshots.length ? (
          <div className="flex max-h-[220px] flex-col gap-1 overflow-auto">
            {snapshots.map((meta) => (
              <PanelRow wrap key={meta.id}>
                <PanelRowText className="flex flex-col">
                  <strong>{new Date(meta.createdAt).toLocaleString("en-US")}</strong>
                  <PanelRowNote>
                    boards: {meta.boards}, cards: {meta.cards}, {Math.round(meta.size / 1024)} KB
                  </PanelRowNote>
                </PanelRowText>
                <Button variant="secondary" className="flex-none" onClick={() => void restoreSnapshot(meta)}>
                  Restore
                </Button>
              </PanelRow>
            ))}
          </div>
        ) : (
          <p>No snapshots yet.</p>
        )}
      </section>
      {report && (
        <p className={reportClass} role="status">
          {report}
        </p>
      )}
      {conflicts.map((conflict) => (
        <ConflictChoice
          key={`${conflict.kind}-${conflict.id}`}
          name={conflict.local.name}
          localLabel="Current version"
          remoteLabel="Backup version"
          onChoose={(version) => onChooseConflict(conflict, version)}
        />
      ))}
      <div className={dialogFooterClass}>
        <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
