import { useCallback, useEffect, useRef, useState } from "react";
import type { MusicPreset, Storyboard, VisualPreset } from "../types";
import { INITIAL_PROMPT } from "../lib/presets";
import { useVideoRender } from "../lib/useVideoRender";
import { usePlayback } from "./storyboard/usePlayback";

export interface ServerStatus {
  gemini: boolean;
  huggingFace: boolean;
}

/** Shared studio state: the current storyboard and everything that edits it. */
export function useStudio() {
  const [prompt, setPrompt] = useState(INITIAL_PROMPT);
  const [style, setStyle] = useState<VisualPreset>("cinema");
  const [music, setMusic] = useState<MusicPreset>("ambient");
  const [storyboard, setStoryboardState] = useState<Storyboard | null>(null);
  const [history, setHistory] = useState<Storyboard[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);

  // Per-scene image backdrops (Hugging Face)
  const [backdrops, setBackdrops] = useState<Record<number, string>>({});
  const [hfPrompt, setHfPrompt] = useState("");
  const [hfModel, setHfModel] = useState("black-forest-labs/FLUX.1-schnell");
  const [isHfGenerating, setIsHfGenerating] = useState(false);
  const [hfStatus, setHfStatus] = useState<{ tone: "info" | "warn" | "error"; text: string } | null>(null);

  const playback = usePlayback(storyboard);
  const veo = useVideoRender();
  const [veoPrompt, setVeoPrompt] = useState("");

  const promptRef = useRef(prompt);
  promptRef.current = prompt;

  const adopt = useCallback(
    (board: Storyboard) => {
      setStoryboardState(board);
      playback.load(board);
      setBackdrops({});
      setWarningDismissed(false);
    },
    [playback.load],
  );

  const generate = useCallback(
    async (opts: { template?: boolean } = {}) => {
      setIsGenerating(true);
      setGenerateError("");
      veo.reset();
      try {
        const res = await fetch("/api/generate-storyboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: opts.template ? INITIAL_PROMPT : promptRef.current,
            style,
            musicVibe: music,
            skipAI: Boolean(opts.template),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `The server answered ${res.status}.`);
        }
        const board: Storyboard = await res.json();
        adopt(board);
        setHistory((prev) => [board, ...prev.filter((p) => p.title !== board.title)].slice(0, 6));
      } catch (err: any) {
        setGenerateError(err?.message || "Couldn't reach the server.");
      } finally {
        setIsGenerating(false);
      }
    },
    [style, music, adopt, veo.reset],
  );

  // First load: a built-in template, so the stage is never empty
  useEffect(() => {
    generate({ template: true });
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : null))
      .then(setServerStatus)
      .catch(() => setServerStatus(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Replace the storyboard after an edit (reorder, duration change, template). */
  const setStoryboard = useCallback((board: Storyboard | null) => {
    setStoryboardState(board);
  }, []);

  const restore = useCallback(
    (board: Storyboard) => {
      veo.reset();
      adopt(board);
    },
    [adopt, veo.reset],
  );

  const sceneIndex = playback.sceneIndex;

  const generateBackdrop = useCallback(async () => {
    const text = hfPrompt.trim() || storyboard?.scenes[sceneIndex]?.visualDescription || "";
    if (!text) {
      setHfStatus({ tone: "error", text: "Write a backdrop prompt first." });
      return;
    }
    setIsHfGenerating(true);
    setHfStatus(null);
    try {
      const res = await fetch("/api/generate-hf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, modelId: hfModel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Image generation failed.");
      if (!data.imageUrl) throw new Error("The server returned no image.");
      setBackdrops((prev) => ({ ...prev, [sceneIndex]: data.imageUrl }));
      setHfStatus(
        data.isFallback
          ? { tone: "warn", text: data.message || "A placeholder image was used." }
          : { tone: "info", text: `Backdrop set for scene ${sceneIndex + 1}.` },
      );
    } catch (err: any) {
      setHfStatus({ tone: "error", text: err?.message || "Image generation failed." });
    } finally {
      setIsHfGenerating(false);
    }
  }, [hfPrompt, hfModel, storyboard, sceneIndex]);

  const clearBackdrop = useCallback(() => {
    setBackdrops((prev) => {
      const next = { ...prev };
      delete next[sceneIndex];
      return next;
    });
    setHfStatus(null);
  }, [sceneIndex]);

  const startVeo = useCallback(() => {
    if (!storyboard) return;
    const scenes = storyboard.scenes.map((s) => s.visualDescription).join(" Then: ");
    const text = `${promptRef.current}. ${scenes} Visual style: ${style}, cinematic lighting, smooth camera motion.`;
    setVeoPrompt(text);
    veo.start("/api/generate-video", { prompt: text, aspectRatio: "16:9", resolution: "720p" });
  }, [storyboard, style, veo.start]);

  return {
    prompt,
    setPrompt,
    style,
    setStyle,
    music,
    setMusic,
    storyboard,
    setStoryboard,
    history,
    restore,
    isGenerating,
    generate,
    generateError,
    warning: warningDismissed ? undefined : storyboard?.warning,
    dismissWarning: () => setWarningDismissed(true),
    serverStatus,
    playback,
    backdrops,
    hfPrompt,
    setHfPrompt,
    hfModel,
    setHfModel,
    isHfGenerating,
    hfStatus,
    generateBackdrop,
    clearBackdrop,
    veo,
    veoPrompt,
    startVeo,
  };
}

export type Studio = ReturnType<typeof useStudio>;
