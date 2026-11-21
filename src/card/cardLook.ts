/** Shared looks of the card dialog: its sections, the boxes the action buttons open, and their small forms. */

/** A section of the card's details (dates, description, checklists…). */
export const detailSectionClass = "my-[22px]";

/** The heading of a detail section or of the activity panel, with its controls inline. */
export const detailTitleClass = "mt-0 mb-3 flex items-center gap-2.5 text-[15px]";

/**
 * A grey "click to write" field: the empty description and "Write a comment…". `!`: the card dialog makes its buttons
 * 44px high on phones, which must not shrink this one.
 */
export const placeholderClass =
  "min-h-14! w-full cursor-text rounded-sm border-0 bg-surface-sunken p-2.5 text-left text-ink-subtle";

/**
 * The framed box an action button opens under the actions (move, share, checklist, link, dependency, cover,
 * stickers).
 */
export const pickerBoxClass =
  "mb-[15px] ml-[34px] flex flex-col gap-2 rounded-md border border-line p-3 max-phone:ml-0";

/** A labelled field in a picker box: the label on the left, the field on the right. */
export const pickerLabelClass = "flex items-center justify-between gap-2.5";

/** A row of buttons in a picker box. */
export const pickerRowClass = "flex gap-2";

/** A one-line form under a list (new sub-card, new checklist items, labels): a `sm` field and its buttons. */
export const inlineFormClass = "mt-2 flex gap-1.5";
