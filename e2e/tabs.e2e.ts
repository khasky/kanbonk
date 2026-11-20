import { expect, importTrelloBoard, test } from "./fixtures";

test("a rename in one tab shows up in another", async ({ page, context }) => {
  await importTrelloBoard(page);
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.getByLabel("Board title")).toHaveValue("Trello import");

  await page.getByLabel("Board title").fill("Renamed board");
  await page.getByLabel("Board title").press("Enter");
  await expect(other.getByLabel("Board title")).toHaveValue("Renamed board");
});
