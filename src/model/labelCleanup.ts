import { deleteLabel } from "./labels";
import { recordRevisions } from "./revisions";
import type { AppState, Board, Label } from "./types";

export interface LabelUsage {
  label: Label;
  /** Cards that carry the label, templates and trashed cards included. */
  cards: number;
  /** Whether an automation rule or the required fields of the board name the label. */
  inRules: boolean;
}

function ruleLabelIds(board?: Board): Set<string> {
  return new Set([
    ...(board?.automationRules ?? []).flatMap((rule) => (rule.labelId ? [rule.labelId] : [])),
    ...(board?.requiredFields?.labelIds ?? []),
  ]);
}

/** The board's labels with how many cards carry each, from the least used to the most. */
export function labelUsage(state: AppState, boardId: string): LabelUsage[] {
  const counts = new Map<string, number>();
  for (const card of state.cards) for (const id of card.labelIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const inRules = ruleLabelIds(state.boards.find((board) => board.id === boardId));
  return state.labels
    .filter((label) => label.boardId === boardId && !label.deleted)
    .map((label) => ({ label, cards: counts.get(label.id) ?? 0, inRules: inRules.has(label.id) }))
    .sort((a, b) => a.cards - b.cards || a.label.name.localeCompare(b.label.name));
}

/** Labels on no card at all and in no automation rule or required field. */
export function unusedLabels(state: AppState, boardId: string): Label[] {
  return labelUsage(state, boardId)
    .filter((usage) => !usage.cards && !usage.inRules)
    .map((usage) => usage.label);
}

/** A label name compared without case and extra spaces. */
const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase();

/** Groups of named labels whose names differ only in case or spaces, each from the most used label to the least. */
export function duplicateLabels(state: AppState, boardId: string): LabelUsage[][] {
  const groups = new Map<string, LabelUsage[]>();
  for (const usage of labelUsage(state, boardId)) {
    const key = nameKey(usage.label.name);
    if (key) groups.set(key, [...(groups.get(key) ?? []), usage]);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => group.sort((a, b) => b.cards - a.cards || a.label.name.localeCompare(b.label.name)));
}

/** Moves the labels to the trash, taking them off their cards. */
export function deleteLabels(state: AppState, labelIds: string[], deviceId: string): AppState {
  return labelIds.reduce((current, id) => deleteLabel(current, id, deviceId), state);
}

/**
 * Merges labels into `keepId`: their cards, automation rules and required fields get it instead, and they go to the
 * trash. The kept label keeps its name and color.
 */
export function mergeLabels(state: AppState, keepId: string, dropIds: string[], deviceId: string): AppState {
  const keep = state.labels.find((label) => label.id === keepId && !label.deleted);
  const drop = new Set(dropIds.filter((id) => id !== keepId));
  if (!keep || !drop.size) return state;
  const swap = (ids: string[]) => [...new Set(ids.map((id) => (drop.has(id) ? keepId : id)))];
  const cards = state.cards.filter((card) => card.labelIds.some((id) => drop.has(id)));
  const board = state.boards.find((item) => item.id === keep.boardId);
  const ruleChange = board && [...ruleLabelIds(board)].some((id) => drop.has(id));
  const cardIds = new Set(cards.map((card) => card.id));
  const swapped = recordRevisions(
    {
      ...state,
      cards: state.cards.map((card) => (cardIds.has(card.id) ? { ...card, labelIds: swap(card.labelIds) } : card)),
      boards: state.boards.map((item) =>
        item === board && ruleChange
          ? {
              ...item,
              automationRules: item.automationRules?.map((rule) =>
                rule.labelId && drop.has(rule.labelId) ? { ...rule, labelId: keepId } : rule,
              ),
              requiredFields: item.requiredFields && {
                ...item.requiredFields,
                labelIds: item.requiredFields.labelIds && swap(item.requiredFields.labelIds),
              },
            }
          : item,
      ),
    },
    [
      ...cards.map((card) => ({ kind: "card" as const, id: card.id })),
      ...(ruleChange ? [{ kind: "board" as const, id: keep.boardId }] : []),
    ],
    deviceId,
  );
  return deleteLabels(swapped, [...drop], deviceId);
}
