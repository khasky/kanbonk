import type { AppState } from "../model";
import { trashDaysLeft, trashEntries, trashRetentionDays, type TrashKind } from "../trash";

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
    <section className="page trash-page" aria-label="Trash">
      <header className="page-header">
        <h1>Trash</h1>
        {all.length > 0 && (
          <button className="danger-button" onClick={onEmpty}>
            Empty trash
          </button>
        )}
      </header>
      <div className="segmented" role="tablist" aria-label="Category">
        <button role="tab" aria-selected={!kind} onClick={() => onKind(undefined)}>
          All ({all.length})
        </button>
        {(Object.keys(kindNames) as TrashKind[]).map((item) => (
          <button key={item} role="tab" aria-selected={kind === item} onClick={() => onKind(item)}>
            {kindNames[item]} ({all.filter((entry) => entry.kind === item).length})
          </button>
        ))}
      </div>
      {entries.length ? (
        <div className="trash-list">
          {entries.map((entry) => (
            <div className="panel-row trash-row" key={`${entry.kind}:${entry.id}`}>
              <span>
                <strong>{entry.name}</strong>
                <small>
                  {kindNames[entry.kind]}
                  {entry.context ? ` · ${entry.context}` : ""} · trashed{" "}
                  {new Date(entry.deletedAt).toLocaleString("en-US")}
                  {entry.withParent ? " · with its parent" : ""} · deleted in {trashDaysLeft(entry.deletedAt)} days
                </small>
              </span>
              <span className="row-actions">
                <button onClick={() => onRestore(entry.kind, entry.id)}>Restore</button>
                <button className="danger-button" onClick={() => onPurge(entry.kind, entry.id)}>
                  Delete forever
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-page">Trash is empty.</p>
      )}
      <p className="hint">
        Items stay in the trash for {trashRetentionDays} days, then are deleted forever. Restoring cascades: an item
        comes back together with its deleted parents (workspace, board, list), everything deleted along with it, and the
        cards it depends on.
      </p>
    </section>
  );
}
