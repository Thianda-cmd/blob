import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { learnText } from "@/i18n/messages/learn";
import { showText } from "@/i18n/messages/show";
import { getLocale, getMessages } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { findTopicMeta } from "@/learn/catalog";
import { ShowVisual } from "@/learn/components/ShowViews";
import { parseLevel } from "@/learn/levels";
import { ShowSkeleton } from "../../../../skeleton";

export async function generateMetadata({ params }: PageProps<"/show/[subject]/[topic]/[level]/[id]">): Promise<Metadata> {
  const { subject, topic, level: raw } = await params;
  const meta = findTopicMeta(topic);
  const level = parseLevel(raw);
  if (meta?.subject !== subject || !level) return {};
  const [t, learn, locale] = await Promise.all([getMessages(showText), getMessages(learnText), getLocale()]);
  // The picture's own title lives in the (client-side) lesson; the topic and level name it well enough.
  const title = t.metaVisual(resolveText(meta.title, locale), learn.levels[level]);
  const description = resolveText(meta.levels[level].blurb ?? meta.blurb, locale);
  return { title, description, openGraph: { title, description, siteName: "Blob", type: "website" } };
}

export default async function ShowVisualPage({ params }: PageProps<"/show/[subject]/[topic]/[level]/[id]">) {
  const { subject, topic, level: raw, id } = await params;
  const meta = findTopicMeta(topic);
  const level = parseLevel(raw);
  if (meta?.subject !== subject || !level || !/^[a-z0-9-]{1,80}$/.test(id)) notFound();
  return (
    <Suspense fallback={<ShowSkeleton />}>
      <ShowVisual slug={topic} level={level} id={id} />
    </Suspense>
  );
}
