/// <reference lib="webworker" />
import { attachmentStore, databaseName } from "../lib/database";

/**
 * Makes the small copy of a stored image for `usePreviewUrl` off the main thread: reads the file from IndexedDB,
 * decodes and scales it to the width asked for (the height in proportion) and encodes it as WebP. It answers each
 * `{ id, width }` with `{ id, blob }`: the copy, the original file when it cannot be decoded, or null without a file.
 */
let connection: Promise<IDBDatabase> | undefined;

function database(): Promise<IDBDatabase> {
  connection ??= new Promise((resolve, reject) => {
    // No version: the app creates and upgrades the database; this only reads it.
    const request = indexedDB.open(databaseName);
    request.onsuccess = () => {
      const opened = request.result;
      // Lets the app upgrade the database while this connection is open.
      opened.onversionchange = () => {
        opened.close();
        connection = undefined;
      };
      resolve(opened);
    };
    request.onerror = () => {
      connection = undefined;
      reject(request.error);
    };
  });
  return connection;
}

async function load(id: string): Promise<Blob | undefined> {
  const opened = await database();
  if (!opened.objectStoreNames.contains(attachmentStore)) return undefined;
  return new Promise((resolve, reject) => {
    const request = opened.transaction(attachmentStore, "readonly").objectStore(attachmentStore).get(id);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : undefined);
    request.onerror = () => reject(request.error);
  });
}

async function preview(id: string, width: number): Promise<Blob | null> {
  const blob = await load(id);
  if (!blob) return null;
  try {
    // One decode, scaled to the width; a smaller image grows as the tile would show it.
    const bitmap = await createImageBitmap(blob, { resizeWidth: width, resizeQuality: "medium" });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    bitmap.close();
    return await canvas.convertToBlob({ type: "image/webp", quality: 0.85 });
  } catch {
    return blob;
  }
}

self.onmessage = (event: MessageEvent<{ id: string; width: number }>) => {
  const { id, width } = event.data;
  preview(id, width).then(
    (blob) => self.postMessage({ id, blob }),
    () => self.postMessage({ id, blob: null }),
  );
};
