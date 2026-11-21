import type { AppState } from "../model";
import { inboxWorkspaceId } from "../model/inbox";

export function HomePage({
  state,
  onOpen,
  onCreate,
}: {
  state: AppState;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const workspaces = state.workspaces.filter((item) => item.id !== inboxWorkspaceId && !item.deletedAt);
  return (
    <section className="page home-page" aria-label="Workspaces">
      <h1>Workspaces</h1>
      {workspaces.length ? (
        <div className="tile-grid">
          {workspaces.map((workspace) => {
            const boards = state.boards.filter((board) => board.workspaceId === workspace.id && !board.deletedAt);
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
