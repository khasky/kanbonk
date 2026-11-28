import { useState } from "react";
import { TemporaryBadge } from "../board/TemporaryBadge";
import { MissingPage } from "./MissingPage";
import { AppLink } from "../ui/AppLink";
import { boardHref } from "../lib/router";
import { t } from "../i18n";
import { type AppState, backdropFill, type Board, type Fill } from "../model";
import { inboxWorkspaceId } from "../model/inbox";
import { Button } from "../ui/Button";
import { FillPicker } from "../ui/FillPicker";
import { Popover } from "../ui/Popover";
import { useFillStyle } from "../ui/useFileUrl";
import { WorkspaceAvatar } from "../ui/WorkspaceAvatar";
import { boardTileClass, emptyClass, pageClass, pageHeaderClass, pageHeadingClass, tileGridClass } from "./pageLook";
import { NameEditor } from "../ui/NameEditor";

/** A board's tile in its background, the text in a color that reads on it. */
function BoardTile({ board, onOpen }: { board: Board; onOpen: () => void }) {
  return (
    <AppLink
      className={boardTileClass}
      style={useFillStyle(backdropFill(board), true)}
      href={boardHref(board.id)}
      onOpen={onOpen}
    >
      <span className="flex min-w-0 flex-col items-start gap-2">
        <strong>{board.name}</strong>
        {board.expiresAt && <TemporaryBadge expiresAt={board.expiresAt} />}
      </span>
      {board.starred && <span aria-label={t("pages.starred")}>★</span>}
    </AppLink>
  );
}

export function WorkspacePage({
  state,
  workspaceId,
  onOpenBoard,
  onCreateBoard,
  onRename,
  onFill,
  onUpload,
  onDelete,
}: {
  state: AppState;
  workspaceId: string;
  onOpenBoard: (id: string) => void;
  onCreateBoard: () => void;
  onRename: (name: string) => void;
  /** Sets the workspace's color, gradient or image; undefined goes back to the default. */
  onFill: (fill: Fill | undefined) => void;
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return <MissingPage what={t("pages.workspaceNotFound")} />;
  const boards = state.boards.filter((board) => board.workspaceId === workspace.id && !board.deletedAt);
  const fill = backdropFill(workspace);
  return (
    <section className={pageClass} aria-label={workspace.name}>
      <header className={pageHeaderClass}>
        <Button
          variant="text"
          aria-label={t("pages.workspaceColor")}
          title={t("pages.workspaceColor")}
          aria-expanded={Boolean(pickerAnchor)}
          onClick={(event) => {
            const anchor = event.currentTarget;
            setPickerAnchor((current) => (current ? null : anchor));
          }}
        >
          <WorkspaceAvatar workspace={workspace} size="lg" />
        </Button>
        {pickerAnchor && (
          <Popover title={t("pages.workspaceColor")} anchor={pickerAnchor} onClose={() => setPickerAnchor(null)}>
            <FillPicker
              value={fill.color || fill.gradient || fill.imageId ? fill : undefined}
              onChange={onFill}
              onUpload={onUpload}
              removeLabel={t("pages.defaultWorkspaceColor")}
              onRemove={() => onFill(undefined)}
            />
          </Popover>
        )}
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
            <BoardTile key={board.id} board={board} onOpen={() => onOpenBoard(board.id)} />
          ))}
          <Button variant="create-tile" onClick={onCreateBoard}>
            {t("pages.createBoardTile")}
          </Button>
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
