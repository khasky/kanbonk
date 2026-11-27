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

export const tools: ToolDefinition[] = [
  { name: "list_workspaces", description: "List workspaces with their boards.", inputSchema: obj({}), readOnly: true },
  {
    name: "get_board",
    description: "Lists (in order, with zones) and cards of a board.",
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
    description: "Full card: description, dates, checklists, comments, sub-cards and dependencies.",
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
    description: "Change card fields. Pass an empty string to clear a date.",
    inputSchema: obj(
      {
        cardId: str("Card ID"),
        name: str("Title"),
        description: str("Markdown description"),
        startAt: str("ISO date-time or empty"),
        dueAt: str("ISO date-time or empty"),
        color: str("Card colour #rrggbb or empty"),
      },
      ["cardId"],
    ),
  },
  {
    name: "move_card",
    description: "Move a card to a list, optionally before another card.",
    inputSchema: obj(
      { cardId: str("Card ID"), listId: str("Target list"), beforeCardId: str("Place before this card") },
      ["cardId", "listId"],
    ),
  },
  {
    name: "clone_card",
    description: "Copy a card right below the original as '<name> - Clone'.",
    inputSchema: obj({ cardId: str("Card ID") }, ["cardId"]),
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
