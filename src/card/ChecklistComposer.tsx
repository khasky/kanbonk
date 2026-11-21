import { useState } from "react";
import { type AppState, type Card, isCardAvailable, newId } from "../model";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Field";
import { pickerBoxClass, pickerLabelClass, pickerRowClass } from "./cardLook";

/** Adds a checklist to the card, optionally copying the items of another checklist on the board. */
export function ChecklistComposer({
  open,
  card,
  state,
  onChange,
  onClose,
}: {
  open: boolean;
  card: Card;
  state: AppState;
  onChange: (change: (card: Card) => Card) => void;
  onClose: () => void;
}) {
  const [checklistName, setChecklistName] = useState("Checklist");
  const [copyChecklistId, setCopyChecklistId] = useState("");
  if (!open) return null;
  const availableChecklists = state.cards
    .filter((item) => item.boardId === card.boardId && isCardAvailable(state, item))
    .flatMap((item) => item.checklists.map((checklist) => ({ checklist, cardName: item.name })));
  function addChecklist() {
    const source = availableChecklists.find(({ checklist }) => checklist.id === copyChecklistId)?.checklist;
    const name = checklistName.trim() || source?.name || "Checklist";
    onChange((item) => ({
      ...item,
      checklists: [
        ...item.checklists,
        { id: newId(), name, items: source?.items.map((entry) => ({ ...entry, id: newId() })) ?? [] },
      ],
    }));
    onClose();
    setChecklistName("Checklist");
    setCopyChecklistId("");
  }
  return (
    <section className={pickerBoxClass} aria-label="New checklist">
      <strong>New checklist</strong>
      <label className={pickerLabelClass}>
        Title
        <Input
          size="sm"
          className="w-[70%] min-w-0"
          value={checklistName}
          onChange={(event) => setChecklistName(event.target.value)}
          aria-label="New checklist title"
        />
      </label>
      <label className={pickerLabelClass}>
        Copy items from
        <Select
          size="sm"
          className="w-[70%] min-w-0"
          value={copyChecklistId}
          onChange={(event) => {
            setCopyChecklistId(event.target.value);
            const source = availableChecklists.find(({ checklist }) => checklist.id === event.target.value)?.checklist;
            if (source && checklistName === "Checklist") setChecklistName(source.name);
          }}
          aria-label="Copy items from"
        >
          <option value="">Don't copy</option>
          {availableChecklists.map(({ checklist, cardName }) => (
            <option key={checklist.id} value={checklist.id}>
              {cardName} / {checklist.name}
            </option>
          ))}
        </Select>
      </label>
      <div className={pickerRowClass}>
        <Button variant="primary" onClick={addChecklist}>
          Add checklist
        </Button>
        <Button variant="secondary" size="lg" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
