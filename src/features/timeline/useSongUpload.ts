import { useCallback, useState } from "react";
import type { Studio } from "../useStudio";
import { analyseSong, readSong } from "../../lib/music";

/** Pick a song file, find its beats and put it on the music track. */
export function useSongUpload(studio: Studio) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      setError("");
      try {
        const { dataUrl, buffer } = await readSong(file);
        // Let the busy state paint before the synchronous analysis
        await new Promise((r) => setTimeout(r, 30));
        const a = analyseSong(buffer);
        studio.playback.stop();
        await studio.addMusic(dataUrl, {
          name: file.name.replace(/\.[^.]+$/, ""),
          duration: a.duration,
          offset: 0,
          volume: 0.9,
          bpm: a.bpm,
          beats: a.beats,
          peaks: a.peaks,
          withScore: false,
        });
      } catch (err: any) {
        setError(err?.message || "Couldn't add that song.");
      } finally {
        setBusy(false);
      }
    },
    [studio],
  );

  return { upload, busy, error, setError };
}
