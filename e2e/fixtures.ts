import { test as base, expect, type Page } from "@playwright/test";

/** Every test fails on an uncaught page error and on a browser dialog: the app asks with its own dialogs. */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => {
      errors.push(`Browser dialog: ${dialog.message()}`);
      void dialog.dismiss();
    });
    await use(page);
    expect(errors).toEqual([]);
  },
});

export { expect };

/** Imports the synthetic Trello board from tests/ through the import dialog. */
export async function importTrelloBoard(page: Page) {
  await page.goto("/");
  await page.getByLabel("App menu").click();
  await page.getByRole("button", { name: "Import from Trello" }).click();
  const dialog = page.getByRole("dialog", { name: "Import from Trello" });
  await dialog.locator("input[type=file]").setInputFiles("tests/trello-board.json");
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  // A finished import closes the dialog, opens the board and reports in a notice.
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: /^Took: \d+:\d\d\. Imported: / })).toBeVisible();
}
