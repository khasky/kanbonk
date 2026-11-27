import { useState } from "react";
import { CardPicker } from "../ui/CardPicker";
import type { relatedCards } from "../model/links";
import { type AppState, type Card, isCardAvailable, parentCandidates } from "../model";
import { t } from "../i18n";
import { tNodes } from "../i18n/nodes";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { detailSectionClass, inlineFormClass } from "./cardLook";
import { DetailTitle } from "./DetailTitle";

const dependencyLineClass = "my-1.5 flex flex-wrap items-center gap-1.5";
/** A sub-card or the parent card, as a blue text link. */
const cardLinkClass = "py-0.5";

/** Cards this card depends on and cards it blocks. */
export function DependencySummary({
  prerequisiteCards,
  dependentCards,
  onNavigateCard,
}: {
  prerequisiteCards: Card[];
  dependentCards: Card[];
  onNavigateCard: (target: Card) => void;
}) {
  return (
    <section className={detailSectionClass}>
      <DetailTitle icon="dependency">{t("card.dependencies")}</DetailTitle>
      {prerequisiteCards.length > 0 && (
        <p className={dependencyLineClass}>
          {tNodes("card.dependsOn", {
            cards: prerequisiteCards.map((item) => (
              <Button variant="secondary" key={item.id} onClick={() => onNavigateCard(item)}>
                {item.name}
              </Button>
            )),
          })}
        </p>
      )}
      {dependentCards.length > 0 && (
        <p className={dependencyLineClass}>
          {tNodes("card.blocks", {
            cards: dependentCards.map((item) => (
              <Button variant="secondary" key={item.id} onClick={() => onNavigateCard(item)}>
                {item.name}
              </Button>
            )),
          })}
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
      <DetailTitle icon="sub-cards">{t("card.subCards")}</DetailTitle>
      {parentCard && (
        <p>
          {tNodes("card.parent", {
            card: (
              <Button variant="link-quiet" className={cardLinkClass} onClick={() => onNavigateCard(parentCard)}>
                {parentCard.name}
              </Button>
            ),
          })}
        </p>
      )}
      {childCards.length > 0 && (
        <ul className="mt-0 mb-2 pl-[18px]">
          {childCards.map((item) => (
            <li key={item.id}>
              <Button variant="link-quiet" className={cardLinkClass} onClick={() => onNavigateCard(item)}>
                {item.name}
              </Button>
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
          placeholder={t("card.newSubCard")}
          aria-label={t("card.newSubCardTitle")}
        />
        <Button
          variant="secondary"
          disabled={!subCardName.trim()}
          onClick={() => {
            onCreateSubCard(subCardName.trim());
            setSubCardName("");
          }}
        >
          {t("common.add")}
        </Button>
      </div>
      <div className="mt-2 flex flex-row flex-wrap items-start gap-1.5">
        {choosingParent ? (
          <>
            <CardPicker
              label={t("card.parentCard")}
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
              {t("common.cancel")}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setChoosingParent(true)}>
              {parentCard ? t("card.changeParent") : t("card.chooseParentCard")}
            </Button>
            {card.parentCardId && (
              <Button variant="secondary" onClick={() => onChange((item) => ({ ...item, parentCardId: undefined }))}>
                {t("card.removeParent")}
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
      <DetailTitle icon="link">{t("card.linkedCards")}</DetailTitle>
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
            <small className="text-danger">{t("card.cardUnavailableName", { name: link.target.name })}</small>
          ) : (
            <small className="text-danger">{t("card.cardNotImported", { url: link.url })}</small>
          )}
        </div>
      ))}
    </section>
  );
}
