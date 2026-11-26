import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { expect, importTrelloBoard, test } from "./fixtures";

test("exports the picked cards of a board as Excel and Word, with a live preview", async ({ page }) => {
  await importTrelloBoard(page);
  const plans = page.locator(".list-column").filter({ has: page.getByLabel("List title Plans") });
  await plans.getByRole("button", { name: "Add a card" }).click();
  await page.keyboard.type("Second card");
  await page.keyboard.press("Enter");
  await expect(plans.getByRole("link", { name: "Second card" })).toBeVisible();

  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Export…" }).click();
  const dialog = page.getByRole("dialog", { name: "Export board" });
  const preview = dialog.getByRole("region", { name: "Preview" });
  await expect(preview.getByRole("cell", { name: "Card from Trello" })).toBeVisible();
  await expect(preview.getByRole("cell", { name: "Second card" })).toBeVisible();

  // Untick one card: it leaves the preview and the file.
  await dialog.getByRole("button", { name: "Show the cards of Plans" }).click();
  await dialog.getByRole("checkbox", { name: "Second card" }).uncheck();
  await expect(preview.getByRole("cell", { name: "Second card" })).toHaveCount(0);
  await expect(dialog.getByText("1 card", { exact: true })).toBeVisible();

  const excel = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download" }).click();
  const file = await excel;
  expect(file.suggestedFilename()).toBe("Trello import.xlsx");
  const sheet = strFromU8(unzipSync(await readFile(await file.path()))["xl/worksheets/sheet1.xml"]);
  expect(sheet).toContain("Card from Trello");
  expect(sheet).not.toContain("Second card");

  await dialog.getByLabel("Format").selectOption({ label: "Word (.docx)" });
  await dialog.getByLabel("Title", { exact: true }).fill("Plans report");
  await expect(preview.getByRole("heading", { name: "Plans report" })).toBeVisible();
  await expect(preview.getByRole("heading", { name: "Card from Trello" })).toBeVisible();
  const word = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download" }).click();
  const document = await word;
  expect(document.suggestedFilename()).toBe("Plans report.docx");
  expect(strFromU8(unzipSync(await readFile(await document.path()))["word/document.xml"])).toContain("Plans report");

  // The format is remembered for the next export.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Export…" }).click();
  await expect(page.getByRole("dialog", { name: "Export board" }).getByLabel("Format")).toHaveValue("docx");
});
