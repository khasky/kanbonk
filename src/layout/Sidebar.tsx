import { inboxBoardId, inboxWorkspaceId } from "../inbox";
import type { AppState } from "../model";
import { trashHref } from "../router";
import { Icon } from "../ui/Icon";
import type { PanelName } from "../uiPreferences";

/** Links to Inbox, Planner, Workspaces and Trash, then every workspace with its boards. */
export function Sidebar({
  state,
  shownPanels,
  page,
  workspaceId,
  boardId,
  onTogglePanel,
  onCreateWorkspace,
  onCreateBoard,
  onOpenBoard,
  navigate,
}: {
  state: AppState;
  shownPanels: PanelName[];
  /** The kind of page in the main area, such as "home" or "trash". */
  page: string;
  /** The workspace whose page is open, if any. */
  workspaceId: string | null;
  boardId: string | null;
  onTogglePanel: (panel: PanelName) => void;
  onCreateWorkspace: () => void;
  onCreateBoard: (workspaceId: string) => void;
  onOpenBoard: (boardId: string) => void;
  navigate: (href: string) => void;
}) {
  const linkClass = (active: boolean) => (active ? "sidebar-link active" : "sidebar-link");
  return (
    <aside className="sidebar">
      <button className={linkClass(shownPanels.includes("inbox"))} onClick={() => onTogglePanel("inbox")}>
        ☰ <span>Inbox</span>
      </button>
      <button className={linkClass(shownPanels.includes("planner"))} onClick={() => onTogglePanel("planner")}>
        ▦ <span>Planner</span>
      </button>
      <button className={linkClass(page === "home")} onClick={() => navigate("/")}>
        ▦ <span>Workspaces</span>
      </button>
      <button className={linkClass(page === "trash")} onClick={() => navigate(trashHref())}>
        🗑 <span>Trash</span>
      </button>
      <div className="sidebar-heading">
        Workspaces
        <button onClick={onCreateWorkspace} aria-label="Create workspace">
          <Icon name="plus" />
        </button>
      </div>
      {state.workspaces
        .filter((item) => item.id !== inboxWorkspaceId && !item.archived)
        .map((workspace) => (
          <div className="workspace-group" key={workspace.id}>
            <div className="workspace-name">
              <span className="workspace-avatar">{workspace.name.slice(0, 1).toUpperCase()}</span>
              <button
                className={`workspace-link ${workspace.id === workspaceId ? "selected" : ""}`}
                onClick={() => navigate(`/w/${workspace.id}`)}
              >
                {workspace.name}
              </button>
              <button onClick={() => onCreateBoard(workspace.id)} aria-label={`Add board to ${workspace.name}`}>
                <Icon name="plus" />
              </button>
            </div>
            {state.boards
              .filter((item) => item.workspaceId === workspace.id && item.id !== inboxBoardId && !item.archived)
              .map((item) => (
                <button
                  key={item.id}
                  className={`board-link ${item.id === boardId ? "selected" : ""}`}
                  onClick={() => onOpenBoard(item.id)}
                >
                  <span className="board-mini" style={{ background: item.background }} />
                  {item.name}
                  {item.starred && <Icon name="star" />}
                </button>
              ))}
          </div>
        ))}
    </aside>
  );
}
