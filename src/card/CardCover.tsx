import { useEffect, useState } from "react";
import type { Card } from "../model";
import { loadAttachment } from "../lib/storage";

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
  if (attachment && image?.id === attachment.id) return <img className="card-cover-image" src={image.url} alt="" />;
  if (card.cover.color && card.cover.size === "normal")
    return <span className="card-cover-color" style={{ background: card.cover.color }} />;
  return null;
}
