import { type AppState, recordRevision } from "./index";

/** Boards created or imported without a workspace land here. */
export const personalWorkspaceId = "kanbonk-personal-workspace";

/** Adds the "Personal" workspace when `workspaceId` is that workspace and it does not exist yet. */
export function ensurePersonalWorkspace(state: AppState, workspaceId: string, deviceId: string): AppState {
  if (workspaceId !== personalWorkspaceId || state.workspaces.some((item) => item.id === personalWorkspaceId))
    return state;
  return recordRevision(
    { ...state, workspaces: [...state.workspaces, { id: personalWorkspaceId, name: "Personal" }] },
    "workspace",
    personalWorkspaceId,
    deviceId,
  );
}
