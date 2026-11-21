import { useRef } from "react";
import { ColorInput } from "../ui/ColorInput";
import { Menu } from "../ui/Menu";

/** Background presets offered in the board menu; the first one is the default for new boards. */
export const boardColors = ["#147d86", "#0c66e4", "#5e4db2", "#a54800", "#216e4e"];

export type BoardMenuActions = {
  onCopy: () => void;
  onAutomation: () => void;
  onActivity: () => void;
  onHistory: () => void;
  onExport: (format: "trello-json" | "csv") => void;
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
      label="Board menu"
      className="board-more"
      summaryClassName="toolbar-button"
      keepOpen={(target) => target.getAttribute("type") === "color"}
    >
      <button onClick={actions.onCopy}>Copy board</button>
      <button onClick={actions.onAutomation}>Automation</button>
      <button onClick={actions.onActivity}>Activity</button>
      <button onClick={actions.onHistory}>History</button>
      <button
        onClick={() => actions.onExport("trello-json")}
        title="Trello JSON export format, without attachment files"
      >
        Export JSON (Trello)
      </button>
      <button onClick={() => actions.onExport("csv")} title="Trello CSV export columns">
        Export CSV (Trello)
      </button>
      <button onClick={actions.onTrash}>Move board to trash</button>
      <label className="menu-item">
        Background from file
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            actions.onBackgroundFile(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
      </label>
      <label className="menu-item board-color-option">
        Background color
        <ColorInput
          value={/^#[\da-f]{6}$/i.test(background) ? background : "#0c66e4"}
          presets={boardColors}
          label="Board background color"
          onCommit={(color) => {
            actions.onBackgroundColor(color);
            if (menu.current) menu.current.open = false;
          }}
        />
      </label>
    </Menu>
  );
}
