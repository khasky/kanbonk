import { askConfirm } from "../ui/AskDialog";
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createSyncBundle,
  openSyncBundle,
  readTrustedDevices,
  type SyncTransport,
  saveTrustedDevices,
  type TrustedDevice,
  tabChannel,
  trustDevice,
} from "../sync/devices";
import { LanSync, type Presence } from "../sync/lanSync";
import { type AppState, markMediaLocal, rememberStateIds } from "../model";
import { shareFile } from "../lib/platform";
import { loadAttachment, loadState, saveAttachment } from "../lib/storage";
import { chooseConflict, mergeStates, type SyncConflict } from "../sync/sync";
import { t } from "../i18n";

const transportKey = "kanbonk-sync-transport";

type Peer = { deviceId: string; name: string };
type LocalRoom = { url: string; code: string };

/**
 * Sync with other devices (Wi-Fi relay, WebRTC, encrypted file packages) and with other tabs of this browser.
 * Owns trusted devices, the live session with its reconnect backoff, and conflicts left for the user to resolve.
 */
export function useDeviceSync({
  ready,
  state,
  stateRef,
  setState,
  deviceId,
  authorName,
  presence,
  onFilesChanged,
  onError,
}: {
  ready: boolean;
  state: AppState;
  stateRef: RefObject<AppState>;
  setState: Dispatch<SetStateAction<AppState>>;
  deviceId: string;
  authorName: string;
  /** The board and card open here, shown to the connected device. */
  presence: Presence;
  /** Called when received files may change what is on screen (board backgrounds). */
  onFilesChanged: () => void;
  onError: (message: string) => void;
}) {
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>(readTrustedDevices);
  const [transport, setTransportState] = useState<SyncTransport>(() => {
    const saved = localStorage.getItem(transportKey);
    return saved === "internet" || saved === "file" ? saved : "wifi";
  });
  const [signal, setSignal] = useState("");
  const [response, setResponse] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [serverUrl, setServerUrl] = useState(() =>
    /^https?:$/.test(window.location.protocol) ? window.location.origin : "",
  );
  const [bundleCode, setBundleCode] = useState("");
  const [status, setStatus] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  /** Where the connected device is, and when it last said so; dropped when it goes quiet. */
  const [peerPresence, setPeerPresence] = useState<(Presence & Peer & { at: number }) | null>(null);
  const presenceRef = useRef(presence);
  presenceRef.current = presence;
  const sessionRef = useRef<LanSync | null>(null);
  const reconnectTimer = useRef<number | undefined>(undefined);
  const reconnectDelay = useRef(5000);
  const lastRoom = useRef<LocalRoom | null>(null);
  const sentHeads = useRef("");
  const tabs = useRef<{ notify: () => void; close: () => void } | null>(null);

  function updateTrusted(change: (current: TrustedDevice[]) => TrustedDevice[]) {
    setTrustedDevices((current) => {
      const next = change(current);
      if (next !== current) saveTrustedDevices(next);
      return next;
    });
  }

  const rememberTrust = (peer: Peer, code: string) => updateTrusted((current) => trustDevice(current, peer, code));

  function markSynced(peerId: string) {
    const now = new Date().toISOString();
    updateTrusted((current) =>
      current.some((item) => item.deviceId === peerId)
        ? current.map((item) => (item.deviceId === peerId ? { ...item, lastSyncAt: now } : item))
        : current,
    );
  }

  function removeDevice(device: TrustedDevice) {
    updateTrusted((current) => current.filter((item) => item.deviceId !== device.deviceId));
  }

  function setTransport(value: SyncTransport) {
    setTransportState(value);
    localStorage.setItem(transportKey, value);
  }

  /** Replaces the live session. With a local room, a dropped connection is retried with backoff. */
  function startSession(room?: LocalRoom): LanSync {
    sessionRef.current?.close();
    window.clearTimeout(reconnectTimer.current);
    reconnectTimer.current = undefined;
    lastRoom.current = room ?? null;
    const pairCode = room?.code.trim().toLowerCase() ?? "";
    const session = new LanSync(
      {
        trust: {
          self: { deviceId, name: authorName },
          isTrusted: (peer) => readTrustedDevices().some((item) => item.deviceId === peer.deviceId),
          onPeer: async (peer) => {
            const accepted = await askConfirm({
              title: t("hooks.newDeviceTitle", { name: peer.name }),
              message: t("hooks.newDeviceMessage", { id: peer.deviceId.slice(0, 8) }),
              confirm: t("hooks.trustAndSync"),
            });
            if (accepted) rememberTrust(peer, pairCode);
            return accepted;
          },
        },
        getState: () => stateRef.current,
        getPresence: () => presenceRef.current,
        onPresence: (where) =>
          setPeerPresence(where && session.peer ? { ...session.peer, ...where, at: Date.now() } : null),
        onState: async (remote) => {
          const merged = mergeStates(stateRef.current, remote);
          rememberStateIds(merged.state);
          if (session.peer && pairCode) rememberTrust(session.peer, pairCode);
          stateRef.current = merged.state;
          setState(merged.state);
          setConflicts(merged.conflicts);
          setStatus(
            merged.conflicts.length
              ? t("hooks.conflictsFound", { count: merged.conflicts.length })
              : t("hooks.dataReceived"),
          );
          reconnectDelay.current = 5000;
          if (session.peer) markSynced(session.peer.deviceId);
          await session.requestFiles(merged.state);
        },
        onFile: (id) => {
          if (stateRef.current.boards.some((item) => item.backgroundImageId === id)) onFilesChanged();
          setState((current) => markMediaLocal(current, id));
        },
        onStatus: setStatus,
        onSent: () => {
          if (session.peer) markSynced(session.peer.deviceId);
        },
        // Offline queue: changes keep accumulating locally; when the relay connection drops, reconnect with backoff
        // and the full-state exchange on reconnect delivers everything made in the meantime.
        onClosed: () => {
          if (!room || sessionRef.current !== session) return;
          const delay = reconnectDelay.current;
          reconnectDelay.current = Math.min(delay * 2, 60_000);
          setStatus(t("hooks.reconnecting", { seconds: Math.round(delay / 1000) }));
          reconnectTimer.current = window.setTimeout(() => {
            if (sessionRef.current === session && navigator.onLine !== false) {
              try {
                startSession(room);
              } catch (cause) {
                setStatus(String(cause));
              }
            }
          }, delay);
        },
      },
      room,
      { internet: transport === "internet" },
    );
    sessionRef.current = session;
    return session;
  }

  async function createOffer() {
    try {
      setSignal(await startSession().createOffer());
      setStatus(t("hooks.offerCreated"));
    } catch (cause) {
      setStatus(t("hooks.offerFailed", { error: String(cause) }));
    }
  }

  async function acceptOffer() {
    try {
      setResponse(await startSession().acceptOffer(signal));
      setStatus(t("hooks.offerAccepted"));
    } catch (cause) {
      setStatus(t("hooks.acceptOfferFailed", { error: String(cause) }));
    }
  }

  async function acceptAnswer() {
    try {
      await sessionRef.current?.acceptAnswer(response);
      setStatus(t("hooks.waitingForConnection"));
    } catch (cause) {
      setStatus(t("hooks.acceptAnswerFailed", { error: String(cause) }));
    }
  }

  function connectLocalRoom() {
    try {
      const server = new URL(serverUrl);
      if (server.protocol !== "http:" && server.protocol !== "https:") throw new Error(t("hooks.serverAddressHttp"));
      server.protocol = server.protocol === "https:" ? "wss:" : "ws:";
      startSession({ url: server.href, code: roomCode });
      setStatus(t("hooks.connectingLocal"));
    } catch (cause) {
      setStatus(t("hooks.connectFailed", { error: String(cause) }));
    }
  }

  function syncNow() {
    try {
      sessionRef.current?.syncNow();
    } catch (cause) {
      setStatus(String(cause));
    }
  }

  async function shareBundle(code: string) {
    try {
      const blob = await createSyncBundle(stateRef.current, code, { deviceId, name: authorName }, loadAttachment);
      const file = new File([blob], `kanbonk-sync-${new Date().toISOString().slice(0, 10)}.kanbonk-sync`, {
        type: "application/octet-stream",
      });
      const result = await shareFile(file);
      setStatus(
        result === "shared"
          ? t("hooks.packageShared")
          : result === "cancelled"
            ? t("hooks.packageCancelled")
            : t("hooks.packageSaved"),
      );
    } catch (cause) {
      setStatus(t("hooks.packageFailed", { error: String(cause) }));
    }
  }

  async function openBundle(file: File | null) {
    if (!file) return;
    try {
      const codes = [...trustedDevices.map((item) => item.code), bundleCode.trim().toLowerCase()].filter(Boolean);
      const opened = await openSyncBundle(new Uint8Array(await file.arrayBuffer()), codes);
      const sender = opened.sender;
      if (sender?.deviceId === deviceId) {
        setStatus(t("hooks.packageOwnDevice"));
        return;
      }
      if (sender && !trustedDevices.some((item) => item.deviceId === sender.deviceId)) {
        if (
          !(await askConfirm({
            title: t("hooks.trustSenderTitle", { name: sender.name }),
            message: t("hooks.trustSenderMessage"),
            confirm: t("hooks.trustAndAccept"),
          }))
        )
          return;
      }
      if (sender) rememberTrust(sender, opened.code);
      for (const item of opened.files) if (!(await loadAttachment(item.id))) await saveAttachment(item.id, item.blob);
      const merged = mergeStates(stateRef.current, opened.state);
      rememberStateIds(merged.state);
      stateRef.current = merged.state;
      setState(opened.files.reduce((current, item) => markMediaLocal(current, item.id), merged.state));
      onFilesChanged();
      setConflicts(merged.conflicts);
      setStatus(t("hooks.packageAccepted", { files: opened.files.length, conflicts: merged.conflicts.length }));
    } catch (cause) {
      setStatus(String(cause instanceof Error ? cause.message : cause));
    }
  }

  function resolveConflict(conflict: SyncConflict, version: "local" | "remote") {
    setState((current) => chooseConflict(current, conflict, version, deviceId));
    setConflicts((current) => current.filter((item) => item !== conflict));
    setStatus(t("hooks.versionChosen"));
  }

  // Tell the connected device where this one is when that changes, and every half minute so it knows this one is
  // still here; a device silent for 90 seconds is no longer shown.
  const { boardId: presentBoardId, cardId: presentCardId } = presence;
  useEffect(() => {
    void sessionRef.current?.sendPresence({ boardId: presentBoardId, cardId: presentCardId });
  }, [presentBoardId, presentCardId]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      void sessionRef.current?.sendPresence();
      setPeerPresence((current) => (current && Date.now() - current.at > 90_000 ? null : current));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Send local changes shortly after they happen, when a session is connected.
  useEffect(() => {
    if (!ready) return;
    const heads = JSON.stringify(state.heads);
    if (heads === sentHeads.current) return;
    sentHeads.current = heads;
    const timer = window.setTimeout(() => {
      void sessionRef.current?.syncIfConnected();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [state.heads, ready]);

  // Coming back online reconnects at once instead of waiting for the backoff timer.
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine !== false);
      if (navigator.onLine !== false && reconnectTimer.current !== undefined && lastRoom.current) {
        try {
          startSession(lastRoom.current);
        } catch (cause) {
          setStatus(String(cause));
        }
      }
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  });

  // Same-device sync: other tabs/windows of this browser profile announce saves; merge what they stored.
  const mergeFromOtherTab = useEffectEvent(() => {
    void loadState()
      .then((stored) => {
        const current = stateRef.current;
        const merged = mergeStates(current, stored);
        if (
          JSON.stringify(merged.state.heads) === JSON.stringify(current.heads) &&
          JSON.stringify(merged.state.tombstones ?? {}) === JSON.stringify(current.tombstones ?? {})
        )
          return;
        rememberStateIds(merged.state);
        stateRef.current = merged.state;
        setState(merged.state);
        if (merged.conflicts.length) setConflicts(merged.conflicts);
      })
      .catch((cause) => onError(t("hooks.tabMergeFailed", { error: String(cause) })));
  });
  useEffect(() => {
    if (!ready) return;
    const channel = tabChannel(() => mergeFromOtherTab());
    tabs.current = channel;
    return () => {
      channel.close();
      tabs.current = null;
    };
  }, [ready]);

  const lastSyncAt = trustedDevices.reduce(
    (latest, item) => (item.lastSyncAt && item.lastSyncAt > latest ? item.lastSyncAt : latest),
    "",
  );
  // Offline queue size: local revisions newer than the last exchange with any trusted device.
  const pendingChanges = useMemo(
    () =>
      trustedDevices.length
        ? state.revisions.filter((item) => item.deviceId === deviceId && item.createdAt > lastSyncAt).length
        : 0,
    [state.revisions, trustedDevices.length, lastSyncAt, deviceId],
  );
  const badge = !trustedDevices.length
    ? t("hooks.badgeLocal")
    : !online
      ? pendingChanges
        ? t("hooks.badgeOfflineQueued", { count: pendingChanges })
        : t("hooks.badgeOffline")
      : pendingChanges
        ? t("hooks.badgeUnsent", { count: pendingChanges })
        : t("hooks.badgeSynced");

  return {
    peerPresence,
    trustedDevices,
    removeDevice,
    transport,
    setTransport,
    signal,
    setSignal,
    response,
    setResponse,
    roomCode,
    setRoomCode,
    serverUrl,
    setServerUrl,
    bundleCode,
    setBundleCode,
    status,
    online,
    conflicts,
    resolveConflict,
    pendingChanges,
    badge,
    createOffer,
    acceptOffer,
    acceptAnswer,
    connectLocalRoom,
    syncNow,
    shareBundle,
    openBundle,
    /** Tells other tabs of this browser that new data was saved. */
    notifyTabs: () => tabs.current?.notify(),
  };
}

export type DeviceSync = ReturnType<typeof useDeviceSync>;
