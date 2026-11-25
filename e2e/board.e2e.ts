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
  await expect(ideas.getByRole("link", { name: /First idea/ })).toBeVisible();

  await page.getByLabel("List actions Ideas").click();
  await page.getByRole("button", { name: "Move right" }).click();
  await expect(page.locator(".list-column [aria-label^='List title']").first()).toHaveValue("Doing");

  await page.reload();
  await expect(page.getByLabel("Board title")).toHaveValue("Roadmap");
  await expect(page.locator(".list-column [aria-label^='List title']").nth(1)).toHaveValue("Ideas");
  await expect(page.getByRole("link", { name: /First idea/ })).toBeVisible();
  await expect(page.getByRole("complementary").getByRole("link", { name: "Team space", exact: true })).toBeVisible();
});

test("opens a card by its address and closes it back to the board", async ({ page }) => {
  await importTrelloBoard(page);
  const boardUrl = page.url();
  const tile = page.getByRole("link", { name: /Card from Trello/ });
  // Card tiles and the sidebar's boards are links: a middle click opens them in a new tab.
  await expect(page.getByRole("complementary").getByRole("link", { name: "Trello import" })).toHaveAttribute(
    "href",
    new URL(boardUrl).pathname,
  );
  const [tab] = await Promise.all([page.context().waitForEvent("page"), tile.click({ button: "middle" })]);
  await expect(tab).toHaveURL(/\/c\//);
  await tab.close();
  await expect(page).toHaveURL(boardUrl);
  await tile.click();
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

test("drags cards from the Inbox panel into a list and onto a card of the board", async ({ page }) => {
  await importTrelloBoard(page);
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  const inbox = page.getByRole("region", { name: "Inbox" });
  for (const name of ["Inbox first", "Inbox second"]) {
    await inbox.getByLabel("New card in inbox").fill(name);
    await inbox.getByRole("button", { name: "Add" }).click();
  }
  const plans = page.locator(".list-column").filter({ has: page.getByLabel("List title Plans") });

  await inbox.getByRole("link", { name: "Inbox first" }).dragTo(plans.getByRole("button", { name: "Add a card" }));
  await expect(inbox.getByRole("link", { name: "Inbox first" })).toHaveCount(0);
  await inbox
    .getByRole("link", { name: "Inbox second" })
    .dragTo(plans.getByRole("link", { name: /Card from Trello/ }), { targetPosition: { x: 20, y: 4 } });
  await expect(inbox.getByRole("link", { name: /Inbox/ })).toHaveCount(0);

  const tiles = plans.locator("a[draggable=true]");
  await expect(tiles).toHaveText([/Inbox second/, /Card from Trello/, /Inbox first/]);
  await page.reload();
  await expect(plans.locator("a[draggable=true]")).toHaveText([/Inbox second/, /Card from Trello/, /Inbox first/]);
});
