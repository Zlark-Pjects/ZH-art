import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CharacterLook, Grade, MusicTrack, Project, RigClip, Scene, Storyboard, TextClip } from "../types";
import { buildStoryboard } from "./builder";
import { DEFAULT_CHARACTER, DEFAULT_CLIP, GRADE_PRESETS } from "./rig";
import {
  deleteAsset,
  deleteProject,
  getAsset,
  lastProjectId,
  listProjects,
  loadProject,
  newId,
  putAsset,
  readImageFile,
  saveProject,
  type ProjectSummary,
} from "./storage";
import { saveFile } from "../lib/saveFile";

export const STARTER_IDEA = "Astronaut fishing for stars on a crescent moon";

export function newProject(board?: Storyboard, prompt = STARTER_IDEA): Project {
  const now = Date.now();
  return {
    id: newId("proj"),
    version: 1,
    prompt,
    board: board ?? buildStoryboard({ idea: prompt, style: "cinema", mood: "ambient", sceneCount: 4, seed: 0 }),
    characters: [DEFAULT_CHARACTER],
    clips: [DEFAULT_CLIP],
    grade: GRADE_PRESETS.none,
    createdAt: now,
    updatedAt: now,
  };
}

function initialProject(): Project {
  const last = lastProjectId();
  return (last && loadProject(last)) || newProject();
}

const renumber = (scenes: Scene[]) => scenes.map((s, i) => ({ ...s, sceneNumber: i + 1 }));

export type SaveState = "saved" | "saving" | "unsaved";

/** The one project every part of the studio reads and edits. Autosaves. */
export function useProject() {
  const [project, setProject] = useState<Project>(initialProject);
  const [projects, setProjects] = useState<ProjectSummary[]>(listProjects);
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const firstRender = useRef(true);

  /* ----- autosave ----- */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      saveProject(project);
      setProjects(listProjects());
      return;
    }
    setSaveState("saving");
    const timer = setTimeout(() => {
      const ok = saveProject(project);
      setSaveState(ok ? "saved" : "unsaved");
      setProjects(listProjects());
    }, 400);
    return () => clearTimeout(timer);
  }, [project]);

  // Save straight away when the page is hidden or closed, so the last edit isn't lost
  const latest = useRef(project);
  latest.current = project;
  useEffect(() => {
    const flush = () => saveProject(latest.current);
    const onHide = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  /* ----- load image assets referenced by scenes ----- */
  const assetIds = useMemo(
    () => [...project.board.scenes.map((s) => s.backdrop), project.music?.assetId].filter((id): id is string => Boolean(id)),
    [project.board.scenes, project.music?.assetId],
  );
  useEffect(() => {
    const missing = assetIds.filter((id) => !(id in assets));
    if (!missing.length) return;
    let cancelled = false;
    Promise.all(missing.map(async (id) => [id, await getAsset(id)] as const)).then((pairs) => {
      if (cancelled) return;
      setAssets((prev) => ({ ...prev, ...Object.fromEntries(pairs.filter(([, v]) => v) as [string, string][]) }));
    });
    return () => {
      cancelled = true;
    };
  }, [assetIds, assets]);

  const update = useCallback((fn: (p: Project) => Project) => {
    setProject((p) => ({ ...fn(p), updatedAt: Date.now() }));
  }, []);

  /* ----- storyboard ----- */
  const setBoard = useCallback((board: Storyboard) => update((p) => ({ ...p, board: { ...board, scenes: renumber(board.scenes) } })), [update]);
  const patchBoard = useCallback((patch: Partial<Storyboard>) => update((p) => ({ ...p, board: { ...p.board, ...patch } })), [update]);
  const setPrompt = useCallback((prompt: string) => update((p) => ({ ...p, prompt })), [update]);

  const updateScene = useCallback(
    (index: number, patch: Partial<Scene> | ((s: Scene) => Scene)) =>
      update((p) => ({
        ...p,
        board: {
          ...p.board,
          scenes: p.board.scenes.map((s, i) => (i === index ? (typeof patch === "function" ? patch(s) : { ...s, ...patch }) : s)),
        },
      })),
    [update],
  );

  const insertScene = useCallback(
    (index: number, scene: Scene) =>
      update((p) => {
        const scenes = [...p.board.scenes];
        scenes.splice(index, 0, scene);
        return { ...p, board: { ...p.board, scenes: renumber(scenes) } };
      }),
    [update],
  );

  const removeScene = useCallback(
    (index: number) =>
      update((p) =>
        p.board.scenes.length <= 1 ? p : { ...p, board: { ...p.board, scenes: renumber(p.board.scenes.filter((_, i) => i !== index)) } },
      ),
    [update],
  );

  const moveScene = useCallback(
    (from: number, to: number) =>
      update((p) => {
        const scenes = [...p.board.scenes];
        const [s] = scenes.splice(from, 1);
        scenes.splice(Math.max(0, Math.min(scenes.length, to)), 0, s);
        return { ...p, board: { ...p.board, scenes: renumber(scenes) } };
      }),
    [update],
  );

  /* ----- backdrops ----- */
  const setBackdrop = useCallback(
    async (index: number, file: File) => {
      const dataUrl = await readImageFile(file);
      const id = newId("img");
      await putAsset(id, dataUrl);
      setAssets((prev) => ({ ...prev, [id]: dataUrl }));
      updateScene(index, { backdrop: id });
    },
    [updateScene],
  );
  const clearBackdrop = useCallback((index: number) => updateScene(index, { backdrop: undefined }), [updateScene]);

  /* ----- characters, clips, grade ----- */
  const upsertCharacter = useCallback(
    (c: CharacterLook) => update((p) => ({ ...p, characters: p.characters.some((x) => x.id === c.id) ? p.characters.map((x) => (x.id === c.id ? c : x)) : [...p.characters, c] })),
    [update],
  );
  const removeCharacter = useCallback(
    (id: string) =>
      update((p) => ({
        ...p,
        characters: p.characters.filter((c) => c.id !== id),
        board: { ...p.board, scenes: p.board.scenes.map((s) => ({ ...s, cast: s.cast?.filter((m) => m.characterId !== id) })) },
      })),
    [update],
  );
  const upsertClip = useCallback(
    (c: RigClip) => update((p) => ({ ...p, clips: p.clips.some((x) => x.id === c.id) ? p.clips.map((x) => (x.id === c.id ? c : x)) : [...p.clips, c] })),
    [update],
  );
  const removeClip = useCallback(
    (id: string) =>
      update((p) => ({
        ...p,
        clips: p.clips.filter((c) => c.id !== id),
        board: { ...p.board, scenes: p.board.scenes.map((s) => ({ ...s, cast: s.cast?.filter((m) => m.clipId !== id) })) },
      })),
    [update],
  );
  const setGrade = useCallback((grade: Grade) => update((p) => ({ ...p, grade })), [update]);

  /* ----- timeline: durations, text, music ----- */
  const setDurations = useCallback(
    (durations: number[]) =>
      update((p) => ({ ...p, board: { ...p.board, scenes: p.board.scenes.map((s, i) => (durations[i] ? { ...s, duration: durations[i] } : s)) } })),
    [update],
  );
  const upsertText = useCallback(
    (t: TextClip) => update((p) => {
      const texts = p.texts ?? [];
      return { ...p, texts: texts.some((x) => x.id === t.id) ? texts.map((x) => (x.id === t.id ? t : x)) : [...texts, t] };
    }),
    [update],
  );
  const removeText = useCallback((id: string) => update((p) => ({ ...p, texts: (p.texts ?? []).filter((t) => t.id !== id) })), [update]);
  const setTitleCards = useCallback((on: boolean) => update((p) => ({ ...p, titleCards: on })), [update]);

  /** Store a song's audio and put it on the music track (replacing any previous song). */
  const addMusic = useCallback(
    async (dataUrl: string, track: Omit<MusicTrack, "assetId">) => {
      const id = newId("song");
      await putAsset(id, dataUrl);
      setAssets((prev) => ({ ...prev, [id]: dataUrl }));
      update((p) => {
        if (p.music?.assetId) deleteAsset(p.music.assetId);
        return { ...p, music: { ...track, assetId: id } };
      });
    },
    [update],
  );
  const patchMusic = useCallback((patch: Partial<MusicTrack>) => update((p) => (p.music ? { ...p, music: { ...p.music, ...patch } } : p)), [update]);
  const removeMusic = useCallback(
    () =>
      update((p) => {
        if (p.music?.assetId) deleteAsset(p.music.assetId);
        return { ...p, music: null };
      }),
    [update],
  );

  /* ----- project management ----- */
  const open = useCallback((id: string) => {
    const p = loadProject(id);
    if (p) {
      firstRender.current = true;
      setProject(p);
      setSaveState("saved");
    }
  }, []);

  const create = useCallback((board?: Storyboard, prompt?: string) => {
    const p = newProject(board, prompt);
    firstRender.current = true;
    setProject(p);
    return p;
  }, []);

  const duplicate = useCallback(async () => {
    const copy: Project = { ...project, id: newId("proj"), board: { ...project.board, title: `${project.board.title} (copy)` }, createdAt: Date.now(), updatedAt: Date.now() };
    // The copy gets its own song, so removing it from one project can't break the other
    if (project.music) {
      const data = assets[project.music.assetId] ?? (await getAsset(project.music.assetId));
      if (data) {
        const id = newId("song");
        await putAsset(id, data);
        setAssets((prev) => ({ ...prev, [id]: data }));
        copy.music = { ...project.music, assetId: id };
      } else {
        copy.music = null;
      }
    }
    firstRender.current = true;
    setProject(copy);
  }, [project, assets]);

  const remove = useCallback(
    (id: string) => {
      const doomed = loadProject(id);
      doomed?.board.scenes.forEach((s) => s.backdrop && deleteAsset(s.backdrop));
      if (doomed?.music?.assetId) deleteAsset(doomed.music.assetId);
      deleteProject(id);
      const remaining = listProjects();
      setProjects(remaining);
      if (id === project.id) {
        const next = remaining[0] && loadProject(remaining[0].id);
        firstRender.current = true;
        setProject(next || newProject());
      }
    },
    [project.id],
  );

  /** Download the project, with its images embedded, as a .zhart.json file. */
  const exportFile = useCallback(async () => {
    const embedded: Record<string, string> = {};
    for (const id of assetIds) {
      const data = assets[id] ?? (await getAsset(id));
      if (data) embedded[id] = data;
    }
    const blob = new Blob([JSON.stringify({ format: "zh-art-project", project, assets: embedded })], { type: "application/json" });
    await saveFile(`${project.board.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "project"}.zhart.json`, blob);
  }, [project, assets, assetIds]);

  const importFile = useCallback(async (file: File) => {
    const data = JSON.parse(await file.text());
    if (data?.format !== "zh-art-project" || !data.project?.board?.scenes) throw new Error("That isn't a ZH-art project file.");
    const imported: Project = { ...data.project, id: newId("proj"), updatedAt: Date.now() };
    const files: Record<string, string> = { ...(data.assets ?? {}) };
    // Songs get a fresh id so this copy and any original never share (and delete) one file
    if (imported.music?.assetId && files[imported.music.assetId]) {
      const id = newId("song");
      files[id] = files[imported.music.assetId];
      delete files[imported.music.assetId];
      imported.music = { ...imported.music, assetId: id };
    }
    for (const [id, url] of Object.entries<string>(files)) await putAsset(id, url);
    setAssets((prev) => ({ ...prev, ...files }));
    firstRender.current = true;
    setProject(imported);
  }, []);

  return {
    project,
    projects,
    saveState,
    assets,
    setBoard,
    patchBoard,
    setPrompt,
    updateScene,
    insertScene,
    removeScene,
    moveScene,
    setBackdrop,
    clearBackdrop,
    upsertCharacter,
    removeCharacter,
    upsertClip,
    removeClip,
    setGrade,
    setDurations,
    upsertText,
    removeText,
    setTitleCards,
    addMusic,
    patchMusic,
    removeMusic,
    open,
    create,
    duplicate,
    remove,
    exportFile,
    importFile,
  };
}

export type ProjectApi = ReturnType<typeof useProject>;
