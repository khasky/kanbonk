import { useState } from "react";
import { cardActivityFeed } from "../model/activity";
import { MarkdownEditor } from "../ui/MarkdownEditor";
import { MarkdownText } from "../ui/MarkdownText";
import { type AppState, type Card, canEditComment, newId } from "../model";
import { Button } from "../ui/Button";
import { detailTitleClass } from "./cardLook";
import { formatDateTime, t } from "../i18n";
import { Icon } from "../ui/Icon";
import { useCardActionsContext } from "./CardActionsContext";

const dateClass = "text-[12px] text-ink-muted";
const avatarClass = "grid size-8 flex-none place-items-center rounded-full font-bold";
const commentPlaceholderClass =
  "w-full cursor-text rounded-lg border-0 bg-white px-3 py-2.5 text-left text-ink-subtle shadow-tile hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white";
const commentActionClass =
  "cursor-pointer border-0 bg-transparent px-0 py-[3px] text-[12px] text-ink-subtle hover:underline";

/** Comments, with the card's change history mixed in when details are shown. Only own comments can be edited. */
export function CardActivity({
  card,
  state,
  authorName,
  currentDeviceId,
  onChange,
  localCardForUrl,
  onNavigateCard,
  readOnly = false,
}: {
  card: Card;
  state: AppState;
  authorName: string;
  currentDeviceId: string;
  onChange: (change: (card: Card) => Card) => void;
  localCardForUrl: (url: string) => Card | undefined;
  onNavigateCard: (target: Card) => void;
  /** Comments cannot be written, edited or deleted. */
  readOnly?: boolean;
}) {
  const [writingComment, setWritingComment] = useState(false);
  const [showActivityDetails, setShowActivityDetails] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const activityFeed = cardActivityFeed(state, card, showActivityDetails);
  const { attachFiles } = useCardActionsContext();
  const attach = readOnly ? undefined : (files: File[]) => attachFiles(card, files);
  function addComment(markdown: string) {
    const text = markdown.trim();
    if (text)
      onChange((item) => ({
        ...item,
        comments: [
          ...item.comments,
          {
            id: newId(),
            text,
            author: authorName,
            authorDeviceId: currentDeviceId,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    setWritingComment(false);
  }
  function saveComment(markdown: string) {
    const text = markdown.trim();
    if (
      !editingCommentId ||
      !text ||
      !card.comments.some((entry) => entry.id === editingCommentId && canEditComment(entry, currentDeviceId))
    )
      return;
    onChange((item) => ({
      ...item,
      comments: item.comments.map((entry) => (entry.id === editingCommentId ? { ...entry, text } : entry)),
    }));
    setEditingCommentId(null);
  }
  function deleteComment(id: string) {
    if (!card.comments.some((entry) => entry.id === id && canEditComment(entry, currentDeviceId))) return;
    onChange((item) => ({ ...item, comments: item.comments.filter((entry) => entry.id !== id) }));
    if (editingCommentId === id) setEditingCommentId(null);
  }
  return (
    <aside className="activity-panel card-markdown overflow-auto border-l border-line bg-surface-sunken px-4 py-5 max-tablet:overflow-visible max-tablet:border-t max-tablet:border-l-0">
      <h3 className={detailTitleClass}>
        <span className="grid size-6 flex-none place-items-center text-ink-subtle">
          <Icon name="message" />
        </span>
        {t("card.commentsAndActivity")}
        <Button
          variant="outline"
          size="md"
          className="ml-auto"
          type="button"
          aria-pressed={showActivityDetails}
          onClick={() => setShowActivityDetails((value) => !value)}
        >
          {showActivityDetails ? t("card.hideDetails") : t("card.showDetails")}
        </Button>
      </h3>
      {writingComment ? (
        <MarkdownEditor
          value=""
          look="comment"
          onAttach={attach}
          label={t("card.newComment")}
          saveLabel={t("card.send")}
          onSave={addComment}
          onCancel={() => setWritingComment(false)}
        />
      ) : (
        <button className={commentPlaceholderClass} disabled={readOnly} onClick={() => setWritingComment(true)}>
          {t("card.writeComment")}
        </button>
      )}
      <div className="mt-4 grid gap-4">
        {activityFeed.map((item) => {
          if (item.kind === "change")
            return (
              <article className="flex gap-2.5 leading-5 wrap-anywhere" key={item.id}>
                <span className={`${avatarClass} bg-line text-ink-subtle`} aria-hidden="true">
                  <Icon name="history" className="size-4" />
                </span>
                <div className="min-w-0 pt-1.5">
                  {item.event.summary}
                  <small className={`${dateClass} block`}>{formatDateTime(item.createdAt)}</small>
                </div>
              </article>
            );
          const entry = item.comment;
          return (
            <article className="flex gap-2.5 leading-5" key={item.id}>
              <span className={`${avatarClass} bg-[#1d7a8c] text-white`}>{entry.author.slice(0, 1)}</span>
              <div className="min-w-0 flex-1 pt-1.5">
                <strong>{entry.author}</strong> <small className={dateClass}>{formatDateTime(entry.createdAt)}</small>
                {editingCommentId === entry.id ? (
                  <div>
                    <MarkdownEditor
                      look="comment-edit"
                      value={commentDraft}
                      label={t("card.editComment")}
                      onSave={saveComment}
                      onCancel={() => setEditingCommentId(null)}
                    />
                  </div>
                ) : (
                  <>
                    <MarkdownText
                      text={entry.text}
                      look="comment"
                      localCardForUrl={localCardForUrl}
                      onNavigateCard={onNavigateCard}
                    />
                    {!readOnly && canEditComment(entry, currentDeviceId) && (
                      <div className="mt-[5px] flex gap-2">
                        <button
                          className={commentActionClass}
                          onClick={() => {
                            setEditingCommentId(entry.id);
                            setCommentDraft(entry.text);
                          }}
                        >
                          {t("common.edit")}
                        </button>
                        <button className={commentActionClass} onClick={() => deleteComment(entry.id)}>
                          {t("common.delete")}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
