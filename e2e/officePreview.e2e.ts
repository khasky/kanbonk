import { strToU8, zipSync } from "fflate";
import { expect, importTrelloBoard, test } from "./fixtures";

const zip = (files: Record<string, string>) =>
  Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([path, text]) => [path, strToU8(text)]))));

const docx = zip({
  "word/document.xml": `<w:document xmlns:w="w"><w:body>
    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Release plan</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Ship</w:t></w:r><w:r><w:t xml:space="preserve"> on Friday</w:t></w:r></w:p>
    <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Owner</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Ann</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
  </w:body></w:document>`,
  "word/styles.xml": '<w:styles xmlns:w="w"><w:style w:styleId="Title"><w:name w:val="Title"/></w:style></w:styles>',
});

const sheet = (rows: string[][]) =>
  `<worksheet><sheetData>${rows
    .map(
      (row, index) =>
        `<row r="${index + 1}">${row.map((value) => `<c t="inlineStr"><is><t>${value}</t></is></c>`).join("")}</row>`,
    )
    .join("")}</sheetData></worksheet>`;
const xlsx = zip({
  "xl/workbook.xml":
    '<workbook xmlns:r="r"><sheets><sheet name="Budget" r:id="a"/><sheet name="Notes" r:id="b"/></sheets></workbook>',
  "xl/_rels/workbook.xml.rels":
    '<Relationships><Relationship Id="a" Target="worksheets/sheet1.xml"/><Relationship Id="b" Target="worksheets/sheet2.xml"/></Relationships>',
  "xl/worksheets/sheet1.xml": sheet([
    ["Item", "Cost"],
    ["Domain", "12"],
  ]),
  "xl/worksheets/sheet2.xml": sheet([["Remember the receipts"]]),
});

const pptx = zip({
  "ppt/presentation.xml":
    '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId r:id="s"/></p:sldIdLst></p:presentation>',
  "ppt/_rels/presentation.xml.rels": '<Relationships><Relationship Id="s" Target="slides/slide1.xml"/></Relationships>',
  "ppt/slides/slide1.xml": `<p:sld xmlns:p="p" xmlns:a="a"><p:cSld><p:spTree>
    <p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Kickoff</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld></p:sld>`,
});

test("previews Word, Excel, PowerPoint and CSV attachments without leaving the app", async ({ page }) => {
  await importTrelloBoard(page);
  await page.getByRole("link", { name: /Card from Trello/ }).click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });
  await card.locator(".card-actions").getByRole("button", { name: "Add", exact: true }).click();
  await card.locator("label.file-button input[type=file]").setInputFiles([
    { name: "plan.docx", mimeType: "", buffer: docx },
    { name: "budget.xlsx", mimeType: "", buffer: xlsx },
    { name: "kickoff.pptx", mimeType: "", buffer: pptx },
    { name: "people.csv", mimeType: "text/csv", buffer: Buffer.from('name,role\nAnn,"Lead, design"\n') },
    { name: "broken.docx", mimeType: "", buffer: Buffer.from("not a zip") },
  ]);

  await card.getByRole("button", { name: /^View all attachments/ }).click();
  await card.getByRole("button", { name: "Preview plan.docx" }).click();
  let preview = page.getByRole("dialog", { name: "Preview plan.docx" });
  await expect(preview.getByRole("heading", { name: "Release plan", level: 1 })).toBeVisible();
  await expect(preview.locator("strong", { hasText: "Ship" })).toBeVisible();
  await expect(preview.getByRole("cell", { name: "Ann" })).toBeVisible();
  await preview.getByRole("button", { name: "Close preview" }).click();

  await card.getByRole("button", { name: "Preview budget.xlsx" }).click();
  preview = page.getByRole("dialog", { name: "Preview budget.xlsx" });
  await expect(preview.getByRole("cell", { name: "Domain" })).toBeVisible();
  await expect(preview.getByRole("columnheader", { name: "B" })).toBeVisible();
  await preview.getByRole("tab", { name: "Notes" }).click();
  await expect(preview.getByRole("cell", { name: "Remember the receipts" })).toBeVisible();
  await preview.getByRole("button", { name: "Close preview" }).click();

  await card.getByRole("button", { name: "Preview kickoff.pptx" }).click();
  preview = page.getByRole("dialog", { name: "Preview kickoff.pptx" });
  await expect(
    preview.getByRole("region", { name: "Slide 1" }).getByRole("heading", { name: "Kickoff" }),
  ).toBeVisible();
  await preview.getByRole("button", { name: "Close preview" }).click();

  await card.getByRole("button", { name: "Preview people.csv" }).click();
  preview = page.getByRole("dialog", { name: "Preview people.csv" });
  await expect(preview.getByRole("cell", { name: "Lead, design" })).toBeVisible();
  await preview.getByRole("button", { name: "Close preview" }).click();

  await card.getByRole("button", { name: "Preview broken.docx" }).click();
  preview = page.getByRole("dialog", { name: "Preview broken.docx" });
  await expect(preview.getByText("This file could not be read.", { exact: false })).toBeVisible();
});
