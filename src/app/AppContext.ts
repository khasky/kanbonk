import { createContext, type Dispatch, type RefObject, type SetStateAction, use } from "react";
import type { DeviceSync } from "../hooks/useDeviceSync";
import type { BoardActions } from "../hooks/useBoardActions";
import type { CardActions } from "../hooks/useCardActions";
import type { PanelLayout } from "../hooks/usePanelLayout";
import type { Trash } from "../hooks/useTrash";
import type { Route } from "../lib/router";
import type { AppState, Card } from "../model";
import type { OverlayControls } from "./useOverlays";

/**
 * What the parts of the app shell share: the data, navigation, the change hooks and the open dialogs. `App` creates
 * it once per render; `MainContent` and `AppOverlays` read it instead of taking dozens of props.
 */
export interface AppServices {
  fullState: AppState;
  /** The state without trashed items, which every view renders. */
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  stateRef: RefObject<AppState>;
  /** Resolves when every change so far is saved. */
  queue: RefObject<Promise<void>>;
  deviceId: string;
  route: Route;
  /** The page in the main area; a card modal keeps the page it was opened from. */
  page: Route;
  boardId: string | null;
  navigate: (href: string, options?: { replace?: boolean; modal?: boolean }) => void;
  setBoardId: (id: string | null) => void;
  /** Opens a card as a modal over the current page, or closes the open one with null. */
  setCardId: (id: string | null) => void;
  /** Shows a card over its board, or over the Inbox panel when it is an inbox card. */
  openCardInPlace: (card: Card) => void;
  showBoard: (id: string) => void;
  panels: PanelLayout;
  boardActions: BoardActions;
  cardActions: CardActions;
  trash: Trash;
  sync: DeviceSync;
  overlays: OverlayControls;
  setNotice: (message: string) => void;
  setNoticeCardId: (id: string | undefined) => void;
  setError: (message: string) => void;
  /** Bumped when attachment files change outside the app's own edits, e.g. after a restore. */
  fileVersion: number;
  bumpFileVersion: () => void;
  localAuthor: string;
  setLocalAuthor: (name: string) => void;
}

export const AppContext = createContext<AppServices | null>(null);

export function useApp(): AppServices {
  const services = use(AppContext);
  if (!services) throw new Error("useApp must be used inside AppContext.");
  return services;
}
