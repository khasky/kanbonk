import { type Card, coverFill, withCover } from "../model";
import { t } from "../i18n";
import { FillPicker } from "../ui/FillPicker";

/** A card's cover, which fills the whole tile: a color, a gradient, one of its images or a new image attached. */
export function CoverPicker({
  card,
  onChange,
  onUpload,
}: {
  card: Card;
  onChange: (change: (card: Card) => Card) => void;
  onUpload: (file: File) => void;
}) {
  return (
    <FillPicker
      value={coverFill(card)}
      images={card.attachments.filter((item) => item.status === "local" && item.mimeType.startsWith("image/"))}
      onChange={(fill) => onChange((item) => withCover(item, fill))}
      onUpload={onUpload}
      removeLabel={t("card.removeCover")}
      onRemove={() => onChange((item) => withCover(item, undefined))}
    />
  );
}
