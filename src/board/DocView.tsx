import { useMemo, useState, type ReactNode } from "react";
import type { AppState, Board, Card } from "../model";
import { MarkdownEditor } from "../ui/MarkdownEditor";
import { MarkdownText } from "../ui/MarkdownText";
import { CardPicker } from "../ui/CardPicker";
import { cardRef, projectSummary, withSummarySnapshot } from "../model/boardDoc";
import { kanbonkCardForUrl } from "../model/links";
import { Button } from "../ui/Button";
import { Hint } from "../ui/Hint";

const paneClass = "min-w-0 rounded-[10px] bg-white px-5 py-4 shadow-tile";

/** The "Link a card" box. */
const linkBoxClass =
  "mt-0 mr-0 mb-[15px] ml-[34px] flex flex-col gap-2 rounded-md border border-line p-3 max-phone:ml-0";

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
    () => state.cards.filter((item) => item.boardId === board.id && !item.deletedAt),
    [state.cards, board.id],
  );
  return (
    <section
      className="grid h-full grid-cols-[minmax(0,1fr)_minmax(280px,420px)] items-start gap-4 overflow-auto p-4 max-[901px]:grid-cols-[1fr]"
      aria-label="Board doc"
    >
      <article className={paneClass}>
        <header className="flex flex-wrap items-center gap-2">
          <h2 className="my-0 mr-auto ml-0 text-[18px]">Project doc</h2>
          {!editing && (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                {doc ? "Edit" : "Write"}
              </Button>
              <Button variant="secondary" onClick={() => setLinking(!linking)} aria-expanded={linking}>
                Link a card
              </Button>
              <Button variant="secondary" onClick={() => onChange(withSummarySnapshot(doc, summary))}>
                Insert status snapshot
              </Button>
            </>
          )}
        </header>
        {linking && !editing && (
          <div className={linkBoxClass}>
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
          <div onDoubleClick={() => setEditing(true)}>
            <MarkdownText text={doc} localCardForUrl={cardForUrl} onNavigateCard={onOpenCard} />
          </div>
        ) : (
          <Hint>
            Describe goals, decisions and agreements. Card links open cards right from here, and a status snapshot
            records where the project stands now.
          </Hint>
        )}
        {assistant}
      </article>
      <aside className={paneClass} aria-label="Board status">
        <h2 className="mx-0 mt-0 mb-2 text-[16px]">
          Board status <small className="text-[12px] font-normal text-ink-muted">updates automatically</small>
        </h2>
        <MarkdownText text={summary} look="summary" localCardForUrl={cardForUrl} onNavigateCard={onOpenCard} />
      </aside>
    </section>
  );
}
