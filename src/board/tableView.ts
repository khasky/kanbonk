import { type MessageKey, t } from "../i18n";
import { csvTable } from "../export/calendarFiles";
import { localDateTime } from "../lib/format";
import { type AppState, type Board, type BoardFilter, type BoardList, type Card, priorities } from "../model";
import { filterBoardCards } from "../model/search";
import type { SortDirection } from "../ui/Table";

/** A column of the Table view besides the card's name, which is always shown. */
export type TableColumn =
  | "board"
  | "list"
  | "labels"
  | "members"
  | "start"
  | "due"
  | "priority"
  | "done"
  | "checklist"
  | "attachments"
  | "comments"
  | "created";

/** The columns one can show, in their order; "board" shows only with cards of other boards. */
export const tableColumns: TableColumn[] = [
  "list",
  "labels",
  "members",
  "start",
  "due",
  "priority",
  "done",
  "checklist",
  "attachments",
  "comments",
  "created",
];
export const defaultColumns: TableColumn[] = ["list", "labels", "members", "due", "priority", "checklist"];

export const columnNames: Record<TableColumn | "name", MessageKey> = {
  name: "table.card",
  board: "table.board",
  list: "table.list",
  labels: "table.labels",
  members: "table.members",
  start: "table.start",
  due: "table.due",
  priority: "table.priority",
  done: "table.done",
  checklist: "table.checklist",
  attachments: "table.attachments",
  comments: "table.comments",
  created: "table.created",
};

export interface TableSort {
  by: TableColumn | "name";
  direction: SortDirection;
}

/** A card with its board and list. */
export interface TableRow {
  card: Card;
  board?: Board;
  list?: BoardList;
}

/** The other open boards of the board's workspace, by name. */
export function workspaceBoards(state: AppState, boardId: string): Board[] {
  const board = state.boards.find((item) => item.id === boardId);
  return state.boards
    .filter((item) => item.id !== boardId && item.workspaceId === board?.workspaceId && !item.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The cards of the board as its filter shows them, then those of the other boards (filtered by keyword, due date and
 * priority: labels and members belong to one board), without templates, by board, list and position.
 */
export function tableRows(
  state: AppState,
  boardId: string,
  otherBoardIds: string[],
  filter: BoardFilter,
  now = Date.now(),
): TableRow[] {
  const boards = new Map(state.boards.map((board) => [board.id, board]));
  const lists = new Map(state.lists.map((list) => [list.id, list]));
  const others = otherBoardIds.filter((id) => id !== boardId && boards.has(id) && !boards.get(id)?.deletedAt);
  return [boardId, ...others].flatMap((id) =>
    filterBoardCards(state, id, id === boardId ? filter : { ...filter, labelId: "", memberId: "" }, now)
      .filter((card) => !card.isTemplate)
      .map((card) => ({ card, board: boards.get(id), list: lists.get(card.listId) }))
      .sort((a, b) => (a.list?.position ?? 0) - (b.list?.position ?? 0) || a.card.position - b.card.position),
  );
}

/** How many checklist items of the card are checked, of how many. */
export function checklistProgress(card: Card) {
  const items = card.checklists.flatMap((checklist) => checklist.items);
  return { done: items.filter((item) => item.checked).length, total: items.length };
}

function sortValue(state: AppState, row: TableRow, by: TableSort["by"]): string | number | undefined {
  const { card } = row;
  switch (by) {
    case "name":
      return card.name;
    case "board":
      return row.board?.name;
    case "list":
      return row.list?.name;
    case "labels":
      return labelNames(state, card) || undefined;
    case "members":
      return memberNames(row) || undefined;
    case "start":
      return card.startAt;
    case "due":
      return card.dueAt;
    case "priority":
      return card.priority && priorities.indexOf(card.priority);
    case "done":
      return card.doneAt;
    case "checklist": {
      const { done, total } = checklistProgress(card);
      return total ? done / total : undefined;
    }
    case "attachments":
      return card.attachments.length;
    case "comments":
      return card.comments.length;
    case "created":
      return card.createdAt;
  }
}

/** The rows sorted by a column; rows without a value come last either way. */
export function sortRows(state: AppState, rows: TableRow[], sort: TableSort): TableRow[] {
  const sign = sort.direction === "ascending" ? 1 : -1;
  return rows
    .map((row) => ({ row, value: sortValue(state, row, sort.by) }))
    .sort((a, b) => {
      if (a.value === undefined || b.value === undefined)
        return a.value === b.value ? 0 : a.value === undefined ? 1 : -1;
      const order =
        typeof a.value === "number" && typeof b.value === "number"
          ? a.value - b.value
          : String(a.value).localeCompare(String(b.value), undefined, { numeric: true });
      return order * sign;
    })
    .map((item) => item.row);
}

/** Whether all, some or none of the cards have something. */
export function tickState(cards: Card[], has: (card: Card) => boolean): "all" | "some" | "none" {
  const count = cards.filter(has).length;
  return count === 0 ? "none" : count === cards.length ? "all" : "some";
}

/** The ids with `id` added ("all"), removed ("none") or left as they are ("some"). */
export function applyTick(ids: string[], id: string, tick: "all" | "some" | "none"): string[] {
  if (tick === "all") return ids.includes(id) ? ids : [...ids, id];
  if (tick === "none") return ids.filter((item) => item !== id);
  return ids;
}

function labelNames(state: AppState, card: Card) {
  return card.labelIds
    .flatMap((id) => state.labels.find((label) => label.id === id && !label.deleted) ?? [])
    .map((label) => label.name || label.color)
    .join(", ");
}

function memberNames(row: TableRow) {
  return (row.card.memberIds ?? [])
    .flatMap((id) => row.board?.members?.find((member) => member.id === id) ?? [])
    .map((member) => member.name)
    .join(", ");
}

const dateCell = (iso?: string) => (iso ? localDateTime(iso).replace("T", " ") : "");

/** The rows as CSV with the card's name and the given columns. */
export function tableCsv(state: AppState, rows: TableRow[], columns: TableColumn[]): string {
  const cell = (row: TableRow, column: TableColumn): string => {
    const { card } = row;
    switch (column) {
      case "board":
        return row.board?.name ?? "";
      case "list":
        return row.list?.name ?? "";
      case "labels":
        return labelNames(state, card);
      case "members":
        return memberNames(row);
      case "start":
        return dateCell(card.startAt);
      case "due":
        return dateCell(card.dueAt);
      case "priority":
        return card.priority ? t(`priority.${card.priority}`) : "";
      case "done":
        return dateCell(card.doneAt);
      case "checklist": {
        const { done, total } = checklistProgress(card);
        return total ? `${done}/${total}` : "";
      }
      case "attachments":
        return String(card.attachments.length);
      case "comments":
        return String(card.comments.length);
      case "created":
        return dateCell(card.createdAt);
    }
  };
  return csvTable([
    [t(columnNames.name), ...columns.map((column) => t(columnNames[column]))],
    ...rows.map((row) => [row.card.name, ...columns.map((column) => cell(row, column))]),
  ]);
}
