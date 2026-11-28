import { useState } from "react";
import { BoardLifetimeField } from "../board/BoardLifetimeField";
import { t } from "../i18n";
import type { Lifetime } from "../model";
import { Dialog, submitWith } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { fieldLabelClass } from "./dialogLook";

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
      className="grid gap-3.5"
      onDismiss={onClose}
      onSubmit={submitWith(() => {
        if (name.trim()) onCreate(name.trim(), lifetime);
      })}
    >
      <h2 className="mx-0 mt-0 mb-1 text-[20px]">{title}</h2>
      <label className={fieldLabelClass}>
        {t("dialogs.titleField")}
        <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
      </label>
      {kind === "board" && <BoardLifetimeField value={lifetime} onChange={setLifetime} />}
      <div className="mt-1 flex justify-end gap-2">
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
