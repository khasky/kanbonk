import { formatDateTime, t } from "../i18n";
import type { Card } from "../model";
import { SidePanel } from "../ui/Modal";
import { Button } from "../ui/Button";
import { PanelRow, PanelRowNote } from "../ui/PanelRow";

export function RemindersPanel({
  reminders,
  onOpen,
  onDismiss,
  onClose,
}: {
  reminders: Card[];
  onOpen: (card: Card) => void;
  onDismiss: (card: Card) => void;
  onClose: () => void;
}) {
  return (
    <SidePanel title={t("panels.reminders")} closeLabel={t("panels.closeReminders")} onClose={onClose}>
      {reminders.length ? (
        reminders.map((item) => (
          <PanelRow key={item.id}>
            <Button variant="row" className="flex-1" onClick={() => onOpen(item)}>
              <span className="min-w-0 wrap-anywhere">
                {item.name}
                <PanelRowNote>{formatDateTime(item.dueAt!)}</PanelRowNote>
              </span>
            </Button>
            <Button
              variant="secondary"
              className="flex-none"
              onClick={() => onDismiss(item)}
              aria-label={t("panels.dismissReminder", { name: item.name })}
            >
              {t("panels.dismiss")}
            </Button>
          </PanelRow>
        ))
      ) : (
        <p className="text-ink-muted">{t("panels.noReminders")}</p>
      )}
    </SidePanel>
  );
}
