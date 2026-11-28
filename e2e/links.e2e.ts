import type { Locator } from "@playwright/test";
import { expect, importTrelloBoard, test } from "./fixtures";

async function link(links: Locator, type: string, name: string) {
  await links.getByRole("button", { name: "Link…" }).click();
  await links.getByLabel("Link type").selectOption({ label: type });
  await links.getByRole("searchbox", { name: "Card to link" }).fill(name);
  await links.getByRole("option", { name, exact: true }).click();
}

test("links cards as an epic with sub-cards, blockers, related cards and duplicates, on tiles, cards and the graph", async ({
  page,
}) => {
  await importTrelloBoard(page);
  for (const name of ["Platform", "Old login"]) {
    await page.getByRole("button", { name: "Add a card" }).first().click();
    await page.keyboard.type(name);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  }

  await page.getByRole("link", { name: "Platform", exact: true }).click();
  let card = page.getByRole("dialog", { name: "Platform" });
  let links = card.getByRole("region", { name: "Links" });
  await links.getByRole("checkbox", { name: /^Epic/ }).check();
  for (const name of ["Login", "Signup"]) {
    await links.getByLabel("New sub-card title").fill(name);
    await links.getByLabel("New sub-card title").press("Enter");
    await expect(links.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(links.getByText("0 of 2 done")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();

  const platform = page.locator("[data-card-id]", { hasText: "Platform" });
  await expect(platform.getByText("Epic", { exact: true })).toBeVisible();
  await expect(platform.getByTitle("Sub-cards done: 0 of 2")).toHaveText("0/2");

  await page.getByRole("link", { name: /^Login/ }).click();
  card = page.getByRole("dialog", { name: "Login" });
  links = card.getByRole("region", { name: "Links" });
  await link(links, "Is blocked by", "Signup");
  await link(links, "Relates to", "Card from Trello");
  await link(links, "Is duplicated by", "Old login");
  for (const group of ["Parent", "Is blocked by", "Relates to", "Is duplicated by"])
    await expect(links.getByText(group, { exact: true })).toBeVisible();
  await expect(links.getByRole("button", { name: "Platform", exact: true })).toBeVisible();
  await links.getByRole("button", { name: "Remove link to “Old login”" }).click();
  await expect(links.getByText("Is duplicated by", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");

  const login = page.locator("[data-card-id]", { hasText: /^Login/ });
  await expect(login.getByText("Blocked", { exact: true })).toBeVisible();
  await expect(login.getByTitle("3 links")).toHaveText("3");

  await page.getByRole("tab", { name: "Graph" }).click();
  const view = page.getByRole("region", { name: "Dependency graph" });
  await view.getByLabel("Epic").selectOption({ label: "Platform" });
  await expect(view.getByRole("button", { name: /^Platform, Open/ })).toContainText("Epic");
  await expect(view.getByRole("button", { name: "Login, Blocked" })).toBeVisible();
  await expect(view.getByRole("button", { name: "“Login” relates to “Card from Trello”", exact: true })).toBeVisible();
  await expect(view.getByRole("button", { name: /^Old login,/ })).toHaveCount(0);
  await view.getByLabel("Epic").selectOption({ label: "All cards" });

  await view.getByRole("tab", { name: "Duplicate" }).click();
  await view.getByRole("button", { name: "Login, Blocked" }).click();
  const aside = view.getByRole("complementary", { name: "Links of the selected card" });
  await link(aside, "Duplicates", "Platform");
  await expect(view.getByRole("button", { name: "“Login” duplicates “Platform”", exact: true })).toBeVisible();
});
