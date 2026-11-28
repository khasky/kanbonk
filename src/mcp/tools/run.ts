// Kanbonk operations for AI agents (MCP tools). Pure functions over AppState so the same code runs in the MCP server,
// in tests, and could run in the app. Every change records revisions with the agent's device ID, so it syncs and
// shows up in card history like an edit from any other trusted device.
import {
  approvalStatus,
  blockedMove,
  cloneCard,
  createSubCard,
  emptyBoardFilter,
  filterBoardCards,
  finishCard,
  isPriority,
  linkDependency,
  mirrorCard,
  mirrorsOf,
  missingFields,
  newId,
  positionBefore,
  recordRevision,
  recordRevisions,
  reopenCard,
  searchCards,
  syncMirrors,
  threadOrder,
  transferCard,
  type AppState,
  type Card,
} from "../../model";
import { applyMoveRules } from "../../model/automation";
import {
  allConnections,
  canConnect,
  cardConnections,
  connect,
  disconnect,
  type ConnectionKind,
} from "../../model/connections";
import { listColors } from "../../model/labelColors";
import {
  moveToTrash,
  restoreFromTrash,
  trashEntries,
  trashSubCards,
  visibleState,
  type TrashKind,
} from "../../model/trash";
import { createZone, moveListToList } from "../../model/zones";
import { projectSummary } from "../../model/boardDoc";
import { findDuplicates, mergeDuplicate } from "../../model/dedupe";
import { moveBlockedText } from "../../model/requiredFieldsText";
import { connectionKinds, type Json, trashKinds } from "./definitions";

export class ToolError extends Error {}

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new ToolError(`${what} not found`);
  return value;
}

const text = (args: Json, key: string, required = false): string | undefined => {
  const value = args[key];
  if (value === undefined || value === null) {
    if (required) throw new ToolError(`"${key}" is required`);
    return undefined;
  }
  if (typeof value !== "string") throw new ToolError(`"${key}" must be a string`);
  if (required && !value.trim()) throw new ToolError(`"${key}" must not be empty`);
  return value;
};

/** An array of strings, or undefined when the argument is absent. */
const texts = (args: Json, key: string): string[] | undefined => {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new ToolError(`"${key}" must be an array of strings`);
  return value;
};

const isoOrClear = (value: string | undefined, key: string): string | undefined | null => {
  if (value === undefined) return undefined;
  if (value === "") return null;
  if (!Number.isFinite(Date.parse(value))) throw new ToolError(`"${key}" must be an ISO date`);
  return new Date(value).toISOString();
};

function cardView(state: AppState, card: Card) {
  const labels = card.labelIds.flatMap((id) =>
    state.labels.filter((label) => label.id === id && !label.deleted).map((label) => label.name || label.color),
  );
  return {
    id: card.id,
    name: card.name,
    listId: card.listId,
    startAt: card.startAt,
    dueAt: card.dueAt,
    labels,
    parentCardId: card.parentCardId,
    priority: card.priority,
    doneAt: card.doneAt,
    isEpic: card.isEpic,
    approval: approvalStatus(card),
    mirrored: Boolean(card.mirrorId) || undefined,
  };
}

/** Runs one tool. Read-only tools return the same state object. Throws ToolError for bad input. */
export function runTool(
  full: AppState,
  name: string,
  args: Json,
  deviceId: string,
  now = new Date(),
): { state: AppState; result: unknown } {
  const state = visibleState(full);
  const card = (id: unknown) =>
    need(
      state.cards.find((item) => item.id === id),
      `Card ${String(id)}`,
    );
  const board = (id: unknown) =>
    need(
      state.boards.find((item) => item.id === id),
      `Board ${String(id)}`,
    );
  const list = (id: unknown) =>
    need(
      state.lists.find((item) => item.id === id),
      `List ${String(id)}`,
    );
  const changeCard = (id: string, change: (item: Card) => Card) =>
    recordRevision(
      { ...full, cards: full.cards.map((item) => (item.id === id ? change(item) : item)) },
      "card",
      id,
      deviceId,
    );
  const done = (next: AppState, result: unknown) => ({
    state: next === full ? next : syncMirrors(full, next, deviceId),
    result,
  });
  const kind = (value: unknown): ConnectionKind => {
    if (!connectionKinds.includes(value as ConnectionKind))
      throw new ToolError(`"kind" must be one of ${connectionKinds.join(", ")}`);
    return value as ConnectionKind;
  };

  switch (name) {
    case "list_workspaces":
      return done(
        full,
        state.workspaces.map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
          boards: state.boards
            .filter((item) => item.workspaceId === workspace.id && !item.deletedAt)
            .map((item) => ({ id: item.id, name: item.name })),
        })),
      );
    case "get_board": {
      const target = board(args.boardId);
      const keyword = text(args, "keyword") ?? "";
      const cards = filterBoardCards(state, target.id, { ...emptyBoardFilter(), keyword });
      const lists = state.lists
        .filter((item) => item.boardId === target.id && !item.deletedAt)
        .sort((a, b) => a.position - b.position);
      const all = keyword ? filterBoardCards(state, target.id, emptyBoardFilter()) : cards;
      return done(full, {
        id: target.id,
        name: target.name,
        zones: target.zones ?? [],
        labels: state.labels
          .filter((item) => item.boardId === target.id && !item.deleted)
          .map(({ id, name, color }) => ({ id, name, color })),
        members: target.members ?? [],
        requiredFields: target.requiredFields,
        cardDone: target.cardDone,
        lists: lists.map((item) => ({
          id: item.id,
          name: item.name,
          zoneId: item.zoneId,
          color: item.color,
          cardLimit: item.cardLimit,
          cardCount: all.filter((entry) => entry.listId === item.id).length,
          cards: cards
            .filter((entry) => entry.listId === item.id)
            .sort((a, b) => a.position - b.position)
            .map((entry) => cardView(state, entry)),
        })),
      });
    }
    case "search_cards": {
      const limit = typeof args.limit === "number" ? Math.max(1, Math.min(500, args.limit)) : 50;
      return done(
        full,
        searchCards(state, text(args, "query", true)!, now.getTime())
          .slice(0, limit)
          .map((item) => ({
            ...cardView(state, item),
            board: state.boards.find((entry) => entry.id === item.boardId)?.name,
          })),
      );
    }
    case "get_card": {
      const target = card(args.cardId);
      return done(full, {
        ...cardView(state, target),
        boardId: target.boardId,
        description: target.description,
        checklists: target.checklists,
        comments: threadOrder(target.comments).map(({ comment }) => ({
          id: comment.id,
          parentId: comment.parentId,
          author: comment.author,
          text: comment.text,
          createdAt: comment.createdAt,
          deleted: comment.deleted,
        })),
        subCards: state.cards.filter((item) => item.parentCardId === target.id).map((item) => cardView(state, item)),
        dependsOn: target.checklists.flatMap((item) =>
          item.items.flatMap((entry) => (entry.linkedCardId ? [entry.linkedCardId] : [])),
        ),
        members: (target.memberIds ?? []).map((id) => ({
          id,
          name: state.boards.find((item) => item.id === target.boardId)?.members?.find((member) => member.id === id)
            ?.name,
        })),
        approvals: target.approvals ?? [],
        connections: Object.fromEntries(
          Object.entries(cardConnections(state, target.id)).map(([group, entries]) => [
            group,
            entries.map(({ card: other }) => ({ id: other.id, name: other.name, boardId: other.boardId })),
          ]),
        ),
        mirrors: mirrorsOf(state, target).map((item) => ({ id: item.id, boardId: item.boardId, listId: item.listId })),
        missingRequired: missingFields(target, state.boards.find((item) => item.id === target.boardId)?.requiredFields),
      });
    }
    case "board_summary":
      return done(full, projectSummary(state, board(args.boardId).id, now.getTime()));
    case "get_board_doc":
      return done(full, board(args.boardId).doc ?? "");
    case "find_duplicates": {
      const threshold = typeof args.threshold === "number" ? Math.min(1, Math.max(0.1, args.threshold)) : undefined;
      const limit = typeof args.limit === "number" ? Math.max(1, Math.min(500, args.limit)) : 50;
      const boardName = (card: Card) => state.boards.find((item) => item.id === card.boardId)?.name;
      return done(
        full,
        findDuplicates(state, { threshold, crossBoardOnly: args.sameBoard !== true })
          .slice(0, limit)
          .map((pair) => ({
            score: Math.round(pair.score * 100) / 100,
            a: { ...cardView(state, pair.a), board: boardName(pair.a) },
            b: { ...cardView(state, pair.b), board: boardName(pair.b) },
          })),
      );
    }
    case "merge_cards": {
      const keep = card(args.keepCardId);
      const drop = card(args.dropCardId);
      if (keep.id === drop.id) throw new ToolError("keepCardId and dropCardId must differ");
      return done(mergeDuplicate(full, keep.id, drop.id, deviceId), { ok: true, trashed: drop.id });
    }
    case "list_trash":
      return done(full, trashEntries(full));
    case "create_workspace": {
      const id = newId();
      return done(
        recordRevision(
          { ...full, workspaces: [...full.workspaces, { id, name: text(args, "name", true)!.trim() }] },
          "workspace",
          id,
          deviceId,
        ),
        { id },
      );
    }
    case "create_board": {
      const workspace = need(
        state.workspaces.find((item) => item.id === args.workspaceId),
        `Workspace ${String(args.workspaceId)}`,
      );
      const id = newId();
      const background = text(args, "background") ?? "#0c66e4";
      if (!/^#[\da-f]{6}$/i.test(background)) throw new ToolError(`"background" must be #rrggbb`);
      return done(
        recordRevision(
          {
            ...full,
            boards: [
              ...full.boards,
              {
                id,
                workspaceId: workspace.id,
                name: text(args, "name", true)!.trim(),
                description: "",
                background,
                members: [],
                starred: false,
              },
            ],
          },
          "board",
          id,
          deviceId,
        ),
        { id },
      );
    }
    case "create_list": {
      const target = board(args.boardId);
      const id = newId();
      const position =
        Math.max(0, ...full.lists.filter((item) => item.boardId === target.id).map((item) => item.position)) + 1;
      return done(
        recordRevision(
          {
            ...full,
            lists: [...full.lists, { id, boardId: target.id, name: text(args, "name", true)!.trim(), position }],
          },
          "list",
          id,
          deviceId,
        ),
        { id },
      );
    }
    case "update_list": {
      const target = list(args.listId);
      const color = text(args, "color");
      if (color && !listColors.includes(color)) throw new ToolError(`"color" must be one of ${listColors.join(", ")}`);
      const limit = args.cardLimit;
      if (limit !== undefined && (typeof limit !== "number" || !Number.isInteger(limit) || limit < 0))
        throw new ToolError(`"cardLimit" must be a whole number, 0 to remove the limit`);
      return done(
        recordRevision(
          {
            ...full,
            lists: full.lists.map((item) =>
              item.id === target.id
                ? {
                    ...item,
                    name: text(args, "name")?.trim() || item.name,
                    color: color === undefined ? item.color : color || undefined,
                    cardLimit: limit === undefined ? item.cardLimit : (limit as number) || undefined,
                  }
                : item,
            ),
          },
          "list",
          target.id,
          deviceId,
        ),
        { ok: true },
      );
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
      if (!listIds.length || listIds.some((id) => list(id).boardId !== target.id))
        throw new ToolError("listIds must name lists of this board");
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
        const created: Card = {
          id,
          boardId: target.boardId,
          listId: target.id,
          name,
          description: "",
          createdAt: now.toISOString(),
          position:
            Math.max(0, ...full.cards.filter((item) => item.listId === target.id).map((item) => item.position)) + 1,
          labelIds: [],
          checklists: [],
          comments: [],
          attachments: [],
        };
        next = { ...full, cards: [...full.cards, created] };
      }
      const startAt = isoOrClear(text(args, "startAt"), "startAt") ?? undefined;
      const dueAt = isoOrClear(text(args, "dueAt"), "dueAt") ?? undefined;
      next = {
        ...next,
        cards: next.cards.map((item) =>
          item.id === id ? { ...item, description: text(args, "description") ?? "", startAt, dueAt } : item,
        ),
      };
      return done(recordRevision(next, "card", id, deviceId), { id });
    }
    case "update_card": {
      const target = card(args.cardId);
      const startAt = isoOrClear(text(args, "startAt"), "startAt");
      const dueAt = isoOrClear(text(args, "dueAt"), "dueAt");
      const color = text(args, "color");
      if (color && !/^#[\da-f]{6}$/i.test(color)) throw new ToolError(`"color" must be #rrggbb`);
      const priority = text(args, "priority");
      if (priority && !isPriority(priority))
        throw new ToolError(`"priority" must be critical, high, medium, low or empty`);
      const labelIds = texts(args, "labelIds");
      if (labelIds?.some((id) => !state.labels.some((item) => item.id === id && item.boardId === target.boardId)))
        throw new ToolError("labelIds must name labels of the card's board");
      const memberIds = texts(args, "memberIds");
      const members = board(target.boardId).members ?? [];
      if (memberIds?.some((id) => !members.some((member) => member.id === id)))
        throw new ToolError("memberIds must name members of the card's board");
      let next = changeCard(target.id, (item) => ({
        ...item,
        name: text(args, "name")?.trim() || item.name,
        description: text(args, "description") ?? item.description,
        startAt: startAt === undefined ? item.startAt : (startAt ?? undefined),
        dueAt: dueAt === undefined ? item.dueAt : (dueAt ?? undefined),
        cover: color === undefined ? item.cover : color ? { color } : undefined,
        priority: priority === undefined ? item.priority : isPriority(priority) ? priority : undefined,
        isEpic: typeof args.isEpic === "boolean" ? args.isEpic || undefined : item.isEpic,
        labelIds: labelIds ?? item.labelIds,
        memberIds: memberIds ? (memberIds.length ? memberIds : undefined) : item.memberIds,
      }));
      // Done goes through the board's settings for finished cards, as the card's Done button does.
      if (args.done === true) next = finishCard(next, target.id, deviceId, now);
      if (args.done === false) next = reopenCard(next, target.id, deviceId);
      return done(next, { ok: true });
    }
    case "move_card": {
      const moving = card(args.cardId);
      const target = list(args.listId);
      const missing = blockedMove(full, moving, target.id);
      if (missing.length) throw new ToolError(moveBlockedText(full, moving, missing));
      const before = text(args, "beforeCardId");
      if (before && card(before).listId !== target.id) throw new ToolError("beforeCardId must be a card of listId");
      // To another board the card takes its labels along and keeps its links, as moving it in the app does.
      const transferred = transferCard(full, moving.id, target.id, false, moving.id).state;
      const position = before ? positionBefore(transferred.cards, moving.id, card(before)) : undefined;
      const next: AppState = {
        ...transferred,
        cards: transferred.cards.map((item) =>
          item.id === moving.id
            ? applyMoveRules(full, moving, position === undefined ? item : { ...item, position })
            : item,
        ),
      };
      return done(trashSubCards(recordRevision(next, "card", moving.id, deviceId), moving.id, deviceId), { ok: true });
    }
    case "mirror_card": {
      const source = card(args.cardId);
      const target = list(args.listId);
      const id = newId();
      return done(mirrorCard(full, source.id, target.id, deviceId, { copyId: id }), { id });
    }
    case "link_cards":
    case "unlink_cards": {
      const linkKind = kind(args.kind);
      const from = card(args.fromCardId).id;
      const to = card(args.toCardId).id;
      if (name === "link_cards") {
        if (!canConnect(full, linkKind, from, to))
          throw new ToolError(
            "These cards cannot be linked: the link exists, would make a loop or a card is out of reach",
          );
        const linked = connect(full, linkKind, from, to);
        return done(
          recordRevisions(
            linked.state,
            linked.changed.map((id) => ({ kind: "card" as const, id })),
            deviceId,
          ),
          { ok: true },
        );
      }
      const connection = allConnections(full).find(
        (item) =>
          item.kind === linkKind &&
          ((item.from === from && item.to === to) || (linkKind === "relates" && item.from === to && item.to === from)),
      );
      if (!connection) throw new ToolError("No such link");
      const unlinked = disconnect(full, connection);
      return done(
        recordRevisions(
          unlinked.state,
          unlinked.changed.map((id) => ({ kind: "card" as const, id })),
          deviceId,
        ),
        { ok: true },
      );
    }
    case "clone_card": {
      const cloned = cloneCard(full, card(args.cardId).id);
      return done(recordRevision(cloned.state, "card", cloned.cardId, deviceId), { id: cloned.cardId });
    }
    case "add_comment": {
      const target = card(args.cardId);
      const replyTo = text(args, "replyToCommentId");
      if (replyTo && !target.comments.some((item) => item.id === replyTo && !item.deleted))
        throw new ToolError(`Comment ${replyTo} not found on the card`);
      const comment = {
        id: newId(),
        text: text(args, "text", true)!,
        author: "AI agent",
        authorDeviceId: deviceId,
        createdAt: now.toISOString(),
        ...(replyTo ? { parentId: replyTo } : {}),
      };
      return done(
        changeCard(target.id, (item) => ({ ...item, comments: [...item.comments, comment] })),
        { id: comment.id },
      );
    }
    case "add_checklist": {
      const target = card(args.cardId);
      const items = Array.isArray(args.items) ? args.items.map(String).filter((item) => item.trim()) : [];
      const checklist = {
        id: newId(),
        name: text(args, "name", true)!.trim(),
        items: items.map((item) => ({ id: newId(), name: item.trim(), checked: false })),
      };
      return done(
        changeCard(target.id, (item) => ({ ...item, checklists: [...item.checklists, checklist] })),
        checklist,
      );
    }
    case "set_checklist_item": {
      const target = card(args.cardId);
      if (!target.checklists.some((item) => item.items.some((entry) => entry.id === args.itemId)))
        throw new ToolError(`Checklist item ${String(args.itemId)} not found`);
      return done(
        changeCard(target.id, (item) => ({
          ...item,
          checklists: item.checklists.map((checklist) => ({
            ...checklist,
            items: checklist.items.map((entry) =>
              entry.id === args.itemId ? { ...entry, checked: args.checked === true } : entry,
            ),
          })),
        })),
        { ok: true },
      );
    }
    case "add_dependency": {
      const dependent = card(args.cardId);
      const prerequisite = card(args.dependsOnCardId);
      return done(
        recordRevisions(
          linkDependency(full, dependent.id, prerequisite.id),
          [
            { kind: "card", id: dependent.id },
            { kind: "card", id: prerequisite.id },
          ],
          deviceId,
        ),
        { ok: true },
      );
    }
    case "update_board_doc": {
      const target = board(args.boardId);
      const markdown = text(args, "markdown", true)!;
      return done(
        recordRevision(
          { ...full, boards: full.boards.map((item) => (item.id === target.id ? { ...item, doc: markdown } : item)) },
          "board",
          target.id,
          deviceId,
        ),
        { ok: true },
      );
    }
    case "delete": {
      const kind = String(args.kind) as TrashKind;
      if (!trashKinds.includes(kind)) throw new ToolError(`"kind" must be one of ${trashKinds.join(", ")}`);
      const collection = { workspace: state.workspaces, board: state.boards, list: state.lists, card: state.cards }[
        kind
      ] as Array<{ id: string }>;
      need(
        collection.find((item) => item.id === args.id),
        `${kind} ${String(args.id)}`,
      );
      return done(moveToTrash(full, kind, String(args.id), deviceId, { now: now.toISOString() }), {
        ok: true,
        restorableDays: 30,
      });
    }
    case "restore": {
      const kind = String(args.kind) as TrashKind;
      if (!trashKinds.includes(kind)) throw new ToolError(`"kind" must be one of ${trashKinds.join(", ")}`);
      const restored = restoreFromTrash(full, kind, String(args.id), deviceId);
      if (!restored.restored.length) throw new ToolError(`${kind} ${String(args.id)} is not in the trash`);
      return done(restored.state, { restored: restored.restored });
    }
    default:
      throw new ToolError(`Unknown tool ${name}`);
  }
}
