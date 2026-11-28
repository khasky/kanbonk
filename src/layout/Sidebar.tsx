import { useState } from "react";
import { t } from "../i18n";
import { inboxBoardId, inboxWorkspaceId } from "../model/inbox";
import { type AppState, backdropFill, type Board } from "../model";
import { useFillStyle } from "../ui/useFileUrl";
import { boardHref, trashHref } from "../lib/router";
import { AppLink } from "../ui/AppLink";
import { Button, buttonClass } from "../ui/Button";
import { Icon, type IconName } from "../ui/Icon";
import { WorkspaceAvatar } from "../ui/WorkspaceAvatar";
import { TemporaryBadge } from "../board/TemporaryBadge";
import type { PanelName } from "../lib/uiPreferences";

const collapsedKey = "kanbonk-sidebar-collapsed";

const boardLook =
  "flex w-full items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap rounded-sm border-0 py-[7px] pr-[9px] pl-[42px] text-left text-inherit no-underline hover:bg-brand-soft";

/**
 * A top link: its icon sits in the same 24px column as the workspace avatars; collapsed, only the icon shows. With an
 * `href` it is a link to that page, otherwise a button (the Inbox and Planner panels have no address).
 */
function NavLink({
  icon,
  label,
  active,
  collapsed,
  href,
  onClick,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  collapsed: boolean;
  href?: string;
  onClick: () => void;
}) {
  const props = {
    className: buttonClass("nav", undefined, collapsed ? "justify-center" : undefined),
    "aria-label": label,
    title: collapsed ? label : undefined,
    children: (
      <>
        <span className="grid size-6 flex-none place-items-center">
          <Icon name={icon} className="size-5" />
        </span>
        {!collapsed && label}
      </>
    ),
  };
  return href ? (
    <AppLink {...props} href={href} onOpen={onClick} aria-current={active ? "page" : undefined} />
  ) : (
    <Button
      variant="nav"
      {...props}
      className={collapsed ? "justify-center" : undefined}
      aria-pressed={active}
      onClick={onClick}
    />
  );
}

/**
 * Links to Inbox, Planner, Workspaces and Trash, then every workspace with its boards. It collapses to a strip of
 * icons; the choice is remembered on this device.
 */
/** The small square of a board's background in the list of boards. */
function BoardSwatch({ board }: { board: Board }) {
  return (
    <span
      className="h-5 w-6 flex-none rounded-[3px]"
      style={{ background: useFillStyle(backdropFill(board)).background }}
    />
  );
}

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
      <Button
        variant="icon"
        className={`size-7 ${collapsed ? "m-[0_auto_8px]" : "m-[-8px_0_6px_auto]"}`}
        onClick={toggle}
        aria-label={collapsed ? t("layout.expandSidebar") : t("layout.collapseSidebar")}
        title={collapsed ? t("layout.expandSidebar") : t("layout.collapseSidebar")}
      >
        <Icon name={collapsed ? "chevron-right" : "chevron-left"} />
      </Button>
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
        href="/"
        onClick={() => navigate("/")}
      />
      <NavLink
        icon="trash"
        label={t("layout.trash")}
        active={page === "trash"}
        collapsed={collapsed}
        href={trashHref()}
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
        <Button variant="icon" onClick={onCreateWorkspace} aria-label={t("layout.createWorkspace")}>
          <Icon name="plus" />
        </Button>
      </div>
      {state.workspaces
        .filter((item) => item.id !== inboxWorkspaceId && !item.deletedAt)
        .map((workspace) => (
          <div className={collapsed ? undefined : "mb-3"} key={workspace.id}>
            <div className={`flex items-center gap-2 ${collapsed ? "justify-center p-0.5" : "py-[3px] pr-1.5 pl-0.5"}`}>
              <AppLink
                className={`flex min-w-0 items-center gap-3 rounded-sm border-0 bg-transparent p-1 text-left font-bold no-underline hover:bg-brand-soft hover:text-brand ${collapsed ? "" : "flex-1"} ${workspace.id === workspaceId ? "text-brand" : "text-inherit"}`}
                href={`/w/${encodeURIComponent(workspace.id)}`}
                onOpen={() => navigate(`/w/${workspace.id}`)}
                aria-label={workspace.name}
                title={collapsed ? workspace.name : undefined}
              >
                <WorkspaceAvatar workspace={workspace} />
                {!collapsed && <span className="truncate">{workspace.name}</span>}
              </AppLink>
              <Button
                variant="icon"
                className={collapsed ? "hidden" : undefined}
                onClick={() => onCreateBoard(workspace.id)}
                aria-label={t("layout.addBoardTo", { name: workspace.name })}
              >
                <Icon name="plus" />
              </Button>
            </div>
            {state.boards
              .filter((item) => item.workspaceId === workspace.id && item.id !== inboxBoardId && !item.deletedAt)
              .map((item) => (
                <AppLink
                  key={item.id}
                  className={
                    collapsed ? "hidden" : `${boardLook} ${item.id === boardId ? "bg-brand-soft" : "bg-transparent"}`
                  }
                  href={boardHref(item.id)}
                  onOpen={() => onOpenBoard(item.id)}
                >
                  <BoardSwatch board={item} />
                  {item.name}
                  {(item.starred || item.expiresAt) && (
                    <span className="ml-auto flex flex-none items-center gap-1.5">
                      {item.expiresAt && <TemporaryBadge expiresAt={item.expiresAt} compact />}
                      {item.starred && <Icon name="star" className="size-3.5 fill-warning" />}
                    </span>
                  )}
                </AppLink>
              ))}
          </div>
        ))}
    </aside>
  );
}
