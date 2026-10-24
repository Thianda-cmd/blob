"use client";

// The pages you opened, newest first (this browser only): the note switcher and "side by side"
// pick from them.

const KEY = "blob-recent-pages";
const MAX = 20;

let cache: string[] | null = null;

function load(): string[] {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function store(ids: string[]) {
  cache = ids.slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
}

export const recentPages = {
  list: load,
  visit(id: string) {
    const ids = load();
    if (ids[0] === id) return;
    store([id, ...ids.filter((x) => x !== id)]);
  },
  forget(id: string) {
    store(load().filter((x) => x !== id));
  },
};

/** The page id in a /p/<id> path (null elsewhere). */
export function pageIdOfPath(pathname: string | null): string | null {
  const m = pathname?.match(/^\/p\/([0-9a-f-]{36})(?:\/|$)/i);
  return m ? m[1] : null;
}
