import { t } from "../i18n";
import { newId } from "./ids";
import { priorityRank } from "./priority";
import type { AppState, BoardList, Card, Label } from "./types";

export function isCardAvailable(state: AppState, card?: Card): boolean {
  return Boolean(
    card &&
      !card.deletedAt &&
      state.boards.some((board) => board.id === card.boardId && !board.deletedAt) &&
      state.lists.some((list) => list.id === card.listId && !list.deletedAt),
  );
}

export function positionBefore(cards: Card[], movingId: string, target: Card): number {
  const siblings = cards
    .filter((card) => card.listId === target.listId && card.id !== movingId && !card.deletedAt)
    .sort((a, b) => a.position - b.position);
  const targetIndex = siblings.findIndex((card) => card.id === target.id);
  if (targetIndex < 1) return target.position - 1;
  return (siblings[targetIndex - 1].position + target.position) / 2;
}

/** The position that puts a card `index`-th (from 0) among the other cards of a list. */
export function positionAt(cards: Card[], listId: string, movingId: string, index: number): number {
  const others = cards
    .filter((card) => card.listId === listId && card.id !== movingId && !card.deletedAt)
    .sort((a, b) => a.position - b.position);
  if (!others.length) return 1;
  if (index <= 0) return others[0].position - 1;
  if (index >= others.length) return others[others.length - 1].position + 1;
  return (others[index - 1].position + others[index].position) / 2;
}

export function reorderLists(lists: BoardList[], movingId: string, targetId: string, after = false): BoardList[] {
  const moving = lists.find((list) => list.id === movingId && !list.deletedAt);
  const target = lists.find((list) => list.id === targetId && !list.deletedAt);
  if (!moving || !target || moving.id === target.id || moving.boardId !== target.boardId) return lists;
  const ordered = lists
    .filter((list) => list.boardId === moving.boardId && !list.deletedAt && list.id !== movingId)
    .sort((a, b) => a.position - b.position);
  const targetIndex = ordered.findIndex((list) => list.id === targetId);
  ordered.splice(targetIndex + Number(after), 0, moving);
  const positions = new Map(ordered.map((list, index) => [list.id, index + 1]));
  return lists.map((list) => (positions.has(list.id) ? { ...list, position: positions.get(list.id)! } : list));
}

export type ListSort =
  | "name"
  | "due"
  | "newest"
  | "oldest"
  | "most-viewed"
  | "least-viewed"
  | "recently-viewed"
  | "least-recently-viewed"
  | "priority-high"
  | "priority-low";

/**
 * Orders a list's cards by name, by due date (cards without one last), by when they were created, or by their views
 * (`views`: count and last view per card; never-viewed cards count as viewed least and longest ago), or by priority
 * either way (cards without one last). Ties keep their current order.
 */
export function sortListCards(
  cards: Card[],
  listId: string,
  by: ListSort,
  views: Map<string, { total: number; lastAt?: string }> = new Map(),
): Card[] {
  const created = (card: Card) => (card.createdAt ? Date.parse(card.createdAt) : 0);
  const due = (card: Card) => (card.dueAt ? Date.parse(card.dueAt) : Infinity);
  const viewCount = (card: Card) => views.get(card.id)?.total ?? 0;
  const lastView = (card: Card) => views.get(card.id)?.lastAt ?? "";
  const compare: Record<ListSort, (a: Card, b: Card) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    due: (a, b) => due(a) - due(b),
    newest: (a, b) => created(b) - created(a),
    oldest: (a, b) => created(a) - created(b),
    "most-viewed": (a, b) => viewCount(b) - viewCount(a),
    "least-viewed": (a, b) => viewCount(a) - viewCount(b),
    "recently-viewed": (a, b) => lastView(b).localeCompare(lastView(a)),
    "least-recently-viewed": (a, b) => lastView(a).localeCompare(lastView(b)),
    "priority-high": (a, b) => priorityRank(a) - priorityRank(b),
    "priority-low": (a, b) =>
      !a.priority || !b.priority ? priorityRank(a) - priorityRank(b) : priorityRank(b) - priorityRank(a),
  };
  const sorted = cards
    .filter((card) => card.listId === listId && !card.deletedAt)
    .sort((a, b) => compare[by](a, b) || a.position - b.position);
  const positions = new Map(sorted.map((card, index) => [card.id, index + 1]));
  return cards.map((card) => (positions.has(card.id) ? { ...card, position: positions.get(card.id)! } : card));
}

/** The label of `boardId` with the name and color of `source`, added to `labels` when the board has none. */
export function boardLabel(labels: Label[], source: Label, boardId: string): Label {
  const onBoard = labels.filter((item) => item.boardId === boardId && !item.deleted);
  let label =
    (source.linkId ? onBoard.find((item) => item.linkId === source.linkId) : undefined) ??
    onBoard.find((item) => item.name === source.name && item.color === source.color);
  if (!label) {
    label = { ...source, id: newId(), boardId };
    labels.push(label);
  }
  return label;
}

/** Moves or copies a card to the bottom of a list (or its top with `top`), on this or another board. */
export function transferCard(
  state: AppState,
  cardId: string,
  targetListId: string,
  copy: boolean,
  copyId?: string,
  top = false,
): { state: AppState; cardId: string } {
  const source = state.cards.find((card) => card.id === cardId && !card.deletedAt);
  const targetList = state.lists.find((list) => list.id === targetListId && !list.deletedAt);
  const targetBoard = state.boards.find((board) => board.id === targetList?.boardId && !board.deletedAt);
  if (!source || !targetList || !targetBoard) throw new Error(t("model.cardOrListUnavailable"));

  const crossBoard = source.boardId !== targetBoard.id;
  const labels = [...state.labels];
  const labelIds = crossBoard
    ? source.labelIds.flatMap((id) => {
        const sourceLabel = state.labels.find((label) => label.id === id && !label.deleted);
        return sourceLabel ? [boardLabel(labels, sourceLabel, targetBoard.id).id] : [];
      })
    : [...source.labelIds];

  const sourceMembers = state.boards.find((board) => board.id === source.boardId)?.members ?? [];
  const memberIds = crossBoard
    ? (source.memberIds ?? []).flatMap((id) => {
        const member = sourceMembers.find((item) => item.id === id);
        const targetMember = targetBoard.members?.find(
          (item) => item.id === id || (member && item.name === member.name),
        );
        return targetMember ? [targetMember.id] : [];
      })
    : [...(source.memberIds ?? [])];

  const others = state.cards
    .filter((card) => card.listId === targetListId && (copy || card.id !== cardId) && !card.deletedAt)
    .map((card) => card.position);
  const position = top ? Math.min(1, ...others) - 1 : Math.max(0, ...others) + 1;
  const transferred: Card = {
    ...structuredClone(source),
    id: copy ? (copyId ?? newId()) : source.id,
    boardId: targetBoard.id,
    listId: targetListId,
    position,
    labelIds,
    memberIds,
    ...(copy
      ? {
          createdAt: new Date().toISOString(),
          sourceTrelloId: undefined,
          sourceTrelloShortLink: undefined,
          automationRunKeys: [],
          checklists: source.checklists.map((list) => ({
            ...structuredClone(list),
            id: newId(),
            items: list.items.map((item) => ({ ...item, id: newId() })),
          })),
          comments: source.comments.map((comment) => ({ ...comment, id: newId() })),
        }
      : {}),
  };
  return {
    state: {
      ...state,
      labels,
      cards: copy
        ? [...state.cards, transferred]
        : state.cards.map((card) => (card.id === cardId ? transferred : card)),
    },
    cardId: transferred.id,
  };
}

/** "<name> - Clone", with one more " - Clone" for each card of the board that already has the name. */
export function cloneCardName(state: AppState, cardId: string): string {
  const source = state.cards.find((card) => card.id === cardId);
  if (!source) throw new Error(t("model.cardNotFound"));
  const taken = new Set(state.cards.filter((card) => card.boardId === source.boardId).map((card) => card.name));
  let name = `${source.name} - Clone`;
  while (taken.has(name)) name += " - Clone";
  return name;
}

/** Copies a card under the name from `cloneCardName` right below the original in the same list. */
export function cloneCard(state: AppState, cardId: string, copyId = newId()): { state: AppState; cardId: string } {
  const source = state.cards.find((card) => card.id === cardId);
  if (!source) throw new Error(t("model.cardNotFound"));
  const copied = transferCard(state, cardId, source.listId, true, copyId).state;
  const next = copied.cards
    .filter(
      (card) =>
        card.listId === source.listId && card.id !== copyId && !card.deletedAt && card.position > source.position,
    )
    .sort((a, b) => a.position - b.position)[0];
  const position = next ? (source.position + next.position) / 2 : source.position + 1;
  return {
    state: {
      ...copied,
      cards: copied.cards.map((card) =>
        card.id === copyId ? { ...card, name: cloneCardName(state, cardId), position } : card,
      ),
    },
    cardId: copyId,
  };
}

/** Creates a sub-card in the parent's list, below the parent and its existing sub-cards. */
export function createSubCard(
  state: AppState,
  parentId: string,
  name: string,
  id = newId(),
  now = new Date().toISOString(),
): AppState {
  const parent = state.cards.find((card) => card.id === parentId);
  if (!parent) throw new Error(t("model.cardNotFound"));
  const siblings = state.cards.filter((card) => card.listId === parent.listId && !card.deletedAt);
  const after = Math.max(
    parent.position,
    ...siblings.filter((card) => card.parentCardId === parentId).map((card) => card.position),
  );
  const next = siblings.filter((card) => card.position > after).sort((a, b) => a.position - b.position)[0];
  const created: Card = {
    id,
    boardId: parent.boardId,
    listId: parent.listId,
    name,
    description: "",
    createdAt: now,
    position: next ? (after + next.position) / 2 : after + 1,
    labelIds: [],
    checklists: [],
    comments: [],
    attachments: [],
    parentCardId: parentId,
  };
  return { ...state, cards: [...state.cards, created] };
}

/** Sub-cards of a card, in board order. */
export function subCards(state: AppState, cardId: string): Card[] {
  return state.cards.filter((card) => card.parentCardId === cardId).sort((a, b) => a.position - b.position);
}

/** Cards that may become the parent of `cardId` without creating a cycle. */
export function parentCandidates(state: AppState, cardId: string): Card[] {
  const blocked = new Set([cardId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const card of state.cards)
      if (card.parentCardId && blocked.has(card.parentCardId) && !blocked.has(card.id)) {
        blocked.add(card.id);
        grew = true;
      }
  }
  return state.cards.filter((card) => !blocked.has(card.id) && !card.deletedAt && !card.isTemplate);
}

export function createCardFromTemplate(
  state: AppState,
  templateId: string,
  targetListId: string,
  name: string,
  copyId = newId(),
): { state: AppState; cardId: string } {
  const template = state.cards.find((card) => card.id === templateId && card.isTemplate);
  const target = state.lists.find((list) => list.id === targetListId && !list.deletedAt);
  if (!template || !target || template.boardId !== target.boardId)
    throw new Error(t("model.templateOrListUnavailable"));
  const result = transferCard(state, templateId, targetListId, true, copyId);
  return {
    state: {
      ...result.state,
      cards: result.state.cards.map((card) =>
        card.id === templateId
          ? template
          : card.id === copyId
            ? {
                ...card,
                name: name.trim() || template.name,
                isTemplate: false,
                startAt: undefined,
                dueAt: undefined,
                dueReminderMinutes: undefined,
                comments: [],
              }
            : card,
      ),
    },
    cardId: copyId,
  };
}

export function moveChecklistItem(card: Card, itemId: string, targetChecklistId: string, beforeItemId?: string): Card {
  const source = card.checklists.find((list) => list.items.some((item) => item.id === itemId));
  const target = card.checklists.find((list) => list.id === targetChecklistId);
  if (!source || !target || itemId === beforeItemId) return card;
  const item = source.items.find((entry) => entry.id === itemId)!;
  const checklists = card.checklists.map((list) => ({
    ...list,
    items: list.items.filter((entry) => entry.id !== itemId),
  }));
  const destination = checklists.find((list) => list.id === targetChecklistId)!;
  const beforeIndex = beforeItemId ? destination.items.findIndex((entry) => entry.id === beforeItemId) : -1;
  destination.items.splice(beforeIndex < 0 ? destination.items.length : beforeIndex, 0, item);
  return { ...card, checklists };
}

export function convertChecklistItem(
  state: AppState,
  cardId: string,
  checklistId: string,
  itemId: string,
  newCardId = newId(),
): AppState {
  const source = state.cards.find((card) => card.id === cardId);
  const item = source?.checklists.find((list) => list.id === checklistId)?.items.find((entry) => entry.id === itemId);
  if (
    !source ||
    !isCardAvailable(state, source) ||
    !item ||
    item.linkedCardId ||
    !item.name.trim() ||
    state.cards.some((card) => card.id === newCardId)
  )
    return state;
  const following = state.cards
    .filter((card) => card.listId === source.listId && !card.deletedAt && card.position > source.position)
    .sort((a, b) => a.position - b.position)[0];
  const created: Card = {
    id: newCardId,
    boardId: source.boardId,
    listId: source.listId,
    name: item.name.trim(),
    description: "",
    position: following ? (source.position + following.position) / 2 : source.position + 1,
    createdAt: new Date().toISOString(),
    labelIds: [],
    checklists: [],
    comments: [],
    attachments: [],
  };
  return {
    ...state,
    cards: [
      ...state.cards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              checklists: card.checklists.map((list) =>
                list.id === checklistId ? { ...list, items: list.items.filter((entry) => entry.id !== itemId) } : list,
              ),
            }
          : card,
      ),
      created,
    ],
  };
}
