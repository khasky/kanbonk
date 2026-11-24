import { formatDateTime, t } from "../i18n";
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
    <SidePanel title={t("panels.versionHistory")} onClose={onClose}>
      <p className="text-ink-muted">{t("panels.versionsKept")}</p>
      {revisions
        .slice()
        .reverse()
        .map((revision) => (
          <PanelRow key={revision.id}>
            <PanelRowText>
              <strong>{revision.snapshot.name}</strong>
              <PanelRowNote>{formatDateTime(revision.createdAt)}</PanelRowNote>
            </PanelRowText>
            <Button variant="secondary" className="flex-none" onClick={() => onRestore(revision)}>
              {t("common.restore")}
            </Button>
          </PanelRow>
        ))}
    </SidePanel>
  );
}
