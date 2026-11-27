import { expect, importTrelloBoard, test } from "./fixtures";

test("finds duplicate cards on the board, explains the match and merges a pair after a confirmation", async ({
  page,
}) => {
  await importTrelloBoard(page);
  for (const name of ["Invoice Acme", "invoice: ACME!", "Invoce Acme"]) {
    await page.getByRole("button", { name: "Add a card" }).first().click();
    await page.keyboard.type(name);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  }

  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Find duplicates" }).click();
  const panel = page.getByRole("dialog", { name: "Duplicate cards" });
  await expect(panel.getByRole("status")).toHaveText("3 pairs");
  await expect(panel.getByText("Typo", { exact: true })).toHaveCount(2);

  await panel.getByRole("tab", { name: "Strict" }).click();
  await expect(panel.getByRole("status")).toHaveText("1 pair");
  const pair = panel.getByRole("listitem");
  await expect(pair.getByText("Same title", { exact: true })).toBeVisible();
  await expect(pair.getByText("Keep", { exact: true })).toBeVisible();

  const kept = (await pair.getByRole("button").first().textContent()) ?? "";
  await pair.getByRole("button", { name: "Swap" }).click();
  await expect(pair.getByRole("button").first()).not.toHaveText(kept);
  await pair.getByRole("button", { name: "Swap" }).click();

  await pair.getByRole("button", { name: "Merge…" }).click();
  const confirm = page.getByRole("alertdialog", { name: /^Merge “/ });
  await expect(confirm.getByText(/goes to the trash, where it can be restored/)).toBeVisible();
  await confirm.getByRole("button", { name: "Merge", exact: true }).click();
  await expect(page.getByText("Cards merged; the duplicate was moved to trash.")).toBeVisible();
  await expect(panel.getByRole("status")).toHaveText("No duplicates found.");

  await panel.getByRole("tab", { name: "Normal" }).click();
  await expect(panel.getByRole("status")).toHaveText("1 pair");
  await panel.getByRole("button", { name: "Not a duplicate" }).click();
  await expect(panel.getByRole("status")).toHaveText("No duplicates found.");

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await page.getByRole("link", { name: new RegExp(`^${kept} 1$`) }).click();
  const card = page.getByRole("dialog", { name: kept });
  await expect(card.getByText(/^Merged with /)).toBeVisible();
});
