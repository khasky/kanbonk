import { recordRevision, type AppState, type Board, type BoardList } from "./model";

export const inboxBoardId = "kanbonk-inbox";
export const inboxListId = "kanbonk-inbox-list";
export const inboxWorkspaceId = "kanbonk-inbox-workspace";

export function ensureInbox(state: AppState, deviceId: string): AppState {
  let next = state;
  if (!next.workspaces.some((workspace) => workspace.id === inboxWorkspaceId)) {
    next = recordRevision({ ...next, workspaces: [...next.workspaces, { id: inboxWorkspaceId, name: "Inbox" }] }, "workspace", inboxWorkspaceId, deviceId);
  }
  if (!next.boards.some((board) => board.id === inboxBoardId)) {
    const board: Board = { id: inboxBoardId, workspaceId: inboxWorkspaceId, name: "Inbox", description: "Personal notes and tasks", background: "#f7f8f9", members: [], starred: false };
    next = recordRevision({ ...next, boards: [...next.boards, board] }, "board", inboxBoardId, deviceId);
  }
  if (!next.lists.some((list) => list.id === inboxListId)) {
    const list: BoardList = { id: inboxListId, boardId: inboxBoardId, name: "Inbox", position: 1 };
    next = recordRevision({ ...next, lists: [...next.lists, list] }, "list", inboxListId, deviceId);
  }
  return next;
}
