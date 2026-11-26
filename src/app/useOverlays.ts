import { useState } from "react";
import type { BoardCopyOptions } from "../dialogs/BoardCopyDialog";

/** The dialogs and side panels that can be open over the app; each is independent of the others. */
export interface Overlays {
  history?: true;
  activityBoardId?: string;
  automationBoardId?: string;
  reminders?: true;
  boardAbout?: true;
  boardCopy?: BoardCopyOptions;
  exportBoardId?: string;
  creation?: { kind: "workspace" | "board"; workspaceId?: string };
  import?: true;
  author?: true;
  backup?: true;
  sync?: true;
  ai?: true;
  settings?: true;
  dedupe?: true;
  cloneCardId?: string;
}

export function useOverlays() {
  const [overlays, setOverlays] = useState<Overlays>({});
  return {
    overlays,
    open: (patch: Overlays) => setOverlays((current) => ({ ...current, ...patch })),
    close: (name: keyof Overlays) =>
      setOverlays((current) => {
        const { [name]: _closed, ...rest } = current;
        return rest;
      }),
  };
}

export type OverlayControls = ReturnType<typeof useOverlays>;
