import type { Metadata } from "next";
import { loadEvents } from "@/calendar/load";
import { themeSpecOf } from "@/components/deck/deck";
import { readPreview } from "@/ink/model";
import { HomeView } from "@/components/home/HomeView";
import { homeText } from "@/i18n/messages/home";
import { getMessages } from "@/i18n/server";
import { loadLearnState } from "@/learn/server";
import { loadProjectSummaries } from "@/components/projects/load";
import type { PagePreview } from "@/components/subjects/PageCards";
import { createClient, getUser } from "@/lib/supabase/server";
import { loadAssignedCards, loadUpcomingTasks } from "@/lib/tasks";
import type { PageKind } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(homeText)).title };
}

type PreviewRow = { id: string; kind: PageKind; plain_text: string | null; slide_title: string | null; deck_theme: string | null; deck_custom: unknown; ink_preview: unknown };

function snippet(text: string | null) {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > 200 ? `${flat.slice(0, 200).replace(/\s+\S*$/, "")}…` : flat;
}

export default async function HomePage() {
  const [supabase, user] = await Promise.all([createClient(), getUser()]);
  const [tasks, recentRes, openRes, learn, cvRes, projects, assigned, events] = await Promise.all([
    loadUpcomingTasks(supabase, 7),
    supabase
      .from("pages")
      .select("id, kind, plain_text, slide_title:content->slides->0->>title, deck_theme:content->>theme, deck_custom:content->custom, ink_preview:content->preview")
      .is("trashed_at", null)
      .order("updated_at", { ascending: false })
      .limit(8),
    // Your own tasks (project cards are counted on their boards).
    supabase.from("tasks").select("subject_id").is("project_id", null).eq("done", false),
    loadLearnState(),
    // Recent CVs show the top of their first page, which needs the whole CV (a few kilobytes).
    supabase.from("pages").select("id, content").eq("kind", "cv").is("trashed_at", null).order("updated_at", { ascending: false }).limit(6),
    user ? loadProjectSummaries(supabase, user.id, { archived: false, limit: 4 }) : [],
    user ? loadAssignedCards(supabase, user.id, 6) : [],
    // Today's events, worked out in the browser (the student's day, not the server's).
    loadEvents(supabase),
  ]);

  const previews: Record<string, PagePreview> = {};
  for (const row of (recentRes.data ?? []) as unknown as PreviewRow[]) {
    previews[row.id] = {
      snippet: row.kind === "note" ? snippet(row.plain_text) : "",
      slideTitle: row.kind === "deck" ? row.slide_title : null,
      theme: row.kind === "deck" ? themeSpecOf(row.deck_theme, row.deck_custom) : null,
      ink: row.kind === "ink" ? readPreview({ preview: row.ink_preview }) : null,
    };
  }

  const openTasks: Record<string, number> = {};
  for (const t of openRes.data ?? []) {
    if (t.subject_id) openTasks[t.subject_id] = (openTasks[t.subject_id] ?? 0) + 1;
  }

  const cvs: Record<string, unknown> = {};
  for (const row of cvRes.data ?? []) cvs[row.id] = row.content;

  return (
    <HomeView
      tasks={tasks}
      previews={previews}
      cvs={cvs}
      openTasks={openTasks}
      openTotal={openRes.data?.length ?? 0}
      learn={learn}
      projects={projects}
      assigned={assigned}
      events={events}
    />
  );
}
