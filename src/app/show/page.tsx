import type { Metadata } from "next";
import { ImageIcon } from "lucide-react";
import Link from "next/link";
import { showText } from "@/i18n/messages/show";
import { getLocale, getMessages } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { SUBJECTS, subjectCatalog, type Subject } from "@/learn/catalog";
import { TopicGlyph } from "@/learn/components/TopicGlyph";
import { showTopicHref } from "@/learn/showcase";
import { manifestItems } from "@/learn/showManifest";
import { AREAS } from "@/learn/types";
import { SubjectNav } from "./SubjectNav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(showText);
  return { title: t.metaGallery, description: t.metaGalleryDescription, openGraph: { title: t.metaGallery, description: t.metaGalleryDescription, siteName: "Blob", type: "website" } };
}

/** Every live subject with its topics that have pictures, grouped by area in the subject's order. */
function gallerySubjects() {
  return SUBJECTS.filter((s) => s.live).flatMap((info) => {
    // Topics without pictures stay out (a topic the manifest doesn't know yet is shown).
    const topics = subjectCatalog(info.slug as Subject).filter((topic) => manifestItems(topic.slug)?.length !== 0);
    if (!topics.length) return [];
    // The subject's areas in its order, then any area only its topics name, so a new area always shows.
    const groups = [...new Set([...(info.areas ?? []), ...topics.map((t) => t.area)])]
      .map((area) => ({ area, topics: topics.filter((t) => t.area === area) }))
      .filter((g) => g.topics.length > 0);
    const pictures = topics.reduce((n, t) => n + (manifestItems(t.slug)?.length ?? 0), 0);
    return [{ info, topics, groups, pictures }];
  });
}

/**
 * Every topic with its public pictures: subject by subject (with jump links), area by area. Areas are panels
 * that flow into columns, so a subject with many topics stays one compact, scannable block.
 */
export default async function ShowGallery() {
  const [t, locale] = await Promise.all([getMessages(showText), getLocale()]);
  const subjects = gallerySubjects();
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-7 sm:px-6 sm:pt-10">
      <h1 className="max-w-[720px] font-display text-[30px] font-bold leading-tight tracking-[-0.02em] sm:text-[40px]">{t.galleryTitle}</h1>
      <p className="mt-2.5 max-w-[680px] text-[15px] leading-relaxed text-ink-2 sm:text-[16px]">{t.galleryIntro}</p>

      {/* A direct child of the page, so it can stay stuck under the header all the way down. */}
      {subjects.length > 1 && (
        <SubjectNav
          label={t.subjectsNav}
          className="mt-6 sm:mt-8"
          items={subjects.map((s) => ({ id: s.info.slug, title: resolveText(s.info.title, locale), count: s.topics.length, hint: t.galleryCount(s.topics.length) }))}
        />
      )}

      {subjects.map(({ info, topics, groups, pictures }) => (
        // Subjects far down the page skip layout and paint until they come near (the gallery grows with every topic).
        <section key={info.slug} id={info.slug} className="mt-8 scroll-mt-[112px] [contain-intrinsic-size:auto_1200px] [content-visibility:auto] sm:mt-10">
          <h2 className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-display text-[22px] font-bold tracking-[-0.015em] sm:mb-4 sm:text-[24px]">
            {resolveText(info.title, locale)}
            <span className="text-[13px] font-normal text-ink-3">
              {t.galleryCount(topics.length)} · {t.pictureCount(pictures)}
            </span>
          </h2>
          <div className="gap-3 sm:columns-2 lg:columns-3">
            {groups.map(({ area, topics: list }) => (
              <div key={area} className="mb-3 break-inside-avoid rounded-2xl border border-line bg-raised p-1.5 shadow-card">
                <h3 className="flex items-baseline justify-between gap-2 px-2.5 pb-1 pt-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                  {resolveText(AREAS[area].title, locale)}
                  <span className="font-medium normal-case tracking-normal tabular-nums">{list.length}</span>
                </h3>
                <ul>
                  {list.map((topic) => {
                    const count = manifestItems(topic.slug)?.length;
                    return (
                      <li key={topic.slug}>
                        <Link href={showTopicHref(topic)} className="group flex min-w-0 items-center gap-3 rounded-xl p-2 transition-colors hover:bg-hover">
                          <span className="grid h-12 w-[104px] shrink-0 place-items-center overflow-hidden rounded-lg bg-surface px-1">
                            {/* Only what the picture needs goes to the browser, not the whole catalog entry. */}
                            <TopicGlyph topic={{ glyph: topic.glyph, icon: topic.icon }} size="sm" className="max-w-full" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <span className="min-w-0 font-display text-[15px] font-semibold leading-snug tracking-[-0.01em] group-hover:text-blob-ink">{resolveText(topic.title, locale)}</span>
                              {count !== undefined && (
                                <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[12px] font-medium tabular-nums text-blob-ink" title={t.pictureCount(count)}>
                                  <ImageIcon className="size-3" aria-hidden />
                                  <span aria-hidden>{count}</span>
                                  <span className="sr-only">{t.pictureCount(count)}</span>
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 line-clamp-1 text-[12.5px] leading-snug text-ink-3 sm:line-clamp-2">{resolveText(topic.blurb, locale)}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
