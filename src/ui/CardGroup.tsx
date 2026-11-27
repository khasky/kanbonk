import type { ReactNode } from "react";
import type { Card } from "../model";
import { Hint } from "./Hint";

/**
 * A titled group of cards with its count, each card a row that opens it with a short note after its name (its list,
 * its due date). `label` names the group for screen readers when `title` is not plain text.
 */
export function CardGroup({
  title,
  label,
  cards,
  note,
  empty,
  onOpen,
}: {
  title: ReactNode;
  label?: string;
  cards: Card[];
  note: (card: Card) => string | undefined;
  empty: string;
  onOpen: (card: Card) => void;
}) {
  return (
    <section className="mb-2 grid gap-1" aria-label={label ?? (typeof title === "string" ? title : undefined)}>
      <h3 className="m-0 flex items-center gap-2 text-[14px]">
        {title}
        <span className="font-normal text-ink-subtle">{cards.length}</span>
      </h3>
      {cards.length ? (
        <ul className="m-0 grid list-none gap-0.5 p-0">
          {cards.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-baseline gap-2 rounded-sm border-0 bg-transparent px-1 py-1 text-left text-ink hover:bg-surface-sunken"
                onClick={() => onOpen(card)}
              >
                <span className="min-w-0 flex-1 truncate">{card.name}</span>
                <span className="flex-none text-[12px] text-ink-subtle">{note(card)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Hint tone="subtle" className="m-0">
          {empty}
        </Hint>
      )}
    </section>
  );
}
