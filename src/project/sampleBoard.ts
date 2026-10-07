import type { Storyboard } from "../types";
import type { SampleFilm } from "./samples";

export function sampleBoard(film: SampleFilm): Storyboard {
  const v = film.musicVibe;
  return {
    title: film.name,
    summary: film.description,
    visualStyle: film.visualStyle,
    musicVibe: v,
    tempoBpm: v === "synthwave" ? 120 : v === "chiptune" ? 140 : 80,
    scale: v === "synthwave" ? "minor" : v === "chiptune" ? "phrygian" : "pentatonic",
    scenes: film.scenes.map((s, i) => ({ ...s, sceneNumber: i + 1, transition: i === 0 ? "cut" : "fade" })),
  };
}
