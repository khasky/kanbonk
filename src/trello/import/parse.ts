import { t } from "../../i18n";
import {
  newId,
  recordRevisions,
  type ActivityEvent,
  type AppState,
  type Attachment,
  type Board,
  type BoardList,
  type Card,
  type Checklist,
  type Comment,
  type Label,
  type Member,
  type Workspace,
} from "../../model/index";
import { trelloLabelColors } from "../../model/labelColors";
import { trelloActionDescription } from "./actions";
import { array, closedInTrello, number, object, string, type TrelloRecord } from "./records";

export interface ImportResult {
  organization?: { id: string; name?: string };
  board: Board;
  lists: BoardList[];
  cards: Card[];
  labels: Label[];
  activity: ActivityEvent[];
  attachments: Array<{
    id: string;
    trelloId: string;
    cardId: string;
    sourceUrl: string;
    name: string;
    mimeType: string;
  }>;
  warnings: string[];
}

/** Exports saved by the Trello helper before the rename carry its fields as listva*. */
function legacyTrelloFields(source: TrelloRecord): TrelloRecord {
  return "listvaComments" in source || "listvaCommentsComplete" in source || "listvaOrganizationName" in source
    ? {
        ...source,
        kanbonkComments: source.kanbonkComments ?? source.listvaComments,
        kanbonkCommentsComplete: source.kanbonkCommentsComplete ?? source.listvaCommentsComplete,
        kanbonkOrganizationName: source.kanbonkOrganizationName ?? source.listvaOrganizationName,
      }
    : source;
}

export function parseTrelloBoard(raw: unknown, workspaceId: string): ImportResult {
  const source = legacyTrelloFields(object(raw));
  if (!string(source.id) || !string(source.name) || !Array.isArray(source.lists) || !Array.isArray(source.cards)) {
    throw new Error(t("trello.notTrelloJson"));
  }
  const boardId = newId();
  const organizationId = string(source.idOrganization);
  const organizationName = string(source.kanbonkOrganizationName) || string(object(source.organization).displayName);
  const organization = organizationId ? { id: organizationId, name: organizationName || undefined } : undefined;
  const prefs = object(source.prefs);
  const board: Board = {
    id: boardId,
    workspaceId,
    name: string(source.name),
    description: string(source.desc),
    background: string(prefs.backgroundColor) || "#147d86",
    sourceTrelloId: string(source.id),
    starred: Boolean(source.starred),
    ...closedInTrello(source.closed, boardId),
  };
  const members: Member[] = [];
  const memberIds = new Map<string, string>();
  for (const entry of array(source.members)) {
    const trelloId = string(entry.id);
    if (!trelloId || memberIds.has(trelloId)) continue;
    const id = newId();
    memberIds.set(trelloId, id);
    members.push({
      id,
      name: string(entry.fullName) || string(entry.username) || `Trello member ${trelloId.slice(0, 8)}`,
    });
  }
  for (const entry of array(source.cards))
    for (const value of Array.isArray(entry.idMembers) ? entry.idMembers : []) {
      const trelloId = string(value);
      if (!trelloId || memberIds.has(trelloId)) continue;
      const id = newId();
      memberIds.set(trelloId, id);
      members.push({ id, name: `Trello member ${trelloId.slice(0, 8)}` });
    }
  board.members = members;
  const listIds = new Map<string, string>();
  const lists = array(source.lists).map((entry, index) => {
    const id = newId();
    listIds.set(string(entry.id), id);
    return {
      id,
      boardId,
      name: string(entry.name) || `List ${index + 1}`,
      position: number(entry.pos) || index + 1,
      ...closedInTrello(entry.closed, id),
    };
  });
  const labelIds = new Map<string, string>();
  const labels: Label[] = array(source.labels).map((entry) => {
    const id = newId();
    labelIds.set(string(entry.id), id);
    return {
      id,
      boardId,
      name: string(entry.name),
      color: trelloLabelColors[string(entry.color)] ?? (entry.color ? "#dfe1e6" : ""),
    };
  });
  const checklistsByCard = new Map<string, Checklist[]>();
  for (const entry of array(source.checklists).sort((a, b) => number(a.pos) - number(b.pos))) {
    const checklist: Checklist = {
      id: newId(),
      name: string(entry.name) || "Checklist",
      items: array(entry.checkItems)
        .sort((a, b) => number(a.pos) - number(b.pos))
        .map((item) => ({ id: newId(), name: string(item.name), checked: string(item.state) === "complete" })),
    };
    const cardId = string(entry.idCard);
    checklistsByCard.set(cardId, [...(checklistsByCard.get(cardId) || []), checklist]);
  }
  const commentsByCard = new Map<string, Comment[]>();
  const completeComments = source.kanbonkCommentsComplete === true && Array.isArray(source.kanbonkComments);
  for (const action of array(completeComments ? source.kanbonkComments : source.actions)) {
    if (action.type !== "commentCard") continue;
    const data = object(action.data);
    const cardId = string(object(data.card).id);
    const comment: Comment = {
      id: newId(),
      text: string(data.text),
      author: string(object(action.memberCreator).fullName) || "Trello author",
      authorDeviceId: `trello:${string(object(action.memberCreator).id) || "unknown"}`,
      createdAt: string(action.date) || new Date().toISOString(),
    };
    commentsByCard.set(cardId, [...(commentsByCard.get(cardId) || []), comment]);
  }
  const createdByCard = new Map<string, string>();
  for (const action of array(source.actions))
    if (action.type === "createCard" && Number.isFinite(Date.parse(string(action.date))))
      createdByCard.set(string(object(object(action.data).card).id), string(action.date));
  const attachments: ImportResult["attachments"] = [];
  const cards: Card[] = array(source.cards).map((entry, index) => {
    const trelloId = string(entry.id);
    const id = newId();
    const attachmentIds = new Map<string, string>();
    const cardAttachments: Attachment[] = array(entry.attachments)
      .sort((a, b) => number(a.pos) - number(b.pos))
      .map((attachment) => {
        const id = newId();
        attachmentIds.set(string(attachment.id), id);
        if (attachment.isUpload !== false)
          attachments.push({
            id,
            trelloId: string(attachment.id),
            cardId: trelloId,
            sourceUrl: string(attachment.url),
            name: string(attachment.name) || "Attachment",
            mimeType: string(attachment.mimeType),
          });
        return {
          id,
          name: string(attachment.name) || "Attachment",
          mimeType: string(attachment.mimeType),
          size: number(attachment.bytes),
          sourceUrl: string(attachment.url),
          status: attachment.isUpload === false ? "link" : "missing",
          addedAt: string(attachment.date) || undefined,
        };
      });
    const sourceCover = object(entry.cover);
    const coverAttachmentId = attachmentIds.get(string(sourceCover.idAttachment) || string(entry.idAttachmentCover));
    const coverColor = trelloLabelColors[string(sourceCover.color)];
    const cover =
      coverAttachmentId || coverColor
        ? {
            attachmentId: coverAttachmentId,
            color: coverColor,
            size: string(sourceCover.size) === "full" ? ("full" as const) : ("normal" as const),
          }
        : undefined;
    return {
      id,
      boardId,
      listId: listIds.get(string(entry.idList)) || lists[0]?.id || "",
      name: string(entry.name) || `Card ${index + 1}`,
      description: string(entry.desc),
      position: number(entry.pos) || index + 1,
      createdAt: /^[a-f0-9]{24}$/.test(trelloId)
        ? new Date(parseInt(trelloId.slice(0, 8), 16) * 1000).toISOString()
        : createdByCard.get(trelloId),
      labelIds: array(entry.labels)
        .map((label) => labelIds.get(string(label.id)))
        .filter((value): value is string => Boolean(value))
        .concat(
          (Array.isArray(entry.idLabels) ? entry.idLabels : [])
            .map((value) => labelIds.get(string(value)))
            .filter((value): value is string => Boolean(value)),
        )
        .filter((value, index, all) => all.indexOf(value) === index),
      memberIds: (Array.isArray(entry.idMembers) ? entry.idMembers : [])
        .map((value) => memberIds.get(string(value)))
        .filter((value): value is string => Boolean(value)),
      startAt: string(entry.start) || undefined,
      dueAt: string(entry.due) || undefined,
      dueReminderMinutes:
        typeof entry.dueReminder === "number" && entry.dueReminder >= 0 ? entry.dueReminder : undefined,
      checklists: checklistsByCard.get(trelloId) || [],
      comments: (commentsByCard.get(trelloId) || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      attachments: cardAttachments,
      cover,
      ...closedInTrello(entry.closed, id),
      sourceTrelloId: trelloId,
      sourceTrelloShortLink: string(entry.shortLink),
      isTemplate: Boolean(entry.isTemplate),
    };
  });
  const cardsByTrelloId = new Map(cards.map((card) => [card.sourceTrelloId, card]));
  const actions = new Map<string, TrelloRecord>();
  for (const action of [...array(source.actions), ...(completeComments ? array(source.kanbonkComments) : [])]) {
    const data = object(action.data);
    const key =
      string(action.id) ||
      `${string(action.type)}:${string(action.date)}:${string(object(data.card).id)}:${string(data.text)}`;
    actions.set(key, action);
  }
  const activity: ActivityEvent[] = [];
  for (const action of actions.values()) {
    const createdAt = string(action.date);
    if (!Number.isFinite(Date.parse(createdAt))) continue;
    const data = object(action.data);
    const importedCard = cardsByTrelloId.get(string(object(data.card).id));
    const cardId = importedCard?.id;
    const listId = listIds.get(string(object(data.list).id));
    const importedListName = lists.find((list) => list.id === listId)?.name;
    const author =
      string(object(action.memberCreator).fullName) || string(object(action.memberCreator).username) || "Trello member";
    activity.push({
      id: newId(),
      entityKind: cardId ? "card" : listId ? "list" : "board",
      entityId: cardId || listId || boardId,
      boardId,
      createdAt,
      deviceId: "trello",
      summary: `${author}: ${trelloActionDescription(action, importedCard?.name, importedListName)}`,
      category: action.type === "commentCard" ? "comment" : "change",
    });
  }
  const warnings: string[] = [];
  if (attachments.length) warnings.push(t("trello.attachmentsNeedDownload"));
  if (organization && !organization.name) warnings.push(t("trello.workspaceNameMissing"));
  if (string(prefs.backgroundImage)) warnings.push(t("trello.backgroundNotTransferred"));
  if (array(source.actions).length >= 1000)
    warnings.push(t(completeComments ? "trello.historyTruncated" : "trello.historyAndCommentsTruncated"));
  return { organization, board, lists, cards, labels, activity, attachments, warnings };
}

export function prepareTrelloWorkspace(
  state: AppState,
  organization: ImportResult["organization"],
  fallbackWorkspaceId: string,
): { state: AppState; workspaceId: string; changedWorkspaceId?: string } {
  if (!organization) return { state, workspaceId: fallbackWorkspaceId };
  const placeholder = `Trello ${organization.id.slice(0, 8)}`;
  const name = organization.name;
  const existing = state.workspaces.find((workspace) => workspace.sourceTrelloId === organization.id);
  if (existing) {
    if (name && existing.name === placeholder) {
      return {
        state: {
          ...state,
          workspaces: state.workspaces.map((workspace) =>
            workspace.id === existing.id ? { ...workspace, name } : workspace,
          ),
        },
        workspaceId: existing.id,
        changedWorkspaceId: existing.id,
      };
    }
    return { state, workspaceId: existing.id };
  }
  const workspace: Workspace = { id: newId(), name: organization.name || placeholder, sourceTrelloId: organization.id };
  return {
    state: { ...state, workspaces: [...state.workspaces, workspace] },
    workspaceId: workspace.id,
    changedWorkspaceId: workspace.id,
  };
}

export function addImportedBoard(state: AppState, result: ImportResult): AppState {
  return {
    ...state,
    boards: [...state.boards, result.board],
    lists: [...state.lists, ...result.lists],
    cards: [...state.cards, ...result.cards],
    labels: [...state.labels, ...result.labels],
    activity: [...(state.activity ?? []), ...result.activity],
  };
}

export function addImportedBoardWithRevisions(state: AppState, result: ImportResult, deviceId: string): AppState {
  let next = addImportedBoard(state, result);
  const importedActivity = next.activity;
  next = recordRevisions(
    next,
    [
      { kind: "board", id: result.board.id },
      ...result.lists.map((list) => ({ kind: "list" as const, id: list.id })),
      ...result.labels.map((label) => ({ kind: "label" as const, id: label.id })),
      ...result.cards.map((card) => ({ kind: "card" as const, id: card.id })),
    ],
    deviceId,
  );
  return { ...next, activity: importedActivity };
}
