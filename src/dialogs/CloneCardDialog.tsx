import { t } from "../i18n";
import { Dialog } from "../ui/Modal";
import { Button } from "../ui/Button";
import { dialogFooterClass, dialogTitleClass } from "./dialogLook";

export function CloneCardDialog({
  name,
  copyName,
  onConfirm,
  onCancel,
}: {
  name: string;
  copyName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog label={t("dialogs.cloneCardLabel")} size="md" role="alertdialog" onDismiss={onCancel}>
      <h2 className={dialogTitleClass}>{t("dialogs.cloneCardTitle", { name })}</h2>
      <p>{t("dialogs.cloneCardMessage", { name: copyName })}</p>
      <div className={`${dialogFooterClass} flex-wrap`}>
        <Button variant="secondary" size="lg" type="button" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="button" variant="primary" autoFocus onClick={onConfirm}>
          {t("dialogs.clone")}
        </Button>
      </div>
    </Dialog>
  );
}
