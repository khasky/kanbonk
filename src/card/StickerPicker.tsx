import type { Card } from "../model";
import { FileButton } from "../ui/FileButton";

const rowClass = "mt-2.5 flex flex-wrap gap-2";
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
    <section
      className="mb-[15px] ml-[34px] rounded-md border border-line bg-white p-3 max-phone:ml-0"
      aria-label="Card stickers"
    >
      <strong>Stickers</strong>
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
        className="mt-2.5"
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
