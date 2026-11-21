import { expect, importTrelloBoard, test } from "./fixtures";

test("creates a workspace, board, lists and cards that survive a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.keyboard.type("Team space");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/w\//);

  await page.getByRole("button", { name: "Add board to Team space" }).click();
  await page.keyboard.type("Roadmap");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/b\//);
  await expect(page.getByLabel("Board title")).toHaveValue("Roadmap");

  for (const name of ["Ideas", "Doing"]) {
    await page.getByRole("button", { name: "Add a list" }).click();
    await page.keyboard.type(name);
    await page.keyboard.press("Enter");
    await expect(page.getByLabel(`List title ${name}`)).toBeVisible();
  }

  const ideas = page.locator(".list-column").filter({ has: page.getByLabel("List title Ideas") });
  await ideas.getByRole("button", { name: "Add a card" }).click();
  await page.keyboard.type("First idea");
  await page.keyboard.press("Enter");
  await expect(ideas.getByRole("button", { name: /First idea/ })).toBeVisible();

  await page.getByLabel("List actions Ideas").click();
  await page.getByRole("button", { name: "Move right" }).click();
  await expect(page.locator(".list-column [aria-label^='List title']").first()).toHaveValue("Doing");

  await page.reload();
  await expect(page.getByLabel("Board title")).toHaveValue("Roadmap");
  await expect(page.locator(".list-column [aria-label^='List title']").nth(1)).toHaveValue("Ideas");
  await expect(page.getByRole("button", { name: /First idea/ })).toBeVisible();
  await expect(page.getByRole("complementary").getByRole("button", { name: "Team space", exact: true })).toBeVisible();
});

test("opens a card by its address and closes it back to the board", async ({ page }) => {
  await importTrelloBoard(page);
  const boardUrl = page.url();
  await page.getByRole("button", { name: /Card from Trello/ }).click();
  await expect(page).toHaveURL(/\/c\//);
  const cardUrl = page.url();

  await page.reload();
  await expect(page.getByRole("dialog", { name: "Card from Trello" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Card from Trello" })).toBeHidden();
  await expect(page).toHaveURL(boardUrl);

  await page.goto(cardUrl.replace(/\/c\/.*/, "/c/missing-card"));
  await expect(page.getByRole("main")).toContainText(/not found/i);
});

test("collapses the sidebar to icons and keeps it collapsed after a reload", async ({ page }) => {
  await page.goto("/");
  const sidebar = page.locator("aside.sidebar");
  await expect(sidebar.getByText("Workspaces", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(sidebar).toHaveClass(/collapsed/);
  expect((await sidebar.boundingBox())?.width).toBeLessThan(60);
  await page.reload();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  expect((await sidebar.boundingBox())?.width).toBeGreaterThan(200);
});
