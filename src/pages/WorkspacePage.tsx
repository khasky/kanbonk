import { MissingPage } from "./MissingPage";
import type { AppState } from "../model";
import { inboxWorkspaceId } from "../model/inbox";
import { Button } from "../ui/Button";
import { WorkspaceAvatar } from "../ui/WorkspaceAvatar";
import {
  boardTileClass,
  createTileClass,
  emptyClass,
  pageClass,
  pageHeaderClass,
  pageHeadingClass,
  tileGridClass,
} from "./pageLook";

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
    <section className={pageClass} aria-label={workspace.name}>
      <header className={pageHeaderClass}>
        <WorkspaceAvatar name={workspace.name} size="lg" />
        <input
          className="flex-1 rounded-sm border border-transparent px-2 py-1.5 text-[22px] font-bold text-ink hover:border-ink-faint focus:border-ink-faint"
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
          <Button variant="danger" onClick={onDelete}>
            Move to trash
          </Button>
        )}
      </header>
      <h2 className={pageHeadingClass}>Boards</h2>
      {boards.length ? (
        <div className={tileGridClass}>
          {boards.map((board) => (
            <button
              key={board.id}
              className={boardTileClass}
              style={{ background: board.background }}
              onClick={() => onOpenBoard(board.id)}
            >
              <strong>{board.name}</strong>
              {board.starred && <span aria-label="Starred">★</span>}
            </button>
          ))}
          <button className={createTileClass} onClick={onCreateBoard}>
            + Create board
          </button>
        </div>
      ) : (
        <div className={emptyClass}>
          <p>This workspace has no boards yet.</p>
          <Button variant="primary" onClick={onCreateBoard}>
            Add board
          </Button>
        </div>
      )}
    </section>
  );
}
