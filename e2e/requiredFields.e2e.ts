import { expect, importTrelloBoard, test } from "./fixtures";

test("required fields show what a card lacks and keep it in its list until it is complete", async ({ page }) => {
  await importTrelloBoard(page);
  await page.getByRole("button", { name: "Add a list" }).click();
  await page.keyboard.type("Done");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("List title Done")).toBeVisible();

  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Required fields" }).click();
  const panel = page.getByRole("dialog", { name: "Required fields" });
  await panel.getByLabel("All checklist items done").check();
  await panel.getByLabel("Description must").selectOption({ label: "Contain" });
  await panel.getByLabel("Text the description is checked against").fill("acceptance");
  await expect(panel.getByRole("status")).toHaveText("1 card lacks required fields.");
  await panel.getByLabel("Keep a card in its list until nothing is missing").check();
  await panel.getByRole("button", { name: "Save" }).click();
  await expect(panel).toBeHidden();

  const tile = page.getByRole("link", { name: /Card from Trello/ });
  const badges = tile.getByLabel("Missing required fields");
  await expect(badges).toContainText("Checklist incomplete: 1/2");
  await expect(badges).toContainText("Description must contain “acceptance”");

  const plans = page.locator(".list-column").filter({ has: page.getByLabel("List title Plans") });
  const done = page.locator(".list-column").filter({ has: page.getByLabel("List title Done") });
  const moveAll = async () => {
    await page.getByLabel("List actions Plans").click();
    await page.getByRole("button", { name: "Move all cards in this list", exact: true }).click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
  };
  await moveAll();
  await expect(page.getByRole("status").filter({ hasText: "stays in its list" })).toContainText(
    "“Card from Trello” stays in its list",
  );
  await expect(plans.getByRole("link", { name: /Card from Trello/ })).toBeVisible();

  await tile.click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });
  const missing = card.getByRole("region", { name: "Missing required fields" });
  await expect(missing).toContainText("Checklist incomplete: 1/2");
  await card.getByLabel("Check item Remaining").check();
  await expect(missing).not.toContainText("Checklist incomplete");
  await card.getByRole("button", { name: "Close" }).first().click();
  await expect(card).toBeHidden();

  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Required fields" }).click();
  await panel.getByLabel("Description must").selectOption({ label: "Anything" });
  await panel.getByRole("button", { name: "Save" }).click();
  await expect(tile.getByLabel("Missing required fields")).toHaveCount(0);
  await moveAll();
  await expect(done.getByRole("link", { name: /Card from Trello/ })).toBeVisible();
});
