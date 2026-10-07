import { expect, fresh, openTab, test } from "./helpers";

test("every tab and rail panel opens without errors", async ({ page, errors }) => {
  await fresh(page);
  const sb = await openTab(page, "storyboard");
  for (const tab of ["Build", "Scene", "Text", "Sound"]) {
    await sb.getByRole("tab", { name: tab, exact: true }).click();
    await expect(sb.getByRole("tab", { name: tab, exact: true })).toHaveAttribute("aria-selected", "true");
  }
  const looks = await openTab(page, "looks");
  await expect(looks.getByText("Film grade")).toBeVisible();
  const ch = await openTab(page, "characters");
  for (const tab of ["Generate", "Parts", "Colours", "Export"]) await ch.getByRole("tab", { name: tab, exact: true }).click();
  const mo = await openTab(page, "rig");
  for (const tab of ["Pose", "Keys", "Capture", "Clips"]) await mo.getByRole("tab", { name: tab, exact: true }).click();
  const ex = await openTab(page, "export");
  await expect(ex.getByRole("button", { name: "Record video" })).toBeEnabled();
  await page.getByRole("button", { name: "Guide" }).click();
  await expect(page.getByRole("dialog")).toContainText("How it works");
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("the project autosaves and survives a reload", async ({ page }) => {
  await fresh(page);
  const sb = await openTab(page, "storyboard");
  await sb.locator("#sb-prompt").fill("A lighthouse keeper who collects lost radio signals");
  await sb.getByRole("button", { name: "Build storyboard" }).click();
  const title = await sb.locator('[aria-label^="Scene 1:"]').getAttribute("aria-label");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("#panel-storyboard #sb-prompt")).toHaveValue(/lighthouse keeper/);
  await expect(page.locator('#panel-storyboard [aria-label^="Scene 1:"]')).toHaveAttribute("aria-label", title!);
});

test("the film grade applies to the stage", async ({ page }) => {
  await fresh(page);
  const looks = await openTab(page, "looks");
  await looks.getByRole("radio", { name: "Noir" }).click();
  await openTab(page, "storyboard");
  const filter = await page.locator("#panel-storyboard svg[role=img]").first().evaluate((el) => (el as SVGElement).style.filter);
  expect(filter).toContain("saturate(0%)");
});
