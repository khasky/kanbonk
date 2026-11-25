/** Shared looks of the card dialog: its sections, the popovers its buttons open, and their small forms. */

/** A section of the card's details (dates, description, checklists…). Its title's icon sits in the left gutter. */
export const detailSectionClass = "my-6";

/** The heading of the activity panel, with its controls inline. */
export const detailTitleClass = "mt-0 mb-3 flex min-h-8 items-center gap-3 text-[15px] font-semibold";

/**
 * A grey "click to write" field: the empty description. `!`: the card dialog makes its buttons 44px high on phones,
 * which must not shrink this one.
 */
export const placeholderClass =
  "min-h-14! w-full cursor-text rounded-sm border-0 bg-surface-sunken p-2.5 text-left text-ink-subtle hover:bg-line";

/** The content of a popover opened by a card button (move, share, checklist, link, dependency, cover). */
export const pickerBoxClass = "flex flex-col gap-3";

/** A labelled field in a popover: a small bold label above a full-width field. */
export const pickerLabelClass = "grid gap-1 text-[12px] font-semibold text-ink-subtle";

/** A row of buttons in a popover. */
export const pickerRowClass = "flex gap-2";

/** A one-line form under a list (new sub-card, new checklist items, labels): a `sm` field and its buttons. */
export const inlineFormClass = "mt-2 flex gap-1.5";
