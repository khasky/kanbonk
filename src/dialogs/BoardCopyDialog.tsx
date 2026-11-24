import { useState } from "react";
import { t } from "../i18n";
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
      label={t("dialogs.copyBoardTitle")}
      className="grid gap-3.5"
      onDismiss={onClose}
      onSubmit={submitWith(() => {
        if (options.name.trim()) onCopy(options);
      })}
    >
      <h2 className="mx-0 mt-0 mb-1 text-[20px]">{t("dialogs.copyBoardTitle")}</h2>
      <label className={fieldLabelClass}>
        {t("dialogs.titleField")}
        <Input
          autoFocus
          value={options.name}
          onChange={(event) => change({ name: event.target.value })}
          required
          maxLength={120}
        />
      </label>
      <label className={fieldLabelClass}>
        {t("dialogs.workspaceField")}
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
        {t("dialogs.keepCards")}
      </label>
      <label className={optionClass}>
        <Checkbox
          checked={options.keepTemplates}
          onChange={(event) => change({ keepTemplates: event.target.checked })}
        />
        {t("dialogs.keepTemplates")}
      </label>
      <p className="m-0 text-[13px] text-ink-muted">{t("dialogs.copyBoardNote")}</p>
      <div className="mt-1 flex justify-end gap-2">
        <Button variant="secondary" size="lg" type="button" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" type="submit">
          {t("dialogs.createCopy")}
        </Button>
      </div>
    </Dialog>
  );
}
