import { ColorInput } from "../ColorInput";
import type { Zone } from "../model";
import type { ReactNode } from "react";

/** A frame drawn around adjacent lists of one zone; its header drags the whole zone and accepts dropped lists. */
export function ZoneFrame({
  zone,
  cardCount,
  onRename,
  onColor,
  onDelete,
  onDropList,
  children,
}: {
  zone: Zone;
  cardCount: number;
  onRename: (name: string) => void;
  onColor: (color: string) => void;
  onDelete: () => void;
  onDropList: (listId: string) => void;
  children: ReactNode;
}) {
  return (
    <section className="zone-frame" style={{ borderColor: zone.color }} aria-label={`Zone ${zone.name}`}>
      <header
        className="zone-header"
        style={{ background: zone.color }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          const listId = event.dataTransfer.getData("text/kanbonk-list");
          if (!listId) return;
          event.preventDefault();
          event.stopPropagation();
          onDropList(listId);
        }}
      >
        <span
          className="list-drag-handle"
          draggable
          title="Drag zone"
          onDragStart={(event) => event.dataTransfer.setData("text/kanbonk-zone", zone.id)}
        >
          ⋮⋮
        </span>
        <input
          aria-label="Zone name"
          size={Math.max(6, zone.name.length + 1)}
          defaultValue={zone.name}
          key={zone.name}
          onBlur={(event) => {
            const name = event.target.value.trim();
            if (name && name !== zone.name) onRename(name);
            else event.target.value = zone.name;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <small title="Cards in zone">{cardCount}</small>
        <ColorInput label={`Zone color ${zone.name}`} value={zone.color} onCommit={onColor} />
        <button onClick={onDelete} aria-label={`Remove zone ${zone.name}`} title="Remove zone (lists stay)">
          ×
        </button>
      </header>
      <div className="zone-lists">{children}</div>
    </section>
  );
}
