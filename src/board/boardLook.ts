/** Shared looks of the lists view: list and zone composers and drag handles. */

/** A composer of a list, card or zone: the field (`Input` or `Textarea`), then a row with the submit and cancel buttons. */
export const composeClass = "flex flex-col gap-2";

/** The row of buttons under a composer's field. */
export const composeActionsClass = "flex items-center gap-[5px]";

/** The "⋮⋮" handle that drags a list or a zone, in its header's text color; `list-drag-handle` is a hook for tests. */
export const dragHandleClass = "list-drag-handle flex-none cursor-grab px-px py-1 select-none active:cursor-grabbing";
