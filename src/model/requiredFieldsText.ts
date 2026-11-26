import { t } from "../i18n";
import type { MissingField } from "./requiredFields";
import type { AppState, Card } from "./types";

/** A short line for what a card lacks, e.g. "No due date"; `name` finds a member's or a label's name by id. */
export function missingFieldText(item: MissingField, name: (id: string) => string | undefined): string {
  switch (item.kind) {
    case "description":
      return t("required.noDescription");
    case "members":
      return t("required.noMembers");
    case "start":
      return t("required.noStart");
    case "due":
      return t("required.noDue");
    case "labels":
      return t("required.noLabels");
    case "checklists":
      return t("required.noChecklist");
    case "checklist-items":
      return t("required.checklistIncomplete", { done: item.done, total: item.total });
    case "member":
      return t("required.needsMember", { name: name(item.id) ?? "?" });
    case "label":
      return t("required.needsLabel", { name: name(item.id) ?? "?" });
    case "description-text":
      return t(
        item.op === "equals"
          ? "required.descriptionEquals"
          : item.op === "starts-with"
            ? "required.descriptionStartsWith"
            : "required.descriptionContains",
        { text: item.text },
      );
    case "checklist-name":
      return t("required.noNamedChecklist", { name: item.name });
  }
}

/** Why a card stays in its list: its name and what it lacks. */
export function moveBlockedText(state: AppState, card: Card, missing: MissingField[]): string {
  const members = state.boards.find((board) => board.id === card.boardId)?.members ?? [];
  const name = (id: string) =>
    state.labels.find((label) => label.id === id)?.name ?? members.find((member) => member.id === id)?.name;
  return t("required.moveBlocked", {
    name: card.name,
    missing: missing.map((item) => missingFieldText(item, name)).join(", "),
  });
}
