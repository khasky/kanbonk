import { expect, importTrelloBoard, test } from "./fixtures";

test("edits a card: label, checklist, sub-card, comment and description", async ({ page }) => {
  await importTrelloBoard(page);
  await page.getByRole("button", { name: /Card from Trello/ }).click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });

  await card.getByRole("button", { name: "Labels" }).click();
  await card.getByLabel("New label").fill("Urgent");
  await card.locator(".label-picker").getByRole("button", { name: "Add" }).click();
  await card.getByRole("button", { name: "Labels" }).click();
  await expect(page.getByRole("button", { name: /Important Urgent Card from Trello/ })).toBeVisible();

  await card.getByLabel("Check item Remaining").check();
  await expect(card.getByText("100%")).toBeVisible();

  await card.getByLabel("New sub-card title").fill("Child one");
  await card.getByLabel("New sub-card title").press("Enter");
  await expect(card.getByRole("button", { name: /Child one/ })).toBeVisible();

  await card.getByText("Write a comment").click();
  await page.keyboard.type("First comment");
  await card.locator(".activity-panel").getByRole("button", { name: "Send" }).click();
  await expect(card.locator(".activity-panel")).toContainText("First comment");

  await card
    .getByRole("heading", { name: /Description/ })
    .getByRole("button", { name: "Edit" })
    .click();
  const description = card.getByRole("textbox", { name: "Card description" });
  await description.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Updated description");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card).toContainText("Updated description");

  await page.reload();
  const reopened = page.getByRole("dialog", { name: "Card from Trello" });
  await expect(reopened).toContainText("Updated description");
  await expect(reopened).toContainText("First comment");
  await expect(reopened.getByLabel("Check item Remaining")).toBeChecked();
});
