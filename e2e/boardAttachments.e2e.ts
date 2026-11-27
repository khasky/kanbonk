import { expect, importTrelloBoard, test } from "./fixtures";

test("lists the board's attachments in their own view to search, filter, sort, preview and download", async ({
  page,
}) => {
  await importTrelloBoard(page);
  await page.getByRole("link", { name: /Card from Trello/ }).click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });
  await card.locator(".card-actions").getByRole("button", { name: "Add", exact: true }).click();
  await card.locator("label.file-button input[type=file]").setInputFiles([
    { name: "notes.md", mimeType: "", buffer: Buffer.from("# Release plan") },
    { name: "bundle.zip", mimeType: "application/zip", buffer: Buffer.from("PK".repeat(1000)) },
  ]);
  await expect(card.getByRole("button", { name: "Preview notes.md" })).toBeVisible();
  await card.getByRole("button", { name: "Close" }).first().click();

  await page.getByRole("tab", { name: "Attachments" }).click();
  await expect(page).toHaveURL(/view=attachments/);
  const view = page.getByRole("region", { name: "Board attachments" });
  const rows = view.locator("tbody tr");
  // note.txt came from the import without its file.
  await expect(rows).toHaveCount(3);
  await expect(view.getByText(/^3 attachments · /)).toBeVisible();
  await expect(rows.filter({ hasText: "note.txt" })).toContainText("Not on this device");

  await view.getByLabel("Type").selectOption({ label: "Archives (1)" });
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("bundle.zip");
  await view.getByLabel("Type").selectOption({ label: "All types" });

  await view.getByLabel("Sort").selectOption({ label: "Largest first" });
  await expect(rows.first()).toContainText("bundle.zip");
  await view.getByLabel("Search attachments").fill("release plan");
  await expect(view.getByText("No attachments match.")).toBeVisible();
  await view.getByLabel("Search attachments").fill("notes plans");
  await expect(rows).toHaveCount(1);

  await view.getByRole("button", { name: "Open notes.md" }).click();
  const preview = page.getByRole("dialog", { name: "Preview notes.md" });
  await expect(preview.getByRole("heading", { name: "Release plan" })).toBeVisible();
  await preview.getByRole("button", { name: "Close preview" }).click();

  const download = page.waitForEvent("download");
  await view.getByRole("button", { name: "Download notes.md" }).click();
  expect((await download).suggestedFilename()).toBe("notes.md");

  await view.getByRole("button", { name: "Open card Card from Trello" }).click();
  await expect(page.getByRole("dialog", { name: "Card from Trello" })).toBeVisible();
});
