import { t } from "../i18n";
import { boardLabel, transferCard } from "./cards";
import { newId } from "./ids";
import type { AppState, Board, Card } from "./types";

export function copyList(
  state: AppState,
  listId: string,
  copyId = newId(),
): { state: AppState; listId: string; cardIds: string[] } {
  const source = state.lists.find((list) => list.id === listId && !list.deletedAt);
  if (!source || !state.boards.some((board) => board.id === source.boardId && !board.deletedAt))
    throw new Error(t("model.listCannotBeCopied"));
  const following = state.lists
    .filter((list) => list.boardId === source.boardId && !list.deletedAt && list.position > source.position)
    .sort((a, b) => a.position - b.position)[0];
  const position = following ? (source.position + following.position) / 2 : source.position + 1;
  const copied = { ...source, id: copyId, name: `${source.name} (copy)`, position };
  let next: AppState = { ...state, lists: [...state.lists, copied] };
  const cardIds: string[] = [];
  for (const card of state.cards
    .filter((item) => item.listId === listId && !item.deletedAt)
    .sort((a, b) => a.position - b.position)) {
    const result = transferCard(next, card.id, copyId, true);
    next = result.state;
    cardIds.push(result.cardId);
  }
  return { state: next, listId: copyId, cardIds };
}

/**
 * Moves a list with its cards to the very start or end of a board. On another board the cards get that board's labels
 * and members, as a moved card does, the list leaves its zone, and the source board's automation rules for the list go
 * with it. Returns the moved cards' ids.
 */
export function moveListToBoard(
  state: AppState,
  listId: string,
  boardId: string,
  atStart: boolean,
): { state: AppState; cardIds: string[] } {
  const source = state.lists.find((list) => list.id === listId && !list.deletedAt);
  const target = state.boards.find((board) => board.id === boardId && !board.deletedAt);
  if (!source || !target) throw new Error(t("model.cardOrListUnavailable"));
  const others = state.lists
    .filter((list) => list.boardId === boardId && list.id !== listId && !list.deletedAt)
    .map((list) => list.position);
  const position = atStart ? Math.min(1, ...others) - 1 : Math.max(0, ...others) + 1;
  const crossBoard = source.boardId !== boardId;
  let next: AppState = {
    ...state,
    lists: state.lists.map((list) =>
      list.id === listId ? { ...list, boardId, position, zoneId: crossBoard ? undefined : list.zoneId } : list,
    ),
  };
  if (!crossBoard) return { state: next, cardIds: [] };

  const cards = state.cards.filter((card) => card.listId === listId);
  for (const card of cards.filter((item) => !item.deletedAt)) next = transferCard(next, card.id, listId, false).state;
  const positions = new Map(cards.map((card) => [card.id, card.position]));
  next.cards = next.cards.map((card): Card => {
    const original = positions.get(card.id);
    if (original === undefined) return card;
    return { ...card, boardId, position: original };
  });

  const sourceBoard = state.boards.find((board) => board.id === source.boardId);
  const rules = sourceBoard?.automationRules?.filter((rule) => rule.listId === listId) ?? [];
  if (rules.length) {
    const labels = [...next.labels];
    const moved = rules.map((rule) => {
      const label = rule.labelId ? state.labels.find((item) => item.id === rule.labelId && !item.deleted) : undefined;
      return label ? { ...rule, labelId: boardLabel(labels, label, boardId).id } : rule;
    });
    next = {
      ...next,
      labels,
      boards: next.boards.map((board) => {
        if (board.id === source.boardId)
          return { ...board, automationRules: board.automationRules?.filter((rule) => rule.listId !== listId) };
        if (board.id === boardId) return { ...board, automationRules: [...(board.automationRules ?? []), ...moved] };
        return board;
      }),
    };
  }
  return { state: next, cardIds: cards.map((card) => card.id) };
}

export function copyBoard(
  state: AppState,
  sourceId: string,
  options: { name: string; workspaceId: string; keepCards: boolean; keepTemplates: boolean },
  copyId = newId(),
): { state: AppState; boardId: string; listIds: string[]; cardIds: string[] } {
  const source = state.boards.find((board) => board.id === sourceId && !board.deletedAt);
  if (
    !source ||
    !options.name.trim() ||
    !state.workspaces.some((workspace) => workspace.id === options.workspaceId && !workspace.deletedAt)
  )
    throw new Error(t("model.boardOrWorkspaceUnavailable"));
  const board: Board = {
    ...structuredClone(source),
    id: copyId,
    workspaceId: options.workspaceId,
    name: options.name.trim(),
    sourceTrelloId: undefined,
    starred: false,
    members: [],
  };
  const listIds = new Map<string, string>();
  const lists = state.lists
    .filter((list) => list.boardId === sourceId && !list.deletedAt)
    .map((list) => {
      const id = newId();
      listIds.set(list.id, id);
      return { ...list, id, boardId: copyId };
    });
  const labelIds = new Map<string, string>();
  const labels = state.labels
    .filter((label) => label.boardId === sourceId && !label.deleted)
    .map((label) => {
      const id = newId();
      labelIds.set(label.id, id);
      return { ...label, id, boardId: copyId };
    });
  board.automationRules = source.automationRules?.flatMap((rule) => {
    const listId = rule.trigger === "button" || rule.trigger === "due" ? "" : listIds.get(rule.listId);
    const labelId = rule.labelId ? labelIds.get(rule.labelId) : undefined;
    if (listId === undefined || (rule.action === "add-label" && !labelId)) return [];
    return [
      {
        ...rule,
        id: newId(),
        listId,
        labelId,
        createdAt: rule.trigger === "due" ? new Date().toISOString() : rule.createdAt,
      },
    ];
  });
  const sourceCards = state.cards.filter((card) => {
    if (card.boardId !== sourceId || card.deletedAt || !listIds.has(card.listId)) return false;
    if (card.isTemplate) return options.keepTemplates;
    return options.keepCards;
  });
  const cardIds = new Map(sourceCards.map((card) => [card.id, newId()]));
  const cards = sourceCards.map((card) => ({
    ...structuredClone(card),
    id: cardIds.get(card.id)!,
    boardId: copyId,
    listId: listIds.get(card.listId)!,
    labelIds: card.labelIds.flatMap((id) => (labelIds.has(id) ? [labelIds.get(id)!] : [])),
    memberIds: [],
    approvals: undefined,
    comments: [],
    sourceTrelloId: undefined,
    sourceTrelloShortLink: undefined,
    automationRunKeys: [],
    checklists: card.checklists.map((list) => ({
      ...structuredClone(list),
      id: newId(),
      items: list.items.map((item) => ({
        ...item,
        id: newId(),
        linkedCardId: item.linkedCardId ? (cardIds.get(item.linkedCardId) ?? item.linkedCardId) : undefined,
      })),
    })),
    attachments: card.attachments.map((item) => ({
      ...item,
      linkedCardId: item.linkedCardId ? (cardIds.get(item.linkedCardId) ?? item.linkedCardId) : undefined,
    })),
  }));
  return {
    state: {
      ...state,
      boards: [...state.boards, board],
      lists: [...state.lists, ...lists],
      labels: [...state.labels, ...labels],
      cards: [...state.cards, ...cards],
    },
    boardId: copyId,
    listIds: lists.map((list) => list.id),
    cardIds: cards.map((card) => card.id),
  };
}
