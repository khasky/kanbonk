import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Attachment } from "../model";
import { loadAttachment } from "../lib/storage";
import { Icon } from "../ui/Icon";
import { MarkdownText } from "../ui/MarkdownText";
import { Modal } from "../ui/Modal";
import { previewMimeType, type PreviewKind } from "./previewKinds";
import { Button } from "../ui/Button";
import { Hint } from "../ui/Hint";

/** Text files are shown up to this size; the rest is left for the download. */
const textLimit = 1_000_000;

const bodyLooks: Record<PreviewKind, string> = {
  image: "grid min-h-0 flex-1 place-items-center overflow-auto bg-surface-soft p-4",
  video: "grid min-h-0 flex-1 place-items-center overflow-auto bg-surface-soft p-4",
  audio: "grid min-h-0 flex-1 place-items-center overflow-auto bg-surface-soft p-4",
  pdf: "min-h-0 flex-1 overflow-auto p-0",
  markdown: "min-h-0 flex-1 overflow-auto p-4",
  text: "min-h-0 flex-1 overflow-auto p-4",
};

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
    <Modal
      label={`Preview ${attachment.name}`}
      className="z-101 flex h-[calc(100dvh-96px)] w-[min(1100px,100%)] flex-col overflow-hidden rounded-[10px] bg-white shadow-dialog max-phone:h-dvh max-phone:max-h-dvh max-phone:w-full max-phone:rounded-none"
      onDismiss={onClose}
    >
      <header className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <h2 className="m-0 min-w-0 flex-1 text-[16px] wrap-anywhere">{attachment.name}</h2>
        <Button variant="secondary" onClick={onDownload}>
          Download
        </Button>
        <Button variant="icon" onClick={onClose} aria-label="Close preview">
          <Icon name="close" />
        </Button>
      </header>
      <div className={bodyLooks[kind]}>
        {!content ? (
          <Hint>Loading…</Hint>
        ) : content.error ? (
          <Hint>{content.error}</Hint>
        ) : kind === "image" ? (
          <img className="max-h-full max-w-full object-contain" src={content.url} alt={attachment.name} />
        ) : kind === "pdf" ? (
          <iframe className="h-full w-full border-0" src={content.url} title={attachment.name} />
        ) : kind === "video" ? (
          <video className="max-h-full max-w-full object-contain" src={content.url} controls autoPlay />
        ) : kind === "audio" ? (
          <audio src={content.url} controls autoPlay />
        ) : kind === "markdown" ? (
          <MarkdownText text={content.text ?? ""} />
        ) : (
          <pre className="m-0 font-[family-name:ui-monospace,SFMono-Regular,Consolas,monospace] text-[13px] leading-[1.5] whitespace-pre-wrap text-ink wrap-anywhere">
            {content.text}
          </pre>
        )}
        {content?.truncated && <Hint>Showing the first 1 MB. Download the file to see all of it.</Hint>}
      </div>
    </Modal>,
    document.body,
  );
}
