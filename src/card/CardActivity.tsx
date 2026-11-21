import { useState } from "react";
import { cardActivityFeed } from "../model/activity";
import { MarkdownEditor } from "../ui/MarkdownEditor";
import { MarkdownText } from "../ui/MarkdownText";
import { type AppState, type Card, canEditComment, newId } from "../model";
import { Button } from "../ui/Button";
import { detailTitleClass, placeholderClass } from "./cardLook";

const dateClass = "block text-[11px] text-ink-muted";
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
}: {
  card: Card;
  state: AppState;
  authorName: string;
  currentDeviceId: string;
  onChange: (change: (card: Card) => Card) => void;
  localCardForUrl: (url: string) => Card | undefined;
  onNavigateCard: (target: Card) => void;
}) {
  const [writingComment, setWritingComment] = useState(false);
  const [showActivityDetails, setShowActivityDetails] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const activityFeed = cardActivityFeed(state, card, showActivityDetails);
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
    <aside className="activity-panel card-markdown overflow-auto border-l border-line bg-surface-soft px-[18px] py-6 max-tablet:overflow-visible max-tablet:border-t max-tablet:border-l-0">
      <h3 className={detailTitleClass}>
        Comments and activity
        <Button
          variant="secondary"
          className="ml-auto"
          type="button"
          aria-expanded={showActivityDetails}
          onClick={() => setShowActivityDetails((value) => !value)}
        >
          {showActivityDetails ? "Hide details" : "Show details"}
        </Button>
      </h3>
      {writingComment ? (
        <MarkdownEditor
          value=""
          look="comment"
          label="New comment"
          saveLabel="Send"
          onSave={addComment}
          onCancel={() => setWritingComment(false)}
        />
      ) : (
        <button className={placeholderClass} onClick={() => setWritingComment(true)}>
          Write a comment…
        </button>
      )}
      <div className="mt-6">
        {activityFeed.map((item) => {
          if (item.kind === "change")
            return (
              <article className="mb-5 block border-b border-line py-[9px] wrap-anywhere" key={item.id}>
                <strong className="block font-normal">{item.event.summary}</strong>
                <small className={`${dateClass} mt-1`}>{new Date(item.createdAt).toLocaleString("en-US")}</small>
              </article>
            );
          const entry = item.comment;
          return (
            <article className="mb-5 flex gap-2.5" key={item.id}>
              <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[#1d7a8c] text-white">
                {entry.author.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <strong>{entry.author}</strong>
                <small className={dateClass}>{new Date(entry.createdAt).toLocaleString("en-US")}</small>
                {editingCommentId === entry.id ? (
                  <div>
                    <MarkdownEditor
                      look="comment-edit"
                      value={commentDraft}
                      label="Edit comment"
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
                    {canEditComment(entry, currentDeviceId) && (
                      <div className="mt-[5px] flex gap-2">
                        <button
                          className={commentActionClass}
                          onClick={() => {
                            setEditingCommentId(entry.id);
                            setCommentDraft(entry.text);
                          }}
                        >
                          Edit
                        </button>
                        <button className={commentActionClass} onClick={() => deleteComment(entry.id)}>
                          Delete
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
