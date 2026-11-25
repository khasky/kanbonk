import type { Locator, Page } from "@playwright/test";
import { expect, importTrelloBoard, test } from "./fixtures";

// Wide enough for three lists, a zone and the new-list column without scrolling the board.
test.use({ viewport: { width: 1800, height: 900 } });

/** Presses on `from`, moves over `to` and checks the preview before releasing, as a person drags. */
async function dragWithPreview(page: Page, from: Locator, to: Locator, preview: () => Promise<void>) {
  const start = (await from.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  const end = (await to.boundingBox())!;
  await page.mouse.move(end.x + 10, end.y + 6, { steps: 8 });
  await page.mouse.move(end.x + 12, end.y + 6, { steps: 2 });
  await preview();
  await page.mouse.up();
}

async function boardWithLists(page: Page) {
  await importTrelloBoard(page);
  for (const name of ["Doing", "Done"]) {
    await page.getByRole("button", { name: "Add a list" }).click();
    await page.keyboard.type(name);
    await page.keyboard.press("Enter");
    await expect(page.getByLabel(`List title ${name}`)).toBeVisible();
  }
  await page.keyboard.press("Escape");
}

/** The titles of the lists in board order, the dragged one left out while it is hidden. */
const titles = (page: Page) =>
  page
    .locator(".list-column:visible [aria-label^='List title']")
    .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
const column = (page: Page, name: string) =>
  page.locator(".list-column").filter({ has: page.getByLabel(`List title ${name}`) });

test("shows where a dragged card lands and moves it there", async ({ page }) => {
  await boardWithLists(page);
  const card = page.getByRole("link", { name: /Card from Trello/ });
  await dragWithPreview(page, card, column(page, "Doing").getByRole("button", { name: "Add a card" }), async () => {
    await expect(column(page, "Doing").locator("[data-drop-slot=card]")).toBeVisible();
    await expect(card).toBeHidden();
  });
  await expect(column(page, "Doing").getByRole("link", { name: /Card from Trello/ })).toBeVisible();
  await expect(page.locator("[data-drop-slot]")).toHaveCount(0);
});

test("shows where a dragged list lands and moves it there", async ({ page }) => {
  await boardWithLists(page);
  await expect.poll(() => titles(page)).toEqual(["Plans", "Doing", "Done"]);
  await dragWithPreview(page, column(page, "Done").locator(".list-drag-handle"), column(page, "Plans"), async () => {
    await expect(page.locator("[data-drop-slot=list]")).toBeVisible();
    await expect.poll(() => titles(page)).toEqual(["Plans", "Doing"]);
  });
  await expect.poll(() => titles(page)).toEqual(["Done", "Plans", "Doing"]);
});

test("moves a zone between lists and a list into a zone", async ({ page }) => {
  await boardWithLists(page);
  await page.getByRole("button", { name: "New zone" }).click();
  await page.getByLabel("Zone name").fill("Development");
  await page.getByRole("button", { name: "Add zone" }).click();
  const zone = page.getByRole("region", { name: "Zone Development" });
  await column(page, "Done").locator(".list-drag-handle").dragTo(zone.getByText("Drag lists here"));
  await expect(zone.getByLabel("List title Done")).toBeVisible();

  // The zone goes in front of Plans, as one block.
  await dragWithPreview(page, zone.locator(".list-drag-handle").first(), column(page, "Plans"), async () => {
    await expect(page.locator("[data-drop-slot=zone]")).toBeVisible();
  });
  await expect.poll(() => titles(page)).toEqual(["Done", "Plans", "Doing"]);

  // Doing joins the zone, next to Done.
  await dragWithPreview(page, column(page, "Doing").locator(".list-drag-handle"), column(page, "Done"), async () => {
    await expect(zone.locator("[data-drop-slot=list]")).toBeVisible();
  });
  await expect(zone.getByLabel("List title Doing")).toBeVisible();
  await expect.poll(() => titles(page)).toEqual(["Doing", "Done", "Plans"]);
});
