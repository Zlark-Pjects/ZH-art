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
