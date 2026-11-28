import { useState } from "react";
import { BoardLifetimeField, defaultLifetime } from "../board/BoardLifetimeField";
import { t } from "../i18n";
import type { Lifetime } from "../model";
import { Button } from "../ui/Button";
import { Dialog, submitWith } from "../ui/Modal";

/** Brings a temporary board whose time ran out back from the trash, for a new time or for good. */
export function ExtendBoardDialog({
  name,
  onExtend,
  onClose,
}: {
  name: string;
  /** A new lifetime, or undefined to keep the board for good. */
  onExtend: (lifetime: Lifetime | undefined) => void;
  onClose: () => void;
}) {
  const [lifetime, setLifetime] = useState<Lifetime | undefined>(defaultLifetime);
  const title = t("board.extendTitle", { name });
  return (
    <Dialog label={title} className="grid gap-3.5" onDismiss={onClose} onSubmit={submitWith(() => onExtend(lifetime))}>
      <h2 className="mx-0 mt-0 mb-1 text-[20px]">{title}</h2>
      <BoardLifetimeField value={lifetime} onChange={setLifetime} />
      <div className="mt-1 flex justify-end gap-2">
        <Button variant="secondary" size="lg" type="button" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" type="submit">
          {t("board.restoreBoard")}
        </Button>
      </div>
    </Dialog>
  );
}
