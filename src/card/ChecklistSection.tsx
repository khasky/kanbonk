import { askConfirm } from "../ui/AskDialog";
import { useEffect, useState, type DragEvent as ReactDragEvent } from "react";
import { moveChecklistItem, newId, type Card, type Checklist } from "../model";
import { Button } from "../ui/Button";
import { SectionTitle } from "../ui/SectionTitle";
import { Checkbox, Textarea } from "../ui/Field";
import { Menu, MenuItem } from "../ui/Menu";
import { detailSectionClass, inlineFormClass } from "./cardLook";
import { t } from "../i18n";
import { Icon } from "../ui/Icon";

/** The "⋯" button of a checklist's and an item's menu. */
const menuButtonClass =
  "grid size-7 place-items-center rounded-sm text-[18px] leading-none text-ink-subtle hover:bg-surface-sunken group-open/menu:bg-surface-sunken max-phone:min-h-11 max-phone:min-w-11";

const itemNameClass =
  "min-w-0 flex-1 border-0 bg-transparent p-[5px] focus:rounded-sm focus:border focus:border-line focus:bg-white";

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
    } else if (action === "convert") {
      const name = checklist.items[index]?.name.trim();
      if (!name) return;
      void askConfirm({
        title: t("card.convertItemTitle", { name }),
        message: t("card.convertItemMessage"),
        confirm: t("card.convert"),
      }).then((confirmed) => {
        if (confirmed) onConvertItem(itemId);
      });
    } else if (action === "up" && index > 0)
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
      className={detailSectionClass}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => dropItem(event)}
    >
      <SectionTitle>
        <h3 className="m-0 mr-auto -ml-9 flex min-h-8 min-w-0 items-center gap-3 text-[16px] font-semibold">
          <span className="grid size-6 flex-none place-items-center text-ink-subtle">
            <Icon name="check-square" />
          </span>
          <input
            className="w-[min(240px,35vw)] min-w-0 border-0 bg-transparent p-0.5 text-inherit focus:bg-white"
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
            aria-label={t("card.checklistTitle")}
          />
        </h3>
        <Button variant="secondary" onClick={() => setHideChecked((value) => !value)} aria-pressed={hideChecked}>
          {hideChecked ? t("card.showCheckedItems") : t("card.hideCheckedItems")}
        </Button>
        <Menu label={t("card.checklistActions", { name: checklist.name })} summaryClassName={menuButtonClass}>
          <MenuItem danger onClick={deleteChecklist}>
            {t("card.deleteChecklist")}
          </MenuItem>
        </Menu>
      </SectionTitle>
      <div className="flex items-center gap-[9px] text-[12px]">
        {checklist.items.length ? Math.round((100 * checked) / checklist.items.length) : 0}%
        <div className="h-2 flex-1 overflow-hidden rounded-[5px] bg-line">
          <span
            className="block h-full bg-[#4bce97]"
            style={{ width: `${checklist.items.length ? (100 * checked) / checklist.items.length : 0}%` }}
          />
        </div>
      </div>
      {checklist.items
        .filter((item) => !hideChecked || !item.checked)
        .map((item) => (
          <div
            className="flex items-center gap-2 py-[5px]"
            key={item.id}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDrop={(event) => dropItem(event, item.id)}
          >
            <span
              className="flex-none cursor-grab text-ink-muted select-none"
              draggable
              title={t("card.dragItem")}
              onDragStart={(event) => event.dataTransfer.setData("text/kanbonk-check-item", item.id)}
            >
              ⋮⋮
            </span>
            <Checkbox
              checked={item.checked}
              onChange={() =>
                updateList((list) => ({
                  ...list,
                  items: list.items.map((entry) =>
                    entry.id === item.id ? { ...entry, checked: !entry.checked } : entry,
                  ),
                }))
              }
              aria-label={t("card.checkItem", { name: item.name })}
            />
            <input
              className={item.checked ? `${itemNameClass} text-ink-muted line-through` : `${itemNameClass} text-ink`}
              value={itemNames[item.id] ?? item.name}
              onChange={(event) => setItemNames((current) => ({ ...current, [item.id]: event.target.value }))}
              onBlur={() => saveItemName(item.id, item.name)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              aria-label={t("card.itemTitle", { name: item.name })}
            />
            <Menu label={t("card.itemActions", { name: item.name })} summaryClassName={menuButtonClass}>
              <MenuItem onClick={() => itemAction(item.id, "up")}>{t("card.moveUp")}</MenuItem>
              <MenuItem onClick={() => itemAction(item.id, "down")}>{t("card.moveDown")}</MenuItem>
              {card.checklists
                .filter((list) => list.id !== checklist.id)
                .map((list) => (
                  <MenuItem key={list.id} onClick={() => itemAction(item.id, `to:${list.id}`)}>
                    {t("card.toChecklist", { name: list.name })}
                  </MenuItem>
                ))}
              <MenuItem disabled={Boolean(item.linkedCardId)} onClick={() => itemAction(item.id, "convert")}>
                {t("card.convertToCard")}
              </MenuItem>
              <MenuItem danger onClick={() => itemAction(item.id, "delete")}>
                {t("card.deleteItem")}
              </MenuItem>
            </Menu>
          </div>
        ))}
      <div className={inlineFormClass}>
        <Textarea
          size="sm"
          className="min-h-[38px] min-w-0 flex-1"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              addItem();
            }
          }}
          placeholder={t("card.addItem")}
          aria-label={t("card.newChecklistItems")}
        />
        <Button variant="secondary" onClick={addItem}>
          {t("common.add")}
        </Button>
      </div>
    </section>
  );
}
