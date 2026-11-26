import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { sha256 } from "@noble/hashes/sha2.js";
import { isViewCount, mediaReferences, newId, type AppState } from "../model";
import { loadAttachment, saveAttachment } from "../lib/storage";
import { mergeStates, type SyncConflict } from "../sync/sync";
import { t } from "../i18n";

interface BackupFile {
  id: string;
  type: string;
  size: number;
  hash?: string;
}

const manifestName = "kanbonk-backup.json";
// Backups made before the rename use these names; they are still restored.
const legacyManifestName = "listva-backup.json";

interface BackupManifest {
  format: "kanbonk-backup" | "listva-backup";
  version: 1 | 2;
  id: string;
  parts: number;
  state: AppState;
  files: BackupFile[];
  unavailable: number;
}

export interface BackupPart {
  name: string;
  blob: Blob;
  index: number;
  total: number;
  unavailable: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasIdName(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string";
}

export function validState(state: Record<string, unknown>): boolean {
  if (
    !["workspaces", "boards", "lists", "cards", "labels", "revisions"].every((key) => Array.isArray(state[key])) ||
    !isRecord(state.heads)
  )
    return false;
  const value = state as unknown as AppState;
  return (
    value.workspaces.every(
      (workspace) =>
        hasIdName(workspace) &&
        (workspace.sourceTrelloId === undefined || typeof workspace.sourceTrelloId === "string"),
    ) &&
    value.boards.every(
      (board) =>
        hasIdName(board) &&
        typeof board.workspaceId === "string" &&
        typeof board.description === "string" &&
        typeof board.background === "string" &&
        typeof board.starred === "boolean" &&
        (board.zones === undefined ||
          (Array.isArray(board.zones) &&
            board.zones.every((zone) => hasIdName(zone) && typeof zone.color === "string"))) &&
        (board.members === undefined || (Array.isArray(board.members) && board.members.every(hasIdName))) &&
        (board.automationRules === undefined ||
          (Array.isArray(board.automationRules) &&
            board.automationRules.every(
              (rule) =>
                isRecord(rule) &&
                typeof rule.id === "string" &&
                typeof rule.listId === "string" &&
                (rule.trigger === undefined ||
                  rule.trigger === "move" ||
                  rule.trigger === "button" ||
                  rule.trigger === "due") &&
                (rule.trigger !== "button" || (typeof rule.name === "string" && rule.name.trim().length > 0)) &&
                (rule.createdAt === undefined ||
                  (typeof rule.createdAt === "string" && Number.isFinite(Date.parse(rule.createdAt)))) &&
                (rule.leadMinutes === undefined ||
                  (rule.trigger === "due" &&
                    typeof rule.leadMinutes === "number" &&
                    [0, 60, 1440, 10080].includes(rule.leadMinutes))) &&
                typeof rule.action === "string" &&
                // "archive" and "complete" come from backups made before archiving and completion were removed.
                ["complete", "trash", "archive", "add-label"].includes(rule.action) &&
                (rule.labelId === undefined || typeof rule.labelId === "string"),
            ))),
    ) &&
    value.lists.every(
      (list) =>
        hasIdName(list) &&
        typeof list.boardId === "string" &&
        Number.isFinite(list.position) &&
        (list.zoneId === undefined || typeof list.zoneId === "string") &&
        (list.color === undefined || typeof list.color === "string"),
    ) &&
    value.labels.every(
      (label) =>
        hasIdName(label) &&
        typeof label.boardId === "string" &&
        typeof label.color === "string" &&
        (label.deleted === undefined || typeof label.deleted === "boolean") &&
        (label.linkId === undefined || typeof label.linkId === "string"),
    ) &&
    value.cards.every(
      (card) =>
        hasIdName(card) &&
        typeof card.boardId === "string" &&
        typeof card.listId === "string" &&
        typeof card.description === "string" &&
        Number.isFinite(card.position) &&
        Array.isArray(card.labelIds) &&
        card.labelIds.every((id) => typeof id === "string") &&
        (card.memberIds === undefined ||
          (Array.isArray(card.memberIds) && card.memberIds.every((id) => typeof id === "string"))) &&
        (card.automationRunKeys === undefined ||
          (Array.isArray(card.automationRunKeys) && card.automationRunKeys.every((key) => typeof key === "string"))) &&
        Array.isArray(card.checklists) &&
        card.checklists.every(
          (list) =>
            hasIdName(list) &&
            Array.isArray(list.items) &&
            list.items.every((item: unknown) => hasIdName(item) && typeof item.checked === "boolean"),
        ) &&
        Array.isArray(card.comments) &&
        card.comments.every(
          (comment) =>
            isRecord(comment) &&
            typeof comment.id === "string" &&
            typeof comment.text === "string" &&
            typeof comment.author === "string" &&
            typeof comment.createdAt === "string",
        ) &&
        Array.isArray(card.attachments) &&
        card.attachments.every(
          (file) =>
            hasIdName(file) &&
            typeof file.mimeType === "string" &&
            Number.isSafeInteger(file.size) &&
            file.size >= 0 &&
            ["local", "missing", "link"].includes(file.status),
        ),
    ) &&
    value.revisions.every(
      (revision) =>
        isRecord(revision) &&
        typeof revision.id === "string" &&
        ["workspace", "board", "list", "card", "label"].includes(revision.entityKind) &&
        typeof revision.entityId === "string" &&
        typeof revision.createdAt === "string" &&
        typeof revision.deviceId === "string" &&
        isRecord(revision.snapshot),
    ) &&
    (state.activity === undefined ||
      (Array.isArray(state.activity) &&
        state.activity.every(
          (item) =>
            isRecord(item) &&
            typeof item.id === "string" &&
            typeof item.entityKind === "string" &&
            ["workspace", "board", "list", "card", "label"].includes(item.entityKind) &&
            typeof item.entityId === "string" &&
            (item.boardId === undefined || typeof item.boardId === "string") &&
            (item.previousBoardId === undefined || typeof item.previousBoardId === "string") &&
            typeof item.createdAt === "string" &&
            typeof item.deviceId === "string" &&
            typeof item.summary === "string" &&
            typeof item.category === "string" &&
            ["change", "comment"].includes(item.category),
        ))) &&
    (state.views === undefined || (Array.isArray(state.views) && state.views.every(isViewCount))) &&
    Object.values(value.heads).every((id) => typeof id === "string") &&
    (state.tombstones === undefined ||
      (isRecord(state.tombstones) && Object.values(state.tombstones).every((time) => typeof time === "string"))) &&
    (state.ancestry === undefined ||
      (isRecord(state.ancestry) &&
        Object.values(state.ancestry).every(
          (parents) => Array.isArray(parents) && parents.every((id) => typeof id === "string"),
        )))
  );
}

function backupFiles(state: AppState): { ids: string[]; unavailable: number } {
  const { fileIds, missingIds } = mediaReferences(state);
  return { ids: fileIds, unavailable: missingIds.length };
}

function groupFiles(files: BackupFile[], maxBytes: number): BackupFile[][] {
  const groups: BackupFile[][] = [[]];
  let size = 0;
  for (const file of files) {
    const current = groups[groups.length - 1];
    if (current.length && (current.length >= 20 || size + file.size > maxBytes)) {
      groups.push([]);
      size = 0;
    }
    groups[groups.length - 1].push(file);
    size += file.size;
  }
  return groups;
}

export async function* createBackupParts(
  state: AppState,
  read = loadAttachment,
  maxBytes = 80 * 1024 * 1024,
): AsyncGenerator<BackupPart> {
  const { ids, unavailable } = backupFiles(state);
  const files: BackupFile[] = [];
  for (const id of ids) {
    const blob = await read(id);
    if (!blob) throw new Error(t("backup.fileMissing", { id }));
    files.push({ id, type: blob.type, size: blob.size, hash: await hash(blob) });
  }
  const groups = groupFiles(files, maxBytes);
  const backupId = newId();
  const manifest: BackupManifest = {
    format: "kanbonk-backup",
    version: 2,
    id: backupId,
    parts: groups.length,
    state,
    files,
    unavailable,
  };
  const stamp = new Date().toISOString().slice(0, 10);
  for (let index = 0; index < groups.length; index++) {
    const entries: Record<string, Uint8Array> = { "backup-id.txt": strToU8(backupId) };
    if (index === 0) entries[manifestName] = strToU8(JSON.stringify(manifest));
    for (const file of groups[index]) {
      const blob = await read(file.id);
      if (!blob || blob.size !== file.size || blob.type !== file.type)
        throw new Error(t("backup.fileChanged", { id: file.id }));
      const data = new Uint8Array(await blob.arrayBuffer());
      if ((await hash(data)) !== file.hash) throw new Error(t("backup.fileChanged", { id: file.id }));
      entries[`files/${file.id}`] = data;
    }
    const archive = zipSync(entries, { level: 0 });
    yield {
      name: `${stamp}-kanbonk-${backupId.slice(0, 8)}-${index + 1}of${groups.length}.zip`,
      blob: new Blob([new Uint8Array(archive)], { type: "application/zip" }),
      index: index + 1,
      total: groups.length,
      unavailable,
    };
  }
}

function readManifest(raw: unknown): BackupManifest {
  if (
    !isRecord(raw) ||
    (raw.format !== "kanbonk-backup" && raw.format !== "listva-backup") ||
    (raw.version !== 1 && raw.version !== 2) ||
    typeof raw.id !== "string" ||
    !Number.isInteger(raw.parts) ||
    (raw.parts as number) < 1 ||
    !Array.isArray(raw.files) ||
    !isRecord(raw.state)
  )
    throw new Error(t("backup.notBackup"));
  const state = raw.state;
  if (!validState(state)) throw new Error(t("backup.stateCorrupted"));
  const files = raw.files;
  if (
    !files.every(
      (file) =>
        isRecord(file) &&
        typeof file.id === "string" &&
        /^[a-z0-9-]+$/i.test(file.id) &&
        typeof file.type === "string" &&
        typeof file.size === "number" &&
        Number.isSafeInteger(file.size) &&
        file.size >= 0 &&
        (raw.version === 1
          ? file.hash === undefined
          : typeof file.hash === "string" && /^[a-f0-9]{64}$/.test(file.hash)),
    )
  )
    throw new Error(t("backup.fileListCorrupted"));
  const ids = files.map((file) => file.id);
  if (new Set(ids).size !== ids.length) throw new Error(t("backup.duplicateIds"));
  if (!Number.isSafeInteger(raw.unavailable) || (raw.unavailable as number) < 0)
    throw new Error(t("backup.manifestCorrupted"));
  const referenced = backupFiles(state as unknown as AppState).ids;
  if (referenced.length !== ids.length || referenced.some((id) => !ids.includes(id)))
    throw new Error(t("backup.fileListMismatch"));
  return raw as unknown as BackupManifest;
}

async function hash(data: Uint8Array | Blob): Promise<string> {
  const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
  const digest = sha256(bytes);
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function restoreBackup(
  parts: File[],
  current: AppState,
  read = loadAttachment,
  write = saveAttachment,
): Promise<{ state: AppState; conflicts: SyncConflict[]; files: number; unavailable: number }> {
  if (!parts.length) throw new Error(t("backup.selectParts"));
  let manifest: BackupManifest | undefined;
  let backupId = "";
  const found = new Map<string, { size: number; hash: string }>();
  for (const part of parts) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(new Uint8Array(await part.arrayBuffer()));
    } catch {
      throw new Error(t("backup.zipUnreadable", { name: part.name }));
    }
    const id = entries["backup-id.txt"] ? strFromU8(entries["backup-id.txt"]) : "";
    if (!id || (backupId && id !== backupId)) throw new Error(t("backup.differentBackups"));
    backupId = id;
    const manifestEntry = entries[manifestName] ?? entries[legacyManifestName];
    if (manifestEntry) {
      if (manifest) throw new Error(t("backup.severalManifests"));
      try {
        manifest = readManifest(JSON.parse(strFromU8(manifestEntry)));
      } catch (cause) {
        throw new Error(t("backup.manifestUnreadable", { error: String(cause) }));
      }
    }
    for (const [path, data] of Object.entries(entries)) {
      if (path === "backup-id.txt" || path === manifestName || path === legacyManifestName) continue;
      const fileId = path.match(/^files\/([a-z0-9-]+)$/i)?.[1];
      if (!fileId || found.has(fileId)) throw new Error(t("backup.invalidFile", { path }));
      found.set(fileId, { size: data.length, hash: await hash(data) });
    }
  }
  if (!manifest || manifest.id !== backupId || manifest.parts !== parts.length)
    throw new Error(t("backup.partsMissing"));
  const expected = new Map(manifest.files.map((file) => [file.id, file]));
  if (found.size !== expected.size) throw new Error(t("backup.filesMismatch"));
  for (const [id, meta] of found) {
    const file = expected.get(id);
    if (!file || file.size !== meta.size) throw new Error(t("backup.sizeMismatch", { id }));
    if (file.hash && file.hash !== meta.hash) throw new Error(t("backup.checksumMismatch", { id }));
    const existing = await read(id);
    if (existing && (existing.size !== meta.size || (await hash(existing)) !== meta.hash))
      throw new Error(t("backup.fileConflict", { id }));
  }
  const merged = mergeStates(current, manifest.state);
  for (const part of parts) {
    const entries = unzipSync(new Uint8Array(await part.arrayBuffer()));
    for (const [path, data] of Object.entries(entries)) {
      const id = path.match(/^files\/([a-z0-9-]+)$/i)?.[1];
      if (id && !(await read(id))) await write(id, new Blob([new Uint8Array(data)], { type: expected.get(id)!.type }));
    }
  }
  return { ...merged, files: expected.size, unavailable: manifest.unavailable };
}
