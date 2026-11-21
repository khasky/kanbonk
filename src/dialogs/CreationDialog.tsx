import { useState } from "react";
import { Dialog, submitWith } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { dialogFooterClass, dialogTitleClass, fieldLabelClass } from "./dialogLook";

/** Asks for the title of a new workspace or board. */
export function CreationDialog({
  kind,
  onCreate,
  onClose,
}: {
  kind: "workspace" | "board";
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const title = kind === "board" ? "Create board" : "Create workspace";
  return (
    <Dialog
      label={title}
      onDismiss={onClose}
      onSubmit={submitWith(() => {
        if (name.trim()) onCreate(name.trim());
      })}
    >
      <h2 className={dialogTitleClass}>{title}</h2>
      <label className={fieldLabelClass}>
        Title
        <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
      </label>
      <div className={dialogFooterClass}>
        <Button variant="secondary" size="lg" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" type="submit">
          Create
        </Button>
      </div>
    </Dialog>
  );
}
