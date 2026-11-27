import { Fragment, type MouseEvent, type ReactNode, useState } from "react";
import { formatDate, formatDateTime, t } from "../i18n";
import type { CardActions } from "../hooks/useCardActions";
import { localDateTime } from "../lib/format";
import { saveFile } from "../lib/platform";
import { type AppState, type Board, type BoardFilter, type Card, type Priority, priorities } from "../model";
import { exportFileName } from "../export/exportData";
import { MemberAvatar } from "../card/MemberPicker";
import { PriorityPicker, priorityName } from "../card/PriorityPicker";
import { fieldLabelClass } from "../dialogs/dialogLook";
import { askConfirm } from "../ui/AskDialog";
import { Button } from "../ui/Button";
import { Checkbox, Input, Select } from "../ui/Field";
import { Hint } from "../ui/Hint";
import { Icon } from "../ui/Icon";
import { LabelChip } from "../ui/LabelChip";
import { MixedCheckbox } from "../ui/MixedCheckbox";
import { Popover } from "../ui/Popover";
import { Table, Td, Th } from "../ui/Table";
import { NewCardForm } from "./NewCardForm";
import {
  applyTick,
  checklistProgress,
  columnNames,
  defaultColumns,
  sortRows,
  type TableColumn,
  type TableRow,
  type TableSort,
  tableColumns,
  tableCsv,
  tableRows,
  tickState,
  workspaceBoards,
} from "./tableView";

const columnsKey = "kanbonk-table-columns";
const boardsKey = "kanbonk-table-boards";

function readStored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be full or blocked; the choice then lasts until the page is reloaded.
  }
}

const isoFromInput = (value: string) => (value ? new Date(value).toISOString() : undefined);

type Tick = "all" | "some" | "none";
type Open = {
  kind: "columns" | "boards" | "add" | "labels" | "members" | "move" | "due" | "priority";
  anchor: HTMLElement;
};

/** Ticks of the labels or members of one board on the ticked cards, to apply together. */
function TickList({
  items,
  cards,
  has,
  onApply,
}: {
  items: Array<{ id: string; name: string; chip: ReactNode }>;
  cards: Card[];
  has: (card: Card, id: string) => boolean;
  onApply: (ticks: Record<string, Tick>) => void;
}) {
  const [ticks, setTicks] = useState<Record<string, Tick>>(() =>
    Object.fromEntries(items.map((item) => [item.id, tickState(cards, (card) => has(card, item.id))])),
  );
  return (
    <div className="grid gap-2">
      {items.map((item) => {
        const tick = ticks[item.id];
        const count = cards.filter((card) => has(card, item.id)).length;
        return (
          <label key={item.id} className="flex cursor-pointer items-center gap-2.5">
            <MixedCheckbox
              mixed={tick === "some"}
              checked={tick === "all"}
              aria-label={item.name}
              onChange={() => setTicks((current) => ({ ...current, [item.id]: tick === "all" ? "none" : "all" }))}
            />
            {item.chip}
            {tick === "some" && <Hint as="small">{t("table.onCount", { count, total: cards.length })}</Hint>}
          </label>
        );
      })}
      <Hint className="m-0">{t("table.mixedHint")}</Hint>
      <Button variant="primary" className="justify-self-start" onClick={() => onApply(ticks)}>
        {t("table.apply", { count: cards.length })}
      </Button>
    </div>
  );
}

/**
 * The board's cards (as its filter shows them), and optionally those of other boards of its workspace, as a table:
 * sorted by any column, edited in place, ticked to change together, exported as CSV.
 */
export function BoardTable({
  state,
  board,
  filter,
  cardActions,
  onOpenCard,
  onError,
}: {
  state: AppState;
  board: Board;
  filter: BoardFilter;
  cardActions: CardActions;
  onOpenCard: (card: Card) => void;
  onError: (message: string) => void;
}) {
  const [columns, setColumns] = useState<TableColumn[]>(() =>
    readStored<TableColumn[]>(columnsKey, defaultColumns).filter((column) => tableColumns.includes(column)),
  );
  const [boardChoice, setBoardChoice] = useState<Record<string, string[]>>(() => readStored(boardsKey, {}));
  const [sort, setSort] = useState<TableSort | undefined>();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Open | undefined>();
  const [due, setDue] = useState("");
  const [moveTo, setMoveTo] = useState("");

  const otherBoards = workspaceBoards(state, board.id);
  const otherIds = (boardChoice[board.id] ?? []).filter((id) => otherBoards.some((item) => item.id === id));
  const all = tableRows(state, board.id, otherIds, filter);
  const rows = sort ? sortRows(state, all, sort) : all;
  const shown = otherIds.length ? (["board", ...columns] as TableColumn[]) : columns;
  const tickedRows = rows.filter((row) => ticked.has(row.card.id));
  const tickedCards = tickedRows.map((row) => row.card);
  const tickedBoards = new Set(tickedCards.map((card) => card.boardId));
  const oneBoard = tickedBoards.size === 1 ? state.boards.find((item) => tickedBoards.has(item.id)) : undefined;
  const oneBoardLists = oneBoard
    ? state.lists
        .filter((list) => list.boardId === oneBoard.id && !list.deletedAt)
        .sort((a, b) => a.position - b.position)
    : [];
  const boardLists = state.lists
    .filter((list) => list.boardId === board.id && !list.deletedAt)
    .sort((a, b) => a.position - b.position);

  const toggle = (kind: Open["kind"]) => (event: MouseEvent<HTMLElement>) => {
    const anchor = event.currentTarget;
    setOpen((current) => (current?.kind === kind ? undefined : { kind, anchor }));
  };
  const close = () => setOpen(undefined);
  const expanded = (kind: Open["kind"]) => open?.kind === kind;
  const sortBy = (by: TableSort["by"]) =>
    setSort((current) => ({
      by,
      direction: current?.by === by && current.direction === "ascending" ? "descending" : "ascending",
    }));
  const sortOf = (by: TableSort["by"]) => (sort?.by === by ? sort.direction : undefined);
  const update = (card: Card, change: Partial<Card>) =>
    cardActions.updateCard(card.id, (current) => ({ ...current, ...change }));
  const tickAll = tickState(
    rows.map((row) => row.card),
    (card) => ticked.has(card.id),
  );
  const forTicked = (run: (card: Card) => void) => {
    for (const card of tickedCards) run(card);
  };

  function saveColumns(next: TableColumn[]) {
    setColumns(next);
    store(columnsKey, next);
  }

  function saveBoards(next: string[]) {
    const choice = { ...boardChoice, [board.id]: next };
    setBoardChoice(choice);
    store(boardsKey, choice);
  }

  function exportCsv() {
    const name = exportFileName(`${board.name} ${t("table.view")}`, "csv");
    saveFile(new Blob([`﻿${tableCsv(state, rows, shown)}\r\n`], { type: "text/csv" }), name).catch((cause) =>
      onError(t("app.fileSaveError", { name, cause: String(cause) })),
    );
  }

  async function trashTicked() {
    const yes = await askConfirm({
      title: t("table.deleteTitle", { count: tickedCards.length }),
      message: t("table.deleteMessage"),
      confirm: t("table.moveToTrash"),
      danger: true,
    });
    if (!yes) return;
    cardActions.trashCards(tickedCards.map((card) => card.id));
    setTicked(new Set());
  }

  function cell(row: TableRow, column: TableColumn) {
    const { card } = row;
    const lists = state.lists
      .filter((list) => list.boardId === card.boardId && !list.deletedAt)
      .sort((a, b) => a.position - b.position);
    switch (column) {
      case "board":
        return <Td muted>{row.board?.name}</Td>;
      case "list":
        return (
          <Td>
            <Select
              size="sm"
              aria-label={t("table.listOf", { name: card.name })}
              value={card.listId}
              onChange={(event) => cardActions.moveOrCopyCard(card.id, event.target.value, false)}
            >
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </Select>
          </Td>
        );
      case "labels":
        return (
          <Td>
            <span className="flex flex-wrap gap-1">
              {card.labelIds.map((id) => {
                const label = state.labels.find((item) => item.id === id && !item.deleted);
                return label && <LabelChip key={id} label={label} size="sm" className="whitespace-nowrap" />;
              })}
            </span>
          </Td>
        );
      case "members":
        return (
          <Td>
            <span className="flex flex-wrap gap-1">
              {(card.memberIds ?? []).map((id) => {
                const member = row.board?.members?.find((item) => item.id === id);
                return member && <MemberAvatar key={id} member={member} />;
              })}
            </span>
          </Td>
        );
      case "start":
      case "due": {
        const value = column === "start" ? card.startAt : card.dueAt;
        return (
          <Td>
            <Input
              size="sm"
              type="datetime-local"
              aria-label={t(column === "start" ? "table.startOf" : "table.dueOf", { name: card.name })}
              value={value ? localDateTime(value) : ""}
              onChange={(event) =>
                update(
                  card,
                  column === "start"
                    ? { startAt: isoFromInput(event.target.value) }
                    : {
                        dueAt: isoFromInput(event.target.value),
                        dueReminderMinutes: event.target.value ? card.dueReminderMinutes : undefined,
                      },
                )
              }
            />
          </Td>
        );
      }
      case "priority":
        return (
          <Td>
            <Select
              size="sm"
              aria-label={t("table.priorityOf", { name: card.name })}
              value={card.priority ?? ""}
              onChange={(event) =>
                update(card, { priority: (event.target.value || undefined) as Priority | undefined })
              }
            >
              <option value="">{t("table.none")}</option>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityName(priority)}
                </option>
              ))}
            </Select>
          </Td>
        );
      case "done":
        return (
          <Td title={card.doneAt ? formatDateTime(card.doneAt) : undefined}>
            <Checkbox
              aria-label={t("table.doneOf", { name: card.name })}
              checked={Boolean(card.doneAt)}
              onChange={() => (card.doneAt ? cardActions.reopenCardDone(card.id) : cardActions.finishCardDone(card.id))}
            />
          </Td>
        );
      case "checklist": {
        const { done, total } = checklistProgress(card);
        return (
          <Td muted className="whitespace-nowrap tabular-nums">
            {total ? `${done}/${total}` : ""}
          </Td>
        );
      }
      case "attachments":
        return (
          <Td muted className="tabular-nums">
            {card.attachments.length || ""}
          </Td>
        );
      case "comments":
        return (
          <Td muted className="tabular-nums">
            {card.comments.length || ""}
          </Td>
        );
      case "created":
        return (
          <Td muted className="whitespace-nowrap">
            {card.createdAt && formatDate(card.createdAt)}
          </Td>
        );
    }
  }

  return (
    <section
      className="mx-3 mt-0 mb-3 flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden rounded-[10px] bg-white p-3 text-ink"
      aria-label={t("table.region")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" aria-expanded={expanded("columns")} onClick={toggle("columns")}>
          {t("table.columns")}
        </Button>
        <Button variant="secondary" aria-expanded={expanded("boards")} onClick={toggle("boards")}>
          {otherIds.length ? `${t("table.boards")} (${otherIds.length + 1})` : t("table.boards")}
        </Button>
        <Button variant="secondary" onClick={exportCsv}>
          {t("table.exportCsv")}
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="ml-auto flex items-center gap-1"
          aria-expanded={expanded("add")}
          onClick={toggle("add")}
        >
          <Icon name="plus" className="size-4" />
          {t("table.addCard")}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length ? (
          <Table>
            <thead className="sticky top-0 z-[1] bg-white">
              <tr>
                <Th className="w-8">
                  <MixedCheckbox
                    aria-label={t("table.tickAll")}
                    mixed={tickAll === "some"}
                    checked={tickAll === "all"}
                    onChange={() => setTicked(tickAll === "all" ? new Set() : new Set(rows.map((row) => row.card.id)))}
                  />
                </Th>
                <Th sort={sortOf("name")} onSort={() => sortBy("name")}>
                  {t(columnNames.name)}
                </Th>
                {shown.map((column) => (
                  <Th key={column} sort={sortOf(column)} onSort={() => sortBy(column)}>
                    {t(columnNames[column])}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.card.id} className={ticked.has(row.card.id) ? "bg-brand-soft" : undefined}>
                  <Td>
                    <Checkbox
                      aria-label={t("table.tick", { name: row.card.name })}
                      checked={ticked.has(row.card.id)}
                      onChange={() =>
                        setTicked((current) => {
                          const next = new Set(current);
                          if (!next.delete(row.card.id)) next.add(row.card.id);
                          return next;
                        })
                      }
                    />
                  </Td>
                  <Td className="max-w-[280px] min-w-[160px]">
                    <Button
                      variant="link-quiet"
                      className="text-left text-[14px] wrap-anywhere"
                      aria-label={t("table.open", { name: row.card.name })}
                      onClick={() => onOpenCard(row.card)}
                    >
                      {row.card.name}
                    </Button>
                  </Td>
                  {shown.map((column) => (
                    <Fragment key={column}>{cell(row, column)}</Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Hint tone="subtle" className="m-0">
            {t("table.noMatch")}
          </Hint>
        )}
      </div>

      {tickedCards.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-line p-2"
          role="toolbar"
          aria-label={t("table.ticked", { count: tickedCards.length })}
        >
          <strong className="mr-1 text-[14px]">{t("table.ticked", { count: tickedCards.length })}</strong>
          <Button
            variant="secondary"
            disabled={!oneBoard}
            aria-expanded={expanded("labels")}
            onClick={toggle("labels")}
          >
            {t("table.changeLabels")}
          </Button>
          <Button
            variant="secondary"
            disabled={!oneBoard}
            aria-expanded={expanded("members")}
            onClick={toggle("members")}
          >
            {t("table.changeMembers")}
          </Button>
          <Button variant="secondary" disabled={!oneBoard} aria-expanded={expanded("move")} onClick={toggle("move")}>
            {t("table.move")}
          </Button>
          <Button variant="secondary" aria-expanded={expanded("due")} onClick={toggle("due")}>
            {t("table.setDue")}
          </Button>
          <Button variant="secondary" aria-expanded={expanded("priority")} onClick={toggle("priority")}>
            {t("table.setPriority")}
          </Button>
          <Button variant="secondary" onClick={() => forTicked((card) => cardActions.finishCardDone(card.id))}>
            {t("table.markDone")}
          </Button>
          <Button variant="danger" size="sm" onClick={() => void trashTicked()}>
            {t("table.delete")}
          </Button>
          <Button variant="link" className="ml-auto" onClick={() => setTicked(new Set())}>
            {t("table.untick")}
          </Button>
          {!oneBoard && <Hint className="m-0 basis-full">{t("table.oneBoard")}</Hint>}
        </div>
      )}

      <Hint className="m-0" aria-live="polite">
        {`${t("table.count", { count: rows.length })}. ${t("table.hint")}`}
      </Hint>

      {open?.kind === "columns" && (
        <Popover title={t("table.columns")} anchor={open.anchor} onClose={close}>
          <div className="grid gap-2">
            {tableColumns.map((column) => (
              <label key={column} className="flex cursor-pointer items-center gap-2.5">
                <Checkbox
                  checked={columns.includes(column)}
                  onChange={() =>
                    saveColumns(
                      columns.includes(column)
                        ? columns.filter((item) => item !== column)
                        : tableColumns.filter((item) => item === column || columns.includes(item)),
                    )
                  }
                />
                {t(columnNames[column])}
              </label>
            ))}
            <Hint className="m-0">{t("table.columnsHint")}</Hint>
          </div>
        </Popover>
      )}
      {open?.kind === "boards" && (
        <Popover title={t("table.boards")} anchor={open.anchor} onClose={close}>
          <div className="grid gap-2">
            <label className="flex items-center gap-2.5">
              <Checkbox checked disabled />
              {board.name}
            </label>
            {otherBoards.map((item) => (
              <label key={item.id} className="flex cursor-pointer items-center gap-2.5">
                <Checkbox
                  checked={otherIds.includes(item.id)}
                  onChange={() =>
                    saveBoards(
                      otherIds.includes(item.id) ? otherIds.filter((id) => id !== item.id) : [...otherIds, item.id],
                    )
                  }
                />
                {item.name}
              </label>
            ))}
            <Hint className="m-0">{otherBoards.length ? t("table.boardsHint") : t("table.noOtherBoards")}</Hint>
          </div>
        </Popover>
      )}
      {open?.kind === "add" && (
        <Popover title={t("table.addCard")} anchor={open.anchor} onClose={close}>
          <NewCardForm
            title={t("table.addCard")}
            lists={boardLists}
            onCreate={(listId, name) => {
              cardActions.createCard(board.id, listId, name);
              close();
            }}
          />
        </Popover>
      )}
      {open?.kind === "labels" && oneBoard && (
        <Popover title={t("table.labels")} anchor={open.anchor} onClose={close}>
          {(() => {
            const labels = state.labels.filter((label) => label.boardId === oneBoard.id && !label.deleted);
            return labels.length ? (
              <TickList
                items={labels.map((label) => ({
                  id: label.id,
                  name: label.name || label.color,
                  chip: <LabelChip label={label} className="flex-1" />,
                }))}
                cards={tickedCards}
                has={(card, id) => card.labelIds.includes(id)}
                onApply={(ticks) => {
                  forTicked((card) =>
                    update(card, {
                      labelIds: Object.entries(ticks).reduce(
                        (ids, [id, tick]) => applyTick(ids, id, tick),
                        card.labelIds,
                      ),
                    }),
                  );
                  close();
                }}
              />
            ) : (
              <Hint className="m-0">{t("table.noLabels")}</Hint>
            );
          })()}
        </Popover>
      )}
      {open?.kind === "members" && oneBoard && (
        <Popover title={t("table.members")} anchor={open.anchor} onClose={close}>
          {oneBoard.members?.length ? (
            <TickList
              items={oneBoard.members.map((member) => ({
                id: member.id,
                name: member.name,
                chip: (
                  <span className="flex items-center gap-2">
                    <MemberAvatar member={member} />
                    {member.name}
                  </span>
                ),
              }))}
              cards={tickedCards}
              has={(card, id) => Boolean(card.memberIds?.includes(id))}
              onApply={(ticks) => {
                forTicked((card) =>
                  update(card, {
                    memberIds: Object.entries(ticks).reduce(
                      (ids, [id, tick]) => applyTick(ids, id, tick),
                      card.memberIds ?? [],
                    ),
                  }),
                );
                close();
              }}
            />
          ) : (
            <Hint className="m-0">{t("table.noMembers")}</Hint>
          )}
        </Popover>
      )}
      {open?.kind === "move" && oneBoard && (
        <Popover title={t("table.moveTo")} anchor={open.anchor} onClose={close}>
          <div className="grid gap-2">
            <label className={fieldLabelClass}>
              {t("table.moveTo")}
              <Select
                value={oneBoardLists.some((list) => list.id === moveTo) ? moveTo : oneBoardLists[0]?.id}
                onChange={(event) => setMoveTo(event.target.value)}
              >
                {oneBoardLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </Select>
            </label>
            <Button
              variant="primary"
              className="justify-self-start"
              onClick={() => {
                const target = oneBoardLists.some((list) => list.id === moveTo) ? moveTo : oneBoardLists[0]?.id;
                if (target) forTicked((card) => cardActions.moveOrCopyCard(card.id, target, false));
                close();
              }}
            >
              {t("table.apply", { count: tickedCards.length })}
            </Button>
          </div>
        </Popover>
      )}
      {open?.kind === "due" && (
        <Popover title={t("table.dueDate")} anchor={open.anchor} onClose={close}>
          <div className="grid gap-2">
            <label className={fieldLabelClass}>
              {t("table.dueDate")}
              <Input type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={!due}
                onClick={() => {
                  forTicked((card) => update(card, { dueAt: isoFromInput(due) }));
                  close();
                }}
              >
                {t("table.apply", { count: tickedCards.length })}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  forTicked((card) => update(card, { dueAt: undefined, dueReminderMinutes: undefined }));
                  close();
                }}
              >
                {t("table.removeDue")}
              </Button>
            </div>
          </div>
        </Popover>
      )}
      {open?.kind === "priority" && (
        <Popover title={t("table.priority")} anchor={open.anchor} onClose={close}>
          <PriorityPicker
            onPick={(priority) => {
              forTicked((card) => update(card, { priority }));
              close();
            }}
          />
        </Popover>
      )}
    </section>
  );
}
