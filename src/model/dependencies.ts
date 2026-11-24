import { t } from "../i18n";
import { isCardAvailable } from "./cards";
import { newId } from "./ids";
import type { AppState } from "./types";

export function linkDependency(state: AppState, dependentId: string, prerequisiteId: string): AppState {
  const dependent = state.cards.find((card) => card.id === dependentId && !card.deletedAt);
  const prerequisite = state.cards.find((card) => card.id === prerequisiteId && !card.deletedAt);
  if (
    !dependent ||
    !prerequisite ||
    dependentId === prerequisiteId ||
    !isCardAvailable(state, dependent) ||
    !isCardAvailable(state, prerequisite)
  )
    throw new Error(t("model.dependencyUnavailable"));
  const checklist = dependent.checklists.find((item) => item.name === "Dependencies");
  if (
    checklist?.items.some((item) => item.linkedCardId === prerequisiteId) &&
    prerequisite.attachments.some((item) => item.linkedCardId === dependentId)
  )
    return state;
  const checklists = dependent.checklists.map((item) =>
    item.id === checklist?.id && !item.items.some((entry) => entry.linkedCardId === prerequisiteId)
      ? {
          ...item,
          items: [
            ...item.items,
            { id: newId(), name: prerequisite.name, checked: false, linkedCardId: prerequisiteId },
          ],
        }
      : item,
  );
  if (!checklist)
    checklists.push({
      id: newId(),
      name: "Dependencies",
      items: [{ id: newId(), name: prerequisite.name, checked: false, linkedCardId: prerequisiteId }],
    });
  const attachments = prerequisite.attachments.some((item) => item.linkedCardId === dependentId)
    ? prerequisite.attachments
    : [
        ...prerequisite.attachments,
        {
          id: newId(),
          name: dependent.name,
          mimeType: "text/uri-list",
          size: 0,
          status: "link" as const,
          linkedCardId: dependentId,
        },
      ];
  return {
    ...state,
    cards: state.cards.map((card) =>
      card.id === dependentId ? { ...card, checklists } : card.id === prerequisiteId ? { ...card, attachments } : card,
    ),
  };
}

export function unlinkDependency(state: AppState, dependentId: string, prerequisiteId: string): AppState {
  const dependent = state.cards.find((card) => card.id === dependentId);
  const prerequisite = state.cards.find((card) => card.id === prerequisiteId);
  const hasChecklistLink = dependent?.checklists.some((list) =>
    list.items.some((item) => item.linkedCardId === prerequisiteId),
  );
  const hasAttachmentLink = prerequisite?.attachments.some((item) => item.linkedCardId === dependentId);
  if (!hasChecklistLink && !hasAttachmentLink) return state;
  return {
    ...state,
    cards: state.cards.map((card) =>
      card.id === dependentId && hasChecklistLink
        ? {
            ...card,
            checklists: card.checklists.map((list) => ({
              ...list,
              items: list.items.filter((item) => item.linkedCardId !== prerequisiteId),
            })),
          }
        : card.id === prerequisiteId && hasAttachmentLink
          ? { ...card, attachments: card.attachments.filter((item) => item.linkedCardId !== dependentId) }
          : card,
    ),
  };
}
