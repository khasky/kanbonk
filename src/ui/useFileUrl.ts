import { useEffect, useState } from "react";
import { loadAttachment } from "../lib/storage";
import { type Fill, fillBackground, fillTextColor } from "../model/fill";

/** An object URL for a stored file, revoked when the id changes; undefined while it loads, without one or on failure. */
export function useFileUrl(id: string | undefined): string | undefined {
  const [file, setFile] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!id) return;
    let url = "";
    let cancelled = false;
    loadAttachment(id)
      .then((blob) => {
        if (!blob || cancelled) return;
        url = URL.createObjectURL(blob);
        setFile({ id, url });
      })
      .catch(() => {
        if (!cancelled) setFile(null);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return file && file.id === id ? file.url : undefined;
}

/**
 * The CSS background and the readable text color of a fill, its image loaded; `scrim` darkens an image under text.
 * Until the image loads it shows the color under it.
 */
export function useFillStyle(fill: Fill | undefined, scrim = false): { background?: string; color?: string } {
  const url = useFileUrl(fill?.imageId);
  const shown = url ? fill : fill && { ...fill, imageId: undefined };
  const background = fillBackground(shown, url, scrim);
  return background ? { background, color: fillTextColor(shown) } : {};
}
