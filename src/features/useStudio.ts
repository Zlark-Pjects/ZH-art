import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MusicPreset, Storyboard, VisualPreset } from "../types";
import { STYLE_PALETTES, applyPalette, buildStoryboard } from "../project/builder";
import { useProject } from "../project/useProject";
import { usePlayback } from "./storyboard/usePlayback";

/**
 * The whole studio: the shared project (autosaved), playback, and the
 * offline storyboard builder. Every tab gets this one object.
 */
export function useStudio() {
  const project = useProject();
  const { board } = project.project;
  const playback = usePlayback(board);

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
    backdrops,
  };
}

export type Studio = ReturnType<typeof useStudio>;
