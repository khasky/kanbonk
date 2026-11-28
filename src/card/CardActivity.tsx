import { type ReactNode, useState } from "react";
import { cardActivityFeed } from "../model/activity";
import { type CommentThread, removeComment, replyCount } from "../model/comments";
import { MarkdownEditor } from "../ui/MarkdownEditor";
import { MarkdownText } from "../ui/MarkdownText";
import { type AppState, type Card, type Comment, canEditComment, newId } from "../model";
import { Button } from "../ui/Button";
import { detailTitleClass } from "./cardLook";
import { formatDateTime, t } from "../i18n";
import { Icon } from "../ui/Icon";
import { useCardActionsContext } from "./CardActionsContext";

const dateClass = "text-[12px] text-ink-muted";
const avatarClass = "grid size-8 flex-none place-items-center rounded-full font-bold";
const commentActionClass = "py-[3px] text-[12px]";
/** Replies are indented under the comment they answer up to this depth; deeper ones line up with it. */
const maxIndent = 3;

/**
 * Comments as threads: each reply under the comment it answers, oldest first; a thread's replies can be hidden. The
 * card's change history is mixed in when details are shown. Only own comments can be edited or deleted; a deleted
 * comment with replies stays as a placeholder.
 */
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
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [hiddenReplies, setHiddenReplies] = useState<ReadonlySet<string>>(new Set());
  const activityFeed = cardActivityFeed(state, card, showActivityDetails);
  const { attachFiles } = useCardActionsContext();
  const attach = readOnly ? undefined : (files: File[]) => attachFiles(card, files);
  /** Adds a comment, or a reply to `parentId`. */
  function addComment(markdown: string, parentId?: string) {
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
            ...(parentId ? { parentId } : {}),
          },
        ],
      }));
    setWritingComment(false);
    setReplyingTo(null);
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
    onChange((item) => ({ ...item, comments: removeComment(item.comments, id) }));
    if (editingCommentId === id) setEditingCommentId(null);
  }
  function toggleReplies(id: string) {
    setHiddenReplies((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  /** A comment with its replies below it; `replyTo` names whom a reply deeper than the indent answers. */
  function renderThread(thread: CommentThread, depth: number, replyTo?: Comment): ReactNode {
    const entry = thread.comment;
    const count = replyCount(thread);
    const hidden = hiddenReplies.has(entry.id);
    const replies = thread.replies.map((reply) =>
      renderThread(reply, depth + 1, depth + 1 >= maxIndent ? entry : undefined),
    );
    const body = entry.deleted ? (
      <article className="flex gap-2.5 leading-5" data-comment-id={entry.id}>
        <span className={`${avatarClass} bg-line text-ink-subtle`} aria-hidden="true">
          <Icon name="message" className="size-4" />
        </span>
        <p className="m-0 min-w-0 flex-1 pt-1.5 text-ink-subtle italic">{t("card.commentDeleted")}</p>
      </article>
    ) : (
      <article className="flex gap-2.5 leading-5" data-comment-id={entry.id}>
        <span className={`${avatarClass} bg-[#1d7a8c] text-white`}>{entry.author.slice(0, 1)}</span>
        <div className="min-w-0 flex-1 pt-1.5">
          <strong>{entry.author}</strong> <small className={dateClass}>{formatDateTime(entry.createdAt)}</small>
          {replyTo && <small className={`${dateClass} block`}>{t("card.inReplyTo", { name: replyTo.author })}</small>}
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
              {!readOnly && (
                <div className="mt-[5px] flex gap-2 text-ink-subtle">
                  <Button
                    variant="text"
                    className={commentActionClass}
                    aria-label={t("card.replyTo", { name: entry.author })}
                    onClick={() => setReplyingTo(entry.id)}
                  >
                    {t("card.reply")}
                  </Button>
                  {canEditComment(entry, currentDeviceId) && (
                    <>
                      <Button
                        variant="text"
                        className={commentActionClass}
                        onClick={() => {
                          setEditingCommentId(entry.id);
                          setCommentDraft(entry.text);
                        }}
                      >
                        {t("common.edit")}
                      </Button>
                      <Button variant="text" className={commentActionClass} onClick={() => deleteComment(entry.id)}>
                        {t("common.delete")}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </article>
    );
    const nested = (
      <>
        {replyingTo === entry.id && (
          <MarkdownEditor
            value=""
            look="comment"
            onAttach={attach}
            label={t("card.replyTo", { name: entry.author })}
            saveLabel={t("card.send")}
            onSave={(markdown) => addComment(markdown, entry.id)}
            onCancel={() => setReplyingTo(null)}
          />
        )}
        {count > 0 && (
          <Button
            variant="text"
            className={`${commentActionClass} justify-self-start text-ink-subtle`}
            aria-expanded={!hidden}
            onClick={() => toggleReplies(entry.id)}
          >
            {hidden ? t("card.showReplies", { count }) : t("card.hideReplies")}
          </Button>
        )}
        {!hidden && replies}
      </>
    );
    // Replies sit in a ruled column under the comment; past the indent limit they line up with their comment.
    return depth >= maxIndent ? (
      <div className="grid gap-4" key={entry.id}>
        {body}
        {nested}
      </div>
    ) : (
      <div className="grid gap-3" key={entry.id}>
        {body}
        {(replyingTo === entry.id || count > 0) && (
          <div className="ml-4 grid gap-3 border-l-2 border-line pl-3">{nested}</div>
        )}
      </div>
    );
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
        <Button variant="placeholder-raised" disabled={readOnly} onClick={() => setWritingComment(true)}>
          {t("card.writeComment")}
        </Button>
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
          return renderThread(item.thread, 0);
        })}
      </div>
    </aside>
  );
}
