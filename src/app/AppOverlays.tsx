import { useState } from "react";
import { type AiSettings, saveAiSettings } from "../ai/ai";
import { AutomationPanel } from "../board/AutomationPanel";
import { BoardActivity } from "../board/BoardActivity";
import { BoardAnalytics } from "../board/BoardAnalytics";
import { ShareLabelsDialog } from "../dialogs/ShareLabelsDialog";
import { AiSettingsDialog } from "../dialogs/AiSettingsDialog";
import { AuthorDialog } from "../dialogs/AuthorDialog";
import { BackupDialog } from "../dialogs/BackupDialog";
import { BoardCopyDialog, type BoardCopyOptions } from "../dialogs/BoardCopyDialog";
import { CloneCardDialog } from "../dialogs/CloneCardDialog";
import { CreationDialog } from "../dialogs/CreationDialog";
import { DedupeDialog } from "../dialogs/DedupeDialog";
import { t } from "../i18n";
import { DeleteDialog } from "../dialogs/DeleteDialog";
import { ExportDialog } from "../dialogs/ExportDialog";
import { ImportDialog } from "../dialogs/ImportDialog";
import { SettingsDialog } from "../dialogs/SettingsDialog";
import { SyncDialog } from "../dialogs/SyncDialog";
import { saveLocalAuthor } from "../lib/storage";
import { type Card, cloneCard, cloneCardName, newId, recordRevision, type Revision, shareLabels } from "../model";
import { mergeDuplicate, pairKey } from "../model/dedupe";
import { inboxWorkspaceId } from "../model/inbox";
import { reminderSignature } from "../model/reminders";
import type { SnapshotMeta } from "../lib/storage";
import { BoardAboutPanel } from "../panels/BoardAboutPanel";
import { HistoryPanel } from "../panels/HistoryPanel";
import { RemindersPanel } from "../panels/RemindersPanel";
import { chooseConflict, type SyncConflict } from "../sync/sync";
import { useApp } from "./AppContext";
import { useStoredSet } from "./useStoredSet";

/** Every dialog and side panel that opens over the app, shown according to `overlays`. */
export function AppOverlays({
  card,
  reminders,
  onDismissReminder,
  aiSettings,
  onAiSettings,
  snapshots,
  onRefreshSnapshots,
  defaultWorkspaceId,
}: {
  /** The open card, whose history the history panel shows instead of the board's. */
  card?: Card;
  reminders: Card[];
  onDismissReminder: (card: Card, signature: string) => void;
  aiSettings: AiSettings | null;
  onAiSettings: (settings: AiSettings | null) => void;
  snapshots: SnapshotMeta[];
  onRefreshSnapshots: () => Promise<void>;
  defaultWorkspaceId?: string;
}) {
  const app = useApp();
  const { state, setState, deviceId, boardId, overlays } = app;
  const open = overlays.overlays;
  const board = state.boards.find((item) => item.id === boardId && !item.deletedAt);
  const [backupConflicts, setBackupConflicts] = useState<SyncConflict[]>([]);
  const [dedupeIgnored, ignorePair] = useStoredSet("kanbonk-dedupe-ignored");
  const cloneSource = open.cloneCardId ? state.cards.find((item) => item.id === open.cloneCardId) : undefined;
  const automationBoard = open.automationBoardId
    ? state.boards.find((item) => item.id === open.automationBoardId && !item.deletedAt)
    : undefined;

  function confirmClone() {
    if (!cloneSource) return;
    const id = newId();
    const name = cloneCardName(state, cloneSource.id);
    setState((current) => recordRevision(cloneCard(current, cloneSource.id, id).state, "card", id, deviceId));
    overlays.close("cloneCardId");
    app.setNotice(t("app.cardCloned", { name }));
    app.setNoticeCardId(id);
  }

  function confirmDelete(withDependents: boolean) {
    const deleted = app.trash.confirmDelete(withDependents);
    if (!deleted) return;
    const { kind, id } = deleted;
    if (kind === "card" && app.route.page === "card" && app.route.id === id) app.setCardId(null);
    if (kind === "board" && boardId === id)
      app.navigate(`/w/${app.fullState.boards.find((item) => item.id === id)?.workspaceId ?? ""}`);
    if (kind === "workspace" && app.page.page === "workspace" && app.page.id === id) app.navigate("/");
    app.setNotice(t("app.movedToTrash", { name: deleted.name }));
  }

  function saveBoardDescription(description: string) {
    if (board && description !== board.description)
      app.boardActions.updateBoard(board.id, (item) => ({ ...item, description }));
    overlays.close("boardAbout");
  }

  function restore(revision: Revision) {
    app.boardActions.restore(revision);
    overlays.close("history");
  }

  function submitBoardCopy(options: BoardCopyOptions) {
    if (!board || !options.name.trim()) return;
    app.setBoardId(app.boardActions.copyBoardTo(board.id, options));
    overlays.close("boardCopy");
  }

  function submitCreation(name: string) {
    const creation = open.creation;
    if (!creation) return;
    if (creation.kind === "workspace") {
      if (name) app.navigate(`/w/${app.boardActions.createWorkspace(name)}`);
    } else if (name) app.setBoardId(app.boardActions.createBoard(name, creation.workspaceId ?? defaultWorkspaceId));
    overlays.close("creation");
  }

  return (
    <>
      {cloneSource && (
        <CloneCardDialog
          name={cloneSource.name}
          copyName={cloneCardName(state, cloneSource.id)}
          onConfirm={confirmClone}
          onCancel={() => overlays.close("cloneCardId")}
        />
      )}
      {app.trash.pendingDelete && (
        <DeleteDialog
          kind={app.trash.pendingDelete.kind}
          name={app.trash.pendingDelete.name}
          impact={app.trash.pendingDelete.impact}
          onConfirm={confirmDelete}
          onCancel={app.trash.cancelDelete}
        />
      )}
      {open.dedupe && (
        <DedupeDialog
          state={state}
          ignored={dedupeIgnored}
          onClose={() => overlays.close("dedupe")}
          onOpen={(item) => {
            overlays.close("dedupe");
            app.setCardId(item.id);
          }}
          onIgnore={(pair) => ignorePair(pairKey(pair.a.id, pair.b.id))}
          onMerge={(keepId, dropId) => {
            setState((current) => mergeDuplicate(current, keepId, dropId, deviceId));
            app.setNotice(t("app.cardsMerged"));
          }}
        />
      )}
      {open.boardAbout && board && (
        <BoardAboutPanel board={board} onSave={saveBoardDescription} onClose={() => overlays.close("boardAbout")} />
      )}
      {open.shareLabelsBoardId && (
        <ShareLabelsDialog
          state={state}
          boardId={open.shareLabelsBoardId}
          onShare={(labelIds, boardIds) => {
            setState((current) => shareLabels(current, labelIds, boardIds, deviceId));
            overlays.close("shareLabelsBoardId");
            app.setNotice(t("labelSharing.shared", { count: boardIds.length }));
          }}
          onClose={() => overlays.close("shareLabelsBoardId")}
        />
      )}
      {open.analyticsBoardId && (
        <BoardAnalytics
          state={state}
          boardId={open.analyticsBoardId}
          onClose={() => overlays.close("analyticsBoardId")}
          onOpenCard={(item) => {
            overlays.close("analyticsBoardId");
            app.setCardId(item.id);
          }}
          onError={app.setError}
        />
      )}
      {open.activityBoardId && (
        <BoardActivity
          state={state}
          boardId={open.activityBoardId}
          onClose={() => overlays.close("activityBoardId")}
          onOpenCard={(item) => {
            app.setBoardId(item.boardId);
            app.setCardId(item.id);
          }}
        />
      )}
      {open.reminders && (
        <RemindersPanel
          reminders={reminders}
          onOpen={(item) => {
            app.openCardInPlace(item);
            overlays.close("reminders");
          }}
          onDismiss={(item) => onDismissReminder(item, reminderSignature(item))}
          onClose={() => overlays.close("reminders")}
        />
      )}
      {automationBoard && (
        <AutomationPanel
          key={automationBoard.id}
          board={automationBoard}
          state={state}
          onClose={() => overlays.close("automationBoardId")}
          onAdd={(listId, action, labelId, trigger, name, leadMinutes) =>
            app.boardActions.addAutomationRule(automationBoard.id, listId, action, labelId, trigger, name, leadMinutes)
          }
          onRemove={(ruleId) => app.boardActions.removeAutomationRule(automationBoard.id, ruleId)}
        />
      )}
      {open.history && (
        <HistoryPanel
          revisions={state.revisions.filter((item) => item.entityId === (card?.id ?? boardId))}
          onRestore={restore}
          onClose={() => overlays.close("history")}
        />
      )}
      {open.settings && (
        <SettingsDialog getState={() => app.stateRef.current} onClose={() => overlays.close("settings")} />
      )}
      {open.ai && (
        <AiSettingsDialog
          settings={aiSettings}
          onClose={() => overlays.close("ai")}
          onSave={(next) => {
            saveAiSettings(next);
            onAiSettings(next);
            overlays.close("ai");
          }}
        />
      )}
      {open.sync && <SyncDialog sync={app.sync} onClose={() => overlays.close("sync")} />}
      {open.backup && (
        <BackupDialog
          getState={() => app.stateRef.current}
          beforeExport={() => app.queue.current}
          onRestored={(restored) => {
            app.stateRef.current = restored;
            setState(restored);
            app.bumpFileVersion();
          }}
          snapshots={snapshots}
          onRefreshSnapshots={onRefreshSnapshots}
          conflicts={backupConflicts}
          onConflictsFound={setBackupConflicts}
          onChooseConflict={(conflict, version) => {
            setState((current) => chooseConflict(current, conflict, version, deviceId));
            setBackupConflicts((current) => current.filter((item) => item !== conflict));
          }}
          onOpenSettings={() => {
            overlays.close("backup");
            overlays.open({ settings: true });
          }}
          onClose={() => overlays.close("backup")}
        />
      )}
      {open.author && (
        <AuthorDialog
          name={app.localAuthor}
          onSave={(name) => {
            app.setLocalAuthor(saveLocalAuthor(name));
            overlays.close("author");
          }}
          onClose={() => overlays.close("author")}
        />
      )}
      {open.import && (
        <ImportDialog
          state={state}
          setState={setState}
          defaultWorkspaceId={defaultWorkspaceId}
          deviceId={deviceId}
          onBoardImported={app.setBoardId}
          onFilesRestored={app.bumpFileVersion}
          onImported={(summary) => {
            overlays.close("import");
            app.setNotice(summary);
          }}
          onClose={() => overlays.close("import")}
        />
      )}
      {open.exportBoardId && (
        <ExportDialog
          state={app.fullState}
          boardId={open.exportBoardId}
          onClose={() => overlays.close("exportBoardId")}
          onError={app.setError}
        />
      )}
      {open.boardCopy && (
        <BoardCopyDialog
          initial={open.boardCopy}
          workspaces={state.workspaces.filter((item) => item.id !== inboxWorkspaceId && !item.deletedAt)}
          onCopy={submitBoardCopy}
          onClose={() => overlays.close("boardCopy")}
        />
      )}
      {open.creation && (
        <CreationDialog
          kind={open.creation.kind}
          onCreate={submitCreation}
          onClose={() => overlays.close("creation")}
        />
      )}
    </>
  );
}
