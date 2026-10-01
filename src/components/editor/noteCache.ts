import type { JSONContent } from "@tiptap/core";
import type { Page } from "@/lib/types";

/**
 * What this tab last wrote for each note.
 *
 * Back/forward navigation restores the router's cached server props, which can be
 * older than what we just saved. Mounting the editor from those would show stale
 * content, and the next keystroke would overwrite the newer version. So we keep the
 * latest local copy and prefer it whenever it is unsaved or newer than the props.
 */
type Entry = {
  title?: string;
  content?: JSONContent;
  /** Bumped on every local edit. */
  version: number;
  /** Highest version confirmed by the server. */
  savedVersion: number;
  /** Server `updated_at` (ms) of that confirmed save. */
  savedAt: number;
};

const entries = new Map<string, Entry>();

export const noteCache = {
  touch(id: string, patch: { title?: string; content?: JSONContent }) {
    const prev = entries.get(id) ?? { version: 0, savedVersion: 0, savedAt: 0 };
    entries.set(id, { ...prev, ...patch, version: prev.version + 1 });
  },

  version(id: string) {
    return entries.get(id)?.version ?? 0;
  },

  saved(id: string, version: number, updatedAt: string | null | undefined) {
    const entry = entries.get(id);
    if (!entry) return;
    entry.savedVersion = Math.max(entry.savedVersion, version);
    const at = updatedAt ? Date.parse(updatedAt) : Date.now();
    if (!Number.isNaN(at)) entry.savedAt = Math.max(entry.savedAt, at);
  },

  freshest(page: Page): Page {
    const entry = entries.get(page.id);
    if (!entry) return page;
    const unsaved = entry.version > entry.savedVersion;
    const newer = entry.savedAt > Date.parse(page.updated_at);
    if (!unsaved && !newer) return page;
    return { ...page, title: entry.title ?? page.title, content: entry.content ?? page.content };
  },
};
