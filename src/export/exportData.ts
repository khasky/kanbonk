import { type MessageKey, t } from "../i18n";
import { localDateTime } from "../lib/format";
import type { AppState, Board, BoardList, Card, Checklist, Comment, Label, Member } from "../model";

export type ExportFormat = "xlsx" | "docx" | "pdf" | "trello-csv" | "trello-json";

export const exportFormats: ExportFormat[] = ["xlsx", "docx", "pdf", "trello-csv", "trello-json"];

/** Trello's formats keep Trello's own columns, so only the choice of lists, cards and filters applies to them. */
export const isTrelloFormat = (format: ExportFormat) => format === "trello-csv" || format === "trello-json";

export const exportFields = [
  "list",
  "name",
  "description",
  "labels",
  "members",
  "startDate",
  "dueDate",
  "createdAt",
  "checklists",
  "attachments",
  "comments",
] as const;

export type ExportField = (typeof exportFields)[number];

export const fieldNames: Record<ExportField, MessageKey> = {
  list: "exporting.fieldList",
  name: "exporting.fieldName",
  description: "exporting.fieldDescription",
  labels: "exporting.fieldLabels",
  members: "exporting.fieldMembers",
  startDate: "exporting.fieldStartDate",
  dueDate: "exporting.fieldDueDate",
  createdAt: "exporting.fieldCreatedAt",
  checklists: "exporting.fieldChecklists",
  attachments: "exporting.fieldAttachments",
  comments: "exporting.fieldComments",
};

/** Where checklists go in a spreadsheet: one cell, a column per checklist, a row per item or a column per item. */
export type ChecklistLayout = "inline" | "block" | "row" | "column";

export const checklistLayouts: ChecklistLayout[] = ["inline", "block", "row", "column"];

/** The choices remembered on this device for the next export, on any board. */
export interface ExportSettings {
  format: ExportFormat;
  fields: ExportField[];
  checklistLayout: ChecklistLayout;
  includeTrash: boolean;
  accent: string;
  cover: boolean;
  pagePerList: boolean;
  style: "styled" | "plain";
}

export const defaultExportSettings: ExportSettings = {
  format: "xlsx",
  fields: [...exportFields],
  checklistLayout: "inline",
  includeTrash: false,
  accent: "#0c66e4",
  cover: true,
  pagePerList: false,
  style: "styled",
};

const settingsKey = "kanbonk-export-settings";

export function readExportSettings(): ExportSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) ?? "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return defaultExportSettings;
    const pick = <T>(value: unknown, allowed: readonly T[], fallback: T) =>
      allowed.includes(value as T) ? (value as T) : fallback;
    const flag = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
    const base = defaultExportSettings;
    return {
      format: pick(saved.format, exportFormats, base.format),
      fields: Array.isArray(saved.fields) ? exportFields.filter((field) => saved.fields.includes(field)) : base.fields,
      checklistLayout: pick(saved.checklistLayout, checklistLayouts, base.checklistLayout),
      includeTrash: flag(saved.includeTrash, base.includeTrash),
      accent: typeof saved.accent === "string" && /^#[0-9a-f]{6}$/i.test(saved.accent) ? saved.accent : base.accent,
      cover: flag(saved.cover, base.cover),
      pagePerList: flag(saved.pagePerList, base.pagePerList),
      style: pick(saved.style, ["styled", "plain"] as const, base.style),
    };
  } catch {
    return defaultExportSettings;
  }
}

export function saveExportSettings(settings: ExportSettings) {
  try {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
  } catch {
    // Storage may be full or blocked; the next export then starts from the defaults.
  }
}

/** Narrows the cards of the chosen lists; empty values do not filter. Due dates compare by local calendar day. */
export interface ExportFilter {
  labelId: string;
  memberId: string;
  dueFrom: string;
  dueTo: string;
}

export const emptyExportFilter: ExportFilter = { labelId: "", memberId: "", dueFrom: "", dueTo: "" };

export const filterIsActive = (filter: ExportFilter) => Object.values(filter).some(Boolean);

/** The lists ticked, and the cards unticked inside them. */
export interface ExportPick {
  listIds: Set<string>;
  excludedCardIds: Set<string>;
}

/** A board's lists and cards that can be exported, in board order; trashed ones only with `includeTrash`. */
export interface BoardScope {
  board: Board;
  lists: BoardList[];
  cardsByList: Map<string, Card[]>;
  labels: Label[];
  members: Member[];
}

export function boardScope(state: AppState, boardId: string, includeTrash: boolean): BoardScope | undefined {
  const board = state.boards.find((item) => item.id === boardId);
  if (!board) return undefined;
  const lists = state.lists
    .filter((item) => item.boardId === boardId && (includeTrash || !item.deletedAt))
    .sort((a, b) => a.position - b.position);
  const cardsByList = new Map<string, Card[]>(lists.map((list) => [list.id, []]));
  for (const card of [...state.cards].sort((a, b) => a.position - b.position))
    if (card.boardId === boardId && (includeTrash || !card.deletedAt)) cardsByList.get(card.listId)?.push(card);
  return {
    board,
    lists,
    cardsByList,
    labels: state.labels.filter((item) => item.boardId === boardId && !item.deleted),
    members: board.members ?? [],
  };
}

const localDay = (value: string) => localDateTime(value).slice(0, 10);

export function matchesExportFilter(card: Card, filter: ExportFilter): boolean {
  if (filter.labelId && !card.labelIds.includes(filter.labelId)) return false;
  if (filter.memberId && !card.memberIds?.includes(filter.memberId)) return false;
  if (filter.dueFrom || filter.dueTo) {
    const due = card.dueAt ? localDay(card.dueAt) : "";
    if (!due || (filter.dueFrom && due < filter.dueFrom) || (filter.dueTo && due > filter.dueTo)) return false;
  }
  return true;
}

export interface ExportGroup {
  list: BoardList;
  cards: Card[];
}

/** The ticked lists with their ticked cards that pass the filter; a list left with no cards is dropped. */
export function pickedGroups(scope: BoardScope, pick: ExportPick, filter: ExportFilter): ExportGroup[] {
  return scope.lists
    .filter((list) => pick.listIds.has(list.id))
    .map((list) => ({
      list,
      cards: (scope.cardsByList.get(list.id) ?? []).filter(
        (card) => !pick.excludedCardIds.has(card.id) && matchesExportFilter(card, filter),
      ),
    }))
    .filter((group) => group.cards.length > 0);
}

/** The state narrowed to the picked lists and cards of the board, for the Trello formats. */
export function pickedState(state: AppState, boardId: string, groups: ExportGroup[]): AppState {
  const listIds = new Set(groups.map((group) => group.list.id));
  const cardIds = new Set(groups.flatMap((group) => group.cards.map((card) => card.id)));
  return {
    ...state,
    lists: state.lists.filter((item) => item.boardId !== boardId || listIds.has(item.id)),
    cards: state.cards.filter((item) => item.boardId !== boardId || cardIds.has(item.id)),
  };
}

export const dateText = (value: string | undefined) => (value ? localDateTime(value).replace("T", " ") : "");

const checkMark = (checked: boolean) => (checked ? "[x]" : "[ ]");

const checklistText = (checklist: Checklist) =>
  [checklist.name, ...checklist.items.map((item) => `${checkMark(item.checked)} ${item.name}`)].join("\n");

const commentText = (comment: Comment) => `${comment.author} (${dateText(comment.createdAt)}): ${comment.text}`;

/** Plain-text values of a card's fields, as a spreadsheet cell or a line of a document shows them. */
export function cardFieldText(scope: BoardScope, card: Card, field: ExportField): string {
  switch (field) {
    case "list":
      return scope.lists.find((item) => item.id === card.listId)?.name ?? "";
    case "name":
      return card.name;
    case "description":
      return card.description;
    case "labels":
      return scope.labels
        .filter((item) => card.labelIds.includes(item.id))
        .map((item) => item.name || item.color)
        .join(", ");
    case "members":
      return scope.members
        .filter((item) => card.memberIds?.includes(item.id))
        .map((item) => item.name)
        .join(", ");
    case "startDate":
      return dateText(card.startAt);
    case "dueDate":
      return dateText(card.dueAt);
    case "createdAt":
      return dateText(card.createdAt);
    case "checklists":
      return card.checklists.map(checklistText).join("\n\n");
    case "attachments":
      return card.attachments
        .map((item) =>
          item.sourceUrl && item.sourceUrl !== item.name ? `${item.name} (${item.sourceUrl})` : item.name,
        )
        .join("\n");
    case "comments":
      return card.comments.map(commentText).join("\n\n");
  }
}

export interface ExportTable {
  header: string[];
  rows: string[][];
}

/** The spreadsheet of the picked cards: one row per card (per check item with the "row" layout). */
export function exportTable(
  scope: BoardScope,
  groups: ExportGroup[],
  fields: ExportField[],
  layout: ChecklistLayout,
): ExportTable {
  const cards = groups.flatMap((group) => group.cards);
  const plain = fields.filter((field) => field !== "checklists");
  const header = plain.map((field) => t(fieldNames[field]));
  const base = (card: Card) => plain.map((field) => cardFieldText(scope, card, field));
  if (!fields.includes("checklists")) return { header, rows: cards.map(base) };
  const checklistsAt = fields.indexOf("checklists");
  const insert = (row: string[], extra: string[]) => [
    ...row.slice(0, checklistsAt),
    ...extra,
    ...row.slice(checklistsAt),
  ];
  const width = (count: number, name: (n: number) => string) => Array.from({ length: count }, (_, i) => name(i + 1));
  switch (layout) {
    case "inline":
      return {
        header: insert(header, [t(fieldNames.checklists)]),
        rows: cards.map((card) => insert(base(card), [cardFieldText(scope, card, "checklists")])),
      };
    case "block": {
      const count = Math.max(0, ...cards.map((card) => card.checklists.length));
      return {
        header: insert(
          header,
          width(count, (n) => t("exporting.checklistColumn", { n })),
        ),
        rows: cards.map((card) =>
          insert(
            base(card),
            width(count, (n) => (card.checklists[n - 1] ? checklistText(card.checklists[n - 1]) : "")),
          ),
        ),
      };
    }
    case "column": {
      const items = (card: Card) => card.checklists.flatMap((list) => list.items);
      const count = Math.max(0, ...cards.map((card) => items(card).length));
      return {
        header: insert(
          header,
          width(count, (n) => t("exporting.itemColumn", { n })),
        ),
        rows: cards.map((card) => {
          const own = items(card);
          return insert(
            base(card),
            width(count, (n) => (own[n - 1] ? `${checkMark(own[n - 1].checked)} ${own[n - 1].name}` : "")),
          );
        }),
      };
    }
    case "row":
      return {
        header: insert(header, [t("exporting.checklistName"), t("exporting.checkItem"), t("exporting.itemDone")]),
        rows: cards.flatMap((card) => {
          const row = base(card);
          const items = card.checklists.flatMap((list) =>
            list.items.map((item) => [list.name, item.name, item.checked ? "✓" : ""]),
          );
          return items.length ? items.map((extra) => insert(row, extra)) : [insert(row, ["", "", ""])];
        }),
      };
  }
}

/** One card of a PDF or Word document: its name as a heading, then the chosen fields. */
export interface DocCard {
  id: string;
  name: string;
  details: { label: string; value: string }[];
  description?: string;
  checklists?: Checklist[];
  comments?: { author: string; date: string; text: string }[];
}

export interface DocLook {
  title: string;
  accent: string;
  style: "styled" | "plain";
  cover: boolean;
  pagePerList: boolean;
}

export interface ExportDocModel extends DocLook {
  cardCount: number;
  dueRange?: [string, string];
  exportedAt: string;
  sections: { id: string; name: string; cards: DocCard[] }[];
}

const detailFields: ExportField[] = ["list", "labels", "members", "startDate", "dueDate", "createdAt", "attachments"];

export function exportDocModel(
  scope: BoardScope,
  groups: ExportGroup[],
  fields: ExportField[],
  look: DocLook,
  now = new Date(),
): ExportDocModel {
  const cards = groups.flatMap((group) => group.cards);
  const dues = cards
    .map((card) => card.dueAt)
    .filter((due): due is string => Boolean(due))
    .map(localDay)
    .sort();
  return {
    ...look,
    cardCount: cards.length,
    dueRange: dues.length ? [dues[0], dues[dues.length - 1]] : undefined,
    exportedAt: localDay(now.toISOString()),
    sections: groups.map((group) => ({
      id: group.list.id,
      name: group.list.name,
      cards: group.cards.map((card) => ({
        id: card.id,
        name: card.name,
        details: detailFields
          .filter((field) => fields.includes(field))
          .map((field) => ({ label: t(fieldNames[field]), value: cardFieldText(scope, card, field) }))
          .filter((item) => item.value),
        description: fields.includes("description") && card.description ? card.description : undefined,
        checklists: fields.includes("checklists") && card.checklists.length ? card.checklists : undefined,
        comments:
          fields.includes("comments") && card.comments.length
            ? card.comments.map((comment) => ({
                author: comment.author,
                date: dateText(comment.createdAt),
                text: comment.text,
              }))
            : undefined,
      })),
    })),
  };
}

/** A name safe for a file on any system. */
export const exportFileName = (name: string, extension: string) =>
  `${
    name
      .replace(/[\\/:*?"<>|]+/g, " ")
      .trim()
      .slice(0, 80) || "board"
  }.${extension}`;
