import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { showText } from "@/i18n/messages/show";
import { getLocale, getMessages } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { findTopicMeta } from "@/learn/catalog";
import { ShowTopicList } from "@/learn/components/ShowViews";
import { ShowSkeleton } from "../../skeleton";

export async function generateMetadata({ params }: PageProps<"/show/[subject]/[topic]">): Promise<Metadata> {
  const { subject, topic } = await params;
  const meta = findTopicMeta(topic);
  if (meta?.subject !== subject) return {};
  const [t, locale] = await Promise.all([getMessages(showText), getLocale()]);
  const title = t.metaTopic(resolveText(meta.title, locale));
  const description = resolveText(meta.blurb, locale);
  return { title, description, openGraph: { title, description, siteName: "Blob", type: "website" } };
}

export default async function ShowTopicPage({ params }: PageProps<"/show/[subject]/[topic]">) {
  const { subject, topic } = await params;
  const meta = findTopicMeta(topic);
  if (meta?.subject !== subject) notFound();
  return (
    <Suspense fallback={<ShowSkeleton />}>
      <ShowTopicList slug={topic} />
    </Suspense>
  );
}
