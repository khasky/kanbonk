// Kanbonk operations for AI agents (MCP tools). Pure functions over AppState so the same code runs in the MCP server,
// in tests, and could run in the app. Every change records revisions with the agent's device ID, so it syncs and
// shows up in card history like an edit from any other trusted device.
import { cloneCard, createSubCard, emptyBoardFilter, filterBoardCards, linkDependency, newId, positionBefore, recordRevision, recordRevisions, searchCards, type AppState, type Card } from "../model";
import { moveToTrash, restoreFromTrash, trashEntries, visibleState, type TrashKind } from "../trash";
import { createZone, moveListToList } from "../zones";
import { projectSummary } from "../boardDoc";
import { findDuplicates, mergeDuplicate } from "../dedupe";

type Json = Record<string, unknown>;
export interface ToolDefinition { name: string; description: string; inputSchema: Json; readOnly?: boolean }

const str = (description: string) => ({ type: "string", description });
const obj = (properties: Json, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const trashKinds = ["workspace", "board", "list", "card"];

export const tools: ToolDefinition[] = [
  { name: "list_workspaces", description: "List workspaces with their boards.", inputSchema: obj({}), readOnly: true },
  { name: "get_board", description: "Lists (in order, with zones) and cards of a board.", inputSchema: obj({ boardId: str("Board ID"), keyword: str("Optional text filter") }, ["boardId"]), readOnly: true },
  { name: "search_cards", description: "Search cards on all boards. Supports Trello-like operators: board:, list:, label:, due:, is:, has:, -negation.", inputSchema: obj({ query: str("Search query"), limit: { type: "number", description: "Max results, default 50" } }, ["query"]), readOnly: true },
  { name: "get_card", description: "Full card: description, dates, checklists, comments, sub-cards and dependencies.", inputSchema: obj({ cardId: str("Card ID") }, ["cardId"]), readOnly: true },
  { name: "board_summary", description: "Live project state of a board as Markdown with links to cards.", inputSchema: obj({ boardId: str("Board ID") }, ["boardId"]), readOnly: true },
  { name: "get_board_doc", description: "The board's project document (Markdown). Card links look like [name](/c/<cardId>).", inputSchema: obj({ boardId: str("Board ID") }, ["boardId"]), readOnly: true },
  { name: "find_duplicates", description: "Find cards with similar meaning (titles, descriptions, checklists), by default only on different boards. Review the pairs before merging.", inputSchema: obj({ threshold: { type: "number", description: "Similarity 0..1, default 0.55" }, sameBoard: { type: "boolean", description: "Also pairs on the same board" }, limit: { type: "number", description: "Max pairs, default 50" } }), readOnly: true },
  { name: "list_trash", description: "Items in the trash (kept 30 days).", inputSchema: obj({}), readOnly: true },
  { name: "create_workspace", description: "Create a workspace.", inputSchema: obj({ name: str("Name") }, ["name"]) },
  { name: "create_board", description: "Create a board in a workspace.", inputSchema: obj({ workspaceId: str("Workspace ID"), name: str("Name"), background: str("Background colour #rrggbb") }, ["workspaceId", "name"]) },
  { name: "create_list", description: "Add a list at the right end of a board.", inputSchema: obj({ boardId: str("Board ID"), name: str("Name") }, ["boardId", "name"]) },
  { name: "move_list", description: "Move a list next to another list of the same board.", inputSchema: obj({ listId: str("List to move"), targetListId: str("List to move next to"), after: { type: "boolean", description: "Place after the target (default before)" } }, ["listId", "targetListId"]) },
  { name: "create_zone", description: "Group adjacent lists of a board into a named zone (a list belongs to at most one zone).", inputSchema: obj({ boardId: str("Board ID"), name: str("Zone name"), listIds: { type: "array", items: { type: "string" }, description: "Lists to put in the zone" } }, ["boardId", "name", "listIds"]) },
  { name: "create_card", description: "Create a card at the end of a list, or as a sub-card below its parent.", inputSchema: obj({ listId: str("List ID (ignored when parentCardId is set)"), name: str("Title"), description: str("Markdown description"), startAt: str("ISO date-time"), dueAt: str("ISO date-time"), parentCardId: str("Parent card for a sub-card") }, ["name"]) },
  { name: "update_card", description: "Change card fields. Pass an empty string to clear a date.", inputSchema: obj({ cardId: str("Card ID"), name: str("Title"), description: str("Markdown description"), startAt: str("ISO date-time or empty"), dueAt: str("ISO date-time or empty"), completed: { type: "boolean" }, color: str("Card colour #rrggbb or empty") }, ["cardId"]) },
  { name: "move_card", description: "Move a card to a list, optionally before another card.", inputSchema: obj({ cardId: str("Card ID"), listId: str("Target list"), beforeCardId: str("Place before this card") }, ["cardId", "listId"]) },
  { name: "clone_card", description: "Copy a card right below the original as '<name> - Clone'.", inputSchema: obj({ cardId: str("Card ID") }, ["cardId"]) },
  { name: "add_comment", description: "Add a Markdown comment to a card.", inputSchema: obj({ cardId: str("Card ID"), text: str("Markdown") }, ["cardId", "text"]) },
  { name: "add_checklist", description: "Add a checklist with items to a card.", inputSchema: obj({ cardId: str("Card ID"), name: str("Checklist name"), items: { type: "array", items: { type: "string" } } }, ["cardId", "name"]) },
  { name: "set_checklist_item", description: "Check or uncheck a checklist item.", inputSchema: obj({ cardId: str("Card ID"), itemId: str("Checklist item ID"), checked: { type: "boolean" } }, ["cardId", "itemId", "checked"]) },
  { name: "add_dependency", description: "Mark that a card depends on another card.", inputSchema: obj({ cardId: str("Dependent card"), dependsOnCardId: str("Prerequisite card") }, ["cardId", "dependsOnCardId"]) },
  { name: "merge_cards", description: "Merge a duplicate into another card: description, comments, checklists, attachments, dates and dependency links move over; the duplicate goes to the trash.", inputSchema: obj({ keepCardId: str("Card to keep"), dropCardId: str("Duplicate to merge and trash") }, ["keepCardId", "dropCardId"]) },
  { name: "update_board_doc", description: "Replace the board's project document. Cite cards as [name](/c/<cardId>).", inputSchema: obj({ boardId: str("Board ID"), markdown: str("Document") }, ["boardId", "markdown"]) },
  { name: "delete", description: "Move a workspace, board, list or card to the trash with everything inside it. Restorable for 30 days.", inputSchema: obj({ kind: { type: "string", enum: trashKinds }, id: str("ID") }, ["kind", "id"]) },
  { name: "restore", description: "Restore an item from the trash together with the parents and items it needs.", inputSchema: obj({ kind: { type: "string", enum: trashKinds }, id: str("ID") }, ["kind", "id"]) },
];

export class ToolError extends Error {}

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new ToolError(`${what} not found`);
  return value;
}
const text = (args: Json, key: string, required = false): string | undefined => {
  const value = args[key];
  if (value === undefined || value === null) { if (required) throw new ToolError(`"${key}" is required`); return undefined; }
  if (typeof value !== "string") throw new ToolError(`"${key}" must be a string`);
  if (required && !value.trim()) throw new ToolError(`"${key}" must not be empty`);
  return value;
};
const isoOrClear = (value: string | undefined, key: string): string | undefined | null => {
  if (value === undefined) return undefined;
  if (value === "") return null;
  if (!Number.isFinite(Date.parse(value))) throw new ToolError(`"${key}" must be an ISO date`);
  return new Date(value).toISOString();
};

function cardView(state: AppState, card: Card) {
  const labels = card.labelIds.flatMap((id) => state.labels.filter((label) => label.id === id && !label.deleted).map((label) => label.name || label.color));
  return { id: card.id, name: card.name, listId: card.listId, completed: card.completed, startAt: card.startAt, dueAt: card.dueAt, labels, parentCardId: card.parentCardId };
}

/** Runs one tool. Read-only tools return the same state object. Throws ToolError for bad input. */
export function runTool(full: AppState, name: string, args: Json, deviceId: string, now = new Date()): { state: AppState; result: unknown } {
  const state = visibleState(full);
  const card = (id: unknown) => need(state.cards.find((item) => item.id === id), `Card ${String(id)}`);
  const board = (id: unknown) => need(state.boards.find((item) => item.id === id), `Board ${String(id)}`);
  const list = (id: unknown) => need(state.lists.find((item) => item.id === id), `List ${String(id)}`);
  const changeCard = (id: string, change: (item: Card) => Card) => recordRevision({ ...full, cards: full.cards.map((item) => item.id === id ? change(item) : item) }, "card", id, deviceId);
  const done = (next: AppState, result: unknown) => ({ state: next, result });

  switch (name) {
    case "list_workspaces":
      return done(full, state.workspaces.map((workspace) => ({ id: workspace.id, name: workspace.name, boards: state.boards.filter((item) => item.workspaceId === workspace.id && !item.archived).map((item) => ({ id: item.id, name: item.name })) })));
    case "get_board": {
      const target = board(args.boardId);
      const keyword = text(args, "keyword") ?? "";
      const cards = filterBoardCards(state, target.id, { ...emptyBoardFilter(), keyword });
      const lists = state.lists.filter((item) => item.boardId === target.id && !item.archived).sort((a, b) => a.position - b.position);
      return done(full, { id: target.id, name: target.name, zones: target.zones ?? [], lists: lists.map((item) => ({ id: item.id, name: item.name, zoneId: item.zoneId, cards: cards.filter((entry) => entry.listId === item.id).sort((a, b) => a.position - b.position).map((entry) => cardView(state, entry)) })) });
    }
    case "search_cards": {
      const limit = typeof args.limit === "number" ? Math.max(1, Math.min(500, args.limit)) : 50;
      return done(full, searchCards(state, text(args, "query", true)!, now.getTime()).slice(0, limit).map((item) => ({ ...cardView(state, item), board: state.boards.find((entry) => entry.id === item.boardId)?.name })));
    }
    case "get_card": {
      const target = card(args.cardId);
      return done(full, { ...cardView(state, target), boardId: target.boardId, description: target.description, checklists: target.checklists, comments: target.comments.map(({ author, text: body, createdAt }) => ({ author, text: body, createdAt })), subCards: state.cards.filter((item) => item.parentCardId === target.id).map((item) => cardView(state, item)), dependsOn: target.checklists.flatMap((item) => item.items.flatMap((entry) => entry.linkedCardId ? [entry.linkedCardId] : [])) });
    }
    case "board_summary": return done(full, projectSummary(state, board(args.boardId).id, now.getTime()));
    case "get_board_doc": return done(full, board(args.boardId).doc ?? "");
    case "find_duplicates": {
      const threshold = typeof args.threshold === "number" ? Math.min(1, Math.max(0.1, args.threshold)) : undefined;
      const limit = typeof args.limit === "number" ? Math.max(1, Math.min(500, args.limit)) : 50;
      const boardName = (card: Card) => state.boards.find((item) => item.id === card.boardId)?.name;
      return done(full, findDuplicates(state, { threshold, crossBoardOnly: args.sameBoard !== true }).slice(0, limit).map((pair) => ({ score: Math.round(pair.score * 100) / 100, a: { ...cardView(state, pair.a), board: boardName(pair.a) }, b: { ...cardView(state, pair.b), board: boardName(pair.b) } })));
    }
    case "merge_cards": {
      const keep = card(args.keepCardId);
      const drop = card(args.dropCardId);
      if (keep.id === drop.id) throw new ToolError("keepCardId and dropCardId must differ");
      return done(mergeDuplicate(full, keep.id, drop.id, deviceId), { ok: true, trashed: drop.id });
    }
    case "list_trash": return done(full, trashEntries(full));
    case "create_workspace": {
      const id = newId();
      return done(recordRevision({ ...full, workspaces: [...full.workspaces, { id, name: text(args, "name", true)!.trim() }] }, "workspace", id, deviceId), { id });
    }
    case "create_board": {
      const workspace = need(state.workspaces.find((item) => item.id === args.workspaceId), `Workspace ${String(args.workspaceId)}`);
      const id = newId();
      const background = text(args, "background") ?? "#0c66e4";
      if (!/^#[\da-f]{6}$/i.test(background)) throw new ToolError(`"background" must be #rrggbb`);
      return done(recordRevision({ ...full, boards: [...full.boards, { id, workspaceId: workspace.id, name: text(args, "name", true)!.trim(), description: "", background, members: [], starred: false }] }, "board", id, deviceId), { id });
    }
    case "create_list": {
      const target = board(args.boardId);
      const id = newId();
      const position = Math.max(0, ...full.lists.filter((item) => item.boardId === target.id).map((item) => item.position)) + 1;
      return done(recordRevision({ ...full, lists: [...full.lists, { id, boardId: target.id, name: text(args, "name", true)!.trim(), position }] }, "list", id, deviceId), { id });
    }
    case "move_list": {
      const moving = list(args.listId);
      const target = list(args.targetListId);
      if (moving.boardId !== target.boardId) throw new ToolError("Lists are on different boards");
      return done(moveListToList(full, moving.id, target.id, args.after === true, deviceId), { ok: true });
    }
    case "create_zone": {
      const target = board(args.boardId);
      const listIds = Array.isArray(args.listIds) ? args.listIds.map(String) : [];
      if (!listIds.length || listIds.some((id) => list(id).boardId !== target.id)) throw new ToolError("listIds must name lists of this board");
      const created = createZone(full, target.id, text(args, "name", true)!.trim(), listIds, deviceId);
      return done(created.state, { id: created.zoneId });
    }
    case "create_card": {
      const name = text(args, "name", true)!.trim();
      const id = newId();
      const parentId = text(args, "parentCardId");
      let next: AppState;
      if (parentId) next = createSubCard(full, card(parentId).id, name, id, now.toISOString());
      else {
        const target = list(args.listId);
        const created: Card = { id, boardId: target.boardId, listId: target.id, name, description: "", createdAt: now.toISOString(), position: Math.max(0, ...full.cards.filter((item) => item.listId === target.id).map((item) => item.position)) + 1, labelIds: [], completed: false, checklists: [], comments: [], attachments: [] };
        next = { ...full, cards: [...full.cards, created] };
      }
      const startAt = isoOrClear(text(args, "startAt"), "startAt") ?? undefined;
      const dueAt = isoOrClear(text(args, "dueAt"), "dueAt") ?? undefined;
      next = { ...next, cards: next.cards.map((item) => item.id === id ? { ...item, description: text(args, "description") ?? "", startAt, dueAt } : item) };
      return done(recordRevision(next, "card", id, deviceId), { id });
    }
    case "update_card": {
      const target = card(args.cardId);
      const startAt = isoOrClear(text(args, "startAt"), "startAt");
      const dueAt = isoOrClear(text(args, "dueAt"), "dueAt");
      const color = text(args, "color");
      if (color && !/^#[\da-f]{6}$/i.test(color)) throw new ToolError(`"color" must be #rrggbb`);
      return done(changeCard(target.id, (item) => ({
        ...item,
        name: text(args, "name")?.trim() || item.name,
        description: text(args, "description") ?? item.description,
        startAt: startAt === undefined ? item.startAt : startAt ?? undefined,
        dueAt: dueAt === undefined ? item.dueAt : dueAt ?? undefined,
        completed: typeof args.completed === "boolean" ? args.completed : item.completed,
        cover: color === undefined ? item.cover : color ? { color, size: "full" } : undefined,
      })), { ok: true });
    }
    case "move_card": {
      const moving = card(args.cardId);
      const target = list(args.listId);
      if (target.boardId !== moving.boardId) throw new ToolError("Moving cards between boards is not supported by this tool");
      const before = text(args, "beforeCardId");
      const position = before ? positionBefore(full.cards, moving.id, { ...card(before), listId: target.id }) : Math.max(0, ...full.cards.filter((item) => item.listId === target.id && item.id !== moving.id).map((item) => item.position)) + 1;
      return done(changeCard(moving.id, (item) => ({ ...item, listId: target.id, position })), { ok: true });
    }
    case "clone_card": {
      const cloned = cloneCard(full, card(args.cardId).id);
      return done(recordRevision(cloned.state, "card", cloned.cardId, deviceId), { id: cloned.cardId });
    }
    case "add_comment": {
      const target = card(args.cardId);
      const comment = { id: newId(), text: text(args, "text", true)!, author: "AI agent", authorDeviceId: deviceId, createdAt: now.toISOString() };
      return done(changeCard(target.id, (item) => ({ ...item, comments: [...item.comments, comment] })), { id: comment.id });
    }
    case "add_checklist": {
      const target = card(args.cardId);
      const items = Array.isArray(args.items) ? args.items.map(String).filter((item) => item.trim()) : [];
      const checklist = { id: newId(), name: text(args, "name", true)!.trim(), items: items.map((item) => ({ id: newId(), name: item.trim(), checked: false })) };
      return done(changeCard(target.id, (item) => ({ ...item, checklists: [...item.checklists, checklist] })), checklist);
    }
    case "set_checklist_item": {
      const target = card(args.cardId);
      if (!target.checklists.some((item) => item.items.some((entry) => entry.id === args.itemId))) throw new ToolError(`Checklist item ${String(args.itemId)} not found`);
      return done(changeCard(target.id, (item) => ({ ...item, checklists: item.checklists.map((checklist) => ({ ...checklist, items: checklist.items.map((entry) => entry.id === args.itemId ? { ...entry, checked: args.checked === true } : entry) })) })), { ok: true });
    }
    case "add_dependency": {
      const dependent = card(args.cardId);
      const prerequisite = card(args.dependsOnCardId);
      return done(recordRevisions(linkDependency(full, dependent.id, prerequisite.id), [{ kind: "card", id: dependent.id }, { kind: "card", id: prerequisite.id }], deviceId), { ok: true });
    }
    case "update_board_doc": {
      const target = board(args.boardId);
      const markdown = text(args, "markdown", true)!;
      return done(recordRevision({ ...full, boards: full.boards.map((item) => item.id === target.id ? { ...item, doc: markdown } : item) }, "board", target.id, deviceId), { ok: true });
    }
    case "delete": {
      const kind = String(args.kind) as TrashKind;
      if (!trashKinds.includes(kind)) throw new ToolError(`"kind" must be one of ${trashKinds.join(", ")}`);
      const collection = { workspace: state.workspaces, board: state.boards, list: state.lists, card: state.cards }[kind] as Array<{ id: string }>;
      need(collection.find((item) => item.id === args.id), `${kind} ${String(args.id)}`);
      return done(moveToTrash(full, kind, String(args.id), deviceId, { now: now.toISOString() }), { ok: true, restorableDays: 30 });
    }
    case "restore": {
      const kind = String(args.kind) as TrashKind;
      if (!trashKinds.includes(kind)) throw new ToolError(`"kind" must be one of ${trashKinds.join(", ")}`);
      const restored = restoreFromTrash(full, kind, String(args.id), deviceId);
      if (!restored.restored.length) throw new ToolError(`${kind} ${String(args.id)} is not in the trash`);
      return done(restored.state, { restored: restored.restored });
    }
    default: throw new ToolError(`Unknown tool ${name}`);
  }
}

