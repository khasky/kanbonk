import { ColorInput } from "../ui/ColorInput";
import type { Card } from "../model";
import { Button } from "../ui/Button";
import { Select } from "../ui/Field";

const pressedClass = "aria-pressed:outline-2 aria-pressed:outline-offset-1 aria-pressed:outline-brand";

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

export function CoverPicker({ card, onChange }: { card: Card; onChange: (change: (card: Card) => Card) => void }) {
  const images = card.attachments.filter((item) => item.status === "local" && item.mimeType.startsWith("image/"));
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5">
        {coverColors.map((color) => (
          <button
            className={`h-8 w-[50px] rounded-sm border-2 border-transparent ${pressedClass}`}
            key={color}
            style={{ background: color }}
            aria-label={`Cover ${color}`}
            aria-pressed={card.cover?.color === color}
            onClick={() => onChange((item) => ({ ...item, cover: { color, size: item.cover?.size ?? "normal" } }))}
          />
        ))}
        <label
          className="inline-flex h-8 w-[50px] cursor-pointer items-center gap-2 overflow-hidden rounded-sm bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]"
          title="Custom color"
        >
          <ColorInput
            className="h-full w-full cursor-pointer border-0 p-0 opacity-85"
            value={card.cover?.color ?? "#579dff"}
            label="Custom cover color"
            onCommit={(color) =>
              onChange((item) => ({ ...item, cover: { color, size: item.cover?.size ?? "normal" } }))
            }
          />
        </label>
      </div>
      <Button
        variant="secondary"
        className="justify-self-start"
        onClick={() =>
          onChange((item) => ({ ...item, cover: { color: item.cover?.color ?? "#579dff", size: "full" } }))
        }
        aria-pressed={card.cover?.size === "full" && Boolean(card.cover.color)}
      >
        Color the whole card
      </Button>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((image) => (
            <Button
              variant="secondary"
              className={pressedClass}
              key={image.id}
              aria-pressed={card.cover?.attachmentId === image.id}
              onClick={() =>
                onChange((item) => ({ ...item, cover: { attachmentId: image.id, size: item.cover?.size ?? "normal" } }))
              }
            >
              {image.name}
            </Button>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2">
        Size{" "}
        <Select
          size="sm"
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
        </Select>
      </label>
      <Button
        variant="secondary"
        className="justify-self-start"
        onClick={() => onChange((item) => ({ ...item, cover: undefined }))}
        disabled={!card.cover}
      >
        Remove cover
      </Button>
    </div>
  );
}
