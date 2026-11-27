import { t } from "../i18n";
import { useMyMember } from "../lib/identity";
import { type AppState, approvalStatus, type Card, isCardAvailable, waitsOn } from "../model";
import { approvalText } from "../card/ApprovalChip";
import { dialogListClass } from "../dialogs/dialogLook";
import { CardGroup } from "../ui/CardGroup";
import { Hint } from "../ui/Hint";
import { SidePanel } from "../ui/Modal";

/** The board's cards that wait on this device's member, the other pending ones, and the decided ones. */
export function ApprovalsPanel({
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
  const board = state.boards.find((item) => item.id === boardId);
  const me = useMyMember(board?.members);
  const lists = new Map(state.lists.map((list) => [list.id, list]));
  const cards = state.cards
    .filter(
      (card) => card.boardId === boardId && !card.isTemplate && isCardAvailable(state, card) && approvalStatus(card),
    )
    .sort(
      (a, b) => (lists.get(a.listId)?.position ?? 0) - (lists.get(b.listId)?.position ?? 0) || a.position - b.position,
    );
  const mine = cards.filter((card) => waitsOn(card, me?.id));
  const note = (card: Card) =>
    [lists.get(card.listId)?.name, approvalStatus(card) === "pending" && approvalText(card, false)]
      .filter(Boolean)
      .join(" · ");
  return (
    <SidePanel title={t("approvals.panel")} onClose={onClose}>
      <div className={dialogListClass}>
        <Hint className="m-0">{me ? t("approvals.panelHint", { name: me.name }) : t("approvals.panelNoMember")}</Hint>
        <CardGroup
          title={t("approvals.waitingOnYou")}
          cards={mine}
          note={note}
          empty={t("approvals.nothingWaiting")}
          onOpen={onOpenCard}
        />
        <CardGroup
          title={t("approvals.pending")}
          cards={cards.filter((card) => approvalStatus(card) === "pending" && !mine.includes(card))}
          note={note}
          empty={t("approvals.noCards")}
          onOpen={onOpenCard}
        />
        <CardGroup
          title={t("approvals.approved")}
          cards={cards.filter((card) => approvalStatus(card) === "approved")}
          note={note}
          empty={t("approvals.noCards")}
          onOpen={onOpenCard}
        />
        <CardGroup
          title={t("approvals.declined")}
          cards={cards.filter((card) => approvalStatus(card) === "declined")}
          note={note}
          empty={t("approvals.noCards")}
          onOpen={onOpenCard}
        />
      </div>
    </SidePanel>
  );
}
