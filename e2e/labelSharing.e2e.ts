import { expect, importTrelloBoard, test } from "./fixtures";

test("shares a label with another board and keeps it in sync when it is renamed there", async ({ page }) => {
  await importTrelloBoard(page);
  const sidebar = page.getByRole("complementary");
  await page.getByRole("button", { name: "Add board to Personal" }).click();
  await page.keyboard.type("Second");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Board title")).toHaveValue("Second");
  await page.getByRole("button", { name: "Add a list" }).click();
  await page.keyboard.type("Todo");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Add a card" }).click();
  await page.keyboard.type("Task");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: /Task/ })).toBeVisible();

  await sidebar.getByRole("link", { name: "Trello import", exact: true }).click();
  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Share labels" }).click();
  const share = page.getByRole("dialog", { name: "Share labels with other boards" });
  await expect(share.getByRole("button", { name: "Share" })).toBeDisabled();
  await share.getByRole("checkbox", { name: "Important" }).check();
  await share.getByRole("checkbox", { name: /^Second/ }).check();
  await share.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Labels shared with 1 board." })).toBeVisible();

  await sidebar.getByRole("link", { name: "Second", exact: true }).click();
  await page.getByRole("link", { name: /Task/ }).click();
  const card = page.getByRole("dialog", { name: "Task" });
  await card.getByRole("button", { name: "Labels", exact: true }).click();
  await card.locator(".label-picker").getByRole("checkbox").first().check();
  await card.getByRole("button", { name: "Edit label Important" }).click();
  await expect(card.getByText("This label is shared")).toBeVisible();
  await card.getByLabel("Label name").fill("Critical");
  await card.locator(".label-picker").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("link", { name: /Critical Task/ })).toBeVisible();
  await card.getByRole("button", { name: "Close" }).first().click();
  await expect(card).toBeHidden();

  await sidebar.getByRole("link", { name: "Trello import", exact: true }).click();
  await expect(page.getByRole("link", { name: /Critical Card from Trello/ })).toBeVisible();
});
