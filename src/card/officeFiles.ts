import { child, elements, find, findAll, textOf, type XmlElement } from "../lib/xml";
import { parseCsv } from "../trello/formats";
import { readOpenDocument } from "./openDocument";
import {
  type Block,
  type OfficeContent,
  Package,
  type Paragraph,
  resolvePath,
  type Run,
  type Sheet,
  sheetLimits,
} from "./officePackage";

export type { Block, OfficeContent, Paragraph, Run, Sheet } from "./officePackage";

/** The relationships of an OOXML part: id → target path (or external URL). */
function relationships(pack: Package, part: string): Map<string, { target: string; external: boolean }> {
  const slash = part.lastIndexOf("/");
  const rels = pack.xml(`${part.slice(0, slash + 1)}_rels/${part.slice(slash + 1)}.rels`);
  return new Map(
    elements(rels, "Relationship").map((rel) => {
      const external = rel.attrs.TargetMode === "External";
      return [rel.attrs.Id, { target: external ? rel.attrs.Target : resolvePath(part, rel.attrs.Target), external }];
    }),
  );
}

const on = (element: XmlElement | undefined) =>
  Boolean(element) && !["0", "false", "none"].includes(element?.attrs["w:val"] ?? "");

// --- Word ---

function readDocx(pack: Package): OfficeContent {
  const part = "word/document.xml";
  const rels = relationships(pack, part);
  const styles = new Map(
    elements(pack.xml("word/styles.xml"), "w:style").map((style) => [
      style.attrs["w:styleId"],
      child(style, "w:name")?.attrs["w:val"].toLowerCase() ?? "",
    ]),
  );
  const numbering = pack.xml("word/numbering.xml");
  const abstracts = new Map(elements(numbering, "w:abstractNum").map((item) => [item.attrs["w:abstractNumId"], item]));
  const numbered = (numId: string, level: number) => {
    const num = elements(numbering, "w:num").find((item) => item.attrs["w:numId"] === numId);
    const abstract = abstracts.get(child(num, "w:abstractNumId")?.attrs["w:val"] ?? "");
    const lvl = elements(abstract, "w:lvl").find((item) => item.attrs["w:ilvl"] === String(level));
    return (child(lvl, "w:numFmt")?.attrs["w:val"] ?? "bullet") !== "bullet";
  };

  const runs = (element: XmlElement, href?: string): Run[] =>
    elements(element).flatMap((item): Run[] => {
      if (item.name === "w:hyperlink") {
        const rel = rels.get(item.attrs["r:id"]);
        return runs(item, rel?.external ? rel.target : href);
      }
      if (["w:ins", "w:smartTag", "w:fldSimple", "w:sdt", "w:sdtContent"].includes(item.name)) return runs(item, href);
      if (item.name !== "w:r") return [];
      const look = child(item, "w:rPr");
      const style = {
        bold: on(child(look, "w:b")),
        italic: on(child(look, "w:i")),
        underline: on(child(look, "w:u")),
        strike: on(child(look, "w:strike")),
        href,
      };
      return elements(item).flatMap((part): Run[] => {
        if (part.name === "w:t") return [{ text: textOf(part), ...style }];
        if (part.name === "w:tab") return [{ text: "\t", ...style }];
        if (part.name === "w:br" || part.name === "w:cr") return [{ text: "\n", ...style }];
        if (part.name === "w:drawing" || part.name === "w:pict") return pictures(part);
        return [];
      });
    });

  const pictures = (element: XmlElement): Run[] =>
    [...findAll(element, "a:blip"), ...findAll(element, "v:imagedata")].flatMap((blip) => {
      const rel = rels.get(blip.attrs["r:embed"] ?? blip.attrs["r:id"]);
      const image = rel && !rel.external ? pack.image(rel.target) : undefined;
      const alt = find(element, "wp:docPr")?.attrs.descr;
      return image ? [{ image, alt }] : [];
    });

  const paragraph = (element: XmlElement): Paragraph => {
    const props = child(element, "w:pPr");
    const style = styles.get(child(props, "w:pStyle")?.attrs["w:val"] ?? "") ?? "";
    const level = /^heading (\d)$/.exec(style)?.[1];
    const numbers = child(props, "w:numPr");
    const numId = child(numbers, "w:numId")?.attrs["w:val"];
    const listLevel = Number(child(numbers, "w:ilvl")?.attrs["w:val"] ?? 0);
    return {
      runs: runs(element),
      heading: style === "title" ? 1 : level ? Math.min(6, Number(level)) : undefined,
      list: numId && numId !== "0" ? { level: listLevel, ordered: numbered(numId, listLevel) } : undefined,
    };
  };

  const blocks = (element: XmlElement | undefined): Block[] =>
    elements(element).flatMap((item): Block[] => {
      if (item.name === "w:p") return [{ paragraph: paragraph(item) }];
      if (item.name === "w:tbl")
        return [
          {
            table: elements(item, "w:tr").map((row) =>
              elements(row, "w:tc").map((cell) => findAll(cell, "w:p").map(paragraph)),
            ),
          },
        ];
      return ["w:sdt", "w:sdtContent", "w:customXml", "w:ins"].includes(item.name) ? blocks(item) : [];
    });

  return { type: "document", blocks: blocks(child(pack.xml(part), "w:body")) };
}

// --- Excel ---

/** The index of a column from its letters (A → 0, AA → 26). */
export function columnIndex(letters: string): number {
  let index = 0;
  for (const letter of letters.toUpperCase()) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

const builtInDates = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/** Whether a number format shows a date or a time; quoted text, escapes and colours are not counted. */
function isDateFormat(code: string): boolean {
  const bare = code.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, "");
  return /[dmyhs]/i.test(bare);
}

/** An Excel serial date (days since 1899-12-30) as an ISO date, with the time when it has one. */
export function excelDate(serial: number): string {
  const time = new Date(Math.round((serial - 25569) * 86400000)).toISOString();
  return serial % 1 ? time.slice(0, 16).replace("T", " ") : time.slice(0, 10);
}

function readXlsx(pack: Package): OfficeContent {
  const part = "xl/workbook.xml";
  const rels = relationships(pack, part);
  const strings = elements(pack.xml("xl/sharedStrings.xml"), "si").map((item) =>
    findAll(item, "t").map(textOf).join(""),
  );
  const styles = pack.xml("xl/styles.xml");
  const formats = new Map(
    elements(child(styles, "numFmts"), "numFmt").map((item) => [Number(item.attrs.numFmtId), item.attrs.formatCode]),
  );
  const dateStyles = elements(child(styles, "cellXfs"), "xf").map((xf) => {
    const id = Number(xf.attrs.numFmtId ?? 0);
    return builtInDates.has(id) || isDateFormat(formats.get(id) ?? "");
  });

  const value = (cell: XmlElement): string => {
    const raw = textOf(child(cell, "v"));
    switch (cell.attrs.t) {
      case "s":
        return strings[Number(raw)] ?? "";
      case "inlineStr":
        return findAll(child(cell, "is"), "t").map(textOf).join("");
      case "b":
        return raw === "1" ? "TRUE" : "FALSE";
      case "str":
      case "e":
        return raw;
      default:
        return raw && dateStyles[Number(cell.attrs.s ?? 0)] && Number.isFinite(Number(raw))
          ? excelDate(Number(raw))
          : raw;
    }
  };

  const sheets = findAll(pack.xml(part), "sheet").map((sheet): Sheet => {
    const target = rels.get(sheet.attrs["r:id"])?.target ?? "";
    const rows: string[][] = [];
    let cut = false;
    for (const row of findAll(pack.xml(target), "row")) {
      const rowIndex = row.attrs.r ? Number(row.attrs.r) - 1 : rows.length;
      if (rowIndex >= sheetLimits.rows) {
        cut = true;
        break;
      }
      const cells: string[] = [];
      for (const cell of elements(row, "c")) {
        const column = cell.attrs.r ? columnIndex(cell.attrs.r.replace(/\d+$/, "")) : cells.length;
        if (column >= sheetLimits.columns) {
          cut = true;
          continue;
        }
        cells[column] = value(cell);
      }
      rows[rowIndex] = Array.from(cells, (cell) => cell ?? "");
    }
    return { name: sheet.attrs.name ?? "", rows: Array.from(rows, (row) => row ?? []), cut };
  });
  return { type: "sheets", sheets };
}

// --- PowerPoint ---

function readPptx(pack: Package): OfficeContent {
  const part = "ppt/presentation.xml";
  const rels = relationships(pack, part);
  const slides = findAll(pack.xml(part), "p:sldId").map((id) => {
    const slidePart = rels.get(id.attrs["r:id"])?.target ?? "";
    const slideRels = relationships(pack, slidePart);
    const blocks: Block[] = [];
    const walk = (element: XmlElement, title: boolean) => {
      for (const item of elements(element)) {
        if (item.name === "p:sp") {
          const type = find(item, "p:ph")?.attrs.type ?? "";
          walk(item, type === "title" || type === "ctrTitle");
        } else if (item.name === "a:p") {
          const runs = elements(item).flatMap((run): Run[] => {
            if (run.name === "a:br") return [{ text: "\n" }];
            if (run.name !== "a:r" && run.name !== "a:fld") return [];
            const look = child(run, "a:rPr")?.attrs ?? {};
            return [
              {
                text: textOf(child(run, "a:t")),
                bold: look.b === "1",
                italic: look.i === "1",
                underline: Boolean(look.u) && look.u !== "none",
                strike: Boolean(look.strike) && look.strike !== "noStrike",
              },
            ];
          });
          if (runs.length) blocks.push({ paragraph: { runs, heading: title ? 2 : undefined } });
        } else if (item.name === "p:pic") {
          const rel = slideRels.get(find(item, "a:blip")?.attrs["r:embed"] ?? "");
          const image = rel && !rel.external ? pack.image(rel.target) : undefined;
          if (image) blocks.push({ paragraph: { runs: [{ image, alt: find(item, "p:cNvPr")?.attrs.descr }] } });
        } else walk(item, title);
      }
    };
    const slide = pack.xml(slidePart);
    if (slide) walk(slide, false);
    return blocks;
  });
  return { type: "slides", slides };
}

// --- Plain tables ---

function readDelimited(text: string, tab: boolean): OfficeContent {
  const rows = tab ? text.split(/\r?\n/).map((line) => line.split("\t")) : parseCsv(text);
  while (rows.length && rows[rows.length - 1].every((cell) => !cell)) rows.pop();
  const cut = rows.length > sheetLimits.rows || rows.some((row) => row.length > sheetLimits.columns);
  return {
    type: "sheets",
    sheets: [{ name: "", rows: rows.slice(0, sheetLimits.rows).map((row) => row.slice(0, sheetLimits.columns)), cut }],
  };
}

/** Reads an office file (Word, Excel, PowerPoint, OpenDocument, CSV or TSV), by its extension, for the preview. */
export function readOffice(name: string, data: ArrayBuffer): OfficeContent {
  const extension = name.toLowerCase().match(/\.([a-z]+)$/)?.[1] ?? "";
  if (extension === "csv" || extension === "tsv")
    return readDelimited(new TextDecoder().decode(data), extension === "tsv");
  const pack = Package.open(data);
  if (extension === "docx") return readDocx(pack);
  if (extension === "xlsx") return readXlsx(pack);
  if (extension === "pptx") return readPptx(pack);
  if (["odt", "ods", "odp"].includes(extension)) return readOpenDocument(pack);
  throw new Error(`Not an office file: ${name}`);
}
