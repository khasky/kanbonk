import { type ReactNode, useState } from "react";
import { t } from "../i18n";
import type { BoardList, ListSort, Priority } from "../model";
import { PriorityPicker } from "../card/PriorityPicker";
import { listColors, trelloLabelColors } from "../model/labelColors";
import { Input } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { MenuItem, MenuSeparator } from "../ui/Menu";
import { Popover } from "../ui/Popover";
import { Swatch } from "../ui/Swatch";
import { Button } from "../ui/Button";

type View = "main" | "move" | "move-cards" | "sort" | "priority" | "limit";

/** The "Set card limit" step: the most cards the list should hold, or none. */
function CardLimitForm({ limit, onLimit }: { limit?: number; onLimit: (limit: number | undefined) => void }) {
  const [value, setValue] = useState(limit ? String(limit) : "");
  const parsed = Math.floor(Number(value));
  return (
    <form
      className="grid gap-2 p-1"
      onSubmit={(event) => {
        event.preventDefault();
        onLimit(parsed > 0 ? parsed : undefined);
      }}
    >
      <label className="grid gap-1 text-[12px] font-semibold text-ink-subtle">
        {t("board.cardLimitLabel")}
        <Input
          type="number"
          min={1}
          step={1}
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <p className="m-0 text-[12px] text-ink-subtle">{t("board.cardLimitHint")}</p>
      <div className="flex gap-2">
        <Button variant="primary" type="submit">
          {t("common.save")}
        </Button>
        <Button variant="secondary" type="button" disabled={!limit} onClick={() => onLimit(undefined)}>
          {t("board.removeCardLimit")}
        </Button>
      </div>
    </form>
  );
}

const sorts: { by: ListSort; label: () => string }[] = [
  { by: "newest", label: () => t("board.sortNewest") },
  { by: "oldest", label: () => t("board.sortOldest") },
  { by: "name", label: () => t("board.sortName") },
  { by: "due", label: () => t("board.sortDue") },
  { by: "most-viewed", label: () => t("views.sortMostViewed") },
  { by: "least-viewed", label: () => t("views.sortLeastViewed") },
  { by: "recently-viewed", label: () => t("views.sortRecentlyViewed") },
  { by: "least-recently-viewed", label: () => t("views.sortLeastRecentlyViewed") },
  { by: "priority-high", label: () => t("priority.sortHigh") },
  { by: "priority-low", label: () => t("priority.sortLow") },
];

/** Trello's "List actions": the list's actions, with the steps that need a choice as submenus behind a back button. */
export function ListActionsPopover({
  list,
  lists,
  anchor,
  movePicker,
  onAddCard,
  onCopy,
  onMoveLeft,
  onMoveRight,
  onMoveCards,
  onSort,
  onPriority,
  onColor,
  onCardLimit,
  onTrash,
  onTrashCards,
  onClose,
}: {
  list: BoardList;
  /** The board's lists, for "Move all cards in this list". */
  lists: BoardList[];
  anchor: HTMLElement;
  movePicker: (list: BoardList, close: () => void) => ReactNode;
  onAddCard: () => void;
  onCopy: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onMoveCards: (targetListId: string) => void;
  onSort: (by: ListSort) => void;
  /** Gives all the list's cards the priority, or none with undefined. */
  onPriority: (priority: Priority | undefined) => void;
  onColor: (color: string | undefined) => void;
  /** Sets the most cards the list should hold, or removes the limit with undefined. */
  onCardLimit: (limit: number | undefined) => void;
  onTrash: () => void;
  onTrashCards: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>("main");
  /** Runs a row's action and closes the popover. */
  const run = (action: () => void) => () => {
    onClose();
    action();
  };
  const back = () => setView("main");

  if (view === "move")
    return (
      <Popover title={t("board.moveList")} anchor={anchor} onClose={onClose} onBack={back}>
        {movePicker(list, onClose)}
      </Popover>
    );
  if (view === "move-cards")
    return (
      <Popover title={t("board.moveAllCardsTitle")} anchor={anchor} onClose={onClose} onBack={back}>
        <div className="grid">
          {lists.map((item) => (
            <MenuItem key={item.id} disabled={item.id === list.id} onClick={run(() => onMoveCards(item.id))}>
              {item.id === list.id ? `${item.name} ${t("card.current")}` : item.name}
            </MenuItem>
          ))}
        </div>
      </Popover>
    );
  if (view === "sort")
    return (
      <Popover title={t("board.sortListTitle")} anchor={anchor} onClose={onClose} onBack={back}>
        <div className="grid">
          {sorts.map((item) => (
            <MenuItem key={item.by} onClick={run(() => onSort(item.by))}>
              {item.label()}
            </MenuItem>
          ))}
        </div>
      </Popover>
    );
  if (view === "priority")
    return (
      <Popover title={t("priority.setForListTitle")} anchor={anchor} onClose={onClose} onBack={back}>
        <PriorityPicker onPick={(priority) => run(() => onPriority(priority))()} />
      </Popover>
    );
  if (view === "limit")
    return (
      <Popover title={t("board.cardLimitTitle")} anchor={anchor} onClose={onClose} onBack={back}>
        <CardLimitForm limit={list.cardLimit} onLimit={(limit) => run(() => onCardLimit(limit))()} />
      </Popover>
    );

  return (
    <Popover title={t("board.listActions")} anchor={anchor} onClose={onClose}>
      <div className="grid">
        <MenuItem onClick={run(onAddCard)}>{t("board.addCard")}</MenuItem>
        <MenuItem onClick={run(onCopy)}>{t("board.copyList")}</MenuItem>
        <MenuItem onClick={() => setView("move")}>{t("board.moveList")}</MenuItem>
        <MenuItem onClick={() => setView("move-cards")}>{t("board.moveAllCards")}</MenuItem>
        <MenuItem onClick={() => setView("sort")}>{t("board.sortBy")}</MenuItem>
        <MenuItem onClick={() => setView("priority")}>{t("priority.setForList")}</MenuItem>
        <MenuItem onClick={() => setView("limit")}>{t("board.setCardLimit")}</MenuItem>
        <MenuItem onClick={run(onMoveLeft)}>{t("board.moveLeft")}</MenuItem>
        <MenuItem onClick={run(onMoveRight)}>{t("board.moveRight")}</MenuItem>
        <MenuSeparator />
        <h5 className="m-0 px-2.5 pt-2 pb-1.5 text-[12px] font-semibold text-ink-subtle">{t("board.listColor")}</h5>
        <div className="grid grid-cols-5 gap-1.5 px-1 pb-2">
          {listColors.map((name) => {
            const color = trelloLabelColors[name];
            const label = name[0].toUpperCase() + name.slice(1);
            return (
              <Swatch
                key={name}
                color={color}
                label={label}
                pressed={list.color === name}
                onClick={() => onColor(name)}
              >
                {list.color === name && <Icon name="check" className="size-4" />}
              </Swatch>
            );
          })}
        </div>
        <Button
          variant="secondary"
          className="mx-1 mb-1 flex h-8 items-center justify-center gap-1.5"
          disabled={!list.color}
          onClick={() => onColor(undefined)}
        >
          <Icon name="close" className="size-4" />
          {t("board.removeColor")}
        </Button>
        <MenuSeparator />
        <MenuItem danger onClick={run(onTrash)}>
          {t("board.moveListToTrash")}
        </MenuItem>
        <MenuItem danger onClick={run(onTrashCards)}>
          {t("board.trashAllCards")}
        </MenuItem>
      </div>
    </Popover>
  );
}
