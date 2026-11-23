import { type AppState, type Board, type BoardFilter, emptyBoardFilter } from "../model";
import { Icon } from "../ui/Icon";
import { Button } from "../ui/Button";
import { SectionTitle } from "../ui/SectionTitle";
import { Input, Select } from "../ui/Field";

const labelClass = "grid gap-[5px] font-semibold";

/** Filters the cards shown on a board by text, label, member and due date. */
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
    <section
      className="absolute top-[58px] right-3 z-20 grid w-[min(320px,calc(100vw-24px))] gap-3 rounded-lg border border-line bg-white p-4 text-ink shadow-overlay"
      aria-label="Board filter"
    >
      <SectionTitle>
        <strong>Board filter</strong>
        <Button variant="secondary" className="grid place-items-center" onClick={onClose} aria-label="Close filter">
          <Icon name="close" />
        </Button>
      </SectionTitle>
      <label className={labelClass}>
        Text
        <Input
          type="search"
          size="sm"
          value={filter.keyword}
          onChange={(event) => onChange({ keyword: event.target.value })}
          placeholder="Title or content"
        />
      </label>
      <label className={labelClass}>
        Label
        <Select size="sm" value={filter.labelId} onChange={(event) => onChange({ labelId: event.target.value })}>
          <option value="">All labels</option>
          {state.labels
            .filter((item) => item.boardId === board.id && !item.deleted)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || item.color}
              </option>
            ))}
        </Select>
      </label>
      <label className={labelClass}>
        Member
        <Select
          size="sm"
          value={filter.memberId ?? ""}
          onChange={(event) => onChange({ memberId: event.target.value })}
        >
          <option value="">All members</option>
          {(board.members ?? []).map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </Select>
      </label>
      <label className={labelClass}>
        Due date
        <Select
          size="sm"
          value={filter.due}
          onChange={(event) => onChange({ due: event.target.value as BoardFilter["due"] })}
        >
          <option value="any">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="next-week">Next 7 days</option>
          <option value="none">No due date</option>
        </Select>
      </label>
      <div className="flex items-center justify-between gap-2 text-ink-subtle">
        <span>
          Showing {shown} of {total}
        </span>
        <Button variant="secondary" onClick={() => onChange(emptyBoardFilter())}>
          Reset
        </Button>
      </div>
    </section>
  );
}

/** How many filter conditions are set. */
export const activeFilterCount = (filter: BoardFilter) =>
  Number(Boolean(filter.keyword.trim())) +
  Number(Boolean(filter.labelId)) +
  Number(Boolean(filter.memberId)) +
  Number(filter.due !== "any");
