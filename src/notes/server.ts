import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { makeCards, termsOf } from "./study/cards";
import { SUSPENDED } from "./study/srs";
import type { Pool } from "./study/quiz";

/** A card that comes up again on `due_on` (the browser decides what "today" is). */
export type DueRow = { page_id: string; card_id: string; due_on: string };

/** Tomorrow (UTC), as yyyy-mm-dd: covers "today" in every time zone around Germany. */
function horizon() {
  return new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Flashcards you learned that are due again soon, only for cards the notes still have (a card
 * deleted from its note doesn't count). `pageIds` limits it to some notes.
 */
export async function loadDue(supabase: SupabaseClient, pageIds?: string[]): Promise<DueRow[]> {
  let query = supabase.from("card_reviews").select("page_id, card_id, due_on").gt("reviews", 0).lte("due_on", horizon()).lt("due_on", SUSPENDED);
  if (pageIds) query = query.in("page_id", pageIds);
  const { data } = await query.limit(5000);
  const rows = (data ?? []) as DueRow[];
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((r) => r.page_id))];
  const { data: pages } = await supabase.from("pages").select("id, title, content").in("id", ids).is("trashed_at", null);
  const valid = new Map<string, Set<string>>();
  for (const p of (pages ?? []) as { id: string; title: string; content: unknown }[]) {
    valid.set(p.id, new Set(makeCards(p.content, p.title).map((c) => c.id)));
  }
  return rows.filter((r) => valid.get(r.page_id)?.has(r.card_id));
}

/**
 * Terms from your other notes for quiz answers: notes of the same subject and notes sharing a tag
 * (without either: the most recently edited). At most 40 notes.
 */
export async function loadPool(supabase: SupabaseClient, page: { id: string; subject_id: string | null; tags: string[] }): Promise<Pool> {
  const base = () => supabase.from("pages").select("id, title, content").eq("kind", "note").is("trashed_at", null).neq("id", page.id).order("updated_at", { ascending: false });
  const empty = Promise.resolve({ data: [] as unknown[] });
  const [same, tagged] = await Promise.all([
    page.subject_id ? base().eq("subject_id", page.subject_id).limit(25) : page.tags.length ? empty : base().limit(25),
    page.tags.length ? base().overlaps("tags", page.tags).limit(15) : empty,
  ]);
  const seen = new Set<string>();
  const pool: Pool = [];
  for (const p of [...(same.data ?? []), ...(tagged.data ?? [])] as { id: string; title: string; content: unknown }[]) {
    if (seen.has(p.id) || seen.size >= 40) continue;
    seen.add(p.id);
    pool.push(...termsOf(p.content, p.title));
  }
  return pool;
}
