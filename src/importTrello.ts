import { strFromU8, unzipSync } from "fflate";
import {
  newId,
  recordRevisions,
  type ActivityEvent,
  type AppState,
  type Attachment,
  type Board,
  type BoardList,
  type Card,
  type Checklist,
  type Comment,
  type Label,
  type Member,
  type Workspace,
} from "./model";
import { loadAttachment, saveAttachment } from "./storage";
import { trelloLabelColors } from "./labels";

type TrelloRecord = Record<string, unknown>;

function object(value: unknown): TrelloRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as TrelloRecord) : {};
}

function array(value: unknown): TrelloRecord[] {
  return Array.isArray(value) ? value.map(object) : [];
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function trelloActionDescription(action: TrelloRecord, importedCardName?: string, importedListName?: string): string {
  const data = object(action.data);
  const old = object(data.old);
  const card = string(object(data.card).name) || importedCardName || "card";
  const list = string(object(data.list).name) || importedListName || "list";
  const attachment = string(object(data.attachment).name) || "attachment";
  switch (action.type) {
    case "commentCard":
      return `commented on card “${card}”: ${string(data.text)}`;
    case "createCard":
      return `created card “${card}”`;
    case "deleteCard":
      return `deleted card “${card}”`;
    case "moveCardToBoard":
      return `moved card “${card}” to this board`;
    case "moveCardFromBoard":
      return `moved card “${card}” from this board`;
    case "addAttachmentToCard":
      return `attached “${attachment}” to card “${card}”`;
    case "deleteAttachmentFromCard":
      return `removed attachment “${attachment}” from card “${card}”`;
    case "addChecklistToCard":
      return `added a checklist to card “${card}”`;
    case "removeChecklistFromCard":
      return `removed a checklist from card “${card}”`;
    case "updateChecklist":
      return `updated a checklist on card “${card}”`;
    case "addMemberToCard":
      return `added a member to card “${card}”`;
    case "removeMemberFromCard":
      return `removed a member from card “${card}”`;
    case "updateCard": {
      const change =
        "name" in old
          ? "renamed card"
          : "idList" in old
            ? "moved card"
            : "desc" in old
              ? "changed the description of card"
              : "due" in old
                ? "changed the due date of card"
                : "closed" in old
                  ? "changed the archive status of card"
                  : "pos" in old
                    ? "changed the position of card"
                    : "updated card";
      return `${change} “${card}”`;
    }
    case "createList":
      return `created list “${list}”`;
    case "updateList":
      return `${"name" in old ? "renamed" : "updated"} list “${list}”`;
    case "moveListFromBoard":
      return `moved list “${list}” from this board`;
    case "createBoard":
      return "created the board";
    case "copyBoard":
      return "copied the board";
    case "updateBoard":
      return "updated the board";
    case "addMemberToBoard":
      return "added a board member";
    case "makeAdminOfBoard":
      return "made a board admin";
    case "makeNormalMemberOfBoard":
      return "changed a board member's role";
    case "addToOrganizationBoard":
      return "added the board to a workspace";
    case "removeFromOrganizationBoard":
      return "removed the board from a workspace";
    default:
      return `performed action ${string(action.type) || "Trello"}`;
  }
}

function backgroundEntry(files: Record<string, Uint8Array>, trelloId: string): [string, Uint8Array] | undefined {
  const entries = Object.entries(files).filter(
    ([path]) => path.startsWith(`background/${trelloId}/`) && !path.endsWith("/"),
  );
  return entries.length === 1 ? entries[0] : undefined;
}

function backgroundMimeType(path: string): string {
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

/** Written into every part by the Kanbonk Trello Import extension. */
const exportManifestName = "kanbonk-export.json";
const exportReportNames = new Set([exportManifestName, "failed-files.txt", "failed-attachments.txt"]);

interface ExportManifest {
  exportId: string;
  boardId: string;
  part: number;
  parts?: number;
}

function exportManifest(files: Record<string, Uint8Array>): ExportManifest | undefined {
  if (!files[exportManifestName]) return undefined;
  const value = object(JSON.parse(strFromU8(files[exportManifestName])));
  if (
    value.format !== "kanbonk-trello-export" ||
    !string(value.exportId) ||
    !string(value.boardId) ||
    !Number.isSafeInteger(value.part) ||
    (value.parts !== undefined && !Number.isSafeInteger(value.parts))
  )
    throw new Error("The export part has an invalid manifest.");
  return {
    exportId: string(value.exportId),
    boardId: string(value.boardId),
    part: value.part as number,
    parts: value.parts as number | undefined,
  };
}

function attachmentEntries(files: Record<string, Uint8Array>): Array<[string, Uint8Array]> {
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

function matchingZipEntries(
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

export interface ImportResult {
  organization?: { id: string; name?: string };
  board: Board;
  lists: BoardList[];
  cards: Card[];
  labels: Label[];
  activity: ActivityEvent[];
  attachments: Array<{
    id: string;
    trelloId: string;
    cardId: string;
    sourceUrl: string;
    name: string;
    mimeType: string;
  }>;
  stickers: Array<{ id: string; trelloId: string; sourceUrl: string; name: string }>;
  warnings: string[];
}

/** Exports saved by the Trello helper before the rename carry its fields as listva*. */
function legacyTrelloFields(source: TrelloRecord): TrelloRecord {
  return "listvaComments" in source || "listvaCommentsComplete" in source || "listvaOrganizationName" in source
    ? {
        ...source,
        kanbonkComments: source.kanbonkComments ?? source.listvaComments,
        kanbonkCommentsComplete: source.kanbonkCommentsComplete ?? source.listvaCommentsComplete,
        kanbonkOrganizationName: source.kanbonkOrganizationName ?? source.listvaOrganizationName,
      }
    : source;
}

export function parseTrelloBoard(raw: unknown, workspaceId: string): ImportResult {
  const source = legacyTrelloFields(object(raw));
  if (!string(source.id) || !string(source.name) || !Array.isArray(source.lists) || !Array.isArray(source.cards)) {
    throw new Error("The file does not look like a Trello board JSON export.");
  }
  const boardId = newId();
  const organizationId = string(source.idOrganization);
  const organizationName = string(source.kanbonkOrganizationName) || string(object(source.organization).displayName);
  const organization = organizationId ? { id: organizationId, name: organizationName || undefined } : undefined;
  const prefs = object(source.prefs);
  const board: Board = {
    id: boardId,
    workspaceId,
    name: string(source.name),
    description: string(source.desc),
    background: string(prefs.backgroundColor) || "#147d86",
    sourceTrelloId: string(source.id),
    starred: Boolean(source.starred),
    archived: Boolean(source.closed),
  };
  const members: Member[] = [];
  const memberIds = new Map<string, string>();
  for (const entry of array(source.members)) {
    const trelloId = string(entry.id);
    if (!trelloId || memberIds.has(trelloId)) continue;
    const id = newId();
    memberIds.set(trelloId, id);
    members.push({
      id,
      name: string(entry.fullName) || string(entry.username) || `Trello member ${trelloId.slice(0, 8)}`,
    });
  }
  for (const entry of array(source.cards))
    for (const value of Array.isArray(entry.idMembers) ? entry.idMembers : []) {
      const trelloId = string(value);
      if (!trelloId || memberIds.has(trelloId)) continue;
      const id = newId();
      memberIds.set(trelloId, id);
      members.push({ id, name: `Trello member ${trelloId.slice(0, 8)}` });
    }
  board.members = members;
  const listIds = new Map<string, string>();
  const lists = array(source.lists).map((entry, index) => {
    const id = newId();
    listIds.set(string(entry.id), id);
    return {
      id,
      boardId,
      name: string(entry.name) || `List ${index + 1}`,
      position: number(entry.pos) || index + 1,
      archived: Boolean(entry.closed),
    };
  });
  const labelIds = new Map<string, string>();
  const labels: Label[] = array(source.labels).map((entry) => {
    const id = newId();
    labelIds.set(string(entry.id), id);
    return {
      id,
      boardId,
      name: string(entry.name),
      color: trelloLabelColors[string(entry.color)] ?? (entry.color ? "#dfe1e6" : ""),
    };
  });
  const checklistsByCard = new Map<string, Checklist[]>();
  for (const entry of array(source.checklists).sort((a, b) => number(a.pos) - number(b.pos))) {
    const checklist: Checklist = {
      id: newId(),
      name: string(entry.name) || "Checklist",
      items: array(entry.checkItems)
        .sort((a, b) => number(a.pos) - number(b.pos))
        .map((item) => ({ id: newId(), name: string(item.name), checked: string(item.state) === "complete" })),
    };
    const cardId = string(entry.idCard);
    checklistsByCard.set(cardId, [...(checklistsByCard.get(cardId) || []), checklist]);
  }
  const commentsByCard = new Map<string, Comment[]>();
  const completeComments = source.kanbonkCommentsComplete === true && Array.isArray(source.kanbonkComments);
  for (const action of array(completeComments ? source.kanbonkComments : source.actions)) {
    if (action.type !== "commentCard") continue;
    const data = object(action.data);
    const cardId = string(object(data.card).id);
    const comment: Comment = {
      id: newId(),
      text: string(data.text),
      author: string(object(action.memberCreator).fullName) || "Trello author",
      authorDeviceId: `trello:${string(object(action.memberCreator).id) || "unknown"}`,
      createdAt: string(action.date) || new Date().toISOString(),
    };
    commentsByCard.set(cardId, [...(commentsByCard.get(cardId) || []), comment]);
  }
  const createdByCard = new Map<string, string>();
  for (const action of array(source.actions))
    if (action.type === "createCard" && Number.isFinite(Date.parse(string(action.date))))
      createdByCard.set(string(object(object(action.data).card).id), string(action.date));
  const attachments: ImportResult["attachments"] = [];
  const stickers: ImportResult["stickers"] = [];
  const cards: Card[] = array(source.cards).map((entry, index) => {
    const trelloId = string(entry.id);
    const id = newId();
    const attachmentIds = new Map<string, string>();
    const cardAttachments: Attachment[] = array(entry.attachments)
      .sort((a, b) => number(a.pos) - number(b.pos))
      .map((attachment) => {
        const id = newId();
        attachmentIds.set(string(attachment.id), id);
        if (attachment.isUpload !== false)
          attachments.push({
            id,
            trelloId: string(attachment.id),
            cardId: trelloId,
            sourceUrl: string(attachment.url),
            name: string(attachment.name) || "Attachment",
            mimeType: string(attachment.mimeType),
          });
        return {
          id,
          name: string(attachment.name) || "Attachment",
          mimeType: string(attachment.mimeType),
          size: number(attachment.bytes),
          sourceUrl: string(attachment.url),
          status: attachment.isUpload === false ? "link" : "missing",
        };
      });
    const sourceCover = object(entry.cover);
    const coverAttachmentId = attachmentIds.get(string(sourceCover.idAttachment) || string(entry.idAttachmentCover));
    const coverColor = trelloLabelColors[string(sourceCover.color)];
    const cover =
      coverAttachmentId || coverColor
        ? {
            attachmentId: coverAttachmentId,
            color: coverColor,
            size: string(sourceCover.size) === "full" ? ("full" as const) : ("normal" as const),
          }
        : undefined;
    const cardStickers = array(entry.stickers).map((sticker) => {
      const imageId = newId();
      const trelloStickerId = string(sticker.id);
      const name = string(sticker.image) || "Trello sticker";
      if (trelloStickerId)
        stickers.push({ id: imageId, trelloId: trelloStickerId, sourceUrl: string(sticker.imageUrl), name });
      return { imageId, name, sourceTrelloId: trelloStickerId || undefined, status: "missing" as const };
    });
    return {
      id,
      boardId,
      listId: listIds.get(string(entry.idList)) || lists[0]?.id || "",
      name: string(entry.name) || `Card ${index + 1}`,
      description: string(entry.desc),
      position: number(entry.pos) || index + 1,
      createdAt: /^[a-f0-9]{24}$/.test(trelloId)
        ? new Date(parseInt(trelloId.slice(0, 8), 16) * 1000).toISOString()
        : createdByCard.get(trelloId),
      labelIds: array(entry.labels)
        .map((label) => labelIds.get(string(label.id)))
        .filter((value): value is string => Boolean(value))
        .concat(
          (Array.isArray(entry.idLabels) ? entry.idLabels : [])
            .map((value) => labelIds.get(string(value)))
            .filter((value): value is string => Boolean(value)),
        )
        .filter((value, index, all) => all.indexOf(value) === index),
      memberIds: (Array.isArray(entry.idMembers) ? entry.idMembers : [])
        .map((value) => memberIds.get(string(value)))
        .filter((value): value is string => Boolean(value)),
      startAt: string(entry.start) || undefined,
      dueAt: string(entry.due) || undefined,
      dueReminderMinutes:
        typeof entry.dueReminder === "number" && entry.dueReminder >= 0 ? entry.dueReminder : undefined,
      completed: Boolean(entry.dueComplete),
      checklists: checklistsByCard.get(trelloId) || [],
      comments: (commentsByCard.get(trelloId) || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      attachments: cardAttachments,
      stickers: cardStickers,
      cover,
      archived: Boolean(entry.closed),
      sourceTrelloId: trelloId,
      sourceTrelloShortLink: string(entry.shortLink),
      isTemplate: Boolean(entry.isTemplate),
    };
  });
  const cardsByTrelloId = new Map(cards.map((card) => [card.sourceTrelloId, card]));
  const actions = new Map<string, TrelloRecord>();
  for (const action of [...array(source.actions), ...(completeComments ? array(source.kanbonkComments) : [])]) {
    const data = object(action.data);
    const key =
      string(action.id) ||
      `${string(action.type)}:${string(action.date)}:${string(object(data.card).id)}:${string(data.text)}`;
    actions.set(key, action);
  }
  const activity: ActivityEvent[] = [];
  for (const action of actions.values()) {
    const createdAt = string(action.date);
    if (!Number.isFinite(Date.parse(createdAt))) continue;
    const data = object(action.data);
    const importedCard = cardsByTrelloId.get(string(object(data.card).id));
    const cardId = importedCard?.id;
    const listId = listIds.get(string(object(data.list).id));
    const importedListName = lists.find((list) => list.id === listId)?.name;
    const author =
      string(object(action.memberCreator).fullName) || string(object(action.memberCreator).username) || "Trello member";
    activity.push({
      id: newId(),
      entityKind: cardId ? "card" : listId ? "list" : "board",
      entityId: cardId || listId || boardId,
      boardId,
      createdAt,
      deviceId: "trello",
      summary: `${author}: ${trelloActionDescription(action, importedCard?.name, importedListName)}`,
      category: action.type === "commentCard" ? "comment" : "change",
    });
  }
  const warnings: string[] = [];
  if (attachments.length) warnings.push("Attachments need a separate download or a ZIP with files.");
  if (stickers.length) warnings.push("Trello sticker images need a ZIP with files.");
  if (organization && !organization.name)
    warnings.push("The workspace name is not included in the Trello JSON; you can rename it after import.");
  if (string(prefs.backgroundImage))
    warnings.push(
      "Background image of the Trello board was not transferred. Save it to your computer and choose it via “Background from file”.",
    );
  if (array(source.actions).length >= 1000)
    warnings.push(
      `A Trello JSON export contains only the last 1000 actions: part of the history${completeComments ? "" : " and older comments"} may be missing.`,
    );
  return { organization, board, lists, cards, labels, activity, attachments, stickers, warnings };
}

export function prepareTrelloWorkspace(
  state: AppState,
  organization: ImportResult["organization"],
  fallbackWorkspaceId: string,
): { state: AppState; workspaceId: string; changedWorkspaceId?: string } {
  if (!organization) return { state, workspaceId: fallbackWorkspaceId };
  const placeholder = `Trello ${organization.id.slice(0, 8)}`;
  const name = organization.name;
  const existing = state.workspaces.find((workspace) => workspace.sourceTrelloId === organization.id);
  if (existing) {
    if (name && existing.name === placeholder) {
      return {
        state: {
          ...state,
          workspaces: state.workspaces.map((workspace) =>
            workspace.id === existing.id ? { ...workspace, name } : workspace,
          ),
        },
        workspaceId: existing.id,
        changedWorkspaceId: existing.id,
      };
    }
    return { state, workspaceId: existing.id };
  }
  const workspace: Workspace = { id: newId(), name: organization.name || placeholder, sourceTrelloId: organization.id };
  return {
    state: { ...state, workspaces: [...state.workspaces, workspace] },
    workspaceId: workspace.id,
    changedWorkspaceId: workspace.id,
  };
}

async function readZip(zipFile: File, filter?: (path: string) => boolean): Promise<Record<string, Uint8Array>> {
  try {
    return unzipSync(
      new Uint8Array(await zipFile.arrayBuffer()),
      filter ? { filter: (file) => filter(file.name) } : undefined,
    );
  } catch {
    throw new Error(`Could not read the ZIP “${zipFile.name}”.`);
  }
}

const zipList = (zipFiles?: File | File[]) =>
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
  if (boards.length > 1)
    throw new Error("The chosen ZIP files contain several board JSON files; choose the parts of one export.");
  if (manifests.length) {
    if (manifests.some((item) => item.exportId !== manifests[0].exportId))
      throw new Error("The chosen ZIP files belong to different exports; choose the parts of one export.");
    const parts = manifests.find((item) => item.parts)?.parts;
    const present = new Set(manifests.map((item) => item.part));
    const missing = parts
      ? Array.from({ length: parts }, (_, index) => index + 1).filter((part) => !present.has(part))
      : [];
    if (!parts) throw new Error("The last part of the export was not chosen.");
    if (missing.length) throw new Error(`Not all parts of the export were chosen; missing: ${missing.join(", ")}.`);
  }
  return { json: boards[0], boardId: string(object(boards[0]).id) || manifests[0]?.boardId || "" };
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

export function addImportedBoard(state: AppState, result: ImportResult): AppState {
  return {
    ...state,
    boards: [...state.boards, result.board],
    lists: [...state.lists, ...result.lists],
    cards: [...state.cards, ...result.cards],
    labels: [...state.labels, ...result.labels],
    activity: [...(state.activity ?? []), ...result.activity],
  };
}

export function addImportedBoardWithRevisions(state: AppState, result: ImportResult, deviceId: string): AppState {
  let next = addImportedBoard(state, result);
  const importedActivity = next.activity;
  next = recordRevisions(
    next,
    [
      { kind: "board", id: result.board.id },
      ...result.lists.map((list) => ({ kind: "list" as const, id: list.id })),
      ...result.labels.map((label) => ({ kind: "label" as const, id: label.id })),
      ...result.cards.map((card) => ({ kind: "card" as const, id: card.id })),
    ],
    deviceId,
  );
  return { ...next, activity: importedActivity };
}

function trelloBoardIdInZip(files: Record<string, Uint8Array>): string {
  const boardIds = boardJsonEntries(files).map(([, data]) => string(object(JSON.parse(strFromU8(data))).id));
  if (boardIds.length > 1) throw new Error("The ZIP contains several board JSON files.");
  return boardIds[0] ?? "";
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
