import { useState } from "react";
import { inboxBoardId, inboxWorkspaceId } from "../model/inbox";
import type { AppState } from "../model";
import { trashHref } from "../lib/router";
import { Icon } from "../ui/Icon";
import { WorkspaceAvatar } from "../ui/WorkspaceAvatar";
import type { PanelName } from "../lib/uiPreferences";

const collapsedKey = "kanbonk-sidebar-collapsed";

const plainButton = "border-0 bg-transparent text-inherit hover:bg-brand-soft";
const smallButton = `grid place-items-center p-1 ${plainButton}`;
const linkLook =
  "flex w-full gap-3 rounded-sm border-0 px-2.5 py-[9px] text-left font-bold text-brand hover:bg-brand-soft";
const boardLook =
  "flex w-full items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap rounded-sm border-0 py-[7px] pr-[9px] pl-[38px] text-left text-inherit hover:bg-brand-soft";

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
  const linkClass = (active: boolean) => `${linkLook} ${active ? "bg-brand-soft" : "bg-transparent"}`;
  const labelClass = collapsed ? "hidden" : undefined;
  function toggle() {
    localStorage.setItem(collapsedKey, String(!collapsed));
    setCollapsed(!collapsed);
  }
  return (
    <aside
      className={
        collapsed
          ? "sidebar collapsed w-[52px] flex-none overflow-auto border-r border-line bg-surface-soft px-1 py-3.5 max-phone:hidden"
          : "sidebar w-[260px] flex-none overflow-auto border-r border-line bg-surface-soft px-2.5 py-[18px] max-tablet:w-[190px] max-phone:hidden"
      }
    >
      <button
        className={`grid size-7 place-items-center rounded-sm border-0 bg-transparent text-[18px] leading-none text-ink-subtle hover:bg-brand-soft ${collapsed ? "m-[0_auto_8px]" : "m-[-8px_0_6px_auto]"}`}
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "»" : "«"}
      </button>
      <button className={linkClass(shownPanels.includes("inbox"))} onClick={() => onTogglePanel("inbox")}>
        ☰ <span className={labelClass}>Inbox</span>
      </button>
      <button className={linkClass(shownPanels.includes("planner"))} onClick={() => onTogglePanel("planner")}>
        ▦ <span className={labelClass}>Planner</span>
      </button>
      <button className={linkClass(page === "home")} onClick={() => navigate("/")}>
        ▦ <span className={labelClass}>Workspaces</span>
      </button>
      <button className={linkClass(page === "trash")} onClick={() => navigate(trashHref())}>
        🗑 <span className={labelClass}>Trash</span>
      </button>
      <div
        className={
          collapsed
            ? "hidden"
            : "m-[24px_6px_14px] flex items-center justify-between text-[12px] font-bold text-ink-subtle uppercase"
        }
      >
        Workspaces
        <button className={smallButton} onClick={onCreateWorkspace} aria-label="Create workspace">
          <Icon name="plus" />
        </button>
      </div>
      {state.workspaces
        .filter((item) => item.id !== inboxWorkspaceId && !item.deletedAt)
        .map((workspace) => (
          <div className="mb-[18px]" key={workspace.id}>
            <div className={`flex items-center gap-2 px-1.5 py-[5px] ${collapsed ? "justify-center" : ""}`}>
              <WorkspaceAvatar name={workspace.name} />
              <button
                className={
                  collapsed
                    ? "hidden"
                    : `grid flex-1 place-items-center border-0 bg-transparent p-1 text-left font-bold hover:bg-brand-soft hover:text-brand ${workspace.id === workspaceId ? "text-brand" : "text-inherit"}`
                }
                onClick={() => navigate(`/w/${workspace.id}`)}
              >
                {workspace.name}
              </button>
              <button
                className={collapsed ? "hidden" : smallButton}
                onClick={() => onCreateBoard(workspace.id)}
                aria-label={`Add board to ${workspace.name}`}
              >
                <Icon name="plus" />
              </button>
            </div>
            {state.boards
              .filter((item) => item.workspaceId === workspace.id && item.id !== inboxBoardId && !item.deletedAt)
              .map((item) => (
                <button
                  key={item.id}
                  className={
                    collapsed ? "hidden" : `${boardLook} ${item.id === boardId ? "bg-brand-soft" : "bg-transparent"}`
                  }
                  onClick={() => onOpenBoard(item.id)}
                >
                  <span className="h-5 w-6 flex-none rounded-[3px]" style={{ background: item.background }} />
                  {item.name}
                  {item.starred && <Icon name="star" className="ml-auto size-3.5 fill-warning" />}
                </button>
              ))}
          </div>
        ))}
    </aside>
  );
}
