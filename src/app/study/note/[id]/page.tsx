import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NoteStudy, type StudyMode, type StudyPage } from "@/components/notes/study/NoteStudy";
import { studyText } from "@/i18n/messages/study";
import { getLocale } from "@/i18n/server";
import { loadPool } from "@/notes/server";
import type { Review } from "@/notes/study/srs";
import { createClient, getUser } from "@/lib/supabase/server";
import type { AccessRole } from "@/lib/types";
import { pageTitle } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const modeOf = (v: string | string[] | undefined): StudyMode => (v === "quiz" || v === "summary" ? v : "cards");

async function loadPage(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("pages")
    .select("id, user_id, kind, title, icon, content, subject_id, parent_id, tags, topics, trashed_at")
    .eq("id", id)
    .maybeSingle();
  return data as (StudyPage & { kind: string; trashed_at: string | null }) | null;
}

export async function generateMetadata({ params, searchParams }: PageProps<"/study/note/[id]">): Promise<Metadata> {
  const [{ id }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const page = await loadPage(id);
  const t = studyText[locale].meta;
  if (!page) return { title: t.notFound };
  return { title: t[modeOf(query.mode)](pageTitle(page.title, "note", locale)) };
}

/** Flashcards, quiz and summary of one note, full screen. */
export default async function NoteStudyPage({ params, searchParams }: PageProps<"/study/note/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const page = await loadPage(id);
  if (!page || page.trashed_at) notFound();
  if (page.kind !== "note") redirect(`/p/${page.id}`);
  const user = await getUser();
  const supabase = await createClient();
  const [reviewsRes, roleRes, pool] = await Promise.all([
    supabase.from("card_reviews").select("card_id, box, due_on, reviews, lapses, last_reviewed").eq("page_id", page.id),
    supabase.rpc("page_role", { p_page: page.id }),
    loadPool(supabase, page),
  ]);
  return (
    <NoteStudy
      key={page.id}
      page={{ id: page.id, user_id: page.user_id, title: page.title, icon: page.icon, content: page.content, subject_id: page.subject_id, parent_id: page.parent_id, tags: page.tags, topics: page.topics }}
      userId={user?.id ?? ""}
      role={(roleRes.data as AccessRole | null) ?? "viewer"}
      reviews={(reviewsRes.data ?? []) as Review[]}
      pool={pool}
      initialMode={modeOf(query.mode)}
      // A new order of quiz questions on every visit (this page renders per request).
      // eslint-disable-next-line react-hooks/purity
      seed={Date.now() % 2147483647}
    />
  );
}
