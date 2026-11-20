import { useState } from "react";
import { CardPicker } from "../ui/CardPicker";
import type { relatedCards } from "../links";
import { type AppState, type Card, isCardAvailable, parentCandidates } from "../model";

/** Cards this card depends on and cards it blocks. */
export function DependencySummary({
  card,
  prerequisiteCards,
  dependentCards,
  onNavigateCard,
}: {
  card: Card;
  prerequisiteCards: Card[];
  dependentCards: Card[];
  onNavigateCard: (target: Card) => void;
}) {
  return (
    <section className="detail-section dependency-summary">
      <h3>Dependencies</h3>
      {prerequisiteCards.length > 0 && (
        <p>
          Depends on:{" "}
          {prerequisiteCards.map((item) => (
            <button key={item.id} onClick={() => onNavigateCard(item)}>
              {item.completed ? "✓" : "⏳"} {item.name}
            </button>
          ))}
        </p>
      )}
      {prerequisiteCards.some((item) => !item.completed) && !card.completed && (
        <p className="blocked-note">Card is blocked: not all dependencies are complete.</p>
      )}
      {dependentCards.length > 0 && (
        <p>
          Blocks:{" "}
          {dependentCards.map((item) => (
            <button key={item.id} onClick={() => onNavigateCard(item)}>
              {item.name}
            </button>
          ))}
        </p>
      )}
    </section>
  );
}

/** The parent card, sub-cards and a field to add a sub-card. */
export function SubCards({
  card,
  state,
  parentCard,
  childCards,
  onChange,
  onCreateSubCard,
  onNavigateCard,
}: {
  card: Card;
  state: AppState;
  parentCard: Card | undefined;
  childCards: Card[];
  onChange: (change: (card: Card) => Card) => void;
  onCreateSubCard: (name: string) => void;
  onNavigateCard: (target: Card) => void;
}) {
  const [subCardName, setSubCardName] = useState("");
  const [choosingParent, setChoosingParent] = useState(false);
  return (
    <section className="detail-section sub-cards">
      <h3>Sub-cards</h3>
      {parentCard && (
        <p>
          Parent: <button onClick={() => onNavigateCard(parentCard)}>{parentCard.name}</button>
        </p>
      )}
      {childCards.length > 0 && (
        <ul>
          {childCards.map((item) => (
            <li key={item.id}>
              <button onClick={() => onNavigateCard(item)}>
                {item.completed ? "✓ " : ""}
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="inline-form">
        <input
          value={subCardName}
          onChange={(event) => setSubCardName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && subCardName.trim()) {
              onCreateSubCard(subCardName.trim());
              setSubCardName("");
            }
          }}
          placeholder="New sub-card"
          aria-label="New sub-card title"
        />
        <button
          disabled={!subCardName.trim()}
          onClick={() => {
            onCreateSubCard(subCardName.trim());
            setSubCardName("");
          }}
        >
          Add
        </button>
      </div>
      <div className="parent-picker">
        {choosingParent ? (
          <>
            <CardPicker
              label="Parent card"
              candidates={parentCandidates(state, card.id).filter(
                (item) => item.boardId === card.boardId && isCardAvailable(state, item),
              )}
              onPick={(parent) => {
                onChange((item) => ({ ...item, parentCardId: parent.id }));
                setChoosingParent(false);
              }}
            />
            <button onClick={() => setChoosingParent(false)}>Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => setChoosingParent(true)}>
              {parentCard ? "Change parent" : "Choose parent card"}
            </button>
            {card.parentCardId && (
              <button onClick={() => onChange((item) => ({ ...item, parentCardId: undefined }))}>Remove parent</button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** Trello cards linked from this card's description, comments or attachments. */
export function RelatedCards({
  related,
  state,
  onNavigateCard,
}: {
  related: ReturnType<typeof relatedCards>;
  state: AppState;
  onNavigateCard: (target: Card) => void;
}) {
  return (
    <section className="detail-section related-cards">
      <h3>Linked cards</h3>
      {related.map((link, index) => (
        <div className="related-row" key={`${link.url}-${index}`}>
          <span>{link.source}</span>
          {link.target && isCardAvailable(state, link.target) ? (
            <button onClick={() => onNavigateCard(link.target!)}>{link.target.name}</button>
          ) : link.target ? (
            <small>Card unavailable: {link.target.name}</small>
          ) : (
            <small>Card not imported: {link.url}</small>
          )}
        </div>
      ))}
    </section>
  );
}
