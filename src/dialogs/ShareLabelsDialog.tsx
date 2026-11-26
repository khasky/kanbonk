import { useState } from "react";
import { t } from "../i18n";
import type { AppState } from "../model";
import { inboxBoardId } from "../model/inbox";
import { readableTextColor } from "../model/labelColors";
import { Dialog, submitWith } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Field";
import { optionLabelClass } from "./dialogLook";

const groupClass = "m-0 grid max-h-[32dvh] min-w-0 gap-1.5 overflow-auto border-0 p-0";
const legendClass = "mb-1 p-0 text-[13px] font-semibold text-ink-subtle";

/** Picks labels of a board and the boards to share them with; shared labels stay in sync from then on. */
export function ShareLabelsDialog({
  state,
  boardId,
  onShare,
  onClose,
}: {
  state: AppState;
  boardId: string;
  onShare: (labelIds: string[], boardIds: string[]) => void;
  onClose: () => void;
}) {
  const labels = state.labels.filter((label) => label.boardId === boardId && !label.deleted);
  const boards = state.boards.filter((board) => board.id !== boardId && board.id !== inboxBoardId && !board.deletedAt);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [boardIds, setBoardIds] = useState<string[]>([]);
  const liveBoards = new Set(boards.map((board) => board.id));
  const sharedWith = (linkId?: string) =>
    linkId
      ? state.labels.filter((item) => item.linkId === linkId && !item.deleted && liveBoards.has(item.boardId)).length
      : 0;
  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  const selectAll = (all: string[], chosen: string[], set: (ids: string[]) => void) => (
    <label className={`${optionLabelClass} font-normal`}>
      <Checkbox checked={chosen.length === all.length} onChange={(event) => set(event.target.checked ? all : [])} />
      {t("labelSharing.selectAll")}
    </label>
  );
  return (
    <Dialog
      label={t("labelSharing.title")}
      className="grid gap-3.5"
      onDismiss={onClose}
      onSubmit={submitWith(() => {
        if (labelIds.length && boardIds.length) onShare(labelIds, boardIds);
      })}
    >
      <h2 className="mx-0 mt-0 mb-1 text-[20px]">{t("labelSharing.title")}</h2>
      <p className="m-0 text-[13px] text-ink-muted">{t("labelSharing.hint")}</p>
      <fieldset className={groupClass}>
        <legend className={legendClass}>{t("labelSharing.labels")}</legend>
        {labels.length === 0 ? (
          <p className="m-0 text-ink-muted">{t("labelSharing.noLabels")}</p>
        ) : (
          <>
            {labels.length > 1 &&
              selectAll(
                labels.map((label) => label.id),
                labelIds,
                setLabelIds,
              )}
            {labels.map((label) => {
              const shared = sharedWith(label.linkId);
              return (
                <label className="flex cursor-pointer items-center gap-2.5" key={label.id}>
                  <Checkbox
                    checked={labelIds.includes(label.id)}
                    onChange={() => setLabelIds((current) => toggle(current, label.id))}
                  />
                  <span
                    className="flex min-h-8 min-w-12 items-center rounded-sm px-3 font-semibold wrap-anywhere"
                    style={{
                      background: label.color || "#dfe1e6",
                      color: readableTextColor(label.color || "#dfe1e6"),
                    }}
                  >
                    {label.name}
                  </span>
                  {shared > 0 && (
                    <small className="text-ink-muted">{t("labelSharing.sharedWith", { count: shared })}</small>
                  )}
                </label>
              );
            })}
          </>
        )}
      </fieldset>
      <fieldset className={groupClass}>
        <legend className={legendClass}>{t("labelSharing.boards")}</legend>
        {boards.length === 0 ? (
          <p className="m-0 text-ink-muted">{t("labelSharing.noBoards")}</p>
        ) : (
          <>
            {boards.length > 1 &&
              selectAll(
                boards.map((board) => board.id),
                boardIds,
                setBoardIds,
              )}
            {boards.map((board) => (
              <label className={`${optionLabelClass} font-normal`} key={board.id}>
                <Checkbox
                  checked={boardIds.includes(board.id)}
                  onChange={() => setBoardIds((current) => toggle(current, board.id))}
                />
                <span className="min-w-0 wrap-anywhere">
                  {board.name}{" "}
                  <small className="text-ink-muted">
                    {state.workspaces.find((workspace) => workspace.id === board.workspaceId)?.name}
                  </small>
                </span>
              </label>
            ))}
          </>
        )}
      </fieldset>
      <div className="mt-1 flex justify-end gap-2">
        <Button variant="secondary" size="lg" type="button" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" type="submit" disabled={!labelIds.length || !boardIds.length}>
          {t("labelSharing.share")}
        </Button>
      </div>
    </Dialog>
  );
}
