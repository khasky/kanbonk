/** Shared looks of the pages in the main area (home, workspace, trash, not found). */

const pagePadding = "px-9 py-7 max-[761px]:px-3.5 max-[761px]:py-[18px]";

/** The scrolling white page. */
export const pageClass = `flex-1 overflow-auto bg-white text-ink ${pagePadding}`;

/** A page that only holds a centered message, such as "not found". */
export const messagePageClass = `mx-auto my-10 max-w-[460px] flex-1 overflow-auto bg-white text-center text-ink-subtle ${pagePadding}`;

/** A centered message inside a page, such as "no boards yet". */
export const emptyClass = "mx-auto my-10 max-w-[460px] text-center text-ink-subtle";

export const pageTitleClass = "mx-0 mt-0 mb-5 text-[24px]";

export const pageHeadingClass = "mx-0 mt-6 mb-3 text-[16px]";

/** A header row with the title and the page's actions. */
export const pageHeaderClass = "mb-3 flex items-center gap-3.5";

/** The grid of workspace or board tiles. */
export const tileGridClass = "grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5";

const tile = "flex min-h-24 cursor-pointer gap-1.5 rounded-lg border-0 p-3.5 text-left shadow-tile hover:brightness-95";

export const workspaceTileClass = `${tile} flex-col bg-surface-soft text-ink`;

/** A board tile; its color comes from the board's background. */
export const boardTileClass = `${tile} flex-row items-start justify-between text-[16px] text-white`;

/** The "+ Create" tile at the end of a grid. */
export const createTileClass = `${tile} flex-col items-center justify-center bg-surface-sunken text-ink-subtle`;
