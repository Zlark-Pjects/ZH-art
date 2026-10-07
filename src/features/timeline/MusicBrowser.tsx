import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Pause, Play, Plus, Search } from "lucide-react";
import { LICENSE_LABEL, OpenverseError, creditFor, downloadTrack, searchMusic, type FreeTrack } from "../../lib/openverse";
import { Button, Chip, Notice, cx, inputClass } from "../../ui";

const MOODS = ["cinematic", "ambient", "piano", "electronic", "lofi", "epic", "acoustic", "chiptune"];

const mmss = (s?: number) => (s === undefined ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);

/**
 * Search free Creative Commons music and put a track on the music track.
 * Previews stream from the source; "Use" downloads the track, finds its
 * beat and saves its credit with the project.
 */
export function MusicBrowser({ onUse, busy }: { onUse: (file: File, track: FreeTrack) => Promise<boolean>; busy: boolean }) {
  const [query, setQuery] = useState("");
  const [commercial, setCommercial] = useState(true);
  const [tracks, setTracks] = useState<FreeTrack[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [rowError, setRowError] = useState<{ id: string; message: string; url: string } | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      audioRef.current?.pause();
    },
    [],
  );

  const run = async (q: string, nextPage = 1) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    setError("");
    setRowError(null);
    try {
      const out = await searchMusic(q, { page: nextPage, commercial, signal: controller.signal });
      setTracks((prev) => (nextPage === 1 ? out.tracks : [...prev, ...out.tracks]));
      setPage(nextPage);
      setPages(out.pages);
      if (nextPage === 1 && !out.tracks.length) setError(`Nothing found for “${q}”. Try a mood or a genre.`);
    } catch (err: any) {
      if (err?.name !== "AbortError") setError(err instanceof OpenverseError ? err.message : "Search failed. Try again.");
    } finally {
      if (abortRef.current === controller) setSearching(false);
    }
  };

  const togglePreview = (t: FreeTrack) => {
    const audio = audioRef.current ?? (audioRef.current = new Audio());
    if (playing === t.id) {
      audio.pause();
      setPlaying(null);
      return;
    }
    audio.pause();
    audio.src = t.url;
    audio.onended = () => setPlaying(null);
    audio.onerror = () => {
      setPlaying(null);
      setRowError({ id: t.id, message: "This preview won't play here.", url: t.sourceUrl });
    };
    audio.play().then(
      () => setPlaying(t.id),
      () => setPlaying(null),
    );
  };

  const use = async (t: FreeTrack) => {
    audioRef.current?.pause();
    setPlaying(null);
    setRowError(null);
    setAdding(t.id);
    try {
      const file = await downloadTrack(t);
      await onUse(file, t);
    } catch (err: any) {
      setRowError({ id: t.id, message: err instanceof OpenverseError ? err.message : "Couldn't add this track.", url: t.sourceUrl });
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
        className="flex gap-2"
      >
        <label htmlFor="fm-q" className="sr-only">
          Search free music
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
          <input id="fm-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mood, genre or instrument…" className={cx(inputClass, "pl-9")} />
        </div>
        <Button type="submit" loading={searching && page === 1}>
          Search
        </Button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {MOODS.map((m) => (
          <Chip
            key={m}
            onClick={() => {
              setQuery(m);
              run(m);
            }}
          >
            {m}
          </Chip>
        ))}
      </div>
      <label className="flex items-center justify-between gap-4 text-[13px] text-fg">
        <span>
          Only music I can use commercially
          <span className="block text-xs text-faint">Off also shows non-commercial (NC) licences</span>
        </span>
        <input type="checkbox" checked={commercial} onChange={(e) => setCommercial(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
      </label>

      {error && <Notice tone="error">{error}</Notice>}

      {tracks.length > 0 && (
        <ul className="flex flex-col divide-y divide-line border-y border-line" aria-label="Free music results">
          {tracks.map((t) => (
            <li key={t.id} className="py-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => togglePreview(t)}
                  aria-label={playing === t.id ? `Stop preview of ${t.title}` : `Preview ${t.title}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-fg hover:border-fg/50"
                >
                  {playing === t.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-fg">{t.title}</p>
                  <p className="truncate text-xs text-faint">
                    {t.creator} · {LICENSE_LABEL(t)}
                    {t.duration ? ` · ${mmss(t.duration)}` : ""} · {t.provider}
                  </p>
                </div>
                <Button size="sm" variant="secondary" icon={adding === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} disabled={busy || adding !== null} onClick={() => use(t)} aria-label={`Use ${t.title}`}>
                  Use
                </Button>
              </div>
              {rowError?.id === t.id && (
                <p className="mt-2 text-xs leading-relaxed text-danger">
                  {rowError.message}{" "}
                  <a href={rowError.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                    Open its page <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {tracks.length > 0 && page < pages && (
        <Button size="sm" variant="ghost" className="self-start" loading={searching && page > 0} onClick={() => run(query, page + 1)}>
          More results
        </Button>
      )}
      <p className="text-xs leading-relaxed text-faint">
        From <a href="https://openverse.org" target="_blank" rel="noreferrer" className="underline underline-offset-2">Openverse</a>: Creative Commons and public-domain music. Tracks that forbid changes (ND) are never shown, since putting music to video counts as a change. Credit the artist when you share your film; the credit is saved with the song.
      </p>
    </div>
  );
}
