import { useState } from "react";
import type { Board } from "../model";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Field";
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
      closeLabel="Close board description"
      onClose={onClose}
    >
      <p className="text-ink-muted">{board.name}</p>
      <label className="grid gap-2 font-bold">
        Description
        <Textarea
          className="min-h-[220px] w-full"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Add a board description…"
        />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="lg" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => onSave(description)} disabled={description === board.description}>
          Save
        </Button>
      </div>
    </SidePanel>
  );
}
