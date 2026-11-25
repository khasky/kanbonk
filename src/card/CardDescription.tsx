import { useCallback, useState } from "react";
import { MarkdownEditor } from "../ui/MarkdownEditor";
import { MarkdownText } from "../ui/MarkdownText";
import { t } from "../i18n";
import type { Card } from "../model";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { detailSectionClass, placeholderClass } from "./cardLook";
import { DetailTitle } from "./DetailTitle";

/** A description taller than this (px) is cut there, faded out, with a "Show more" button under it. */
const collapsedHeight = 432;
const toggleClass =
  "mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-sm border border-line text-ink hover:bg-line";

/** The card description as Markdown; a double click or the Edit button opens the editor, unless `readOnly`. */
export function CardDescription({
  card,
  readOnly = false,
  onChange,
  localCardForUrl,
  onNavigateCard,
}: {
  card: Card;
  readOnly?: boolean;
  onChange: (change: (card: Card) => Card) => void;
  localCardForUrl: (url: string) => Card | undefined;
  onNavigateCard: (target: Card) => void;
}) {
  const [editingDescription, setEditingDescription] = useState(false);
  const [long, setLong] = useState(false);
  const [expanded, setExpanded] = useState(false);
  /** Watches the shown description's height while it is on screen. */
  const measureContent = useCallback((content: HTMLDivElement | null) => {
    if (!content) return;
    const observer = new ResizeObserver(() => setLong(content.offsetHeight > collapsedHeight));
    observer.observe(content);
    return () => observer.disconnect();
  }, []);
  const clamped = long && !expanded;
  return (
    <section className={`card-markdown ${detailSectionClass}`}>
      <DetailTitle icon="text">
        {t("card.description")}
        {card.description && !editingDescription && (
          <Button variant="outline" size="md" className="ml-auto" onClick={() => setEditingDescription(true)}>
            {t("common.edit")}
          </Button>
        )}
      </DetailTitle>
      {editingDescription ? (
        <MarkdownEditor
          value={card.description}
          label={t("card.cardDescription")}
          onSave={(value) => {
            if (value !== card.description) onChange((item) => ({ ...item, description: value }));
            setEditingDescription(false);
          }}
          onCancel={() => setEditingDescription(false)}
        />
      ) : card.description ? (
        <>
          <div
            className={clamped ? "description-clamp overflow-hidden mask-b-from-70%" : undefined}
            style={clamped ? { maxHeight: collapsedHeight } : undefined}
            onDoubleClick={() => setEditingDescription(!readOnly)}
          >
            <div ref={measureContent}>
              <MarkdownText text={card.description} localCardForUrl={localCardForUrl} onNavigateCard={onNavigateCard} />
            </div>
          </div>
          {long && (
            <button
              className={`${toggleClass} ${expanded ? "bg-white" : "bg-surface-sunken"}`}
              aria-expanded={expanded}
              data-share-skip
              onClick={() => setExpanded(!expanded)}
            >
              <Icon name={expanded ? "chevron-up" : "chevron-down"} className="size-4" />
              {expanded ? t("card.showLess") : t("card.showMore")}
            </button>
          )}
        </>
      ) : (
        <button className={placeholderClass} onClick={() => setEditingDescription(true)}>
          {t("card.addDescription")}
        </button>
      )}
    </section>
  );
}
