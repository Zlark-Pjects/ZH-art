/* Stickville City on its own: the game without the film studio. Built into one HTML file
   (`npm run build:stickville`) for browsers, and wrapped as an Android app with Capacitor
   (`npm run build:android`), where it fills the whole screen. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CityView } from "./features/city/CityView";
import "./index.css";

const native = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
const app = native || new URLSearchParams(location.search).has("app");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {app ? (
      <CityView active fill />
    ) : (
      <main className="mx-auto max-w-[1280px] pb-10 pt-6 pl-[max(16px,env(safe-area-inset-left,0px))] pr-[max(16px,env(safe-area-inset-right,0px))]">
        <CityView active />
        <p className="eyebrow mt-6 text-faint">Stickville City · from ZH-art · runs entirely in your browser</p>
      </main>
    )}
  </StrictMode>,
);
