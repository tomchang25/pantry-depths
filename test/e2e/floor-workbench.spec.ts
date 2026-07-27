import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The workbench is the one browser surface with a server dependency: its client fetches the
 * development authoring endpoint, which the Vite middleware in `vite.config.ts` forwards to a
 * `vite-node` child process. The request handler, the generator, and the validator are all owned by
 * `test/unit/dev/tools/floor-set/` and `test/unit/content/floor/`, and the map's projection by
 * `test/unit/app/debug/floor-map.test.ts`; none of them can observe the wiring between browser,
 * middleware, and runner, and neither can they observe the DOM interlock that guards the canonical
 * file. Everything else about this page — layout, map readability, generated content quality — stays
 * a manual judgement.
 *
 * No test here presses "Save Canonical JSON": that button overwrites
 * `src/content/floors/provisional-floor-set.json`.
 */

const CANONICAL_LOADED = /Canonical JSON loaded as an unsaved draft/;

/** The draft map reports its own status, so the workbench's status is read through its own panel. */
function departureStatus(page: Page): Locator {
  return page.getByRole("region", { name: "Export and Save" }).getByRole("status");
}

test("the workbench loads and regenerates a draft through the development authoring endpoint", async ({ page }) => {
  await page.goto("/debug/floor-workbench");

  const status = departureStatus(page);
  const editor = page.getByLabel("Floor-set JSON");
  await expect(status).toHaveText(CANONICAL_LOADED);

  const canonicalDraft = await editor.inputValue();
  expect(canonicalDraft.length).toBeGreaterThan(0);

  // A seed the canonical content was not baked from, so the response cannot be mistaken for the
  // draft that was already loaded.
  await page.getByLabel("Seed").fill("7");
  await page.getByRole("button", { name: "Generate Draft" }).click();

  // The endpoint spawns a `vite-node` runner per request, so the first generation pays a process
  // start on top of the generator's own search.
  await expect(status).toHaveText(/Generated candidate loaded as an unsaved draft/, { timeout: 30_000 });
  await expect(editor).not.toHaveValue(canonicalDraft);
});

test("export and canonical overwrite stay disabled until the exact draft validates", async ({ page }) => {
  await page.goto("/debug/floor-workbench");

  const status = departureStatus(page);
  const editor = page.getByLabel("Floor-set JSON");
  const exportButton = page.getByRole("button", { name: /Export JSON File/ });
  const saveButton = page.getByRole("button", { name: /Save Canonical JSON/ });
  await expect(status).toHaveText(CANONICAL_LOADED);
  await expect(exportButton).toBeDisabled();
  await expect(saveButton).toBeDisabled();

  await page.getByRole("button", { name: "Validate Draft" }).click();

  await expect(status).toHaveText(/Download and canonical overwrite are enabled/);
  await expect(exportButton).toBeEnabled();
  await expect(saveButton).toBeEnabled();

  // Still-valid JSON: the interlock re-arms on any edit, not on a parse failure.
  await editor.press(" ");

  await expect(status).toHaveText(/Draft changed. Validate again/);
  await expect(exportButton).toBeDisabled();
  await expect(saveButton).toBeDisabled();
});
