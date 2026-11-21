import { useState } from "react";
import type { Workspace } from "../model";
import { Dialog, submitWith } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Checkbox, Input, Select } from "../ui/Field";
import { fieldLabelClass, optionLabelClass } from "./dialogLook";

const optionClass = `${optionLabelClass} font-normal`;

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
    <Dialog
      label="Copy board"
      className="grid gap-3.5"
      onDismiss={onClose}
      onSubmit={submitWith(() => {
        if (options.name.trim()) onCopy(options);
      })}
    >
      <h2 className="mx-0 mt-0 mb-1 text-[20px]">Copy board</h2>
      <label className={fieldLabelClass}>
        Title
        <Input
          autoFocus
          value={options.name}
          onChange={(event) => change({ name: event.target.value })}
          required
          maxLength={120}
        />
      </label>
      <label className={fieldLabelClass}>
        Workspace
        <Select value={options.workspaceId} onChange={(event) => change({ workspaceId: event.target.value })}>
          {workspaces.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </label>
      <label className={optionClass}>
        <Checkbox checked={options.keepCards} onChange={(event) => change({ keepCards: event.target.checked })} />
        Keep cards
      </label>
      <label className={optionClass}>
        <Checkbox
          checked={options.keepTemplates}
          onChange={(event) => change({ keepTemplates: event.target.checked })}
        />
        Keep card templates
      </label>
      <p className="m-0 text-[13px] text-ink-muted">Comments, members and cards in the trash are not copied.</p>
      <div className="mt-1 flex justify-end gap-2">
        <Button variant="secondary" size="lg" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" type="submit">
          Create copy
        </Button>
      </div>
    </Dialog>
  );
}
