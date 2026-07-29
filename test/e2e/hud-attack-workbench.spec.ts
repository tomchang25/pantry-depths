import { expect, test } from "@playwright/test";

/** Covers the two browser-only authoring surfaces without writing their explicit save endpoint. */
test("the HUD and Attack Workbench previews live model and hit-arc changes", async ({ page }) => {
  await page.goto("/debug/hud-attack-workbench");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("HUD and Attack Workbench");
  await expect(page.locator('.render-panel[data-state="ready"]')).toHaveCount(2);
  await page.getByLabel("HP", { exact: true }).fill("31");
  await expect(page.getByRole("progressbar", { name: "Health" })).toHaveAttribute("aria-valuenow", "31");

  // The readout is two numbers and nothing else. Depth, enemy count, kills, walls broken, the altar
  // and the wall ahead were all cut from the model, not merely hidden.
  await expect(page.locator(".demo__readout")).toHaveText("31 / 100 · 60 FPS");

  await page.getByRole("tab", { name: "Attack" }).click();
  await page.getByLabel("Aim target").selectOption("4");
  await page.getByRole("button", { name: "Play selected attack" }).click();
  await expect(page.locator(".attack-workbench-status")).toContainText("Missed outside the hit arc");

  await page.getByLabel("Aim target").selectOption("2");
  await page.getByRole("button", { name: "Play selected attack" }).click();
  await expect(page.locator(".attack-workbench-status")).toContainText("Connected with camera and arm impact hitch");
});
