import type { JSONContent } from "@tiptap/core";
import { getAll, write } from "@/lib/offline/idb";
import type { NoteCopy } from "@/lib/offline/notes";
import type { Page } from "@/lib/types";

/**
 * What this device last wrote for each note, kept in IndexedDB too (src/lib/offline/idb.ts), so
 * text written without a connection survives closing the app.
 *
 * Back/forward navigation (and pages opened offline from the app's cache) can hand the editor
 * older server props than what was written here. Mounting the editor from those would show stale
 * content, and the next keystroke would overwrite the newer version. So we keep the latest local
 * copy and prefer it whenever it is unsaved or newer than the props.
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
  /** The note's `rev` that the local text builds on (the server's after our last save). */
  baseRev?: number;
  /** The content of that save (what the server had when we last knew). */
  baseContent?: JSONContent;
  /** The title was changed here and not saved yet (otherwise saves leave the title alone). */
  titleEdited?: boolean;
};

type Stored = Entry & { id: string };

const entries = new Map<string, Entry>();
/** The server's notes as this device last fetched them (src/lib/offline/notes.ts). */
const copies = new Map<string, NoteCopy>();
let owner: string | null = null;
/** The device's copies are in memory (an editor must not start before, or it would miss them). */
let loaded: string | null = null;
/** Notes open in an editor on this page (their editor saves them). */
const open = new Map<string, number>();
/** The open editors' "save now" (signing out sends what they still hold first). */
const flushers = new Set<() => Promise<void>>();
let loading: Promise<void> | null = null;
const readyListeners = new Set<() => void>();

const asDoc = (content: unknown) => (content && typeof content === "object" ? (content as JSONContent) : null);

/** A note's unsaved text that no editor is saving (title only when it was changed here). */
export type Waiting = { id: string; title?: string; content?: JSONContent; version: number; baseRev?: number; baseContent?: JSONContent; copy?: NoteCopy };

/** Where an editor starts: the text, whether it came from this device, and what it builds on. */
export type Start = { page: Page; local: boolean; baseRev: number; baseContent: JSONContent | null };
const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Notes kept on the device besides those with unsaved text. */
const KEEP = 60;

function writeOut(user: string, id: string) {
  const entry = entries.get(id);
  void write(user, "notes", entry ? [{ id, ...entry }] : [], entry ? [] : [id]);
}

function persist(id: string) {
  if (!owner) return;
  const user = owner;
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      writeOut(user, id);
    }, 400),
  );
}

/** Writes what is still waiting for its timer right away (the app is being closed or hidden). */
function persistNow() {
  if (!owner) return;
  for (const [id, t] of timers) {
    clearTimeout(t);
    writeOut(owner, id);
  }
  timers.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", persistNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persistNow();
  });
}

export const noteCache = {
  /** The server's notes on the device (after they were brought up to date). */
  async loadCopies(userId: string) {
    const rows = await getAll<NoteCopy>(userId, "pages");
    copies.clear();
    for (const r of rows) copies.set(r.id, r);
  },

  /** Loads this device's copies for the signed-in account (once per page). */
  load(userId: string): Promise<void> {
    if (owner === userId && loading) return loading;
    owner = userId;
    loading = noteCache.loadEntries(userId).finally(() => {
      loaded = userId;
      readyListeners.forEach((fn) => fn());
    });
    return loading;
  },

  /** Whether an editor may start (the device's copies are in memory). */
  isReady(userId: string) {
    return loaded === userId;
  },

  onReady(fn: () => void) {
    readyListeners.add(fn);
    return () => {
      readyListeners.delete(fn);
    };
  },

  async loadEntries(userId: string) {
    await noteCache.loadCopies(userId);
    const stored = (await getAll<Stored>(userId, "notes")).filter((s) => !s.id.includes(":"));
    // Saved copies only help for a while: the newest few stay, unsaved ones always.
    const saved = stored.filter((s) => s.version <= s.savedVersion).sort((a, b) => b.savedAt - a.savedAt);
    const drop = new Set(saved.slice(KEEP).map((s) => s.id));
    if (drop.size) void write(userId, "notes", [], [...drop]);
    for (const { id, ...entry } of stored) {
      if (drop.has(id)) continue;
      const cur = entries.get(id);
      // This tab's own edits (made before the device copies arrived) win.
      if (!cur || cur.version === 0) entries.set(id, entry);
    }
  },

  touch(id: string, patch: { title?: string; content?: JSONContent }) {
    const prev = entries.get(id) ?? { version: 0, savedVersion: 0, savedAt: 0 };
    entries.set(id, { ...prev, ...patch, version: prev.version + 1, titleEdited: prev.titleEdited || patch.title !== undefined });
    persist(id);
  },

  /** The title was changed on this device and isn't saved yet. */
  titleEdited(id: string) {
    const entry = entries.get(id);
    return !!entry?.titleEdited && entry.version > entry.savedVersion;
  },

  /** What this device last saved of the note (its `rev` and text), whichever editor or job saved it. */
  base(id: string): { rev?: number; content?: JSONContent } | null {
    const entry = entries.get(id);
    return entry ? { rev: entry.baseRev, content: entry.baseContent } : null;
  },

  /** An editor has the note open. */
  isOpen(id: string) {
    return open.has(id);
  },

  version(id: string) {
    return entries.get(id)?.version ?? 0;
  },

  saved(id: string, version: number, updatedAt: string | null | undefined, after?: { rev?: number; content?: JSONContent }) {
    const entry = entries.get(id) ?? { version, savedVersion: 0, savedAt: 0 };
    entry.savedVersion = Math.max(entry.savedVersion, version);
    const at = updatedAt ? Date.parse(updatedAt) : Date.now();
    if (!Number.isNaN(at)) entry.savedAt = Math.max(entry.savedAt, at);
    if (after?.rev !== undefined) entry.baseRev = after.rev;
    if (after?.content) entry.baseContent = after.content;
    if (entry.savedVersion >= entry.version) entry.titleEdited = false;
    entries.set(id, entry);
    persist(id);
  },

  /** Local text not yet saved. */
  unsaved(id: string) {
    const entry = entries.get(id);
    return !!entry && entry.version > entry.savedVersion;
  },

  /** The editor starts from the server's text: remember what it builds on. */
  startFrom(page: Page) {
    const entry = entries.get(page.id);
    if (entry && entry.version > entry.savedVersion) return;
    const content = page.content && typeof page.content === "object" ? (page.content as JSONContent) : undefined;
    entries.set(page.id, { version: entry?.version ?? 0, savedVersion: entry?.version ?? 0, savedAt: Math.max(entry?.savedAt ?? 0, Date.parse(page.updated_at) || 0), baseRev: page.rev, baseContent: content, title: page.title, content });
    persist(page.id);
  },

  /** Forget the local copy (it was kept elsewhere, or replaced by the server's). */
  forget(id: string) {
    entries.delete(id);
    persist(id);
  },

  /**
   * Where an editor for `page` starts: the newest the server had as far as this device knows (the
   * props, or the device's copy when that is newer, e.g. a page opened offline from the app's
   * cache), with this device's unsaved (or newer) text on top.
   */
  startOf(page: Page): Start {
    let server = page;
    const copy = copies.get(page.id);
    if (copy && Date.parse(copy.updated_at) > Date.parse(page.updated_at)) {
      server = { ...page, title: copy.title, content: copy.content, plain_text: copy.plain_text ?? "", rev: copy.rev, doc_version: copy.doc_version, updated_at: copy.updated_at };
    }
    const fromServer: Start = { page: server, local: server !== page, baseRev: server.rev, baseContent: asDoc(server.content) };
    const entry = entries.get(page.id);
    if (!entry) return fromServer;
    const unsaved = entry.version > entry.savedVersion;
    const newer = entry.savedAt > Date.parse(server.updated_at);
    if (!unsaved && !newer) return fromServer;
    return {
      page: { ...server, title: entry.title ?? server.title, content: entry.content ?? server.content },
      local: true,
      baseRev: entry.baseRev ?? server.rev,
      baseContent: entry.baseContent ?? asDoc(server.content),
    };
  },

  /** An editor has the note open (and saves it itself). */
  opened(id: string) {
    open.set(id, (open.get(id) ?? 0) + 1);
    return () => {
      const n = (open.get(id) ?? 1) - 1;
      if (n > 0) open.set(id, n);
      else open.delete(id);
    };
  },

  /** An open editor's "save now"; returns the function that removes it. */
  addFlusher(fn: () => Promise<void>) {
    flushers.add(fn);
    return () => {
      flushers.delete(fn);
    };
  },

  /** Has every open editor save what it holds now. */
  async flushOpen() {
    await Promise.all([...flushers].map((fn) => fn().catch(() => {})));
  },

  /** Notes with text this device hasn't saved yet (open or not). */
  unsavedCount() {
    let n = 0;
    for (const e of entries.values()) if (e.version > e.savedVersion) n++;
    return n;
  },

  /** Notes with text written on this device that isn't saved, and no editor open to save it. */
  waiting(): Waiting[] {
    const out: Waiting[] = [];
    for (const id of entries.keys()) {
      const w = noteCache.waitingOne(id);
      if (w) out.push(w);
    }
    return out;
  },

  /** The note's unsaved text as it is now, if it is still waiting (no editor has it open). */
  waitingOne(id: string): Waiting | null {
    const e = entries.get(id);
    if (!e || e.version <= e.savedVersion || open.has(id)) return null;
    return { id, title: e.titleEdited ? e.title : undefined, content: e.content, version: e.version, baseRev: e.baseRev, baseContent: e.baseContent, copy: copies.get(id) };
  },

  /** Signing out: nothing stays in memory either. */
  reset() {
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
    entries.clear();
    copies.clear();
    owner = null;
    loaded = null;
    loading = null;
  },

  freshest(page: Page): Page {
    return noteCache.startOf(page).page;
  },
};
