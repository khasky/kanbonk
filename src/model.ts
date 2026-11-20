import { trelloLabelColors } from "./labels";

export type EntityKind = "workspace" | "board" | "list" | "card" | "label";

export interface Trashable {
  deletedAt?: string;
  deletedBatch?: string;
}

export interface Workspace extends Trashable {
  id: string;
  name: string;
  archived?: boolean;
  sourceTrelloId?: string;
}

export interface AutomationRule {
  id: string;
  listId: string;
  trigger?: "move" | "button" | "due";
  name?: string;
  createdAt?: string;
  leadMinutes?: number;
  action: "complete" | "archive" | "add-label";
  labelId?: string;
}

export interface Board extends Trashable {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  background: string;
  backgroundImageId?: string;
  sourceTrelloId?: string;
  members?: Member[];
  automationRules?: AutomationRule[];
  /** Groups of adjacent lists, e.g. "Development" = Todo + In progress + Testing. */
  zones?: Zone[];
  /** Project document twin of the board (Markdown); links `/c/<id>` point at cards. */
  doc?: string;
  starred: boolean;
  archived?: boolean;
}

export interface Zone {
  id: string;
  name: string;
  color: string;
}

export interface Member {
  id: string;
  name: string;
}

export interface BoardList extends Trashable {
  id: string;
  boardId: string;
  name: string;
  position: number;
  /** A list belongs to at most one zone of its board. */
  zoneId?: string;
  archived?: boolean;
}

export interface Label {
  id: string;
  boardId: string;
  name: string;
  color: string;
  deleted?: boolean;
}

export interface ChecklistItem {
  id: string;
  name: string;
  checked: boolean;
  linkedCardId?: string;
}

export interface Checklist {
  id: string;
  name: string;
  items: ChecklistItem[];
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  authorDeviceId?: string;
  createdAt: string;
}

export function canEditComment(comment: Comment, deviceId: string): boolean {
  return !comment.authorDeviceId || comment.authorDeviceId === deviceId;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  sourceUrl?: string;
  status: "local" | "missing" | "link";
  linkedCardId?: string;
}

export interface ImageSticker {
  imageId: string;
  name: string;
  sourceTrelloId?: string;
  status?: "local" | "missing";
}

export interface Card extends Trashable {
  id: string;
  boardId: string;
  listId: string;
  name: string;
  description: string;
  position: number;
  createdAt?: string;
  labelIds: string[];
  memberIds?: string[];
  startAt?: string;
  dueAt?: string;
  dueReminderMinutes?: number;
  dueRepeat?: { cadence: "daily" | "weekly" | "monthly" | "yearly"; anchor: string };
  automationRunKeys?: string[];
  completed: boolean;
  checklists: Checklist[];
  comments: Comment[];
  attachments: Attachment[];
  stickers?: Array<string | ImageSticker>;
  cover?: { attachmentId?: string; color?: string; size: "normal" | "full" };
  archived?: boolean;
  sourceTrelloId?: string;
  sourceTrelloShortLink?: string;
  isTemplate?: boolean;
  /** Parent card for sub-cards. */
  parentCardId?: string;
}

export interface Revision {
  id: string;
  parentId?: string;
  parentIds?: string[];
  entityKind: EntityKind;
  entityId: string;
  createdAt: string;
  deviceId: string;
  snapshot: Workspace | Board | BoardList | Card | Label;
}

export interface ActivityEvent {
  id: string;
  entityKind: EntityKind;
  entityId: string;
  boardId?: string;
  previousBoardId?: string;
  createdAt: string;
  deviceId: string;
  summary: string;
  category: "change" | "comment";
}

export interface AppState {
  workspaces: Workspace[];
  boards: Board[];
  lists: BoardList[];
  cards: Card[];
  labels: Label[];
  revisions: Revision[];
  activity?: ActivityEvent[];
  heads: Record<string, string>;
  ancestry: Record<string, string[]>;
  /** Permanently deleted entities ("kind:id" -> ISO time); synced so purges propagate. */
  tombstones?: Record<string, string>;
}

export interface BoardFilter {
  keyword: string;
  labelId: string;
  memberId?: string;
  status: "all" | "complete" | "incomplete";
  due: "any" | "overdue" | "next-week" | "none";
}

export const emptyBoardFilter = (): BoardFilter => ({ keyword: "", labelId: "", memberId: "", status: "all", due: "any" });

export function isCardAvailable(state: AppState, card?: Card): boolean {
  return Boolean(card && !card.archived && state.boards.some((board) => board.id === card.boardId && !board.archived) && state.lists.some((list) => list.id === card.listId && !list.archived));
}

const cardTexts = new WeakMap<Card, string>();

/** Lower-cased searchable text of a card, computed once per card object (cards are immutable). */
export function cardText(card: Card): string {
  let text = cardTexts.get(card);
  if (text === undefined) {
    text = [card.name, card.description, ...card.checklists.flatMap((list) => [list.name, ...list.items.map((item) => item.name)]), ...card.comments.map((comment) => comment.text), ...card.attachments.map((attachment) => attachment.name)].join("\n").toLocaleLowerCase();
    cardTexts.set(card, text);
  }
  return text;
}

export function filterBoardCards(state: AppState, boardId: string, filter: BoardFilter, now = Date.now()): Card[] {
  const keyword = filter.keyword.trim().toLocaleLowerCase();
  const archivedListIds = new Set(state.lists.filter((list) => list.archived).map((list) => list.id));
  return state.cards.filter((card) => {
    if (card.boardId !== boardId || card.archived || archivedListIds.has(card.listId)) return false;
    if (filter.labelId && !card.labelIds.includes(filter.labelId)) return false;
    if (filter.memberId && !(card.memberIds ?? []).includes(filter.memberId)) return false;
    if (filter.status === "complete" && !card.completed) return false;
    if (filter.status === "incomplete" && card.completed) return false;
    const due = card.dueAt ? new Date(card.dueAt).getTime() : NaN;
    if (filter.due === "none" && card.dueAt) return false;
    if (filter.due === "overdue" && (card.completed || !(due < now))) return false;
    if (filter.due === "next-week" && (card.completed || !(due >= now && due <= now + 7 * 24 * 60 * 60 * 1000))) return false;
    if (!keyword) return true;
    return cardText(card).includes(keyword);
  });
}

export const emptyState = (): AppState => ({
  workspaces: [],
  boards: [],
  lists: [],
  cards: [],
  labels: [],
  revisions: [],
  activity: [],
  heads: {},
  ancestry: {},
});

const idAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const issuedIds = new Set<string>();

/** Registers ids already present locally so newId never repeats them. */
export function rememberIds(ids: Iterable<string>): void {
  for (const id of ids) issuedIds.add(id);
}

export function rememberStateIds(state: AppState): void {
  for (const collection of [state.workspaces, state.boards, state.lists, state.cards, state.labels, state.revisions]) rememberIds(collection.map((item) => item.id));
}

/** Trello-like short id: URL-safe base62, unbiased (rejection sampling), unique among ids known to this device. */
export function newId(length = 8): string {
  for (;;) {
    let id = "";
    while (id.length < length) {
      for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
        if (byte < 248 && id.length < length) id += idAlphabet[byte % 62];
      }
    }
    if (!issuedIds.has(id)) { issuedIds.add(id); return id; }
  }
}

export function isShortId(value: string): boolean {
  return /^[0-9A-Za-z]{8}$/.test(value);
}

export function positionBefore(cards: Card[], movingId: string, target: Card): number {
  const siblings = cards.filter((card) => card.listId === target.listId && card.id !== movingId && !card.archived).sort((a, b) => a.position - b.position);
  const targetIndex = siblings.findIndex((card) => card.id === target.id);
  if (targetIndex < 1) return target.position - 1;
  return (siblings[targetIndex - 1].position + target.position) / 2;
}

export function reorderLists(lists: BoardList[], movingId: string, targetId: string, after = false): BoardList[] {
  const moving = lists.find((list) => list.id === movingId && !list.archived);
  const target = lists.find((list) => list.id === targetId && !list.archived);
  if (!moving || !target || moving.id === target.id || moving.boardId !== target.boardId) return lists;
  const ordered = lists.filter((list) => list.boardId === moving.boardId && !list.archived && list.id !== movingId).sort((a, b) => a.position - b.position);
  const targetIndex = ordered.findIndex((list) => list.id === targetId);
  ordered.splice(targetIndex + Number(after), 0, moving);
  const positions = new Map(ordered.map((list, index) => [list.id, index + 1]));
  return lists.map((list) => positions.has(list.id) ? { ...list, position: positions.get(list.id)! } : list);
}

export function sortListCards(cards: Card[], listId: string, by: "name" | "due"): Card[] {
  const sorted = cards.filter((card) => card.listId === listId && !card.archived).sort((a, b) => by === "name"
    ? a.name.localeCompare(b.name)
    : (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity));
  const positions = new Map(sorted.map((card, index) => [card.id, index + 1]));
  return cards.map((card) => positions.has(card.id) ? { ...card, position: positions.get(card.id)! } : card);
}

export function transferCard(state: AppState, cardId: string, targetListId: string, copy: boolean, copyId?: string): { state: AppState; cardId: string } {
  const source = state.cards.find((card) => card.id === cardId && !card.archived);
  const targetList = state.lists.find((list) => list.id === targetListId && !list.archived);
  const targetBoard = state.boards.find((board) => board.id === targetList?.boardId && !board.archived);
  if (!source || !targetList || !targetBoard) throw new Error("The card or target list is unavailable.");

  const crossBoard = source.boardId !== targetBoard.id;
  const labels = [...state.labels];
  const labelIds = crossBoard ? source.labelIds.flatMap((id) => {
    const sourceLabel = state.labels.find((label) => label.id === id && !label.deleted);
    if (!sourceLabel) return [];
    let targetLabel = labels.find((label) => label.boardId === targetBoard.id && !label.deleted && label.name === sourceLabel.name && label.color === sourceLabel.color);
    if (!targetLabel) {
      targetLabel = { ...sourceLabel, id: newId(), boardId: targetBoard.id };
      labels.push(targetLabel);
    }
    return [targetLabel.id];
  }) : [...source.labelIds];

  const sourceMembers = state.boards.find((board) => board.id === source.boardId)?.members ?? [];
  const memberIds = crossBoard ? (source.memberIds ?? []).flatMap((id) => {
    const member = sourceMembers.find((item) => item.id === id);
    const targetMember = targetBoard.members?.find((item) => item.id === id || (member && item.name === member.name));
    return targetMember ? [targetMember.id] : [];
  }) : [...source.memberIds ?? []];

  const position = Math.max(0, ...state.cards.filter((card) => card.listId === targetListId && (copy || card.id !== cardId) && !card.archived).map((card) => card.position)) + 1;
  const transferred: Card = {
    ...structuredClone(source), id: copy ? copyId ?? newId() : source.id, boardId: targetBoard.id, listId: targetListId, position, labelIds, memberIds,
    ...(copy ? {
      createdAt: new Date().toISOString(), sourceTrelloId: undefined, sourceTrelloShortLink: undefined,
      automationRunKeys: [],
      checklists: source.checklists.map((list) => ({ ...structuredClone(list), id: newId(), items: list.items.map((item) => ({ ...item, id: newId() })) })),
      comments: source.comments.map((comment) => ({ ...comment, id: newId() })),
    } : {}),
  };
  return { state: { ...state, labels, cards: copy ? [...state.cards, transferred] : state.cards.map((card) => card.id === cardId ? transferred : card) }, cardId: transferred.id };
}

/** "<name> - Clone", with one more " - Clone" for each card of the board that already has the name. */
export function cloneCardName(state: AppState, cardId: string): string {
  const source = state.cards.find((card) => card.id === cardId);
  if (!source) throw new Error("Card not found.");
  const taken = new Set(state.cards.filter((card) => card.boardId === source.boardId).map((card) => card.name));
  let name = `${source.name} - Clone`;
  while (taken.has(name)) name += " - Clone";
  return name;
}

/** Copies a card under the name from `cloneCardName` right below the original in the same list. */
export function cloneCard(state: AppState, cardId: string, copyId = newId()): { state: AppState; cardId: string } {
  const source = state.cards.find((card) => card.id === cardId);
  if (!source) throw new Error("Card not found.");
  const copied = transferCard(state, cardId, source.listId, true, copyId).state;
  const next = copied.cards.filter((card) => card.listId === source.listId && card.id !== copyId && !card.archived && card.position > source.position).sort((a, b) => a.position - b.position)[0];
  const position = next ? (source.position + next.position) / 2 : source.position + 1;
  return { state: { ...copied, cards: copied.cards.map((card) => card.id === copyId ? { ...card, name: cloneCardName(state, cardId), position } : card) }, cardId: copyId };
}

/** Creates a sub-card in the parent's list, below the parent and its existing sub-cards. */
export function createSubCard(state: AppState, parentId: string, name: string, id = newId(), now = new Date().toISOString()): AppState {
  const parent = state.cards.find((card) => card.id === parentId);
  if (!parent) throw new Error("Card not found.");
  const siblings = state.cards.filter((card) => card.listId === parent.listId && !card.archived);
  const after = Math.max(parent.position, ...siblings.filter((card) => card.parentCardId === parentId).map((card) => card.position));
  const next = siblings.filter((card) => card.position > after).sort((a, b) => a.position - b.position)[0];
  const created: Card = { id, boardId: parent.boardId, listId: parent.listId, name, description: "", createdAt: now, position: next ? (after + next.position) / 2 : after + 1, labelIds: [], completed: false, checklists: [], comments: [], attachments: [], parentCardId: parentId };
  return { ...state, cards: [...state.cards, created] };
}

/** Sub-cards of a card, in board order. */
export function subCards(state: AppState, cardId: string): Card[] {
  return state.cards.filter((card) => card.parentCardId === cardId).sort((a, b) => a.position - b.position);
}

/** Cards that may become the parent of `cardId` without creating a cycle. */
export function parentCandidates(state: AppState, cardId: string): Card[] {
  const blocked = new Set([cardId]);
  for (let grew = true; grew;) {
    grew = false;
    for (const card of state.cards) if (card.parentCardId && blocked.has(card.parentCardId) && !blocked.has(card.id)) { blocked.add(card.id); grew = true; }
  }
  return state.cards.filter((card) => !blocked.has(card.id) && !card.archived && !card.isTemplate);
}

export function createCardFromTemplate(state: AppState, templateId: string, targetListId: string, name: string, copyId = newId()): { state: AppState; cardId: string } {
  const template = state.cards.find((card) => card.id === templateId && card.isTemplate);
  const target = state.lists.find((list) => list.id === targetListId && !list.archived);
  if (!template || !target || template.boardId !== target.boardId) throw new Error("The template or target list is unavailable.");
  const available = template.archived ? { ...state, cards: state.cards.map((card) => card.id === templateId ? { ...card, archived: false } : card) } : state;
  const result = transferCard(available, templateId, targetListId, true, copyId);
  return {
    state: {
      ...result.state,
      cards: result.state.cards.map((card) => card.id === templateId ? template : card.id === copyId ? {
        ...card, name: name.trim() || template.name, isTemplate: false, archived: false,
        startAt: undefined, dueAt: undefined, dueReminderMinutes: undefined, dueRepeat: undefined, comments: [],
      } : card),
    },
    cardId: copyId,
  };
}

export function linkDependency(state: AppState, dependentId: string, prerequisiteId: string): AppState {
  const dependent = state.cards.find((card) => card.id === dependentId && !card.archived);
  const prerequisite = state.cards.find((card) => card.id === prerequisiteId && !card.archived);
  if (!dependent || !prerequisite || dependentId === prerequisiteId || !isCardAvailable(state, dependent) || !isCardAvailable(state, prerequisite)) throw new Error("The cards for the dependency are unavailable.");
  const checklist = dependent.checklists.find((item) => item.name === "Dependencies");
  if (checklist?.items.some((item) => item.linkedCardId === prerequisiteId) && prerequisite.attachments.some((item) => item.linkedCardId === dependentId)) return state;
  const checklists = dependent.checklists.map((item) => item.id === checklist?.id && !item.items.some((entry) => entry.linkedCardId === prerequisiteId)
    ? { ...item, items: [...item.items, { id: newId(), name: prerequisite.name, checked: false, linkedCardId: prerequisiteId }] }
    : item);
  if (!checklist) checklists.push({ id: newId(), name: "Dependencies", items: [{ id: newId(), name: prerequisite.name, checked: false, linkedCardId: prerequisiteId }] });
  const attachments = prerequisite.attachments.some((item) => item.linkedCardId === dependentId)
    ? prerequisite.attachments
    : [...prerequisite.attachments, { id: newId(), name: dependent.name, mimeType: "text/uri-list", size: 0, status: "link" as const, linkedCardId: dependentId }];
  return { ...state, cards: state.cards.map((card) => card.id === dependentId ? { ...card, checklists } : card.id === prerequisiteId ? { ...card, attachments } : card) };
}

export function unlinkDependency(state: AppState, dependentId: string, prerequisiteId: string): AppState {
  const dependent = state.cards.find((card) => card.id === dependentId);
  const prerequisite = state.cards.find((card) => card.id === prerequisiteId);
  const hasChecklistLink = dependent?.checklists.some((list) => list.items.some((item) => item.linkedCardId === prerequisiteId));
  const hasAttachmentLink = prerequisite?.attachments.some((item) => item.linkedCardId === dependentId);
  if (!hasChecklistLink && !hasAttachmentLink) return state;
  return { ...state, cards: state.cards.map((card) => card.id === dependentId && hasChecklistLink
    ? { ...card, checklists: card.checklists.map((list) => ({ ...list, items: list.items.filter((item) => item.linkedCardId !== prerequisiteId) })) }
    : card.id === prerequisiteId && hasAttachmentLink
      ? { ...card, attachments: card.attachments.filter((item) => item.linkedCardId !== dependentId) }
      : card) };
}

export function copyList(state: AppState, listId: string, copyId = newId()): { state: AppState; listId: string; cardIds: string[] } {
  const source = state.lists.find((list) => list.id === listId && !list.archived);
  if (!source || !state.boards.some((board) => board.id === source.boardId && !board.archived)) throw new Error("The list cannot be copied.");
  const following = state.lists.filter((list) => list.boardId === source.boardId && !list.archived && list.position > source.position).sort((a, b) => a.position - b.position)[0];
  const position = following ? (source.position + following.position) / 2 : source.position + 1;
  const copied = { ...source, id: copyId, name: `${source.name} (copy)`, position };
  let next: AppState = { ...state, lists: [...state.lists, copied] };
  const cardIds: string[] = [];
  for (const card of state.cards.filter((item) => item.listId === listId && !item.archived).sort((a, b) => a.position - b.position)) {
    const result = transferCard(next, card.id, copyId, true);
    next = result.state;
    cardIds.push(result.cardId);
  }
  return { state: next, listId: copyId, cardIds };
}

export function copyBoard(state: AppState, sourceId: string, options: { name: string; workspaceId: string; keepCards: boolean; keepTemplates: boolean }, copyId = newId()): { state: AppState; boardId: string; listIds: string[]; cardIds: string[] } {
  const source = state.boards.find((board) => board.id === sourceId && !board.archived);
  if (!source || !options.name.trim() || !state.workspaces.some((workspace) => workspace.id === options.workspaceId && !workspace.archived)) throw new Error("The board or workspace is unavailable.");
  const board: Board = { ...structuredClone(source), id: copyId, workspaceId: options.workspaceId, name: options.name.trim(), sourceTrelloId: undefined, starred: false, members: [] };
  const listIds = new Map<string, string>();
  const lists = state.lists.filter((list) => list.boardId === sourceId && !list.archived).map((list) => {
    const id = newId();
    listIds.set(list.id, id);
    return { ...list, id, boardId: copyId };
  });
  const labelIds = new Map<string, string>();
  const labels = state.labels.filter((label) => label.boardId === sourceId && !label.deleted).map((label) => {
    const id = newId();
    labelIds.set(label.id, id);
    return { ...label, id, boardId: copyId };
  });
  board.automationRules = source.automationRules?.flatMap((rule) => {
    const listId = rule.trigger === "button" || rule.trigger === "due" ? "" : listIds.get(rule.listId);
    const labelId = rule.labelId ? labelIds.get(rule.labelId) : undefined;
    if (listId === undefined || rule.action === "add-label" && !labelId) return [];
    return [{ ...rule, id: newId(), listId, labelId, createdAt: rule.trigger === "due" ? new Date().toISOString() : rule.createdAt }];
  });
  const sourceCards = state.cards.filter((card) => {
    if (card.boardId !== sourceId || card.archived || !listIds.has(card.listId)) return false;
    if (card.isTemplate) return options.keepTemplates;
    return options.keepCards;
  });
  const cardIds = new Map(sourceCards.map((card) => [card.id, newId()]));
  const cards = sourceCards.map((card) => ({
    ...structuredClone(card), id: cardIds.get(card.id)!, boardId: copyId, listId: listIds.get(card.listId)!,
    labelIds: card.labelIds.flatMap((id) => labelIds.has(id) ? [labelIds.get(id)!] : []),
    memberIds: [], comments: [], sourceTrelloId: undefined, sourceTrelloShortLink: undefined,
    automationRunKeys: [],
    checklists: card.checklists.map((list) => ({ ...structuredClone(list), id: newId(), items: list.items.map((item) => ({ ...item, id: newId(), linkedCardId: item.linkedCardId ? cardIds.get(item.linkedCardId) ?? item.linkedCardId : undefined })) })),
    attachments: card.attachments.map((item) => ({ ...item, linkedCardId: item.linkedCardId ? cardIds.get(item.linkedCardId) ?? item.linkedCardId : undefined })),
  }));
  return {
    state: { ...state, boards: [...state.boards, board], lists: [...state.lists, ...lists], labels: [...state.labels, ...labels], cards: [...state.cards, ...cards] },
    boardId: copyId, listIds: lists.map((list) => list.id), cardIds: cards.map((card) => card.id),
  };
}

export function moveChecklistItem(card: Card, itemId: string, targetChecklistId: string, beforeItemId?: string): Card {
  const source = card.checklists.find((list) => list.items.some((item) => item.id === itemId));
  const target = card.checklists.find((list) => list.id === targetChecklistId);
  if (!source || !target || itemId === beforeItemId) return card;
  const item = source.items.find((entry) => entry.id === itemId)!;
  const checklists = card.checklists.map((list) => ({ ...list, items: list.items.filter((entry) => entry.id !== itemId) }));
  const destination = checklists.find((list) => list.id === targetChecklistId)!;
  const beforeIndex = beforeItemId ? destination.items.findIndex((entry) => entry.id === beforeItemId) : -1;
  destination.items.splice(beforeIndex < 0 ? destination.items.length : beforeIndex, 0, item);
  return { ...card, checklists };
}

export function convertChecklistItem(state: AppState, cardId: string, checklistId: string, itemId: string, newCardId = newId()): AppState {
  const source = state.cards.find((card) => card.id === cardId);
  const item = source?.checklists.find((list) => list.id === checklistId)?.items.find((entry) => entry.id === itemId);
  if (!source || !isCardAvailable(state, source) || !item || item.linkedCardId || !item.name.trim() || state.cards.some((card) => card.id === newCardId)) return state;
  const following = state.cards.filter((card) => card.listId === source.listId && !card.archived && card.position > source.position).sort((a, b) => a.position - b.position)[0];
  const created: Card = {
    id: newCardId, boardId: source.boardId, listId: source.listId, name: item.name.trim(), description: "",
    position: following ? (source.position + following.position) / 2 : source.position + 1,
    createdAt: new Date().toISOString(), labelIds: [], completed: item.checked, checklists: [], comments: [], attachments: [],
  };
  return { ...state, cards: [...state.cards.map((card) => card.id === cardId
    ? { ...card, checklists: card.checklists.map((list) => list.id === checklistId ? { ...list, items: list.items.filter((entry) => entry.id !== itemId) } : list) }
    : card), created] };
}

const searchOperators = new Set(["board", "list", "label", "member", "name", "description", "checklist", "comment", "due", "has", "is"]);

function searchTokens(query: string): Array<{ operator: string; value: string; negative: boolean }> {
  return (query.match(/(?:[^\s"]|"[^"]*")+/g) ?? []).map((raw) => {
    const negative = raw.startsWith("-");
    const token = negative ? raw.slice(1) : raw;
    const separator = token.indexOf(":");
    const prefix = token.slice(0, separator).toLocaleLowerCase();
    const operator = separator > 0 && searchOperators.has(prefix) ? prefix : token.startsWith("@") ? "member" : token.startsWith("#") ? "label" : "text";
    const value = operator === "text" ? token : operator === "member" && token.startsWith("@") || operator === "label" && token.startsWith("#") ? token.slice(1) : token.slice(separator + 1);
    return { operator, value: value.replace(/^"|"$/g, "").toLocaleLowerCase(), negative };
  });
}

function searchMatch(card: Card, operator: string, value: string, board: Board, list: BoardList | undefined, labels: Label[], now: number): boolean {
  const includes = (text: string) => text.toLocaleLowerCase().includes(value);
  if (!value) return false;
  if (operator === "board") return includes(board.name) || value === board.id.toLocaleLowerCase() || value === board.sourceTrelloId?.toLocaleLowerCase();
  if (operator === "list") return Boolean(list && (includes(list.name) || value === list.id.toLocaleLowerCase()));
  if (operator === "label") return labels.some((label) => includes(label.name) || label.color.toLocaleLowerCase() === value || label.color === trelloLabelColors[value]);
  if (operator === "member") return (board.members ?? []).some((member) => card.memberIds?.includes(member.id) && includes(member.name));
  if (operator === "name") return includes(card.name);
  if (operator === "description") return includes(card.description);
  if (operator === "checklist") return card.checklists.some((checklist) => includes(checklist.name) || checklist.items.some((item) => includes(item.name)));
  if (operator === "comment") return card.comments.some((comment) => includes(comment.text));
  if (operator === "has") return value === "attachments" ? card.attachments.length > 0 : value === "description" ? Boolean(card.description.trim()) : value === "cover" ? Boolean(card.cover) : value === "members" ? Boolean(card.memberIds?.length) : value === "stickers" ? Boolean(card.stickers?.length) : false;
  if (operator === "is") return value === "open" || value === "starred" && board.starred;
  if (operator === "due") {
    if (value === "complete") return Boolean(card.dueAt && card.completed);
    if (value === "incomplete") return Boolean(card.dueAt && !card.completed);
    const due = Date.parse(card.dueAt ?? "");
    if (!Number.isFinite(due)) return false;
    if (value === "overdue") return !card.completed && due < now;
    const days = value === "day" ? 1 : value === "week" ? 7 : value === "month" ? 30 : /^\d+$/.test(value) ? Number(value) : NaN;
    return Number.isFinite(days) && days >= 0 && due >= now && due <= now + days * 86400000;
  }
  return cardText(card).includes(value) || labels.some((label) => includes(label.name));
}

export function searchCards(state: AppState, query: string, now = Date.now()): Card[] {
  const tokens = searchTokens(query.trim());
  if (!tokens.length) return [];
  const boards = new Map(state.boards.filter((board) => !board.archived).map((board) => [board.id, board]));
  const lists = new Map(state.lists.map((list) => [list.id, list]));
  const labels = new Map(state.labels.filter((label) => !label.deleted).map((label) => [label.id, label]));
  return state.cards.filter((card) => {
    const board = boards.get(card.boardId);
    const list = lists.get(card.listId);
    if (card.archived || !board || list?.archived) return false;
    const cardLabels = card.labelIds.map((id) => labels.get(id)).filter((label): label is Label => Boolean(label));
    return tokens.every(({ operator, value, negative }) => searchMatch(card, operator, value, board, list, cardLabels, now) !== negative);
  });
}

export function ancestryFromRevisions(revisions: Revision[], existing: Record<string, string[]> = {}): Record<string, string[]> {
  const ancestry = { ...existing };
  for (const revision of revisions) ancestry[revision.id] ??= revision.parentIds ?? (revision.parentId ? [revision.parentId] : []);
  return ancestry;
}

export function mediaReferences(state: AppState): { fileIds: string[]; missingIds: string[] } {
  const files = new Set<string>();
  const missing = new Set<string>();
  const boardFiles = (board: Board) => { if (board.backgroundImageId) files.add(board.backgroundImageId); };
  const cardFiles = (card: Card) => {
    for (const attachment of card.attachments) {
      if (attachment.status === "local") files.add(attachment.id);
      else if (attachment.status === "missing") missing.add(attachment.id);
    }
    for (const sticker of card.stickers ?? []) if (typeof sticker !== "string") {
      if (sticker.status === "missing") missing.add(sticker.imageId);
      else files.add(sticker.imageId);
    }
  };
  state.boards.forEach(boardFiles);
  state.cards.forEach(cardFiles);
  for (const revision of state.revisions) {
    if (revision.entityKind === "board") boardFiles(revision.snapshot as Board);
    else if (revision.entityKind === "card") cardFiles(revision.snapshot as Card);
  }
  return { fileIds: [...files], missingIds: [...missing].filter((id) => !files.has(id)) };
}

export function markMediaLocal(state: AppState, fileId: string): AppState {
  let changed = false;
  const cards = state.cards.map((card) => {
    const attachments = card.attachments.map((attachment) => attachment.id === fileId && attachment.status !== "link" ? { ...attachment, status: "local" as const } : attachment);
    const stickers = card.stickers?.map((sticker) => typeof sticker !== "string" && sticker.imageId === fileId ? { ...sticker, status: "local" as const } : sticker);
    const attachmentChanged = attachments.some((attachment, index) => attachment !== card.attachments[index]);
    const stickerChanged = stickers?.some((sticker, index) => sticker !== card.stickers?.[index]) ?? false;
    if (!attachmentChanged && !stickerChanged) return card;
    changed = true;
    return { ...card, attachments, stickers };
  });
  return changed ? { ...state, cards } : state;
}

export function recordRevision(state: AppState, kind: EntityKind, entityId: string, deviceId: string): AppState {
  return recordRevisions(state, [{ kind, id: entityId }], deviceId);
}

const revisionLimit = 30;

/** Records revisions for many entities in one pass: linear in the state size however many entities change. */
export function recordRevisions(state: AppState, refs: Array<{ kind: EntityKind; id: string }>, deviceId: string): AppState {
  if (!refs.length) return state;
  const collections: Record<EntityKind, Array<Workspace | Board | BoardList | Card | Label>> = { workspace: state.workspaces, board: state.boards, list: state.lists, label: state.labels, card: state.cards };
  const lookups = new Map<EntityKind, Map<string, Workspace | Board | BoardList | Card | Label>>();
  const find = (kind: EntityKind, id: string) => {
    let lookup = lookups.get(kind);
    if (!lookup) { lookup = new Map(collections[kind].map((item) => [item.id, item])); lookups.set(kind, lookup); }
    return lookup.get(id);
  };
  const revisionById = new Map(state.revisions.map((item) => [item.id, item]));
  let lastByKey: Map<string, string> | undefined;
  const heads = { ...state.heads };
  const ancestry = { ...state.ancestry };
  const revisions = [...state.revisions];
  const activity: ActivityEvent[] = [...(state.activity ?? [])];
  const touched = new Set<string>();
  for (const { kind, id: entityId } of refs) {
    const entity = find(kind, entityId);
    if (!entity) continue;
    const key = `${kind}:${entityId}`;
    let parent = heads[key];
    if (!parent) {
      lastByKey ??= new Map(state.revisions.map((item) => [`${item.entityKind}:${item.entityId}`, item.id]));
      parent = lastByKey.get(key) ?? "";
    }
    const previous = parent ? revisionById.get(parent)?.snapshot : undefined;
    const revision: Revision = {
      id: newId(12), parentIds: parent ? [parent] : [],
      entityKind: kind, entityId, createdAt: new Date().toISOString(), deviceId,
      snapshot: structuredClone(entity),
    };
    revisions.push(revision);
    revisionById.set(revision.id, revision);
    ancestry[revision.id] = revision.parentIds ?? [];
    heads[key] = revision.id;
    touched.add(key);
    const currentBoardId = kind === "board" ? entityId : kind === "workspace" ? undefined : (entity as BoardList | Card | Label).boardId;
    const previousBoardId = kind === "board" ? entityId : kind === "workspace" ? undefined : (previous as BoardList | Card | Label | undefined)?.boardId;
    const name = entity.name;
    const label = kind === "workspace" ? "Workspace" : kind === "board" ? "Board" : kind === "list" ? "List" : kind === "label" ? "Label" : "Card";
    const oldCard = kind === "card" ? previous as Card | undefined : undefined;
    const newCard = kind === "card" ? entity as Card : undefined;
    const oldComments = new Set(oldCard?.comments.map((comment) => comment.id) ?? []);
    const addedComments = newCard?.comments.filter((comment) => !oldComments.has(comment.id)) ?? [];
    const commentOnly = Boolean(oldCard && addedComments.length && JSON.stringify({ ...oldCard, comments: newCard?.comments }) === JSON.stringify(newCard));
    const labelDeletionChanged = kind === "label" && Boolean((previous as Label | undefined)?.deleted) !== Boolean((entity as Label).deleted);
    const summary = !previous ? `${label} “${name}” created` : previousBoardId && currentBoardId !== previousBoardId ? `${label} “${name}” moved to another board` : previous.name !== name ? `${label} renamed: “${name}”` : labelDeletionChanged ? `${label} “${name}” ${(entity as Label).deleted ? "deleted" : "restored"}` : (entity as Trashable).deletedAt !== (previous as Trashable).deletedAt ? `${label} “${name}” ${(entity as Trashable).deletedAt ? "moved to Trash" : "restored from Trash"}` : "archived" in previous && "archived" in entity && previous.archived !== entity.archived ? `${label} “${name}” ${entity.archived ? "archived" : "restored"}` : `${label} “${name}” changed`;
    if (!commentOnly && currentBoardId) activity.push({ id: revision.id, entityKind: kind, entityId, boardId: currentBoardId, previousBoardId, createdAt: revision.createdAt, deviceId, summary, category: "change" });
    for (const comment of addedComments) activity.push({ id: `comment:${comment.id}`, entityKind: kind, entityId, boardId: currentBoardId, createdAt: comment.createdAt, deviceId, summary: `${comment.author}: ${comment.text}`, category: "comment" });
  }
  if (!touched.size) return state;
  // Keep the newest `revisionLimit` revisions of every entity that just got a new one.
  const counts = new Map<string, number>();
  for (const item of revisions) {
    const key = `${item.entityKind}:${item.entityId}`;
    if (touched.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const excess = new Map([...counts].filter(([, total]) => total > revisionLimit).map(([key, total]) => [key, total - revisionLimit]));
  const kept = excess.size ? revisions.filter((item) => {
    const key = `${item.entityKind}:${item.entityId}`;
    const drop = excess.get(key);
    if (!drop) return true;
    excess.set(key, drop - 1);
    return false;
  }) : revisions;
  return { ...state, revisions: kept, activity, heads, ancestry };
}

export function deleteLabel(state: AppState, labelId: string, deviceId: string): AppState {
  const label = state.labels.find((item) => item.id === labelId && !item.deleted);
  if (!label) return state;
  const affectedCards = state.cards.filter((card) => card.labelIds.includes(labelId));
  let next = recordRevision({ ...state,
    labels: state.labels.map((item) => item.id === labelId ? { ...item, deleted: true } : item),
    cards: state.cards.map((card) => card.labelIds.includes(labelId) ? { ...card, labelIds: card.labelIds.filter((id) => id !== labelId) } : card),
  }, "label", labelId, deviceId);
  return recordRevisions(next, affectedCards.map((card) => ({ kind: "card" as const, id: card.id })), deviceId);
}

export function restoreRevision(state: AppState, revision: Revision, deviceId: string): AppState {
  const key = revision.entityKind === "workspace" ? "workspaces" : revision.entityKind === "board" ? "boards" : revision.entityKind === "list" ? "lists" : revision.entityKind === "label" ? "labels" : "cards";
  const collection = state[key] as Array<{ id: string }>;
  const restored = collection.filter((item) => item.id !== revision.entityId);
  restored.push(structuredClone(revision.snapshot));
  return recordRevision({ ...state, [key]: restored }, revision.entityKind, revision.entityId, deviceId);
}
