import { Table, Td, Th } from "./Table";

/** Cells longer than this are cut, so one huge cell does not stretch the preview. */
const cellLimit = 300;

/**
 * A spreadsheet-like preview of rows: framed cells, a sticky header row and, with `rowNumbers`, the row numbers in the
 * first column. Put it in a scrolling box.
 */
export function SheetTable({ header, rows, rowNumbers }: { header: string[]; rows: string[][]; rowNumbers?: boolean }) {
  return (
    <Table grid>
      <thead className="sticky top-0 bg-surface-sunken">
        <tr>
          {rowNumbers && <Th aria-hidden="true" className="w-px" />}
          {header.map((name, index) => (
            <Th key={`${name}-${index}`}>{name}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={`${rowIndex}-${row[0]}`}>
            {rowNumbers && (
              <Th scope="row" className="w-px bg-surface-sunken text-right">
                {rowIndex + 1}
              </Th>
            )}
            {header.map((name, index) => {
              const value = row[index] ?? "";
              return (
                <Td top key={`${name}-${index}`} className="max-w-[260px] whitespace-pre-wrap">
                  {value.length > cellLimit ? `${value.slice(0, cellLimit)}…` : value}
                </Td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
