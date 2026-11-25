import { useState } from "react";
import { MarkdownEditor } from "../ui/MarkdownEditor";
import { MarkdownText } from "../ui/MarkdownText";
import { t } from "../i18n";
import type { Card } from "../model";
import { Button } from "../ui/Button";
import { detailSectionClass, placeholderClass } from "./cardLook";
import { DetailTitle } from "./DetailTitle";

/** The card description as Markdown; a double click or the Edit button opens the editor. */
export function CardDescription({
  card,
  onChange,
  localCardForUrl,
  onNavigateCard,
}: {
  card: Card;
  onChange: (change: (card: Card) => Card) => void;
  localCardForUrl: (url: string) => Card | undefined;
  onNavigateCard: (target: Card) => void;
}) {
  const [editingDescription, setEditingDescription] = useState(false);
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
        <div onDoubleClick={() => setEditingDescription(true)}>
          <MarkdownText text={card.description} localCardForUrl={localCardForUrl} onNavigateCard={onNavigateCard} />
        </div>
      ) : (
        <button className={placeholderClass} onClick={() => setEditingDescription(true)}>
          {t("card.addDescription")}
        </button>
      )}
    </section>
  );
}
