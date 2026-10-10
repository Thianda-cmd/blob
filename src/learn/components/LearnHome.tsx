"use client";

import { motion } from "motion/react";
import { ArrowRight, BookOpen, Check, Clock, Dumbbell, Flame, GraduationCap, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Blob, type BlobHandle } from "@/components/blob/Blob";
import { TopBar } from "@/components/shell/TopBar";
import { useLocale, useMessages } from "@/i18n/client";
import { learnText } from "@/i18n/messages/learn";
import { useText } from "@/i18n/useText";
import { firstLessonMinutes, studyHref, subjectCatalog, SUBJECTS, topicHref, upNext, type Subject, type TopicMeta } from "@/learn/catalog";
import { levelProgress, type LevelRows, suggestedLevel } from "@/learn/levels";
import { DAILY_GOAL, EMPTY_PROGRESS, masteryLabel, type LearnDay, type TopicProgress } from "@/learn/progress";
import { useToday, useTodayXp } from "@/learn/session";
import { AREAS, LEVELS } from "@/learn/types";
import { cn } from "@/lib/utils";
import { Ring } from "./Ring";
import { TopicGlyph } from "./TopicGlyph";
import { topicNames } from "./topicNames";

export function LearnHome({
  subject,
  progress,
  levels,
  days,
}: {
  subject: Subject;
  progress: Record<string, TopicProgress>;
  levels: LevelRows;
  days: LearnDay[];
}) {
  const today = useTodayXp(days);
  const catalog = subjectCatalog(subject);
  const info = SUBJECTS.find((s) => s.slug === subject)!;
  // A subject that just went live may not have topics yet.
  const next = catalog.length ? upNext(catalog, progress) : null;
  const totalXp = Object.values(progress).reduce((s, p) => s + p.xp, 0);
  const mastered = catalog.filter((t) => (progress[t.slug]?.mastery ?? 0) >= 85).length;
  const lessons = catalog.filter((t) => progress[t.slug]?.lesson_done).length;
  const avgMastery = catalog.length ? Math.round(catalog.reduce((s, t) => s + (progress[t.slug]?.mastery ?? 0), 0) / catalog.length) : 0;
  // The subject's areas in its order, then any area only its topics name, so a new area always shows.
  const groups = [...new Set([...(info.areas ?? []), ...catalog.map((t) => t.area)])]
    .map((area) => ({ area, topics: catalog.filter((t) => t.area === area) }))
    .filter((g) => g.topics.length > 0);
  const shown = groups.flatMap((g) => g.topics);
  // Cards fade in one after another, capped so long lists don't keep the last ones waiting.
  const delay = (topic: TopicMeta) => Math.min(shown.indexOf(topic), 12) * 0.035;
  const t = useMessages(learnText);
  const tt = useText();
  const soon = SUBJECTS.filter((s) => !s.live).map((s) => tt(s.title));

  return (
    <>
      <TopBar crumbs={[{ label: t.learn, icon: <GraduationCap className="size-3.5" /> }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1320px] px-5 pb-16 pt-3 sm:px-8">
          <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">
                <GraduationCap className="size-3.5" /> {t.home.eyebrow}
              </div>
              <h1 className="mt-1 font-display text-[32px] font-bold leading-none tracking-[-0.02em]">{t.learn}</h1>
              <p className="mt-2 text-[14.5px] text-ink-2">{t.home.intro}</p>
            </div>
            {/* Phones: three equal tiles in one row; wider: chips side by side. */}
            <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              <StatChip icon={<Flame className="size-4" />} label={t.dayStreak} value={today.streak} hot={today.streak > 0} />
              <div className={cn(CHIP, "sm:pl-2")}>
                <Ring value={today.xp / DAILY_GOAL} size={34} stroke={4} className="max-sm:-m-0.5">
                  <Zap className="size-3.5 text-blob" />
                </Ring>
                <div className="min-w-0 leading-tight">
                  <div className="text-[14px] font-semibold tabular-nums">
                    {today.xp}
                    <span className="font-normal text-ink-3"> / {DAILY_GOAL} XP</span>
                  </div>
                  <div className="text-[11.5px] text-ink-3">{today.xp >= DAILY_GOAL ? t.home.goalReached : t.dailyGoal}</div>
                </div>
              </div>
              <StatChip icon={<Trophy className="size-4" />} label={t.home.totalXp} value={totalXp} />
            </div>
          </header>

          <SubjectTabs subject={subject} />

          <div className="mt-6 grid gap-8 sm:mt-7 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-8 sm:space-y-9">
              {next ? (
                <UpNext topic={next} progress={progress[next.slug] ?? EMPTY_PROGRESS(next.slug)} levels={levels} />
              ) : (
                <div className="rounded-2xl border border-dashed border-line-2 p-5 text-[14px] text-ink-2">{t.home.noTopics}</div>
              )}

              {groups.map(({ area, topics }) => (
                <section key={area}>
                  <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <h2 className="hyphens-auto font-display text-[19px] font-semibold tracking-[-0.01em] break-words">{tt(AREAS[area].title)}</h2>
                    <span className="text-[13px] text-ink-3">{tt(AREAS[area].blurb)}</span>
                  </div>
                  {/* As many columns as fit; a lone card keeps its column width. */}
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] gap-3">
                    {topics.map((t) => (
                      <TopicCard key={t.slug} topic={t} progress={progress[t.slug]} levels={levels} delay={delay(t)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Tablets: two cards side by side; wide screens: a sticky column. */}
            <aside className="grid content-start gap-4 sm:grid-cols-2 xl:sticky xl:top-6 xl:grid-cols-1 xl:self-start">
              <WeekCard days={days} />
              <div className="rounded-2xl border border-line bg-raised p-4 shadow-card">
                <div className="text-[13px] font-semibold">{t.home.yourSubject(tt(info.title))}</div>
                <div className="mt-3 flex items-center gap-4">
                  <Ring value={avgMastery / 100} size={72} stroke={7}>
                    <span className="text-[17px] font-bold tabular-nums">{t.pct(avgMastery)}</span>
                  </Ring>
                  <div className="space-y-1 text-[13px] text-ink-2">
                    <div>
                      <span className="font-semibold text-ink tabular-nums">{lessons}</span> {t.home.lessonsDone(catalog.length)}
                    </div>
                    <div>
                      <span className="font-semibold text-ink tabular-nums">{mastered}</span> {t.home.topicsMastered(mastered)}
                    </div>
                    <div>{t.home.averageMastery}</div>
                  </div>
                </div>
              </div>
              <Link
                href="/learn/french"
                className="group flex items-center gap-3 rounded-2xl border border-line bg-raised p-4 shadow-card transition-[transform,border-color] hover:-translate-y-0.5 hover:border-line-2"
              >
                <Blob size={64} mood="happy" accessory="beret" interactive={false} className="shrink-0" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">🇫🇷 {t.home.frenchTitle}</div>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{t.home.frenchText}</p>
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-blob-ink">
                    {t.home.frenchCta} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
              {soon.length > 0 && (
                <div className="rounded-2xl border border-dashed border-line-2 p-4 sm:col-span-2 xl:col-span-1">
                  <div className="text-[13px] font-semibold">{t.home.moreSoon}</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{t.home.moreSoonText(soon)}</p>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * The subject tabs. More subjects than fit scroll sideways: the open one is scrolled into view
 * and the edges fade where more tabs wait.
 */
/** The learning center's subjects as tabs (the French course is one of them). */
export function SubjectTabs({ subject }: { subject: string }) {
  const t = useMessages(learnText);
  const tt = useText();
  const ref = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>("[aria-current=page]");
    if (active && (active.offsetLeft < nav.scrollLeft || active.offsetLeft + active.offsetWidth > nav.scrollLeft + nav.clientWidth)) {
      nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    }
    const update = () => {
      const start = nav.scrollLeft > 1;
      const end = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1;
      setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
    };
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    nav.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      nav.removeEventListener("scroll", update);
    };
  }, [subject]);

  const fade = edges.start || edges.end ? `linear-gradient(to right, ${edges.start ? "transparent, black 40px" : "black"}, ${edges.end ? "black calc(100% - 40px), transparent" : "black"})` : undefined;
  return (
    <div className="mt-5 border-b border-line sm:mt-6">
      <nav
        ref={ref}
        className="relative -mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: fade, WebkitMaskImage: fade }}
        aria-label={t.home.subjects}
      >
        {SUBJECTS.map((s) =>
          s.live ? (
            <Link
              key={s.slug}
              href={`/learn/${s.slug}`}
              aria-current={s.slug === subject ? "page" : undefined}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 pb-2.5 pt-1.5 text-[14px] font-medium transition-colors",
                s.slug === subject ? "text-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              {tt(s.title)}
              {s.slug === subject && (
                <motion.span layoutId="learn-subject" transition={{ type: "spring", stiffness: 500, damping: 38 }} className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-blob" />
              )}
            </Link>
          ) : (
            <span
              key={s.slug}
              className="relative flex shrink-0 cursor-default items-center gap-1.5 whitespace-nowrap px-3 pb-2.5 pt-1.5 text-[14px] font-medium text-ink-3"
              title={t.home.comingSoon}
            >
              {tt(s.title)}
              <span className="rounded-full bg-hover px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide text-ink-3">{t.home.soon}</span>
            </span>
          ),
        )}
      </nav>
    </div>
  );
}

/** A stat in the header: a tile on phones (icon above the number), a chip from sm. */
export const CHIP =
  "flex min-w-0 flex-col items-start gap-1.5 rounded-xl border border-line bg-raised p-2.5 shadow-card sm:h-12 sm:flex-row sm:items-center sm:gap-2.5 sm:py-0 sm:pl-3.5 sm:pr-3.5";

export function StatChip({ icon, label, value, hot }: { icon: React.ReactNode; label: string; value: number; hot?: boolean }) {
  return (
    <div className={CHIP}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", hot ? "bg-blob text-white" : "bg-hover text-ink-2")}>{icon}</span>
      <div className="min-w-0 leading-tight">
        <div className="text-[14px] font-semibold tabular-nums">{value}</div>
        <div className="text-[11.5px] text-ink-3">{label}</div>
      </div>
    </div>
  );
}

function UpNext({ topic, progress, levels }: { topic: TopicMeta; progress: TopicProgress; levels: LevelRows }) {
  const blob = useRef<BlobHandle>(null);
  const level = suggestedLevel(topic, progress, levels);
  const started = levelProgress(topic.slug, level, progress, levels).lesson_done || !topic.levels[level].minutes;
  const t = useMessages(learnText);
  const tt = useText();
  const names = topicNames(topic, useLocale());
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      // Laid out by its own width (the column is narrower beside the sidebar and the week card).
      className="@container relative overflow-hidden rounded-3xl border border-line bg-raised shadow-card"
      onMouseEnter={() => blob.current?.jump(0.5)}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,color-mix(in_oklab,var(--blob)_14%,transparent),transparent_60%)]" />
      <div className="bg-dots pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-30 [mask-image:linear-gradient(to_left,black,transparent)]" />
      <div className="relative grid items-center gap-3 p-5 @lg:grid-cols-[150px_minmax(0,1fr)] @lg:gap-6 @lg:p-7 @3xl:grid-cols-[150px_minmax(0,1fr)_auto]">
        <div className="mx-auto">
          <Blob ref={blob} size={140} mood="happy" accessory="cap" className="@max-lg:size-24" />
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">{started ? t.home.keepGoing : t.home.upNext}</div>
          <h2 className="mt-1 hyphens-auto font-display text-[24px] font-bold leading-tight tracking-[-0.015em] break-words @lg:text-[26px]">{names.title}</h2>
          {names.school && <div className="text-[13.5px] text-ink-3 break-words">{names.school}</div>}
          <p className="mt-2 max-w-[520px] text-[14.5px] leading-relaxed text-ink-2">{tt(topic.blurb)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={studyHref(topic, started ? "practice" : "lesson", level)}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-blob px-5 text-[14.5px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-[transform,background] hover:bg-blob-deep active:scale-[0.97]"
            >
              {started ? <Dumbbell className="size-4" /> : <BookOpen className="size-4" />}
              {started ? t.home.practise : t.home.startLesson}
            </Link>
            <Link
              href={topicHref(topic, level)}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-[14px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink"
            >
              {t.home.openTopic} <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
        <div className="hidden max-w-[260px] place-items-center rounded-2xl border border-line bg-surface/70 px-8 py-6 @3xl:grid">
          <TopicGlyph topic={topic} size="lg" />
        </div>
      </div>
    </motion.section>
  );
}

function TopicCard({ topic, progress, levels, delay }: { topic: TopicMeta; progress?: TopicProgress; levels: LevelRows; delay: number }) {
  const mastery = progress?.mastery ?? 0;
  const t = useMessages(learnText);
  const tt = useText();
  const locale = useLocale();
  const names = topicNames(topic, locale);
  // A topic whose lessons are all still being written has practice only: no minutes to show.
  const minutes = firstLessonMinutes(topic);
  return (
    // A card as wide as a phone (one per row) lays out as a row, picture on the left, at half the height.
    <motion.div className="@container" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: "spring", stiffness: 360, damping: 30 }}>
      <Link
        href={topicHref(topic)}
        className="group flex h-full flex-col rounded-2xl border border-line bg-raised p-3 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-pop @xs:flex-row @xs:gap-3"
      >
        {/* The picture sits below the level dots, so tall glyphs (fractions) never run into them. */}
        <div className="relative grid h-[84px] shrink-0 place-items-center overflow-hidden rounded-xl bg-surface px-1 pt-4 transition-colors duration-300 group-hover:bg-blob-soft/60 @xs:h-auto @xs:min-h-24 @xs:w-[112px] @xs:pt-5">
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-25" />
          {/* Narrow cards and phone rows draw the glyph smaller, so wide formulas stay on one line. */}
          <div className="relative max-w-full transition-transform duration-300 group-hover:scale-[1.06] @max-[15rem]:[&_.blob-math]:text-[20px]! @xs:[&_.blob-math]:text-[18px]!">
            <TopicGlyph topic={topic} size="md" />
          </div>
          <LevelDots topic={topic} progress={progress} levels={levels} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col px-1 pb-0.5 pt-3 @xs:px-0 @xs:pt-0.5">
          <div className="hyphens-auto text-[15px] font-semibold leading-snug break-words">{names.title}</div>
          {names.school && (
            <div className="truncate text-[12.5px] text-ink-3" title={names.school}>
              {names.school}
            </div>
          )}
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-ink-2">{tt(topic.blurb)}</p>
          <div className="mt-auto flex items-center gap-2.5 pt-3 @xs:pt-2.5">
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-blob"
                initial={{ width: 0 }}
                animate={{ width: `${mastery}%` }}
                transition={{ delay: delay + 0.2, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
              />
            </div>
            <span className={cn("shrink-0 text-[11.5px] font-medium", mastery >= 85 ? "text-ok" : mastery > 0 ? "text-blob-ink" : "text-ink-3")}>{masteryLabel(mastery, locale)}</span>
            {minutes > 0 && (
              <span className="flex shrink-0 items-center gap-0.5 text-[11.5px] text-ink-3">
                <Clock className="size-3" />
                {t.home.minutesShort(minutes)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/** One dot per level: green when its lesson is done, purple ring when ready, dashed when coming soon. */
function LevelDots({ topic, progress, levels }: { topic: TopicMeta; progress?: TopicProgress; levels: LevelRows }) {
  const t = useMessages(learnText);
  return (
    <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-raised/85 px-1.5 py-0.5 shadow-card">
      {LEVELS.map((l) => {
        const written = !!topic.levels[l].minutes;
        const done = written && levelProgress(topic.slug, l, progress, levels).lesson_done;
        const name = t.level(l);
        return (
          <span
            key={l}
            title={done ? t.home.levelDone(name) : written ? t.home.levelOpen(name) : t.home.levelSoon(name)}
            className={cn(
              "grid size-3.5 place-items-center rounded-full",
              done ? "bg-ok text-white" : written ? "border-[1.5px] border-blob/70" : "border-[1.5px] border-dashed border-line-2",
            )}
          >
            {done && <Check className="size-2.5" strokeWidth={3.5} />}
          </span>
        );
      })}
    </span>
  );
}

function WeekCard({ days }: { days: LearnDay[] }) {
  const day = useToday();
  const t = useMessages(learnText);
  const list = Array.from({ length: 7 }, (_, i) => {
    if (!day) return { key: String(i), label: "", xp: 0, isToday: false };
    const d = new Date(`${day}T12:00:00`);
    d.setDate(d.getDate() - (6 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { key, label: t.home.weekdays[d.getDay()], xp: days.find((x) => x.day === key)?.xp ?? 0, isToday: i === 6 };
  });
  const max = Math.max(DAILY_GOAL, ...list.map((d) => d.xp));
  const week = list.reduce((s, d) => s + d.xp, 0);

  return (
    <div className="rounded-2xl border border-line bg-raised p-4 shadow-card">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold">{t.home.thisWeek}</span>
        <span className="text-[12.5px] tabular-nums text-ink-2">{t.xp(week)}</span>
      </div>
      <div className="relative mt-4 flex h-[92px] items-end gap-2">
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line-2" style={{ bottom: `${(DAILY_GOAL / max) * 100}%` }} title={t.dailyGoal} />
        {list.map((d, i) => (
          <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <motion.div
              className={cn("w-full rounded-md", d.xp >= DAILY_GOAL ? "bg-blob" : d.xp > 0 ? "bg-blob/45" : "bg-line")}
              initial={{ height: 4 }}
              animate={{ height: Math.max(4, (d.xp / max) * 72) }}
              transition={{ delay: 0.1 + i * 0.05, type: "spring", stiffness: 200, damping: 22 }}
              title={t.xp(d.xp)}
            />
            <span className={cn("text-[10.5px] font-medium", d.isToday ? "text-blob-ink" : "text-ink-3")}>{d.label || "\u00a0"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
