import { t } from "../i18n";
import { type AppState, type Card, isCardAvailable, priorities } from "../model";
import { PriorityChip, priorityName } from "../card/PriorityPicker";
import { dialogListClass } from "../dialogs/dialogLook";
import { CardGroup } from "../ui/CardGroup";
import { Hint } from "../ui/Hint";
import { SidePanel } from "../ui/Modal";

/** The board's cards by priority, from critical to none, each opening its card. */
export function PriorityOverview({
  state,
  boardId,
  onOpenCard,
  onClose,
}: {
  state: AppState;
  boardId: string;
  onOpenCard: (card: Card) => void;
  onClose: () => void;
}) {
  const lists = new Map(state.lists.map((list) => [list.id, list]));
  const cards = state.cards
    .filter((card) => card.boardId === boardId && !card.isTemplate && isCardAvailable(state, card))
    .sort(
      (a, b) => (lists.get(a.listId)?.position ?? 0) - (lists.get(b.listId)?.position ?? 0) || a.position - b.position,
    );
  return (
    <SidePanel title={t("priority.overview")} onClose={onClose}>
      <div className={dialogListClass}>
        <Hint>{t("priority.overviewHint")}</Hint>
        {[...priorities, undefined].map((priority) => {
          const group = cards.filter((card) => card.priority === priority);
          return (
            <CardGroup
              key={priority ?? "none"}
              title={
                priority ? <PriorityChip priority={priority} className="px-2 py-0.5 text-[12px]" /> : t("priority.none")
              }
              label={priority ? priorityName(priority) : t("priority.none")}
              cards={group}
              note={(card) => lists.get(card.listId)?.name}
              empty={t("priority.noCards")}
              onOpen={onOpenCard}
            />
          );
        })}
      </div>
    </SidePanel>
  );
}
