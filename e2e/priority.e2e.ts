import { expect, importTrelloBoard, test } from "./fixtures";

test("sets card priorities one by one and for a whole list, sorts, filters and shows them by priority", async ({
  page,
}) => {
  await importTrelloBoard(page);
  await page.getByRole("button", { name: "Add a card" }).first().click();
  await page.keyboard.type("Second card");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  const first = page.getByRole("link", { name: /Card from Trello/ });
  const second = page.getByRole("link", { name: /Second card/ });
  await expect(second).toBeVisible();

  await first.click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });
  await card.getByRole("button", { name: "Priority", exact: true }).click();
  await expect(card.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: "Low" }).click();
  await expect(card.getByRole("button", { name: "Priority: Low" })).toBeVisible();
  await card.getByRole("button", { name: "Close" }).first().click();
  await expect(first.getByTitle("Priority: Low")).toBeVisible();

  await page.getByLabel("List actions Plans").click();
  await page.getByRole("button", { name: "Set priority of all cards…" }).click();
  await page.getByRole("button", { name: "Critical" }).click();
  await expect(first.getByTitle("Priority: Critical")).toBeVisible();
  await expect(second.getByTitle("Priority: Critical")).toBeVisible();

  await second.click();
  const other = page.getByRole("dialog", { name: "Second card" });
  await other.getByRole("button", { name: "Priority: Critical" }).click();
  await other.getByRole("button", { name: "Medium" }).click();
  await other.getByRole("button", { name: "Close" }).first().click();
  await expect(other).toBeHidden();

  const names = () => page.locator("[data-card-id]").evaluateAll((tiles) => tiles.map((tile) => tile.textContent));
  await page.getByLabel("List actions Plans").click();
  await page.getByRole("button", { name: "Sort by…" }).click();
  await page.getByRole("button", { name: "Priority (lowest first)" }).click();
  await expect
    .poll(names)
    .toEqual([expect.stringContaining("Second card"), expect.stringContaining("Card from Trello")]);
  await page.getByLabel("List actions Plans").click();
  await page.getByRole("button", { name: "Sort by…" }).click();
  await page.getByRole("button", { name: "Priority (highest first)" }).click();
  await expect
    .poll(names)
    .toEqual([expect.stringContaining("Card from Trello"), expect.stringContaining("Second card")]);

  await page.getByRole("button", { name: "Board filter" }).click();
  await page.getByRole("region", { name: "Board filter" }).getByLabel("Priority").selectOption("Medium");
  await expect(first).toBeHidden();
  await expect(second).toBeVisible();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(first).toBeVisible();

  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Priorities" }).click();
  const overview = page.getByRole("dialog", { name: "Priorities" });
  await expect(overview.getByRole("region", { name: "Critical" }).getByRole("button")).toHaveText([/Card from Trello/]);
  await expect(overview.getByRole("region", { name: "Medium" }).getByRole("button")).toHaveText([/Second card/]);
  await expect(overview.getByRole("region", { name: "None" })).toContainText("No cards");
  await overview.getByRole("button", { name: /Second card/ }).click();
  await expect(page.getByRole("dialog", { name: "Second card" })).toBeVisible();
});
