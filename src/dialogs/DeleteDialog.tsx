import { Dialog } from "../ui/Modal";
import { trashRetentionDays, type TrashImpact, type TrashKind } from "../model/trash";
import { Button } from "../ui/Button";
import { dialogFooterClass, dialogTitleClass } from "./dialogLook";

const kindOne: Record<TrashKind, string> = { workspace: "workspace", board: "board", list: "list", card: "card" };

export function DeleteDialog({
  kind,
  name,
  impact,
  onConfirm,
  onCancel,
}: {
  kind: TrashKind;
  name: string;
  impact: TrashImpact;
  onConfirm: (withDependents: boolean) => void;
  onCancel: () => void;
}) {
  const cards = impact.cardIds.length - (kind === "card" ? 1 : 0);
  return (
    <Dialog label="Move to trash" size="md" role="alertdialog" onDismiss={onCancel}>
      <h2 className={dialogTitleClass}>
        Delete {kindOne[kind]} “{name}”?
      </h2>
      <p>
        It will be moved to the trash{cards > 0 ? ` along with ${cards} ${cards === 1 ? "card" : "cards"}` : ""}. You
        can restore it from the Trash page for {trashRetentionDays} days.
      </p>
      {impact.dependents.length > 0 && (
        <div className="mt-2.5 rounded-md border border-warning bg-[#fff7d6] px-3 py-2.5" role="alert">
          <strong>Dependent cards ({impact.dependents.length}):</strong>
          <ul className="mx-0 mt-1.5 mb-0 pl-[18px]">
            {impact.dependents.slice(0, 8).map(({ dependent, prerequisite }) => (
              <li key={`${dependent.id}-${prerequisite.id}`}>
                “{dependent.name}” depends on “{prerequisite.name}”
              </li>
            ))}
          </ul>
          {impact.dependents.length > 8 && <small>and {impact.dependents.length - 8} more</small>}
        </div>
      )}
      <div className={`${dialogFooterClass} flex-wrap`}>
        <Button variant="secondary" size="lg" type="button" onClick={onCancel}>
          Cancel
        </Button>
        {impact.dependents.length > 0 && (
          <Button type="button" variant="danger" size="lg" onClick={() => onConfirm(true)}>
            Delete with dependents
          </Button>
        )}
        <Button type="button" variant="primary-danger" autoFocus onClick={() => onConfirm(false)}>
          {impact.dependents.length ? "Delete, keep dependents" : "Delete"}
        </Button>
      </div>
    </Dialog>
  );
}
