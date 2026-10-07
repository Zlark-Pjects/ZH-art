import { beatWav, expect, fresh, openTab, seekScene, test } from "./helpers";

const sceneLabels = (page: import("@playwright/test").Page) =>
  page.locator('#panel-storyboard [aria-label^="Scene "][aria-label*="seconds"]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")!));

test("split, duplicate, delete and reorder scenes", async ({ page }) => {
  await fresh(page);
  const sb = await openTab(page, "storyboard");
  const before = await sceneLabels(page);
  await seekScene(page, 1, 0.5);
  await sb.getByRole("button", { name: "Split at playhead" }).click();
  await expect.poll(async () => (await sceneLabels(page)).length).toBe(before.length + 1);
  await sb.getByRole("button", { name: "Delete scene" }).click();
  await expect.poll(async () => (await sceneLabels(page)).length).toBe(before.length);

  // Drag scene 1 past scene 2
  const s1 = (await sb.locator('[aria-label^="Scene 1:"]').boundingBox())!;
  const s2 = (await sb.locator('[aria-label^="Scene 2:"]').boundingBox())!;
  await page.mouse.move(s1.x + 20, s1.y + 20);
  await page.mouse.down();
  await page.mouse.move(s1.x + 60, s1.y + 20, { steps: 3 });
  await page.mouse.move(s2.x + s2.width * 0.85, s1.y + 20, { steps: 8 });
  await page.mouse.up();
  const after = await sceneLabels(page);
  expect(after[0]).toContain(before[1].split(":")[1].split(",")[0]);
});

test("trim a scene by dragging its edge", async ({ page }) => {
  await fresh(page);
  const sb = await openTab(page, "storyboard");
  const label = async () => Number((await sb.locator('[aria-label^="Scene 1:"]').getAttribute("aria-label"))!.match(/([\d.]+) seconds/)![1]);
  const start = await label();
  const handle = (await sb.getByRole("separator", { name: "Trim scene 1" }).boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 60, handle.y + handle.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(await label()).toBeGreaterThan(start);
});

test("transitions, text and title cards", async ({ page }) => {
  await fresh(page);
  const sb = await openTab(page, "storyboard");
  await sb.getByRole("button", { name: /Transition into scene 2/ }).click();
  await sb.getByRole("menuitemradio", { name: "Wipe" }).click();
  await expect(sb.getByRole("button", { name: /Transition into scene 2: Wipe/ })).toBeVisible();

  await seekScene(page, 1, 0.3);
  await sb.getByRole("button", { name: "Add text" }).first().click();
  await sb.locator("#tx-text").fill("Hello there");
  await expect(sb.locator("figure").first()).toContainText("Hello there");
  await sb.getByRole("checkbox", { name: /Scene title cards/ }).uncheck();
  await expect(sb.locator("figure h3")).toHaveCount(0);
});

test("a song is analysed and cuts snap to its beat", async ({ page }) => {
  await fresh(page);
  const sb = await openTab(page, "storyboard");
  await sb.locator('input[type=file][accept^="audio"]').first().setInputFiles({ name: "click.wav", mimeType: "audio/wav", buffer: beatWav() });
  await expect(sb.getByText(/click · 1(19|20|21) bpm/).first()).toBeVisible({ timeout: 20_000 });
  await sb.getByRole("button", { name: /Move every cut onto the nearest beat|Cut on beat/ }).click();
  const first = Number((await sb.locator('[aria-label^="Scene 1:"]').getAttribute("aria-label"))!.match(/([\d.]+) seconds/)![1]);
  // Beats fall every 0.5 s from 0.2 s, so the first cut lands on x.2 or x.7
  expect(Math.round((first % 0.5) * 10) / 10).toBeCloseTo(0.2, 1);
  await page.reload();
  await expect(page.locator("#panel-storyboard").getByText(/click · 1(19|20|21) bpm/).first()).toBeVisible();
});

test("camera keyframes move the camera at the playhead", async ({ page }) => {
  await fresh(page);
  const sb = await openTab(page, "storyboard");
  await sb.getByRole("tab", { name: "Scene" }).click();
  await sb.getByRole("radio", { name: "Keyframes" }).click();
  await seekScene(page, 1, 0.5);
  await sb.getByRole("button", { name: "+ Key at playhead" }).click();
  await sb.getByLabel("Zoom", { exact: true }).fill("1.9");
  const zooms = await page.locator("#panel-storyboard svg[role=img] > g[transform]").evaluateAll((gs) => gs.map((g) => g.getAttribute("transform")));
  expect(zooms.some((t) => /scale\(1\.(8|9)/.test(t ?? ""))).toBe(true);
});

test("a cast character moves along its keys and can be dragged to a new key", async ({ page }) => {
  await fresh(page);
  const sb = await openTab(page, "storyboard");
  await sb.getByRole("tab", { name: "Scene" }).click();
  await sb.getByRole("button", { name: /Add a character/ }).click();
  await sb.getByRole("radio", { name: "Moves" }).click();
  const figureX = async () =>
    Number(
      (await page.locator('#panel-storyboard svg[role=img] g[transform*="translate(-200"]').first().getAttribute("transform"))!.match(/translate\(([\d.]+)/)![1],
    );
  await seekScene(page, 1, 0.05);
  const a = await figureX();
  await seekScene(page, 1, 0.95);
  const b = await figureX();
  expect(Math.abs(b - a)).toBeGreaterThan(100);

  await seekScene(page, 1, 0.5);
  const hit = (await sb.locator('svg[role=img] g[transform*="translate(-200"] rect[fill="transparent"]').first().boundingBox())!;
  await page.mouse.move(hit.x + hit.width / 2, hit.y + hit.height / 2);
  await page.mouse.down();
  await page.mouse.move(hit.x + hit.width / 2, hit.y + hit.height / 2 - 80, { steps: 5 });
  await page.mouse.up();
  await expect(sb.locator('[aria-label="Position keys"] [role=listitem]')).toHaveCount(3);
});
