import { describe, expect, it } from "vitest";
import {
  type AppState,
  approvalStatus,
  type Card,
  decideApproval,
  emptyBoardFilter,
  emptyState,
  filterBoardCards,
  isApprovals,
  memberOfDevice,
  resetApprovals,
  setApprovers,
  transferCard,
  waitsOn,
} from "../src/model";

const card = (id: string, extra: Partial<Card> = {}): Card => ({
  id,
  boardId: "a",
  listId: "todo",
  name: id,
  description: "",
  position: 1,
  labelIds: [],
  checklists: [],
  comments: [],
  attachments: [],
  ...extra,
});

const base = emptyState();
const ann = { id: "ann", name: "Ann" };
const bob = { id: "bob", name: "Bob" };
const state: AppState = {
  ...base,
  boards: [
    { ...base.boards[0], id: "a", name: "A", workspaceId: "w", members: [ann] },
    { ...base.boards[0], id: "b", name: "B", workspaceId: "w", members: [{ id: "bob-b", name: "Bob" }] },
  ],
  lists: [
    { id: "todo", boardId: "a", name: "Todo", position: 1 },
    { id: "ok", boardId: "a", name: "Approved", position: 2 },
    { id: "other", boardId: "b", name: "Other", position: 1 },
  ],
  cards: [card("c")],
};
const cardOf = (next: AppState) => next.cards.find((item) => item.id === "c")!;

describe("approvals", () => {
  it("adds approvers, joining new ones to the board, and tells the status as decisions come", () => {
    let next = setApprovers(state, "c", [ann, bob], "dev");
    expect(next.boards[0].members).toEqual([ann, bob]);
    expect(approvalStatus(cardOf(next))).toBe("pending");
    expect(waitsOn(cardOf(next), "bob")).toBe(true);

    next = decideApproval(next, "c", "ann", "approved", "dev", undefined, "2026-11-27T10:00:00.000Z");
    expect(approvalStatus(cardOf(next))).toBe("pending");
    expect(waitsOn(cardOf(next), "ann")).toBe(false);
    next = decideApproval(next, "c", "bob", "declined", "dev", "  Too costly ");
    expect(approvalStatus(cardOf(next))).toBe("declined");
    expect(cardOf(next).approvals?.[1]).toMatchObject({ decision: "declined", comment: "Too costly" });
    // A declined card waits on nobody.
    expect(waitsOn(cardOf(next), "bob")).toBe(false);

    next = decideApproval(next, "c", "bob", "approved", "dev");
    expect(approvalStatus(cardOf(next))).toBe("approved");
    expect(cardOf(next).approvals?.[1].comment).toBeUndefined();

    next = resetApprovals(next, "c", "dev");
    expect(cardOf(next).approvals).toEqual([{ memberId: "ann" }, { memberId: "bob" }]);
    next = setApprovers(next, "c", [], "dev");
    expect(cardOf(next).approvals).toBeUndefined();
    expect(approvalStatus(cardOf(next))).toBeUndefined();
  });

  it("keeps the decisions of approvers who stay", () => {
    let next = setApprovers(state, "c", [ann, bob], "dev");
    next = decideApproval(next, "c", "ann", "approved", "dev");
    next = setApprovers(next, "c", [ann], "dev");
    expect(approvalStatus(cardOf(next))).toBe("approved");
  });

  it("runs the board's rules when a card is approved or declined", () => {
    const withRules: AppState = {
      ...state,
      boards: state.boards.map((board) =>
        board.id === "a"
          ? {
              ...board,
              automationRules: [
                { id: "r", listId: "", trigger: "approved", action: "move-to-list", targetListId: "ok" },
                { id: "s", listId: "", trigger: "declined", action: "trash" },
              ],
            }
          : board,
      ),
    };
    let next = setApprovers(withRules, "c", [ann], "dev");
    next = decideApproval(next, "c", "ann", "approved", "dev");
    expect(cardOf(next).listId).toBe("ok");
    next = decideApproval(next, "c", "ann", "declined", "dev");
    expect(cardOf(next).deletedAt).toBeTruthy();
  });

  it("filters by status and carries approvers to another board by name", () => {
    let next = setApprovers(state, "c", [ann, bob], "dev");
    next = { ...next, cards: [...next.cards, card("d")] };
    const names = (approval: NonNullable<ReturnType<typeof emptyBoardFilter>["approval"]>) =>
      filterBoardCards(next, "a", { ...emptyBoardFilter(), approval }).map((item) => item.id);
    expect(names("pending")).toEqual(["c"]);
    expect(names("none")).toEqual(["d"]);
    expect(names("approved")).toEqual([]);

    next = decideApproval(next, "c", "bob", "approved", "dev");
    const moved = transferCard(next, "c", "other", false).state.cards.find((item) => item.id === "c")!;
    expect(moved.approvals).toMatchObject([{ memberId: "bob-b", decision: "approved" }]);
    const copied = transferCard(next, "c", "todo", true, "copy").state.cards.find((item) => item.id === "copy")!;
    expect(copied.approvals).toEqual([{ memberId: "ann" }, { memberId: "bob" }]);
  });

  it("finds this device's member by id or author name and checks saved approvals", () => {
    expect(memberOfDevice([ann, bob], "bob", "")).toBe(bob);
    expect(memberOfDevice([ann, bob], "x", " ann ")).toBe(ann);
    expect(memberOfDevice([ann, bob], "x", "Zed")).toBeUndefined();
    expect(isApprovals([{ memberId: "a", decision: "approved", decidedAt: "x" }])).toBe(true);
    expect(isApprovals([{ memberId: "a", decision: "maybe" }])).toBe(false);
  });
});
