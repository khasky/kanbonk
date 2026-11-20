import { type AppState, type Board, type BoardFilter, emptyBoardFilter } from "../model";
import { Icon } from "../ui/Icon";

/** Filters the cards shown on a board by text, label, member, completion and due date. */
export function BoardFilterPanel({
  state,
  board,
  filter,
  shown,
  total,
  onChange,
  onClose,
}: {
  state: AppState;
  board: Board;
  filter: BoardFilter;
  /** How many cards pass the filter, out of `total` on the board. */
  shown: number;
  total: number;
  onChange: (change: Partial<BoardFilter>) => void;
  onClose: () => void;
}) {
  return (
    <section className="board-filter" aria-label="Board filter">
      <div className="section-title">
        <strong>Board filter</strong>
        <button onClick={onClose} aria-label="Close filter">
          <Icon name="close" />
        </button>
      </div>
      <label>
        Text
        <input
          type="search"
          value={filter.keyword}
          onChange={(event) => onChange({ keyword: event.target.value })}
          placeholder="Title or content"
        />
      </label>
      <label>
        Label
        <select value={filter.labelId} onChange={(event) => onChange({ labelId: event.target.value })}>
          <option value="">All labels</option>
          {state.labels
            .filter((item) => item.boardId === board.id && !item.deleted)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || item.color}
              </option>
            ))}
        </select>
      </label>
      <label>
        Member
        <select value={filter.memberId ?? ""} onChange={(event) => onChange({ memberId: event.target.value })}>
          <option value="">All members</option>
          {(board.members ?? []).map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select
          value={filter.status}
          onChange={(event) => onChange({ status: event.target.value as BoardFilter["status"] })}
        >
          <option value="all">All cards</option>
          <option value="complete">Completed</option>
          <option value="incomplete">Not completed</option>
        </select>
      </label>
      <label>
        Due date
        <select value={filter.due} onChange={(event) => onChange({ due: event.target.value as BoardFilter["due"] })}>
          <option value="any">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="next-week">Next 7 days</option>
          <option value="none">No due date</option>
        </select>
      </label>
      <div className="filter-footer">
        <span>
          Showing {shown} of {total}
        </span>
        <button onClick={() => onChange(emptyBoardFilter())}>Reset</button>
      </div>
    </section>
  );
}

/** How many filter conditions are set. */
export const activeFilterCount = (filter: BoardFilter) =>
  Number(Boolean(filter.keyword.trim())) +
  Number(Boolean(filter.labelId)) +
  Number(Boolean(filter.memberId)) +
  Number(filter.status !== "all") +
  Number(filter.due !== "any");
