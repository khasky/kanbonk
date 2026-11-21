import { newId, type AppState, type Board } from "../../model/index";
import { loadAttachment, saveAttachment } from "../../lib/storage";
import type { ImportResult } from "./parse";
import {
  attachmentEntries,
  backgroundEntry,
  backgroundMimeType,
  exportManifest,
  matchingZipEntries,
  readZip,
  trelloBoardIdInZip,
  zipList,
} from "./zip";

async function downloadTrelloSticker(urlValue: string): Promise<Blob> {
  const url = new URL(urlValue);
  const hosts = new Set([
    "d2k1ftgv7pobq7.cloudfront.net",
    "trello-stickers.s3.amazonaws.com",
    "a.trellocdn.com",
    "trello.com",
  ]);
  if (url.protocol !== "https:" || !hosts.has(url.hostname) || url.username || url.password)
    throw new Error("Invalid Trello sticker URL.");
  const response = await fetch(url.href, { credentials: "omit" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  if (
    !(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"] as string[]).includes(blob.type) ||
    !blob.size ||
    blob.size > 25 * 1024 * 1024
  )
    throw new Error("Invalid Trello sticker image.");
  return blob;
}

/** Saves attachments, stickers and the background from the ZIP parts, one part in memory at a time; what is not in them is downloaded when possible. */
export async function restoreTrelloAttachments(
  result: ImportResult,
  zipFiles?: File | File[],
  download?: (url: string) => Promise<Blob>,
): Promise<string[]> {
  type PendingAttachment = ImportResult["attachments"][number];
  type PendingSticker = ImportResult["stickers"][number];
  const warnings: string[] = [];
  const pendingAttachments = new Set(result.attachments);
  const pendingStickers = new Set(result.stickers);
  const savedAttachment = (attachment: PendingAttachment) =>
    result.cards
      .find((item) => item.attachments.some((entry) => entry.id === attachment.id))
      ?.attachments.find((entry) => entry.id === attachment.id);
  async function keepAttachment(attachment: PendingAttachment, blob: Blob) {
    const saved = savedAttachment(attachment);
    if (saved?.size && blob.size !== saved.size) return;
    await saveAttachment(attachment.id, blob);
    if (saved) {
      saved.status = "local";
      saved.size = blob.size;
    }
    pendingAttachments.delete(attachment);
  }
  async function keepSticker(sticker: PendingSticker, blob: Blob) {
    await saveAttachment(sticker.id, blob);
    const card = result.cards.find((item) =>
      item.stickers?.some((value) => typeof value !== "string" && value.imageId === sticker.id),
    );
    const saved = card?.stickers?.find((value) => typeof value !== "string" && value.imageId === sticker.id);
    if (saved && typeof saved !== "string") saved.status = "local";
    pendingStickers.delete(sticker);
  }
  for (const zipFile of zipList(zipFiles)) {
    const files = await readZip(zipFile);
    const entries = attachmentEntries(files);
    const background = result.board.backgroundImageId
      ? undefined
      : backgroundEntry(files, result.board.sourceTrelloId ?? "");
    if (background) {
      const id = newId();
      await saveAttachment(id, new Blob([new Uint8Array(background[1])], { type: backgroundMimeType(background[0]) }));
      result.board.backgroundImageId = id;
      result.warnings = result.warnings.filter((warning) => !warning.startsWith("Background image"));
    }
    for (const attachment of [...pendingAttachments]) {
      const uniqueName = result.attachments.filter((item) => item.name === attachment.name).length === 1;
      const candidates = matchingZipEntries(
        entries,
        attachment.trelloId,
        attachment.name,
        uniqueName,
        savedAttachment(attachment)?.size ?? 0,
      );
      if (candidates.length === 1)
        await keepAttachment(attachment, new Blob([new Uint8Array(candidates[0][1])], { type: attachment.mimeType }));
    }
    for (const sticker of [...pendingStickers]) {
      const matches = Object.entries(files).filter(
        ([path]) => path.startsWith(`stickers/${sticker.trelloId}/`) && !path.endsWith("/"),
      );
      if (matches.length === 1)
        await keepSticker(
          sticker,
          new Blob([new Uint8Array(matches[0][1])], { type: backgroundMimeType(matches[0][0]) }),
        );
    }
  }
  for (const attachment of [...pendingAttachments]) {
    if (download) {
      try {
        await keepAttachment(attachment, await download(attachment.sourceUrl));
      } catch {
        /* The attachment remains marked as missing. */
      }
    }
    if (pendingAttachments.has(attachment)) warnings.push(`Could not download attachment “${attachment.name}”.`);
  }
  for (const sticker of [...pendingStickers]) {
    if (sticker.sourceUrl) {
      try {
        await keepSticker(sticker, await downloadTrelloSticker(sticker.sourceUrl));
      } catch {
        /* The sticker remains marked as missing. */
      }
    }
    if (pendingStickers.has(sticker)) warnings.push(`Could not download sticker “${sticker.name}”.`);
  }
  return warnings;
}

type RestoredAttachments = {
  state: AppState;
  restored: number;
  restoredStickers: number;
  restoredBackgrounds: number;
  changedCards: string[];
  changedBoards: string[];
};

/** Fills missing attachments, stickers and backgrounds of imported boards from ZIP parts, one part in memory at a time. */
export async function restoreExistingAttachments(
  state: AppState,
  zipFiles: File | File[],
): Promise<RestoredAttachments> {
  let total: RestoredAttachments = {
    state,
    restored: 0,
    restoredStickers: 0,
    restoredBackgrounds: 0,
    changedCards: [],
    changedBoards: [],
  };
  for (const zipFile of zipList(zipFiles)) {
    const part = await restoreFromZip(total.state, await readZip(zipFile));
    total = {
      state: part.state,
      restored: total.restored + part.restored,
      restoredStickers: total.restoredStickers + part.restoredStickers,
      restoredBackgrounds: total.restoredBackgrounds + part.restoredBackgrounds,
      changedCards: [...new Set([...total.changedCards, ...part.changedCards])],
      changedBoards: [...new Set([...total.changedBoards, ...part.changedBoards])],
    };
  }
  return total;
}

async function restoreFromZip(state: AppState, files: Record<string, Uint8Array>): Promise<RestoredAttachments> {
  const zipBoardId = trelloBoardIdInZip(files) || exportManifest(files)?.boardId || "";
  if (zipBoardId && !state.boards.some((board) => board.sourceTrelloId === zipBoardId))
    throw new Error("The board from the ZIP was not found among imported boards.");
  const allowedBoardIds = new Set(
    state.boards.filter((board) => !zipBoardId || board.sourceTrelloId === zipBoardId).map((board) => board.id),
  );
  const entries = attachmentEntries(files);
  let restored = 0;
  let restoredStickers = 0;
  const changedCards: string[] = [];
  const changedBoards: string[] = [];
  const boards: Board[] = [];
  for (const board of state.boards) {
    if (zipBoardId && board.sourceTrelloId !== zipBoardId) {
      boards.push(board);
      continue;
    }
    const background =
      board.sourceTrelloId && !board.backgroundImageId ? backgroundEntry(files, board.sourceTrelloId) : undefined;
    if (!background) {
      boards.push(board);
      continue;
    }
    const id = newId();
    await saveAttachment(id, new Blob([new Uint8Array(background[1])], { type: backgroundMimeType(background[0]) }));
    boards.push({ ...board, backgroundImageId: id });
    changedBoards.push(board.id);
  }
  const cards = [];
  const allAttachments = state.cards.flatMap((card) => card.attachments);
  for (const card of state.cards) {
    if (zipBoardId && !allowedBoardIds.has(card.boardId)) {
      cards.push(card);
      continue;
    }
    let changed = false;
    const attachments = [];
    const stickers = [...(card.stickers ?? [])];
    for (const attachment of card.attachments) {
      if (attachment.status !== "missing") {
        attachments.push(attachment);
        continue;
      }
      const trelloId = attachment.sourceUrl?.match(/\/attachments\/([^/]+)\//)?.[1] || "";
      const uniqueName = allAttachments.filter((item) => item.name === attachment.name).length === 1;
      const matches = matchingZipEntries(entries, trelloId, attachment.name, uniqueName, attachment.size);
      if (matches.length !== 1) {
        attachments.push(attachment);
        continue;
      }
      const blob = new Blob([new Uint8Array(matches[0][1])], { type: attachment.mimeType });
      await saveAttachment(attachment.id, blob);
      attachments.push({ ...attachment, size: blob.size, status: "local" as const });
      if (attachment.status === "missing") restored++;
      changed = true;
    }
    for (const [index, sticker] of stickers.entries()) {
      if (typeof sticker === "string" || !sticker.sourceTrelloId) continue;
      if (sticker.status !== "missing" && (await loadAttachment(sticker.imageId))) continue;
      const matches = Object.entries(files).filter(
        ([path]) => path.startsWith(`stickers/${sticker.sourceTrelloId}/`) && !path.endsWith("/"),
      );
      if (matches.length !== 1) continue;
      await saveAttachment(
        sticker.imageId,
        new Blob([new Uint8Array(matches[0][1])], { type: backgroundMimeType(matches[0][0]) }),
      );
      stickers[index] = { ...sticker, status: "local" };
      restoredStickers++;
      changed = true;
    }
    cards.push(changed ? { ...card, attachments, stickers } : card);
    if (changed) changedCards.push(card.id);
  }
  return {
    state: { ...state, boards, cards },
    restored,
    restoredStickers,
    restoredBackgrounds: changedBoards.length,
    changedCards,
    changedBoards,
  };
}
