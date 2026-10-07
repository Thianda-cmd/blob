import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LocaleProvider } from "@/i18n/client";
import { isLocale } from "@/i18n/config";
import { learnText } from "@/i18n/messages/learn";
import { showText } from "@/i18n/messages/show";
import { getLocale, getMessages } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { findTopicMeta } from "@/learn/catalog";
import { EmbedVisual } from "@/learn/components/ShowViews";
import { parseLevel } from "@/learn/levels";
import { manifestItem } from "@/learn/showManifest";

export async function generateMetadata({ params }: PageProps<"/embed/[subject]/[topic]/[level]/[id]">): Promise<Metadata> {
  const { subject, topic, level: raw, id } = await params;
  const meta = findTopicMeta(topic);
  const level = parseLevel(raw);
  if (meta?.subject !== subject || !level) return {};
  const [t, learn, locale] = await Promise.all([getMessages(showText), getMessages(learnText), getLocale()]);
  const item = manifestItem(meta.slug, level, id);
  const name = resolveText(meta.title, locale);
  // The public /show page is the one to find; this copy lives inside other sites.
  return { title: item ? t.metaPicture(item.title[locale], name) : t.metaVisual(name, learn.levels[level]), robots: { index: false } };
}

/**
 * One lesson picture alone, made to sit in an iframe on another site. `?lang=de|en` keeps the language the
 * teacher shared it in (cookies don't reach a frame on another site); `?theme=light|dark` fixes the colours
 * (applied before the first paint by the root layout's boot script).
 */
export default async function EmbedPage({ params, searchParams }: PageProps<"/embed/[subject]/[topic]/[level]/[id]">) {
  const [{ subject, topic, level: raw, id }, query] = await Promise.all([params, searchParams]);
  const meta = findTopicMeta(topic);
  const level = parseLevel(raw);
  if (meta?.subject !== subject || !level || raw !== String(level) || !/^[a-z0-9-]{1,80}$/.test(id)) notFound();
  const lang = isLocale(query.lang) ? query.lang : undefined;
  const picture = (
    <Suspense fallback={<div className="min-h-[200px]" />}>
      <EmbedVisual slug={topic} level={level} id={id} />
    </Suspense>
  );
  return lang ? <LocaleProvider locale={lang}>{picture}</LocaleProvider> : picture;
}
