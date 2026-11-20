import type { ReactNode } from "react";
import type { PanelLayout } from "../hooks/usePanelLayout";
import type { PanelName } from "../uiPreferences";

/** An Inbox or Planner panel next to the board, with a handle that resizes it by pointer or arrow keys. */
export function PanelSlot({ name, layout, children }: { name: PanelName; layout: PanelLayout; children: ReactNode }) {
  const width = layout.width(name);
  return (
    <div className="panel-slot">
      <aside className={name === "planner" ? "aux-panel planner-panel" : "aux-panel inbox-panel"} style={{ width }}>
        {children}
      </aside>
      <div
        className="panel-resizer"
        role="separator"
        tabIndex={0}
        aria-label={`Resize panel ${name === "inbox" ? "Inbox" : "Planner"}`}
        aria-orientation="vertical"
        aria-valuemin={220}
        aria-valuemax={layout.widthLimit}
        aria-valuenow={width}
        onPointerDown={(event) => layout.resizeStart(event, name)}
        onKeyDown={(event) => layout.resizeKey(event, name)}
      />
    </div>
  );
}
