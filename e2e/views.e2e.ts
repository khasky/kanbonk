import { expect, importTrelloBoard, test } from "./fixtures";

test("counts card views on the tile and the card, sorts by them and sums them up in board analytics", async ({
  page,
}) => {
  await page.clock.install();
  await importTrelloBoard(page);
  const plans = page.locator(".list-column").filter({ has: page.getByLabel("List title Plans") });
  await plans.getByRole("button", { name: "Add a card" }).click();
  await page.keyboard.type("Second card");
  await page.keyboard.press("Enter");
  const tile = plans.getByRole("link", { name: /Second card/ });
  await expect(tile).toBeVisible();
  await expect(tile).not.toContainText("·");

  await tile.click();
  const dialog = page.getByRole("dialog", { name: "Second card" });
  await expect(dialog.getByRole("region", { name: "Views" })).toContainText("1 view · 1 person");
  await page.keyboard.press("Escape");
  await expect(tile.locator("[title^='1 view']")).toBeVisible();

  // Opening it again within minutes counts once; later it counts again.
  await tile.click();
  await page.keyboard.press("Escape");
  await expect(tile.locator("[title^='1 view']")).toBeVisible();
  await page.clock.fastForward("06:00");
  await tile.click();
  await expect(dialog.getByRole("region", { name: "Views" })).toContainText("2 views · 1 person");
  await page.keyboard.press("Escape");

  await page.getByLabel("List actions Plans").click();
  await page.getByRole("button", { name: "Sort by…" }).click();
  await page.getByRole("button", { name: "Most viewed" }).click();
  await expect(plans.locator("a[draggable=true]").first()).toContainText("Second card");

  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Board analytics" }).click();
  const analytics = page.getByRole("dialog", { name: "Board analytics" });
  await expect(analytics.getByText("Card views", { exact: true }).first()).toBeVisible();
  const row = analytics.getByRole("row").filter({ hasText: "Second card" });
  await expect(row.getByRole("cell").nth(1)).toHaveText("2");
  await expect(analytics.getByRole("row").filter({ hasText: "Card from Trello" }).getByRole("cell").nth(3)).toHaveText(
    "Never",
  );
  await analytics.getByRole("button", { name: "Close" }).click();

  // The badge can be hidden on this device.
  await page.getByLabel("App menu").click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Show how often cards were viewed on their tiles").uncheck();
  await page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Close" }).click();
  await expect(tile.locator("[title^='2 views']")).toHaveCount(0);
});
