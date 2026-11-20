import type { Card } from "../model";

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
    <section className="sticker-picker" aria-label="Card stickers">
      <strong>Stickers</strong>
      <div className="sticker-options">
        {stickerChoices.map(({ symbol, name }) => (
          <button
            key={symbol}
            onClick={() => onChange((item) => ({ ...item, stickers: [...(item.stickers ?? []), symbol] }))}
            aria-label={`Add sticker ${name}`}
          >
            {symbol}
          </button>
        ))}
      </div>
      <label className="file-button">
        Custom image
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          onChange={(event) => {
            onAddStickerImage(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
      </label>
      {(card.stickers ?? []).length > 0 && (
        <div className="sticker-current">
          {card.stickers!.map((symbol, index) => (
            <button
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
