import type { AppState } from "../model";
import { inboxWorkspaceId } from "../model/inbox";
import { Button } from "../ui/Button";
import { WorkspaceAvatar } from "../ui/WorkspaceAvatar";
import { createTileClass, emptyClass, pageClass, pageTitleClass, tileGridClass, workspaceTileClass } from "./pageLook";

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
    <section className={pageClass} aria-label="Workspaces">
      <h1 className={pageTitleClass}>Workspaces</h1>
      {workspaces.length ? (
        <div className={tileGridClass}>
          {workspaces.map((workspace) => {
            const boards = state.boards.filter((board) => board.workspaceId === workspace.id && !board.deletedAt);
            return (
              <button key={workspace.id} className={workspaceTileClass} onClick={() => onOpen(workspace.id)}>
                <WorkspaceAvatar name={workspace.name} />
                <strong>{workspace.name}</strong>
                <small className="text-ink-muted">
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
          <button className={createTileClass} onClick={onCreate}>
            + Create workspace
          </button>
        </div>
      ) : (
        <div className={emptyClass}>
          <p>No workspaces yet.</p>
          <Button variant="primary" onClick={onCreate}>
            Add workspace
          </Button>
        </div>
      )}
    </section>
  );
}
