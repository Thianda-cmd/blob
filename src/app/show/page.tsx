import type { Metadata } from "next";
import Link from "next/link";
import { showText } from "@/i18n/messages/show";
import { getLocale, getMessages } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { SUBJECTS, subjectCatalog, type Subject } from "@/learn/catalog";
import { TopicGlyph } from "@/learn/components/TopicGlyph";
import { showTopicHref } from "@/learn/showcase";
import { AREAS } from "@/learn/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(showText);
  return { title: t.metaGallery, description: t.metaGalleryDescription, openGraph: { title: t.metaGallery, description: t.metaGalleryDescription, siteName: "Blob", type: "website" } };
}

/** Every topic with its public pictures, subject by subject. */
export default async function ShowGallery() {
  const [t, locale] = await Promise.all([getMessages(showText), getLocale()]);
  const subjects = SUBJECTS.filter((s) => s.live);
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-20 pt-10 sm:px-6">
      <h1 className="max-w-[720px] font-display text-[34px] font-bold leading-tight tracking-[-0.02em] sm:text-[42px]">{t.galleryTitle}</h1>
      <p className="mt-3 max-w-[680px] text-[16px] leading-relaxed text-ink-2">{t.galleryIntro}</p>
      {subjects.map((s) => {
        const topics = subjectCatalog(s.slug as Subject);
        return (
          <section key={s.slug} className="mt-12">
            <h2 className="mb-4 flex items-baseline gap-3 font-display text-[24px] font-bold tracking-[-0.015em]">
              {resolveText(s.title, locale)}
              <span className="text-[13.5px] font-normal text-ink-3">{t.galleryCount(topics.length)}</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((topic) => (
                <Link
                  key={topic.slug}
                  href={showTopicHref(topic)}
                  className="group flex min-w-0 items-center gap-3.5 rounded-2xl border border-line bg-raised p-3.5 shadow-card transition-[border-color,transform] hover:-translate-y-0.5 hover:border-blob/45"
                >
                  <span className="grid h-14 w-[104px] shrink-0 place-items-center overflow-hidden rounded-xl bg-surface px-1">
                    <TopicGlyph topic={topic} size="sm" className="max-w-full" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{resolveText(AREAS[topic.area].title, locale)}</span>
                    <span className="block truncate font-display text-[16.5px] font-semibold tracking-[-0.01em] group-hover:text-blob-ink">{resolveText(topic.title, locale)}</span>
                    <span className="line-clamp-2 text-[12.5px] leading-snug text-ink-3">{resolveText(topic.blurb, locale)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
