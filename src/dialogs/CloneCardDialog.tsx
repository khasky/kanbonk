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
    <Dialog label="Clone card" size="md" role="alertdialog" onDismiss={onCancel}>
      <h2 className={dialogTitleClass}>Clone card “{name}”?</h2>
      <p>The copy “{copyName}” will be added right below it in the same list.</p>
      <div className={`${dialogFooterClass} flex-wrap`}>
        <Button variant="secondary" size="lg" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="primary" autoFocus onClick={onConfirm}>
          Clone
        </Button>
      </div>
    </Dialog>
  );
}
