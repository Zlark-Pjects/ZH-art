import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MusicPreset, Storyboard, VisualPreset } from "../types";
import { STYLE_PALETTES, applyPalette, buildStoryboard } from "../project/builder";
import { useProject } from "../project/useProject";
import { usePlayback } from "./storyboard/usePlayback";
import { loadSong } from "../lib/music";
import { sampleBoard, type SampleFilm } from "../project/samples";

/**
 * The whole studio: the shared project (autosaved), playback, and the
 * offline storyboard builder. Every tab gets this one object.
 */
export function useStudio() {
  const project = useProject();
  const { board, music } = project.project;

  // Decode the music track's song once its audio has loaded from storage
  const [song, setSong] = useState<{ assetId: string; buffer: AudioBuffer } | null>(null);
  const [songError, setSongError] = useState("");
  const songData = music ? project.assets[music.assetId] : undefined;
  useEffect(() => {
    if (!music || !songData) return;
    if (song?.assetId === music.assetId) return;
    let cancelled = false;
    setSongError("");
    loadSong(music.assetId, songData)
      .then((buffer) => !cancelled && setSong({ assetId: music.assetId, buffer }))
      .catch(() => !cancelled && setSongError("This browser couldn't play the song on the music track."));
    return () => {
      cancelled = true;
    };
  }, [music?.assetId, songData, song?.assetId]);
  const songBuffer = music && song?.assetId === music.assetId ? song.buffer : null;

  const playback = usePlayback(board, {
    score: !music || music.withScore,
    song: music && songBuffer ? { buffer: songBuffer, offset: music.offset, volume: music.volume } : null,
  });

  // Builder settings (inputs for "Build storyboard")
  const [style, setStyle] = useState<VisualPreset>((board.visualStyle as VisualPreset) || "cinema");
  const [sceneCount, setSceneCount] = useState(Math.min(6, Math.max(3, board.scenes.length)));
  const [seed, setSeed] = useState(0);
  const undoRef = useRef<Storyboard | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  // Keep builder inputs in step when another project is opened
  const projectId = project.project.id;
  useEffect(() => {
    setStyle((board.visualStyle as VisualPreset) || "cinema");
    setSceneCount(Math.min(6, Math.max(3, board.scenes.length)));
    undoRef.current = null;
    setCanUndo(false);
    playback.load(board);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const mood = board.musicVibe as MusicPreset;
  const setMood = useCallback((m: MusicPreset) => project.patchBoard({ musicVibe: m }), [project.patchBoard]);

  /** Compose a new storyboard from the prompt. Keeps characters, clips and grade. */
  const build = useCallback(
    (opts: { reroll?: boolean } = {}) => {
      const nextSeed = opts.reroll ? seed + 1 : seed;
      if (opts.reroll) setSeed(nextSeed);
      const next = buildStoryboard({ idea: project.project.prompt, style, mood, sceneCount, seed: nextSeed });
      undoRef.current = board;
      setCanUndo(true);
      project.setBoard(next);
      playback.load(next);
    },
    [seed, project.project.prompt, project.setBoard, style, mood, sceneCount, board, playback.load],
  );

  const undoBuild = useCallback(() => {
    if (!undoRef.current) return;
    project.setBoard(undoRef.current);
    playback.load(undoRef.current);
    undoRef.current = null;
    setCanUndo(false);
  }, [project.setBoard, playback.load]);

  /** Replace the scenes with a hand-made sample film (undoable). */
  const openSample = useCallback(
    (film: SampleFilm) => {
      const next = sampleBoard(film);
      undoRef.current = board;
      setCanUndo(true);
      setStyle(film.visualStyle);
      project.setPrompt(film.prompt);
      project.setBoard(next);
      playback.load(next);
    },
    [board, project.setBoard, project.setPrompt, playback.load],
  );

  /** Recolour the current scenes with the selected style's palette, keeping everything else. */
  const applyStyle = useCallback(() => {
    undoRef.current = board;
    setCanUndo(true);
    project.setBoard(applyPalette(board, STYLE_PALETTES[style], style));
  }, [board, style, project.setBoard]);

  const backdrops = useMemo(() => {
    const out: Record<number, string> = {};
    board.scenes.forEach((s, i) => {
      if (s.backdrop && project.assets[s.backdrop]) out[i] = project.assets[s.backdrop];
    });
    return out;
  }, [board.scenes, project.assets]);

  return {
    ...project,
    board,
    playback,
    style,
    setStyle,
    mood,
    setMood,
    sceneCount,
    setSceneCount,
    build,
    undoBuild,
    canUndo,
    applyStyle,
    openSample,
    backdrops,
    songBuffer,
    songError,
  };
}

export type Studio = ReturnType<typeof useStudio>;
