import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { readAiSettings, type AiSettings } from "../ai/ai";
import { t } from "../i18n";
import type { TileActions } from "../board/CardTile";
import { CardActionsContext } from "../card/CardActionsContext";
import { CardDialog, type TrashedCard } from "../card/CardDialog";
import { useAutoBackup } from "../hooks/useAutoBackup";
import { useBoardActions } from "../hooks/useBoardActions";
import { type CardActions, useCardActions } from "../hooks/useCardActions";
import { useDeviceSync } from "../hooks/useDeviceSync";
import { usePanelLayout } from "../hooks/usePanelLayout";
import { useTrash } from "../hooks/useTrash";
import { AppHeader, type AppMenuActions, plannerViewId } from "../layout/AppHeader";
import { PanelSlot } from "../layout/PanelSlot";
import { SearchResults } from "../layout/SearchResults";
import { Sidebar } from "../layout/Sidebar";
import { boardHref, type Route, useRoute } from "../lib/router";
import { readLocalAuthor } from "../lib/storage";
import { readDismissedReminders, type PanelName } from "../lib/uiPreferences";
import type { Card, Member } from "../model";
import { applyDueRules } from "../model/automation";
import { inboxBoardId, inboxListId, inboxWorkspaceId } from "../model/inbox";
import { dueReminders } from "../model/reminders";
import { purgeExpired } from "../model/trash";
import { recordView } from "../model/views";
import { useViewPreferences } from "../lib/viewPreferences";
import { InboxView } from "../panels/InboxView";
import { PlannerView } from "../panels/PlannerView";
import { AppContext, type AppServices } from "./AppContext";
import { AppOverlays } from "./AppOverlays";
import { AskDialogHost } from "../ui/AskDialog";
import { MainContent } from "./MainContent";
import { StatusBanners } from "./StatusBanners";
import { useAppState } from "./useAppState";
import { useBoardBackground } from "./useBoardBackground";
import { useBoardView } from "./useBoardView";
import { useClock } from "./useClock";
import { useNotice } from "./useNotice";
import { useOverlays } from "./useOverlays";
import { loadTrashRetention, useTrashRetention } from "../lib/trashRetention";
import "../styles/index.css";

/**
 * The app shell. It owns the data, the route and the open dialogs, wires the change hooks together and lays out the
 * header, sidebar, side panels and main area; the pieces live in `app/`, `board/`, `layout/` and `hooks/`.
 */
function App() {
  const [error, setError] = useState("");
  const { notice, noticeCardId, setNotice, setNoticeCardId } = useNotice();
  // Both callbacks run in effects after the first render, when `panels` and `sync` below exist.
  const { fullState, state, setState, ready, localDeviceId, stateRef, queue } = useAppState({
    onLoaded: () => panels.restore(),
    onSaved: () => sync.notifyTabs(),
    onError: setError,
  });
  const { route, navigate, back } = useRoute();
  const page: Route = route.page === "card" ? (route.background ?? { page: "card", id: route.id }) : route;
  const boardId = page.page === "board" ? page.id : null;
  const cardId = route.page === "card" ? route.id : null;
  const cardAsPage = route.page === "card" && !route.background;

  const [search, setSearch] = useState("");
  const [localAuthor, setLocalAuthor] = useState(readLocalAuthor);
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(readAiSettings);
  const [fileVersion, setFileVersion] = useState(0);
  const bumpFileVersion = () => setFileVersion((current) => current + 1);
  const overlays = useOverlays();

  const sync = useDeviceSync({
    ready,
    state: fullState,
    stateRef,
    setState,
    deviceId: localDeviceId,
    authorName: localAuthor,
    presence: { boardId: boardId ?? undefined, cardId: cardId ?? undefined },
    onFilesChanged: bumpFileVersion,
    onError: setError,
  });
  const panels = usePanelLayout({ ready, onError: setError });
  const cardActions = useCardActions({
    state,
    setState,
    deviceId: localDeviceId,
    onError: setError,
    onNotice: setNotice,
  });
  const boardActions = useBoardActions({ setState, deviceId: localDeviceId });
  const trash = useTrash({ fullState, setState, deviceId: localDeviceId, onNotice: setNotice });
  const { snapshots, refreshSnapshots, backupAsk, saveDueBackup, skipDueBackup } = useAutoBackup({
    ready,
    stateRef,
    onError: setError,
    onNotice: setNotice,
  });

  // Reminders, due-date rules and the trash purge (after the days set in Settings) follow the clock.
  const clock = useClock();
  const retentionDays = useTrashRetention();
  useEffect(() => {
    loadTrashRetention().catch((cause) => reportError(t("app.trashSettingsError", { cause: String(cause) })));
  }, []);
  const [dismissedReminders, setDismissedReminders] = useState<Record<string, string>>(readDismissedReminders);
  const reportError = useEffectEvent(setError);
  useEffect(() => {
    try {
      localStorage.setItem("kanbonk-dismissed-reminders", JSON.stringify(dismissedReminders));
    } catch (cause) {
      reportError(t("app.remindersSaveError", { cause: String(cause) }));
    }
  }, [dismissedReminders]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: cards and boards are triggers, so new due dates and rules apply at once.
  useEffect(() => {
    if (!ready) return;
    setState((current) => {
      const next = applyDueRules(current, clock.now, localDeviceId);
      return retentionDays === undefined ? next : purgeExpired(next, localDeviceId, clock.now, retentionDays);
    });
  }, [ready, clock.now, state.boards, state.cards, retentionDays]);
  const reminders = useMemo(
    () => dueReminders(state, clock.now, dismissedReminders),
    [state, clock.now, dismissedReminders],
  );

  // Counts a visit to the open board and a view of the open card; opening them again soon after counts once.
  const { track: trackViews } = useViewPreferences();
  const countView = useEffectEvent((kind: "board" | "card", id: string) =>
    setState((current) => {
      const boardOfView =
        kind === "board"
          ? current.boards.find((item) => item.id === id && !item.deletedAt)?.id
          : current.cards.find((item) => item.id === id && !item.deletedAt)?.boardId;
      return boardOfView
        ? recordView(current, {
            kind,
            entityId: id,
            boardId: boardOfView,
            deviceId: localDeviceId,
            author: localAuthor,
          })
        : current;
    }),
  );
  // A board or card opened before it reaches the data (a new board, an import) counts once it arrives.
  const boardKnown = state.boards.some((item) => item.id === boardId);
  const cardKnown = state.cards.some((item) => item.id === cardId);
  useEffect(() => {
    if (ready && trackViews && boardId && boardKnown) countView("board", boardId);
  }, [ready, trackViews, boardId, boardKnown]);
  useEffect(() => {
    if (ready && trackViews && cardId && cardKnown) countView("card", cardId);
  }, [ready, trackViews, cardId, cardKnown]);

  // Card ages change by the week, so the hour is fine enough and spares re-rendering the board every tick.
  const view = useBoardView(state, boardId, setError, Math.floor(clock.now / 3_600_000) * 3_600_000);
  const backgroundUrl = useBoardBackground(view.board?.backgroundImageId, fileVersion, setError);
  const card = state.cards.find((item) => item.id === cardId && !item.deletedAt);
  const defaultWorkspaceId = state.workspaces.find((item) => item.id !== inboxWorkspaceId && !item.deletedAt)?.id;
  const trashCount = useMemo(
    () =>
      [fullState.workspaces, fullState.boards, fullState.lists, fullState.cards].reduce(
        (sum, items) => sum + items.filter((item) => item.deletedAt).length,
        0,
      ),
    [fullState],
  );
  useEffect(() => {
    document.title = t("app.documentTitle");
  }, []);

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

  function showBoard(target: string) {
    setBoardId(target);
    panels.deactivate();
  }

  function openCardInPlace(item: Card) {
    if (item.boardId === inboxBoardId) panels.show("inbox");
    else showBoard(item.boardId);
    setCardId(item.id);
  }

  function togglePanel(target: PanelName) {
    panels.toggle(target);
    setCardId(null);
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

  function moveOrCopyCard(id: string, targetListId: string, copy: boolean, top = false, position?: number) {
    const moved = cardActions.moveOrCopyCard(id, targetListId, copy, top, position);
    if (!moved) return;
    if (moved.boardId === inboxBoardId) panels.show("inbox");
    else showBoard(moved.boardId);
    setCardId(moved.targetId);
  }

  // Card tiles are memoized, so they get stable handlers that call the latest ones.
  const tileHandlers = useRef<TileActions>({ open: () => undefined });
  tileHandlers.current = {
    open: (id) => setCardId(id),
  };
  const tileActions = useMemo<TileActions>(
    () => ({
      open: (id) => tileHandlers.current.open(id),
    }),
    [],
  );

  const cardActionsWithFilters: CardActions = {
    ...cardActions,
    removeLabel: (id) => {
      const label = state.labels.find((item) => item.id === id);
      cardActions.removeLabel(id);
      if (label) view.forgetLabel(label.boardId, id);
    },
  };
  const team: Member[] = [
    { id: localDeviceId, name: localAuthor || t("app.thisDevice") },
    ...sync.trustedDevices.map((device) => ({ id: device.deviceId, name: device.name })),
  ];
  const cardDialog = card ? (
    <CardDialog
      key={card.id}
      card={card}
      asPage={cardAsPage}
      onDelete={() => trash.requestDelete("card", card.id)}
      authorName={localAuthor}
      currentDeviceId={localDeviceId}
      state={state}
      lists={state.lists.filter((item) => item.boardId === card.boardId && !item.deletedAt)}
      onClose={() => setCardId(null)}
      onNavigateCard={openCardInPlace}
      onTransfer={(targetListId, copy, top, position) => moveOrCopyCard(card.id, targetListId, copy, top, position)}
      onHistory={() => overlays.open({ history: true })}
      team={team}
      onOpenDoc={() => navigate(boardHref(card.boardId, { view: "doc" }))}
      onClone={() => overlays.open({ cloneCardId: card.id })}
    />
  ) : null;
  /** A card in the trash, opened from the Trash page: the same dialog, read-only; its list may be trashed too. */
  const trashedCardDialog = (item: Card, trashed: TrashedCard, onClose: () => void) => (
    <CardDialog
      key={item.id}
      card={item}
      trash={trashed}
      onDelete={trashed.onPurge}
      authorName={localAuthor}
      currentDeviceId={localDeviceId}
      state={fullState}
      lists={fullState.lists.filter(
        (list) => list.boardId === item.boardId && (!list.deletedAt || list.id === item.listId),
      )}
      onClose={onClose}
      onNavigateCard={openCardInPlace}
      onTransfer={() => undefined}
      onHistory={() => undefined}
      team={team}
      onOpenDoc={() => undefined}
      onClone={() => undefined}
    />
  );

  const appMenu: AppMenuActions = {
    onImport: () => overlays.open({ import: true }),
    onBackup: () => {
      overlays.open({ backup: true });
      void refreshSnapshots();
    },
    onSettings: () => overlays.open({ settings: true }),
    onSync: () => overlays.open({ sync: true }),
    onAi: () => overlays.open({ ai: true }),
    onDedupe: () => overlays.open({ dedupe: true }),
    onAuthor: () => overlays.open({ author: true }),
  };

  const services: AppServices = {
    fullState,
    state,
    setState,
    stateRef,
    queue,
    deviceId: localDeviceId,
    route,
    page,
    boardId,
    navigate,
    setBoardId,
    setCardId,
    openCardInPlace,
    showBoard,
    panels,
    boardActions,
    cardActions,
    trash,
    sync,
    overlays,
    setNotice,
    setNoticeCardId,
    setError,
    fileVersion,
    bumpFileVersion,
    localAuthor,
    setLocalAuthor,
  };

  if (!ready) return <main className="grid min-h-dvh place-items-center">{error || t("app.loading")}</main>;
  return (
    <AppContext value={services}>
      <CardActionsContext value={cardActionsWithFilters}>
        <div className="flex h-dvh flex-col overflow-hidden">
          <AppHeader
            state={state}
            boardId={boardId}
            shownPanels={panels.shownPanels}
            onPickBoard={pickBoard}
            onCreate={() => overlays.open({ creation: { kind: "board" } })}
            reminderCount={reminders.length}
            onOpenReminders={() => {
              clock.refresh();
              overlays.open({ reminders: true });
            }}
            menu={appMenu}
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
          <StatusBanners
            notice={notice}
            noticeCardId={noticeCardId}
            onDismissNotice={() => setNotice("")}
            onOpenCard={setCardId}
            backupAsk={backupAsk}
            onSaveBackup={() => void saveDueBackup()}
            onSkipBackup={() => void skipDueBackup()}
            error={error}
            onDismissError={() => setError("")}
          />
          {/* `panel-open` is a hook for the board toolbar's rules. */}
          <div className={panels.shownPanels.length ? "panel-open flex min-h-0 flex-1" : "flex min-h-0 flex-1"}>
            <Sidebar
              state={state}
              shownPanels={panels.shownPanels}
              page={page.page}
              workspaceId={page.page === "workspace" ? page.id : null}
              boardId={boardId}
              onTogglePanel={togglePanel}
              onCreateWorkspace={() => overlays.open({ creation: { kind: "workspace" } })}
              onCreateBoard={(workspaceId) => overlays.open({ creation: { kind: "board", workspaceId } })}
              onOpenBoard={(id) => {
                showBoard(id);
                setCardId(null);
              }}
              navigate={navigate}
            />
            {panels.shownPanels.map((name) => (
              <PanelSlot key={name} name={name} layout={panels}>
                {name === "inbox" ? (
                  <InboxView
                    state={state}
                    onCreate={cardActions.createInboxCard}
                    onOpen={setCardId}
                    onDropCard={(id) => cardActions.moveOrCopyCard(id, inboxListId, false)}
                  />
                ) : (
                  <PlannerView state={state} onOpen={openCardInPlace} />
                )}
              </PanelSlot>
            ))}
            <MainContent
              view={view}
              tileActions={tileActions}
              aiSettings={aiSettings}
              cardPage={cardDialog}
              trashedCardDialog={trashedCardDialog}
              backgroundUrl={backgroundUrl}
            />
          </div>
          {card && !cardAsPage && cardDialog}
          <AppOverlays
            card={card}
            reminders={reminders}
            onDismissReminder={(item, signature) =>
              setDismissedReminders((current) => ({ ...current, [item.id]: signature }))
            }
            aiSettings={aiSettings}
            onAiSettings={setAiSettings}
            snapshots={snapshots}
            onRefreshSnapshots={refreshSnapshots}
            defaultWorkspaceId={defaultWorkspaceId}
          />
          <AskDialogHost />
        </div>
      </CardActionsContext>
    </AppContext>
  );
}

export default App;
