import { useState } from "react";
import { BoardLifetimeField } from "../board/BoardLifetimeField";
import { t } from "../i18n";
import type { Lifetime } from "../model";
import { Dialog, submitWith } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { dialogFooterClass, dialogTitleClass, fieldLabelClass } from "./dialogLook";

/** Asks for the title of a new workspace or board; a board may be made temporary, with the time it lives. */
export function CreationDialog({
  kind,
  onCreate,
  onClose,
}: {
  kind: "workspace" | "board";
  onCreate: (name: string, lifetime?: Lifetime) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [lifetime, setLifetime] = useState<Lifetime>();
  const title = kind === "board" ? t("dialogs.createBoard") : t("dialogs.createWorkspace");
  return (
    <Dialog
      label={title}
      onDismiss={onClose}
      onSubmit={submitWith(() => {
        if (name.trim()) onCreate(name.trim(), lifetime);
      })}
    >
      <h2 className={dialogTitleClass}>{title}</h2>
      <label className={fieldLabelClass}>
        {t("dialogs.titleField")}
        <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
      </label>
      {kind === "board" && <BoardLifetimeField value={lifetime} onChange={setLifetime} />}
      <div className={dialogFooterClass}>
        <Button variant="secondary" size="lg" type="button" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" type="submit">
          {t("dialogs.create")}
        </Button>
      </div>
    </Dialog>
  );
}
