import { useState } from "react";
import { cardActivityFeed } from "../activity";
import { MarkdownEditor } from "../MarkdownEditor";
import { MarkdownText } from "../MarkdownText";
import { type AppState, type Card, canEditComment, newId } from "../model";

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
    <aside className="activity-panel">
      <h3>
        Comments and activity
        <button
          className="activity-toggle"
          type="button"
          aria-expanded={showActivityDetails}
          onClick={() => setShowActivityDetails((value) => !value)}
        >
          {showActivityDetails ? "Hide details" : "Show details"}
        </button>
      </h3>
      {writingComment ? (
        <MarkdownEditor
          value=""
          label="New comment"
          saveLabel="Send"
          onSave={addComment}
          onCancel={() => setWritingComment(false)}
        />
      ) : (
        <button className="description-placeholder" onClick={() => setWritingComment(true)}>
          Write a comment…
        </button>
      )}
      <div className="comments">
        {activityFeed.map((item) => {
          if (item.kind === "change")
            return (
              <article className="card-activity-entry" key={item.id}>
                <strong>{item.event.summary}</strong>
                <small>{new Date(item.createdAt).toLocaleString("en-US")}</small>
              </article>
            );
          const entry = item.comment;
          return (
            <article key={item.id}>
              <span className="comment-avatar">{entry.author.slice(0, 1)}</span>
              <div>
                <strong>{entry.author}</strong>
                <small>{new Date(entry.createdAt).toLocaleString("en-US")}</small>
                {editingCommentId === entry.id ? (
                  <div className="comment-edit">
                    <MarkdownEditor
                      value={commentDraft}
                      label="Edit comment"
                      onSave={saveComment}
                      onCancel={() => setEditingCommentId(null)}
                    />
                  </div>
                ) : (
                  <>
                    <MarkdownText text={entry.text} localCardForUrl={localCardForUrl} onNavigateCard={onNavigateCard} />
                    {canEditComment(entry, currentDeviceId) && (
                      <div className="comment-actions">
                        <button
                          onClick={() => {
                            setEditingCommentId(entry.id);
                            setCommentDraft(entry.text);
                          }}
                        >
                          Edit
                        </button>
                        <button onClick={() => deleteComment(entry.id)}>Delete</button>
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
