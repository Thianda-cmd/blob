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
  /** Others can open it (someone else's, or yours shared, itself or through a folder above it). */
  shared?: boolean;
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
  // Who else is on which page: your role on notes shared with you, and which of yours are shared
  // (a shared note is only read offline: its edits go through working together).
  const { data: memberships, error: membersError } = await db.from("page_members").select("page_id, user_id, role").limit(5000);
  if (membersError) return;
  const rows = (memberships ?? []) as { page_id: string; user_id: string; role: "editor" | "viewer" }[];
  const roles = new Map(rows.filter((m) => m.user_id === userId).map((m) => [m.page_id, m.role]));
  const withOthers = new Set(rows.filter((m) => m.user_id !== userId).map((m) => m.page_id));
  const parents = new Map(pages.map((p) => [p.id, p.parent_id]));
  const sharedOf = (c: { id: string; user_id: string }) => {
    if (c.user_id !== userId) return true;
    for (let id: string | null | undefined = c.id, n = 0; id && n < 50; id = parents.get(id), n++) if (withOthers.has(id)) return true;
    return false;
  };
  const roleOf = (c: { id: string; user_id: string }) => (c.user_id === userId ? null : (roles.get(c.id) ?? null));
  const moved = stored
    .filter((c) => want.has(c.id) && !stale.some((p) => p.id === c.id) && ((c.role ?? null) !== roleOf(c) || c.shared !== sharedOf(c)))
    .map((c) => ({ ...c, role: roleOf(c), shared: sharedOf(c) }));
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
      ((data ?? []) as NoteCopy[]).map((c) => ({ ...c, role: roleOf(c), shared: sharedOf(c) })),
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

/** `doc`: the editor's whole text then, kept as a copy if the steps can't be placed any more. */
type OwedRecord = { id: string; page: string; owed: OwedSteps; at: number; doc?: unknown };

/** One record per editor (a reloaded note gets a new editor; the old one's steps stay until settled). */
const owedKey = (pageId: string, client: string) => `owed:${pageId}:${client}`;

/** Keeps (or, with null, forgets) the unsent steps of one shared-note editor on the device, with its text. */
export function keepOwed(userId: string, pageId: string, client: string, owed: OwedSteps | null, doc?: unknown) {
  if (!owed || !owed.steps.length) return write(userId, "notes", [], [owedKey(pageId, client)]);
  const record: OwedRecord = { id: owedKey(pageId, client), page: pageId, owed, at: Date.now(), doc };
  return write(userId, "notes", [record]);
}

let settling = false;

/**
 * Sends kept steps to the server, which places them on the note as it is now. Sending steps the
 * server already has is harmless (it recognises the editor's own steps), so after a crash they can
 * simply go again. When it can no longer place them (the note moved on too far, or you can't edit
 * it any more), the editor's text then becomes a note of your own ("… (offline copy)").
 */
export async function settleOwed(userId: string, words?: { copyTitle: (t: string) => string; conflict: (t: string) => string }, onConflict?: (message: string) => void) {
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
      // Placed: forget them. Can't be placed: the text becomes a copy first. Signed out or a
      // server hiccup: try again later.
      if (res.ok || res.status === 400 || res.status === 413) {
        await write(userId, "notes", [], [r.id]);
        continue;
      }
      if (res.status !== 409 && res.status !== 404) continue;
      const answer = (await res.json().catch(() => null)) as { lost?: boolean } | null;
      if (res.status === 404 || answer?.lost) {
        if (r.doc && words) {
          const note = await noteCopy(userId, r.page);
          const name = words.copyTitle(note?.title ?? "");
          if (!(await keepAsCopy({ title: name, content: r.doc, plain_text: textOf(r.doc), subject_id: null, parent_id: null }))) continue;
          onConflict?.(words.conflict(name));
        }
        await write(userId, "notes", [], [r.id]);
      } else if (Date.now() - r.at > 7 * 864e5) {
        await write(userId, "notes", [], [r.id]);
      }
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

/** A note's text that can't be saved over the note (another device saved other text meanwhile). */
export type CopyOf = { title: string; content: unknown; plain_text: string; links?: unknown[]; subject_id: string | null; parent_id: string | null };

/**
 * Keeps text as a note of its own ("… (offline copy)"), next to the note it came from, in one
 * insert with its text. True only once it is safely stored: until then the text stays where it is.
 */
export async function keepAsCopy(copy: CopyOf): Promise<boolean> {
  const db = createClient();
  const row = { kind: "note", title: copy.title.slice(0, 300), content: copy.content, plain_text: copy.plain_text, links: copy.links ?? [], subject_id: copy.subject_id, parent_id: copy.parent_id };
  let { error, status } = await db.from("pages").insert(row);
  // Under a page that isn't yours (a shared note), or a subject that isn't: among your own notes instead.
  if (error && !isNetworkError(error, status) && (row.parent_id || row.subject_id)) ({ error, status } = await db.from("pages").insert({ ...row, parent_id: null, subject_id: null }));
  if (error && isNetworkError(error, status)) reportNetworkError();
  return !error;
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
    for (const { id } of noteCache.waiting()) {
      // As it is now: an editor may have opened it, or saved it, while earlier notes went out.
      const n = noteCache.waitingOne(id);
      if (!n) continue;
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
      if (noteCache.waitingOne(id)?.version !== n.version) continue;
      // Only the bookkeeping was behind (the server has what this text builds on, or what this
      // device itself saved meanwhile): save over it.
      const own = noteCache.base(id);
      if (same(row.content, n.content) || (n.baseContent && same(row.content, n.baseContent)) || (own?.rev === row.rev && own.content && same(row.content, own.content))) {
        result = await attempt(row.rev);
        if (result === "wait") return;
        continue;
      }
      // Another device saved other text: this device's becomes a copy (and stays here until it is).
      const name = words.copyTitle(n.title ?? row.title);
      if (!(await keepAsCopy({ title: name, content: n.content, plain_text: textOf(n.content), subject_id: row.subject_id, parent_id: row.parent_id }))) continue;
      if (noteCache.waitingOne(id)?.version === n.version) noteCache.forget(n.id);
      onConflict(words.conflict(name));
    }
  } finally {
    flushing = false;
  }
}
