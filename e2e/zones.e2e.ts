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
