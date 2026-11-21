import type { ReactNode } from "react";
import type { AiSettings } from "../ai/ai";
import type { ProposedCard } from "../board/AiPanel";
import { BoardView } from "../board/BoardView";
import type { TileActions } from "../board/CardTile";
import { exportTrelloCsv, exportTrelloJson } from "../trello/formats";
import { saveFile } from "../lib/platform";
import { trashHref } from "../lib/router";
import { saveAttachment } from "../lib/storage";
import { newId, recordRevision } from "../model";
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
  backgroundUrl,
}: {
  view: BoardViewData;
  tileActions: TileActions;
  aiSettings: AiSettings | null;
  /** The card dialog when a card's address was opened directly, without a page behind it. */
  cardPage: ReactNode;
  backgroundUrl?: string;
}) {
  const app = useApp();
  const { state, fullState, page, navigate, overlays, boardActions } = app;
  const board = view.board;

  function downloadText(content: string, name: string, type: string) {
    saveFile(new Blob([content], { type }), name).catch((cause) =>
      app.setError(`Could not save “${name}”: ${String(cause)}`),
    );
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

  async function uploadBoardBackground(file: File | null) {
    if (!board || !file) return;
    if (!file.type.startsWith("image/")) {
      app.setError("Choose an image for the background.");
      return;
    }
    const id = newId();
    try {
      await saveAttachment(id, file);
      boardActions.updateBoard(board.id, (item) => ({ ...item, backgroundImageId: id }));
    } catch (cause) {
      app.setError(`Could not save the board background: ${String(cause)}`);
    }
  }

  function createProposedCards(items: ProposedCard[]) {
    app.cardActions.createProposedCards(items);
    app.setNotice(`Cards created: ${items.length}`);
  }

  return (
    <main
      className="main-area"
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
                  name: `${board.name} (copy)`,
                  workspaceId: board.workspaceId,
                  keepCards: true,
                  keepTemplates: true,
                },
              }),
            onAutomation: () => overlays.open({ automationBoardId: board.id }),
            onActivity: () => overlays.open({ activityBoardId: board.id }),
            onHistory: () => overlays.open({ history: true }),
            onExport: exportBoard,
            onTrash: () => app.trash.requestDelete("board", board.id),
            onBackgroundFile: (file) => void uploadBoardBackground(file),
            onBackgroundColor: (background) =>
              boardActions.updateBoard(board.id, (item) => ({ ...item, background, backgroundImageId: undefined })),
          }}
          onOpenAbout={() => overlays.open({ boardAbout: true })}
          onOpenCard={(item) => app.setCardId(item.id)}
          onOpenAiSettings={() => overlays.open({ ai: true })}
          onCreateProposedCards={createProposedCards}
          onDeleteCard={(item) => app.trash.requestDelete("card", item.id)}
          onDeleteList={(listId) => app.trash.requestDelete("list", listId)}
        />
      ) : page.page === "board" ? (
        <MissingPage what="Board not found" />
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
        />
      ) : page.page === "card" ? (
        (cardPage ?? <MissingPage what="Card not found" />)
      ) : page.page === "not-found" ? (
        <MissingPage what="Page not found" />
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
