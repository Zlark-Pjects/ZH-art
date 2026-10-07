import { useCallback, useEffect, useRef, useState } from "react";
import { synth } from "../../lib/synth";
import type { ScaleName } from "../../lib/presets";
import type { Storyboard } from "../../types";

/**
 * Drives storyboard playback: the scene timeline (requestAnimationFrame) and
 * the procedural score. Tempo and scale apply live without restarting.
 */
export function usePlayback(storyboard: Storyboard | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [bpm, setBpm] = useState(100);
  const [scale, setScale] = useState<ScaleName>("pentatonic");
  const [sceneIndex, setSceneIndexState] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const storyboardRef = useRef(storyboard);
  storyboardRef.current = storyboard;
  const sceneIndexRef = useRef(sceneIndex);
  sceneIndexRef.current = sceneIndex;
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const lastPaintRef = useRef(0);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;

  const sceneCount = storyboard?.scenes.length ?? 0;
  const safeSceneIndex = sceneCount ? Math.min(sceneIndex, sceneCount - 1) : 0;

  useEffect(() => synth.updateBpm(bpm), [bpm]);
  useEffect(() => synth.setScale(scale), [scale]);

  const stop = useCallback(() => {
    setIsPlaying(false);
    synth.stop();
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const tick = useCallback((timestamp: number) => {
    const board = storyboardRef.current;
    if (!board || board.scenes.length === 0) return;
    if (startRef.current === null) startRef.current = timestamp;
    const index = Math.min(sceneIndexRef.current, board.scenes.length - 1);
    const scene = board.scenes[index];
    const sceneElapsed = (timestamp - startRef.current) / 1000;

    if (sceneElapsed >= scene.duration) {
      startRef.current = timestamp;
      const next = (index + 1) % board.scenes.length;
      sceneIndexRef.current = next;
      setSceneIndexState(next);
      setElapsed(0);
    } else if (timestamp - lastPaintRef.current > 33) {
      // ~30 fps is plenty for camera interpolation and keeps re-renders cheap
      lastPaintRef.current = timestamp;
      setElapsed(sceneElapsed);
    }
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const play = useCallback(() => {
    const board = storyboardRef.current;
    if (!board) return;
    setIsPlaying(true);
    synth.start(board.musicVibe, scale, bpm);
    synth.setMute(isMuted);
    frameRef.current = requestAnimationFrame((t) => {
      startRef.current = t - elapsedRef.current * 1000;
      tick(t);
    });
  }, [bpm, scale, isMuted, tick]);

  const toggle = useCallback(() => (isPlaying ? stop() : play()), [isPlaying, play, stop]);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => {
      synth.setMute(!m);
      return !m;
    });
  }, []);

  const setSceneIndex = useCallback((index: number) => {
    sceneIndexRef.current = index;
    setSceneIndexState(index);
    setElapsed(0);
    startRef.current = null;
    if (frameRef.current) {
      // Restart the scene clock on the next frame
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  /** Load a new storyboard: stop playback, rewind and adopt its tempo/scale. */
  const load = useCallback((board: Storyboard) => {
    stop();
    sceneIndexRef.current = 0;
    setSceneIndexState(0);
    setElapsed(0);
    setBpm(board.tempoBpm || 100);
    setScale((board.scale as ScaleName) || "pentatonic");
  }, [stop]);

  const sequenceElapsed = storyboard
    ? storyboard.scenes.slice(0, safeSceneIndex).reduce((sum, s) => sum + s.duration, 0) + elapsed
    : 0;
  const sequenceDuration = storyboard ? storyboard.scenes.reduce((sum, s) => sum + s.duration, 0) : 0;

  return {
    isPlaying,
    isMuted,
    toggle,
    stop,
    toggleMute,
    bpm,
    setBpm,
    scale,
    setScale,
    sceneIndex: safeSceneIndex,
    setSceneIndex,
    elapsed,
    sequenceElapsed,
    sequenceDuration,
    load,
  };
}

export type Playback = ReturnType<typeof usePlayback>;
