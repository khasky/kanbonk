import { type KeyboardEvent, type PointerEvent, useMemo, useRef, useState } from "react";
import { type MessageKey, t } from "../i18n";
import type { CardActions } from "../hooks/useCardActions";
import type { AppState, Card } from "../model";
import {
  canLink,
  cardGraph,
  cardLinks,
  type GraphEdge,
  type GraphNode,
  type LinkKind,
  nodeSize,
} from "../model/cardGraph";
import { Button } from "../ui/Button";
import { CardPicker } from "../ui/CardPicker";
import { Checkbox } from "../ui/Field";
import { Hint } from "../ui/Hint";
import { Segmented, SegmentedTab } from "../ui/Segmented";

type Selection = { card: string } | { edge: GraphEdge } | undefined;
/** Which relation of the selected card is being added: a card it waits on, one it blocks, its parent or a sub-card. */
type Adding = "waitsOn" | "blocks" | "parent" | "child";

const statusLook: Record<GraphNode["status"], { border: string; key: MessageKey }> = {
  done: { border: "border-l-success", key: "graph.statusDone" },
  blocked: { border: "border-l-danger", key: "graph.statusBlocked" },
  open: { border: "border-l-brand", key: "graph.statusOpen" },
};

const sameEdge = (a: GraphEdge, b: GraphEdge) => a.from === b.from && a.to === b.to && a.kind === b.kind;

/**
 * The board's cards as a graph of their dependencies and sub-cards. A link is drawn by dragging from the dot on a card
 * to another card, and removed by selecting it and pressing Delete; the selected card's links can also be added and
 * removed from the list beside the graph, which works without a mouse.
 */
export function BoardGraph({
  state,
  cardIds,
  cardActions,
  onOpenCard,
  onError,
}: {
  state: AppState;
  cardIds: Set<string>;
  cardActions: CardActions;
  onOpenCard: (card: Card) => void;
  onError: (message: string) => void;
}) {
  const [linkedOnly, setLinkedOnly] = useState(true);
  const [mode, setMode] = useState<LinkKind>("blocks");
  const [selected, setSelected] = useState<Selection>();
  const [adding, setAdding] = useState<Adding>();
  const [drag, setDrag] = useState<{ from: string; x: number; y: number }>();
  const canvas = useRef<HTMLDivElement>(null);
  const graph = useMemo(() => cardGraph(state, cardIds, { linkedOnly }), [state, cardIds, linkedOnly]);
  /** Every link, also to cards the graph leaves out, for the selected card's list. */
  const allEdges = useMemo(() => cardLinks(state), [state]);
  const nodes = new Map(graph.nodes.map((node) => [node.card.id, node]));
  const lists = new Map(state.lists.map((list) => [list.id, list.name]));
  const boards = new Map(state.boards.map((board) => [board.id, board.name]));
  const labels = new Map(state.labels.map((label) => [label.id, label]));
  const cards = new Map(state.cards.map((card) => [card.id, card]));
  const name = (id: string) => cards.get(id)?.name ?? "";

  const link = (kind: LinkKind, from: string, to: string) => {
    if (!canLink(state, kind, from, to))
      return onError(t(kind === "blocks" ? "graph.cannotBlock" : "graph.cannotParent"));
    if (kind === "blocks") cardActions.addDependency(to, from);
    else cardActions.updateCard(to, (card) => ({ ...card, parentCardId: from }));
  };
  const unlink = (edge: GraphEdge) => {
    if (edge.kind === "blocks") cardActions.removeDependency(edge.to, edge.from);
    else cardActions.updateCard(edge.to, (card) => ({ ...card, parentCardId: undefined }));
    setSelected((current) => (current && "edge" in current && sameEdge(current.edge, edge) ? undefined : current));
  };
  const edgeText = (edge: GraphEdge) =>
    t(edge.kind === "blocks" ? "graph.edgeBlocks" : "graph.edgeParent", { from: name(edge.from), to: name(edge.to) });

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

  const path = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const bend = Math.max(40, Math.abs(to.x - from.x) / 2);
    return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
  };
  /** The middle of the curve drawn by `path`. */
  const halfway = (from: { x: number; y: number }, to: { x: number; y: number }) => ({
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
  });
  const exit = (node: GraphNode) => ({ x: node.x + nodeSize.width, y: node.y + nodeSize.height / 2 });
  const entry = (node: GraphNode) => ({ x: node.x, y: node.y + nodeSize.height / 2 });

  const selectedCard = selected && "card" in selected ? cards.get(selected.card) : undefined;
  const selectedEdge = selected && "edge" in selected ? selected.edge : undefined;
  const removeOnKey = (event: KeyboardEvent, edge: GraphEdge) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      unlink(edge);
    }
  };

  const relations = (card: Card) => {
    const edges = allEdges.filter((edge) => edge.from === card.id || edge.to === card.id);
    const group = (title: MessageKey, items: GraphEdge[], other: (edge: GraphEdge) => string, add: Adding) => (
      <div className="grid gap-1">
        <div className="flex items-center justify-between gap-2">
          <strong className="text-[13px]">{t(title)}</strong>
          <Button
            variant="text"
            aria-label={`${t("common.add")}: ${t(title)}`}
            aria-expanded={adding === add}
            onClick={() => setAdding(adding === add ? undefined : add)}
          >
            {t("common.add")}
          </Button>
        </div>
        {adding === add && (
          <CardPicker
            label={t(title)}
            candidates={state.cards.filter((item) => {
              if (item.boardId !== card.boardId && add !== "waitsOn" && add !== "blocks") return false;
              const [kind, from, to]: [LinkKind, string, string] =
                add === "waitsOn"
                  ? ["blocks", item.id, card.id]
                  : add === "blocks"
                    ? ["blocks", card.id, item.id]
                    : add === "parent"
                      ? ["parent", item.id, card.id]
                      : ["parent", card.id, item.id];
              return canLink(state, kind, from, to);
            })}
            onPick={(item) => {
              setAdding(undefined);
              if (add === "waitsOn") link("blocks", item.id, card.id);
              else if (add === "blocks") link("blocks", card.id, item.id);
              else if (add === "parent") link("parent", item.id, card.id);
              else link("parent", card.id, item.id);
            }}
          />
        )}
        {items.length ? (
          <ul className="m-0 grid list-none gap-1 p-0">
            {items.map((edge) => (
              <li key={`${edge.kind}${edge.from}${edge.to}`} className="flex items-center gap-1">
                <Button
                  variant="link-quiet"
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => setSelected({ card: other(edge) })}
                >
                  {name(other(edge))}
                </Button>
                <Button
                  variant="icon"
                  aria-label={t("graph.removeLink", { link: edgeText(edge) })}
                  onClick={() => unlink(edge)}
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-[13px] text-ink-subtle">{t("graph.none")}</span>
        )}
      </div>
    );
    const blocks = (edge: GraphEdge) => edge.kind === "blocks";
    return (
      <>
        {group(
          "graph.waitsOn",
          edges.filter((edge) => blocks(edge) && edge.to === card.id),
          (edge) => edge.from,
          "waitsOn",
        )}
        {group(
          "graph.blocks",
          edges.filter((edge) => blocks(edge) && edge.from === card.id),
          (edge) => edge.to,
          "blocks",
        )}
        {group(
          "graph.parent",
          edges.filter((edge) => !blocks(edge) && edge.to === card.id),
          (edge) => edge.from,
          "parent",
        )}
        {group(
          "graph.subCards",
          edges.filter((edge) => !blocks(edge) && edge.from === card.id),
          (edge) => edge.to,
          "child",
        )}
      </>
    );
  };

  return (
    <section
      className="mx-3 mt-0 mb-3 flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto rounded-[10px] bg-white p-3 text-ink"
      aria-label={t("graph.region")}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented label={t("graph.newLink")}>
          <SegmentedTab selected={mode === "blocks"} onClick={() => setMode("blocks")}>
            {t("graph.modeBlocks")}
          </SegmentedTab>
          <SegmentedTab selected={mode === "parent"} onClick={() => setMode("parent")}>
            {t("graph.modeParent")}
          </SegmentedTab>
        </Segmented>
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
          <span className="flex items-center gap-1.5">
            <svg width="28" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="28" y2="4" className="stroke-ink-subtle" strokeWidth="2" strokeDasharray="5 4" />
            </svg>
            {t("graph.legendParent")}
          </span>
        </span>
      </div>
      <Hint className="m-0">{t(mode === "blocks" ? "graph.hintBlocks" : "graph.hintParent")}</Hint>
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
                      d={path(exit(from), entry(to))}
                      fill="none"
                      markerEnd="url(#graph-arrow)"
                      strokeWidth={active ? 3.5 : 2}
                      strokeDasharray={edge.kind === "parent" ? "6 5" : undefined}
                      className={active ? "stroke-brand" : blocking ? "stroke-danger" : "stroke-ink-subtle"}
                    />
                  );
                })}
                {drag && nodes.get(drag.from) && (
                  <path
                    d={path(exit(nodes.get(drag.from) as GraphNode), drag)}
                    fill="none"
                    strokeWidth="2"
                    strokeDasharray={mode === "parent" ? "6 5" : undefined}
                    className="pointer-events-none stroke-brand"
                  />
                )}
              </svg>
              {graph.edges.map((edge) => {
                const [from, to] = [nodes.get(edge.from), nodes.get(edge.to)];
                if (!from || !to) return null;
                const middle = halfway(exit(from), entry(to));
                const active = selectedEdge && sameEdge(selectedEdge, edge);
                return (
                  <button
                    key={`${edge.kind}${edge.from}${edge.to}`}
                    type="button"
                    aria-label={edgeText(edge)}
                    aria-pressed={Boolean(active)}
                    title={edgeText(edge)}
                    className={`absolute size-3.5 -translate-1/2 cursor-pointer rounded-full border-2 border-white p-0 shadow hover:scale-125 ${
                      active ? "bg-brand" : edge.kind === "blocks" && !edge.resolved ? "bg-danger" : "bg-ink-subtle"
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
          <aside className="grid w-[280px] content-start gap-3 max-phone:w-auto" aria-label={t("graph.details")}>
            {selectedCard && (
              <>
                <div className="grid gap-1.5">
                  <strong className="wrap-anywhere">{selectedCard.name}</strong>
                  <Button variant="secondary" className="justify-self-start" onClick={() => onOpenCard(selectedCard)}>
                    {t("graph.openCard")}
                  </Button>
                </div>
                {relations(selectedCard)}
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
