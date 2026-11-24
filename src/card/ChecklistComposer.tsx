import { useState } from "react";
import { type AppState, type Card, isCardAvailable, newId } from "../model";
import { t } from "../i18n";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Field";
import { pickerBoxClass, pickerLabelClass } from "./cardLook";

/** Adds a checklist to the card, optionally copying the items of another checklist on the board. */
export function ChecklistComposer({
  card,
  state,
  onChange,
  onClose,
}: {
  card: Card;
  state: AppState;
  onChange: (change: (card: Card) => Card) => void;
  onClose: () => void;
}) {
  const [checklistName, setChecklistName] = useState(() => t("card.checklist"));
  const [copyChecklistId, setCopyChecklistId] = useState("");
  const availableChecklists = state.cards
    .filter((item) => item.boardId === card.boardId && isCardAvailable(state, item))
    .flatMap((item) => item.checklists.map((checklist) => ({ checklist, cardName: item.name })));
  function addChecklist() {
    const source = availableChecklists.find(({ checklist }) => checklist.id === copyChecklistId)?.checklist;
    const name = checklistName.trim() || source?.name || t("card.checklist");
    onChange((item) => ({
      ...item,
      checklists: [
        ...item.checklists,
        { id: newId(), name, items: source?.items.map((entry) => ({ ...entry, id: newId() })) ?? [] },
      ],
    }));
    onClose();
    setChecklistName(t("card.checklist"));
    setCopyChecklistId("");
  }
  return (
    <section className={pickerBoxClass} aria-label={t("card.newChecklist")}>
      <label className={pickerLabelClass}>
        {t("card.title")}
        <Input
          size="sm"
          className="w-full min-w-0"
          value={checklistName}
          onChange={(event) => setChecklistName(event.target.value)}
          aria-label={t("card.newChecklistTitle")}
        />
      </label>
      <label className={pickerLabelClass}>
        {t("card.copyItemsFrom")}
        <Select
          size="sm"
          className="w-full min-w-0"
          value={copyChecklistId}
          onChange={(event) => {
            setCopyChecklistId(event.target.value);
            const source = availableChecklists.find(({ checklist }) => checklist.id === event.target.value)?.checklist;
            if (source && checklistName === t("card.checklist")) setChecklistName(source.name);
          }}
          aria-label={t("card.copyItemsFrom")}
        >
          <option value="">{t("card.dontCopy")}</option>
          {availableChecklists.map(({ checklist, cardName }) => (
            <option key={checklist.id} value={checklist.id}>
              {cardName} / {checklist.name}
            </option>
          ))}
        </Select>
      </label>
      <Button variant="primary" onClick={addChecklist}>
        {t("card.addChecklist")}
      </Button>
    </section>
  );
}
