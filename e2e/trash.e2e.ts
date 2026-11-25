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
  await expect(page.getByRole("link", { name: /Card from Trello/ })).toBeVisible();
});

test("shows a trashed card read-only, follows the trash period from Settings and deletes it forever", async ({
  page,
}) => {
  await importTrelloBoard(page);
  await page.getByRole("link", { name: /Card from Trello/ }).click();
  await page.getByLabel("Card actions").click();
  await page.getByRole("button", { name: "Move to trash" }).click();
  await page.getByRole("alertdialog", { name: "Move to trash" }).getByRole("button", { name: "Delete" }).click();

  await page.getByLabel("App menu").click();
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await settings.getByLabel("Delete items in the trash forever after").selectOption("14");
  await settings.getByRole("button", { name: "Close" }).click();

  await page.getByRole("link", { name: /Trash:/ }).click();
  const main = page.getByRole("main");
  await expect(main).toContainText("Items are deleted forever 14 days after they were moved here.");
  await expect(main).toContainText("deleted in 14 days");
  await main.getByRole("button", { name: "Card from Trello" }).click();
  const viewed = page.getByRole("dialog", { name: "Card from Trello" });
  await expect(viewed).toContainText("will be deleted forever in 14 days");
  await expect(viewed.getByRole("checkbox", { name: "Remaining" })).toBeDisabled();
  // The same card dialog as on a board, with its editing controls disabled; files can still be downloaded.
  await expect(viewed.getByRole("textbox", { name: "Card title", exact: true })).toBeDisabled();
  await expect(viewed.locator("input:enabled, textarea:enabled, select:enabled, [contenteditable=true]")).toHaveCount(
    0,
  );
  await expect(viewed.getByRole("button", { name: "Write a comment…" })).toBeDisabled();
  await expect(viewed.locator(".card-actions button:enabled")).toHaveCount(0);

  await viewed.getByRole("button", { name: "Delete forever" }).click();
  const ask = page.getByRole("alertdialog", { name: "Delete “Card from Trello” forever?" });
  await ask.getByRole("button", { name: "Cancel" }).click();
  await expect(viewed).toBeVisible();
  await viewed.getByRole("button", { name: "Delete forever" }).click();
  await ask.getByRole("button", { name: "Delete forever" }).click();
  await expect(viewed).toBeHidden();
  await expect(main).not.toContainText("Card from Trello");
});
