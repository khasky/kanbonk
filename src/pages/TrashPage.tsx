import { useState } from "react";
import { useTrashRetention } from "../lib/trashRetention";
import type { AppState } from "../model";
import { trashDaysLeft, trashEntries, trashRetentionDays, type TrashKind } from "../model/trash";
import { Button } from "../ui/Button";
import { Hint } from "../ui/Hint";
import { PanelRow, PanelRowNote, PanelRowText, RowActions } from "../ui/PanelRow";
import { Segmented, SegmentedTab } from "../ui/Segmented";
import { emptyClass, pageClass, pageHeaderClass } from "./pageLook";
import { TrashedCardDialog } from "./TrashedCardDialog";

const kindNames: Record<TrashKind, string> = { workspace: "Workspaces", board: "Boards", list: "Lists", card: "Cards" };

export function TrashPage({
  state,
  kind,
  onKind,
  onRestore,
  onPurge,
  onEmpty,
}: {
  state: AppState;
  kind?: TrashKind;
  onKind: (kind?: TrashKind) => void;
  onRestore: (kind: TrashKind, id: string) => void;
  onPurge: (kind: TrashKind, id: string) => void;
  onEmpty: () => void;
}) {
  const days = useTrashRetention() ?? trashRetentionDays;
  const [viewedCardId, setViewedCardId] = useState<string>();
  const viewedCard = state.cards.find((item) => item.id === viewedCardId && item.deletedAt);
  const all = trashEntries(state);
  const entries = kind ? all.filter((item) => item.kind === kind) : all;
  return (
    <section className={pageClass} aria-label="Trash">
      <header className={pageHeaderClass}>
        <div className="flex-1">
          <h1 className="m-0 text-[24px]">Trash</h1>
          <p className="mt-1 mb-0 text-[13px] text-ink-subtle">
            Items are deleted forever {days} days after they were moved here. Change it in ⋯ → Settings.
          </p>
        </div>
        {all.length > 0 && (
          <Button variant="danger" onClick={onEmpty}>
            Empty trash
          </Button>
        )}
      </header>
      <Segmented label="Category">
        <SegmentedTab selected={!kind} onClick={() => onKind(undefined)}>
          All ({all.length})
        </SegmentedTab>
        {(Object.keys(kindNames) as TrashKind[]).map((item) => (
          <SegmentedTab key={item} selected={kind === item} onClick={() => onKind(item)}>
            {kindNames[item]} ({all.filter((entry) => entry.kind === item).length})
          </SegmentedTab>
        ))}
      </Segmented>
      {entries.length ? (
        <div className="mt-4 flex flex-col gap-1.5">
          {entries.map((entry) => (
            <PanelRow look="boxed" key={`${entry.kind}:${entry.id}`}>
              <PanelRowText className="flex flex-col gap-[3px]">
                {entry.kind === "card" ? (
                  <button
                    type="button"
                    className="self-start border-0 bg-transparent p-0 text-left font-semibold text-ink hover:underline"
                    onClick={() => setViewedCardId(entry.id)}
                  >
                    {entry.name}
                  </button>
                ) : (
                  <strong>{entry.name}</strong>
                )}
                <PanelRowNote>
                  {kindNames[entry.kind]}
                  {entry.context ? ` · ${entry.context}` : ""} · trashed{" "}
                  {new Date(entry.deletedAt).toLocaleString("en-US")}
                  {entry.withParent ? " · with its parent" : ""} · deleted in{" "}
                  {trashDaysLeft(entry.deletedAt, undefined, days)} days
                </PanelRowNote>
              </PanelRowText>
              <RowActions as="span" className="min-w-0 wrap-anywhere">
                <Button variant="secondary" className="flex-none" onClick={() => onRestore(entry.kind, entry.id)}>
                  Restore
                </Button>
                <Button variant="danger" size="sm" className="flex-none" onClick={() => onPurge(entry.kind, entry.id)}>
                  Delete forever
                </Button>
              </RowActions>
            </PanelRow>
          ))}
        </div>
      ) : (
        <p className={emptyClass}>Trash is empty.</p>
      )}
      <Hint>
        Open a card to see its contents; it can be edited again once restored. Restoring cascades: an item comes back
        together with its deleted parents (workspace, board, list), everything deleted along with it, and the cards it
        depends on.
      </Hint>
      {viewedCard && (
        <TrashedCardDialog
          card={viewedCard}
          state={state}
          daysLeft={trashDaysLeft(viewedCard.deletedAt!, undefined, days)}
          // The dialog closes by itself once the card leaves the trash.
          onRestore={() => onRestore("card", viewedCard.id)}
          onPurge={() => onPurge("card", viewedCard.id)}
          onClose={() => setViewedCardId(undefined)}
        />
      )}
    </section>
  );
}
