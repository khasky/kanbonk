import type { Board } from "../model";
import { type BoardView, boardHref, type CalendarScale } from "../lib/router";
import { Icon } from "../ui/Icon";
import { NameEditor } from "../ui/NameEditor";
import { BoardMenu, type BoardMenuActions } from "./BoardMenu";
import { Button } from "../ui/Button";
import { Segmented, SegmentedTab } from "../ui/Segmented";
import { t } from "../i18n";

/** A person on another synced device who has this board open, and the card they are looking at, if any. */
export interface BoardVisitor {
  id: string;
  name: string;
  cardName?: string;
}

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
  visitors = [],
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
  visitors?: BoardVisitor[];
}) {
  return (
    <div className="flex min-h-[58px] items-center gap-[7px] bg-[#0002] px-3.5 py-[9px] text-white max-phone:p-1.5 max-phone:not-in-[.panel-open]:whitespace-nowrap *:in-[.panel-open]:shrink-0">
      <NameEditor
        key={board.id}
        className="w-[min(360px,32vw)] min-w-[120px] rounded-[3px] border-0 bg-transparent px-[9px] py-1.5 text-[18px] font-bold text-white hover:bg-[#ffffff2b] focus:bg-[#ffffff2b] max-tablet:w-[170px] max-phone:min-h-11 max-phone:w-auto max-phone:min-w-20 max-phone:grow max-phone:basis-[120px]"
        label={t("board.boardTitle")}
        value={board.name}
        onCommit={(name) => onUpdate((item) => ({ ...item, name }))}
      />
      <Button
        variant="toolbar"
        onClick={() => onUpdate((item) => ({ ...item, starred: !item.starred }))}
        aria-label={board.starred ? t("board.removeFromFavorites") : t("board.addToFavorites")}
      >
        <Icon name="star" className={board.starred ? "fill-warning text-warning" : undefined} />
      </Button>
      <Button variant="toolbar" onClick={onOpenAbout} aria-label={t("board.boardDescription")}>
        <Icon name="info" /> {t("board.description")}
      </Button>
      <Segmented label={t("board.boardView")} tone="toolbar">
        <SegmentedTab selected={view === "lists"} onClick={() => navigate(boardHref(board.id))}>
          {t("board.viewLists")}
        </SegmentedTab>
        <SegmentedTab
          selected={view === "calendar"}
          onClick={() => navigate(boardHref(board.id, { view: "calendar", scale }))}
        >
          {t("board.viewCalendar")}
        </SegmentedTab>
        <SegmentedTab selected={view === "doc"} onClick={() => navigate(boardHref(board.id, { view: "doc" }))}>
          {t("board.viewDoc")}
        </SegmentedTab>
      </Segmented>
      <span className="flex-1 in-[.panel-open]:flex-[1_0_4px] max-phone:hidden" />
      <input
        type="search"
        className="h-8 w-[200px] max-w-[32vw] rounded-md border border-[#ffffff55] bg-[#ffffff33] px-2.5 py-0 text-inherit placeholder:text-inherit placeholder:opacity-80 focus:bg-white focus:text-ink focus:outline-2 focus:outline-brand"
        value={keyword}
        onChange={(event) => onKeyword(event.target.value)}
        placeholder={t("board.searchBoard")}
        aria-label={t("board.searchBoardLabel")}
      />
      <Button
        variant="toolbar"
        aria-expanded={filterOpen}
        aria-label={filterCount ? t("board.boardFilterActive", { count: filterCount }) : t("board.boardFilter")}
        onClick={onToggleFilter}
      >
        <Icon name="search" /> {filterCount ? t("board.filterCount", { count: filterCount }) : t("board.filter")}
      </Button>
      {visitors.length > 0 && (
        <ul className="m-0 flex list-none gap-1 p-0" aria-label={t("views.onlineNow")}>
          {visitors.map((visitor) => {
            const where = visitor.cardName
              ? t("views.visitorOnCard", { name: visitor.name, card: visitor.cardName })
              : t("views.visitorOnBoard", { name: visitor.name });
            return (
              <li
                key={visitor.id}
                className="relative grid size-8 place-items-center rounded-full bg-white text-[12px] font-bold text-ink"
                title={where}
                aria-label={where}
              >
                {visitor.name.slice(0, 2).toUpperCase()}
                <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-white bg-[#22a06b]" />
              </li>
            );
          })}
        </ul>
      )}
      <BoardMenu background={board.background} actions={menu} />
    </div>
  );
}
