"use client";

// The pages you opened, newest first (this browser only): the note switcher and "side by side"
// pick from them. Read from storage each time (a short list, read when the switcher opens): a copy
// kept in memory would outlive signing out (src/lib/offline/device.ts, forgetDevice, here or in
// another tab) and bring the account's pages back with the next page opened.

const KEY = "blob-recent-pages";
const MAX = 20;

function load(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function store(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
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
