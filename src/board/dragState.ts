import { useSyncExternalStore } from "react";

/** What is being dragged, with the size of its element so the place it would land can be drawn at that size. */
export interface Drag {
  kind: "card" | "list" | "zone";
  id: string;
  width: number;
  height: number;
}

/**
 * Where the dragged item would land: a card at `index` among the visible cards of a list; a list at `index` among the
 * board's other lists, inside zone `zoneId` or outside zones (`index` undefined: at the end, into an empty zone); a
 * zone at `index` among the board's other runs (zones and lists outside zones).
 */
export type DropTarget =
  | { kind: "card"; listId: string; index: number }
  | { kind: "list"; index?: number; zoneId?: string }
  | { kind: "zone"; index: number };

interface DragState {
  drag?: Drag;
  target?: DropTarget;
}

let current: DragState = {};
const listeners = new Set<() => void>();

function publish(next: DragState) {
  current = next;
  for (const listener of listeners) listener();
}

/**
 * Starts showing a drag. The dragged element is hidden only after the browser has taken its picture for the drag
 * image: hiding it during `dragstart` would cancel the drag.
 */
export function startDrag(element: HTMLElement, drag: Omit<Drag, "width" | "height">) {
  const box = element.getBoundingClientRect();
  window.setTimeout(() => publish({ drag: { ...drag, width: box.width, height: box.height } }));
}

export function setDropTarget(target: DropTarget | undefined) {
  if (!current.drag || JSON.stringify(target) === JSON.stringify(current.target)) return;
  publish({ ...current, target });
}

export function endDrag() {
  if (current.drag) publish({});
}

export function currentDrag(): DragState {
  return current;
}

export function useDragState(): DragState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

/** The kind of item a drag over the board carries, read from the types of its data. */
export function dragKind(types: readonly string[]): Drag["kind"] | undefined {
  if (types.includes("text/kanbonk-zone")) return "zone";
  if (types.includes("text/kanbonk-list")) return "list";
  if (types.includes("text/kanbonk-card")) return "card";
  return undefined;
}

/** How many of `elements` lie before the point on the axis: the index the dragged item would get among them. */
function indexAt(elements: Element[], point: number, axis: "x" | "y") {
  const index = elements.findIndex((element) => {
    const box = element.getBoundingClientRect();
    return axis === "x" ? point < box.left + box.width / 2 : point < box.top + box.height / 2;
  });
  return index < 0 ? elements.length : index;
}

const data = (element: Element, key: string) => (element as HTMLElement).dataset[key];

/**
 * Where an item dragged over the board (`canvas`, whose children are list columns and zone frames) would land, from
 * the pointer and the element under it. The dragged item itself (`id`) is left out of the count.
 */
export function dropTargetAt(
  canvas: HTMLElement,
  kind: Drag["kind"],
  id: string | undefined,
  x: number,
  y: number,
  under: Element,
): DropTarget | undefined {
  if (kind === "card") {
    const column = under.closest("[data-list-id]");
    if (!column || !canvas.contains(column)) return undefined;
    const tiles = [...column.querySelectorAll("[data-card-id]")].filter((item) => data(item, "cardId") !== id);
    return { kind, listId: data(column, "listId")!, index: indexAt(tiles, y, "y") };
  }
  if (kind === "list") {
    const zone = under.closest("[data-zone-id]");
    const zoneId = zone && canvas.contains(zone) ? data(zone, "zoneId") : undefined;
    if (zone && data(zone, "zoneEmpty") !== undefined) return { kind, zoneId };
    const columns = [...canvas.querySelectorAll("[data-list-id]")].filter((item) => data(item, "listId") !== id);
    return { kind, index: indexAt(columns, x, "x"), zoneId };
  }
  const units = [...canvas.children].filter(
    (item) =>
      (data(item, "listId") !== undefined || data(item, "zoneId") !== undefined) &&
      data(item, "zoneId") !== id &&
      data(item, "zoneEmpty") === undefined,
  );
  return { kind, index: indexAt(units, x, "x") };
}
