import type { ReactNode } from "react";
import type { PanelLayout } from "../hooks/usePanelLayout";
import { t } from "../i18n";
import type { PanelName } from "../lib/uiPreferences";

const panelLook = {
  inbox: "w-[300px] bg-brand-soft",
  planner: "w-[400px] bg-white",
};

/** An Inbox or Planner panel next to the board, with a handle that resizes it by pointer or arrow keys. */
export function PanelSlot({ name, layout, children }: { name: PanelName; layout: PanelLayout; children: ReactNode }) {
  const width = layout.width(name);
  return (
    <div className="flex min-h-0 min-w-0 flex-none max-phone:w-full">
      <aside
        className={`flex min-h-0 min-w-0 max-w-[calc(100vw_-_580px)] flex-none flex-col border-r border-line max-tablet:w-[260px]! max-tablet:max-w-none max-phone:w-full! max-phone:border-0 ${panelLook[name]}`}
        style={{ width }}
      >
        {children}
      </aside>
      <div
        className="w-2 flex-none cursor-col-resize touch-none bg-line hover:bg-brand hover:outline-none focus-visible:bg-brand focus-visible:outline-none max-tablet:hidden"
        role="separator"
        tabIndex={0}
        aria-label={t("layout.resizePanel", { name: t(name === "inbox" ? "layout.inbox" : "layout.planner") })}
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
