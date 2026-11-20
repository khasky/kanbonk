import { useEffect, useState } from "react";
import type { Card } from "../model";
import { loadAttachment } from "../storage";

export function AttachmentRow({
  attachment,
  linkedCard,
  onNavigateCard,
  onDownload,
  onRemove,
}: {
  attachment: Card["attachments"][number];
  linkedCard?: Card;
  onNavigateCard: (card: Card) => void;
  onDownload: (id: string, name: string) => void;
  onRemove: () => void;
}) {
  const [localUrl, setLocalUrl] = useState("");
  useEffect(() => {
    if (attachment.status !== "local" || !/^(image|video|audio)\//.test(attachment.mimeType)) return;
    let url = "";
    let cancelled = false;
    loadAttachment(attachment.id)
      .then((blob) => {
        if (!blob || cancelled) return;
        url = URL.createObjectURL(blob);
        setLocalUrl(url);
      })
      .catch(() => {
        if (!cancelled) setLocalUrl("");
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.id, attachment.mimeType, attachment.status, attachment]);
  const kind = attachment.mimeType.split("/")[0];
  let action = (
    <button onClick={() => onDownload(attachment.id, attachment.name)} disabled={attachment.status === "missing"}>
      Download
    </button>
  );
  if (attachment.status === "link") {
    if (linkedCard && !linkedCard.archived)
      action = <button onClick={() => onNavigateCard(linkedCard)}>Open card</button>;
    else if (attachment.linkedCardId) action = <small>Card unavailable</small>;
    else if (/^https?:\/\//.test(attachment.sourceUrl ?? ""))
      action = (
        <a href={attachment.sourceUrl} target="_blank" rel="noopener noreferrer">
          Open link
        </a>
      );
    else action = <small>Link unavailable</small>;
  }
  return (
    <div className="attachment-entry">
      <div className="attachment-row">
        <span>
          {attachment.name}
          <small>
            {attachment.status === "link"
              ? "Link"
              : `${Math.round(attachment.size / 1024)} KB ${attachment.status === "missing" ? "· file missing" : ""}`}
          </small>
        </span>
        {action}
        <button onClick={onRemove} aria-label={`Delete attachment ${attachment.name}`}>
          Delete
        </button>
      </div>
      {localUrl && kind === "image" && <img className="attachment-preview" src={localUrl} alt={attachment.name} />}
      {localUrl && kind === "video" && (
        <video className="attachment-preview" src={localUrl} controls preload="metadata" />
      )}
      {localUrl && kind === "audio" && (
        <audio className="attachment-audio" src={localUrl} controls preload="metadata" />
      )}
    </div>
  );
}
