import { expect, importTrelloBoard, test } from "./fixtures";

test("asks for approval on a card, decides, shows the status on the tile, filters and moves approved cards", async ({
  page,
}) => {
  await importTrelloBoard(page);
  await page.getByLabel("App menu").click();
  await page.getByRole("button", { name: "My name" }).click();
  const author = page.getByRole("dialog", { name: "My name" });
  await author.getByLabel("Name").fill("Ann");
  await author.getByRole("button", { name: "Save" }).click();

  await page.getByRole("button", { name: "Add a list" }).click();
  await page.keyboard.type("Approved");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("List title Approved")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Automation" }).click();
  const automation = page.getByRole("dialog", { name: "Board automation" });
  await automation.getByLabel("Type").selectOption({ label: "When a card is approved by all its approvers" });
  await automation.getByLabel("Action").selectOption({ label: "Move to list" });
  await automation.getByLabel("Target list").selectOption({ label: "Approved" });
  await automation.getByRole("button", { name: "Add rule" }).click();
  await expect(automation.getByText("When approved — move to “Approved”")).toBeVisible();
  await automation.getByRole("button", { name: "Close automation" }).click();

  const tile = page.getByRole("link", { name: /Card from Trello/ });
  await tile.click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });
  await card.locator(".card-actions").getByRole("button", { name: "Add", exact: true }).click();
  await card.getByRole("button", { name: /^Approval/ }).click();
  const picker = page.getByRole("dialog", { name: "Approvers" });
  await picker.getByRole("checkbox", { name: "Ann" }).check();
  await page.keyboard.press("Escape");

  const section = card.getByRole("region", { name: "Approval" });
  await expect(section.getByText("🔔 Pending your approval")).toBeVisible();
  await expect(section.getByText("(you)")).toBeVisible();

  await section.getByRole("button", { name: "Decline as Ann" }).click();
  const why = page.getByRole("dialog", { name: "Decline “Card from Trello”" });
  await why.getByLabel("Why? (optional)").fill("Needs a budget");
  await why.getByRole("button", { name: "Decline" }).click();
  await expect(section.getByRole("note")).toHaveText("Declined by Ann. Needs a budget");
  await expect(section.getByText("Declined", { exact: true })).toBeVisible();

  await section.getByRole("button", { name: "Undo the decision of Ann" }).click();
  await section.getByRole("button", { name: "Approve as Ann" }).click();
  await expect(section.getByText("Approved", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Close" }).first().click();

  // The rule moved the approved card to its list.
  const approvedList = page.locator("[data-list-id]").filter({ has: page.getByLabel("List title Approved") });
  await expect(approvedList.getByRole("link", { name: /Card from Trello/ })).toBeVisible();
  await expect(tile.locator("[data-approval=approved]")).toHaveText("Approved");

  await page.getByRole("button", { name: "Board filter" }).click();
  const filter = page.getByRole("region", { name: "Board filter" });
  await filter.getByLabel("Approval").selectOption({ label: "Pending" });
  await expect(tile).toBeHidden();
  await filter.getByLabel("Approval").selectOption({ label: "Approved" });
  await expect(tile).toBeVisible();

  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Approvals" }).click();
  const panel = page.getByRole("dialog", { name: "Approvals" });
  await expect(panel.getByText("You are Ann on this board")).toBeVisible();
  await expect(panel.getByRole("region", { name: "Approved" })).toContainText("Card from Trello");
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: "Table" }).click();
  await page.getByRole("button", { name: "Columns" }).click();
  await page.getByRole("dialog", { name: "Columns" }).getByRole("checkbox", { name: "Approval" }).check();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("columnheader", { name: /Approval/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Card from Trello/ }).locator("[data-approval=approved]")).toBeVisible();
});
