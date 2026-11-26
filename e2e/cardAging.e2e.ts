import { expect, importTrelloBoard, test } from "./fixtures";

test("board settings turn card aging on: a card unchanged for weeks ages and a change makes it new", async ({
  page,
}) => {
  await page.clock.install();
  await importTrelloBoard(page);
  const tile = page.getByRole("link", { name: /Card from Trello/ });

  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Board settings" }).click();
  const settings = page.getByRole("dialog", { name: "Board settings" });
  await settings.getByLabel("Age cards that have not changed for a while").check();
  await expect(settings.getByLabel("Fade")).toBeChecked();
  await settings.getByRole("button", { name: "Close" }).click();
  await expect(tile).not.toHaveAttribute("data-age");

  await page.clock.fastForward(15 * 24 * 3_600_000);
  await expect(tile).toHaveAttribute("data-age", "2");
  await expect(tile).toHaveAttribute("data-aging", "regular");
  await expect(tile).toHaveAttribute("title", "Not changed for 2 weeks");

  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Board settings" }).click();
  await settings.getByLabel("Pirate: yellow and torn").check();
  await settings.getByRole("button", { name: "Close" }).click();
  await expect(tile).toHaveAttribute("data-aging", "pirate");

  // Opened, the card says when it last changed; a change makes it new again.
  await tile.click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });
  await expect(card.getByText(/· changed /)).toBeVisible();
  await card.getByLabel("Check item Remaining").check();
  await card.getByRole("button", { name: "Close" }).first().click();
  await expect(card).toBeHidden();
  await expect(tile).not.toHaveAttribute("data-age");

  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Board settings" }).click();
  await settings.getByLabel("Age cards that have not changed for a while").uncheck();
  await expect(settings.getByLabel("Fade")).toHaveCount(0);
});
