import type { DeviceSync } from "../hooks/useDeviceSync";
import { inboxBoardId } from "../inbox";
import type { AppState } from "../model";
import { linkHref, trashHref } from "../router";
import { Icon } from "../ui/Icon";
import type { PanelName } from "../uiPreferences";

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
  onClosedBoards: () => void;
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
  closedBoardCount,
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
  closedBoardCount: number;
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
          .filter((item) => item.id !== inboxBoardId && !item.archived)
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
      <AppMenu actions={menu} closedBoardCount={closedBoardCount} navigate={navigate} />
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

/** The "⋯" menu. It closes when focus leaves it, on Escape and after any of its buttons is pressed. */
function AppMenu({
  actions,
  closedBoardCount,
  navigate,
}: {
  actions: AppMenuActions;
  closedBoardCount: number;
  navigate: (href: string) => void;
}) {
  return (
    <details
      className="topbar-more"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label="App menu" title="App menu">
        ⋯
      </summary>
      <div
        className="topbar-more-menu"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button"))
            (event.currentTarget.parentElement as HTMLDetailsElement).open = false;
        }}
      >
        <button onClick={actions.onImport}>Import from Trello</button>
        <button onClick={actions.onBackup}>Backup</button>
        <button onClick={actions.onSettings}>Settings</button>
        <button onClick={actions.onSync}>Sync</button>
        <button onClick={actions.onAi}>AI assistant</button>
        <button onClick={actions.onDedupe}>Duplicates across boards</button>
        <button onClick={() => navigate(trashHref())}>Trash</button>
        <button onClick={actions.onAuthor}>My name</button>
        {closedBoardCount > 0 && <button onClick={actions.onClosedBoards}>Closed boards ({closedBoardCount})</button>}
      </div>
    </details>
  );
}
