import { useState } from "react";
import { type AiSettings, saveAiSettings } from "../ai/ai";
import { AutomationPanel } from "../board/AutomationPanel";
import { BoardActivity } from "../board/BoardActivity";
import { BoardAnalytics } from "../board/BoardAnalytics";
import { ApprovalsPanel } from "../board/ApprovalsPanel";
import { DuplicatesPanel } from "../board/DuplicatesPanel";
import { PriorityOverview } from "../board/PriorityOverview";
import { ShareLabelsDialog } from "../dialogs/ShareLabelsDialog";
import { LabelCleanupPanel } from "../board/LabelCleanupPanel";
import { RequiredFieldsPanel } from "../board/RequiredFieldsPanel";
import { BoardSettingsPanel } from "../board/BoardSettingsPanel";
import { AiSettingsDialog } from "../dialogs/AiSettingsDialog";
import { AuthorDialog } from "../dialogs/AuthorDialog";
import { BackupDialog } from "../dialogs/BackupDialog";
import { BoardCopyDialog, type BoardCopyOptions } from "../dialogs/BoardCopyDialog";
import { CloneCardDialog } from "../dialogs/CloneCardDialog";
import { CreationDialog } from "../dialogs/CreationDialog";
import { t } from "../i18n";
import { DeleteDialog } from "../dialogs/DeleteDialog";
import { ExportDialog } from "../dialogs/ExportDialog";
import { ImportDialog } from "../dialogs/ImportDialog";
import { SettingsDialog } from "../dialogs/SettingsDialog";
import { SyncDialog } from "../dialogs/SyncDialog";
import { refreshIdentity } from "../lib/identity";
import { saveLocalAuthor } from "../lib/storage";
import {
  type Card,
  cloneCard,
  cloneCardName,
  deleteLabels,
  mergeLabels,
  newId,
  recordRevision,
  type Revision,
  shareLabels,
} from "../model";
import { mergeDuplicate } from "../model/dedupe";
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
  const settingsBoard = open.settingsBoardId
    ? state.boards.find((item) => item.id === open.settingsBoardId && !item.deletedAt)
    : undefined;
  const requiredFieldsBoard = open.requiredFieldsBoardId
    ? state.boards.find((item) => item.id === open.requiredFieldsBoardId && !item.deletedAt)
    : undefined;
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

  function confirmDelete(withDependents: boolean, withMirrors: boolean) {
    const deleted = app.trash.confirmDelete(withDependents, withMirrors);
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
          mirrorCount={app.trash.pendingDelete.mirrorIds.length}
          onConfirm={confirmDelete}
          onCancel={app.trash.cancelDelete}
        />
      )}
      {open.duplicatesBoardId && (
        <DuplicatesPanel
          state={state}
          boardId={open.duplicatesBoardId}
          ignored={dedupeIgnored}
          onIgnore={ignorePair}
          onClose={() => overlays.close("duplicatesBoardId")}
          onOpenCard={(item) => {
            overlays.close("duplicatesBoardId");
            app.setCardId(item.id);
          }}
          onMerge={(keepId, dropId, notes) => {
            setState((current) =>
              mergeDuplicate(current, keepId, dropId, deviceId, { ...notes, author: app.localAuthor }),
            );
            app.setNotice(t("app.cardsMerged"));
          }}
        />
      )}
      {open.boardAbout && board && (
        <BoardAboutPanel board={board} onSave={saveBoardDescription} onClose={() => overlays.close("boardAbout")} />
      )}
      {settingsBoard && (
        <BoardSettingsPanel
          board={settingsBoard}
          state={state}
          onCardAging={(cardAging) =>
            app.boardActions.updateBoard(settingsBoard.id, (item) => ({ ...item, cardAging }))
          }
          onCardDone={(cardDone) => app.boardActions.updateBoard(settingsBoard.id, (item) => ({ ...item, cardDone }))}
          onClose={() => overlays.close("settingsBoardId")}
        />
      )}
      {requiredFieldsBoard && (
        <RequiredFieldsPanel
          state={state}
          board={requiredFieldsBoard}
          onSave={(requiredFields) => {
            app.boardActions.updateBoard(requiredFieldsBoard.id, (item) => ({ ...item, requiredFields }));
            overlays.close("requiredFieldsBoardId");
          }}
          onClose={() => overlays.close("requiredFieldsBoardId")}
        />
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
      {open.cleanLabelsBoardId && (
        <LabelCleanupPanel
          state={state}
          boardId={open.cleanLabelsBoardId}
          onDelete={(labelIds) => {
            setState((current) => deleteLabels(current, labelIds, deviceId));
            app.setNotice(t("labelCleanup.deleted", { count: labelIds.length }));
          }}
          onMerge={(keepId, dropIds) => {
            setState((current) => mergeLabels(current, keepId, dropIds, deviceId));
            const name = state.labels.find((label) => label.id === keepId)?.name ?? "";
            app.setNotice(t("labelCleanup.merged", { count: dropIds.length, name }));
          }}
          onClose={() => overlays.close("cleanLabelsBoardId")}
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
      {open.prioritiesBoardId && (
        <PriorityOverview
          state={state}
          boardId={open.prioritiesBoardId}
          onClose={() => overlays.close("prioritiesBoardId")}
          onOpenCard={(item) => {
            overlays.close("prioritiesBoardId");
            app.setCardId(item.id);
          }}
        />
      )}
      {open.approvalsBoardId && (
        <ApprovalsPanel
          state={state}
          boardId={open.approvalsBoardId}
          onClose={() => overlays.close("approvalsBoardId")}
          onOpenCard={(item) => {
            overlays.close("approvalsBoardId");
            app.setCardId(item.id);
          }}
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
          onAdd={(listId, action, labelId, trigger, name, leadMinutes, targetListId) =>
            app.boardActions.addAutomationRule(
              automationBoard.id,
              listId,
              action,
              labelId,
              trigger,
              name,
              leadMinutes,
              targetListId,
            )
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
            // Tiles and cards tell what waits on this device's member, found by this name.
            refreshIdentity();
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
