export type EntityKind = "workspace" | "board" | "list" | "card" | "label";

export interface Trashable {
  deletedAt?: string;
  deletedBatch?: string;
}

export interface Workspace extends Trashable {
  id: string;
  name: string;
  sourceTrelloId?: string;
}

export interface AutomationRule {
  id: string;
  listId: string;
  trigger?: "move" | "button" | "due";
  name?: string;
  createdAt?: string;
  leadMinutes?: number;
  action: "trash" | "add-label";
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
  /** Cards that have not changed for a week or more fade ("regular") or yellow and tear ("pirate"); off when unset. */
  cardAging?: "regular" | "pirate";
  /** What every card on the board must have; see model/requiredFields. */
  requiredFields?: RequiredFields;
  /** What finishing a card does on this board; see model/cardDone. */
  cardDone?: CardDoneSettings;
  starred: boolean;
}

/** What happens to a card of the board when it is finished with its Done button. */
export interface CardDoneSettings {
  /** The list a finished card goes to, on this board or another; it stays in its list when unset. */
  listId?: string;
  /** To the top of that list rather than the bottom. */
  top?: boolean;
  /** A card moved into that list by hand is finished too, and one moved out of it is no longer. */
  markInList?: boolean;
  checkItems?: boolean;
  clearDue?: boolean;
  clearLabels?: boolean;
  clearMembers?: boolean;
  /** Moves the finished card to the trash instead. */
  trash?: boolean;
  /** No celebration when a card is finished. */
  quiet?: boolean;
}

/** Fields every card on a board must have, checked on the card and, with `blockMoves`, before it leaves its list. */
export interface RequiredFields {
  description?: boolean;
  members?: boolean;
  startDate?: boolean;
  dueDate?: boolean;
  labels?: boolean;
  checklists?: boolean;
  /** Every item of every checklist is checked. */
  checklistsDone?: boolean;
  /** Members and labels every card must have. */
  memberIds?: string[];
  labelIds?: string[];
  /** Compared without case and surrounding spaces. */
  descriptionRule?: { op: "contains" | "equals" | "starts-with"; text: string };
  /** A checklist of this name, without case. */
  checklistName?: string;
  /** A card that lacks a field stays in its list. */
  blockMoves?: boolean;
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
  /** A Trello color name from `listColors`; the list shows its light shade. */
  color?: string;
}

export interface Label {
  id: string;
  boardId: string;
  name: string;
  color: string;
  deleted?: boolean;
  /** Labels with the same `linkId` are one label shared between boards: a change to one goes to all of them. */
  linkId?: string;
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
  /** When it was attached (ISO); absent on attachments saved before it was recorded. */
  addedAt?: string;
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
  automationRunKeys?: string[];
  checklists: Checklist[];
  comments: Comment[];
  attachments: Attachment[];
  /** Always shown at the normal size; "full" survives only in data saved before that size was dropped. */
  cover?: { attachmentId?: string; color?: string; size: "normal" | "full" };
  sourceTrelloId?: string;
  sourceTrelloShortLink?: string;
  isTemplate?: boolean;
  /** Parent card for sub-cards. */
  parentCardId?: string;
  /** Cards with the same `mirrorId` mirror each other; see model/mirrors. */
  mirrorId?: string;
  /** How urgent the card is; none when unset. See model/priority. */
  priority?: Priority;
  /** When the card was finished (ISO); see model/cardDone. */
  doneAt?: string;
}

export type Priority = "critical" | "high" | "medium" | "low";

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

/**
 * How often one device viewed a board or a card on one local day. Only that device changes its counter, so syncing
 * devices keep the larger count. `id` is `kind:entityId:deviceId:day`.
 */
export interface ViewCount {
  id: string;
  kind: "board" | "card";
  entityId: string;
  boardId: string;
  deviceId: string;
  /** The device's author name when it last counted a view; views count per person by this name. */
  author: string;
  day: string;
  count: number;
  lastAt: string;
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
  /** Board visits and card views, kept outside the history. */
  views?: ViewCount[];
}

export interface BoardFilter {
  keyword: string;
  labelId: string;
  memberId?: string;
  due: "any" | "overdue" | "next-week" | "none";
  /** A priority, "none" for cards without one, or empty for any. */
  priority?: Priority | "none" | "";
}

export const emptyBoardFilter = (): BoardFilter => ({
  keyword: "",
  labelId: "",
  memberId: "",
  priority: "",
  due: "any",
});

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
