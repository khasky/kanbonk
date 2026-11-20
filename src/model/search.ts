import { trelloLabelColors } from "../labels";
import type { AppState, Board, BoardFilter, BoardList, Card, Label } from "./types";

const cardTexts = new WeakMap<Card, string>();

/** Lower-cased searchable text of a card, computed once per card object (cards are immutable). */
export function cardText(card: Card): string {
  let text = cardTexts.get(card);
  if (text === undefined) {
    text = [
      card.name,
      card.description,
      ...card.checklists.flatMap((list) => [list.name, ...list.items.map((item) => item.name)]),
      ...card.comments.map((comment) => comment.text),
      ...card.attachments.map((attachment) => attachment.name),
    ]
      .join("\n")
      .toLocaleLowerCase();
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
    if (filter.due === "next-week" && (card.completed || !(due >= now && due <= now + 7 * 24 * 60 * 60 * 1000)))
      return false;
    if (!keyword) return true;
    return cardText(card).includes(keyword);
  });
}

const searchOperators = new Set([
  "board",
  "list",
  "label",
  "member",
  "name",
  "description",
  "checklist",
  "comment",
  "due",
  "has",
  "is",
]);

function searchTokens(query: string): Array<{ operator: string; value: string; negative: boolean }> {
  return (query.match(/(?:[^\s"]|"[^"]*")+/g) ?? []).map((raw) => {
    const negative = raw.startsWith("-");
    const token = negative ? raw.slice(1) : raw;
    const separator = token.indexOf(":");
    const prefix = token.slice(0, separator).toLocaleLowerCase();
    const operator =
      separator > 0 && searchOperators.has(prefix)
        ? prefix
        : token.startsWith("@")
          ? "member"
          : token.startsWith("#")
            ? "label"
            : "text";
    const value =
      operator === "text"
        ? token
        : (operator === "member" && token.startsWith("@")) || (operator === "label" && token.startsWith("#"))
          ? token.slice(1)
          : token.slice(separator + 1);
    return { operator, value: value.replace(/^"|"$/g, "").toLocaleLowerCase(), negative };
  });
}

function searchMatch(
  card: Card,
  operator: string,
  value: string,
  board: Board,
  list: BoardList | undefined,
  labels: Label[],
  now: number,
): boolean {
  const includes = (text: string) => text.toLocaleLowerCase().includes(value);
  if (!value) return false;
  if (operator === "board")
    return (
      includes(board.name) ||
      value === board.id.toLocaleLowerCase() ||
      value === board.sourceTrelloId?.toLocaleLowerCase()
    );
  if (operator === "list") return Boolean(list && (includes(list.name) || value === list.id.toLocaleLowerCase()));
  if (operator === "label")
    return labels.some(
      (label) =>
        includes(label.name) || label.color.toLocaleLowerCase() === value || label.color === trelloLabelColors[value],
    );
  if (operator === "member")
    return (board.members ?? []).some((member) => card.memberIds?.includes(member.id) && includes(member.name));
  if (operator === "name") return includes(card.name);
  if (operator === "description") return includes(card.description);
  if (operator === "checklist")
    return card.checklists.some(
      (checklist) => includes(checklist.name) || checklist.items.some((item) => includes(item.name)),
    );
  if (operator === "comment") return card.comments.some((comment) => includes(comment.text));
  if (operator === "has")
    return value === "attachments"
      ? card.attachments.length > 0
      : value === "description"
        ? Boolean(card.description.trim())
        : value === "cover"
          ? Boolean(card.cover)
          : value === "members"
            ? Boolean(card.memberIds?.length)
            : value === "stickers"
              ? Boolean(card.stickers?.length)
              : false;
  if (operator === "is") return value === "open" || (value === "starred" && board.starred);
  if (operator === "due") {
    if (value === "complete") return Boolean(card.dueAt && card.completed);
    if (value === "incomplete") return Boolean(card.dueAt && !card.completed);
    const due = Date.parse(card.dueAt ?? "");
    if (!Number.isFinite(due)) return false;
    if (value === "overdue") return !card.completed && due < now;
    const days =
      value === "day" ? 1 : value === "week" ? 7 : value === "month" ? 30 : /^\d+$/.test(value) ? Number(value) : NaN;
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
    return tokens.every(
      ({ operator, value, negative }) => searchMatch(card, operator, value, board, list, cardLabels, now) !== negative,
    );
  });
}
