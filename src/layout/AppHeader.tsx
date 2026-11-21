import type { DeviceSync } from "../hooks/useDeviceSync";
import { inboxBoardId } from "../model/inbox";
import type { AppState } from "../model";
import { linkHref, trashHref } from "../lib/router";
import { Icon } from "../ui/Icon";
import { Menu } from "../ui/Menu";
import type { PanelName } from "../lib/uiPreferences";

/** The value the mobile board picker uses for the Planner panel, which is not a board. */
export const plannerViewId = "kanbonk-planner";

export type AppMenuActions = {
  onImport: () => void;
  onBackup: () => void;
  onSettings: () => void;
  onSync: () => void;
  onAi: () => void;
  onDedupe: () => void;
  onAuthor: () => void;
};

export function AppHeader({
  state,
  boardId,
  shownPanels,
  onPickBoard,
  onCreate,
  reminderCount,
  onOpenReminders,
  menu,
  search,
  onSearch,
  trashActive,
  trashCount,
  sync,
  navigate,
}: {
  state: AppState;
  boardId: string | null;
  shownPanels: PanelName[];
  /** Called with a board id, `inboxBoardId`, `plannerViewId` or "" for the home page. */
  onPickBoard: (value: string) => void;
  onCreate: () => void;
  reminderCount: number;
  onOpenReminders: () => void;
  menu: AppMenuActions;
  search: string;
  onSearch: (search: string) => void;
  trashActive: boolean;
  trashCount: number;
  sync: DeviceSync;
  navigate: (href: string) => void;
}) {
  return (
    <header className="topbar">
      <a
        className="brand"
        href={linkHref("/")}
        onClick={(event) => {
          event.preventDefault();
          navigate("/");
        }}
      >
        <img className="brand-mark" src={`${import.meta.env.BASE_URL}favicon.png`} alt="" />
        <strong>Kanbonk</strong>
      </a>
      <select
        className="mobile-board-picker"
        aria-label="Choose board"
        value={
          shownPanels.includes("inbox")
            ? inboxBoardId
            : shownPanels.includes("planner")
              ? plannerViewId
              : (boardId ?? "")
        }
        onChange={(event) => onPickBoard(event.target.value)}
      >
        <option value="">Boards</option>
        <option value={inboxBoardId}>Inbox</option>
        <option value={plannerViewId}>Planner</option>
        {state.boards
          .filter((item) => item.id !== inboxBoardId && !item.deletedAt)
          .map((item) => (
            <option key={item.id} value={item.id}>
              {state.workspaces.find((workspace) => workspace.id === item.workspaceId)?.name} / {item.name}
            </option>
          ))}
      </select>
      <button className="topbar-create" onClick={onCreate}>
        Create
      </button>
      <button onClick={onOpenReminders} aria-label={`Reminders: ${reminderCount}`}>
        Reminders{reminderCount ? ` (${reminderCount})` : ""}
      </button>
      <AppMenu actions={menu} navigate={navigate} />
      <label className="global-search">
        <Icon name="search" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search"
          aria-label="Search cards"
          onKeyDown={(event) => {
            if (event.key === "Escape") onSearch("");
          }}
        />
      </label>
      <a
        className={`topbar-trash ${trashActive ? "active" : ""}`}
        href={linkHref(trashHref())}
        onClick={(event) => {
          event.preventDefault();
          navigate(trashHref());
        }}
        aria-label={`Trash: ${trashCount}`}
      >
        🗑 Trash{trashCount ? ` (${trashCount})` : ""}
      </a>
      <button
        className={`local-badge ${sync.pendingChanges ? "pending" : ""} ${sync.online ? "" : "offline"}`}
        onClick={menu.onSync}
        title="Sync with trusted devices"
      >
        {sync.badge}
      </button>
    </header>
  );
}

/** The app's "⋯" menu. */
function AppMenu({ actions, navigate }: { actions: AppMenuActions; navigate: (href: string) => void }) {
  return (
    <Menu label="App menu" className="topbar-more">
      <button onClick={actions.onImport}>Import from Trello</button>
      <button onClick={actions.onBackup}>Backup</button>
      <button onClick={actions.onSettings}>Settings</button>
      <button onClick={actions.onSync}>Sync</button>
      <button onClick={actions.onAi}>AI assistant</button>
      <button onClick={actions.onDedupe}>Duplicates across boards</button>
      <button onClick={() => navigate(trashHref())}>Trash</button>
      <button onClick={actions.onAuthor}>My name</button>
    </Menu>
  );
}
