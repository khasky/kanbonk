import type { BoardList, Card, Label, Member } from "../model";
import { Icon } from "../ui/Icon";
import { Menu, MenuItem, MenuSeparator } from "../ui/Menu";
import { NameEditor } from "../ui/NameEditor";
import { CardTile, type TileActions } from "./CardTile";
import { ListCards } from "./ListCards";
import { TemplateComposer } from "./TemplateComposer";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Field";
import { addCardClass, composeActionsClass, composeClass, dragHandleClass } from "./boardLook";

/** What a list column can ask the board to do; every handler gets the list's id. */
export interface ListActions {
  rename: (listId: string, name: string) => void;
  run: (listId: string, action: "name" | "due" | "move-left" | "move-right" | "copy" | "delete") => void;
  dropZone: (zoneId: string, listId: string, after: boolean) => void;
  dropList: (movingListId: string, listId: string, after: boolean) => void;
  dropCard: (cardId: string, listId: string) => void;
  startCard: (listId: string) => void;
  cancelCard: () => void;
  createCard: (listId: string) => void;
  createFromTemplate: (templateId: string, listId: string, name: string) => void;
}

/** One list on the board: header with its menu, the cards, the new-card composer and templates. */
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
}) {
  return (
    <section
      className="list-column flex max-h-full w-[272px] flex-none flex-col rounded-xl bg-surface-sunken p-2 shadow-tile-soft"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        const after = event.clientX > bounds.left + bounds.width / 2;
        const movingZoneId = event.dataTransfer.getData("text/kanbonk-zone");
        if (movingZoneId) {
          actions.dropZone(movingZoneId, list.id, after);
          return;
        }
        const movingListId = event.dataTransfer.getData("text/kanbonk-list");
        if (movingListId) {
          actions.dropList(movingListId, list.id, after);
          return;
        }
        const id = event.dataTransfer.getData("text/kanbonk-card");
        if (id) actions.dropCard(id, list.id);
      }}
    >
      <div className="flex items-center gap-1 px-1 pt-0.5 pb-2">
        <span
          className={`${dragHandleClass} text-ink-muted`}
          draggable
          title="Drag list"
          onDragStart={(event) => event.dataTransfer.setData("text/kanbonk-list", list.id)}
        >
          ⋮⋮
        </span>
        <NameEditor
          className="min-w-0 flex-1 rounded-sm border-0 bg-transparent px-1.5 py-[7px] font-bold text-ink focus:bg-white max-phone:text-[16px]"
          value={list.name}
          label={`List title ${list.name}`}
          onCommit={(name) => actions.rename(list.id, name)}
        />
        <Menu
          label={`List actions ${list.name}`}
          summaryClassName="grid size-8 place-items-center rounded-sm text-[20px] leading-none text-ink-subtle group-open/menu:bg-line hover:bg-line max-phone:min-h-11 max-phone:min-w-11"
          touchRows
        >
          <MenuItem onClick={() => actions.run(list.id, "name")}>Sort by title</MenuItem>
          <MenuItem onClick={() => actions.run(list.id, "due")}>Sort by due date</MenuItem>
          <MenuItem onClick={() => actions.run(list.id, "move-left")}>Move left</MenuItem>
          <MenuItem onClick={() => actions.run(list.id, "move-right")}>Move right</MenuItem>
          <MenuItem onClick={() => actions.run(list.id, "copy")}>Copy list</MenuItem>
          <MenuSeparator />
          <MenuItem danger onClick={() => actions.run(list.id, "delete")}>
            Move list to trash
          </MenuItem>
        </Menu>
      </div>
      <ListCards
        cards={cards}
        render={(item) => (
          <CardTile
            key={item.id}
            card={item}
            labels={labels}
            members={members}
            parentName={item.parentCardId ? cardById.get(item.parentCardId)?.name : undefined}
            actions={tileActions}
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
            placeholder="Card title"
          />
          <div className={composeActionsClass}>
            <Button variant="primary" onClick={() => actions.createCard(list.id)}>
              Add a card
            </Button>
            <Button variant="icon" onClick={actions.cancelCard} aria-label="Cancel">
              <Icon name="close" />
            </Button>
          </div>
        </div>
      ) : (
        <button className={addCardClass} onClick={() => actions.startCard(list.id)}>
          <Icon name="plus" /> Add a card
        </button>
      )}
      <TemplateComposer
        templates={templates}
        onCreate={(templateId, name) => actions.createFromTemplate(templateId, list.id, name)}
      />
    </section>
  );
}
