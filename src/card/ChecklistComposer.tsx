import { useState } from "react";
import { type AppState, type Card, isCardAvailable, newId } from "../model";

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
    <section className="transfer-picker checklist-composer" aria-label="New checklist">
      <strong>New checklist</strong>
      <label>
        Title
        <input
          value={checklistName}
          onChange={(event) => setChecklistName(event.target.value)}
          aria-label="New checklist title"
        />
      </label>
      <label>
        Copy items from
        <select
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
        </select>
      </label>
      <div>
        <button className="primary-button" onClick={addChecklist}>
          Add checklist
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </section>
  );
}
