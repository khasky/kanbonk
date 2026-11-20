import { useState } from "react";
import { MarkdownEditor } from "../ui/MarkdownEditor";
import { MarkdownText } from "../ui/MarkdownText";
import type { Card } from "../model";

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
    <section className="detail-section">
      <h3>
        Description
        {card.description && !editingDescription && (
          <button className="description-edit-button" onClick={() => setEditingDescription(true)}>
            Edit
          </button>
        )}
      </h3>
      {editingDescription ? (
        <MarkdownEditor
          value={card.description}
          label="Card description"
          onSave={(value) => {
            if (value !== card.description) onChange((item) => ({ ...item, description: value }));
            setEditingDescription(false);
          }}
          onCancel={() => setEditingDescription(false)}
        />
      ) : card.description ? (
        <div className="description-preview" onDoubleClick={() => setEditingDescription(true)}>
          <MarkdownText text={card.description} localCardForUrl={localCardForUrl} onNavigateCard={onNavigateCard} />
        </div>
      ) : (
        <button className="description-placeholder" onClick={() => setEditingDescription(true)}>
          Add a more detailed description…
        </button>
      )}
    </section>
  );
}
