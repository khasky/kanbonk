import { useState } from "react";
import { labelColorOptions, readableTextColor } from "../model/labelColors";
import type { Card, Label } from "../model";
import { Button } from "../ui/Button";
import { Checkbox, Input } from "../ui/Field";
import { inlineFormClass } from "./cardLook";

/** The box of the label and member pickers; `label-picker` is a hook for tests. */
export const labelPickerClass =
  "label-picker mb-[15px] ml-[34px] flex flex-col gap-1.5 rounded-md border border-line p-3 max-phone:ml-0";

const colorFieldClass = "h-8 w-[42px] min-w-0 flex-none self-center rounded-sm border border-ink-faint bg-white p-0.5";

/** Toggles the board's labels on the card, and creates, edits and deletes labels. */
export function LabelPicker({
  open,
  card,
  boardLabels,
  onChange,
  onAddLabel,
  onEditLabel,
  onDeleteLabel,
}: {
  open: boolean;
  card: Card;
  boardLabels: Label[];
  onChange: (change: (card: Card) => Card) => void;
  onAddLabel: (name: string, color: string) => void;
  onEditLabel: (id: string, name: string, color: string) => void;
  onDeleteLabel: (id: string) => void;
}) {
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState("#4bce97");
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelName, setEditingLabelName] = useState("");
  const [editingLabelColor, setEditingLabelColor] = useState("#4bce97");
  if (!open) return null;
  return (
    <div className={labelPickerClass}>
      <strong>Labels</strong>
      {boardLabels.map((label) => (
        <div className="flex items-center gap-2" key={label.id}>
          <label className="flex min-w-0 flex-1 items-center gap-2">
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
              className="flex-1 rounded-sm px-2.5 py-[7px]"
              style={{
                background: label.color || "#dfe1e6",
                color: readableTextColor(label.color || "#dfe1e6"),
              }}
            >
              {label.name}
            </span>
          </label>
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setEditingLabelId(label.id);
              setEditingLabelName(label.name);
              setEditingLabelColor(label.color);
            }}
            aria-label={`Edit label ${label.name}`}
          >
            Edit
          </Button>
        </div>
      ))}
      {editingLabelId && (
        <div className={inlineFormClass}>
          <Input
            size="sm"
            className="min-w-0 flex-1"
            value={editingLabelName}
            onChange={(event) => setEditingLabelName(event.target.value)}
            aria-label="Label name"
          />
          <input
            className={colorFieldClass}
            type="color"
            list="label-color-presets"
            value={editingLabelColor || "#dfe1e6"}
            onChange={(event) => setEditingLabelColor(event.target.value)}
            aria-label="Edited label color"
          />
          <Button
            variant="secondary"
            disabled={!editingLabelName.trim()}
            onClick={() => {
              onEditLabel(editingLabelId, editingLabelName.trim(), editingLabelColor);
              setEditingLabelId(null);
            }}
          >
            Save
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (editingLabelId && confirm("Remove this label from all cards?")) {
                onDeleteLabel(editingLabelId);
                setEditingLabelId(null);
              }
            }}
            aria-label="Delete label"
          >
            Delete
          </Button>
          <Button variant="secondary" onClick={() => setEditingLabelId(null)}>
            Cancel
          </Button>
        </div>
      )}
      <div className={inlineFormClass}>
        <Input
          size="sm"
          className="min-w-0 flex-1"
          value={labelName}
          onChange={(event) => setLabelName(event.target.value)}
          placeholder="New label"
          aria-label="New label"
        />
        <input
          className={colorFieldClass}
          type="color"
          list="label-color-presets"
          value={labelColor}
          onChange={(event) => setLabelColor(event.target.value)}
          aria-label="Label color"
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
          Add
        </Button>
      </div>
    </div>
  );
}

/** The card's labels as colored chips. */
export function CardLabelChips({ card, boardLabels }: { card: Card; boardLabels: Label[] }) {
  if (!card.labelIds.length) return null;
  return (
    <div className="ml-[34px] flex flex-wrap gap-1">
      {card.labelIds.map((id) => {
        const label = boardLabels.find((item) => item.id === id);
        return (
          label && (
            <span
              className="min-w-10 rounded-[3px] px-2 py-0.5 text-[11px] font-bold"
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
      })}
    </div>
  );
}
