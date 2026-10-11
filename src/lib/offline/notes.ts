"use client";

import { noteCache } from "@/components/editor/noteCache";
import { createClient } from "@/lib/supabase/client";
import type { PageMeta } from "@/lib/types";
import { getAll, write } from "./idb";
import { isNetworkError, isOnline, reportNetworkError, reportOk } from "./net";

// Notes on the device: a copy of every note you can open (yours and the ones shared with you),
// kept in step with the server, so any note opens without a connection. And the edits to shared
// notes that couldn't be sent before an editor closed, which the server settles later (the same
// route the closing editor's beacon uses: src/app/api/notes/[id]/settle).

/** A note as the server last had it, on the device ("pages" store). */
export type NoteCopy = {
  id: string;
  kind: string;
  user_id: string;
  title: string;
  icon: string | null;
  subject_id: string | null;
  parent_id: string | null;
  content: unknown;
  plain_text: string | null;
  links: string[];
  rev: number;
  doc_version: number;
  /** Your role on someone else's note (from its members; none: only through a folder above it). */
  role?: "editor" | "viewer" | null;
  tags: string[];
  topics: string[];
  is_favorite: boolean;
  position: number;
  trashed_at: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS = "id, kind, user_id, title, icon, subject_id, parent_id, content, plain_text, links, rev, doc_version, tags, topics, is_favorite, position, trashed_at, created_at, updated_at";
/** How many notes are kept (the most recently changed). */
const MAX_NOTES = 500;
const BATCH = 20;
const EVERY = 5 * 60e3;

let running: Promise<void> | null = null;
let lastRun = 0;

/** Brings the device's notes up to date with `pages` (the workspace's list). Cheap when nothing changed. */
export function syncNoteCopies(userId: string, pages: PageMeta[], opts: { force?: boolean } = {}): Promise<void> {
  if (typeof window === "undefined" || !userId) return Promise.resolve();
  if (running) return running;
  if (!opts.force && Date.now() - lastRun < EVERY) return Promise.resolve();
  running = run(userId, pages).finally(() => {
    running = null;
    lastRun = Date.now();
  });
  return running;
}

async function run(userId: string, pages: PageMeta[]) {
  if (!isOnline()) return;
  const wanted = pages
    .filter((p) => p.kind === "note" && !p.trashed_at)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, MAX_NOTES);
  const want = new Map(wanted.map((p) => [p.id, p]));
  const stored = await getAll<NoteCopy>(userId, "pages");
  const have = new Map(stored.map((c) => [c.id, c]));
  const stale = wanted.filter((p) => {
    const c = have.get(p.id);
    return !c || c.updated_at < p.updated_at;
  });
  const gone = stored.filter((c) => !want.has(c.id)).map((c) => c.id);
  if (gone.length) await write(userId, "pages", [], gone);
  const db = createClient();
  // Your role on notes others shared with you (editing them offline needs it).
  const shared = wanted.some((p) => p.user_id !== userId);
  const { data: memberships } = shared ? await db.from("page_members").select("page_id, role").eq("user_id", userId) : { data: [] };
  const roles = new Map(((memberships ?? []) as { page_id: string; role: "editor" | "viewer" }[]).map((m) => [m.page_id, m.role]));
  const roleOf = (c: { id: string; user_id: string }) => (c.user_id === userId ? null : (roles.get(c.id) ?? null));
  const moved = stored.filter((c) => want.has(c.id) && !stale.some((p) => p.id === c.id) && (c.role ?? null) !== roleOf(c)).map((c) => ({ ...c, role: roleOf(c) }));
  if (moved.length) await write(userId, "pages", moved);
  for (let i = 0; i < stale.length; i += BATCH) {
    const ids = stale.slice(i, i + BATCH).map((p) => p.id);
    const { data, error, status } = await db.from("pages").select(COLUMNS).in("id", ids);
    if (error) {
      if (isNetworkError(error, status)) reportNetworkError();
      return;
    }
    reportOk();
    await write(
      userId,
      "pages",
      ((data ?? []) as NoteCopy[]).map((c) => ({ ...c, role: roleOf(c) })),
    );
  }
}

/** One note from the device (null when it isn't here). */
export async function noteCopy(userId: string, id: string): Promise<NoteCopy | null> {
  const rows = await getAll<NoteCopy>(userId, "pages");
  return rows.find((r) => r.id === id) ?? null;
}

/** Every note on the device, newest first (the offline page's list). */
export async function noteCopies(userId: string): Promise<NoteCopy[]> {
  return (await getAll<NoteCopy>(userId, "pages")).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

// Edits to shared notes the editor couldn't send -------------------------------------------------

/** Steps a shared note's editor made on top of `version`, as the settle route takes them. */
export type OwedSteps = { version: number; steps: unknown[]; client: string };

type OwedRecord = { id: string; page: string; owed: OwedSteps; at: number };

/** One record per editor (a reloaded note gets a new editor; the old one's steps stay until settled). */
const owedKey = (pageId: string, client: string) => `owed:${pageId}:${client}`;

/** Keeps (or, with null, forgets) the unsent steps of one shared-note editor on the device. */
export function keepOwed(userId: string, pageId: string, client: string, owed: OwedSteps | null) {
  if (!owed || !owed.steps.length) return write(userId, "notes", [], [owedKey(pageId, client)]);
  const record: OwedRecord = { id: owedKey(pageId, client), page: pageId, owed, at: Date.now() };
  return write(userId, "notes", [record]);
}

let settling = false;

/**
 * Sends kept steps to the server, which places them on the note as it is now. Sending steps the
 * server already has is harmless (it recognises the editor's own steps), so after a crash they can
 * simply go again. Steps it can no longer place (the note moved on too far) are dropped after a week.
 */
export async function settleOwed(userId: string) {
  if (settling || typeof window === "undefined" || !isOnline()) return;
  settling = true;
  try {
    const all = (await getAll<OwedRecord & { id: string }>(userId, "notes")).filter((r) => r.id.startsWith("owed:"));
    for (const r of all) {
      let res: Response;
      try {
        res = await fetch(`/api/notes/${r.page}/settle`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(r.owed), credentials: "same-origin" });
      } catch {
        reportNetworkError();
        return;
      }
      reportOk();
      // Done (or the note is gone / not ours any more): forget them. Signed out or a server
      // hiccup: try again later. Refused: try again for a week.
      const done = res.ok || res.status === 404 || res.status === 413 || res.status === 400;
      const tooOld = Date.now() - r.at > 7 * 864e5;
      if (done || (res.status === 409 && tooOld)) await write(userId, "notes", [], [r.id]);
    }
  } finally {
    settling = false;
  }
}

// Notes written offline and closed before they could be saved -----------------------------------

/** The text of a note's JSON (for search and previews; the editor writes the exact one later). */
export function textOf(doc: unknown): string {
  const out: string[] = [];
  const walk = (node: unknown, block: boolean) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (typeof n.text === "string") out.push(n.text);
    for (const c of n.content ?? []) walk(c, false);
    if (block || (n.type && n.type !== "text" && !["hardBreak", "image"].includes(n.type) && n.content)) out.push("\n");
  };
  walk(doc, true);
  return out.join("").replace(/\n{2,}/g, "\n").trim().slice(0, 20000);
}

const same = (a: unknown, b: unknown) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]));
  return v;
}

let flushing = false;

/**
 * Saves notes written on this device while offline whose editor was closed before they could be
 * saved. Only over the version they were written on: when another device saved the note meanwhile,
 * this device's text becomes a copy next to it ("… (offline copy)") instead of replacing it.
 */
export async function flushWaitingNotes(userId: string, words: { copyTitle: (t: string) => string; conflict: (t: string) => string }, onConflict: (message: string) => void) {
  if (flushing || !isOnline()) return;
  flushing = true;
  try {
    const db = createClient();
    for (const n of noteCache.waiting()) {
      const patch: Record<string, unknown> = {};
      if (n.title !== undefined) patch.title = n.title;
      if (n.content) {
        patch.content = n.content;
        patch.plain_text = textOf(n.content);
      }
      if (!Object.keys(patch).length) continue;
      const attempt = async (rev: number | undefined): Promise<"saved" | "behind" | "wait" | "skip"> => {
        let q = db.from("pages").update(patch).eq("id", n.id);
        if (n.content) q = q.eq("rev", rev ?? -1);
        const { data, error, status } = await q.select("updated_at, rev").maybeSingle();
        if (error) return isNetworkError(error, status) ? "wait" : "skip";
        if (!data) return "behind";
        const row = data as { updated_at: string; rev: number };
        noteCache.saved(n.id, n.version, row.updated_at, n.content ? { rev: row.rev, content: n.content } : undefined);
        return "saved";
      };
      let result = await attempt(n.baseRev);
      if (result === "wait") {
        reportNetworkError();
        return;
      }
      if (result !== "behind") continue;
      const { data: server, error } = await db.from("pages").select("title, content, rev, subject_id, parent_id").eq("id", n.id).maybeSingle();
      if (error || !server) continue;
      const row = server as { title: string; content: unknown; rev: number; subject_id: string | null; parent_id: string | null };
      // Only the bookkeeping was behind (the server still has what this text builds on): save over it.
      if (same(row.content, n.content) || (n.baseContent && same(row.content, n.baseContent))) {
        result = await attempt(row.rev);
        if (result === "wait") return;
        continue;
      }
      // Another device saved other text: this device's becomes a copy.
      const name = words.copyTitle(n.title ?? row.title);
      const { error: copyError } = await db.from("pages").insert({ kind: "note", title: name.slice(0, 300), content: n.content, plain_text: textOf(n.content), subject_id: row.subject_id, parent_id: row.parent_id });
      if (copyError) continue;
      noteCache.forget(n.id);
      onConflict(words.conflict(name));
    }
  } finally {
    flushing = false;
  }
}
