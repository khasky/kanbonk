import { newId } from "./ids";
import { recordRevision, recordRevisions } from "./revisions";
import type { AppState, Label } from "./types";

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

/** Renames or recolors a label, and every label shared with it on other boards. */
export function updateLabel(state: AppState, id: string, name: string, color: string, deviceId: string): AppState {
  const label = state.labels.find((item) => item.id === id && !item.deleted);
  if (!label) return state;
  const changed = state.labels.filter(
    (item) =>
      !item.deleted &&
      (item.id === id || (label.linkId && item.linkId === label.linkId)) &&
      (item.name !== name || item.color !== color),
  );
  if (!changed.length) return state;
  const ids = new Set(changed.map((item) => item.id));
  return recordRevisions(
    { ...state, labels: state.labels.map((item) => (ids.has(item.id) ? { ...item, name, color } : item)) },
    changed.map((item) => ({ kind: "label" as const, id: item.id })),
    deviceId,
  );
}

const sameName = (a: Label, b: Label) =>
  a.name.trim().toLocaleLowerCase() === b.name.trim().toLocaleLowerCase() &&
  (a.name.trim() !== "" || a.color === b.color);

/**
 * Shares labels with other boards: each board gets the label, or its label of the same name takes the shared name and
 * color, and from then on they stay in sync.
 */
export function shareLabels(state: AppState, labelIds: string[], boardIds: string[], deviceId: string): AppState {
  const labels = [...state.labels];
  const changed = new Set<string>();
  const put = (label: Label) => {
    const index = labels.findIndex((item) => item.id === label.id);
    if (index < 0) labels.push(label);
    else labels[index] = label;
    changed.add(label.id);
  };
  const boards = boardIds.filter((id) => state.boards.some((board) => board.id === id && !board.deletedAt));
  for (const id of labelIds) {
    const source = labels.find((item) => item.id === id && !item.deleted);
    if (!source) continue;
    const linkId = source.linkId ?? newId();
    if (!source.linkId) put({ ...source, linkId });
    for (const boardId of boards) {
      if (boardId === source.boardId) continue;
      const onBoard = labels.filter((item) => item.boardId === boardId && !item.deleted);
      const target = onBoard.find((item) => item.linkId === linkId) ?? onBoard.find((item) => sameName(item, source));
      if (!target) put({ id: newId(), boardId, name: source.name, color: source.color, linkId });
      else if (target.linkId !== linkId || target.name !== source.name || target.color !== source.color)
        put({ ...target, name: source.name, color: source.color, linkId });
    }
  }
  return recordRevisions(
    { ...state, labels },
    [...changed].map((id) => ({ kind: "label" as const, id })),
    deviceId,
  );
}
