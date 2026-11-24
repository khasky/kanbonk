import { useState } from "react";
import { t } from "../i18n";
import type { Board } from "../model";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Field";
import { SidePanel } from "../ui/Modal";

export function BoardAboutPanel({
  board,
  onSave,
  onClose,
}: {
  board: Board;
  onSave: (description: string) => void;
  onClose: () => void;
}) {
  const [description, setDescription] = useState(board.description);
  return (
    <SidePanel
      title={t("panels.aboutBoard")}
      label={t("panels.boardDescription")}
      closeLabel={t("panels.closeBoardDescription")}
      onClose={onClose}
    >
      <p className="text-ink-muted">{board.name}</p>
      <label className="grid gap-2 font-bold">
        {t("panels.description")}
        <Textarea
          className="min-h-[220px] w-full"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("panels.descriptionPlaceholder")}
        />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="lg" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={() => onSave(description)} disabled={description === board.description}>
          {t("common.save")}
        </Button>
      </div>
    </SidePanel>
  );
}
