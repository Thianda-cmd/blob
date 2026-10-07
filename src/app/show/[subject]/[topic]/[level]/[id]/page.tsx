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
import { showHref } from "@/learn/showcase";
import { manifestItem, manifestItems } from "@/learn/showManifest";
import { ShowSkeleton } from "../../../../skeleton";

type Params = { subject: string; topic: string; level: string; id: string };

/** The picture's topic and level, or nothing when the address can't be one (only "1", "2", "3" count as levels). */
function resolve({ subject, topic, level: raw, id }: Params) {
  const meta = findTopicMeta(topic);
  const level = parseLevel(raw);
  if (meta?.subject !== subject || !level || raw !== String(level) || !/^[a-z0-9-]{1,80}$/.test(id)) return null;
  return { meta, level };
}

export async function generateMetadata({ params }: PageProps<"/show/[subject]/[topic]/[level]/[id]">): Promise<Metadata> {
  const p = await params;
  const found = resolve(p);
  if (!found) return {};
  const { meta, level } = found;
  const [t, learn, locale] = await Promise.all([getMessages(showText), getMessages(learnText), getLocale()]);
  const topic = resolveText(meta.title, locale);
  const item = manifestItem(meta.slug, level, p.id);
  const known = manifestItems(meta.slug);
  const title = item ? t.metaPicture(item.title[locale], topic) : t.metaVisual(topic, learn.levels[level]);
  const description = item?.text?.[locale] ?? resolveText(meta.levels[level].blurb ?? meta.blurb, locale);
  const url = showHref(meta, level, p.id);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "Blob", type: "website" },
    // A picture the lessons don't have (any more): the page explains that, but search engines shouldn't keep it.
    ...(known && !item ? { robots: { index: false } } : {}),
  };
}

export default async function ShowVisualPage({ params }: PageProps<"/show/[subject]/[topic]/[level]/[id]">) {
  const p = await params;
  const found = resolve(p);
  if (!found) notFound();
  return (
    <Suspense fallback={<ShowSkeleton />}>
      <ShowVisual slug={found.meta.slug} level={found.level} id={p.id} />
    </Suspense>
  );
}
