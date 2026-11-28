import { useRef, useState } from "react";
import type { Fill } from "../model";
import { FillPicker } from "../ui/FillPicker";
import { Menu, MenuItem } from "../ui/Menu";
import { Popover } from "../ui/Popover";
import { t } from "../i18n";

/** The background of a new board. */
export const defaultBoardBackground = "#147d86";

export type BoardMenuActions = {
  onCopy: () => void;
  onAutomation: () => void;
  onActivity: () => void;
  onAnalytics: () => void;
  onPriorities: () => void;
  onApprovals: () => void;
  onDuplicates: () => void;
  onShareLabels: () => void;
  onCleanLabels: () => void;
  onRequiredFields: () => void;
  onSettings: () => void;
  onHistory: () => void;
  onExport: () => void;
  onTrash: () => void;
  onBackgroundFile: (file: File) => void;
  onBackground: (fill: Fill) => void;
};

/** The board's "⋯" menu; "Change background" opens the background picker under the menu's button. */
export function BoardMenu({ background, actions }: { background: Fill; actions: BoardMenuActions }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Menu
        ref={menu}
        label={t("board.boardMenu")}
        className="z-20"
        summaryClassName="flex min-h-8 min-w-10 items-center justify-center gap-1.5 rounded-[3px] border-0 bg-[#ffffff26] px-2 py-1 text-[22px] leading-none text-white group-open/menu:bg-[#ffffff45] hover:bg-[#ffffff45] max-phone:min-h-11 max-phone:min-w-11 max-phone:flex-none"
      >
        <MenuItem onClick={actions.onSettings}>{t("cardAging.settingsTitle")}</MenuItem>
        <MenuItem onClick={actions.onCopy}>{t("board.copyBoard")}</MenuItem>
        <MenuItem onClick={actions.onAutomation}>{t("board.automation")}</MenuItem>
        <MenuItem onClick={actions.onRequiredFields}>{t("required.title")}</MenuItem>
        <MenuItem onClick={actions.onActivity}>{t("board.activity")}</MenuItem>
        <MenuItem onClick={actions.onAnalytics}>{t("views.analytics")}</MenuItem>
        <MenuItem onClick={actions.onPriorities}>{t("priority.overview")}</MenuItem>
        <MenuItem onClick={actions.onApprovals}>{t("approvals.panel")}</MenuItem>
        <MenuItem onClick={actions.onDuplicates}>{t("duplicates.menuItem")}</MenuItem>
        <MenuItem onClick={actions.onShareLabels}>{t("labelSharing.menuItem")}</MenuItem>
        <MenuItem onClick={actions.onCleanLabels}>{t("labelCleanup.title")}</MenuItem>
        <MenuItem onClick={actions.onHistory}>{t("board.history")}</MenuItem>
        <MenuItem onClick={actions.onExport}>{t("board.exportBoard")}</MenuItem>
        <MenuItem onClick={actions.onTrash}>{t("board.moveBoardToTrash")}</MenuItem>
        <MenuItem onClick={() => setPickerAnchor(menu.current?.querySelector("summary") ?? null)}>
          {t("board.changeBackground")}
        </MenuItem>
      </Menu>
      {pickerAnchor && (
        <Popover title={t("board.background")} anchor={pickerAnchor} onClose={() => setPickerAnchor(null)}>
          <FillPicker value={background} onChange={actions.onBackground} onUpload={actions.onBackgroundFile} />
        </Popover>
      )}
    </>
  );
}
