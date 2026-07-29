import { expect, test } from "@playwright/test";

/** Covers the Workbench's browser-only controls, concurrent renderer panels, and explicit gaps. */
test("the Entity Workbench exposes reproducible animation checks without hiding missing states", async ({ page }) => {
  await page.goto("/debug/entity-workbench");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entity Workbench");
  await expect(page.locator('.render-panel[data-state="ready"]')).toHaveCount(3);
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
});
