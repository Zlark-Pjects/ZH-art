import { expect, fresh, openTab, test } from "./helpers";
import type { Page } from "@playwright/test";

const city = (page: Page) => page.getByTestId("stickcity");

async function start(page: Page) {
  await fresh(page);
  const play = await openTab(page, "play");
  const dialog = play.getByRole("dialog");
  await expect(dialog).toContainText("Make your character");
  await dialog.getByLabel("Character name").fill("Tester");
  await dialog.getByRole("radio", { name: "skirt" }).click();
  await dialog.getByRole("button", { name: "Start playing" }).click();
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(700); // the tab's smooth scroll
  return play;
}

/** A game already in progress, with the console hook (?cheats) so tests can drive it quickly. */
async function startWith(page: Page, save: object) {
  await page.goto("/?cheats");
  await page.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem("zh-art:stickcity", JSON.stringify({ v: 2, hero: { name: "T", hair: "bun", hairColor: "#141010", headwear: "none", skin: "#c68b5e", top: "#3fa7ff", bottom: "pants", bottomColor: "#30343c" }, ...s }));
  }, save);
  await page.reload();
  const skip = page.getByText(/click to skip/i);
  if (await skip.isVisible().catch(() => false)) await skip.click();
  const play = await openTab(page, "play");
  await expect(city(page)).toHaveAttribute("data-x", /\d+/);
  return play;
}

async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

test("make a character, meet Nana Bea, and ride the dirt bike", async ({ page, errors }) => {
  const play = await start(page);
  await expect(city(page)).toHaveAttribute("data-money", "250");
  // Nana Bea waves a little way east of where you start
  await hold(page, "KeyD", 1500);
  await expect(city(page)).toHaveAttribute("data-prompt", /Talk to Nana Bea/);
  await page.keyboard.press("KeyE");
  const dialog = play.getByRole("dialog");
  await expect(dialog).toContainText("Nana Bea");
  await expect(dialog).toContainText("Those empty plots on our block are yours");
  await dialog.getByRole("button", { name: "Okay" }).click();
  await expect(city(page)).toHaveAttribute("data-money", "350");
  // Your bike is parked west of your block
  await hold(page, "KeyA", 2700);
  await expect(city(page)).toHaveAttribute("data-prompt", /dirt bike/);
  await page.keyboard.press("KeyE");
  await expect(city(page)).toHaveAttribute("data-vehicle", "bike");
  const x0 = Number(await city(page).getAttribute("data-x"));
  await hold(page, "KeyS", 300);
  await hold(page, "KeyW", 1200);
  await expect.poll(async () => Math.abs(Number(await city(page).getAttribute("data-x")) - x0) + Math.abs(Number(await city(page).getAttribute("data-y")))).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test("every phone app opens", async ({ page, errors }) => {
  const play = await start(page);
  await page.keyboard.press("Tab");
  const phone = play.getByRole("dialog", { name: "Phone" });
  await expect(phone).toBeVisible();
  for (const app of ["Map", "Missions", "Races", "Jobs", "People", "Garage", "Style", "Brain", "Radio", "Stats", "Settings"]) {
    // People carries a badge with the number of people who have news
    await phone.getByRole("button", { name: new RegExp(`^${app}( \\(\\d+ new\\))?$`) }).click();
    await expect(phone.getByRole("heading", { name: app === "Brain" ? "Brain games" : app === "Races" ? "Street races" : app })).toBeVisible();
    await phone.getByRole("button", { name: "Apps" }).click();
  }
  await page.keyboard.press("Escape");
  await expect(phone).toBeHidden();
  expect(errors).toEqual([]);
});

test("missions, a race, a pizza run, a taxi fare and a stunt all pay out", async ({ page, errors }) => {
  await startWith(page, { money: 5000, xp: 5000, plots: ["house", "garage", "helipad", null, null, null] });
  const log = await page.evaluate(() => {
    const g = (window as any).stickcity;
    const { MISSIONS, RACES } = (window as any).stickcityData;
    const step = (n: number, fn?: () => void) => {
      for (let i = 0; i < n; i++) {
        fn?.();
        g.update(1 / 60);
      }
    };
    const out: Record<string, unknown> = {};
    // Hold the Base: stand in the yard and keep firing
    Object.assign(g.player, { x: 78 * 64, y: 20 * 64 });
    g.startMission(MISSIONS[0]);
    for (let i = 0; i < 60 * 150 && g.mission; i++) {
      g.input.fire = true;
      g.player.hp = 100;
      g.update(1 / 60);
    }
    g.input.fire = false;
    out.defense = g.save.missions.defense?.stars ?? 0;
    // Codebreaker: answer all three terminals
    g.save.missions.convoy = { stars: 1 };
    g.save.missions.stealth = { stars: 1 };
    g.startMission(MISSIONS[3]);
    for (let i = 0; i < 3; i++) g.answerTerminal(i, true);
    step(3);
    out.hack = g.save.missions.hack?.stars ?? 0;
    // A race: teleport through the checkpoints
    const bike = g.vehicles.find((v: any) => v.kind === "bike" && v.owned);
    g.enter(bike);
    g.startRace(RACES[0]);
    step(200);
    for (const w of g.raceWaypoints(RACES[0]).slice(1)) {
      Object.assign(bike, w);
      step(2);
    }
    out.race = g.save.races.downtown?.wins ?? 0;
    // Pizza
    g.exit();
    g.startJob("pizza");
    for (let i = 0; i < 5 && g.job; i++) {
      Object.assign(g.player, { x: g.job.target.x, y: g.job.target.y });
      step(2);
    }
    out.pizza = g.save.deliveries;
    // A stunt off the stunt park ramp
    const car = g.vehicles.find((v: any) => v.kind === "car" && v.owned);
    g.enter(car);
    const ramp = g.map.ramps[0];
    Object.assign(car, { x: ramp.x - 120, y: ramp.y, a: 0, vx: 520, vy: 0, z: 0 });
    for (let i = 0; i < 180; i++) {
      g.input.up = true;
      g.update(1 / 60);
    }
    g.input.up = false;
    out.stunt = g.save.bestStunt;
    return out;
  });
  expect(log.defense).toBeGreaterThan(0);
  expect(log.hack).toBe(3);
  expect(log.race).toBe(1);
  expect(log.pizza).toBe(5);
  expect(log.stunt).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test("build a home, buy an upgrade, and use the Builder with a Blender model", async ({ page, errors }) => {
  const play = await startWith(page, { money: 3000 });
  // The plots are just north of where you start
  await hold(page, "KeyW", 600);
  await expect(city(page)).toHaveAttribute("data-prompt", /Build on plot/);
  await page.keyboard.press("KeyE");
  const dialog = play.getByRole("dialog");
  await dialog.getByRole("button", { name: "Build Home" }).click();
  await expect(city(page)).toHaveAttribute("data-money", "2400");
  // Phone → Garage → Nitro
  await page.keyboard.press("Tab");
  const phone = play.getByRole("dialog", { name: "Phone" });
  await phone.getByRole("button", { name: "Garage", exact: true }).click();
  await phone.getByRole("button", { name: "$800" }).first().click();
  await expect(city(page)).toHaveAttribute("data-money", "1600");
  await page.keyboard.press("Escape");
  // Builder: place a trampoline-free palm tree, then import the example Blender rocket and place it
  await play.getByRole("button", { name: "Builder" }).click();
  const bar = play.getByRole("region", { name: "Builder" });
  const canvas = play.locator("canvas[role=img]");
  const clickCity = async (fx: number, fy: number) => {
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  };
  await bar.getByRole("radio", { name: "Palm" }).click();
  await clickCity(0.3, 0.75);
  await expect(city(page)).toHaveAttribute("data-props", "1");
  await bar.getByLabel("Import file").setInputFiles("blender/examples/rocket.stickpack.json");
  await expect(bar.getByRole("status")).toContainText("Imported 1 item");
  await clickCity(0.7, 0.75);
  await expect(city(page)).toHaveAttribute("data-props", "2");
  // The world code round-trips
  await bar.getByRole("button", { name: "World code" }).click();
  const code = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("zh-art:stickcity")!);
    return JSON.stringify({ format: "stickville-world", version: 2, props: s.props, packs: s.packs, questions: [] });
  });
  await dialog.locator("#world-code").fill(code);
  await dialog.getByRole("button", { name: "Add to my city" }).click();
  await expect(dialog.getByRole("status")).toContainText("Loaded 2 items");
  await expect(city(page)).toHaveAttribute("data-props", "4");
  expect(errors).toEqual([]);
});
