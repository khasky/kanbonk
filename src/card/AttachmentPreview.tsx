import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Attachment } from "../model";
import { loadAttachment } from "../lib/storage";
import { Icon } from "../ui/Icon";
import { MarkdownText } from "../ui/MarkdownText";
import { Modal } from "../ui/Modal";
import { previewMimeType, type PreviewKind } from "./previewKinds";

/** Text files are shown up to this size; the rest is left for the download. */
const textLimit = 1_000_000;

type Content = { url?: string; text?: string; truncated?: boolean; error?: string };

/** Shows a stored attachment in a dialog: images, PDF, Markdown (rendered), plain text and code, video and audio. */
export function AttachmentPreview({
  attachment,
  kind,
  onDownload,
  onClose,
}: {
  attachment: Attachment;
  kind: PreviewKind;
  onDownload: () => void;
  onClose: () => void;
}) {
  const [content, setContent] = useState<Content>();
  useEffect(() => {
    let url = "";
    let cancelled = false;
    void (async () => {
      const blob = await loadAttachment(attachment.id);
      if (!blob) throw new Error("The file is not on this device.");
      if (kind === "text" || kind === "markdown") {
        const text = await blob.slice(0, textLimit).text();
        if (!cancelled) setContent({ text, truncated: blob.size > textLimit });
        return;
      }
      url = URL.createObjectURL(new Blob([blob], { type: previewMimeType(kind, attachment.name, blob.type) }));
      if (cancelled) URL.revokeObjectURL(url);
      else setContent({ url });
    })().catch((cause) => {
      if (!cancelled) setContent({ error: String(cause instanceof Error ? cause.message : cause) });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.id, attachment.name, kind]);

  // Rendered into <body>: inside the card dialog a fixed backdrop would be confined to the dialog's box.
  return createPortal(
    <Modal label={`Preview ${attachment.name}`} className="attachment-preview-dialog" onDismiss={onClose}>
      <header>
        <h2>{attachment.name}</h2>
        <button onClick={onDownload}>Download</button>
        <button className="plain-icon" onClick={onClose} aria-label="Close preview">
          <Icon name="close" />
        </button>
      </header>
      <div className={`attachment-preview-body preview-${kind}`}>
        {!content ? (
          <p className="hint">Loading…</p>
        ) : content.error ? (
          <p className="hint">{content.error}</p>
        ) : kind === "image" ? (
          <img src={content.url} alt={attachment.name} />
        ) : kind === "pdf" ? (
          <iframe src={content.url} title={attachment.name} />
        ) : kind === "video" ? (
          <video src={content.url} controls autoPlay />
        ) : kind === "audio" ? (
          <audio src={content.url} controls autoPlay />
        ) : kind === "markdown" ? (
          <MarkdownText text={content.text ?? ""} />
        ) : (
          <pre>{content.text}</pre>
        )}
        {content?.truncated && <p className="hint">Showing the first 1 MB. Download the file to see all of it.</p>}
      </div>
    </Modal>,
    document.body,
  );
}
