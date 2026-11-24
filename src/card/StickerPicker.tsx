import type { Card } from "../model";
import { FileButton } from "../ui/FileButton";

const rowClass = "flex flex-wrap gap-2";
const stickerClass = "min-h-11 min-w-11 rounded-md border border-line bg-surface-soft text-[25px] hover:bg-brand-soft";

const stickerChoices = [
  { symbol: "⭐", name: "Star" },
  { symbol: "✅", name: "Done" },
  { symbol: "🎉", name: "Party" },
  { symbol: "🚀", name: "Rocket" },
  { symbol: "🔥", name: "Fire" },
  { symbol: "💡", name: "Idea" },
];

/** Adds emoji or image stickers to the card and removes the ones it has. */
export function StickerPicker({
  card,
  onChange,
  onAddStickerImage,
}: {
  card: Card;
  onChange: (change: (card: Card) => Card) => void;
  onAddStickerImage: (file: File | null) => void;
}) {
  return (
    <section className="grid gap-2.5" aria-label="Card stickers">
      <div className={rowClass}>
        {stickerChoices.map(({ symbol, name }) => (
          <button
            className={stickerClass}
            key={symbol}
            onClick={() => onChange((item) => ({ ...item, stickers: [...(item.stickers ?? []), symbol] }))}
            aria-label={`Add sticker ${name}`}
          >
            {symbol}
          </button>
        ))}
      </div>
      <FileButton
        size="md"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        onFiles={(files) => onAddStickerImage(files[0] ?? null)}
      >
        Custom image
      </FileButton>
      {(card.stickers ?? []).length > 0 && (
        <div className={rowClass}>
          {card.stickers!.map((symbol, index) => (
            <button
              className={stickerClass}
              key={index}
              onClick={() =>
                onChange((item) => ({
                  ...item,
                  stickers: (item.stickers ?? []).filter((_, position) => position !== index),
                }))
              }
              aria-label={`Remove sticker ${index + 1}`}
            >
              {typeof symbol === "string" ? symbol : symbol.name} ×
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
