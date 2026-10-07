import { notFound, redirect } from "next/navigation";
import { findTopicMeta } from "@/learn/catalog";
import { parseLevel } from "@/learn/levels";
import { showTopicHref } from "@/learn/showcase";

/** A level without a picture: the topic's pictures, scrolled to that level. */
export default async function ShowLevelPage({ params }: PageProps<"/show/[subject]/[topic]/[level]">) {
  const { subject, topic, level: raw } = await params;
  const meta = findTopicMeta(topic);
  const level = parseLevel(raw);
  if (meta?.subject !== subject || !level) notFound();
  redirect(`${showTopicHref(meta)}#level-${level}`);
}
