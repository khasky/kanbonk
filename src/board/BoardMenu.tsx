import { useRef } from "react";
import { ColorInput } from "../ui/ColorInput";

/** Background presets offered in the board menu; the first one is the default for new boards. */
export const boardColors = ["#147d86", "#0c66e4", "#5e4db2", "#a54800", "#216e4e"];

export type BoardMenuActions = {
  onArchive: () => void;
  onClose: () => void;
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
 * The board's "⋯" menu. It closes when focus leaves it, on Escape and after a button is pressed. The color picker
 * takes focus while it is open, so blur from the color input does not close the menu; committing a color does.
 */
export function BoardMenu({ background, actions }: { background: string; actions: BoardMenuActions }) {
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={menu}
      className="board-more"
      onBlur={(event) => {
        if (
          (event.target as Element).getAttribute("type") !== "color" &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary className="toolbar-button" aria-label="Board menu" title="Board menu">
        ⋯
      </summary>
      <div
        className="board-more-menu"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button"))
            (event.currentTarget.parentElement as HTMLDetailsElement).open = false;
        }}
      >
        <button onClick={actions.onArchive}>Archive</button>
        <button onClick={actions.onClose}>Close board</button>
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
        <label className="background-upload">
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
        <label className="board-color-option">
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
      </div>
    </details>
  );
}
