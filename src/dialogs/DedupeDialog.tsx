import { SidePanel } from "../ui/Modal";
import { useMemo, useState } from "react";
import type { AppState, Card } from "../model";
import { findDuplicates, pairKey, type DuplicatePair } from "../model/dedupe";
import { inboxBoardId } from "../model/inbox";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Field";
import { Hint } from "../ui/Hint";
import { optionLabelClass } from "./dialogLook";
import { RowActions } from "../ui/PanelRow";

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
    <SidePanel title="Duplicates across boards" label="Find duplicates" width="wide" closeIcon="×" onClose={onClose}>
      <Hint>Text similarity (word stems, n-grams, TF-IDF) is computed locally; no data leaves this device.</Hint>
      <label className="flex flex-wrap items-center gap-2">
        Similarity threshold: {Math.round(threshold * 100)}%
        <input
          className="accent-brand"
          type="range"
          min={0.3}
          max={0.95}
          step={0.05}
          value={threshold}
          onChange={(event) => setThreshold(Number(event.target.value))}
        />
      </label>
      <label className={`${optionLabelClass} mt-2`}>
        <Checkbox checked={sameBoard} onChange={(event) => setSameBoard(event.target.checked)} />
        Also search within the same board
      </label>
      <p className="text-ink-muted">Pairs found: {pairs.length}</p>
      {pairs.slice(0, 100).map((pair) => (
        <div className="my-2 grid gap-1.5 rounded-md border border-line p-2" key={pairKey(pair.a.id, pair.b.id)}>
          <strong>{Math.round(pair.score * 100)}%</strong>
          {[pair.a, pair.b].map((card) => (
            <button
              key={card.id}
              className="flex cursor-pointer flex-col rounded-sm border-0 bg-surface-soft px-2 py-1.5 text-left text-ink"
              onClick={() => onOpen(card)}
            >
              <span>{card.name}</span>
              <small className="text-ink-muted">{where(card)}</small>
            </button>
          ))}
          <RowActions>
            <Button
              variant="secondary"
              onClick={() => onMerge(pair.a.id, pair.b.id)}
              title="Move the second card’s comments, checklists and attachments into the first, and the second card to the trash"
            >
              Merge into first
            </Button>
            <Button variant="secondary" onClick={() => onMerge(pair.b.id, pair.a.id)}>
              Merge into second
            </Button>
            <Button variant="secondary" onClick={() => onIgnore(pair)}>
              Not a duplicate
            </Button>
          </RowActions>
        </div>
      ))}
    </SidePanel>
  );
}
