/* Stickville on its own: the game without the film studio, for the single-file browser build
   (`npm run build:stickville`). */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GameView } from "./features/game/GameView";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main className="mx-auto max-w-[1280px] pb-10 pt-6 pl-[max(16px,env(safe-area-inset-left,0px))] pr-[max(16px,env(safe-area-inset-right,0px))]">
      <GameView active />
      <p className="eyebrow mt-6 text-faint">Stickville · from ZH-art · runs entirely in your browser</p>
    </main>
  </StrictMode>,
);
