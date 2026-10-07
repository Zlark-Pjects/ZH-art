import { expect, fresh, openTab, test } from "./helpers";

test("key two poses with easing, save, load and cast the clip", async ({ page }) => {
  await fresh(page);
  const mo = await openTab(page, "rig");
  await mo.getByRole("button", { name: "Key", exact: true }).click();
  const track = (await mo.getByRole("slider", { name: "Rig playhead" }).boundingBox())!;
  await page.mouse.click(track.x + track.width * 0.5, track.y + 10);
  const hand = (await mo.locator('circle[aria-label="L hand"]').boundingBox())!;
  await page.mouse.move(hand.x + hand.width / 2, hand.y + hand.height / 2);
  await page.mouse.down();
  await page.mouse.move(hand.x, hand.y - 150, { steps: 6 });
  await page.mouse.up();
  await expect(mo.locator('[aria-label^="Key "][aria-label*="seconds"]')).toHaveCount(2);

  await mo.getByRole("tab", { name: "Keys" }).click();
  await mo.getByRole("radio", { name: "Overshoot" }).click();
  await mo.getByRole("tab", { name: "Clips" }).click();
  await mo.locator("#clip-name").fill("Wave hello");
  await mo.getByRole("button", { name: "Save clip" }).click();
  await expect(mo.getByText(/Saved “Wave hello”/)).toBeVisible();

  const sb = await openTab(page, "storyboard");
  await sb.getByRole("tab", { name: "Scene" }).click();
  await sb.getByRole("button", { name: /Add a character/ }).click();
  await sb.locator("select").filter({ hasText: "Wave hello" }).first().selectOption({ label: "Wave hello" });
  await expect(sb.locator('svg[role=img] g[transform*="translate(-200"]')).toHaveCount(1);
});

test("a character that isn't two-legged follows the skeleton", async ({ page }) => {
  await fresh(page);
  const ch = await openTab(page, "characters");
  await ch.getByRole("tab", { name: "Parts" }).click();
  await ch.getByRole("radio", { name: "Flyer", exact: true }).click();
  await ch.getByRole("button", { name: /Save to project|Save as new/ }).first().click();
  const mo = await openTab(page, "rig");
  await mo.locator("#mo-char").selectOption({ index: 1 });
  await expect(mo.getByText(/isn't two-legged, so it follows the skeleton/)).toBeVisible();
  // The inset preview draws the flyer
  await expect(mo.locator('svg g[transform^="translate(470"] path').first()).toBeVisible();
});

test("video capture offers a file picker", async ({ page }) => {
  await fresh(page);
  const mo = await openTab(page, "rig");
  await mo.getByRole("tab", { name: "Capture" }).click();
  await mo.getByRole("radio", { name: "Video file" }).click();
  await expect(mo.getByRole("button", { name: "Choose a video" })).toBeVisible();
});
