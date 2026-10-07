import { expect, fresh, openTab, test } from "./helpers";

test("no screen scrolls sideways on a phone", async ({ page }) => {
  await fresh(page);
  for (const tab of ["storyboard", "looks", "characters", "rig", "export"] as const) {
    await openTab(page, tab);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, tab).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
});

test("tapping a scene on the timeline selects it", async ({ page }) => {
  await fresh(page);
  const sb = await openTab(page, "storyboard");
  await sb.locator('[aria-label^="Scene 3:"]').tap();
  await expect(sb.locator('[aria-label^="Scene 3:"]')).toHaveAttribute("aria-current", "step");
});
