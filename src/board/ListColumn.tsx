import { type ReactNode, useState } from "react";
import { t } from "../i18n";
import type {
  BoardList,
  Card,
  CardAge,
  CardAgingMode,
  Label,
  ListSort,
  Member,
  MissingField,
  Priority,
  ViewStats,
} from "../model";
import { trelloLabelColors } from "../model/labelColors";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { NameEditor } from "../ui/NameEditor";
import { addCardClass, composeActionsClass, composeClass, dragHandleClass } from "./boardLook";
import { CardTile, type TileActions } from "./CardTile";
import { endDrag, startDrag } from "./dragState";
import { ListActionsPopover } from "./ListActionsPopover";
import { ListCards } from "./ListCards";
import { TemplateComposer } from "./TemplateComposer";

const headerButtonClass =
  "grid size-8 flex-none cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-ink-subtle hover:bg-line aria-expanded:bg-line max-phone:min-h-11 max-phone:min-w-11";

/** What a list column can ask the board to do; every handler gets the list's id. */
export interface ListActions {
  rename: (listId: string, name: string) => void;
  run: (listId: string, action: ListSort | "move-left" | "move-right" | "copy" | "delete" | "trash-cards") => void;
  setColor: (listId: string, color: string | undefined) => void;
  setPriority: (listId: string, priority: Priority | undefined) => void;
  moveCards: (listId: string, targetListId: string) => void;
  toggleCollapsed: (listId: string) => void;
  startCard: (listId: string) => void;
  cancelCard: () => void;
  createCard: (listId: string) => void;
  createFromTemplate: (templateId: string, listId: string, name: string) => void;
  createTemplate: (listId: string, name: string) => void;
  /** The "Move list" form for the list; `close` closes its popover. */
  movePicker: (list: BoardList, close: () => void) => ReactNode;
}

/** The light shade a colored list takes, as in Trello. */
function listBackground(list: BoardList, hidden: boolean) {
  return {
    ...(list.color ? { background: trelloLabelColors[`${list.color}_light`] } : undefined),
    ...(hidden ? { display: "none" } : undefined),
  };
}

/**
 * One list on the board: header with its card count, collapse button and actions, the cards, the new-card composer
 * and the templates. Dropping on it is handled by the board (`data-list-id` marks it); while a card is dragged,
 * `draggedCardId` is hidden and `cardSlot` shows where it would land. A collapsed list is a narrow column with its
 * name running down it.
 */
export function ListColumn({
  list,
  lists,
  cards,
  labels,
  members,
  cardById,
  subCardCounts,
  cardViews,
  missingByCard,
  cardAges,
  mirrorCounts,
  agingMode,
  tileActions,
  templates,
  composing,
  draft,
  onDraft,
  actions,
  collapsed = false,
  hidden = false,
  draggedCardId,
  cardSlot,
}: {
  list: BoardList;
  /** The board's lists, for moving all cards to one of them. */
  lists: BoardList[];
  cards: Card[];
  labels: Map<string, Label>;
  members?: Member[];
  cardById: Map<string, Card>;
  subCardCounts: Map<string, number>;
  cardViews: Map<string, ViewStats>;
  /** What each card lacks under the board's required fields. */
  missingByCard: Map<string, MissingField[]>;
  /** How long each card has gone without a change, on a board that ages its cards. */
  cardAges: Map<string, CardAge>;
  /** How many other mirrors each mirrored card has. */
  mirrorCounts: Map<string, number>;
  agingMode?: CardAgingMode;
  tileActions: TileActions;
  templates: Card[];
  /** Whether the new-card composer is open in this list. */
  composing: boolean;
  draft: string;
  onDraft: (draft: string) => void;
  actions: ListActions;
  collapsed?: boolean;
  /** Hidden while the list is dragged to another place, which the board shows instead. */
  hidden?: boolean;
  draggedCardId?: string;
  cardSlot?: { index: number; height: number };
}) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement>();
  const [templateAnchor, setTemplateAnchor] = useState<HTMLElement>();
  const count = (
    <span className="flex-none px-1 text-[14px] font-normal text-ink-subtle" title={t("board.totalCards")}>
      {cards.length}
    </span>
  );
  const dragHandle = (
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
  );

  if (collapsed)
    return (
      <section
        className="list-column flex max-h-full w-11 flex-none flex-col items-center gap-2 rounded-xl bg-surface-sunken py-2 shadow-tile-soft"
        style={listBackground(list, hidden)}
        data-list-id={list.id}
      >
        <button
          className={headerButtonClass}
          onClick={() => actions.toggleCollapsed(list.id)}
          aria-label={t("board.expandListOf", { name: list.name })}
          title={t("board.expandList")}
        >
          <Icon name="expand" className="size-4" />
        </button>
        <span className="flex min-h-0 items-center gap-2 overflow-hidden text-[16px] font-bold text-ink [writing-mode:vertical-rl]">
          <span className="truncate">{list.name}</span>
          {count}
        </span>
        {dragHandle}
      </section>
    );

  return (
    <section
      className="list-column flex max-h-full w-[272px] flex-none flex-col rounded-xl bg-surface-sunken p-2 shadow-tile-soft"
      style={listBackground(list, hidden)}
      data-list-id={list.id}
    >
      <div className="flex items-center gap-1 px-1 pt-0.5 pb-2">
        {dragHandle}
        <NameEditor
          className="min-w-0 flex-1 rounded-sm border-0 bg-transparent px-1.5 py-[5px] text-[16px] leading-5 font-bold text-ink focus:bg-white"
          value={list.name}
          label={t("board.listTitleOf", { name: list.name })}
          onCommit={(name) => actions.rename(list.id, name)}
        />
        {count}
        <button
          className={headerButtonClass}
          onClick={() => actions.toggleCollapsed(list.id)}
          aria-label={t("board.collapseListOf", { name: list.name })}
          title={t("board.collapseList")}
        >
          <Icon name="collapse" className="size-4" />
        </button>
        <button
          className={`${headerButtonClass} text-[20px] leading-none`}
          aria-label={t("board.listActionsOf", { name: list.name })}
          aria-expanded={Boolean(menuAnchor)}
          title={t("board.listActions")}
          onClick={(event) => setMenuAnchor(menuAnchor ? undefined : event.currentTarget)}
        >
          ⋯
        </button>
        {menuAnchor && (
          <ListActionsPopover
            list={list}
            lists={lists}
            anchor={menuAnchor}
            movePicker={actions.movePicker}
            onAddCard={() => actions.startCard(list.id)}
            onCopy={() => actions.run(list.id, "copy")}
            onMoveLeft={() => actions.run(list.id, "move-left")}
            onMoveRight={() => actions.run(list.id, "move-right")}
            onMoveCards={(targetId) => actions.moveCards(list.id, targetId)}
            onSort={(by) => actions.run(list.id, by)}
            onPriority={(priority) => actions.setPriority(list.id, priority)}
            onColor={(color) => actions.setColor(list.id, color)}
            onTrash={() => actions.run(list.id, "delete")}
            onTrashCards={() => actions.run(list.id, "trash-cards")}
            onClose={() => setMenuAnchor(undefined)}
          />
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
            subCardCount={subCardCounts.get(item.id)}
            viewCount={cardViews.get(item.id)?.total}
            lastViewedAt={cardViews.get(item.id)?.lastAt}
            missing={missingByCard.get(item.id)}
            age={agingMode && cardAges.get(item.id)}
            agingMode={agingMode}
            mirrorCount={mirrorCounts.get(item.id)}
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
        <div className="mt-[5px] flex items-center gap-1">
          <button className={`${addCardClass} flex-1`} onClick={() => actions.startCard(list.id)}>
            <Icon name="plus" /> {t("board.addCard")}
          </button>
          <button
            className={`${headerButtonClass} size-9`}
            aria-label={t("board.createFromTemplate")}
            aria-expanded={Boolean(templateAnchor)}
            title={t("board.createFromTemplate")}
            onClick={(event) => setTemplateAnchor(templateAnchor ? undefined : event.currentTarget)}
          >
            <Icon name="card-template" className="size-4" />
          </button>
        </div>
      )}
      {templateAnchor && (
        <TemplateComposer
          templates={templates}
          anchor={templateAnchor}
          onCreate={(templateId, name) => actions.createFromTemplate(templateId, list.id, name)}
          onCreateTemplate={(name) => actions.createTemplate(list.id, name)}
          onClose={() => setTemplateAnchor(undefined)}
        />
      )}
    </section>
  );
}
