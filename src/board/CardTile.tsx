import { memo } from "react";
import { CardCover } from "../card/CardCover";
import { CardStickers } from "../card/CardStickers";
import { readableTextColor } from "../model/labelColors";
import type { Card, Label, Member } from "../model";
import { Icon } from "../ui/Icon";
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
  actions,
  hidden = false,
}: {
  card: Card;
  labels: Map<string, Label>;
  members?: Member[];
  parentName?: string;
  actions: TileActions;
  /** Hidden while it is dragged to another place, which the board shows instead. */
  hidden?: boolean;
}) {
  const full = item.cover?.size === "full";
  const fullCover = full && Boolean(item.cover?.attachmentId);
  return (
    <button
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
      onClick={() => actions.open(item.id)}
    >
      <CardCover card={item} fill={fullCover} />
      <CardStickers card={item} />
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
          Template
        </span>
      )}
      {parentName && (
        <span className="truncate text-[12px] opacity-75" title="Parent card">
          ↳ {parentName}
        </span>
      )}
      {(item.memberIds ?? []).length > 0 && (
        <span className="flex flex-wrap gap-1 self-end" aria-label="Card members">
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
      {item.description || item.dueAt || item.attachments.length || item.comments.length || item.checklists.length ? (
        <span className={fullCover ? "hidden" : tileMetaClass(full)}>
          {item.description && "≡"}
          {item.dueAt && (
            <span className={tileMetaItemClass}>
              <Icon name="clock" className={tileMetaIconClass} />
              {new Date(item.dueAt).toLocaleDateString()}
            </span>
          )}
          {item.attachments.length > 0 && (
            <span className={tileMetaItemClass}>
              <Icon name="clip" className={tileMetaIconClass} />
              {item.attachments.length}
            </span>
          )}
          {item.comments.length > 0 && <span className={tileMetaItemClass}>☰ {item.comments.length}</span>}
          {item.checklists.map((checklist) => (
            <span key={checklist.id} className={tileMetaItemClass}>
              ☑ {checklist.items.filter((entry) => entry.checked).length}/{checklist.items.length}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
});
