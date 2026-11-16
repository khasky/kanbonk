/**
 * The only place that knows which shell runs the shared React app: web page, browser extension,
 * Tauri desktop or Tauri mobile. Everything else in src/ is platform-neutral.
 */
export type Platform = "web" | "extension" | "desktop" | "mobile";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const platform: Platform = typeof window === "undefined" ? "web"
  : isTauri ? (/Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop")
  : /-extension:$/.test(window.location.protocol) ? "extension" : "web";

/** Extension pages have no server that falls back to index.html, so routes live in the URL hash there. */
export const hashRouting = platform === "extension";

/** Saves a blob as a user-visible file. Returns false if the user cancelled the save dialog. */
export async function saveFile(blob: Blob, name: string): Promise<boolean> {
  // Tauri WebViews (notably Android) ignore <a download>, so use the native save dialog there.
  if (isTauri) {
    const [{ save }, { writeFile }] = await Promise.all([import("@tauri-apps/plugin-dialog"), import("@tauri-apps/plugin-fs")]);
    const path = await save({ defaultPath: name });
    if (!path) return false;
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return true;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/** Hands a file to the OS share sheet (Bluetooth, Nearby Share…) when available, otherwise saves it. */
export async function shareFile(file: File): Promise<"shared" | "saved" | "cancelled"> {
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: file.name }); return "shared"; }
  return await saveFile(file, file.name) ? "saved" : "cancelled";
}
