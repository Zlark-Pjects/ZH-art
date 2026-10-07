import type { MusicCredit } from "../types";

/*
 * Free music from Openverse (https://openverse.org), a public catalogue of
 * Creative Commons and public-domain audio from Jamendo, ccMixter, Freesound,
 * Wikimedia and others. No account or key is needed.
 *
 * Only licences that allow adapting the work are offered, because putting
 * music to video counts as an adaptation under Creative Commons; "no
 * derivatives" (ND) tracks are never shown. Non-commercial (NC) licences are
 * optional.
 */

const API = "https://api.openverse.org/v1/audio/";

export interface FreeTrack {
  id: string;
  title: string;
  creator: string;
  creatorUrl?: string;
  /** Direct audio file */
  url: string;
  /** The track's page at its source */
  sourceUrl: string;
  provider: string;
  license: string;
  licenseVersion: string;
  licenseUrl: string;
  /** Seconds, when known */
  duration?: number;
  attribution: string;
  genres: string[];
  fileSize?: number;
}

export const LICENSES_COMMERCIAL = ["cc0", "pdm", "by", "by-sa"];
export const LICENSES_ANY_USE = [...LICENSES_COMMERCIAL, "by-nc", "by-nc-sa"];

export const LICENSE_LABEL = (t: Pick<FreeTrack, "license" | "licenseVersion">) =>
  t.license === "cc0" ? "CC0 (public domain)" : t.license === "pdm" ? "Public domain" : `CC ${t.license.toUpperCase()} ${t.licenseVersion}`.trim();

export class OpenverseError extends Error {}

const PROVIDER_NAMES: Record<string, string> = {
  jamendo: "Jamendo",
  ccmixter: "ccMixter",
  freesound: "Freesound",
  wikimedia_audio: "Wikimedia Commons",
  wikimedia: "Wikimedia Commons",
  europeana: "Europeana",
};
const providerName = (id: string) => PROVIDER_NAMES[id] ?? id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Search for music. Pages start at 1. */
export async function searchMusic(query: string, opts: { page?: number; commercial: boolean; signal?: AbortSignal }): Promise<{ tracks: FreeTrack[]; pages: number }> {
  const params = new URLSearchParams({
    q: query.trim() || "music",
    category: "music",
    license: (opts.commercial ? LICENSES_COMMERCIAL : LICENSES_ANY_USE).join(","),
    page: String(opts.page ?? 1),
    page_size: "20",
    mature: "false",
  });
  let res: Response;
  try {
    res = await fetch(`${API}?${params}`, { signal: opts.signal, headers: { Accept: "application/json" } });
  } catch (err: any) {
    if (err?.name === "AbortError") throw err;
    throw new OpenverseError("Couldn't reach the free music catalogue. Check your connection, or try again in a moment.");
  }
  if (res.status === 429) throw new OpenverseError("The free music catalogue is busy (too many searches). Wait a minute and try again.");
  if (!res.ok) throw new OpenverseError(`The free music catalogue answered with an error (${res.status}). Try again in a moment.`);
  const data = await res.json();
  const tracks: FreeTrack[] = (data.results ?? [])
    .filter((r: any) => r.url && r.license && !String(r.license).includes("nd"))
    .map((r: any) => ({
      id: String(r.id),
      title: r.title || "Untitled",
      creator: r.creator || "Unknown artist",
      creatorUrl: r.creator_url || undefined,
      url: r.url,
      sourceUrl: r.foreign_landing_url || r.url,
      provider: providerName(String(r.source || r.provider || "Openverse")),
      license: String(r.license),
      licenseVersion: String(r.license_version ?? ""),
      licenseUrl: r.license_url || "https://creativecommons.org/licenses/",
      duration: typeof r.duration === "number" ? r.duration / 1000 : undefined,
      attribution: r.attribution || "",
      genres: Array.isArray(r.genres) ? r.genres : [],
      fileSize: typeof r.filesize === "number" ? r.filesize : undefined,
    }));
  return { tracks, pages: Number(data.page_count) || 1 };
}

export function creditFor(t: FreeTrack): MusicCredit {
  const license = LICENSE_LABEL(t);
  return {
    title: t.title,
    creator: t.creator,
    creatorUrl: t.creatorUrl,
    license,
    licenseUrl: t.licenseUrl,
    sourceUrl: t.sourceUrl,
    provider: t.provider,
    attribution: t.attribution || `“${t.title}” by ${t.creator}, ${license} (${t.licenseUrl}), via ${t.provider}: ${t.sourceUrl}`,
  };
}

/** Download a track's audio as a File, ready for the music track. */
export async function downloadTrack(t: FreeTrack, signal?: AbortSignal): Promise<File> {
  let res: Response;
  try {
    res = await fetch(t.url, { signal, mode: "cors" });
  } catch (err: any) {
    if (err?.name === "AbortError") throw err;
    // Almost always the host refusing cross-site downloads (CORS)
    throw new OpenverseError(`${t.provider} doesn't let other sites download this track directly. Open its page, download it there, then add the file with “Add a song”.`);
  }
  if (!res.ok) throw new OpenverseError(`Couldn't download this track (${res.status}). Try another one.`);
  const blob = await res.blob();
  const ext = /mpeg|mp3/.test(blob.type) ? "mp3" : /ogg/.test(blob.type) ? "ogg" : /wav/.test(blob.type) ? "wav" : /flac/.test(blob.type) ? "flac" : "mp3";
  return new File([blob], `${t.title}.${ext}`, { type: blob.type.startsWith("audio/") ? blob.type : `audio/${ext === "mp3" ? "mpeg" : ext}` });
}
