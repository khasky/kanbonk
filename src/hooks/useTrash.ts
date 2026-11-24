import { askConfirm } from "../ui/AskDialog";
import { type Dispatch, type SetStateAction, useState } from "react";
import type { AppState } from "../model";
import { t } from "../i18n";
import {
  emptyTrash,
  moveToTrash,
  purgeFromTrash,
  restoreFromTrash,
  type TrashImpact,
  type TrashKind,
  trashImpact,
} from "../model/trash";

export interface PendingDelete {
  kind: TrashKind;
  id: string;
  name: string;
  impact: TrashImpact;
}

/**
 * Moving items to the trash after a confirmation dialog, restoring them, deleting them forever. Messages for the user
 * go to `onNotice`; leaving a page whose item was deleted is up to the caller.
 */
export function useTrash({
  fullState,
  setState,
  deviceId,
  onNotice,
}: {
  fullState: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  deviceId: string;
  onNotice: (message: string) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  function entityName(kind: TrashKind, id: string): string {
    const collection =
      kind === "workspace"
        ? fullState.workspaces
        : kind === "board"
          ? fullState.boards
          : kind === "list"
            ? fullState.lists
            : fullState.cards;
    return collection.find((item) => item.id === id)?.name ?? "";
  }

  /** Opens the confirmation dialog for moving an item to the trash. */
  function requestDelete(kind: TrashKind, id: string) {
    setPendingDelete({ kind, id, name: entityName(kind, id), impact: trashImpact(fullState, kind, id) });
  }

  /** Moves the pending item to the trash and returns it, or undefined when nothing was pending. */
  function confirmDelete(withDependents: boolean) {
    if (!pendingDelete) return undefined;
    const { kind, id } = pendingDelete;
    setState((current) => moveToTrash(current, kind, id, deviceId, { withDependents }));
    setPendingDelete(null);
    return pendingDelete;
  }

  function cancelDelete() {
    setPendingDelete(null);
  }

  function restore(kind: TrashKind, id: string) {
    const result = restoreFromTrash(fullState, kind, id, deviceId);
    setState(result.state);
    const extra = result.restored.length - 1;
    const name = entityName(kind, id);
    onNotice(extra > 0 ? t("hooks.restoredWithRelated", { name, count: extra }) : t("hooks.restored", { name }));
  }

  async function purge(kind: TrashKind, id: string) {
    if (
      !(await askConfirm({
        title: t("hooks.purgeTitle", { name: entityName(kind, id) }),
        message: t("hooks.purgeMessage"),
        confirm: t("hooks.deleteForever"),
        danger: true,
      }))
    )
      return;
    setState((current) => purgeFromTrash(current, kind, id, deviceId));
  }

  async function empty() {
    if (
      !(await askConfirm({
        title: t("hooks.emptyTrashTitle"),
        message: t("hooks.emptyTrashMessage"),
        confirm: t("hooks.emptyTrash"),
        danger: true,
      }))
    )
      return;
    setState((current) => emptyTrash(current, deviceId));
  }

  return { pendingDelete, requestDelete, confirmDelete, cancelDelete, restore, purge, empty };
}
export type Trash = ReturnType<typeof useTrash>;
