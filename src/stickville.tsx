/* Stickville on its own: the Battle Royale (the main game) and the open city, without the
   film studio. Built into one HTML file (`npm run build:stickville`) for browsers, wrapped as an
   Android app with Capacitor (`npm run build:android`), and put in docs/ for GitHub Pages
   (`npm run build:web`) where it can be added to an iPhone's Home Screen as an app. */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { BattleView } from "./features/battle/BattleView";
import { CityView } from "./features/city/CityView";
import "./index.css";

const native = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
// Added to an iPhone's (or Android's) Home Screen, the page opens without browser bars
const homeScreen = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches;
const params = new URLSearchParams(location.search);
const app = native || homeScreen || params.has("app");

// On the web host, keep a copy so the Home Screen app opens without internet
if (!native && location.protocol === "https:" && "serviceWorker" in navigator && document.querySelector('link[rel="manifest"]')) {
  void navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function Root() {
  const [mode, setMode] = useState<"battle" | "city">(params.get("mode") === "city" ? "city" : "battle");
  if (mode === "battle") return <BattleView onCity={() => setMode("city")} />;
  const back = (
    <button type="button" onClick={() => setMode("battle")} className="rounded-full bg-black/60 px-3 py-1 text-[11px] text-white">
      ← Battle Royale
    </button>
  );
  if (app)
    return (
      <>
        <CityView active fill />
        <div className="fixed left-1/2 top-[max(4px,env(safe-area-inset-top))] z-50 -translate-x-1/2">{back}</div>
      </>
    );
  return (
    <main className="mx-auto max-w-[1280px] pb-10 pt-6 pl-[max(16px,env(safe-area-inset-left,0px))] pr-[max(16px,env(safe-area-inset-right,0px))]">
      <div className="mb-3">{back}</div>
      <CityView active />
      <p className="eyebrow mt-6 text-faint">Stickville City · from ZH-art · runs entirely in your browser</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
