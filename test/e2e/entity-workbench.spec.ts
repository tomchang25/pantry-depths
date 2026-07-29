import { expect, test } from "@playwright/test";

/** Covers the Workbench's browser-only controls, concurrent renderer panels, and explicit gaps. */
test("the Entity Workbench exposes reproducible animation checks without hiding missing states", async ({ page }) => {
  await page.goto("/debug/entity-workbench");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entity Workbench");
  await expect(page.locator('.render-panel[data-state="ready"]')).toHaveCount(4);
  await expect(page.locator('section[aria-label="Decor presets"]')).toBeHidden();

  const status = page.locator(".entity-workbench-status");
  // By id, because a label lookup for "Wall face" also matches the decor tab's "Preview wall face".
  const wallFace = page.locator("#entity-wall-face");
  const matrix = page.getByRole("region", { name: "Entity animation coverage matrix" });
  await expect(matrix).toContainText("Missing — placeholder");
  // Measured, not written down: the skeleton reaches splattered through the impaled atlas, and a
  // slime has no walk of its own. Both answers come from comparing projections.
  await expect(matrix).toContainText("Shared with");

  // The three axes are independent. Changing the situation must leave the body and the state alone.
  await page.getByLabel("State").selectOption("dying");
  await expect(page.getByLabel("Death cause")).toBeEnabled();
  await page.getByLabel("Death cause").selectOption("blasted");
  await page.getByLabel("Situation").selectOption("wall");
  await expect(page.getByLabel("State")).toHaveValue("dying");
  await expect(page.getByLabel("Death cause")).toHaveValue("blasted");
  await expect(wallFace).toBeEnabled();
  await expect(status).toContainText("Against a wall · dying · blasted");

  // Nothing moves when a situation changes what applies: the playback button holds its place, and
  // controls that no longer apply stay put and go inert instead of collapsing their row.
  const play = page.getByRole("button", { name: "Pause playback" });
  const before = await play.boundingBox();
  await page.getByLabel("Situation").selectOption("water");
  await expect(page.getByLabel("Bodies in the pool")).toBeEnabled();
  await expect(wallFace).toBeDisabled();
  await expect(page.getByLabel("State")).toBeDisabled();
  expect((await play.boundingBox())?.y).toBe(before?.y);
  await expect(status).toContainText("going under");

  // The whole drowning is on one scrubber, corpse half included.
  await page.getByLabel("Frame scrubber").fill("90");
  await expect(page.getByRole("button", { name: "Play animation" })).toBeVisible();

  await page.getByLabel("Situation").selectOption("skewered");
  await expect(page.getByLabel("Bodies on stick")).toBeEnabled();
  await page.getByLabel("Bodies on stick").fill("5");
  await expect(status).toContainText("Skewered flight (broken)");

  // A body with no state of its own says so, and the preview shows a placeholder rather than idle.
  await page.getByLabel("Archetype").selectOption("walker");
  await page.getByLabel("Situation").selectOption("room");
  await page.getByLabel("State").selectOption("walk");
  await expect(status).toContainText("no walk of its own");

  await page.getByRole("tab", { name: "Decor" }).click();
  await expect(page.locator('section[aria-label="Body"]')).toBeHidden();
  await expect(page.locator('section[aria-label="Decor presets"]')).toBeVisible();
  await page.getByLabel("Preview wall face").selectOption("west");
  await expect(page.locator(".decor-workbench-status")).toContainText("west face");
  await page.getByLabel("Scale").fill("0.9");
  await expect(page.locator(".decor-workbench-status")).toContainText("Save explicitly");
  await page.getByRole("button", { name: "Duplicate as named variant" }).click();
  await expect(page.locator(".decor-workbench-status")).toContainText("independent named variant");
});
