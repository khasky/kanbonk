import { readFile } from "node:fs/promises";
import { expect, importTrelloBoard, test } from "./fixtures";

test("shows the board as a table to sort, edit in place, change ticked cards together and export", async ({ page }) => {
  await importTrelloBoard(page);
  await page.getByRole("button", { name: "Add a card" }).first().click();
  await page.keyboard.type("Second card");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: /Second card/ })).toBeVisible();

  await page.getByRole("tab", { name: "Table" }).click();
  await expect(page).toHaveURL(/view=table/);
  const view = page.getByRole("region", { name: "Board table" });
  const rows = view.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(view.getByText(/^2 cards\. Tick cards/)).toBeVisible();

  const cardHeader = view.getByRole("columnheader", { name: "Card", exact: true });
  await cardHeader.getByRole("button").click();
  await expect(cardHeader).toHaveAttribute("aria-sort", "ascending");
  await cardHeader.getByRole("button").click();
  await expect(cardHeader).toHaveAttribute("aria-sort", "descending");
  await expect(rows.first()).toContainText("Second card");

  await view.getByLabel("Priority of Second card").selectOption({ label: "High" });
  await expect(view.getByLabel("Priority of Second card")).toHaveValue("high");

  await view.getByRole("button", { name: "Columns" }).click();
  const columns = page.getByRole("dialog", { name: "Columns" });
  await columns.getByRole("checkbox", { name: "Done" }).check();
  await columns.getByRole("checkbox", { name: "Comments" }).check();
  await page.keyboard.press("Escape");
  await expect(view.getByRole("columnheader", { name: "Done" })).toBeVisible();

  await view.getByRole("checkbox", { name: "Tick all cards" }).check();
  const bar = view.getByRole("toolbar", { name: "2 cards ticked" });
  await expect(bar).toBeVisible();

  await bar.getByRole("button", { name: "Labels…" }).click();
  const labels = page.getByRole("dialog", { name: "Labels" });
  const important = labels.getByRole("checkbox", { name: "Important" });
  await expect(important).toHaveAttribute("aria-checked", "mixed");
  await expect(labels.getByText("on 1 of 2")).toBeVisible();
  await important.click();
  await labels.getByRole("button", { name: "Apply to 2 cards" }).click();
  await expect(rows.filter({ hasText: "Important" })).toHaveCount(2);

  await bar.getByRole("button", { name: "Due date…" }).click();
  const due = page.getByRole("dialog", { name: "Due date" });
  await due.getByLabel("Due date", { exact: true }).fill("2026-12-01T09:00");
  await due.getByRole("button", { name: "Apply to 2 cards" }).click();
  await expect(view.getByLabel("Due date of Second card")).toHaveValue("2026-12-01T09:00");
  await expect(view.getByLabel("Due date of Card from Trello")).toHaveValue("2026-12-01T09:00");

  await bar.getByRole("button", { name: "Mark done" }).click();
  await expect(view.getByRole("checkbox", { name: "Second card is done" })).toBeChecked();
  await bar.getByRole("button", { name: "Untick all" }).click();
  await expect(bar).toBeHidden();

  const download = page.waitForEvent("download");
  await view.getByRole("button", { name: "Export CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.csv$/);
  const csv = await readFile(await file.path(), "utf8");
  expect(csv).toContain("Card,List,Labels,Members,Due,Priority,Done,Checklist,Comments");
  expect(csv).toContain("Second card,Plans,Important,,2026-12-01 09:00,High,");

  await view.getByRole("button", { name: "Add card" }).click();
  const add = page.getByRole("dialog", { name: "Add card" });
  await add.getByLabel("Card name").fill("Third card");
  await add.getByRole("button", { name: "Add", exact: true }).click();
  await expect(rows).toHaveCount(3);

  await view.getByRole("checkbox", { name: "Tick Third card" }).check();
  await view.getByRole("toolbar", { name: "1 card ticked" }).getByRole("button", { name: "Delete…" }).click();
  await page
    .getByRole("alertdialog", { name: "Move 1 card to the trash?" })
    .getByRole("button", { name: "Move to trash" })
    .click();
  await expect(rows).toHaveCount(2);

  await page.reload();
  await expect(view.getByRole("columnheader", { name: "Comments" })).toBeVisible();
  await view.getByRole("button", { name: "Open Second card" }).click();
  await expect(page.getByRole("dialog", { name: "Second card" })).toBeVisible();
});
