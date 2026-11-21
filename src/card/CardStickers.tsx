import { useEffect, useState } from "react";
import type { Card } from "../model";
import { loadAttachment } from "../lib/storage";

export function CardStickers({ card }: { card: Card }) {
  const imageIds = (card.stickers ?? []).flatMap((sticker) => (typeof sticker === "string" ? [] : [sticker.imageId]));
  const imageKey = imageIds.join(",");
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    void Promise.all(
      (imageKey ? imageKey.split(",") : []).map(async (id) => {
        try {
          const blob = await loadAttachment(id);
          if (!blob || !active) return null;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          return [id, url] as const;
        } catch {
          return null;
        }
      }),
    ).then((loaded) => {
      if (active)
        setImageUrls(Object.fromEntries(loaded.filter((item): item is readonly [string, string] => item !== null)));
    });
    return () => {
      active = false;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [imageKey]);
  if (!card.stickers?.length) return null;
  return (
    <span
      className="flex flex-wrap gap-[5px] self-end text-[24px] leading-none"
      aria-label={`Stickers: ${card.stickers.map((sticker) => (typeof sticker === "string" ? sticker : sticker.name)).join(" ")}`}
    >
      {card.stickers.map((sticker, index) => (
        <span
          key={index}
          className="inline-block"
          role="img"
          aria-label={typeof sticker === "string" ? sticker : sticker.name}
        >
          {typeof sticker === "string" ? (
            sticker
          ) : sticker.status === "missing" ? (
            <span className="inline-block" title="Sticker file missing">
              ⚠
            </span>
          ) : (
            imageUrls[sticker.imageId] && (
              <img className="block h-8 w-8 object-contain" src={imageUrls[sticker.imageId]} alt="" />
            )
          )}
        </span>
      ))}
    </span>
  );
}
