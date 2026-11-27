import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { attachmentKind } from "../src/board/attachmentIndex";
import { buildXlsx } from "../src/export/xlsx";
import { parseXml, textOf } from "../src/lib/xml";
import { type Block, columnIndex, excelDate, type OfficeContent, readOffice } from "../src/card/officeFiles";
import { previewKind } from "../src/card/previewKinds";

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const zip = (files: Record<string, string | Uint8Array>) =>
  zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, data]) => [path, typeof data === "string" ? strToU8(data) : data]),
    ),
  ).buffer as ArrayBuffer;
const text = (block: Block) =>
  "paragraph" in block ? block.paragraph.runs.map((run) => ("text" in run ? run.text : "[img]")).join("") : "[table]";
const blocksOf = (content: OfficeContent) => {
  if (content.type !== "document") throw new Error(content.type);
  return content.blocks;
};

const w = 'xmlns:w="w" xmlns:r="r" xmlns:a="a" xmlns:wp="wp"';
const docx = zip({
  "word/document.xml": `<?xml version="1.0"?><w:document ${w}><w:body>
    <w:p><w:pPr><w:pStyle w:val="H1"/></w:pPr><w:r><w:t>Plan &amp; goals</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Bold </w:t></w:r><w:r><w:rPr><w:i w:val="0"/></w:rPr><w:t>plain</w:t></w:r>
      <w:hyperlink r:id="link"><w:r><w:t>site</w:t></w:r></w:hyperlink></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>First</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Nested</w:t></w:r></w:p>
    <w:tbl><w:tr><w:tc><w:p><w:r><w:t>A1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B1</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    <w:p><w:r><w:drawing><wp:docPr descr="Logo"/><a:blip r:embed="pic"/></w:drawing></w:r></w:p>
  </w:body></w:document>`,
  "word/_rels/document.xml.rels": `<Relationships>
    <Relationship Id="link" Target="https://example.com" TargetMode="External"/>
    <Relationship Id="pic" Target="media/logo.png"/></Relationships>`,
  "word/styles.xml": `<w:styles ${w}><w:style w:styleId="H1"><w:name w:val="heading 1"/></w:style></w:styles>`,
  "word/numbering.xml": `<w:numbering ${w}><w:abstractNum w:abstractNumId="7">
    <w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl>
    </w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="7"/></w:num></w:numbering>`,
  "word/media/logo.png": png,
});

describe("office previews", () => {
  it("previews office files and tables by extension", () => {
    for (const name of ["a.docx", "a.XLSX", "a.pptx", "a.odt", "a.ods", "a.odp", "a.csv", "a.tsv"])
      expect(previewKind(name, "application/octet-stream")).toBe("office");
    expect(previewKind("data.csv", "text/csv")).toBe("office");
    expect(previewKind("old.doc", "application/msword")).toBeUndefined();
    expect(attachmentKind({ id: "a", name: "plan.docx", mimeType: "", size: 1, status: "local" })).toBe("document");
  });

  it("parses XML with entities, CDATA and self-closing tags", () => {
    const root = parseXml('<?xml version="1.0"?><!-- note --><a x="1 &lt; 2"><b/>A&#x26;B<![CDATA[<raw>]]></a>');
    expect(root.attrs.x).toBe("1 < 2");
    expect(textOf(root)).toBe("A&B<raw>");
  });

  it("reads a Word document's headings, emphasis, links, numbered lists, tables and pictures", () => {
    const blocks = blocksOf(readOffice("plan.docx", docx));
    expect(blocks.map(text)).toEqual(["Plan & goals", "Bold plainsite", "First", "Nested", "[table]", "[img]"]);
    const [heading, styled, first, nested, table, picture] = blocks;
    expect("paragraph" in heading && heading.paragraph.heading).toBe(1);
    expect("paragraph" in styled && styled.paragraph.runs).toMatchObject([
      { text: "Bold ", bold: true },
      { text: "plain", italic: false },
      { text: "site", href: "https://example.com" },
    ]);
    expect("paragraph" in first && first.paragraph.list).toEqual({ level: 0, ordered: true });
    expect("paragraph" in nested && nested.paragraph.list).toEqual({ level: 1, ordered: false });
    expect("table" in table && table.table.map((row) => row.map((cell) => text({ paragraph: cell[0] })))).toEqual([
      ["A1", "B1"],
    ]);
    expect("paragraph" in picture && picture.paragraph.runs[0]).toMatchObject({
      image: expect.stringMatching(/^data:image\/png;base64,/),
      alt: "Logo",
    });
  });

  it("reads the sheets of a workbook the app itself exports, and Excel dates", () => {
    const data = buildXlsx(
      {
        header: ["Card", "Due"],
        rows: [
          ["Ship", "2026-12-01"],
          ["Test & fix", ""],
        ],
      },
      "Plans",
    );
    const content = readOffice("cards.xlsx", data.buffer as ArrayBuffer);
    expect(content).toEqual({
      type: "sheets",
      sheets: [
        {
          name: "Plans",
          rows: [
            ["Card", "Due"],
            ["Ship", "2026-12-01"],
            ["Test & fix", ""],
          ],
          cut: false,
        },
      ],
    });
    expect(columnIndex("AA")).toBe(26);
    expect(excelDate(46357)).toBe("2026-12-01");
    expect(excelDate(46357.5)).toBe("2026-12-01 12:00");
  });

  it("reads a deck's slides in order, with titles and pictures", () => {
    const slide = (title: string, body: string, picture = "") =>
      `<p:sld xmlns:p="p" xmlns:a="a" xmlns:r="r"><p:cSld><p:spTree>
        <p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp>
        <p:sp><p:txBody><a:p><a:r><a:rPr b="1"/><a:t>${body}</a:t></a:r><a:br/><a:r><a:t>more</a:t></a:r></a:p></p:txBody></p:sp>
        ${picture}</p:spTree></p:cSld></p:sld>`;
    const deck = zip({
      "ppt/presentation.xml":
        '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId r:id="b"/><p:sldId r:id="a"/></p:sldIdLst></p:presentation>',
      "ppt/_rels/presentation.xml.rels":
        '<Relationships><Relationship Id="a" Target="slides/slide1.xml"/><Relationship Id="b" Target="slides/slide2.xml"/></Relationships>',
      "ppt/slides/slide1.xml": slide("Second", "Body two"),
      "ppt/slides/slide2.xml": slide("First", "Body one", '<p:pic><a:blip r:embed="img"/></p:pic>'),
      "ppt/slides/_rels/slide2.xml.rels":
        '<Relationships><Relationship Id="img" Target="../media/image1.png"/></Relationships>',
      "ppt/media/image1.png": png,
    });
    const content = readOffice("talk.pptx", deck);
    if (content.type !== "slides") throw new Error(content.type);
    expect(content.slides.map((blocks) => blocks.map(text))).toEqual([
      ["First", "Body one\nmore", "[img]"],
      ["Second", "Body two\nmore"],
    ]);
    expect(content.slides[0][0]).toMatchObject({ paragraph: { heading: 2 } });
    expect(content.slides[0][1]).toMatchObject({ paragraph: { runs: [{ bold: true }, {}, {}] } });
  });

  it("reads OpenDocument text, spreadsheets and presentations", () => {
    const ns =
      'xmlns:office="o" xmlns:text="t" xmlns:table="tb" xmlns:style="s" xmlns:fo="fo" xmlns:draw="d" xmlns:xlink="x" xmlns:presentation="p"';
    const odt = zip({
      "content.xml": `<office:document-content ${ns}>
        <office:automatic-styles><style:style style:name="B"><style:text-properties fo:font-weight="bold"/></style:style>
          <text:list-style style:name="L"><text:list-level-style-number text:level="1"/></text:list-style></office:automatic-styles>
        <office:body><office:text><text:h text:outline-level="2">Title</text:h>
          <text:p>Hello <text:span text:style-name="B">world</text:span><text:s text:c="2"/>!</text:p>
          <text:list text:style-name="L"><text:list-item><text:p>One</text:p></text:list-item></text:list>
          <table:table><table:table-row><table:table-cell><text:p>Cell</text:p></table:table-cell></table:table-row></table:table>
        </office:text></office:body></office:document-content>`,
    });
    const blocks = blocksOf(readOffice("note.odt", odt));
    expect(blocks.map(text)).toEqual(["Title", "Hello world  !", "One", "[table]"]);
    expect(blocks[0]).toMatchObject({ paragraph: { heading: 2 } });
    expect(blocks[1]).toMatchObject({
      paragraph: { runs: [{ text: "Hello " }, { text: "world", bold: true }, {}, {}] },
    });
    expect(blocks[2]).toMatchObject({ paragraph: { list: { level: 0, ordered: true } } });

    const ods = zip({
      "content.xml": `<office:document-content ${ns}><office:body><office:spreadsheet><table:table table:name="Budget">
        <table:table-row><table:table-cell table:number-columns-repeated="2"><text:p>x</text:p></table:table-cell><table:table-cell table:number-columns-repeated="16000"/></table:table-row>
        <table:table-row table:number-rows-repeated="1048000"><table:table-cell/></table:table-row>
        </table:table></office:spreadsheet></office:body></office:document-content>`,
    });
    expect(readOffice("budget.ods", ods)).toEqual({
      type: "sheets",
      sheets: [{ name: "Budget", rows: [["x", "x"]], cut: false }],
    });

    const odp = zip({
      "content.xml": `<office:document-content ${ns}><office:body><office:presentation>
        <draw:page><draw:frame presentation:class="title"><draw:text-box><text:p>Hi</text:p></draw:text-box></draw:frame>
          <draw:frame><draw:image xlink:href="Pictures/a.png"/></draw:frame></draw:page>
        </office:presentation></office:body></office:document-content>`,
      "Pictures/a.png": png,
    });
    const deck = readOffice("deck.odp", odp);
    if (deck.type !== "slides") throw new Error(deck.type);
    expect(deck.slides.map((slide) => slide.map(text))).toEqual([["Hi", "[img]"]]);
  });

  it("shows CSV and TSV as one sheet and cuts very large ones", () => {
    const csv = strToU8('name,note\n"Ann","says ""hi"", twice"\n\n').buffer as ArrayBuffer;
    expect(readOffice("people.csv", csv)).toEqual({
      type: "sheets",
      sheets: [
        {
          name: "",
          rows: [
            ["name", "note"],
            ["Ann", 'says "hi", twice'],
          ],
          cut: false,
        },
      ],
    });
    const tsv = strToU8(Array.from({ length: 1200 }, (_, index) => `${index}\tx`).join("\n")).buffer as ArrayBuffer;
    const content = readOffice("big.tsv", tsv);
    expect(content.type === "sheets" && [content.sheets[0].rows.length, content.sheets[0].cut]).toEqual([1000, true]);
  });

  it("refuses files that are not what their name says", () => {
    expect(() => readOffice("plan.docx", strToU8("not a zip").buffer as ArrayBuffer)).toThrow();
    expect(() => readOffice("plan.doc", new ArrayBuffer(0))).toThrow();
  });
});
