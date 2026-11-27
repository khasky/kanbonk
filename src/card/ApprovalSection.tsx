import { useState } from "react";
import { formatDateTime, t } from "../i18n";
import type { CardActions } from "../hooks/useCardActions";
import { useMyMember } from "../lib/identity";
import { type Card, type Member, waitsOn } from "../model";
import { askConfirm, askText } from "../ui/AskDialog";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Field";
import { Hint } from "../ui/Hint";
import { Icon } from "../ui/Icon";
import { Menu, MenuItem } from "../ui/Menu";
import { Popover } from "../ui/Popover";
import { SectionTitle } from "../ui/SectionTitle";
import { ApprovalChip } from "./ApprovalChip";
import { detailSectionClass, menuButtonClass } from "./cardLook";
import { MemberAvatar } from "./MemberPicker";

/**
 * Picks the card's approvers: board members first, then trusted devices and imported members, which join the board
 * when chosen.
 */
export function ApproverPicker({
  card,
  assignable,
  onChange,
}: {
  card: Card;
  assignable: Member[];
  onChange: (members: Member[]) => void;
}) {
  const chosen = (card.approvals ?? []).map((approval) => approval.memberId);
  return (
    <div className="grid gap-1">
      {assignable.map((member) => (
        <label
          key={member.id}
          className="flex cursor-pointer items-center gap-2.5 rounded-sm px-1.5 py-1 hover:bg-surface-sunken"
        >
          <Checkbox
            checked={chosen.includes(member.id)}
            onChange={() =>
              onChange(
                chosen.includes(member.id)
                  ? assignable.filter((item) => item.id !== member.id && chosen.includes(item.id))
                  : [...chosen.flatMap((id) => assignable.find((item) => item.id === id) ?? []), member],
              )
            }
          />
          <MemberAvatar member={member} />
          {member.name}
        </label>
      ))}
      <Hint className="m-0">{t("approvals.pickerHint")}</Hint>
    </div>
  );
}

/** The card's approvers with their decisions, buttons to approve or decline, and a menu to reset or remove them. */
export function ApprovalSection({
  card,
  boardMembers,
  assignable,
  actions,
}: {
  card: Card;
  boardMembers: Member[];
  assignable: Member[];
  actions: CardActions;
}) {
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
  const me = useMyMember(boardMembers);
  const approvals = card.approvals ?? [];
  const nameOf = (id: string) => boardMembers.find((member) => member.id === id)?.name ?? t("approvals.unknown");
  const decliners = approvals.filter((approval) => approval.decision === "declined");

  async function decline(memberId: string) {
    const comment = await askText({
      title: t("approvals.declineTitle", { name: card.name }),
      label: t("approvals.declineComment"),
      confirm: t("approvals.decline"),
      optional: true,
    });
    if (comment !== undefined) actions.decideCardApproval(card.id, memberId, "declined", comment);
  }

  return (
    <section className={detailSectionClass} aria-label={t("approvals.title")}>
      <SectionTitle>
        <h3 className="m-0 mr-auto -ml-9 flex min-h-8 min-w-0 flex-wrap items-center gap-3 text-[16px] font-semibold">
          <span className="grid size-6 flex-none place-items-center text-ink-subtle">
            <Icon name="check" />
          </span>
          {t("approvals.title")}
          <ApprovalChip card={card} mine={waitsOn(card, me?.id)} className="px-2 py-0.5 text-[12px]" />
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            aria-expanded={Boolean(pickerAnchor)}
            onClick={(event) => setPickerAnchor(pickerAnchor ? null : event.currentTarget)}
          >
            {t("approvals.changeApprovers")}
          </Button>
          <Menu label={t("approvals.actions")} summaryClassName={menuButtonClass}>
            <MenuItem
              disabled={!approvals.some((approval) => approval.decision)}
              onClick={async () => {
                if (await askConfirm({ title: t("approvals.resetTitle"), confirm: t("approvals.reset") }))
                  actions.resetCardApprovals(card.id);
              }}
            >
              {t("approvals.reset")}
            </MenuItem>
            <MenuItem
              danger
              onClick={async () => {
                if (
                  await askConfirm({ title: t("approvals.removeTitle"), confirm: t("approvals.remove"), danger: true })
                )
                  actions.setCardApprovers(card.id, []);
              }}
            >
              {t("approvals.remove")}
            </MenuItem>
          </Menu>
        </div>
      </SectionTitle>
      <ul className="m-0 grid list-none gap-2 p-0">
        {approvals.map((approval) => {
          const name = nameOf(approval.memberId);
          return (
            <li key={approval.memberId} className="flex flex-wrap items-center gap-2.5">
              <MemberAvatar member={{ id: approval.memberId, name }} />
              <span className="grid min-w-0 flex-1">
                <span className="font-semibold wrap-anywhere">
                  {name}
                  {me?.id === approval.memberId && (
                    <span className="font-normal text-ink-subtle"> {t("approvals.you")}</span>
                  )}
                </span>
                {approval.decision && approval.decidedAt && (
                  <Hint as="small">
                    {t(approval.decision === "approved" ? "approvals.approvedAt" : "approvals.declinedAt", {
                      time: formatDateTime(approval.decidedAt),
                    })}
                  </Hint>
                )}
              </span>
              {approval.decision ? (
                <Button
                  variant="link"
                  aria-label={t("approvals.undoOf", { name })}
                  onClick={() => actions.decideCardApproval(card.id, approval.memberId, undefined)}
                >
                  {t("approvals.undo")}
                </Button>
              ) : (
                <span className="flex gap-1.5">
                  <Button
                    variant="primary"
                    size="sm"
                    aria-label={t("approvals.approveAs", { name })}
                    onClick={() => actions.decideCardApproval(card.id, approval.memberId, "approved")}
                  >
                    {t("approvals.approve")}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    aria-label={t("approvals.declineAs", { name })}
                    onClick={() => void decline(approval.memberId)}
                  >
                    {t("approvals.decline")}
                  </Button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {decliners.map((approval) => (
        <p key={approval.memberId} className="mt-3 mb-0 rounded-sm bg-danger-soft px-3 py-2 text-ink" role="note">
          <strong>{t("approvals.declinedBy", { name: nameOf(approval.memberId) })}</strong>
          {approval.comment && ` ${approval.comment}`}
        </p>
      ))}
      {pickerAnchor && (
        <Popover title={t("approvals.approvers")} anchor={pickerAnchor} onClose={() => setPickerAnchor(null)}>
          <ApproverPicker
            card={card}
            assignable={assignable}
            onChange={(members) => actions.setCardApprovers(card.id, members)}
          />
        </Popover>
      )}
    </section>
  );
}
