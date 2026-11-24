import type { ReactNode } from "react";
import { CardLabelChips } from "../card/LabelPicker";
import { useCardActionsContext } from "../card/CardActionsContext";
import { dialogFooterClass } from "../dialogs/dialogLook";
import { formatDateTime, t } from "../i18n";
import type { AppState, Card } from "../model";
import { Button } from "../ui/Button";
import { Icon, type IconName } from "../ui/Icon";
import { MarkdownText } from "../ui/MarkdownText";
import { Dialog } from "../ui/Modal";

function Section({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mt-0 mb-2 flex items-center gap-2 text-[16px] font-semibold">
        <Icon name={icon} className="text-ink-subtle" />
        {title}
      </h3>
      {children}
    </section>
  );
}

const when = (value: string) => formatDateTime(value);

/**
 * A card in the trash, read-only: its title, labels, dates, description, checklists, attachments and comments. It can
 * only be restored, deleted forever, or have its files downloaded; editing waits until it is restored.
 */
export function TrashedCardDialog({
  card,
  state,
  daysLeft,
  onRestore,
  onPurge,
  onClose,
}: {
  card: Card;
  state: AppState;
  daysLeft: number;
  onRestore: () => void;
  onPurge: () => void;
  onClose: () => void;
}) {
  const { downloadAttachment } = useCardActionsContext();
  const list = state.lists.find((item) => item.id === card.listId);
  const board = state.boards.find((item) => item.id === card.boardId);
  const labels = state.labels.filter((item) => item.boardId === card.boardId && !item.deleted);
  const files = card.attachments.filter((item) => !item.linkedCardId);
  return (
    <Dialog label={card.name} size="lg" onDismiss={onClose}>
      <p className="mt-0 mb-3 rounded-sm bg-danger-soft px-3 py-2 text-danger" role="note">
        {t("pages.cardInTrash", { count: daysLeft })}
      </p>
      <h2 className="mx-0 mt-0 mb-1 text-[22px] wrap-anywhere">{card.name}</h2>
      <p className="m-0 text-[12px] text-ink-subtle">
        {list ? t("pages.inList", { name: list.name }) : ""}
        {board ? ` · ${board.name}` : ""} · {t("pages.trashedAt", { time: card.deletedAt ? when(card.deletedAt) : "" })}
      </p>
      {(card.labelIds.length > 0 || card.startAt || card.dueAt) && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <CardLabelChips card={card} boardLabels={labels} />
          {card.startAt && (
            <span className="rounded-sm bg-surface-sunken px-3 py-1.5">
              {t("pages.start", { time: when(card.startAt) })}
            </span>
          )}
          {card.dueAt && (
            <span className="rounded-sm bg-surface-sunken px-3 py-1.5">
              {t("pages.due", { time: when(card.dueAt) })}
            </span>
          )}
        </div>
      )}
      {card.description.trim() && (
        <Section icon="text" title={t("pages.description")}>
          <MarkdownText text={card.description} />
        </Section>
      )}
      {card.checklists.map((checklist) => (
        <Section key={checklist.id} icon="check-square" title={checklist.name}>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {checklist.items.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <input type="checkbox" className="m-0 size-4" checked={item.checked} disabled aria-label={item.name} />
                <span className={item.checked ? "text-ink-muted line-through" : undefined}>{item.name}</span>
              </li>
            ))}
          </ul>
        </Section>
      ))}
      {files.length > 0 && (
        <Section icon="clip" title={t("pages.attachments")}>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {files.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 wrap-anywhere">{item.name}</span>
                {item.status === "link" && item.sourceUrl ? (
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                    {t("pages.openLink")}
                  </a>
                ) : (
                  item.status === "local" && (
                    <Button variant="secondary" onClick={() => void downloadAttachment(item.id, item.name)}>
                      {t("pages.download")}
                    </Button>
                  )
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {card.comments.length > 0 && (
        <Section icon="message" title={t("pages.comments")}>
          <div className="flex flex-col gap-3">
            {card.comments.map((comment) => (
              <div key={comment.id}>
                <div className="mb-1 text-[12px] text-ink-subtle">
                  <strong className="text-ink">{comment.author}</strong> {when(comment.createdAt)}
                </div>
                <MarkdownText text={comment.text} look="comment" />
              </div>
            ))}
          </div>
        </Section>
      )}
      <div className={dialogFooterClass}>
        <Button variant="secondary" size="lg" onClick={onClose}>
          {t("common.close")}
        </Button>
        <Button variant="danger" size="lg" onClick={onPurge}>
          {t("pages.deleteForever")}
        </Button>
        <Button variant="primary" onClick={onRestore} autoFocus>
          {t("common.restore")}
        </Button>
      </div>
    </Dialog>
  );
}
