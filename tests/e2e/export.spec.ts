import { readFileSync } from "fs";
import { expect, fresh, openTab, test } from "./helpers";

test("exports a short film to a real video file", async ({ page }) => {
  test.setTimeout(150_000);
  await fresh(page);
  // A 4-second film keeps the test quick
  await page.evaluate(() => {
    const id = localStorage.getItem("zh-art:last-project")!;
    const p = JSON.parse(localStorage.getItem(`zh-art:project:${id}`)!);
    p.board.scenes = p.board.scenes.slice(0, 2).map((s: { duration: number }) => ({ ...s, duration: 2 }));
    p.texts = [{ id: "t1", text: "The end", start: 2.5, duration: 1.5, animation: "pop", font: "display", position: "middle", size: "m", box: false }];
    localStorage.setItem(`zh-art:project:${id}`, JSON.stringify(p));
  });
  await page.reload();
  const ex = await openTab(page, "export");
  await ex.getByRole("radio", { name: "720p" }).click();
  await ex.getByRole("button", { name: "Record video" }).click();
  const download = ex.getByRole("button", { name: /Download ·/ });
  await expect(download).toBeVisible({ timeout: 120_000 });
  const [file] = await Promise.all([page.waitForEvent("download"), download.click()]);
  const bytes = readFileSync((await file.path())!);
  expect(bytes.length).toBeGreaterThan(20_000);
  const isWebm = bytes.readUInt32BE(0) === 0x1a45dfa3;
  const isMp4 = bytes.toString("latin1", 4, 8) === "ftyp";
  expect(isWebm || isMp4).toBe(true);
  expect(file.suggestedFilename()).toMatch(isMp4 ? /\.mp4$/ : /\.webm$/);
});
