import { recordRevision, recordRevisions } from "./revisions";
import type { AppState } from "./types";

export function deleteLabel(state: AppState, labelId: string, deviceId: string): AppState {
  const label = state.labels.find((item) => item.id === labelId && !item.deleted);
  if (!label) return state;
  const affectedCards = state.cards.filter((card) => card.labelIds.includes(labelId));
  const next = recordRevision(
    {
      ...state,
      labels: state.labels.map((item) => (item.id === labelId ? { ...item, deleted: true } : item)),
      cards: state.cards.map((card) =>
        card.labelIds.includes(labelId) ? { ...card, labelIds: card.labelIds.filter((id) => id !== labelId) } : card,
      ),
    },
    "label",
    labelId,
    deviceId,
  );
  return recordRevisions(
    next,
    affectedCards.map((card) => ({ kind: "card" as const, id: card.id })),
    deviceId,
  );
}
