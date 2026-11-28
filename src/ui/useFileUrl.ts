import { startTransition, useEffect, useState } from "react";
import { type Fill, fillBackground, fillTextColor } from "../model/fill";

/** Wide enough for a card tile (272px) on a screen of twice the density. */
export const previewWidth = 544;

const previews = new Map<string, Promise<string | undefined>>();
const waiting = new Map<string, (blob: Blob | null) => void>();
let worker: Worker | undefined;

/** The worker that makes the copies (see `previewWorker`), started on first use. */
function previewWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./previewWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: string; blob: Blob | null }>) => {
      waiting.get(event.data.id)?.(event.data.blob);
      waiting.delete(event.data.id);
    };
  }
  return worker;
}

/**
 * A small copy of a stored image, `previewWidth` wide, made once per session by a worker, so the main thread neither
 * reads, decodes nor scales the full image, and every tile showing the image shares the copy: scrolling a board of
 * screenshots decodes nothing big. Undefined without the file.
 */
function preview(id: string): Promise<string | undefined> {
  let made = previews.get(id);
  if (!made) {
    made = new Promise<Blob | null>((resolve) => {
      waiting.set(id, resolve);
      previewWorker().postMessage({ id, width: previewWidth });
    }).then((blob) => (blob ? URL.createObjectURL(blob) : undefined));
    previews.set(id, made);
    // A file that is not stored yet (e.g. still syncing) is looked up again next time.
    void made.then((url) => {
      if (!url) previews.delete(id);
    });
  }
  return made;
}

/** The URL of a stored image's small copy (see `preview`); undefined while it is being made or without the file. */
export function usePreviewUrl(id: string | undefined): string | undefined {
  const [shown, setShown] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void preview(id).then((url) => {
      // A low-priority update: a burst of copies arriving while the board scrolls does not hold up a frame.
      if (url && !cancelled) startTransition(() => setShown({ id, url }));
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  return shown && shown.id === id ? shown.url : undefined;
}

/**
 * The CSS background and the readable text color of a fill, its image as a small copy; `scrim` darkens an image under
 * text. Until the image is ready it shows the color under it.
 */
export function useFillStyle(fill: Fill | undefined, scrim = false): { background?: string; color?: string } {
  const url = usePreviewUrl(fill?.imageId);
  const shown = url ? fill : fill && { ...fill, imageId: undefined };
  const background = fillBackground(shown, url, scrim);
  return background ? { background, color: fillTextColor(shown) } : {};
}
