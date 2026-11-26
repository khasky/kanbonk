import { useState } from "react";
import { BoardSelect, moveLabelClass, moveSelectClass } from "../card/MovePicker";
import { t } from "../i18n";
import type { AppState, BoardList } from "../model";
import { inboxBoardId } from "../model/inbox";
import { Button } from "../ui/Button";
import { Select } from "../ui/Field";

/** Trello's "Move list": a board, this one or another, and the very start or end of it. */
export function ListMovePicker({
  list,
  state,
  onMove,
}: {
  list: BoardList;
  state: AppState;
  onMove: (boardId: string, atStart: boolean) => void;
}) {
  const boards = state.boards.filter((item) => item.id !== inboxBoardId && !item.deletedAt);
  const [boardId, setBoardId] = useState(list.boardId);
  const [atStart, setAtStart] = useState(false);
  return (
    <div className="grid gap-4">
      <label className={moveLabelClass}>
        {t("card.board")}
        <BoardSelect
          state={state}
          boards={boards}
          currentBoardId={list.boardId}
          value={boardId}
          onChange={setBoardId}
        />
      </label>
      <label className={moveLabelClass}>
        {t("card.position")}
        <Select
          className={moveSelectClass}
          value={atStart ? "start" : "end"}
          onChange={(event) => setAtStart(event.target.value === "start")}
        >
          <option value="start">{t("board.veryStart")}</option>
          <option value="end">{t("board.veryEnd")}</option>
        </Select>
      </label>
      <Button variant="primary" onClick={() => onMove(boardId, atStart)}>
        {t("common.move")}
      </Button>
    </div>
  );
}
