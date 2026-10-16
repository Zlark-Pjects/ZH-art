import { expect, fresh, openTab, test } from "./helpers";

const game = (page: import("@playwright/test").Page) => page.getByTestId("stickville");

async function start(page: import("@playwright/test").Page) {
  await fresh(page);
  const play = await openTab(page, "play");
  const dialog = play.getByRole("dialog");
  await expect(dialog).toContainText("Make your hero");
  await dialog.getByRole("button", { name: "Zara" }).click();
  await dialog.getByLabel("Hero name").fill("Tester");
  await dialog.getByRole("radio", { name: "skirt" }).click();
  await dialog.getByRole("button", { name: "Start playing" }).click();
  await expect(dialog).toBeHidden();
  return play;
}

async function hold(page: import("@playwright/test").Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

test("make a hero, walk, and build on the first plot", async ({ page, errors }) => {
  const play = await start(page);
  await expect(game(page)).toHaveAttribute("data-x", /\d+/);
  const x0 = Number(await game(page).getAttribute("data-x"));
  await hold(page, "KeyD", 900);
  await expect.poll(async () => Number(await game(page).getAttribute("data-x"))).toBeGreaterThan(x0 + 150);
  await page.keyboard.press("KeyE");
  const dialog = play.getByRole("dialog");
  await expect(dialog).toContainText("Build something");
  await dialog.getByRole("button", { name: "Build Park" }).click();
  await expect(game(page)).toHaveAttribute("data-coins", "75");
  // When construction finishes, its builder's note appears
  await expect(dialog).toContainText("Builder's note", { timeout: 10_000 });
  await dialog.getByRole("button", { name: "Nice" }).click();
  // The hero and the town survive a reload
  await page.reload();
  await openTab(page, "play");
  await expect(play.getByRole("dialog")).toBeHidden();
  await expect(game(page)).toHaveAttribute("data-coins", /^\d+$/);
  expect(Number(await game(page).getAttribute("data-coins"))).toBeGreaterThanOrEqual(75);
  expect(errors).toEqual([]);
});

test("ride the bike and open every menu", async ({ page, errors }) => {
  const play = await start(page);
  // The bike is parked just right of the spawn point
  await hold(page, "KeyD", 200);
  await page.keyboard.press("KeyE");
  await expect(game(page)).toHaveAttribute("data-vehicle", "bike");
  const x0 = Number(await game(page).getAttribute("data-x"));
  await hold(page, "KeyD", 1500);
  await expect.poll(async () => Number(await game(page).getAttribute("data-x"))).toBeGreaterThan(x0 + 400);
  await page.keyboard.press("KeyE");
  await expect(game(page)).toHaveAttribute("data-vehicle", "");
  for (const name of ["Journal", "How to play", "Character"]) {
    await play.getByRole("button", { name, exact: true }).click();
    await expect(play.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(play.getByRole("dialog")).toBeHidden();
  }
  expect(errors).toEqual([]);
});

test("a school quiz explains every answer and pays for right ones", async ({ page, errors }) => {
  const play = await start(page);
  await hold(page, "KeyD", 900);
  await page.keyboard.press("KeyE");
  const dialog = play.getByRole("dialog");
  await dialog.getByRole("button", { name: "Build School" }).click();
  await expect(dialog).toContainText("Builder's note", { timeout: 10_000 });
  await dialog.getByRole("button", { name: "Nice" }).click();
  await page.keyboard.press("KeyE");
  await expect(dialog).toContainText("question 1 of 5");
  await dialog.locator("button:not([aria-label])").first().click();
  await expect(dialog.getByRole("status")).toContainText(/Correct!|Not quite\./);
  await dialog.getByRole("button", { name: "Next question" }).click();
  await expect(dialog).toContainText("question 2 of 5");
  expect(errors).toEqual([]);
});

test("creator: place items, bounce on a trampoline, import a Blender model, share a world", async ({ page, errors }) => {
  const play = await start(page);
  const canvas = play.locator("canvas[role=img]");
  const clickWorld = async (fx: number, fy: number) => {
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  };
  await page.waitForTimeout(800); // let the tab's smooth scroll settle
  await play.getByRole("button", { name: "Create" }).click();
  const panel = play.getByRole("region", { name: "Creator" });
  await panel.getByRole("tab", { name: "Play" }).click();
  await panel.getByRole("radio", { name: "Trampoline" }).click();
  // Just right of the hero, on the road
  await clickWorld(0.62, 0.7);
  await expect(game(page)).toHaveAttribute("data-props", "1");
  await panel.getByRole("radio", { name: "Move" }).click();
  // Walk onto it: the hero is thrown high into the air
  await page.keyboard.down("KeyD");
  await expect.poll(async () => Number(await game(page).getAttribute("data-y")), { timeout: 8000 }).toBeLessThan(-150);
  await page.keyboard.up("KeyD");

  // A model exported by the Blender add-on
  await panel.getByLabel("Import file").setInputFiles("blender/examples/rocket.stickpack.json");
  await expect(panel.getByRole("status")).toContainText("Imported 1 item");
  await clickWorld(0.4, 0.6);
  await expect(game(page)).toHaveAttribute("data-props", "2");

  // Your own quiz question
  await panel.getByRole("button", { name: "Quiz maker" }).click();
  const dialog = play.getByRole("dialog");
  await dialog.locator("#quiz-q").fill("How many legs does a spider have?");
  await dialog.locator("#quiz-opt-0").fill("Six");
  await dialog.locator("#quiz-opt-1").fill("Eight");
  await dialog.getByLabel("Answer 2 is right").check();
  await dialog.getByRole("button", { name: "Add question" }).click();
  await expect(dialog).toContainText("→ Eight");
  await dialog.getByRole("button", { name: "Done" }).click();

  // A world file round-trips: copy it as code, clear, paste it back
  await panel.getByRole("button", { name: "World file" }).click();
  const code = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("zh-art:stickville")!);
    return JSON.stringify({ format: "stickville-world", version: 1, name: "t", props: s.props, packs: s.packs, questions: s.myQuestions });
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await panel.getByRole("button", { name: "Clear" }).click();
  await panel.getByRole("button", { name: /Remove all/ }).click();
  await expect(game(page)).toHaveAttribute("data-props", "0");
  await panel.getByRole("button", { name: "World file" }).click();
  await dialog.locator("#world-code").fill(code);
  await dialog.getByRole("button", { name: "Add to my world" }).click();
  await expect(dialog.getByRole("status")).toContainText("Loaded 2 items");
  await expect(game(page)).toHaveAttribute("data-props", "2");
  expect(errors).toEqual([]);
});
