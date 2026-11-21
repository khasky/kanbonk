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
    <SidePanel title="Reminders" closeLabel="Close reminders" onClose={onClose}>
      {reminders.length ? (
        reminders.map((item) => (
          <PanelRow key={item.id}>
            <button
              className="flex-1 whitespace-normal rounded-sm border-0 bg-transparent px-[9px] py-1.5 text-left text-ink hover:bg-brand-soft"
              onClick={() => onOpen(item)}
            >
              {item.name}
              <PanelRowNote>{new Date(item.dueAt!).toLocaleString("en-US")}</PanelRowNote>
            </button>
            <Button
              variant="secondary"
              className="flex-none"
              onClick={() => onDismiss(item)}
              aria-label={`Dismiss reminder ${item.name}`}
            >
              Dismiss
            </Button>
          </PanelRow>
        ))
      ) : (
        <p className="text-ink-muted">No new reminders.</p>
      )}
    </SidePanel>
  );
}
