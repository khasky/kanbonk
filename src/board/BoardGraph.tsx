import { type KeyboardEvent, type PointerEvent, useMemo, useRef, useState } from "react";
import { type MessageKey, t } from "../i18n";
import type { CardActions } from "../hooks/useCardActions";
import type { AppState, Card } from "../model";
import { cardGraph, type GraphEdge, type GraphNode, type LinkKind, nodeSize } from "../model/cardGraph";
import { descendants } from "../model/connections";
import { CardLinks, epicBadgeClass } from "../card/CardRelations";
import { Button } from "../ui/Button";
import { Checkbox, Select } from "../ui/Field";
import { Hint } from "../ui/Hint";
import { Segmented, SegmentedTab } from "../ui/Segmented";

type Selection = { card: string } | { edge: GraphEdge } | undefined;

const statusLook: Record<GraphNode["status"], { border: string; key: MessageKey }> = {
  done: { border: "border-l-success", key: "graph.statusDone" },
  blocked: { border: "border-l-danger", key: "graph.statusBlocked" },
  open: { border: "border-l-brand", key: "graph.statusOpen" },
};

/** How each kind of link is named, explained and drawn: its dash pattern and its colour. */
const kinds: Record<
  LinkKind,
  { mode: MessageKey; hint: MessageKey; legend: MessageKey; edge: MessageKey; dash?: string; colour: string }
> = {
  blocks: {
    mode: "graph.modeBlocks",
    hint: "graph.hintBlocks",
    legend: "graph.modeBlocks",
    edge: "graph.edgeBlocks",
    colour: "ink-subtle",
  },
  parent: {
    mode: "graph.modeParent",
    hint: "graph.hintParent",
    legend: "graph.legendParent",
    edge: "graph.edgeParent",
    dash: "6 5",
    colour: "ink-subtle",
  },
  relates: {
    mode: "graph.modeRelates",
    hint: "graph.hintRelates",
    legend: "graph.legendRelates",
    edge: "graph.edgeRelates",
    dash: "2 4",
    colour: "brand",
  },
  duplicates: {
    mode: "graph.modeDuplicates",
    hint: "graph.hintDuplicates",
    legend: "graph.legendDuplicates",
    edge: "graph.edgeDuplicates",
    dash: "10 4 2 4",
    colour: "warning",
  },
};
const linkKinds = Object.keys(kinds) as LinkKind[];
/** Tailwind needs the full class names in the source. */
const strokeOf: Record<string, string> = {
  "ink-subtle": "stroke-ink-subtle",
  brand: "stroke-brand",
  warning: "stroke-warning",
};
const fillOf: Record<string, string> = { "ink-subtle": "bg-ink-subtle", brand: "bg-brand", warning: "bg-warning" };

const sameEdge = (a: GraphEdge, b: GraphEdge) => a.from === b.from && a.to === b.to && a.kind === b.kind;

/**
 * The board's cards as a graph of their links: dependencies, sub-cards, related cards and duplicates. A link is drawn
 * by dragging from the dot on a card to another card, and removed by selecting it and pressing Delete; the selected
 * card's links are listed beside the graph, where they can be added and removed without a mouse. Choosing an epic
 * narrows the graph to the epic, its sub-cards at every level and the cards linked to them.
 */
export function BoardGraph({
  state,
  cardIds,
  cardActions,
  onOpenCard,
}: {
  state: AppState;
  cardIds: Set<string>;
  cardActions: CardActions;
  onOpenCard: (card: Card) => void;
}) {
  const [linkedOnly, setLinkedOnly] = useState(true);
  const [mode, setMode] = useState<LinkKind>("blocks");
  const [epicId, setEpicId] = useState("");
  const [selected, setSelected] = useState<Selection>();
  const [drag, setDrag] = useState<{ from: string; x: number; y: number }>();
  const canvas = useRef<HTMLDivElement>(null);
  const epics = state.cards.filter((card) => card.isEpic && cardIds.has(card.id));
  const epic = epics.find((card) => card.id === epicId);
  const shown = useMemo(
    () =>
      epic
        ? new Set([epic, ...descendants(state, epic.id)].map((card) => card.id).filter((id) => cardIds.has(id)))
        : cardIds,
    [state, epic, cardIds],
  );
  const graph = useMemo(() => cardGraph(state, shown, { linkedOnly }), [state, shown, linkedOnly]);
  const nodes = new Map(graph.nodes.map((node) => [node.card.id, node]));
  const lists = new Map(state.lists.map((list) => [list.id, list.name]));
  const boards = new Map(state.boards.map((board) => [board.id, board.name]));
  const labels = new Map(state.labels.map((label) => [label.id, label]));
  const cards = new Map(state.cards.map((card) => [card.id, card]));
  const name = (id: string) => cards.get(id)?.name ?? "";

  const link = (kind: LinkKind, from: string, to: string) => cardActions.connectCards(kind, from, to);
  const unlink = (edge: GraphEdge) => {
    cardActions.disconnectCards(edge);
    setSelected((current) => (current && "edge" in current && sameEdge(current.edge, edge) ? undefined : current));
  };
  const edgeText = (edge: GraphEdge) => t(kinds[edge.kind].edge, { from: name(edge.from), to: name(edge.to) });

  const point = (event: PointerEvent) => {
    const box = canvas.current?.getBoundingClientRect();
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) };
  };
  const finishDrag = (event: PointerEvent) => {
    if (!drag) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-node]")
      ?.dataset.node;
    setDrag(undefined);
    if (target && target !== drag.from) link(mode, drag.from, target);
  };

  type Point = { x: number; y: number };
  /** The bezier control points of a curve leaving `from` and reaching `to`; each side's direction is 1 (right) or -1 (left). */
  const curve = (from: Point, fromSide: number, to: Point, toSide: number) => {
    const bend = Math.max(40, Math.abs(to.x - from.x) / 2, fromSide === toSide ? Math.abs(to.y - from.y) / 3 : 0);
    return [from, { x: from.x + fromSide * bend, y: from.y }, { x: to.x + toSide * bend, y: to.y }, to];
  };
  const path = ([a, b, c, d]: Point[]) => `M ${a.x} ${a.y} C ${b.x} ${b.y}, ${c.x} ${c.y}, ${d.x} ${d.y}`;
  /** The middle of a curve made by `curve`. */
  const halfway = ([a, b, c, d]: Point[]) => ({
    x: (a.x + 3 * b.x + 3 * c.x + d.x) / 8,
    y: (a.y + 3 * b.y + 3 * c.y + d.y) / 8,
  });
  const exit = (node: GraphNode) => ({ x: node.x + nodeSize.width, y: node.y + nodeSize.height / 2 });
  const entry = (node: GraphNode) => ({ x: node.x, y: node.y + nodeSize.height / 2 });
  /** Links run from the right side to the left side; a link to a card in the same column or to the left (related cards, duplicates) bends round instead of crossing the cards. */
  const edgeCurve = (from: GraphNode, to: GraphNode) =>
    to.x >= from.x + nodeSize.width
      ? curve(exit(from), 1, entry(to), -1)
      : to.x + nodeSize.width <= from.x
        ? curve(entry(from), -1, exit(to), 1)
        : curve(exit(from), 1, exit(to), 1);

  const selectedCard = selected && "card" in selected ? cards.get(selected.card) : undefined;
  const selectedEdge = selected && "edge" in selected ? selected.edge : undefined;
  const removeOnKey = (event: KeyboardEvent, edge: GraphEdge) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      unlink(edge);
    }
  };

  return (
    <section
      className="mx-3 mt-0 mb-3 flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto rounded-[10px] bg-white p-3 text-ink"
      aria-label={t("graph.region")}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented label={t("graph.newLink")}>
          {linkKinds.map((kind) => (
            <SegmentedTab key={kind} selected={mode === kind} onClick={() => setMode(kind)}>
              {t(kinds[kind].mode)}
            </SegmentedTab>
          ))}
        </Segmented>
        {epics.length > 0 && (
          <label className="flex items-center gap-2">
            {t("graph.epicFilter")}
            <Select size="sm" value={epic?.id ?? ""} onChange={(event) => setEpicId(event.target.value)}>
              <option value="">{t("graph.allCards")}</option>
              {epics.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label className="flex items-center gap-2">
          <Checkbox checked={linkedOnly} onChange={(event) => setLinkedOnly(event.target.checked)} />
          {t("graph.linkedOnly")}
        </label>
        <span className="flex flex-wrap items-center gap-3 text-[13px] text-ink-subtle">
          {(["open", "blocked", "done"] as const).map((status) => (
            <span key={status} className={`border-l-4 pl-1.5 ${statusLook[status].border}`}>
              {t(statusLook[status].key)}
            </span>
          ))}
          {linkKinds.map((kind) => (
            <span key={kind} className="flex items-center gap-1.5">
              <svg width="28" height="8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="28"
                  y2="4"
                  className={strokeOf[kinds[kind].colour]}
                  strokeWidth="2"
                  strokeDasharray={kinds[kind].dash}
                />
              </svg>
              {t(kinds[kind].legend)}
            </span>
          ))}
        </span>
      </div>
      <Hint className="m-0">{t(kinds[mode].hint)}</Hint>
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_auto] gap-3 max-phone:grid-cols-1">
        <div className="min-h-[240px] overflow-auto rounded-md border border-line bg-surface-soft">
          {graph.nodes.length ? (
            <div
              ref={canvas}
              className="relative touch-none"
              style={{ width: graph.width, height: graph.height }}
              onPointerMove={(event) => drag && setDrag({ ...drag, ...point(event) })}
              onPointerUp={finishDrag}
              onPointerCancel={() => setDrag(undefined)}
              onClick={(event) => event.target === event.currentTarget && setSelected(undefined)}
            >
              <svg className="absolute inset-0 overflow-visible" width={graph.width} height={graph.height}>
                <title>{t("graph.region")}</title>
                <defs>
                  <marker
                    id="graph-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto"
                  >
                    <path d="M0,0 L10,5 L0,10 z" className="fill-ink-subtle" />
                  </marker>
                </defs>
                {graph.edges.map((edge) => {
                  const [from, to] = [nodes.get(edge.from), nodes.get(edge.to)];
                  if (!from || !to) return null;
                  const active = selectedEdge && sameEdge(selectedEdge, edge);
                  const blocking = edge.kind === "blocks" && !edge.resolved;
                  return (
                    <path
                      key={`${edge.kind}${edge.from}${edge.to}`}
                      d={path(edgeCurve(from, to))}
                      fill="none"
                      markerEnd={edge.kind === "relates" ? undefined : "url(#graph-arrow)"}
                      strokeWidth={active ? 3.5 : 2}
                      strokeDasharray={kinds[edge.kind].dash}
                      className={
                        active ? "stroke-brand" : blocking ? "stroke-danger" : strokeOf[kinds[edge.kind].colour]
                      }
                    />
                  );
                })}
                {drag && nodes.get(drag.from) && (
                  <path
                    d={path(curve(exit(nodes.get(drag.from) as GraphNode), 1, drag, -1))}
                    fill="none"
                    strokeWidth="2"
                    strokeDasharray={kinds[mode].dash}
                    className="pointer-events-none stroke-brand"
                  />
                )}
              </svg>
              {graph.edges.map((edge) => {
                const [from, to] = [nodes.get(edge.from), nodes.get(edge.to)];
                if (!from || !to) return null;
                const middle = halfway(edgeCurve(from, to));
                const active = selectedEdge && sameEdge(selectedEdge, edge);
                return (
                  <button
                    key={`${edge.kind}${edge.from}${edge.to}`}
                    type="button"
                    aria-label={edgeText(edge)}
                    aria-pressed={Boolean(active)}
                    title={edgeText(edge)}
                    className={`absolute size-3.5 -translate-1/2 cursor-pointer rounded-full border-2 border-white p-0 shadow hover:scale-125 ${
                      active
                        ? "bg-brand"
                        : edge.kind === "blocks" && !edge.resolved
                          ? "bg-danger"
                          : fillOf[kinds[edge.kind].colour]
                    }`}
                    style={{ left: middle.x, top: middle.y }}
                    onClick={() => setSelected({ edge })}
                    onKeyDown={(event) => removeOnKey(event, edge)}
                  />
                );
              })}
              {graph.nodes.map((node) => {
                const card = node.card;
                const active = selectedCard?.id === card.id;
                const place = node.external ? boards.get(card.boardId) : lists.get(card.listId);
                return (
                  <div
                    key={card.id}
                    data-node={card.id}
                    className={`absolute flex rounded-md border border-l-4 bg-white shadow-sm ${statusLook[node.status].border} ${
                      active ? "border-brand ring-2 ring-brand" : "border-line"
                    } ${node.external ? "opacity-70" : ""}`}
                    style={{ left: node.x, top: node.y, width: nodeSize.width, height: nodeSize.height }}
                  >
                    <button
                      type="button"
                      className="grid min-w-0 flex-1 cursor-pointer content-start gap-0.5 rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-ink"
                      aria-label={`${card.name}, ${t(statusLook[node.status].key)}`}
                      aria-pressed={active}
                      onClick={() => setSelected({ card: card.id })}
                      onDoubleClick={() => onOpenCard(card)}
                    >
                      <span className="line-clamp-2 text-[13px] leading-tight font-semibold wrap-anywhere">
                        {card.isEpic && <span className={`${epicBadgeClass} mr-1`}>{t("graph.epicBadge")}</span>}
                        {card.name}
                      </span>
                      <span className="flex min-w-0 items-center gap-1 text-[12px] text-ink-subtle">
                        <span className="truncate">{place}</span>
                        {node.blocking > 0 && (
                          <span className="shrink-0 font-semibold text-danger">
                            · {t("graph.waiting", { count: node.blocking })}
                          </span>
                        )}
                        {card.labelIds.slice(0, 3).map((id) => {
                          const label = labels.get(id);
                          return (
                            label && (
                              <span
                                key={id}
                                title={label.name}
                                className="h-2 w-4 shrink-0 rounded-full"
                                style={{ background: label.color || "#dfe1e6" }}
                              />
                            )
                          );
                        })}
                      </span>
                    </button>
                    <span
                      className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-brand shadow"
                      aria-hidden="true"
                      title={t("graph.dragToLink")}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        canvas.current?.setPointerCapture(event.pointerId);
                        setDrag({ from: card.id, ...point(event) });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="m-0 p-4 text-ink-subtle">{t(linkedOnly ? "graph.emptyLinked" : "graph.empty")}</p>
          )}
        </div>
        {(selectedCard || selectedEdge) && (
          <aside className="grid w-[316px] content-start gap-3 pl-9 max-phone:w-auto" aria-label={t("graph.details")}>
            {selectedCard && (
              <>
                <div className="grid gap-1.5">
                  <strong className="wrap-anywhere">{selectedCard.name}</strong>
                  <Button variant="secondary" className="justify-self-start" onClick={() => onOpenCard(selectedCard)}>
                    {t("graph.openCard")}
                  </Button>
                </div>
                <CardLinks
                  card={selectedCard}
                  state={state}
                  allowSubCards={false}
                  onChange={(change) => cardActions.updateCard(selectedCard.id, change)}
                  onCreateSubCard={() => undefined}
                  onNavigateCard={(target) => setSelected({ card: target.id })}
                  onConnect={cardActions.connectCards}
                  onDisconnect={cardActions.disconnectCards}
                />
              </>
            )}
            {selectedEdge && (
              <div className="grid gap-2">
                <span>{edgeText(selectedEdge)}</span>
                <Button variant="danger" className="justify-self-start" onClick={() => unlink(selectedEdge)}>
                  {t("graph.remove")}
                </Button>
              </div>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
