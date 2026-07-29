import { expect, test } from "@playwright/test";

/** Covers the eight-move prototype's browser-only canvas wiring and no-repeat selection. */
test("the melee prototype triggers non-repeating attacks with the left mouse button", async ({ page }) => {
  await page.goto("/debug/melee-viewmodel-lab");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("方案一 · Eight-Attack Prototype");
  const attackStage = page.getByRole("button", { name: /八種劍擊測試區/ });
  await expect(attackStage).toBeVisible();

  await attackStage.click({ button: "left" });
  const firstAttack = await page.getByRole("status").textContent();
  await expect(page.getByRole("status")).toContainText("下一次將從其餘七招抽取");

  await page.waitForTimeout(900);
  await attackStage.click({ button: "left" });
  const secondAttack = await page.getByRole("status").textContent();

  expect(secondAttack).not.toBe(firstAttack);
});
