import { useState } from "react";
import type { AiSettings } from "../ai/ai";
import type { BoardViewData } from "../app/useBoardView";
import type { BoardActions } from "../hooks/useBoardActions";
import type { CardActions } from "../hooks/useCardActions";
import { boardHref, type CalendarScale, type Route } from "../lib/router";
import type { AppState, Board, Card } from "../model";
import { AiPanel, type ProposedCard } from "./AiPanel";
import { BoardCalendar } from "./BoardCalendar";
import { BoardCanvas } from "./BoardCanvas";
import { BoardFilterPanel } from "./BoardFilterPanel";
import type { BoardMenuActions } from "./BoardMenu";
import { BoardToolbar } from "./BoardToolbar";
import type { TileActions } from "./CardTile";
import { DocView } from "./DocView";

/** An open board: its toolbar and filter, then the lists, calendar or document view chosen in the toolbar. */
export function BoardView({
  state,
  board,
  route,
  view,
  navigate,
  tileActions,
  boardActions,
  cardActions,
  aiSettings,
  menu,
  onOpenAbout,
  onOpenCard,
  onOpenAiSettings,
  onCreateProposedCards,
  onDeleteCard,
  onDeleteList,
}: {
  state: AppState;
  board: Board;
  route: Extract<Route, { page: "board" }>;
  view: BoardViewData;
  navigate: (href: string, options?: { replace?: boolean }) => void;
  tileActions: TileActions;
  boardActions: BoardActions;
  cardActions: CardActions;
  aiSettings: AiSettings | null;
  menu: BoardMenuActions;
  onOpenAbout: () => void;
  onOpenCard: (card: Card) => void;
  onOpenAiSettings: () => void;
  onCreateProposedCards: (items: ProposedCard[]) => void;
  onDeleteCard: (card: Card) => void;
  onDeleteList: (listId: string) => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const updateBoard = (change: (item: Board) => Board) => boardActions.updateBoard(board.id, change);
  const setDoc = (doc: string) => updateBoard((item) => ({ ...item, doc }));
  return (
    <>
      <BoardToolbar
        board={board}
        view={route.view}
        scale={route.scale}
        navigate={navigate}
        onUpdate={updateBoard}
        onOpenAbout={onOpenAbout}
        keyword={view.filter.keyword}
        onKeyword={(keyword) => view.updateFilter({ keyword })}
        filterCount={view.filterCount}
        filterOpen={filterOpen}
        onToggleFilter={() => setFilterOpen((current) => !current)}
        menu={menu}
      />
      {filterOpen && (
        <BoardFilterPanel
          state={state}
          board={board}
          filter={view.filter}
          shown={view.filteredCardIds.size}
          total={view.totalCardCount}
          onChange={view.updateFilter}
          onClose={() => setFilterOpen(false)}
        />
      )}
      {route.view === "doc" ? (
        <DocView
          state={state}
          board={board}
          onChange={setDoc}
          onOpenCard={onOpenCard}
          assistant={
            <AiPanel
              state={state}
              board={board}
              settings={aiSettings}
              onOpenSettings={onOpenAiSettings}
              onCreateCards={onCreateProposedCards}
              onDocChange={setDoc}
              onOpenCard={onOpenCard}
            />
          }
        />
      ) : route.view === "calendar" ? (
        <BoardCalendar
          state={state}
          cards={state.cards.filter((item) => view.filteredCardIds.has(item.id))}
          scale={route.scale}
          date={route.date}
          onNavigate={(scale: CalendarScale, date?: string) =>
            navigate(boardHref(board.id, { view: "calendar", scale, date }), { replace: true })
          }
          onOpen={onOpenCard}
          onReschedule={(item, dates) =>
            cardActions.updateCard(item.id, (current) => ({
              ...current,
              startAt: dates.startAt,
              dueAt: dates.dueAt,
              dueReminderMinutes: dates.dueAt ? current.dueReminderMinutes : undefined,
              dueRepeat: dates.dueAt ? current.dueRepeat : undefined,
            }))
          }
          onDelete={onDeleteCard}
        />
      ) : (
        <BoardCanvas
          state={state}
          board={board}
          view={view}
          tileActions={tileActions}
          boardActions={boardActions}
          cardActions={cardActions}
          onDeleteList={onDeleteList}
        />
      )}
    </>
  );
}
