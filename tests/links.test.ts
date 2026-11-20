import { expect, it } from "vitest";
import { emptyState, isCardAvailable, linkDependency, unlinkDependency, type Card } from "../src/model";
import { importedCardForUrl, relatedCards } from "../src/links";
import { addImportedBoard, parseTrelloBoard } from "../src/importTrello";

it.each(["source first", "target first"])(
  "resolves Trello checklist and attachment links when importing %s",
  (order) => {
    const source = parseTrelloBoard(
      {
        id: "source-board",
        name: "Source",
        lists: [{ id: "source-list", name: "Tasks" }],
        cards: [
          {
            id: "source-card",
            idList: "source-list",
            name: "Dependent",
            attachments: [
              { id: "link", name: "Prerequisite", url: "https://trello.com/c/TARGET12/prerequisite", isUpload: false },
            ],
          },
        ],
        checklists: [
          {
            id: "checklist",
            idCard: "source-card",
            name: "Dependencies",
            checkItems: [{ id: "item", name: "https://trello.com/c/TARGET12/prerequisite", state: "incomplete" }],
          },
        ],
      },
      "workspace",
    );
    const target = parseTrelloBoard(
      {
        id: "target-board",
        name: "Target",
        lists: [{ id: "target-list", name: "Tasks" }],
        cards: [{ id: "target-card", shortLink: "TARGET12", idList: "target-list", name: "Prerequisite" }],
      },
      "workspace",
    );
    const boards = order === "source first" ? [source, target] : [target, source];
    const state = boards.reduce(addImportedBoard, emptyState());
    const card = state.cards.find((item) => item.sourceTrelloId === "source-card")!;
    const links = relatedCards(card, state);

    expect(card.checklists[0].items[0]).toMatchObject({
      checked: false,
      name: "https://trello.com/c/TARGET12/prerequisite",
    });
    expect(card.attachments[0]).toMatchObject({
      status: "link",
      sourceUrl: "https://trello.com/c/TARGET12/prerequisite",
    });
    expect(links.map((link) => link.source)).toEqual(["Dependencies", "Attachment"]);
    expect(links.every((link) => link.target?.sourceTrelloId === "target-card")).toBe(true);
  },
);

it("resolves imported Trello card links from descriptions and checklists", () => {
  const target: Card = {
    id: "local-2",
    boardId: "board-2",
    listId: "list-2",
    name: "Dependency",
    description: "",
    position: 1,
    labelIds: [],
    completed: false,
    checklists: [],
    comments: [],
    attachments: [],
    sourceTrelloShortLink: "ABC123",
  };
  const source: Card = {
    id: "local-1",
    boardId: "board-1",
    listId: "list-1",
    name: "Task",
    description: "See https://trello.com/c/ABC123/example",
    position: 1,
    labelIds: [],
    completed: false,
    checklists: [
      {
        id: "checklist",
        name: "Dependencies",
        items: [{ id: "item", name: "https://trello.com/c/ABC123/example", checked: false }],
      },
    ],
    comments: [],
    attachments: [],
  };
  const links = relatedCards(source, { ...emptyState(), cards: [source, target] });
  expect(links).toHaveLength(2);
  expect(links.map((link) => link.source)).toEqual(["Description", "Dependencies"]);
  expect(links.every((link) => link.target?.id === target.id)).toBe(true);
});

it("resolves a card URL across boards without accepting lookalike hosts", () => {
  const target: Card = {
    id: "local-2",
    boardId: "board-2",
    listId: "list-2",
    name: "Target",
    description: "",
    position: 1,
    labelIds: [],
    completed: false,
    checklists: [],
    comments: [],
    attachments: [],
    sourceTrelloShortLink: "ABC123",
  };
  const state = { ...emptyState(), cards: [target] };
  expect(importedCardForUrl("https://trello.com/c/ABC123/task?x=1", state)).toBe(target);
  expect(importedCardForUrl("https://www.trello.com/c/ABC123", state)).toBe(target);
  expect(importedCardForUrl("https://trello.com.evil.example/c/ABC123", state)).toBeUndefined();
  expect(importedCardForUrl("https://trello.com/c/UNKNOWN", state)).toBeUndefined();
});

it("shows a Trello Markdown card link only once", () => {
  const target: Card = {
    id: "target",
    boardId: "board",
    listId: "list",
    name: "Target",
    description: "",
    position: 1,
    labelIds: [],
    completed: false,
    checklists: [],
    comments: [],
    attachments: [],
    sourceTrelloShortLink: "ABC123",
  };
  const source: Card = {
    ...target,
    id: "source",
    sourceTrelloShortLink: undefined,
    description: '[https://trello.com/c/ABC123](https://trello.com/c/ABC123 "smartCard-inline")',
  };
  expect(relatedCards(source, { ...emptyState(), cards: [source, target] }).map((link) => link.target?.id)).toEqual([
    "target",
  ]);
});

it("creates a local dependency checklist and reciprocal card attachment", () => {
  const prerequisite: Card = {
    id: "needed",
    boardId: "board",
    listId: "list",
    name: "First",
    description: "",
    position: 1,
    labelIds: [],
    completed: false,
    checklists: [],
    comments: [],
    attachments: [],
  };
  const dependent: Card = { ...structuredClone(prerequisite), id: "later", name: "Then" };
  const state = {
    ...emptyState(),
    boards: [
      { id: "board", workspaceId: "workspace", name: "Board", description: "", background: "#fff", starred: false },
    ],
    lists: [{ id: "list", boardId: "board", name: "Tasks", position: 1 }],
    cards: [dependent, prerequisite],
  };
  const linked = linkDependency(state, dependent.id, prerequisite.id);
  expect(linked.cards[0].checklists[0].items[0]).toMatchObject({
    name: "First",
    linkedCardId: "needed",
    checked: false,
  });
  expect(linked.cards[1].attachments[0]).toMatchObject({ name: "Then", linkedCardId: "later", status: "link" });
  expect(relatedCards(linked.cards[0], linked)[0].target?.id).toBe("needed");
  expect(relatedCards(linked.cards[1], linked)[0].target?.id).toBe("later");
  expect(linkDependency(linked, dependent.id, prerequisite.id)).toBe(linked);
  expect(() => linkDependency(state, dependent.id, dependent.id)).toThrow("unavailable");
  const archived = { ...linked, cards: [linked.cards[0], { ...linked.cards[1], archived: true }] };
  expect(isCardAvailable(archived, archived.cards[1])).toBe(false);
  expect(() => linkDependency(archived, dependent.id, prerequisite.id)).toThrow("unavailable");
  const unlinked = unlinkDependency(linked, dependent.id, prerequisite.id);
  expect(unlinked.cards[0].checklists[0].items).toEqual([]);
  expect(unlinked.cards[1].attachments).toEqual([]);
  expect(unlinkDependency(unlinked, dependent.id, prerequisite.id)).toBe(unlinked);
  const missingTarget = { ...linked, cards: [linked.cards[0]] };
  expect(unlinkDependency(missingTarget, dependent.id, prerequisite.id).cards[0].checklists[0].items).toEqual([]);
});
