import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  deviceId,
  loadAttachment,
  loadState,
  readLocalAuthor,
  saveAttachment,
  saveLocalAuthor,
  saveState,
} from "./storage";
import { boardHref, trashHref, useRoute, type CalendarScale, type Route } from "./router";
import { purgeExpired, visibleState } from "./trash";

import { exportTrelloCsv, exportTrelloJson } from "./trello/formats";
import { mergeDuplicate, pairKey } from "./dedupe";

import { DocView } from "./board/DocView";
import { AiPanel, type ProposedCard } from "./board/AiPanel";
import { AiSettingsDialog } from "./dialogs/AiSettingsDialog";
import { readAiSettings, saveAiSettings, type AiSettings } from "./ai";

import { saveFile } from "./platform";
import { zoneRuns } from "./zones";
import { BoardCalendar } from "./board/BoardCalendar";
import { ZoneFrame } from "./board/ZoneFrame";
import { DedupeDialog } from "./dialogs/DedupeDialog";
import { DeleteDialog } from "./dialogs/DeleteDialog";
import { HomePage } from "./pages/HomePage";
import { MissingPage } from "./pages/MissingPage";
import { TrashPage } from "./pages/TrashPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { SettingsDialog } from "./dialogs/SettingsDialog";
import { AuthorDialog } from "./dialogs/AuthorDialog";
import { BackupDialog } from "./dialogs/BackupDialog";
import { type BoardCopyOptions, BoardCopyDialog } from "./dialogs/BoardCopyDialog";
import { CloneCardDialog } from "./dialogs/CloneCardDialog";
import { CreationDialog } from "./dialogs/CreationDialog";
import { ArchivePanel } from "./panels/ArchivePanel";
import { BoardAboutPanel } from "./panels/BoardAboutPanel";
import { ClosedBoardsPanel } from "./panels/ClosedBoardsPanel";
import { HistoryPanel } from "./panels/HistoryPanel";
import { RemindersPanel } from "./panels/RemindersPanel";
import { SyncDialog } from "./dialogs/SyncDialog";
import { useDeviceSync } from "./hooks/useDeviceSync";
import { ImportDialog } from "./dialogs/ImportDialog";
import {
  cloneCard,
  cloneCardName,
  type Member,
  emptyBoardFilter,
  emptyState,
  filterBoardCards,
  newId,
  positionBefore,
  recordRevision,
  type AppState,
  type Board,
  type BoardFilter,
  type BoardList,
  type Zone,
  type Card,
  type Revision,
} from "./model";
import { chooseConflict, type SyncConflict } from "./sync";

import { applyDueRules } from "./automation";
import { dueReminders, reminderSignature } from "./reminders";
import { ensureInbox, inboxBoardId, inboxWorkspaceId } from "./inbox";

import { AutomationPanel } from "./board/AutomationPanel";
import { activeFilterCount, BoardFilterPanel } from "./board/BoardFilterPanel";
import { BoardToolbar } from "./board/BoardToolbar";
import { BoardActivity } from "./board/BoardActivity";
import type { TileActions } from "./board/CardTile";
import { type ListActions, ListColumn } from "./board/ListColumn";
import { CardDialog } from "./card/CardDialog";
import { AppHeader, type AppMenuActions, plannerViewId } from "./layout/AppHeader";
import { SearchResults } from "./layout/SearchResults";
import { Sidebar } from "./layout/Sidebar";
import { PanelSlot } from "./layout/PanelSlot";
import { CardActionsContext } from "./card/CardActionsContext";
import { useAutoBackup } from "./hooks/useAutoBackup";
import { useBoardActions } from "./hooks/useBoardActions";
import { type CardActions, useCardActions } from "./hooks/useCardActions";
import { useTrash } from "./hooks/useTrash";
import { usePanelLayout } from "./hooks/usePanelLayout";
import { InboxView } from "./panels/InboxView";
import { PlannerView } from "./panels/PlannerView";
import { Icon } from "./ui/Icon";
import { readBoardFilters, readDismissedReminders, type PanelName } from "./uiPreferences";
import "./ui/MarkdownText.css";
import "./styles/activity.css";
import "./styles/App.css";
import "./styles/pages.css";

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
  const [boardCopy, setBoardCopy] = useState<BoardCopyOptions | null>(null);
  const [creation, setCreation] = useState<{ kind: "workspace" | "board"; workspaceId?: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [localAuthor, setLocalAuthor] = useState(readLocalAuthor);
  const [authorDialogOpen, setAuthorDialogOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupConflicts, setBackupConflicts] = useState<SyncConflict[]>([]);
  const [syncOpen, setSyncOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(readAiSettings);
  const [fileVersion, setFileVersion] = useState(0);
  const [backgroundImage, setBackgroundImage] = useState<{ id: string; url: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const queue = useRef(Promise.resolve());
  const localDeviceId = useRef(deviceId());
  const stateRef = useRef(fullState);
  stateRef.current = fullState;
  const sync = useDeviceSync({
    ready,
    state: fullState,
    stateRef,
    setState,
    deviceId: localDeviceId.current,
    authorName: localAuthor,
    onFilesChanged: () => setFileVersion((current) => current + 1),
    onError: setError,
  });
  const panels = usePanelLayout({ ready, onError: setError });
  const { shownPanels } = panels;
  const cardActions = useCardActions({ state, setState, deviceId: localDeviceId.current, onError: setError });
  const { updateCard, createInboxCard, addCardFromTemplate } = cardActions;
  const boardActions = useBoardActions({ setState, deviceId: localDeviceId.current });
  const { updateList, moveList, copyListOnBoard, sortList, addAutomationRule, removeAutomationRule } = boardActions;
  const trash = useTrash({ fullState, setState, deviceId: localDeviceId.current, onNotice: setNotice });
  const { requestDelete } = trash;

  const restorePanels = useEffectEvent(() => panels.restore());
  useEffect(() => {
    loadState()
      .then((loaded) => {
        loaded = ensureInbox(loaded, localDeviceId.current);
        setState(loaded);
        restorePanels();
        setReady(true);
      })
      .catch((cause) => setError(`Could not open local data: ${String(cause)}`));
  }, []);

  const notifyTabs = useEffectEvent(() => sync.notifyTabs());
  useEffect(() => {
    if (!ready) return;
    queue.current = queue.current
      .then(() => saveState(fullState))
      .then(() => notifyTabs())
      .catch((cause) => setError(`Could not save changes: ${String(cause)}`));
  }, [fullState, ready]);

  const { snapshots, refreshSnapshots } = useAutoBackup({ ready, stateRef, onError: setError });

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: cards and boards are triggers, so new due dates and rules apply at once.
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
  const filterCount = activeFilterCount(boardFilter);

  function updateFilter(change: Partial<BoardFilter>) {
    if (!boardId) return;
    setBoardFilters((current) => ({
      ...current,
      [boardId]: { ...(current[boardId] ?? emptyBoardFilter()), ...change },
    }));
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: fileVersion is a trigger that reloads the image after files change.
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

  function confirmDelete(withDependents: boolean) {
    const deleted = trash.confirmDelete(withDependents);
    if (!deleted) return;
    const { kind, id } = deleted;
    if (kind === "card" && cardId === id) setCardId(null);
    if (kind === "board" && boardId === id)
      navigate(`/w/${fullState.boards.find((item) => item.id === id)?.workspaceId ?? ""}`);
    if (kind === "workspace" && page.page === "workspace" && page.id === id) navigate("/");
    setNotice(`“${deleted.name}” moved to trash.`);
  }

  function downloadText(content: string, name: string, type: string) {
    saveFile(new Blob([content], { type }), name).catch((cause) =>
      setError(`Could not save “${name}”: ${String(cause)}`),
    );
  }

  function createWorkspace(name: string) {
    if (!name) return;
    navigate(`/w/${boardActions.createWorkspace(name)}`);
  }

  function createBoard(name: string, workspaceId = defaultWorkspaceId) {
    if (!name) return;
    setBoardId(boardActions.createBoard(name, workspaceId));
  }

  function submitBoardCopy(options: BoardCopyOptions) {
    if (!board || !options.name.trim()) return;
    setBoardId(boardActions.copyBoardTo(board.id, options));
    setBoardCopy(null);
  }

  function openCreation(kind: "workspace" | "board", workspaceId?: string) {
    setCreation({ kind, workspaceId });
  }

  function togglePanel(target: PanelName) {
    panels.toggle(target);
    setCardId(null);
  }

  function showBoard(target: string) {
    setBoardId(target);
    panels.deactivate();
  }

  /** Shows a card over its board, or over the Inbox panel when it is an inbox card. */
  function openCardInPlace(item: Card) {
    if (item.boardId === inboxBoardId) panels.show("inbox");
    else showBoard(item.boardId);
    setCardId(item.id);
  }

  /** Handles the mobile board picker, which also lists the Inbox and Planner panels. */
  function pickBoard(value: string) {
    if (value === inboxBoardId) panels.show("inbox");
    else if (value === plannerViewId) panels.show("planner");
    else {
      panels.deactivate();
      setBoardId(value || null);
    }
    setCardId(null);
  }

  function openArchive(targetBoardId: string) {
    setArchiveBoardId(targetBoardId);
    setPanel("archive");
  }

  function submitCreation(name: string) {
    if (!creation) return;
    if (creation.kind === "workspace") createWorkspace(name);
    else createBoard(name, creation.workspaceId);
    setCreation(null);
  }

  function updateBoard(change: (item: Board) => Board) {
    if (board) boardActions.updateBoard(board.id, change);
  }

  function openBoardAbout() {
    if (!board) return;
    setBoardAboutOpen(true);
  }

  function saveBoardDescription(description: string) {
    if (board && description !== board.description) updateBoard((item) => ({ ...item, description }));
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
    boardActions.reopenBoard(id);
    setBoardId(id);
    setClosedBoardsOpen(false);
  }

  function moveZoneTo(zoneId: string, targetListId: string, after: boolean) {
    if (board) boardActions.moveZoneTo(board.id, zoneId, targetListId, after);
  }

  /** `value`: a zone id, "none" to leave the zone, or "new" to create a zone for this list. */
  function setListZone(listId: string, value: string) {
    if (!board) return;
    if (value === "new") {
      const name = prompt("Zone name, e.g. “Development”")?.trim();
      if (name) boardActions.createZoneForList(board.id, listId, name);
      return;
    }
    boardActions.setListZone(listId, value === "none" ? undefined : value);
  }

  function changeZone(zoneId: string, change: { name?: string; color?: string }) {
    if (board) boardActions.changeZone(board.id, zoneId, change);
  }

  function removeZone(zone: Zone) {
    if (board && confirm(`Remove zone “${zone.name}”? Lists and cards will stay on the board.`))
      boardActions.removeZone(board.id, zone.id);
  }

  function runListAction(listId: string, action: string) {
    if (action === "name" || action === "due") sortList(listId, action);
    else if (action === "move-left") moveListByOne(listId, -1);
    else if (action === "move-right") moveListByOne(listId, 1);
    else if (action === "copy") copyListOnBoard(listId);
    else if (action === "delete") requestDelete("list", listId);
    else if (action.startsWith("zone:")) setListZone(listId, action.slice(5));
  }

  const listActions: ListActions = {
    rename: (listId, name) => updateList(listId, (item) => ({ ...item, name })),
    run: runListAction,
    archive: (listId) => updateList(listId, (item) => ({ ...item, archived: true })),
    dropZone: moveZoneTo,
    dropList: moveList,
    dropCard: cardActions.dropCardInList,
    startCard: (listId) => {
      setEditingCardList(listId);
      setEditingList(false);
      setDraft("");
    },
    cancelCard: () => {
      setEditingCardList(null);
      setDraft("");
    },
    createCard,
    createFromTemplate: addCardFromTemplate,
  };

  function renderList(list: BoardList) {
    return (
      <ListColumn
        key={list.id}
        list={list}
        zones={board?.zones ?? []}
        cards={cardsByList.get(list.id) ?? []}
        labels={labelMap}
        members={board?.members}
        cardById={cardById}
        tileActions={tileActions}
        templates={boardTemplates}
        composing={editingCardList === list.id}
        draft={draft}
        onDraft={setDraft}
        actions={listActions}
      />
    );
  }

  function moveListByOne(id: string, direction: -1 | 1) {
    const index = lists.findIndex((item) => item.id === id);
    const target = lists[index + direction];
    if (target) moveList(id, target.id, direction === 1);
  }

  function moveOrCopyCard(id: string, targetListId: string, copy: boolean) {
    const moved = cardActions.moveOrCopyCard(id, targetListId, copy);
    if (!moved) return;
    if (moved.boardId === inboxBoardId) panels.show("inbox");
    else showBoard(moved.boardId);
    setCardId(moved.targetId);
  }

  function createList() {
    if (!board || !draft.trim()) return;
    boardActions.createList(board.id, draft.trim(), Math.max(0, ...lists.map((item) => item.position)) + 1);
    setDraft("");
    setEditingList(false);
  }

  function createCard(listId: string) {
    if (!board || !draft.trim()) return;
    cardActions.createCard(board.id, listId, draft.trim());
    setDraft("");
    setEditingCardList(null);
  }

  function createProposedCards(items: ProposedCard[]) {
    cardActions.createProposedCards(items);
    setNotice(`Cards created: ${items.length}`);
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

  function restore(revision: Revision) {
    boardActions.restore(revision);
    setPanel(null);
  }

  function openImport() {
    setImporting(true);
  }

  const team: Member[] = [
    { id: localDeviceId.current, name: localAuthor || "This device" },
    ...sync.trustedDevices.map((device) => ({ id: device.deviceId, name: device.name })),
  ];
  const cardActionsWithFilters: CardActions = {
    ...cardActions,
    removeLabel: (id) => {
      const label = state.labels.find((item) => item.id === id);
      cardActions.removeLabel(id);
      if (label)
        setBoardFilters((current) =>
          current[label.boardId]?.labelId === id
            ? { ...current, [label.boardId]: { ...current[label.boardId], labelId: "" } }
            : current,
        );
    },
  };
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
      onNavigateCard={openCardInPlace}
      onTransfer={(targetListId, copy) => moveOrCopyCard(card.id, targetListId, copy)}
      onArchive={() => {
        if (confirm(`Archive card “${card.name}”?`)) {
          updateCard(card.id, (item) => ({ ...item, archived: true }));
          setCardId(null);
        }
      }}
      onHistory={() => setPanel("history")}
      team={team}
      onOpenDoc={() => navigate(boardHref(card.boardId, { view: "doc" }))}
      onClone={() => setCloneRequest(card.id)}
    />
  ) : null;
  const trashCount = useMemo(
    () =>
      [fullState.workspaces, fullState.boards, fullState.lists, fullState.cards].reduce(
        (sum, items) => sum + items.filter((item) => item.deletedAt).length,
        0,
      ),
    [fullState],
  );

  const appMenu: AppMenuActions = {
    onImport: openImport,
    onBackup: () => {
      setBackupOpen(true);
      void refreshSnapshots();
    },
    onSettings: () => setSettingsOpen(true),
    onSync: () => setSyncOpen(true),
    onAi: () => setAiOpen(true),
    onDedupe: () => setDedupeOpen(true),
    onAuthor: () => setAuthorDialogOpen(true),
    onClosedBoards: () => setClosedBoardsOpen(true),
  };

  if (!ready) return <main className="startup">{error || "Loading local data…"}</main>;
  return (
    <CardActionsContext value={cardActionsWithFilters}>
      <div className="app-shell">
        <AppHeader
          state={state}
          boardId={boardId}
          shownPanels={shownPanels}
          onPickBoard={pickBoard}
          onCreate={() => openCreation("board")}
          reminderCount={reminders.length}
          onOpenReminders={() => {
            setNow(Date.now());
            setRemindersOpen(true);
          }}
          menu={appMenu}
          closedBoardCount={closedBoards.length}
          search={search}
          onSearch={setSearch}
          trashActive={page.page === "trash"}
          trashCount={trashCount}
          sync={sync}
          navigate={navigate}
        />
        {search.trim() && (
          <SearchResults
            state={state}
            query={search}
            onOpenWorkspace={(id) => {
              navigate(`/w/${id}`);
              setSearch("");
            }}
            onOpenBoard={(id) => {
              showBoard(id);
              setCardId(null);
              setSearch("");
            }}
            onOpenCard={(item) => {
              openCardInPlace(item);
              setSearch("");
            }}
          />
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
          <Sidebar
            state={state}
            shownPanels={shownPanels}
            page={page.page}
            workspaceId={page.page === "workspace" ? page.id : null}
            boardId={boardId}
            onTogglePanel={togglePanel}
            onCreateWorkspace={() => openCreation("workspace")}
            onCreateBoard={(workspaceId) => openCreation("board", workspaceId)}
            onOpenBoard={(id) => {
              showBoard(id);
              setCardId(null);
            }}
            navigate={navigate}
          />
          {shownPanels.map((name) => (
            <PanelSlot key={name} name={name} layout={panels}>
              {name === "inbox" ? (
                <InboxView
                  state={state}
                  onCreate={createInboxCard}
                  onOpen={setCardId}
                  onOpenArchive={() => openArchive(inboxBoardId)}
                />
              ) : (
                <PlannerView state={state} onOpen={openCardInPlace} />
              )}
            </PanelSlot>
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
                <BoardToolbar
                  board={board}
                  view={page.page === "board" ? page.view : undefined}
                  scale={page.page === "board" ? page.scale : "month"}
                  navigate={navigate}
                  onUpdate={updateBoard}
                  onOpenAbout={openBoardAbout}
                  keyword={boardFilter.keyword}
                  onKeyword={(keyword) => updateFilter({ keyword })}
                  filterCount={filterCount}
                  filterOpen={filterOpen}
                  onToggleFilter={() => setFilterOpen((current) => !current)}
                  menu={{
                    onArchive: () => openArchive(board.id),
                    onClose: closeBoard,
                    onCopy: () =>
                      setBoardCopy({
                        name: `${board.name} (copy)`,
                        workspaceId: board.workspaceId,
                        keepCards: true,
                        keepTemplates: true,
                      }),
                    onAutomation: () => setAutomationBoardId(board.id),
                    onActivity: () => setActivityBoardId(board.id),
                    onHistory: () => setPanel("history"),
                    onExport: exportBoard,
                    onTrash: () => requestDelete("board", board.id),
                    onBackgroundFile: (file) => void uploadBoardBackground(file),
                    onBackgroundColor: (background) =>
                      updateBoard((item) => ({ ...item, background, backgroundImageId: undefined })),
                  }}
                />
                {filterOpen && (
                  <BoardFilterPanel
                    state={state}
                    board={board}
                    filter={boardFilter}
                    shown={filteredCardIds.size}
                    total={boardCardCount}
                    onChange={updateFilter}
                    onClose={() => setFilterOpen(false)}
                  />
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
                onRestore={trash.restore}
                onPurge={trash.purge}
                onEmpty={trash.empty}
              />
            ) : page.page === "card" ? (
              (cardDialog ?? <MissingPage what="Card not found" />)
            ) : page.page === "not-found" ? (
              <MissingPage what="Page not found" />
            ) : (
              <HomePage
                state={state}
                onOpen={(id) => navigate(`/w/${id}`)}
                onCreate={() => openCreation("workspace")}
              />
            )}
          </main>
        </div>
        {card && !cardAsPage && cardDialog}
        {cloneSource && (
          <CloneCardDialog
            name={cloneSource.name}
            copyName={cloneCardName(state, cloneSource.id)}
            onConfirm={confirmClone}
            onCancel={() => setCloneRequest(undefined)}
          />
        )}
        {trash.pendingDelete && (
          <DeleteDialog
            kind={trash.pendingDelete.kind}
            name={trash.pendingDelete.name}
            impact={trash.pendingDelete.impact}
            onConfirm={confirmDelete}
            onCancel={trash.cancelDelete}
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
          <BoardAboutPanel board={board} onSave={saveBoardDescription} onClose={() => setBoardAboutOpen(false)} />
        )}
        {closedBoardsOpen && (
          <ClosedBoardsPanel
            boards={closedBoards}
            workspaces={state.workspaces}
            onRestore={restoreClosedBoard}
            onClose={() => setClosedBoardsOpen(false)}
          />
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
          <RemindersPanel
            reminders={reminders}
            onOpen={(item) => {
              openCardInPlace(item);
              setRemindersOpen(false);
            }}
            onDismiss={(item) =>
              setDismissedReminders((current) => ({ ...current, [item.id]: reminderSignature(item) }))
            }
            onClose={() => setRemindersOpen(false)}
          />
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
        {panel === "archive" && (
          <ArchivePanel
            cards={state.cards.filter((item) => item.boardId === (archiveBoardId ?? boardId) && item.archived)}
            lists={state.lists.filter((item) => item.boardId === (archiveBoardId ?? boardId) && item.archived)}
            onRestoreCard={(id) => updateCard(id, (current) => ({ ...current, archived: false }))}
            onRestoreList={(id) => updateList(id, (current) => ({ ...current, archived: false }))}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === "history" && (
          <HistoryPanel
            revisions={state.revisions.filter((item) => item.entityId === (card?.id ?? boardId))}
            onRestore={restore}
            onClose={() => setPanel(null)}
          />
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
        {syncOpen && <SyncDialog sync={sync} onClose={() => setSyncOpen(false)} />}
        {backupOpen && (
          <BackupDialog
            getState={() => stateRef.current}
            beforeExport={() => queue.current}
            onRestored={(restored) => {
              stateRef.current = restored;
              setState(restored);
              setFileVersion((current) => current + 1);
            }}
            snapshots={snapshots}
            onRefreshSnapshots={refreshSnapshots}
            conflicts={backupConflicts}
            onConflictsFound={setBackupConflicts}
            onChooseConflict={(conflict, version) => {
              setState((current) => chooseConflict(current, conflict, version, localDeviceId.current));
              setBackupConflicts((current) => current.filter((item) => item !== conflict));
            }}
            onOpenSettings={() => {
              setBackupOpen(false);
              setSettingsOpen(true);
            }}
            onClose={() => setBackupOpen(false)}
          />
        )}
        {authorDialogOpen && (
          <AuthorDialog
            name={localAuthor}
            onSave={(name) => {
              setLocalAuthor(saveLocalAuthor(name));
              setAuthorDialogOpen(false);
            }}
            onClose={() => setAuthorDialogOpen(false)}
          />
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
          <BoardCopyDialog
            initial={boardCopy}
            workspaces={state.workspaces.filter((item) => item.id !== inboxWorkspaceId && !item.archived)}
            onCopy={submitBoardCopy}
            onClose={() => setBoardCopy(null)}
          />
        )}
        {creation && (
          <CreationDialog kind={creation.kind} onCreate={submitCreation} onClose={() => setCreation(null)} />
        )}
      </div>
    </CardActionsContext>
  );
}

export default App;
