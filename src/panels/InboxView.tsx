import { useState } from "react";
import { CardCover } from "../card/CardCover";
import { CardStickers } from "../card/CardStickers";
import { inboxBoardId } from "../model/inbox";
import { emptyBoardFilter, filterBoardCards, type AppState, type BoardFilter } from "../model";
import { Icon } from "../ui/Icon";

export function InboxView({
  state,
  onCreate,
  onOpen,
}: {
  state: AppState;
  onCreate: (name: string) => void;
  onOpen: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<BoardFilter["status"]>("all");
  const [due, setDue] = useState<BoardFilter["due"]>("any");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const cards = filterBoardCards(state, inboxBoardId, { ...emptyBoardFilter(), keyword, status, due }).sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name)
      : sort === "newest"
        ? b.position - a.position
        : a.position - b.position,
  );
  function addCard() {
    if (!draft.trim()) return;
    onCreate(draft);
    setDraft("");
  }
  return (
    <section className="inbox-view" aria-label="Inbox">
      <header>
        <div>
          <h1>Inbox</h1>
          <p>Collect ideas and tasks here, then move them to a board.</p>
        </div>
      </header>
      <form
        className="inbox-compose"
        onSubmit={(event) => {
          event.preventDefault();
          addCard();
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a card"
          aria-label="New card in inbox"
          required
        />
        <button className="primary-button" type="submit">
          Add
        </button>
      </form>
      <div className="inbox-filters">
        <input
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Search inbox"
          aria-label="Search inbox"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as BoardFilter["status"])}
          aria-label="Inbox status"
        >
          <option value="all">Any status</option>
          <option value="complete">Completed</option>
          <option value="incomplete">Not completed</option>
        </select>
        <select
          value={due}
          onChange={(event) => setDue(event.target.value as BoardFilter["due"])}
          aria-label="Inbox due date"
        >
          <option value="any">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="next-week">Next 7 days</option>
          <option value="none">No due date</option>
        </select>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as typeof sort)}
          aria-label="Inbox sorting"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">By title</option>
        </select>
      </div>
      <div className="inbox-cards">
        {cards.map((card) => (
          <button className="card-tile" key={card.id} onClick={() => onOpen(card.id)}>
            <CardCover card={card} />
            <CardStickers card={card} />
            <span className="card-name">
              {card.completed && <span className="complete-mark">✓</span>}
              {card.name}
            </span>
            <span className="card-meta">
              {card.dueAt && (
                <span>
                  <Icon name="clock" /> {new Date(card.dueAt).toLocaleDateString()}
                </span>
              )}
              {card.checklists.length > 0 && (
                <span>
                  ☑{" "}
                  {card.checklists.reduce((count, list) => count + list.items.filter((item) => item.checked).length, 0)}
                  /{card.checklists.reduce((count, list) => count + list.items.length, 0)}
                </span>
              )}
              {card.attachments.length > 0 && (
                <span>
                  <Icon name="clip" /> {card.attachments.length}
                </span>
              )}
            </span>
          </button>
        ))}
        {!cards.length && (
          <p className="inbox-empty">
            {keyword || status !== "all" || due !== "any" ? "Nothing found" : "No cards in your inbox yet"}
          </p>
        )}
      </div>
    </section>
  );
}
