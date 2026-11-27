import { child, elements, findAll, textOf, type XmlElement } from "../lib/xml";
import { type Block, type OfficeContent, type Package, type Paragraph, type Run, sheetLimits } from "./officePackage";

type Look = Omit<Extract<Run, { text: string }>, "text">;

/** Text looks and numbered list styles of an OpenDocument, from its automatic and named styles. */
function readStyles(pack: Package, content: XmlElement | undefined) {
  const sources = [child(content, "office:automatic-styles"), child(pack.xml("styles.xml"), "office:styles")];
  const looks = new Map<string, Look>();
  const lists = new Map<string, Set<number>>();
  for (const source of sources) {
    for (const style of elements(source, "style:style")) {
      const text = child(style, "style:text-properties")?.attrs ?? {};
      looks.set(style.attrs["style:name"], {
        bold: text["fo:font-weight"] === "bold",
        italic: text["fo:font-style"] === "italic",
        underline: Boolean(text["style:text-underline-style"]) && text["style:text-underline-style"] !== "none",
        strike: Boolean(text["style:text-line-through-style"]) && text["style:text-line-through-style"] !== "none",
      });
    }
    for (const list of elements(source, "text:list-style"))
      lists.set(
        list.attrs["style:name"],
        new Set(elements(list, "text:list-level-style-number").map((level) => Number(level.attrs["text:level"]) - 1)),
      );
  }
  return { looks, lists };
}

const skipped = new Set(["text:tracked-changes", "office:annotation", "text:note", "text:sequence-decls"]);

function reader(pack: Package, content: XmlElement | undefined) {
  const { looks, lists } = readStyles(pack, content);
  const look = (element: XmlElement, base: Look): Look => ({
    ...base,
    ...Object.fromEntries(Object.entries(looks.get(element.attrs["text:style-name"]) ?? {}).filter(([, on]) => on)),
  });

  const images = (frame: XmlElement): Run[] =>
    findAll(frame, "draw:image").flatMap((image) => {
      const src = pack.image(image.attrs["xlink:href"] ?? "");
      return src ? [{ image: src, alt: textOf(child(frame, "svg:desc")) || undefined }] : [];
    });

  const runs = (element: XmlElement, base: Look): Run[] =>
    element.children.flatMap((item): Run[] => {
      if (typeof item === "string") return item ? [{ text: item.replace(/\s+/g, " "), ...base }] : [];
      if (skipped.has(item.name)) return [];
      if (item.name === "text:s") return [{ text: " ".repeat(Number(item.attrs["text:c"] ?? 1)), ...base }];
      if (item.name === "text:tab") return [{ text: "\t", ...base }];
      if (item.name === "text:line-break") return [{ text: "\n", ...base }];
      if (item.name === "draw:frame") return images(item);
      if (item.name === "text:a") return runs(item, { ...base, href: item.attrs["xlink:href"] });
      return runs(item, look(item, base));
    });

  const paragraph = (element: XmlElement, extra: Omit<Paragraph, "runs">): Paragraph => ({
    runs: runs(element, look(element, {})),
    ...extra,
  });

  type Context = { list?: { style: string; level: number }; title?: boolean };
  const blocks = (element: XmlElement, context: Context = {}): Block[] =>
    elements(element).flatMap((item): Block[] => {
      if (skipped.has(item.name)) return [];
      const list = context.list && {
        level: context.list.level,
        ordered: lists.get(context.list.style)?.has(context.list.level) ?? false,
      };
      if (item.name === "text:p")
        return [{ paragraph: paragraph(item, { list, heading: context.title ? 2 : undefined }) }];
      if (item.name === "text:h")
        return [
          { paragraph: paragraph(item, { heading: Math.min(6, Number(item.attrs["text:outline-level"] ?? 1)) }) },
        ];
      if (item.name === "text:list") {
        const style = item.attrs["text:style-name"] ?? context.list?.style ?? "";
        const level = context.list ? context.list.level + 1 : 0;
        return elements(item).flatMap((entry) => blocks(entry, { ...context, list: { style, level } }));
      }
      if (item.name === "table:table")
        return [
          {
            table: findAll(item, "table:table-row").map((row) =>
              elements(row)
                .filter((cell) => cell.name === "table:table-cell" || cell.name === "table:covered-table-cell")
                .map((cell) => blocks(cell).flatMap((block) => ("paragraph" in block ? [block.paragraph] : []))),
            ),
          },
        ];
      if (item.name === "draw:frame") {
        const title = item.attrs["presentation:class"] === "title";
        const pictures = images(item);
        return [
          ...(pictures.length ? [{ paragraph: { runs: pictures } }] : []),
          ...blocks(item, { ...context, title: context.title || title }),
        ];
      }
      if (item.name === "draw:image") return [];
      return blocks(item, context);
    });

  return { blocks };
}

/** A spreadsheet's tables, with repeated rows and cells expanded up to the shown limits and trailing blanks dropped. */
function readTables(spreadsheet: XmlElement | undefined): OfficeContent {
  const sheets = elements(spreadsheet, "table:table").map((table) => {
    const rows: string[][] = [];
    let cut = false;
    for (const row of findAll(table, "table:table-row")) {
      const cells: string[] = [];
      for (const cell of elements(row)) {
        if (cell.name !== "table:table-cell" && cell.name !== "table:covered-table-cell") continue;
        const value = elements(cell, "text:p").map(textOf).join("\n");
        const repeat = Number(cell.attrs["table:number-columns-repeated"] ?? 1);
        const room = Math.min(repeat, sheetLimits.columns - cells.length);
        for (let index = 0; index < room; index++) cells.push(value);
        if (room < repeat && value) cut = true;
      }
      while (cells.length && !cells[cells.length - 1]) cells.pop();
      const repeat = Number(row.attrs["table:number-rows-repeated"] ?? 1);
      const room = Math.min(repeat, sheetLimits.rows - rows.length);
      for (let index = 0; index < room; index++) rows.push(cells);
      if (room < repeat && cells.length) cut = true;
    }
    while (rows.length && !rows[rows.length - 1].length) rows.pop();
    return { name: table.attrs["table:name"] ?? "", rows, cut };
  });
  return { type: "sheets", sheets };
}

/** Reads an OpenDocument text, spreadsheet or presentation (odt, ods, odp) for the preview. */
export function readOpenDocument(pack: Package): OfficeContent {
  const content = pack.xml("content.xml");
  const body = child(content, "office:body");
  const spreadsheet = child(body, "office:spreadsheet");
  if (spreadsheet) return readTables(spreadsheet);
  const { blocks } = reader(pack, content);
  const presentation = child(body, "office:presentation");
  if (presentation) return { type: "slides", slides: elements(presentation, "draw:page").map((page) => blocks(page)) };
  const text = child(body, "office:text");
  if (!text) throw new Error("Not an OpenDocument file");
  return { type: "document", blocks: blocks(text) };
}
