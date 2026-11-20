import { memo, startTransition, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { deviceId, listSnapshots, loadAttachment, loadSnapshot, loadState, readLocalAuthor, saveAttachment, saveLocalAuthor, saveState, type SnapshotMeta } from "./storage";
import { boardHref, linkHref, trashHref, useRoute, type CalendarScale, type Route } from "./router";
import { dependentsOf, emptyTrash, moveToTrash, prerequisitesOf, purgeExpired, purgeFromTrash, restoreFromTrash, trashImpact, visibleState, type TrashImpact, type TrashKind } from "./trash";
import { cardCreatedAt } from "./calendar";
import { exportTrelloCsv, exportTrelloJson, parseTrelloCsv } from "./trelloFormats";
import { mergeDuplicate, pairKey } from "./dedupe";
import { MarkdownEditor } from "./MarkdownEditor";
import { ColorInput } from "./ColorInput";
import { CardPicker } from "./CardPicker";
import { DocView } from "./DocView";
import { AiPanel, AiSettingsDialog, type ProposedCard } from "./AiPanel";
import { readAiSettings, saveAiSettings, type AiSettings } from "./ai";
import { mentionedCardIds } from "./boardDoc";
import { cardLink, downloadCardJson, downloadCardPng, printCard, qrSvg } from "./share";
import { saveFile, shareFile } from "./platform";
import { assignListToZone, createZone, deleteZone, moveListToList, moveZone, updateZone, zoneRuns } from "./zones";
import { BoardCalendar, DedupeDialog, DeleteDialog, HomePage, MissingPage, TrashPage, WorkspacePage, ZoneFrame } from "./pages";
import { autoBackupIntervalMs, autoSnapshot, backupFolderName, chooseBackupFolder, folderBackupSupported, forgetBackupFolder, lastFolderBackup, writeFolderBackup } from "./autoBackup";
import { createSyncBundle, openSyncBundle, readTrustedDevices, saveTrustedDevices, tabChannel, trustDevice, type SyncTransport, type TrustedDevice } from "./devices";
import { cloneCard, createSubCard, parentCandidates, subCards, type Label, type Member, rememberStateIds, recordRevisions, canEditComment, convertChecklistItem, copyBoard, copyList, createCardFromTemplate, deleteLabel, emptyBoardFilter, emptyState, filterBoardCards, isCardAvailable, linkDependency, markMediaLocal, moveChecklistItem, newId, positionBefore, recordRevision, restoreRevision, searchCards, sortListCards, transferCard, unlinkDependency, type AppState, type AutomationRule, type Board, type BoardFilter, type BoardList, type Zone, type Card, type Checklist, type Revision } from "./model";
import { addImportedBoardWithRevisions, parseTrelloBoard, parseTrelloZip, prepareTrelloWorkspace, readTrelloZipBoardId, restoreExistingAttachments, restoreTrelloAttachments } from "./importTrello";
import { LanSync, newRoomCode } from "./lanSync";
import { chooseConflict, mergeStates, type SyncConflict } from "./sync";
import { importedCardForUrl, relatedCards } from "./links";
import { cardActivityFeed } from "./activity";
import { createBackupParts, restoreBackup } from "./backup";
import { applyCardButton, applyDueRules, applyMoveRules } from "./automation";
import { dueReminders, reminderSignature } from "./reminders";
import { applyDueRecurrence } from "./repeatingDue";
import { ensureInbox, inboxBoardId, inboxListId, inboxWorkspaceId } from "./inbox";
import { downloadTrelloAttachment, downloadTrelloComments, trelloBridgeAvailable } from "./trelloBridge";
import { labelColorOptions, readableTextColor } from "./labels";
import { MarkdownText } from "./MarkdownText";
import "./MarkdownText.css";
import "./activity.css";
import "./App.css";
import "./pages.css";

const personalWorkspaceId = "kanbonk-personal-workspace";

function LocalRoomControls({ serverUrl, roomCode, onServerChange, onCodeChange, onConnect }: { serverUrl: string; roomCode: string; onServerChange: (value: string) => void; onCodeChange: (value: string) => void; onConnect: () => void }) {
  return <section className="local-sync">
    <h3>Via a local server</h3>
    <p>Open Kanbonk on both devices using the computer's Wi-Fi address. Enter the address of the running Kanbonk server and share the room code with the second device. Changes sync automatically; the server only receives encrypted data.</p>
    <label>Server address<input type="url" value={serverUrl} onChange={(event) => onServerChange(event.target.value)} placeholder="http://192.168.1.178:4174" /></label>
    <label>Room code<input value={roomCode} onChange={(event) => onCodeChange(event.target.value)} spellCheck={false} autoComplete="off" /></label>
    <div><button onClick={() => onCodeChange(newRoomCode())}>Create code</button><button className="primary-button" onClick={onConnect} disabled={!serverUrl || !roomCode}>Connect with code</button></div>
  </section>;
}

function Icon({ name }: { name: "plus" | "close" | "star" | "search" | "clip" | "clock" | "archive" | "history" | "info" }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />, close: <path d="M18 6 6 18M6 6l12 12" />,
    star: <path d="m12 2 3 6.5 7 1-5 5 .9 7.5L12 18.5 6.1 22l.9-7.5-5-5 7-1L12 2Z" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    clip: <path d="m21 11.5-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    archive: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v12h14V8M10 12h4" /></>,
    history: <><path d="M3 11a9 9 0 1 1 3 7M3 4v7h7" /><path d="M12 7v5l4 2" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function NameEditor({ value, label, className, onCommit }: { value: string; label: string; className?: string; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  const cancelled = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(value); }, [value]);
  function save() {
    editing.current = false;
    if (cancelled.current) { cancelled.current = false; setDraft(value); return; }
    const name = draft.trim();
    if (name && name !== value) onCommit(name);
    else setDraft(value);
  }
  return <input className={className} aria-label={label} value={draft} onFocus={() => { editing.current = true; }} onChange={(event) => setDraft(event.target.value)} onBlur={save} onKeyDown={(event) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") { event.stopPropagation(); cancelled.current = true; event.currentTarget.blur(); }
  }} />;
}

const boardColors = ["#147d86", "#0c66e4", "#5e4db2", "#a54800", "#216e4e"];
const plannerViewId = "kanbonk-planner";
const coverColors = ["#4bce97", "#f5cd47", "#fea362", "#f87168", "#9f8fef", "#579dff", "#6cc3e0", "#94c748", "#e774bb", "#626f86"];
const stickerChoices = [{ symbol: "⭐", name: "Star" }, { symbol: "✅", name: "Done" }, { symbol: "🎉", name: "Party" }, { symbol: "🚀", name: "Rocket" }, { symbol: "🔥", name: "Fire" }, { symbol: "💡", name: "Idea" }];
const reminderOptions = [{ minutes: 0, label: "At due time" }, { minutes: 5, label: "5 minutes before" }, { minutes: 10, label: "10 minutes before" }, { minutes: 15, label: "15 minutes before" }, { minutes: 60, label: "1 hour before" }, { minutes: 120, label: "2 hours before" }, { minutes: 1440, label: "1 day before" }, { minutes: 2880, label: "2 days before" }, { minutes: 10080, label: "1 week before" }];

function localDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function readBoardFilters(): Record<string, BoardFilter> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem("kanbonk-board-filters") ?? "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter(([, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const filter = value as Record<string, unknown>;
      return typeof filter.keyword === "string" && typeof filter.labelId === "string" && (filter.memberId === undefined || typeof filter.memberId === "string") && ["all", "complete", "incomplete"].includes(String(filter.status)) && ["any", "overdue", "next-week", "none"].includes(String(filter.due));
    })) as Record<string, BoardFilter>;
  } catch { return {}; }
}

function readDismissedReminders(): Record<string, string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem("kanbonk-dismissed-reminders") ?? "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? Object.fromEntries(Object.entries(saved).filter(([, value]) => typeof value === "string")) : {};
  } catch { return {}; }
}

type PanelWidths = { inbox: number; planner: number };
type PanelName = keyof PanelWidths;
type PanelVisibility = Record<PanelName, boolean>;

function readPanelWidths(): PanelWidths {
  try {
    const saved = JSON.parse(localStorage.getItem("kanbonk-panel-widths") ?? "{}");
    return {
      inbox: Number.isFinite(saved.inbox) ? Math.min(720, Math.max(220, saved.inbox)) : 300,
      planner: Number.isFinite(saved.planner) ? Math.min(720, Math.max(220, saved.planner)) : 400,
    };
  } catch { return { inbox: 300, planner: 400 }; }
}

function App() {
  const [fullState, setState] = useState<AppState>(emptyState);
  const state = useMemo(() => visibleState(fullState), [fullState]);
  const { route, navigate, back } = useRoute();
  /** The page shown in the main area; a card modal keeps the page it was opened from. */
  const page: Route = route.page === "card" ? route.background ?? { page: "card", id: route.id } : route;
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
  const [boardCopy, setBoardCopy] = useState<{ name: string; workspaceId: string; keepCards: boolean; keepTemplates: boolean } | null>(null);
  const [boardDescriptionDraft, setBoardDescriptionDraft] = useState("");
  const [creation, setCreation] = useState<{ kind: "workspace" | "board"; workspaceId?: string } | null>(null);
  const [creationName, setCreationName] = useState("");
  const [importing, setImporting] = useState(false);
  const [localAuthor, setLocalAuthor] = useState(readLocalAuthor);
  const [authorDialogOpen, setAuthorDialogOpen] = useState(false);
  const [authorDraft, setAuthorDraft] = useState("");
  const [importJson, setImportJson] = useState<File | null>(null);
  const [importZip, setImportZip] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importReport, setImportReport] = useState("");
  const [helperCode, setHelperCode] = useState("");
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
  const [syncServerUrl, setSyncServerUrl] = useState(() => /^https?:$/.test(window.location.protocol) ? window.location.origin : "");
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
  const [folderStatus, setFolderStatus] = useState("");
  const [folderName, setFolderName] = useState<string | undefined>();
  const [pendingDelete, setPendingDelete] = useState<{ kind: TrashKind; id: string; name: string; impact: TrashImpact } | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 8000); return () => window.clearTimeout(timer); }, [notice]);
  const [dedupeOpen, setDedupeOpen] = useState(false);
  const [dedupeIgnored, setDedupeIgnored] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem("kanbonk-dedupe-ignored") ?? "[]")); } catch { return new Set(); } });
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>(readTrustedDevices);
  const [syncTransport, setSyncTransport] = useState<SyncTransport>(() => { const saved = localStorage.getItem("kanbonk-sync-transport"); return saved === "internet" || saved === "file" ? saved : "wifi"; });
  const [bundleCode, setBundleCode] = useState("");
  const queue = useRef(Promise.resolve());
  const localDeviceId = useRef(deviceId());
  const syncRef = useRef<LanSync | null>(null);
  const stateRef = useRef(fullState);
  const sentHeads = useRef("");
  stateRef.current = fullState;
  const wideLayout = viewportWidth >= 1500;
  const shownPanels: PanelName[] = wideLayout ? (["inbox", "planner"] as const).filter((name) => visiblePanels[name]) : activePanel && visiblePanels[activePanel] ? [activePanel] : [];
  const panelWidthLimit = Math.max(220, Math.min(720, shownPanels.length === 2 ? Math.floor((viewportWidth - 776) / 2) : viewportWidth - 580));

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
      setPanelWidths((current) => ({ ...current, [panel]: Math.min(panelWidthLimit, Math.max(220, startWidth + pointer.clientX - startX)) }));
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
    setPanelWidths((current) => ({ ...current, [panel]: event.key === "Home" ? 220 : event.key === "End" ? panelWidthLimit : Math.min(panelWidthLimit, Math.max(220, Math.min(current[panel], panelWidthLimit) + (event.key === "ArrowRight" ? 20 : -20))) }));
  }

  useEffect(() => { localStorage.setItem("kanbonk-panel-widths", JSON.stringify(panelWidths)); }, [panelWidths]);
  useEffect(() => { if (ready) localStorage.setItem("kanbonk-open-panels", JSON.stringify(visiblePanels)); }, [visiblePanels, ready]);

  useEffect(() => {
    loadState().then((loaded) => {
      loaded = ensureInbox(loaded, localDeviceId.current);
      setState(loaded);
      const savedPanel = localStorage.getItem("kanbonk-active-panel");
      const initialPanel = savedPanel === "inbox" || savedPanel === "planner" ? savedPanel : null;
      setActivePanel(initialPanel);
      try {
        const stored = JSON.parse(localStorage.getItem("kanbonk-open-panels") ?? "null");
        setVisiblePanels(stored && typeof stored.inbox === "boolean" && typeof stored.planner === "boolean" ? stored : { inbox: initialPanel === "inbox", planner: initialPanel === "planner" });
      } catch { setVisiblePanels({ inbox: initialPanel === "inbox", planner: initialPanel === "planner" }); }
      setReady(true);
    }).catch((cause) => setError(`Could not open local data: ${String(cause)}`));
  }, []);

  useEffect(() => {
    if (!ready) return;
    queue.current = queue.current.then(() => saveState(fullState)).then(() => tabs.current?.notify()).catch((cause) => setError(`Could not save changes: ${String(cause)}`));
  }, [fullState, ready]);

  useEffect(() => {
    if (!ready) return;
    const heads = JSON.stringify(fullState.heads);
    if (heads === sentHeads.current) return;
    sentHeads.current = heads;
    const timer = window.setTimeout(() => { void syncRef.current?.syncIfConnected(); }, 250);
    return () => window.clearTimeout(timer);
  }, [fullState.heads, ready]);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine !== false);
      if (navigator.onLine !== false && reconnectTimer.current !== undefined && lastLan.current) { try { syncSession(lastLan.current); } catch (cause) { setSyncStatus(String(cause)); } }
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  });

  // Same-device sync: other tabs/windows of this browser profile announce saves; merge what they stored.
  useEffect(() => {
    if (!ready) return;
    const channel = tabChannel(() => {
      void loadState().then((stored) => {
        const current = stateRef.current;
        const merged = mergeStates(current, stored);
        if (JSON.stringify(merged.state.heads) === JSON.stringify(current.heads) && JSON.stringify(merged.state.tombstones ?? {}) === JSON.stringify(current.tombstones ?? {})) return;
        rememberStateIds(merged.state);
        stateRef.current = merged.state;
        setState(merged.state);
        if (merged.conflicts.length) setSyncConflicts(merged.conflicts);
      }).catch((cause) => setError(`Could not get changes from another tab: ${String(cause)}`));
    });
    tabs.current = channel;
    return () => { channel.close(); tabs.current = null; };
  }, [ready]);

  // Automatic backups: local snapshots every 10 minutes (and when the page is hidden) plus a daily ZIP into a chosen folder.
  useEffect(() => {
    if (!ready) return;
    const run = () => {
      void autoSnapshot(stateRef.current).then((meta) => { if (meta) setSnapshots((current) => [meta, ...current]); }).catch((cause) => setError(`Automatic backup was not created: ${String(cause)}`));
      void lastFolderBackup().then(async (last) => {
        if (!await backupFolderName() || last?.slice(0, 10) === new Date().toISOString().slice(0, 10)) return;
        setFolderStatus(`Latest backup in folder: ${await writeFolderBackup(stateRef.current)}`);
      }).catch((cause) => setFolderStatus(String(cause instanceof Error ? cause.message : cause)));
    };
    const first = window.setTimeout(run, 30_000);
    const interval = window.setInterval(run, autoBackupIntervalMs);
    const hidden = () => { if (document.visibilityState === "hidden") void autoSnapshot(stateRef.current); };
    document.addEventListener("visibilitychange", hidden);
    return () => { window.clearTimeout(first); window.clearInterval(interval); document.removeEventListener("visibilitychange", hidden); };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      if (activePanel) localStorage.setItem("kanbonk-active-panel", activePanel);
      else localStorage.removeItem("kanbonk-active-panel");
    } catch (cause) { setError(`Could not save the selected section: ${String(cause)}`); }
  }, [activePanel, ready]);


  useEffect(() => {
    try { localStorage.setItem("kanbonk-board-filters", JSON.stringify(boardFilters)); }
    catch (cause) { setError(`Could not save the board filter: ${String(cause)}`); }
  }, [boardFilters]);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  useEffect(() => {
    if (ready) setState((current) => purgeExpired(applyDueRules(current, now, localDeviceId.current), localDeviceId.current, now));
  }, [ready, now, state.boards, state.cards]);

  useEffect(() => {
    try { localStorage.setItem("kanbonk-dismissed-reminders", JSON.stringify(dismissedReminders)); }
    catch (cause) { setError(`Could not save reminders: ${String(cause)}`); }
  }, [dismissedReminders]);

  const board = state.boards.find((item) => item.id === boardId && !item.archived);
  const defaultWorkspaceId = state.workspaces.find((item) => item.id !== inboxWorkspaceId && !item.archived)?.id;
  const lists = state.lists.filter((item) => item.boardId === boardId && !item.archived).sort((a, b) => a.position - b.position);
  const card = state.cards.find((item) => item.id === cardId && !item.archived);
  const deferredSearch = useDeferredValue(search);
  const matchingCards = useMemo(() => searchCards(state, deferredSearch).slice(0, 50), [state, deferredSearch]);
  const matchingBoards = search.trim() ? state.boards.filter((item) => item.id !== inboxBoardId && !item.archived && item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).slice(0, 20) : [];
  const boardFilter = useMemo(() => boardFilters[boardId ?? ""] ?? emptyBoardFilter(), [boardFilters, boardId]);
  const deferredFilter = useDeferredValue(boardFilter);
  const filteredCards = useMemo(() => boardId ? filterBoardCards(state, boardId, deferredFilter) : [], [state, boardId, deferredFilter]);
  const filteredCardIds = useMemo(() => new Set(filteredCards.map((item) => item.id)), [filteredCards]);
  const cardsByList = useMemo(() => {
    const groups = new Map<string, Card[]>();
    for (const item of filteredCards) { const group = groups.get(item.listId); if (group) group.push(item); else groups.set(item.listId, [item]); }
    for (const group of groups.values()) group.sort((a, b) => a.position - b.position);
    return groups;
  }, [filteredCards]);
  const labelMap = useMemo(() => new Map(state.labels.filter((item) => !item.deleted).map((item) => [item.id, item])), [state.labels]);
  const cardById = useMemo(() => new Map(state.cards.map((item) => [item.id, item])), [state.cards]);
  const tileHandlers = useRef<TileActions>({ open: () => undefined, drop: () => undefined });
  tileHandlers.current = {
    open: (id) => setCardId(id),
    drop: (movingId, target) => { const moving = state.cards.find((entry) => entry.id === movingId); if (moving && moving.id !== target.id && moving.boardId === target.boardId) updateCard(moving.id, (current) => ({ ...current, listId: target.listId, position: positionBefore(state.cards, moving.id, target) })); },
  };
  const tileActions = useMemo<TileActions>(() => ({ open: (id) => tileHandlers.current.open(id), drop: (movingId, target) => tileHandlers.current.drop(movingId, target) }), []);
  const boardCardCount = boardId ? filterBoardCards(state, boardId, emptyBoardFilter()).length : 0;
  const closedBoards = state.boards.filter((item) => item.archived);
  const reminders = useMemo(() => dueReminders(state, now, dismissedReminders), [state, now, dismissedReminders]);
  const boardTemplates = state.cards.filter((item) => item.boardId === boardId && item.isTemplate);
  const filterCount = Number(Boolean(boardFilter.keyword.trim())) + Number(Boolean(boardFilter.labelId)) + Number(Boolean(boardFilter.memberId)) + Number(boardFilter.status !== "all") + Number(boardFilter.due !== "any");

  function updateFilter(change: Partial<BoardFilter>) {
    if (!boardId) return;
    setBoardFilters((current) => ({ ...current, [boardId]: { ...current[boardId] ?? emptyBoardFilter(), ...change } }));
  }

  useEffect(() => {
    const id = board?.backgroundImageId;
    if (!id) return;
    let url = "";
    let cancelled = false;
    loadAttachment(id).then((blob) => {
      if (!blob || cancelled) return;
      url = URL.createObjectURL(blob);
      setBackgroundImage({ id, url });
    }).catch((cause) => setError(`Could not open the board background: ${String(cause)}`));
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [board?.backgroundImageId, fileVersion]);

  function setBoardId(id: string | null) {
    navigate(id ? boardHref(id) : "/");
  }

  /** Opening a card from any page shows a modal over that page; closing returns to it. */
  function setCardId(id: string | null) {
    if (id) { navigate(`/c/${id}`, { modal: true }); return; }
    if (route.page !== "card") return;
    if (route.background) { back(); return; }
    const target = fullState.cards.find((item) => item.id === route.id);
    navigate(target && target.boardId !== inboxBoardId ? boardHref(target.boardId) : "/");
  }

  function entityName(kind: TrashKind, id: string): string {
    const collection = kind === "workspace" ? fullState.workspaces : kind === "board" ? fullState.boards : kind === "list" ? fullState.lists : fullState.cards;
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
    if (kind === "board" && boardId === id) navigate(`/w/${fullState.boards.find((item) => item.id === id)?.workspaceId ?? ""}`);
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
    if (!confirm(`Delete “${entityName(kind, id)}” forever? This can't be undone (except by restoring from a backup).`)) return;
    setState((current) => purgeFromTrash(current, kind, id, localDeviceId.current));
  }

  function emptyAllTrash() {
    if (!confirm("Empty trash forever?")) return;
    setState((current) => emptyTrash(current, localDeviceId.current));
  }

  function downloadText(content: string, name: string, type: string) {
    saveFile(new Blob([content], { type }), name).catch((cause) => setError(`Could not save “${name}”: ${String(cause)}`));
  }

  function rememberTrust(peer: { deviceId: string; name: string }, code: string) {
    setTrustedDevices((current) => { const next = trustDevice(current, peer, code); saveTrustedDevices(next); return next; });
  }

  async function shareSyncBundle(code: string) {
    try {
      const blob = await createSyncBundle(stateRef.current, code, { deviceId: localDeviceId.current, name: localAuthor }, loadAttachment);
      const file = new File([blob], `kanbonk-sync-${new Date().toISOString().slice(0, 10)}.kanbonk-sync`, { type: "application/octet-stream" });
      const result = await shareFile(file);
      setSyncStatus(result === "shared" ? "Package sent via the system Share menu (Bluetooth, Nearby Share, etc.)." : result === "cancelled" ? "Package saving canceled." : "Package saved. Transfer the file via Bluetooth, USB or any other way and open it on a trusted device.");
    } catch (cause) { setSyncStatus(`Could not create package: ${String(cause)}`); }
  }

  async function openBundle(file: File | null) {
    if (!file) return;
    try {
      const codes = [...trustedDevices.map((item) => item.code), bundleCode.trim().toLowerCase()].filter(Boolean);
      const opened = await openSyncBundle(new Uint8Array(await file.arrayBuffer()), codes);
      if (opened.sender?.deviceId === localDeviceId.current) { setSyncStatus("This package was created on this device. Open it on another one."); return; }
      if (opened.sender && !trustedDevices.some((item) => item.deviceId === opened.sender!.deviceId)) {
        if (!confirm(`Add “${opened.sender.name}” to trusted devices and accept the data?`)) return;
      }
      if (opened.sender) rememberTrust(opened.sender, opened.code);
      for (const item of opened.files) if (!await loadAttachment(item.id)) await saveAttachment(item.id, item.blob);
      const merged = mergeStates(stateRef.current, opened.state);
      rememberStateIds(merged.state);
      stateRef.current = merged.state;
      setState(opened.files.reduce((current, item) => markMediaLocal(current, item.id), merged.state));
      setFileVersion((current) => current + 1);
      setSyncConflicts(merged.conflicts);
      setSyncStatus(`Package accepted. Files: ${opened.files.length}, conflicts: ${merged.conflicts.length}.`);
    } catch (cause) { setSyncStatus(String(cause instanceof Error ? cause.message : cause)); }
  }

  async function refreshBackupInfo() {
    setSnapshots((await listSnapshots()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setFolderName(await backupFolderName());
  }

  async function restoreSnapshot(meta: SnapshotMeta) {
    if (!confirm(`Restore all data to the state from ${new Date(meta.createdAt).toLocaleString("en-US")}? The current state will be saved as a separate backup first.`)) return;
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
    } catch (cause) { setBackupReport(`Restore failed: ${String(cause)}`); }
  }

  function createWorkspace(name: string) {
    if (!name) return;
    const workspace = { id: newId(), name };
    setState((current) => recordRevision({ ...current, workspaces: [...current.workspaces, workspace] }, "workspace", workspace.id, localDeviceId.current));
    navigate(`/w/${workspace.id}`);
  }

  function createBoard(name: string, workspaceId = defaultWorkspaceId) {
    if (!name) return;
    const targetWorkspaceId = workspaceId ?? personalWorkspaceId;
    const created: Board = { id: newId(), workspaceId: targetWorkspaceId, name, description: "", background: boardColors[0], members: [], starred: false };
    setState((current) => {
      let next = current;
      if (targetWorkspaceId === personalWorkspaceId && !next.workspaces.some((item) => item.id === personalWorkspaceId)) {
        next = recordRevision({ ...next, workspaces: [...next.workspaces, { id: personalWorkspaceId, name: "Personal" }] }, "workspace", personalWorkspaceId, localDeviceId.current);
      }
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
      return recordRevisions(copied.state, [
        { kind: "board", id },
        ...copied.listIds.map((listId) => ({ kind: "list" as const, id: listId })),
        ...copied.state.labels.filter((item) => item.boardId === id).map((label) => ({ kind: "label" as const, id: label.id })),
        ...copied.cardIds.map((cardId) => ({ kind: "card" as const, id: cardId })),
      ], localDeviceId.current);
    });
    setBoardId(id);
    setBoardCopy(null);
  }

  function openCreation(kind: "workspace" | "board", workspaceId?: string) {
    setCreation({ kind, workspaceId });
    setCreationName("");
  }

  function togglePanel(target: "inbox" | "planner") {
    if (!wideLayout && activePanel !== target) { showPanel(target); setCardId(null); return; }
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
    setState((current) => recordRevision({ ...current, boards: current.boards.map((item) => item.id === board.id ? change(item) : item) }, "board", board.id, localDeviceId.current));
  }

  function openBoardAbout() {
    if (!board) return;
    setBoardDescriptionDraft(board.description);
    setBoardAboutOpen(true);
  }

  function saveBoardDescription() {
    if (board && boardDescriptionDraft !== board.description) updateBoard((item) => ({ ...item, description: boardDescriptionDraft }));
    setBoardAboutOpen(false);
  }

  function closeBoard() {
    if (!board || !confirm(`Close board “${board.name}”? You can reopen it later.`)) return;
    updateBoard((item) => ({ ...item, archived: true }));
    setBoardId(state.boards.find((item) => item.id !== board.id && item.id !== inboxBoardId && !item.archived)?.id ?? null);
    setCardId(null);
    setClosedBoardsOpen(true);
  }

  function restoreClosedBoard(id: string) {
    setState((current) => {
      const target = current.boards.find((item) => item.id === id && item.archived);
      return target ? recordRevision({ ...current, boards: current.boards.map((item) => item.id === id ? { ...item, archived: false } : item) }, "board", id, localDeviceId.current) : current;
    });
    setBoardId(id);
    setClosedBoardsOpen(false);
  }

  function updateList(id: string, change: (item: AppState["lists"][number]) => AppState["lists"][number]) {
    setState((current) => recordRevision({ ...current, lists: current.lists.map((item) => item.id === id ? change(item) : item) }, "list", id, localDeviceId.current));
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
    setState((current) => assignListToZone(current, listId, value === "none" ? undefined : value, localDeviceId.current));
  }

  function changeZone(zoneId: string, change: { name?: string; color?: string }) {
    if (board) setState((current) => updateZone(current, board.id, zoneId, change, localDeviceId.current));
  }

  function removeZone(zone: Zone) {
    if (board && confirm(`Remove zone “${zone.name}”? Lists and cards will stay on the board.`)) setState((current) => deleteZone(current, board.id, zone.id, localDeviceId.current));
  }

  function renderList(list: BoardList) {
    return <section className="list-column" key={list.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const bounds = event.currentTarget.getBoundingClientRect(); const movingZoneId = event.dataTransfer.getData("text/kanbonk-zone"); if (movingZoneId) { moveZoneTo(movingZoneId, list.id, event.clientX > bounds.left + bounds.width / 2); return; } const movingListId = event.dataTransfer.getData("text/kanbonk-list"); if (movingListId) { moveList(movingListId, list.id, event.clientX > bounds.left + bounds.width / 2); return; } const id = event.dataTransfer.getData("text/kanbonk-card"); if (id) updateCard(id, (item) => ({ ...item, listId: list.id, position: Math.max(0, ...state.cards.filter((entry) => entry.listId === list.id).map((entry) => entry.position)) + 1 })); }}><div className="list-header"><span className="list-drag-handle" draggable title="Drag list" onDragStart={(event) => event.dataTransfer.setData("text/kanbonk-list", list.id)}>⋮⋮</span><NameEditor value={list.name} label={`List title ${list.name}`} onCommit={(name) => updateList(list.id, (item) => ({ ...item, name }))} /><select className="list-sort" aria-label={`List actions ${list.name}`} title="List actions" defaultValue="" onChange={(event) => { const action = event.target.value; if (action === "name" || action === "due") sortList(list.id, action); else if (action === "move-left") moveListByOne(list.id, -1); else if (action === "move-right") moveListByOne(list.id, 1); else if (action === "copy") copyListOnBoard(list.id); else if (action === "delete") requestDelete("list", list.id); else if (action.startsWith("zone:")) setListZone(list.id, action.slice(5)); event.target.value = ""; }}><option value="">⋯</option><option value="name">Sort by title</option><option value="due">Sort by due date</option><option value="move-left">Move left</option><option value="move-right">Move right</option><option value="copy">Copy list</option><optgroup label="Zone">{list.zoneId && <option value="zone:none">Remove from zone</option>}{(board?.zones ?? []).filter((zone) => zone.id !== list.zoneId).map((zone) => <option key={zone.id} value={`zone:${zone.id}`}>To zone “{zone.name}”</option>)}<option value="zone:new">New zone…</option></optgroup><option value="delete">Move list to trash</option></select><button onClick={() => { if (confirm(`Archive list “${list.name}”?`)) updateList(list.id, (item) => ({ ...item, archived: true })); }} aria-label={`Archive list ${list.name}`}><Icon name="archive" /></button></div><div className="card-stack"><ListCards cards={cardsByList.get(list.id) ?? []} render={(item) => <CardTile key={item.id} card={item} labels={labelMap} members={board?.members} parentName={item.parentCardId ? cardById.get(item.parentCardId)?.name : undefined} actions={tileActions} />} /></div>{editingCardList === list.id ? <div className="compose"><textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); createCard(list.id); } }} placeholder="Card title" /><div><button className="primary-button" onClick={() => createCard(list.id)}>Add a card</button><button className="plain-icon" onClick={() => { setEditingCardList(null); setDraft(""); }} aria-label="Cancel"><Icon name="close" /></button></div></div> : <button className="add-card" onClick={() => { setEditingCardList(list.id); setEditingList(false); setDraft(""); }}><Icon name="plus" /> Add a card</button>}<TemplateComposer templates={boardTemplates} onCreate={(templateId, name) => addCardFromTemplate(templateId, list.id, name)} /></section>;
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
      return recordRevisions(copied.state, [{ kind: "list", id: copied.listId }, ...copied.cardIds.map((cardId) => ({ kind: "card" as const, id: cardId }))], localDeviceId.current);
    });
  }

  function updateCard(id: string, change: (item: Card) => Card) {
    setState((current) => recordRevision({ ...current, cards: current.cards.map((item) => item.id === id ? applyDueRecurrence(item, applyMoveRules(current, item, change(item))) : item) }, "card", id, localDeviceId.current));
  }

  function runCardButton(cardId: string, ruleId: string) {
    setState((current) => {
      const before = current.cards.find((item) => item.id === cardId);
      if (!before) return current;
      const after = applyDueRecurrence(before, applyCardButton(current, before, ruleId));
      return after === before ? current : recordRevision({ ...current, cards: current.cards.map((item) => item.id === cardId ? after : item) }, "card", cardId, localDeviceId.current);
    });
  }

  function addAutomationRule(targetBoardId: string, listId: string, action: AutomationRule["action"], labelId?: string, trigger: "move" | "button" | "due" = "move", name?: string, leadMinutes = 0) {
    setState((current) => {
      const board = current.boards.find((item) => item.id === targetBoardId && !item.archived);
      if (!board || trigger === "move" && !current.lists.some((item) => item.id === listId && item.boardId === targetBoardId && !item.archived) || trigger === "button" && !name?.trim() || trigger === "due" && ![0, 60, 1440, 10080].includes(leadMinutes)) return current;
      if (action === "add-label" && !current.labels.some((item) => item.id === labelId && item.boardId === targetBoardId && !item.deleted)) return current;
      const rule: AutomationRule = { id: newId(), listId: trigger === "move" ? listId : "", trigger, name: trigger === "button" ? name!.trim() : undefined, createdAt: trigger === "due" ? new Date().toISOString() : undefined, leadMinutes: trigger === "due" ? leadMinutes : undefined, action, labelId: action === "add-label" ? labelId : undefined };
      return recordRevision({ ...current, boards: current.boards.map((item) => item.id === targetBoardId ? { ...item, automationRules: [...(item.automationRules ?? []), rule] } : item) }, "board", targetBoardId, localDeviceId.current);
    });
  }

  function removeAutomationRule(targetBoardId: string, ruleId: string) {
    setState((current) => recordRevision({ ...current, boards: current.boards.map((item) => item.id === targetBoardId ? { ...item, automationRules: (item.automationRules ?? []).filter((rule) => rule.id !== ruleId) } : item) }, "board", targetBoardId, localDeviceId.current));
  }

  function moveOrCopyCard(id: string, targetListId: string, copy: boolean) {
    const targetList = state.lists.find((list) => list.id === targetListId && !list.archived);
    if (!targetList) return;
    const targetId = copy ? newId() : id;
    setState((current) => {
      const transferred = transferCard(current, id, targetListId, copy, targetId).state;
      const before = current.cards.find((item) => item.id === id);
      const cards = !copy && before ? transferred.cards.map((item) => item.id === id ? applyDueRecurrence(before, applyMoveRules(current, before, item)) : item) : transferred.cards;
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
      return recordRevisions({ ...current, cards }, changed.map((card) => ({ kind: "card" as const, id: card.id })), localDeviceId.current);
    });
  }

  function createList() {
    if (!board || !draft.trim()) return;
    const created = { id: newId(), boardId: board.id, name: draft.trim(), position: Math.max(0, ...lists.map((item) => item.position)) + 1 };
    setState((current) => recordRevision({ ...current, lists: [...current.lists, created] }, "list", created.id, localDeviceId.current));
    setDraft(""); setEditingList(false);
  }

  function createCard(listId: string) {
    if (!board || !draft.trim()) return;
    const created: Card = { id: newId(), boardId: board.id, listId, name: draft.trim(), description: "", createdAt: new Date().toISOString(), position: Math.max(0, ...state.cards.filter((item) => item.listId === listId).map((item) => item.position)) + 1, labelIds: [], completed: false, checklists: [], comments: [], attachments: [] };
    setState((current) => recordRevision({ ...current, cards: [...current.cards, created] }, "card", created.id, localDeviceId.current));
    setDraft(""); setEditingCardList(null);
  }

  /** Cards accepted from AI triage; the quoted source stays in the description so every card is traceable. */
  function createProposedCards(items: ProposedCard[]) {
    setState((current) => {
      const now = new Date().toISOString();
      const created: Card[] = items.map((item, index) => ({ id: newId(), boardId: current.lists.find((list) => list.id === item.listId)?.boardId ?? "", listId: item.listId, name: item.title.trim(), description: `${item.description.trim()}\n\n> Source: ${item.source.replace(/\s+/g, " ").trim()}`, createdAt: now, dueAt: item.due ? new Date(`${item.due}T12:00:00`).toISOString() : undefined, position: Math.max(0, ...current.cards.filter((card) => card.listId === item.listId).map((card) => card.position)) + 1 + index, labelIds: [], completed: false, checklists: [], comments: [], attachments: [] }));
      return recordRevisions({ ...current, cards: [...current.cards, ...created] }, created.map((card) => ({ kind: "card" as const, id: card.id })), localDeviceId.current);
    });
    setNotice(`Cards created: ${items.length}`);
  }

  function createInboxCard(name: string) {
    const title = name.trim();
    if (!title) return;
    setState((current) => {
      const created: Card = { id: newId(), boardId: inboxBoardId, listId: inboxListId, name: title, description: "", createdAt: new Date().toISOString(), position: Math.max(0, ...current.cards.filter((item) => item.listId === inboxListId).map((item) => item.position)) + 1, labelIds: [], completed: false, checklists: [], comments: [], attachments: [] };
      return recordRevision({ ...current, cards: [...current.cards, created] }, "card", created.id, localDeviceId.current);
    });
  }

  function addCardFromTemplate(templateId: string, listId: string, name: string) {
    const id = newId();
    try {
      setState((current) => recordRevision(createCardFromTemplate(current, templateId, listId, name, id).state, "card", id, localDeviceId.current));
    } catch (cause) { setError(String(cause)); }
  }

  function addDependency(dependentId: string, prerequisiteId: string) {
    setState((current) => {
      const linked = linkDependency(current, dependentId, prerequisiteId);
      if (linked === current) return current;
      return recordRevision(recordRevision(linked, "card", dependentId, localDeviceId.current), "card", prerequisiteId, localDeviceId.current);
    });
  }

  function removeDependency(dependentId: string, prerequisiteId: string) {
    setState((current) => {
      const unlinked = unlinkDependency(current, dependentId, prerequisiteId);
      if (unlinked === current) return current;
      let next = unlinked;
      if (current.cards.some((item) => item.id === dependentId)) next = recordRevision(next, "card", dependentId, localDeviceId.current);
      if (current.cards.some((item) => item.id === prerequisiteId)) next = recordRevision(next, "card", prerequisiteId, localDeviceId.current);
      return next;
    });
  }

  function convertItem(cardId: string, checklistId: string, itemId: string) {
    const createdId = newId();
    setState((current) => {
      const converted = convertChecklistItem(current, cardId, checklistId, itemId, createdId);
      if (converted === current) return current;
      return recordRevision(recordRevision(converted, "card", cardId, localDeviceId.current), "card", createdId, localDeviceId.current);
    });
  }

  async function attachFiles(target: Card, files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      const id = newId();
      try {
        await saveAttachment(id, file);
        updateCard(target.id, (current) => ({ ...current, attachments: [...current.attachments, { id, name: file.name, mimeType: file.type, size: file.size, status: "local" }], cover: current.cover ?? (file.type.startsWith("image/") ? { attachmentId: id, size: "normal" } : undefined) }));
      } catch (cause) { setError(`Could not save ${file.name}: ${String(cause)}`); }
    }
  }

  async function addStickerImage(target: Card, file: File | null) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"].includes(file.type)) { setError("Choose a PNG, JPEG, WebP, GIF or AVIF image for the sticker."); return; }
    const id = newId();
    try {
      await saveAttachment(id, file);
      updateCard(target.id, (current) => ({ ...current, stickers: [...(current.stickers ?? []), { imageId: id, name: file.name }] }));
    } catch (cause) { setError(`Could not save the sticker: ${String(cause)}`); }
  }

  async function uploadBoardBackground(file: File | null) {
    if (!board || !file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image for the background."); return; }
    const id = newId();
    try {
      await saveAttachment(id, file);
      updateBoard((item) => ({ ...item, backgroundImageId: id }));
    } catch (cause) { setError(`Could not save the board background: ${String(cause)}`); }
  }

  async function downloadAttachment(id: string, name: string) {
    try {
      const blob = await loadAttachment(id);
      if (!blob) { setError(`File “${name}” is not available on this device.`); return; }
      await saveFile(blob, name);
    } catch (cause) { setError(`Could not open file “${name}”: ${String(cause)}`); }
  }

  function exportBoard(format: "trello-json" | "csv") {
    if (!board) return;
    if (format === "csv") downloadText(`\ufeff${exportTrelloCsv(fullState, board.id)}`, `${board.name}.csv`, "text/csv;charset=utf-8");
    else downloadText(JSON.stringify(exportTrelloJson(fullState, board.id), null, 2), `${board.name}.json`, "application/json");
  }

  async function exportBackup() {
    setBackupBusy(true);
    setBackupReport("");
    try {
      await queue.current;
      let count = 0;
      let unavailable = 0;
      for await (const part of createBackupParts(stateRef.current)) {
        if (!await saveFile(part.blob, part.name)) { setBackupReport(`Saving canceled after ${count} parts.`); return; }
        count++;
        unavailable = part.unavailable;
        setBackupReport(`Downloaded ${count} of ${part.total} parts.`);
      }
      setBackupReport(`Backup downloaded: ${count} ZIP files.${unavailable ? ` Missing attachments: ${unavailable}; fetch them from Trello first.` : ""}`);
    } catch (cause) { setBackupReport(`Backup failed: ${String(cause)}`); }
    finally { setBackupBusy(false); }
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
      setBackupReport(`Files restored: ${restored.files}. Conflicts: ${restored.conflicts.length}.${restored.unavailable ? ` Attachments missing from the original backup: ${restored.unavailable}.` : ""}`);
    } catch (cause) { setBackupReport(`Restore failed: ${String(cause)}`); }
    finally { setBackupBusy(false); }
  }

  function restore(revision: Revision) {
    setState((current) => restoreRevision(current, revision, localDeviceId.current));
    setPanel(null);
  }

  function openImport() {
    setImportJson(null);
    setImportZip(null);
    setImportReport("");
    setHelperCode("");
    setImporting(true);
  }

  async function importBoard() {
    if (!importJson && !importZip) return;
    setImportBusy(true);
    setImportReport("");
    try {
      if (importJson?.name.toLowerCase().endsWith(".csv")) {
        const workspaceId = defaultWorkspaceId ?? personalWorkspaceId;
        const result = parseTrelloCsv(await importJson.text(), workspaceId, importJson.name.replace(/\.csv$/i, ""));
        setState((current) => {
          let next = current;
          if (workspaceId === personalWorkspaceId && !next.workspaces.some((item) => item.id === personalWorkspaceId)) next = recordRevision({ ...next, workspaces: [...next.workspaces, { id: personalWorkspaceId, name: "Personal" }] }, "workspace", personalWorkspaceId, localDeviceId.current);
          return addImportedBoardWithRevisions(next, result, localDeviceId.current);
        });
        setBoardId(result.board.id);
        setImportReport(`Imported from CSV: ${counted(result.lists.length, "list", "lists")}, ${counted(result.cards.length, "card", "cards")}. ${result.warnings.join(" ")}`);
        return;
      }
      let raw = importJson ? JSON.parse(await importJson.text()) : parseTrelloZip(new Uint8Array(await importZip!.arrayBuffer())).json;
      if (importJson && importZip) {
        const zipBoardId = await readTrelloZipBoardId(importZip);
        if (zipBoardId && zipBoardId !== (raw as { id?: string }).id) throw new Error("The JSON and ZIP belong to different Trello boards.");
      }
      const fallbackWorkspaceId = defaultWorkspaceId ?? personalWorkspaceId;
      const bridgeAvailable = await trelloBridgeAvailable();
      const source = raw as { id?: unknown; actions?: unknown; kanbonkCommentsComplete?: unknown };
      if (bridgeAvailable && source && typeof source.id === "string" && Array.isArray(source.actions) && source.actions.length >= 1000 && source.kanbonkCommentsComplete !== true) {
        try { raw = { ...source, kanbonkComments: await downloadTrelloComments(source.id), kanbonkCommentsComplete: true }; }
        catch { /* The JSON warning reports that older comments may be missing. */ }
      }
      const result = parseTrelloBoard(raw, fallbackWorkspaceId);
      const directDownload = result.attachments.length > 0 && bridgeAvailable;
      const warnings = await restoreTrelloAttachments(result, importZip ?? undefined, directDownload ? downloadTrelloAttachment : undefined);
      setState((current) => {
        let next = current;
        const prepared = prepareTrelloWorkspace(next, result.organization, fallbackWorkspaceId);
        next = prepared.state;
        result.board.workspaceId = prepared.workspaceId;
        if (prepared.changedWorkspaceId) next = recordRevision(next, "workspace", prepared.changedWorkspaceId, localDeviceId.current);
        if (prepared.workspaceId === personalWorkspaceId && !next.workspaces.some((item) => item.id === personalWorkspaceId)) {
          next = recordRevision({ ...next, workspaces: [...next.workspaces, { id: personalWorkspaceId, name: "Personal" }] }, "workspace", personalWorkspaceId, localDeviceId.current);
        }
        return addImportedBoardWithRevisions(next, result, localDeviceId.current);
      });
      if (!result.board.archived) setBoardId(result.board.id);
      const missingAttachments = warnings.filter((item) => item.startsWith("Could not download attachment"));
      const missingStickers = warnings.filter((item) => item.startsWith("Could not download sticker"));
      const unavailable = warnings.length ? `Attachments not fetched: ${missingAttachments.length}. Stickers: ${missingStickers.length}. ${warnings.slice(0, 3).join(" ")}${missingAttachments.length && !importZip && !directDownload ? " For direct download, check the Kanbonk Trello Import extension and an open, signed-in Trello tab, or add a ZIP." : ""}` : "";
      setImportReport(`Imported: ${counted(result.lists.length, "list", "lists")}, ${counted(result.cards.length, "card", "cards")}, ${counted(result.attachments.length - missingAttachments.length, "attachment", "attachments")}, ${counted(result.stickers.length - missingStickers.length, "sticker", "stickers")}. ${[...result.warnings.filter((item) => !item.startsWith("Attachments need") && !item.startsWith("Trello sticker images need")), unavailable, result.board.archived ? "The board is closed in Trello; you can find it under “Closed boards”." : ""].filter(Boolean).join(" ")}`);
    } catch (cause) { setImportReport(`Import failed: ${String(cause)}`); }
    finally { setImportBusy(false); }
  }

  async function addMissingAttachments() {
    if (!importZip) return;
    setImportBusy(true);
    setImportReport("");
    try {
      const restored = await restoreExistingAttachments(state, importZip);
      setState(() => {
        return recordRevisions(restored.state, [...restored.changedBoards.map((id) => ({ kind: "board" as const, id })), ...restored.changedCards.map((id) => ({ kind: "card" as const, id }))], localDeviceId.current);
      });
      if (restored.restoredBackgrounds || restored.restoredStickers) setFileVersion((current) => current + 1);
      setImportReport(`Attachments restored: ${restored.restored}. Stickers: ${restored.restoredStickers}. Board backgrounds: ${restored.restoredBackgrounds}.`);
    } catch (cause) { setImportReport(`ZIP error: ${String(cause)}`); }
    finally { setImportBusy(false); }
  }

  async function copyTrelloHelper() {
    try {
      const response = await fetch("/trello-helper.js");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const code = await response.text();
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(code);
          setHelperCode("");
          setImportReport("Code copied. Open the Trello board, paste the code into the browser console and wait for the ZIP files. The first ZIP contains the board JSON.");
          return;
        } catch { /* Clipboard API may be denied on a local-network page. */ }
      }
      setHelperCode(code);
      setImportReport("Select the code below and copy it manually, then paste it into the console on the Trello board page.");
    } catch (cause) { setImportReport(`Could not copy the helper: ${String(cause)}`); }
  }

  function markSynced(deviceId: string) {
    const now = new Date().toISOString();
    setTrustedDevices((current) => { if (!current.some((item) => item.deviceId === deviceId)) return current; const next = current.map((item) => item.deviceId === deviceId ? { ...item, lastSyncAt: now } : item); saveTrustedDevices(next); return next; });
  }

  function syncSession(local?: { url: string; code: string }): LanSync {
    syncRef.current?.close();
    window.clearTimeout(reconnectTimer.current);
    reconnectTimer.current = undefined;
    lastLan.current = local ?? null;
    const pairCode = local?.code.trim().toLowerCase() ?? "";
    const session = new LanSync({
      trust: {
        self: { deviceId: localDeviceId.current, name: localAuthor },
        isTrusted: (peer) => readTrustedDevices().some((item) => item.deviceId === peer.deviceId),
        onPeer: async (peer) => {
          const accepted = confirm(`New device “${peer.name}” (${peer.deviceId.slice(0, 8)}) wants to sync. Add it to trusted devices?`);
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
        if (stateRef.current.boards.some((item) => item.backgroundImageId === id)) setFileVersion((current) => current + 1);
        setState((current) => markMediaLocal(current, id));
      },
      onStatus: setSyncStatus,
      onSent: () => { if (session.peer) markSynced(session.peer.deviceId); },
      // Offline queue: changes keep accumulating locally; when the relay connection drops, reconnect with backoff
      // and the full-state exchange on reconnect delivers everything made in the meantime.
      onClosed: () => {
        if (!local || syncRef.current !== session) return;
        const delay = reconnectDelay.current;
        reconnectDelay.current = Math.min(delay * 2, 60_000);
        setSyncStatus(`Connection lost. Changes are saved on this device; reconnecting in ${Math.round(delay / 1000)} s…`);
        reconnectTimer.current = window.setTimeout(() => { if (syncRef.current === session && navigator.onLine !== false) { try { syncSession(local); } catch (cause) { setSyncStatus(String(cause)); } } }, delay);
      },
    }, local, { internet: syncTransport === "internet" });
    syncRef.current = session;
    return session;
  }

  async function createSyncOffer() {
    try { setSyncSignal(await syncSession().createOffer()); setSyncStatus("Send the invitation to the second device and paste its response."); }
    catch (cause) { setSyncStatus(`Could not create the invitation: ${String(cause)}`); }
  }

  async function acceptSyncOffer() {
    try { setSyncResponse(await syncSession().acceptOffer(syncSignal)); setSyncStatus("Send the response to the first device."); }
    catch (cause) { setSyncStatus(`Could not accept the invitation: ${String(cause)}`); }
  }

  async function acceptSyncAnswer() {
    try { await syncRef.current?.acceptAnswer(syncResponse); setSyncStatus("Waiting for connection…"); }
    catch (cause) { setSyncStatus(`Could not accept the response: ${String(cause)}`); }
  }

  function connectLocalRoom() {
    try {
      const server = new URL(syncServerUrl);
      if (server.protocol !== "http:" && server.protocol !== "https:") throw new Error("Enter the HTTP address of the local Kanbonk server.");
      server.protocol = server.protocol === "https:" ? "wss:" : "ws:";
      syncSession({ url: server.href, code: syncRoomCode });
      setSyncStatus("Connecting to the local server…");
    } catch (cause) { setSyncStatus(`Could not connect: ${String(cause)}`); }
  }

  const team: Member[] = [{ id: localDeviceId.current, name: localAuthor || "This device" }, ...trustedDevices.map((device) => ({ id: device.deviceId, name: device.name }))];
  const cardDialog = card ? <CardDialog key={card.id} card={card} asPage={cardAsPage} onDelete={() => requestDelete("card", card.id)} authorName={localAuthor} currentDeviceId={localDeviceId.current} state={state} lists={state.lists.filter((item) => item.boardId === card.boardId && !item.archived)} onClose={() => setCardId(null)} onChange={(change) => updateCard(card.id, change)} onAttach={(files) => attachFiles(card, files)} onAddStickerImage={(file) => { void addStickerImage(card, file); }} onDownload={downloadAttachment} onNavigateCard={(target) => { if (target.boardId === inboxBoardId) showPanel("inbox"); else showBoard(target.boardId); setCardId(target.id); }} onTransfer={(targetListId, copy) => moveOrCopyCard(card.id, targetListId, copy)} onArchive={() => { if (confirm(`Archive card “${card.name}”?`)) { updateCard(card.id, (item) => ({ ...item, archived: true })); setCardId(null); } }} onHistory={() => setPanel("history")} onRunAutomation={(ruleId) => runCardButton(card.id, ruleId)} onAddDependency={(targetId) => addDependency(card.id, targetId)} onRemoveDependency={removeDependency} onConvertChecklistItem={(checklistId, itemId) => convertItem(card.id, checklistId, itemId)} team={team} onOpenDoc={() => navigate(boardHref(card.boardId, { view: "doc" }))} onClone={() => setState((current) => { const cloned = cloneCard(current, card.id); return recordRevision(cloned.state, "card", cloned.cardId, localDeviceId.current); })} onCreateSubCard={(name) => setState((current) => { const id = newId(); return recordRevision(createSubCard(current, card.id, name, id), "card", id, localDeviceId.current); })} onAddMember={(member) => { setState((current) => { let next = { ...current, boards: current.boards.map((item) => item.id === card.boardId ? { ...item, members: [...(item.members ?? []).filter((entry) => entry.id !== member.id), member] } : item), cards: current.cards.map((item) => item.id === card.id ? { ...item, memberIds: [...(item.memberIds ?? []), member.id] } : item) }; next = recordRevision(next, "board", card.boardId, localDeviceId.current); return recordRevision(next, "card", card.id, localDeviceId.current); }); }} onAddLabel={(name, color) => { const label = { id: newId(), boardId: card.boardId, name, color }; setState((current) => { const next = recordRevision({ ...current, labels: [...current.labels, label], cards: current.cards.map((item) => item.id === card.id ? { ...item, labelIds: [...item.labelIds, label.id] } : item) }, "label", label.id, localDeviceId.current); return recordRevision(next, "card", card.id, localDeviceId.current); }); }} onDeleteLabel={(id) => { setState((current) => deleteLabel(current, id, localDeviceId.current)); setBoardFilters((current) => current[card.boardId]?.labelId === id ? { ...current, [card.boardId]: { ...current[card.boardId], labelId: "" } } : current); }} onEditLabel={(id, name, color) => setState((current) => { const label = current.labels.find((item) => item.id === id && item.boardId === card.boardId && !item.deleted); if (!label || label.name === name && label.color === color) return current; return recordRevision({ ...current, labels: current.labels.map((item) => item.id === id ? { ...item, name, color } : item) }, "label", id, localDeviceId.current); })} /> : null;
  const matchingWorkspaces = search.trim() ? state.workspaces.filter((item) => item.id !== inboxWorkspaceId && item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).slice(0, 10) : [];
  const lastSyncAt = trustedDevices.reduce((latest, item) => item.lastSyncAt && item.lastSyncAt > latest ? item.lastSyncAt : latest, "");
  // Offline queue size: local revisions newer than the last exchange with any trusted device.
  const pendingChanges = useMemo(() => trustedDevices.length ? fullState.revisions.filter((item) => item.deviceId === localDeviceId.current && item.createdAt > lastSyncAt).length : 0, [fullState.revisions, trustedDevices.length, lastSyncAt]);
  const syncBadge = !trustedDevices.length ? "Local" : !online ? `Offline${pendingChanges ? ` · ${pendingChanges} queued` : ""}` : pendingChanges ? `Unsent: ${pendingChanges}` : "Synced";
  const trashCount = useMemo(() => [fullState.workspaces, fullState.boards, fullState.lists, fullState.cards].reduce((sum, items) => sum + items.filter((item) => item.deletedAt).length, 0), [fullState]);

  if (!ready) return <main className="startup">{error || "Loading local data…"}</main>;
  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href={linkHref("/")} onClick={(event) => { event.preventDefault(); navigate("/"); }}><img className="brand-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /><strong>Kanbonk</strong></a>
      <select className="mobile-board-picker" aria-label="Choose board" value={shownPanels.includes("inbox") ? inboxBoardId : shownPanels.includes("planner") ? plannerViewId : boardId ?? ""} onChange={(event) => { const value = event.target.value; if (value === inboxBoardId) showPanel("inbox"); else if (value === plannerViewId) showPanel("planner"); else { setActivePanel(null); setBoardId(value || null); } setCardId(null); }}><option value="">Boards</option><option value={inboxBoardId}>Inbox</option><option value={plannerViewId}>Planner</option>{state.boards.filter((item) => item.id !== inboxBoardId && !item.archived).map((item) => <option key={item.id} value={item.id}>{state.workspaces.find((workspace) => workspace.id === item.workspaceId)?.name} / {item.name}</option>)}</select>
      <button className="topbar-create" onClick={() => openCreation("board")}>Create</button>
      <button onClick={() => { setNow(Date.now()); setRemindersOpen(true); }} aria-label={`Reminders: ${reminders.length}`}>Reminders{reminders.length ? ` (${reminders.length})` : ""}</button>
      <details className="topbar-more" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
        <summary aria-label="App menu" title="App menu">⋯</summary>
        <div className="topbar-more-menu" onClick={(event) => { if ((event.target as HTMLElement).closest("button")) (event.currentTarget.parentElement as HTMLDetailsElement).open = false; }}>
          <button onClick={openImport}>Import from Trello</button>
          <button onClick={() => { setBackupReport(""); setBackupOpen(true); void refreshBackupInfo(); }}>Backup</button>
          <button onClick={() => setSyncOpen(true)}>Sync</button>
          <button onClick={() => setAiOpen(true)}>AI assistant</button>
          <button onClick={() => setDedupeOpen(true)}>Duplicates across boards</button>
          <button onClick={() => navigate(trashHref())}>Trash</button>
          <button onClick={() => { setAuthorDraft(localAuthor); setAuthorDialogOpen(true); }}>My name</button>
          {closedBoards.length > 0 && <button onClick={() => setClosedBoardsOpen(true)}>Closed boards ({closedBoards.length})</button>}
        </div>
      </details>
      <label className="global-search"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" aria-label="Search cards" onKeyDown={(event) => { if (event.key === "Escape") setSearch(""); }} /></label>
      <a className={`topbar-trash ${page.page === "trash" ? "active" : ""}`} href={linkHref(trashHref())} onClick={(event) => { event.preventDefault(); navigate(trashHref()); }} aria-label={`Trash: ${trashCount}`}>🗑 Trash{trashCount ? ` (${trashCount})` : ""}</a>
      <button className={`local-badge ${pendingChanges ? "pending" : ""} ${online ? "" : "offline"}`} onClick={() => setSyncOpen(true)} title="Sync with trusted devices">{syncBadge}</button>
    </header>
    {search.trim() && <section className="search-results" aria-label="Search results"><strong>Search results</strong>{matchingWorkspaces.map((item) => <button key={item.id} onClick={() => { navigate(`/w/${item.id}`); setSearch(""); }}><small>Workspace</small>{item.name}</button>)}{matchingBoards.map((item) => <button key={item.id} onClick={() => { showBoard(item.id); setCardId(null); setSearch(""); }}><small>Board</small>{item.name}</button>)}{matchingCards.map((item) => <button key={item.id} onClick={() => { if (item.boardId === inboxBoardId) showPanel("inbox"); else showBoard(item.boardId); setCardId(item.id); setSearch(""); }}><small>{state.boards.find((board) => board.id === item.boardId)?.name}</small>{item.name}</button>)}{!matchingWorkspaces.length && !matchingBoards.length && !matchingCards.length && <p>Nothing found</p>}</section>}
    {notice && <div className="notice-banner" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message"><Icon name="close" /></button></div>}
    {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss message"><Icon name="close" /></button></div>}
    <div className={shownPanels.length ? "workspace-layout panel-open" : "workspace-layout"}><aside className="sidebar"><button className={shownPanels.includes("inbox") ? "sidebar-link active" : "sidebar-link"} onClick={() => togglePanel("inbox")}>☰ <span>Inbox</span></button><button className={shownPanels.includes("planner") ? "sidebar-link active" : "sidebar-link"} onClick={() => togglePanel("planner")}>▦ <span>Planner</span></button><button className={page.page === "home" ? "sidebar-link active" : "sidebar-link"} onClick={() => navigate("/")}>▦ <span>Workspaces</span></button><button className={page.page === "trash" ? "sidebar-link active" : "sidebar-link"} onClick={() => navigate(trashHref())}>🗑 <span>Trash</span></button><div className="sidebar-heading">Workspaces<button onClick={() => openCreation("workspace")} aria-label="Create workspace"><Icon name="plus" /></button></div>{state.workspaces.filter((item) => item.id !== inboxWorkspaceId && !item.archived).map((workspace) => <div className="workspace-group" key={workspace.id}><div className="workspace-name"><span className="workspace-avatar">{workspace.name.slice(0, 1).toUpperCase()}</span><button className={`workspace-link ${page.page === "workspace" && page.id === workspace.id ? "selected" : ""}`} onClick={() => navigate(`/w/${workspace.id}`)}>{workspace.name}</button><button onClick={() => openCreation("board", workspace.id)} aria-label={`Add board to ${workspace.name}`}><Icon name="plus" /></button></div>{state.boards.filter((item) => item.workspaceId === workspace.id && item.id !== inboxBoardId && !item.archived).map((item) => <button key={item.id} className={`board-link ${item.id === boardId ? "selected" : ""}`} onClick={() => { showBoard(item.id); setCardId(null); }}><span className="board-mini" style={{ background: item.background }} />{item.name}{item.starred && <Icon name="star" />}</button>)}</div>)}</aside>
      {shownPanels.map((name) => <div className="panel-slot" key={name}><aside className={name === "planner" ? "aux-panel planner-panel" : "aux-panel inbox-panel"} style={{ width: Math.min(panelWidths[name], panelWidthLimit) }}>{name === "inbox" ? <InboxView state={state} onCreate={createInboxCard} onOpen={setCardId} onOpenArchive={() => openArchive(inboxBoardId)} /> : <PlannerView state={state} onOpen={(item) => { if (item.boardId === inboxBoardId) showPanel("inbox"); else showBoard(item.boardId); setCardId(item.id); }} />}</aside><div className="panel-resizer" role="separator" tabIndex={0} aria-label={`Resize panel ${name === "inbox" ? "Inbox" : "Planner"}`} aria-orientation="vertical" aria-valuemin={220} aria-valuemax={panelWidthLimit} aria-valuenow={Math.min(panelWidths[name], panelWidthLimit)} onPointerDown={(event) => resizePanelStart(event, name)} onKeyDown={(event) => resizePanelKey(event, name)} /></div>)}
      <main className="main-area" style={{ backgroundColor: board?.background ?? "#f7f8f9", backgroundImage: backgroundImage && board?.backgroundImageId === backgroundImage.id ? `url("${backgroundImage.url}")` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>{board ? <><div className="board-toolbar">
        <NameEditor key={board.id} className="board-title" label="Board title" value={board.name} onCommit={(name) => updateBoard((item) => ({ ...item, name }))} />
        <button className={`toolbar-button ${board.starred ? "is-starred" : ""}`} onClick={() => updateBoard((item) => ({ ...item, starred: !item.starred }))} aria-label={board.starred ? "Remove from favorites" : "Add to favorites"}><Icon name="star" /></button>
        <button className="toolbar-button" onClick={openBoardAbout} aria-label="Board description"><Icon name="info" /> Description</button>
        <div className="segmented view-switch" role="tablist" aria-label="Board view"><button role="tab" aria-selected={page.page === "board" && page.view === "lists"} onClick={() => navigate(boardHref(board.id))}>Lists</button><button role="tab" aria-selected={page.page === "board" && page.view === "calendar"} onClick={() => navigate(boardHref(board.id, { view: "calendar", scale: page.page === "board" ? page.scale : "month" }))}>Calendar</button><button role="tab" aria-selected={page.page === "board" && page.view === "doc"} onClick={() => navigate(boardHref(board.id, { view: "doc" }))}>Doc</button></div>
        <span className="toolbar-spacer" />
        <input type="search" className="board-search" value={boardFilter.keyword} onChange={(event) => updateFilter({ keyword: event.target.value })} placeholder="Search this board" aria-label="Search cards on this board" />
        <button className="toolbar-button" aria-expanded={filterOpen} aria-label={filterCount ? `Board filter, active: ${filterCount}` : "Board filter"} onClick={() => setFilterOpen((current) => !current)}><Icon name="search" /> Filter{filterCount ? ` (${filterCount})` : ""}</button>
        <details className="board-more" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
          <summary className="toolbar-button" aria-label="Board menu" title="Board menu">⋯</summary>
          <div className="board-more-menu" onClick={(event) => { if ((event.target as HTMLElement).closest("button")) (event.currentTarget.parentElement as HTMLDetailsElement).open = false; }}>
            <button onClick={() => openArchive(board.id)}>Archive</button>
            <button onClick={closeBoard}>Close board</button>
            <button onClick={() => setBoardCopy({ name: `${board.name} (copy)`, workspaceId: board.workspaceId, keepCards: true, keepTemplates: true })}>Copy board</button>
            <button onClick={() => setAutomationBoardId(board.id)}>Automation</button>
            <button onClick={() => setActivityBoardId(board.id)}>Activity</button>
            <button onClick={() => setPanel("history")}>History</button>
            <button onClick={() => exportBoard("trello-json")} title="Trello JSON export format, without attachment files">Export JSON (Trello)</button>
            <button onClick={() => exportBoard("csv")} title="Trello CSV export columns">Export CSV (Trello)</button>
            <button onClick={() => requestDelete("board", board.id)}>Move board to trash</button>
            <label className="background-upload">Background from file<input type="file" accept="image/*" onChange={(event) => { void uploadBoardBackground(event.target.files?.[0] ?? null); event.target.value = ""; }} /></label>
            <label className="board-color-option">Background color<ColorInput value={/^#[\da-f]{6}$/i.test(board.background) ? board.background : "#0c66e4"} presets={boardColors} label="Board background color" onCommit={(background) => updateBoard((item) => ({ ...item, background, backgroundImageId: undefined }))} /></label>
          </div>
        </details>
      </div>
      {filterOpen && <section className="board-filter" aria-label="Board filter"><div className="section-title"><strong>Board filter</strong><button onClick={() => setFilterOpen(false)} aria-label="Close filter"><Icon name="close" /></button></div><label>Text<input type="search" value={boardFilter.keyword} onChange={(event) => updateFilter({ keyword: event.target.value })} placeholder="Title or content" /></label><label>Label<select value={boardFilter.labelId} onChange={(event) => updateFilter({ labelId: event.target.value })}><option value="">All labels</option>{state.labels.filter((item) => item.boardId === board.id && !item.deleted).map((item) => <option key={item.id} value={item.id}>{item.name || item.color}</option>)}</select></label><label>Member<select value={boardFilter.memberId ?? ""} onChange={(event) => updateFilter({ memberId: event.target.value })}><option value="">All members</option>{(board.members ?? []).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label>Status<select value={boardFilter.status} onChange={(event) => updateFilter({ status: event.target.value as BoardFilter["status"] })}><option value="all">All cards</option><option value="complete">Completed</option><option value="incomplete">Not completed</option></select></label><label>Due date<select value={boardFilter.due} onChange={(event) => updateFilter({ due: event.target.value as BoardFilter["due"] })}><option value="any">Any due date</option><option value="overdue">Overdue</option><option value="next-week">Next 7 days</option><option value="none">No due date</option></select></label><div className="filter-footer"><span>Showing {filteredCardIds.size} of {boardCardCount}</span><button onClick={() => updateFilter(emptyBoardFilter())}>Reset</button></div></section>}
      {page.page === "board" && page.view === "doc" ? <DocView state={state} board={board} onChange={(doc) => updateBoard((item) => ({ ...item, doc }))} onOpenCard={(item) => setCardId(item.id)} assistant={<AiPanel state={state} board={board} settings={aiSettings} onOpenSettings={() => setAiOpen(true)} onCreateCards={createProposedCards} onDocChange={(doc) => updateBoard((item) => ({ ...item, doc }))} onOpenCard={(item) => setCardId(item.id)} />} /> : page.page === "board" && page.view === "calendar" ? <BoardCalendar state={state} cards={state.cards.filter((item) => filteredCardIds.has(item.id))} scale={page.scale} date={page.date} onNavigate={(scale: CalendarScale, date?: string) => navigate(boardHref(board.id, { view: "calendar", scale, date }), { replace: true })} onOpen={(item) => setCardId(item.id)} onReschedule={(item, dates) => updateCard(item.id, (current) => ({ ...current, startAt: dates.startAt, dueAt: dates.dueAt, dueReminderMinutes: dates.dueAt ? current.dueReminderMinutes : undefined, dueRepeat: dates.dueAt ? current.dueRepeat : undefined }))} onDelete={(item) => requestDelete("card", item.id)} /> : <div className="board-canvas">{zoneRuns(lists, board.zones).map((run) => run.zone ? <ZoneFrame key={`zone-${run.zone.id}-${run.lists[0].id}`} zone={run.zone} cardCount={state.cards.filter((item) => run.lists.some((entry) => entry.id === item.listId) && filteredCardIds.has(item.id)).length} onRename={(name) => changeZone(run.zone!.id, { name })} onColor={(color) => changeZone(run.zone!.id, { color })} onDelete={() => removeZone(run.zone!)} onDropList={(listId) => setListZone(listId, run.zone!.id)}>{run.lists.map(renderList)}</ZoneFrame> : run.lists.map(renderList))}<div className="add-list-column">{editingList ? <div className="compose"><input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createList(); }} placeholder="List title" /><div><button className="primary-button" onClick={createList}>Add a list</button><button className="plain-icon" onClick={() => { setEditingList(false); setDraft(""); }} aria-label="Cancel"><Icon name="close" /></button></div></div> : <button onClick={() => { setEditingList(true); setEditingCardList(null); setDraft(""); }}><Icon name="plus" /> Add a list</button>}</div></div>}</> : page.page === "board" ? <MissingPage what="Board not found" /> : page.page === "workspace" ? <WorkspacePage state={state} workspaceId={page.id} onOpenBoard={(id) => setBoardId(id)} onCreateBoard={() => openCreation("board", page.id)} onRename={(name) => setState((current) => recordRevision({ ...current, workspaces: current.workspaces.map((item) => item.id === page.id ? { ...item, name } : item) }, "workspace", page.id, localDeviceId.current))} onDelete={() => requestDelete("workspace", page.id)} /> : page.page === "trash" ? <TrashPage state={fullState} kind={page.kind} onKind={(kind) => navigate(trashHref(kind), { replace: true })} onRestore={restoreTrashed} onPurge={purgeTrashed} onEmpty={emptyAllTrash} /> : page.page === "card" ? cardDialog ?? <MissingPage what="Card not found" /> : page.page === "not-found" ? <MissingPage what="Page not found" /> : <HomePage state={state} onOpen={(id) => navigate(`/w/${id}`)} onCreate={() => openCreation("workspace")} />}</main>
    </div>
    {card && !cardAsPage && cardDialog}
    {pendingDelete && <DeleteDialog kind={pendingDelete.kind} name={pendingDelete.name} impact={pendingDelete.impact} onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />}
    {dedupeOpen && <DedupeDialog state={state} ignored={dedupeIgnored} onClose={() => setDedupeOpen(false)} onOpen={(item) => { setDedupeOpen(false); setCardId(item.id); }} onIgnore={(pair) => setDedupeIgnored((current) => { const next = new Set(current); next.add(pairKey(pair.a.id, pair.b.id)); localStorage.setItem("kanbonk-dedupe-ignored", JSON.stringify([...next])); return next; })} onMerge={(keepId, dropId) => { setState((current) => mergeDuplicate(current, keepId, dropId, localDeviceId.current)); setNotice("Cards merged; the duplicate was moved to trash."); }} />}
    {boardAboutOpen && board && <div className="dialog-backdrop" onMouseDown={() => setBoardAboutOpen(false)}><section className="side-panel board-about" role="dialog" aria-modal="true" aria-label="Board description" onMouseDown={(event) => event.stopPropagation()}><header><h2>About this board</h2><button onClick={() => setBoardAboutOpen(false)} aria-label="Close board description"><Icon name="close" /></button></header><p>{board.name}</p><label>Description<textarea value={boardDescriptionDraft} onChange={(event) => setBoardDescriptionDraft(event.target.value)} placeholder="Add a board description…" /></label><div className="panel-actions"><button onClick={() => setBoardAboutOpen(false)}>Cancel</button><button className="primary-button" onClick={saveBoardDescription} disabled={boardDescriptionDraft === board.description}>Save</button></div></section></div>}    {closedBoardsOpen && <div className="dialog-backdrop" onMouseDown={() => setClosedBoardsOpen(false)}><section className="side-panel" role="dialog" aria-modal="true" aria-label="Closed boards" onMouseDown={(event) => event.stopPropagation()}><header><h2>Closed boards</h2><button onClick={() => setClosedBoardsOpen(false)} aria-label="Close"><Icon name="close" /></button></header>{closedBoards.length ? closedBoards.map((item) => <div className="panel-row" key={item.id}><span><strong>{item.name}</strong><small>{state.workspaces.find((workspace) => workspace.id === item.workspaceId)?.name}</small></span><button onClick={() => restoreClosedBoard(item.id)}>Restore</button></div>) : <p>No closed boards.</p>}</section></div>}
    {activityBoardId && <BoardActivity state={state} boardId={activityBoardId} onClose={() => setActivityBoardId(null)} onOpenCard={(item) => { setBoardId(item.boardId); setCardId(item.id); }} />}
    {remindersOpen && <div className="dialog-backdrop" onMouseDown={() => setRemindersOpen(false)}><section className="side-panel" role="dialog" aria-modal="true" aria-label="Reminders" onMouseDown={(event) => event.stopPropagation()}><header><h2>Reminders</h2><button onClick={() => setRemindersOpen(false)} aria-label="Close reminders"><Icon name="close" /></button></header>{reminders.length ? reminders.map((item) => <div className="panel-row reminder-row" key={item.id}><button onClick={() => { if (item.boardId === inboxBoardId) showPanel("inbox"); else showBoard(item.boardId); setCardId(item.id); setRemindersOpen(false); }}>{item.name}<small>{new Date(item.dueAt!).toLocaleString("en-US")}</small></button><button onClick={() => setDismissedReminders((current) => ({ ...current, [item.id]: reminderSignature(item) }))} aria-label={`Dismiss reminder ${item.name}`}>Dismiss</button></div>) : <p>No new reminders.</p>}</section></div>}
    {automationBoardId && state.boards.some((item) => item.id === automationBoardId && !item.archived) && <AutomationPanel key={automationBoardId} board={state.boards.find((item) => item.id === automationBoardId)!} state={state} onClose={() => setAutomationBoardId(null)} onAdd={(listId, action, labelId, trigger, name, leadMinutes) => addAutomationRule(automationBoardId, listId, action, labelId, trigger, name, leadMinutes)} onRemove={(ruleId) => removeAutomationRule(automationBoardId, ruleId)} />}
    {panel && <div className="dialog-backdrop" onMouseDown={() => setPanel(null)}><section className="side-panel" role="dialog" aria-modal="true" aria-label={panel === "archive" ? "Archive" : "Version history"} onMouseDown={(event) => event.stopPropagation()}><header><h2>{panel === "archive" ? "Archive" : "Version history"}</h2><button onClick={() => setPanel(null)} aria-label="Close"><Icon name="close" /></button></header>{panel === "archive" ? <>{state.cards.filter((item) => item.boardId === (archiveBoardId ?? boardId) && item.archived).map((item) => <div className="panel-row" key={item.id}>{item.name}<button onClick={() => updateCard(item.id, (current) => ({ ...current, archived: false }))}>Restore</button></div>)}{state.lists.filter((item) => item.boardId === (archiveBoardId ?? boardId) && item.archived).map((item) => <div className="panel-row" key={item.id}>{item.name}<button onClick={() => updateList(item.id, (current) => ({ ...current, archived: false }))}>Restore</button></div>)}</> : <><p>The last 30 versions of each item are kept.</p>{state.revisions.filter((item) => item.entityId === (card?.id ?? boardId)).slice().reverse().map((revision) => <div className="panel-row" key={revision.id}><span><strong>{revision.snapshot.name}</strong><small>{new Date(revision.createdAt).toLocaleString()}</small></span><button onClick={() => restore(revision)}>Restore</button></div>)}</>}</section></div>}
    {aiOpen && <AiSettingsDialog settings={aiSettings} onClose={() => setAiOpen(false)} onSave={(next) => { saveAiSettings(next); setAiSettings(next); setAiOpen(false); }} />}
    {syncOpen && <div className="dialog-backdrop" onMouseDown={() => setSyncOpen(false)}><section className="creation-dialog sync-dialog" role="dialog" aria-modal="true" aria-label="Device sync" onMouseDown={(event) => event.stopPropagation()}><h2>Device sync</h2>
      <label>Sync method<select value={syncTransport} onChange={(event) => { const value = event.target.value as SyncTransport; setSyncTransport(value); localStorage.setItem("kanbonk-sync-transport", value); }}><option value="wifi">Wi-Fi / local network</option><option value="internet">Internet: direct P2P connection (WebRTC)</option><option value="file">File: Bluetooth / USB / messenger</option></select></label>
      <p className="hint">Tabs and windows in this browser sync automatically. For the desktop app and a browser on the same computer, run <code>pnpm serve:lan</code> and connect to <button className="link-button" onClick={() => setSyncServerUrl("http://127.0.0.1:4173")}>http://127.0.0.1:4173</button>.</p>
      {trustedDevices.length > 0 && <section className="trusted-devices"><h3>Trusted devices</h3>{trustedDevices.map((device) => <div className="panel-row" key={device.deviceId}><span><strong>{device.name}</strong><small>{device.deviceId.slice(0, 8)} · added {new Date(device.pairedAt).toLocaleDateString("en-US")}{device.lastSyncAt ? ` · synced ${new Date(device.lastSyncAt).toLocaleString("en-US")}` : ""}</small></span><span className="row-actions">{syncTransport === "wifi" && <button onClick={() => setSyncRoomCode(device.code)}>Pairing code</button>}{syncTransport === "file" && <button onClick={() => void shareSyncBundle(device.code)}>Send package</button>}<button onClick={() => { if (confirm(`Remove “${device.name}” from trusted devices?`)) setTrustedDevices((current) => { const next = current.filter((item) => item.deviceId !== device.deviceId); saveTrustedDevices(next); return next; }); }}>Delete</button></span></div>)}</section>}
      {syncTransport === "file" && <section className="local-sync"><h3>Sync package</h3><p>An encrypted file with your data and attachments. Send it via Bluetooth (the Share menu on your phone), USB or a messenger; only a device that knows the pairing code can open it.</p><label>Pairing code (for a new device)<input value={bundleCode} onChange={(event) => setBundleCode(event.target.value)} spellCheck={false} autoComplete="off" /></label><div><button onClick={() => setBundleCode(newRoomCode())}>Create code</button><button className="primary-button" disabled={!/^[a-f0-9]{32}$/.test(bundleCode.trim().toLowerCase())} onClick={() => void shareSyncBundle(bundleCode.trim().toLowerCase())}>Send package with code</button></div><label>Open received package<input type="file" accept=".kanbonk-sync,application/octet-stream" onChange={(event) => { void openBundle(event.target.files?.[0] ?? null); event.target.value = ""; }} /></label></section>}
      {syncTransport === "wifi" && <LocalRoomControls serverUrl={syncServerUrl} roomCode={syncRoomCode} onServerChange={setSyncServerUrl} onCodeChange={setSyncRoomCode} onConnect={connectLocalRoom} />}{syncTransport !== "file" && <><p>{syncTransport === "internet" ? "Direct connection over the internet: devices exchange an invitation and a response through any channel (messenger, email). Data flows directly and is encrypted (DTLS); the public STUN server only sees network addresses, not data. Only someone you sent the invitation to can connect, and only after you confirm trust." : "If both browsers support WebRTC, you can connect directly over the local network. Exchange an invitation and a response."}</p><button className="primary-button" onClick={createSyncOffer}>Create invitation</button><label>Invitation: send it to the second device or paste the one you received<textarea value={syncSignal} onChange={(event) => setSyncSignal(event.target.value)} /></label><button onClick={acceptSyncOffer} disabled={!syncSignal}>Accept invitation</button><label>Response: send it to the first device or paste the one you received<textarea value={syncResponse} onChange={(event) => setSyncResponse(event.target.value)} /></label><button onClick={acceptSyncAnswer} disabled={!syncResponse}>Connect with response</button></>}<button onClick={() => { try { syncRef.current?.syncNow(); } catch (cause) { setSyncStatus(String(cause)); } }}>Sync now</button>{syncStatus && <p className="import-report" role="status">{syncStatus}</p>}{syncConflicts.map((conflict) => <div className="sync-conflict" key={`${conflict.kind}-${conflict.id}`}><strong>Conflict: {conflict.local.name}</strong><small>Choose a version of this item.</small><div><button onClick={() => { setState((current) => chooseConflict(current, conflict, "local", localDeviceId.current)); setSyncConflicts((current) => current.filter((item) => item !== conflict)); setSyncStatus("Version chosen. Syncing…"); }}>My version</button><button onClick={() => { setState((current) => chooseConflict(current, conflict, "remote", localDeviceId.current)); setSyncConflicts((current) => current.filter((item) => item !== conflict)); setSyncStatus("Version chosen. Syncing…"); }}>Other device's version</button></div></div>)}<div><button onClick={() => setSyncOpen(false)}>Close</button></div></section></div>}
    {backupOpen && <div className="dialog-backdrop" onMouseDown={() => { if (!backupBusy) setBackupOpen(false); }}><section className="creation-dialog import-dialog" role="dialog" aria-modal="true" aria-label="Backup" onMouseDown={(event) => event.stopPropagation()}><h2>Backup</h2><p>Save all boards and available local files to ZIP. To restore, select all parts of one backup at once. Existing data is kept; conflicting changes will ask you to choose a version.</p><button className="primary-button" onClick={exportBackup} disabled={backupBusy}>{backupBusy ? "Please wait…" : "Download backup"}</button><label>Backup ZIP parts<input type="file" accept=".zip,application/zip" multiple onChange={(event) => setBackupFiles(Array.from(event.target.files ?? []))} /></label><button onClick={importBackup} disabled={backupBusy || !backupFiles.length}>Restore from ZIP</button>
      <section className="auto-backups"><h3>Automatic backups</h3><p>Every 10 minutes, if anything changed, a snapshot of all data is saved (the last 20, plus one per day for 30 days).{folderBackupSupported() ? " In addition, once a day a full ZIP backup with files is written to the chosen folder." : ""}</p>
        {folderBackupSupported() && <div className="row-actions">{folderName ? <><span>Folder: <strong>{folderName}</strong></span><button onClick={() => void writeFolderBackup(stateRef.current, true).then((result) => setFolderStatus(`Written: ${result}`)).catch((cause) => setFolderStatus(String(cause instanceof Error ? cause.message : cause)))}>Write now</button><button onClick={() => void forgetBackupFolder().then(refreshBackupInfo)}>Turn off</button></> : <button onClick={() => void chooseBackupFolder().then((name) => { setFolderName(name); return writeFolderBackup(stateRef.current, true); }).then((result) => setFolderStatus(`Written: ${result}`)).catch((cause) => setFolderStatus(String(cause instanceof Error ? cause.message : cause)))}>Choose folder for daily backups</button>}</div>}
        {folderStatus && <p className="import-report" role="status">{folderStatus}</p>}
        <button onClick={() => void autoSnapshot(stateRef.current).then(refreshBackupInfo)}>Create snapshot now</button>
        {snapshots.length ? <div className="snapshot-list">{snapshots.map((meta) => <div className="panel-row" key={meta.id}><span><strong>{new Date(meta.createdAt).toLocaleString("en-US")}</strong><small>boards: {meta.boards}, cards: {meta.cards}, {Math.round(meta.size / 1024)} KB</small></span><button onClick={() => void restoreSnapshot(meta)}>Restore</button></div>)}</div> : <p>No snapshots yet.</p>}
      </section>{backupReport && <p className="import-report" role="status">{backupReport}</p>}{backupConflicts.map((conflict) => <div className="sync-conflict" key={`${conflict.kind}-${conflict.id}`}><strong>Conflict: {conflict.local.name}</strong><small>Choose a version of this item.</small><div><button onClick={() => { setState((current) => chooseConflict(current, conflict, "local", localDeviceId.current)); setBackupConflicts((current) => current.filter((item) => item !== conflict)); }}>Current version</button><button onClick={() => { setState((current) => chooseConflict(current, conflict, "remote", localDeviceId.current)); setBackupConflicts((current) => current.filter((item) => item !== conflict)); }}>Backup version</button></div></div>)}<div><button onClick={() => setBackupOpen(false)} disabled={backupBusy}>Close</button></div></section></div>}
    {authorDialogOpen && <div className="dialog-backdrop" onMouseDown={() => setAuthorDialogOpen(false)}><form className="creation-dialog" role="dialog" aria-modal="true" aria-label="My name" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); setLocalAuthor(saveLocalAuthor(authorDraft)); setAuthorDialogOpen(false); }}><h2>My name</h2><p>Your name is stored only on this device and shown on new comments.</p><label>Name<input autoFocus value={authorDraft} onChange={(event) => setAuthorDraft(event.target.value)} maxLength={60} required /></label><div><button type="button" onClick={() => setAuthorDialogOpen(false)}>Cancel</button><button className="primary-button" disabled={!authorDraft.trim()}>Save</button></div></form></div>}
    {importing && <div className="dialog-backdrop" onMouseDown={() => setImporting(false)}><section className="creation-dialog import-dialog" role="dialog" aria-modal="true" aria-label="Import from Trello" onMouseDown={(event) => event.stopPropagation()}><h2>Import from Trello</h2><p>Choose the board JSON. If the Kanbonk Trello Import extension is installed in Chrome and a Trello tab is open in the same profile, attachments and the full comment history download directly when Kanbonk is opened via localhost. The extension is in the project's trello-bridge folder; load it via chrome://extensions as an unpacked extension.</p><p>You can also choose a ZIP with attachments. To get it from a signed-in Trello, copy the helper and run it in the browser console on the board page.</p><button onClick={copyTrelloHelper}>Copy Trello helper</button><label>Board JSON or CSV<input type="file" accept=".json,application/json,.csv,text/csv" onChange={(event) => setImportJson(event.target.files?.[0] ?? null)} /></label><label>ZIP with attachments<input type="file" accept=".zip,application/zip" onChange={(event) => setImportZip(event.target.files?.[0] ?? null)} /></label>{importReport && <p className="import-report" role="status">{importReport}</p>}{helperCode && <textarea className="helper-code" aria-label="Trello helper code" readOnly value={helperCode} onFocus={(event) => event.target.select()} />}<div><button onClick={() => setImporting(false)}>Close</button><button onClick={addMissingAttachments} disabled={importBusy || !importZip}>Load attachments from ZIP</button><button className="primary-button" onClick={importBoard} disabled={importBusy || (!importJson && !importZip)}>{importBusy ? "Importing…" : "Import"}</button></div></section></div>}
    {boardCopy && <div className="dialog-backdrop" onMouseDown={() => setBoardCopy(null)}><form className="creation-dialog board-copy-dialog" role="dialog" aria-modal="true" aria-label="Copy board" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); submitBoardCopy(); }}><h2>Copy board</h2><label>Title<input autoFocus value={boardCopy.name} onChange={(event) => setBoardCopy({ ...boardCopy, name: event.target.value })} required maxLength={120} /></label><label>Workspace<select value={boardCopy.workspaceId} onChange={(event) => setBoardCopy({ ...boardCopy, workspaceId: event.target.value })}>{state.workspaces.filter((item) => item.id !== inboxWorkspaceId && !item.archived).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="copy-option"><input type="checkbox" checked={boardCopy.keepCards} onChange={(event) => setBoardCopy({ ...boardCopy, keepCards: event.target.checked })} />Keep cards</label><label className="copy-option"><input type="checkbox" checked={boardCopy.keepTemplates} onChange={(event) => setBoardCopy({ ...boardCopy, keepTemplates: event.target.checked })} />Keep card templates</label><p>Comments, members and archived cards are not copied.</p><div><button type="button" onClick={() => setBoardCopy(null)}>Cancel</button><button className="primary-button" type="submit">Create copy</button></div></form></div>}    {creation && <div className="dialog-backdrop" onMouseDown={() => setCreation(null)}><form className="creation-dialog" role="dialog" aria-modal="true" aria-label={creation.kind === "board" ? "Create board" : "Create workspace"} onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); submitCreation(); }}><h2>{creation.kind === "board" ? "Create board" : "Create workspace"}</h2><label>Title<input autoFocus value={creationName} onChange={(event) => setCreationName(event.target.value)} required maxLength={120} /></label><div><button type="button" onClick={() => setCreation(null)}>Cancel</button><button className="primary-button" type="submit">Create</button></div></form></div>}
  </div>;
}

function BoardActivity({ state, boardId, onClose, onOpenCard }: { state: AppState; boardId: string; onClose: () => void; onOpenCard: (card: Card) => void }) {
  const [filter, setFilter] = useState<"all" | "comment">("all");
  const [limit, setLimit] = useState(50);
  const entries = (state.activity ?? []).filter((item) => (item.boardId === boardId || item.previousBoardId === boardId) && (filter === "all" || item.category === "comment")).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  return <div className="dialog-backdrop" onMouseDown={onClose}><section className="side-panel" role="dialog" aria-modal="true" aria-label="Board activity" onMouseDown={(event) => event.stopPropagation()}><header><h2>Activity</h2><button onClick={onClose} aria-label="Close"><Icon name="close" /></button></header><div className="activity-filters"><button aria-pressed={filter === "all"} onClick={() => { setFilter("all"); setLimit(50); }}>All</button><button aria-pressed={filter === "comment"} onClick={() => { setFilter("comment"); setLimit(50); }}>Comments</button></div>{entries.length ? entries.slice(0, limit).map((item) => { const card = item.entityKind === "card" ? state.cards.find((entry) => entry.id === item.entityId) : undefined; return <div className="panel-row activity-row" key={item.id}><span><strong>{item.summary}</strong><small>{new Date(item.createdAt).toLocaleString("en-US")}</small></span>{card && <button onClick={() => { onOpenCard(card); onClose(); }}>Open</button>}</div>; }) : <p>No activity yet.</p>}{entries.length > limit && <button className="activity-more" onClick={() => setLimit((value) => value + 50)}>Show more</button>}</section></div>;
}

function AutomationPanel({ board, state, onClose, onAdd, onRemove }: { board: Board; state: AppState; onClose: () => void; onAdd: (listId: string, action: AutomationRule["action"], labelId: string, trigger: "move" | "button" | "due", name: string, leadMinutes: number) => void; onRemove: (ruleId: string) => void }) {
  const lists = state.lists.filter((item) => item.boardId === board.id && !item.archived);
  const labels = state.labels.filter((item) => item.boardId === board.id && !item.deleted);
  const [trigger, setTrigger] = useState<"move" | "button" | "due">("move");
  const [name, setName] = useState("");
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [action, setAction] = useState<AutomationRule["action"]>("complete");
  const [labelId, setLabelId] = useState(labels[0]?.id ?? "");
  const [leadMinutes, setLeadMinutes] = useState(0);
  const actionText = (rule: AutomationRule) => rule.action === "complete" ? "mark complete" : rule.action === "archive" ? "archive" : `add label “${labels.find((item) => item.id === rule.labelId)?.name ?? "unavailable"}”`;
  return <div className="dialog-backdrop" onMouseDown={onClose}>
    <section className="side-panel automation-panel" role="dialog" aria-modal="true" aria-label="Board automation" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2>Automation</h2><button onClick={onClose} aria-label="Close automation"><Icon name="close" /></button></header>
      <p>Rules run when a card is moved to a list, when a due date arrives, or when a card button is pressed. Due dates are checked while the app is open and on the next launch.</p>
      <form onSubmit={(event) => { event.preventDefault(); onAdd(listId, action, labelId, trigger, name, leadMinutes); if (trigger === "button") setName(""); }}>
        <label>Type<select value={trigger} onChange={(event) => setTrigger(event.target.value as "move" | "button" | "due")}><option value="move">Moved to list</option><option value="due">Due date arrives</option><option value="button">Card button</option></select></label>
        {trigger === "move" ? <label>List<select value={listId} onChange={(event) => setListId(event.target.value)}>{lists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : trigger === "button" ? <label>Button name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="For example, Finish" /></label> : null}
        {trigger === "due" && <label>When<select value={leadMinutes} onChange={(event) => setLeadMinutes(Number(event.target.value))}><option value={0}>At due time</option><option value={60}>1 hour before</option><option value={1440}>1 day before</option><option value={10080}>1 week before</option></select></label>}
        <label>Action<select value={action} onChange={(event) => setAction(event.target.value as AutomationRule["action"])}><option value="complete">Mark complete</option><option value="archive">Archive</option><option value="add-label">Add label</option></select></label>
        {action === "add-label" && <label>Label<select value={labelId} onChange={(event) => setLabelId(event.target.value)}>{labels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <button className="primary-button" type="submit" disabled={trigger === "move" && !listId || trigger === "button" && !name.trim() || action === "add-label" && !labelId}>Add rule</button>
        {action === "add-label" && !labels.length && <small>Create a label on the board first.</small>}
      </form>
      <h3>Board rules</h3>
      {(board.automationRules ?? []).length ? board.automationRules!.map((rule) => <div className="panel-row" key={rule.id}><span>{rule.trigger === "button" ? "Button “" + rule.name + "”" : rule.trigger === "due" ? ({ 0: "At due time", 60: "1 hour before due", 1440: "1 day before due", 10080: "1 week before due" } as Record<number, string>)[rule.leadMinutes ?? 0] : "When moved to “" + (state.lists.find((item) => item.id === rule.listId)?.name ?? "list unavailable") + "”"} — {actionText(rule)}</span><button onClick={() => { if (confirm("Delete rule?")) onRemove(rule.id); }}>Delete</button></div>) : <p>No rules yet.</p>}
    </section>
  </div>;
}

function PlannerView({ state, onOpen }: { state: AppState; onOpen: (card: Card) => void }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (today.getDay() + 6) % 7 + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  const cards = state.cards.filter((card) => card.dueAt && isCardAvailable(state, card)).sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!));
  return <section className="planner-view" aria-label="Planner">
    <header><div><h1>Planner</h1><p>Cards with due dates from your boards and inbox.</p></div><div><button onClick={() => setWeekOffset((value) => value - 1)}>Previous week</button><button onClick={() => setWeekOffset(0)}>Today</button><button onClick={() => setWeekOffset((value) => value + 1)}>Next week</button></div></header>
    <div className="planner-week">{days.map((day) => <section className="planner-day" key={day.toDateString()}><h2>{day.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "long" })}</h2>{cards.filter((card) => new Date(card.dueAt!).toDateString() === day.toDateString()).map((card) => <button className="planner-card" key={card.id} onClick={() => onOpen(card)}><strong>{card.name}</strong><small>{state.boards.find((board) => board.id === card.boardId)?.name} · {new Date(card.dueAt!).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}{card.completed ? " · done" : ""}</small></button>)}</section>)}</div>
  </section>;
}

function InboxView({ state, onCreate, onOpen, onOpenArchive }: { state: AppState; onCreate: (name: string) => void; onOpen: (id: string) => void; onOpenArchive: () => void }) {
  const [draft, setDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<BoardFilter["status"]>("all");
  const [due, setDue] = useState<BoardFilter["due"]>("any");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const cards = filterBoardCards(state, inboxBoardId, { ...emptyBoardFilter(), keyword, status, due }).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "newest" ? b.position - a.position : a.position - b.position);
  function addCard() {
    if (!draft.trim()) return;
    onCreate(draft);
    setDraft("");
  }
  return <section className="inbox-view" aria-label="Inbox">
    <header><div><h1>Inbox</h1><p>Collect ideas and tasks here, then move them to a board.</p></div><button onClick={onOpenArchive}>Archive</button></header>
    <form className="inbox-compose" onSubmit={(event) => { event.preventDefault(); addCard(); }}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add a card" aria-label="New card in inbox" required /><button className="primary-button" type="submit">Add</button></form>
    <div className="inbox-filters"><input type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Search inbox" aria-label="Search inbox" /><select value={status} onChange={(event) => setStatus(event.target.value as BoardFilter["status"])} aria-label="Inbox status"><option value="all">Any status</option><option value="complete">Completed</option><option value="incomplete">Not completed</option></select><select value={due} onChange={(event) => setDue(event.target.value as BoardFilter["due"])} aria-label="Inbox due date"><option value="any">Any due date</option><option value="overdue">Overdue</option><option value="next-week">Next 7 days</option><option value="none">No due date</option></select><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Inbox sorting"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">By title</option></select></div>
    <div className="inbox-cards">{cards.map((card) => <button className="card-tile" key={card.id} onClick={() => onOpen(card.id)}><CardCover card={card} /><CardStickers card={card} /><span className="card-name">{card.completed && <span className="complete-mark">✓</span>}{card.name}</span><span className="card-meta">{card.dueAt && <span><Icon name="clock" /> {new Date(card.dueAt).toLocaleDateString()}</span>}{card.checklists.length > 0 && <span>☑ {card.checklists.reduce((count, list) => count + list.items.filter((item) => item.checked).length, 0)}/{card.checklists.reduce((count, list) => count + list.items.length, 0)}</span>}{card.attachments.length > 0 && <span><Icon name="clip" /> {card.attachments.length}</span>}</span></button>)}{!cards.length && <p className="inbox-empty">{keyword || status !== "all" || due !== "any" ? "Nothing found" : "No cards in your inbox yet"}</p>}</div>
  </section>;
}

function TemplateComposer({ templates, onCreate }: { templates: Card[]; onCreate: (templateId: string, name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  if (!templates.length) return null;
  const selected = templates.find((item) => item.id === templateId) ?? templates[0];
  if (!open) return <button className="add-card" onClick={() => { setTemplateId(selected.id); setName(selected.name); setOpen(true); }}>Create from template</button>;
  return <div className="compose template-compose"><label>Template<select value={selected.id} onChange={(event) => { const next = templates.find((item) => item.id === event.target.value); if (next) { setTemplateId(next.id); setName(next.name); } }}>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) { onCreate(selected.id, name); setOpen(false); } }} aria-label="New card title" /><div><button className="primary-button" disabled={!name.trim()} onClick={() => { onCreate(selected.id, name); setOpen(false); }}>Create card</button><button className="plain-icon" onClick={() => setOpen(false)} aria-label="Cancel"><Icon name="close" /></button></div></div>;
}

interface TileActions { open: (id: string) => void; drop: (movingId: string, target: Card) => void }

/** One card on a board; memoised so typing or editing elsewhere does not re-render thousands of tiles. */
const CardTile = memo(function CardTile({ card: item, labels, members, parentName, actions }: { card: Card; labels: Map<string, Label>; members?: Member[]; parentName?: string; actions: TileActions }) {
  return <button className={`card-tile ${item.cover?.size === "full" ? item.cover.attachmentId ? "full-cover" : "full-color" : ""}`} style={item.cover?.size === "full" && item.cover.color ? { background: item.cover.color, color: readableTextColor(item.cover.color) } : undefined} draggable onDragStart={(event) => event.dataTransfer.setData("text/kanbonk-card", item.id)} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }} onDrop={(event) => { const movingId = event.dataTransfer.getData("text/kanbonk-card"); if (!movingId) return; event.preventDefault(); event.stopPropagation(); actions.drop(movingId, item); }} onClick={() => actions.open(item.id)}><CardCover card={item} /><CardStickers card={item} />{item.labelIds.some((id) => labels.get(id)?.color) && <span className="card-labels">{item.labelIds.map((id) => { const label = labels.get(id); return label?.color && <span key={id} style={{ background: label.color, color: readableTextColor(label.color) }}>{label.name}</span>; })}</span>}<span className="card-name">{item.completed && <span className="complete-mark">✓</span>}{item.name}</span>{item.isTemplate && <span className="template-badge">Template</span>}{parentName && <span className="sub-card-parent" title="Parent card">↳ {parentName}</span>}{(item.memberIds ?? []).length > 0 && <span className="card-members" aria-label="Card members">{(item.memberIds ?? []).map((id) => { const member = members?.find((entry) => entry.id === id); return member && <span key={id} title={member.name}>{member.name.slice(0, 2).toUpperCase()}</span>; })}</span>}{(item.description || item.dueAt || item.attachments.length || item.comments.length || item.checklists.length) ? <span className="card-meta">{item.description && "≡"}{item.dueAt && <span><Icon name="clock" />{new Date(item.dueAt).toLocaleDateString()}</span>}{item.attachments.length > 0 && <span><Icon name="clip" />{item.attachments.length}</span>}{item.comments.length > 0 && <span>☰ {item.comments.length}</span>}{item.checklists.map((checklist) => <span key={checklist.id}>☑ {checklist.items.filter((entry) => entry.checked).length}/{checklist.items.length}</span>)}</span> : null}</button>;
});

/** Renders a long list in pages: the next page mounts when the end of the list scrolls into view. */
/**
 * Renders a list's cards only while the list is near the viewport, and long lists in pages: the next page mounts when
 * the end of the list scrolls into view. Keeps the DOM small on boards with thousands of cards.
 */
function ListCards({ cards, render }: { cards: Card[]; render: (card: Card) => ReactNode }) {
  const [limit, setLimit] = useState(listPageSize);
  const [near, setNear] = useState(false);
  const stack = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const more = near && cards.length > limit;
  useEffect(() => {
    const element = stack.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => { const visible = entries.some((entry) => entry.isIntersecting); startTransition(() => setNear(visible)); }, { rootMargin: "200px 600px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = sentinel.current;
    if (!more || !element) return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) setLimit((value) => value + listPageSize); }, { rootMargin: "600px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [more, limit]);
  if (!near) return <div ref={stack} className="card-stack card-stack-placeholder" data-count={cards.length} style={{ height: Math.min(cards.length, listPageSize) * 44 }} aria-label={`Cards: ${cards.length}`} />;
  return <div ref={stack} className="card-stack" data-count={cards.length}>{cards.slice(0, limit).map(render)}{more && <div ref={sentinel} className="card-stack-more"><button onClick={() => setLimit((value) => value + listPageSize)}>Show {Math.min(listPageSize, cards.length - limit)} more of {cards.length - limit}</button></div>}</div>;
}

const listPageSize = 40;

function CardDialog({ card, state, lists, authorName, currentDeviceId, asPage, onDelete, onClose, onChange, onAttach, onAddStickerImage, onDownload, onNavigateCard, onTransfer, onArchive, onHistory, onRunAutomation, onAddMember, onAddLabel, onEditLabel, onDeleteLabel, onAddDependency, onRemoveDependency, onConvertChecklistItem, team, onClone, onCreateSubCard, onOpenDoc }: { card: Card; state: AppState; lists: AppState["lists"]; authorName: string; currentDeviceId: string; asPage?: boolean; onDelete: () => void; onClose: () => void; onChange: (change: (card: Card) => Card) => void; onAttach: (files: FileList | null) => void; onAddStickerImage: (file: File | null) => void; onDownload: (id: string, name: string) => void; onNavigateCard: (target: Card) => void; onTransfer: (targetListId: string, copy: boolean) => void; onArchive: () => void; onHistory: () => void; onRunAutomation: (ruleId: string) => void; onAddMember: (member: Member) => void; onAddLabel: (name: string, color: string) => void; onEditLabel: (id: string, name: string, color: string) => void; onDeleteLabel: (id: string) => void; onAddDependency: (targetId: string) => void; onRemoveDependency: (dependentId: string, prerequisiteId: string) => void; onConvertChecklistItem: (checklistId: string, itemId: string) => void; team: Member[]; onClone: () => void; onCreateSubCard: (name: string) => void; onOpenDoc: () => void }) {
  const [editingDescription, setEditingDescription] = useState(false);
  const [writingComment, setWritingComment] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [subCardName, setSubCardName] = useState("");
  const [choosingParent, setChoosingParent] = useState(false);
  const [showActivityDetails, setShowActivityDetails] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState("#4bce97");
  const [showLabels, setShowLabels] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelName, setEditingLabelName] = useState("");
  const [editingLabelColor, setEditingLabelColor] = useState("#4bce97");
  const [showMembers, setShowMembers] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showDependencies, setShowDependencies] = useState(false);
  const [showChecklistComposer, setShowChecklistComposer] = useState(false);
  const [checklistName, setChecklistName] = useState("Checklist");
  const [copyChecklistId, setCopyChecklistId] = useState("");
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkError, setLinkError] = useState("");
  const [destinationBoardId, setDestinationBoardId] = useState(card.boardId);
  const [destinationListId, setDestinationListId] = useState(card.listId);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => { dialogRef.current?.focus(); const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [onClose]);
  const boardLabels = state.labels.filter((item) => item.boardId === card.boardId && !item.deleted);
  const boardMembers = state.boards.find((item) => item.id === card.boardId)?.members ?? [];
  const assignable = [...boardMembers, ...team.filter((member) => !boardMembers.some((item) => item.id === member.id))];
  const canAssign = assignable.some((member) => member.id !== currentDeviceId);
  const children = subCards(state, card.id).filter((item) => isCardAvailable(state, item));
  const parentCard = state.cards.find((item) => item.id === card.parentCardId && isCardAvailable(state, item));
  const mentionedInDoc = mentionedCardIds(state.boards.find((item) => item.id === card.boardId)?.doc ?? "").has(card.id);
  async function share(action: "print" | "png" | "json" | "link") {
    setShareStatus("");
    try {
      if (action === "print") printCard();
      else if (action === "png") { if (dialogRef.current && await downloadCardPng(dialogRef.current, card)) setShareStatus("Image saved."); }
      else if (action === "json") { if (await downloadCardJson(state, card)) setShareStatus("JSON saved."); }
      else { await navigator.clipboard.writeText(cardLink(card.id)); setShareStatus("Link copied."); }
    } catch (cause) { setShareStatus(`Something went wrong: ${cause instanceof Error ? cause.message : String(cause)}`); }
  }
  const cardButtons = card.isTemplate ? [] : state.boards.find((item) => item.id === card.boardId)?.automationRules?.filter((rule) => rule.trigger === "button") ?? [];
  const availableBoards = state.boards.filter((item) => !item.archived && state.lists.some((list) => list.boardId === item.id && !list.archived));
  const destinationLists = state.lists.filter((item) => item.boardId === destinationBoardId && !item.archived).sort((a, b) => a.position - b.position);
  const availableDependencies = useMemo(() => showDependencies ? state.cards.filter((item) => item.id !== card.id && isCardAvailable(state, item)) : [], [showDependencies, state, card.id]);
  const availableChecklists = !showChecklistComposer ? [] : state.cards.filter((item) => item.boardId === card.boardId && isCardAvailable(state, item)).flatMap((item) => item.checklists.map((checklist) => ({ checklist, cardName: item.name })));
  const related = relatedCards(card, state);
  const activityFeed = cardActivityFeed(state, card, showActivityDetails);
  const localCardForUrl = (url: string) => {
    const target = importedCardForUrl(url, state);
    return target && isCardAvailable(state, target) ? target : undefined;
  };
  function addChecklist() {
    const source = availableChecklists.find(({ checklist }) => checklist.id === copyChecklistId)?.checklist;
    const name = checklistName.trim() || source?.name || "Checklist";
    onChange((item) => ({ ...item, checklists: [...item.checklists, { id: newId(), name, items: source?.items.map((entry) => ({ ...entry, id: newId() })) ?? [] }] }));
    setShowChecklistComposer(false);
    setChecklistName("Checklist");
    setCopyChecklistId("");
  }
  function addComment(markdown: string) { const text = markdown.trim(); if (text) onChange((item) => ({ ...item, comments: [...item.comments, { id: newId(), text, author: authorName, authorDeviceId: currentDeviceId, createdAt: new Date().toISOString() }] })); setWritingComment(false); }
  function saveComment(markdown: string) {
    const text = markdown.trim();
    if (!editingCommentId || !text || !card.comments.some((entry) => entry.id === editingCommentId && canEditComment(entry, currentDeviceId))) return;
    onChange((item) => ({ ...item, comments: item.comments.map((entry) => entry.id === editingCommentId ? { ...entry, text } : entry) }));
    setEditingCommentId(null);
  }
  function deleteComment(id: string) {
    if (!card.comments.some((entry) => entry.id === id && canEditComment(entry, currentDeviceId))) return;
    onChange((item) => ({ ...item, comments: item.comments.filter((entry) => entry.id !== id) }));
    if (editingCommentId === id) setEditingCommentId(null);
  }
  function addUrlAttachment() {
    try {
      const url = new URL(linkUrl.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported URL");
      onChange((item) => ({ ...item, attachments: [...item.attachments, { id: newId(), name: linkName.trim() || url.hostname, mimeType: "text/uri-list", size: 0, sourceUrl: url.href, status: "link" }] }));
      setLinkUrl(""); setLinkName(""); setLinkError(""); setShowLinkEditor(false);
    } catch { setLinkError("Enter a link starting with http:// or https://."); }
  }
  function removeAttachment(attachment: Card["attachments"][number]) {
    if (attachment.linkedCardId) onRemoveDependency(attachment.linkedCardId, card.id);
    else onChange((item) => ({ ...item, attachments: item.attachments.filter((entry) => entry.id !== attachment.id), cover: item.cover?.attachmentId === attachment.id ? undefined : item.cover }));
  }
  const prerequisiteCards = prerequisitesOf(state, card.id).flatMap((id) => state.cards.filter((item) => item.id === id));
  const dependentCards = dependentsOf(state, card.id);
  const created = cardCreatedAt(state, card);
  const body = <div className={asPage ? "card-dialog card-page" : "card-dialog"} role={asPage ? "region" : "dialog"} aria-modal={asPage ? undefined : true} aria-label={card.name} tabIndex={-1} ref={dialogRef} onMouseDown={(event) => event.stopPropagation()}><header className="card-dialog-top"><select value={card.listId} onChange={(event) => onTransfer(event.target.value, false)} aria-label="Card list">{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select><div><button onClick={onHistory} aria-label="Card history"><Icon name="history" /></button><button onClick={onClose} aria-label="Close card"><Icon name="close" /></button></div></header><div className="card-dialog-body"><div className="card-detail-main"><div className="card-title-row">{!card.isTemplate && <button className={`complete-toggle ${card.completed ? "done" : ""}`} onClick={() => onChange((item) => ({ ...item, completed: !item.completed }))} aria-label={card.completed ? "Mark incomplete" : "Mark complete"}>{card.completed && "✓"}</button>}<NameEditor value={card.name} label="Card title" onCommit={(name) => onChange((item) => ({ ...item, name }))} /></div><p className="card-meta-line">in list “{lists.find((item) => item.id === card.listId)?.name ?? "—"}” · {state.boards.find((item) => item.id === card.boardId)?.name}{created ? ` · created ${new Date(created).toLocaleString("en-US")}` : ""} · ID {card.id}</p><div className="card-actions">{cardButtons.map((rule) => <button key={rule.id} onClick={() => onRunAutomation(rule.id)}>{rule.name}</button>)}{card.boardId !== inboxBoardId && <><button onClick={() => onChange((item) => ({ ...item, isTemplate: !item.isTemplate }))}>{card.isTemplate ? "Remove template" : "Make template"}</button>{canAssign && <button onClick={() => setShowMembers(!showMembers)}>Members</button>}<button onClick={() => setShowLabels(!showLabels)}>Labels</button></>}<button onClick={() => setShowCover(!showCover)}>Cover</button><button onClick={() => setShowStickers(!showStickers)}>Stickers</button>{!card.isTemplate && <button onClick={() => document.getElementById(`due-${card.id}`)?.focus()}>Due date</button>}<button onClick={() => setShowChecklistComposer(!showChecklistComposer)}>Checklist</button><label className="file-button">Attachment<input type="file" multiple onChange={(event) => { onAttach(event.target.files); event.target.value = ""; }} /></label><button onClick={() => setShowLinkEditor(!showLinkEditor)}>Link</button><button onClick={() => setShowTransfer(!showTransfer)}>Move / copy</button><button onClick={onClone}>Clone</button><button onClick={() => setShowShare(!showShare)} aria-expanded={showShare}>Share</button>{card.boardId !== inboxBoardId && <button onClick={() => setShowDependencies(!showDependencies)}>Dependency</button>}</div>
    {showShare && <section className="transfer-picker share-panel" aria-label="Share card" data-share-skip><strong>Share</strong><div className="share-actions"><button onClick={() => void share("print")}>Print</button><button onClick={() => void share("png")}>PNG</button><button onClick={() => void share("json")}>JSON</button><button onClick={() => void share("link")}>Copy link</button><button onClick={() => setShowQr(!showQr)} aria-pressed={showQr}>QR code</button></div>{showQr && <figure className="share-qr"><span role="img" aria-label="QR code for the card link" dangerouslySetInnerHTML={{ __html: qrSvg(cardLink(card.id)) }} /><figcaption>{cardLink(card.id)}</figcaption></figure>}{shareStatus && <p role="status">{shareStatus}</p>}</section>}
    {showChecklistComposer && <section className="transfer-picker checklist-composer" aria-label="New checklist"><strong>New checklist</strong><label>Title<input value={checklistName} onChange={(event) => setChecklistName(event.target.value)} aria-label="New checklist title" /></label><label>Copy items from<select value={copyChecklistId} onChange={(event) => { setCopyChecklistId(event.target.value); const source = availableChecklists.find(({ checklist }) => checklist.id === event.target.value)?.checklist; if (source && checklistName === "Checklist") setChecklistName(source.name); }} aria-label="Copy items from"><option value="">Don't copy</option>{availableChecklists.map(({ checklist, cardName }) => <option key={checklist.id} value={checklist.id}>{cardName} / {checklist.name}</option>)}</select></label><div><button className="primary-button" onClick={addChecklist}>Add checklist</button><button onClick={() => setShowChecklistComposer(false)}>Cancel</button></div></section>}
    {card.isTemplate && <p className="template-notice">This is a card template. Dates aren't copied when you create a card from it.</p>}{showCover && <CoverPicker card={card} onChange={onChange} onClose={() => setShowCover(false)} />}{showStickers && <section className="sticker-picker" aria-label="Card stickers"><strong>Stickers</strong><div className="sticker-options">{stickerChoices.map(({ symbol, name }) => <button key={symbol} onClick={() => onChange((item) => ({ ...item, stickers: [...(item.stickers ?? []), symbol] }))} aria-label={`Add sticker ${name}`}>{symbol}</button>)}</div><label className="file-button">Custom image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(event) => { onAddStickerImage(event.target.files?.[0] ?? null); event.target.value = ""; }} /></label>{(card.stickers ?? []).length > 0 && <div className="sticker-current">{card.stickers!.map((symbol, index) => <button key={index} onClick={() => onChange((item) => ({ ...item, stickers: (item.stickers ?? []).filter((_, position) => position !== index) }))} aria-label={`Remove sticker ${index + 1}`}>{typeof symbol === "string" ? symbol : symbol.name} ×</button>)}</div>}</section>}
    {showTransfer && <section className="transfer-picker" aria-label="Move or copy card"><strong>Choose a destination</strong><label>Board<select value={destinationBoardId} onChange={(event) => { const id = event.target.value; setDestinationBoardId(id); setDestinationListId(state.lists.filter((item) => item.boardId === id && !item.archived).sort((a, b) => a.position - b.position)[0]?.id ?? ""); }}>{availableBoards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>List<select value={destinationListId} onChange={(event) => setDestinationListId(event.target.value)}>{destinationLists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div><button onClick={() => onTransfer(destinationListId, false)} disabled={!destinationListId}>Move</button><button onClick={() => onTransfer(destinationListId, true)} disabled={!destinationListId}>Copy</button></div></section>}
    {showLinkEditor && <section className="transfer-picker link-editor" aria-label="Add link"><strong>Website link</strong><label>URL<input type="url" value={linkUrl} onChange={(event) => { setLinkUrl(event.target.value); setLinkError(""); }} placeholder="https://example.com" /></label><label>Title<input value={linkName} onChange={(event) => setLinkName(event.target.value)} placeholder="Optional" /></label>{linkError && <p role="alert">{linkError}</p>}<button disabled={!linkUrl.trim()} onClick={addUrlAttachment}>Add link</button></section>}
    {showDependencies && <section className="transfer-picker dependency-picker" aria-label="Add dependency"><strong>Depends on card</strong><CardPicker label="Dependency card" candidates={availableDependencies} describe={(item) => `${state.boards.find((board) => board.id === item.boardId)?.name ?? ""} / ${item.name}`} onPick={(item) => { onAddDependency(item.id); setShowDependencies(false); }} /></section>}
    {showMembers && canAssign && card.boardId !== inboxBoardId && <div className="label-picker"><strong>Board members</strong>{assignable.map((member) => <label key={member.id}><input type="checkbox" checked={(card.memberIds ?? []).includes(member.id)} onChange={() => boardMembers.some((item) => item.id === member.id) ? onChange((item) => ({ ...item, memberIds: (item.memberIds ?? []).includes(member.id) ? (item.memberIds ?? []).filter((id) => id !== member.id) : [...(item.memberIds ?? []), member.id] })) : onAddMember(member)} />{member.name}{member.id === currentDeviceId ? " (you)" : ""}</label>)}<small className="hint">Members are trusted devices and members imported from Trello.</small></div>}
    {showLabels && card.boardId !== inboxBoardId && <div className="label-picker"><strong>Labels</strong>{boardLabels.map((label) => <div className="label-row" key={label.id}><label><input type="checkbox" checked={card.labelIds.includes(label.id)} onChange={() => onChange((item) => ({ ...item, labelIds: item.labelIds.includes(label.id) ? item.labelIds.filter((id) => id !== label.id) : [...item.labelIds, label.id] }))} /><span style={{ background: label.color || "#dfe1e6", color: readableTextColor(label.color || "#dfe1e6") }}>{label.name}</span></label><button type="button" onClick={() => { setEditingLabelId(label.id); setEditingLabelName(label.name); setEditingLabelColor(label.color); }} aria-label={`Edit label ${label.name}`}>Edit</button></div>)}{editingLabelId && <div className="inline-form"><input value={editingLabelName} onChange={(event) => setEditingLabelName(event.target.value)} aria-label="Label name" /><input type="color" list="label-color-presets" value={editingLabelColor || "#dfe1e6"} onChange={(event) => setEditingLabelColor(event.target.value)} aria-label="Edited label color" /><button disabled={!editingLabelName.trim()} onClick={() => { onEditLabel(editingLabelId, editingLabelName.trim(), editingLabelColor); setEditingLabelId(null); }}>Save</button><button onClick={() => { if (editingLabelId && confirm("Remove this label from all cards?")) { onDeleteLabel(editingLabelId); setEditingLabelId(null); } }} aria-label="Delete label">Delete</button><button onClick={() => setEditingLabelId(null)}>Cancel</button></div>}<div className="inline-form"><input value={labelName} onChange={(event) => setLabelName(event.target.value)} placeholder="New label" aria-label="New label" /><input type="color" list="label-color-presets" value={labelColor} onChange={(event) => setLabelColor(event.target.value)} aria-label="Label color" /><datalist id="label-color-presets">{labelColorOptions.filter(({ color }) => color).map(({ color }) => <option key={color} value={color} />)}</datalist><button onClick={() => { if (labelName.trim()) { onAddLabel(labelName.trim(), labelColor); setLabelName(""); } }}>Add</button></div></div>}
    {card.labelIds.length > 0 && <div className="detail-labels">{card.labelIds.map((id) => { const label = boardLabels.find((item) => item.id === id); return label && <span key={id} style={{ background: label.color || "#dfe1e6", color: readableTextColor(label.color || "#dfe1e6") }}>{label.name}</span>; })}</div>}
    {(card.memberIds ?? []).length > 0 && <div className="member-avatars" aria-label="Card members">{(card.memberIds ?? []).map((id) => { const member = boardMembers.find((item) => item.id === id); return member && <span key={id} title={member.name} aria-label={member.name}>{member.name.slice(0, 2).toUpperCase()}</span>; })}</div>}
    {!card.isTemplate && <section className="detail-section"><h3><Icon name="clock" /> Dates</h3><div className="date-fields"><label>Start date<input type="datetime-local" value={card.startAt ? localDateTime(card.startAt) : ""} onChange={(event) => onChange((item) => ({ ...item, startAt: event.target.value ? new Date(event.target.value).toISOString() : undefined }))} aria-label="Card start date" /></label><label>Due date<input id={`due-${card.id}`} type="datetime-local" value={card.dueAt ? localDateTime(card.dueAt) : ""} onChange={(event) => onChange((item) => ({ ...item, dueAt: event.target.value ? new Date(event.target.value).toISOString() : undefined, dueReminderMinutes: event.target.value ? item.dueReminderMinutes : undefined, dueRepeat: event.target.value ? item.dueRepeat : undefined }))} aria-label="Card due date" /></label><label>Reminder<select value={card.dueReminderMinutes ?? ""} onChange={(event) => onChange((item) => ({ ...item, dueReminderMinutes: event.target.value === "" ? undefined : Number(event.target.value) }))} disabled={!card.dueAt} aria-label="Card due date reminder"><option value="">No reminder</option>{reminderOptions.map((option) => <option key={option.minutes} value={option.minutes}>{option.label}</option>)}{card.dueReminderMinutes !== undefined && !reminderOptions.some((option) => option.minutes === card.dueReminderMinutes) && <option value={card.dueReminderMinutes}>{card.dueReminderMinutes} minutes before</option>}</select></label><label>Repeat<select value={card.dueRepeat?.cadence ?? ""} onChange={(event) => { const cadence = event.target.value as NonNullable<Card["dueRepeat"]>["cadence"] | ""; onChange((item) => ({ ...item, dueRepeat: cadence && item.dueAt ? { cadence, anchor: localDateTime(item.dueAt).slice(0, 10) } : undefined })); }} disabled={!card.dueAt} aria-label="Repeat card due date"><option value="">Don't repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label></div></section>}
    <section className="detail-section"><h3>Description{card.description && !editingDescription && <button className="description-edit-button" onClick={() => setEditingDescription(true)}>Edit</button>}</h3>{editingDescription ? <MarkdownEditor value={card.description} label="Card description" onSave={(value) => { if (value !== card.description) onChange((item) => ({ ...item, description: value })); setEditingDescription(false); }} onCancel={() => setEditingDescription(false)} /> : card.description ? <div className="description-preview" onDoubleClick={() => setEditingDescription(true)}><MarkdownText text={card.description} localCardForUrl={localCardForUrl} onNavigateCard={onNavigateCard} /></div> : <button className="description-placeholder" onClick={() => setEditingDescription(true)}>Add a more detailed description…</button>}</section>
    {(prerequisiteCards.length > 0 || dependentCards.length > 0) && <section className="detail-section dependency-summary"><h3>Dependencies</h3>{prerequisiteCards.length > 0 && <p>Depends on: {prerequisiteCards.map((item) => <button key={item.id} onClick={() => onNavigateCard(item)}>{item.completed ? "✓" : "⏳"} {item.name}</button>)}</p>}{prerequisiteCards.some((item) => !item.completed) && !card.completed && <p className="blocked-note">Card is blocked: not all dependencies are complete.</p>}{dependentCards.length > 0 && <p>Blocks: {dependentCards.map((item) => <button key={item.id} onClick={() => onNavigateCard(item)}>{item.name}</button>)}</p>}</section>}
    {mentionedInDoc && <p className="doc-backlink">📄 Mentioned in the <button className="link-button" onClick={onOpenDoc}>board doc</button></p>}
    {!card.isTemplate && card.boardId !== inboxBoardId && <section className="detail-section sub-cards"><h3>Sub-cards</h3>{parentCard && <p>Parent: <button onClick={() => onNavigateCard(parentCard)}>{parentCard.name}</button></p>}{children.length > 0 && <ul>{children.map((item) => <li key={item.id}><button onClick={() => onNavigateCard(item)}>{item.completed ? "✓ " : ""}{item.name}</button></li>)}</ul>}<div className="inline-form"><input value={subCardName} onChange={(event) => setSubCardName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && subCardName.trim()) { onCreateSubCard(subCardName.trim()); setSubCardName(""); } }} placeholder="New sub-card" aria-label="New sub-card title" /><button disabled={!subCardName.trim()} onClick={() => { onCreateSubCard(subCardName.trim()); setSubCardName(""); }}>Add</button></div><div className="parent-picker">{choosingParent ? <><CardPicker label="Parent card" candidates={parentCandidates(state, card.id).filter((item) => item.boardId === card.boardId && isCardAvailable(state, item))} onPick={(parent) => { onChange((item) => ({ ...item, parentCardId: parent.id })); setChoosingParent(false); }} /><button onClick={() => setChoosingParent(false)}>Cancel</button></> : <><button onClick={() => setChoosingParent(true)}>{parentCard ? "Change parent" : "Choose parent card"}</button>{card.parentCardId && <button onClick={() => onChange((item) => ({ ...item, parentCardId: undefined }))}>Remove parent</button>}</>}</div></section>}
    {card.checklists.map((checklist) => <ChecklistSection key={checklist.id} checklist={checklist} card={card} onChange={onChange} onRemoveDependency={onRemoveDependency} onConvertItem={(itemId) => onConvertChecklistItem(checklist.id, itemId)} />)}
    {related.length > 0 && <section className="detail-section related-cards"><h3>Linked cards</h3>{related.map((link, index) => <div className="related-row" key={`${link.url}-${index}`}><span>{link.source}</span>{link.target && isCardAvailable(state, link.target) ? <button onClick={() => onNavigateCard(link.target!)}>{link.target.name}</button> : link.target ? <small>Card unavailable: {link.target.name}</small> : <small>Card not imported: {link.url}</small>}</div>)}</section>}
    {card.attachments.length > 0 && <section className="detail-section"><h3><Icon name="clip" /> Attachments</h3>{card.attachments.map((attachment) => <AttachmentRow key={attachment.id} attachment={attachment} linkedCard={state.cards.find((item) => item.id === attachment.linkedCardId && isCardAvailable(state, item))} onNavigateCard={onNavigateCard} onDownload={onDownload} onRemove={() => removeAttachment(attachment)} />)}</section>}
    <div className="card-footer-actions"><button className="archive-action" onClick={onArchive}><Icon name="archive" /> Archive card</button><button className="archive-action danger" onClick={onDelete}>🗑 Move to trash</button></div></div><aside className="activity-panel"><h3>Comments and activity<button className="activity-toggle" type="button" aria-expanded={showActivityDetails} onClick={() => setShowActivityDetails((value) => !value)}>{showActivityDetails ? "Hide details" : "Show details"}</button></h3>{writingComment ? <MarkdownEditor value="" label="New comment" saveLabel="Send" onSave={addComment} onCancel={() => setWritingComment(false)} /> : <button className="description-placeholder" onClick={() => setWritingComment(true)}>Write a comment…</button>}<div className="comments">{activityFeed.map((item) => {
  if (item.kind === "change") return <article className="card-activity-entry" key={item.id}><strong>{item.event.summary}</strong><small>{new Date(item.createdAt).toLocaleString("en-US")}</small></article>;
  const entry = item.comment;
  return <article key={item.id}><span className="comment-avatar">{entry.author.slice(0, 1)}</span><div><strong>{entry.author}</strong><small>{new Date(entry.createdAt).toLocaleString("en-US")}</small>{editingCommentId === entry.id ? <div className="comment-edit"><MarkdownEditor value={commentDraft} label="Edit comment" onSave={saveComment} onCancel={() => setEditingCommentId(null)} /></div> : <><MarkdownText text={entry.text} localCardForUrl={localCardForUrl} onNavigateCard={onNavigateCard} />{canEditComment(entry, currentDeviceId) && <div className="comment-actions"><button onClick={() => { setEditingCommentId(entry.id); setCommentDraft(entry.text); }}>Edit</button><button onClick={() => deleteComment(entry.id)}>Delete</button></div>}</>}</div></article>;
})}</div></aside></div></div>;
  return asPage ? body : <div className="dialog-backdrop" onMouseDown={onClose}>{body}</div>;
}

function ChecklistSection({ checklist, card, onChange, onRemoveDependency, onConvertItem }: { checklist: Checklist; card: Card; onChange: (change: (card: Card) => Card) => void; onRemoveDependency: (dependentId: string, prerequisiteId: string) => void; onConvertItem: (itemId: string) => void }) {
  const [draft, setDraft] = useState("");
  const [hideChecked, setHideChecked] = useState(false);
  const [titleDraft, setTitleDraft] = useState(checklist.name);
  const [itemNames, setItemNames] = useState<Record<string, string>>({});
  useEffect(() => setTitleDraft(checklist.name), [checklist.name]);
  const checked = checklist.items.filter((item) => item.checked).length;

  function updateList(change: (list: Checklist) => Checklist) {
    onChange((current) => ({ ...current, checklists: current.checklists.map((list) => list.id === checklist.id ? change(list) : list) }));
  }

  function addItem() {
    const names = draft.split(/\r\n|\r|\n/).map((name) => name.trim()).filter(Boolean);
    if (!names.length) return;
    updateList((list) => ({ ...list, items: [...list.items, ...names.map((name) => ({ id: newId(), name, checked: false }))] }));
    setDraft("");
  }

  function saveItemName(itemId: string, currentName: string) {
    const name = (itemNames[itemId] ?? currentName).trim();
    if (name && name !== currentName) updateList((list) => ({ ...list, items: list.items.map((item) => item.id === itemId ? { ...item, name } : item) }));
    setItemNames((current) => { const next = { ...current }; delete next[itemId]; return next; });
  }

  function itemAction(itemId: string, action: string) {
    const index = checklist.items.findIndex((item) => item.id === itemId);
    if (action === "delete") {
      const linkedCardId = checklist.items[index]?.linkedCardId;
      if (linkedCardId) onRemoveDependency(card.id, linkedCardId);
      else updateList((list) => ({ ...list, items: list.items.filter((item) => item.id !== itemId) }));
    }
    else if (action === "convert") onConvertItem(itemId);
    else if (action === "up" && index > 0) onChange((current) => moveChecklistItem(current, itemId, checklist.id, checklist.items[index - 1].id));
    else if (action === "down" && index >= 0 && index < checklist.items.length - 1) onChange((current) => moveChecklistItem(current, itemId, checklist.id, checklist.items[index + 2]?.id));
    else if (action.startsWith("to:")) onChange((current) => moveChecklistItem(current, itemId, action.slice(3)));
  }

  function deleteChecklist() {
    for (const linkedCardId of new Set(checklist.items.flatMap((item) => item.linkedCardId ? [item.linkedCardId] : []))) onRemoveDependency(card.id, linkedCardId);
    onChange((current) => ({ ...current, checklists: current.checklists.filter((list) => list.id !== checklist.id) }));
  }

  function dropItem(event: ReactDragEvent, beforeItemId?: string) {
    const id = event.dataTransfer.getData("text/kanbonk-check-item");
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    onChange((current) => moveChecklistItem(current, id, checklist.id, beforeItemId));
  }

  return <section className="detail-section" onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropItem(event)}>
    <div className="section-title"><h3>☑ <input className="checklist-title" value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} onBlur={() => { const name = titleDraft.trim(); if (name && name !== checklist.name) updateList((list) => ({ ...list, name })); else setTitleDraft(checklist.name); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label="Checklist title" /></h3><button onClick={() => setHideChecked((value) => !value)} aria-pressed={hideChecked}>{hideChecked ? "Show checked items" : "Hide checked items"}</button><select className="checklist-actions" aria-label={`Checklist actions ${checklist.name}`} defaultValue="" onChange={(event) => { if (event.target.value === "delete") deleteChecklist(); event.target.value = ""; }}><option value="">⋯</option><option value="delete">Delete checklist</option></select></div>
    <div className="checklist-progress">{checklist.items.length ? Math.round(100 * checked / checklist.items.length) : 0}%<div><span style={{ width: `${checklist.items.length ? 100 * checked / checklist.items.length : 0}%` }} /></div></div>
    {checklist.items.filter((item) => !hideChecked || !item.checked).map((item) => <div className="checklist-item-row" key={item.id} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }} onDrop={(event) => dropItem(event, item.id)}><span className="checklist-drag-handle" draggable title="Drag item" onDragStart={(event) => event.dataTransfer.setData("text/kanbonk-check-item", item.id)}>⋮⋮</span><input type="checkbox" checked={item.checked} onChange={() => updateList((list) => ({ ...list, items: list.items.map((entry) => entry.id === item.id ? { ...entry, checked: !entry.checked } : entry) }))} aria-label={`Check item ${item.name}`} /><input className={item.checked ? "checklist-item-name checked" : "checklist-item-name"} value={itemNames[item.id] ?? item.name} onChange={(event) => setItemNames((current) => ({ ...current, [item.id]: event.target.value }))} onBlur={() => saveItemName(item.id, item.name)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label={`Item title ${item.name}`} /><select aria-label={`Item actions ${item.name}`} defaultValue="" onChange={(event) => { itemAction(item.id, event.target.value); event.target.value = ""; }}><option value="">⋯</option><option value="up">Move up</option><option value="down">Move down</option>{card.checklists.filter((list) => list.id !== checklist.id).map((list) => <option key={list.id} value={`to:${list.id}`}>To checklist “{list.name}”</option>)}<option value="convert" disabled={Boolean(item.linkedCardId)}>Convert to card</option><option value="delete">Delete item</option></select></div>)}
    <div className="inline-form"><textarea className="checklist-new-items" rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); addItem(); } }} placeholder="Add an item" aria-label="New checklist items" /><button onClick={addItem}>Add</button></div>
  </section>;
}

function CoverPicker({ card, onChange, onClose }: { card: Card; onChange: (change: (card: Card) => Card) => void; onClose: () => void }) {
  const images = card.attachments.filter((item) => item.status === "local" && item.mimeType.startsWith("image/"));
  return <div className="cover-picker"><div className="section-title"><strong>Cover</strong><button onClick={onClose}>Close</button></div><div className="cover-colors">{coverColors.map((color) => <button key={color} style={{ background: color }} aria-label={`Cover ${color}`} aria-pressed={card.cover?.color === color} onClick={() => onChange((item) => ({ ...item, cover: { color, size: item.cover?.size ?? "normal" } }))} />)}<label className="custom-color" title="Custom color"><ColorInput value={card.cover?.color ?? "#579dff"} label="Custom cover color" onCommit={(color) => onChange((item) => ({ ...item, cover: { color, size: item.cover?.size ?? "normal" } }))} /></label></div><button onClick={() => onChange((item) => ({ ...item, cover: { color: item.cover?.color ?? "#579dff", size: "full" } }))} aria-pressed={card.cover?.size === "full" && Boolean(card.cover.color)}>Color the whole card</button>{images.length > 0 && <div className="cover-files">{images.map((image) => <button key={image.id} aria-pressed={card.cover?.attachmentId === image.id} onClick={() => onChange((item) => ({ ...item, cover: { attachmentId: image.id, size: item.cover?.size ?? "normal" } }))}>{image.name}</button>)}</div>}<label>Size <select value={card.cover?.size ?? "normal"} disabled={!card.cover} onChange={(event) => onChange((item) => ({ ...item, cover: item.cover ? { ...item.cover, size: event.target.value as "normal" | "full" } : undefined }))}><option value="normal">Normal</option><option value="full">Full card</option></select></label><button onClick={() => onChange((item) => ({ ...item, cover: undefined }))} disabled={!card.cover}>Remove cover</button></div>;
}

function CardStickers({ card }: { card: Card }) {
  const imageIds = (card.stickers ?? []).flatMap((sticker) => typeof sticker === "string" ? [] : [sticker.imageId]);
  const imageKey = imageIds.join(",");
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    void Promise.all(imageIds.map(async (id) => {
      try {
        const blob = await loadAttachment(id);
        if (!blob || !active) return null;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return [id, url] as const;
      } catch { return null; }
    })).then((loaded) => { if (active) setImageUrls(Object.fromEntries(loaded.filter((item): item is readonly [string, string] => item !== null))); });
    return () => { active = false; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [imageKey, card]);
  if (!card.stickers?.length) return null;
  return <span className="card-stickers" aria-label={`Stickers: ${card.stickers.map((sticker) => typeof sticker === "string" ? sticker : sticker.name).join(" ")}`}>{card.stickers.map((sticker, index) => <span key={index} role="img" aria-label={typeof sticker === "string" ? sticker : sticker.name}>{typeof sticker === "string" ? sticker : sticker.status === "missing" ? <span title="Sticker file missing">⚠</span> : imageUrls[sticker.imageId] && <img src={imageUrls[sticker.imageId]} alt="" />}</span>)}</span>;
}

function CardCover({ card }: { card: Card }) {
  const attachment = card.attachments.find((item) => item.id === card.cover?.attachmentId && item.status === "local" && item.mimeType.startsWith("image/"));
  const [image, setImage] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!attachment) return;
    let url = "";
    let cancelled = false;
    loadAttachment(attachment.id).then((blob) => {
      if (!blob || cancelled) return;
      url = URL.createObjectURL(blob);
      setImage({ id: attachment.id, url });
    }).catch(() => { if (!cancelled) setImage(null); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [attachment?.id, attachment]);
  if (!card.cover) return null;
  if (attachment && image?.id === attachment.id) return <img className="card-cover-image" src={image.url} alt="" />;
  if (card.cover.color && card.cover.size === "normal") return <span className="card-cover-color" style={{ background: card.cover.color }} />;
  return null;
}

function AttachmentRow({ attachment, linkedCard, onNavigateCard, onDownload, onRemove }: { attachment: Card["attachments"][number]; linkedCard?: Card; onNavigateCard: (card: Card) => void; onDownload: (id: string, name: string) => void; onRemove: () => void }) {
  const [localUrl, setLocalUrl] = useState("");
  useEffect(() => {
    if (attachment.status !== "local" || !/^(image|video|audio)\//.test(attachment.mimeType)) return;
    let url = "";
    let cancelled = false;
    loadAttachment(attachment.id).then((blob) => {
      if (!blob || cancelled) return;
      url = URL.createObjectURL(blob);
      setLocalUrl(url);
    }).catch(() => { if (!cancelled) setLocalUrl(""); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [attachment.id, attachment.mimeType, attachment.status, attachment]);
  const kind = attachment.mimeType.split("/")[0];
  let action = <button onClick={() => onDownload(attachment.id, attachment.name)} disabled={attachment.status === "missing"}>Download</button>;
  if (attachment.status === "link") {
    if (linkedCard && !linkedCard.archived) action = <button onClick={() => onNavigateCard(linkedCard)}>Open card</button>;
    else if (attachment.linkedCardId) action = <small>Card unavailable</small>;
    else if (/^https?:\/\//.test(attachment.sourceUrl ?? "")) action = <a href={attachment.sourceUrl} target="_blank" rel="noopener noreferrer">Open link</a>;
    else action = <small>Link unavailable</small>;
  }
  return <div className="attachment-entry"><div className="attachment-row"><span>{attachment.name}<small>{attachment.status === "link" ? "Link" : `${Math.round(attachment.size / 1024)} KB ${attachment.status === "missing" ? "· file missing" : ""}`}</small></span>{action}<button onClick={onRemove} aria-label={`Delete attachment ${attachment.name}`}>Delete</button></div>{localUrl && kind === "image" && <img className="attachment-preview" src={localUrl} alt={attachment.name} />}{localUrl && kind === "video" && <video className="attachment-preview" src={localUrl} controls preload="metadata" />}{localUrl && kind === "audio" && <audio className="attachment-audio" src={localUrl} controls preload="metadata" />}</div>;
}

export default App;
