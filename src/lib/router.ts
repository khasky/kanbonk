import { useCallback, useEffect, useState } from "react";
import type { TrashKind } from "../model/trash";
import { hashRouting } from "./platform";

export type CalendarScale = "week" | "month" | "year";

export type Route =
  | { page: "home" }
  | { page: "trash"; kind?: TrashKind }
  | { page: "workspace"; id: string }
  | { page: "board"; id: string; view: BoardView; scale: CalendarScale; date?: string }
  | { page: "card"; id: string; background?: Route }
  | { page: "not-found" };

interface HistoryState {
  backgroundHref?: string;
}

const trashKinds: Record<string, TrashKind> = {
  workspaces: "workspace",
  boards: "board",
  lists: "list",
  cards: "card",
};

export function parseRoute(pathname: string, search = "", state?: HistoryState | null): Route {
  const params = new URLSearchParams(search);
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return { page: "home" };
  if (parts.length === 1 && parts[0] === "trash") return { page: "trash", kind: trashKinds[params.get("type") ?? ""] };
  if (parts.length === 2 && parts[0] === "w") return { page: "workspace", id: parts[1] };
  if (parts.length >= 2 && parts[0] === "b") {
    const scale = params.get("scale");
    const date = params.get("date") ?? undefined;
    return {
      page: "board",
      id: parts[1],
      view: params.get("view") === "calendar" ? "calendar" : params.get("view") === "doc" ? "doc" : "lists",
      scale: scale === "week" || scale === "year" ? scale : "month",
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    };
  }
  if (parts.length >= 2 && parts[0] === "c") {
    const href = state?.backgroundHref;
    const background =
      href && !href.startsWith("/c/")
        ? parseRoute(new URL(href, "http://x").pathname, new URL(href, "http://x").search)
        : undefined;
    return { page: "card", id: parts[1], background };
  }
  return { page: "not-found" };
}

export type BoardView = "lists" | "calendar" | "doc";

export function trashHref(kind?: TrashKind): string {
  const type = Object.entries(trashKinds).find(([, value]) => value === kind)?.[0];
  return type ? `/trash?type=${type}` : "/trash";
}

export function boardHref(
  id: string,
  options: { view?: BoardView; scale?: CalendarScale; date?: string } = {},
): string {
  const params = new URLSearchParams();
  if (options.view === "doc") params.set("view", "doc");
  if (options.view === "calendar") {
    params.set("view", "calendar");
    if (options.scale && options.scale !== "month") params.set("scale", options.scale);
    if (options.date) params.set("date", options.date);
  }
  const query = params.toString();
  return `/b/${encodeURIComponent(id)}${query ? `?${query}` : ""}`;
}

/** Current app path, e.g. "/b/DMZD8gZ6?view=calendar". */
function currentHref(): string {
  return hashRouting ? window.location.hash.slice(1) || "/" : window.location.pathname + window.location.search;
}

/** Turns an app path into a value for `<a href>` and the History API. */
export function linkHref(href: string): string {
  return hashRouting ? `#${href}` : href;
}

function currentRoute(): Route {
  const url = new URL(currentHref(), "http://x");
  return parseRoute(url.pathname, url.search, window.history.state as HistoryState | null);
}

export function useRoute(): {
  route: Route;
  navigate: (href: string, options?: { replace?: boolean; modal?: boolean }) => void;
  back: () => void;
} {
  const [route, setRoute] = useState<Route>(currentRoute);
  useEffect(() => {
    const update = () => setRoute(currentRoute());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  /** `modal` keeps the current page rendered behind a card (Trello-style card modal). */
  const navigate = useCallback((href: string, options: { replace?: boolean; modal?: boolean } = {}) => {
    const here = currentHref();
    const previous = window.history.state as HistoryState | null;
    const state: HistoryState = options.modal
      ? { backgroundHref: here.startsWith("/c/") ? previous?.backgroundHref : here }
      : {};
    if (href === here && !options.modal) return;
    if (options.replace) window.history.replaceState(state, "", linkHref(href));
    else window.history.pushState(state, "", linkHref(href));
    setRoute(currentRoute());
  }, []);
  /** Leaves a card modal: returns to the page it was opened from. */
  const back = useCallback(() => {
    const state = window.history.state as HistoryState | null;
    if (state?.backgroundHref) {
      window.history.pushState({}, "", linkHref(state.backgroundHref));
      setRoute(currentRoute());
    }
  }, []);
  return { route, navigate, back };
}
