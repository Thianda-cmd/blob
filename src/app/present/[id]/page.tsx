import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { normalizeDeck } from "@/components/deck/deck";
import { Presenter } from "@/components/deck/Presenter";
import { createClient } from "@/lib/supabase/server";
import type { Page } from "@/lib/types";
import { pageTitle } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadDeck(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("pages").select("id, kind, title, content, trashed_at").eq("id", id).maybeSingle();
  const page = data as Pick<Page, "id" | "kind" | "title" | "content" | "trashed_at"> | null;
  if (!page || page.kind !== "deck" || page.trashed_at) return null;
  return page;
}

export async function generateMetadata({ params }: PageProps<"/present/[id]">): Promise<Metadata> {
  const page = await loadDeck((await params).id);
  return { title: page ? `Presenting ${pageTitle(page.title, "deck")}` : "Not found" };
}

export default async function PresentPage({ params, searchParams }: PageProps<"/present/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const page = await loadDeck(id);
  if (!page) notFound();

  const deck = normalizeDeck(page.content);
  const requested = Number(Array.isArray(query.slide) ? query.slide[0] : query.slide);
  const start = Number.isInteger(requested) ? Math.min(Math.max(requested - 1, 0), deck.slides.length - 1) : 0;

  // ?view=speaker opens the speaker view (used for the second window).
  const view = query.view === "speaker" ? "speaker" : "audience";

  return <Presenter pageId={page.id} title={pageTitle(page.title, "deck")} deck={deck} start={start} initialView={view} />;
}
