import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { themeSpecOf } from "@/components/deck/deck";
import type { PagePreview } from "@/components/subjects/PageCards";
import { SubjectView } from "@/components/subjects/SubjectView";
import { subjectsText } from "@/i18n/messages/subjects";
import { getMessages } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { loadTasks } from "@/lib/tasks";
import type { PageKind, Subject } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadSubject(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("subjects").select("*").eq("id", id).maybeSingle();
  return data as Subject | null;
}

export async function generateMetadata({ params }: PageProps<"/subjects/[id]">): Promise<Metadata> {
  const subject = await loadSubject((await params).id);
  return { title: subject ? subject.name : (await getMessages(subjectsText)).notFound };
}

type PreviewRow = { id: string; kind: PageKind; plain_text: string | null; slide_title: string | null; deck_theme: string | null; deck_custom: unknown };

function snippet(text: string | null) {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > 220 ? `${flat.slice(0, 220).replace(/\s+\S*$/, "")}…` : flat;
}

export default async function SubjectPage({ params }: PageProps<"/subjects/[id]">) {
  const { id } = await params;
  const subject = await loadSubject(id);
  if (!subject) notFound();

  const supabase = await createClient();
  const [pagesRes, tasks] = await Promise.all([
    supabase
      .from("pages")
      .select("id, kind, plain_text, slide_title:content->slides->0->>title, deck_theme:content->>theme, deck_custom:content->custom")
      .eq("subject_id", id)
      .is("trashed_at", null),
    loadTasks(supabase, { subjectId: id }),
  ]);

  // Only small previews travel to the client; the page list itself comes from the workspace.
  const previews: Record<string, PagePreview> = {};
  for (const row of (pagesRes.data ?? []) as unknown as PreviewRow[]) {
    previews[row.id] = {
      snippet: row.kind === "note" ? snippet(row.plain_text) : "",
      slideTitle: row.kind === "deck" ? row.slide_title : null,
      theme: row.kind === "deck" ? themeSpecOf(row.deck_theme, row.deck_custom) : null,
    };
  }

  return <SubjectView key={subject.id} subject={subject} previews={previews} initialTasks={tasks} />;
}
