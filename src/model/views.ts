import { localDateTime } from "../lib/format";
import type { AppState, ViewCount } from "./types";

/** Views older than this are dropped when a new one is recorded, so the counters stay small. */
export const viewRetentionDays = 400;

/** Opening the same card again within this time on one device counts once; a board visit has a longer window. */
const repeatWindow = { card: 5 * 60_000, board: 30 * 60_000 };

/** The later of two ISO times. */
const later = (a: string, b: string) => (a.localeCompare(b) > 0 ? a : b);

export const localDay = (value: string | Date) =>
  localDateTime(typeof value === "string" ? value : value.toISOString()).slice(0, 10);

/** The person a view counts for: the author name of the device, or the device when it has none. */
export const viewerName = (view: Pick<ViewCount, "author" | "deviceId">) =>
  view.author.trim() || view.deviceId.slice(0, 8);

/**
 * Counts one view of a board or card by this device: a counter per entity, device and day, which only its own device
 * increments, so syncing devices merge counters by taking the larger value. Views are not revisions; they are kept
 * outside the history.
 */
export function recordView(
  state: AppState,
  view: { kind: ViewCount["kind"]; entityId: string; boardId: string; deviceId: string; author: string },
  now = new Date(),
): AppState {
  const views = state.views ?? [];
  const own = views.filter(
    (item) => item.kind === view.kind && item.entityId === view.entityId && item.deviceId === view.deviceId,
  );
  const last = own.reduce((latest, item) => later(item.lastAt, latest), "");
  if (last && now.getTime() - Date.parse(last) < repeatWindow[view.kind]) return state;
  const day = localDay(now);
  const id = `${view.kind}:${view.entityId}:${view.deviceId}:${day}`;
  const at = now.toISOString();
  const oldest = localDay(new Date(now.getTime() - viewRetentionDays * 86_400_000));
  const kept = views.filter((item) => item.id !== id && item.day >= oldest);
  const current = views.find((item) => item.id === id);
  return {
    ...state,
    views: [
      ...kept,
      { ...view, id, day, count: (current?.count ?? 0) + 1, lastAt: at, author: view.author || current?.author || "" },
    ],
  };
}

export const isViewCount = (value: unknown): value is ViewCount => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    (item.kind === "board" || item.kind === "card") &&
    ["id", "entityId", "boardId", "deviceId", "author", "day", "lastAt"].every(
      (key) => typeof item[key] === "string",
    ) &&
    Number.isSafeInteger(item.count) &&
    (item.count as number) > 0
  );
};

/** The union of two devices' view counters; a counter both have keeps the larger count and the later view. */
export function mergeViews(local: ViewCount[] | undefined, remote: unknown): ViewCount[] {
  const merged = new Map((local ?? []).map((item) => [item.id, item]));
  for (const item of Array.isArray(remote) ? remote.filter(isViewCount) : []) {
    const mine = merged.get(item.id);
    merged.set(
      item.id,
      mine
        ? {
            ...mine,
            count: Math.max(mine.count, item.count),
            lastAt: later(item.lastAt, mine.lastAt),
            author: item.lastAt > mine.lastAt ? item.author || mine.author : mine.author || item.author,
          }
        : item,
    );
  }
  return [...merged.values()];
}

export interface ViewerStats {
  name: string;
  count: number;
  lastAt: string;
}

export interface ViewStats {
  total: number;
  unique: number;
  lastAt?: string;
  lastBy?: string;
  /** Views per local day (YYYY-MM-DD). */
  byDay: Map<string, number>;
  /** People who viewed, most views first. */
  viewers: ViewerStats[];
}

export function viewStats(views: ViewCount[]): ViewStats {
  const byDay = new Map<string, number>();
  const people = new Map<string, ViewerStats>();
  let total = 0;
  let last: ViewCount | undefined;
  for (const view of views) {
    total += view.count;
    byDay.set(view.day, (byDay.get(view.day) ?? 0) + view.count);
    const name = viewerName(view);
    const person = people.get(name) ?? { name, count: 0, lastAt: "" };
    person.count += view.count;
    if (view.lastAt > person.lastAt) person.lastAt = view.lastAt;
    people.set(name, person);
    if (!last || view.lastAt > last.lastAt) last = view;
  }
  return {
    total,
    unique: people.size,
    lastAt: last?.lastAt,
    lastBy: last ? viewerName(last) : undefined,
    byDay,
    viewers: [...people.values()].sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt)),
  };
}

/** Views of each card of a board (or of every board), by card id. */
export function cardViewStats(state: AppState, boardId?: string): Map<string, ViewStats> {
  const byCard = new Map<string, ViewCount[]>();
  for (const view of state.views ?? [])
    if (view.kind === "card" && (!boardId || view.boardId === boardId)) {
      const list = byCard.get(view.entityId) ?? [];
      list.push(view);
      byCard.set(view.entityId, list);
    }
  return new Map([...byCard].map(([id, views]) => [id, viewStats(views)]));
}

export const boardVisitStats = (state: AppState, boardId: string) =>
  viewStats((state.views ?? []).filter((view) => view.kind === "board" && view.entityId === boardId));

/** The last `days` local days, oldest first, ending today. */
export function lastDays(days: number, now = new Date()): string[] {
  return Array.from({ length: days }, (_, index) => {
    // Calendar arithmetic, so a daylight-saving change does not skip or repeat a day.
    const date = new Date(now);
    date.setDate(date.getDate() - (days - 1 - index));
    return localDay(date);
  });
}
