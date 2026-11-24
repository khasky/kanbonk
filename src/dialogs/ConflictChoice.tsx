import { t } from "../i18n";
import { Button } from "../ui/Button";

/** An unresolved conflict in the backup or sync dialog: the two versions of one item to choose from. */
export function ConflictChoice({
  name,
  localLabel,
  remoteLabel,
  onChoose,
}: {
  name: string;
  localLabel: string;
  remoteLabel: string;
  onChoose: (version: "local" | "remote") => void;
}) {
  return (
    <div className="my-3 rounded-sm border border-warning bg-[#fffae6] p-2.5">
      <strong>{t("dialogs.conflictTitle", { name })}</strong>
      <small className="my-[5px] block">{t("dialogs.conflictHint")}</small>
      <div className="flex gap-2">
        <Button variant="secondary" size="lg" onClick={() => onChoose("local")}>
          {localLabel}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => onChoose("remote")}>
          {remoteLabel}
        </Button>
      </div>
    </div>
  );
}
