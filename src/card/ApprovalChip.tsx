import { t } from "../i18n";
import { type ApprovalStatus, approvalCount, approvalStatus, type Card } from "../model";
import { readableTextColor } from "../model/labelColors";

/** The color of each approval status on tiles, in the card and in the table. */
export const approvalColors: Record<ApprovalStatus | "mine", string> = {
  pending: "#dfd8fd",
  mine: "#6e5dc6",
  approved: "#1f845a",
  declined: "#c9372c",
};

/** The status of a card's approval as words: "Pending (1/2)", "Approved", "Declined" or "Pending your approval". */
export function approvalText(card: Card, mine: boolean): string | undefined {
  const status = approvalStatus(card);
  if (!status) return undefined;
  if (status === "pending") {
    if (mine) return t("approvals.pendingYours");
    const { approved, total } = approvalCount(card);
    return t("approvals.pendingCount", { approved, total });
  }
  return t(status === "approved" ? "approvals.approved" : "approvals.declined");
}

/**
 * A card's approval status as a colored chip; `mine` when it waits on this device's member. Nothing for a card
 * without approvers. `className` may only add layout or size.
 */
export function ApprovalChip({ card, mine, className = "" }: { card: Card; mine: boolean; className?: string }) {
  const status = approvalStatus(card);
  const text = approvalText(card, mine);
  if (!status || !text) return null;
  const color = approvalColors[status === "pending" && mine ? "mine" : status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[3px] font-bold whitespace-nowrap ${className}`}
      style={{ background: color, color: readableTextColor(color) }}
      data-approval={status}
    >
      {text}
    </span>
  );
}
