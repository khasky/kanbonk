import { useSyncExternalStore } from "react";

/** This device's choices about view counting: whether its own views count, and whether tiles show the view badge. */
export interface ViewPreferences {
  track: boolean;
  showBadges: boolean;
}

const key = "kanbonk-view-preferences";
const defaults: ViewPreferences = { track: true, showBadges: true };
const listeners = new Set<() => void>();

function read(): ViewPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "{}");
    return {
      track: typeof saved.track === "boolean" ? saved.track : defaults.track,
      showBadges: typeof saved.showBadges === "boolean" ? saved.showBadges : defaults.showBadges,
    };
  } catch {
    return defaults;
  }
}

let current = typeof localStorage === "undefined" ? defaults : read();

export function setViewPreferences(patch: Partial<ViewPreferences>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(key, JSON.stringify(current));
  } catch {
    // Storage may be full or blocked; the choice then lasts until the page is reloaded.
  }
  for (const listener of listeners) listener();
}

export function viewPreferences(): ViewPreferences {
  return current;
}

export function useViewPreferences(): ViewPreferences {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
