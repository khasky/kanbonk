import { expect, importTrelloBoard, test } from "./fixtures";

test("finishes a card with its Done button and as the board says, also when it is moved to the done list", async ({
  page,
}) => {
  await importTrelloBoard(page);
  const tile = page.getByRole("link", { name: /Card from Trello/ });
  await tile.click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });
  await card.getByRole("button", { name: "Mark done" }).click();
  await expect(card.getByRole("button", { name: "Done", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".done-cheer")).toBeAttached();
  await expect(tile).toContainText("Done");
  await card.getByRole("button", { name: "Done", exact: true }).click();
  await expect(card.getByRole("button", { name: "Mark done" })).toHaveAttribute("aria-pressed", "false");
  await card.getByRole("button", { name: "Close" }).first().click();
  await expect(card).toBeHidden();

  await page.getByRole("button", { name: "Add a list" }).click();
  await page.keyboard.type("Finished");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("List title Finished")).toBeVisible();
  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Board settings" }).click();
  const settings = page.getByRole("dialog", { name: "Board settings" });
  await settings.getByLabel("Move a finished card to").selectOption({ label: "Finished" });
  await settings.getByLabel("Check all checklist items").check();
  await settings.getByLabel("Celebrate finished cards").uncheck();
  await settings.getByRole("button", { name: "Close" }).click();

  await tile.click();
  await card.getByRole("button", { name: "Mark done" }).click();
  await expect(card.getByText("in list “Finished”")).toBeVisible();
  await expect(card.getByLabel("Check item Remaining")).toBeChecked();
  await expect(page.locator(".done-cheer")).toHaveCount(0);
  await card.getByRole("button", { name: "Close" }).first().click();

  // Moved out of the done list by hand, the card is open again once the list marks cards; moved back, it is done.
  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Board settings" }).click();
  await settings.getByLabel("A card moved to this list is done, and one moved out of it is not").check();
  await settings.getByRole("button", { name: "Close" }).click();
  await page.getByLabel("List actions Finished").click();
  await page.getByRole("button", { name: "Move all cards in this list", exact: true }).click();
  await page.getByRole("button", { name: "Plans", exact: true }).click();
  await expect(tile).not.toContainText("Done");
  await page.getByLabel("List actions Plans").click();
  await page.getByRole("button", { name: "Move all cards in this list", exact: true }).click();
  await page.getByRole("button", { name: "Finished", exact: true }).click();
  await expect(tile).toContainText("Done");
});
