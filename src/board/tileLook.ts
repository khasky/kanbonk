/** Looks of a card tile, shared by the board's `CardTile` and the Inbox's tiles. */

const tileBase =
  "flex w-full flex-col gap-[7px] rounded-lg border-0 bg-white px-3 py-[9px] text-left leading-[1.35] shadow-tile-soft hover:shadow-[0_2px_7px_#091e4255]";

/** A tile; `fullCover` is a tile whose cover image fills it, with the title on a dark gradient at the bottom. */
export const tileClass = (fullCover = false) =>
  fullCover
    ? `${tileBase} relative isolate min-h-[170px] justify-end overflow-hidden text-white before:absolute before:inset-0 before:-z-1 before:bg-[linear-gradient(transparent,#172b4dcc)] before:content-['']`
    : `${tileBase} text-ink`;

/** The title line. */
export const tileNameClass = (fullCover = false) =>
  fullCover
    ? "flex items-center gap-[5px] wrap-anywhere text-[18px] font-bold"
    : "flex items-center gap-[5px] wrap-anywhere";

/**
 * The line of due date, attachments, comments and checklists; hidden when empty (the Inbox always renders it).
 * `inherit` takes the text color of a tile filled with its cover color.
 */
export const tileMetaClass = (inherit = false) =>
  inherit
    ? "flex flex-wrap items-center gap-2 text-[12px] text-inherit empty:hidden"
    : "flex flex-wrap items-center gap-2 text-[12px] text-ink-muted empty:hidden";

export const tileMetaItemClass = "inline-flex items-center gap-[3px]";

export const tileMetaIconClass = "h-3.5 w-3.5";
