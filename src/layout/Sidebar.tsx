import { useState } from "react";
import { inboxBoardId, inboxWorkspaceId } from "../model/inbox";
import type { AppState } from "../model";
import { trashHref } from "../lib/router";
import { Icon } from "../ui/Icon";
import type { PanelName } from "../lib/uiPreferences";

const collapsedKey = "kanbonk-sidebar-collapsed";

/**
 * Links to Inbox, Planner, Workspaces and Trash, then every workspace with its boards. It collapses to a strip of
 * icons; the choice is remembered on this device.
 */
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
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(collapsedKey) === "true");
  const linkClass = (active: boolean) => (active ? "sidebar-link active" : "sidebar-link");
  function toggle() {
    localStorage.setItem(collapsedKey, String(!collapsed));
    setCollapsed(!collapsed);
  }
  return (
    <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
      <button
        className="sidebar-toggle"
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "»" : "«"}
      </button>
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
        .filter((item) => item.id !== inboxWorkspaceId && !item.deletedAt)
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
              .filter((item) => item.workspaceId === workspace.id && item.id !== inboxBoardId && !item.deletedAt)
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
