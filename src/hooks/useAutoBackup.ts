import { type RefObject, useEffect, useEffectEvent, useRef, useState } from "react";
import {
  autoBackupIntervalMs,
  autoSnapshot,
  backupDue,
  lastAutoBackup,
  loadAutoBackupSettings,
  writeAutoBackup,
} from "../autoBackup";
import type { AppState } from "../model";
import { listSnapshots, type SnapshotMeta } from "../storage";

/**
 * Automatic backups: local snapshots every 10 minutes (and when the page is hidden) plus full ZIP backups on the
 * schedule from Settings. Returns the snapshot list shown in the Backup dialog.
 */
export function useAutoBackup({
  ready,
  stateRef,
  onError,
}: {
  ready: boolean;
  stateRef: RefObject<AppState>;
  onError: (message: string) => void;
}) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const running = useRef(false);
  const lastError = useRef("");
  const reportError = useEffectEvent(onError);

  useEffect(() => {
    if (!ready) return;
    const run = () => {
      void autoSnapshot(stateRef.current)
        .then((meta) => {
          if (meta) setSnapshots((current) => [meta, ...current]);
        })
        .catch((cause) => reportError(`Automatic backup was not created: ${String(cause)}`));
      if (running.current) return;
      running.current = true;
      void (async () => {
        const settings = await loadAutoBackupSettings();
        if (!backupDue(settings, await lastAutoBackup())) return;
        await writeAutoBackup(stateRef.current, settings);
        lastError.current = "";
      })()
        .catch((cause) => {
          // A failing backup is reported once per distinct reason, not every 10 minutes.
          const message = String(cause instanceof Error ? cause.message : cause);
          if (message !== lastError.current) reportError(`Automatic backup failed: ${message} Check ⋯ → Settings.`);
          lastError.current = message;
        })
        .finally(() => {
          running.current = false;
        });
    };
    const first = window.setTimeout(run, 30_000);
    const interval = window.setInterval(run, autoBackupIntervalMs);
    const hidden = () => {
      if (document.visibilityState === "hidden") void autoSnapshot(stateRef.current);
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [ready, stateRef]);

  async function refreshSnapshots() {
    setSnapshots((await listSnapshots()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  return { snapshots, refreshSnapshots };
}
