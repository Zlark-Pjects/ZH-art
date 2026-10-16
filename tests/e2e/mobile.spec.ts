import { expect, fresh, openTab, test } from "./helpers";

test("no screen scrolls sideways on a phone", async ({ page }) => {
  await fresh(page);
  for (const tab of ["storyboard", "looks", "characters", "rig", "export", "play"] as const) {
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

test("the game plays with the on-screen buttons", async ({ page }) => {
  await fresh(page);
  const play = await openTab(page, "play");
  await play.getByRole("button", { name: "Start playing" }).tap();
  const game = play.getByTestId("stickville");
  await expect(game).toHaveAttribute("data-x", /\d+/);
  const x0 = Number(await game.getAttribute("data-x"));
  await play.getByRole("button", { name: "Right" }).dispatchEvent("pointerdown");
  await page.waitForTimeout(800);
  await play.getByRole("button", { name: "Right" }).dispatchEvent("pointerup");
  await expect.poll(async () => Number(await game.getAttribute("data-x"))).toBeGreaterThan(x0 + 100);
});
