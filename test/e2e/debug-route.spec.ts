import { expect, test } from "@playwright/test";

/**
 * The development console is the project's only browser surface today; ordinary play is still a
 * placeholder. Route resolution is already owned by `test/unit/app/app-route.test.ts` and
 * `test/unit/app/debug/debug-router.test.ts`, and the catalog entries by the same router suite, so
 * this spec asserts none of that. It covers only what no cheaper layer can observe: the real
 * bootstrap mounting against a development server, a hub card performing a full-document
 * navigation, and the target tool's dynamic import resolving.
 */
test("the debug hub boots and opens a lazily loaded tool through a full-document navigation", async ({ page }) => {
  await page.goto("/debug");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Development Tools");

  await page.getByRole("link", { name: /Floor Set Workbench/ }).click();

  await expect(page).toHaveURL(/\/debug\/floor-workbench$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Floor Set Workbench");
});
