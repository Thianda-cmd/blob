"use client";

import { motion } from "motion/react";
import { ArrowRight, Atom, BookOpen, Check, Clock, Dumbbell, Flame, FlaskConical, GraduationCap, Languages, Map as MapIcon, Microscope, Search, Sigma, Trophy, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Blob, type BlobHandle } from "@/components/blob/Blob";
import { TopBar } from "@/components/shell/TopBar";
import { useLocale, useMessages } from "@/i18n/client";
import { atlasText } from "@/i18n/messages/atlas";
import { learnText } from "@/i18n/messages/learn";
import { resolveText } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { ATLAS, atlasHref } from "@/learn/atlas/catalog";
import { AtlasArt } from "@/learn/atlas/components/AtlasArt";
import { ModelCard } from "@/learn/atlas/components/AtlasHome";
import type { AtlasStats } from "@/learn/atlas/content";
import { useAllSeen } from "@/learn/atlas/seen";
import { CATALOG, firstLessonMinutes, studyHref, subjectCatalog, SUBJECTS, topicHref, upNext, type Subject, type TopicMeta } from "@/learn/catalog";
import { levelProgress, type LevelRows, suggestedLevel } from "@/learn/levels";
import { DAILY_GOAL, EMPTY_PROGRESS, masteryLabel, type LearnDay, type TopicProgress } from "@/learn/progress";
import { useToday, useTodayXp } from "@/learn/session";
import { AREAS, LEVELS, type Area } from "@/learn/types";
import { cn } from "@/lib/utils";
import { Ring } from "./Ring";
import { TopicGlyph } from "./TopicGlyph";
import { topicNames } from "./topicNames";

const SUBJECT_ICONS: Record<string, LucideIcon> = { maths: Sigma, chemistry: FlaskConical, biology: Microscope, physics: Atom, english: Languages };

/** Average mastery of a subject's topics, 0–100. */
const subjectMastery = (subject: string, progress: Record<string, TopicProgress>) => {
  const list = CATALOG.filter((t) => t.subject === subject);
  return list.length ? Math.round(list.reduce((s, t) => s + (progress[t.slug]?.mastery ?? 0), 0) / list.length) : 0;
};

export function LearnHome({
  subject,
  progress,
  levels,
  days,
  atlas,
  atlasStats,
}: {
  subject: Subject;
  progress: Record<string, TopicProgress>;
  levels: LevelRows;
  days: LearnDay[];
  atlas: Record<string, TopicProgress>;
  atlasStats: AtlasStats[];
}) {
  const today = useTodayXp(days);
  const catalog = subjectCatalog(subject);
  const info = SUBJECTS.find((s) => s.slug === subject)!;
  // A subject that just went live may not have topics yet.
  const next = catalog.length ? upNext(catalog, progress) : null;
  const totalXp = [...Object.values(progress), ...Object.values(atlas)].reduce((s, p) => s + p.xp, 0);
  const mastered = catalog.filter((t) => (progress[t.slug]?.mastery ?? 0) >= 85).length;
  const lessons = catalog.filter((t) => progress[t.slug]?.lesson_done).length;
  const avgMastery = subjectMastery(subject, progress);
  // The subject's areas in its order, then any area only its topics name, so a new area always shows.
  const groups = [...new Set([...(info.areas ?? []), ...catalog.map((t) => t.area)])]
    .map((area) => ({ area, topics: catalog.filter((t) => t.area === area) }))
    .filter((g) => g.topics.length > 0);
  const [area, setArea] = useState<Area | "all">("all");
  const [query, setQuery] = useState("");
  const shownGroups = area === "all" ? groups : groups.filter((g) => g.area === area);
  const shown = shownGroups.flatMap((g) => g.topics);
  // Cards fade in one after another, capped so long lists don't keep the last ones waiting.
  const delay = (topic: TopicMeta) => Math.min(shown.indexOf(topic), 12) * 0.035;
  const t = useMessages(learnText);
  const tt = useText();
  const soon = SUBJECTS.filter((s) => !s.live).map((s) => tt(s.title));

  return (
    <>
      <TopBar crumbs={[{ label: t.learn, icon: <GraduationCap className="size-3.5" /> }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-3 sm:px-8">
          <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">
                <GraduationCap className="size-3.5" /> {t.home.eyebrow}
              </div>
              <h1 className="mt-1 font-display text-[32px] font-bold leading-none tracking-[-0.02em] sm:text-[36px]">{t.learn}</h1>
              <p className="mt-2 max-w-[560px] text-[14.5px] text-ink-2">{t.home.intro}</p>
            </div>
            <TodayPanel streak={today.streak} xp={today.xp} total={totalXp} />
          </header>

          {/* Pick up where you left off, and the Atlas. */}
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {next ? (
              <UpNext topic={next} progress={progress[next.slug] ?? EMPTY_PROGRESS(next.slug)} levels={levels} />
            ) : (
              <div className="rounded-3xl border border-dashed border-line-2 p-5 text-[14px] text-ink-2">{t.home.noTopics}</div>
            )}
            <AtlasFeature atlas={atlas} stats={atlasStats} />
          </div>

          {/* Subjects and search. */}
          <div className="mt-9 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <SubjectSwitcher subject={subject} progress={progress} />
            <SearchField value={query} onChange={setQuery} />
          </div>

          {query.trim() ? (
            <SearchResults query={query} progress={progress} levels={levels} atlas={atlas} stats={atlasStats} />
          ) : (
            <div className="mt-5 grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-w-0">
                {groups.length > 1 && (
                  <div className="-mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label={t.home.areas}>
                    {[{ key: "all" as const, label: t.home.all, n: catalog.length }, ...groups.map((g) => ({ key: g.area, label: tt(AREAS[g.area].title), n: g.topics.length }))].map((c) => {
                      const on = area === c.key;
                      return (
                        <button
                          key={c.key}
                          type="button"
                          role="tab"
                          aria-selected={on}
                          onClick={() => setArea(c.key)}
                          className={cn(
                            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors [@media(hover:none)]:h-9",
                            on ? "border-blob/50 bg-blob-soft text-blob-ink" : "border-line bg-raised text-ink-2 hover:border-line-2 hover:text-ink",
                          )}
                        >
                          {c.label}
                          <span className={cn("text-[11.5px] tabular-nums", on ? "text-blob-ink/70" : "text-ink-3")}>{c.n}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="space-y-8 sm:space-y-9">
                  {shownGroups.map(({ area: a, topics }) => (
                    <section key={a}>
                      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <h2 className="hyphens-auto font-display text-[19px] font-semibold tracking-[-0.01em] break-words">{tt(AREAS[a].title)}</h2>
                        <span className="text-[13px] text-ink-3">{tt(AREAS[a].blurb)}</span>
                      </div>
                      {/* As many columns as fit; a lone card keeps its column width. */}
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] gap-3">
                        {topics.map((topic) => (
                          <TopicCard key={topic.slug} topic={topic} progress={progress[topic.slug]} levels={levels} delay={delay(topic)} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>

              {/* Tablets: cards side by side; wide screens: a sticky column. */}
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
                <AtlasProgress atlas={atlas} stats={atlasStats} />
                {soon.length > 0 && (
                  <div className="rounded-2xl border border-dashed border-line-2 p-4 sm:col-span-2 xl:col-span-1">
                    <div className="text-[13px] font-semibold">{t.home.moreSoon}</div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{t.home.moreSoonText(soon)}</p>
                  </div>
                )}
              </aside>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Today at a glance: streak, daily goal and all XP, in one card. */
function TodayPanel({ streak, xp, total }: { streak: number; xp: number; total: number }) {
  const t = useMessages(learnText);
  return (
    <div className="grid w-full grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-raised shadow-card sm:w-auto" aria-label={t.home.today}>
      <div className="flex min-w-0 flex-col items-start gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-2.5 sm:px-4">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", streak > 0 ? "bg-blob text-white" : "bg-hover text-ink-2")}>
          <Flame className="size-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-[15px] font-semibold tabular-nums">{streak}</div>
          <div className="truncate text-[11.5px] text-ink-3">{t.dayStreak}</div>
        </div>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-2.5 sm:px-4">
        <Ring value={xp / DAILY_GOAL} size={36} stroke={4} className="shrink-0">
          {xp >= DAILY_GOAL ? <Check className="size-3.5 text-blob" strokeWidth={3} /> : <span className="text-[9.5px] font-bold tabular-nums text-blob-ink">{Math.round(Math.min(1, xp / DAILY_GOAL) * 100)}</span>}
        </Ring>
        <div className="min-w-0 leading-tight">
          <div className="whitespace-nowrap text-[15px] font-semibold tabular-nums">
            {xp}
            <span className="font-normal text-ink-3"> / {DAILY_GOAL}</span>
          </div>
          <div className="truncate text-[11.5px] text-ink-3">{xp >= DAILY_GOAL ? t.home.goalReached : t.dailyGoal}</div>
        </div>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-2.5 sm:px-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-hover text-ink-2">
          <Trophy className="size-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-[15px] font-semibold tabular-nums">{total}</div>
          <div className="truncate text-[11.5px] text-ink-3">{t.home.totalXp}</div>
        </div>
      </div>
    </div>
  );
}

/** The subjects as pills with an icon and how far you are; subjects to come are greyed out. */
function SubjectSwitcher({ subject, progress }: { subject: string; progress: Record<string, TopicProgress> }) {
  const t = useMessages(learnText);
  const tt = useText();
  return (
    <nav className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={t.home.subjects}>
      {SUBJECTS.map((s) => {
        const Icon = SUBJECT_ICONS[s.slug] ?? GraduationCap;
        if (!s.live)
          return (
            <span key={s.slug} title={t.home.comingSoon} className="inline-flex h-11 shrink-0 cursor-default items-center gap-2 rounded-2xl border border-dashed border-line-2 px-3.5 text-[14px] font-medium text-ink-3">
              <Icon className="size-4" />
              {tt(s.title)}
              <span className="rounded-full bg-hover px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide">{t.home.soon}</span>
            </span>
          );
        const on = s.slug === subject;
        const m = subjectMastery(s.slug, progress);
        return (
          <Link
            key={s.slug}
            href={`/learn/${s.slug}`}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border px-3.5 text-[14px] font-semibold transition-[background,border-color,color,box-shadow]",
              on ? "border-ink bg-ink text-paper shadow-card" : "border-line bg-raised text-ink-2 hover:border-line-2 hover:text-ink",
            )}
          >
            <Icon className="size-4" />
            {tt(s.title)}
            <Ring value={m / 100} size={22} stroke={3} color={on ? "var(--blob-light)" : "var(--blob)"} track={on ? "color-mix(in oklab, var(--paper) 25%, transparent)" : "var(--line)"} className="ml-0.5" />
          </Link>
        );
      })}
    </nav>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useMessages(learnText);
  return (
    <label className="relative flex h-11 w-full items-center md:w-[300px]">
      <Search className="pointer-events-none absolute left-3.5 size-4 text-ink-3" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        placeholder={t.home.search}
        aria-label={t.home.searchAll}
        className="h-full w-full rounded-2xl border border-line bg-raised pl-10 pr-10 text-[14px] shadow-card outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus:border-blob/60 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} className="absolute right-2 grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink" aria-label={t.home.clearSearch}>
          <X className="size-4" />
        </button>
      )}
    </label>
  );
}

/** Topics of every subject and Atlas models that match the search, in both languages. */
function SearchResults({ query, progress, levels, atlas, stats }: { query: string; progress: Record<string, TopicProgress>; levels: LevelRows; atlas: Record<string, TopicProgress>; stats: AtlasStats[] }) {
  const t = useMessages(learnText);
  const tt = useText();
  const seen = useAllSeen();
  const q = query.trim().toLowerCase();
  const has = (...texts: (string | undefined)[]) => texts.some((s) => s?.toLowerCase().includes(q));
  const topics = useMemo(
    () => CATALOG.filter((x) => has(resolveText(x.title, "en"), resolveText(x.title, "de"), x.de, resolveText(x.blurb, "en"), resolveText(x.blurb, "de"))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q],
  );
  const models = useMemo(
    () => ATLAS.filter((m) => has(resolveText(m.title, "en"), resolveText(m.title, "de"), resolveText(m.subtitle, "en"), resolveText(m.subtitle, "de"), m.keywords)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q],
  );
  const total = topics.length + models.length;
  return (
    <div className="mt-6">
      <div className="mb-3 text-[13px] font-medium text-ink-3">{total ? t.home.results(total) : t.home.noResults(query.trim())}</div>
      {models.length > 0 && (
        <section className="mb-7">
          <h2 className="mb-3 flex items-center gap-2 font-display text-[18px] font-semibold">
            <MapIcon className="size-4 text-blob-ink" /> {t.home.inAtlas}
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-3">
            {models.map((m) => (
              <ModelCard key={m.slug} meta={m} stats={stats.find((s) => s.slug === m.slug)} seen={seen[m.slug]?.length ?? 0} progress={atlas[m.slug]} compact />
            ))}
          </div>
        </section>
      )}
      {topics.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] gap-3">
          {topics.map((topic, i) => (
            <TopicCard key={topic.slug} topic={topic} progress={progress[topic.slug]} levels={levels} delay={Math.min(i, 10) * 0.03} subject={tt(SUBJECTS.find((s) => s.slug === topic.subject)!.title)} />
          ))}
        </div>
      )}
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
      // Laid out by its own width (the column is narrower beside the Atlas card).
      className="@container relative overflow-hidden rounded-3xl border border-line bg-raised shadow-card"
      onMouseEnter={() => blob.current?.jump(0.5)}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,color-mix(in_oklab,var(--blob)_14%,transparent),transparent_60%)]" />
      <div className="bg-dots pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-30 [mask-image:linear-gradient(to_left,black,transparent)]" />
      <div className="relative grid h-full items-center gap-3 p-5 @lg:grid-cols-[130px_minmax(0,1fr)] @lg:gap-6 @lg:p-7 @3xl:grid-cols-[130px_minmax(0,1fr)_auto]">
        <div className="mx-auto">
          <Blob ref={blob} size={124} mood="happy" accessory="cap" className="@max-lg:size-24" />
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
          {/* The three levels: which lessons are done and how practice goes. */}
          <div className="mt-6 grid max-w-[460px] grid-cols-3 gap-3">
            {LEVELS.map((l) => {
              const p = levelProgress(topic.slug, l, progress, levels);
              const written = !!topic.levels[l].minutes;
              return (
                <div key={l} className={cn(!written && "opacity-55")}>
                  <div className="flex items-center justify-between gap-1 text-[11.5px]">
                    <span className={cn("truncate", l === level ? "font-semibold text-ink" : "text-ink-3")}>{t.level(l)}</span>
                    {p.lesson_done && <Check className="size-3.5 shrink-0 text-ok" strokeWidth={3} />}
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                    <motion.div className="h-full rounded-full bg-blob" initial={{ width: 0 }} animate={{ width: `${p.mastery}%` }} transition={{ delay: 0.3 + l * 0.08, duration: 0.8 }} />
                  </div>
                  <div className="mt-1 text-[11px] text-ink-3">{topic.levels[l].depth ? tt(topic.levels[l].depth) : ""}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="hidden max-w-[220px] place-items-center rounded-2xl border border-line bg-surface/70 px-7 py-6 @3xl:grid">
          <TopicGlyph topic={topic} size="lg" />
        </div>
      </div>
    </motion.section>
  );
}

/** The Atlas on the learn home: what it is, three models to jump into, and the way in. */
function AtlasFeature({ atlas, stats }: { atlas: Record<string, TopicProgress>; stats: AtlasStats[] }) {
  const a = useMessages(atlasText);
  const tt = useText();
  const seen = useAllSeen();
  const started = ATLAS.some((m) => (seen[m.slug]?.length ?? 0) > 0 || atlas[m.slug]);
  const picks = ["bacterial-cell", "cell-wall", "endospores"].map((slug) => ATLAS.find((m) => m.slug === slug)!).filter(Boolean);
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.05 }}
      className="relative flex flex-col overflow-hidden rounded-3xl border border-line bg-raised p-5 shadow-card sm:p-6"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_80%_at_100%_0%,color-mix(in_oklab,var(--bio-gpos)_16%,transparent),transparent_65%)]" aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">
          <MapIcon className="size-3.5" /> {started ? a.atlas : a.cardEyebrow}
        </div>
        <h2 className="mt-1 font-display text-[22px] font-bold leading-tight tracking-[-0.015em]">{a.cardTitle}</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{a.cardText}</p>
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        {picks.map((m) => {
          const s = stats.find((x) => x.slug === m.slug);
          const share = s?.items ? Math.min(1, (seen[m.slug]?.length ?? 0) / s.items) : 0;
          return (
            <Link key={m.slug} href={atlasHref(m.slug)} className="group min-w-0 rounded-xl border border-line bg-surface/80 p-1.5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-blob/40">
              <div className="rounded-lg bg-raised px-1 py-1.5">
                <AtlasArt slug={m.slug} />
              </div>
              <div className="mt-1.5 line-clamp-2 min-h-[30px] hyphens-auto px-0.5 text-[12px] font-semibold leading-[15px] text-ink-2 group-hover:text-ink">{tt(m.title)}</div>
              <div className="mx-0.5 mb-0.5 mt-1 h-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-blob" style={{ width: `${Math.round(share * 100)}%` }} />
              </div>
            </Link>
          );
        })}
      </div>
      <div className="relative mt-4 flex items-center justify-between gap-3 sm:mt-auto sm:pt-4">
        <span className="text-[12.5px] text-ink-3">{a.models(ATLAS.length)}</span>
        <Link
          href="/learn/atlas"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-[14px] font-semibold text-paper transition-[transform,opacity] hover:opacity-90 active:scale-[0.97]"
        >
          {a.openAtlas} <ArrowRight className="size-4" />
        </Link>
      </div>
    </motion.section>
  );
}

/** How far you are with each Atlas model (explored on this device; a tick when done). */
function AtlasProgress({ atlas, stats }: { atlas: Record<string, TopicProgress>; stats: AtlasStats[] }) {
  const t = useMessages(learnText);
  const tt = useText();
  const seen = useAllSeen();
  return (
    <div className="rounded-2xl border border-line bg-raised p-4 shadow-card">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold">{t.home.yourAtlas}</span>
        <Link href="/learn/atlas" className="text-[12.5px] font-medium text-blob-ink hover:underline">
          {t.home.openTopic}
        </Link>
      </div>
      <p className="mt-0.5 text-[12px] text-ink-3">{t.home.atlasText}</p>
      <ul className="mt-3 space-y-2">
        {ATLAS.map((m) => {
          const s = stats.find((x) => x.slug === m.slug);
          const n = Math.min(seen[m.slug]?.length ?? 0, s?.items ?? 0);
          const done = atlas[m.slug]?.lesson_done || (!!s?.items && n >= s.items);
          return (
            <li key={m.slug}>
              <Link href={atlasHref(m.slug)} className="group block">
                <div className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="truncate text-ink-2 group-hover:text-ink">{tt(m.title)}</span>
                  <span className={cn("shrink-0 tabular-nums", done ? "text-ok" : "text-ink-3")}>{done ? <Check className="size-3.5" strokeWidth={3} /> : `${n}/${s?.items ?? 0}`}</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-line">
                  <div className={cn("h-full rounded-full", done ? "bg-ok" : "bg-blob")} style={{ width: `${s?.items ? Math.round((n / s.items) * 100) : 0}%` }} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TopicCard({ topic, progress, levels, delay, subject }: { topic: TopicMeta; progress?: TopicProgress; levels: LevelRows; delay: number; subject?: string }) {
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
          {subject && <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blob-ink">{subject}</div>}
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
            <span className={cn("text-[10.5px] font-medium", d.isToday ? "text-blob-ink" : "text-ink-3")}>{d.label || " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
