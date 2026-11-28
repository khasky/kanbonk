import { isCardAvailable, parentCandidates } from "./cards";
import { linkDependency, unlinkDependency } from "./dependencies";
import { newId } from "./ids";
import type { AppState, Card } from "./types";

/**
 * How two cards can be connected, as in Jira's issue links. `blocks`: the first must be finished before the second
 * (a dependency, kept as an item of the second card's Dependencies checklist); `parent`: the second is a sub-card of the
 * first (its `parentCardId`); `relates`: related, both ways; `duplicates`: the first repeats the work of the second.
 * The last two are kept in the first card's `links`.
 */
export type ConnectionKind = "blocks" | "parent" | "relates" | "duplicates";

/** The groups a card's connections are listed in, each seen from that card. */
export type ConnectionGroup =
  | "parent"
  | "subCards"
  | "blocks"
  | "blockedBy"
  | "relates"
  | "duplicates"
  | "duplicatedBy";

export const connectionGroups: ConnectionGroup[] = [
  "parent",
  "subCards",
  "blockedBy",
  "blocks",
  "relates",
  "duplicates",
  "duplicatedBy",
];

/** A group as a link from `from` to `to`, for a card on the given side of it. */
export function groupLink(group: ConnectionGroup, card: string, other: string): [ConnectionKind, string, string] {
  switch (group) {
    case "parent":
      return ["parent", other, card];
    case "subCards":
      return ["parent", card, other];
    case "blocks":
      return ["blocks", card, other];
    case "blockedBy":
      return ["blocks", other, card];
    case "relates":
      return ["relates", card, other];
    case "duplicates":
      return ["duplicates", card, other];
    case "duplicatedBy":
      return ["duplicates", other, card];
  }
}

export interface Connection {
  kind: ConnectionKind;
  from: string;
  to: string;
  /** A dependency whose prerequisite is finished, or ticked off in the dependent's checklist. */
  resolved?: boolean;
}

const live = (state: AppState, card: Card | undefined): card is Card =>
  Boolean(card && !card.deletedAt && !card.isTemplate && isCardAvailable(state, card));

/** Every connection among live cards. */
export function allConnections(state: AppState): Connection[] {
  const cards = new Map(state.cards.filter((card) => live(state, card)).map((card) => [card.id, card]));
  const result: Connection[] = [];
  const seen = new Set<string>();
  const add = (connection: Connection) => {
    // A related pair is one connection whichever card holds it.
    const [a, b] =
      connection.kind === "relates" ? [connection.from, connection.to].sort() : [connection.from, connection.to];
    const key = `${connection.kind}:${a}>${b}`;
    if (connection.from === connection.to || seen.has(key)) return;
    seen.add(key);
    result.push(connection);
  };
  for (const card of cards.values()) {
    for (const list of card.checklists)
      for (const item of list.items) {
        const prerequisite = item.linkedCardId ? cards.get(item.linkedCardId) : undefined;
        if (prerequisite)
          add({
            kind: "blocks",
            from: prerequisite.id,
            to: card.id,
            resolved: Boolean(prerequisite.doneAt) || item.checked,
          });
      }
    if (card.parentCardId && cards.has(card.parentCardId))
      add({ kind: "parent", from: card.parentCardId, to: card.id });
    for (const link of card.links ?? [])
      if (cards.has(link.cardId)) add({ kind: link.kind, from: card.id, to: link.cardId });
  }
  return result;
}

/** A card's connections by group, with the other card of each; `connections` defaults to all of them. */
export function cardConnections(
  state: AppState,
  cardId: string,
  connections = allConnections(state),
): Record<ConnectionGroup, Array<{ card: Card; connection: Connection }>> {
  const cards = new Map(state.cards.map((card) => [card.id, card]));
  const groups = Object.fromEntries(connectionGroups.map((group) => [group, []])) as unknown as Record<
    ConnectionGroup,
    Array<{ card: Card; connection: Connection }>
  >;
  for (const connection of connections) {
    const outgoing = connection.from === cardId;
    if (!outgoing && connection.to !== cardId) continue;
    const other = cards.get(outgoing ? connection.to : connection.from);
    if (!other) continue;
    const group: ConnectionGroup =
      connection.kind === "parent"
        ? outgoing
          ? "subCards"
          : "parent"
        : connection.kind === "blocks"
          ? outgoing
            ? "blocks"
            : "blockedBy"
          : connection.kind === "relates"
            ? "relates"
            : outgoing
              ? "duplicates"
              : "duplicatedBy";
    groups[group].push({ card: other, connection });
  }
  return groups;
}

const connected = (state: AppState, kind: ConnectionKind, from: string, to: string) =>
  allConnections(state).some(
    (item) =>
      item.kind === kind &&
      ((item.from === from && item.to === to) || (kind === "relates" && item.from === to && item.to === from)),
  );

/** Whether `from` → `to` can be connected as `kind` without a duplicate, a loop or a card out of reach. */
export function canConnect(state: AppState, kind: ConnectionKind, from: string, to: string): boolean {
  if (from === to) return false;
  const [first, second] = [state.cards.find((card) => card.id === from), state.cards.find((card) => card.id === to)];
  if (!live(state, first) || !live(state, second) || connected(state, kind, from, to)) return false;
  if (kind === "parent")
    return first.boardId === second.boardId && parentCandidates(state, to).some((card) => card.id === from);
  if (kind === "duplicates") return !connected(state, "duplicates", to, from);
  if (kind === "relates") return true;
  // A dependency loop: `from` already waits on `to`, directly or through other cards.
  const next = new Map<string, string[]>();
  for (const edge of allConnections(state))
    if (edge.kind === "blocks") next.set(edge.from, [...(next.get(edge.from) ?? []), edge.to]);
  const reached = new Set([to]);
  for (const queue = [to]; queue.length; )
    for (const id of next.get(queue.shift() as string) ?? [])
      if (!reached.has(id)) {
        if (id === from) return false;
        reached.add(id);
        queue.push(id);
      }
  return true;
}

const changeCard = (state: AppState, id: string, change: (card: Card) => Card): AppState => ({
  ...state,
  cards: state.cards.map((card) => (card.id === id ? change(card) : card)),
});

/** Connects two cards; the ids of the cards that changed come back with the state, for their revisions. */
export function connect(
  state: AppState,
  kind: ConnectionKind,
  from: string,
  to: string,
): { state: AppState; changed: string[] } {
  if (!canConnect(state, kind, from, to)) return { state, changed: [] };
  if (kind === "blocks") return { state: linkDependency(state, to, from), changed: [to, from] };
  if (kind === "parent")
    return { state: changeCard(state, to, (card) => ({ ...card, parentCardId: from })), changed: [to] };
  return {
    state: changeCard(state, from, (card) => ({
      ...card,
      links: [...(card.links ?? []), { id: newId(), kind, cardId: to }],
    })),
    changed: [from],
  };
}

/** Removes a connection, whichever card holds it. */
export function disconnect(state: AppState, connection: Connection): { state: AppState; changed: string[] } {
  const { kind, from, to } = connection;
  if (kind === "blocks") return { state: unlinkDependency(state, to, from), changed: [to, from] };
  if (kind === "parent")
    return {
      state: changeCard(state, to, (card) =>
        card.parentCardId === from ? { ...card, parentCardId: undefined } : card,
      ),
      changed: [to],
    };
  const holds = (holder: string, other: string) =>
    state.cards.find((card) => card.id === holder)?.links?.some((link) => link.kind === kind && link.cardId === other);
  const changed = [...(holds(from, to) ? [from] : []), ...(kind === "relates" && holds(to, from) ? [to] : [])];
  let next = state;
  for (const holder of changed) {
    const other = holder === from ? to : from;
    next = changeCard(next, holder, (card) => {
      const links = (card.links ?? []).filter((link) => !(link.kind === kind && link.cardId === other));
      return { ...card, links: links.length ? links : undefined };
    });
  }
  return { state: next, changed };
}

const childrenOf = (state: AppState) => {
  const children = new Map<string, Card[]>();
  for (const card of state.cards)
    if (card.parentCardId && live(state, card))
      children.set(card.parentCardId, [...(children.get(card.parentCardId) ?? []), card]);
  return children;
};

/** A card's sub-cards at every level below it, live ones only. */
export function descendants(state: AppState, cardId: string, children = childrenOf(state)): Card[] {
  const result: Card[] = [];
  const seen = new Set([cardId]);
  for (const queue = [cardId]; queue.length; )
    for (const child of children.get(queue.shift() as string) ?? [])
      if (!seen.has(child.id)) {
        seen.add(child.id);
        result.push(child);
        queue.push(child.id);
      }
  return result;
}

/** How many of a card's sub-cards, at every level, are done. */
export function subCardProgress(
  state: AppState,
  cardId: string,
  children = childrenOf(state),
): { done: number; total: number } {
  const all = descendants(state, cardId, children);
  return { done: all.filter((card) => card.doneAt).length, total: all.length };
}

/** The nearest epic above a card, through its parents. */
export function epicOf(
  state: AppState,
  card: Card,
  cards = new Map(state.cards.map((item) => [item.id, item])),
): Card | undefined {
  const seen = new Set([card.id]);
  for (let parent = cards.get(card.parentCardId ?? ""); parent && !seen.has(parent.id); ) {
    if (parent.isEpic && live(state, parent)) return parent;
    seen.add(parent.id);
    parent = cards.get(parent.parentCardId ?? "");
  }
  return undefined;
}

/** What a card tile shows about the card's connections, for every card at once. */
export interface ConnectionBadges {
  /** Unresolved dependencies the card waits on. */
  blockers: number;
  /** All connections of the card. */
  connections: number;
  /** The name of the nearest epic above the card. */
  epic?: string;
  progress?: { done: number; total: number };
}

export function connectionBadges(state: AppState): Map<string, ConnectionBadges> {
  const result = new Map<string, ConnectionBadges>();
  const get = (id: string) => {
    let value = result.get(id);
    if (!value) {
      value = { blockers: 0, connections: 0 };
      result.set(id, value);
    }
    return value;
  };
  for (const connection of allConnections(state)) {
    get(connection.from).connections++;
    get(connection.to).connections++;
    if (connection.kind === "blocks" && !connection.resolved) get(connection.to).blockers++;
  }
  const cards = new Map(state.cards.map((card) => [card.id, card]));
  for (const card of state.cards) {
    const epic = card.parentCardId && live(state, card) ? epicOf(state, card, cards) : undefined;
    if (epic) get(card.id).epic = epic.name;
  }
  const children = childrenOf(state);
  for (const [id, value] of result) {
    if (!children.has(id)) continue;
    const progress = subCardProgress(state, id, children);
    if (progress.total) value.progress = progress;
  }
  return result;
}
