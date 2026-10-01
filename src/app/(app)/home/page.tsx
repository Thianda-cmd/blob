import type { Metadata } from "next";
import { HomeView } from "@/components/home/HomeView";
import type { PagePreview } from "@/components/subjects/PageCards";
import { createClient } from "@/lib/supabase/server";
import { loadUpcomingTasks } from "@/lib/tasks";
import type { DeckTheme, PageKind } from "@/lib/types";

export const metadata: Metadata = { title: "Home" };

type PreviewRow = { id: string; kind: PageKind; plain_text: string | null; slide_title: string | null; deck_theme: string | null };

function snippet(text: string | null) {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > 200 ? `${flat.slice(0, 200).replace(/\s+\S*$/, "")}…` : flat;
}

export default async function HomePage() {
  const supabase = await createClient();
  const [tasks, recentRes, openRes] = await Promise.all([
    loadUpcomingTasks(supabase, 7),
    supabase
      .from("pages")
      .select("id, kind, plain_text, slide_title:content->slides->0->>title, deck_theme:content->>theme")
      .is("trashed_at", null)
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase.from("tasks").select("subject_id").eq("done", false),
  ]);

  const previews: Record<string, PagePreview> = {};
  for (const row of (recentRes.data ?? []) as unknown as PreviewRow[]) {
    previews[row.id] = {
      snippet: row.kind === "note" ? snippet(row.plain_text) : "",
      slideTitle: row.kind === "deck" ? row.slide_title : null,
      theme: (["paper", "ink", "blob"].includes(row.deck_theme ?? "") ? row.deck_theme : null) as DeckTheme | null,
    };
  }

  const openTasks: Record<string, number> = {};
  for (const t of openRes.data ?? []) {
    if (t.subject_id) openTasks[t.subject_id] = (openTasks[t.subject_id] ?? 0) + 1;
  }

  return <HomeView tasks={tasks} previews={previews} openTasks={openTasks} openTotal={openRes.data?.length ?? 0} />;
}
