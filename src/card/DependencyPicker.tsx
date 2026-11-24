import { useMemo } from "react";
import { CardPicker } from "../ui/CardPicker";
import { type AppState, type Card, isCardAvailable } from "../model";
import { t } from "../i18n";
import { pickerBoxClass } from "./cardLook";

/** Picks a card that this card depends on. */
export function DependencyPicker({
  card,
  state,
  onAddDependency,
  onClose,
}: {
  card: Card;
  state: AppState;
  onAddDependency: (targetId: string) => void;
  onClose: () => void;
}) {
  const availableDependencies = useMemo(
    () => state.cards.filter((item) => item.id !== card.id && isCardAvailable(state, item)),
    [state, card.id],
  );
  return (
    <section className={pickerBoxClass} aria-label={t("card.addDependency")}>
      <CardPicker
        label={t("card.dependencyCard")}
        candidates={availableDependencies}
        describe={(item) => `${state.boards.find((board) => board.id === item.boardId)?.name ?? ""} / ${item.name}`}
        onPick={(item) => {
          onAddDependency(item.id);
          onClose();
        }}
      />
    </section>
  );
}
