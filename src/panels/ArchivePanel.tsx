import type { BoardList, Card } from "../model";
import { SidePanel } from "../ui/Modal";

/** Archived cards and lists of a board. */
export function ArchivePanel({
  cards,
  lists,
  onRestoreCard,
  onRestoreList,
  onClose,
}: {
  cards: Card[];
  lists: BoardList[];
  onRestoreCard: (cardId: string) => void;
  onRestoreList: (listId: string) => void;
  onClose: () => void;
}) {
  return (
    <SidePanel title="Archive" onClose={onClose}>
      {cards.map((item) => (
        <div className="panel-row" key={item.id}>
          {item.name}
          <button onClick={() => onRestoreCard(item.id)}>Restore</button>
        </div>
      ))}
      {lists.map((item) => (
        <div className="panel-row" key={item.id}>
          {item.name}
          <button onClick={() => onRestoreList(item.id)}>Restore</button>
        </div>
      ))}
    </SidePanel>
  );
}
