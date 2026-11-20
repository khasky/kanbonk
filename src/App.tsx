import { useDeferredValue, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  deviceId,
  listSnapshots,
  loadAttachment,
  loadSnapshot,
  loadState,
  readLocalAuthor,
  saveAttachment,
  saveLocalAuthor,
  saveState,
  type SnapshotMeta,
} from "./storage";
import { boardHref, linkHref, trashHref, useRoute, type CalendarScale, type Route } from "./router";
import {
  emptyTrash,
  moveToTrash,
  purgeExpired,
  purgeFromTrash,
  restoreFromTrash,
  trashImpact,
  visibleState,
  type TrashImpact,
  type TrashKind,
} from "./trash";

import { exportTrelloCsv, exportTrelloJson } from "./trelloFormats";
import { mergeDuplicate, pairKey } from "./dedupe";

import { ColorInput } from "./ColorInput";

import { DocView } from "./DocView";
import { AiPanel, AiSettingsDialog, type ProposedCard } from "./AiPanel";
import { readAiSettings, saveAiSettings, type AiSettings } from "./ai";

import { saveFile, shareFile } from "./platform";
import { assignListToZone, createZone, deleteZone, moveListToList, moveZone, updateZone, zoneRuns } from "./zones";
import {
  BoardCalendar,
  DedupeDialog,
  DeleteDialog,
  HomePage,
  MissingPage,
  TrashPage,
  WorkspacePage,
  ZoneFrame,
} from "./pages";
import {
  autoBackupIntervalMs,
  autoSnapshot,
  backupDue,
  lastAutoBackup,
  loadAutoBackupSettings,
  writeAutoBackup,
} from "./autoBackup";
import { SettingsDialog } from "./SettingsDialog";
import { ImportDialog } from "./dialogs/ImportDialog";
import { ensurePersonalWorkspace, personalWorkspaceId } from "./workspaces";
import {
  createSyncBundle,
  openSyncBundle,
  readTrustedDevices,
  saveTrustedDevices,
  tabChannel,
  trustDevice,
  type SyncTransport,
  type TrustedDevice,
} from "./devices";
import {
  cloneCard,
  cloneCardName,
  createSubCard,
  type Member,
  rememberStateIds,
  recordRevisions,
  convertChecklistItem,
  copyBoard,
  copyList,
  createCardFromTemplate,
  deleteLabel,
  emptyBoardFilter,
  emptyState,
  filterBoardCards,
  linkDependency,
  markMediaLocal,
  newId,
  positionBefore,
  recordRevision,
  restoreRevision,
  searchCards,
  sortListCards,
  transferCard,
  unlinkDependency,
  type AppState,
  type AutomationRule,
  type Board,
  type BoardFilter,
  type BoardList,
  type Zone,
  type Card,
  type Revision,
} from "./model";
import { LanSync, newRoomCode } from "./lanSync";
import { chooseConflict, mergeStates, type SyncConflict } from "./sync";

import { createBackupParts, restoreBackup } from "./backup";
import { applyCardButton, applyDueRules, applyMoveRules } from "./automation";
import { dueReminders, reminderSignature } from "./reminders";
import { applyDueRecurrence } from "./repeatingDue";
import { ensureInbox, inboxBoardId, inboxListId, inboxWorkspaceId } from "./inbox";

import { AutomationPanel } from "./board/AutomationPanel";
import { BoardActivity } from "./board/BoardActivity";
import { CardTile, type TileActions } from "./board/CardTile";
import { ListCards } from "./board/ListCards";
import { TemplateComposer } from "./board/TemplateComposer";
import { CardDialog } from "./card/CardDialog";
import { LocalRoomControls } from "./dialogs/LocalRoomControls";
import { InboxView } from "./panels/InboxView";
import { PlannerView } from "./panels/PlannerView";
import { Icon } from "./ui/Icon";
import { NameEditor } from "./ui/NameEditor";
import {
  readBoardFilters,
  readDismissedReminders,
  readPanelWidths,
  type PanelName,
  type PanelVisibility,
  type PanelWidths,
} from "./uiPreferences";
import "./MarkdownText.css";
import "./activity.css";
import "./App.css";
import "./pages.css";

const boardColors = ["#147d86", "#0c66e4", "#5e4db2", "#a54800", "#216e4e"];
const plannerViewId = "kanbonk-planner";
function App() {
  const [fullState, setState] = useState<AppState>(emptyState);
  const state = useMemo(() => visibleState(fullState), [fullState]);
  const { route, navigate, back } = useRoute();
  /** The page shown in the main area; a card modal keeps the page it was opened from. */
  const page: Route = route.page === "card" ? (route.background ?? { page: "card", id: route.id }) : route;
  const boardId = page.page === "board" ? page.id : null;
  const cardId = route.page === "card" ? route.id : null;
  const cardAsPage = route.page === "card" && !route.background;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [activePanel, setActivePanel] = useState<"inbox" | "planner" | null>(null);
  const [visiblePanels, setVisiblePanels] = useState<PanelVisibility>({ inbox: false, planner: false });
  const [panelWidths, setPanelWidths] = useState<PanelWidths>(readPanelWidths);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const [search, setSearch] = useState("");
  const [boardFilters, setBoardFilters] = useState<Record<string, BoardFilter>>(readBoardFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [editingList, setEditingList] = useState(false);
  const [editingCardList, setEditingCardList] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [panel, setPanel] = useState<"archive" | "history" | null>(null);
  const [activityBoardId, setActivityBoardId] = useState<string | null>(null);
  const [automationBoardId, setAutomationBoardId] = useState<string | null>(null);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [dismissedReminders, setDismissedReminders] = useState<Record<string, string>>(readDismissedReminders);
  const [now, setNow] = useState(Date.now);
  const [archiveBoardId, setArchiveBoardId] = useState<string | null>(null);
  const [boardAboutOpen, setBoardAboutOpen] = useState(false);
  const [closedBoardsOpen, setClosedBoardsOpen] = useState(false);
  const [boardCopy, setBoardCopy] = useState<{
    name: string;
    workspaceId: string;
    keepCards: boolean;
    keepTemplates: boolean;
  } | null>(null);
  const [boardDescriptionDraft, setBoardDescriptionDraft] = useState("");
  const [creation, setCreation] = useState<{ kind: "workspace" | "board"; workspaceId?: string } | null>(null);
  const [creationName, setCreationName] = useState("");
  const [importing, setImporting] = useState(false);
  const [localAuthor, setLocalAuthor] = useState(readLocalAuthor);
  const [authorDialogOpen, setAuthorDialogOpen] = useState(false);
  const [authorDraft, setAuthorDraft] = useState("");
  const boardMenu = useRef<HTMLDetailsElement>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupFiles, setBackupFiles] = useState<File[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupReport, setBackupReport] = useState("");
  const [backupConflicts, setBackupConflicts] = useState<SyncConflict[]>([]);
  const [syncOpen, setSyncOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(readAiSettings);
  const [syncSignal, setSyncSignal] = useState("");
  const [syncResponse, setSyncResponse] = useState("");
  const [syncRoomCode, setSyncRoomCode] = useState("");
  const [syncServerUrl, setSyncServerUrl] = useState(() =>
    /^https?:$/.test(window.location.protocol) ? window.location.origin : "",
  );
  const [syncStatus, setSyncStatus] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const reconnectTimer = useRef<number | undefined>(undefined);
  const reconnectDelay = useRef(5000);
  const lastLan = useRef<{ url: string; code: string } | null>(null);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([]);
  const [fileVersion, setFileVersion] = useState(0);
  const [backgroundImage, setBackgroundImage] = useState<{ id: string; url: string } | null>(null);
  const tabs = useRef<{ notify: () => void; close: () => void } | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const autoBackupRunning = useRef(false);
  const autoBackupError = useRef("");
  const [pendingDelete, setPendingDelete] = useState<{
    kind: TrashKind;
    id: string;
    name: string;
    impact: TrashImpact;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeCardId, setNoticeCardId] = useState<string>();
  const [cloneRequest, setCloneRequest] = useState<string>();
  useEffect(() => {
    if (!notice) {
      setNoticeCardId(undefined);
      return;
    }
    const timer = window.setTimeout(() => setNotice(""), 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const [dedupeOpen, setDedupeOpen] = useState(false);
  const [dedupeIgnored, setDedupeIgnored] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("kanbonk-dedupe-ignored") ?? "[]"));
    } catch {
      return new Set();
    }
  });
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>(readTrustedDevices);
  const [syncTransport, setSyncTransport] = useState<SyncTransport>(() => {
    const saved = localStorage.getItem("kanbonk-sync-transport");
    return saved === "internet" || saved === "file" ? saved : "wifi";
  });
  const [bundleCode, setBundleCode] = useState("");
  const queue = useRef(Promise.resolve());
  const localDeviceId = useRef(deviceId());
  const syncRef = useRef<LanSync | null>(null);
  const stateRef = useRef(fullState);
  const sentHeads = useRef("");
  stateRef.current = fullState;
  const wideLayout = viewportWidth >= 1500;
  const shownPanels: PanelName[] = wideLayout
    ? (["inbox", "planner"] as const).filter((name) => visiblePanels[name])
    : activePanel && visiblePanels[activePanel]
      ? [activePanel]
      : [];
  const panelWidthLimit = Math.max(
    220,
    Math.min(720, shownPanels.length === 2 ? Math.floor((viewportWidth - 776) / 2) : viewportWidth - 580),
  );

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", update);
    update();
    return () => window.removeEventListener("resize", update);
  }, []);

  function resizePanelStart(event: ReactPointerEvent<HTMLDivElement>, panel: PanelName) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = Math.min(panelWidths[panel], panelWidthLimit);
    const handle = event.currentTarget;
    function move(pointer: PointerEvent) {
      setPanelWidths((current) => ({
        ...current,
        [panel]: Math.min(panelWidthLimit, Math.max(220, startWidth + pointer.clientX - startX)),
      }));
    }
    function stop() {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    }
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  function resizePanelKey(event: React.KeyboardEvent<HTMLDivElement>, panel: PanelName) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    setPanelWidths((current) => ({
      ...current,
      [panel]:
        event.key === "Home"
          ? 220
          : event.key === "End"
            ? panelWidthLimit
            : Math.min(
                panelWidthLimit,
                Math.max(220, Math.min(current[panel], panelWidthLimit) + (event.key === "ArrowRight" ? 20 : -20)),
              ),
    }));
  }

  useEffect(() => {
    localStorage.setItem("kanbonk-panel-widths", JSON.stringify(panelWidths));
  }, [panelWidths]);
  useEffect(() => {
    if (ready) localStorage.setItem("kanbonk-open-panels", JSON.stringify(visiblePanels));
  }, [visiblePanels, ready]);

  useEffect(() => {
    loadState()
      .then((loaded) => {
        loaded = ensureInbox(loaded, localDeviceId.current);
        setState(loaded);
        const savedPanel = localStorage.getItem("kanbonk-active-panel");
        const initialPanel = savedPanel === "inbox" || savedPanel === "planner" ? savedPanel : null;
        setActivePanel(initialPanel);
        try {
          const stored = JSON.parse(localStorage.getItem("kanbonk-open-panels") ?? "null");
          setVisiblePanels(
            stored && typeof stored.inbox === "boolean" && typeof stored.planner === "boolean"
              ? stored
              : { inbox: initialPanel === "inbox", planner: initialPanel === "planner" },
          );
        } catch {
          setVisiblePanels({ inbox: initialPanel === "inbox", planner: initialPanel === "planner" });
        }
        setReady(true);
      })
      .catch((cause) => setError(`Could not open local data: ${String(cause)}`));
  }, []);

  useEffect(() => {
    if (!ready) return;
    queue.current = queue.current
      .then(() => saveState(fullState))
      .then(() => tabs.current?.notify())
      .catch((cause) => setError(`Could not save changes: ${String(cause)}`));
  }, [fullState, ready]);

  useEffect(() => {
    if (!ready) return;
    const heads = JSON.stringify(fullState.heads);
    if (heads === sentHeads.current) return;
    sentHeads.current = heads;
    const timer = window.setTimeout(() => {
      void syncRef.current?.syncIfConnected();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [fullState.heads, ready]);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine !== false);
      if (navigator.onLine !== false && reconnectTimer.current !== undefined && lastLan.current) {
        try {
          syncSession(lastLan.current);
        } catch (cause) {
          setSyncStatus(String(cause));
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
  useEffect(() => {
    if (!ready) return;
    const channel = tabChannel(() => {
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
          if (merged.conflicts.length) setSyncConflicts(merged.conflicts);
        })
        .catch((cause) => setError(`Could not get changes from another tab: ${String(cause)}`));
    });
    tabs.current = channel;
    return () => {
      channel.close();
      tabs.current = null;
    };
  }, [ready]);

  // Automatic backups: local snapshots every 10 minutes (and when the page is hidden) plus full ZIP backups on the schedule from Settings.
  useEffect(() => {
    if (!ready) return;
    const run = () => {
      void autoSnapshot(stateRef.current)
        .then((meta) => {
          if (meta) setSnapshots((current) => [meta, ...current]);
        })
        .catch((cause) => setError(`Automatic backup was not created: ${String(cause)}`));
      if (autoBackupRunning.current) return;
      autoBackupRunning.current = true;
      void (async () => {
        const settings = await loadAutoBackupSettings();
        if (!backupDue(settings, await lastAutoBackup())) return;
        await writeAutoBackup(stateRef.current, settings);
        autoBackupError.current = "";
      })()
        .catch((cause) => {
          // A failing backup is reported once per distinct reason, not every 10 minutes.
          const message = String(cause instanceof Error ? cause.message : cause);
          if (message !== autoBackupError.current) setError(`Automatic backup failed: ${message} Check ⋯ → Settings.`);
          autoBackupError.current = message;
        })
        .finally(() => {
          autoBackupRunning.current = false;
        });
    };
    const first = window.setTimeout(run, 30_000);
    const interval = window.setInterval(run, autoBackupIntervalMs);
    const hidden = () => {
      if (document.visibilityState === "hidden") void autoSnapshot(stateRef.current);
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      if (activePanel) localStorage.setItem("kanbonk-active-panel", activePanel);
      else localStorage.removeItem("kanbonk-active-panel");
    } catch (cause) {
      setError(`Could not save the selected section: ${String(cause)}`);
    }
  }, [activePanel, ready]);

  useEffect(() => {
    try {
      localStorage.setItem("kanbonk-board-filters", JSON.stringify(boardFilters));
    } catch (cause) {
      setError(`Could not save the board filter: ${String(cause)}`);
    }
  }, [boardFilters]);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    if (ready)
      setState((current) =>
        purgeExpired(applyDueRules(current, now, localDeviceId.current), localDeviceId.current, now),
      );
  }, [ready, now, state.boards, state.cards]);

  useEffect(() => {
    try {
      localStorage.setItem("kanbonk-dismissed-reminders", JSON.stringify(dismissedReminders));
    } catch (cause) {
      setError(`Could not save reminders: ${String(cause)}`);
    }
  }, [dismissedReminders]);

  const board = state.boards.find((item) => item.id === boardId && !item.archived);
  const defaultWorkspaceId = state.workspaces.find((item) => item.id !== inboxWorkspaceId && !item.archived)?.id;
  const lists = state.lists
    .filter((item) => item.boardId === boardId && !item.archived)
    .sort((a, b) => a.position - b.position);
  const card = state.cards.find((item) => item.id === cardId && !item.archived);
  const deferredSearch = useDeferredValue(search);
  const matchingCards = useMemo(() => searchCards(state, deferredSearch).slice(0, 50), [state, deferredSearch]);
  const matchingBoards = search.trim()
    ? state.boards
        .filter(
          (item) =>
            item.id !== inboxBoardId &&
            !item.archived &&
            item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
        )
        .slice(0, 20)
    : [];
  const boardFilter = useMemo(() => boardFilters[boardId ?? ""] ?? emptyBoardFilter(), [boardFilters, boardId]);
  const deferredFilter = useDeferredValue(boardFilter);
  const filteredCards = useMemo(
    () => (boardId ? filterBoardCards(state, boardId, deferredFilter) : []),
    [state, boardId, deferredFilter],
  );
  const filteredCardIds = useMemo(() => new Set(filteredCards.map((item) => item.id)), [filteredCards]);
  const cardsByList = useMemo(() => {
    const groups = new Map<string, Card[]>();
    for (const item of filteredCards) {
      const group = groups.get(item.listId);
      if (group) group.push(item);
      else groups.set(item.listId, [item]);
    }
    for (const group of groups.values()) group.sort((a, b) => a.position - b.position);
    return groups;
  }, [filteredCards]);
  const labelMap = useMemo(
    () => new Map(state.labels.filter((item) => !item.deleted).map((item) => [item.id, item])),
    [state.labels],
  );
  const cardById = useMemo(() => new Map(state.cards.map((item) => [item.id, item])), [state.cards]);
  const tileHandlers = useRef<TileActions>({ open: () => undefined, drop: () => undefined });
  tileHandlers.current = {
    open: (id) => setCardId(id),
    drop: (movingId, target) => {
      const moving = state.cards.find((entry) => entry.id === movingId);
      if (moving && moving.id !== target.id && moving.boardId === target.boardId)
        updateCard(moving.id, (current) => ({
          ...current,
          listId: target.listId,
          position: positionBefore(state.cards, moving.id, target),
        }));
    },
  };
  const tileActions = useMemo<TileActions>(
    () => ({
      open: (id) => tileHandlers.current.open(id),
      drop: (movingId, target) => tileHandlers.current.drop(movingId, target),
    }),
    [],
  );
  const boardCardCount = boardId ? filterBoardCards(state, boardId, emptyBoardFilter()).length : 0;
  const closedBoards = state.boards.filter((item) => item.archived);
  const reminders = useMemo(() => dueReminders(state, now, dismissedReminders), [state, now, dismissedReminders]);
  const boardTemplates = state.cards.filter((item) => item.boardId === boardId && item.isTemplate);
  const filterCount =
    Number(Boolean(boardFilter.keyword.trim())) +
    Number(Boolean(boardFilter.labelId)) +
    Number(Boolean(boardFilter.memberId)) +
    Number(boardFilter.status !== "all") +
    Number(boardFilter.due !== "any");

  function updateFilter(change: Partial<BoardFilter>) {
    if (!boardId) return;
    setBoardFilters((current) => ({
      ...current,
      [boardId]: { ...(current[boardId] ?? emptyBoardFilter()), ...change },
    }));
  }

  useEffect(() => {
    const id = board?.backgroundImageId;
    if (!id) return;
    let url = "";
    let cancelled = false;
    loadAttachment(id)
      .then((blob) => {
        if (!blob || cancelled) return;
        url = URL.createObjectURL(blob);
        setBackgroundImage({ id, url });
      })
      .catch((cause) => setError(`Could not open the board background: ${String(cause)}`));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [board?.backgroundImageId, fileVersion]);

  function setBoardId(id: string | null) {
    navigate(id ? boardHref(id) : "/");
  }

  /** Opening a card from any page shows a modal over that page; closing returns to it. */
  function setCardId(id: string | null) {
    if (id) {
      navigate(`/c/${id}`, { modal: true });
      return;
    }
    if (route.page !== "card") return;
    if (route.background) {
      back();
      return;
    }
    const target = fullState.cards.find((item) => item.id === route.id);
    navigate(target && target.boardId !== inboxBoardId ? boardHref(target.boardId) : "/");
  }

  const cloneSource = cloneRequest ? state.cards.find((item) => item.id === cloneRequest) : undefined;

  function confirmClone() {
    if (!cloneSource) return;
    const id = newId();
    const name = cloneCardName(state, cloneSource.id);
    setState((current) =>
      recordRevision(cloneCard(current, cloneSource.id, id).state, "card", id, localDeviceId.current),
    );
    setCloneRequest(undefined);
    setNotice(`Card cloned: “${name}”.`);
    setNoticeCardId(id);
  }

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

  function requestDelete(kind: TrashKind, id: string) {
    setPendingDelete({ kind, id, name: entityName(kind, id), impact: trashImpact(fullState, kind, id) });
  }

  function confirmDelete(withDependents: boolean) {
    if (!pendingDelete) return;
    const { kind, id } = pendingDelete;
    setState((current) => moveToTrash(current, kind, id, localDeviceId.current, { withDependents }));
    setPendingDelete(null);
    if (kind === "card" && cardId === id) setCardId(null);
    if (kind === "board" && boardId === id)
      navigate(`/w/${fullState.boards.find((item) => item.id === id)?.workspaceId ?? ""}`);
    if (kind === "workspace" && page.page === "workspace" && page.id === id) navigate("/");
    setNotice(`“${pendingDelete.name}” moved to trash.`);
  }

  function restoreTrashed(kind: TrashKind, id: string) {
    const result = restoreFromTrash(fullState, kind, id, localDeviceId.current);
    setState(result.state);
    const extra = result.restored.length - 1;
    setNotice(`Restored “${entityName(kind, id)}”${extra > 0 ? ` along with related items: ${extra}` : ""}.`);
  }

  function purgeTrashed(kind: TrashKind, id: string) {
    if (!confirm(`Delete “${entityName(kind, id)}” forever? This can't be undone (except by restoring from a backup).`))
      return;
    setState((current) => purgeFromTrash(current, kind, id, localDeviceId.current));
  }

  function emptyAllTrash() {
    if (!confirm("Empty trash forever?")) return;
    setState((current) => emptyTrash(current, localDeviceId.current));
  }

  function downloadText(content: string, name: string, type: string) {
    saveFile(new Blob([content], { type }), name).catch((cause) =>
      setError(`Could not save “${name}”: ${String(cause)}`),
    );
  }

  function rememberTrust(peer: { deviceId: string; name: string }, code: string) {
    setTrustedDevices((current) => {
      const next = trustDevice(current, peer, code);
      saveTrustedDevices(next);
      return next;
    });
  }

  async function shareSyncBundle(code: string) {
    try {
      const blob = await createSyncBundle(
        stateRef.current,
        code,
        { deviceId: localDeviceId.current, name: localAuthor },
        loadAttachment,
      );
      const file = new File([blob], `kanbonk-sync-${new Date().toISOString().slice(0, 10)}.kanbonk-sync`, {
        type: "application/octet-stream",
      });
      const result = await shareFile(file);
      setSyncStatus(
        result === "shared"
          ? "Package sent via the system Share menu (Bluetooth, Nearby Share, etc.)."
          : result === "cancelled"
            ? "Package saving canceled."
            : "Package saved. Transfer the file via Bluetooth, USB or any other way and open it on a trusted device.",
      );
    } catch (cause) {
      setSyncStatus(`Could not create package: ${String(cause)}`);
    }
  }

  async function openBundle(file: File | null) {
    if (!file) return;
    try {
      const codes = [...trustedDevices.map((item) => item.code), bundleCode.trim().toLowerCase()].filter(Boolean);
      const opened = await openSyncBundle(new Uint8Array(await file.arrayBuffer()), codes);
      if (opened.sender?.deviceId === localDeviceId.current) {
        setSyncStatus("This package was created on this device. Open it on another one.");
        return;
      }
      if (opened.sender && !trustedDevices.some((item) => item.deviceId === opened.sender!.deviceId)) {
        if (!confirm(`Add “${opened.sender.name}” to trusted devices and accept the data?`)) return;
      }
      if (opened.sender) rememberTrust(opened.sender, opened.code);
      for (const item of opened.files) if (!(await loadAttachment(item.id))) await saveAttachment(item.id, item.blob);
      const merged = mergeStates(stateRef.current, opened.state);
      rememberStateIds(merged.state);
      stateRef.current = merged.state;
      setState(opened.files.reduce((current, item) => markMediaLocal(current, item.id), merged.state));
      setFileVersion((current) => current + 1);
      setSyncConflicts(merged.conflicts);
      setSyncStatus(`Package accepted. Files: ${opened.files.length}, conflicts: ${merged.conflicts.length}.`);
    } catch (cause) {
      setSyncStatus(String(cause instanceof Error ? cause.message : cause));
    }
  }

  async function refreshBackupInfo() {
    setSnapshots((await listSnapshots()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async function restoreSnapshot(meta: SnapshotMeta) {
    if (
      !confirm(
        `Restore all data to the state from ${new Date(meta.createdAt).toLocaleString("en-US")}? The current state will be saved as a separate backup first.`,
      )
    )
      return;
    try {
      await autoSnapshot(stateRef.current);
      const snapshot = await loadSnapshot(meta.id);
      if (!snapshot) throw new Error("Backup not found.");
      rememberStateIds(snapshot);
      stateRef.current = snapshot;
      setState(snapshot);
      setFileVersion((current) => current + 1);
      setBackupReport("Data restored from the automatic backup.");
      await refreshBackupInfo();
    } catch (cause) {
      setBackupReport(`Restore failed: ${String(cause)}`);
    }
  }

  function createWorkspace(name: string) {
    if (!name) return;
    const workspace = { id: newId(), name };
    setState((current) =>
      recordRevision(
        { ...current, workspaces: [...current.workspaces, workspace] },
        "workspace",
        workspace.id,
        localDeviceId.current,
      ),
    );
    navigate(`/w/${workspace.id}`);
  }

  function createBoard(name: string, workspaceId = defaultWorkspaceId) {
    if (!name) return;
    const targetWorkspaceId = workspaceId ?? personalWorkspaceId;
    const created: Board = {
      id: newId(),
      workspaceId: targetWorkspaceId,
      name,
      description: "",
      background: boardColors[0],
      members: [],
      starred: false,
    };
    setState((current) => {
      const next = ensurePersonalWorkspace(current, targetWorkspaceId, localDeviceId.current);
      if (!next.workspaces.some((item) => item.id === targetWorkspaceId && !item.archived)) return current;
      return recordRevision({ ...next, boards: [...next.boards, created] }, "board", created.id, localDeviceId.current);
    });
    setBoardId(created.id);
  }

  function submitBoardCopy() {
    if (!board || !boardCopy?.name.trim()) return;
    const id = newId();
    setState((current) => {
      const copied = copyBoard(current, board.id, boardCopy, id);
      return recordRevisions(
        copied.state,
        [
          { kind: "board", id },
          ...copied.listIds.map((listId) => ({ kind: "list" as const, id: listId })),
          ...copied.state.labels
            .filter((item) => item.boardId === id)
            .map((label) => ({ kind: "label" as const, id: label.id })),
          ...copied.cardIds.map((cardId) => ({ kind: "card" as const, id: cardId })),
        ],
        localDeviceId.current,
      );
    });
    setBoardId(id);
    setBoardCopy(null);
  }

  function openCreation(kind: "workspace" | "board", workspaceId?: string) {
    setCreation({ kind, workspaceId });
    setCreationName("");
  }

  function togglePanel(target: "inbox" | "planner") {
    if (!wideLayout && activePanel !== target) {
      showPanel(target);
      setCardId(null);
      return;
    }
    const opening = !visiblePanels[target];
    const other = target === "inbox" ? "planner" : "inbox";
    setVisiblePanels((current) => ({ ...current, [target]: opening }));
    setActivePanel(opening ? target : visiblePanels[other] && wideLayout ? other : null);
    setCardId(null);
  }

  function showPanel(target: PanelName) {
    setVisiblePanels((current) => ({ ...current, [target]: true }));
    setActivePanel(target);
  }

  function showBoard(target: string) {
    setBoardId(target);
    setActivePanel(null);
  }

  function openArchive(targetBoardId: string) {
    setArchiveBoardId(targetBoardId);
    setPanel("archive");
  }

  function submitCreation() {
    const name = creationName.trim();
    if (!creation || !name) return;
    if (creation.kind === "workspace") createWorkspace(name);
    else createBoard(name, creation.workspaceId);
    setCreation(null);
  }

  function updateBoard(change: (item: Board) => Board) {
    if (!board) return;
    setState((current) =>
      recordRevision(
        { ...current, boards: current.boards.map((item) => (item.id === board.id ? change(item) : item)) },
        "board",
        board.id,
        localDeviceId.current,
      ),
    );
  }

  function openBoardAbout() {
    if (!board) return;
    setBoardDescriptionDraft(board.description);
    setBoardAboutOpen(true);
  }

  function saveBoardDescription() {
    if (board && boardDescriptionDraft !== board.description)
      updateBoard((item) => ({ ...item, description: boardDescriptionDraft }));
    setBoardAboutOpen(false);
  }

  function closeBoard() {
    if (!board || !confirm(`Close board “${board.name}”? You can reopen it later.`)) return;
    updateBoard((item) => ({ ...item, archived: true }));
    setBoardId(
      state.boards.find((item) => item.id !== board.id && item.id !== inboxBoardId && !item.archived)?.id ?? null,
    );
    setCardId(null);
    setClosedBoardsOpen(true);
  }

  function restoreClosedBoard(id: string) {
    setState((current) => {
      const target = current.boards.find((item) => item.id === id && item.archived);
      return target
        ? recordRevision(
            {
              ...current,
              boards: current.boards.map((item) => (item.id === id ? { ...item, archived: false } : item)),
            },
            "board",
            id,
            localDeviceId.current,
          )
        : current;
    });
    setBoardId(id);
    setClosedBoardsOpen(false);
  }

  function updateList(id: string, change: (item: AppState["lists"][number]) => AppState["lists"][number]) {
    setState((current) =>
      recordRevision(
        { ...current, lists: current.lists.map((item) => (item.id === id ? change(item) : item)) },
        "list",
        id,
        localDeviceId.current,
      ),
    );
  }

  function moveList(id: string, targetId: string, after = false) {
    setState((current) => moveListToList(current, id, targetId, after, localDeviceId.current));
  }

  function moveZoneTo(zoneId: string, targetListId: string, after: boolean) {
    if (board) setState((current) => moveZone(current, board.id, zoneId, targetListId, after, localDeviceId.current));
  }

  /** `value`: a zone id, "none" to leave the zone, or "new" to create a zone for this list. */
  function setListZone(listId: string, value: string) {
    if (!board) return;
    if (value === "new") {
      const name = prompt("Zone name, e.g. “Development”")?.trim();
      if (name) setState((current) => createZone(current, board.id, name, [listId], localDeviceId.current).state);
      return;
    }
    setState((current) =>
      assignListToZone(current, listId, value === "none" ? undefined : value, localDeviceId.current),
    );
  }

  function changeZone(zoneId: string, change: { name?: string; color?: string }) {
    if (board) setState((current) => updateZone(current, board.id, zoneId, change, localDeviceId.current));
  }

  function removeZone(zone: Zone) {
    if (board && confirm(`Remove zone “${zone.name}”? Lists and cards will stay on the board.`))
      setState((current) => deleteZone(current, board.id, zone.id, localDeviceId.current));
  }

  function renderList(list: BoardList) {
    return (
      <section
        className="list-column"
        key={list.id}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          const movingZoneId = event.dataTransfer.getData("text/kanbonk-zone");
          if (movingZoneId) {
            moveZoneTo(movingZoneId, list.id, event.clientX > bounds.left + bounds.width / 2);
            return;
          }
          const movingListId = event.dataTransfer.getData("text/kanbonk-list");
          if (movingListId) {
            moveList(movingListId, list.id, event.clientX > bounds.left + bounds.width / 2);
            return;
          }
          const id = event.dataTransfer.getData("text/kanbonk-card");
          if (id)
            updateCard(id, (item) => ({
              ...item,
              listId: list.id,
              position:
                Math.max(0, ...state.cards.filter((entry) => entry.listId === list.id).map((entry) => entry.position)) +
                1,
            }));
        }}
      >
        <div className="list-header">
          <span
            className="list-drag-handle"
            draggable
            title="Drag list"
            onDragStart={(event) => event.dataTransfer.setData("text/kanbonk-list", list.id)}
          >
            ⋮⋮
          </span>
          <NameEditor
            value={list.name}
            label={`List title ${list.name}`}
            onCommit={(name) => updateList(list.id, (item) => ({ ...item, name }))}
          />
          <select
            className="list-sort"
            aria-label={`List actions ${list.name}`}
            title="List actions"
            defaultValue=""
            onChange={(event) => {
              const action = event.target.value;
              if (action === "name" || action === "due") sortList(list.id, action);
              else if (action === "move-left") moveListByOne(list.id, -1);
              else if (action === "move-right") moveListByOne(list.id, 1);
              else if (action === "copy") copyListOnBoard(list.id);
              else if (action === "delete") requestDelete("list", list.id);
              else if (action.startsWith("zone:")) setListZone(list.id, action.slice(5));
              event.target.value = "";
            }}
          >
            <option value="">⋯</option>
            <option value="name">Sort by title</option>
            <option value="due">Sort by due date</option>
            <option value="move-left">Move left</option>
            <option value="move-right">Move right</option>
            <option value="copy">Copy list</option>
            <optgroup label="Zone">
              {list.zoneId && <option value="zone:none">Remove from zone</option>}
              {(board?.zones ?? [])
                .filter((zone) => zone.id !== list.zoneId)
                .map((zone) => (
                  <option key={zone.id} value={`zone:${zone.id}`}>
                    To zone “{zone.name}”
                  </option>
                ))}
              <option value="zone:new">New zone…</option>
            </optgroup>
            <option value="delete">Move list to trash</option>
          </select>
          <button
            onClick={() => {
              if (confirm(`Archive list “${list.name}”?`)) updateList(list.id, (item) => ({ ...item, archived: true }));
            }}
            aria-label={`Archive list ${list.name}`}
          >
            <Icon name="archive" />
          </button>
        </div>
        <div className="card-stack">
          <ListCards
            cards={cardsByList.get(list.id) ?? []}
            render={(item) => (
              <CardTile
                key={item.id}
                card={item}
                labels={labelMap}
                members={board?.members}
                parentName={item.parentCardId ? cardById.get(item.parentCardId)?.name : undefined}
                actions={tileActions}
              />
            )}
          />
        </div>
        {editingCardList === list.id ? (
          <div className="compose">
            <textarea
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  createCard(list.id);
                }
              }}
              placeholder="Card title"
            />
            <div>
              <button className="primary-button" onClick={() => createCard(list.id)}>
                Add a card
              </button>
              <button
                className="plain-icon"
                onClick={() => {
                  setEditingCardList(null);
                  setDraft("");
                }}
                aria-label="Cancel"
              >
                <Icon name="close" />
              </button>
            </div>
          </div>
        ) : (
          <button
            className="add-card"
            onClick={() => {
              setEditingCardList(list.id);
              setEditingList(false);
              setDraft("");
            }}
          >
            <Icon name="plus" /> Add a card
          </button>
        )}
        <TemplateComposer
          templates={boardTemplates}
          onCreate={(templateId, name) => addCardFromTemplate(templateId, list.id, name)}
        />
      </section>
    );
  }

  function moveListByOne(id: string, direction: -1 | 1) {
    const index = lists.findIndex((item) => item.id === id);
    const target = lists[index + direction];
    if (target) moveList(id, target.id, direction === 1);
  }

  function copyListOnBoard(id: string) {
    const copyId = newId();
    setState((current) => {
      if (!current.lists.some((list) => list.id === id && !list.archived)) return current;
      const copied = copyList(current, id, copyId);
      return recordRevisions(
        copied.state,
        [
          { kind: "list", id: copied.listId },
          ...copied.cardIds.map((cardId) => ({ kind: "card" as const, id: cardId })),
        ],
        localDeviceId.current,
      );
    });
  }

  function updateCard(id: string, change: (item: Card) => Card) {
    setState((current) =>
      recordRevision(
        {
          ...current,
          cards: current.cards.map((item) =>
            item.id === id ? applyDueRecurrence(item, applyMoveRules(current, item, change(item))) : item,
          ),
        },
        "card",
        id,
        localDeviceId.current,
      ),
    );
  }

  function runCardButton(cardId: string, ruleId: string) {
    setState((current) => {
      const before = current.cards.find((item) => item.id === cardId);
      if (!before) return current;
      const after = applyDueRecurrence(before, applyCardButton(current, before, ruleId));
      return after === before
        ? current
        : recordRevision(
            { ...current, cards: current.cards.map((item) => (item.id === cardId ? after : item)) },
            "card",
            cardId,
            localDeviceId.current,
          );
    });
  }

  function addAutomationRule(
    targetBoardId: string,
    listId: string,
    action: AutomationRule["action"],
    labelId?: string,
    trigger: "move" | "button" | "due" = "move",
    name?: string,
    leadMinutes = 0,
  ) {
    setState((current) => {
      const board = current.boards.find((item) => item.id === targetBoardId && !item.archived);
      if (
        !board ||
        (trigger === "move" &&
          !current.lists.some((item) => item.id === listId && item.boardId === targetBoardId && !item.archived)) ||
        (trigger === "button" && !name?.trim()) ||
        (trigger === "due" && ![0, 60, 1440, 10080].includes(leadMinutes))
      )
        return current;
      if (
        action === "add-label" &&
        !current.labels.some((item) => item.id === labelId && item.boardId === targetBoardId && !item.deleted)
      )
        return current;
      const rule: AutomationRule = {
        id: newId(),
        listId: trigger === "move" ? listId : "",
        trigger,
        name: trigger === "button" ? name!.trim() : undefined,
        createdAt: trigger === "due" ? new Date().toISOString() : undefined,
        leadMinutes: trigger === "due" ? leadMinutes : undefined,
        action,
        labelId: action === "add-label" ? labelId : undefined,
      };
      return recordRevision(
        {
          ...current,
          boards: current.boards.map((item) =>
            item.id === targetBoardId ? { ...item, automationRules: [...(item.automationRules ?? []), rule] } : item,
          ),
        },
        "board",
        targetBoardId,
        localDeviceId.current,
      );
    });
  }

  function removeAutomationRule(targetBoardId: string, ruleId: string) {
    setState((current) =>
      recordRevision(
        {
          ...current,
          boards: current.boards.map((item) =>
            item.id === targetBoardId
              ? { ...item, automationRules: (item.automationRules ?? []).filter((rule) => rule.id !== ruleId) }
              : item,
          ),
        },
        "board",
        targetBoardId,
        localDeviceId.current,
      ),
    );
  }

  function moveOrCopyCard(id: string, targetListId: string, copy: boolean) {
    const targetList = state.lists.find((list) => list.id === targetListId && !list.archived);
    if (!targetList) return;
    const targetId = copy ? newId() : id;
    setState((current) => {
      const transferred = transferCard(current, id, targetListId, copy, targetId).state;
      const before = current.cards.find((item) => item.id === id);
      const cards =
        !copy && before
          ? transferred.cards.map((item) =>
              item.id === id ? applyDueRecurrence(before, applyMoveRules(current, before, item)) : item,
            )
          : transferred.cards;
      return recordRevision({ ...transferred, cards }, "card", targetId, localDeviceId.current);
    });
    if (targetList.boardId === inboxBoardId) showPanel("inbox");
    else showBoard(targetList.boardId);
    setCardId(targetId);
  }

  function sortList(id: string, by: "name" | "due") {
    setState((current) => {
      const cards = sortListCards(current.cards, id, by);
      const changed = cards.filter((card, index) => card.position !== current.cards[index].position);
      return recordRevisions(
        { ...current, cards },
        changed.map((card) => ({ kind: "card" as const, id: card.id })),
        localDeviceId.current,
      );
    });
  }

  function createList() {
    if (!board || !draft.trim()) return;
    const created = {
      id: newId(),
      boardId: board.id,
      name: draft.trim(),
      position: Math.max(0, ...lists.map((item) => item.position)) + 1,
    };
    setState((current) =>
      recordRevision({ ...current, lists: [...current.lists, created] }, "list", created.id, localDeviceId.current),
    );
    setDraft("");
    setEditingList(false);
  }

  function createCard(listId: string) {
    if (!board || !draft.trim()) return;
    const created: Card = {
      id: newId(),
      boardId: board.id,
      listId,
      name: draft.trim(),
      description: "",
      createdAt: new Date().toISOString(),
      position: Math.max(0, ...state.cards.filter((item) => item.listId === listId).map((item) => item.position)) + 1,
      labelIds: [],
      completed: false,
      checklists: [],
      comments: [],
      attachments: [],
    };
    setState((current) =>
      recordRevision({ ...current, cards: [...current.cards, created] }, "card", created.id, localDeviceId.current),
    );
    setDraft("");
    setEditingCardList(null);
  }

  /** Cards accepted from AI triage; the quoted source stays in the description so every card is traceable. */
  function createProposedCards(items: ProposedCard[]) {
    setState((current) => {
      const now = new Date().toISOString();
      const created: Card[] = items.map((item, index) => ({
        id: newId(),
        boardId: current.lists.find((list) => list.id === item.listId)?.boardId ?? "",
        listId: item.listId,
        name: item.title.trim(),
        description: `${item.description.trim()}\n\n> Source: ${item.source.replace(/\s+/g, " ").trim()}`,
        createdAt: now,
        dueAt: item.due ? new Date(`${item.due}T12:00:00`).toISOString() : undefined,
        position:
          Math.max(0, ...current.cards.filter((card) => card.listId === item.listId).map((card) => card.position)) +
          1 +
          index,
        labelIds: [],
        completed: false,
        checklists: [],
        comments: [],
        attachments: [],
      }));
      return recordRevisions(
        { ...current, cards: [...current.cards, ...created] },
        created.map((card) => ({ kind: "card" as const, id: card.id })),
        localDeviceId.current,
      );
    });
    setNotice(`Cards created: ${items.length}`);
  }

  function createInboxCard(name: string) {
    const title = name.trim();
    if (!title) return;
    setState((current) => {
      const created: Card = {
        id: newId(),
        boardId: inboxBoardId,
        listId: inboxListId,
        name: title,
        description: "",
        createdAt: new Date().toISOString(),
        position:
          Math.max(0, ...current.cards.filter((item) => item.listId === inboxListId).map((item) => item.position)) + 1,
        labelIds: [],
        completed: false,
        checklists: [],
        comments: [],
        attachments: [],
      };
      return recordRevision(
        { ...current, cards: [...current.cards, created] },
        "card",
        created.id,
        localDeviceId.current,
      );
    });
  }

  function addCardFromTemplate(templateId: string, listId: string, name: string) {
    const id = newId();
    try {
      setState((current) =>
        recordRevision(
          createCardFromTemplate(current, templateId, listId, name, id).state,
          "card",
          id,
          localDeviceId.current,
        ),
      );
    } catch (cause) {
      setError(String(cause));
    }
  }

  function addDependency(dependentId: string, prerequisiteId: string) {
    setState((current) => {
      const linked = linkDependency(current, dependentId, prerequisiteId);
      if (linked === current) return current;
      return recordRevision(
        recordRevision(linked, "card", dependentId, localDeviceId.current),
        "card",
        prerequisiteId,
        localDeviceId.current,
      );
    });
  }

  function removeDependency(dependentId: string, prerequisiteId: string) {
    setState((current) => {
      const unlinked = unlinkDependency(current, dependentId, prerequisiteId);
      if (unlinked === current) return current;
      let next = unlinked;
      if (current.cards.some((item) => item.id === dependentId))
        next = recordRevision(next, "card", dependentId, localDeviceId.current);
      if (current.cards.some((item) => item.id === prerequisiteId))
        next = recordRevision(next, "card", prerequisiteId, localDeviceId.current);
      return next;
    });
  }

  function convertItem(cardId: string, checklistId: string, itemId: string) {
    const createdId = newId();
    setState((current) => {
      const converted = convertChecklistItem(current, cardId, checklistId, itemId, createdId);
      if (converted === current) return current;
      return recordRevision(
        recordRevision(converted, "card", cardId, localDeviceId.current),
        "card",
        createdId,
        localDeviceId.current,
      );
    });
  }

  async function attachFiles(target: Card, files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      const id = newId();
      try {
        await saveAttachment(id, file);
        updateCard(target.id, (current) => ({
          ...current,
          attachments: [
            ...current.attachments,
            { id, name: file.name, mimeType: file.type, size: file.size, status: "local" },
          ],
          cover: current.cover ?? (file.type.startsWith("image/") ? { attachmentId: id, size: "normal" } : undefined),
        }));
      } catch (cause) {
        setError(`Could not save ${file.name}: ${String(cause)}`);
      }
    }
  }

  async function addStickerImage(target: Card, file: File | null) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"].includes(file.type)) {
      setError("Choose a PNG, JPEG, WebP, GIF or AVIF image for the sticker.");
      return;
    }
    const id = newId();
    try {
      await saveAttachment(id, file);
      updateCard(target.id, (current) => ({
        ...current,
        stickers: [...(current.stickers ?? []), { imageId: id, name: file.name }],
      }));
    } catch (cause) {
      setError(`Could not save the sticker: ${String(cause)}`);
    }
  }

  async function uploadBoardBackground(file: File | null) {
    if (!board || !file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image for the background.");
      return;
    }
    const id = newId();
    try {
      await saveAttachment(id, file);
      updateBoard((item) => ({ ...item, backgroundImageId: id }));
    } catch (cause) {
      setError(`Could not save the board background: ${String(cause)}`);
    }
  }

  async function downloadAttachment(id: string, name: string) {
    try {
      const blob = await loadAttachment(id);
      if (!blob) {
        setError(`File “${name}” is not available on this device.`);
        return;
      }
      await saveFile(blob, name);
    } catch (cause) {
      setError(`Could not open file “${name}”: ${String(cause)}`);
    }
  }

  function exportBoard(format: "trello-json" | "csv") {
    if (!board) return;
    if (format === "csv")
      downloadText(`\ufeff${exportTrelloCsv(fullState, board.id)}`, `${board.name}.csv`, "text/csv;charset=utf-8");
    else
      downloadText(
        JSON.stringify(exportTrelloJson(fullState, board.id), null, 2),
        `${board.name}.json`,
        "application/json",
      );
  }

  async function exportBackup() {
    setBackupBusy(true);
    setBackupReport("");
    try {
      await queue.current;
      let count = 0;
      let unavailable = 0;
      for await (const part of createBackupParts(stateRef.current)) {
        if (!(await saveFile(part.blob, part.name))) {
          setBackupReport(`Saving canceled after ${count} parts.`);
          return;
        }
        count++;
        unavailable = part.unavailable;
        setBackupReport(`Downloaded ${count} of ${part.total} parts.`);
      }
      setBackupReport(
        `Backup downloaded: ${count} ZIP files.${unavailable ? ` Missing attachments: ${unavailable}; fetch them from Trello first.` : ""}`,
      );
    } catch (cause) {
      setBackupReport(`Backup failed: ${String(cause)}`);
    } finally {
      setBackupBusy(false);
    }
  }

  async function importBackup() {
    setBackupBusy(true);
    setBackupReport("");
    try {
      const restored = await restoreBackup(backupFiles, stateRef.current);
      stateRef.current = restored.state;
      setState(restored.state);
      setFileVersion((current) => current + 1);
      setBackupConflicts(restored.conflicts);
      setBackupReport(
        `Files restored: ${restored.files}. Conflicts: ${restored.conflicts.length}.${restored.unavailable ? ` Attachments missing from the original backup: ${restored.unavailable}.` : ""}`,
      );
    } catch (cause) {
      setBackupReport(`Restore failed: ${String(cause)}`);
    } finally {
      setBackupBusy(false);
    }
  }

  function restore(revision: Revision) {
    setState((current) => restoreRevision(current, revision, localDeviceId.current));
    setPanel(null);
  }

  function openImport() {
    setImporting(true);
  }

  function markSynced(deviceId: string) {
    const now = new Date().toISOString();
    setTrustedDevices((current) => {
      if (!current.some((item) => item.deviceId === deviceId)) return current;
      const next = current.map((item) => (item.deviceId === deviceId ? { ...item, lastSyncAt: now } : item));
      saveTrustedDevices(next);
      return next;
    });
  }

  function syncSession(local?: { url: string; code: string }): LanSync {
    syncRef.current?.close();
    window.clearTimeout(reconnectTimer.current);
    reconnectTimer.current = undefined;
    lastLan.current = local ?? null;
    const pairCode = local?.code.trim().toLowerCase() ?? "";
    const session = new LanSync(
      {
        trust: {
          self: { deviceId: localDeviceId.current, name: localAuthor },
          isTrusted: (peer) => readTrustedDevices().some((item) => item.deviceId === peer.deviceId),
          onPeer: async (peer) => {
            const accepted = confirm(
              `New device “${peer.name}” (${peer.deviceId.slice(0, 8)}) wants to sync. Add it to trusted devices?`,
            );
            if (accepted) rememberTrust(peer, pairCode);
            return accepted;
          },
        },
        getState: () => stateRef.current,
        onState: async (remote) => {
          const merged = mergeStates(stateRef.current, remote);
          rememberStateIds(merged.state);
          if (session.peer && pairCode) rememberTrust(session.peer, pairCode);
          stateRef.current = merged.state;
          setState(merged.state);
          setSyncConflicts(merged.conflicts);
          setSyncStatus(merged.conflicts.length ? `Conflicts found: ${merged.conflicts.length}` : "Data received");
          reconnectDelay.current = 5000;
          if (session.peer) markSynced(session.peer.deviceId);
          await session.requestFiles(merged.state);
        },
        onFile: (id) => {
          if (stateRef.current.boards.some((item) => item.backgroundImageId === id))
            setFileVersion((current) => current + 1);
          setState((current) => markMediaLocal(current, id));
        },
        onStatus: setSyncStatus,
        onSent: () => {
          if (session.peer) markSynced(session.peer.deviceId);
        },
        // Offline queue: changes keep accumulating locally; when the relay connection drops, reconnect with backoff
        // and the full-state exchange on reconnect delivers everything made in the meantime.
        onClosed: () => {
          if (!local || syncRef.current !== session) return;
          const delay = reconnectDelay.current;
          reconnectDelay.current = Math.min(delay * 2, 60_000);
          setSyncStatus(
            `Connection lost. Changes are saved on this device; reconnecting in ${Math.round(delay / 1000)} s…`,
          );
          reconnectTimer.current = window.setTimeout(() => {
            if (syncRef.current === session && navigator.onLine !== false) {
              try {
                syncSession(local);
              } catch (cause) {
                setSyncStatus(String(cause));
              }
            }
          }, delay);
        },
      },
      local,
      { internet: syncTransport === "internet" },
    );
    syncRef.current = session;
    return session;
  }

  async function createSyncOffer() {
    try {
      setSyncSignal(await syncSession().createOffer());
      setSyncStatus("Send the invitation to the second device and paste its response.");
    } catch (cause) {
      setSyncStatus(`Could not create the invitation: ${String(cause)}`);
    }
  }

  async function acceptSyncOffer() {
    try {
      setSyncResponse(await syncSession().acceptOffer(syncSignal));
      setSyncStatus("Send the response to the first device.");
    } catch (cause) {
      setSyncStatus(`Could not accept the invitation: ${String(cause)}`);
    }
  }

  async function acceptSyncAnswer() {
    try {
      await syncRef.current?.acceptAnswer(syncResponse);
      setSyncStatus("Waiting for connection…");
    } catch (cause) {
      setSyncStatus(`Could not accept the response: ${String(cause)}`);
    }
  }

  function connectLocalRoom() {
    try {
      const server = new URL(syncServerUrl);
      if (server.protocol !== "http:" && server.protocol !== "https:")
        throw new Error("Enter the HTTP address of the local Kanbonk server.");
      server.protocol = server.protocol === "https:" ? "wss:" : "ws:";
      syncSession({ url: server.href, code: syncRoomCode });
      setSyncStatus("Connecting to the local server…");
    } catch (cause) {
      setSyncStatus(`Could not connect: ${String(cause)}`);
    }
  }

  const team: Member[] = [
    { id: localDeviceId.current, name: localAuthor || "This device" },
    ...trustedDevices.map((device) => ({ id: device.deviceId, name: device.name })),
  ];
  const cardDialog = card ? (
    <CardDialog
      key={card.id}
      card={card}
      asPage={cardAsPage}
      onDelete={() => requestDelete("card", card.id)}
      authorName={localAuthor}
      currentDeviceId={localDeviceId.current}
      state={state}
      lists={state.lists.filter((item) => item.boardId === card.boardId && !item.archived)}
      onClose={() => setCardId(null)}
      onChange={(change) => updateCard(card.id, change)}
      onAttach={(files) => attachFiles(card, files)}
      onAddStickerImage={(file) => {
        void addStickerImage(card, file);
      }}
      onDownload={downloadAttachment}
      onNavigateCard={(target) => {
        if (target.boardId === inboxBoardId) showPanel("inbox");
        else showBoard(target.boardId);
        setCardId(target.id);
      }}
      onTransfer={(targetListId, copy) => moveOrCopyCard(card.id, targetListId, copy)}
      onArchive={() => {
        if (confirm(`Archive card “${card.name}”?`)) {
          updateCard(card.id, (item) => ({ ...item, archived: true }));
          setCardId(null);
        }
      }}
      onHistory={() => setPanel("history")}
      onRunAutomation={(ruleId) => runCardButton(card.id, ruleId)}
      onAddDependency={(targetId) => addDependency(card.id, targetId)}
      onRemoveDependency={removeDependency}
      onConvertChecklistItem={(checklistId, itemId) => convertItem(card.id, checklistId, itemId)}
      team={team}
      onOpenDoc={() => navigate(boardHref(card.boardId, { view: "doc" }))}
      onClone={() => setCloneRequest(card.id)}
      onCreateSubCard={(name) =>
        setState((current) => {
          const id = newId();
          return recordRevision(createSubCard(current, card.id, name, id), "card", id, localDeviceId.current);
        })
      }
      onAddMember={(member) => {
        setState((current) => {
          let next = {
            ...current,
            boards: current.boards.map((item) =>
              item.id === card.boardId
                ? { ...item, members: [...(item.members ?? []).filter((entry) => entry.id !== member.id), member] }
                : item,
            ),
            cards: current.cards.map((item) =>
              item.id === card.id ? { ...item, memberIds: [...(item.memberIds ?? []), member.id] } : item,
            ),
          };
          next = recordRevision(next, "board", card.boardId, localDeviceId.current);
          return recordRevision(next, "card", card.id, localDeviceId.current);
        });
      }}
      onAddLabel={(name, color) => {
        const label = { id: newId(), boardId: card.boardId, name, color };
        setState((current) => {
          const next = recordRevision(
            {
              ...current,
              labels: [...current.labels, label],
              cards: current.cards.map((item) =>
                item.id === card.id ? { ...item, labelIds: [...item.labelIds, label.id] } : item,
              ),
            },
            "label",
            label.id,
            localDeviceId.current,
          );
          return recordRevision(next, "card", card.id, localDeviceId.current);
        });
      }}
      onDeleteLabel={(id) => {
        setState((current) => deleteLabel(current, id, localDeviceId.current));
        setBoardFilters((current) =>
          current[card.boardId]?.labelId === id
            ? { ...current, [card.boardId]: { ...current[card.boardId], labelId: "" } }
            : current,
        );
      }}
      onEditLabel={(id, name, color) =>
        setState((current) => {
          const label = current.labels.find((item) => item.id === id && item.boardId === card.boardId && !item.deleted);
          if (!label || (label.name === name && label.color === color)) return current;
          return recordRevision(
            { ...current, labels: current.labels.map((item) => (item.id === id ? { ...item, name, color } : item)) },
            "label",
            id,
            localDeviceId.current,
          );
        })
      }
    />
  ) : null;
  const matchingWorkspaces = search.trim()
    ? state.workspaces
        .filter(
          (item) =>
            item.id !== inboxWorkspaceId && item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
        )
        .slice(0, 10)
    : [];
  const lastSyncAt = trustedDevices.reduce(
    (latest, item) => (item.lastSyncAt && item.lastSyncAt > latest ? item.lastSyncAt : latest),
    "",
  );
  // Offline queue size: local revisions newer than the last exchange with any trusted device.
  const pendingChanges = useMemo(
    () =>
      trustedDevices.length
        ? fullState.revisions.filter((item) => item.deviceId === localDeviceId.current && item.createdAt > lastSyncAt)
            .length
        : 0,
    [fullState.revisions, trustedDevices.length, lastSyncAt],
  );
  const syncBadge = !trustedDevices.length
    ? "Local"
    : !online
      ? `Offline${pendingChanges ? ` · ${pendingChanges} queued` : ""}`
      : pendingChanges
        ? `Unsent: ${pendingChanges}`
        : "Synced";
  const trashCount = useMemo(
    () =>
      [fullState.workspaces, fullState.boards, fullState.lists, fullState.cards].reduce(
        (sum, items) => sum + items.filter((item) => item.deletedAt).length,
        0,
      ),
    [fullState],
  );

  if (!ready) return <main className="startup">{error || "Loading local data…"}</main>;
  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href={linkHref("/")}
          onClick={(event) => {
            event.preventDefault();
            navigate("/");
          }}
        >
          <img className="brand-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <strong>Kanbonk</strong>
        </a>
        <select
          className="mobile-board-picker"
          aria-label="Choose board"
          value={
            shownPanels.includes("inbox")
              ? inboxBoardId
              : shownPanels.includes("planner")
                ? plannerViewId
                : (boardId ?? "")
          }
          onChange={(event) => {
            const value = event.target.value;
            if (value === inboxBoardId) showPanel("inbox");
            else if (value === plannerViewId) showPanel("planner");
            else {
              setActivePanel(null);
              setBoardId(value || null);
            }
            setCardId(null);
          }}
        >
          <option value="">Boards</option>
          <option value={inboxBoardId}>Inbox</option>
          <option value={plannerViewId}>Planner</option>
          {state.boards
            .filter((item) => item.id !== inboxBoardId && !item.archived)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {state.workspaces.find((workspace) => workspace.id === item.workspaceId)?.name} / {item.name}
              </option>
            ))}
        </select>
        <button className="topbar-create" onClick={() => openCreation("board")}>
          Create
        </button>
        <button
          onClick={() => {
            setNow(Date.now());
            setRemindersOpen(true);
          }}
          aria-label={`Reminders: ${reminders.length}`}
        >
          Reminders{reminders.length ? ` (${reminders.length})` : ""}
        </button>
        <details
          className="topbar-more"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary aria-label="App menu" title="App menu">
            ⋯
          </summary>
          <div
            className="topbar-more-menu"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("button"))
                (event.currentTarget.parentElement as HTMLDetailsElement).open = false;
            }}
          >
            <button onClick={openImport}>Import from Trello</button>
            <button
              onClick={() => {
                setBackupReport("");
                setBackupOpen(true);
                void refreshBackupInfo();
              }}
            >
              Backup
            </button>
            <button onClick={() => setSettingsOpen(true)}>Settings</button>
            <button onClick={() => setSyncOpen(true)}>Sync</button>
            <button onClick={() => setAiOpen(true)}>AI assistant</button>
            <button onClick={() => setDedupeOpen(true)}>Duplicates across boards</button>
            <button onClick={() => navigate(trashHref())}>Trash</button>
            <button
              onClick={() => {
                setAuthorDraft(localAuthor);
                setAuthorDialogOpen(true);
              }}
            >
              My name
            </button>
            {closedBoards.length > 0 && (
              <button onClick={() => setClosedBoardsOpen(true)}>Closed boards ({closedBoards.length})</button>
            )}
          </div>
        </details>
        <label className="global-search">
          <Icon name="search" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            aria-label="Search cards"
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearch("");
            }}
          />
        </label>
        <a
          className={`topbar-trash ${page.page === "trash" ? "active" : ""}`}
          href={linkHref(trashHref())}
          onClick={(event) => {
            event.preventDefault();
            navigate(trashHref());
          }}
          aria-label={`Trash: ${trashCount}`}
        >
          🗑 Trash{trashCount ? ` (${trashCount})` : ""}
        </a>
        <button
          className={`local-badge ${pendingChanges ? "pending" : ""} ${online ? "" : "offline"}`}
          onClick={() => setSyncOpen(true)}
          title="Sync with trusted devices"
        >
          {syncBadge}
        </button>
      </header>
      {search.trim() && (
        <section className="search-results" aria-label="Search results">
          <strong>Search results</strong>
          {matchingWorkspaces.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                navigate(`/w/${item.id}`);
                setSearch("");
              }}
            >
              <small>Workspace</small>
              {item.name}
            </button>
          ))}
          {matchingBoards.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                showBoard(item.id);
                setCardId(null);
                setSearch("");
              }}
            >
              <small>Board</small>
              {item.name}
            </button>
          ))}
          {matchingCards.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.boardId === inboxBoardId) showPanel("inbox");
                else showBoard(item.boardId);
                setCardId(item.id);
                setSearch("");
              }}
            >
              <small>{state.boards.find((board) => board.id === item.boardId)?.name}</small>
              {item.name}
            </button>
          ))}
          {!matchingWorkspaces.length && !matchingBoards.length && !matchingCards.length && <p>Nothing found</p>}
        </section>
      )}
      {notice && (
        <div className="notice-banner" role="status">
          {notice}
          {noticeCardId && (
            <button
              className="link-button"
              onClick={() => {
                setNotice("");
                setCardId(noticeCardId);
              }}
            >
              Open
            </button>
          )}
          <button onClick={() => setNotice("")} aria-label="Dismiss message">
            <Icon name="close" />
          </button>
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss message">
            <Icon name="close" />
          </button>
        </div>
      )}
      <div className={shownPanels.length ? "workspace-layout panel-open" : "workspace-layout"}>
        <aside className="sidebar">
          <button
            className={shownPanels.includes("inbox") ? "sidebar-link active" : "sidebar-link"}
            onClick={() => togglePanel("inbox")}
          >
            ☰ <span>Inbox</span>
          </button>
          <button
            className={shownPanels.includes("planner") ? "sidebar-link active" : "sidebar-link"}
            onClick={() => togglePanel("planner")}
          >
            ▦ <span>Planner</span>
          </button>
          <button
            className={page.page === "home" ? "sidebar-link active" : "sidebar-link"}
            onClick={() => navigate("/")}
          >
            ▦ <span>Workspaces</span>
          </button>
          <button
            className={page.page === "trash" ? "sidebar-link active" : "sidebar-link"}
            onClick={() => navigate(trashHref())}
          >
            🗑 <span>Trash</span>
          </button>
          <div className="sidebar-heading">
            Workspaces
            <button onClick={() => openCreation("workspace")} aria-label="Create workspace">
              <Icon name="plus" />
            </button>
          </div>
          {state.workspaces
            .filter((item) => item.id !== inboxWorkspaceId && !item.archived)
            .map((workspace) => (
              <div className="workspace-group" key={workspace.id}>
                <div className="workspace-name">
                  <span className="workspace-avatar">{workspace.name.slice(0, 1).toUpperCase()}</span>
                  <button
                    className={`workspace-link ${page.page === "workspace" && page.id === workspace.id ? "selected" : ""}`}
                    onClick={() => navigate(`/w/${workspace.id}`)}
                  >
                    {workspace.name}
                  </button>
                  <button
                    onClick={() => openCreation("board", workspace.id)}
                    aria-label={`Add board to ${workspace.name}`}
                  >
                    <Icon name="plus" />
                  </button>
                </div>
                {state.boards
                  .filter((item) => item.workspaceId === workspace.id && item.id !== inboxBoardId && !item.archived)
                  .map((item) => (
                    <button
                      key={item.id}
                      className={`board-link ${item.id === boardId ? "selected" : ""}`}
                      onClick={() => {
                        showBoard(item.id);
                        setCardId(null);
                      }}
                    >
                      <span className="board-mini" style={{ background: item.background }} />
                      {item.name}
                      {item.starred && <Icon name="star" />}
                    </button>
                  ))}
              </div>
            ))}
        </aside>
        {shownPanels.map((name) => (
          <div className="panel-slot" key={name}>
            <aside
              className={name === "planner" ? "aux-panel planner-panel" : "aux-panel inbox-panel"}
              style={{ width: Math.min(panelWidths[name], panelWidthLimit) }}
            >
              {name === "inbox" ? (
                <InboxView
                  state={state}
                  onCreate={createInboxCard}
                  onOpen={setCardId}
                  onOpenArchive={() => openArchive(inboxBoardId)}
                />
              ) : (
                <PlannerView
                  state={state}
                  onOpen={(item) => {
                    if (item.boardId === inboxBoardId) showPanel("inbox");
                    else showBoard(item.boardId);
                    setCardId(item.id);
                  }}
                />
              )}
            </aside>
            <div
              className="panel-resizer"
              role="separator"
              tabIndex={0}
              aria-label={`Resize panel ${name === "inbox" ? "Inbox" : "Planner"}`}
              aria-orientation="vertical"
              aria-valuemin={220}
              aria-valuemax={panelWidthLimit}
              aria-valuenow={Math.min(panelWidths[name], panelWidthLimit)}
              onPointerDown={(event) => resizePanelStart(event, name)}
              onKeyDown={(event) => resizePanelKey(event, name)}
            />
          </div>
        ))}
        <main
          className="main-area"
          style={{
            backgroundColor: board?.background ?? "#f7f8f9",
            backgroundImage:
              backgroundImage && board?.backgroundImageId === backgroundImage.id
                ? `url("${backgroundImage.url}")`
                : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {board ? (
            <>
              <div className="board-toolbar">
                <NameEditor
                  key={board.id}
                  className="board-title"
                  label="Board title"
                  value={board.name}
                  onCommit={(name) => updateBoard((item) => ({ ...item, name }))}
                />
                <button
                  className={`toolbar-button ${board.starred ? "is-starred" : ""}`}
                  onClick={() => updateBoard((item) => ({ ...item, starred: !item.starred }))}
                  aria-label={board.starred ? "Remove from favorites" : "Add to favorites"}
                >
                  <Icon name="star" />
                </button>
                <button className="toolbar-button" onClick={openBoardAbout} aria-label="Board description">
                  <Icon name="info" /> Description
                </button>
                <div className="segmented view-switch" role="tablist" aria-label="Board view">
                  <button
                    role="tab"
                    aria-selected={page.page === "board" && page.view === "lists"}
                    onClick={() => navigate(boardHref(board.id))}
                  >
                    Lists
                  </button>
                  <button
                    role="tab"
                    aria-selected={page.page === "board" && page.view === "calendar"}
                    onClick={() =>
                      navigate(
                        boardHref(board.id, { view: "calendar", scale: page.page === "board" ? page.scale : "month" }),
                      )
                    }
                  >
                    Calendar
                  </button>
                  <button
                    role="tab"
                    aria-selected={page.page === "board" && page.view === "doc"}
                    onClick={() => navigate(boardHref(board.id, { view: "doc" }))}
                  >
                    Doc
                  </button>
                </div>
                <span className="toolbar-spacer" />
                <input
                  type="search"
                  className="board-search"
                  value={boardFilter.keyword}
                  onChange={(event) => updateFilter({ keyword: event.target.value })}
                  placeholder="Search this board"
                  aria-label="Search cards on this board"
                />
                <button
                  className="toolbar-button"
                  aria-expanded={filterOpen}
                  aria-label={filterCount ? `Board filter, active: ${filterCount}` : "Board filter"}
                  onClick={() => setFilterOpen((current) => !current)}
                >
                  <Icon name="search" /> Filter{filterCount ? ` (${filterCount})` : ""}
                </button>
                <details
                  ref={boardMenu}
                  className="board-more"
                  onBlur={(event) => {
                    if (
                      (event.target as Element).getAttribute("type") !== "color" &&
                      !event.currentTarget.contains(event.relatedTarget)
                    )
                      event.currentTarget.open = false;
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.currentTarget.open = false;
                      event.currentTarget.querySelector("summary")?.focus();
                    }
                  }}
                >
                  <summary className="toolbar-button" aria-label="Board menu" title="Board menu">
                    ⋯
                  </summary>
                  <div
                    className="board-more-menu"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("button"))
                        (event.currentTarget.parentElement as HTMLDetailsElement).open = false;
                    }}
                  >
                    <button onClick={() => openArchive(board.id)}>Archive</button>
                    <button onClick={closeBoard}>Close board</button>
                    <button
                      onClick={() =>
                        setBoardCopy({
                          name: `${board.name} (copy)`,
                          workspaceId: board.workspaceId,
                          keepCards: true,
                          keepTemplates: true,
                        })
                      }
                    >
                      Copy board
                    </button>
                    <button onClick={() => setAutomationBoardId(board.id)}>Automation</button>
                    <button onClick={() => setActivityBoardId(board.id)}>Activity</button>
                    <button onClick={() => setPanel("history")}>History</button>
                    <button
                      onClick={() => exportBoard("trello-json")}
                      title="Trello JSON export format, without attachment files"
                    >
                      Export JSON (Trello)
                    </button>
                    <button onClick={() => exportBoard("csv")} title="Trello CSV export columns">
                      Export CSV (Trello)
                    </button>
                    <button onClick={() => requestDelete("board", board.id)}>Move board to trash</button>
                    <label className="background-upload">
                      Background from file
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          void uploadBoardBackground(event.target.files?.[0] ?? null);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <label className="board-color-option">
                      Background color
                      <ColorInput
                        value={/^#[\da-f]{6}$/i.test(board.background) ? board.background : "#0c66e4"}
                        presets={boardColors}
                        label="Board background color"
                        onCommit={(background) => {
                          updateBoard((item) => ({ ...item, background, backgroundImageId: undefined }));
                          if (boardMenu.current) boardMenu.current.open = false;
                        }}
                      />
                    </label>
                  </div>
                </details>
              </div>
              {filterOpen && (
                <section className="board-filter" aria-label="Board filter">
                  <div className="section-title">
                    <strong>Board filter</strong>
                    <button onClick={() => setFilterOpen(false)} aria-label="Close filter">
                      <Icon name="close" />
                    </button>
                  </div>
                  <label>
                    Text
                    <input
                      type="search"
                      value={boardFilter.keyword}
                      onChange={(event) => updateFilter({ keyword: event.target.value })}
                      placeholder="Title or content"
                    />
                  </label>
                  <label>
                    Label
                    <select
                      value={boardFilter.labelId}
                      onChange={(event) => updateFilter({ labelId: event.target.value })}
                    >
                      <option value="">All labels</option>
                      {state.labels
                        .filter((item) => item.boardId === board.id && !item.deleted)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name || item.color}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Member
                    <select
                      value={boardFilter.memberId ?? ""}
                      onChange={(event) => updateFilter({ memberId: event.target.value })}
                    >
                      <option value="">All members</option>
                      {(board.members ?? []).map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={boardFilter.status}
                      onChange={(event) => updateFilter({ status: event.target.value as BoardFilter["status"] })}
                    >
                      <option value="all">All cards</option>
                      <option value="complete">Completed</option>
                      <option value="incomplete">Not completed</option>
                    </select>
                  </label>
                  <label>
                    Due date
                    <select
                      value={boardFilter.due}
                      onChange={(event) => updateFilter({ due: event.target.value as BoardFilter["due"] })}
                    >
                      <option value="any">Any due date</option>
                      <option value="overdue">Overdue</option>
                      <option value="next-week">Next 7 days</option>
                      <option value="none">No due date</option>
                    </select>
                  </label>
                  <div className="filter-footer">
                    <span>
                      Showing {filteredCardIds.size} of {boardCardCount}
                    </span>
                    <button onClick={() => updateFilter(emptyBoardFilter())}>Reset</button>
                  </div>
                </section>
              )}
              {page.page === "board" && page.view === "doc" ? (
                <DocView
                  state={state}
                  board={board}
                  onChange={(doc) => updateBoard((item) => ({ ...item, doc }))}
                  onOpenCard={(item) => setCardId(item.id)}
                  assistant={
                    <AiPanel
                      state={state}
                      board={board}
                      settings={aiSettings}
                      onOpenSettings={() => setAiOpen(true)}
                      onCreateCards={createProposedCards}
                      onDocChange={(doc) => updateBoard((item) => ({ ...item, doc }))}
                      onOpenCard={(item) => setCardId(item.id)}
                    />
                  }
                />
              ) : page.page === "board" && page.view === "calendar" ? (
                <BoardCalendar
                  state={state}
                  cards={state.cards.filter((item) => filteredCardIds.has(item.id))}
                  scale={page.scale}
                  date={page.date}
                  onNavigate={(scale: CalendarScale, date?: string) =>
                    navigate(boardHref(board.id, { view: "calendar", scale, date }), { replace: true })
                  }
                  onOpen={(item) => setCardId(item.id)}
                  onReschedule={(item, dates) =>
                    updateCard(item.id, (current) => ({
                      ...current,
                      startAt: dates.startAt,
                      dueAt: dates.dueAt,
                      dueReminderMinutes: dates.dueAt ? current.dueReminderMinutes : undefined,
                      dueRepeat: dates.dueAt ? current.dueRepeat : undefined,
                    }))
                  }
                  onDelete={(item) => requestDelete("card", item.id)}
                />
              ) : (
                <div className="board-canvas">
                  {zoneRuns(lists, board.zones).map((run) =>
                    run.zone ? (
                      <ZoneFrame
                        key={`zone-${run.zone.id}-${run.lists[0].id}`}
                        zone={run.zone}
                        cardCount={
                          state.cards.filter(
                            (item) =>
                              run.lists.some((entry) => entry.id === item.listId) && filteredCardIds.has(item.id),
                          ).length
                        }
                        onRename={(name) => changeZone(run.zone!.id, { name })}
                        onColor={(color) => changeZone(run.zone!.id, { color })}
                        onDelete={() => removeZone(run.zone!)}
                        onDropList={(listId) => setListZone(listId, run.zone!.id)}
                      >
                        {run.lists.map(renderList)}
                      </ZoneFrame>
                    ) : (
                      run.lists.map(renderList)
                    ),
                  )}
                  <div className="add-list-column">
                    {editingList ? (
                      <div className="compose">
                        <input
                          autoFocus
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") createList();
                          }}
                          placeholder="List title"
                        />
                        <div>
                          <button className="primary-button" onClick={createList}>
                            Add a list
                          </button>
                          <button
                            className="plain-icon"
                            onClick={() => {
                              setEditingList(false);
                              setDraft("");
                            }}
                            aria-label="Cancel"
                          >
                            <Icon name="close" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingList(true);
                          setEditingCardList(null);
                          setDraft("");
                        }}
                      >
                        <Icon name="plus" /> Add a list
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : page.page === "board" ? (
            <MissingPage what="Board not found" />
          ) : page.page === "workspace" ? (
            <WorkspacePage
              state={state}
              workspaceId={page.id}
              onOpenBoard={(id) => setBoardId(id)}
              onCreateBoard={() => openCreation("board", page.id)}
              onRename={(name) =>
                setState((current) =>
                  recordRevision(
                    {
                      ...current,
                      workspaces: current.workspaces.map((item) => (item.id === page.id ? { ...item, name } : item)),
                    },
                    "workspace",
                    page.id,
                    localDeviceId.current,
                  ),
                )
              }
              onDelete={() => requestDelete("workspace", page.id)}
            />
          ) : page.page === "trash" ? (
            <TrashPage
              state={fullState}
              kind={page.kind}
              onKind={(kind) => navigate(trashHref(kind), { replace: true })}
              onRestore={restoreTrashed}
              onPurge={purgeTrashed}
              onEmpty={emptyAllTrash}
            />
          ) : page.page === "card" ? (
            (cardDialog ?? <MissingPage what="Card not found" />)
          ) : page.page === "not-found" ? (
            <MissingPage what="Page not found" />
          ) : (
            <HomePage state={state} onOpen={(id) => navigate(`/w/${id}`)} onCreate={() => openCreation("workspace")} />
          )}
        </main>
      </div>
      {card && !cardAsPage && cardDialog}
      {cloneSource && (
        <div className="dialog-backdrop" onMouseDown={() => setCloneRequest(undefined)}>
          <section
            className="creation-dialog delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="Clone card"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2>Clone card “{cloneSource.name}”?</h2>
            <p>The copy “{cloneCardName(state, cloneSource.id)}” will be added right below it in the same list.</p>
            <div>
              <button type="button" onClick={() => setCloneRequest(undefined)}>
                Cancel
              </button>
              <button type="button" className="primary-button" autoFocus onClick={confirmClone}>
                Clone
              </button>
            </div>
          </section>
        </div>
      )}
      {pendingDelete && (
        <DeleteDialog
          kind={pendingDelete.kind}
          name={pendingDelete.name}
          impact={pendingDelete.impact}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      {dedupeOpen && (
        <DedupeDialog
          state={state}
          ignored={dedupeIgnored}
          onClose={() => setDedupeOpen(false)}
          onOpen={(item) => {
            setDedupeOpen(false);
            setCardId(item.id);
          }}
          onIgnore={(pair) =>
            setDedupeIgnored((current) => {
              const next = new Set(current);
              next.add(pairKey(pair.a.id, pair.b.id));
              localStorage.setItem("kanbonk-dedupe-ignored", JSON.stringify([...next]));
              return next;
            })
          }
          onMerge={(keepId, dropId) => {
            setState((current) => mergeDuplicate(current, keepId, dropId, localDeviceId.current));
            setNotice("Cards merged; the duplicate was moved to trash.");
          }}
        />
      )}
      {boardAboutOpen && board && (
        <div className="dialog-backdrop" onMouseDown={() => setBoardAboutOpen(false)}>
          <section
            className="side-panel board-about"
            role="dialog"
            aria-modal="true"
            aria-label="Board description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <h2>About this board</h2>
              <button onClick={() => setBoardAboutOpen(false)} aria-label="Close board description">
                <Icon name="close" />
              </button>
            </header>
            <p>{board.name}</p>
            <label>
              Description
              <textarea
                value={boardDescriptionDraft}
                onChange={(event) => setBoardDescriptionDraft(event.target.value)}
                placeholder="Add a board description…"
              />
            </label>
            <div className="panel-actions">
              <button onClick={() => setBoardAboutOpen(false)}>Cancel</button>
              <button
                className="primary-button"
                onClick={saveBoardDescription}
                disabled={boardDescriptionDraft === board.description}
              >
                Save
              </button>
            </div>
          </section>
        </div>
      )}{" "}
      {closedBoardsOpen && (
        <div className="dialog-backdrop" onMouseDown={() => setClosedBoardsOpen(false)}>
          <section
            className="side-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Closed boards"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <h2>Closed boards</h2>
              <button onClick={() => setClosedBoardsOpen(false)} aria-label="Close">
                <Icon name="close" />
              </button>
            </header>
            {closedBoards.length ? (
              closedBoards.map((item) => (
                <div className="panel-row" key={item.id}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{state.workspaces.find((workspace) => workspace.id === item.workspaceId)?.name}</small>
                  </span>
                  <button onClick={() => restoreClosedBoard(item.id)}>Restore</button>
                </div>
              ))
            ) : (
              <p>No closed boards.</p>
            )}
          </section>
        </div>
      )}
      {activityBoardId && (
        <BoardActivity
          state={state}
          boardId={activityBoardId}
          onClose={() => setActivityBoardId(null)}
          onOpenCard={(item) => {
            setBoardId(item.boardId);
            setCardId(item.id);
          }}
        />
      )}
      {remindersOpen && (
        <div className="dialog-backdrop" onMouseDown={() => setRemindersOpen(false)}>
          <section
            className="side-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Reminders"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <h2>Reminders</h2>
              <button onClick={() => setRemindersOpen(false)} aria-label="Close reminders">
                <Icon name="close" />
              </button>
            </header>
            {reminders.length ? (
              reminders.map((item) => (
                <div className="panel-row reminder-row" key={item.id}>
                  <button
                    onClick={() => {
                      if (item.boardId === inboxBoardId) showPanel("inbox");
                      else showBoard(item.boardId);
                      setCardId(item.id);
                      setRemindersOpen(false);
                    }}
                  >
                    {item.name}
                    <small>{new Date(item.dueAt!).toLocaleString("en-US")}</small>
                  </button>
                  <button
                    onClick={() =>
                      setDismissedReminders((current) => ({ ...current, [item.id]: reminderSignature(item) }))
                    }
                    aria-label={`Dismiss reminder ${item.name}`}
                  >
                    Dismiss
                  </button>
                </div>
              ))
            ) : (
              <p>No new reminders.</p>
            )}
          </section>
        </div>
      )}
      {automationBoardId && state.boards.some((item) => item.id === automationBoardId && !item.archived) && (
        <AutomationPanel
          key={automationBoardId}
          board={state.boards.find((item) => item.id === automationBoardId)!}
          state={state}
          onClose={() => setAutomationBoardId(null)}
          onAdd={(listId, action, labelId, trigger, name, leadMinutes) =>
            addAutomationRule(automationBoardId, listId, action, labelId, trigger, name, leadMinutes)
          }
          onRemove={(ruleId) => removeAutomationRule(automationBoardId, ruleId)}
        />
      )}
      {panel && (
        <div className="dialog-backdrop" onMouseDown={() => setPanel(null)}>
          <section
            className="side-panel"
            role="dialog"
            aria-modal="true"
            aria-label={panel === "archive" ? "Archive" : "Version history"}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <h2>{panel === "archive" ? "Archive" : "Version history"}</h2>
              <button onClick={() => setPanel(null)} aria-label="Close">
                <Icon name="close" />
              </button>
            </header>
            {panel === "archive" ? (
              <>
                {state.cards
                  .filter((item) => item.boardId === (archiveBoardId ?? boardId) && item.archived)
                  .map((item) => (
                    <div className="panel-row" key={item.id}>
                      {item.name}
                      <button onClick={() => updateCard(item.id, (current) => ({ ...current, archived: false }))}>
                        Restore
                      </button>
                    </div>
                  ))}
                {state.lists
                  .filter((item) => item.boardId === (archiveBoardId ?? boardId) && item.archived)
                  .map((item) => (
                    <div className="panel-row" key={item.id}>
                      {item.name}
                      <button onClick={() => updateList(item.id, (current) => ({ ...current, archived: false }))}>
                        Restore
                      </button>
                    </div>
                  ))}
              </>
            ) : (
              <>
                <p>The last 30 versions of each item are kept.</p>
                {state.revisions
                  .filter((item) => item.entityId === (card?.id ?? boardId))
                  .slice()
                  .reverse()
                  .map((revision) => (
                    <div className="panel-row" key={revision.id}>
                      <span>
                        <strong>{revision.snapshot.name}</strong>
                        <small>{new Date(revision.createdAt).toLocaleString()}</small>
                      </span>
                      <button onClick={() => restore(revision)}>Restore</button>
                    </div>
                  ))}
              </>
            )}
          </section>
        </div>
      )}
      {settingsOpen && <SettingsDialog getState={() => stateRef.current} onClose={() => setSettingsOpen(false)} />}
      {aiOpen && (
        <AiSettingsDialog
          settings={aiSettings}
          onClose={() => setAiOpen(false)}
          onSave={(next) => {
            saveAiSettings(next);
            setAiSettings(next);
            setAiOpen(false);
          }}
        />
      )}
      {syncOpen && (
        <div className="dialog-backdrop" onMouseDown={() => setSyncOpen(false)}>
          <section
            className="creation-dialog sync-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Device sync"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2>Device sync</h2>
            <label>
              Sync method
              <select
                value={syncTransport}
                onChange={(event) => {
                  const value = event.target.value as SyncTransport;
                  setSyncTransport(value);
                  localStorage.setItem("kanbonk-sync-transport", value);
                }}
              >
                <option value="wifi">Wi-Fi / local network</option>
                <option value="internet">Internet: direct P2P connection (WebRTC)</option>
                <option value="file">File: Bluetooth / USB / messenger</option>
              </select>
            </label>
            <p className="hint">
              Tabs and windows in this browser sync automatically. For the desktop app and a browser on the same
              computer, run <code>pnpm serve:lan</code> and connect to{" "}
              <button className="link-button" onClick={() => setSyncServerUrl("http://127.0.0.1:4173")}>
                http://127.0.0.1:4173
              </button>
              .
            </p>
            {trustedDevices.length > 0 && (
              <section className="trusted-devices">
                <h3>Trusted devices</h3>
                {trustedDevices.map((device) => (
                  <div className="panel-row" key={device.deviceId}>
                    <span>
                      <strong>{device.name}</strong>
                      <small>
                        {device.deviceId.slice(0, 8)} · added {new Date(device.pairedAt).toLocaleDateString("en-US")}
                        {device.lastSyncAt ? ` · synced ${new Date(device.lastSyncAt).toLocaleString("en-US")}` : ""}
                      </small>
                    </span>
                    <span className="row-actions">
                      {syncTransport === "wifi" && (
                        <button onClick={() => setSyncRoomCode(device.code)}>Pairing code</button>
                      )}
                      {syncTransport === "file" && (
                        <button onClick={() => void shareSyncBundle(device.code)}>Send package</button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Remove “${device.name}” from trusted devices?`))
                            setTrustedDevices((current) => {
                              const next = current.filter((item) => item.deviceId !== device.deviceId);
                              saveTrustedDevices(next);
                              return next;
                            });
                        }}
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                ))}
              </section>
            )}
            {syncTransport === "file" && (
              <section className="local-sync">
                <h3>Sync package</h3>
                <p>
                  An encrypted file with your data and attachments. Send it via Bluetooth (the Share menu on your
                  phone), USB or a messenger; only a device that knows the pairing code can open it.
                </p>
                <label>
                  Pairing code (for a new device)
                  <input
                    value={bundleCode}
                    onChange={(event) => setBundleCode(event.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </label>
                <div>
                  <button onClick={() => setBundleCode(newRoomCode())}>Create code</button>
                  <button
                    className="primary-button"
                    disabled={!/^[a-f0-9]{32}$/.test(bundleCode.trim().toLowerCase())}
                    onClick={() => void shareSyncBundle(bundleCode.trim().toLowerCase())}
                  >
                    Send package with code
                  </button>
                </div>
                <label>
                  Open received package
                  <input
                    type="file"
                    accept=".kanbonk-sync,application/octet-stream"
                    onChange={(event) => {
                      void openBundle(event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                  />
                </label>
              </section>
            )}
            {syncTransport === "wifi" && (
              <LocalRoomControls
                serverUrl={syncServerUrl}
                roomCode={syncRoomCode}
                onServerChange={setSyncServerUrl}
                onCodeChange={setSyncRoomCode}
                onConnect={connectLocalRoom}
              />
            )}
            {syncTransport !== "file" && (
              <>
                <p>
                  {syncTransport === "internet"
                    ? "Direct connection over the internet: devices exchange an invitation and a response through any channel (messenger, email). Data flows directly and is encrypted (DTLS); the public STUN server only sees network addresses, not data. Only someone you sent the invitation to can connect, and only after you confirm trust."
                    : "If both browsers support WebRTC, you can connect directly over the local network. Exchange an invitation and a response."}
                </p>
                <button className="primary-button" onClick={createSyncOffer}>
                  Create invitation
                </button>
                <label>
                  Invitation: send it to the second device or paste the one you received
                  <textarea value={syncSignal} onChange={(event) => setSyncSignal(event.target.value)} />
                </label>
                <button onClick={acceptSyncOffer} disabled={!syncSignal}>
                  Accept invitation
                </button>
                <label>
                  Response: send it to the first device or paste the one you received
                  <textarea value={syncResponse} onChange={(event) => setSyncResponse(event.target.value)} />
                </label>
                <button onClick={acceptSyncAnswer} disabled={!syncResponse}>
                  Connect with response
                </button>
              </>
            )}
            <button
              onClick={() => {
                try {
                  syncRef.current?.syncNow();
                } catch (cause) {
                  setSyncStatus(String(cause));
                }
              }}
            >
              Sync now
            </button>
            {syncStatus && (
              <p className="import-report" role="status">
                {syncStatus}
              </p>
            )}
            {syncConflicts.map((conflict) => (
              <div className="sync-conflict" key={`${conflict.kind}-${conflict.id}`}>
                <strong>Conflict: {conflict.local.name}</strong>
                <small>Choose a version of this item.</small>
                <div>
                  <button
                    onClick={() => {
                      setState((current) => chooseConflict(current, conflict, "local", localDeviceId.current));
                      setSyncConflicts((current) => current.filter((item) => item !== conflict));
                      setSyncStatus("Version chosen. Syncing…");
                    }}
                  >
                    My version
                  </button>
                  <button
                    onClick={() => {
                      setState((current) => chooseConflict(current, conflict, "remote", localDeviceId.current));
                      setSyncConflicts((current) => current.filter((item) => item !== conflict));
                      setSyncStatus("Version chosen. Syncing…");
                    }}
                  >
                    Other device's version
                  </button>
                </div>
              </div>
            ))}
            <div>
              <button onClick={() => setSyncOpen(false)}>Close</button>
            </div>
          </section>
        </div>
      )}
      {backupOpen && (
        <div
          className="dialog-backdrop"
          onMouseDown={() => {
            if (!backupBusy) setBackupOpen(false);
          }}
        >
          <section
            className="creation-dialog import-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Backup"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2>Backup</h2>
            <p>
              Save all boards and available local files to ZIP. To restore, select all parts of one backup at once.
              Existing data is kept; conflicting changes will ask you to choose a version.
            </p>
            <button className="primary-button" onClick={exportBackup} disabled={backupBusy}>
              {backupBusy ? "Please wait…" : "Download backup"}
            </button>
            <label>
              Backup ZIP parts
              <input
                type="file"
                accept=".zip,application/zip"
                multiple
                onChange={(event) => setBackupFiles(Array.from(event.target.files ?? []))}
              />
            </label>
            <button onClick={importBackup} disabled={backupBusy || !backupFiles.length}>
              Restore from ZIP
            </button>
            <section className="auto-backups">
              <h3>Snapshots</h3>
              <p>
                Every 10 minutes, if anything changed, a snapshot of all data is saved inside the app (the last 20, plus
                one per day for 30 days). Full backups with files outside the app are set up in{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setBackupOpen(false);
                    setSettingsOpen(true);
                  }}
                >
                  Settings
                </button>
                .
              </p>
              <button onClick={() => void autoSnapshot(stateRef.current).then(refreshBackupInfo)}>
                Create snapshot now
              </button>
              {snapshots.length ? (
                <div className="snapshot-list">
                  {snapshots.map((meta) => (
                    <div className="panel-row" key={meta.id}>
                      <span>
                        <strong>{new Date(meta.createdAt).toLocaleString("en-US")}</strong>
                        <small>
                          boards: {meta.boards}, cards: {meta.cards}, {Math.round(meta.size / 1024)} KB
                        </small>
                      </span>
                      <button onClick={() => void restoreSnapshot(meta)}>Restore</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No snapshots yet.</p>
              )}
            </section>
            {backupReport && (
              <p className="import-report" role="status">
                {backupReport}
              </p>
            )}
            {backupConflicts.map((conflict) => (
              <div className="sync-conflict" key={`${conflict.kind}-${conflict.id}`}>
                <strong>Conflict: {conflict.local.name}</strong>
                <small>Choose a version of this item.</small>
                <div>
                  <button
                    onClick={() => {
                      setState((current) => chooseConflict(current, conflict, "local", localDeviceId.current));
                      setBackupConflicts((current) => current.filter((item) => item !== conflict));
                    }}
                  >
                    Current version
                  </button>
                  <button
                    onClick={() => {
                      setState((current) => chooseConflict(current, conflict, "remote", localDeviceId.current));
                      setBackupConflicts((current) => current.filter((item) => item !== conflict));
                    }}
                  >
                    Backup version
                  </button>
                </div>
              </div>
            ))}
            <div>
              <button onClick={() => setBackupOpen(false)} disabled={backupBusy}>
                Close
              </button>
            </div>
          </section>
        </div>
      )}
      {authorDialogOpen && (
        <div className="dialog-backdrop" onMouseDown={() => setAuthorDialogOpen(false)}>
          <form
            className="creation-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="My name"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              setLocalAuthor(saveLocalAuthor(authorDraft));
              setAuthorDialogOpen(false);
            }}
          >
            <h2>My name</h2>
            <p>Your name is stored only on this device and shown on new comments.</p>
            <label>
              Name
              <input
                autoFocus
                value={authorDraft}
                onChange={(event) => setAuthorDraft(event.target.value)}
                maxLength={60}
                required
              />
            </label>
            <div>
              <button type="button" onClick={() => setAuthorDialogOpen(false)}>
                Cancel
              </button>
              <button className="primary-button" disabled={!authorDraft.trim()}>
                Save
              </button>
            </div>
          </form>
        </div>
      )}
      {importing && (
        <ImportDialog
          state={state}
          setState={setState}
          defaultWorkspaceId={defaultWorkspaceId}
          deviceId={localDeviceId.current}
          onBoardImported={setBoardId}
          onFilesRestored={() => setFileVersion((current) => current + 1)}
          onClose={() => setImporting(false)}
        />
      )}
      {boardCopy && (
        <div className="dialog-backdrop" onMouseDown={() => setBoardCopy(null)}>
          <form
            className="creation-dialog board-copy-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Copy board"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              submitBoardCopy();
            }}
          >
            <h2>Copy board</h2>
            <label>
              Title
              <input
                autoFocus
                value={boardCopy.name}
                onChange={(event) => setBoardCopy({ ...boardCopy, name: event.target.value })}
                required
                maxLength={120}
              />
            </label>
            <label>
              Workspace
              <select
                value={boardCopy.workspaceId}
                onChange={(event) => setBoardCopy({ ...boardCopy, workspaceId: event.target.value })}
              >
                {state.workspaces
                  .filter((item) => item.id !== inboxWorkspaceId && !item.archived)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="copy-option">
              <input
                type="checkbox"
                checked={boardCopy.keepCards}
                onChange={(event) => setBoardCopy({ ...boardCopy, keepCards: event.target.checked })}
              />
              Keep cards
            </label>
            <label className="copy-option">
              <input
                type="checkbox"
                checked={boardCopy.keepTemplates}
                onChange={(event) => setBoardCopy({ ...boardCopy, keepTemplates: event.target.checked })}
              />
              Keep card templates
            </label>
            <p>Comments, members and archived cards are not copied.</p>
            <div>
              <button type="button" onClick={() => setBoardCopy(null)}>
                Cancel
              </button>
              <button className="primary-button" type="submit">
                Create copy
              </button>
            </div>
          </form>
        </div>
      )}{" "}
      {creation && (
        <div className="dialog-backdrop" onMouseDown={() => setCreation(null)}>
          <form
            className="creation-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={creation.kind === "board" ? "Create board" : "Create workspace"}
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              submitCreation();
            }}
          >
            <h2>{creation.kind === "board" ? "Create board" : "Create workspace"}</h2>
            <label>
              Title
              <input
                autoFocus
                value={creationName}
                onChange={(event) => setCreationName(event.target.value)}
                required
                maxLength={120}
              />
            </label>
            <div>
              <button type="button" onClick={() => setCreation(null)}>
                Cancel
              </button>
              <button className="primary-button" type="submit">
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
