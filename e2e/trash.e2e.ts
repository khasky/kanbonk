import { expect, importTrelloBoard, test } from "./fixtures";

test("moves a list to the trash and restores it", async ({ page }) => {
  await importTrelloBoard(page);
  const boardUrl = page.url();
  await page.getByLabel("List actions Plans").click();
  await page.getByRole("button", { name: "Move list to trash" }).click();
  await page.getByRole("alertdialog", { name: "Move to trash" }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByLabel("List title Plans")).toBeHidden();
  await expect(page.getByRole("link", { name: "Trash: 2" })).toBeVisible();

  await page.getByRole("link", { name: "Trash: 2" }).click();
  await expect(page.getByRole("main")).toContainText("Plans");
  await page.getByRole("main").getByRole("button", { name: "Restore" }).first().click();
  await expect(page.getByRole("link", { name: "Trash: 0" })).toBeVisible();

  await page.goto(boardUrl);
  await expect(page.getByLabel("List title Plans")).toBeVisible();
  await expect(page.getByRole("button", { name: /Card from Trello/ })).toBeVisible();
});
