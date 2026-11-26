import { type ReactNode, useRef, useState } from "react";
import type { BoardList, Card, Label, Member } from "../model";
import { Icon } from "../ui/Icon";
import { Menu, MenuItem, MenuSeparator } from "../ui/Menu";
import { NameEditor } from "../ui/NameEditor";
import { Popover } from "../ui/Popover";
import { CardTile, type TileActions } from "./CardTile";
import { ListCards } from "./ListCards";
import { TemplateComposer } from "./TemplateComposer";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Field";
import { t } from "../i18n";
import { addCardClass, composeActionsClass, composeClass, dragHandleClass } from "./boardLook";
import { endDrag, startDrag } from "./dragState";

/** What a list column can ask the board to do; every handler gets the list's id. */
export interface ListActions {
  rename: (listId: string, name: string) => void;
  run: (listId: string, action: "name" | "due" | "move-left" | "move-right" | "copy" | "delete") => void;
  startCard: (listId: string) => void;
  cancelCard: () => void;
  createCard: (listId: string) => void;
  createFromTemplate: (templateId: string, listId: string, name: string) => void;
  /** The "Move list" form for the list; `close` closes its popover. */
  movePicker: (list: BoardList, close: () => void) => ReactNode;
}

/**
 * One list on the board: header with its menu, the cards, the new-card composer and templates. Dropping on it is
 * handled by the board (`data-list-id` marks it); while a card is dragged, `draggedCardId` is hidden and `cardSlot`
 * shows where it would land.
 */
export function ListColumn({
  list,
  cards,
  labels,
  members,
  cardById,
  tileActions,
  templates,
  composing,
  draft,
  onDraft,
  actions,
  hidden = false,
  draggedCardId,
  cardSlot,
}: {
  list: BoardList;
  cards: Card[];
  labels: Map<string, Label>;
  members?: Member[];
  cardById: Map<string, Card>;
  tileActions: TileActions;
  templates: Card[];
  /** Whether the new-card composer is open in this list. */
  composing: boolean;
  draft: string;
  onDraft: (draft: string) => void;
  actions: ListActions;
  /** Hidden while the list is dragged to another place, which the board shows instead. */
  hidden?: boolean;
  draggedCardId?: string;
  cardSlot?: { index: number; height: number };
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [moving, setMoving] = useState(false);
  return (
    <section
      className="list-column flex max-h-full w-[272px] flex-none flex-col rounded-xl bg-surface-sunken p-2 shadow-tile-soft"
      style={hidden ? { display: "none" } : undefined}
      data-list-id={list.id}
    >
      <div className="flex items-center gap-1 px-1 pt-0.5 pb-2">
        <span
          className={`${dragHandleClass} text-ink-muted`}
          draggable
          title={t("board.dragList")}
          onDragStart={(event) => {
            event.dataTransfer.setData("text/kanbonk-list", list.id);
            // The whole list is the picture under the pointer, as in Trello, not just the handle.
            const column = event.currentTarget.closest("section")!;
            event.dataTransfer.setDragImage(column, event.nativeEvent.offsetX + 8, event.nativeEvent.offsetY + 8);
            startDrag(column, { kind: "list", id: list.id });
          }}
          onDragEnd={endDrag}
        >
          ⋮⋮
        </span>
        <NameEditor
          className="min-w-0 flex-1 rounded-sm border-0 bg-transparent px-1.5 py-[5px] text-[16px] leading-5 font-bold text-ink focus:bg-white"
          value={list.name}
          label={t("board.listTitleOf", { name: list.name })}
          onCommit={(name) => actions.rename(list.id, name)}
        />
        <Menu
          ref={menuRef}
          label={t("board.listActionsOf", { name: list.name })}
          summaryClassName="grid size-8 place-items-center rounded-sm text-[20px] leading-none text-ink-subtle group-open/menu:bg-line hover:bg-line max-phone:min-h-11 max-phone:min-w-11"
          touchRows
        >
          <MenuItem onClick={() => actions.run(list.id, "name")}>{t("board.sortByTitle")}</MenuItem>
          <MenuItem onClick={() => actions.run(list.id, "due")}>{t("board.sortByDue")}</MenuItem>
          <MenuItem onClick={() => actions.run(list.id, "move-left")}>{t("board.moveLeft")}</MenuItem>
          <MenuItem onClick={() => actions.run(list.id, "move-right")}>{t("board.moveRight")}</MenuItem>
          <MenuItem onClick={() => setMoving(true)}>{t("board.moveList")}</MenuItem>
          <MenuItem onClick={() => actions.run(list.id, "copy")}>{t("board.copyList")}</MenuItem>
          <MenuSeparator />
          <MenuItem danger onClick={() => actions.run(list.id, "delete")}>
            {t("board.moveListToTrash")}
          </MenuItem>
        </Menu>
        {moving && menuRef.current && (
          <Popover title={t("board.moveList")} anchor={menuRef.current} onClose={() => setMoving(false)}>
            {actions.movePicker(list, () => setMoving(false))}
          </Popover>
        )}
      </div>
      <ListCards
        cards={cards}
        draggedId={draggedCardId}
        slot={cardSlot}
        render={(item) => (
          <CardTile
            key={item.id}
            card={item}
            labels={labels}
            members={members}
            parentName={item.parentCardId ? cardById.get(item.parentCardId)?.name : undefined}
            actions={tileActions}
            hidden={item.id === draggedCardId}
          />
        )}
      />
      {composing ? (
        <div className={composeClass}>
          <Textarea
            className="min-h-[42px] w-full"
            autoFocus
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                actions.createCard(list.id);
              }
            }}
            placeholder={t("board.cardTitle")}
          />
          <div className={composeActionsClass}>
            <Button variant="primary" onClick={() => actions.createCard(list.id)}>
              {t("board.addCard")}
            </Button>
            <Button variant="icon" onClick={actions.cancelCard} aria-label={t("common.cancel")}>
              <Icon name="close" />
            </Button>
          </div>
        </div>
      ) : (
        <button className={addCardClass} onClick={() => actions.startCard(list.id)}>
          <Icon name="plus" /> {t("board.addCard")}
        </button>
      )}
      <TemplateComposer
        templates={templates}
        onCreate={(templateId, name) => actions.createFromTemplate(templateId, list.id, name)}
      />
    </section>
  );
}
