import type { Revision } from "../model";
import { SidePanel } from "../ui/Modal";

/** Earlier versions of one item, newest first. */
export function HistoryPanel({
  revisions,
  onRestore,
  onClose,
}: {
  revisions: Revision[];
  onRestore: (revision: Revision) => void;
  onClose: () => void;
}) {
  return (
    <SidePanel title="Version history" onClose={onClose}>
      <p>The last 30 versions of each item are kept.</p>
      {revisions
        .slice()
        .reverse()
        .map((revision) => (
          <div className="panel-row" key={revision.id}>
            <span>
              <strong>{revision.snapshot.name}</strong>
              <small>{new Date(revision.createdAt).toLocaleString()}</small>
            </span>
            <button onClick={() => onRestore(revision)}>Restore</button>
          </div>
        ))}
    </SidePanel>
  );
}
