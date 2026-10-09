"use client";

import { motion } from "motion/react";
import { BookOpen, Check, Dumbbell, Flame, GraduationCap, Languages, Lock, Star, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Blob, type BlobHandle } from "@/components/blob/Blob";
import { TopBar } from "@/components/shell/TopBar";
import { useLocale, useMessages } from "@/i18n/client";
import { frenchText } from "@/i18n/messages/french";
import { learnText } from "@/i18n/messages/learn";
import { resolveText } from "@/i18n/text";
import { CHIP, StatChip, SubjectTabs } from "@/learn/components/LearnHome";
import { Ring } from "@/learn/components/Ring";
import { DAILY_GOAL, type LearnDay, type TopicProgress } from "@/learn/progress";
import { useTodayXp } from "@/learn/session";
import { cn } from "@/lib/utils";
import { courseState, SECTIONS, type LessonState, type UnitState } from "../course";
import type { WordRow } from "../server";
import type { Unit } from "../types";
import { say } from "../speech";

/** Colours of the units on the path, in turn. */
const UNIT_COLORS = ["#6d3df5", "#2f6f6a", "#c4653e", "#3f78b3", "#c05475", "#5d8a4c", "#b48e38", "#8a5a9c"];

export function FrenchHome({ lessons, days, words }: { lessons: Record<string, Pick<TopicProgress, "lesson_done">>; days: LearnDay[]; words: WordRow[] }) {
  const t = useMessages(frenchText);
  const lt = useMessages(learnText);
  const locale = useLocale();
  const today = useTodayXp(days);
  const { units, next } = courseState(lessons);
  const started = units.some((u) => u.done > 0);
  const nextHref = next ? `/study/french/${next.unit.slug}/${next.lesson}` : null;

  return (
    <>
      <TopBar crumbs={[{ label: lt.learn, icon: <GraduationCap className="size-3.5" />, href: "/learn" }, { label: t.title }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1320px] px-5 pb-20 pt-3 sm:px-8">
          <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">
                <Languages className="size-3.5" /> {t.home.kicker}
              </div>
              <h1 className="mt-1 font-display text-[32px] font-bold leading-none tracking-[-0.02em]">
                {t.title} <span aria-hidden>🇫🇷</span>
              </h1>
              <p className="mt-2 max-w-[560px] text-[14.5px] text-ink-2">{t.home.intro}</p>
            </div>
            <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              <StatChip icon={<Flame className="size-4" />} label={t.home.streak} value={today.streak} hot={today.streak > 0} />
              <div className={cn(CHIP, "sm:pl-2")}>
                <Ring value={today.xp / DAILY_GOAL} size={34} stroke={4} className="max-sm:-m-0.5">
                  <Zap className="size-3.5 text-blob" />
                </Ring>
                <div className="min-w-0 leading-tight">
                  <div className="text-[14px] font-semibold tabular-nums">
                    {today.xp}
                    <span className="font-normal text-ink-3"> / {DAILY_GOAL} XP</span>
                  </div>
                  <div className="text-[11.5px] text-ink-3">{t.home.today}</div>
                </div>
              </div>
              <StatChip icon={<BookOpen className="size-4" />} label={t.home.words} value={words.length} />
            </div>
          </header>

          <SubjectTabs subject="french" />

          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            {/* Blob and the quick actions: on top on phones, beside the path from laptops. */}
            <aside className="space-y-3 lg:sticky lg:top-4 lg:order-2">
              <Greeting nextHref={nextHref} started={started} nextLabel={next ? t.home.nextUp(resolveText(next.unit.title, locale), next.lesson) : t.home.allDone} />
              <div className="grid grid-cols-2 gap-3">
                <SideLink
                  href={started ? "/study/french/practice" : null}
                  icon={<Dumbbell className="size-5" />}
                  title={t.home.practice}
                  hint={t.home.practiceHint}
                  tone="bg-[#c4653e]/12 text-[#a5532f]"
                />
                <SideLink href="/learn/french/words" icon={<BookOpen className="size-5" />} title={t.home.words} hint={t.home.wordsCount(words.length)} tone="bg-[#3f78b3]/12 text-[#2f5f93]" />
              </div>
            </aside>

            <div className="min-w-0 lg:order-1" aria-label={t.home.path}>
              {SECTIONS.map((section) => (
                <section key={section.n} className="mb-10">
                  <div className="mb-4 rounded-2xl border border-line bg-surface px-4 py-3">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                      {t.home.section(section.n)} · {section.cefr}
                    </div>
                    <div className="font-display text-[19px] font-semibold">{resolveText(section.title, locale)}</div>
                    <div className="text-[13.5px] text-ink-2">{resolveText(section.goal, locale)}</div>
                  </div>
                  {section.soon || !section.units.length ? (
                    <div className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-line-2 px-5 py-6 text-ink-2">
                      <Blob size={64} mood="thinking" accessory="beret" interactive={false} />
                      <div>
                        <div className="font-semibold text-ink">{t.home.soon}</div>
                        <div className="text-[13.5px]">{t.home.soonHint}</div>
                      </div>
                    </div>
                  ) : (
                    units
                      .filter((u) => section.units.includes(u.unit))
                      .map((state) => <UnitPath key={state.unit.slug} state={state} color={UNIT_COLORS[(state.unit.n - 1) % UNIT_COLORS.length]} />)
                  )}
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Greeting({ nextHref, nextLabel, started }: { nextHref: string | null; nextLabel: string; started: boolean }) {
  const t = useMessages(frenchText);
  const blob = useRef<BlobHandle>(null);
  const [line] = useState(() => t.greet[new Date().getDate() % t.greet.length]);
  useEffect(() => {
    const id = setTimeout(() => blob.current?.wave(), 500);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-raised p-5 shadow-card">
      <div className="flex items-end gap-3">
        <button type="button" onClick={() => void say(line.fr)} className="shrink-0" aria-label={line.fr}>
          <Blob ref={blob} size={96} mood="happy" accessory="beret" />
        </button>
        <div className="relative mb-5 min-w-0 flex-1 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5">
          <div lang="fr" className="text-[15.5px] font-semibold text-ink">
            {line.fr}
          </div>
          <div className="text-[13px] text-ink-2">{line.tr}</div>
        </div>
      </div>
      <p className="mt-3 text-[13.5px] text-ink-2">{nextLabel}</p>
      {nextHref && (
        <Link
          href={nextHref}
          className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl bg-blob text-[15px] font-bold uppercase tracking-wide text-white shadow-[0_4px_0_var(--blob-deep)] transition-transform active:translate-y-[2px] active:shadow-none"
        >
          {started ? t.home.continue : t.home.start}
        </Link>
      )}
    </div>
  );
}

function SideLink({ href, icon, title, hint, tone }: { href: string | null; icon: React.ReactNode; title: string; hint: string; tone: string }) {
  const inner = (
    <>
      <span className={cn("grid size-10 place-items-center rounded-xl", tone)}>{icon}</span>
      <span className="mt-2 block text-[14.5px] font-semibold text-ink">{title}</span>
      <span className="block text-[12.5px] leading-snug text-ink-3">{hint}</span>
    </>
  );
  const cls = "block rounded-2xl border border-line bg-raised p-3.5 shadow-card transition-[transform,border-color]";
  return href ? (
    <Link href={href} className={cn(cls, "hover:-translate-y-0.5 hover:border-line-2")}>
      {inner}
    </Link>
  ) : (
    <div className={cn(cls, "opacity-55")}>{inner}</div>
  );
}

/** One unit on the path: its banner, then its lessons as stepping stones. */
function UnitPath({ state, color }: { state: UnitState; color: string }) {
  const t = useMessages(frenchText);
  const locale = useLocale();
  const { unit } = state;
  const all = unit.lessons.length;
  const complete = state.done === all;
  return (
    <div className="mb-8">
      <div className={cn("relative overflow-hidden rounded-3xl px-5 py-4 text-white shadow-card", !state.unlocked && "opacity-60 grayscale-[35%]")} style={{ background: color }}>
        <div aria-hidden className="pointer-events-none absolute -right-3 -top-4 text-[86px] leading-none opacity-25">
          {unit.emoji}
        </div>
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/75">
              {t.home.unit(unit.n)} · {t.home.lessonsDone(state.done, all)}
            </div>
            <div className="font-display text-[22px] font-bold leading-tight">{resolveText(unit.title, locale)}</div>
            <div className="mt-0.5 text-[13.5px] text-white/85">{resolveText(unit.goal, locale)}</div>
          </div>
          <Link
            href={`/learn/french/${unit.slug}`}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-white/35 px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/15"
          >
            <BookOpen className="size-4" /> <span className="max-sm:hidden">{t.home.guide}</span>
          </Link>
        </div>
      </div>
      <ol className="relative mx-auto mt-6 flex max-w-[360px] flex-col items-center gap-5">
        {unit.lessons.map((lesson, i) => (
          <LessonNode key={i} unit={unit} n={i + 1} state={state.lessons[i]} color={color} title={resolveText(lesson.title, locale)} story={unit.dialogue?.lesson === i + 1} />
        ))}
        <li className={cn("grid size-16 place-items-center rounded-full border-4 text-white", complete ? "border-[#b48e38] bg-[#e2b84b]" : "border-line bg-hover text-ink-3")} title={complete ? t.end.unitDone(resolveText(unit.title, locale)) : undefined}>
          <Trophy className={cn("size-7", complete ? "text-white" : "text-ink-3")} />
        </li>
      </ol>
    </div>
  );
}

function LessonNode({ unit, n, state, color, title, story }: { unit: Unit; n: number; state: LessonState; color: string; title: string; story: boolean }) {
  const t = useMessages(frenchText);
  // Stepping stones swing left and right like a path.
  const x = Math.round(Math.sin((n - 1) * 1.15) * 72);
  const Icon = state === "locked" ? Lock : state === "done" ? Check : story ? BookOpen : Star;
  const href = state === "locked" ? null : `/study/french/${unit.slug}/${n}`;
  const node = (
    <span
      className={cn(
        "relative grid size-[72px] place-items-center rounded-full border-b-[6px] transition-transform",
        state === "locked" ? "border-line-2 bg-line text-ink-3" : "text-white active:translate-y-[3px] active:border-b-[3px]",
        href && "hover:scale-[1.04]",
      )}
      style={state === "locked" ? undefined : { background: state === "done" ? color : color, borderBottomColor: "rgba(0,0,0,0.22)", opacity: state === "done" ? 0.92 : 1 }}
    >
      <Icon className="size-8" strokeWidth={state === "done" ? 3 : 2.2} fill={state === "current" && !story ? "currentColor" : "none"} />
      {state === "current" && <span className="absolute -inset-2 animate-ping rounded-full border-4 opacity-30" style={{ borderColor: color }} />}
    </span>
  );
  return (
    <li className="relative" style={{ transform: `translateX(${x}px)` }}>
      {state === "current" && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: [0, -4, 0] }} transition={{ y: { repeat: Infinity, duration: 1.8 } }} className="absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border-2 border-line bg-raised px-3 py-1 text-[13px] font-bold uppercase tracking-wide shadow-card" style={{ color }}>
          {t.home.startLesson}
        </motion.div>
      )}
      {href ? (
        <Link href={href} aria-label={`${t.home.lesson(n)}: ${title}`} title={state === "done" ? `${title} · ${t.home.replay}` : title} className="block rounded-full">
          {node}
        </Link>
      ) : (
        <span title={t.home.lessonLocked} aria-label={`${t.home.lesson(n)}: ${title} · ${t.home.lessonLocked}`}>
          {node}
        </span>
      )}
      {state === "current" && (
        <div className={cn("absolute top-1/2 -translate-y-1/2", x > 0 ? "right-full mr-4" : "left-full ml-4")}>
          <Blob size={70} mood="excited" accessory="beret" interactive={false} />
        </div>
      )}
    </li>
  );
}
