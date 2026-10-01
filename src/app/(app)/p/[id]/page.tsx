import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeckEditor } from "@/components/deck/DeckEditor";
import { NoteEditor } from "@/components/editor/NoteEditor";
import { TrashedNotice } from "@/components/page/TrashedNotice";
import { createClient } from "@/lib/supabase/server";
import type { Page } from "@/lib/types";
import { pageTitle } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadPage(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("pages").select("*").eq("id", id).maybeSingle();
  return data as Page | null;
}

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const page = await loadPage((await params).id);
  return { title: page ? pageTitle(page.title, page.kind) : "Not found" };
}

export default async function PageRoute({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const page = await loadPage(id);
  if (!page) notFound();
  if (page.trashed_at) return <TrashedNotice page={page} />;
  return page.kind === "deck" ? <DeckEditor key={page.id} page={page} /> : <NoteEditor key={page.id} page={page} />;
}
