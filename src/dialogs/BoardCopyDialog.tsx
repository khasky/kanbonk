import { useState } from "react";
import type { Workspace } from "../model";
import { Modal, submitWith } from "../ui/Modal";

export interface BoardCopyOptions {
  name: string;
  workspaceId: string;
  keepCards: boolean;
  keepTemplates: boolean;
}

export function BoardCopyDialog({
  initial,
  workspaces,
  onCopy,
  onClose,
}: {
  initial: BoardCopyOptions;
  /** Workspaces the copy may go to. */
  workspaces: Workspace[];
  onCopy: (options: BoardCopyOptions) => void;
  onClose: () => void;
}) {
  const [options, setOptions] = useState(initial);
  const change = (patch: Partial<BoardCopyOptions>) => setOptions((current) => ({ ...current, ...patch }));
  return (
    <Modal
      label="Copy board"
      className="creation-dialog board-copy-dialog"
      onDismiss={onClose}
      onSubmit={submitWith(() => {
        if (options.name.trim()) onCopy(options);
      })}
    >
      <h2>Copy board</h2>
      <label>
        Title
        <input
          autoFocus
          value={options.name}
          onChange={(event) => change({ name: event.target.value })}
          required
          maxLength={120}
        />
      </label>
      <label>
        Workspace
        <select value={options.workspaceId} onChange={(event) => change({ workspaceId: event.target.value })}>
          {workspaces.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="copy-option">
        <input
          type="checkbox"
          checked={options.keepCards}
          onChange={(event) => change({ keepCards: event.target.checked })}
        />
        Keep cards
      </label>
      <label className="copy-option">
        <input
          type="checkbox"
          checked={options.keepTemplates}
          onChange={(event) => change({ keepTemplates: event.target.checked })}
        />
        Keep card templates
      </label>
      <p>Comments, members and archived cards are not copied.</p>
      <div>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="primary-button" type="submit">
          Create copy
        </button>
      </div>
    </Modal>
  );
}
