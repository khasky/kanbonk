import { useDeferredValue, useMemo } from "react";
import { t } from "../i18n";
import { inboxBoardId, inboxWorkspaceId } from "../model/inbox";
import { type AppState, type Card, searchCards } from "../model";

const resultClass =
  "flex w-full flex-col gap-[3px] rounded-sm border-0 bg-transparent p-[9px] text-left text-ink hover:bg-brand-soft focus-visible:bg-brand-soft";

/** Workspaces, boards and cards matching the global search. Card search is deferred so typing stays responsive. */
export function SearchResults({
  state,
  query,
  onOpenWorkspace,
  onOpenBoard,
  onOpenCard,
}: {
  state: AppState;
  query: string;
  onOpenWorkspace: (workspaceId: string) => void;
  onOpenBoard: (boardId: string) => void;
  onOpenCard: (card: Card) => void;
}) {
  const deferredQuery = useDeferredValue(query, "");
  const cards = useMemo(() => searchCards(state, deferredQuery).slice(0, 50), [state, deferredQuery]);
  const needle = query.trim().toLocaleLowerCase();
  const workspaces = state.workspaces
    .filter((item) => item.id !== inboxWorkspaceId && item.name.toLocaleLowerCase().includes(needle))
    .slice(0, 10);
  const boards = state.boards
    .filter((item) => item.id !== inboxBoardId && !item.deletedAt && item.name.toLocaleLowerCase().includes(needle))
    .slice(0, 20);
  return (
    <section
      className="fixed top-[43px] left-1/2 z-[90] max-h-[60dvh] w-[min(540px,calc(100vw_-_20px))] -translate-x-1/2 overflow-auto rounded-md border border-line bg-white p-2.5 text-ink shadow-overlay max-phone:top-20"
      aria-label={t("layout.searchResults")}
    >
      <strong className="block px-2 pt-[5px] pb-[9px]">{t("layout.searchResults")}</strong>
      {workspaces.map((item) => (
        <button key={item.id} className={resultClass} onClick={() => onOpenWorkspace(item.id)}>
          <small className="text-ink-muted">{t("layout.workspace")}</small>
          {item.name}
        </button>
      ))}
      {boards.map((item) => (
        <button key={item.id} className={resultClass} onClick={() => onOpenBoard(item.id)}>
          <small className="text-ink-muted">{t("layout.board")}</small>
          {item.name}
        </button>
      ))}
      {cards.map((item) => (
        <button key={item.id} className={resultClass} onClick={() => onOpenCard(item)}>
          <small className="text-ink-muted">{state.boards.find((board) => board.id === item.boardId)?.name}</small>
          {item.name}
        </button>
      ))}
      {!workspaces.length && !boards.length && !cards.length && (
        <p className="p-2 text-ink-muted">{t("layout.nothingFound")}</p>
      )}
    </section>
  );
}
