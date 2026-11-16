import { expect, it } from "vitest";
import { ensureInbox, inboxBoardId, inboxListId, inboxWorkspaceId } from "../src/inbox";
import { emptyState, recordRevision } from "../src/model";
import { mergeStates } from "../src/sync";

it("initializes the inbox before any personal workspace exists", () => {
  const state = ensureInbox(emptyState(), "device-a");
  expect(state.workspaces).toEqual([{ id: inboxWorkspaceId, name: "Inbox" }]);
  expect(state.boards.map((item) => item.id)).toEqual([inboxBoardId]);
  expect(state.lists.map((item) => item.id)).toEqual([inboxListId]);
});

it("creates one versioned personal inbox and leaves it unchanged on later loads", () => {
  const state = recordRevision({ ...emptyState(), workspaces: [{ id: "personal", name: "Personal" }] }, "workspace", "personal", "device-a");
  const initialized = ensureInbox(state, "device-a");
  expect(initialized.workspaces.find((item) => item.id === inboxWorkspaceId)?.name).toBe("Inbox");
  expect(initialized.boards.find((item) => item.id === inboxBoardId)?.workspaceId).toBe(inboxWorkspaceId);
  expect(initialized.lists.find((item) => item.id === inboxListId)?.boardId).toBe(inboxBoardId);
  expect(initialized.revisions.filter((item) => [inboxWorkspaceId, inboxBoardId, inboxListId].includes(item.entityId))).toHaveLength(3);
  expect(ensureInbox(initialized, "device-a")).toBe(initialized);
});

it("merges independently initialized inboxes without a workspace or board conflict", () => {
  const first = ensureInbox({ ...emptyState(), workspaces: [{ id: "workspace-a", name: "Personal" }] }, "device-a");
  const second = ensureInbox({ ...emptyState(), workspaces: [{ id: "workspace-b", name: "Personal" }] }, "device-b");
  const merged = mergeStates(first, second);
  expect(merged.conflicts).toEqual([]);
  expect(merged.state.workspaces.filter((item) => item.id === inboxWorkspaceId)).toHaveLength(1);
  expect(merged.state.boards.filter((item) => item.id === inboxBoardId)).toHaveLength(1);
  expect(merged.state.lists.filter((item) => item.id === inboxListId)).toHaveLength(1);
});
