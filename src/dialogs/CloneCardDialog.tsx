import { Modal } from "../ui/Modal";

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
    <Modal label="Clone card" className="creation-dialog delete-dialog" role="alertdialog" onDismiss={onCancel}>
      <h2>Clone card “{name}”?</h2>
      <p>The copy “{copyName}” will be added right below it in the same list.</p>
      <div>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="primary-button" autoFocus onClick={onConfirm}>
          Clone
        </button>
      </div>
    </Modal>
  );
}
