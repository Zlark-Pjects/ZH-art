// Informational CI check: does the real Openverse API answer as the free music
// browser expects, and which music hosts allow browsers to download tracks
// directly (CORS)? Tracks from hosts that don't get an "Open its page" fallback.
const API = "https://api.openverse.org/v1/audio/";
const queries = ["cinematic", "ambient", "piano", "electronic", "acoustic"];
const hosts = new Map();

for (const q of queries) {
  const params = new URLSearchParams({ q, category: "music", license: "cc0,pdm,by,by-sa", page_size: "20", mature: "false" });
  const res = await fetch(`${API}?${params}`, { headers: { Origin: "https://zh-art.example", Accept: "application/json" } });
  const cors = res.headers.get("access-control-allow-origin");
  if (!res.ok) {
    console.log(`search "${q}": HTTP ${res.status}`);
    continue;
  }
  const data = await res.json();
  console.log(`search "${q}": ${data.result_count} results, API CORS: ${cors ?? "none"}`);
  for (const r of data.results.slice(0, 8)) {
    const source = r.source || r.provider;
    let verdict;
    try {
      const f = await fetch(r.url, { headers: { Origin: "https://zh-art.example" }, redirect: "follow" });
      const allow = f.headers.get("access-control-allow-origin");
      verdict = f.ok && (allow === "*" || allow === "https://zh-art.example") ? "direct" : `blocked (HTTP ${f.status}, CORS ${allow ?? "none"})`;
      await f.body?.cancel();
    } catch (err) {
      verdict = `error (${err.message})`;
    }
    const h = hosts.get(source) ?? { direct: 0, other: 0, sample: "" };
    if (verdict === "direct") h.direct++;
    else {
      h.other++;
      h.sample = verdict;
    }
    hosts.set(source, h);
  }
}

console.log("\nDirect downloads by source:");
for (const [source, h] of hosts) console.log(`  ${source}: ${h.direct} direct, ${h.other} not${h.sample ? ` — e.g. ${h.sample}` : ""}`);
