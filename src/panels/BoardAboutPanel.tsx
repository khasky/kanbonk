import { useState } from "react";
import type { Board } from "../model";
import { SidePanel } from "../ui/Modal";

export function BoardAboutPanel({
  board,
  onSave,
  onClose,
}: {
  board: Board;
  onSave: (description: string) => void;
  onClose: () => void;
}) {
  const [description, setDescription] = useState(board.description);
  return (
    <SidePanel
      title="About this board"
      label="Board description"
      className="board-about"
      closeLabel="Close board description"
      onClose={onClose}
    >
      <p>{board.name}</p>
      <label>
        Description
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Add a board description…"
        />
      </label>
      <div className="panel-actions">
        <button onClick={onClose}>Cancel</button>
        <button
          className="primary-button"
          onClick={() => onSave(description)}
          disabled={description === board.description}
        >
          Save
        </button>
      </div>
    </SidePanel>
  );
}
