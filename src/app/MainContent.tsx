import type { ReactNode } from "react";
import type { AiSettings } from "../ai/ai";
import type { ProposedCard } from "../board/AiPanel";
import { BoardView } from "../board/BoardView";
import type { TileActions } from "../board/CardTile";
import type { TrashedCard } from "../card/CardDialog";
import { t } from "../i18n";
import { trashHref } from "../lib/router";
import { saveAttachment } from "../lib/storage";
import { type Card, newId, recordRevision } from "../model";
import { HomePage } from "../pages/HomePage";
import { MissingPage } from "../pages/MissingPage";
import { TrashPage } from "../pages/TrashPage";
import { WorkspacePage } from "../pages/WorkspacePage";
import { useApp } from "./AppContext";
import type { BoardViewData } from "./useBoardView";

/** The page in the main area: a board, a workspace, the trash, a card shown as a page, or the home page. */
export function MainContent({
  view,
  tileActions,
  aiSettings,
  cardPage,
  trashedCardDialog,
  backgroundUrl,
}: {
  view: BoardViewData;
  tileActions: TileActions;
  aiSettings: AiSettings | null;
  /** The card dialog when a card's address was opened directly, without a page behind it. */
  cardPage: ReactNode;
  /** The card dialog of a card in the trash, opened from the Trash page. */
  trashedCardDialog: (card: Card, trash: TrashedCard, onClose: () => void) => ReactNode;
  backgroundUrl?: string;
}) {
  const app = useApp();
  const { state, fullState, page, navigate, overlays, boardActions } = app;
  const board = view.board;

  async function uploadBoardBackground(file: File | null) {
    if (!board || !file) return;
    if (!file.type.startsWith("image/")) {
      app.setError(t("app.backgroundNotImage"));
      return;
    }
    const id = newId();
    try {
      await saveAttachment(id, file);
      boardActions.updateBoard(board.id, (item) => ({ ...item, backgroundImageId: id }));
    } catch (cause) {
      app.setError(t("app.backgroundSaveError", { cause: String(cause) }));
    }
  }

  function createProposedCards(items: ProposedCard[]) {
    app.cardActions.createProposedCards(items);
    app.setNotice(t("app.cardsCreated", { count: items.length }));
  }

  return (
    <main
      className={
        app.panels.shownPanels.length
          ? "relative flex min-w-0 flex-1 flex-col max-phone:hidden"
          : "relative flex min-w-0 flex-1 flex-col"
      }
      style={{
        backgroundColor: board?.background ?? "#f7f8f9",
        backgroundImage: backgroundUrl ? `url("${backgroundUrl}")` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {board && page.page === "board" ? (
        <BoardView
          state={state}
          board={board}
          route={page}
          view={view}
          navigate={navigate}
          tileActions={tileActions}
          boardActions={boardActions}
          cardActions={app.cardActions}
          aiSettings={aiSettings}
          menu={{
            onCopy: () =>
              overlays.open({
                boardCopy: {
                  name: t("app.boardCopyName", { name: board.name }),
                  workspaceId: board.workspaceId,
                  keepCards: true,
                  keepTemplates: true,
                },
              }),
            onAutomation: () => overlays.open({ automationBoardId: board.id }),
            onActivity: () => overlays.open({ activityBoardId: board.id }),
            onAnalytics: () => overlays.open({ analyticsBoardId: board.id }),
            onPriorities: () => overlays.open({ prioritiesBoardId: board.id }),
            onShareLabels: () => overlays.open({ shareLabelsBoardId: board.id }),
            onCleanLabels: () => overlays.open({ cleanLabelsBoardId: board.id }),
            onRequiredFields: () => overlays.open({ requiredFieldsBoardId: board.id }),
            onSettings: () => overlays.open({ settingsBoardId: board.id }),
            onHistory: () => overlays.open({ history: true }),
            onExport: () => overlays.open({ exportBoardId: board.id }),
            onTrash: () => app.trash.requestDelete("board", board.id),
            onBackgroundFile: (file) => void uploadBoardBackground(file),
            onBackgroundColor: (background) =>
              boardActions.updateBoard(board.id, (item) => ({ ...item, background, backgroundImageId: undefined })),
          }}
          visitors={
            app.sync.peerPresence?.boardId === board.id
              ? [
                  {
                    id: app.sync.peerPresence.deviceId,
                    name: app.sync.peerPresence.name,
                    cardName: state.cards.find((item) => item.id === app.sync.peerPresence?.cardId)?.name,
                  },
                ]
              : []
          }
          onOpenAbout={() => overlays.open({ boardAbout: true })}
          onOpenCard={(item) => app.setCardId(item.id)}
          onOpenAiSettings={() => overlays.open({ ai: true })}
          onCreateProposedCards={createProposedCards}
          onDeleteCard={(item) => app.trash.requestDelete("card", item.id)}
          onDeleteList={(listId) => app.trash.requestDelete("list", listId)}
        />
      ) : page.page === "board" ? (
        <MissingPage what={t("app.boardNotFound")} />
      ) : page.page === "workspace" ? (
        <WorkspacePage
          state={state}
          workspaceId={page.id}
          onOpenBoard={(id) => app.setBoardId(id)}
          onCreateBoard={() => overlays.open({ creation: { kind: "board", workspaceId: page.id } })}
          onRename={(name) =>
            app.setState((current) =>
              recordRevision(
                {
                  ...current,
                  workspaces: current.workspaces.map((item) => (item.id === page.id ? { ...item, name } : item)),
                },
                "workspace",
                page.id,
                app.deviceId,
              ),
            )
          }
          onDelete={() => app.trash.requestDelete("workspace", page.id)}
        />
      ) : page.page === "trash" ? (
        <TrashPage
          state={fullState}
          kind={page.kind}
          onKind={(kind) => navigate(trashHref(kind), { replace: true })}
          onRestore={app.trash.restore}
          onPurge={app.trash.purge}
          onEmpty={app.trash.empty}
          cardDialog={trashedCardDialog}
        />
      ) : page.page === "card" ? (
        (cardPage ?? <MissingPage what={t("app.cardNotFound")} />)
      ) : page.page === "not-found" ? (
        <MissingPage what={t("app.pageNotFound")} />
      ) : (
        <HomePage
          state={state}
          onOpen={(id) => navigate(`/w/${id}`)}
          onCreate={() => overlays.open({ creation: { kind: "workspace" } })}
        />
      )}
    </main>
  );
}
