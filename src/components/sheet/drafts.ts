"use client";

// Unsaved spreadsheet work kept on this device, so nothing typed is lost: no connection, the app
// closed or killed before the save went out, a save the server refused. A draft holds what the
// editor had (`mine`) and the server's version it was based on (`base`, at revision `rev`), so the
// next time it is merged with whatever the server has by then (src/sheet/collab.ts) instead of
// overwriting someone else's changes.
//
// Each open editor keeps a draft of its own, under its own id (`writer`): two tabs of the same
// spreadsheet that are offline at once never write over each other's work. While its editor is
// open, a draft is that editor's. Once the editor has closed (or its tab has, or crashed), the draft
// is waiting: the next editor of the spreadsheet takes it over (SheetSaver.restore) or the
// background save sends it (flushDrafts.ts), one taker at a time, and the taker removes it. Which
// editors are open is known across tabs through Web Locks: each holds one while it is open.
//
// Where: localStorage first (it can be written while the page is closing), IndexedDB for drafts
// too big for it (the "meta" store of src/lib/offline/idb.ts). Signing out removes both
// (src/lib/offline/device.ts forgetDevice) and stops the editors open in every tab first, and
// another account signing in on this device removes them too (registerOffline). The key names the
// account, so another account never reads it.
//
// A draft the server refused for good (this account can't edit the page any more) is marked and
// stays until you decide (DeniedDrafts.tsx): kept as a spreadsheet of your own, or let go. Beside
// the drafts, each page keeps this device's last save that went through (readLastSave).
//
// This module stays light (no engine): the shell asks draftPages when it catches up, and only
// loads the saving code (flushDrafts.ts) when there is something to send.

import { getPrefix, setMeta, write } from "@/lib/offline/idb";
import type { Workbook } from "@/sheet/types";

export type SheetDraft = {
  v: 1;
  pageId: string;
  /** The editor that wrote it (each open editor has its own id). */
  writer: string;
  /** The server's revision `base` is. */
  rev: number;
  base: Workbook;
  mine: Workbook;
  baseTitle: string;
  title: string;
  /** When it was written (ms): the newer of two copies, and the order drafts are put back in. */
  at: number;
  /**
   * A save of this work that went out and got no answer (the connection dropped, the page was
   * closed): it may have landed. `id` is its save id (pages.save_ids); `title` and `wb` are what it
   * sent (no `wb`: the same as `mine`). If it landed, the draft's own changes start there.
   */
  sending?: { id: string; title: string; wb?: Workbook };
  /** The editor's last save that went through: the next save takes its place in pages.save_ids. */
  lastSave?: string;
  /**
   * The server said this account can't save the page any more (access gone, or the page is): the
   * background save leaves it alone, and Blob asks whether to keep the work as a spreadsheet of
   * your own or to let it go (DeniedDrafts.tsx). Until then it counts as unsaved (signing out).
   */
  denied?: boolean;
};

export const DRAFT_PREFIX = "blob-sheet-draft:";
const localKey = (userId: string, pageId: string, writer: string) => `${DRAFT_PREFIX}${userId}:${pageId}:${writer}`;
const metaKey = (pageId: string, writer: string) => `sheet-draft:${pageId}:${writer}`;

/** A random UUID (save ids are stored as uuid), also where crypto.randomUUID is missing (plain http). */
export function randomUuid(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** A new editor's id. */
export const newWriterId = () => randomUuid().replace(/-/g, "").slice(0, 12);

const isDraft = (x: unknown): x is SheetDraft => {
  const d = x as SheetDraft | null;
  return (
    !!d &&
    typeof d === "object" &&
    d.v === 1 &&
    typeof d.pageId === "string" &&
    typeof d.writer === "string" &&
    typeof d.rev === "number" &&
    !!d.base &&
    !!d.mine &&
    typeof d.at === "number" &&
    (d.sending === undefined || (typeof d.sending?.id === "string" && typeof d.sending.title === "string")) &&
    (d.denied === undefined || typeof d.denied === "boolean")
  );
};

/**
 * Keep an editor's draft (synchronously in localStorage when it fits, else in IndexedDB). Returns
 * false when neither could take it right away (IndexedDB is written in the background then).
 */
export function writeDraft(userId: string, draft: SheetDraft): boolean {
  if (!userId) return false;
  const key = localKey(userId, draft.pageId, draft.writer);
  try {
    localStorage.setItem(key, JSON.stringify(draft));
    // A bigger, older copy in IndexedDB isn't needed any more.
    void write(userId, "meta", [], [metaKey(draft.pageId, draft.writer)]);
    return true;
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage not available at all.
    }
    void setMeta(userId, metaKey(draft.pageId, draft.writer), draft);
    return false;
  }
}

/** Every draft of a page on this device (of each editor the newer copy, wherever it is kept), oldest first. */
export async function readDrafts(userId: string, pageId: string): Promise<SheetDraft[]> {
  if (!userId) return [];
  const byWriter = new Map<string, SheetDraft>();
  const take = (d: unknown) => {
    if (!isDraft(d) || d.pageId !== pageId) return;
    const had = byWriter.get(d.writer);
    if (!had || d.at > had.at) byWriter.set(d.writer, d);
  };
  const prefix = `${DRAFT_PREFIX}${userId}:${pageId}:`;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      try {
        take(JSON.parse(localStorage.getItem(key) ?? "null"));
      } catch {
        // A damaged copy: left out.
      }
    }
  } catch {
    // No storage.
  }
  try {
    for (const row of await getPrefix<{ key: string; value: unknown }>(userId, "meta", `sheet-draft:${pageId}:`)) take(row.value);
  } catch {
    // No database.
  }
  return [...byWriter.values()].sort((a, b) => a.at - b.at);
}

/** Forget an editor's draft (saved, or taken over by another editor). */
export function clearDraft(userId: string, pageId: string, writer: string) {
  if (!userId) return;
  try {
    localStorage.removeItem(localKey(userId, pageId, writer));
  } catch {
    // Nothing kept there.
  }
  void write(userId, "meta", [], [metaKey(pageId, writer)]);
}

/** Every page with a draft on this device. */
export async function draftPages(userId: string): Promise<string[]> {
  if (!userId) return [];
  const ids = new Set<string>();
  const prefix = `${DRAFT_PREFIX}${userId}:`;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) ids.add(key.slice(prefix.length).split(":")[0]);
    }
  } catch {
    // No storage.
  }
  try {
    for (const row of await getPrefix<{ key: string }>(userId, "meta", "sheet-draft:")) ids.add(row.key.slice("sheet-draft:".length).split(":")[0]);
  } catch {
    // No database.
  }
  return [...ids];
}

/**
 * Another account signed in on this device: drafts of every other account go (they stayed when a
 * session ended without signing out; their key names the account, so nobody else could use them),
 * and so do their last saves (readLastSave).
 */
export function forgetOtherAccounts(userId: string) {
  try {
    const others: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      for (const prefix of [DRAFT_PREFIX, LAST_SAVE_PREFIX]) if (key?.startsWith(prefix) && !key.startsWith(`${prefix}${userId}:`)) others.push(key);
    }
    for (const key of others) localStorage.removeItem(key);
  } catch {
    // No storage.
  }
}

/** Per account and page: this device's last save that went through (readLastSave). Signing out removes them (forgetDevice). */
export const LAST_SAVE_PREFIX = "blob-sheet-last-save:";
const lastSaveKey = (userId: string, pageId: string) => `${LAST_SAVE_PREFIX}${userId}:${pageId}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * This device's last save of the page that went through (its answer came), or null. A new editor
 * names it as the save its own first one replaces in pages.save_ids (save_sheet's p_last_save), so
 * a device keeps one place there however often the page is opened, and a save whose answer was lost
 * is still recognized there much later (SheetSaver.settle).
 */
export function readLastSave(userId: string, pageId: string): string | null {
  if (!userId) return null;
  try {
    const id = localStorage.getItem(lastSaveKey(userId, pageId));
    return id && UUID.test(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * A save of the page went through on this device, its answer came, and no draft here still names
 * it as a save that may have landed (call it once the draft is updated or gone): replacing it later
 * can't hide a save someone still has to look up.
 */
export function writeLastSave(userId: string, pageId: string, saveId: string) {
  if (!userId) return;
  try {
    localStorage.setItem(lastSaveKey(userId, pageId), saveId);
  } catch {
    // Storage full or switched off: the next visit just takes a new place.
  }
}

// ----------------------------------------------------------------------------------------------
// Open editors

/** An open editor's saving (SheetSaver), as signing out and the background save need it. */
export type OpenSheet = {
  pageId: string;
  writer: string;
  /** Save now. */
  flush(): Promise<void>;
  /** Holds work that isn't saved (or may not be). */
  unsaved(): boolean;
  /** Signing out: stop at once, keeping nothing more on this device. */
  discard(): void;
  /** Its work was kept as a spreadsheet of your own (letGoOf): stop, and its draft goes. */
  letGo(): void;
  /** Someone saved revision `rev`. */
  remote(rev: number): Promise<void>;
  /** Closing: done once its last save went out (or couldn't). */
  closing(): Promise<void> | null;
};

const LOCK = "blob-sheet-editor:";
const openSheets = new Set<OpenSheet>();
const locks = (): LockManager | null => (typeof navigator !== "undefined" && navigator.locks) || null;

// Signing out in one tab stops the editors open in the other tabs too: they would save into a
// session that is gone and write their drafts again after the device was wiped. Said on this
// channel, which a tab listens to while it has an editor open.
const SIGN_OUT = "blob-sheet-sign-out";
let signOuts: BroadcastChannel | null = null;

function hearSignOuts(on: boolean) {
  if (on && !signOuts && typeof BroadcastChannel !== "undefined") {
    try {
      signOuts = new BroadcastChannel(SIGN_OUT);
      signOuts.onmessage = () => {
        for (const s of [...openSheets]) s.discard();
      };
    } catch {
      // No channel: this tab's editors stop when its page goes.
    }
  } else if (!on && signOuts) {
    signOuts.close();
    signOuts = null;
  }
}

/**
 * An editor opened: until the returned function is called, its draft is its own, here and (through
 * the Web Lock it holds) for other tabs.
 */
export function openSheet(sheet: OpenSheet): () => void {
  openSheets.add(sheet);
  hearSignOuts(true);
  let release: (() => void) | null = null;
  let closed = false;
  try {
    void locks()
      ?.request(
        LOCK + sheet.writer,
        () =>
          new Promise<void>((resolve) => {
            if (closed) resolve();
            else release = resolve;
          }),
      )
      .catch(() => {});
  } catch {
    // No Web Locks: this tab knows its own editors anyway.
  }
  return () => {
    closed = true;
    openSheets.delete(sheet);
    if (!openSheets.size) hearSignOuts(false);
    release?.();
  };
}

/** Editors of the page in this tab that are closing (you came straight back): their last save first, a few seconds at most. */
export async function closingDone(pageId: string, ms = 3000): Promise<void> {
  const waits = [...openSheets].filter((s) => s.pageId === pageId).map((s) => s.closing());
  const pending = waits.filter((w): w is Promise<void> => !!w);
  if (pending.length) await Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, ms))]);
}

/** Editors that are open: this tab's, and other tabs' as far as Web Locks tell. */
async function openWriters(): Promise<Set<string>> {
  const out = new Set([...openSheets].map((s) => s.writer));
  try {
    const held = await locks()?.query();
    for (const l of [...(held?.held ?? []), ...(held?.pending ?? [])]) if (l.name?.startsWith(LOCK)) out.add(l.name.slice(LOCK.length));
  } catch {
    // No Web Locks.
  }
  return out;
}

/** A page's drafts whose editor has closed: waiting to be taken over or sent, oldest first. */
export async function waitingDrafts(userId: string, pageId: string): Promise<SheetDraft[]> {
  const open = await openWriters();
  return (await readDrafts(userId, pageId)).filter((d) => !open.has(d.writer));
}

const taking = new Map<string, Promise<unknown>>();

/**
 * Runs `fn` with the page's waiting drafts, one taker at a time (across tabs too, through a Web
 * Lock): the taker removes what it took, so no draft is put back twice.
 */
export function takeDrafts<T>(userId: string, pageId: string, fn: (drafts: SheetDraft[]) => Promise<T>): Promise<T> {
  const name = `blob-sheet-take:${userId}:${pageId}`;
  const run = async () => fn(await waitingDrafts(userId, pageId));
  const lm = locks();
  if (lm) return lm.request(name, run) as Promise<T>;
  // Without Web Locks: one after the other in this tab.
  const next = (taking.get(name) ?? Promise.resolve()).catch(() => {}).then(run);
  taking.set(name, next);
  void next
    .finally(() => {
      if (taking.get(name) === next) taking.delete(name);
    })
    .catch(() => {});
  return next;
}

/**
 * The work of a spreadsheet open here was saved as a copy of your own (it couldn't be saved where it
 * was, SheetEditor): its editors in this tab stop saving it, and their drafts go.
 */
export function letGoOf(pageId: string) {
  for (const s of [...openSheets]) if (s.pageId === pageId) s.letGo();
}

/** Drafts the server refused for good (`denied`) whose editor is closed, on every page, oldest first. */
export async function deniedDrafts(userId: string): Promise<SheetDraft[]> {
  const out: SheetDraft[] = [];
  for (const pageId of await draftPages(userId)) out.push(...(await waitingDrafts(userId, pageId)).filter((d) => d.denied));
  return out.sort((a, b) => a.at - b.at);
}

const deniedListeners = new Set<() => void>();

/** Hear when a draft was newly refused for good (DeniedDrafts.tsx asks what to do with it). Returns the function that stops. */
export function onDeniedDrafts(fn: () => void): () => void {
  deniedListeners.add(fn);
  return () => {
    deniedListeners.delete(fn);
  };
}

/** The background save found a draft refused for good: whoever asks about such drafts looks again. */
export function announceDenied() {
  for (const fn of [...deniedListeners]) fn();
}

/** Signing out: the open editors in this tab save what they hold now. */
export async function flushOpenSheets(): Promise<void> {
  await Promise.all([...openSheets].map((s) => s.flush().catch(() => {})));
}

/** Signing out: the open editors stop without saving or keeping anything more here, in every tab. */
export function discardOpenSheets() {
  for (const s of [...openSheets]) s.discard();
  try {
    const channel = new BroadcastChannel(SIGN_OUT);
    channel.postMessage("discard");
    channel.close();
  } catch {
    // No channel: other tabs' editors stop when their page goes.
  }
}

/**
 * Spreadsheets with work on this device that isn't saved (signing out would delete it): open
 * editors' here, and drafts that change something (a draft that changes nothing doesn't count).
 */
export async function unsavedSheets(userId: string): Promise<number> {
  const pages = new Set<string>();
  for (const s of openSheets) if (s.unsaved()) pages.add(s.pageId);
  for (const pageId of await draftPages(userId)) {
    if (!pages.has(pageId) && (await readDrafts(userId, pageId)).some(holdsWork)) pages.add(pageId);
  }
  return pages.size;
}

/** A draft that would change something (its save that got no answer may have landed: it counts). */
const holdsWork = (d: SheetDraft) => d.title !== d.baseTitle || !!d.sending || !sameValue(d.base, d.mine);

/** Deep equality of JSON values, key order aside (sameJson in src/sheet/collab.ts, which this light module can't load). */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) return false;
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keys = Object.keys(x).filter((k) => x[k] !== undefined);
  return keys.length === Object.keys(y).filter((k) => y[k] !== undefined).length && keys.every((k) => sameValue(x[k], y[k]));
}

// Revisions the background save wrote in this tab. A spreadsheet opened at that very moment may have
// come with the version before (its page was already on its way): its editor catches up with them.
const flushed = new Map<string, number>();

/** The background save saved a page: its editors open here fetch it (and one opening right now). */
export function markFlushed(pageId: string, rev: number) {
  flushed.set(pageId, Math.max(rev, flushed.get(pageId) ?? 0));
  for (const s of openSheets) if (s.pageId === pageId) void s.remote(rev);
}

/** The newest revision the background save wrote for a page in this tab (0: none). */
export const flushedRev = (pageId: string) => flushed.get(pageId) ?? 0;
