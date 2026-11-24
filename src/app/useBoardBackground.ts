import { useEffect, useEffectEvent, useState } from "react";
import { t } from "../i18n";
import { loadAttachment } from "../lib/storage";

/** An object URL for the board's background image; reloads when `fileVersion` changes (files were restored). */
export function useBoardBackground(
  imageId: string | undefined,
  fileVersion: number,
  onError: (message: string) => void,
): string | undefined {
  const [image, setImage] = useState<{ id: string; url: string } | null>(null);
  const reportError = useEffectEvent(onError);
  // biome-ignore lint/correctness/useExhaustiveDependencies: fileVersion is a trigger that reloads the image after files change.
  useEffect(() => {
    if (!imageId) return;
    let url = "";
    let cancelled = false;
    loadAttachment(imageId)
      .then((blob) => {
        if (!blob || cancelled) return;
        url = URL.createObjectURL(blob);
        setImage({ id: imageId, url });
      })
      .catch((cause) => reportError(t("app.backgroundOpenError", { cause: String(cause) })));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageId, fileVersion]);
  return image && image.id === imageId ? image.url : undefined;
}
