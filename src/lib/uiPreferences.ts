import type { BoardFilter } from "../model";

export function readBoardFilters(): Record<string, BoardFilter> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem("kanbonk-board-filters") ?? "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(
      Object.entries(saved).filter(([, value]) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        const filter = value as Record<string, unknown>;
        return (
          typeof filter.keyword === "string" &&
          typeof filter.labelId === "string" &&
          (filter.memberId === undefined || typeof filter.memberId === "string") &&
          ["any", "overdue", "next-week", "none"].includes(String(filter.due))
        );
      }),
    ) as Record<string, BoardFilter>;
  } catch {
    return {};
  }
}

/** The lists collapsed on this device; Trello keeps that per person too, not on the board. */
export function readCollapsedLists(): Set<string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem("kanbonk-collapsed-lists") ?? "[]");
    return new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveCollapsedLists(ids: Set<string>) {
  try {
    localStorage.setItem("kanbonk-collapsed-lists", JSON.stringify([...ids]));
  } catch {
    // Storage may be full or blocked; the lists then stay collapsed only until the page is reloaded.
  }
}

export function readDismissedReminders(): Record<string, string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem("kanbonk-dismissed-reminders") ?? "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved)
      ? Object.fromEntries(Object.entries(saved).filter(([, value]) => typeof value === "string"))
      : {};
  } catch {
    return {};
  }
}

export type PanelWidths = { inbox: number; planner: number };

export type PanelName = keyof PanelWidths;

export type PanelVisibility = Record<PanelName, boolean>;

export function readPanelWidths(): PanelWidths {
  try {
    const saved = JSON.parse(localStorage.getItem("kanbonk-panel-widths") ?? "{}");
    return {
      inbox: Number.isFinite(saved.inbox) ? Math.min(720, Math.max(220, saved.inbox)) : 300,
      planner: Number.isFinite(saved.planner) ? Math.min(720, Math.max(220, saved.planner)) : 400,
    };
  } catch {
    return { inbox: 300, planner: 400 };
  }
}
