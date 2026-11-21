import { Modal } from "../ui/Modal";
import { type Dispatch, type SetStateAction, useState } from "react";
import { counted } from "../lib/format";
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
  async function run(action: () => Promise<string>, failure: string) {
    setBusy(true);
    setTime({ start: Date.now() });
    setReport("");
    try {
      setReport(await action());
    } catch (cause) {
      setReport(`${failure}: ${String(cause)}`);
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
    return `Imported from CSV: ${counted(result.lists.length, "list", "lists")}, ${counted(result.cards.length, "card", "cards")}. ${result.warnings.join(" ")}`;
  }

  async function importBoard(): Promise<string> {
    const boardFiles = files.filter((file) => !isZip(file));
    if (boardFiles.length > 1) throw new Error("Choose one board JSON or CSV.");
    const boardFile = boardFiles[0];
    if (boardFile?.name.toLowerCase().endsWith(".csv")) return importCsv(boardFile);

    const exported = zips.length ? await readTrelloExport(zips) : { json: undefined, boardId: "" };
    let raw = boardFile ? JSON.parse(await boardFile.text()) : exported.json;
    if (!raw)
      throw new Error(
        "The chosen ZIP files contain no board JSON. Choose all parts of the export, or add the board JSON.",
      );
    if (boardFile && exported.boardId && exported.boardId !== (raw as { id?: string }).id)
      throw new Error("The JSON and the ZIP files belong to different Trello boards.");
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

    const missingAttachments = warnings.filter((item) => item.startsWith("Could not download attachment"));
    const missingStickers = warnings.filter((item) => item.startsWith("Could not download sticker"));
    const hint =
      missingAttachments.length && !zips.length && !directDownload
        ? " Export the board with the Kanbonk Trello Import extension and choose its ZIP files."
        : "";
    const unavailable = warnings.length
      ? `Attachments not fetched: ${missingAttachments.length}. Stickers: ${missingStickers.length}. ${warnings.slice(0, 3).join(" ")}${hint}`
      : "";
    const notes = [
      ...result.warnings.filter(
        (item) => !item.startsWith("Attachments need") && !item.startsWith("Trello sticker images need"),
      ),
      unavailable,
      result.board.deletedAt
        ? "The board is closed in Trello, so it is in the trash; restore it there within 30 days."
        : [...result.lists, ...result.cards].some((item) => item.deletedAt)
          ? `Lists and cards closed in Trello are in the trash (${[...result.lists, ...result.cards].filter((item) => item.deletedAt).length}); restore them there within 30 days.`
          : "",
    ];
    const imported = [
      counted(result.lists.length, "list", "lists"),
      counted(result.cards.length, "card", "cards"),
      counted(result.attachments.length - missingAttachments.length, "attachment", "attachments"),
      counted(result.stickers.length - missingStickers.length, "sticker", "stickers"),
    ];
    return `Imported: ${imported.join(", ")}. ${notes.filter(Boolean).join(" ")}`;
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
    if (restored.restoredBackgrounds || restored.restoredStickers) onFilesRestored();
    return `Attachments restored: ${restored.restored}. Stickers: ${restored.restoredStickers}. Board backgrounds: ${restored.restoredBackgrounds}.`;
  }

  return (
    <Modal label="Import from Trello" className="creation-dialog import-dialog" onDismiss={busy ? undefined : onClose}>
      <h2>Import from Trello</h2>
      <p>
        To move a board with all its files, install the Kanbonk Trello Import extension: open chrome://extensions or
        edge://extensions, turn on Developer mode, choose Load unpacked and select the trello-import-extension folder of
        the project. Then open the board in Trello and press <strong>Export board</strong> in the Kanbonk panel. The
        board arrives as ZIP parts of about 100 MB.
      </p>
      <p>
        Choose all the parts here at once. A board JSON or CSV exported from Trello also works; attachments are then
        fetched through the extension while a Trello tab is open.
      </p>
      <label>
        Files from Trello
        <input
          type="file"
          multiple
          accept=".zip,application/zip,.json,application/json,.csv,text/csv"
          disabled={busy}
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        />
      </label>
      {files.length > 1 && <p className="hint">{counted(files.length, "file", "files")} chosen.</p>}
      {time && <ElapsedTime {...time} />}
      {report && (
        <p className="import-report" role="status">
          {report}
        </p>
      )}
      <div>
        <button onClick={onClose} disabled={busy}>
          Close
        </button>
        <button
          onClick={() => void run(addMissingFiles, "ZIP error")}
          disabled={busy || !zips.length}
          title="Fill missing files of a board imported earlier"
        >
          Add files to imported board
        </button>
        <button
          className="primary-button"
          onClick={() => void run(importBoard, "Import failed")}
          disabled={busy || !files.length}
        >
          {busy ? "Importing…" : "Import"}
        </button>
      </div>
    </Modal>
  );
}
