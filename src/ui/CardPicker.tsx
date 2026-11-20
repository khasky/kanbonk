import { useState } from "react";
import type { Card } from "../model";
/** Search box over many cards; shows only the best few matches so huge boards stay fast. */
export function CardPicker({
  candidates,
  label,
  describe = (card) => card.name,
  onPick,
}: {
  candidates: Card[];
  label: string;
  describe?: (card: Card) => string;
  onPick: (card: Card) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const matches = (
    needle ? candidates.filter((item) => item.name.toLocaleLowerCase().includes(needle)) : candidates
  ).slice(0, 12);
  return (
    <div className="card-picker">
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Find a card"
        aria-label={label}
      />
      <div className="card-picker-results" role="listbox" aria-label={`${label}: results`}>
        {matches.map((item) => (
          <button role="option" aria-selected={false} key={item.id} onClick={() => onPick(item)}>
            {describe(item)}
          </button>
        ))}
        {!matches.length && <small>No matches</small>}
      </div>
    </div>
  );
}
