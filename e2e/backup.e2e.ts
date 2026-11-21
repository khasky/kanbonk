import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/** Turns on daily backups to the default location (downloads in the web page) and lets the first check run. */
async function dueBackup(page: Page) {
  await page.clock.install();
  await page.goto("/");
  await page.getByLabel("App menu").click();
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await settings.getByLabel("Frequency").selectOption({ label: "Every day" });
  await settings.getByRole("button", { name: "Close" }).click();
  await page.clock.fastForward("00:31");
  return page.getByRole("alertdialog", { name: "Automatic backup" });
}

test("asks before downloading a due automatic backup and saves it on request", async ({ page }) => {
  const ask = await dueBackup(page);
  await expect(ask).toBeVisible();
  const download = page.waitForEvent("download");
  await ask.getByRole("button", { name: "Save backup" }).click();
  expect((await download).suggestedFilename()).toMatch(/^kanbonk-auto-web-[A-Za-z0-9]+-.+-1of1\.zip$/);
  await expect(ask).toBeHidden();
  await expect(page.getByRole("status")).toContainText("Backup saved");
});

test("skipping a due automatic backup postpones it by one period", async ({ page }) => {
  const ask = await dueBackup(page);
  await ask.getByRole("button", { name: "Skip" }).click();
  await expect(ask).toBeHidden();
  await page.reload();
  await page.clock.fastForward("00:31");
  await page.clock.fastForward("10:00");
  await expect(page.getByRole("alertdialog", { name: "Automatic backup" })).toBeHidden();
  await page.clock.fastForward("24:00:00");
  await expect(page.getByRole("alertdialog", { name: "Automatic backup" })).toBeVisible();
});
