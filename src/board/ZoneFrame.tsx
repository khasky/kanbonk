import { ColorInput } from "../ui/ColorInput";
import type { Zone } from "../model";
import { useState, type ReactNode } from "react";
import { Icon } from "../ui/Icon";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { t } from "../i18n";
import { addListClass, composeActionsClass, composeClass, dragHandleClass } from "./boardLook";
import { endDrag, startDrag } from "./dragState";
import { NameEditor } from "../ui/NameEditor";

/**
 * A frame drawn around adjacent lists of one zone; its header drags the whole zone. A zone without lists is shown at
 * the end of the board with a drop area. Drops are handled by the board (`data-zone-id` marks the frame).
 */
export function ZoneFrame({
  zone,
  cardCount,
  onRename,
  onColor,
  onDelete,
  hidden = false,
  dropping = false,
  children,
}: {
  zone: Zone;
  cardCount: number;
  onRename: (name: string) => void;
  onColor: (color: string) => void;
  onDelete: () => void;
  /** Hidden while the zone is dragged to another place, which the board shows instead. */
  hidden?: boolean;
  /** A list dragged over the empty zone would land in it: its drop area turns into the list's place. */
  dropping?: boolean;
  /** The zone's lists; without them the zone shows a place to drop lists into. */
  children?: ReactNode;
}) {
  // A grid, not a flex column: its cards row then gets a definite height within the board, so the lists in it can
  // keep to that height and scroll their cards, as lists outside zones do.
  return (
    <section
      className="grid max-h-full flex-none grid-rows-[auto_minmax(0,1fr)] rounded-[14px] border-2 border-solid bg-[#ffffff26]"
      style={{ borderColor: zone.color, display: hidden ? "none" : undefined }}
      aria-label={t("board.zoneOf", { name: zone.name })}
      data-zone-id={zone.id}
      data-zone-empty={children ? undefined : ""}
    >
      <header
        className="sticky left-0 flex items-center gap-1.5 rounded-t-[11px] px-2 py-1 text-white"
        style={{ background: zone.color }}
      >
        <span
          className={dragHandleClass}
          draggable
          title={t("board.dragZone")}
          onDragStart={(event) => {
            event.dataTransfer.setData("text/kanbonk-zone", zone.id);
            const frame = event.currentTarget.closest("section")!;
            event.dataTransfer.setDragImage(frame, event.nativeEvent.offsetX + 8, event.nativeEvent.offsetY + 8);
            startDrag(frame, { kind: "zone", id: zone.id });
          }}
          onDragEnd={endDrag}
        >
          ⋮⋮
        </span>
        <NameEditor
          className="rounded-sm border-0 bg-transparent px-1.5 py-1 font-bold text-white focus:bg-[#0003]"
          label={t("board.zoneName")}
          size={Math.max(6, zone.name.length + 1)}
          value={zone.name}
          onCommit={onRename}
        />
        <small title={t("board.cardsInZone")}>{cardCount}</small>
        <ColorInput
          className="h-[22px] w-[22px] rounded-sm border-2 border-solid border-white bg-transparent p-0"
          label={t("board.zoneColorOf", { name: zone.name })}
          value={zone.color}
          onCommit={onColor}
        />
        <button
          className="rounded-sm border-0 bg-transparent px-1.5 py-0 text-[16px] text-white hover:bg-[#0003]"
          onClick={onDelete}
          aria-label={t("board.removeZoneOf", { name: zone.name })}
          title={t("board.removeZoneHint")}
        >
          ×
        </button>
      </header>
      <div className="flex min-h-0 items-start gap-3 p-2">
        {children ?? (
          <div
            className={
              dropping
                ? "grid min-h-24 w-[272px] place-items-center rounded-xl border-2 border-solid border-transparent bg-[#0000003d] font-semibold text-white"
                : "grid min-h-24 w-[272px] place-items-center rounded-xl border-2 border-dashed border-[#ffffffb3] font-semibold text-white"
            }
          >
            {t("board.dragListsHere")}
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
      <button className={addListClass} onClick={() => setName("")}>
        <Icon name="plus" /> {t("board.newZone")}
      </button>
    );
  const submit = () => {
    if (name.trim()) onCreate(name.trim());
    setName(undefined);
  };
  return (
    <div className={composeClass}>
      <Input
        className="w-full"
        autoFocus
        aria-label={t("board.zoneName")}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit();
          if (event.key === "Escape") setName(undefined);
        }}
        placeholder={t("board.zoneNamePlaceholder")}
      />
      <div className={composeActionsClass}>
        <Button variant="primary" onClick={submit}>
          {t("board.addZone")}
        </Button>
        <Button variant="icon" onClick={() => setName(undefined)} aria-label={t("common.cancel")}>
          <Icon name="close" />
        </Button>
      </div>
    </div>
  );
}
