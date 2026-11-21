import { useEffect, useState } from "react";
import type { Card } from "../model";
import { platform } from "../lib/platform";
import { loadAttachment } from "../lib/storage";
import { AttachmentPreview } from "./AttachmentPreview";
import { previewKind } from "./previewKinds";

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
  const [previewOpen, setPreviewOpen] = useState(false);
  // Android WebViews have no PDF viewer, so PDFs are only downloaded there.
  const preview = attachment.status === "local" ? previewKind(attachment.name, attachment.mimeType) : undefined;
  const canPreview = preview && !(preview === "pdf" && platform === "mobile");
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
    if (linkedCard && !linkedCard.deletedAt)
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
        {canPreview && (
          <button onClick={() => setPreviewOpen(true)} aria-label={`Preview ${attachment.name}`}>
            Preview
          </button>
        )}
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
      {previewOpen && preview && (
        <AttachmentPreview
          attachment={attachment}
          kind={preview}
          onDownload={() => onDownload(attachment.id, attachment.name)}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
