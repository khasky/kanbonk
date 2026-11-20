import { useEffect, useState, type DragEvent as ReactDragEvent } from "react";
import { moveChecklistItem, newId, type Card, type Checklist } from "../model";

export function ChecklistSection({
  checklist,
  card,
  onChange,
  onRemoveDependency,
  onConvertItem,
}: {
  checklist: Checklist;
  card: Card;
  onChange: (change: (card: Card) => Card) => void;
  onRemoveDependency: (dependentId: string, prerequisiteId: string) => void;
  onConvertItem: (itemId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [hideChecked, setHideChecked] = useState(false);
  const [titleDraft, setTitleDraft] = useState(checklist.name);
  const [itemNames, setItemNames] = useState<Record<string, string>>({});
  useEffect(() => setTitleDraft(checklist.name), [checklist.name]);
  const checked = checklist.items.filter((item) => item.checked).length;

  function updateList(change: (list: Checklist) => Checklist) {
    onChange((current) => ({
      ...current,
      checklists: current.checklists.map((list) => (list.id === checklist.id ? change(list) : list)),
    }));
  }

  function addItem() {
    const names = draft
      .split(/\r\n|\r|\n/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (!names.length) return;
    updateList((list) => ({
      ...list,
      items: [...list.items, ...names.map((name) => ({ id: newId(), name, checked: false }))],
    }));
    setDraft("");
  }

  function saveItemName(itemId: string, currentName: string) {
    const name = (itemNames[itemId] ?? currentName).trim();
    if (name && name !== currentName)
      updateList((list) => ({
        ...list,
        items: list.items.map((item) => (item.id === itemId ? { ...item, name } : item)),
      }));
    setItemNames((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }

  function itemAction(itemId: string, action: string) {
    const index = checklist.items.findIndex((item) => item.id === itemId);
    if (action === "delete") {
      const linkedCardId = checklist.items[index]?.linkedCardId;
      if (linkedCardId) onRemoveDependency(card.id, linkedCardId);
      else updateList((list) => ({ ...list, items: list.items.filter((item) => item.id !== itemId) }));
    } else if (action === "convert") onConvertItem(itemId);
    else if (action === "up" && index > 0)
      onChange((current) => moveChecklistItem(current, itemId, checklist.id, checklist.items[index - 1].id));
    else if (action === "down" && index >= 0 && index < checklist.items.length - 1)
      onChange((current) => moveChecklistItem(current, itemId, checklist.id, checklist.items[index + 2]?.id));
    else if (action.startsWith("to:")) onChange((current) => moveChecklistItem(current, itemId, action.slice(3)));
  }

  function deleteChecklist() {
    for (const linkedCardId of new Set(
      checklist.items.flatMap((item) => (item.linkedCardId ? [item.linkedCardId] : [])),
    ))
      onRemoveDependency(card.id, linkedCardId);
    onChange((current) => ({ ...current, checklists: current.checklists.filter((list) => list.id !== checklist.id) }));
  }

  function dropItem(event: ReactDragEvent, beforeItemId?: string) {
    const id = event.dataTransfer.getData("text/kanbonk-check-item");
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    onChange((current) => moveChecklistItem(current, id, checklist.id, beforeItemId));
  }

  return (
    <section
      className="detail-section"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => dropItem(event)}
    >
      <div className="section-title">
        <h3>
          ☑{" "}
          <input
            className="checklist-title"
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={() => {
              const name = titleDraft.trim();
              if (name && name !== checklist.name) updateList((list) => ({ ...list, name }));
              else setTitleDraft(checklist.name);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-label="Checklist title"
          />
        </h3>
        <button onClick={() => setHideChecked((value) => !value)} aria-pressed={hideChecked}>
          {hideChecked ? "Show checked items" : "Hide checked items"}
        </button>
        <select
          className="checklist-actions"
          aria-label={`Checklist actions ${checklist.name}`}
          defaultValue=""
          onChange={(event) => {
            if (event.target.value === "delete") deleteChecklist();
            event.target.value = "";
          }}
        >
          <option value="">⋯</option>
          <option value="delete">Delete checklist</option>
        </select>
      </div>
      <div className="checklist-progress">
        {checklist.items.length ? Math.round((100 * checked) / checklist.items.length) : 0}%
        <div>
          <span style={{ width: `${checklist.items.length ? (100 * checked) / checklist.items.length : 0}%` }} />
        </div>
      </div>
      {checklist.items
        .filter((item) => !hideChecked || !item.checked)
        .map((item) => (
          <div
            className="checklist-item-row"
            key={item.id}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDrop={(event) => dropItem(event, item.id)}
          >
            <span
              className="checklist-drag-handle"
              draggable
              title="Drag item"
              onDragStart={(event) => event.dataTransfer.setData("text/kanbonk-check-item", item.id)}
            >
              ⋮⋮
            </span>
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() =>
                updateList((list) => ({
                  ...list,
                  items: list.items.map((entry) =>
                    entry.id === item.id ? { ...entry, checked: !entry.checked } : entry,
                  ),
                }))
              }
              aria-label={`Check item ${item.name}`}
            />
            <input
              className={item.checked ? "checklist-item-name checked" : "checklist-item-name"}
              value={itemNames[item.id] ?? item.name}
              onChange={(event) => setItemNames((current) => ({ ...current, [item.id]: event.target.value }))}
              onBlur={() => saveItemName(item.id, item.name)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              aria-label={`Item title ${item.name}`}
            />
            <select
              aria-label={`Item actions ${item.name}`}
              defaultValue=""
              onChange={(event) => {
                itemAction(item.id, event.target.value);
                event.target.value = "";
              }}
            >
              <option value="">⋯</option>
              <option value="up">Move up</option>
              <option value="down">Move down</option>
              {card.checklists
                .filter((list) => list.id !== checklist.id)
                .map((list) => (
                  <option key={list.id} value={`to:${list.id}`}>
                    To checklist “{list.name}”
                  </option>
                ))}
              <option value="convert" disabled={Boolean(item.linkedCardId)}>
                Convert to card
              </option>
              <option value="delete">Delete item</option>
            </select>
          </div>
        ))}
      <div className="inline-form">
        <textarea
          className="checklist-new-items"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              addItem();
            }
          }}
          placeholder="Add an item"
          aria-label="New checklist items"
        />
        <button onClick={addItem}>Add</button>
      </div>
    </section>
  );
}
