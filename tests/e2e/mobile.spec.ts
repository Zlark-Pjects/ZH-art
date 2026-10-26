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

test("battle royale plays with the phone sticks and buttons", async ({ page }) => {
  const { existsSync } = await import("node:fs");
  const file = process.cwd() + "/dist-stickville/stickville.html";
  test.skip(!existsSync(file), "needs `npm run build:stickville` first");
  type G = { you: { x: number; mag?: number; skillCd: number; rollCd: number; guns: ({ mag: number } | null)[]; cur: number; ammo: Record<string, number> }; phase: string; update(dt: number): void };
  await page.goto("file://" + file + "?cheats");
  await page.getByRole("button", { name: "Drop in" }).tap();
  await expect(page.getByTestId("battle")).toBeVisible();
  await page.evaluate(() => {
    const s = (window as unknown as { stickbr: G }).stickbr;
    for (let i = 0; i < 60 * 14; i++) s.update(1 / 60);
  });
  await page.evaluate(() => {
    const s = (window as unknown as { stickbr: G }).stickbr;
    s.you.guns[0] = { mag: 30 };
    (s.you.guns[0] as unknown as { id: string }).id = "ar";
    s.you.cur = 0;
    s.you.ammo.med = 60;
  });
  const x0 = await page.evaluate(() => (window as unknown as { stickbr: G }).stickbr.you.x);
  const move = page.getByRole("slider", { name: "Move" });
  const m = (await move.boundingBox())!;
  await move.dispatchEvent("pointerdown", { clientX: m.x + m.width / 2, clientY: m.y + m.height / 2, pointerId: 3 });
  await move.dispatchEvent("pointermove", { clientX: m.x + m.width / 2 + 50, clientY: m.y + m.height / 2, pointerId: 3 });
  await expect.poll(() => page.evaluate(() => (window as unknown as { stickbr: G }).stickbr.you.x)).toBeGreaterThan(x0 + 60);
  await move.dispatchEvent("pointerup", { pointerId: 3 });

  await page.getByRole("button", { name: "Roll" }).tap();
  await expect.poll(() => page.evaluate(() => (window as unknown as { stickbr: G }).stickbr.you.rollCd)).toBeGreaterThan(0);
  await page.getByRole("button", { name: /^Skill:/ }).tap();
  await expect.poll(() => page.evaluate(() => (window as unknown as { stickbr: G }).stickbr.you.skillCd)).toBeGreaterThan(0);

  // Push the aim stick all the way: it shoots
  const aim = page.getByRole("slider", { name: "Aim" });
  const a = (await aim.boundingBox())!;
  await aim.dispatchEvent("pointerdown", { clientX: a.x + a.width / 2, clientY: a.y + a.height / 2, pointerId: 4 });
  await aim.dispatchEvent("pointermove", { clientX: a.x + a.width / 2 - 55, clientY: a.y + a.height / 2, pointerId: 4 });
  await expect.poll(() => page.evaluate(() => (window as unknown as { stickbr: G }).stickbr.you.guns[0]!.mag)).toBeLessThan(30);
  await aim.dispatchEvent("pointerup", { pointerId: 4 });
});
