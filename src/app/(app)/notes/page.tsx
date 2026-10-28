import type { Metadata } from "next";
import { themeSpecOf } from "@/components/deck/deck";
import { NotesHome, type NotesQuery } from "@/components/notes/NotesHome";
import type { PagePreview } from "@/components/subjects/PageCards";
import { notesText } from "@/i18n/messages/notes";
import { getMessages } from "@/i18n/server";
import { loadDue } from "@/notes/server";
import { readPreview } from "@/ink/preview";
import { snippet } from "@/notes/snippet";
import { createClient } from "@/lib/supabase/server";
import type { Attachment, PageKind, Project } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(notesText)).metaTitle };
}

type Row = { id: string; kind: PageKind; plain_text: string | null; links: string[] | null; slide_title: string | null; deck_theme: string | null; deck_custom: unknown; ink_preview: unknown };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** All your notes, presentations and folders (and the ones shared with you): search, filters, tags and the knowledge graph. */
export default async function NotesPage({ searchParams }: PageProps<"/notes">) {
  const params = await searchParams;
  const supabase = await createClient();
  const [rowsRes, due, cardsRes] = await Promise.all([
    supabase
      .from("pages")
      .select("id, kind, plain_text, links, slide_title:content->slides->0->>title, deck_theme:content->>theme, deck_custom:content->custom, ink_preview:content->preview")
      .is("trashed_at", null)
      .neq("kind", "cv"),
    loadDue(supabase),
    // The project cards' attachments: which pages are in which projects (the "Project" filter).
    supabase.from("tasks").select("project_id, attachments").not("project_id", "is", null).limit(3000),
  ]);

  // Only small previews and the links travel to the browser; the pages themselves come from the workspace.
  const previews: Record<string, PagePreview> = {};
  const links: Record<string, string[]> = {};
  for (const row of (rowsRes.data ?? []) as unknown as Row[]) {
    previews[row.id] = {
      snippet: row.kind === "note" ? snippet(row.plain_text) : "",
      slideTitle: row.kind === "deck" ? row.slide_title : null,
      theme: row.kind === "deck" ? themeSpecOf(row.deck_theme, row.deck_custom) : null,
      ink: row.kind === "ink" ? readPreview({ preview: row.ink_preview }) : null,
    };
    if (row.links?.length) links[row.id] = row.links;
  }

  const pageProjects: Record<string, string[]> = {};
  for (const card of (cardsRes.data ?? []) as { project_id: string; attachments: Attachment[] | null }[]) {
    for (const a of card.attachments ?? []) {
      if (a?.type !== "page") continue;
      const list = (pageProjects[a.page_id] ??= []);
      if (!list.includes(card.project_id)) list.push(card.project_id);
    }
  }
  const projectIds = [...new Set(Object.values(pageProjects).flat())];
  const projects = projectIds.length
    ? (((await supabase.from("projects").select("id, title, icon, color").in("id", projectIds)).data ?? []) as Pick<Project, "id" | "title" | "icon" | "color">[])
    : [];

  const query: NotesQuery = {
    q: one(params.q),
    subject: one(params.subject),
    tag: one(params.tag),
    kind: one(params.kind),
    owner: one(params.owner),
    project: one(params.project),
    topic: one(params.topic),
    sort: one(params.sort),
    view: one(params.view),
  };
  return <NotesHome previews={previews} links={links} due={due} initialQuery={query} projects={projects} pageProjects={pageProjects} />;
}
