import { formatDateTime, t } from "../i18n";
import type { Revision } from "../model";
import { SidePanel } from "../ui/Modal";
import { Button } from "../ui/Button";
import { PanelRow, PanelRowNote, PanelRowText } from "../ui/PanelRow";
import { revisionChanges, revisionSize } from "./revisionChanges";

/** Earlier versions of one item, newest first, each with what changed from the version before it. */
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
        .map((revision, index) => ({
          revision,
          changes: revisionChanges(revisions[index - 1]?.snapshot, revision.snapshot),
        }))
        .reverse()
        .map(({ revision, changes }) => (
          <PanelRow key={revision.id}>
            <PanelRowText className="grid gap-0.5">
              <strong>{revision.snapshot.name}</strong>
              <ul className="m-0 list-none p-0 text-[14px]">
                {changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
              <PanelRowNote>
                {formatDateTime(revision.createdAt)} · {revisionSize(revision.snapshot)}
              </PanelRowNote>
            </PanelRowText>
            <Button variant="secondary" className="flex-none" onClick={() => onRestore(revision)}>
              {t("common.restore")}
            </Button>
          </PanelRow>
        ))}
    </SidePanel>
  );
}
