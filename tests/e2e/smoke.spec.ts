import { expect, test } from "@playwright/test";

test.describe("public smoke routes", () => {
  test("homepage renders hero content", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Anca Visuals|AncaVisuals/i);
    await expect(
      page.getByRole("heading", { name: /pentru amintiri/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("link", { name: /portofoliu/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("portfolio route renders stable content", async ({ page }) => {
    await page.goto("/portofoliu");

    await expect(page).toHaveURL(/\/portofoliu$/);
    await expect(page.getByText(/ce vezi în portofoliu/i)).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("link", { name: /foto video nuntă|foto video nunta/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("contact route renders configurator entry", async ({ page }) => {
    await page.goto("/contact");

    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByText(/bună, oameni frumoși!/i)).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/configurează pachetul tău în câteva click-uri/i),
    ).toBeVisible({ timeout: 15_000 });
  });
});
