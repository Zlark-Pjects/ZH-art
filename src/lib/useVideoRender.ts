import { useCallback, useEffect, useRef, useState } from "react";

export type VideoRenderStatus = "idle" | "requesting" | "rendering" | "completed" | "error";

const POLL_INTERVAL_MS = 5000;
// Veo jobs regularly take several minutes; give up only well after that.
const TIMEOUT_MS = 10 * 60 * 1000;
const MAX_CONSECUTIVE_POLL_FAILURES = 3;

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

async function postJson(url: string, body: unknown, signal: AbortSignal) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

async function readError(res: Response, fallback: string) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Starts a Veo render through one of the server's video endpoints, polls it to
 * completion, downloads the result and exposes it as an object URL.
 * Polling is cancelled on unmount or when a new render starts, and the
 * previous object URL is revoked whenever it is replaced.
 */
export function useVideoRender() {
  const [status, setStatus] = useState<VideoRenderStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus("idle");
    setProgress(0);
    setUrl(null);
    setError("");
  }, []);

  const start = useCallback(async (endpoint: string, body: unknown) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;

    setStatus("requesting");
    setProgress(5);
    setUrl(null);
    setError("");

    try {
      const startRes = await postJson(endpoint, body, signal);
      if (!startRes.ok) {
        throw new Error(await readError(startRes, "The render request was refused."));
      }
      const startData = await startRes.json();
      if (startData.unavailable) {
        throw new Error(startData.message || "Video generation is not configured on this server.");
      }
      const operationName: string = startData.operationName;

      setStatus("rendering");
      setProgress(15);

      const startedAt = Date.now();
      let failures = 0;
      while (true) {
        await sleep(POLL_INTERVAL_MS, signal);
        const elapsed = Date.now() - startedAt;
        if (elapsed > TIMEOUT_MS) {
          throw new Error("The render is taking unusually long. Try again later.");
        }
        // Veo reports no progress, so show an estimate that eases toward 95%.
        setProgress(Math.round(15 + 80 * (1 - Math.exp(-elapsed / 90_000))));

        const statusRes = await postJson("/api/video-status", { operationName }, signal);
        if (!statusRes.ok) {
          failures++;
          if (failures >= MAX_CONSECUTIVE_POLL_FAILURES) {
            throw new Error(await readError(statusRes, "Checking the render status failed."));
          }
          continue;
        }
        failures = 0;
        const statusData = await statusRes.json();
        if (statusData.error) throw new Error(statusData.error);
        if (statusData.done) break;
      }

      const downloadRes = await postJson("/api/video-download", { operationName }, signal);
      if (!downloadRes.ok) {
        throw new Error(await readError(downloadRes, "Downloading the finished video failed."));
      }
      const blob = await downloadRes.blob();
      setUrl(URL.createObjectURL(blob));
      setProgress(100);
      setStatus("completed");
    } catch (err: any) {
      if (signal.aborted) return;
      setError(err?.message || "The render failed.");
      setStatus("error");
    }
  }, []);

  return { status, progress, url, error, start, reset };
}
