import { useState } from "react";
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
    <Dialog label="My name" onDismiss={onClose} onSubmit={submitWith(() => onSave(draft))}>
      <h2 className={dialogTitleClass}>My name</h2>
      <p>Your name is stored only on this device and shown on new comments.</p>
      <label className={fieldLabelClass}>
        Name
        <Input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={60} required />
      </label>
      <div className={dialogFooterClass}>
        <Button variant="secondary" size="lg" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!draft.trim()}>
          Save
        </Button>
      </div>
    </Dialog>
  );
}
