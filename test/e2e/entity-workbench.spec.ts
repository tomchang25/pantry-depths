import { expect, test } from "@playwright/test";

/** Covers the Workbench's browser-only controls, concurrent renderer panels, and explicit gaps. */
test("the Entity Workbench exposes reproducible animation checks without hiding missing states", async ({ page }) => {
  await page.goto("/debug/entity-workbench");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entity Workbench");
  await expect(page.locator('.render-panel[data-state="ready"]')).toHaveCount(4);
  await expect(page.getByRole("region", { name: "Entity animation coverage matrix" })).toContainText(
    "Missing — placeholder",
  );

  await page.getByLabel("Scenario").selectOption("carried");
  await page.getByLabel("Bodies on stick").fill("5");
  await expect(page.getByRole("status").filter({ hasText: "Skeleton Swordsman" })).toContainText("Skewered flight");

  await page.getByLabel("Archetype").selectOption("walker");
  await page.getByLabel("Scenario").selectOption("clip");
  await page.getByLabel("Clip / body state").selectOption("walk");
  await expect(page.getByRole("status").filter({ hasText: "no walk state" })).toBeVisible();

  await page.getByRole("tab", { name: "Decor" }).click();
  await page.getByLabel("Preview wall face").selectOption("west");
  await expect(page.locator(".decor-workbench-status")).toContainText("west face");
  await page.getByLabel("Scale").fill("0.9");
  await expect(page.locator(".decor-workbench-status")).toContainText("Save explicitly");
  await page.getByRole("button", { name: "Duplicate as named variant" }).click();
  await expect(page.locator(".decor-workbench-status")).toContainText("independent named variant");
});
