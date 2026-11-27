import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, importTrelloBoard, test } from "./fixtures";

async function downloaded(page: Page, button: string) {
  const download = page.waitForEvent("download");
  await page.getByRole("dialog", { name: "Print and export" }).getByRole("button", { name: button }).click();
  return readFile(await (await download).path(), "utf8");
}

test("starts weeks on Sunday, adds a card from the day panel, sums up due dates, prints and exports", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-26T10:00:00Z"));
  await importTrelloBoard(page);
  await page.getByLabel("App menu").click();
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings.getByLabel("First day of the week")).toHaveValue("auto");
  await settings.getByLabel("First day of the week").selectOption({ label: "Monday" });
  await settings.getByRole("button", { name: "Close" }).click();

  await page.getByRole("tab", { name: "Calendar" }).click();
  const calendar = page.getByRole("region", { name: "Board calendar" });
  const days = calendar.getByRole("button", { name: /^Cards of / });
  // November 2026 begins on a Sunday: a Monday-first month starts with 26 October.
  await expect(days.first()).toHaveAccessibleName("Cards of 10/26/2026");
  await page.getByLabel("App menu").click();
  await page.getByRole("button", { name: "Settings" }).click();
  await settings.getByLabel("First day of the week").selectOption({ label: "Sunday" });
  await settings.getByRole("button", { name: "Close" }).click();
  await expect(days.first()).toHaveAccessibleName("Cards of 11/1/2026");

  await calendar.getByRole("button", { name: "Cards of 11/26/2026" }).click();
  const day = page.getByRole("dialog", { name: "Thursday, November 26, 2026" });
  await expect(day.getByRole("region", { name: "Due" })).toContainText("No cards");
  await day.getByLabel("Card name").fill("Calendar task");
  await expect(day.getByLabel("List")).toHaveValue(/.+/);
  await day.getByRole("button", { name: "Add", exact: true }).click();
  await expect(day.getByRole("region", { name: "Due" })).toContainText("Calendar task");
  await day.getByRole("button", { name: "Close" }).click();
  await expect(calendar.getByRole("button", { name: "Calendar task", exact: true })).toBeVisible();

  await calendar.getByRole("button", { name: "Summary" }).click();
  const summary = page.getByRole("dialog", { name: "Summary" });
  await expect(summary.getByRole("region", { name: "With a due date" })).toContainText(
    /2.*Calendar task.*Card from Trello/,
  );
  await expect(summary.getByRole("region", { name: "Upcoming" })).toContainText("2");
  await expect(summary.getByRole("region", { name: "Overdue" })).toContainText("No cards");
  await summary
    .getByRole("region", { name: "Upcoming" })
    .getByRole("button", { name: /^Calendar task/ })
    .click();
  await expect(summary).toBeHidden();
  const card = page.getByRole("dialog", { name: "Calendar task" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Close" }).first().click();

  await calendar.getByRole("button", { name: "Print and export" }).click();
  const ics = await downloaded(page, "Download iCalendar (.ics)");
  expect(ics).toContain("SUMMARY:Calendar task\r\n");
  expect(ics).toContain("DTSTART;VALUE=DATE:20261126\r\nDTEND;VALUE=DATE:20261127\r\n");
  // The Trello card is due in December, outside the month shown.
  expect(ics).not.toContain("Card from Trello");
  const csv = await downloaded(page, "Download CSV");
  expect(csv).toContain("Name,List,Labels,Start,Due,Status\r\nCalendar task,Plans,,,2026-11-26 12:00,Upcoming");

  await page.evaluate(() => {
    window.print = () => {
      document.title = `printed: ${document.body.className}; ${document.head.lastElementChild?.textContent}`;
    };
  });
  const popover = page.getByRole("dialog", { name: "Print and export" });
  await popover.getByLabel("Paper").selectOption({ label: "US Letter" });
  await popover.getByLabel("Card titles").uncheck();
  await popover.getByRole("button", { name: "Print", exact: true }).click();
  await expect(page).toHaveTitle(/printed: .*printing-calendar print-no-titles; @page \{ size: letter landscape/);
});
