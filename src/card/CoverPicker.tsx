import { ColorInput } from "../ui/ColorInput";
import type { Card } from "../model";

const coverColors = [
  "#4bce97",
  "#f5cd47",
  "#fea362",
  "#f87168",
  "#9f8fef",
  "#579dff",
  "#6cc3e0",
  "#94c748",
  "#e774bb",
  "#626f86",
];

export function CoverPicker({
  card,
  onChange,
  onClose,
}: {
  card: Card;
  onChange: (change: (card: Card) => Card) => void;
  onClose: () => void;
}) {
  const images = card.attachments.filter((item) => item.status === "local" && item.mimeType.startsWith("image/"));
  return (
    <div className="cover-picker">
      <div className="section-title">
        <strong>Cover</strong>
        <button onClick={onClose}>Close</button>
      </div>
      <div className="cover-colors">
        {coverColors.map((color) => (
          <button
            key={color}
            style={{ background: color }}
            aria-label={`Cover ${color}`}
            aria-pressed={card.cover?.color === color}
            onClick={() => onChange((item) => ({ ...item, cover: { color, size: item.cover?.size ?? "normal" } }))}
          />
        ))}
        <label className="custom-color" title="Custom color">
          <ColorInput
            value={card.cover?.color ?? "#579dff"}
            label="Custom cover color"
            onCommit={(color) =>
              onChange((item) => ({ ...item, cover: { color, size: item.cover?.size ?? "normal" } }))
            }
          />
        </label>
      </div>
      <button
        onClick={() =>
          onChange((item) => ({ ...item, cover: { color: item.cover?.color ?? "#579dff", size: "full" } }))
        }
        aria-pressed={card.cover?.size === "full" && Boolean(card.cover.color)}
      >
        Color the whole card
      </button>
      {images.length > 0 && (
        <div className="cover-files">
          {images.map((image) => (
            <button
              key={image.id}
              aria-pressed={card.cover?.attachmentId === image.id}
              onClick={() =>
                onChange((item) => ({ ...item, cover: { attachmentId: image.id, size: item.cover?.size ?? "normal" } }))
              }
            >
              {image.name}
            </button>
          ))}
        </div>
      )}
      <label>
        Size{" "}
        <select
          value={card.cover?.size ?? "normal"}
          disabled={!card.cover}
          onChange={(event) =>
            onChange((item) => ({
              ...item,
              cover: item.cover ? { ...item.cover, size: event.target.value as "normal" | "full" } : undefined,
            }))
          }
        >
          <option value="normal">Normal</option>
          <option value="full">Full card</option>
        </select>
      </label>
      <button onClick={() => onChange((item) => ({ ...item, cover: undefined }))} disabled={!card.cover}>
        Remove cover
      </button>
    </div>
  );
}
