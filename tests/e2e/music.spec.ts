import { beatWav, expect, fresh, openTab, test } from "./helpers";

/*
 * The free music browser, against a stand-in for the Openverse API (same
 * response shape), so the test doesn't depend on the network.
 */
const result = (id: string, title: string, url: string, license = "by", source = "jamendo") => ({
  id,
  title,
  creator: "Test Artist",
  creator_url: "https://example.org/artist",
  url,
  foreign_landing_url: `https://example.org/track/${id}`,
  license,
  license_version: "4.0",
  license_url: `https://creativecommons.org/licenses/${license}/4.0/`,
  provider: source,
  source,
  duration: 12000,
  attribution: `"${title}" by Test Artist is licensed under CC ${license.toUpperCase()} 4.0.`,
  genres: ["cinematic"],
});

test("search free music, add a track with its credit, and handle a host that refuses downloads", async ({ page }) => {
  const queries: URL[] = [];
  await page.route("https://api.openverse.org/v1/audio/**", (route) => {
    queries.push(new URL(route.request().url()));
    return route.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({
        result_count: 3,
        page_count: 1,
        results: [
          result("1", "Moonlit Drift", "https://media.example.org/moonlit.wav"),
          result("2", "Locked Track", "https://locked.example.org/locked.mp3"),
          result("3", "No Changes Allowed", "https://media.example.org/nd.wav", "by-nd"),
        ],
      }),
    });
  });
  await page.route("https://media.example.org/**", (route) =>
    route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "audio/wav" }, body: beatWav() }),
  );
  // A host without CORS: the browser blocks the download
  await page.route("https://locked.example.org/**", (route) => route.abort("failed"));

  await fresh(page);
  const sb = await openTab(page, "storyboard");
  await sb.getByRole("tab", { name: "Sound" }).click();
  await sb.getByRole("button", { name: "cinematic" }).click();

  const results = sb.getByRole("list", { name: "Free music results" });
  await expect(results.getByRole("listitem")).toHaveCount(2); // the ND track is filtered out
  const q = queries[0];
  expect(q.searchParams.get("q")).toBe("cinematic");
  expect(q.searchParams.get("category")).toBe("music");
  expect(q.searchParams.get("license")!.split(",")).toEqual(["cc0", "pdm", "by", "by-sa"]);

  await results.getByRole("button", { name: "Use Locked Track" }).click();
  await expect(results.getByText(/doesn't let other sites download this track directly/)).toBeVisible();

  await results.getByRole("button", { name: "Use Moonlit Drift" }).click();
  await expect(sb.getByText(/Moonlit Drift — Test Artist · 1(19|20|21) bpm/).first()).toBeVisible({ timeout: 20_000 });
  await expect(sb.getByText(/Credit · CC BY 4.0/)).toBeVisible();

  const ex = await openTab(page, "export");
  await expect(ex.getByText(/licensed under CC BY 4.0/)).toBeVisible();

  // The credit is saved with the project
  await page.reload();
  await page.locator("#panel-storyboard").getByRole("tab", { name: "Sound" }).click();
  await expect(page.locator("#panel-storyboard").getByText(/Credit · CC BY 4.0/)).toBeVisible();
});

test("turning off commercial-only widens the licences searched", async ({ page }) => {
  let license = "";
  await page.route("https://api.openverse.org/v1/audio/**", (route) => {
    license = new URL(route.request().url()).searchParams.get("license") ?? "";
    return route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*" }, contentType: "application/json", body: JSON.stringify({ result_count: 0, page_count: 0, results: [] }) });
  });
  await fresh(page);
  const sb = await openTab(page, "storyboard");
  await sb.getByRole("tab", { name: "Sound" }).click();
  await sb.getByRole("checkbox", { name: /Only music I can use commercially/ }).uncheck();
  await sb.locator("#fm-q").fill("harp");
  await sb.getByRole("button", { name: "Search", exact: true }).click();
  await expect(sb.getByText(/Nothing found for “harp”/)).toBeVisible();
  expect(license.split(",")).toEqual(["cc0", "pdm", "by", "by-sa", "by-nc", "by-nc-sa"]);
});

test("a catalogue outage shows a clear message", async ({ page }) => {
  await page.route("https://api.openverse.org/v1/audio/**", (route) => route.fulfill({ status: 429, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await fresh(page);
  const sb = await openTab(page, "storyboard");
  await sb.getByRole("tab", { name: "Sound" }).click();
  await sb.getByRole("button", { name: "ambient" }).click();
  await expect(sb.getByText(/catalogue is busy/)).toBeVisible();
});
