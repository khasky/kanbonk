import { applyApprovalRules } from "./automation";
import { recordRevisions } from "./revisions";
import { trashSubCards } from "./trash";
import type { AppState, Approval, ApprovalDecision, ApprovalStatus, Card, Member } from "./types";

/** Where the card's approval stands: declined by anyone, approved by all, pending otherwise; none without approvers. */
export function approvalStatus(card: Pick<Card, "approvals">): ApprovalStatus | undefined {
  const approvals = card.approvals ?? [];
  if (!approvals.length) return undefined;
  if (approvals.some((item) => item.decision === "declined")) return "declined";
  return approvals.every((item) => item.decision === "approved") ? "approved" : "pending";
}

/** How many approvers have approved the card, of how many. */
export function approvalCount(card: Pick<Card, "approvals">) {
  const approvals = card.approvals ?? [];
  return { approved: approvals.filter((item) => item.decision === "approved").length, total: approvals.length };
}

/** The member of the board who is this device: the one with its id, or else with its author's name. */
export function memberOfDevice(members: Member[], deviceId: string, authorName: string): Member | undefined {
  const name = authorName.trim().toLocaleLowerCase();
  return (
    members.find((member) => member.id === deviceId) ??
    (name ? members.find((member) => member.name.trim().toLocaleLowerCase() === name) : undefined)
  );
}

/** Whether the card waits on this member's decision: they are an approver who has not decided and nobody declined. */
export function waitsOn(card: Card, memberId: string | undefined): boolean {
  return (
    Boolean(memberId) &&
    approvalStatus(card) === "pending" &&
    Boolean(card.approvals?.some((item) => item.memberId === memberId && !item.decision))
  );
}

function changeCard(state: AppState, cardId: string, deviceId: string, change: (card: Card) => Card): AppState {
  const before = state.cards.find((card) => card.id === cardId);
  if (!before) return state;
  const changed = change(before);
  if (changed === before) return state;
  // A decision that settles the card runs the board's rules for an approved or declined card.
  const after = approvalStatus(changed) !== approvalStatus(before) ? applyApprovalRules(state, changed) : changed;
  return trashSubCards(
    recordRevisions(
      { ...state, cards: state.cards.map((card) => (card.id === cardId ? after : card)) },
      [{ kind: "card", id: cardId }],
      deviceId,
    ),
    cardId,
    deviceId,
  );
}

/**
 * Makes these members the card's approvers, keeping the decisions of those who stay; members not on the card's board
 * yet join it.
 */
export function setApprovers(state: AppState, cardId: string, members: Member[], deviceId: string): AppState {
  const card = state.cards.find((item) => item.id === cardId);
  const board = state.boards.find((item) => item.id === card?.boardId);
  if (!card || !board) return state;
  const missing = members.filter((member) => !(board.members ?? []).some((item) => item.id === member.id));
  let next = state;
  if (missing.length)
    next = recordRevisions(
      {
        ...state,
        boards: state.boards.map((item) =>
          item.id === board.id ? { ...item, members: [...(item.members ?? []), ...missing] } : item,
        ),
      },
      [{ kind: "board", id: board.id }],
      deviceId,
    );
  return changeCard(next, cardId, deviceId, (item) => {
    const approvals: Approval[] = members.map(
      (member) => item.approvals?.find((approval) => approval.memberId === member.id) ?? { memberId: member.id },
    );
    return { ...item, approvals: approvals.length ? approvals : undefined };
  });
}

/** Records an approver's decision, with a comment when they decline; undefined takes the decision back. */
export function decideApproval(
  state: AppState,
  cardId: string,
  memberId: string,
  decision: ApprovalDecision | undefined,
  deviceId: string,
  comment?: string,
  now = new Date().toISOString(),
): AppState {
  return changeCard(state, cardId, deviceId, (card) => {
    if (!card.approvals?.some((item) => item.memberId === memberId)) return card;
    return {
      ...card,
      approvals: card.approvals.map((item) =>
        item.memberId === memberId
          ? decision
            ? {
                memberId,
                decision,
                decidedAt: now,
                comment: decision === "declined" && comment?.trim() ? comment.trim() : undefined,
              }
            : { memberId }
          : item,
      ),
    };
  });
}

/** Clears every decision on the card; the approvers stay. */
export function resetApprovals(state: AppState, cardId: string, deviceId: string): AppState {
  return changeCard(state, cardId, deviceId, (card) =>
    card.approvals?.some((item) => item.decision)
      ? { ...card, approvals: card.approvals.map((item) => ({ memberId: item.memberId })) }
      : card,
  );
}

/** The approvals a card takes to another board: approvers matched by id or name, decisions kept unless copied. */
export function carriedApprovals(
  approvals: Approval[] | undefined,
  sourceMembers: Member[],
  targetMembers: Member[] | undefined,
  crossBoard: boolean,
  copy: boolean,
): Approval[] | undefined {
  const carried = (approvals ?? []).flatMap((approval) => {
    let memberId = approval.memberId;
    if (crossBoard) {
      const member = sourceMembers.find((item) => item.id === approval.memberId);
      const target = targetMembers?.find((item) => item.id === memberId || (member && item.name === member.name));
      if (!target) return [];
      memberId = target.id;
    }
    return [copy ? { memberId } : { ...approval, memberId }];
  });
  return carried.length ? carried : undefined;
}

const decisions: ApprovalDecision[] = ["approved", "declined"];

/** Whether a value read from a file is a valid list of approvals. */
export const isApprovals = (value: unknown): value is Approval[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof item.memberId === "string" &&
      (item.decision === undefined || decisions.includes(item.decision)) &&
      (item.decidedAt === undefined || typeof item.decidedAt === "string") &&
      (item.comment === undefined || typeof item.comment === "string"),
  );
