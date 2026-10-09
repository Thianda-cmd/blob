import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CvEditor } from "@/components/cv/CvEditor";
import { DeckEditor } from "@/components/deck/DeckEditor";
import { NoteEditor } from "@/components/editor/NoteEditor";
import { FileSweep } from "@/components/files/FileSweep";
import { themeSpecOf } from "@/components/deck/deck";
import { FolderView } from "@/components/notes/FolderView";
import type { PagePreview } from "@/components/subjects/PageCards";
import { snippet } from "@/notes/snippet";
import { TrashedNotice } from "@/components/page/TrashedNotice";
import { pageText } from "@/i18n/messages/page";
import { getLocale } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { AccessRole, Member, Page, PageKind } from "@/lib/types";
import { pageTitle } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadPage(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("pages").select("*").eq("id", id).maybeSingle();
  return data as Page | null;
}

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const [page, locale] = await Promise.all([params.then(({ id }) => loadPage(id)), getLocale()]);
  return { title: page ? pageTitle(page.title, page.kind, locale) : pageText[locale].notFound };
}

/** Your role on the page and everyone on it (owner first): more than one person means it is shared. */
async function loadAccess(id: string): Promise<{ role: AccessRole; members: Member[] }> {
  const supabase = await createClient();
  const [role, members] = await Promise.all([
    supabase.rpc("page_role", { p_page: id }),
    supabase.rpc("member_profiles", { p_type: "page", p_target: id }),
  ]);
  const list = ((members.data ?? []) as Member[]).sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0));
  return { role: (role.data as AccessRole | null) ?? "owner", members: list };
}

type PreviewRow = { id: string; kind: PageKind; plain_text: string | null; slide_title: string | null; deck_theme: string | null; deck_custom: unknown };

/** Small previews of a folder's pages (the pages themselves come from the workspace). */
async function loadFolderPreviews(id: string): Promise<Record<string, PagePreview>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pages")
    .select("id, kind, plain_text, slide_title:content->slides->0->>title, deck_theme:content->>theme, deck_custom:content->custom")
    .eq("parent_id", id)
    .is("trashed_at", null);
  const previews: Record<string, PagePreview> = {};
  for (const row of (data ?? []) as unknown as PreviewRow[]) {
    previews[row.id] = {
      snippet: row.kind === "note" ? snippet(row.plain_text) : "",
      slideTitle: row.kind === "deck" ? row.slide_title : null,
      theme: row.kind === "deck" ? themeSpecOf(row.deck_theme, row.deck_custom) : null,
    };
  }
  return previews;
}

export default async function PageRoute({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const page = await loadPage(id);
  if (!page) notFound();
  if (page.trashed_at) return <TrashedNotice page={page} />;
  if (page.kind === "cv") return <CvEditor key={page.id} page={page} />;
  if (page.kind === "folder") {
    const [{ role, members }, previews] = await Promise.all([loadAccess(page.id), loadFolderPreviews(page.id)]);
    return <FolderView key={page.id} page={page} role={role} members={members} previews={previews} />;
  }
  const { role, members } = await loadAccess(page.id);
  if (page.kind === "deck") return <DeckEditor key={page.id} page={page} role={role} members={members} />;
  return (
    <>
      <NoteEditor key={page.id} page={page} role={role} members={members} />
      {/* Files of deleted file blocks: removed once nobody uses them (only editors may). */}
      {(role === "owner" || role === "editor") && <FileSweep key={`files-${page.id}`} kind="page" id={page.id} />}
    </>
  );
}
