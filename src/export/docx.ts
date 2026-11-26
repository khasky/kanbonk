import { strToU8, zipSync } from "fflate";
import { t } from "../i18n";
import type { DocCard, ExportDocModel } from "./exportData";
import { xmlText } from "./xlsx";

const hex = (color: string) => color.replace("#", "").toUpperCase();

/** A run of text; newlines become line breaks. */
function run(text: string, props = ""): string {
  const lines = text.split("\n");
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}${lines
    .map((line, index) => `${index ? "<w:br/>" : ""}<w:t xml:space="preserve">${xmlText(line)}</w:t>`)
    .join("")}</w:r>`;
}

function paragraph(content: string, props = ""): string {
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}${content}</w:p>`;
}

const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

/** The card's fields as a two-column table; styled tables have light borders and a shaded label column. */
function detailsTable(card: DocCard, styled: boolean): string {
  const border = styled ? "DFE1E6" : "000000";
  const borders = ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="${border}"/>`)
    .join("");
  const shade = styled ? '<w:shd w:val="clear" w:color="auto" w:fill="F4F5F7"/>' : "";
  const rows = card.details
    .map(
      (item) =>
        `<w:tr><w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/>${shade}</w:tcPr>${paragraph(run(item.label, "<w:b/>"))}</w:tc><w:tc><w:tcPr><w:tcW w:w="6600" w:type="dxa"/></w:tcPr>${paragraph(run(item.value))}</w:tc></w:tr>`,
    )
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="2400"/><w:gridCol w:w="6600"/></w:tblGrid>${rows}</w:tbl>`;
}

function cardBody(card: DocCard, model: ExportDocModel): string {
  const styled = model.style === "styled";
  const parts = [paragraph(run(card.name), '<w:pStyle w:val="Heading2"/><w:keepNext/>')];
  if (card.details.length) parts.push(detailsTable(card, styled), paragraph(""));
  if (card.description)
    parts.push(
      paragraph(run(t("exporting.fieldDescription")), '<w:pStyle w:val="Heading3"/><w:keepNext/>'),
      ...card.description.split(/\n{2,}/).map((block) => paragraph(run(block))),
    );
  for (const checklist of card.checklists ?? []) {
    const done = checklist.items.filter((item) => item.checked).length;
    parts.push(
      paragraph(
        run(`${checklist.name} (${done}/${checklist.items.length})`),
        '<w:pStyle w:val="Heading3"/><w:keepNext/>',
      ),
      ...checklist.items.map((item) =>
        paragraph(
          `${run(item.checked ? "☑ " : "☐ ")}${run(item.name, item.checked ? '<w:strike/><w:color w:val="6B778C"/>' : "")}`,
          '<w:ind w:left="240"/><w:spacing w:after="40"/>',
        ),
      ),
    );
  }
  if (card.comments) {
    parts.push(paragraph(run(t("exporting.fieldComments")), '<w:pStyle w:val="Heading3"/><w:keepNext/>'));
    for (const comment of card.comments)
      parts.push(
        paragraph(run(`${comment.author} · ${comment.date}`, '<w:b/><w:sz w:val="18"/>'), "<w:keepNext/>"),
        paragraph(run(comment.text), '<w:ind w:left="240"/>'),
      );
  }
  return parts.join("");
}

function coverPage(model: ExportDocModel): string {
  const lines = [
    t("common.cards", { count: model.cardCount }),
    model.dueRange ? t("exporting.coverDue", { from: model.dueRange[0], to: model.dueRange[1] }) : "",
    t("exporting.coverExported", { date: model.exportedAt }),
  ].filter(Boolean);
  return [
    paragraph("", '<w:spacing w:before="2400"/>'),
    paragraph(run(model.title), '<w:pStyle w:val="Title"/>'),
    ...lines.map((line) => paragraph(run(line, '<w:color w:val="44546F"/>'))),
  ].join("");
}

/** A Word document of the picked cards: an optional cover page, a heading per list and a section per card. */
export function buildDocx(model: ExportDocModel): Uint8Array {
  const styled = model.style === "styled";
  const color = styled ? hex(model.accent) : "000000";
  const body: string[] = [];
  if (model.cover) {
    body.push(coverPage(model));
    if (!model.pagePerList) body.push(pageBreak);
  } else body.push(paragraph(run(model.title), '<w:pStyle w:val="Title"/>'));
  model.sections.forEach((section, index) => {
    const breakBefore = model.pagePerList && (index > 0 || model.cover) ? "<w:pageBreakBefore/>" : "";
    body.push(paragraph(run(section.name), `<w:pStyle w:val="Heading1"/><w:keepNext/>${breakBefore}`));
    for (const card of section.cards) body.push(cardBody(card, model));
  });
  const heading = (id: string, name: string, size: number, extra = "") =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/>${extra}</w:pPr><w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr></w:style>`;
  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`,
    "word/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="52"/></w:rPr></w:style>${heading("Heading1", "heading 1", 34, styled ? `<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" w:color="${color}"/></w:pBdr><w:outlineLvl w:val="0"/>` : '<w:outlineLvl w:val="0"/>')}${heading("Heading2", "heading 2", 26, '<w:outlineLvl w:val="1"/>')}${heading("Heading3", "heading 3", 21, '<w:outlineLvl w:val="2"/>')}</w:styles>`,
    "word/footer1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`,
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body.join("")}<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([path, text]) => [path, strToU8(text)])), { level: 6 });
}
