import { strToU8, zipSync } from "fflate";
import type { ExportTable } from "./exportData";

/** Whether XML 1.0 allows the character; Excel and Word refuse a file with control characters other than tab and newlines. */
const allowedInXml = (char: string) => {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 0x20 && code !== 0xfffe && code !== 0xffff) || code === 0x9 || code === 0xa || code === 0xd;
};

export const xmlText = (value: string) =>
  [...value]
    .filter(allowedInXml)
    .join("")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Excel's column letters: 1 → A, 27 → AA. */
export function columnName(index: number): string {
  let name = "";
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

// Excel keeps at most 32,767 characters in a cell.
const cellLimit = 32767;

/** A sheet name Excel accepts: no []:*?/\ and at most 31 characters. */
export const sheetName = (name: string) =>
  name
    .replace(/[[\]:*?/\\]+/g, " ")
    .trim()
    .slice(0, 31) || "Sheet1";

/**
 * An .xlsx workbook with one sheet: a bold, frozen header row with a filter, then text cells that wrap. Columns are
 * as wide as their longest line, within limits.
 */
export function buildXlsx(table: ExportTable, name: string): Uint8Array {
  const rows = [table.header, ...table.rows];
  const longestLine = (value = "") => Math.max(0, ...value.split("\n").map((line) => line.length));
  const widths = table.header.map((_, column) =>
    Math.min(60, Math.max(10, ...rows.map((row) => longestLine(row[column]) + 2))),
  );
  const cell = (value: string, row: number, column: number) => {
    const style = row === 1 ? 1 : 2;
    const text = value.length > cellLimit ? value.slice(0, cellLimit) : value;
    return `<c r="${columnName(column + 1)}${row}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlText(text)}</t></is></c>`;
  };
  const lastCell = `${columnName(Math.max(1, table.header.length))}${rows.length}`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("")}</cols><sheetData>${rows
    .map(
      (row, index) =>
        `<row r="${index + 1}">${row.map((value, column) => cell(value, index + 1, column)).join("")}</row>`,
    )
    .join("")}</sheetData>${table.header.length ? `<autoFilter ref="A1:${lastCell}"/>` : ""}</worksheet>`;
  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlText(sheetName(name))}" sheetId="1" r:id="rId1"/></sheets>${table.header.length ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${xmlText(sheetName(name).replace(/'/g, "''"))}'!$A$1:$${lastCell.replace(/(\d+)$/, "$$$1")}</definedName></definedNames>` : ""}</workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    "xl/worksheets/sheet1.xml": sheet,
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([path, text]) => [path, strToU8(text)])), { level: 6 });
}
