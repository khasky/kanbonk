import { newId, type AppState, type Board, type BoardList, type Card, type Label } from "./model";
import { trelloLabelColors } from "./labels";
import { cardCreatedAt } from "./calendar";
import type { ImportResult } from "./importTrello";

const colorNames = new Map(Object.entries(trelloLabelColors).map(([name, color]) => [color.toLowerCase(), name]));

function boardData(state: AppState, boardId: string) {
  const board = state.boards.find((item) => item.id === boardId);
  if (!board) throw new Error("Board not found.");
  const lists = state.lists
    .filter((item) => item.boardId === boardId && !item.deletedAt)
    .sort((a, b) => a.position - b.position);
  const listIds = new Set(lists.map((item) => item.id));
  const cards = state.cards
    .filter((item) => item.boardId === boardId && !item.deletedAt && listIds.has(item.listId))
    .sort((a, b) => a.position - b.position);
  const labels = state.labels.filter((item) => item.boardId === boardId && !item.deleted);
  return { board, lists, cards, labels };
}

function cardUrl(card: Card): string {
  return `https://trello.com/c/${card.sourceTrelloShortLink ?? card.id}`;
}

/** Board in the shape of Trello's JSON export (board -> lists, cards, labels, checklists, actions, members). */
export function exportTrelloJson(state: AppState, boardId: string): Record<string, unknown> {
  const { board, lists, cards, labels } = boardData(state, boardId);
  const cardById = new Map(state.cards.map((card) => [card.id, card]));
  const label = (item: Label) => ({
    id: item.id,
    idBoard: board.id,
    name: item.name,
    color: item.color ? (colorNames.get(item.color.toLowerCase()) ?? null) : null,
  });
  const listName = new Map(lists.map((item) => [item.id, item.name]));
  const actions: Record<string, unknown>[] = [];
  for (const card of cards) {
    const created = cardCreatedAt(state, card);
    if (created)
      actions.push({
        id: `${card.id}-create`,
        type: "createCard",
        date: created,
        memberCreator: { id: "kanbonk", fullName: "Kanbonk" },
        data: {
          card: { id: card.id, name: card.name, shortLink: card.id },
          list: { id: card.listId, name: listName.get(card.listId) },
          board: { id: board.id, name: board.name },
        },
      });
    for (const comment of card.comments)
      actions.push({
        id: comment.id,
        type: "commentCard",
        date: comment.createdAt,
        memberCreator: { id: comment.authorDeviceId ?? "kanbonk", fullName: comment.author },
        data: {
          text: comment.text,
          card: { id: card.id, name: card.name, shortLink: card.id },
          list: { id: card.listId, name: listName.get(card.listId) },
          board: { id: board.id, name: board.name },
        },
      });
  }
  actions.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return {
    id: board.id,
    name: board.name,
    desc: board.description,
    closed: Boolean(board.archived),
    idOrganization: board.workspaceId,
    kanbonkOrganizationName: state.workspaces.find((item) => item.id === board.workspaceId)?.name,
    starred: board.starred,
    shortLink: board.id,
    url: `https://trello.com/b/${board.id}`,
    prefs: { backgroundColor: board.background },
    labels: labels.map(label),
    lists: lists.map((list) => ({
      id: list.id,
      idBoard: board.id,
      name: list.name,
      closed: Boolean(list.archived),
      pos: list.position,
    })),
    members: (board.members ?? []).map((member) => ({
      id: member.id,
      fullName: member.name,
      username: member.name.toLowerCase().replace(/\s+/g, ""),
    })),
    cards: cards.map((card) => ({
      id: card.id,
      idBoard: board.id,
      idList: card.listId,
      name: card.name,
      desc: card.description,
      closed: Boolean(card.archived),
      pos: card.position,
      shortLink: card.id,
      url: cardUrl(card),
      start: card.startAt ?? null,
      due: card.dueAt ?? null,
      dueComplete: card.completed,
      dueReminder: card.dueReminderMinutes ?? null,
      idLabels: card.labelIds,
      labels: labels.filter((item) => card.labelIds.includes(item.id)).map(label),
      idMembers: card.memberIds ?? [],
      idChecklists: card.checklists.map((item) => item.id),
      isTemplate: Boolean(card.isTemplate),
      cover: card.cover
        ? {
            idAttachment: card.cover.attachmentId ?? null,
            color: card.cover.color ? (colorNames.get(card.cover.color.toLowerCase()) ?? null) : null,
            size: card.cover.size,
          }
        : undefined,
      attachments: card.attachments.map((item, index) => {
        const linked = item.linkedCardId ? cardById.get(item.linkedCardId) : undefined;
        return {
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
          bytes: item.size,
          pos: index + 1,
          isUpload: item.status !== "link",
          url: linked ? cardUrl(linked) : (item.sourceUrl ?? ""),
        };
      }),
    })),
    checklists: cards.flatMap((card) =>
      card.checklists.map((checklist, index) => ({
        id: checklist.id,
        idBoard: board.id,
        idCard: card.id,
        name: checklist.name,
        pos: index + 1,
        checkItems: checklist.items.map((item, position) => {
          const linked = item.linkedCardId ? cardById.get(item.linkedCardId) : undefined;
          return {
            id: item.id,
            idChecklist: checklist.id,
            name: linked ? cardUrl(linked) : item.name,
            state: item.checked ? "complete" : "incomplete",
            pos: position + 1,
          };
        }),
      })),
    ),
    actions,
  };
}

export const trelloCsvColumns = [
  "Card ID",
  "Card Name",
  "Card URL",
  "Card Description",
  "Labels",
  "Members",
  "Due Date",
  "Attachment Count",
  "Attachment Links",
  "Checklist Item Total Count",
  "Checklist Item Completed Count",
  "Vote Count",
  "Comment Count",
  "Last Activity Date",
  "List ID",
  "List Name",
  "Board ID",
  "Board Name",
  "Archived",
  "Start Date",
  "Due Complete",
];

function csvCell(value: string | number | boolean): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV with the column set of Trello's CSV export. */
export function exportTrelloCsv(state: AppState, boardId: string): string {
  const { board, lists, cards, labels } = boardData(state, boardId);
  const listName = new Map(lists.map((item) => [item.id, item.name]));
  const rows = cards.map((card) => {
    const items = card.checklists.flatMap((list) => list.items);
    const lastActivity =
      state.revisions
        .filter((item) => item.entityId === card.id)
        .map((item) => item.createdAt)
        .sort()
        .pop() ??
      cardCreatedAt(state, card) ??
      "";
    return [
      card.id,
      card.name,
      cardUrl(card),
      card.description,
      labels
        .filter((item) => card.labelIds.includes(item.id))
        .map((item) => `${item.name} (${colorNames.get(item.color.toLowerCase()) ?? "none"})`)
        .join(", "),
      (board.members ?? [])
        .filter((item) => card.memberIds?.includes(item.id))
        .map((item) => item.name)
        .join(", "),
      card.dueAt ?? "",
      card.attachments.length,
      card.attachments
        .map((item) => item.sourceUrl ?? "")
        .filter(Boolean)
        .join(" "),
      items.length,
      items.filter((item) => item.checked).length,
      0,
      card.comments.length,
      lastActivity,
      card.listId,
      listName.get(card.listId) ?? "",
      board.id,
      board.name,
      card.archived ? "true" : "false",
      card.startAt ?? "",
      card.completed ? "true" : "false",
    ]
      .map(csvCell)
      .join(",");
  });
  return `${[trelloCsvColumns.join(","), ...rows].join("\r\n")}\r\n`;
}

/** RFC 4180 parser (quoted fields, escaped quotes, CRLF/LF, BOM). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((item) => item.some((cell) => cell.trim()));
}

const date = (value: string) =>
  value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;

/** Builds a board from a Trello CSV export (comments and checklist items are not part of Trello CSV). */
export function parseTrelloCsv(text: string, workspaceId: string, fallbackName = "CSV import"): ImportResult {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error("The CSV file is empty.");
  const column = new Map(header.map((name, index) => [name.trim().toLowerCase(), index]));
  const get = (row: string[], name: string) => row[column.get(name.toLowerCase()) ?? -1]?.trim() ?? "";
  if (!column.has("card name") || !column.has("list name"))
    throw new Error(
      "The CSV does not look like a Trello export: the “Card Name” and “List Name” columns are required.",
    );
  const boardId = newId();
  const board: Board = {
    id: boardId,
    workspaceId,
    name: get(rows[0] ?? [], "Board Name") || fallbackName,
    description: "",
    background: "#147d86",
    members: [],
    starred: false,
  };
  const lists: BoardList[] = [];
  const listByKey = new Map<string, BoardList>();
  const labels: Label[] = [];
  const labelByKey = new Map<string, Label>();
  const memberByName = new Map<string, string>();
  const cards: Card[] = rows.map((row, index) => {
    const listKey = get(row, "List ID") || get(row, "List Name");
    let list = listByKey.get(listKey);
    if (!list) {
      list = {
        id: newId(),
        boardId,
        name: get(row, "List Name") || `List ${lists.length + 1}`,
        position: lists.length + 1,
      };
      lists.push(list);
      listByKey.set(listKey, list);
    }
    const labelIds = (get(row, "Labels").match(/[^,]+?\s*\([a-z_]+\)|[^,]+/g) ?? [])
      .map((raw) => raw.trim())
      .filter(Boolean)
      .map((raw) => {
        const match = raw.match(/^(.*?)\s*\(([a-z_]+)\)$/);
        const name = match ? match[1] : raw;
        const color = match ? (trelloLabelColors[match[2]] ?? "") : "";
        const key = `${name}|${color}`;
        let label = labelByKey.get(key);
        if (!label) {
          label = { id: newId(), boardId, name, color };
          labels.push(label);
          labelByKey.set(key, label);
        }
        return label.id;
      });
    const memberIds = get(row, "Members")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => {
        let id = memberByName.get(name);
        if (!id) {
          id = newId();
          memberByName.set(name, id);
          board.members!.push({ id, name });
        }
        return id;
      });
    const sourceId = get(row, "Card ID");
    const url = get(row, "Card URL");
    return {
      id: newId(),
      boardId,
      listId: list.id,
      name: get(row, "Card Name") || `Card ${index + 1}`,
      description: get(row, "Card Description"),
      position: index + 1,
      createdAt: /^[a-f0-9]{24}$/.test(sourceId)
        ? new Date(parseInt(sourceId.slice(0, 8), 16) * 1000).toISOString()
        : undefined,
      labelIds,
      memberIds,
      startAt: date(get(row, "Start Date")),
      dueAt: date(get(row, "Due Date")),
      completed: get(row, "Due Complete").toLowerCase() === "true",
      archived: get(row, "Archived").toLowerCase() === "true",
      checklists: [],
      comments: [],
      attachments: get(row, "Attachment Links")
        .split(/\s+/)
        .filter((link) => /^https?:\/\//.test(link))
        .map((link) => ({
          id: newId(),
          name: decodeURIComponent(link.split("/").pop() || link),
          mimeType: "text/uri-list",
          size: 0,
          sourceUrl: link,
          status: "link" as const,
        })),
      sourceTrelloId: sourceId || undefined,
      sourceTrelloShortLink: url.match(/trello\.com\/c\/([A-Za-z0-9]{8})/)?.[1],
    };
  });
  return {
    board,
    lists,
    cards,
    labels,
    activity: [],
    attachments: [],
    stickers: [],
    warnings: ["A Trello CSV does not include comments or checklist items; use JSON for a complete transfer."],
  };
}
