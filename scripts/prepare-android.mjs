// The Android app's web files: the single-file game as index.html (Capacitor loads index.html).
import { copyFileSync, mkdirSync, rmSync } from "node:fs";

rmSync("dist-android", { recursive: true, force: true });
mkdirSync("dist-android", { recursive: true });
copyFileSync("dist-stickville/stickville.html", "dist-android/index.html");
console.log("dist-android/index.html ready");
