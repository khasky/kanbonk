import { Dialog } from "../ui/Modal";
import { type Dispatch, type SetStateAction, useState } from "react";
import { isMessage, type MessageKey, t } from "../i18n";
import { tNodes } from "../i18n/nodes";
import {
  addImportedBoardWithRevisions,
  parseTrelloBoard,
  prepareTrelloWorkspace,
  readTrelloExport,
  restoreExistingAttachments,
  restoreTrelloAttachments,
} from "../trello/import";
import { type AppState, recordRevision, recordRevisions } from "../model";
import { downloadTrelloAttachment, downloadTrelloComments, trelloBridgeAvailable } from "../trello/bridge";
import { parseTrelloCsv } from "../trello/formats";
import { ElapsedTime } from "../ui/ElapsedTime";
import { ensurePersonalWorkspace, personalWorkspaceId } from "../model/workspaces";
import { Button } from "../ui/Button";
import { FileButton } from "../ui/FileButton";
import { Hint } from "../ui/Hint";
import { dialogFooterClass, dialogIntroClass, dialogTitleClass, fieldLabelClass, reportClass } from "./dialogLook";

const isZip = (file: File) => file.name.toLowerCase().endsWith(".zip");

/** Imports a Trello board from its export (ZIP parts, JSON or CSV), or adds files to a board imported earlier. */
export function ImportDialog({
  state,
  setState,
  defaultWorkspaceId,
  deviceId,
  onBoardImported,
  onFilesRestored,
  onClose,
}: {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  defaultWorkspaceId: string | undefined;
  deviceId: string;
  onBoardImported: (boardId: string) => void;
  onFilesRestored: () => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [time, setTime] = useState<{ start: number; end?: number }>();
  const [report, setReport] = useState("");
  const zips = files.filter(isZip);

  /** Runs one import action with the busy flag, the timer and an error report. */
  async function run(action: () => Promise<string>, failure: MessageKey) {
    setBusy(true);
    setTime({ start: Date.now() });
    setReport("");
    try {
      setReport(await action());
    } catch (cause) {
      setReport(t(failure, { error: String(cause) }));
    } finally {
      setBusy(false);
      setTime((current) => current && { ...current, end: Date.now() });
    }
  }

  async function importCsv(file: File): Promise<string> {
    const workspaceId = defaultWorkspaceId ?? personalWorkspaceId;
    const result = parseTrelloCsv(await file.text(), workspaceId, file.name.replace(/\.csv$/i, ""));
    setState((current) =>
      addImportedBoardWithRevisions(ensurePersonalWorkspace(current, workspaceId, deviceId), result, deviceId),
    );
    onBoardImported(result.board.id);
    return t("dialogs.importedCsv", {
      lists: t("dialogs.lists", { count: result.lists.length }),
      cards: t("common.cards", { count: result.cards.length }),
      warnings: result.warnings.join(" "),
    });
  }

  async function importBoard(): Promise<string> {
    const boardFiles = files.filter((file) => !isZip(file));
    if (boardFiles.length > 1) throw new Error(t("dialogs.chooseOneBoard"));
    const boardFile = boardFiles[0];
    if (boardFile?.name.toLowerCase().endsWith(".csv")) return importCsv(boardFile);

    const exported = zips.length ? await readTrelloExport(zips) : { json: undefined, boardId: "" };
    let raw = boardFile ? JSON.parse(await boardFile.text()) : exported.json;
    if (!raw) throw new Error(t("dialogs.noBoardJson"));
    if (boardFile && exported.boardId && exported.boardId !== (raw as { id?: string }).id)
      throw new Error(t("dialogs.differentBoards"));
    const fallbackWorkspaceId = defaultWorkspaceId ?? personalWorkspaceId;
    const bridgeAvailable = await trelloBridgeAvailable();
    const source = raw as { id?: unknown; actions?: unknown; kanbonkCommentsComplete?: unknown };
    // Trello's JSON export holds at most 1000 actions; the extension can fetch the older comments.
    if (
      bridgeAvailable &&
      source &&
      typeof source.id === "string" &&
      Array.isArray(source.actions) &&
      source.actions.length >= 1000 &&
      source.kanbonkCommentsComplete !== true
    ) {
      try {
        raw = { ...source, kanbonkComments: await downloadTrelloComments(source.id), kanbonkCommentsComplete: true };
      } catch {
        /* The JSON warning reports that older comments may be missing. */
      }
    }
    const result = parseTrelloBoard(raw, fallbackWorkspaceId);
    const directDownload = result.attachments.length > 0 && bridgeAvailable;
    const warnings = await restoreTrelloAttachments(
      result,
      zips,
      directDownload ? downloadTrelloAttachment : undefined,
    );
    setState((current) => {
      const prepared = prepareTrelloWorkspace(current, result.organization, fallbackWorkspaceId);
      let next = prepared.state;
      result.board.workspaceId = prepared.workspaceId;
      if (prepared.changedWorkspaceId) next = recordRevision(next, "workspace", prepared.changedWorkspaceId, deviceId);
      next = ensurePersonalWorkspace(next, prepared.workspaceId, deviceId);
      return addImportedBoardWithRevisions(next, result, deviceId);
    });
    if (!result.board.deletedAt) onBoardImported(result.board.id);

    const missingAttachments = warnings.filter((item) => isMessage(item, "trello.attachmentNotDownloaded"));
    const notFetched = t("dialogs.attachmentsNotFetched", {
      attachments: missingAttachments.length,
      warnings: warnings.slice(0, 3).join(" "),
    });
    const unavailable = warnings.length
      ? missingAttachments.length && !zips.length && !directDownload
        ? `${notFetched} ${t("dialogs.importExtensionHint")}`
        : notFetched
      : "";
    const closed = [...result.lists, ...result.cards].filter((item) => item.deletedAt).length;
    const notes = [
      ...result.warnings.filter((item) => item !== t("trello.attachmentsNeedDownload")),
      unavailable,
      result.board.deletedAt
        ? t("dialogs.boardClosedInTrello")
        : closed
          ? t("dialogs.closedInTrello", { count: closed })
          : "",
    ];
    const imported = [
      t("dialogs.lists", { count: result.lists.length }),
      t("common.cards", { count: result.cards.length }),
      t("dialogs.attachments", { count: result.attachments.length - missingAttachments.length }),
    ];
    return t("dialogs.imported", { items: imported.join(", "), notes: notes.filter(Boolean).join(" ") });
  }

  async function addMissingFiles(): Promise<string> {
    const restored = await restoreExistingAttachments(state, zips);
    setState(() =>
      recordRevisions(
        restored.state,
        [
          ...restored.changedBoards.map((id) => ({ kind: "board" as const, id })),
          ...restored.changedCards.map((id) => ({ kind: "card" as const, id })),
        ],
        deviceId,
      ),
    );
    if (restored.restoredBackgrounds) onFilesRestored();
    return t("dialogs.filesRestored", {
      attachments: restored.restored,
      backgrounds: restored.restoredBackgrounds,
    });
  }

  return (
    <Dialog
      label={t("dialogs.importTitle")}
      className="max-h-[calc(100dvh-96px)] overflow-auto"
      onDismiss={busy ? undefined : onClose}
    >
      <h2 className={dialogTitleClass}>{t("dialogs.importTitle")}</h2>
      <p className={dialogIntroClass}>
        {tNodes("dialogs.importIntro", { exportBoard: <strong>{t("dialogs.exportBoard")}</strong> })}
      </p>
      <p className={dialogIntroClass}>{t("dialogs.importIntroParts")}</p>
      <div className={`${fieldLabelClass} my-3.5`}>
        {t("dialogs.filesFromTrello")}
        <FileButton
          size="lg"
          multiple
          accept=".zip,application/zip,.json,application/json,.csv,text/csv"
          disabled={busy}
          placeholder={t("dialogs.noFilesChosen")}
          onFiles={setFiles}
        >
          {t("dialogs.chooseFiles")}
        </FileButton>
      </div>
      {files.length > 1 && <Hint tone="subtle">{t("dialogs.filesChosen", { count: files.length })}</Hint>}
      {time && <ElapsedTime {...time} tone="subtle" />}
      {report && (
        <p className={reportClass} role="status">
          {report}
        </p>
      )}
      <div className={dialogFooterClass}>
        <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>
          {t("common.close")}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => void run(addMissingFiles, "dialogs.zipError")}
          disabled={busy || !zips.length}
          title={t("dialogs.addFilesTitle")}
        >
          {t("dialogs.addFiles")}
        </Button>
        <Button
          variant="primary"
          onClick={() => void run(importBoard, "dialogs.importFailed")}
          disabled={busy || !files.length}
        >
          {busy ? t("dialogs.importing") : t("dialogs.import")}
        </Button>
      </div>
    </Dialog>
  );
}
