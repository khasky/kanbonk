import { useRef } from "react";
import { ColorInput } from "../ui/ColorInput";
import { Menu, MenuItem, menuItemClass } from "../ui/Menu";
import { t } from "../i18n";

/** Background presets offered in the board menu; the first one is the default for new boards. */
export const boardColors = ["#147d86", "#0c66e4", "#5e4db2", "#a54800", "#216e4e"];

export type BoardMenuActions = {
  onCopy: () => void;
  onAutomation: () => void;
  onActivity: () => void;
  onAnalytics: () => void;
  onPriorities: () => void;
  onShareLabels: () => void;
  onRequiredFields: () => void;
  onSettings: () => void;
  onHistory: () => void;
  onExport: () => void;
  onTrash: () => void;
  onBackgroundFile: (file: File | null) => void;
  onBackgroundColor: (color: string) => void;
};

/**
 * The board's "⋯" menu. The color picker takes focus while it is open, so blur from the color input does not close
 * the menu; committing a color does.
 */
export function BoardMenu({ background, actions }: { background: string; actions: BoardMenuActions }) {
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <Menu
      ref={menu}
      label={t("board.boardMenu")}
      className="z-20"
      summaryClassName="flex min-h-8 min-w-10 items-center justify-center gap-1.5 rounded-[3px] border-0 bg-[#ffffff26] px-2 py-1 text-[22px] leading-none text-white group-open/menu:bg-[#ffffff45] hover:bg-[#ffffff45] max-phone:min-h-11 max-phone:min-w-11 max-phone:flex-none"
      keepOpen={(target) => target.getAttribute("type") === "color"}
    >
      <MenuItem onClick={actions.onSettings}>{t("cardAging.settingsTitle")}</MenuItem>
      <MenuItem onClick={actions.onCopy}>{t("board.copyBoard")}</MenuItem>
      <MenuItem onClick={actions.onAutomation}>{t("board.automation")}</MenuItem>
      <MenuItem onClick={actions.onRequiredFields}>{t("required.title")}</MenuItem>
      <MenuItem onClick={actions.onActivity}>{t("board.activity")}</MenuItem>
      <MenuItem onClick={actions.onAnalytics}>{t("views.analytics")}</MenuItem>
      <MenuItem onClick={actions.onPriorities}>{t("priority.overview")}</MenuItem>
      <MenuItem onClick={actions.onShareLabels}>{t("labelSharing.menuItem")}</MenuItem>
      <MenuItem onClick={actions.onHistory}>{t("board.history")}</MenuItem>
      <MenuItem onClick={actions.onExport}>{t("board.exportBoard")}</MenuItem>
      <MenuItem onClick={actions.onTrash}>{t("board.moveBoardToTrash")}</MenuItem>
      <label
        className={`${menuItemClass} relative has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-brand`}
      >
        {t("board.backgroundFromFile")}
        <input
          type="file"
          className="sr-only"
          accept="image/*"
          onChange={(event) => {
            actions.onBackgroundFile(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
      </label>
      <label className="mt-[3px] grid w-full cursor-default gap-1.5 rounded-none border-x-0 border-b-0 border-t border-line bg-transparent p-2.5 text-left text-inherit">
        {t("board.backgroundColor")}
        <ColorInput
          value={/^#[\da-f]{6}$/i.test(background) ? background : "#0c66e4"}
          presets={boardColors}
          label={t("board.boardBackgroundColor")}
          onCommit={(color) => {
            actions.onBackgroundColor(color);
            if (menu.current) menu.current.open = false;
          }}
        />
      </label>
    </Menu>
  );
}
