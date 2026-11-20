import { useState } from "react";
import { Modal, submitWith } from "../ui/Modal";

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
    <Modal label="My name" className="creation-dialog" onDismiss={onClose} onSubmit={submitWith(() => onSave(draft))}>
      <h2>My name</h2>
      <p>Your name is stored only on this device and shown on new comments.</p>
      <label>
        Name
        <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={60} required />
      </label>
      <div>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="primary-button" disabled={!draft.trim()}>
          Save
        </button>
      </div>
    </Modal>
  );
}
