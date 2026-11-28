import { describe, expect, it } from "vitest";
import {
  copyBoard,
  copyList,
  createCardFromTemplate,
  emptyState,
  moveListToBoard,
  transferCard,
  type AppState,
} from "../src/model";

function fixture(): AppState {
  return {
    ...emptyState(),
    boards: [
      {
        id: "from",
        workspaceId: "workspace",
        name: "From",
        description: "",
        background: "#fff",
        starred: false,
        members: [
          { id: "member-a", name: "Anna" },
          { id: "member-b", name: "Boris" },
        ],
      },
      {
        id: "to",
        workspaceId: "workspace",
        name: "To",
        description: "",
        background: "#fff",
        starred: false,
        members: [{ id: "member-c", name: "Anna" }],
      },
    ],
    lists: [
      { id: "from-list", boardId: "from", name: "From", position: 1 },
      { id: "to-list", boardId: "to", name: "To", position: 1 },
    ],
    labels: [
      { id: "label-a", boardId: "from", name: "Important", color: "#f00" },
      { id: "label-b", boardId: "to", name: "Important", color: "#f00" },
    ],
    cards: [
      {
        id: "card",
        boardId: "from",
        listId: "from-list",
        name: "Task",
        description: "Text",
        position: 1,
        labelIds: ["label-a"],
        memberIds: ["member-a", "member-b"],
        checklists: [{ id: "checklist", name: "Steps", items: [{ id: "item", name: "First", checked: true }] }],
        comments: [{ id: "comment", text: "Comment", author: "Anna", createdAt: "2026-01-01" }],
        attachments: [{ id: "file", name: "photo.png", mimeType: "image/png", size: 3, status: "local" }],
        cover: { attachmentId: "file" },
        sourceTrelloId: "trello-card",
      },
    ],
  };
}

describe("card transfer", () => {
  it("moves a card across boards with matching labels and board members", () => {
    const result = transferCard(fixture(), "card", "to-list", false);
    expect(result.state.cards).toHaveLength(1);
    expect(result.state.cards[0]).toMatchObject({
      id: "card",
      boardId: "to",
      listId: "to-list",
      labelIds: ["label-b"],
      memberIds: ["member-c"],
    });
    expect(result.state.cards[0].attachments[0].id).toBe("file");
    expect(result.state.labels).toHaveLength(2);
  });

  it("copies details and local media references into a new card", () => {
    const source = fixture();
    const result = transferCard(source, "card", "to-list", true);
    const copied = result.state.cards[1];
    expect(result.state.cards[0]).toEqual(source.cards[0]);
    expect(copied.id).not.toBe("card");
    expect(copied).toMatchObject({
      boardId: "to",
      listId: "to-list",
      description: "Text",
      labelIds: ["label-b"],
      memberIds: ["member-c"],
      sourceTrelloId: undefined,
    });
    expect(copied.checklists[0].id).not.toBe("checklist");
    expect(copied.comments[0].id).not.toBe("comment");
    expect(copied.attachments[0].id).toBe("file");
    expect(copied.cover?.attachmentId).toBe("file");
  });

  it("creates a destination label when needed and rejects a target list in the trash", () => {
    const source = fixture();
    source.labels = source.labels.slice(0, 1);
    const result = transferCard(source, "card", "to-list", false);
    expect(result.state.labels.find((label) => label.id === result.state.cards[0].labelIds[0])).toMatchObject({
      boardId: "to",
      name: "Important",
      color: "#f00",
    });
    source.lists[1].deletedAt = "2026-01-01T00:00:00.000Z";
    expect(() => transferCard(source, "card", "to-list", false)).toThrow("unavailable");
  });

  it("places a moved or copied card at the end of its target list", () => {
    const source = fixture();
    source.lists.push({ id: "second-list", boardId: "from", name: "Second", position: 2 });
    source.cards.push({ ...structuredClone(source.cards[0]), id: "other", listId: "second-list", position: 4 });
    expect(transferCard(source, "card", "second-list", false).state.cards[0].position).toBe(5);
    expect(transferCard(source, "card", "from-list", true).state.cards.at(-1)?.position).toBe(2);
  });

  it("places a moved or copied card at the top of its target list on request", () => {
    const source = fixture();
    source.lists.push({ id: "second-list", boardId: "from", name: "Second", position: 2 });
    source.cards.push({ ...structuredClone(source.cards[0]), id: "other", listId: "second-list", position: 4 });
    expect(transferCard(source, "card", "second-list", false, undefined, true).state.cards[0].position).toBe(0);
    source.cards.push({ ...structuredClone(source.cards[0]), id: "first", listId: "second-list", position: -2 });
    const copied = transferCard(source, "card", "second-list", true, "copy", true).state;
    expect(copied.cards.find((card) => card.id === "copy")?.position).toBe(-3);
  });
});

describe("list copy", () => {
  it("copies active cards in order while keeping local media references", () => {
    const source = fixture();
    source.lists.push({ id: "following", boardId: "from", name: "Following", position: 2 });
    source.cards.push({ ...structuredClone(source.cards[0]), id: "second", name: "Second", position: 2 });
    source.cards.push({
      ...structuredClone(source.cards[0]),
      id: "trashed",
      deletedAt: "2026-01-01T00:00:00.000Z",
      position: 3,
    });
    const copied = copyList(source, "from-list", "copy-list");
    expect(source.lists).toHaveLength(3);
    expect(source.cards).toHaveLength(3);
    expect(copied.state.lists.find((list) => list.id === "copy-list")).toMatchObject({
      boardId: "from",
      name: "From (copy)",
      position: 1.5,
    });
    expect(copied.cardIds).toHaveLength(2);
    const cards = copied.state.cards
      .filter((card) => card.listId === "copy-list")
      .sort((a, b) => a.position - b.position);
    expect(cards.map((card) => card.name)).toEqual(["Task", "Second"]);
    expect(cards[0].attachments[0].id).toBe("file");
    expect(cards[0].cover?.attachmentId).toBe("file");
    expect(cards[0].checklists[0].id).not.toBe("checklist");
    expect(cards[0].comments[0].id).not.toBe("comment");
    expect(cards[0].sourceTrelloId).toBeUndefined();
  });

  it("does not copy a list in the trash", () => {
    const source = fixture();
    source.lists[0].deletedAt = "2026-01-01T00:00:00.000Z";
    expect(() => copyList(source, "from-list")).toThrow("cannot be copied");
  });

  it("moves a list with its cards and automation rules to the start of another board", () => {
    const source = fixture();
    source.lists[0].zoneId = "zone";
    source.labels.push({ id: "label-c", boardId: "from", name: "Done", color: "#0f0" });
    source.boards[0].automationRules = [
      { id: "rule", listId: "from-list", action: "add-label", labelId: "label-c" },
      { id: "other", listId: "elsewhere", action: "trash" },
    ];
    source.cards.push({ ...source.cards[0], id: "trashed", position: 5, deletedAt: "2026-01-01T00:00:00.000Z" });
    const moved = moveListToBoard(source, "from-list", "to", true);
    expect(moved.cardIds).toEqual(["card", "trashed"]);
    expect(moved.state.lists[0]).toMatchObject({ boardId: "to", position: 0, zoneId: undefined });
    expect(moved.state.cards[0]).toMatchObject({
      boardId: "to",
      listId: "from-list",
      position: 1,
      labelIds: ["label-b"],
    });
    expect(moved.state.cards[1]).toMatchObject({ boardId: "to", position: 5 });
    const done = moved.state.labels.find((label) => label.boardId === "to" && label.name === "Done");
    expect(moved.state.boards[0].automationRules?.map((rule) => rule.id)).toEqual(["other"]);
    expect(moved.state.boards[1].automationRules).toEqual([
      { ...source.boards[0].automationRules[0], labelId: done?.id },
    ]);
  });

  it("moves a list to the end of its own board without touching its cards", () => {
    const source = fixture();
    source.lists.push({ id: "next", boardId: "from", name: "Next", position: 2 });
    const moved = moveListToBoard(source, "from-list", "from", false);
    expect(moved.state.lists[0].position).toBe(3);
    expect(moved.state.cards).toBe(source.cards);
  });
});

describe("card templates", () => {
  it("creates a normal card from a template without dates or comments", () => {
    const source = fixture();
    source.cards[0] = {
      ...source.cards[0],
      isTemplate: true,
      startAt: "2026-01-01",
      dueAt: "2026-02-01",
      dueReminderMinutes: 1440,
    };
    const result = createCardFromTemplate(source, "card", "from-list", "New task", "new-card");
    expect(result.state.cards[0]).toEqual(source.cards[0]);
    expect(result.state.cards[1]).toMatchObject({
      id: "new-card",
      name: "New task",
      isTemplate: false,
      description: "Text",
      labelIds: ["label-a"],
    });
    expect(result.state.cards[1].checklists[0].id).not.toBe("checklist");
    expect(result.state.cards[1].attachments[0].id).toBe("file");
    expect(result.state.cards[1].comments).toEqual([]);
    expect(result.state.cards[1].startAt).toBeUndefined();
    expect(result.state.cards[1].dueAt).toBeUndefined();
    expect(result.state.cards[1].dueReminderMinutes).toBeUndefined();
  });

  it("rejects templates from another board", () => {
    const source = fixture();
    source.cards[0].isTemplate = true;
    expect(() => createCardFromTemplate(source, "card", "to-list", "New task")).toThrow("unavailable");
  });
});

describe("board copy", () => {
  it("maps automation rules to copied lists and labels", () => {
    const source = fixture();
    source.workspaces = [{ id: "workspace", name: "Personal" }];
    source.boards[0].automationRules = [
      { id: "rule", listId: "from-list", action: "add-label", labelId: "label-a" },
      { id: "button", listId: "", trigger: "button", name: "Mark", action: "add-label", labelId: "label-a" },
    ];
    const result = copyBoard(source, "from", {
      name: "Copy",
      workspaceId: "workspace",
      keepCards: true,
      keepTemplates: true,
    });
    expect(result.state.boards.at(-1)?.automationRules).toMatchObject([
      { listId: result.listIds[0], labelId: result.state.labels.at(-1)?.id, action: "add-label" },
      { listId: "", trigger: "button", name: "Mark", labelId: result.state.labels.at(-1)?.id },
    ]);
    expect(result.state.boards.at(-1)?.automationRules?.[0].id).not.toBe("rule");
  });

  it("copies active cards and templates with fresh IDs and local media references", () => {
    const source = fixture();
    source.workspaces = [{ id: "workspace", name: "Personal" }];
    source.cards.push({ ...structuredClone(source.cards[0]), id: "trashed", deletedAt: "2026-01-01T00:00:00.000Z" });
    source.cards.push({ ...structuredClone(source.cards[0]), id: "template", isTemplate: true });
    source.cards.push({
      ...structuredClone(source.cards[0]),
      id: "trashed-template",
      isTemplate: true,
      deletedAt: "2026-01-01T00:00:00.000Z",
    });
    const result = copyBoard(
      source,
      "from",
      { name: "Copy", workspaceId: "workspace", keepCards: true, keepTemplates: true },
      "board-copy",
    );
    const cards = result.state.cards.filter((card) => card.boardId === "board-copy");
    expect(source.boards).toHaveLength(2);
    expect(result.state.boards.at(-1)).toMatchObject({
      id: "board-copy",
      name: "Copy",
      members: [],
      sourceTrelloId: undefined,
    });
    expect(result.listIds).toHaveLength(1);
    expect(cards).toHaveLength(2);
    expect(cards.find((card) => card.isTemplate)).toMatchObject({ comments: [], memberIds: [] });
    expect(cards.find((card) => !card.isTemplate)).toMatchObject({
      description: "Text",
      labelIds: [result.state.labels.at(-1)?.id],
    });
    expect(cards.find((card) => !card.isTemplate)?.deletedAt).toBeUndefined();
    expect(cards[0].attachments[0].id).toBe("file");
    expect(cards[0].cover?.attachmentId).toBe("file");
    expect(cards[0].checklists[0].id).not.toBe("checklist");
  });

  it("can copy only the board structure", () => {
    const source = fixture();
    source.workspaces = [{ id: "workspace", name: "Personal" }];
    const result = copyBoard(source, "from", {
      name: "Empty",
      workspaceId: "workspace",
      keepCards: false,
      keepTemplates: false,
    });
    expect(result.listIds).toHaveLength(1);
    expect(result.cardIds).toHaveLength(0);
    expect(result.state.labels.filter((label) => label.boardId === result.boardId)).toHaveLength(1);
  });

  it("keeps card and template choices independent", () => {
    const source = fixture();
    source.workspaces = [{ id: "workspace", name: "Personal" }];
    source.cards.push({ ...structuredClone(source.cards[0]), id: "template", isTemplate: true });
    const templates = copyBoard(source, "from", {
      name: "Templates",
      workspaceId: "workspace",
      keepCards: false,
      keepTemplates: true,
    });
    const cards = copyBoard(source, "from", {
      name: "Cards",
      workspaceId: "workspace",
      keepCards: true,
      keepTemplates: false,
    });
    expect(
      templates.state.cards.filter((card) => card.boardId === templates.boardId).map((card) => card.isTemplate),
    ).toEqual([true]);
    expect(cards.state.cards.filter((card) => card.boardId === cards.boardId).map((card) => card.isTemplate)).toEqual([
      undefined,
    ]);
  });

  it("keeps copied local dependencies inside the copied board", () => {
    const source = fixture();
    source.workspaces = [{ id: "workspace", name: "Personal" }];
    source.cards[0].checklists[0].items[0].linkedCardId = "second";
    source.cards.push({
      ...structuredClone(source.cards[0]),
      id: "second",
      checklists: [],
      attachments: [
        { id: "back-link", name: "Task", mimeType: "text/uri-list", size: 0, status: "link", linkedCardId: "card" },
      ],
    });
    const result = copyBoard(source, "from", {
      name: "Copy",
      workspaceId: "workspace",
      keepCards: true,
      keepTemplates: false,
    });
    const [first, second] = result.state.cards.filter((card) => card.boardId === result.boardId);
    expect(first.checklists[0].items[0].linkedCardId).toBe(second.id);
    expect(second.attachments[0].linkedCardId).toBe(first.id);
  });
});
