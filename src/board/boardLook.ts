/** Shared looks of the lists view: list and zone composers, the "add" buttons and drag handles. */

/** A composer of a list, card or zone: the field (`Input` or `Textarea`), then a row with the submit and cancel buttons. */
export const composeClass = "flex flex-col gap-2";

/** The row of buttons under a composer's field. */
export const composeActionsClass = "flex items-center gap-[5px]";

/** "Add a card" and "Create from template" at the bottom of a list. */
export const addCardClass =
  "mt-[5px] flex w-full items-center gap-[7px] rounded-md border-0 bg-transparent p-2 text-left text-ink-subtle hover:bg-line max-phone:min-h-11";

/** "Add a list" and "New zone" on the board background. */
export const addListClass =
  "flex w-full items-center gap-[7px] rounded-md border-0 bg-transparent p-2 text-left font-semibold text-white hover:bg-[#ffffff38] max-phone:min-h-11";

/** The "⋮⋮" handle that drags a list or a zone, in its header's text color; `list-drag-handle` is a hook for tests. */
export const dragHandleClass = "list-drag-handle flex-none cursor-grab px-px py-1 select-none active:cursor-grabbing";
