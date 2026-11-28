import { isCardAvailable } from "./cards";
import { allConnections, type Connection, type ConnectionKind } from "./connections";
import type { AppState, Card } from "./types";

export type LinkKind = ConnectionKind;
export type GraphEdge = Connection;

/** done: finished; blocked: waits on an unresolved dependency; open: free to work on. */
export type NodeStatus = "done" | "blocked" | "open";

export interface GraphNode {
  card: Card;
  status: NodeStatus;
  /** On another board: shown because a card of this board links to it. */
  external: boolean;
  /** How many unfinished cards wait on this card, directly or through others. */
  blocking: number;
  x: number;
  y: number;
}

export interface CardGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

export const nodeSize = { width: 200, height: 68 };
const gap = { x: 84, y: 22 };
const margin = 16;

const live = (state: AppState, card: Card | undefined): card is Card =>
  Boolean(card && !card.deletedAt && !card.isTemplate && isCardAvailable(state, card));

/**
 * The graph of a board's cards and their links, laid out in columns from left to right: prerequisites and parents
 * before the cards that wait on them or belong to them. `cardIds` are the board's shown cards; cards on other boards
 * linked to them join as external nodes. With `linkedOnly`, cards without links are left out.
 */
export function cardGraph(state: AppState, cardIds: Set<string>, options: { linkedOnly?: boolean } = {}): CardGraph {
  const all = allConnections(state);
  const edges = all.filter((edge) => cardIds.has(edge.from) || cardIds.has(edge.to));
  const linked = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  const cards = state.cards.filter(
    (card) => live(state, card) && (linked.has(card.id) || (!options.linkedOnly && cardIds.has(card.id))),
  );
  const ids = new Map(cards.map((card, index) => [card.id, index]));
  const incoming = cards.map(() => [] as number[]);
  const outgoing = cards.map(() => [] as number[]);
  for (const edge of edges) {
    const [from, to] = [ids.get(edge.from), ids.get(edge.to)];
    // Only dependencies and sub-cards set the columns; related cards and duplicates are drawn across them.
    if (from === undefined || to === undefined || edge.kind === "relates" || edge.kind === "duplicates") continue;
    outgoing[from].push(to);
    incoming[to].push(from);
  }

  // Columns: the longest chain of links leading to a card; a link back into a chain (a loop) is not followed.
  const layer = cards.map(() => -1);
  const visiting = new Set<number>();
  const depth = (index: number): number => {
    if (layer[index] >= 0) return layer[index];
    visiting.add(index);
    let value = 0;
    for (const from of incoming[index]) if (!visiting.has(from)) value = Math.max(value, depth(from) + 1);
    visiting.delete(index);
    layer[index] = value;
    return value;
  };
  for (let index = 0; index < cards.length; index++) depth(index);

  // Rows: board order first, then a few passes that move each card next to the cards it links to.
  const position = new Map(state.lists.map((list) => [list.id, list.position]));
  const columns: number[][] = [];
  cards
    .map((card, index) => ({ card, index }))
    .sort(
      (a, b) =>
        Number(!cardIds.has(a.card.id)) - Number(!cardIds.has(b.card.id)) ||
        (position.get(a.card.listId) ?? 0) - (position.get(b.card.listId) ?? 0) ||
        a.card.position - b.card.position,
    )
    .forEach(({ index }) => {
      columns[layer[index]] ??= [];
      columns[layer[index]].push(index);
    });
  const row = new Map<number, number>();
  const place = (column: number[] | undefined) => {
    for (const [at, index] of (column ?? []).entries()) row.set(index, at);
  };
  for (const column of columns) place(column);
  const centre = (neighbours: number[], fallback: number) =>
    neighbours.length
      ? neighbours.reduce((sum, index) => sum + (row.get(index) ?? 0), 0) / neighbours.length
      : fallback;
  for (let pass = 0; pass < 4; pass++) {
    const forward = pass % 2 === 0;
    for (const column of forward ? columns : [...columns].reverse()) {
      if (!column) continue;
      column.sort(
        (a, b) =>
          centre(forward ? incoming[a] : outgoing[a], row.get(a) ?? 0) -
          centre(forward ? incoming[b] : outgoing[b], row.get(b) ?? 0),
      );
      place(column);
    }
  }

  // How many unfinished cards wait on each card through unresolved dependencies.
  const waiting = new Map<string, string[]>();
  for (const edge of all)
    if (edge.kind === "blocks" && !edge.resolved) waiting.set(edge.from, [...(waiting.get(edge.from) ?? []), edge.to]);
  const byId = new Map(state.cards.map((card) => [card.id, card]));
  const blocking = (id: string) => {
    const seen = new Set<string>();
    for (const queue = [id]; queue.length; )
      for (const next of waiting.get(queue.shift() as string) ?? [])
        if (!seen.has(next) && next !== id) {
          seen.add(next);
          queue.push(next);
        }
    return [...seen].filter((item) => !byId.get(item)?.doneAt).length;
  };
  const blocked = new Set(all.filter((edge) => edge.kind === "blocks" && !edge.resolved).map((edge) => edge.to));

  const nodes: GraphNode[] = cards.map((card, index) => ({
    card,
    status: card.doneAt ? "done" : blocked.has(card.id) ? "blocked" : "open",
    external: !cardIds.has(card.id),
    blocking: blocking(card.id),
    x: margin + layer[index] * (nodeSize.width + gap.x),
    y: margin + (row.get(index) ?? 0) * (nodeSize.height + gap.y),
  }));
  const tallest = Math.max(0, ...columns.map((column) => column?.length ?? 0));
  return {
    nodes,
    edges: edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)),
    width: margin * 2 + columns.length * nodeSize.width + Math.max(0, columns.length - 1) * gap.x,
    height: margin * 2 + tallest * nodeSize.height + Math.max(0, tallest - 1) * gap.y,
  };
}
