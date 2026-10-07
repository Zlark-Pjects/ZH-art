import { expect, test as base, type Page } from "@playwright/test";

/** Every test fails on an uncaught page error or a console error. */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`);
    });
    await use(errors);
    expect(errors, "page errors").toEqual([]);
  },
});

export { expect };

/** Open the app on a fresh project, past the intro leader. */
export async function fresh(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    indexedDB.deleteDatabase("zh-art");
  });
  await page.reload();
  const skip = page.getByText(/click to skip/i);
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect(page.locator("#tab-storyboard")).toBeVisible();
}

export async function openTab(page: Page, id: "storyboard" | "looks" | "characters" | "rig" | "export") {
  await page.locator(`#tab-${id}`).click();
  await expect(page.locator(`#panel-${id}`)).toBeVisible();
  return page.locator(`#panel-${id}`);
}

/** A 120 bpm click track as a WAV file, for the music track. */
export function beatWav(seconds = 12, bpm = 120): Buffer {
  const rate = 22050;
  const n = rate * seconds;
  const data = Buffer.alloc(44 + n * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + n * 2, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(n * 2, 40);
  const step = 60 / bpm;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const since = (t - 0.2 + step) % step;
    let v = 0.06 * Math.sin(2 * Math.PI * 220 * t);
    if (since < 0.12) v += 0.8 * Math.sin(2 * Math.PI * (55 + 60 * Math.exp(-since * 30)) * since) * Math.exp(-since * 25);
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 30000))), 44 + i * 2);
  }
  return data;
}

/** Seek the storyboard playhead to a fraction of scene `n` (1-based). */
export async function seekScene(page: Page, n: number, fraction: number) {
  const panel = page.locator("#panel-storyboard");
  const ruler = await panel.getByRole("slider", { name: "Playhead" }).boundingBox();
  const block = await panel.locator(`[aria-label^="Scene ${n}:"]`).boundingBox();
  if (!ruler || !block) throw new Error("timeline not visible");
  await page.mouse.click(block.x + block.width * fraction, ruler.y + ruler.height / 2);
}
