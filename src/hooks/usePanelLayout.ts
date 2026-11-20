import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, useEffect, useState } from "react";
import { type PanelName, type PanelVisibility, type PanelWidths, readPanelWidths } from "../uiPreferences";

const minWidth = 220;
/** From this viewport width both panels can be open next to the board; below it only the active one is shown. */
const wideLayoutWidth = 1500;

/**
 * The Inbox and Planner side panels: which are open, which is active and how wide they are.
 * Open panels, the active panel and widths are kept in localStorage; `restore` reads them back once data is loaded.
 */
export function usePanelLayout({ ready, onError }: { ready: boolean; onError: (message: string) => void }) {
  const [activePanel, setActivePanel] = useState<PanelName | null>(null);
  const [visiblePanels, setVisiblePanels] = useState<PanelVisibility>({ inbox: false, planner: false });
  const [panelWidths, setPanelWidths] = useState<PanelWidths>(readPanelWidths);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);

  const wideLayout = viewportWidth >= wideLayoutWidth;
  const shownPanels: PanelName[] = wideLayout
    ? (["inbox", "planner"] as const).filter((name) => visiblePanels[name])
    : activePanel && visiblePanels[activePanel]
      ? [activePanel]
      : [];
  const widthLimit = Math.max(
    minWidth,
    Math.min(720, shownPanels.length === 2 ? Math.floor((viewportWidth - 776) / 2) : viewportWidth - 580),
  );

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", update);
    update();
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    localStorage.setItem("kanbonk-panel-widths", JSON.stringify(panelWidths));
  }, [panelWidths]);
  useEffect(() => {
    if (ready) localStorage.setItem("kanbonk-open-panels", JSON.stringify(visiblePanels));
  }, [visiblePanels, ready]);
  useEffect(() => {
    if (!ready) return;
    try {
      if (activePanel) localStorage.setItem("kanbonk-active-panel", activePanel);
      else localStorage.removeItem("kanbonk-active-panel");
    } catch (cause) {
      onError(`Could not save the selected section: ${String(cause)}`);
    }
  }, [activePanel, ready]);

  function restore() {
    const savedPanel = localStorage.getItem("kanbonk-active-panel");
    const initialPanel = savedPanel === "inbox" || savedPanel === "planner" ? savedPanel : null;
    setActivePanel(initialPanel);
    try {
      const stored = JSON.parse(localStorage.getItem("kanbonk-open-panels") ?? "null");
      setVisiblePanels(
        stored && typeof stored.inbox === "boolean" && typeof stored.planner === "boolean"
          ? stored
          : { inbox: initialPanel === "inbox", planner: initialPanel === "planner" },
      );
    } catch {
      setVisiblePanels({ inbox: initialPanel === "inbox", planner: initialPanel === "planner" });
    }
  }

  function show(target: PanelName) {
    setVisiblePanels((current) => ({ ...current, [target]: true }));
    setActivePanel(target);
  }

  /** On a narrow screen a click on another panel's link switches to it; otherwise it opens or closes the panel. */
  function toggle(target: PanelName) {
    if (!wideLayout && activePanel !== target) {
      show(target);
      return;
    }
    const opening = !visiblePanels[target];
    const other = target === "inbox" ? "planner" : "inbox";
    setVisiblePanels((current) => ({ ...current, [target]: opening }));
    setActivePanel(opening ? target : visiblePanels[other] && wideLayout ? other : null);
  }

  /** Makes the main area active again, so on a narrow screen the open panel gives way to the board. */
  function deactivate() {
    setActivePanel(null);
  }

  const width = (panel: PanelName) => Math.min(panelWidths[panel], widthLimit);

  function resizeStart(event: ReactPointerEvent<HTMLDivElement>, panel: PanelName) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = width(panel);
    const handle = event.currentTarget;
    function move(pointer: PointerEvent) {
      setPanelWidths((current) => ({
        ...current,
        [panel]: Math.min(widthLimit, Math.max(minWidth, startWidth + pointer.clientX - startX)),
      }));
    }
    function stop() {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    }
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  function resizeKey(event: KeyboardEvent<HTMLDivElement>, panel: PanelName) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    setPanelWidths((current) => ({
      ...current,
      [panel]:
        event.key === "Home"
          ? minWidth
          : event.key === "End"
            ? widthLimit
            : Math.min(
                widthLimit,
                Math.max(minWidth, Math.min(current[panel], widthLimit) + (event.key === "ArrowRight" ? 20 : -20)),
              ),
    }));
  }

  return { shownPanels, widthLimit, width, restore, show, toggle, deactivate, resizeStart, resizeKey };
}

export type PanelLayout = ReturnType<typeof usePanelLayout>;
