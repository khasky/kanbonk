import { loadSetting, saveSetting } from "./storage";

/**
 * The only place that knows which shell runs the shared React app: web page, browser extension,
 * Tauri desktop or Tauri mobile. Everything else in src/ is platform-neutral.
 */
export type Platform = "web" | "extension" | "desktop" | "mobile";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const platform: Platform =
  typeof window === "undefined"
    ? "web"
    : isTauri
      ? /Android|iPhone|iPad/i.test(navigator.userAgent)
        ? "mobile"
        : "desktop"
      : /-extension:$/.test(window.location.protocol)
        ? "extension"
        : "web";

/** Extension pages have no server that falls back to index.html, so routes live in the URL hash there. */
export const hashRouting = platform === "extension";

/** Saves a blob as a user-visible file. Returns false if the user cancelled the save dialog. */
export async function saveFile(blob: Blob, name: string): Promise<boolean> {
  // Tauri WebViews (notably Android) ignore <a download>, so use the native save dialog there.
  if (isTauri) {
    const [{ save }, { writeFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const path = await save({ defaultPath: name });
    if (!path) return false;
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return true;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/** Hands a file to the OS share sheet (Bluetooth, Nearby Share…) when available, otherwise saves it. */
export async function shareFile(file: File): Promise<"shared" | "saved" | "cancelled"> {
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: file.name });
    return "shared";
  }
  return (await saveFile(file, file.name)) ? "saved" : "cancelled";
}

/** Where automatic backups are written. Without `list` and `remove`, older copies cannot be deleted there. */
export interface BackupDestination {
  label: string;
  write(name: string, blob: Blob): Promise<void>;
  list?(): Promise<string[]>;
  remove?(name: string): Promise<void>;
}

type DirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  keys(): AsyncIterable<string>;
};

/** A folder the user chose: a browser directory handle, or a path in the desktop app. Kept in IndexedDB. */
export type BackupFolder = { kind: "handle"; handle: FileSystemDirectoryHandle } | { kind: "path"; path: string };

export const backupFolderSupported =
  platform === "desktop" ||
  ((platform === "web" || platform === "extension") &&
    typeof window !== "undefined" &&
    "showDirectoryPicker" in window);

/** Asks for a backup folder; undefined when the user cancels. */
export async function pickBackupFolder(): Promise<BackupFolder | undefined> {
  if (platform === "desktop") {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({ directory: true, title: "Folder for automatic backups" });
    return typeof path === "string" ? { kind: "path", path } : undefined;
  }
  const picker = (
    window as unknown as {
      showDirectoryPicker: (options: { mode: "readwrite"; id: string }) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker;
  try {
    return { kind: "handle", handle: await picker({ mode: "readwrite", id: "kanbonk-backups" }) };
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") return undefined;
    throw cause;
  }
}

export const backupFolderLabel = (folder: BackupFolder) => (folder.kind === "path" ? folder.path : folder.handle.name);

async function tauriFolder(dir: string): Promise<BackupDestination> {
  const { invoke } = await import("@tauri-apps/api/core");
  return {
    label: dir,
    write: async (name, blob) => {
      await invoke("backup_write", new Uint8Array(await blob.arrayBuffer()), {
        headers: { "x-dir": encodeURIComponent(dir), "x-name": encodeURIComponent(name) },
      });
    },
    list: () => invoke<string[]>("backup_list", { dir }),
    remove: async (name) => {
      await invoke("backup_remove", { dir, name });
    },
  };
}

/** Thrown when the browser no longer lets Kanbonk write to the chosen folder; granting it again needs a click. */
export class BackupAccessError extends Error {}

export async function folderDestination(folder: BackupFolder, interactive: boolean): Promise<BackupDestination> {
  if (folder.kind === "path") return tauriFolder(folder.path);
  const handle = folder.handle as DirectoryHandle;
  let permission = await handle.queryPermission({ mode: "readwrite" });
  if (permission !== "granted" && interactive) permission = await handle.requestPermission({ mode: "readwrite" });
  if (permission !== "granted")
    throw new BackupAccessError(`Kanbonk may no longer write to the folder “${handle.name}”.`);
  return {
    label: handle.name,
    write: async (name, blob) => {
      const writable = await (await handle.getFileHandle(name, { create: true })).createWritable();
      await writable.write(blob);
      await writable.close();
    },
    list: async () => {
      const names: string[] = [];
      for await (const name of handle.keys()) names.push(name);
      return names;
    },
    remove: (name) => handle.removeEntry(name),
  };
}

interface DownloadItem {
  id: number;
  filename: string;
  exists: boolean;
  byExtensionId?: string;
  state: string;
}
interface ChromeDownloads {
  runtime: { id: string };
  downloads: {
    download(options: { url: string; filename: string; conflictAction: "overwrite"; saveAs: false }): Promise<number>;
    search(query: { id: number }): Promise<DownloadItem[]>;
    removeFile(id: number): Promise<void>;
    erase(query: { id: number }): Promise<number[]>;
    onChanged: {
      addListener(listener: (delta: { id: number; state?: { current: string } }) => void): void;
      removeListener(listener: (delta: { id: number; state?: { current: string } }) => void): void;
    };
  };
}

/** The extension saves into Downloads/Kanbonk Backups without asking and may delete the copies it saved. */
function extensionDownloads(): BackupDestination {
  const chrome = (globalThis as unknown as { chrome: ChromeDownloads }).chrome;
  const folder = "Kanbonk Backups";
  // Files are found again by the download IDs recorded here, not by name: the browser may rename a download.
  const recorded = async () => (await loadSetting<Record<string, number[]>>("backup-downloads")) ?? {};
  const present = async (id: number) =>
    (await chrome.downloads.search({ id })).some((item) => item.exists && item.state === "complete");
  return {
    label: `Downloads/${folder}`,
    write: async (name, blob) => {
      const url = URL.createObjectURL(blob);
      // Listen before starting: a small file can finish before download() resolves with its ID.
      const finished = new Map<number, string>();
      let settle: ((state: string) => void) | undefined;
      let id: number | undefined;
      const listener = (delta: { id: number; state?: { current: string } }) => {
        if (!delta.state || delta.state.current === "in_progress") return;
        finished.set(delta.id, delta.state.current);
        if (delta.id === id) settle?.(delta.state.current);
      };
      chrome.downloads.onChanged.addListener(listener);
      try {
        id = await chrome.downloads.download({
          url,
          filename: `${folder}/${name}`,
          conflictAction: "overwrite",
          saveAs: false,
        });
        const state =
          finished.get(id) ??
          (await new Promise<string>((resolve) => {
            settle = resolve;
          }));
        if (state !== "complete") throw new Error(`The browser did not save ${name}.`);
        const ids = await recorded();
        await saveSetting("backup-downloads", { ...ids, [name]: [...(ids[name] ?? []), id] });
      } finally {
        chrome.downloads.onChanged.removeListener(listener);
        URL.revokeObjectURL(url);
      }
    },
    list: async () => {
      const ids = await recorded();
      const names: string[] = [];
      for (const [name, list] of Object.entries(ids))
        if ((await Promise.all(list.map(present))).some(Boolean)) names.push(name);
      return names;
    },
    remove: async (name) => {
      const ids = await recorded();
      for (const id of ids[name] ?? []) {
        if (await present(id)) await chrome.downloads.removeFile(id);
        await chrome.downloads.erase({ id });
      }
      delete ids[name];
      await saveSetting("backup-downloads", ids);
    },
  };
}

/** The place automatic backups go when the user has not chosen a folder; undefined where there is none. */
export async function defaultBackupDestination(): Promise<BackupDestination | undefined> {
  if (platform === "extension") return extensionDownloads();
  if (platform === "desktop") {
    const { invoke } = await import("@tauri-apps/api/core");
    return tauriFolder(await invoke<string>("backup_default_dir"));
  }
  // A web page cannot write files silently: each backup is an ordinary download, and old ones stay.
  if (platform === "web")
    return {
      label: "Downloads",
      write: async (name, blob) => {
        await saveFile(blob, name);
      },
    };
  return undefined;
}
