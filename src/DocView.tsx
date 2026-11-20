import { useMemo, useState, type ReactNode } from "react";
import type { AppState, Board, Card } from "./model";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownText } from "./MarkdownText";
import { CardPicker } from "./CardPicker";
import { cardRef, projectSummary, withSummarySnapshot } from "./boardDoc";
import { kanbonkCardForUrl } from "./links";

/**
 * Board + document twin: the project document next to a live, linked summary of the board, so the "why" and the
 * current state live in one place instead of a separate wiki.
 */
export function DocView({
  state,
  board,
  onChange,
  onOpenCard,
  assistant,
}: {
  state: AppState;
  board: Board;
  onChange: (doc: string) => void;
  onOpenCard: (card: Card) => void;
  assistant?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  const doc = board.doc ?? "";
  const summary = useMemo(() => projectSummary(state, board.id), [state, board.id]);
  const cardForUrl = (url: string) => kanbonkCardForUrl(url, state);
  const boardCards = useMemo(
    () => state.cards.filter((item) => item.boardId === board.id && !item.archived),
    [state.cards, board.id],
  );
  return (
    <section className="doc-view" aria-label="Board doc">
      <article className="doc-main">
        <header className="doc-header">
          <h2>Project doc</h2>
          {!editing && (
            <>
              <button onClick={() => setEditing(true)}>{doc ? "Edit" : "Write"}</button>
              <button onClick={() => setLinking(!linking)} aria-expanded={linking}>
                Link a card
              </button>
              <button onClick={() => onChange(withSummarySnapshot(doc, summary))}>Insert status snapshot</button>
            </>
          )}
        </header>
        {linking && !editing && (
          <div className="transfer-picker">
            <CardPicker
              label="Card to link"
              candidates={boardCards}
              onPick={(card) => {
                onChange(`${doc.trimEnd()}${doc.trim() ? "\n" : ""}- ${cardRef(card)}\n`);
                setLinking(false);
              }}
            />
          </div>
        )}
        {editing ? (
          <MarkdownEditor
            value={doc}
            label="Board doc"
            onSave={(value) => {
              if (value !== doc) onChange(value);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : doc ? (
          <div className="doc-body" onDoubleClick={() => setEditing(true)}>
            <MarkdownText text={doc} localCardForUrl={cardForUrl} onNavigateCard={onOpenCard} />
          </div>
        ) : (
          <p className="hint">
            Describe goals, decisions and agreements. Card links open cards right from here, and a status snapshot
            records where the project stands now.
          </p>
        )}
        {assistant}
      </article>
      <aside className="doc-summary" aria-label="Board status">
        <h2>
          Board status <small>updates automatically</small>
        </h2>
        <MarkdownText text={summary} localCardForUrl={cardForUrl} onNavigateCard={onOpenCard} />
      </aside>
    </section>
  );
}
