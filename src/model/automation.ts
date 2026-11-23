import { isCardAvailable, newId, recordRevision, type AppState, type AutomationRule, type Card } from "./index";
import { trashSubCards } from "./trash";

function applyAction(state: AppState, boardId: string, card: Card, rule: AutomationRule): Card {
  // The rule trashes only the card; trashSubCards then sends its sub-cards along, as deleting it by hand does.
  if (rule.action === "trash")
    return card.deletedAt ? card : { ...card, deletedAt: new Date().toISOString(), deletedBatch: newId() };
  if (
    rule.action === "add-label" &&
    rule.labelId &&
    state.labels.some((label) => label.id === rule.labelId && label.boardId === boardId && !label.deleted) &&
    !card.labelIds.includes(rule.labelId)
  ) {
    return { ...card, labelIds: [...card.labelIds, rule.labelId] };
  }
  return card;
}

export function applyMoveRules(state: AppState, before: Card, after: Card): Card {
  if (before.boardId === after.boardId && before.listId === after.listId) return after;
  const board = state.boards.find((item) => item.id === after.boardId && !item.deletedAt);
  const list = state.lists.find((item) => item.id === after.listId && item.boardId === board?.id && !item.deletedAt);
  if (!board || !list) return after;
  return (board.automationRules ?? [])
    .filter((rule) => (rule.trigger === undefined || rule.trigger === "move") && rule.listId === list.id)
    .reduce((card, rule) => applyAction(state, board.id, card, rule), after);
}

export function applyDueRules(state: AppState, now: number, deviceId: string): AppState {
  let next = state;
  for (const original of state.cards) {
    if (!original.dueAt || original.isTemplate || !isCardAvailable(state, original)) continue;
    const due = Date.parse(original.dueAt);
    if (!Number.isFinite(due)) continue;
    const board = state.boards.find((item) => item.id === original.boardId);
    const rules = (board?.automationRules ?? []).filter((rule) => {
      if (rule.trigger !== "due") return false;
      const triggerTime = due - (rule.leadMinutes ?? 0) * 60_000;
      return triggerTime <= now && (!rule.createdAt || Date.parse(rule.createdAt) <= triggerTime);
    });
    let card = original;
    for (const rule of rules) {
      const key = `${rule.id}:${original.dueAt}`;
      if (card.automationRunKeys?.includes(key)) continue;
      card = {
        ...applyAction(state, original.boardId, card, rule),
        automationRunKeys: [...(card.automationRunKeys ?? []), key],
      };
    }
    if (card === original) continue;
    next = trashSubCards(
      recordRevision(
        { ...next, cards: next.cards.map((item) => (item.id === card.id ? card : item)) },
        "card",
        card.id,
        deviceId,
      ),
      card.id,
      deviceId,
    );
  }
  return next;
}

export function applyCardButton(state: AppState, card: Card, ruleId: string): Card {
  if (card.isTemplate || !isCardAvailable(state, card)) return card;
  const board = state.boards.find((item) => item.id === card.boardId);
  const rule = board?.automationRules?.find((item) => item.id === ruleId && item.trigger === "button");
  return board && rule ? applyAction(state, board.id, card, rule) : card;
}
