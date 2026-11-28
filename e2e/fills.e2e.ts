import { expect, importTrelloBoard, test } from "./fixtures";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);
const yellow = "rgb(245, 205, 71)";
const darkText = "rgb(23, 43, 77)";
const white = "rgb(255, 255, 255)";

test("fills a card, a board and a workspace with a color, a gradient or an image from the same picker", async ({
  page,
}) => {
  await importTrelloBoard(page);
  const tile = page.locator("[data-card-id]", { hasText: "Card from Trello" });
  await tile.click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });
  await card.locator("[data-panel=cover]").click();
  const cover = page.getByRole("dialog", { name: "Cover" });

  // The cover fills the whole tile, its text in a color that reads on it.
  await cover.getByRole("button", { name: "Color #f5cd47" }).click();
  await expect(tile).toHaveCSS("background-color", yellow);
  await expect(tile).toHaveCSS("color", darkText);
  await cover.getByRole("button", { name: "Gradient 2" }).click();
  await expect(tile).toHaveCSS("background-image", /linear-gradient/);
  await expect(tile).toHaveCSS("color", white);
  await cover.getByLabel("Custom color").fill("#123456");
  await expect(tile).toHaveCSS("background-color", "rgb(18, 52, 86)");
  await expect(cover.getByRole("button", { name: "Gradient 2" })).toHaveAttribute("aria-pressed", "false");

  // An uploaded image is attached to the card and becomes its cover.
  await cover.locator("label.file-button input[type=file]").setInputFiles({
    name: "cover.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(tile).toHaveCSS("background-image", /url\("blob:/);
  await expect(tile).toHaveCSS("color", white);
  // The tile shows a copy made for its size (544px wide), not the stored file.
  const shownWidth = await tile.evaluate(async (element) => {
    const url = /url\("([^"]+)"\)/.exec(getComputedStyle(element).backgroundImage)?.[1] ?? "";
    const image = new Image();
    image.src = url;
    await image.decode();
    return image.naturalWidth;
  });
  expect(shownWidth).toBe(544);
  await expect(card.getByText("cover.png").first()).toBeVisible();
  await cover.getByRole("button", { name: "Remove cover" }).click();
  await expect(tile).toHaveCSS("background-color", white);
  await expect(tile).toHaveCSS("color", darkText);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();

  const main = page.getByRole("main");
  await page.getByLabel("Board menu").click();
  await page.getByRole("button", { name: "Change background" }).click();
  const background = page.getByRole("dialog", { name: "Board background" });
  await background.getByRole("button", { name: "Gradient 9" }).click();
  await expect(main).toHaveCSS("background-image", /linear-gradient/);
  await background.getByRole("button", { name: "Color #f5cd47" }).click();
  await expect(main).toHaveCSS("background-color", yellow);
  await expect(main).toHaveCSS("background-image", "none");
  await page.keyboard.press("Escape");

  await page.locator("aside.sidebar a[href^='/w/']").first().click();
  const colorButton = page.getByRole("button", { name: "Workspace color" });
  await colorButton.click();
  await page.getByRole("dialog", { name: "Workspace color" }).getByRole("button", { name: "Color #f5cd47" }).click();
  const avatar = colorButton.locator("span");
  await expect(avatar).toHaveCSS("background-color", yellow);
  await expect(avatar).toHaveCSS("color", darkText);
  // The board's tile shows its background with readable text.
  const boardTile = page.getByRole("link", { name: "Trello import" }).last();
  await expect(boardTile).toHaveCSS("background-color", yellow);
  await expect(boardTile).toHaveCSS("color", darkText);

  await page.reload();
  await expect(page.getByRole("button", { name: "Workspace color" }).locator("span")).toHaveCSS(
    "background-color",
    yellow,
  );
});
