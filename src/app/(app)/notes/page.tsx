import type { Metadata } from "next";
import { themeSpecOf } from "@/components/deck/deck";
import { NotesHome, type NotesQuery } from "@/components/notes/NotesHome";
import type { PagePreview } from "@/components/subjects/PageCards";
import { notesText } from "@/i18n/messages/notes";
import { getMessages } from "@/i18n/server";
import { loadDue } from "@/notes/server";
import { snippet } from "@/notes/snippet";
import { createClient } from "@/lib/supabase/server";
import type { PageKind } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(notesText)).metaTitle };
}

type Row = { id: string; kind: PageKind; plain_text: string | null; links: string[] | null; slide_title: string | null; deck_theme: string | null; deck_custom: unknown };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** All your notes, presentations and folders (and the ones shared with you): search, filters, tags and the knowledge graph. */
export default async function NotesPage({ searchParams }: PageProps<"/notes">) {
  const params = await searchParams;
  const supabase = await createClient();
  const [rowsRes, due] = await Promise.all([
    supabase
      .from("pages")
      .select("id, kind, plain_text, links, slide_title:content->slides->0->>title, deck_theme:content->>theme, deck_custom:content->custom")
      .is("trashed_at", null)
      .neq("kind", "cv"),
    loadDue(supabase),
  ]);

  // Only small previews and the links travel to the browser; the pages themselves come from the workspace.
  const previews: Record<string, PagePreview> = {};
  const links: Record<string, string[]> = {};
  for (const row of (rowsRes.data ?? []) as unknown as Row[]) {
    previews[row.id] = {
      snippet: row.kind === "note" ? snippet(row.plain_text) : "",
      slideTitle: row.kind === "deck" ? row.slide_title : null,
      theme: row.kind === "deck" ? themeSpecOf(row.deck_theme, row.deck_custom) : null,
    };
    if (row.links?.length) links[row.id] = row.links;
  }

  const query: NotesQuery = {
    q: one(params.q),
    subject: one(params.subject),
    tag: one(params.tag),
    kind: one(params.kind),
    owner: one(params.owner),
    topic: one(params.topic),
    sort: one(params.sort),
    view: one(params.view),
  };
  return <NotesHome previews={previews} links={links} due={due} initialQuery={query} />;
}
