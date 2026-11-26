import { useState } from "react";
import { Dialog } from "../ui/Modal";
import { Checkbox } from "../ui/Field";
import { optionLabelClass } from "./dialogLook";
import { type MessageKey, t } from "../i18n";
import { useTrashRetention } from "../lib/trashRetention";
import { trashRetentionDays, type TrashImpact, type TrashKind } from "../model/trash";
import { Button } from "../ui/Button";
import { dialogFooterClass, dialogTitleClass } from "./dialogLook";

const titles: Record<TrashKind, MessageKey> = {
  workspace: "dialogs.deleteWorkspaceTitle",
  board: "dialogs.deleteBoardTitle",
  list: "dialogs.deleteListTitle",
  card: "dialogs.deleteCardTitle",
};

export function DeleteDialog({
  kind,
  name,
  impact,
  mirrorCount = 0,
  onConfirm,
  onCancel,
}: {
  kind: TrashKind;
  name: string;
  impact: TrashImpact;
  /** The card's other mirrors, offered to delete with it. */
  mirrorCount?: number;
  onConfirm: (withDependents: boolean, withMirrors: boolean) => void;
  onCancel: () => void;
}) {
  const [withMirrors, setWithMirrors] = useState(false);
  const cards = impact.cardIds.length - (kind === "card" ? 1 : 0);
  const days = t("common.days", { count: useTrashRetention() ?? trashRetentionDays });
  return (
    <Dialog label={t("dialogs.moveToTrash")} size="md" role="alertdialog" onDismiss={onCancel}>
      <h2 className={dialogTitleClass}>{t(titles[kind], { name })}</h2>
      <p>
        {cards > 0 ? t("dialogs.deleteMessageWithCards", { count: cards, days }) : t("dialogs.deleteMessage", { days })}
      </p>
      {impact.dependents.length > 0 && (
        <div className="mt-2.5 rounded-md border border-warning bg-[#fff7d6] px-3 py-2.5" role="alert">
          <strong>{t("dialogs.dependentCards", { count: impact.dependents.length })}</strong>
          <ul className="mx-0 mt-1.5 mb-0 pl-[18px]">
            {impact.dependents.slice(0, 8).map(({ dependent, prerequisite }) => (
              <li key={`${dependent.id}-${prerequisite.id}`}>
                {t("dialogs.dependsOn", { dependent: dependent.name, prerequisite: prerequisite.name })}
              </li>
            ))}
          </ul>
          {impact.dependents.length > 8 && (
            <small>{t("dialogs.andMore", { count: impact.dependents.length - 8 })}</small>
          )}
        </div>
      )}
      {mirrorCount > 0 && (
        <label className={`${optionLabelClass} mt-2.5`}>
          <Checkbox checked={withMirrors} onChange={(event) => setWithMirrors(event.target.checked)} />
          {t("mirrors.deleteMirrors", { count: mirrorCount })}
        </label>
      )}
      <div className={`${dialogFooterClass} flex-wrap`}>
        <Button variant="secondary" size="lg" type="button" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        {impact.dependents.length > 0 && (
          <Button type="button" variant="danger" size="lg" onClick={() => onConfirm(true, withMirrors)}>
            {t("dialogs.deleteWithDependents")}
          </Button>
        )}
        <Button type="button" variant="primary-danger" autoFocus onClick={() => onConfirm(false, withMirrors)}>
          {impact.dependents.length ? t("dialogs.deleteKeepDependents") : t("common.delete")}
        </Button>
      </div>
    </Dialog>
  );
}
