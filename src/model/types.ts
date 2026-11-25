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
  starred: boolean;
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
  cover?: { attachmentId?: string; color?: string; size: "normal" | "full" };
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
  due: "any" | "overdue" | "next-week" | "none";
}

export const emptyBoardFilter = (): BoardFilter => ({
  keyword: "",
  labelId: "",
  memberId: "",
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
