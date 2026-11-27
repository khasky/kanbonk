import { expect, importTrelloBoard, test } from "./fixtures";

test("deletes unused labels, merges duplicate ones and counts their cards", async ({ page }) => {
  await importTrelloBoard(page);
  const tile = page.getByRole("link", { name: /Card from Trello/ });
  await tile.click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });
  await card.getByRole("button", { name: "Labels", exact: true }).click();
  const picker = card.locator(".label-picker");
  // A new label goes onto the card at once; Idle is then taken off it again.
  for (const name of ["Bug", "bug", "Idle"]) {
    await card.getByLabel("New label").fill(name);
    await picker.getByRole("button", { name: "Add" }).click();
  }
  await picker.getByRole("checkbox", { name: "Idle" }).uncheck();
  await card.getByRole("button", { name: "Labels", exact: true }).click();
  await card.getByRole("button", { name: "Close" }).first().click();
  await expect(tile).toContainText(/Bug.*bug/);

  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Clean up labels" }).click();
  const panel = page.getByRole("dialog", { name: "Clean up labels" });
  const unused = panel.getByRole("region", { name: "Unused labels" });
  await expect(unused.getByRole("checkbox")).toHaveCount(1);
  await expect(unused).toContainText("Idle");
  await unused.getByRole("button", { name: "Delete checked" }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 label moved to the trash." })).toBeVisible();
  await expect(unused).toContainText("Every label is in use.");

  const duplicates = panel.getByRole("region", { name: "Duplicates" });
  await duplicates.getByRole("radio", { name: "Keep Bug", exact: true }).check();
  await duplicates.getByRole("button", { name: "Merge" }).click();
  await expect(duplicates).toContainText("No duplicate names.");
  await expect(panel.getByRole("region", { name: "Usage" })).toContainText(/Bug\s*1 card/);
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(tile).toContainText("Bug");
  await expect(tile).not.toContainText("bug");
});
