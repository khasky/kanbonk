import { type MessageKey, t } from "../i18n";
import type { Card } from "../model";
import { FileButton } from "../ui/FileButton";

const rowClass = "flex flex-wrap gap-2";
const stickerClass = "min-h-11 min-w-11 rounded-md border border-line bg-surface-soft text-[25px] hover:bg-brand-soft";

const stickerChoices: Array<{ symbol: string; name: MessageKey }> = [
  { symbol: "⭐", name: "card.stickerStar" },
  { symbol: "✅", name: "card.stickerDone" },
  { symbol: "🎉", name: "card.stickerParty" },
  { symbol: "🚀", name: "card.stickerRocket" },
  { symbol: "🔥", name: "card.stickerFire" },
  { symbol: "💡", name: "card.stickerIdea" },
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
    <section className="grid gap-2.5" aria-label={t("card.cardStickers")}>
      <div className={rowClass}>
        {stickerChoices.map(({ symbol, name }) => (
          <button
            className={stickerClass}
            key={symbol}
            onClick={() => onChange((item) => ({ ...item, stickers: [...(item.stickers ?? []), symbol] }))}
            aria-label={t("card.addSticker", { name: t(name) })}
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
        {t("card.customImage")}
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
              aria-label={t("card.removeSticker", { number: index + 1 })}
            >
              {typeof symbol === "string" ? symbol : symbol.name} ×
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
