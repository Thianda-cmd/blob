import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { normalizeDeck } from "@/components/deck/deck";
import { Presenter } from "@/components/deck/Presenter";
import { presentText } from "@/i18n/messages/present";
import { getLocale } from "@/i18n/server";
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
  const [page, locale] = await Promise.all([params.then((p) => loadDeck(p.id)), getLocale()]);
  const t = presentText[locale];
  return { title: page ? t.metaTitle(pageTitle(page.title, "deck", locale)) : t.metaNotFound };
}

export default async function PresentPage({ params, searchParams }: PageProps<"/present/[id]">) {
  const [{ id }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const page = await loadDeck(id);
  if (!page) notFound();

  const deck = normalizeDeck(page.content);
  const requested = Number(Array.isArray(query.slide) ? query.slide[0] : query.slide);
  const start = Number.isInteger(requested) ? Math.min(Math.max(requested - 1, 0), deck.slides.length - 1) : 0;

  // ?view=speaker opens the speaker view (used for the second window).
  const view = query.view === "speaker" ? "speaker" : "audience";

  return <Presenter pageId={page.id} title={pageTitle(page.title, "deck", locale)} deck={deck} start={start} initialView={view} />;
}
