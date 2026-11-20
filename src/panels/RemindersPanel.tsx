import type { Card } from "../model";
import { SidePanel } from "../ui/Modal";

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
          <div className="panel-row reminder-row" key={item.id}>
            <button onClick={() => onOpen(item)}>
              {item.name}
              <small>{new Date(item.dueAt!).toLocaleString("en-US")}</small>
            </button>
            <button onClick={() => onDismiss(item)} aria-label={`Dismiss reminder ${item.name}`}>
              Dismiss
            </button>
          </div>
        ))
      ) : (
        <p>No new reminders.</p>
      )}
    </SidePanel>
  );
}
