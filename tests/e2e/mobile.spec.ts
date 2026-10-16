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

test("the city plays with the on-screen joystick", async ({ page }) => {
  await fresh(page);
  const play = await openTab(page, "play");
  await play.getByRole("button", { name: "Start playing" }).tap();
  const city = play.getByTestId("stickcity");
  await expect(city).toHaveAttribute("data-x", /\d+/);
  const x0 = Number(await city.getAttribute("data-x"));
  const stick = play.getByRole("slider", { name: "Move" });
  const b = (await stick.boundingBox())!;
  await stick.dispatchEvent("pointerdown", { clientX: b.x + b.width / 2, clientY: b.y + b.height / 2, pointerId: 7 });
  await stick.dispatchEvent("pointermove", { clientX: b.x + b.width / 2 + 45, clientY: b.y + b.height / 2, pointerId: 7 });
  await expect.poll(async () => Number(await city.getAttribute("data-x"))).toBeGreaterThan(x0 + 100);
  await stick.dispatchEvent("pointerup", { pointerId: 7 });
  await play.getByRole("button", { name: "Phone" }).first().tap();
  await expect(play.getByRole("dialog", { name: "Phone" })).toBeVisible();
});
