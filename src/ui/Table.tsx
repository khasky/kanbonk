import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

export type SortDirection = "ascending" | "descending";

/**
 * A data table: full width, collapsed borders, 13px text. `grid` frames every cell, as a spreadsheet preview.
 * `className` may only add layout. Put `Th` cells in its `thead` and `Td` cells in its `tbody`.
 */
export function Table({ grid, className, children }: { grid?: boolean; className?: string; children: ReactNode }) {
  const look = grid ? "w-max min-w-full text-[12px] [&_td]:border [&_th]:border" : "w-full text-[13px]";
  return <table className={`border-collapse text-left ${look}${className ? ` ${className}` : ""}`}>{children}</table>;
}

const cellClass = "border-b border-line px-2 py-1.5 text-left";

/**
 * A column header. With `onSort` its title is a button that sorts the table by the column; `sort` tells the
 * direction when the table is sorted by it (and sets `aria-sort`). `className` may only add layout or hide the
 * column on small screens.
 */
export function Th({
  sort,
  onSort,
  className,
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { sort?: SortDirection; onSort?: () => void }) {
  return (
    <th
      className={`${cellClass} align-bottom text-[12px] font-bold whitespace-nowrap text-ink-muted${className ? ` ${className}` : ""}`}
      aria-sort={onSort ? (sort ?? "none") : undefined}
      {...props}
    >
      {onSort ? (
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-inherit hover:underline"
          onClick={onSort}
        >
          {children}
          {sort && <span aria-hidden="true">{sort === "descending" ? " ↓" : " ↑"}</span>}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

/**
 * A table cell; `top` aligns its content to the top (cells with several lines), otherwise it is centered. `muted`
 * greys a secondary value (a size, a date). `className` may only add layout or hide the column on small screens.
 */
export function Td({
  top,
  muted,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { top?: boolean; muted?: boolean }) {
  return (
    <td
      className={`${cellClass} ${top ? "align-top" : "align-middle"}${muted ? " text-ink-subtle" : ""}${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}
