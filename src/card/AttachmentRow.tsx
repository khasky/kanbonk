import { useEffect, useState } from "react";
import type { Card } from "../model";
import { platform } from "../lib/platform";
import { loadAttachment } from "../lib/storage";
import { AttachmentPreview } from "./AttachmentPreview";
import { previewKind } from "./previewKinds";
import { Button } from "../ui/Button";
import { PanelRowNote } from "../ui/PanelRow";

const buttonClass = "whitespace-nowrap";
const noteClass = "mt-[3px] block text-ink-muted";
const mediaMargins = "mx-2 mt-1 mb-3 block";

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
    <Button
      variant="secondary"
      className={buttonClass}
      onClick={() => onDownload(attachment.id, attachment.name)}
      disabled={attachment.status === "missing"}
    >
      Download
    </Button>
  );
  if (attachment.status === "link") {
    if (linkedCard && !linkedCard.deletedAt)
      action = (
        <Button variant="secondary" className={buttonClass} onClick={() => onNavigateCard(linkedCard)}>
          Open card
        </Button>
      );
    else if (attachment.linkedCardId) action = <small className={noteClass}>Card unavailable</small>;
    else if (/^https?:\/\//.test(attachment.sourceUrl ?? ""))
      action = (
        <a
          className="whitespace-nowrap text-brand no-underline"
          href={attachment.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open link
        </a>
      );
    else action = <small className={noteClass}>Link unavailable</small>;
  }
  return (
    <div className="border-b border-[#eee]">
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2">
        <span className="min-w-0 flex-[1_1_150px] wrap-anywhere">
          {attachment.name}
          <PanelRowNote>
            {attachment.status === "link"
              ? "Link"
              : `${Math.round(attachment.size / 1024)} KB ${attachment.status === "missing" ? "· file missing" : ""}`}
          </PanelRowNote>
        </span>
        {canPreview && (
          <Button
            variant="secondary"
            className={buttonClass}
            onClick={() => setPreviewOpen(true)}
            aria-label={`Preview ${attachment.name}`}
          >
            Preview
          </Button>
        )}
        {action}
        <Button
          variant="secondary"
          className={buttonClass}
          onClick={onRemove}
          aria-label={`Delete attachment ${attachment.name}`}
        >
          Delete
        </Button>
      </div>
      {localUrl && kind === "image" && (
        <img
          className={`${mediaMargins} max-h-80 max-w-full rounded-sm object-contain`}
          src={localUrl}
          alt={attachment.name}
        />
      )}
      {localUrl && kind === "video" && (
        <video
          className={`${mediaMargins} max-h-80 max-w-full rounded-sm object-contain`}
          src={localUrl}
          controls
          preload="metadata"
        />
      )}
      {localUrl && kind === "audio" && (
        <audio className={`${mediaMargins} w-[min(100%,360px)]`} src={localUrl} controls preload="metadata" />
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
