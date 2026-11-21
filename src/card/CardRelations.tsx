import { useState } from "react";
import { CardPicker } from "../ui/CardPicker";
import type { relatedCards } from "../model/links";
import { type AppState, type Card, isCardAvailable, parentCandidates } from "../model";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { detailSectionClass, detailTitleClass, inlineFormClass } from "./cardLook";

const dependencyLineClass = "my-1.5 flex flex-wrap items-center gap-1.5";
/** A sub-card or the parent card, as a blue text link. */
const cardLinkClass = "cursor-pointer border-0 bg-transparent px-0 py-0.5 text-left text-brand";

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
    <section className={detailSectionClass}>
      <h3 className={detailTitleClass}>Dependencies</h3>
      {prerequisiteCards.length > 0 && (
        <p className={dependencyLineClass}>
          Depends on:{" "}
          {prerequisiteCards.map((item) => (
            <Button variant="secondary" key={item.id} onClick={() => onNavigateCard(item)}>
              {item.completed ? "✓" : "⏳"} {item.name}
            </Button>
          ))}
        </p>
      )}
      {prerequisiteCards.some((item) => !item.completed) && !card.completed && (
        <p className={`${dependencyLineClass} font-semibold text-danger`}>
          Card is blocked: not all dependencies are complete.
        </p>
      )}
      {dependentCards.length > 0 && (
        <p className={dependencyLineClass}>
          Blocks:{" "}
          {dependentCards.map((item) => (
            <Button variant="secondary" key={item.id} onClick={() => onNavigateCard(item)}>
              {item.name}
            </Button>
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
    <section className={detailSectionClass}>
      <h3 className={detailTitleClass}>Sub-cards</h3>
      {parentCard && (
        <p>
          Parent:{" "}
          <button className={cardLinkClass} onClick={() => onNavigateCard(parentCard)}>
            {parentCard.name}
          </button>
        </p>
      )}
      {childCards.length > 0 && (
        <ul className="mt-0 mb-2 pl-[18px]">
          {childCards.map((item) => (
            <li key={item.id}>
              <button className={cardLinkClass} onClick={() => onNavigateCard(item)}>
                {item.completed ? "✓ " : ""}
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={inlineFormClass}>
        <Input
          size="sm"
          className="min-w-0 flex-1"
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
        <Button
          variant="secondary"
          disabled={!subCardName.trim()}
          onClick={() => {
            onCreateSubCard(subCardName.trim());
            setSubCardName("");
          }}
        >
          Add
        </Button>
      </div>
      <div className="mt-2 flex flex-row flex-wrap items-start gap-1.5">
        {choosingParent ? (
          <>
            <CardPicker
              label="Parent card"
              className="min-w-[200px] flex-1"
              candidates={parentCandidates(state, card.id).filter(
                (item) => item.boardId === card.boardId && isCardAvailable(state, item),
              )}
              onPick={(parent) => {
                onChange((item) => ({ ...item, parentCardId: parent.id }));
                setChoosingParent(false);
              }}
            />
            <Button variant="secondary" onClick={() => setChoosingParent(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setChoosingParent(true)}>
              {parentCard ? "Change parent" : "Choose parent card"}
            </Button>
            {card.parentCardId && (
              <Button variant="secondary" onClick={() => onChange((item) => ({ ...item, parentCardId: undefined }))}>
                Remove parent
              </Button>
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
    <section className={detailSectionClass}>
      <h3 className={detailTitleClass}>Linked cards</h3>
      {related.map((link, index) => (
        <div className="flex items-center gap-2.5 border-b border-line py-2 wrap-anywhere" key={`${link.url}-${index}`}>
          <span className="min-w-[70px] text-[12px] text-ink-muted">{link.source}</span>
          {link.target && isCardAvailable(state, link.target) ? (
            <button
              className="rounded-sm border-0 bg-brand-soft px-2 py-1.5 text-left text-brand"
              onClick={() => onNavigateCard(link.target!)}
            >
              {link.target.name}
            </button>
          ) : link.target ? (
            <small className="text-danger">Card unavailable: {link.target.name}</small>
          ) : (
            <small className="text-danger">Card not imported: {link.url}</small>
          )}
        </div>
      ))}
    </section>
  );
}
