import { describe, expect, it, vi } from "vitest";
import {
  isShortId,
  rememberIds,
  canEditComment,
  emptyBoardFilter,
  emptyState,
  filterBoardCards,
  markMediaLocal,
  newId,
  positionBefore,
  recordRevision,
  reorderLists,
  restoreRevision,
  searchCards,
  sortListCards,
  type Card,
} from "../src/model";

it("allows an author to edit their own comment while protecting synced and imported comments", () => {
  const own = { id: "comment", text: "Text", author: "Anna", authorDeviceId: "device-a", createdAt: "2026-01-01" };
  expect(canEditComment(own, "device-a")).toBe(true);
  expect(canEditComment(own, "device-b")).toBe(false);
  expect(canEditComment({ ...own, authorDeviceId: "trello:member" }, "device-a")).toBe(false);
  expect(canEditComment({ ...own, authorDeviceId: undefined }, "device-b")).toBe(true);
});

it("creates 8-character URL-safe short ids without repeats, also without crypto.randomUUID", () => {
  const ids = new Set(Array.from({ length: 5000 }, () => newId()));
  expect(ids.size).toBe(5000);
  for (const id of ids) expect(isShortId(id)).toBe(true);
  rememberIds(["00000000"]);
  let call = 0;
  vi.stubGlobal("crypto", {
    getRandomValues: (bytes: Uint8Array) => {
      bytes.fill(call++ < 1 ? 0 : 1);
      return bytes;
    },
  });
  try {
    expect(newId()).toBe("11111111");
  } finally {
    vi.unstubAllGlobals();
  }
});

it("marks received attachments and sticker images as local", () => {
  const card: Card = {
    id: "card",
    boardId: "board",
    listId: "list",
    name: "Media",
    description: "",
    position: 1,
    labelIds: [],
    checklists: [],
    comments: [],
    attachments: [{ id: "file", name: "file.png", mimeType: "image/png", size: 3, status: "missing" }],
    stickers: [{ imageId: "sticker", name: "check", status: "missing" }],
  };
  const original = { ...emptyState(), cards: [card] };
  expect(markMediaLocal(original, "unknown")).toBe(original);
  const withAttachment = markMediaLocal(original, "file");
  expect(withAttachment.cards[0].attachments[0].status).toBe("local");
  expect(withAttachment.cards[0].stickers?.[0]).toMatchObject({ status: "missing" });
  const withSticker = markMediaLocal(withAttachment, "sticker");
  expect(withSticker.cards[0].stickers?.[0]).toMatchObject({ status: "local" });
  expect(withSticker.cards[0].attachments[0].status).toBe("local");
  expect(markMediaLocal(withSticker, "sticker").cards[0]).not.toBe(withSticker.cards[0]);
});

describe("entity versions", () => {
  it("keeps the latest 30 snapshots and restores an earlier card", () => {
    const card = {
      id: "card-1",
      boardId: "board-1",
      listId: "list-1",
      name: "Original",
      description: "",
      position: 1,
      labelIds: [],
      checklists: [],
      comments: [],
      attachments: [],
    };
    let state = { ...emptyState(), cards: [card] };
    state = recordRevision(state, "card", card.id, "device-1");
    const first = state.revisions[0];
    for (let index = 0; index < 35; index++) {
      state = { ...state, cards: [{ ...card, name: `Version ${index}` }] };
      state = recordRevision(state, "card", card.id, "device-1");
    }
    expect(state.revisions).toHaveLength(30);
    expect(state.activity).toHaveLength(36);
    expect(state.revisions.at(-1)?.snapshot.name).toBe("Version 34");
    const restored = restoreRevision(state, first, "device-1");
    expect(restored.cards[0].name).toBe("Original");
  });
});

it("records comments separately from card changes and includes a move on both boards", () => {
  const card: Card = {
    id: "card",
    boardId: "board-a",
    listId: "list-a",
    name: "Note",
    description: "",
    position: 1,
    labelIds: [],
    checklists: [],
    comments: [],
    attachments: [],
  };
  const first = recordRevision({ ...emptyState(), cards: [card] }, "card", card.id, "device");
  const commented = recordRevision(
    {
      ...first,
      cards: [
        { ...card, comments: [{ id: "comment", text: "Hello", author: "Author", createdAt: "2026-01-01T00:00:00Z" }] },
      ],
    },
    "card",
    card.id,
    "device",
  );
  expect(commented.activity?.filter((item) => item.category === "comment").map((item) => item.summary)).toEqual([
    "Author: Hello",
  ]);
  expect(commented.activity).toHaveLength(2);
  const moved = recordRevision(
    { ...commented, cards: [{ ...commented.cards[0], boardId: "board-b", listId: "list-b" }] },
    "card",
    card.id,
    "device",
  );
  expect(moved.activity?.at(-1)).toMatchObject({ boardId: "board-b", previousBoardId: "board-a" });
});

it("places a dragged card before the target in the same or another list", () => {
  const card = (id: string, listId: string, position: number): Card => ({
    id,
    boardId: "board",
    listId,
    position,
    name: id,
    description: "",
    labelIds: [],
    checklists: [],
    comments: [],
    attachments: [],
  });
  const cards = [card("a", "first", 1), card("b", "first", 2), card("c", "first", 3), card("d", "second", 10)];
  expect(positionBefore(cards, "c", cards[1])).toBe(1.5);
  expect(positionBefore(cards, "c", cards[0])).toBe(0);
  expect(positionBefore(cards, "a", cards[3])).toBe(9);
});

it("sorts a whole list by name or due date without moving trashed or other-list cards", () => {
  const card = (id: string, name: string, position: number, dueAt?: string): Card => ({
    id,
    boardId: "board",
    listId: "first",
    position,
    name,
    description: "",
    labelIds: [],
    checklists: [],
    comments: [],
    attachments: [],
    dueAt,
  });
  const cards = [
    card("z", "Zebra", 1, "2026-12-02"),
    card("a", "Alpha", 2),
    card("b", "Beta", 3, "2026-12-01"),
    { ...card("hidden", "A", 4), deletedAt: "2026-01-01T00:00:00.000Z" },
    { ...card("other", "A", 12), listId: "second" },
  ];
  const byName = sortListCards(cards, "first", "name");
  expect(
    byName
      .filter((item) => item.listId === "first" && !item.deletedAt)
      .sort((a, b) => a.position - b.position)
      .map((item) => item.id),
  ).toEqual(["a", "b", "z"]);
  const byDue = sortListCards(cards, "first", "due");
  expect(
    byDue
      .filter((item) => item.listId === "first" && !item.deletedAt)
      .sort((a, b) => a.position - b.position)
      .map((item) => item.id),
  ).toEqual(["b", "z", "a"]);
  expect(byDue.find((item) => item.id === "hidden")?.position).toBe(4);
  expect(byDue.find((item) => item.id === "other")?.position).toBe(12);
});

it("reorders active lists only within their board", () => {
  const lists = [
    { id: "first", boardId: "board", name: "First", position: 1 },
    { id: "second", boardId: "board", name: "Second", position: 2 },
    { id: "third", boardId: "board", name: "Third", position: 3 },
    { id: "hidden", boardId: "board", name: "Hidden", position: 4, deletedAt: "2026-01-01T00:00:00.000Z" },
    { id: "other", boardId: "other-board", name: "Other", position: 1 },
  ];
  const moved = reorderLists(lists, "first", "second", true);
  expect(
    moved
      .filter((item) => item.boardId === "board" && !item.deletedAt)
      .sort((a, b) => a.position - b.position)
      .map((item) => item.id),
  ).toEqual(["second", "first", "third"]);
  expect(moved.find((item) => item.id === "hidden")?.position).toBe(4);
  expect(reorderLists(lists, "first", "other")).toBe(lists);
});

it("searches across boards and card details while excluding trashed cards", () => {
  const card = (id: string, boardId: string): Card => ({
    id,
    boardId,
    listId: "list",
    position: 1,
    name: id,
    description: "",
    labelIds: [],
    checklists: [],
    comments: [],
    attachments: [],
  });
  const first = {
    ...card("first", "board-a"),
    labelIds: ["label"],
    comments: [{ id: "comment", text: "Shared project", author: "You", createdAt: "2026-01-01" }],
  };
  const second = {
    ...card("second", "board-b"),
    checklists: [{ id: "checklist", name: "Stages", items: [{ id: "item", name: "Shared project", checked: false }] }],
  };
  const trashed = { ...card("third", "board-b"), name: "Shared project", deletedAt: "2026-01-01T00:00:00.000Z" };
  const boards = ["board-a", "board-b"].map((id) => ({
    id,
    workspaceId: "workspace",
    name: id,
    description: "",
    background: "#fff",
    starred: false,
  }));
  const state = {
    ...emptyState(),
    boards,
    cards: [first, second, trashed],
    labels: [{ id: "label", boardId: "board-a", name: "Important", color: "#f00" }],
  };
  expect(searchCards(state, "shared PROJECT").map((item) => item.id)).toEqual(["first", "second"]);
  expect(searchCards(state, "important").map((item) => item.id)).toEqual(["first"]);
});

it("combines words and quoted field phrases while allowing exclusions", () => {
  const card = (id: string, name: string, description: string): Card => ({
    id,
    boardId: "board",
    listId: "list",
    position: 1,
    name,
    description,
    labelIds: [],
    checklists: [],
    comments: [],
    attachments: [],
  });
  const state = {
    ...emptyState(),
    boards: [
      { id: "board", workspaceId: "workspace", name: "Projects", description: "", background: "#fff", starred: false },
    ],
    cards: [
      card("first", "Launch plan", "Shared project"),
      card("second", "Shared plan", "Internal project"),
      card("third", "Plan", "Shared archive of the project"),
    ],
  };
  expect(searchCards(state, "plan shared").map((item) => item.id)).toEqual(["first", "second", "third"]);
  expect(searchCards(state, 'description:"shared project"').map((item) => item.id)).toEqual(["first"]);
  expect(searchCards(state, "plan -name:shared").map((item) => item.id)).toEqual(["first", "third"]);
});

it("filters across boards by list, label, member and attachments", () => {
  const base: Card = {
    id: "first",
    boardId: "board-a",
    listId: "list-a",
    position: 1,
    name: "Task",
    description: "",
    labelIds: ["label-a"],
    memberIds: ["member-a"],
    checklists: [],
    comments: [],
    attachments: [{ id: "file", name: "photo.png", mimeType: "image/png", size: 1, status: "local" }],
  };
  const state = {
    ...emptyState(),
    boards: [
      {
        id: "board-a",
        workspaceId: "workspace",
        name: "Personal board",
        description: "",
        background: "#fff",
        starred: true,
        members: [{ id: "member-a", name: "Irina" }],
      },
      {
        id: "board-b",
        workspaceId: "workspace",
        name: "Other board",
        description: "",
        background: "#fff",
        starred: false,
      },
    ],
    lists: [
      { id: "list-a", boardId: "board-a", name: "In progress", position: 1 },
      { id: "list-b", boardId: "board-b", name: "In progress", position: 1 },
    ],
    labels: [{ id: "label-a", boardId: "board-a", name: "Important", color: "#f87168" }],
    cards: [
      base,
      { ...base, id: "second", boardId: "board-b", listId: "list-b", labelIds: [], memberIds: [], attachments: [] },
    ],
  };
  expect(
    searchCards(
      state,
      'board:"personal board" list:"in progress" label:important @irina has:attachments is:starred',
    ).map((item) => item.id),
  ).toEqual(["first"]);
  expect(searchCards(state, "#red").map((item) => item.id)).toEqual(["first"]);
  expect(searchCards(state, "-has:attachments").map((item) => item.id)).toEqual(["second"]);
  expect(searchCards(state, "#red -has:attachments")).toEqual([]);
  expect(searchCards(state, "board:board-b has:attachments")).toEqual([]);
});

it("filters upcoming and overdue due dates", () => {
  const card = (id: string, dueAt: string): Card => ({
    id,
    boardId: "board",
    listId: "list",
    position: 1,
    name: id,
    description: "",
    labelIds: [],
    dueAt,
    checklists: [],
    comments: [],
    attachments: [],
  });
  const state = {
    ...emptyState(),
    boards: [
      { id: "board", workspaceId: "workspace", name: "Deadlines", description: "", background: "#fff", starred: false },
    ],
    cards: [card("late", "2025-12-31T00:00:00.000Z"), card("soon", "2026-01-03T00:00:00.000Z")],
  };
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  expect(searchCards(state, "due:overdue", now).map((item) => item.id)).toEqual(["late"]);
  expect(searchCards(state, "due:week", now).map((item) => item.id)).toEqual(["soon"]);
});

it("hides cards of trashed lists from board filters and global search", () => {
  const card = (id: string, listId: string): Card => ({
    id,
    boardId: "board",
    listId,
    position: 1,
    name: "Shared request",
    description: "",
    labelIds: [],
    checklists: [],
    comments: [],
    attachments: [],
  });
  const state = {
    ...emptyState(),
    boards: [
      { id: "board", workspaceId: "workspace", name: "Board", description: "", background: "#fff", starred: false },
    ],
    lists: [
      { id: "active", boardId: "board", name: "Active", position: 1 },
      { id: "trashed", boardId: "board", name: "Old", position: 2, deletedAt: "2026-01-01T00:00:00.000Z" },
    ],
    cards: [card("visible", "active"), card("hidden", "trashed")],
  };
  expect(searchCards(state, "Shared request").map((item) => item.id)).toEqual(["visible"]);
  expect(filterBoardCards(state, "board", emptyBoardFilter()).map((item) => item.id)).toEqual(["visible"]);
});

it("filters cards inside one board by text, label and due date", () => {
  const card = (id: string, boardId: string): Card => ({
    id,
    boardId,
    listId: "list",
    position: 1,
    name: id,
    description: "",
    labelIds: [],
    checklists: [],
    comments: [],
    attachments: [],
  });
  const state = {
    ...emptyState(),
    cards: [
      {
        ...card("soon", "board-a"),
        labelIds: ["red"],
        memberIds: ["member-1"],
        description: "Document",
        dueAt: "2026-01-03T00:00:00.000Z",
      },
      { ...card("late", "board-a"), dueAt: "2025-12-31T00:00:00.000Z" },
      { ...card("other", "board-b"), labelIds: ["red"], dueAt: "2026-01-03T00:00:00.000Z" },
      { ...card("hidden", "board-a"), deletedAt: "2026-01-01T00:00:00.000Z" },
    ],
  };
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  expect(filterBoardCards(state, "board-a", emptyBoardFilter(), now).map((item) => item.id)).toEqual(["soon", "late"]);
  expect(
    filterBoardCards(state, "board-a", { keyword: "DOCUMENT", labelId: "red", due: "next-week" }, now).map(
      (item) => item.id,
    ),
  ).toEqual(["soon"]);
  expect(
    filterBoardCards(state, "board-a", { ...emptyBoardFilter(), memberId: "member-1" }, now).map((item) => item.id),
  ).toEqual(["soon"]);
  expect(
    filterBoardCards(state, "board-a", { ...emptyBoardFilter(), due: "overdue" }, now).map((item) => item.id),
  ).toEqual(["late"]);
  expect(filterBoardCards(state, "board-a", { ...emptyBoardFilter(), due: "none" }, now)).toHaveLength(0);
});
