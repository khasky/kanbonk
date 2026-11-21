import { MissingPage } from "./MissingPage";
import type { AppState } from "../model";
import { inboxWorkspaceId } from "../model/inbox";

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
  const boards = state.boards.filter((board) => board.workspaceId === workspace.id && !board.deletedAt);
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
