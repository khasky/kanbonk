import { useState } from "react";
import { t } from "../i18n";
import { inboxBoardId, inboxWorkspaceId } from "../model/inbox";
import type { AppState } from "../model";
import { trashHref } from "../lib/router";
import { Icon, type IconName } from "../ui/Icon";
import { WorkspaceAvatar } from "../ui/WorkspaceAvatar";
import type { PanelName } from "../lib/uiPreferences";

const collapsedKey = "kanbonk-sidebar-collapsed";

const plainButton = "border-0 bg-transparent text-inherit hover:bg-brand-soft";
const smallButton = `grid place-items-center p-1 ${plainButton}`;
const boardLook =
  "flex w-full items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap rounded-sm border-0 py-[7px] pr-[9px] pl-[42px] text-left text-inherit hover:bg-brand-soft";

/** A top link: its icon sits in the same 24px column as the workspace avatars; collapsed, only the icon shows. */
function NavLink({
  icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-sm border-0 p-1.5 text-left font-bold text-brand hover:bg-brand-soft ${active ? "bg-brand-soft" : "bg-transparent"} ${collapsed ? "justify-center" : ""}`}
      onClick={onClick}
      aria-label={label}
      title={collapsed ? label : undefined}
    >
      <span className="grid size-6 flex-none place-items-center">
        <Icon name={icon} className="size-5" />
      </span>
      {!collapsed && label}
    </button>
  );
}

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
        aria-label={collapsed ? t("layout.expandSidebar") : t("layout.collapseSidebar")}
        aria-expanded={!collapsed}
        title={collapsed ? t("layout.expandSidebar") : t("layout.collapseSidebar")}
      >
        {collapsed ? "»" : "«"}
      </button>
      <NavLink
        icon="inbox"
        label={t("layout.inbox")}
        active={shownPanels.includes("inbox")}
        collapsed={collapsed}
        onClick={() => onTogglePanel("inbox")}
      />
      <NavLink
        icon="calendar"
        label={t("layout.planner")}
        active={shownPanels.includes("planner")}
        collapsed={collapsed}
        onClick={() => onTogglePanel("planner")}
      />
      <NavLink
        icon="grid"
        label={t("layout.workspaces")}
        active={page === "home"}
        collapsed={collapsed}
        onClick={() => navigate("/")}
      />
      <NavLink
        icon="trash"
        label={t("layout.trash")}
        active={page === "trash"}
        collapsed={collapsed}
        onClick={() => navigate(trashHref())}
      />
      {collapsed && <hr className="mx-1.5 my-2 border-0 border-t border-line" />}
      <div
        className={
          collapsed
            ? "hidden"
            : "m-[24px_6px_14px] flex items-center justify-between text-[12px] font-bold text-ink-subtle uppercase"
        }
      >
        {t("layout.workspaces")}
        <button className={smallButton} onClick={onCreateWorkspace} aria-label={t("layout.createWorkspace")}>
          <Icon name="plus" />
        </button>
      </div>
      {state.workspaces
        .filter((item) => item.id !== inboxWorkspaceId && !item.deletedAt)
        .map((workspace) => (
          <div className={collapsed ? undefined : "mb-3"} key={workspace.id}>
            <div className={`flex items-center gap-2 p-1.5 ${collapsed ? "justify-center" : ""}`}>
              <WorkspaceAvatar name={workspace.name} />
              <button
                className={
                  collapsed
                    ? "hidden"
                    : `min-w-0 flex-1 truncate rounded-sm border-0 bg-transparent p-1 text-left font-bold hover:bg-brand-soft hover:text-brand ${workspace.id === workspaceId ? "text-brand" : "text-inherit"}`
                }
                onClick={() => navigate(`/w/${workspace.id}`)}
              >
                {workspace.name}
              </button>
              <button
                className={collapsed ? "hidden" : smallButton}
                onClick={() => onCreateBoard(workspace.id)}
                aria-label={t("layout.addBoardTo", { name: workspace.name })}
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
