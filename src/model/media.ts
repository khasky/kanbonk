import type { AppState, Board, Card } from "./types";

export function mediaReferences(state: AppState): { fileIds: string[]; missingIds: string[] } {
  const files = new Set<string>();
  const missing = new Set<string>();
  const boardFiles = (board: Board) => {
    if (board.backgroundImageId) files.add(board.backgroundImageId);
  };
  const cardFiles = (card: Card) => {
    for (const attachment of card.attachments) {
      if (attachment.status === "local") files.add(attachment.id);
      else if (attachment.status === "missing") missing.add(attachment.id);
    }
  };
  state.boards.forEach(boardFiles);
  state.cards.forEach(cardFiles);
  for (const revision of state.revisions) {
    if (revision.entityKind === "board") boardFiles(revision.snapshot as Board);
    else if (revision.entityKind === "card") cardFiles(revision.snapshot as Card);
  }
  return { fileIds: [...files], missingIds: [...missing].filter((id) => !files.has(id)) };
}

export function markMediaLocal(state: AppState, fileId: string): AppState {
  let changed = false;
  const cards = state.cards.map((card) => {
    const attachments = card.attachments.map((attachment) =>
      attachment.id === fileId && attachment.status !== "link"
        ? { ...attachment, status: "local" as const }
        : attachment,
    );
    const attachmentChanged = attachments.some((attachment, index) => attachment !== card.attachments[index]);
    if (!attachmentChanged) return card;
    changed = true;
    return { ...card, attachments };
  });
  return changed ? { ...state, cards } : state;
}
