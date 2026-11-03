"use client";

// Unsaved spreadsheet work kept on this device, so nothing typed is lost: no connection, the app
// closed or killed before the save went out, a save the server refused. A draft holds what the
// editor had (`mine`) and the server's version it was based on (`base`, at revision `rev`), so the
// next time it is merged with whatever the server has by then (src/sheet/collab.ts) instead of
// overwriting someone else's changes.
//
// Where: localStorage first (it can be written while the page is closing), IndexedDB for drafts
// too big for it (the "meta" store of src/lib/offline/idb.ts). Signing out removes both
// (src/lib/offline/device.ts forgetDevice). The key names the account, so another account on the
// same device never sees it.
//
// This module stays light (no engine): the shell asks draftPages when it catches up, and only
// loads the saving code (flushDrafts.ts) when there is something to send.

import { getMeta, getPrefix, setMeta, write } from "@/lib/offline/idb";
import type { Workbook } from "@/sheet/types";

export type SheetDraft = {
  v: 1;
  pageId: string;
  /** The server's revision `base` is. */
  rev: number;
  base: Workbook;
  mine: Workbook;
  baseTitle: string;
  title: string;
  /** When it was written (ms), to pick the newer of two copies. */
  at: number;
  /** The tab that wrote it: a tab only clears its own draft (another tab may have unsaved work). */
  tab: string;
};

const PREFIX = "blob-sheet-draft:";
const localKey = (userId: string, pageId: string) => `${PREFIX}${userId}:${pageId}`;
const metaKey = (pageId: string) => `sheet-draft:${pageId}`;

/** This tab's id (drafts remember which tab wrote them). */
export const draftTab = (() => {
  let id: string | null = null;
  return () => (id ??= Math.random().toString(36).slice(2, 10));
})();

const isDraft = (x: unknown): x is SheetDraft => {
  const d = x as SheetDraft | null;
  return !!d && typeof d === "object" && d.v === 1 && typeof d.pageId === "string" && typeof d.rev === "number" && !!d.base && !!d.mine && typeof d.at === "number";
};

/**
 * Keep a draft (synchronously in localStorage when it fits, else in IndexedDB). Returns false
 * when neither could take it right away (IndexedDB is written in the background then).
 */
export function writeDraft(userId: string, draft: SheetDraft): boolean {
  if (!userId) return false;
  try {
    localStorage.setItem(localKey(userId, draft.pageId), JSON.stringify(draft));
    // A bigger, older copy in IndexedDB isn't needed any more.
    void write(userId, "meta", [], [metaKey(draft.pageId)]);
    return true;
  } catch {
    try {
      localStorage.removeItem(localKey(userId, draft.pageId));
    } catch {
      // Storage not available at all.
    }
    void setMeta(userId, metaKey(draft.pageId), draft);
    return false;
  }
}

/** The draft of a page in localStorage (synchronous; IndexedDB's copy: readDraft). */
export function readLocalDraft(userId: string, pageId: string): SheetDraft | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(localKey(userId, pageId));
    const d: unknown = raw ? JSON.parse(raw) : null;
    return isDraft(d) && d.pageId === pageId ? d : null;
  } catch {
    return null;
  }
}

/** The newest draft of a page on this device, wherever it is kept. */
export async function readDraft(userId: string, pageId: string): Promise<SheetDraft | null> {
  const local = readLocalDraft(userId, pageId);
  let stored: unknown = null;
  try {
    stored = await getMeta<SheetDraft>(userId, metaKey(pageId));
  } catch {
    stored = null;
  }
  const idb = isDraft(stored) && stored.pageId === pageId ? stored : null;
  if (local && idb) return local.at >= idb.at ? local : idb;
  return local ?? idb;
}

/** Forget a page's draft (after it was saved). `tab`: only if that tab wrote it. */
export function clearDraft(userId: string, pageId: string, tab?: string) {
  if (!userId) return;
  try {
    const key = localKey(userId, pageId);
    if (tab) {
      const d = readLocalDraft(userId, pageId);
      if (d && d.tab !== tab) return;
    }
    localStorage.removeItem(key);
  } catch {
    // Nothing kept there.
  }
  void write(userId, "meta", [], [metaKey(pageId)]);
}

/** Pages with a draft in localStorage. */
function localDraftPages(userId: string): string[] {
  if (!userId) return [];
  const prefix = `${PREFIX}${userId}:`;
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) out.push(key.slice(prefix.length));
    }
  } catch {
    // No storage.
  }
  return out;
}

/** Every page with a draft on this device. */
export async function draftPages(userId: string): Promise<string[]> {
  const ids = new Set(localDraftPages(userId));
  try {
    for (const row of await getPrefix<{ key: string }>(userId, "meta", "sheet-draft:")) ids.add(row.key.slice("sheet-draft:".length));
  } catch {
    // No database.
  }
  return [...ids];
}

// Spreadsheets open in this tab: the background save of waiting drafts leaves them to their editor.
const open = new Map<string, number>();

export function markSheetOpen(pageId: string): () => void {
  open.set(pageId, (open.get(pageId) ?? 0) + 1);
  return () => {
    const n = (open.get(pageId) ?? 1) - 1;
    if (n <= 0) open.delete(pageId);
    else open.set(pageId, n);
  };
}

export const isSheetOpen = (pageId: string) => open.has(pageId);

// Revisions the background save wrote in this tab. A spreadsheet opened at that very moment may have
// come with the version before (its page was already on its way): its editor catches up with them.
const flushed = new Map<string, number>();

export function markFlushed(pageId: string, rev: number) {
  flushed.set(pageId, Math.max(rev, flushed.get(pageId) ?? 0));
}

/** The newest revision the background save wrote for a page in this tab (0: none). */
export const flushedRev = (pageId: string) => flushed.get(pageId) ?? 0;
