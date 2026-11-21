import { startTransition, useEffect, useRef, useState, type ReactNode } from "react";
import type { Card } from "../model";

/** Renders a long list in pages: the next page mounts when the end of the list scrolls into view. */
/**
 * Renders a list's cards only while the list is near the viewport, and long lists in pages: the next page mounts when
 * the end of the list scrolls into view. Keeps the DOM small on boards with thousands of cards.
 */
export function ListCards({ cards, render }: { cards: Card[]; render: (card: Card) => ReactNode }) {
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
        aria-label={`Cards: ${cards.length}`}
      />
    );
  return (
    <div ref={stack} className="flex min-h-0.5 flex-col gap-[7px] overflow-auto px-0.5" data-count={cards.length}>
      {cards.slice(0, limit).map(render)}
      {more && (
        <div ref={sentinel} className="py-1.5">
          <button
            className="w-full cursor-pointer rounded-md border-0 bg-[#091e420f] p-1.5"
            onClick={() => setLimit((value) => value + listPageSize)}
          >
            Show {Math.min(listPageSize, cards.length - limit)} more of {cards.length - limit}
          </button>
        </div>
      )}
    </div>
  );
}

export const listPageSize = 40;
