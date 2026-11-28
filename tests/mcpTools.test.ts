import { describe, expect, it } from "vitest";
import { emptyState, type AppState } from "../src/model";
import { runTool, ToolError, tools } from "../src/mcp/tools";

const now = new Date("2026-11-15T10:00:00Z");
function session() {
  let state: AppState = emptyState();
  const call = (name: string, args: Record<string, unknown> = {}) => {
    const output = runTool(state, name, args, "agent", now);
    state = output.state;
    return output.result as Record<string, unknown> & { id: string };
  };
  return {
    call,
    state: () => state,
    edit: (change: (current: AppState) => AppState) => {
      state = change(state);
    },
  };
}

describe("MCP tools", () => {
  it("builds a board and manages cards", () => {
    const { call, state } = session();
    const workspaceId = call("create_workspace", { name: "W" }).id;
    const boardId = call("create_board", { workspaceId, name: "B" }).id;
    const todo = call("create_list", { boardId, name: "Todo" }).id;
    const done = call("create_list", { boardId, name: "Done" }).id;
    const a = call("create_card", { listId: todo, name: "A", dueAt: "2026-11-20T12:00:00Z", description: "**x**" }).id;
    const b = call("create_card", { listId: todo, name: "B" }).id;
    const sub = call("create_card", { name: "A.1", parentCardId: a }).id;
    const clone = call("clone_card", { cardId: a }).id;

    expect(state().cards.find((card) => card.id === sub)?.parentCardId).toBe(a);
    expect(state().cards.find((card) => card.id === clone)?.name).toBe("A - Clone");
    call("move_card", { cardId: b, listId: done });
    call("move_list", { listId: done, targetListId: todo });
    const board = call("get_board", { boardId }) as unknown as {
      lists: Array<{ name: string; cards: Array<{ name: string }> }>;
    };
    expect(board.lists.map((list) => list.name)).toEqual(["Done", "Todo"]);
    expect(board.lists[0].cards.map((card) => card.name)).toEqual(["B"]);

    call("update_card", { cardId: a, dueAt: "", color: "#ff0000" });
    const card = state().cards.find((item) => item.id === a)!;
    expect([card.dueAt, card.cover]).toEqual([undefined, { color: "#ff0000" }]);

    const checklist = call("add_checklist", { cardId: a, name: "Steps", items: ["one", "two"] }) as unknown as {
      items: Array<{ id: string }>;
    };
    call("set_checklist_item", { cardId: a, itemId: checklist.items[1].id, checked: true });
    const question = call("add_comment", { cardId: a, text: "Done?" }).id;
    const answer = call("add_comment", { cardId: a, text: "Yes", replyToCommentId: question }).id;
    expect(() => call("add_comment", { cardId: a, text: "x", replyToCommentId: "nope" })).toThrow(ToolError);
    const thread = (
      call("get_card", { cardId: a }) as unknown as { comments: Array<{ id: string; parentId?: string }> }
    ).comments;
    expect(thread.map((item) => [item.id, item.parentId])).toEqual([
      [question, undefined],
      [answer, question],
    ]);
    call("add_dependency", { cardId: b, dependsOnCardId: a });
    const details = call("get_card", { cardId: b }) as unknown as { dependsOn: string[] };
    expect(details.dependsOn).toEqual([a]);
    expect(
      state()
        .cards.find((item) => item.id === a)
        ?.checklists[0].items.map((item) => item.checked),
    ).toEqual([false, true]);

    call("update_board_doc", { boardId, markdown: `See [A](/c/${a})` });
    expect(call("get_board_doc", { boardId })).toContain(`/c/${a}`);
    expect((call("search_cards", { query: "clone" }) as unknown as unknown[]).length).toBe(1);
    expect(state().revisions.length).toBeGreaterThan(0);
  });

  it("deletes to the trash and restores the parent chain", () => {
    const { call, state } = session();
    const workspaceId = call("create_workspace", { name: "W" }).id;
    const boardId = call("create_board", { workspaceId, name: "B" }).id;
    const listId = call("create_list", { boardId, name: "L" }).id;
    const cardId = call("create_card", { listId, name: "C" }).id;
    call("delete", { kind: "card", id: cardId });
    call("delete", { kind: "board", id: boardId });
    expect(() => call("get_card", { cardId })).toThrow(ToolError);
    call("restore", { kind: "card", id: cardId });
    expect(state().boards.find((board) => board.id === boardId)?.deletedAt).toBeUndefined();
    expect(state().lists.find((list) => list.id === listId)?.deletedAt).toBeUndefined();
    expect(call("get_card", { cardId }).name).toBe("C");
  });

  it("rejects bad input with ToolError and leaves state unchanged on reads", () => {
    const { call, state } = session();
    expect(() => call("create_workspace", { name: " " })).toThrow(ToolError);
    expect(() => call("create_board", { workspaceId: "nope", name: "B" })).toThrow(/not found/);
    expect(() => call("delete", { kind: "planet", id: "x" })).toThrow(ToolError);
    expect(() => call("unknown_tool")).toThrow(/Unknown tool/);
    const before = state();
    call("list_workspaces");
    expect(state()).toBe(before);
  });
  it("finds duplicates across boards and merges them", () => {
    const { call, state } = session();
    const workspaceId = call("create_workspace", { name: "W" }).id;
    const lists = ["Dev", "Support"].map(
      (name) => call("create_list", { boardId: call("create_board", { workspaceId, name }).id, name: "Todo" }).id,
    );
    const keep = call("create_card", {
      listId: lists[0],
      name: "Prepare the report on the advertising campaign",
      description: "Expense summary",
    }).id;
    const drop = call("create_card", {
      listId: lists[1],
      name: "Preparing reports on advertising campaigns",
      description: "Expense summary",
    }).id;
    call("create_card", { listId: lists[1], name: "Buy milk" });
    const pairs = call("find_duplicates") as unknown as Array<{ a: { id: string }; b: { id: string } }>;
    expect(pairs.map((pair) => [pair.a.id, pair.b.id].sort())).toEqual([[keep, drop].sort()]);
    call("merge_cards", { keepCardId: keep, dropCardId: drop });
    expect(state().cards.find((card) => card.id === drop)?.deletedAt).toBeTruthy();
    expect(call("find_duplicates")).toEqual([]);
  });

  it("sets list limits, card priority, labels, done and links, and mirrors and moves cards across boards", () => {
    const { call, state, edit } = session();
    const workspaceId = call("create_workspace", { name: "W" }).id;
    const boardId = call("create_board", { workspaceId, name: "Dev" }).id;
    const otherBoardId = call("create_board", { workspaceId, name: "Ops" }).id;
    const todo = call("create_list", { boardId, name: "Todo" }).id;
    const other = call("create_list", { boardId: otherBoardId, name: "Inbox" }).id;
    const a = call("create_card", { listId: todo, name: "A" }).id;
    const b = call("create_card", { listId: todo, name: "B" }).id;

    call("update_list", { listId: todo, name: "Doing", color: "red", cardLimit: 1 });
    type BoardOut = {
      labels: Array<{ id: string }>;
      lists: Array<{ name: string; color?: string; cardLimit?: number; cardCount: number }>;
    };
    const board = () => call("get_board", { boardId, keyword: "A" }) as unknown as BoardOut;
    expect(board().lists[0]).toMatchObject({ name: "Doing", color: "red", cardLimit: 1, cardCount: 2 });
    call("update_list", { listId: todo, color: "", cardLimit: 0 });
    expect(board().lists[0]).toMatchObject({ color: undefined, cardLimit: undefined });
    expect(() => call("update_list", { listId: todo, color: "teal" })).toThrow(ToolError);
    expect(() => call("update_list", { listId: todo, cardLimit: 1.5 })).toThrow(ToolError);

    edit((current) => ({ ...current, labels: [{ id: "bug", boardId, name: "Bug", color: "red" }] }));
    expect(board().labels.map((label) => label.id)).toEqual(["bug"]);
    call("update_card", { cardId: a, priority: "high", isEpic: true, labelIds: ["bug"] });
    expect(() => call("update_card", { cardId: a, priority: "urgent" })).toThrow(ToolError);
    expect(() => call("update_card", { cardId: a, labelIds: ["nope"] })).toThrow(ToolError);
    call("update_card", { cardId: a, done: true });
    const card = () => call("get_card", { cardId: a }) as unknown as Record<string, unknown>;
    expect(card()).toMatchObject({ priority: "high", isEpic: true, labels: ["Bug"], doneAt: now.toISOString() });
    call("update_card", { cardId: a, done: false, priority: "" });
    expect(card()).toMatchObject({ priority: undefined, doneAt: undefined });

    call("link_cards", { kind: "relates", fromCardId: a, toCardId: b });
    call("link_cards", { kind: "parent", fromCardId: a, toCardId: b });
    expect(() => call("link_cards", { kind: "relates", fromCardId: b, toCardId: a })).toThrow(ToolError);
    const links = () => card().connections as Record<string, Array<{ id: string }>>;
    expect([links().relates.map((item) => item.id), links().subCards.map((item) => item.id)]).toEqual([[b], [b]]);
    call("unlink_cards", { kind: "relates", fromCardId: b, toCardId: a });
    expect(links().relates).toEqual([]);

    const mirror = call("mirror_card", { cardId: a, listId: other }).id;
    call("update_card", { cardId: a, name: "A renamed" });
    expect(state().cards.find((item) => item.id === mirror)?.name).toBe("A renamed");
    expect((card().mirrors as Array<{ id: string }>).map((item) => item.id)).toEqual([mirror]);

    call("move_card", { cardId: b, listId: other });
    expect(state().cards.find((item) => item.id === b)).toMatchObject({ boardId: otherBoardId, listId: other });
  });

  it("keeps the tool list stable for agents", () => {
    expect(tools.map((tool) => tool.name)).toEqual([
      "list_workspaces",
      "get_board",
      "search_cards",
      "get_card",
      "board_summary",
      "get_board_doc",
      "find_duplicates",
      "list_trash",
      "create_workspace",
      "create_board",
      "create_list",
      "update_list",
      "move_list",
      "create_zone",
      "create_card",
      "update_card",
      "move_card",
      "clone_card",
      "mirror_card",
      "add_comment",
      "add_checklist",
      "set_checklist_item",
      "add_dependency",
      "link_cards",
      "unlink_cards",
      "merge_cards",
      "update_board_doc",
      "delete",
      "restore",
    ]);
  });
});
