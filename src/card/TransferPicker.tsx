import { useState } from "react";
import type { AppState, Card } from "../model";

/** Moves or copies the card to a list on any open board. */
export function TransferPicker({
  open,
  card,
  state,
  onTransfer,
}: {
  open: boolean;
  card: Card;
  state: AppState;
  onTransfer: (targetListId: string, copy: boolean) => void;
}) {
  const [destinationBoardId, setDestinationBoardId] = useState(card.boardId);
  const [destinationListId, setDestinationListId] = useState(card.listId);
  if (!open) return null;
  const availableBoards = state.boards.filter(
    (item) => !item.deletedAt && state.lists.some((list) => list.boardId === item.id && !list.deletedAt),
  );
  const destinationLists = state.lists
    .filter((item) => item.boardId === destinationBoardId && !item.deletedAt)
    .sort((a, b) => a.position - b.position);
  return (
    <section className="transfer-picker" aria-label="Move or copy card">
      <strong>Choose a destination</strong>
      <label>
        Board
        <select
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
        </select>
      </label>
      <label>
        List
        <select value={destinationListId} onChange={(event) => setDestinationListId(event.target.value)}>
          {destinationLists.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <div>
        <button onClick={() => onTransfer(destinationListId, false)} disabled={!destinationListId}>
          Move
        </button>
        <button onClick={() => onTransfer(destinationListId, true)} disabled={!destinationListId}>
          Copy
        </button>
      </div>
    </section>
  );
}
