import { transferCard } from "./cards";
import { newId } from "./ids";
import type { AppState, Board } from "./types";

export function copyList(
  state: AppState,
  listId: string,
  copyId = newId(),
): { state: AppState; listId: string; cardIds: string[] } {
  const source = state.lists.find((list) => list.id === listId && !list.archived);
  if (!source || !state.boards.some((board) => board.id === source.boardId && !board.archived))
    throw new Error("The list cannot be copied.");
  const following = state.lists
    .filter((list) => list.boardId === source.boardId && !list.archived && list.position > source.position)
    .sort((a, b) => a.position - b.position)[0];
  const position = following ? (source.position + following.position) / 2 : source.position + 1;
  const copied = { ...source, id: copyId, name: `${source.name} (copy)`, position };
  let next: AppState = { ...state, lists: [...state.lists, copied] };
  const cardIds: string[] = [];
  for (const card of state.cards
    .filter((item) => item.listId === listId && !item.archived)
    .sort((a, b) => a.position - b.position)) {
    const result = transferCard(next, card.id, copyId, true);
    next = result.state;
    cardIds.push(result.cardId);
  }
  return { state: next, listId: copyId, cardIds };
}

export function copyBoard(
  state: AppState,
  sourceId: string,
  options: { name: string; workspaceId: string; keepCards: boolean; keepTemplates: boolean },
  copyId = newId(),
): { state: AppState; boardId: string; listIds: string[]; cardIds: string[] } {
  const source = state.boards.find((board) => board.id === sourceId && !board.archived);
  if (
    !source ||
    !options.name.trim() ||
    !state.workspaces.some((workspace) => workspace.id === options.workspaceId && !workspace.archived)
  )
    throw new Error("The board or workspace is unavailable.");
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
    .filter((list) => list.boardId === sourceId && !list.archived)
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
    if (card.boardId !== sourceId || card.archived || !listIds.has(card.listId)) return false;
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
