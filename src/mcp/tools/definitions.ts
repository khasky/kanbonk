export type Json = Record<string, unknown>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Json;
  readOnly?: boolean;
}

const str = (description: string) => ({ type: "string", description });

const obj = (properties: Json, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

export const trashKinds = ["workspace", "board", "list", "card"];

/** How two cards can be linked; see model/connections. */
export const connectionKinds = ["blocks", "parent", "relates", "duplicates"];

const ids = (description: string) => ({ type: "array", items: { type: "string" }, description });

const linkSchema = obj(
  {
    kind: {
      type: "string",
      enum: connectionKinds,
      description:
        "blocks: from must be finished before to; parent: to becomes a sub-card of from (same board); relates; duplicates: from duplicates to",
    },
    fromCardId: str("Card the link starts at"),
    toCardId: str("Card the link points to"),
  },
  ["kind", "fromCardId", "toCardId"],
);

export const tools: ToolDefinition[] = [
  { name: "list_workspaces", description: "List workspaces with their boards.", inputSchema: obj({}), readOnly: true },
  {
    name: "get_board",
    description:
      "Lists (in order, with zones, color, card limit and card count) and cards of a board, with its labels, members, required fields and done settings.",
    inputSchema: obj({ boardId: str("Board ID"), keyword: str("Optional text filter") }, ["boardId"]),
    readOnly: true,
  },
  {
    name: "search_cards",
    description:
      "Search cards on all boards. Supports Trello-like operators: board:, list:, label:, due:, is:, has:, -negation.",
    inputSchema: obj(
      { query: str("Search query"), limit: { type: "number", description: "Max results, default 50" } },
      ["query"],
    ),
    readOnly: true,
  },
  {
    name: "get_card",
    description:
      "Full card: description, dates, priority, done, labels, members, checklists, comments, approvals, links (sub-cards, dependencies, related, duplicates), mirrors and the required fields it lacks.",
    inputSchema: obj({ cardId: str("Card ID") }, ["cardId"]),
    readOnly: true,
  },
  {
    name: "board_summary",
    description: "Live project state of a board as Markdown with links to cards.",
    inputSchema: obj({ boardId: str("Board ID") }, ["boardId"]),
    readOnly: true,
  },
  {
    name: "get_board_doc",
    description: "The board's project document (Markdown). Card links look like [name](/c/<cardId>).",
    inputSchema: obj({ boardId: str("Board ID") }, ["boardId"]),
    readOnly: true,
  },
  {
    name: "find_duplicates",
    description:
      "Find cards with similar meaning (titles, descriptions, checklists), by default only on different boards. Review the pairs before merging.",
    inputSchema: obj({
      threshold: { type: "number", description: "Similarity 0..1, default 0.55" },
      sameBoard: { type: "boolean", description: "Also pairs on the same board" },
      limit: { type: "number", description: "Max pairs, default 50" },
    }),
    readOnly: true,
  },
  { name: "list_trash", description: "Items in the trash (kept 30 days).", inputSchema: obj({}), readOnly: true },
  { name: "create_workspace", description: "Create a workspace.", inputSchema: obj({ name: str("Name") }, ["name"]) },
  {
    name: "create_board",
    description: "Create a board in a workspace.",
    inputSchema: obj(
      { workspaceId: str("Workspace ID"), name: str("Name"), background: str("Background colour #rrggbb") },
      ["workspaceId", "name"],
    ),
  },
  {
    name: "create_list",
    description: "Add a list at the right end of a board.",
    inputSchema: obj({ boardId: str("Board ID"), name: str("Name") }, ["boardId", "name"]),
  },
  {
    name: "update_list",
    description: "Rename a list, change its color, or set the most cards it should hold (the list turns red above it).",
    inputSchema: obj(
      {
        listId: str("List ID"),
        name: str("Name"),
        color: str("green, yellow, orange, red, purple, blue, sky, lime, pink, black, or empty to remove"),
        cardLimit: { type: "number", description: "Most cards in the list; 0 removes the limit" },
      },
      ["listId"],
    ),
  },
  {
    name: "move_list",
    description: "Move a list next to another list of the same board.",
    inputSchema: obj(
      {
        listId: str("List to move"),
        targetListId: str("List to move next to"),
        after: { type: "boolean", description: "Place after the target (default before)" },
      },
      ["listId", "targetListId"],
    ),
  },
  {
    name: "create_zone",
    description: "Group adjacent lists of a board into a named zone (a list belongs to at most one zone).",
    inputSchema: obj(
      {
        boardId: str("Board ID"),
        name: str("Zone name"),
        listIds: { type: "array", items: { type: "string" }, description: "Lists to put in the zone" },
      },
      ["boardId", "name", "listIds"],
    ),
  },
  {
    name: "create_card",
    description: "Create a card at the end of a list, or as a sub-card below its parent.",
    inputSchema: obj(
      {
        listId: str("List ID (ignored when parentCardId is set)"),
        name: str("Title"),
        description: str("Markdown description"),
        startAt: str("ISO date-time"),
        dueAt: str("ISO date-time"),
        parentCardId: str("Parent card for a sub-card"),
      },
      ["name"],
    ),
  },
  {
    name: "update_card",
    description:
      "Change card fields. Pass an empty string to clear a date, colour or priority. done finishes or reopens the card under the board's done settings.",
    inputSchema: obj(
      {
        cardId: str("Card ID"),
        name: str("Title"),
        description: str("Markdown description"),
        startAt: str("ISO date-time or empty"),
        dueAt: str("ISO date-time or empty"),
        color: str("Card colour #rrggbb or empty"),
        priority: str("critical, high, medium, low, or empty for none"),
        done: { type: "boolean", description: "Finish (true) or reopen (false) the card" },
        isEpic: { type: "boolean", description: "Mark the card as an epic that gathers its sub-cards" },
        labelIds: ids("Labels of the card's board; replaces the card's labels"),
        memberIds: ids("Members of the card's board; replaces the card's members"),
      },
      ["cardId"],
    ),
  },
  {
    name: "move_card",
    description:
      "Move a card to a list on any board, optionally before another card. The board's required fields and move rules apply as in the app.",
    inputSchema: obj(
      { cardId: str("Card ID"), listId: str("Target list"), beforeCardId: str("Place before this card of the list") },
      ["cardId", "listId"],
    ),
  },
  {
    name: "clone_card",
    description: "Copy a card right below the original as '<name> - Clone'.",
    inputSchema: obj({ cardId: str("Card ID") }, ["cardId"]),
  },
  {
    name: "mirror_card",
    description: "Put a mirror of the card at the end of a list on any board; mirrors stay alike when either changes.",
    inputSchema: obj({ cardId: str("Card ID"), listId: str("List for the mirror") }, ["cardId", "listId"]),
  },
  {
    name: "add_comment",
    description: "Add a Markdown comment to a card.",
    inputSchema: obj({ cardId: str("Card ID"), text: str("Markdown") }, ["cardId", "text"]),
  },
  {
    name: "add_checklist",
    description: "Add a checklist with items to a card.",
    inputSchema: obj(
      { cardId: str("Card ID"), name: str("Checklist name"), items: { type: "array", items: { type: "string" } } },
      ["cardId", "name"],
    ),
  },
  {
    name: "set_checklist_item",
    description: "Check or uncheck a checklist item.",
    inputSchema: obj({ cardId: str("Card ID"), itemId: str("Checklist item ID"), checked: { type: "boolean" } }, [
      "cardId",
      "itemId",
      "checked",
    ]),
  },
  {
    name: "add_dependency",
    description: "Mark that a card depends on another card.",
    inputSchema: obj({ cardId: str("Dependent card"), dependsOnCardId: str("Prerequisite card") }, [
      "cardId",
      "dependsOnCardId",
    ]),
  },
  {
    name: "link_cards",
    description: "Link two cards: a dependency, a sub-card, related cards or a duplicate.",
    inputSchema: linkSchema,
  },
  { name: "unlink_cards", description: "Remove a link between two cards.", inputSchema: linkSchema },
  {
    name: "merge_cards",
    description:
      "Merge a duplicate into another card: description, comments, checklists, attachments, labels, members, dates and dependency links move over; the duplicate goes to the trash.",
    inputSchema: obj({ keepCardId: str("Card to keep"), dropCardId: str("Duplicate to merge and trash") }, [
      "keepCardId",
      "dropCardId",
    ]),
  },
  {
    name: "update_board_doc",
    description: "Replace the board's project document. Cite cards as [name](/c/<cardId>).",
    inputSchema: obj({ boardId: str("Board ID"), markdown: str("Document") }, ["boardId", "markdown"]),
  },
  {
    name: "delete",
    description:
      "Move a workspace, board, list or card to the trash with everything inside it. Restorable for 30 days.",
    inputSchema: obj({ kind: { type: "string", enum: trashKinds }, id: str("ID") }, ["kind", "id"]),
  },
  {
    name: "restore",
    description: "Restore an item from the trash together with the parents and items it needs.",
    inputSchema: obj({ kind: { type: "string", enum: trashKinds }, id: str("ID") }, ["kind", "id"]),
  },
];
