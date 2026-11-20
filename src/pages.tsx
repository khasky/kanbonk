import { Modal } from "./ui/Modal";
import { ColorInput } from "./ColorInput";
import { useMemo, useState } from "react";
import type { AppState, Card, Zone } from "./model";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { linkHref, type CalendarScale } from "./router";
import { trashDaysLeft, trashEntries, trashRetentionDays, type TrashImpact, type TrashKind } from "./trash";
import {
  calendarItems,
  calendarRange,
  dayKey,
  daysBetween,
  itemsInMonth,
  layoutWeek,
  monthWeeks,
  parseDay,
  previewItem,
  rescheduleCard,
  shiftAnchor,
  startOfWeek,
  type CalendarDrag,
  type WeekRow,
} from "./calendar";
import { findDuplicates, pairKey, type DuplicatePair } from "./dedupe";
import { inboxWorkspaceId, inboxBoardId } from "./inbox";

const kindNames: Record<TrashKind, string> = { workspace: "Workspaces", board: "Boards", list: "Lists", card: "Cards" };
const kindOne: Record<TrashKind, string> = { workspace: "workspace", board: "board", list: "list", card: "card" };

export function HomePage({
  state,
  onOpen,
  onCreate,
}: {
  state: AppState;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const workspaces = state.workspaces.filter((item) => item.id !== inboxWorkspaceId && !item.archived);
  return (
    <section className="page home-page" aria-label="Workspaces">
      <h1>Workspaces</h1>
      {workspaces.length ? (
        <div className="tile-grid">
          {workspaces.map((workspace) => {
            const boards = state.boards.filter((board) => board.workspaceId === workspace.id && !board.archived);
            return (
              <button key={workspace.id} className="tile workspace-tile" onClick={() => onOpen(workspace.id)}>
                <span className="workspace-avatar">{workspace.name.slice(0, 1).toUpperCase()}</span>
                <strong>{workspace.name}</strong>
                <small>
                  {boards.length
                    ? boards
                        .slice(0, 3)
                        .map((board) => board.name)
                        .join(", ") + (boards.length > 3 ? "…" : "")
                    : "No boards"}
                </small>
              </button>
            );
          })}
          <button className="tile tile-create" onClick={onCreate}>
            + Create workspace
          </button>
        </div>
      ) : (
        <div className="empty-page">
          <p>No workspaces yet.</p>
          <button className="primary-button" onClick={onCreate}>
            Add workspace
          </button>
        </div>
      )}
    </section>
  );
}

export function WorkspacePage({
  state,
  workspaceId,
  onOpenBoard,
  onCreateBoard,
  onRename,
  onDelete,
}: {
  state: AppState;
  workspaceId: string;
  onOpenBoard: (id: string) => void;
  onCreateBoard: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return <MissingPage what="Workspace not found" />;
  const boards = state.boards.filter((board) => board.workspaceId === workspace.id && !board.archived);
  return (
    <section className="page workspace-page" aria-label={workspace.name}>
      <header className="page-header">
        <span className="workspace-avatar large">{workspace.name.slice(0, 1).toUpperCase()}</span>
        <input
          className="page-title"
          aria-label="Workspace name"
          defaultValue={workspace.name}
          key={workspace.name}
          onBlur={(event) => {
            const name = event.target.value.trim();
            if (name && name !== workspace.name) onRename(name);
            else event.target.value = workspace.name;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        {workspace.id !== inboxWorkspaceId && (
          <button className="danger-button" onClick={onDelete}>
            Move to trash
          </button>
        )}
      </header>
      <h2>Boards</h2>
      {boards.length ? (
        <div className="tile-grid">
          {boards.map((board) => (
            <button
              key={board.id}
              className="tile board-tile"
              style={{ background: board.background }}
              onClick={() => onOpenBoard(board.id)}
            >
              <strong>{board.name}</strong>
              {board.starred && <span aria-label="Starred">★</span>}
            </button>
          ))}
          <button className="tile tile-create" onClick={onCreateBoard}>
            + Create board
          </button>
        </div>
      ) : (
        <div className="empty-page">
          <p>This workspace has no boards yet.</p>
          <button className="primary-button" onClick={onCreateBoard}>
            Add board
          </button>
        </div>
      )}
    </section>
  );
}

export function MissingPage({ what }: { what: string }) {
  return (
    <section className="page empty-page" aria-label="Not found">
      <h1>{what}</h1>
      <p>It may have been moved to the trash or not synced to this device yet.</p>
      <p>
        <a href={linkHref("/")}>Go home</a> · <a href={linkHref("/trash")}>Open trash</a>
      </p>
    </section>
  );
}

export function TrashPage({
  state,
  kind,
  onKind,
  onRestore,
  onPurge,
  onEmpty,
}: {
  state: AppState;
  kind?: TrashKind;
  onKind: (kind?: TrashKind) => void;
  onRestore: (kind: TrashKind, id: string) => void;
  onPurge: (kind: TrashKind, id: string) => void;
  onEmpty: () => void;
}) {
  const all = trashEntries(state);
  const entries = kind ? all.filter((item) => item.kind === kind) : all;
  return (
    <section className="page trash-page" aria-label="Trash">
      <header className="page-header">
        <h1>Trash</h1>
        {all.length > 0 && (
          <button className="danger-button" onClick={onEmpty}>
            Empty trash
          </button>
        )}
      </header>
      <div className="segmented" role="tablist" aria-label="Category">
        <button role="tab" aria-selected={!kind} onClick={() => onKind(undefined)}>
          All ({all.length})
        </button>
        {(Object.keys(kindNames) as TrashKind[]).map((item) => (
          <button key={item} role="tab" aria-selected={kind === item} onClick={() => onKind(item)}>
            {kindNames[item]} ({all.filter((entry) => entry.kind === item).length})
          </button>
        ))}
      </div>
      {entries.length ? (
        <div className="trash-list">
          {entries.map((entry) => (
            <div className="panel-row trash-row" key={`${entry.kind}:${entry.id}`}>
              <span>
                <strong>{entry.name}</strong>
                <small>
                  {kindNames[entry.kind]}
                  {entry.context ? ` · ${entry.context}` : ""} · trashed{" "}
                  {new Date(entry.deletedAt).toLocaleString("en-US")}
                  {entry.withParent ? " · with its parent" : ""} · deleted in {trashDaysLeft(entry.deletedAt)} days
                </small>
              </span>
              <span className="row-actions">
                <button onClick={() => onRestore(entry.kind, entry.id)}>Restore</button>
                <button className="danger-button" onClick={() => onPurge(entry.kind, entry.id)}>
                  Delete forever
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-page">Trash is empty.</p>
      )}
      <p className="hint">
        Items stay in the trash for {trashRetentionDays} days, then are deleted forever. Restoring cascades: an item
        comes back together with its deleted parents (workspace, board, list), everything deleted along with it, and the
        cards it depends on.
      </p>
    </section>
  );
}

export function DeleteDialog({
  kind,
  name,
  impact,
  onConfirm,
  onCancel,
}: {
  kind: TrashKind;
  name: string;
  impact: TrashImpact;
  onConfirm: (withDependents: boolean) => void;
  onCancel: () => void;
}) {
  const cards = impact.cardIds.length - (kind === "card" ? 1 : 0);
  return (
    <Modal label="Move to trash" className="creation-dialog delete-dialog" role="alertdialog" onDismiss={onCancel}>
      <h2>
        Delete {kindOne[kind]} “{name}”?
      </h2>
      <p>
        It will be moved to the trash{cards > 0 ? ` along with ${cards} ${cards === 1 ? "card" : "cards"}` : ""}. You
        can restore it from the Trash page for {trashRetentionDays} days.
      </p>
      {impact.dependents.length > 0 && (
        <div className="dependency-warning" role="alert">
          <strong>Dependent cards ({impact.dependents.length}):</strong>
          <ul>
            {impact.dependents.slice(0, 8).map(({ dependent, prerequisite }) => (
              <li key={`${dependent.id}-${prerequisite.id}`}>
                “{dependent.name}” depends on “{prerequisite.name}”
              </li>
            ))}
          </ul>
          {impact.dependents.length > 8 && <small>and {impact.dependents.length - 8} more</small>}
        </div>
      )}
      <div>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        {impact.dependents.length > 0 && (
          <button type="button" onClick={() => onConfirm(true)}>
            Delete with dependents
          </button>
        )}
        <button type="button" className="primary-button danger" autoFocus onClick={() => onConfirm(false)}>
          {impact.dependents.length ? "Delete, keep dependents" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface CalendarDragState {
  cardId: string;
  mode: CalendarDrag;
  delta: number;
}

function dayAt(x: number, y: number): string | undefined {
  return document
    .elementsFromPoint(x, y)
    .map((element) => (element as HTMLElement).dataset?.day)
    .find(Boolean);
}

function CalendarWeek({
  row,
  month,
  today,
  labels,
  tall,
  dragging,
  onOpen,
  onStartDrag,
  onDelete,
}: {
  row: WeekRow;
  month?: number;
  today: string;
  labels: AppState["labels"];
  tall?: boolean;
  dragging?: string;
  onOpen: (card: Card) => void;
  onStartDrag: (event: ReactPointerEvent, card: Card, mode: CalendarDrag) => void;
  onDelete: (card: Card) => void;
}) {
  return (
    <div
      className={`calendar-week ${tall ? "tall" : ""}`}
      style={{ gridTemplateRows: `26px repeat(${Math.max(row.lanes, 1)}, auto) 1fr` }}
    >
      {row.days.map((day, index) => (
        <div
          key={dayKey(day)}
          data-day={dayKey(day)}
          className={`calendar-day ${month !== undefined && day.getMonth() !== month ? "outside" : ""} ${dayKey(day) === today ? "today" : ""}`}
          style={{ gridColumn: index + 1, gridRow: `1 / span ${row.lanes + 2}` }}
        >
          <span className="calendar-day-number">{day.getDate()}</span>
        </div>
      ))}
      {row.segments.map((segment) => {
        const { card } = segment.item;
        const color = labels.find((label) => card.labelIds.includes(label.id) && label.color)?.color;
        return (
          <div
            key={card.id}
            className={`calendar-bar ${segment.continuesBefore ? "cont-before" : ""} ${segment.continuesAfter ? "cont-after" : ""} ${card.completed ? "done" : ""} ${dragging === card.id ? "dragging" : ""}`}
            style={{
              gridColumn: `${segment.column + 1} / span ${segment.span}`,
              gridRow: segment.lane + 2,
              borderLeftColor: color,
            }}
            title={`${card.name} — ${segment.item.start.toLocaleDateString("en-US")}${segment.item.end > segment.item.start ? ` – ${segment.item.end.toLocaleDateString("en-US")}` : ""}`}
            onPointerDown={(event) => onStartDrag(event, card, "move")}
          >
            {!segment.continuesBefore && (
              <span
                className="calendar-resize start"
                aria-hidden="true"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onStartDrag(event, card, "start");
                }}
              />
            )}
            <button
              className="calendar-bar-name"
              onClick={(event) => {
                if (event.detail === 0) onOpen(card);
              }}
              onKeyDown={(event) => {
                if (event.key === "Delete") onDelete(card);
              }}
            >
              {card.completed ? "✓ " : ""}
              {card.name}
            </button>
            {!segment.continuesAfter && (
              <>
                <button
                  className="calendar-delete"
                  aria-label={`Delete card ${card.name}`}
                  title="Delete"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(card);
                  }}
                >
                  ×
                </button>
                <span
                  className="calendar-resize end"
                  aria-hidden="true"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onStartDrag(event, card, "end");
                  }}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BoardCalendar({
  state,
  cards,
  scale,
  date,
  onNavigate,
  onOpen,
  onReschedule,
  onDelete,
}: {
  state: AppState;
  cards: Card[];
  scale: CalendarScale;
  date?: string;
  onNavigate: (scale: CalendarScale, date?: string) => void;
  onOpen: (card: Card) => void;
  onReschedule: (card: Card, dates: { startAt?: string; dueAt?: string }) => void;
  onDelete: (card: Card) => void;
}) {
  const [drag, setDrag] = useState<CalendarDragState | null>(null);
  const anchor = date ? parseDay(date) : new Date();
  const today = dayKey(new Date());
  const baseItems = useMemo(() => calendarItems(state, cards), [state, cards]);
  const items = useMemo(
    () =>
      drag
        ? baseItems.map((item) => (item.card.id === drag.cardId ? previewItem(item, drag.mode, drag.delta) : item))
        : baseItems,
    [baseItems, drag],
  );
  function startDrag(event: ReactPointerEvent, card: Card, mode: CalendarDrag) {
    const item = baseItems.find((entry) => entry.card.id === card.id);
    const origin = dayAt(event.clientX, event.clientY);
    if (event.button !== 0 || !item || !origin) return;
    event.preventDefault();
    const startX = event.clientX,
      startY = event.clientY;
    let current: CalendarDragState = { cardId: card.id, mode, delta: 0 };
    let moved = false;
    setDrag(current);
    const move = (next: PointerEvent) => {
      moved ||= Math.abs(next.clientX - startX) + Math.abs(next.clientY - startY) > 4;
      const target = dayAt(next.clientX, next.clientY);
      if (!target) return;
      const delta = daysBetween(parseDay(origin), parseDay(target));
      if (delta !== current.delta) {
        current = { ...current, delta };
        setDrag(current);
      }
    };
    const finish = (commit: boolean) => () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      setDrag(null);
      if (!commit) return;
      if (current.delta !== 0) onReschedule(card, rescheduleCard(item, mode, current.delta));
      else if (!moved && mode === "move") onOpen(card);
    };
    const up = finish(true);
    const cancel = finish(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }
  const { from, to } = calendarRange(scale, anchor);
  const title =
    scale === "year"
      ? String(anchor.getFullYear())
      : scale === "month"
        ? `${monthNames[anchor.getMonth()]} ${anchor.getFullYear()}`
        : `${from.toLocaleDateString("en-US")} – ${to.toLocaleDateString("en-US")}`;
  const boardLabels = state.labels.filter((label) => !label.deleted);
  return (
    <section className="board-calendar" aria-label="Board calendar">
      <div className="calendar-toolbar">
        <button onClick={() => onNavigate(scale, dayKey(shiftAnchor(scale, anchor, -1)))} aria-label="Previous">
          ‹
        </button>
        <button onClick={() => onNavigate(scale, undefined)}>Today</button>
        <button onClick={() => onNavigate(scale, dayKey(shiftAnchor(scale, anchor, 1)))} aria-label="Next">
          ›
        </button>
        <h2>{title}</h2>
        <div className="segmented" role="tablist" aria-label="Calendar scale">
          {(["week", "month", "year"] as const).map((item) => (
            <button key={item} role="tab" aria-selected={scale === item} onClick={() => onNavigate(item, date)}>
              {item === "week" ? "Week" : item === "month" ? "Month" : "Year"}
            </button>
          ))}
        </div>
      </div>
      {scale === "year" ? (
        <div className="calendar-year">
          {monthNames.map((name, month) => {
            const monthItems = itemsInMonth(items, anchor.getFullYear(), month);
            return (
              <div className="calendar-year-month" key={name}>
                <button
                  className="calendar-year-title"
                  onClick={() => onNavigate("month", dayKey(new Date(anchor.getFullYear(), month, 1)))}
                >
                  {name} <small>{monthItems.length || ""}</small>
                </button>
                {monthItems.slice(0, 8).map((item) => (
                  <button
                    key={item.card.id}
                    className={`calendar-chip ${item.card.completed ? "done" : ""}`}
                    onClick={() => onOpen(item.card)}
                    title={item.card.name}
                  >
                    <small>{item.start.getMonth() === month ? item.start.getDate() : "…"}</small> {item.card.name}
                  </button>
                ))}
                {monthItems.length > 8 && (
                  <button
                    className="calendar-more"
                    onClick={() => onNavigate("month", dayKey(new Date(anchor.getFullYear(), month, 1)))}
                  >
                    {monthItems.length - 8} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`calendar-grid ${scale}`}>
          <div className="calendar-weekdays">
            {weekdays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          {(scale === "week" ? [layoutWeek(startOfWeek(anchor), items)] : monthWeeks(anchor, items)).map((row) => (
            <CalendarWeek
              key={dayKey(row.start)}
              row={row}
              month={scale === "month" ? anchor.getMonth() : undefined}
              today={today}
              labels={boardLabels}
              onOpen={onOpen}
              tall={scale === "week"}
              dragging={drag?.cardId}
              onStartDrag={startDrag}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
      <p className="hint">
        A card spans from its start date (or creation date) to its due date, if that is later. Drag a bar to another
        day, or drag its edge to change the start or due date; × moves the card to the trash.
      </p>
    </section>
  );
}

export function DedupeDialog({
  state,
  ignored,
  onIgnore,
  onMerge,
  onOpen,
  onClose,
}: {
  state: AppState;
  ignored: Set<string>;
  onIgnore: (pair: DuplicatePair) => void;
  onMerge: (keepId: string, dropId: string) => void;
  onOpen: (card: Card) => void;
  onClose: () => void;
}) {
  const [threshold, setThreshold] = useState(0.55);
  const [sameBoard, setSameBoard] = useState(false);
  const cards = useMemo(
    () => ({ ...state, cards: state.cards.filter((card) => card.boardId !== inboxBoardId || sameBoard) }),
    [state, sameBoard],
  );
  const pairs = useMemo(
    () => findDuplicates(cards, { threshold, crossBoardOnly: !sameBoard, ignored }),
    [cards, threshold, sameBoard, ignored],
  );
  const where = (card: Card) =>
    `${state.boards.find((board) => board.id === card.boardId)?.name ?? ""} / ${state.lists.find((list) => list.id === card.listId)?.name ?? ""}`;
  return (
    <Modal label="Find duplicates" className="side-panel dedupe-panel" onDismiss={onClose}>
      <header>
        <h2>Duplicates across boards</h2>
        <button onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <p className="hint">
        Text similarity (word stems, n-grams, TF-IDF) is computed locally; no data leaves this device.
      </p>
      <label>
        Similarity threshold: {Math.round(threshold * 100)}%
        <input
          type="range"
          min={0.3}
          max={0.95}
          step={0.05}
          value={threshold}
          onChange={(event) => setThreshold(Number(event.target.value))}
        />
      </label>
      <label className="copy-option">
        <input type="checkbox" checked={sameBoard} onChange={(event) => setSameBoard(event.target.checked)} />
        Also search within the same board
      </label>
      <p>Pairs found: {pairs.length}</p>
      {pairs.slice(0, 100).map((pair) => (
        <div className="dedupe-pair" key={pairKey(pair.a.id, pair.b.id)}>
          <strong>{Math.round(pair.score * 100)}%</strong>
          {[pair.a, pair.b].map((card) => (
            <button key={card.id} className="dedupe-card" onClick={() => onOpen(card)}>
              <span>{card.name}</span>
              <small>{where(card)}</small>
            </button>
          ))}
          <div className="row-actions">
            <button
              onClick={() => onMerge(pair.a.id, pair.b.id)}
              title="Move the second card’s comments, checklists and attachments into the first, and the second card to the trash"
            >
              Merge into first
            </button>
            <button onClick={() => onMerge(pair.b.id, pair.a.id)}>Merge into second</button>
            <button onClick={() => onIgnore(pair)}>Not a duplicate</button>
          </div>
        </div>
      ))}
    </Modal>
  );
}

/** A frame drawn around adjacent lists of one zone; its header drags the whole zone and accepts dropped lists. */
export function ZoneFrame({
  zone,
  cardCount,
  onRename,
  onColor,
  onDelete,
  onDropList,
  children,
}: {
  zone: Zone;
  cardCount: number;
  onRename: (name: string) => void;
  onColor: (color: string) => void;
  onDelete: () => void;
  onDropList: (listId: string) => void;
  children: ReactNode;
}) {
  return (
    <section className="zone-frame" style={{ borderColor: zone.color }} aria-label={`Zone ${zone.name}`}>
      <header
        className="zone-header"
        style={{ background: zone.color }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          const listId = event.dataTransfer.getData("text/kanbonk-list");
          if (!listId) return;
          event.preventDefault();
          event.stopPropagation();
          onDropList(listId);
        }}
      >
        <span
          className="list-drag-handle"
          draggable
          title="Drag zone"
          onDragStart={(event) => event.dataTransfer.setData("text/kanbonk-zone", zone.id)}
        >
          ⋮⋮
        </span>
        <input
          aria-label="Zone name"
          size={Math.max(6, zone.name.length + 1)}
          defaultValue={zone.name}
          key={zone.name}
          onBlur={(event) => {
            const name = event.target.value.trim();
            if (name && name !== zone.name) onRename(name);
            else event.target.value = zone.name;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <small title="Cards in zone">{cardCount}</small>
        <ColorInput label={`Zone color ${zone.name}`} value={zone.color} onCommit={onColor} />
        <button onClick={onDelete} aria-label={`Remove zone ${zone.name}`} title="Remove zone (lists stay)">
          ×
        </button>
      </header>
      <div className="zone-lists">{children}</div>
    </section>
  );
}
