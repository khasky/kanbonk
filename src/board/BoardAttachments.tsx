import { useMemo, useState } from "react";
import { formatDateTime, type MessageKey, t } from "../i18n";
import { platform } from "../lib/platform";
import type { AppState, BoardList, Card } from "../model";
import { AttachmentPreview } from "../card/AttachmentPreview";
import { useImageUrl } from "../card/AttachmentRow";
import { previewKind } from "../card/previewKinds";
import { Input, Select } from "../ui/Field";
import { Hint } from "../ui/Hint";
import { Icon } from "../ui/Icon";
import {
  type AttachmentKind,
  type AttachmentSort,
  attachmentKinds,
  type BoardAttachment,
  boardAttachments,
  findAttachments,
  formatSize,
} from "./attachmentIndex";

const kindNames: Record<AttachmentKind, MessageKey> = {
  image: "attachments.image",
  video: "attachments.video",
  audio: "attachments.audio",
  pdf: "attachments.pdf",
  document: "attachments.document",
  archive: "attachments.archive",
  link: "attachments.link",
  other: "attachments.other",
};
const sorts: Array<[AttachmentSort, MessageKey]> = [
  ["newest", "attachments.newest"],
  ["oldest", "attachments.oldest"],
  ["name", "attachments.name"],
  ["largest", "attachments.largest"],
  ["card", "attachments.card"],
];

const cellClass = "border-t border-line px-2 py-1.5 align-middle";
const iconButtonClass =
  "grid size-8 flex-none cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-ink-subtle hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50";
const linkClass =
  "min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left text-[14px] font-semibold wrap-anywhere text-ink hover:underline disabled:cursor-default disabled:no-underline";

/** One attachment: its thumbnail and name (opening a preview, the link or the linked card), card, list, size and date. */
function AttachmentLine({
  item,
  cardById,
  onOpenCard,
  onDownload,
}: {
  item: BoardAttachment;
  cardById: Map<string, Card>;
  onOpenCard: (card: Card) => void;
  onDownload: (id: string, name: string) => void;
}) {
  const { attachment, card, list } = item;
  const [previewOpen, setPreviewOpen] = useState(false);
  const imageUrl = useImageUrl(attachment);
  const missing = attachment.status === "missing";
  const preview = attachment.status === "local" ? previewKind(attachment.name, attachment.mimeType) : undefined;
  const canPreview = preview && !(preview === "pdf" && platform === "mobile");
  const linked = attachment.linkedCardId ? cardById.get(attachment.linkedCardId) : undefined;
  const webUrl = item.kind === "link" && !attachment.linkedCardId && /^https?:\/\//.test(attachment.sourceUrl ?? "");
  const extension = attachment.name.includes(".") ? attachment.name.split(".").pop()?.slice(0, 4) : "";
  const label = t("attachments.open", { name: attachment.name });

  let name = (
    <button
      type="button"
      className={linkClass}
      disabled={missing}
      aria-label={label}
      onClick={() => (canPreview ? setPreviewOpen(true) : onDownload(attachment.id, attachment.name))}
    >
      {attachment.name}
    </button>
  );
  if (webUrl)
    name = (
      <a className={linkClass} href={attachment.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={label}>
        {attachment.name}
      </a>
    );
  else if (item.kind === "link")
    name = (
      <button
        type="button"
        className={linkClass}
        disabled={!linked || Boolean(linked.deletedAt)}
        aria-label={label}
        onClick={() => linked && onOpenCard(linked)}
      >
        {attachment.name}
      </button>
    );

  return (
    <tr>
      <td className={cellClass}>
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-12 flex-none place-items-center overflow-hidden rounded-[3px] bg-surface-sunken text-[11px] font-bold text-ink-subtle uppercase">
            {imageUrl ? (
              <img className="size-full object-cover" src={imageUrl} alt="" />
            ) : item.kind === "link" ? (
              <Icon name="link" className="size-4" />
            ) : (
              extension || <Icon name="clip" className="size-4" />
            )}
          </span>
          <span className="grid min-w-0 gap-0.5">
            {name}
            {missing && <small className="text-ink-subtle">{t("attachments.missing")}</small>}
          </span>
        </span>
      </td>
      <td className={`${cellClass} max-w-[220px] max-phone:max-w-[110px]`}>
        <button
          type="button"
          className="max-w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[14px] text-brand hover:underline"
          aria-label={t("attachments.openCard", { name: card.name })}
          onClick={() => onOpenCard(card)}
        >
          {card.name}
        </button>
      </td>
      <td className={`${cellClass} text-[14px] text-ink-subtle max-phone:hidden`}>{list?.name}</td>
      <td className={`${cellClass} text-[13px] whitespace-nowrap text-ink-subtle`}>
        {item.kind === "link" ? "—" : formatSize(attachment.size)}
      </td>
      <td className={`${cellClass} text-[13px] whitespace-nowrap text-ink-subtle max-phone:hidden`}>
        {attachment.addedAt && formatDateTime(attachment.addedAt, { dateStyle: "medium" })}
      </td>
      <td className={`${cellClass} w-10`}>
        {item.kind !== "link" && (
          <button
            type="button"
            className={iconButtonClass}
            disabled={missing}
            aria-label={t("attachments.download", { name: attachment.name })}
            title={t("card.download")}
            onClick={() => onDownload(attachment.id, attachment.name)}
          >
            <Icon name="download" className="size-4" />
          </button>
        )}
        {previewOpen && preview && (
          <AttachmentPreview
            attachment={attachment}
            kind={preview}
            onDownload={() => onDownload(attachment.id, attachment.name)}
            onClose={() => setPreviewOpen(false)}
          />
        )}
      </td>
    </tr>
  );
}

/** Every attachment of the board's cards (as the board filter shows them) in one table to search, filter and sort. */
export function BoardAttachments({
  state,
  cards,
  lists,
  onOpenCard,
  onDownload,
}: {
  state: AppState;
  cards: Card[];
  lists: BoardList[];
  onOpenCard: (card: Card) => void;
  onDownload: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<AttachmentKind | "">("");
  const [listId, setListId] = useState("");
  const [sort, setSort] = useState<AttachmentSort>("newest");
  const all = useMemo(() => boardAttachments(state, cards), [state, cards]);
  const shown = findAttachments(all, { query, kind, listId, sort });
  const cardById = useMemo(() => new Map(state.cards.map((card) => [card.id, card])), [state.cards]);
  const counts = new Map<AttachmentKind, number>();
  for (const item of all) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  const size = shown.reduce((total, item) => total + (item.kind === "link" ? 0 : item.attachment.size), 0);
  return (
    <section
      className="mx-3 mt-0 mb-3 flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto rounded-[10px] bg-white p-3 text-ink"
      aria-label={t("attachments.region")}
    >
      <div className="flex flex-wrap items-end gap-2">
        <Input
          type="search"
          className="min-w-[200px] flex-1"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("attachments.searchPlaceholder")}
          aria-label={t("attachments.search")}
        />
        <Select
          aria-label={t("attachments.type")}
          value={kind}
          onChange={(event) => setKind(event.target.value as AttachmentKind | "")}
        >
          <option value="">{t("attachments.anyType")}</option>
          {attachmentKinds
            .filter((item) => counts.has(item))
            .map((item) => (
              <option key={item} value={item}>
                {`${t(kindNames[item])} (${counts.get(item)})`}
              </option>
            ))}
        </Select>
        <Select aria-label={t("attachments.list")} value={listId} onChange={(event) => setListId(event.target.value)}>
          <option value="">{t("attachments.anyList")}</option>
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t("attachments.sort")}
          value={sort}
          onChange={(event) => setSort(event.target.value as AttachmentSort)}
        >
          {sorts.map(([value, key]) => (
            <option key={value} value={value}>
              {t(key)}
            </option>
          ))}
        </Select>
      </div>
      {all.length ? (
        <>
          <p className="m-0 text-[13px] text-ink-subtle" aria-live="polite">
            {t("attachments.count", { count: shown.length, size: formatSize(size) })}
          </p>
          {shown.length ? (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="text-[12px] text-ink-muted">
                  <th className="px-2 py-1 font-bold">{t("attachments.file")}</th>
                  <th className="px-2 py-1 font-bold">{t("attachments.card")}</th>
                  <th className="px-2 py-1 font-bold max-phone:hidden">{t("attachments.list")}</th>
                  <th className="px-2 py-1 font-bold">{t("attachments.size")}</th>
                  <th className="px-2 py-1 font-bold max-phone:hidden">{t("attachments.added")}</th>
                  <th className="px-2 py-1">
                    <span className="sr-only">{t("card.download")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => (
                  <AttachmentLine
                    key={`${item.card.id}:${item.attachment.id}`}
                    item={item}
                    cardById={cardById}
                    onOpenCard={onOpenCard}
                    onDownload={onDownload}
                  />
                ))}
              </tbody>
            </table>
          ) : (
            <p className="m-0 text-[14px] text-ink-subtle">{t("attachments.noMatch")}</p>
          )}
        </>
      ) : (
        <p className="m-0 text-[14px] text-ink-subtle">{t("attachments.none")}</p>
      )}
      <Hint>{t("attachments.hint")}</Hint>
    </section>
  );
}
