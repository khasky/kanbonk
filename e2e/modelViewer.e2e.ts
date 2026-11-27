import { expect, importTrelloBoard, test } from "./fixtures";

const stl = `solid part
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 20 0 0
vertex 0 30 0
endloop
endfacet
endsolid part
`;

test("views 3D attachments with orbit, light and background, and filters them as 3D models", async ({ page }) => {
  await importTrelloBoard(page);
  await page.getByRole("link", { name: /Card from Trello/ }).click();
  const card = page.getByRole("dialog", { name: "Card from Trello" });
  await card.locator(".card-actions").getByRole("button", { name: "Add", exact: true }).click();
  await card.locator("label.file-button input[type=file]").setInputFiles([
    { name: "part.stl", mimeType: "", buffer: Buffer.from(stl) },
    { name: "broken.glb", mimeType: "model/gltf-binary", buffer: Buffer.from("not a model") },
  ]);

  await card.getByRole("button", { name: "View 3D part.stl" }).click();
  const preview = page.getByRole("dialog", { name: "Preview part.stl" });
  await expect(preview.locator("[data-model-state=ready] canvas")).toBeVisible();
  await preview.getByLabel("Light").fill("2");
  await expect(preview.getByLabel("Light")).toHaveValue("2");
  await expect(preview.getByLabel("Background")).toBeVisible();
  const canvas = preview.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("The 3D view has no size");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 20);
  await page.mouse.up();
  await expect(preview.locator("[data-model-state=ready]")).toBeVisible();
  await preview.getByRole("button", { name: "Close preview" }).click();

  await card.getByRole("button", { name: "View 3D broken.glb" }).click();
  const broken = page.getByRole("dialog", { name: "Preview broken.glb" });
  await expect(broken.getByText("This 3D file could not be read.", { exact: false })).toBeVisible();
  await broken.getByRole("button", { name: "Close preview" }).click();
  await card.getByRole("button", { name: "Close" }).first().click();

  await page.getByRole("tab", { name: "Attachments" }).click();
  const view = page.getByRole("region", { name: "Board attachments" });
  await view.getByLabel("Type").selectOption({ label: "3D models (2)" });
  await expect(view.locator("tbody tr")).toHaveCount(2);
});
