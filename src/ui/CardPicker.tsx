import { Input } from "./Field";
import { useState } from "react";
import type { Card } from "../model";

const resultClass =
  "cursor-pointer rounded-sm border-0 bg-transparent px-1.5 py-[5px] text-left text-ink hover:bg-brand-soft focus:bg-brand-soft";

/**
 * Search box over many cards; shows only the best few matches so huge boards stay fast. `className` adds layout only.
 */
export function CardPicker({
  candidates,
  label,
  className,
  describe = (card) => card.name,
  onPick,
}: {
  candidates: Card[];
  label: string;
  className?: string;
  describe?: (card: Card) => string;
  onPick: (card: Card) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const matches = (
    needle ? candidates.filter((item) => item.name.toLocaleLowerCase().includes(needle)) : candidates
  ).slice(0, 12);
  return (
    <div className={className ? `flex flex-col gap-1.5 ${className}` : "flex flex-col gap-1.5"}>
      <Input
        size="sm"
        type="search"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Find a card"
        aria-label={label}
      />
      <div className="flex max-h-[220px] flex-col overflow-auto" role="listbox" aria-label={`${label}: results`}>
        {matches.map((item) => (
          <button
            className={resultClass}
            role="option"
            aria-selected={false}
            key={item.id}
            onClick={() => onPick(item)}
          >
            {describe(item)}
          </button>
        ))}
        {!matches.length && <small>No matches</small>}
      </div>
    </div>
  );
}
