import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { t } from "../i18n";
import { deviceId, loadState, saveState } from "../lib/storage";
import { emptyState, type AppState } from "../model";
import { ensureInbox } from "../model/inbox";
import { visibleState } from "../model/trash";

/**
 * The app's data: loads it from IndexedDB once, writes every change back through a serialized queue and calls
 * `onSaved` after each write (other tabs are told to reload). `state` is the visible state without trashed items;
 * trash pages and sync use `fullState`.
 */
export function useAppState({
  onLoaded,
  onSaved,
  onError,
}: {
  onLoaded: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [fullState, setState] = useState<AppState>(emptyState);
  const state = useMemo(() => visibleState(fullState), [fullState]);
  const [ready, setReady] = useState(false);
  const localDeviceId = useRef(deviceId()).current;
  /** The latest state for callbacks that run outside a render, such as backups. */
  const stateRef = useRef(fullState);
  stateRef.current = fullState;
  /** Resolves when every change made so far is written; exports wait for it. */
  const queue = useRef(Promise.resolve());

  const loaded = useEffectEvent(onLoaded);
  const reportError = useEffectEvent(onError);
  useEffect(() => {
    loadState()
      .then((state) => {
        setState(ensureInbox(state, localDeviceId));
        loaded();
        setReady(true);
      })
      .catch((cause) => reportError(t("app.openDataError", { cause: String(cause) })));
  }, [localDeviceId]);

  const saved = useEffectEvent(onSaved);
  useEffect(() => {
    if (!ready) return;
    queue.current = queue.current
      .then(() => saveState(fullState))
      .then(() => saved())
      .catch((cause) => reportError(t("app.saveChangesError", { cause: String(cause) })));
  }, [fullState, ready]);

  return { fullState, state, setState, ready, localDeviceId, stateRef, queue };
}
