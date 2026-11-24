import { startTransition, useEffect, useRef, useState, type ReactNode } from "react";
import type { Card } from "../model";
import { t } from "../i18n";

/**
 * Renders a list's cards only while the list is near the viewport, and long lists in pages: the next page mounts when
 * the end of the list scrolls into view. Keeps the DOM small on boards with thousands of cards.
 *
 * While a card is dragged over the list, `slot` is where it would land: a gap of the card's height at `index` among
 * the list's cards other than the dragged one (`draggedId`, which `render` hides).
 */
export function ListCards({
  cards,
  render,
  draggedId,
  slot,
}: {
  cards: Card[];
  render: (card: Card) => ReactNode;
  draggedId?: string;
  slot?: { index: number; height: number };
}) {
  const [limit, setLimit] = useState(listPageSize);
  const [near, setNear] = useState(false);
  const stack = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const more = near && cards.length > limit;
  useEffect(() => {
    const element = stack.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        startTransition(() => setNear(visible));
      },
      { rootMargin: "200px 600px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: limit is a trigger; a new observer reports the sentinel again if it is still in view.
  useEffect(() => {
    const element = sentinel.current;
    if (!more || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setLimit((value) => value + listPageSize);
      },
      { rootMargin: "600px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [more, limit]);
  if (!near)
    return (
      <div
        ref={stack}
        className="flex min-h-0.5 flex-col gap-[7px] overflow-auto px-0.5"
        data-count={cards.length}
        style={{ height: Math.min(cards.length, listPageSize) * 44 }}
        aria-label={t("board.cardsCount", { count: cards.length })}
      />
    );
  return (
    <div ref={stack} className="flex min-h-0.5 flex-col gap-[7px] overflow-auto px-0.5" data-count={cards.length}>
      {withSlot(cards.slice(0, limit), render, draggedId, slot)}
      {more && (
        <div ref={sentinel} className="py-1.5">
          <button
            className="w-full cursor-pointer rounded-md border-0 bg-[#091e420f] p-1.5"
            onClick={() => setLimit((value) => value + listPageSize)}
          >
            {t("board.showMoreOf", { count: Math.min(listPageSize, cards.length - limit), rest: cards.length - limit })}
          </button>
        </div>
      )}
    </div>
  );
}

export const listPageSize = 40;

function withSlot(
  cards: Card[],
  render: (card: Card) => ReactNode,
  draggedId: string | undefined,
  slot: { index: number; height: number } | undefined,
): ReactNode[] {
  const gap = slot && (
    <div
      key="drop-slot"
      className="flex-none rounded-lg bg-[#091e4224]"
      style={{ height: slot.height }}
      aria-hidden
      data-drop-slot="card"
    />
  );
  const rendered: ReactNode[] = [];
  let index = 0;
  for (const card of cards) {
    if (card.id !== draggedId) {
      if (index === slot?.index) rendered.push(gap);
      index++;
    }
    rendered.push(render(card));
  }
  if (slot && slot.index >= index) rendered.push(gap);
  return rendered;
}
