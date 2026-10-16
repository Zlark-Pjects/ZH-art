// Inline the standalone game's JS and CSS into dist-stickville/stickville.html, so the game is
// one self-contained file (fonts still come from Google Fonts, with system fallbacks).
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const dir = "dist-stickville";
const file = join(dir, "stickville.html");
let html = readFileSync(file, "utf8");
const used = [];

html = html.replace(/<script type="module" crossorigin src="\/([^"]+)"><\/script>/g, (_, src) => {
  used.push(src);
  const js = readFileSync(join(dir, src), "utf8").replace(/<\/script/gi, "<\\/script");
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="\/([^"]+)">/g, (_, href) => {
  used.push(href);
  return `<style>${readFileSync(join(dir, href), "utf8")}</style>`;
});
if (!used.some((u) => u.endsWith(".js"))) throw new Error("no script found to inline");
writeFileSync(file, html);
rmSync(join(dir, "assets"), { recursive: true, force: true });
console.log(`${file}: ${(html.length / 1024).toFixed(0)} kB, inlined ${used.join(", ")}`);
