import { useState } from "react";
import type { AppState, Card } from "../model";
import { t } from "../i18n";
import { Button } from "../ui/Button";
import { Select } from "../ui/Field";
import { pickerBoxClass, pickerLabelClass, pickerRowClass } from "./cardLook";

/** Moves or copies the card to the top or bottom of a list on any open board. */
export function TransferPicker({
  card,
  state,
  onTransfer,
}: {
  card: Card;
  state: AppState;
  onTransfer: (targetListId: string, copy: boolean, top: boolean) => void;
}) {
  const [destinationBoardId, setDestinationBoardId] = useState(card.boardId);
  const [destinationListId, setDestinationListId] = useState(card.listId);
  const [top, setTop] = useState(false);
  const availableBoards = state.boards.filter(
    (item) => !item.deletedAt && state.lists.some((list) => list.boardId === item.id && !list.deletedAt),
  );
  const destinationLists = state.lists
    .filter((item) => item.boardId === destinationBoardId && !item.deletedAt)
    .sort((a, b) => a.position - b.position);
  return (
    <section className={pickerBoxClass} aria-label={t("card.moveOrCopyCard")}>
      <label className={pickerLabelClass}>
        {t("card.board")}
        <Select
          size="sm"
          className="w-full min-w-0"
          value={destinationBoardId}
          onChange={(event) => {
            const id = event.target.value;
            setDestinationBoardId(id);
            setDestinationListId(
              state.lists
                .filter((item) => item.boardId === id && !item.deletedAt)
                .sort((a, b) => a.position - b.position)[0]?.id ?? "",
            );
          }}
        >
          {availableBoards.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </label>
      <label className={pickerLabelClass}>
        {t("card.list")}
        <Select
          size="sm"
          className="w-full min-w-0"
          value={destinationListId}
          onChange={(event) => setDestinationListId(event.target.value)}
        >
          {destinationLists.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </label>
      <label className={pickerLabelClass}>
        {t("card.position")}
        <Select
          size="sm"
          className="w-full min-w-0"
          value={top ? "top" : "bottom"}
          onChange={(event) => setTop(event.target.value === "top")}
        >
          <option value="top">{t("card.veryTop")}</option>
          <option value="bottom">{t("card.veryBottom")}</option>
        </Select>
      </label>
      <div className={pickerRowClass}>
        <Button
          variant="primary"
          className="flex-1"
          onClick={() => onTransfer(destinationListId, false, top)}
          disabled={!destinationListId}
        >
          {t("common.move")}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          onClick={() => onTransfer(destinationListId, true, top)}
          disabled={!destinationListId}
        >
          {t("common.copy")}
        </Button>
      </div>
    </section>
  );
}
