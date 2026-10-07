import { readFileSync } from "fs";
import { expect, fresh, openTab, test } from "./helpers";

test("generate, change body plan, save, and export a sprite sheet with a clip row", async ({ page }) => {
  await fresh(page);
  // A keyed clip to export as a row
  const mo = await openTab(page, "rig");
  await mo.getByRole("button", { name: "Key", exact: true }).click();
  const track = (await mo.getByRole("slider", { name: "Rig playhead" }).boundingBox())!;
  await page.mouse.click(track.x + track.width / 2, track.y + 10);
  await mo.getByRole("tab", { name: "Pose" }).click();
  await mo.getByRole("button", { name: "Action" }).click();
  await mo.getByRole("tab", { name: "Clips" }).click();
  await mo.locator("#clip-name").fill("Big Kick");
  await mo.getByRole("button", { name: "Save clip" }).click();

  const ch = await openTab(page, "characters");
  await ch.getByRole("button", { name: /Surprise me/i }).click();
  await ch.getByRole("tab", { name: "Parts" }).click();
  await ch.getByRole("radio", { name: "Four legs", exact: true }).click();
  await ch.getByRole("button", { name: /Save to project|Save as new/ }).first().click();
  await ch.getByRole("tab", { name: "Export", exact: true }).click();
  await ch.getByRole("button", { name: "Big Kick" }).click();
  await ch.getByRole("button", { name: /sprite sheet/i }).click();
  await expect(ch.getByText(/px sheet/)).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), ch.getByRole("button", { name: "Atlas JSON only" }).click()]);
  const atlas = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(Object.keys(atlas.animations)).toEqual(["idle", "walk", "run", "jump", "attack", "big-kick"]);
  expect(atlas.meta.zhart.bodyPlan).toBe("quadruped");
  expect(atlas.animations["big-kick"].length).toBeGreaterThan(5);
});

test("each body plan renders in the forge preview", async ({ page }) => {
  await fresh(page);
  const ch = await openTab(page, "characters");
  await ch.getByRole("tab", { name: "Parts" }).click();
  for (const plan of ["Two legs", "Four legs", "Flyer", "Serpent", "Floater"]) {
    await ch.getByRole("radio", { name: plan, exact: true }).click();
    const shapes = await ch.locator("figure svg path, figure svg line").count();
    expect(shapes, plan).toBeGreaterThan(10);
  }
});
