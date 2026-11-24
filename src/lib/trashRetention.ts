import { useSyncExternalStore } from "react";
import { trashRetentionDays } from "../model/trash";
import { loadSetting, saveSetting } from "./storage";

/** The periods Settings offers for keeping items in the trash, in days. */
export const trashRetentionChoices = [7, 14, 30, 60, 90];

// Undefined until the device's setting is read, so nothing is purged by a period the user did not choose.
let days: number | undefined;
const listeners = new Set<() => void>();

function publish(value: number) {
  days = value;
  for (const listener of listeners) listener();
}

/** Reads this device's trash period; the default when none is saved. */
export async function loadTrashRetention(): Promise<void> {
  const saved = await loadSetting<number>("trash-retention-days");
  publish(saved !== undefined && trashRetentionChoices.includes(saved) ? saved : trashRetentionDays);
}

export async function setTrashRetention(value: number): Promise<void> {
  publish(value);
  await saveSetting("trash-retention-days", value);
}

/** Days items stay in the trash on this device; undefined while the setting is being read. */
export function useTrashRetention(): number | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => days,
  );
}
