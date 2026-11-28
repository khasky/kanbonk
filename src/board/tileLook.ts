/** Looks of a card tile (`CardTile`), on a board and in the Inbox. */

const tileBase =
  "flex w-full flex-col gap-[7px] rounded-lg border-0 bg-white px-3 py-[9px] text-left text-[16px] leading-5 no-underline shadow-tile-soft hover:shadow-[0_2px_7px_#091e4255]";

export const tileClass = `${tileBase} text-ink`;

/** The title line. */
export const tileNameClass = "flex items-center gap-[5px] wrap-anywhere";

/** The line of due date, attachments, comments and checklists; hidden when empty. Its color comes with the tile. */
export const tileMetaClass = "flex flex-wrap items-center gap-2.5 text-[12px] empty:hidden";

export const tileMetaItemClass = "inline-flex items-center gap-[3px]";

export const tileMetaIconClass = "size-4";
