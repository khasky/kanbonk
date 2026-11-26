import { expect, importTrelloBoard, test } from "./fixtures";

test("mirrors a card on another board, keeps both alike, deletes one or both and stops mirroring", async ({ page }) => {
  await importTrelloBoard(page);
  const sidebar = page.getByRole("complementary");
  await page.getByRole("button", { name: "Add board to Personal" }).click();
  await page.keyboard.type("Second");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Board title")).toHaveValue("Second");
  await page.getByRole("button", { name: "Add a list" }).click();
  await page.keyboard.type("Todo");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("List title Todo")).toBeVisible();

  await sidebar.getByRole("link", { name: "Trello import", exact: true }).click();
  const original = page.getByRole("link", { name: /Card from Trello/ });
  await original.click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });
  await card.getByLabel("Card actions").click();
  await card.getByRole("button", { name: "Move / copy" }).click();
  const picker = card.getByRole("region", { name: "Move or copy card" });
  await picker.getByLabel("Board").selectOption({ label: "Second" });
  await picker.getByRole("button", { name: "Mirror" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Mirror made in “Second”, list “Todo”." })).toBeVisible();
  const mirrors = card.getByRole("region", { name: "Mirrors" });
  await expect(mirrors.getByRole("button", { name: "Second · Todo" })).toBeVisible();

  // A change here shows on the mirror.
  await card.getByLabel("Check item Remaining").check();
  await card.getByRole("button", { name: "Close" }).first().click();
  await expect(card).toBeHidden();
  await expect(original.getByTitle("Mirrored on 1 more card")).toBeVisible();

  await sidebar.getByRole("link", { name: "Second", exact: true }).click();
  const mirror = page.getByRole("link", { name: /Card from Trello/ });
  await expect(mirror.getByTitle("Mirrored on 1 more card")).toBeVisible();
  await mirror.click();
  const copy = page.getByRole("dialog", { name: "Card from Trello" });
  await expect(copy.getByLabel("Check item Remaining")).toBeChecked();

  // A change on the mirror goes back; deleting it alone keeps the original.
  await copy.getByLabel("Check item Remaining").uncheck();
  await copy.getByLabel("Card actions").click();
  await copy.getByRole("button", { name: "Move to trash" }).click();
  const ask = page.getByRole("alertdialog", { name: "Move to trash" });
  await expect(ask.getByLabel("Also delete its 1 mirror")).not.toBeChecked();
  await ask.getByRole("button", { name: "Delete" }).click();
  await expect(mirror).toBeHidden();

  await sidebar.getByRole("link", { name: "Trello import", exact: true }).click();
  await expect(original).toBeVisible();
  await expect(original.getByTitle("Mirrored on 1 more card")).toBeHidden();
  await original.click();
  await expect(card.getByLabel("Check item Remaining")).not.toBeChecked();
  await expect(card.getByRole("region", { name: "Mirrors" })).toBeHidden();

  // Two new mirrors; deleting with its mirrors takes all of them.
  for (let index = 0; index < 2; index++) {
    await card.getByLabel("Card actions").click();
    await card.getByRole("button", { name: "Move / copy" }).click();
    await picker.getByLabel("Board").selectOption({ label: "Second" });
    await picker.getByRole("button", { name: "Mirror" }).click();
  }
  await expect(mirrors.getByRole("button", { name: "Second · Todo" })).toHaveCount(2);
  await card.getByLabel("Card actions").click();
  await card.getByRole("button", { name: "Move to trash" }).click();
  await ask.getByLabel("Also delete its 2 mirrors").check();
  await ask.getByRole("button", { name: "Delete" }).click();
  await expect(original).toBeHidden();
  await sidebar.getByRole("link", { name: "Second", exact: true }).click();
  await expect(page.getByRole("link", { name: /Card from Trello/ })).toHaveCount(0);
});

test("stops mirroring: the cards no longer change together", async ({ page }) => {
  await importTrelloBoard(page);
  const original = page.getByRole("link", { name: /Card from Trello/ });
  await original.click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });
  await card.getByLabel("Card actions").click();
  await card.getByRole("button", { name: "Move / copy" }).click();
  await card.getByRole("region", { name: "Move or copy card" }).getByRole("button", { name: "Mirror" }).click();
  const mirrors = card.getByRole("region", { name: "Mirrors" });
  await expect(mirrors.getByRole("button", { name: /^Trello import · / })).toBeVisible();
  await mirrors.getByRole("button", { name: "Stop mirroring" }).click();
  await expect(mirrors).toBeHidden();
  await card.getByLabel("Check item Remaining").check();
  await card.getByRole("button", { name: "Close" }).first().click();
  await expect(card).toBeHidden();
  await expect(original).toHaveCount(2);
  await expect(original.getByTitle(/Mirrored/)).toHaveCount(0);
});
