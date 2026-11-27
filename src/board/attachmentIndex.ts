import type { AppState, Attachment, BoardList, Card } from "../model";
import { previewKind } from "../card/previewKinds";

/** What an attachment is, for the type filter of the board's attachments. */
export type AttachmentKind = "image" | "video" | "audio" | "pdf" | "document" | "archive" | "link" | "other";

export const attachmentKinds: AttachmentKind[] = [
  "image",
  "video",
  "audio",
  "pdf",
  "document",
  "archive",
  "link",
  "other",
];

export type AttachmentSort = "newest" | "oldest" | "name" | "largest" | "card";

export interface BoardAttachment {
  attachment: Attachment;
  card: Card;
  list?: BoardList;
  kind: AttachmentKind;
}

const documentExtensions = /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf|pages|numbers|key)$/i;
const archiveExtensions = /\.(zip|rar|7z|tar|gz|tgz|bz2|xz)$/i;

export function attachmentKind(attachment: Attachment): AttachmentKind {
  if (attachment.status === "link") return "link";
  const preview = previewKind(attachment.name, attachment.mimeType);
  if (preview === "markdown" || preview === "text") return "document";
  if (preview) return preview;
  if (documentExtensions.test(attachment.name)) return "document";
  if (archiveExtensions.test(attachment.name) || /zip|compressed|x-tar/.test(attachment.mimeType)) return "archive";
  return "other";
}

/** Every attachment of the cards, with its card, list and kind. */
export function boardAttachments(state: AppState, cards: Card[]): BoardAttachment[] {
  const lists = new Map(state.lists.map((list) => [list.id, list]));
  return cards.flatMap((card) =>
    card.attachments.map((attachment) => ({
      attachment,
      card,
      list: lists.get(card.listId),
      kind: attachmentKind(attachment),
    })),
  );
}

const time = (item: BoardAttachment) => (item.attachment.addedAt ? Date.parse(item.attachment.addedAt) : Number.NaN);
const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

/** Attachments whose kind, list and file, card or list name match, in the order asked for; undated ones last by date. */
export function findAttachments(
  items: BoardAttachment[],
  options: { query: string; kind: AttachmentKind | ""; listId: string; sort: AttachmentSort },
): BoardAttachment[] {
  const words = options.query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const found = items.filter((item) => {
    if (options.kind && item.kind !== options.kind) return false;
    if (options.listId && item.card.listId !== options.listId) return false;
    const text = `${item.attachment.name} ${item.card.name} ${item.list?.name ?? ""}`.toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
  // Undated attachments go last; between two of them the difference is NaN, which falls through to the name.
  const undatedLast = (a: BoardAttachment, b: BoardAttachment) =>
    Number(Number.isNaN(time(a))) - Number(Number.isNaN(time(b)));
  const compare: Record<AttachmentSort, (a: BoardAttachment, b: BoardAttachment) => number> = {
    newest: (a, b) => undatedLast(a, b) || time(b) - time(a),
    oldest: (a, b) => undatedLast(a, b) || time(a) - time(b),
    name: (a, b) => byName(a.attachment.name, b.attachment.name),
    largest: (a, b) => b.attachment.size - a.attachment.size,
    card: (a, b) => byName(a.card.name, b.card.name) || byName(a.attachment.name, b.attachment.name),
  };
  return [...found].sort((a, b) => compare[options.sort](a, b) || byName(a.attachment.name, b.attachment.name));
}

/** A byte count as B, KB, MB or GB. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
