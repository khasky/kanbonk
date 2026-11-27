import { useEffect, useRef, useState } from "react";
import type { Card } from "../model";
import { formatDateTime, t } from "../i18n";
import { platform } from "../lib/platform";
import { loadAttachment } from "../lib/storage";
import { AttachmentPreview } from "./AttachmentPreview";
import { previewKind } from "./previewKinds";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { Menu, MenuItem } from "../ui/Menu";
import { Popover } from "../ui/Popover";

const openClass =
  "grid size-8 flex-none place-items-center rounded-sm border-0 bg-transparent text-ink-subtle no-underline hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50";

/** The image of an attachment, read from this device, or "" while there is none. */
export function useImageUrl(attachment: Card["attachments"][number]) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (attachment.status !== "local" || !attachment.mimeType.startsWith("image/")) return;
    let objectUrl = "";
    let cancelled = false;
    loadAttachment(attachment.id)
      .then((blob) => {
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl("");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, attachment.mimeType, attachment.status]);
  return url;
}

/**
 * An attachment as Trello shows it: a thumbnail, its name and when it was added, a button that opens it (a preview, the
 * link or the linked card) and a "⋯" menu to rename, download, make it the cover or remove it. A menu action is
 * absent when its handler is.
 */
export function AttachmentRow({
  attachment,
  linkedCard,
  isCover,
  onNavigateCard,
  onDownload,
  onRename,
  onToggleCover,
  onRemove,
}: {
  attachment: Card["attachments"][number];
  linkedCard?: Card;
  isCover: boolean;
  onNavigateCard: (card: Card) => void;
  onDownload: (id: string, name: string) => void;
  onRename?: (name: string) => void;
  onToggleCover?: () => void;
  /** Absent while the attachment cannot be removed, e.g. from a card in the trash. */
  onRemove?: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(attachment.name);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const imageUrl = useImageUrl(attachment);
  const isLink = attachment.status === "link";
  const isFile = attachment.status !== "link";
  // Android WebViews have no PDF viewer, so PDFs are only downloaded there.
  const preview = attachment.status === "local" ? previewKind(attachment.name, attachment.mimeType) : undefined;
  const canPreview = preview && !(preview === "pdf" && platform === "mobile");
  const webUrl = isLink && !attachment.linkedCardId && /^https?:\/\//.test(attachment.sourceUrl ?? "");
  const openCard = linkedCard && !linkedCard.deletedAt ? linkedCard : undefined;
  const extension = attachment.name.includes(".") ? attachment.name.split(".").pop()?.slice(0, 4) : "";

  let note: string;
  if (attachment.linkedCardId && !openCard) note = t("card.cardUnavailable");
  else if (isLink && !openCard && !webUrl) note = t("card.linkUnavailable");
  else if (attachment.addedAt)
    note = t("card.addedOn", { date: formatDateTime(attachment.addedAt, { dateStyle: "medium", timeStyle: "short" }) });
  else note = isLink ? t("card.link") : t("card.sizeKb", { size: Math.round(attachment.size / 1024) });
  if (attachment.status === "missing") note += ` ${t("card.fileMissing")}`;

  const openLabel = t("card.openAttachment", { name: attachment.name });
  let open = (
    <button
      className={openClass}
      onClick={() => (canPreview ? setPreviewOpen(true) : onDownload(attachment.id, attachment.name))}
      disabled={attachment.status === "missing"}
      aria-label={canPreview ? t("card.previewName", { name: attachment.name }) : openLabel}
      title={canPreview ? t("card.preview") : t("card.download")}
    >
      <Icon name="external" className="size-5" />
    </button>
  );
  if (isLink)
    open = webUrl ? (
      <a className={openClass} href={attachment.sourceUrl} target="_blank" rel="noopener noreferrer" title={openLabel}>
        <Icon name="external" className="size-5" />
      </a>
    ) : (
      <button
        className={openClass}
        onClick={() => openCard && onNavigateCard(openCard)}
        disabled={!openCard}
        aria-label={openLabel}
        title={t("card.openCard")}
      >
        <Icon name="external" className="size-5" />
      </button>
    );

  return (
    <div className="flex items-center gap-3 py-1">
      <span className="grid h-12 w-16 flex-none place-items-center overflow-hidden rounded-[3px] bg-surface-sunken text-[13px] font-bold text-ink-subtle uppercase">
        {imageUrl ? (
          <img className="size-full object-cover" src={imageUrl} alt="" />
        ) : isLink ? (
          <Icon name="link" className="size-5" />
        ) : (
          extension || <Icon name="clip" className="size-5" />
        )}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate text-[14px] font-bold text-ink">{attachment.name}</span>
        <span className="text-[14px] text-ink-subtle">{note}</span>
      </span>
      {open}
      <Menu
        ref={menuRef}
        label={t("card.attachmentActions", { name: attachment.name })}
        summaryClassName="grid size-8 place-items-center rounded-sm border border-line bg-white text-[18px] leading-none text-ink-subtle hover:bg-surface-sunken group-open/menu:bg-surface-sunken"
        touchRows
      >
        {onRename && (
          <MenuItem
            onClick={() => {
              setName(attachment.name);
              setEditing(true);
            }}
          >
            {t("common.edit")}
          </MenuItem>
        )}
        {isFile && (
          <MenuItem
            onClick={() => onDownload(attachment.id, attachment.name)}
            disabled={attachment.status === "missing"}
          >
            {t("card.download")}
          </MenuItem>
        )}
        {onToggleCover && imageUrl && (
          <MenuItem onClick={onToggleCover}>{isCover ? t("card.removeCover") : t("card.makeCover")}</MenuItem>
        )}
        {onRemove && (
          <MenuItem danger onClick={onRemove}>
            {t("common.remove")}
          </MenuItem>
        )}
      </Menu>
      {editing && onRename && menuRef.current && (
        <Popover title={t("card.editAttachment")} anchor={menuRef.current} onClose={() => setEditing(false)}>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim() && name.trim() !== attachment.name) onRename(name.trim());
              setEditing(false);
            }}
          >
            <label className="grid gap-1 text-[12px] font-semibold text-ink-subtle">
              {t("card.attachmentName")}
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <Button variant="primary" type="submit" className="justify-self-start">
              {t("common.save")}
            </Button>
          </form>
        </Popover>
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
