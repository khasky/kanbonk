import type { Revision } from "../model";
import { SidePanel } from "../ui/Modal";
import { Button } from "../ui/Button";
import { PanelRow, PanelRowNote, PanelRowText } from "../ui/PanelRow";

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
      <p className="text-ink-muted">The last 30 versions of each item are kept.</p>
      {revisions
        .slice()
        .reverse()
        .map((revision) => (
          <PanelRow key={revision.id}>
            <PanelRowText>
              <strong>{revision.snapshot.name}</strong>
              <PanelRowNote>{new Date(revision.createdAt).toLocaleString()}</PanelRowNote>
            </PanelRowText>
            <Button variant="secondary" className="flex-none" onClick={() => onRestore(revision)}>
              Restore
            </Button>
          </PanelRow>
        ))}
    </SidePanel>
  );
}
