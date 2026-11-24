import { useState } from "react";
import { t } from "../i18n";
import { Dialog, submitWith } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { dialogFooterClass, dialogTitleClass, fieldLabelClass } from "./dialogLook";

/** The name shown on comments made on this device. */
export function AuthorDialog({
  name,
  onSave,
  onClose,
}: {
  name: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(name);
  return (
    <Dialog label={t("dialogs.authorTitle")} onDismiss={onClose} onSubmit={submitWith(() => onSave(draft))}>
      <h2 className={dialogTitleClass}>{t("dialogs.authorTitle")}</h2>
      <p>{t("dialogs.authorIntro")}</p>
      <label className={fieldLabelClass}>
        {t("dialogs.authorName")}
        <Input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={60} required />
      </label>
      <div className={dialogFooterClass}>
        <Button variant="secondary" size="lg" type="button" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" disabled={!draft.trim()}>
          {t("common.save")}
        </Button>
      </div>
    </Dialog>
  );
}
