import { expect, test } from "./fixtures";

test("switches the interface language in Settings and keeps it after a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("App menu").click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("dialog", { name: "Settings" }).getByLabel("Language").selectOption("ru");

  const settings = page.getByRole("dialog", { name: "Настройки" });
  await expect(settings.getByRole("heading", { name: "Корзина" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");

  await page.reload();
  await page.getByLabel("Меню приложения").click();
  await page.getByRole("button", { name: "Настройки" }).click();
  await page.getByRole("dialog", { name: "Настройки" }).getByLabel("Язык").selectOption("");
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
});
