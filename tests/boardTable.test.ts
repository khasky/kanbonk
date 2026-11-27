import { describe, expect, it } from "vitest";
import {
  applyTick,
  checklistProgress,
  sortRows,
  tableCsv,
  tableRows,
  tickState,
  workspaceBoards,
} from "../src/board/tableView";
import { boardHref, parseRoute } from "../src/lib/router";
import { type AppState, type Card, emptyBoardFilter, emptyState } from "../src/model";

const card = (id: string, boardId: string, listId: string, extra: Partial<Card> = {}): Card => ({
  id,
  boardId,
  listId,
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
const state: AppState = {
  ...base,
  boards: [
    { ...base.boards[0], id: "a", name: "Alpha", workspaceId: "w", members: [{ id: "m", name: "Mia" }] },
    { ...base.boards[0], id: "b", name: "Beta", workspaceId: "w" },
    { ...base.boards[0], id: "c", name: "Gamma", workspaceId: "other" },
  ],
  lists: [
    { id: "todo", boardId: "a", name: "Todo", position: 1 },
    { id: "done", boardId: "a", name: "Done", position: 2 },
    { id: "beta", boardId: "b", name: "Backlog", position: 1 },
  ],
  labels: [{ id: "red", boardId: "a", name: "Bug", color: "#f87168" }],
  cards: [
    card("Write", "a", "done", { position: 1, dueAt: "2026-11-30T10:00:00.000Z", priority: "low" }),
    card("Plan", "a", "todo", {
      position: 2,
      labelIds: ["red"],
      memberIds: ["m"],
      priority: "critical",
      checklists: [
        {
          id: "x",
          name: "Steps",
          items: [
            { id: "1", name: "a", checked: true },
            { id: "2", name: "b", checked: false },
          ],
        },
      ],
    }),
    card("Draft", "a", "todo", { position: 1 }),
    card("Template", "a", "todo", { isTemplate: true }),
    card("Gone", "a", "todo", { deletedAt: "2026-11-01T00:00:00.000Z" }),
    card("Other", "b", "beta", { labelIds: [] }),
  ],
};

describe("board table", () => {
  it("lists the board's cards by list and position, then the chosen boards of its workspace", () => {
    const names = (others: string[], filter = emptyBoardFilter()) =>
      tableRows(state, "a", others, filter).map((row) => row.card.name);
    expect(names([])).toEqual(["Draft", "Plan", "Write"]);
    expect(names(["b", "c"])).toEqual(["Draft", "Plan", "Write", "Other"]);
    // A label filter of this board does not hide the cards of the other boards.
    expect(names(["b"], { ...emptyBoardFilter(), labelId: "red" })).toEqual(["Plan", "Other"]);
    expect(workspaceBoards(state, "a").map((board) => board.name)).toEqual(["Beta"]);
  });

  it("sorts by a column with empty values last", () => {
    const rows = tableRows(state, "a", [], emptyBoardFilter());
    const by = (sort: Parameters<typeof sortRows>[2]) => sortRows(state, rows, sort).map((row) => row.card.name);
    expect(by({ by: "name", direction: "ascending" })).toEqual(["Draft", "Plan", "Write"]);
    expect(by({ by: "priority", direction: "ascending" })).toEqual(["Plan", "Write", "Draft"]);
    expect(by({ by: "priority", direction: "descending" })).toEqual(["Write", "Plan", "Draft"]);
    expect(by({ by: "due", direction: "descending" })).toEqual(["Write", "Draft", "Plan"]);
    expect(by({ by: "list", direction: "descending" })).toEqual(["Draft", "Plan", "Write"]);
  });

  it("tells and applies half-ticked choices", () => {
    const cards = state.cards.slice(0, 3);
    const hasBug = (item: Card) => item.labelIds.includes("red");
    expect(tickState(cards, hasBug)).toBe("some");
    expect(tickState(cards.slice(1, 2), hasBug)).toBe("all");
    expect(tickState([cards[0]], hasBug)).toBe("none");
    expect(applyTick(["x"], "y", "all")).toEqual(["x", "y"]);
    expect(applyTick(["x", "y"], "y", "none")).toEqual(["x"]);
    expect(applyTick(["x"], "y", "some")).toEqual(["x"]);
    expect(checklistProgress(cards[1])).toEqual({ done: 1, total: 2 });
  });

  it("exports the rows and shown columns as CSV and keeps the view in the address", () => {
    const rows = tableRows(state, "a", [], emptyBoardFilter()).slice(1, 2);
    expect(tableCsv(state, rows, ["list", "labels", "members", "priority", "checklist"]).split("\r\n")).toEqual([
      "Card,List,Labels,Members,Priority,Checklist",
      "Plan,Todo,Bug,Mia,Critical,1/2",
    ]);
    expect(boardHref("x", { view: "table" })).toBe("/b/x?view=table");
    expect(parseRoute("/b/x", "?view=table")).toMatchObject({ view: "table" });
  });
});
