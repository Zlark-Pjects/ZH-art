import { useCallback, useEffect, useRef, useState } from "react";
import { synth } from "../../lib/synth";
import { playSong, setSongVolume, stopSong } from "../../lib/music";
import type { ScaleName } from "../../lib/presets";
import type { Storyboard } from "../../types";

export interface PlaybackAudio {
  /** Play the generated score */
  score: boolean;
  /** A song on the music track, once decoded */
  song: { buffer: AudioBuffer; offset: number; volume: number } | null;
}

/**
 * Drives storyboard playback: the film clock (requestAnimationFrame), the
 * procedural score and the music track. Tempo and scale apply live; seeking,
 * jumping scenes and looping keep the song in sync with the picture.
 */
export function usePlayback(storyboard: Storyboard | null, audio: PlaybackAudio) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [bpm, setBpm] = useState(100);
  const [scale, setScale] = useState<ScaleName>("pentatonic");
  const [sceneIndex, setSceneIndexState] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const storyboardRef = useRef(storyboard);
  storyboardRef.current = storyboard;
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const sceneIndexRef = useRef(sceneIndex);
  sceneIndexRef.current = sceneIndex;
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  /** Local scene time to resume from when the clock restarts */
  const resumeRef = useRef(0);
  const lastPaintRef = useRef(0);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;
  const playingRef = useRef(false);

  const sceneCount = storyboard?.scenes.length ?? 0;
  const safeSceneIndex = sceneCount ? Math.min(sceneIndex, sceneCount - 1) : 0;

  useEffect(() => synth.updateBpm(bpm), [bpm]);
  useEffect(() => synth.setScale(scale), [scale]);

  const filmTime = (index: number, local: number) =>
    (storyboardRef.current?.scenes.slice(0, index).reduce((sum, s) => sum + s.duration, 0) ?? 0) + local;

  /** (Re)start the song so it lines up with film time `t`. */
  const syncSong = useCallback((t: number) => {
    const song = audioRef.current.song;
    if (!song || !playingRef.current) return stopSong();
    playSong(song.buffer, song.offset + t, song.volume);
  }, []);

  // Switching the mood while playing swaps the score without stopping the picture
  const vibe = storyboard?.musicVibe;
  const liveRef = useRef({ bpm, scale });
  liveRef.current = { bpm, scale };
  useEffect(() => {
    if (playingRef.current && vibe && audioRef.current.score) synth.start(vibe, liveRef.current.scale, liveRef.current.bpm);
  }, [vibe]);

  // Turning the score on or off while playing
  useEffect(() => {
    if (!playingRef.current) return;
    const board = storyboardRef.current;
    if (audio.score && board) synth.start(board.musicVibe, liveRef.current.scale, liveRef.current.bpm);
    else synth.stop();
  }, [audio.score]);

  // A new song, or a new start point in it, while playing
  const songBuffer = audio.song?.buffer;
  const songOffset = audio.song?.offset;
  useEffect(() => {
    if (playingRef.current) syncSong(filmTime(sceneIndexRef.current, elapsedRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songBuffer, songOffset, syncSong]);
  const songVolume = audio.song?.volume;
  useEffect(() => {
    if (songVolume !== undefined) setSongVolume(songVolume);
  }, [songVolume]);

  const stop = useCallback(() => {
    playingRef.current = false;
    setIsPlaying(false);
    synth.stop();
    stopSong();
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const tick = useCallback((timestamp: number) => {
    const board = storyboardRef.current;
    if (!board || board.scenes.length === 0) return;
    if (startRef.current === null) startRef.current = timestamp - resumeRef.current * 1000;
    const index = Math.min(sceneIndexRef.current, board.scenes.length - 1);
    const scene = board.scenes[index];
    const sceneElapsed = (timestamp - startRef.current) / 1000;

    if (sceneElapsed >= scene.duration) {
      startRef.current = timestamp;
      const next = (index + 1) % board.scenes.length;
      sceneIndexRef.current = next;
      setSceneIndexState(next);
      setElapsed(0);
      elapsedRef.current = 0;
      // Looping back to the top restarts the song with the picture
      if (next === 0) syncSong(0);
    } else if (timestamp - lastPaintRef.current > 33) {
      // ~30 fps is plenty for camera interpolation and keeps re-renders cheap
      lastPaintRef.current = timestamp;
      setElapsed(sceneElapsed);
    }
    frameRef.current = requestAnimationFrame(tick);
  }, [syncSong]);

  const restartClock = useCallback((local: number) => {
    resumeRef.current = local;
    startRef.current = null;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const play = useCallback(() => {
    const board = storyboardRef.current;
    if (!board) return;
    playingRef.current = true;
    setIsPlaying(true);
    synth.init();
    if (audioRef.current.score) synth.start(board.musicVibe, scale, bpm);
    synth.setMute(isMuted);
    syncSong(filmTime(sceneIndexRef.current, elapsedRef.current));
    restartClock(elapsedRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, scale, isMuted, restartClock, syncSong]);

  const toggle = useCallback(() => (playingRef.current ? stop() : play()), [play, stop]);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => {
      synth.setMute(!m);
      return !m;
    });
  }, []);

  /** Jump to a point in the film (seconds from the start). */
  const seek = useCallback((t: number) => {
    const board = storyboardRef.current;
    if (!board?.scenes.length) return;
    let index = 0;
    let rest = Math.max(0, t);
    while (index < board.scenes.length - 1 && rest >= board.scenes[index].duration) {
      rest -= board.scenes[index].duration;
      index++;
    }
    const local = Math.min(rest, board.scenes[index].duration - 0.001);
    sceneIndexRef.current = index;
    setSceneIndexState(index);
    setElapsed(local);
    elapsedRef.current = local;
    if (playingRef.current) {
      syncSong(filmTime(index, local));
      restartClock(local);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartClock, syncSong]);

  const setSceneIndex = useCallback((index: number) => {
    sceneIndexRef.current = index;
    setSceneIndexState(index);
    setElapsed(0);
    elapsedRef.current = 0;
    if (playingRef.current) {
      syncSong(filmTime(index, 0));
      restartClock(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartClock, syncSong]);

  /** Load a new storyboard: stop playback, rewind and adopt its tempo/scale. */
  const load = useCallback((board: Storyboard) => {
    stop();
    sceneIndexRef.current = 0;
    setSceneIndexState(0);
    setElapsed(0);
    elapsedRef.current = 0;
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
    seek,
    elapsed,
    sequenceElapsed,
    sequenceDuration,
    load,
  };
}

export type Playback = ReturnType<typeof usePlayback>;
