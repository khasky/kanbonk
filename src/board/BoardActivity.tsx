import { SidePanel } from "../ui/Modal";
import { useState } from "react";
import type { AppState, Card } from "../model";
import { Button } from "../ui/Button";
import { PanelRow, PanelRowNote, PanelRowText } from "../ui/PanelRow";

const filterClass =
  "rounded-sm border-0 bg-surface-sunken px-3 py-2 text-ink aria-pressed:bg-brand-soft aria-pressed:font-bold aria-pressed:text-brand";

export function BoardActivity({
  state,
  boardId,
  onClose,
  onOpenCard,
}: {
  state: AppState;
  boardId: string;
  onClose: () => void;
  onOpenCard: (card: Card) => void;
}) {
  const [filter, setFilter] = useState<"all" | "comment">("all");
  const [limit, setLimit] = useState(50);
  const entries = (state.activity ?? [])
    .filter(
      (item) =>
        (item.boardId === boardId || item.previousBoardId === boardId) &&
        (filter === "all" || item.category === "comment"),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  return (
    <SidePanel title="Activity" label="Board activity" onClose={onClose}>
      <div className="flex gap-2 border-b border-line py-3.5">
        <button
          className={filterClass}
          aria-pressed={filter === "all"}
          onClick={() => {
            setFilter("all");
            setLimit(50);
          }}
        >
          All
        </button>
        <button
          className={filterClass}
          aria-pressed={filter === "comment"}
          onClick={() => {
            setFilter("comment");
            setLimit(50);
          }}
        >
          Comments
        </button>
      </div>
      {entries.length ? (
        entries.slice(0, limit).map((item) => {
          const card = item.entityKind === "card" ? state.cards.find((entry) => entry.id === item.entityId) : undefined;
          return (
            <PanelRow key={item.id}>
              <PanelRowText>
                <strong className="font-normal wrap-anywhere whitespace-pre-wrap">{item.summary}</strong>
                <PanelRowNote>{new Date(item.createdAt).toLocaleString("en-US")}</PanelRowNote>
              </PanelRowText>
              {card && (
                <Button
                  variant="secondary"
                  className="flex-none"
                  onClick={() => {
                    onOpenCard(card);
                    onClose();
                  }}
                >
                  Open
                </Button>
              )}
            </PanelRow>
          );
        })
      ) : (
        <p className="text-ink-muted">No activity yet.</p>
      )}
      {entries.length > limit && (
        <Button variant="secondary" size="lg" className="mt-3.5 w-full" onClick={() => setLimit((value) => value + 50)}>
          Show more
        </Button>
      )}
    </SidePanel>
  );
}
