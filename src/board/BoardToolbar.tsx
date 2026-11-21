import type { Board } from "../model";
import { type BoardView, boardHref, type CalendarScale } from "../lib/router";
import { Icon } from "../ui/Icon";
import { NameEditor } from "../ui/NameEditor";
import { BoardMenu, type BoardMenuActions } from "./BoardMenu";

/** The bar above a board: title, favorite, description, view switch, search, filter and the board menu. */
export function BoardToolbar({
  board,
  view,
  scale,
  navigate,
  onUpdate,
  onOpenAbout,
  keyword,
  onKeyword,
  filterCount,
  filterOpen,
  onToggleFilter,
  menu,
}: {
  board: Board;
  /** The open view, or undefined when the board is not the current page. */
  view: BoardView | undefined;
  /** The calendar scale to open the Calendar view with. */
  scale: CalendarScale;
  navigate: (href: string) => void;
  onUpdate: (change: (board: Board) => Board) => void;
  onOpenAbout: () => void;
  keyword: string;
  onKeyword: (keyword: string) => void;
  filterCount: number;
  filterOpen: boolean;
  onToggleFilter: () => void;
  menu: BoardMenuActions;
}) {
  return (
    <div className="board-toolbar">
      <NameEditor
        key={board.id}
        className="board-title"
        label="Board title"
        value={board.name}
        onCommit={(name) => onUpdate((item) => ({ ...item, name }))}
      />
      <button
        className={`toolbar-button ${board.starred ? "is-starred" : ""}`}
        onClick={() => onUpdate((item) => ({ ...item, starred: !item.starred }))}
        aria-label={board.starred ? "Remove from favorites" : "Add to favorites"}
      >
        <Icon name="star" />
      </button>
      <button className="toolbar-button" onClick={onOpenAbout} aria-label="Board description">
        <Icon name="info" /> Description
      </button>
      <div className="segmented view-switch" role="tablist" aria-label="Board view">
        <button role="tab" aria-selected={view === "lists"} onClick={() => navigate(boardHref(board.id))}>
          Lists
        </button>
        <button
          role="tab"
          aria-selected={view === "calendar"}
          onClick={() => navigate(boardHref(board.id, { view: "calendar", scale }))}
        >
          Calendar
        </button>
        <button
          role="tab"
          aria-selected={view === "doc"}
          onClick={() => navigate(boardHref(board.id, { view: "doc" }))}
        >
          Doc
        </button>
      </div>
      <span className="toolbar-spacer" />
      <input
        type="search"
        className="board-search"
        value={keyword}
        onChange={(event) => onKeyword(event.target.value)}
        placeholder="Search this board"
        aria-label="Search cards on this board"
      />
      <button
        className="toolbar-button"
        aria-expanded={filterOpen}
        aria-label={filterCount ? `Board filter, active: ${filterCount}` : "Board filter"}
        onClick={onToggleFilter}
      >
        <Icon name="search" /> Filter{filterCount ? ` (${filterCount})` : ""}
      </button>
      <BoardMenu background={board.background} actions={menu} />
    </div>
  );
}
