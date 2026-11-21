import { useState } from "react";
import { labelColorOptions, readableTextColor } from "../model/labelColors";
import type { Card, Label } from "../model";

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
    <div className="label-picker">
      <strong>Labels</strong>
      {boardLabels.map((label) => (
        <div className="label-row" key={label.id}>
          <label>
            <input
              type="checkbox"
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
              style={{
                background: label.color || "#dfe1e6",
                color: readableTextColor(label.color || "#dfe1e6"),
              }}
            >
              {label.name}
            </span>
          </label>
          <button
            type="button"
            onClick={() => {
              setEditingLabelId(label.id);
              setEditingLabelName(label.name);
              setEditingLabelColor(label.color);
            }}
            aria-label={`Edit label ${label.name}`}
          >
            Edit
          </button>
        </div>
      ))}
      {editingLabelId && (
        <div className="inline-form">
          <input
            value={editingLabelName}
            onChange={(event) => setEditingLabelName(event.target.value)}
            aria-label="Label name"
          />
          <input
            type="color"
            list="label-color-presets"
            value={editingLabelColor || "#dfe1e6"}
            onChange={(event) => setEditingLabelColor(event.target.value)}
            aria-label="Edited label color"
          />
          <button
            disabled={!editingLabelName.trim()}
            onClick={() => {
              onEditLabel(editingLabelId, editingLabelName.trim(), editingLabelColor);
              setEditingLabelId(null);
            }}
          >
            Save
          </button>
          <button
            onClick={() => {
              if (editingLabelId && confirm("Remove this label from all cards?")) {
                onDeleteLabel(editingLabelId);
                setEditingLabelId(null);
              }
            }}
            aria-label="Delete label"
          >
            Delete
          </button>
          <button onClick={() => setEditingLabelId(null)}>Cancel</button>
        </div>
      )}
      <div className="inline-form">
        <input
          value={labelName}
          onChange={(event) => setLabelName(event.target.value)}
          placeholder="New label"
          aria-label="New label"
        />
        <input
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
        <button
          onClick={() => {
            if (labelName.trim()) {
              onAddLabel(labelName.trim(), labelColor);
              setLabelName("");
            }
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

/** The card's labels as colored chips. */
export function CardLabelChips({ card, boardLabels }: { card: Card; boardLabels: Label[] }) {
  if (!card.labelIds.length) return null;
  return (
    <div className="detail-labels">
      {card.labelIds.map((id) => {
        const label = boardLabels.find((item) => item.id === id);
        return (
          label && (
            <span
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
