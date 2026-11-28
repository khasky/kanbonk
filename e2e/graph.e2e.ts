import type { Page } from "@playwright/test";
import { expect, importTrelloBoard, test } from "./fixtures";

/** Drags from the link dot of one card node to another card node. */
async function drawLink(page: Page, from: string, to: string) {
  const handle = page.locator(`[data-node]:has(button[aria-label^="${from},"]) > span[aria-hidden]`);
  const target = page.getByRole("button", { name: new RegExp(`^${to},`) });
  const start = await handle.boundingBox();
  const end = await target.boundingBox();
  if (!start || !end) throw new Error("card node not shown");
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
  await page.mouse.up();
}

test("shows dependencies and sub-cards as a graph and edits them by dragging and from the card's links", async ({
  page,
}) => {
  await importTrelloBoard(page);
  for (const name of ["Design", "Build", "Ship"]) {
    await page.getByRole("button", { name: "Add a card" }).first().click();
    await page.keyboard.type(name);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  }

  await page.getByRole("tab", { name: "Graph" }).click();
  await expect(page).toHaveURL(/view=graph/);
  const view = page.getByRole("region", { name: "Dependency graph" });
  await expect(view.getByText(/^No linked cards yet/)).toBeVisible();
  await view.getByRole("checkbox", { name: "Only linked cards" }).uncheck();

  await drawLink(page, "Design", "Build");
  await expect(view.getByRole("button", { name: "“Design” blocks “Build”", exact: true })).toBeVisible();
  await expect(view.getByRole("button", { name: "Build, Blocked" })).toBeVisible();
  await expect(view.getByRole("button", { name: "Design, Open" })).toContainText("1 waits");

  await view.getByRole("button", { name: "Build, Blocked" }).click();
  const links = view.getByRole("complementary", { name: "Links of the selected card" });
  await expect(links.getByRole("button", { name: "Design", exact: true })).toBeVisible();
  await links.getByRole("button", { name: "Add: Blocks" }).click();
  await links.getByRole("searchbox", { name: "Blocks" }).fill("Ship");
  await links.getByRole("option", { name: "Ship" }).click();
  await expect(view.getByRole("button", { name: "“Build” blocks “Ship”", exact: true })).toBeVisible();
  await expect(view.getByRole("button", { name: "Design, Open" })).toContainText("2 wait");

  await view.getByRole("tab", { name: "Sub-card" }).click();
  await drawLink(page, "Design", "Ship");
  await expect(view.getByRole("button", { name: "“Ship” is a sub-card of “Design”", exact: true })).toBeVisible();

  // A link that would make cards wait on each other is refused.
  await view.getByRole("tab", { name: "Blocks" }).click();
  await drawLink(page, "Ship", "Design");
  await expect(page.getByText(/would make the cards wait on each other/)).toBeVisible();
  await expect(view.getByRole("button", { name: "“Ship” blocks “Design”", exact: true })).toHaveCount(0);

  await view.getByRole("button", { name: "“Design” blocks “Build”", exact: true }).focus();
  await page.keyboard.press("Delete");
  await expect(view.getByRole("button", { name: "“Design” blocks “Build”", exact: true })).toHaveCount(0);
  await expect(view.getByRole("button", { name: "Build, Open" })).toBeVisible();

  await view.getByRole("button", { name: "Ship, Blocked" }).dblclick();
  const card = page.getByRole("dialog", { name: "Ship" });
  await expect(card.getByText("Parent:")).toBeVisible();
  await expect(card.getByRole("button", { name: "Design", exact: true })).toBeVisible();
  await expect(
    card.locator("p", { hasText: "Depends on:" }).getByRole("button", { name: "Build", exact: true }),
  ).toBeVisible();
});
