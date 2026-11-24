import { strFromU8, unzipSync } from "fflate";
import { t } from "../../i18n";
import { object, string } from "./records";

export function backgroundEntry(files: Record<string, Uint8Array>, trelloId: string): [string, Uint8Array] | undefined {
  const entries = Object.entries(files).filter(
    ([path]) => path.startsWith(`background/${trelloId}/`) && !path.endsWith("/"),
  );
  return entries.length === 1 ? entries[0] : undefined;
}

export function backgroundMimeType(path: string): string {
  const extension = path.split(".").slice(-1)[0]?.toLowerCase();
  return (
    (
      {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        gif: "image/gif",
        avif: "image/avif",
        svg: "image/svg+xml",
      } as Record<string, string>
    )[extension ?? ""] ?? "image/jpeg"
  );
}

/** Written into every part by the Kanbonk Trello Import extension. */
const exportManifestName = "kanbonk-export.json";

const exportReportNames = new Set([exportManifestName, "failed-files.txt", "failed-attachments.txt"]);

interface ExportManifest {
  exportId: string;
  boardId: string;
  part: number;
  parts?: number;
}

export function exportManifest(files: Record<string, Uint8Array>): ExportManifest | undefined {
  if (!files[exportManifestName]) return undefined;
  const value = object(JSON.parse(strFromU8(files[exportManifestName])));
  if (
    value.format !== "kanbonk-trello-export" ||
    !string(value.exportId) ||
    !string(value.boardId) ||
    !Number.isSafeInteger(value.part) ||
    (value.parts !== undefined && !Number.isSafeInteger(value.parts))
  )
    throw new Error(t("trello.invalidManifest"));
  return {
    exportId: string(value.exportId),
    boardId: string(value.boardId),
    part: value.part as number,
    parts: value.parts as number | undefined,
  };
}

export function attachmentEntries(files: Record<string, Uint8Array>): Array<[string, Uint8Array]> {
  return Object.entries(files).filter(([path, data]) => {
    if (
      path.endsWith("/") ||
      path.startsWith("background/") ||
      path.startsWith("stickers/") ||
      exportReportNames.has(path)
    )
      return false;
    if (path.startsWith("attachments/")) return true;
    if (!path.toLowerCase().endsWith(".json")) return true;
    try {
      const value = object(JSON.parse(strFromU8(data)));
      return !string(value.id) || !string(value.name) || !Array.isArray(value.lists) || !Array.isArray(value.cards);
    } catch {
      return true;
    }
  });
}

function boardJsonEntries(files: Record<string, Uint8Array>): Array<[string, Uint8Array]> {
  return Object.entries(files).filter(([path, data]) => {
    if (!path.toLowerCase().endsWith(".json") || path.startsWith("attachments/") || path.startsWith("background/"))
      return false;
    try {
      const value = object(JSON.parse(strFromU8(data)));
      return Boolean(
        string(value.id) && string(value.name) && Array.isArray(value.lists) && Array.isArray(value.cards),
      );
    } catch {
      return false;
    }
  });
}

export function matchingZipEntries(
  entries: Array<[string, Uint8Array]>,
  trelloId: string,
  name: string,
  uniqueName: boolean,
  expectedSize: number,
): Array<[string, Uint8Array]> {
  const byId = trelloId ? entries.filter(([path]) => path.split("/").includes(trelloId)) : [];
  const candidates = byId.length
    ? byId
    : uniqueName
      ? entries.filter(([path]) => !/^attachments\/[^/]+\//.test(path) && path.split("/").slice(-1)[0] === name)
      : [];
  return candidates.filter(([, data]) => !expectedSize || data.length === expectedSize);
}

export async function readZip(zipFile: File, filter?: (path: string) => boolean): Promise<Record<string, Uint8Array>> {
  try {
    return unzipSync(
      new Uint8Array(await zipFile.arrayBuffer()),
      filter ? { filter: (file) => filter(file.name) } : undefined,
    );
  } catch {
    throw new Error(t("trello.zipUnreadable", { name: zipFile.name }));
  }
}

export const zipList = (zipFiles?: File | File[]) =>
  zipFiles === undefined ? [] : Array.isArray(zipFiles) ? zipFiles : [zipFiles];

/**
 * Reads the board JSON and the part manifests of the chosen ZIPs without unpacking the files in them.
 * Parts made by the extension must come from one export and all be present; older ZIPs have no manifest.
 */
export async function readTrelloExport(zipFiles: File[]): Promise<{ json?: unknown; boardId: string }> {
  const boards: unknown[] = [];
  const manifests: ExportManifest[] = [];
  for (const zipFile of zipFiles) {
    const files = await readZip(
      zipFile,
      (path) => path.toLowerCase().endsWith(".json") && !/^(attachments|background|stickers)\//.test(path),
    );
    const manifest = exportManifest(files);
    if (manifest) manifests.push(manifest);
    for (const [, data] of boardJsonEntries(files)) boards.push(JSON.parse(strFromU8(data)));
  }
  if (boards.length > 1) throw new Error(t("trello.severalBoardsInParts"));
  if (manifests.length) {
    if (manifests.some((item) => item.exportId !== manifests[0].exportId))
      throw new Error(t("trello.differentExports"));
    const parts = manifests.find((item) => item.parts)?.parts;
    const present = new Set(manifests.map((item) => item.part));
    const missing = parts
      ? Array.from({ length: parts }, (_, index) => index + 1).filter((part) => !present.has(part))
      : [];
    if (!parts) throw new Error(t("trello.lastPartMissing"));
    if (missing.length) throw new Error(t("trello.partsMissing", { parts: missing.join(", ") }));
  }
  return { json: boards[0], boardId: string(object(boards[0]).id) || manifests[0]?.boardId || "" };
}

export function trelloBoardIdInZip(files: Record<string, Uint8Array>): string {
  const boardIds = boardJsonEntries(files).map(([, data]) => string(object(JSON.parse(strFromU8(data))).id));
  if (boardIds.length > 1) throw new Error(t("trello.severalBoardsInZip"));
  return boardIds[0] ?? "";
}
