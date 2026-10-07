"use client";

import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, ImageIcon, Maximize2, Minimize2, MousePointerClick } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BlobMark } from "@/components/blob/BlobMark";
import { useLocale, useMessages } from "@/i18n/client";
import { learnText } from "@/i18n/messages/learn";
import { showText } from "@/i18n/messages/show";
import { useText } from "@/i18n/useText";
import { studyHref, SUBJECTS } from "@/learn/catalog";
import { showHref, showItems, showTopicHref, type ShowItem } from "@/learn/showcase";
import { useTopic } from "@/learn/topics";
import { LEVELS, type Level, type Topic } from "@/learn/types";
import { cn } from "@/lib/utils";
import { LevelBars } from "./LevelBars";
import { Inline, Rich } from "./Rich";
import { ShareVisual } from "./ShareVisual";
import { TopicGlyph } from "./TopicGlyph";
import { topicNames } from "./topicNames";

/** The picture itself, in the same card as in the lesson. */
function VisualCard({ item, className }: { item: ShowItem; className?: string }) {
  const View = item.component;
  return (
    <div className={cn("rounded-2xl border border-line bg-raised p-4 shadow-card sm:p-6", className)}>
      <View {...item.props} />
    </div>
  );
}

function KindBadge({ kind }: { kind: ShowItem["kind"] }) {
  const t = useMessages(showText);
  return (
    <span className="inline-flex items-center gap-1 self-start rounded-full bg-blob-soft px-2 py-0.5 text-[11.5px] font-semibold text-blob-ink">
      {kind === "widget" ? <MousePointerClick className="size-3" /> : <ImageIcon className="size-3" />}
      {kind === "widget" ? t.interactive : t.picture}
    </span>
  );
}

function TopicHeader({ topic, small }: { topic: Topic; small?: boolean }) {
  const tt = useText();
  const names = topicNames(topic, useLocale());
  const subject = SUBJECTS.find((s) => s.slug === topic.subject);
  return (
    <div className="flex items-center gap-3">
      <div className={cn("grid shrink-0 place-items-center rounded-xl border border-line bg-raised shadow-card", small ? "size-11" : "size-14")}>
        <TopicGlyph topic={topic} size="sm" />
      </div>
      <div className="min-w-0">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-blob-ink">
          {subject ? tt(subject.title) : ""} · {names.area}
        </div>
        <Link href={showTopicHref(topic)} className={cn("block truncate font-display font-bold tracking-[-0.015em] hover:text-blob-ink", small ? "text-[16px]" : "text-[19px]")}>
          {names.title}
        </Link>
      </div>
    </div>
  );
}

/** All public pictures of a topic, level by level. */
export function ShowTopicList({ slug }: { slug: string }) {
  const topic = useTopic(slug);
  const t = useMessages(showText);
  const levels = useMessages(learnText).levels;
  const tt = useText();
  const names = topicNames(topic, useLocale());
  const items = showItems(topic);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-20 pt-8 sm:px-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative grid h-[104px] w-full shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-raised shadow-card sm:w-[168px]">
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-30" />
          <TopicGlyph topic={topic} size="lg" className="relative" />
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">{tt(SUBJECTS.find((s) => s.slug === topic.subject)!.title)} · {names.area}</div>
          <h1 className="mt-1 font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">{names.title}</h1>
          <p className="mt-1.5 max-w-[620px] text-[15px] leading-relaxed text-ink-2">{t.topicIntro}</p>
        </div>
      </div>

      {items.length === 0 && <p className="mt-10 rounded-2xl border border-dashed border-line-2 p-6 text-[14.5px] text-ink-3">{t.noItems}</p>}

      {LEVELS.map((level) => {
        const list = items.filter((i) => i.level === level);
        if (!list.length) return null;
        return (
          <section key={level} id={`level-${level}`} className="mt-10 scroll-mt-20">
            <h2 className="mb-3 flex items-baseline gap-2.5 font-display text-[19px] font-semibold tracking-[-0.01em]">
              <LevelBars level={level} className="text-blob-ink" />
              {levels[level]}
              <span className="text-[13px] font-normal text-ink-3">{tt(topic.levels[level].depth)}</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((item, i) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }} className="min-w-0">
                  <Link
                    href={showHref(topic, level, item.id)}
                    className="group flex h-full flex-col rounded-2xl border border-line bg-raised p-4 shadow-card transition-[border-color,transform] hover:-translate-y-0.5 hover:border-blob/45"
                  >
                    <KindBadge kind={item.kind} />
                    <span className="mt-2.5 font-display text-[16.5px] font-semibold leading-snug tracking-[-0.01em] group-hover:text-blob-ink">{tt(item.title)}</span>
                    {item.body && (
                      <span className="mt-1.5 line-clamp-3 text-[13.5px] leading-snug text-ink-3">
                        <Inline text={item.body} />
                      </span>
                    )}
                    <span className="mt-auto flex items-center gap-1 pt-3 text-[13px] font-medium text-ink-2 group-hover:text-blob-ink">
                      {t.openPage} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        );
      })}

      <LearnCard topic={topic} level={items[0]?.level ?? 1} />
    </div>
  );
}

function LearnCard({ topic, level }: { topic: Topic; level: Level }) {
  const t = useMessages(showText);
  return (
    <section className="mt-12 flex flex-col gap-4 rounded-2xl border border-line bg-raised p-5 shadow-card sm:flex-row sm:items-center sm:p-6">
      <BlobMark size={44} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-[18px] font-bold tracking-[-0.01em]">{t.learnTitle}</h2>
        <p className="mt-0.5 text-[14px] leading-relaxed text-ink-2">{t.learnText}</p>
      </div>
      <Link href={studyHref(topic, "lesson", level)} className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white hover:bg-blob/90">
        <BookOpen className="size-4" /> {t.learnCta}
      </Link>
    </section>
  );
}

const noSubscribe = () => () => {};

/** Follows the browser's full-screen state for one element. */
function useFullscreen() {
  const ref = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const sync = () => setFull(!!ref.current && document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void ref.current?.requestFullscreen?.();
  };
  return { ref, full, toggle };
}

/** One picture on its public page: title, explanation, the picture, sharing and the way to the lesson. */
export function ShowVisual({ slug, level, id }: { slug: string; level: Level; id: string }) {
  const topic = useTopic(slug);
  const t = useMessages(showText);
  const levels = useMessages(learnText).levels;
  const tt = useText();
  const items = showItems(topic);
  const index = items.findIndex((i) => i.level === level && i.id === id);
  const item = items[index];
  const { ref, full, toggle } = useFullscreen();
  // Not every browser can (iPhone Safari can't for elements): only offer it where it works.
  const canFull = useSyncExternalStore(noSubscribe, () => document.fullscreenEnabled, () => false);
  const title = item ? tt(item.title) : "";
  useEffect(() => {
    if (title) document.title = `${title} · ${tt(topic.title)} · Blob`;
  }, [title, topic, tt]);

  if (!item) {
    return (
      <div className="mx-auto w-full max-w-[880px] px-4 pb-20 pt-10 sm:px-6">
        <TopicHeader topic={topic} />
        <div className="mt-8 rounded-2xl border border-dashed border-line-2 p-6">
          <h1 className="font-display text-[22px] font-bold">{t.notFoundTitle}</h1>
          <p className="mt-1 text-[14.5px] text-ink-2">{t.notFoundText}</p>
          <Link href={showTopicHref(topic)} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[13.5px] font-medium text-paper">
            {t.allOfTopic} <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  const prev = items[index - 1];
  const next = items[index + 1];
  const others = items.filter((i) => i !== item).slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
      <TopicHeader topic={topic} small />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <KindBadge kind={item.kind} />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-[11.5px] font-medium text-ink-2">
          <LevelBars level={item.level} /> {levels[item.level]} · {tt(topic.levels[item.level].depth)}
        </span>
      </div>
      <div className="mt-2 flex items-start gap-3">
        <h1 className="min-w-0 flex-1 font-display text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]">{title}</h1>
        <div className="flex shrink-0 items-center gap-1 pt-1">
          {canFull && (
            <button
              type="button"
              onClick={toggle}
              className="flex h-8.5 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
            >
              <Maximize2 className="size-4" /> <span className="hidden sm:inline">{t.fullscreen}</span>
            </button>
          )}
          <ShareVisual topic={topic} level={item.level} id={item.id} title={item.title} />
        </div>
      </div>
      {item.body && <Rich text={item.body} className="mt-3 max-w-[720px] text-[16px] leading-relaxed text-ink-2" />}

      <div
        ref={ref}
        className={cn("mt-5", full && "flex h-full w-full flex-col overflow-auto bg-paper px-5 py-6 sm:px-10 sm:py-8")}
      >
        {full && (
          <div className="mx-auto mb-5 flex w-full max-w-[1200px] items-center gap-3">
            <BlobMark size={28} />
            <h2 className="min-w-0 flex-1 truncate font-display text-[24px] font-bold tracking-[-0.015em] sm:text-[30px]">{title}</h2>
            <button type="button" onClick={toggle} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
              <Minimize2 className="size-4" /> {t.exitFullscreen}
            </button>
          </div>
        )}
        <VisualCard item={item} className={cn(full && "mx-auto my-auto w-full max-w-[1200px]")} />
      </div>

      <nav className="mt-4 flex items-center justify-between gap-3 text-[13.5px]">
        {prev ? (
          <Link href={showHref(topic, prev.level, prev.id)} className="flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-ink-2 hover:bg-hover hover:text-ink">
            <ArrowLeft className="size-4 shrink-0" /> <span className="truncate">{tt(prev.title)}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={showHref(topic, next.level, next.id)} className="flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-right font-medium text-ink-2 hover:bg-hover hover:text-ink">
            <span className="truncate">{tt(next.title)}</span> <ArrowRight className="size-4 shrink-0" />
          </Link>
        )}
      </nav>

      <LearnCard topic={topic} level={item.level} />

      {others.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">{t.more}</h2>
            <Link href={showTopicHref(topic)} className="text-[13.5px] font-medium text-blob-ink hover:underline">
              {t.allOfTopic}
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {others.map((o) => (
              <Link
                key={`${o.level}-${o.id}`}
                href={showHref(topic, o.level, o.id)}
                className="flex items-center gap-2 rounded-xl border border-line bg-raised px-3 py-2 text-[13.5px] font-medium shadow-card hover:border-blob/45 hover:text-blob-ink"
              >
                <LevelBars level={o.level} className="text-ink-3" />
                {tt(o.title)}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** One picture alone, for an iframe on someone else's site. */
export function EmbedVisual({ slug, level, id, theme }: { slug: string; level: Level; id: string; theme?: "light" | "dark" }) {
  const topic = useTopic(slug);
  const t = useMessages(showText);
  const tt = useText();
  const item = showItems(topic).find((i) => i.level === level && i.id === id);

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="flex min-h-dvh flex-col gap-3 p-3 sm:p-4">
      {item ? (
        <>
          <div className="flex items-center gap-2">
            <h1 className="min-w-0 flex-1 truncate font-display text-[17px] font-bold tracking-[-0.01em]">{tt(item.title)}</h1>
          </div>
          <VisualCard item={item} />
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-line-2 p-5 text-[14px] text-ink-2">{t.notFoundText}</p>
      )}
      <a
        href={item ? showHref(topic, level, id) : showTopicHref(topic)}
        target="_blank"
        rel="noopener"
        className="mt-auto flex items-center gap-1.5 self-end rounded-lg px-2 py-1 text-[12.5px] font-medium text-ink-3 hover:text-blob-ink"
      >
        <BlobMark size={16} /> {t.openOnBlob} <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
