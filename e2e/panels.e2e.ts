import { expect, importTrelloBoard, test } from "./fixtures";

test("board Activity renders comment Markdown, History says what changed, and Escape closes the top panel", async ({
  page,
}) => {
  await importTrelloBoard(page);
  await page.getByRole("button", { name: /Card from Trello/ }).click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });
  await card.getByText("Write a comment").click();
  await page.keyboard.type("Some ");
  await card.getByRole("button", { name: "Bold" }).click();
  await page.keyboard.type("bold");
  await card.getByRole("button", { name: "Bold" }).click();
  await page.keyboard.type(" text");
  await card.locator(".activity-panel").getByRole("button", { name: "Send" }).click();
  await expect(card.locator(".activity-panel strong", { hasText: "bold" })).toBeVisible();

  await card.getByLabel("Card actions").click();
  await card.getByRole("button", { name: "Card history" }).click();
  const history = page.getByRole("dialog", { name: "Version history" });
  await expect(history.getByText("Comments (+1)")).toBeVisible();
  await expect(history.getByText(/\d\.\d KB/).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(history).toBeHidden();
  await expect(card).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();

  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Activity" }).click();
  const activity = page.getByRole("dialog", { name: "Board activity" });
  await expect(activity.locator("strong", { hasText: /^bold$/ })).toBeVisible();
  await expect(activity).not.toContainText("**bold**");
  await page.keyboard.press("Escape");
  await expect(activity).toBeHidden();
});
