import { askConfirm } from "../ui/AskDialog";
import { useState } from "react";
import { labelColorOptions, readableTextColor } from "../model/labelColors";
import type { Card, Label } from "../model";
import { t } from "../i18n";
import { Button } from "../ui/Button";
import { Checkbox, Input } from "../ui/Field";
import { Icon } from "../ui/Icon";

/** The label and member pickers; `label-picker` is a hook for tests. */
export const labelPickerClass = "label-picker flex flex-col gap-1.5";

const colorFieldClass = "h-8 w-[42px] min-w-0 flex-none self-center rounded-sm border border-ink-faint bg-white p-0.5";
const groupTitleClass = "mt-1.5 mb-0.5 text-[12px] font-semibold text-ink-subtle";

/** Toggles the board's labels on the card, and creates, edits and deletes labels. */
export function LabelPicker({
  card,
  boardLabels,
  onChange,
  onAddLabel,
  onEditLabel,
  onDeleteLabel,
}: {
  card: Card;
  boardLabels: Label[];
  onChange: (change: (card: Card) => Card) => void;
  onAddLabel: (name: string, color: string) => void;
  onEditLabel: (id: string, name: string, color: string) => void;
  onDeleteLabel: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState("#4bce97");
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelName, setEditingLabelName] = useState("");
  const [editingLabelColor, setEditingLabelColor] = useState("#4bce97");
  const query = search.trim().toLocaleLowerCase();
  const shown = boardLabels.filter((label) => label.name.toLocaleLowerCase().includes(query));
  return (
    <div className={labelPickerClass}>
      {boardLabels.length > 0 && (
        <Input
          size="sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("card.searchLabelsPlaceholder")}
          aria-label={t("card.searchLabels")}
        />
      )}
      {shown.length > 0 && <div className={groupTitleClass}>{t("card.labels")}</div>}
      {shown.map((label) => (
        <div className="flex items-center gap-2" key={label.id}>
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
            <Checkbox
              checked={card.labelIds.includes(label.id)}
              onChange={() =>
                onChange((item) => ({
                  ...item,
                  labelIds: item.labelIds.includes(label.id)
                    ? item.labelIds.filter((id) => id !== label.id)
                    : [...item.labelIds, label.id],
                }))
              }
            />
            <span
              className="flex min-h-8 flex-1 items-center rounded-sm px-3 font-semibold wrap-anywhere"
              style={{
                background: label.color || "#dfe1e6",
                color: readableTextColor(label.color || "#dfe1e6"),
              }}
            >
              {label.name}
            </span>
          </label>
          <Button
            variant="icon"
            type="button"
            onClick={() => {
              setEditingLabelId(label.id);
              setEditingLabelName(label.name);
              setEditingLabelColor(label.color);
            }}
            aria-label={t("card.editLabel", { name: label.name })}
          >
            <Icon name="pencil" className="size-4" />
          </Button>
        </div>
      ))}
      {editingLabelId && (
        <div className="mt-2 flex flex-wrap gap-1.5 rounded-sm bg-surface-soft p-2">
          <Input
            size="sm"
            className="min-w-0 flex-1"
            value={editingLabelName}
            onChange={(event) => setEditingLabelName(event.target.value)}
            aria-label={t("card.labelName")}
          />
          <input
            className={colorFieldClass}
            type="color"
            list="label-color-presets"
            value={editingLabelColor || "#dfe1e6"}
            onChange={(event) => setEditingLabelColor(event.target.value)}
            aria-label={t("card.editedLabelColor")}
          />
          <div className="flex w-full gap-1.5">
            <Button
              variant="primary"
              size="sm"
              disabled={!editingLabelName.trim()}
              onClick={() => {
                onEditLabel(editingLabelId, editingLabelName.trim(), editingLabelColor);
                setEditingLabelId(null);
              }}
            >
              {t("common.save")}
            </Button>
            <Button variant="secondary" onClick={() => setEditingLabelId(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              size="sm"
              className="ml-auto"
              onClick={async () => {
                if (
                  editingLabelId &&
                  (await askConfirm({
                    title: t("card.deleteLabelTitle"),
                    message: t("card.deleteLabelMessage"),
                    confirm: t("common.delete"),
                    danger: true,
                  }))
                ) {
                  onDeleteLabel(editingLabelId);
                  setEditingLabelId(null);
                }
              }}
              aria-label={t("card.deleteLabel")}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      )}
      <div className={groupTitleClass}>{t("card.newLabel")}</div>
      <div className="flex gap-1.5">
        <Input
          size="sm"
          className="min-w-0 flex-1"
          value={labelName}
          onChange={(event) => setLabelName(event.target.value)}
          placeholder={t("card.labelName")}
          aria-label={t("card.newLabel")}
        />
        <input
          className={colorFieldClass}
          type="color"
          list="label-color-presets"
          value={labelColor}
          onChange={(event) => setLabelColor(event.target.value)}
          aria-label={t("card.labelColor")}
        />
        <datalist id="label-color-presets">
          {labelColorOptions
            .filter(({ color }) => color)
            .map(({ color }) => (
              <option key={color} value={color} />
            ))}
        </datalist>
        <Button
          variant="secondary"
          onClick={() => {
            if (labelName.trim()) {
              onAddLabel(labelName.trim(), labelColor);
              setLabelName("");
            }
          }}
        >
          {t("common.add")}
        </Button>
      </div>
    </div>
  );
}

/** The card's labels as colored chips, for a row of the card's details. */
export function CardLabelChips({ card, boardLabels }: { card: Card; boardLabels: Label[] }) {
  return card.labelIds.map((id) => {
    const label = boardLabels.find((item) => item.id === id);
    return (
      label && (
        <span
          className="flex h-8 min-w-12 items-center rounded-sm px-3 font-semibold"
          key={id}
          style={{
            background: label.color || "#dfe1e6",
            color: readableTextColor(label.color || "#dfe1e6"),
          }}
        >
          {label.name}
        </span>
      )
    );
  });
}
