import { expect, importTrelloBoard, test } from "./fixtures";

test("creates an empty zone and drags a list into it", async ({ page }) => {
  await importTrelloBoard(page);
  await page.getByRole("button", { name: "New zone" }).click();
  await page.getByLabel("Zone name").fill("Development");
  await page.getByRole("button", { name: "Add zone" }).click();
  const zone = page.getByRole("region", { name: "Zone Development" });
  await expect(zone.getByText("Drag lists here")).toBeVisible();

  await page
    .getByLabel("List title Plans")
    .locator("xpath=ancestor::section[contains(@class,'list-column')]")
    .locator(".list-drag-handle")
    .dragTo(zone.getByText("Drag lists here"));
  await expect(zone.getByLabel("List title Plans")).toBeVisible();
  await expect(zone.getByText("Drag lists here")).toBeHidden();
});

test("a long list in a zone keeps to the board's height and scrolls its cards", async ({ page }) => {
  await importTrelloBoard(page);
  const plans = page.locator(".list-column").filter({ has: page.getByLabel("List title Plans") });
  for (let index = 1; index <= 25; index++) {
    await plans.getByRole("button", { name: "Add a card" }).click();
    await page.keyboard.type(`Task ${index}`);
    await page.keyboard.press("Enter");
  }
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "New zone" }).click();
  await page.getByLabel("Zone name").fill("Development");
  await page.getByRole("button", { name: "Add zone" }).click();
  const zone = page.getByRole("region", { name: "Zone Development" });
  await plans.locator(".list-drag-handle").dragTo(zone.getByText("Drag lists here"));
  const inZone = zone.locator(".list-column");
  await expect(inZone.getByLabel("List title Plans")).toBeVisible();
  const viewport = page.viewportSize()!.height;
  expect((await inZone.boundingBox())!.y + (await inZone.boundingBox())!.height).toBeLessThanOrEqual(viewport);
  await expect(inZone.getByRole("button", { name: "Add a card" })).toBeInViewport();
});
