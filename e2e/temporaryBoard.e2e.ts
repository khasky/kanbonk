import { expect, importTrelloBoard, test } from "./fixtures";

const hour = 3_600_000;

test("a temporary board goes to the trash when its time is up and Extend brings it back for good", async ({ page }) => {
  await page.clock.install();
  await importTrelloBoard(page);
  await page.getByRole("button", { name: "Add board to Personal" }).click();
  const create = page.getByRole("dialog", { name: "Create board" });
  await create.getByLabel("Title").fill("Hackathon");
  await expect(create.getByLabel("days")).toHaveCount(0);
  await create.getByLabel("Temporary board").check();
  await create.getByLabel("days").fill("0");
  await create.getByLabel("hours").fill("3");
  await create.getByRole("button", { name: "Create" }).click();
  await expect(page.locator("aside.sidebar").getByRole("link", { name: "Hackathon" })).toBeVisible();

  // The board, its tile on the workspace page and the sidebar show it is temporary.
  await expect(page.locator("aside.sidebar").getByText("Temporary board, 3h left")).toBeAttached();
  const timeLeft = page.getByRole("button", { name: /^Temporary board\. Moves to the trash on .* \(3h left\)$/ });
  await expect(timeLeft).toHaveText("3h left");

  // The time can be changed in the board's settings, which the time left opens.
  await timeLeft.click();
  const settings = page.getByRole("dialog", { name: "Board settings" });
  await expect(settings.getByLabel("Temporary board")).toBeChecked();
  await expect(settings.getByLabel("hours")).toHaveValue("3");
  await settings.getByLabel("hours").fill("1");
  await expect(settings.getByText(/^Moves to the trash on /)).toBeVisible();
  await settings.getByRole("button", { name: "Close" }).click();
  await page.locator("aside.sidebar").getByRole("link", { name: "Personal" }).click();
  await expect(page.getByRole("link", { name: /^Hackathon/ }).getByText("1h left")).toBeVisible();

  await page.clock.fastForward(hour + 60_000);
  const notice = page
    .getByRole("alert")
    .filter({ hasText: "The board “Hackathon” expired and was moved to the trash." });
  await expect(notice).toBeVisible();
  await expect(page.locator("aside.sidebar").getByRole("link", { name: "Hackathon" })).toHaveCount(0);

  await notice.getByRole("button", { name: "Extend" }).click();
  const extend = page.getByRole("dialog", { name: "Extend “Hackathon”" });
  await extend.getByLabel("Temporary board").uncheck();
  await extend.getByRole("button", { name: "Restore board" }).click();
  await expect(notice).toBeHidden();
  await expect(page.locator("aside.sidebar").getByRole("link", { name: "Hackathon" })).toBeVisible();

  // Kept for good: it stays after any time.
  await page.clock.fastForward(48 * hour);
  await expect(page.locator("aside.sidebar").getByRole("link", { name: "Hackathon" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Temporary board/ })).toHaveCount(0);
  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Board settings" }).click();
  await expect(settings.getByLabel("Temporary board")).not.toBeChecked();
});
