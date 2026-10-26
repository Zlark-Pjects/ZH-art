import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "./helpers";

/* Stickman Battle Royale, from the standalone build (`npm run build:stickville`). */
const FILE = resolve(process.cwd(), "dist-stickville/stickville.html");
test.skip(!existsSync(FILE), "needs `npm run build:stickville` first");

type G = {
  you: { x: number; y: number; hp: number; kills: number; z: number; skillCd: number; rollCd: number; guns: ({ id: string; mag: number } | null)[]; cur: number; ammo: Record<string, number>; alive: boolean };
  phase: string;
  time: number;
  bullets: unknown[];
  actors: { alive: boolean }[];
  demo: boolean;
  result: { place: number } | null;
  update(dt: number): void;
  input: { pressed: Set<string> };
};

test("pick a fighter, drop in, move, roll, use a skill and shoot", async ({ page, errors }) => {
  void errors;
  await page.goto("file://" + FILE + "?cheats");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { name: /battle royale/i })).toBeVisible();

  // Locked fighters can't be picked until they're bought
  await expect(page.getByRole("button", { name: "Unlock Zed" })).toBeDisabled();
  await page.getByRole("radio", { name: /Mia: Mend/ }).click();
  await page.getByRole("button", { name: "Drop in" }).click();
  await expect(page.getByTestId("battle")).toBeVisible();

  // Parachute down
  await page.evaluate(() => {
    const g = (window as unknown as { stickbr: G }).stickbr;
    for (let i = 0; i < 60 * 14; i++) g.update(1 / 60);
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { stickbr: G }).stickbr.phase)).toBe("play");

  // Arm the player, then play with the real keys
  await page.evaluate(() => {
    const g = (window as unknown as { stickbr: G }).stickbr;
    g.you.guns[0] = { id: "ar", mag: 30 };
    g.you.cur = 0;
    g.you.ammo.med = 60;
  });
  const before = await page.evaluate(() => {
    const y = (window as unknown as { stickbr: G }).stickbr.you;
    return { x: y.x, y: y.y };
  });
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyD");
  const after = await page.evaluate(() => {
    const y = (window as unknown as { stickbr: G }).stickbr.you;
    return { x: y.x, y: y.y };
  });
  expect(after.x, "WASD moves the fighter").toBeGreaterThan(before.x + 20);

  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as unknown as { stickbr: G }).stickbr.you.rollCd)).toBeGreaterThan(0);
  await page.keyboard.press("KeyQ");
  await expect.poll(() => page.evaluate(() => (window as unknown as { stickbr: G }).stickbr.you.skillCd)).toBeGreaterThan(0);

  const box = (await page.getByTestId("battle").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();
  const mag = await page.evaluate(() => (window as unknown as { stickbr: G }).stickbr.you.guns[0]!.mag);
  expect(mag, "firing uses ammo").toBeLessThan(30);

  // Leaving asks first
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Leave match" })).toBeVisible();
  await page.getByRole("button", { name: "Keep playing" }).click();
});

test("a whole match ends with a result, coins and a rematch", async ({ page, errors }) => {
  void errors;
  await page.goto("file://" + FILE + "?cheats");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Drop in" }).click();
  await expect(page.getByTestId("battle")).toBeVisible();
  await page.evaluate(() => {
    const g = (window as unknown as { stickbr: G }).stickbr;
    g.demo = true; // let the bot brain play for us
    for (let i = 0; i < 60 * 60 * 6 && g.phase !== "over"; i++) g.update(1 / 60);
  });
  const dlg = page.getByRole("dialog", { name: "Match result" });
  await expect(dlg).toBeVisible({ timeout: 20_000 });
  await expect(dlg).toContainText(/#\d+/);
  await expect(dlg).toContainText(/coins/);
  const coins = await page.evaluate(() => JSON.parse(localStorage.getItem("stickville.battle.v1")!).coins as number);
  expect(coins, "the match paid out").toBeGreaterThan(0);

  await dlg.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("heading", { name: /battle royale/i })).toBeVisible();
  // Spend them: upgrading the starter fighter costs 120
  if (coins >= 120) {
    await page.getByRole("button", { name: "Upgrade Kai" }).click();
    await expect(page.getByLabel("Skill level 2 of 5").first()).toBeVisible();
  }
  await page.getByRole("button", { name: "Drop in" }).click();
  await expect(page.getByTestId("battle")).toBeVisible();
});

test("the city is still one tap away", async ({ page, errors }) => {
  void errors;
  await page.goto("file://" + FILE);
  await page.getByRole("button", { name: /open the city/i }).click();
  await expect(page.getByTestId("stickcity")).toBeVisible();
  await page.getByRole("button", { name: /battle royale/i }).click();
  await expect(page.getByRole("heading", { name: /battle royale/i })).toBeVisible();
});
