import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { learnText } from "@/i18n/messages/learn";
import { showText } from "@/i18n/messages/show";
import { getLocale, getMessages } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { findTopicMeta } from "@/learn/catalog";
import { EmbedVisual } from "@/learn/components/ShowViews";
import { parseLevel } from "@/learn/levels";

export async function generateMetadata({ params }: PageProps<"/embed/[subject]/[topic]/[level]/[id]">): Promise<Metadata> {
  const { subject, topic, level: raw } = await params;
  const meta = findTopicMeta(topic);
  const level = parseLevel(raw);
  if (meta?.subject !== subject || !level) return {};
  const [t, learn, locale] = await Promise.all([getMessages(showText), getMessages(learnText), getLocale()]);
  // The public /show page is the one to find; this copy lives inside other sites.
  return { title: t.metaVisual(resolveText(meta.title, locale), learn.levels[level]), robots: { index: false } };
}

/** One lesson picture alone, made to sit in an iframe on another site. `?theme=light|dark` fixes the colours. */
export default async function EmbedPage({ params, searchParams }: PageProps<"/embed/[subject]/[topic]/[level]/[id]">) {
  const [{ subject, topic, level: raw, id }, query] = await Promise.all([params, searchParams]);
  const meta = findTopicMeta(topic);
  const level = parseLevel(raw);
  if (meta?.subject !== subject || !level || !/^[a-z0-9-]{1,80}$/.test(id)) notFound();
  const theme = query.theme === "light" || query.theme === "dark" ? query.theme : undefined;
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <EmbedVisual slug={topic} level={level} id={id} theme={theme} />
    </Suspense>
  );
}
