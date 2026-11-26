import { ColorInput } from "../ui/ColorInput";
import type { Card } from "../model";
import { t } from "../i18n";
import { Button } from "../ui/Button";

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

/** A card's cover: a color or one of its images, always shown at the normal size above the title. */
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
            aria-label={t("card.coverColor", { color })}
            aria-pressed={card.cover?.color === color}
            onClick={() => onChange((item) => ({ ...item, cover: { color, size: "normal" } }))}
          />
        ))}
        <label
          className="inline-flex h-8 w-[50px] cursor-pointer items-center gap-2 overflow-hidden rounded-sm bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]"
          title={t("card.customColor")}
        >
          <ColorInput
            className="h-full w-full cursor-pointer border-0 p-0 opacity-85"
            value={card.cover?.color ?? "#579dff"}
            label={t("card.customCoverColor")}
            onCommit={(color) => onChange((item) => ({ ...item, cover: { color, size: "normal" } }))}
          />
        </label>
      </div>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((image) => (
            <Button
              variant="secondary"
              className={pressedClass}
              key={image.id}
              aria-pressed={card.cover?.attachmentId === image.id}
              onClick={() => onChange((item) => ({ ...item, cover: { attachmentId: image.id, size: "normal" } }))}
            >
              {image.name}
            </Button>
          ))}
        </div>
      )}
      <Button
        variant="secondary"
        className="justify-self-start"
        onClick={() => onChange((item) => ({ ...item, cover: undefined }))}
        disabled={!card.cover}
      >
        {t("card.removeCover")}
      </Button>
    </div>
  );
}
