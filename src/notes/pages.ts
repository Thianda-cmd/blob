// Creating notes where the workspace (sidebar) isn't around: the study screens and lessons.
// Inside the app use useWorkspace().createPage, which also updates the sidebar.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Subject as LearnSubject } from "@/learn/catalog";
import { PAGE_META_COLUMNS, type PageMeta, type Subject } from "@/lib/types";
import { fold } from "./text";

/** School-subject names for each learning-center subject, as students name them (folded). */
const NAMES: Record<LearnSubject, string[]> = {
  maths: ["mathe", "mathematik", "math", "maths", "mathematics", "ma"],
  chemistry: ["chemie", "chemistry", "chem", "ch"],
  biology: ["bio", "biologie", "biology", "bi"],
};

/** The student's own subject for a learning-center subject ("Mathe" for maths), if they have one. */
export function guessSubject(subjects: Pick<Subject, "id" | "name" | "kind">[], learn: LearnSubject): string | null {
  const names = NAMES[learn];
  const school = subjects.filter((s) => (s.kind ?? "subject") === "subject");
  const exact = school.find((s) => names.includes(fold(s.name).replace(/[^a-z]/g, "")));
  if (exact) return exact.id;
  const loose = school.find((s) => names.some((n) => n.length > 2 && fold(s.name).startsWith(n)));
  return loose?.id ?? null;
}

type Insert = {
  title: string;
  content: unknown;
  plain_text: string;
  subject_id?: string | null;
  parent_id?: string | null;
  icon?: string | null;
  tags?: string[];
  topics?: string[];
  links?: string[];
};

/** Adds a note at the end of its level (the sidebar sorts by position). */
export async function insertNote(supabase: SupabaseClient, userId: string, input: Insert): Promise<PageMeta | null> {
  let last = supabase.from("pages").select("position").eq("user_id", userId).order("position", { ascending: false }).limit(1);
  last = input.parent_id ? last.eq("parent_id", input.parent_id) : last.is("parent_id", null);
  const { data: top } = await last.maybeSingle();
  const { data, error } = await supabase
    .from("pages")
    .insert({
      kind: "note",
      title: input.title.slice(0, 300),
      content: input.content,
      plain_text: input.plain_text,
      subject_id: input.subject_id ?? null,
      parent_id: input.parent_id ?? null,
      icon: input.icon ?? null,
      tags: (input.tags ?? []).slice(0, 20),
      topics: (input.topics ?? []).slice(0, 20),
      links: (input.links ?? []).slice(0, 500),
      position: ((top as { position?: number } | null)?.position ?? 0) + 1,
    })
    .select(PAGE_META_COLUMNS)
    .single();
  if (error || !data) return null;
  return data as PageMeta;
}
