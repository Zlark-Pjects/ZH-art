import { useCallback, useState } from "react";
import type { MusicCredit } from "../../types";
import type { Studio } from "../useStudio";
import { analyseSong, readSong } from "../../lib/music";

/** Take a song file (picked, or downloaded from the free music browser), find its beats and put it on the music track. */
export function useSongUpload(studio: Studio) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = useCallback(
    async (file: File, credit?: MusicCredit): Promise<boolean> => {
      setBusy(true);
      setError("");
      try {
        const { dataUrl, buffer } = await readSong(file);
        // Let the busy state paint before the synchronous analysis
        await new Promise((r) => setTimeout(r, 30));
        const a = analyseSong(buffer);
        studio.playback.stop();
        await studio.addMusic(dataUrl, {
          name: credit ? `${credit.title} — ${credit.creator}` : file.name.replace(/\.[^.]+$/, ""),
          duration: a.duration,
          offset: 0,
          volume: 0.9,
          bpm: a.bpm,
          beats: a.beats,
          peaks: a.peaks,
          withScore: false,
          credit,
        });
        return true;
      } catch (err: any) {
        setError(err?.message || "Couldn't add that song.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [studio],
  );

  return { upload, busy, error, setError };
}
