import { askConfirm } from "../ui/AskDialog";
import { Dialog } from "../ui/Modal";
import { useState } from "react";
import { autoSnapshot } from "../backup/autoBackup";
import { createBackupParts, restoreBackup } from "../backup/backup";
import { formatDateTime, t } from "../i18n";
import { tNodes } from "../i18n/nodes";
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
          setReport(t("dialogs.backupSavingCanceled", { count }));
          return;
        }
        count++;
        unavailable = part.unavailable;
        setReport(t("dialogs.backupDownloadedParts", { done: count, count: part.total }));
      }
      const done = t("dialogs.backupDownloaded", { count });
      setReport(unavailable ? `${done} ${t("dialogs.backupMissingAttachments", { count: unavailable })}` : done);
    } catch (cause) {
      setReport(t("dialogs.backupFailed", { error: String(cause) }));
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
      const done = t("dialogs.backupRestored", { files: restored.files, conflicts: restored.conflicts.length });
      setReport(
        restored.unavailable ? `${done} ${t("dialogs.backupRestoredMissing", { count: restored.unavailable })}` : done,
      );
    } catch (cause) {
      setReport(t("dialogs.restoreFailed", { error: String(cause) }));
    } finally {
      setBusy(false);
    }
  }

  async function restoreSnapshot(meta: SnapshotMeta) {
    const time = formatDateTime(meta.createdAt);
    if (
      !(await askConfirm({
        title: t("dialogs.restoreSnapshotTitle", { time }),
        message: t("dialogs.restoreSnapshotMessage"),
        confirm: t("common.restore"),
      }))
    )
      return;
    try {
      await autoSnapshot(getState());
      const snapshot = await loadSnapshot(meta.id);
      if (!snapshot) throw new Error(t("dialogs.backupNotFound"));
      rememberStateIds(snapshot);
      onRestored(snapshot);
      setReport(t("dialogs.snapshotRestored"));
      await onRefreshSnapshots();
    } catch (cause) {
      setReport(t("dialogs.restoreFailed", { error: String(cause) }));
    }
  }

  return (
    <Dialog
      label={t("dialogs.backupTitle")}
      className="max-h-[calc(100dvh-96px)] overflow-auto"
      onDismiss={busy ? undefined : onClose}
    >
      <h2 className={dialogTitleClass}>{t("dialogs.backupTitle")}</h2>
      <p className={dialogIntroClass}>{t("dialogs.backupIntro")}</p>
      <Button variant="primary" onClick={exportBackup} disabled={busy}>
        {busy ? t("common.pleaseWait") : t("dialogs.downloadBackup")}
      </Button>
      <div className={`${fieldLabelClass} my-3.5`}>
        {t("dialogs.backupZipParts")}
        <FileButton
          size="lg"
          accept=".zip,application/zip"
          multiple
          placeholder={t("dialogs.noFilesChosen")}
          onFiles={setFiles}
        >
          {t("dialogs.chooseFiles")}
        </FileButton>
      </div>
      <Button variant="secondary" size="lg" onClick={importBackup} disabled={busy || !files.length}>
        {t("dialogs.restoreFromZip")}
      </Button>
      <section className={dialogListClass}>
        <h3>{t("dialogs.snapshotsTitle")}</h3>
        <p>
          {tNodes("dialogs.snapshotsIntro", {
            settings: (
              <Button type="button" variant="link" onClick={onOpenSettings}>
                {t("settings.title")}
              </Button>
            ),
          })}
        </p>
        <Button
          variant="secondary"
          size="lg"
          className="self-start"
          onClick={() => void autoSnapshot(getState()).then(onRefreshSnapshots)}
        >
          {t("dialogs.createSnapshotNow")}
        </Button>
        {snapshots.length ? (
          <div className="flex max-h-[220px] flex-col gap-1 overflow-auto">
            {snapshots.map((meta) => (
              <PanelRow wrap key={meta.id}>
                <PanelRowText className="flex flex-col">
                  <strong>{formatDateTime(meta.createdAt)}</strong>
                  <PanelRowNote>
                    {t("dialogs.snapshotStats", {
                      boards: meta.boards,
                      cards: meta.cards,
                      size: Math.round(meta.size / 1024),
                    })}
                  </PanelRowNote>
                </PanelRowText>
                <Button variant="secondary" className="flex-none" onClick={() => void restoreSnapshot(meta)}>
                  {t("common.restore")}
                </Button>
              </PanelRow>
            ))}
          </div>
        ) : (
          <p>{t("dialogs.noSnapshots")}</p>
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
          localLabel={t("dialogs.currentVersion")}
          remoteLabel={t("dialogs.backupVersion")}
          onChoose={(version) => onChooseConflict(conflict, version)}
        />
      ))}
      <div className={dialogFooterClass}>
        <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>
          {t("common.close")}
        </Button>
      </div>
    </Dialog>
  );
}
