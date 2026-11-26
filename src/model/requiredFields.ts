import type { AppState, Card, RequiredFields } from "./types";

/** One thing a card lacks under its board's required fields. */
export type MissingField =
  | { kind: "description" | "members" | "start" | "due" | "labels" | "checklists" }
  | { kind: "description-text"; op: NonNullable<RequiredFields["descriptionRule"]>["op"]; text: string }
  | { kind: "checklist-items"; done: number; total: number }
  | { kind: "member" | "label"; id: string }
  | { kind: "checklist-name"; name: string };

export const descriptionRuleOps = ["contains", "equals", "starts-with"] as const;
const flags = [
  "description",
  "members",
  "startDate",
  "dueDate",
  "labels",
  "checklists",
  "checklistsDone",
  "blockMoves",
];

const normal = (text: string) => text.trim().toLocaleLowerCase();

/** What the card lacks under the rules, in the order the rules are listed; templates need nothing. */
export function missingFields(card: Card, rules: RequiredFields | undefined): MissingField[] {
  if (!rules || card.isTemplate) return [];
  const missing: MissingField[] = [];
  const members = card.memberIds ?? [];
  const items = card.checklists.flatMap((checklist) => checklist.items);
  if (rules.description && !card.description.trim()) missing.push({ kind: "description" });
  if (rules.members && !members.length) missing.push({ kind: "members" });
  if (rules.startDate && !card.startAt) missing.push({ kind: "start" });
  if (rules.dueDate && !card.dueAt) missing.push({ kind: "due" });
  if (rules.labels && !card.labelIds.length) missing.push({ kind: "labels" });
  if (rules.checklists && !card.checklists.length) missing.push({ kind: "checklists" });
  const done = items.filter((item) => item.checked).length;
  if (rules.checklistsDone && done < items.length) missing.push({ kind: "checklist-items", done, total: items.length });
  for (const id of rules.memberIds ?? []) if (!members.includes(id)) missing.push({ kind: "member", id });
  for (const id of rules.labelIds ?? []) if (!card.labelIds.includes(id)) missing.push({ kind: "label", id });
  const rule = rules.descriptionRule;
  if (rule?.text.trim()) {
    const [description, text] = [normal(card.description), normal(rule.text)];
    const met =
      rule.op === "equals"
        ? description === text
        : rule.op === "starts-with"
          ? description.startsWith(text)
          : description.includes(text);
    if (!met) missing.push({ kind: "description-text", op: rule.op, text: rule.text.trim() });
  }
  const name = rules.checklistName?.trim();
  if (name && !card.checklists.some((checklist) => normal(checklist.name) === normal(name)))
    missing.push({ kind: "checklist-name", name });
  return missing;
}

/**
 * What keeps the card in its list: the fields it lacks when its board blocks moves and `targetListId` is another list.
 * Empty when the move may go ahead.
 */
export function blockedMove(state: AppState, card: Card, targetListId: string): MissingField[] {
  if (card.listId === targetListId) return [];
  const rules = state.boards.find((board) => board.id === card.boardId)?.requiredFields;
  return rules?.blockMoves ? missingFields(card, rules) : [];
}

export function isRequiredFields(value: unknown): value is RequiredFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rules = value as Record<string, unknown>;
  const strings = (list: unknown) =>
    list === undefined || (Array.isArray(list) && list.every((id) => typeof id === "string"));
  const rule = rules.descriptionRule as Record<string, unknown> | undefined;
  return (
    flags.every((key) => rules[key] === undefined || typeof rules[key] === "boolean") &&
    strings(rules.memberIds) &&
    strings(rules.labelIds) &&
    (rule === undefined ||
      (typeof rule === "object" &&
        rule !== null &&
        descriptionRuleOps.includes(rule.op as (typeof descriptionRuleOps)[number]) &&
        typeof rule.text === "string")) &&
    (rules.checklistName === undefined || typeof rules.checklistName === "string")
  );
}
