import { memo } from "react";
import { CardCover } from "../card/CardCover";
import { CardStickers } from "../card/CardStickers";
import { readableTextColor } from "../model/labelColors";
import type { Card, Label, Member } from "../model";
import { Icon } from "../ui/Icon";

export interface TileActions {
  open: (id: string) => void;
  drop: (movingId: string, target: Card) => void;
}

/** One card on a board; memoised so typing or editing elsewhere does not re-render thousands of tiles. */
export const CardTile = memo(function CardTile({
  card: item,
  labels,
  members,
  parentName,
  actions,
}: {
  card: Card;
  labels: Map<string, Label>;
  members?: Member[];
  parentName?: string;
  actions: TileActions;
}) {
  return (
    <button
      className={`card-tile ${item.cover?.size === "full" ? (item.cover.attachmentId ? "full-cover" : "full-color") : ""}`}
      style={
        item.cover?.size === "full" && item.cover.color
          ? { background: item.cover.color, color: readableTextColor(item.cover.color) }
          : undefined
      }
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/kanbonk-card", item.id)}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onDrop={(event) => {
        const movingId = event.dataTransfer.getData("text/kanbonk-card");
        if (!movingId) return;
        event.preventDefault();
        event.stopPropagation();
        actions.drop(movingId, item);
      }}
      onClick={() => actions.open(item.id)}
    >
      <CardCover card={item} />
      <CardStickers card={item} />
      {item.labelIds.some((id) => labels.get(id)?.color) && (
        <span className="card-labels">
          {item.labelIds.map((id) => {
            const label = labels.get(id);
            return (
              label?.color && (
                <span key={id} style={{ background: label.color, color: readableTextColor(label.color) }}>
                  {label.name}
                </span>
              )
            );
          })}
        </span>
      )}
      <span className="card-name">
        {item.completed && <span className="complete-mark">✓</span>}
        {item.name}
      </span>
      {item.isTemplate && <span className="template-badge">Template</span>}
      {parentName && (
        <span className="sub-card-parent" title="Parent card">
          ↳ {parentName}
        </span>
      )}
      {(item.memberIds ?? []).length > 0 && (
        <span className="card-members" aria-label="Card members">
          {(item.memberIds ?? []).map((id) => {
            const member = members?.find((entry) => entry.id === id);
            return (
              member && (
                <span key={id} title={member.name}>
                  {member.name.slice(0, 2).toUpperCase()}
                </span>
              )
            );
          })}
        </span>
      )}
      {item.description || item.dueAt || item.attachments.length || item.comments.length || item.checklists.length ? (
        <span className="card-meta">
          {item.description && "≡"}
          {item.dueAt && (
            <span>
              <Icon name="clock" />
              {new Date(item.dueAt).toLocaleDateString()}
            </span>
          )}
          {item.attachments.length > 0 && (
            <span>
              <Icon name="clip" />
              {item.attachments.length}
            </span>
          )}
          {item.comments.length > 0 && <span>☰ {item.comments.length}</span>}
          {item.checklists.map((checklist) => (
            <span key={checklist.id}>
              ☑ {checklist.items.filter((entry) => entry.checked).length}/{checklist.items.length}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
});
