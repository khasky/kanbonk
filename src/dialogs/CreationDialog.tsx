import { useState } from "react";
import { Modal, submitWith } from "../ui/Modal";

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
    <Modal
      label={title}
      className="creation-dialog"
      onDismiss={onClose}
      onSubmit={submitWith(() => {
        if (name.trim()) onCreate(name.trim());
      })}
    >
      <h2>{title}</h2>
      <label>
        Title
        <input autoFocus value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
      </label>
      <div>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="primary-button" type="submit">
          Create
        </button>
      </div>
    </Modal>
  );
}
