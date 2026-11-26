import { useEffect, useState } from "react";
import type { Card } from "../model";
import { loadAttachment } from "../lib/storage";

const edgeToEdge = "block w-[calc(100%+24px)] -mx-3 -mt-[9px] mb-0 self-stretch rounded-t-lg";

/**
 * A card's cover at the top of its tile: an image, or a color band. Covers saved at Trello's "full card" size show at
 * the normal size too.
 */
export function CardCover({ card }: { card: Card }) {
  const attachment = card.attachments.find(
    (item) => item.id === card.cover?.attachmentId && item.status === "local" && item.mimeType.startsWith("image/"),
  );
  const [image, setImage] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!attachment) return;
    let url = "";
    let cancelled = false;
    loadAttachment(attachment.id)
      .then((blob) => {
        if (!blob || cancelled) return;
        url = URL.createObjectURL(blob);
        setImage({ id: attachment.id, url });
      })
      .catch(() => {
        if (!cancelled) setImage(null);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment?.id, attachment]);
  if (!card.cover) return null;
  if (attachment && image?.id === attachment.id)
    return <img className={`${edgeToEdge} h-[130px] object-cover`} src={image.url} alt="" />;
  if (card.cover.color) return <span className={`${edgeToEdge} h-[38px]`} style={{ background: card.cover.color }} />;
  return null;
}
