import { useDeferredValue, useMemo } from "react";
import { inboxBoardId, inboxWorkspaceId } from "../model/inbox";
import { type AppState, type Card, searchCards } from "../model";

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
    <section className="search-results" aria-label="Search results">
      <strong>Search results</strong>
      {workspaces.map((item) => (
        <button key={item.id} onClick={() => onOpenWorkspace(item.id)}>
          <small>Workspace</small>
          {item.name}
        </button>
      ))}
      {boards.map((item) => (
        <button key={item.id} onClick={() => onOpenBoard(item.id)}>
          <small>Board</small>
          {item.name}
        </button>
      ))}
      {cards.map((item) => (
        <button key={item.id} onClick={() => onOpenCard(item)}>
          <small>{state.boards.find((board) => board.id === item.boardId)?.name}</small>
          {item.name}
        </button>
      ))}
      {!workspaces.length && !boards.length && !cards.length && <p>Nothing found</p>}
    </section>
  );
}
