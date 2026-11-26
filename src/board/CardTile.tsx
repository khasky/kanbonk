import { memo } from "react";
import { CardCover } from "../card/CardCover";
import { readableTextColor } from "../model/labelColors";
import type { Card, Label, Member } from "../model";
import { AppLink } from "../ui/AppLink";
import { Icon } from "../ui/Icon";
import { formatDate, t } from "../i18n";
import { useLocale } from "../i18n/nodes";
import { endDrag, startDrag } from "./dragState";
import { tileClass, tileMetaClass, tileMetaIconClass, tileMetaItemClass, tileNameClass } from "./tileLook";

export interface TileActions {
  open: (id: string) => void;
}

/** One card on a board; memoised so typing or editing elsewhere does not re-render thousands of tiles. */
export const CardTile = memo(function CardTile({
  card: item,
  labels,
  members,
  parentName,
  subCardCount = 0,
  actions,
  hidden = false,
}: {
  card: Card;
  labels: Map<string, Label>;
  members?: Member[];
  parentName?: string;
  subCardCount?: number;
  actions: TileActions;
  /** Hidden while it is dragged to another place, which the board shows instead. */
  hidden?: boolean;
}) {
  // A memoised tile still renders again in a newly chosen language.
  useLocale();
  const full = item.cover?.size === "full";
  const fullCover = full && Boolean(item.cover?.attachmentId);
  return (
    <AppLink
      href={`/c/${encodeURIComponent(item.id)}`}
      className={tileClass(fullCover)}
      style={{
        ...(item.cover?.size === "full" && item.cover.color
          ? { background: item.cover.color, color: readableTextColor(item.cover.color) }
          : undefined),
        display: hidden ? "none" : undefined,
      }}
      data-card-id={item.id}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/kanbonk-card", item.id);
        startDrag(event.currentTarget, { kind: "card", id: item.id });
      }}
      onDragEnd={endDrag}
      onOpen={() => actions.open(item.id)}
    >
      <CardCover card={item} fill={fullCover} />
      {item.labelIds.some((id) => labels.get(id)?.color) && (
        <span className={fullCover ? "hidden" : "flex flex-wrap gap-1"}>
          {item.labelIds.map((id) => {
            const label = labels.get(id);
            return (
              label?.color && (
                <span
                  key={id}
                  className="min-w-10 rounded-[3px] px-2 py-0.5 text-[11px] font-bold"
                  style={{ background: label.color, color: readableTextColor(label.color) }}
                >
                  {label.name}
                </span>
              )
            );
          })}
        </span>
      )}
      <span className={tileNameClass(fullCover)}>{item.name}</span>
      {item.isTemplate && (
        <span className="self-start rounded-[3px] bg-line px-[5px] py-0.5 text-[11px] font-bold text-ink-subtle">
          {t("board.template")}
        </span>
      )}
      {parentName && (
        <span className="truncate text-[12px] opacity-75" title={t("board.parentCard")}>
          ↳ {parentName}
        </span>
      )}
      {(item.memberIds ?? []).length > 0 && (
        <span className="flex flex-wrap gap-1 self-end" aria-label={t("board.cardMembers")}>
          {(item.memberIds ?? []).map((id) => {
            const member = members?.find((entry) => entry.id === id);
            return (
              member && (
                <span
                  key={id}
                  className="grid h-6 w-6 place-items-center rounded-[50%] bg-line text-[10px] font-bold text-ink"
                  title={member.name}
                >
                  {member.name.slice(0, 2).toUpperCase()}
                </span>
              )
            );
          })}
        </span>
      )}
      {item.description ||
      item.dueAt ||
      item.attachments.length ||
      item.comments.length ||
      item.checklists.length ||
      subCardCount ? (
        <span className={fullCover ? "hidden" : tileMetaClass(full)}>
          {item.description && <Icon name="text" className={tileMetaIconClass} />}
          {item.dueAt && (
            <span className={tileMetaItemClass}>
              <Icon name="clock" className={tileMetaIconClass} />
              {formatDate(item.dueAt)}
            </span>
          )}
          {item.attachments.length > 0 && (
            <span className={tileMetaItemClass}>
              <Icon name="clip" className={tileMetaIconClass} />
              {item.attachments.length}
            </span>
          )}
          {item.comments.length > 0 && (
            <span className={tileMetaItemClass}>
              <Icon name="message" className={tileMetaIconClass} />
              {item.comments.length}
            </span>
          )}
          {subCardCount > 0 && (
            <span className={tileMetaItemClass} title={t("card.subCards")}>
              <Icon name="sub-cards" className={tileMetaIconClass} />
              {subCardCount}
            </span>
          )}
          {item.checklists.map((checklist) => (
            <span key={checklist.id} className={tileMetaItemClass}>
              <Icon name="check-square" className={tileMetaIconClass} />
              {checklist.items.filter((entry) => entry.checked).length}/{checklist.items.length}
            </span>
          ))}
        </span>
      ) : null}
    </AppLink>
  );
});
