import { type AppState, type Board, type BoardFilter, emptyBoardFilter, priorities } from "../model";
import { priorityName } from "../card/PriorityPicker";
import { Icon } from "../ui/Icon";
import { Button } from "../ui/Button";
import { SectionTitle } from "../ui/SectionTitle";
import { Input, Select } from "../ui/Field";
import { t } from "../i18n";

const labelClass = "grid gap-[5px] font-semibold";

/** Filters the cards shown on a board by text, label, member, priority and due date. */
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
      aria-label={t("board.boardFilter")}
    >
      <SectionTitle>
        <strong>{t("board.boardFilter")}</strong>
        <Button
          variant="secondary"
          className="grid place-items-center"
          onClick={onClose}
          aria-label={t("board.closeFilter")}
        >
          <Icon name="close" />
        </Button>
      </SectionTitle>
      <label className={labelClass}>
        {t("board.filterText")}
        <Input
          type="search"
          size="sm"
          value={filter.keyword}
          onChange={(event) => onChange({ keyword: event.target.value })}
          placeholder={t("board.filterTextPlaceholder")}
        />
      </label>
      <label className={labelClass}>
        {t("board.label")}
        <Select size="sm" value={filter.labelId} onChange={(event) => onChange({ labelId: event.target.value })}>
          <option value="">{t("board.allLabels")}</option>
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
        {t("board.member")}
        <Select
          size="sm"
          value={filter.memberId ?? ""}
          onChange={(event) => onChange({ memberId: event.target.value })}
        >
          <option value="">{t("board.allMembers")}</option>
          {(board.members ?? []).map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </Select>
      </label>
      <label className={labelClass}>
        {t("priority.title")}
        <Select
          size="sm"
          value={filter.priority ?? ""}
          onChange={(event) => onChange({ priority: event.target.value as BoardFilter["priority"] })}
        >
          <option value="">{t("priority.any")}</option>
          {priorities.map((priority) => (
            <option key={priority} value={priority}>
              {priorityName(priority)}
            </option>
          ))}
          <option value="none">{t("priority.none")}</option>
        </Select>
      </label>
      <label className={labelClass}>
        {t("approvals.title")}
        <Select
          size="sm"
          value={filter.approval ?? ""}
          onChange={(event) => onChange({ approval: event.target.value as BoardFilter["approval"] })}
        >
          <option value="">{t("approvals.any")}</option>
          <option value="pending">{t("approvals.pending")}</option>
          <option value="approved">{t("approvals.approved")}</option>
          <option value="declined">{t("approvals.declined")}</option>
          <option value="none">{t("approvals.none")}</option>
        </Select>
      </label>
      <label className={labelClass}>
        {t("board.dueDate")}
        <Select
          size="sm"
          value={filter.due}
          onChange={(event) => onChange({ due: event.target.value as BoardFilter["due"] })}
        >
          <option value="any">{t("board.anyDueDate")}</option>
          <option value="overdue">{t("board.overdue")}</option>
          <option value="next-week">{t("board.next7Days")}</option>
          <option value="none">{t("board.noDueDate")}</option>
        </Select>
      </label>
      <div className="flex items-center justify-between gap-2 text-ink-subtle">
        <span>{t("board.showingOf", { shown, total })}</span>
        <Button variant="secondary" onClick={() => onChange(emptyBoardFilter())}>
          {t("board.reset")}
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
  Number(Boolean(filter.priority)) +
  Number(Boolean(filter.approval)) +
  Number(filter.due !== "any");
