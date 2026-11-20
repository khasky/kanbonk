import { Modal } from "../ui/Modal";
import { trashRetentionDays, type TrashImpact, type TrashKind } from "../trash";

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
    <Modal label="Move to trash" className="creation-dialog delete-dialog" role="alertdialog" onDismiss={onCancel}>
      <h2>
        Delete {kindOne[kind]} “{name}”?
      </h2>
      <p>
        It will be moved to the trash{cards > 0 ? ` along with ${cards} ${cards === 1 ? "card" : "cards"}` : ""}. You
        can restore it from the Trash page for {trashRetentionDays} days.
      </p>
      {impact.dependents.length > 0 && (
        <div className="dependency-warning" role="alert">
          <strong>Dependent cards ({impact.dependents.length}):</strong>
          <ul>
            {impact.dependents.slice(0, 8).map(({ dependent, prerequisite }) => (
              <li key={`${dependent.id}-${prerequisite.id}`}>
                “{dependent.name}” depends on “{prerequisite.name}”
              </li>
            ))}
          </ul>
          {impact.dependents.length > 8 && <small>and {impact.dependents.length - 8} more</small>}
        </div>
      )}
      <div>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        {impact.dependents.length > 0 && (
          <button type="button" onClick={() => onConfirm(true)}>
            Delete with dependents
          </button>
        )}
        <button type="button" className="primary-button danger" autoFocus onClick={() => onConfirm(false)}>
          {impact.dependents.length ? "Delete, keep dependents" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}
