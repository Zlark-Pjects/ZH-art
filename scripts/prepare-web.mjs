// Puts the single-file game into docs/ for GitHub Pages, with what an iPhone needs to
// add it to the Home Screen as an app: a manifest, and a service worker so it opens offline.
import { copyFileSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

mkdirSync("docs", { recursive: true });
copyFileSync("dist-stickville/stickville.html", "docs/index.html");
writeFileSync("docs/.nojekyll", "");
writeFileSync(
  "docs/manifest.webmanifest",
  JSON.stringify(
    {
      name: "Stickville City",
      short_name: "Stickville",
      start_url: "./",
      scope: "./",
      display: "standalone",
      background_color: "#08080a",
      theme_color: "#08080a",
      icons: [
        { src: "icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    null,
    2,
  ) + "\n",
);
// A new build gets a new cache name, so phones pick up the update next time they're online
const version = createHash("sha256").update(readFileSync("docs/index.html")).digest("hex").slice(0, 12);
writeFileSync(
  "docs/sw.js",
  `// Network first, so updates arrive; the saved copy is used when there's no internet.
const CACHE = "stickville-${version}";
const FILES = ["./", "./manifest.webmanifest", "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok && (new URL(e.request.url).origin === location.origin || e.request.url.includes("fonts.g"))) {
          const copy = r.clone();
          void caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("./"))),
  );
});
`,
);
console.log("docs/ ready for GitHub Pages");
