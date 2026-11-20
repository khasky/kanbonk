import type { Board, Workspace } from "../model";
import { SidePanel } from "../ui/Modal";

export function ClosedBoardsPanel({
  boards,
  workspaces,
  onRestore,
  onClose,
}: {
  boards: Board[];
  workspaces: Workspace[];
  onRestore: (boardId: string) => void;
  onClose: () => void;
}) {
  return (
    <SidePanel title="Closed boards" onClose={onClose}>
      {boards.length ? (
        boards.map((item) => (
          <div className="panel-row" key={item.id}>
            <span>
              <strong>{item.name}</strong>
              <small>{workspaces.find((workspace) => workspace.id === item.workspaceId)?.name}</small>
            </span>
            <button onClick={() => onRestore(item.id)}>Restore</button>
          </div>
        ))
      ) : (
        <p>No closed boards.</p>
      )}
    </SidePanel>
  );
}
