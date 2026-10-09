import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { JSONContent } from "@tiptap/core";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";
import { Mapping, Step, Transform } from "@tiptap/pm/transform";
import { collectLinks } from "@/components/editor/links";
import { noteSchema, plainDoc, plainTextOf } from "@/components/editor/schema";
import type { Locale } from "@/i18n/config";

// Settling a note edited together: the steps in page_steps that no snapshot holds yet are applied to
// pages.content on the server and stored with save_note_snapshot, so search, previews, study tools
// and backlinks see the latest note even when the last editor closed the tab before saving one.
// It runs as the signed-in user (RLS and page_role decide), with the editor's own schema.

type StepRow = { version: number; steps: unknown[]; client_id: string };
type PageRow = { kind: string; content: unknown; plain_text: string | null; doc_version: number | null };

/** Steps a closing editor hadn't sent yet: on top of `version`, made by editor `client`. */
export type Owed = { version: number; steps: unknown[]; client: string };

/** The note at `version` (`saved`: stored as the snapshot; false for viewers, who can only read it). */
export type Settled = { content: JSONContent; plain: string; version: number; saved: boolean };

/** The stored document as the editor opens it (null when only a browser could read it). */
function storedDoc(schema: Schema, page: PageRow): PMNode | null {
  try {
    const content = page.content;
    if (content && typeof content === "object" && (content as JSONContent).type === "doc") {
      const doc = schema.nodeFromJSON(content);
      doc.check();
      return doc;
    }
    if (typeof content === "string" && content.trim()) return null;
    const plain = page.plain_text ?? "";
    return plain.trim() ? schema.nodeFromJSON(plainDoc(plain)) : schema.topNodeType.createAndFill();
  } catch {
    return null;
  }
}

async function loadPage(supabase: SupabaseClient, pageId: string) {
  const { data } = await supabase.from("pages").select("kind, content, plain_text, doc_version").eq("id", pageId).maybeSingle();
  return (data as PageRow | null) ?? null;
}

/** Step rows that reach past `from`, in order (null: couldn't load them). */
async function rowsFrom(supabase: SupabaseClient, pageId: string, from: number) {
  const { data, error } = await supabase
    .from("page_steps")
    .select("version, steps, client_id")
    .eq("page_id", pageId)
    .gte("version", Math.max(0, from - 500))
    .order("version");
  if (error) return null;
  return ((data ?? []) as StepRow[]).filter((r) => r.version + r.steps.length > from);
}

/** The steps from `from` on, one after another, and the version they lead to (null: a gap in the history). */
function flatten(rows: StepRow[], from: number) {
  let at = from;
  const steps: unknown[] = [];
  for (const r of rows) {
    if (r.version + r.steps.length <= at) continue;
    if (r.version > at) return null;
    steps.push(...r.steps.slice(at - r.version));
    at = r.version + r.steps.length;
  }
  return { steps, end: at };
}

/** The document as plain JSON (ProseMirror's attributes have no prototype: React can't pass them on). */
const jsonOf = (doc: PMNode) => JSON.parse(JSON.stringify(doc.toJSON())) as JSONContent;

function parse(schema: Schema, steps: unknown[]): Step[] | null {
  try {
    return steps.map((json) => Step.fromJSON(schema, json));
  } catch {
    return null;
  }
}

/** The document after the steps (null when one doesn't fit: the editors would reload the note too). */
function replay(doc: PMNode, steps: Step[]): PMNode | null {
  const tr = new Transform(doc);
  for (const step of steps) if (tr.maybeStep(step).failed) return null;
  return tr.doc;
}

/**
 * Our steps, made on the document before `over`, moved past them (as prosemirror-collab rebases a
 * browser's unsent steps): through the inverse of our own maps, theirs, and our steps placed so far.
 * Steps that no longer fit (their text was deleted) are dropped. `doc` is the document after `over`.
 */
function rebase(ours: Step[], over: Step[], doc: PMNode): Step[] {
  const mapping = new Mapping();
  for (let i = ours.length - 1; i >= 0; i--) mapping.appendMap(ours[i].getMap().invert());
  for (const step of over) mapping.appendMap(step.getMap());
  const tr = new Transform(doc);
  const out: Step[] = [];
  for (let i = 0, mapFrom = ours.length; i < ours.length; i++) {
    const mapped = ours[i].map(mapping.slice(mapFrom));
    mapFrom--;
    if (mapped && !tr.maybeStep(mapped).failed) {
      mapping.appendMap(mapped.getMap(), mapFrom);
      out.push(mapped);
    }
  }
  return out;
}

/**
 * Send a closed editor's last steps. When others wrote in between, the steps of ours that arrived
 * anyway (a push still on its way) are skipped and the rest is rebased over theirs.
 */
async function pushOwed(supabase: SupabaseClient, schema: Schema, pageId: string, owed: Owed) {
  let version = owed.version;
  let steps = parse(schema, owed.steps);
  for (let tries = 0; tries < 4 && steps?.length; tries++) {
    const { data, error } = await supabase.rpc("push_steps", { p_page: pageId, p_version: version, p_steps: steps.map((s) => s.toJSON()), p_client: owed.client });
    if (error) return;
    const result = data as { ok: boolean; version?: number; reason?: string };
    // Done; or not allowed; or the history was reset (the note was saved on its own since).
    if (result.ok || result.reason === "denied" || (typeof result.version === "number" && result.version < version)) return;
    const page = await loadPage(supabase, pageId);
    const stored = page?.doc_version ?? 0;
    const rows = page && (await rowsFrom(supabase, pageId, Math.min(version, stored)));
    if (!page || !rows) return;
    let later = rows.filter((r) => r.version + r.steps.length > version);
    while (later.length && later[0].version === version && later[0].client_id === owed.client) {
      version += later[0].steps.length;
      steps = steps.slice(later[0].steps.length);
      later = later.slice(1);
    }
    if (!steps.length) return;
    // More of our own steps further on can't be told apart from these: leave the note as it is.
    if (later.some((r) => r.client_id === owed.client)) return;
    if (!later.length) continue;
    const theirs = flatten(later, version);
    const all = flatten(rows, stored);
    const base = storedDoc(schema, page);
    const over = theirs && parse(schema, theirs.steps);
    const allSteps = all && parse(schema, all.steps);
    const latest = base && allSteps && replay(base, allSteps);
    if (!theirs || !all || !over || !latest || theirs.end !== all.end) return;
    steps = rebase(steps, over, latest);
    version = all.end;
  }
}

/**
 * Apply the steps nobody stored yet and save the note as a snapshot (with its plain text and
 * links, as the editor would). `owed`: a closing editor's unsent steps, sent first. Null when the
 * note can't be read or settled; for viewers the settled note is returned without saving it.
 */
export async function settleNote(supabase: SupabaseClient, pageId: string, locale: Locale, owed?: Owed | null): Promise<Settled | null> {
  const schema = noteSchema(locale);
  const { data: role } = await supabase.rpc("page_role", { p_page: pageId });
  if (!role) return null;
  const canEdit = role === "owner" || role === "editor";
  if (canEdit && owed?.steps.length) await pushOwed(supabase, schema, pageId, owed);
  for (let tries = 0; tries < 3; tries++) {
    const page = await loadPage(supabase, pageId);
    if (!page || page.kind !== "note") return null;
    const from = page.doc_version ?? 0;
    const base = storedDoc(schema, page);
    const rows = await rowsFrom(supabase, pageId, from);
    const flat = rows && flatten(rows, from);
    const steps = flat && parse(schema, flat.steps);
    if (!base || !flat || !steps) return null;
    if (!steps.length) return { content: jsonOf(base), plain: page.plain_text ?? "", version: from, saved: true };
    const doc = replay(base, steps);
    if (!doc) return null;
    const settled = { content: jsonOf(doc), plain: plainTextOf(doc), version: flat.end };
    if (!canEdit) return { ...settled, saved: false };
    const { data: ok, error } = await supabase.rpc("save_note_snapshot", {
      p_page: pageId,
      p_version: flat.end,
      p_content: settled.content,
      p_plain: settled.plain,
      p_links: collectLinks(doc, pageId),
    });
    if (error) return { ...settled, saved: false };
    if (ok) return { ...settled, saved: true };
    // Someone stored a newer snapshot meanwhile: start again from that one.
  }
  return null;
}

/** Settle a note only when it has steps beyond its stored version (cheap to ask first). */
export async function settleIfPending(supabase: SupabaseClient, pageId: string, docVersion: number, locale: Locale) {
  const { data } = await supabase.from("page_steps").select("version").eq("page_id", pageId).gte("version", docVersion).limit(1);
  return data?.length ? settleNote(supabase, pageId, locale) : null;
}
