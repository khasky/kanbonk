import type { AppState } from "../model";
import { trashDaysLeft, trashEntries, trashRetentionDays, type TrashKind } from "../model/trash";
import { Button } from "../ui/Button";
import { Hint } from "../ui/Hint";
import { PanelRow, PanelRowNote, PanelRowText, RowActions } from "../ui/PanelRow";
import { Segmented, SegmentedTab } from "../ui/Segmented";
import { emptyClass, pageClass, pageHeaderClass } from "./pageLook";

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
  const all = trashEntries(state);
  const entries = kind ? all.filter((item) => item.kind === kind) : all;
  return (
    <section className={pageClass} aria-label="Trash">
      <header className={pageHeaderClass}>
        <h1 className="m-0 flex-1 text-[24px]">Trash</h1>
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
                <strong>{entry.name}</strong>
                <PanelRowNote>
                  {kindNames[entry.kind]}
                  {entry.context ? ` · ${entry.context}` : ""} · trashed{" "}
                  {new Date(entry.deletedAt).toLocaleString("en-US")}
                  {entry.withParent ? " · with its parent" : ""} · deleted in {trashDaysLeft(entry.deletedAt)} days
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
        Items stay in the trash for {trashRetentionDays} days, then are deleted forever. Restoring cascades: an item
        comes back together with its deleted parents (workspace, board, list), everything deleted along with it, and the
        cards it depends on.
      </Hint>
    </section>
  );
}
