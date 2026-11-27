import { t } from "../i18n";
import { type AppState, type Card, isCardAvailable, priorities } from "../model";
import { PriorityChip, priorityName } from "../card/PriorityPicker";
import { dialogListClass } from "../dialogs/dialogLook";
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
          const title = priority ? undefined : t("priority.none");
          return (
            <section
              key={priority ?? "none"}
              className="mb-2 grid gap-1"
              aria-label={priority ? priorityName(priority) : title}
            >
              <h3 className="m-0 flex items-center gap-2 text-[14px]">
                {priority ? <PriorityChip priority={priority} className="px-2 py-0.5 text-[12px]" /> : title}
                <span className="font-normal text-ink-subtle">{group.length}</span>
              </h3>
              {group.length ? (
                <ul className="m-0 grid list-none gap-0.5 p-0">
                  {group.map((card) => (
                    <li key={card.id}>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-baseline gap-2 rounded-sm border-0 bg-transparent px-1 py-1 text-left text-ink hover:bg-surface-sunken"
                        onClick={() => onOpenCard(card)}
                      >
                        <span className="min-w-0 flex-1 truncate">{card.name}</span>
                        <span className="flex-none text-[12px] text-ink-subtle">{lists.get(card.listId)?.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-[13px] text-ink-subtle">{t("priority.noCards")}</p>
              )}
            </section>
          );
        })}
      </div>
    </SidePanel>
  );
}
