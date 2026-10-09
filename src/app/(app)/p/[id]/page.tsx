import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CvEditor } from "@/components/cv/CvEditor";
import { DeckEditor } from "@/components/deck/DeckEditor";
import { NoteEditor } from "@/components/editor/NoteEditor";
import { TrashedNotice } from "@/components/page/TrashedNotice";
import { pageText } from "@/i18n/messages/page";
import { getLocale } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { AccessRole, Member, Page } from "@/lib/types";
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

export default async function PageRoute({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const page = await loadPage(id);
  if (!page) notFound();
  if (page.trashed_at) return <TrashedNotice page={page} />;
  if (page.kind === "cv") return <CvEditor key={page.id} page={page} />;
  const { role, members } = await loadAccess(page.id);
  return page.kind === "deck" ? (
    <DeckEditor key={page.id} page={page} role={role} members={members} />
  ) : (
    <NoteEditor key={page.id} page={page} role={role} members={members} />
  );
}
