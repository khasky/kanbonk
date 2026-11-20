import { useState } from "react";
import type { AppState, Card } from "../model";
import { Icon } from "../ui/Icon";

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
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section
        className="side-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Board activity"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>Activity</h2>
          <button onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="activity-filters">
          <button
            aria-pressed={filter === "all"}
            onClick={() => {
              setFilter("all");
              setLimit(50);
            }}
          >
            All
          </button>
          <button
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
            const card =
              item.entityKind === "card" ? state.cards.find((entry) => entry.id === item.entityId) : undefined;
            return (
              <div className="panel-row activity-row" key={item.id}>
                <span>
                  <strong>{item.summary}</strong>
                  <small>{new Date(item.createdAt).toLocaleString("en-US")}</small>
                </span>
                {card && (
                  <button
                    onClick={() => {
                      onOpenCard(card);
                      onClose();
                    }}
                  >
                    Open
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <p>No activity yet.</p>
        )}
        {entries.length > limit && (
          <button className="activity-more" onClick={() => setLimit((value) => value + 50)}>
            Show more
          </button>
        )}
      </section>
    </div>
  );
}
