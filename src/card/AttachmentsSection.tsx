import { type MouseEvent, type ReactNode, useState } from "react";
import { t } from "../i18n";
import { type AppState, type Card, isCardAvailable } from "../model";
import { Button } from "../ui/Button";
import { AttachmentRow } from "./AttachmentRow";
import { detailSectionClass } from "./cardLook";
import { DetailTitle } from "./DetailTitle";

/** How many attachments of a group show before "View all attachments". */
const shownAtFirst = 4;
const groupTitleClass = "mt-1 mb-1 text-[12px] font-semibold text-ink-subtle";

type Attachment = Card["attachments"][number];

/** One group ("Files" or "Links"), newest first, folded to its first few. */
function AttachmentGroup({
  title,
  items,
  row,
}: {
  title: string;
  items: Attachment[];
  row: (attachment: Attachment) => ReactNode;
}) {
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const hidden = items.length - shownAtFirst;
  return (
    <>
      <h4 className={groupTitleClass}>{title}</h4>
      {(all ? items : items.slice(0, shownAtFirst)).map(row)}
      {hidden > 0 && (
        <Button
          variant={all ? "outline" : "secondary"}
          size="md"
          className="mt-2 justify-self-start"
          onClick={() => setAll(!all)}
        >
          {all ? t("card.showFewerAttachments") : t("card.viewAllAttachments", { count: hidden })}
        </Button>
      )}
    </>
  );
}

/** The card's attachments as Trello shows them: files and links in groups, with an Add button. */
export function AttachmentsSection({
  card,
  state,
  locked,
  addExpanded,
  onAdd,
  onChange,
  onNavigateCard,
  onDownload,
  onRemove,
}: {
  card: Card;
  state: AppState;
  locked: boolean;
  addExpanded: boolean;
  onAdd: (event: MouseEvent<HTMLButtonElement>) => void;
  onChange: (change: (card: Card) => Card) => void;
  onNavigateCard: (card: Card) => void;
  onDownload: (id: string, name: string) => void;
  onRemove: (attachment: Attachment) => void;
}) {
  // Attachments are kept in the order they were added; Trello lists the newest first.
  const newestFirst = [...card.attachments].reverse();
  const row = (attachment: Attachment) => (
    <AttachmentRow
      key={attachment.id}
      attachment={attachment}
      linkedCard={state.cards.find((item) => item.id === attachment.linkedCardId && isCardAvailable(state, item))}
      isCover={card.cover?.attachmentId === attachment.id}
      onNavigateCard={onNavigateCard}
      onDownload={onDownload}
      onRename={
        locked
          ? undefined
          : (name) =>
              onChange((item) => ({
                ...item,
                attachments: item.attachments.map((entry) => (entry.id === attachment.id ? { ...entry, name } : entry)),
              }))
      }
      onToggleCover={
        locked
          ? undefined
          : () =>
              onChange((item) => ({
                ...item,
                cover:
                  item.cover?.attachmentId === attachment.id
                    ? undefined
                    : { attachmentId: attachment.id, size: item.cover?.size ?? "normal" },
              }))
      }
      onRemove={locked ? undefined : () => onRemove(attachment)}
    />
  );
  return (
    <section className={`${detailSectionClass} grid`}>
      <DetailTitle icon="clip">
        {t("card.attachments")}
        {!locked && (
          <Button
            variant="outline"
            size="md"
            className="ml-auto"
            data-panel="attach"
            aria-expanded={addExpanded}
            onClick={onAdd}
          >
            {t("common.add")}
          </Button>
        )}
      </DetailTitle>
      <AttachmentGroup title={t("card.links")} items={newestFirst.filter((item) => item.status === "link")} row={row} />
      <AttachmentGroup title={t("card.files")} items={newestFirst.filter((item) => item.status !== "link")} row={row} />
    </section>
  );
}
