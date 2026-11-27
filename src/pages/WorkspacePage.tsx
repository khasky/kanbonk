import { MissingPage } from "./MissingPage";
import { AppLink } from "../ui/AppLink";
import { boardHref } from "../lib/router";
import { t } from "../i18n";
import type { AppState } from "../model";
import { inboxWorkspaceId } from "../model/inbox";
import { Button } from "../ui/Button";
import { WorkspaceAvatar } from "../ui/WorkspaceAvatar";
import {
  boardTileClass,
  createTileClass,
  emptyClass,
  pageClass,
  pageHeaderClass,
  pageHeadingClass,
  tileGridClass,
} from "./pageLook";
import { NameEditor } from "../ui/NameEditor";

export function WorkspacePage({
  state,
  workspaceId,
  onOpenBoard,
  onCreateBoard,
  onRename,
  onDelete,
}: {
  state: AppState;
  workspaceId: string;
  onOpenBoard: (id: string) => void;
  onCreateBoard: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return <MissingPage what={t("pages.workspaceNotFound")} />;
  const boards = state.boards.filter((board) => board.workspaceId === workspace.id && !board.deletedAt);
  return (
    <section className={pageClass} aria-label={workspace.name}>
      <header className={pageHeaderClass}>
        <WorkspaceAvatar name={workspace.name} size="lg" />
        <NameEditor
          className="flex-1 rounded-sm border border-transparent px-2 py-1.5 text-[22px] font-bold text-ink hover:border-ink-faint focus:border-ink-faint"
          label={t("pages.workspaceName")}
          value={workspace.name}
          onCommit={onRename}
        />
        {workspace.id !== inboxWorkspaceId && (
          <Button variant="danger" onClick={onDelete}>
            {t("pages.moveToTrash")}
          </Button>
        )}
      </header>
      <h2 className={pageHeadingClass}>{t("pages.boards")}</h2>
      {boards.length ? (
        <div className={tileGridClass}>
          {boards.map((board) => (
            <AppLink
              key={board.id}
              className={boardTileClass}
              style={{ background: board.background }}
              href={boardHref(board.id)}
              onOpen={() => onOpenBoard(board.id)}
            >
              <strong>{board.name}</strong>
              {board.starred && <span aria-label={t("pages.starred")}>★</span>}
            </AppLink>
          ))}
          <button className={createTileClass} onClick={onCreateBoard}>
            {t("pages.createBoardTile")}
          </button>
        </div>
      ) : (
        <div className={emptyClass}>
          <p>{t("pages.noBoardsYet")}</p>
          <Button variant="primary" onClick={onCreateBoard}>
            {t("pages.addBoard")}
          </Button>
        </div>
      )}
    </section>
  );
}
