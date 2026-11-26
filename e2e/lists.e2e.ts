import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function boardWithLists(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.keyboard.type("Team space");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Add board to Team space" }).click();
  await page.keyboard.type("Roadmap");
  await page.keyboard.press("Enter");
  for (const name of ["Ideas", "Doing"]) {
    await page.getByRole("button", { name: "Add a list" }).click();
    await page.keyboard.type(name);
    await page.keyboard.press("Enter");
    await expect(page.getByLabel(`List title ${name}`)).toBeVisible();
  }
  const ideas = page.locator(".list-column").filter({ has: page.getByLabel("List title Ideas") });
  for (const name of ["Banana", "Apple"]) {
    await ideas.getByRole("button", { name: "Add a card" }).click();
    await page.keyboard.type(name);
    await page.keyboard.press("Enter");
    await expect(ideas.getByRole("link", { name })).toBeVisible();
  }
  await page.keyboard.press("Escape");
  return ideas;
}

test("counts, sorts, colors, collapses and empties a list from its header", async ({ page }) => {
  const ideas = await boardWithLists(page);
  await expect(ideas.getByTitle("Total cards")).toHaveText("2");

  await page.getByLabel("List actions Ideas").click();
  await page.getByRole("button", { name: "Sort by…" }).click();
  await page
    .getByRole("dialog", { name: "Sort list" })
    .getByRole("button", { name: "Card name (alphabetically)" })
    .click();
  await expect(ideas.locator("a[draggable=true]")).toHaveText(["Apple", "Banana"]);

  await page.getByLabel("List actions Ideas").click();
  await page.getByRole("button", { name: "Green", exact: true }).click();
  await expect(page.getByRole("button", { name: "Green", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");

  await page.getByLabel("Collapse list Ideas").click();
  await expect(ideas.getByRole("link")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Expand list Ideas")).toBeVisible();
  await page.getByLabel("Expand list Ideas").click();
  await expect(ideas.getByRole("link")).toHaveCount(2);

  await page.getByLabel("List actions Ideas").click();
  await page.getByRole("button", { name: "Move all cards in this list", exact: true }).click();
  await page.getByRole("dialog", { name: "Move all cards in list" }).getByRole("button", { name: "Doing" }).click();
  const doing = page.locator(".list-column").filter({ has: page.getByLabel("List title Doing") });
  await expect(doing.locator("a[draggable=true]")).toHaveText(["Apple", "Banana"]);
  await expect(ideas.getByTitle("Total cards")).toHaveText("0");

  await page.getByLabel("List actions Doing").click();
  await page.getByRole("button", { name: "Move all cards in this list to trash" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Move to trash" }).click();
  await expect(doing.getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Trash: 2" })).toBeVisible();
});

test("creates a template in a list and a card from it", async ({ page }) => {
  const ideas = await boardWithLists(page);
  await ideas.getByRole("button", { name: "Create from template" }).click();
  await page
    .getByRole("dialog", { name: "Card templates" })
    .getByRole("button", { name: "Create a new template" })
    .click();
  await page.getByRole("dialog", { name: "Create a new template" }).getByLabel("Template title").fill("Weekly report");
  await page.getByRole("dialog", { name: "Create a new template" }).getByRole("button", { name: "Add" }).click();
  await page.getByRole("dialog", { name: "Weekly report" }).getByRole("button", { name: "Close" }).first().click();

  await ideas.getByRole("button", { name: "Create from template" }).click();
  await page.getByRole("dialog", { name: "Card templates" }).getByRole("button", { name: "Weekly report" }).click();
  const create = page.getByRole("dialog", { name: "Create card from template" });
  await create.getByLabel("Card title").fill("Report for May");
  await create.getByRole("button", { name: "Create card", exact: true }).click();
  await expect(ideas.getByRole("link", { name: "Report for May" })).toBeVisible();
});
