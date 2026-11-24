import type { DeviceSync } from "../hooks/useDeviceSync";
import { t } from "../i18n";
import { inboxBoardId } from "../model/inbox";
import type { AppState } from "../model";
import { linkHref, trashHref } from "../lib/router";
import { Icon } from "../ui/Icon";
import { Menu, MenuItem } from "../ui/Menu";
import type { PanelName } from "../lib/uiPreferences";

/** The value the mobile board picker uses for the Planner panel, which is not a board. */
export const plannerViewId = "kanbonk-planner";

/** Touch-sized buttons on phones. */
const phoneButton = "max-phone:min-h-11 max-phone:px-2.5 max-phone:py-2 max-phone:text-[14px]";
const topbarButton = `rounded-[3px] border-0 bg-topbar-button px-3 py-[7px] text-inherit ${phoneButton}`;

/** The sync badge; it stays visible on phones only while changes wait or the device is offline. */
function badgeClass(sync: DeviceSync): string {
  const look = !sync.online
    ? "bg-ink-muted text-white"
    : sync.pendingChanges
      ? "bg-[#7f5f01] text-[#fff7d6]"
      : "bg-[#164b35] text-[#baf3db] max-phone:hidden";
  return `cursor-pointer whitespace-nowrap rounded-[20px] border-0 px-[9px] py-[5px] text-[12px] ${phoneButton} ${look}`;
}

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
    <header className="flex h-[49px] flex-none items-center gap-3 bg-topbar px-3.5 text-surface-sunken max-phone:h-auto max-phone:min-h-[49px] max-phone:flex-wrap max-phone:gap-1.5 max-phone:px-2">
      <a
        className="flex items-center gap-2 text-[18px] tracking-[-0.5px] text-inherit no-underline"
        href={linkHref("/")}
        onClick={(event) => {
          event.preventDefault();
          navigate("/");
        }}
      >
        <img className="block size-[26px] rounded-[22%]" src={`${import.meta.env.BASE_URL}favicon.png`} alt="" />
        <strong className="max-phone:hidden">Kanbonk</strong>
      </a>
      <select
        className="hidden max-phone:order-2 max-phone:block max-phone:h-11 max-phone:min-w-[120px] max-phone:flex-[1_1_calc(50%_-_12px)] max-phone:rounded-sm max-phone:border max-phone:border-[#6b778c] max-phone:bg-[#22272b] max-phone:text-[16px] max-phone:text-white"
        aria-label={t("layout.chooseBoard")}
        value={
          shownPanels.includes("inbox")
            ? inboxBoardId
            : shownPanels.includes("planner")
              ? plannerViewId
              : (boardId ?? "")
        }
        onChange={(event) => onPickBoard(event.target.value)}
      >
        <option value="">{t("layout.boards")}</option>
        <option value={inboxBoardId}>{t("layout.inbox")}</option>
        <option value={plannerViewId}>{t("layout.planner")}</option>
        {state.boards
          .filter((item) => item.id !== inboxBoardId && !item.deletedAt)
          .map((item) => (
            <option key={item.id} value={item.id}>
              {state.workspaces.find((workspace) => workspace.id === item.workspaceId)?.name} / {item.name}
            </option>
          ))}
      </select>
      <button className={`ml-6 max-phone:ml-0 ${topbarButton}`} onClick={onCreate}>
        {t("layout.create")}
      </button>
      <button
        className={topbarButton}
        onClick={onOpenReminders}
        aria-label={t("layout.remindersLabel", { count: reminderCount })}
      >
        {reminderCount ? t("layout.remindersCount", { count: reminderCount }) : t("layout.reminders")}
      </button>
      <AppMenu actions={menu} navigate={navigate} />
      <label className="mx-auto flex h-8 w-[min(480px,40vw)] items-center gap-2 rounded-sm border border-[#6b778c] bg-[#22272b] px-[9px] max-tablet:w-[30vw] max-phone:order-2 max-phone:mx-0 max-phone:h-11 max-phone:w-auto max-phone:min-w-[120px] max-phone:flex-[1_1_calc(50%_-_12px)]">
        <Icon name="search" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className="w-full border-0 bg-transparent text-white outline-none placeholder:text-[#c7d1db] max-phone:min-w-0 max-phone:text-[16px]"
          placeholder={t("layout.search")}
          aria-label={t("layout.searchCards")}
          onKeyDown={(event) => {
            if (event.key === "Escape") onSearch("");
          }}
        />
      </label>
      <a
        className={`rounded-[3px] px-3 py-[7px] whitespace-nowrap no-underline max-[761px]:hidden ${trashActive ? "bg-brand-light text-topbar" : "bg-topbar-button text-surface-sunken hover:bg-brand-light hover:text-topbar"}`}
        href={linkHref(trashHref())}
        onClick={(event) => {
          event.preventDefault();
          navigate(trashHref());
        }}
        aria-label={t("layout.trashLabel", { count: trashCount })}
      >
        {trashCount ? t("layout.trashLinkCount", { count: trashCount }) : t("layout.trashLink")}
      </a>
      <button className={badgeClass(sync)} onClick={menu.onSync} title={t("layout.syncTitle")}>
        {sync.badge}
      </button>
    </header>
  );
}

/** The app's "⋯" menu. */
function AppMenu({ actions, navigate }: { actions: AppMenuActions; navigate: (href: string) => void }) {
  return (
    <Menu
      label={t("layout.appMenu")}
      className="z-30"
      summaryClassName="grid h-8 w-[34px] place-items-center rounded-sm bg-topbar-button text-[22px] leading-none text-white hover:bg-ink-muted group-open/menu:bg-ink-muted max-phone:h-11 max-phone:w-11"
      placement="topbar"
      touchRows
    >
      <MenuItem onClick={actions.onImport}>{t("layout.importTrello")}</MenuItem>
      <MenuItem onClick={actions.onBackup}>{t("layout.backup")}</MenuItem>
      <MenuItem onClick={actions.onSettings}>{t("layout.settings")}</MenuItem>
      <MenuItem onClick={actions.onSync}>{t("layout.sync")}</MenuItem>
      <MenuItem onClick={actions.onAi}>{t("layout.aiAssistant")}</MenuItem>
      <MenuItem onClick={actions.onDedupe}>{t("layout.duplicates")}</MenuItem>
      <MenuItem onClick={() => navigate(trashHref())}>{t("layout.trash")}</MenuItem>
      <MenuItem onClick={actions.onAuthor}>{t("layout.myName")}</MenuItem>
    </Menu>
  );
}
