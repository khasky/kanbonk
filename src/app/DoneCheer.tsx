import { useEffect, useRef, useState } from "react";
import type { AppState } from "../model";

const pieces = Array.from({ length: 36 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 9) * 40}ms`,
  drift: `${((index * 53) % 120) - 60}px`,
  color: ["#4bce97", "#fca700", "#579dff", "#f87168", "#9f8fef", "#eed12b"][index % 6],
}));

/**
 * Confetti when a card was just finished, here or on a synced device, on a board that celebrates finished cards.
 * Decorative only: the card's Done button and tile say it is done.
 */
export function DoneCheer({ state }: { state: AppState }) {
  const seen = useRef<Set<string> | null>(null);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    const before = seen.current;
    seen.current = new Set(state.cards.filter((card) => card.doneAt).map((card) => card.id));
    if (!before) return;
    const now = Date.now();
    const fresh = state.cards.some(
      (card) =>
        card.doneAt &&
        !before.has(card.id) &&
        now - Date.parse(card.doneAt) < 5_000 &&
        !state.boards.find((board) => board.id === card.boardId)?.cardDone?.quiet,
    );
    if (fresh) setBurst(now);
  }, [state.cards, state.boards]);
  useEffect(() => {
    if (!burst) return;
    const timer = setTimeout(() => setBurst(0), 1_800);
    return () => clearTimeout(timer);
  }, [burst]);
  if (!burst) return null;
  return (
    <div key={burst} className="done-cheer pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {pieces.map((piece) => (
        <span
          key={piece.left}
          style={{
            left: piece.left,
            background: piece.color,
            animationDelay: piece.delay,
            ["--drift" as string]: piece.drift,
          }}
        />
      ))}
    </div>
  );
}
