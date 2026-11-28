import { expect, importTrelloBoard, test } from "./fixtures";

test("edits a card: label, checklist, sub-card, comment and description", async ({ page }) => {
  await importTrelloBoard(page);
  await page.getByRole("link", { name: /Card from Trello/ }).click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });

  await card.getByRole("button", { name: "Labels", exact: true }).click();
  await card.getByLabel("New label").fill("Urgent");
  await card.locator(".label-picker").getByRole("button", { name: "Add" }).click();
  await card.getByRole("button", { name: "Labels", exact: true }).click();
  await expect(page.getByRole("link", { name: /Important Urgent Card from Trello/ })).toBeVisible();

  await card.locator(".card-actions").getByRole("button", { name: "Dates" }).click();
  await card.getByLabel("Card due date", { exact: true }).fill("1/5/2030");
  await card.getByLabel("Card due time").fill("9:30 AM");
  await card.getByRole("button", { name: "Save" }).click();
  await card.getByRole("button", { name: "Dates: Jan 5, 9:30 AM" }).click();
  await expect(card.getByRole("button", { name: "Saturday, January 5, 2030" })).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: "Remove" }).click();
  await expect(card.getByRole("button", { name: /^Dates:/ })).toHaveCount(0);

  await card.getByLabel("Check item Remaining").check();
  await expect(card.getByText("100%")).toBeVisible();

  await card.getByLabel("New sub-card title").fill("Child one");
  await card.getByLabel("New sub-card title").press("Enter");
  await expect(card.getByRole("button", { name: "Child one", exact: true })).toBeVisible();
  await expect(
    page.locator("[data-card-id]", { hasText: "Card from Trello" }).getByTitle("Sub-cards done: 0 of 1"),
  ).toHaveText("0/1");

  await card.getByText("Write a comment").click();
  await page.keyboard.type("First comment");
  await card.locator(".activity-panel").getByRole("button", { name: "Send" }).click();
  await expect(card.locator(".activity-panel")).toContainText("First comment");

  await card
    .getByRole("heading", { name: /Description/ })
    .getByRole("button", { name: "Edit" })
    .click();
  const description = card.getByRole("textbox", { name: "Card description" });
  await description.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Updated description");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card).toContainText("Updated description");

  await page.reload();
  const reopened = page.getByRole("dialog", { name: "Card from Trello" });
  await expect(reopened).toContainText("Updated description");
  await expect(reopened).toContainText("First comment");
  await expect(reopened.getByLabel("Check item Remaining")).toBeChecked();
});

test("previews a Markdown attachment and offers no preview for an archive", async ({ page }) => {
  await importTrelloBoard(page);
  await page.getByRole("link", { name: /Card from Trello/ }).click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });
  await card.locator(".card-actions").getByRole("button", { name: "Add", exact: true }).click();
  await card.locator("label.file-button input[type=file]").setInputFiles([
    { name: "notes.md", mimeType: "", buffer: Buffer.from("# Release plan\n\n- ship it") },
    { name: "bundle.zip", mimeType: "application/zip", buffer: Buffer.from("PK") },
  ]);
  await expect(card.getByRole("button", { name: "Preview notes.md" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Preview bundle.zip" })).toHaveCount(0);

  await card.getByRole("button", { name: "Preview notes.md" }).click();
  const preview = page.getByRole("dialog", { name: "Preview notes.md" });
  await expect(preview.getByRole("heading", { name: "Release plan" })).toBeVisible();
  await expect(preview.getByRole("listitem")).toHaveText("ship it");
  await preview.getByRole("button", { name: "Close preview" }).click();
  await expect(preview).toBeHidden();
  await expect(card).toBeVisible();

  // With note.txt from the import there are five files: the oldest hides behind "View all attachments".
  await card.locator("[data-panel=attach]").click();
  await card.locator("label.file-button input[type=file]").setInputFiles([
    { name: "plan.txt", mimeType: "text/plain", buffer: Buffer.from("plan") },
    { name: "todo.txt", mimeType: "text/plain", buffer: Buffer.from("todo") },
  ]);
  await card.getByRole("button", { name: "View all attachments (1 hidden)" }).click();
  await card.getByLabel("Actions for note.txt").click();
  await card.locator("details[open]").getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("dialog", { name: "Edit attachment" }).getByLabel("Name").fill("old-note.txt");
  await page.getByRole("dialog", { name: "Edit attachment" }).getByRole("button", { name: "Save" }).click();
  await card.getByLabel("Actions for old-note.txt").click();
  await card.locator("details[open]").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(card.getByText("old-note.txt")).toHaveCount(0);
  await expect(card.getByRole("button", { name: /View all attachments/ })).toHaveCount(0);
});

test("folds a long description behind Show more", async ({ page }) => {
  await importTrelloBoard(page);
  await page.getByRole("link", { name: /Card from Trello/ }).click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });
  await card.locator(".card-markdown").getByRole("button", { name: "Edit" }).click();
  await card
    .getByRole("textbox", { name: "Card description" })
    .fill(Array.from({ length: 40 }, (_, index) => `Line ${index + 1}`).join("\n"));
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByText("Line 40")).not.toBeInViewport();
  await card.getByRole("button", { name: "Show more" }).click();
  await card.getByText("Line 40").scrollIntoViewIfNeeded();
  await expect(card.getByText("Line 40")).toBeInViewport();
  await card.getByRole("button", { name: "Show less" }).click();
  await expect(card.getByRole("button", { name: "Show more" })).toBeVisible();
});

test("replies to comments in threads, hides replies and keeps a deleted comment's replies", async ({ page }) => {
  await importTrelloBoard(page);
  await page.getByRole("link", { name: /Card from Trello/ }).click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });
  const activity = card.locator(".activity-panel");
  const comment = (text: string) => activity.locator("article", { hasText: text });

  await card.getByText("Write a comment").click();
  await page.keyboard.type("Question");
  await activity.getByRole("button", { name: "Send" }).click();
  await comment("Question").getByRole("button", { name: "Reply" }).click();
  await page.keyboard.type("Answer");
  await activity.getByRole("button", { name: "Send" }).click();
  await comment("Answer").getByRole("button", { name: "Reply" }).click();
  await page.keyboard.type("Thanks");
  await activity.getByRole("button", { name: "Send" }).click();
  await expect(comment("Thanks")).toBeVisible();

  await activity.getByRole("button", { name: "Hide replies" }).first().click();
  await expect(comment("Answer")).toHaveCount(0);
  await activity.getByRole("button", { name: "Show 2 replies" }).click();
  await expect(comment("Thanks")).toBeVisible();

  await comment("Answer").getByRole("button", { name: "Delete" }).click();
  await expect(activity.getByText("Comment deleted")).toBeVisible();
  await expect(comment("Thanks")).toBeVisible();

  await page.reload();
  const reopened = page.getByRole("dialog", { name: "Card from Trello" }).locator(".activity-panel");
  await expect(reopened.getByText("Comment deleted")).toBeVisible();
  await expect(reopened.locator("article", { hasText: "Thanks" })).toBeVisible();
});
