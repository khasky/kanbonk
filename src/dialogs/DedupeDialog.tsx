import { Modal } from "../ui/Modal";
import { useMemo, useState } from "react";
import type { AppState, Card } from "../model";
import { findDuplicates, pairKey, type DuplicatePair } from "../model/dedupe";
import { inboxBoardId } from "../model/inbox";

export function DedupeDialog({
  state,
  ignored,
  onIgnore,
  onMerge,
  onOpen,
  onClose,
}: {
  state: AppState;
  ignored: Set<string>;
  onIgnore: (pair: DuplicatePair) => void;
  onMerge: (keepId: string, dropId: string) => void;
  onOpen: (card: Card) => void;
  onClose: () => void;
}) {
  const [threshold, setThreshold] = useState(0.55);
  const [sameBoard, setSameBoard] = useState(false);
  const cards = useMemo(
    () => ({ ...state, cards: state.cards.filter((card) => card.boardId !== inboxBoardId || sameBoard) }),
    [state, sameBoard],
  );
  const pairs = useMemo(
    () => findDuplicates(cards, { threshold, crossBoardOnly: !sameBoard, ignored }),
    [cards, threshold, sameBoard, ignored],
  );
  const where = (card: Card) =>
    `${state.boards.find((board) => board.id === card.boardId)?.name ?? ""} / ${state.lists.find((list) => list.id === card.listId)?.name ?? ""}`;
  return (
    <Modal label="Find duplicates" className="side-panel dedupe-panel" onDismiss={onClose}>
      <header>
        <h2>Duplicates across boards</h2>
        <button onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <p className="hint">
        Text similarity (word stems, n-grams, TF-IDF) is computed locally; no data leaves this device.
      </p>
      <label>
        Similarity threshold: {Math.round(threshold * 100)}%
        <input
          type="range"
          min={0.3}
          max={0.95}
          step={0.05}
          value={threshold}
          onChange={(event) => setThreshold(Number(event.target.value))}
        />
      </label>
      <label className="copy-option">
        <input type="checkbox" checked={sameBoard} onChange={(event) => setSameBoard(event.target.checked)} />
        Also search within the same board
      </label>
      <p>Pairs found: {pairs.length}</p>
      {pairs.slice(0, 100).map((pair) => (
        <div className="dedupe-pair" key={pairKey(pair.a.id, pair.b.id)}>
          <strong>{Math.round(pair.score * 100)}%</strong>
          {[pair.a, pair.b].map((card) => (
            <button key={card.id} className="dedupe-card" onClick={() => onOpen(card)}>
              <span>{card.name}</span>
              <small>{where(card)}</small>
            </button>
          ))}
          <div className="row-actions">
            <button
              onClick={() => onMerge(pair.a.id, pair.b.id)}
              title="Move the second card’s comments, checklists and attachments into the first, and the second card to the trash"
            >
              Merge into first
            </button>
            <button onClick={() => onMerge(pair.b.id, pair.a.id)}>Merge into second</button>
            <button onClick={() => onIgnore(pair)}>Not a duplicate</button>
          </div>
        </div>
      ))}
    </Modal>
  );
}
