import type { Project } from "../types";

/*
 * Persistence for studio projects.
 * - Project JSON lives in localStorage (small, synchronous).
 * - Uploaded images live in IndexedDB as data URLs, keyed by asset id.
 * Every call tolerates storage being unavailable (private mode, blocked
 * site data): the studio keeps working in memory, it just won't persist.
 */

const INDEX_KEY = "zh-art:projects";
const PROJECT_KEY = (id: string) => `zh-art:project:${id}`;
const LAST_KEY = "zh-art:last-project";

export interface ProjectSummary {
  id: string;
  title: string;
  updatedAt: number;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function listProjects(): ProjectSummary[] {
  return (readJson<ProjectSummary[]>(INDEX_KEY) ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadProject(id: string): Project | null {
  return readJson<Project>(PROJECT_KEY(id));
}

export function lastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

/** Returns false when the browser refused to store it (quota or blocked). */
export function saveProject(project: Project): boolean {
  const ok = writeJson(PROJECT_KEY(project.id), project);
  if (!ok) return false;
  const index = listProjects().filter((p) => p.id !== project.id);
  index.unshift({ id: project.id, title: project.board.title, updatedAt: project.updatedAt });
  writeJson(INDEX_KEY, index);
  try {
    localStorage.setItem(LAST_KEY, project.id);
  } catch {
    /* ignore */
  }
  return true;
}

export function deleteProject(id: string) {
  try {
    localStorage.removeItem(PROJECT_KEY(id));
  } catch {
    /* ignore */
  }
  writeJson(INDEX_KEY, listProjects().filter((p) => p.id !== id));
}

/* ---------- Image assets (IndexedDB) ---------- */

const DB_NAME = "zh-art";
const STORE = "assets";
let dbPromise: Promise<IDBDatabase | null> | null = null;

function db(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const database = await db();
  if (!database) return null;
  return new Promise((resolve) => {
    try {
      const req = run(database.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export const putAsset = (id: string, dataUrl: string) => tx("readwrite", (s) => s.put(dataUrl, id));
export const getAsset = (id: string) => tx<string | undefined>("readonly", (s) => s.get(id)).then((v) => v ?? null);
export const deleteAsset = (id: string) => tx("readwrite", (s) => s.delete(id));

export function newId(prefix: string) {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

/** Read an image file as a data URL, downscaled so projects stay a sensible size. */
export function readImageFile(file: File, maxSide = 1920): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("That file isn't an image."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't open that image."));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
