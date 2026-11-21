import { ColorInput } from "../ui/ColorInput";
import type { Zone } from "../model";
import { useState, type ReactNode } from "react";
import { Icon } from "../ui/Icon";

/**
 * A frame drawn around adjacent lists of one zone; its header drags the whole zone and accepts dropped lists. A zone
 * without lists is shown at the end of the board with a drop area.
 */
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
  /** The zone's lists; without them the zone shows a place to drop lists into. */
  children?: ReactNode;
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
      <div className="zone-lists">
        {children ?? (
          <div
            className="zone-empty"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const listId = event.dataTransfer.getData("text/kanbonk-list");
              if (!listId) return;
              event.preventDefault();
              onDropList(listId);
            }}
          >
            Drag lists here
          </div>
        )}
      </div>
    </section>
  );
}

/** "New zone" at the end of the board: asks for a name and adds an empty zone that lists can be dragged into. */
export function ZoneComposer({ onCreate }: { onCreate: (name: string) => void }) {
  const [name, setName] = useState<string>();
  if (name === undefined)
    return (
      <button onClick={() => setName("")}>
        <Icon name="plus" /> New zone
      </button>
    );
  const submit = () => {
    if (name.trim()) onCreate(name.trim());
    setName(undefined);
  };
  return (
    <div className="compose">
      <input
        autoFocus
        aria-label="Zone name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit();
          if (event.key === "Escape") setName(undefined);
        }}
        placeholder="Zone name, e.g. Development"
      />
      <div>
        <button className="primary-button" onClick={submit}>
          Add zone
        </button>
        <button className="plain-icon" onClick={() => setName(undefined)} aria-label="Cancel">
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
}
