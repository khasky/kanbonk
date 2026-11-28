import { useState } from "react";
import { ExtendBoardDialog } from "../dialogs/ExtendBoardDialog";
import { t } from "../i18n";
import { type AppState, expiredBoards, type Lifetime } from "../model";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { useStoredSet } from "./useStoredSet";

/**
 * A message over the app for each temporary board whose time ran out and that went to the trash, until it is
 * dismissed on this device; **Extend** brings the board back for a new time or for good.
 */
export function ExpiredBoards({
  state,
  onExtend,
}: {
  state: AppState;
  onExtend: (boardId: string, lifetime: Lifetime | undefined) => void;
}) {
  const [dismissed, dismiss] = useStoredSet("kanbonk-expired-boards-seen");
  const [extending, setExtending] = useState<{ id: string; name: string } | null>(null);
  const shown = expiredBoards(state).filter((board) => !dismissed.has(`${board.id}:${board.deletedAt}`));
  return (
    <>
      {shown.length > 0 && (
        <div className="fixed top-[58px] left-1/2 z-[110] grid w-[min(520px,calc(100vw-32px))] -translate-x-1/2 gap-2">
          {shown.map((board) => (
            <div
              key={board.id}
              className="flex items-center gap-3 rounded-[5px] border border-[#f5cd47] bg-[#fff7d6] px-3 py-2.5 text-[14px] text-[#533f04] shadow-popover"
              role="alert"
            >
              <span className="min-w-0 flex-1 wrap-anywhere">{t("board.boardExpired", { name: board.name })}</span>
              <Button variant="primary" onClick={() => setExtending({ id: board.id, name: board.name })}>
                {t("board.extend")}
              </Button>
              <Button
                variant="text"
                onClick={() => dismiss(`${board.id}:${board.deletedAt}`)}
                aria-label={t("app.dismissMessage")}
              >
                <Icon name="close" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {extending && (
        <ExtendBoardDialog
          name={extending.name}
          onExtend={(lifetime) => {
            onExtend(extending.id, lifetime);
            setExtending(null);
          }}
          onClose={() => setExtending(null)}
        />
      )}
    </>
  );
}
