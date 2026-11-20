import { expect, it } from "vitest";
import { convertChecklistItem, emptyState, moveChecklistItem, recordRevision, type Card } from "../src/model";

const card: Card = {
  id: "card",
  boardId: "board",
  listId: "list",
  name: "Card",
  description: "",
  position: 1,
  labelIds: [],
  completed: false,
  comments: [],
  attachments: [],
  checklists: [
    {
      id: "first",
      name: "First",
      items: [
        { id: "one", name: "One", checked: false },
        { id: "two", name: "Two", checked: true },
        { id: "three", name: "Three", checked: false },
      ],
    },
    { id: "second", name: "Second", items: [{ id: "four", name: "Four", checked: false }] },
  ],
};

it("moves an item within or between checklists without losing its status", () => {
  const reordered = moveChecklistItem(card, "three", "first", "one");
  expect(reordered.checklists[0].items.map((item) => item.id)).toEqual(["three", "one", "two"]);
  const moved = moveChecklistItem(card, "two", "second", "four");
  expect(moved.checklists[0].items.map((item) => item.id)).toEqual(["one", "three"]);
  expect(moved.checklists[1].items.map((item) => item.id)).toEqual(["two", "four"]);
  expect(moved.checklists[1].items[0]).toMatchObject({ name: "Two", checked: true });
  expect(card.checklists[0].items.map((item) => item.id)).toEqual(["one", "two", "three"]);
  expect(moveChecklistItem(card, "missing", "second")).toBe(card);
});

it("converts a checklist item into a card directly below its parent and records both versions", () => {
  const state = {
    ...emptyState(),
    boards: [
      { id: "board", workspaceId: "workspace", name: "Board", description: "", background: "#fff", starred: false },
    ],
    lists: [{ id: "list", boardId: "board", name: "List", position: 1 }],
    cards: [card, { ...card, id: "next", name: "Next", position: 3, checklists: [] }],
  };
  const before = recordRevision(state, "card", card.id, "device");
  const converted = convertChecklistItem(before, card.id, "first", "two", "created");
  const versioned = recordRevision(recordRevision(converted, "card", card.id, "device"), "card", "created", "device");
  expect(versioned.cards.find((item) => item.id === card.id)?.checklists[0].items.map((item) => item.id)).toEqual([
    "one",
    "three",
  ]);
  expect(versioned.cards.find((item) => item.id === "created")).toMatchObject({
    name: "Two",
    boardId: "board",
    listId: "list",
    position: 2,
    completed: true,
  });
  expect(versioned.revisions.filter((item) => item.entityId === card.id)).toHaveLength(2);
  expect(versioned.revisions.filter((item) => item.entityId === "created")).toHaveLength(1);
  expect(card.checklists[0].items.map((item) => item.id)).toEqual(["one", "two", "three"]);
});

it("keeps a linked checklist item and its dependency unchanged", () => {
  const linked = {
    ...card,
    checklists: [
      { id: "first", name: "Dependency", items: [{ id: "one", name: "Next", checked: false, linkedCardId: "next" }] },
    ],
  };
  const state = {
    ...emptyState(),
    boards: [
      { id: "board", workspaceId: "workspace", name: "Board", description: "", background: "#fff", starred: false },
    ],
    lists: [{ id: "list", boardId: "board", name: "List", position: 1 }],
    cards: [linked, { ...card, id: "next", checklists: [] }],
  };
  expect(convertChecklistItem(state, "card", "first", "one", "created")).toBe(state);
});
