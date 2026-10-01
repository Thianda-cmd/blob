"use client";

import { motion } from "motion/react";
import { ArrowRight, BookOpen, Check, Clock, Dumbbell, Flame, GraduationCap, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Blob, type BlobHandle } from "@/components/blob/Blob";
import { TopBar } from "@/components/shell/TopBar";
import { MATHS_CATALOG, SUBJECTS, type TopicMeta } from "@/learn/catalog";
import { DAILY_GOAL, EMPTY_PROGRESS, masteryLabel, type LearnDay, type TopicProgress } from "@/learn/progress";
import { useToday, useTodayXp } from "@/learn/session";
import { AREAS, type Area } from "@/learn/types";
import { cn } from "@/lib/utils";
import { MathView } from "./MathView";
import { Ring } from "./Ring";

const AREA_ORDER: Area[] = ["algebra", "numbers", "equations", "functions", "applied"];

/** Which topic to suggest: the first lesson not done yet, else the weakest topic. */
function upNext(progress: Record<string, TopicProgress>): TopicMeta {
  const fresh = MATHS_CATALOG.find((t) => !progress[t.slug]?.lesson_done);
  if (fresh) return fresh;
  return [...MATHS_CATALOG].sort((a, b) => (progress[a.slug]?.mastery ?? 0) - (progress[b.slug]?.mastery ?? 0))[0];
}

export function LearnHome({ progress, days }: { progress: Record<string, TopicProgress>; days: LearnDay[] }) {
  const today = useTodayXp(days);
  const next = upNext(progress);
  const nextProgress = progress[next.slug] ?? EMPTY_PROGRESS(next.slug);
  const totalXp = Object.values(progress).reduce((s, p) => s + p.xp, 0);
  const mastered = MATHS_CATALOG.filter((t) => (progress[t.slug]?.mastery ?? 0) >= 85).length;
  const lessons = MATHS_CATALOG.filter((t) => progress[t.slug]?.lesson_done).length;
  const avgMastery = Math.round(MATHS_CATALOG.reduce((s, t) => s + (progress[t.slug]?.mastery ?? 0), 0) / MATHS_CATALOG.length);

  return (
    <>
      <TopBar crumbs={[{ label: "Learn", icon: <GraduationCap className="size-3.5" /> }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1320px] px-5 pb-16 pt-3 sm:px-8">
          <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">
                <GraduationCap className="size-3.5" /> Learning center
              </div>
              <h1 className="mt-1 font-display text-[32px] font-bold leading-none tracking-[-0.02em]">Learn</h1>
              <p className="mt-2 text-[14.5px] text-ink-2">Short lessons with Blob, practice that adapts to you, and a cheat sheet for every topic.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatChip icon={<Flame className="size-4" />} label="Day streak" value={today.streak} hot={today.streak > 0} />
              <div className="flex h-12 items-center gap-2.5 rounded-xl border border-line bg-raised pl-2 pr-3.5 shadow-card">
                <Ring value={today.xp / DAILY_GOAL} size={34} stroke={4}>
                  <Zap className="size-3.5 text-blob" />
                </Ring>
                <div className="leading-tight">
                  <div className="text-[14px] font-semibold tabular-nums">
                    {today.xp}
                    <span className="font-normal text-ink-3"> / {DAILY_GOAL} XP</span>
                  </div>
                  <div className="text-[11.5px] text-ink-3">{today.xp >= DAILY_GOAL ? "Goal reached!" : "Daily goal"}</div>
                </div>
              </div>
              <StatChip icon={<Sparkles className="size-4" />} label="Total XP" value={totalXp} />
            </div>
          </header>

          <nav className="mt-6 flex gap-1 border-b border-line" aria-label="Subjects">
            {SUBJECTS.map((s) => (
              <span
                key={s.slug}
                className={cn(
                  "relative -mb-px flex items-center gap-1.5 px-3 pb-2.5 pt-1 text-[14px] font-medium",
                  s.live ? "text-ink" : "cursor-default text-ink-3",
                )}
                title={s.live ? undefined : "Coming soon"}
              >
                {s.title}
                {!s.live && <span className="rounded-full bg-hover px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide text-ink-3">Soon</span>}
                {s.live && <motion.span layoutId="learn-subject" className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-blob" />}
              </span>
            ))}
          </nav>

          <div className="mt-7 grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-9">
              <UpNext topic={next} progress={nextProgress} />

              {AREA_ORDER.map((area, ai) => {
                const topics = MATHS_CATALOG.filter((t) => t.area === area);
                if (!topics.length) return null;
                return (
                  <section key={area}>
                    <div className="mb-3 flex items-baseline gap-3">
                      <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">{AREAS[area].title}</h2>
                      <span className="text-[13px] text-ink-3">{AREAS[area].blurb}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {topics.map((t, i) => (
                        <TopicCard key={t.slug} topic={t} progress={progress[t.slug]} delay={ai * 0.05 + i * 0.04} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
              <WeekCard days={days} />
              <div className="rounded-2xl border border-line bg-raised p-4 shadow-card">
                <div className="text-[13px] font-semibold">Your maths</div>
                <div className="mt-3 flex items-center gap-4">
                  <Ring value={avgMastery / 100} size={72} stroke={7}>
                    <span className="text-[17px] font-bold tabular-nums">{avgMastery}%</span>
                  </Ring>
                  <div className="space-y-1 text-[13px] text-ink-2">
                    <div>
                      <span className="font-semibold text-ink tabular-nums">{lessons}</span> / {MATHS_CATALOG.length} lessons done
                    </div>
                    <div>
                      <span className="font-semibold text-ink tabular-nums">{mastered}</span> topics mastered
                    </div>
                    <div>Average mastery</div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-dashed border-line-2 p-4">
                <div className="text-[13px] font-semibold">More subjects soon</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">Chemistry, biology, physics and English are next on Blob&apos;s list.</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}

function StatChip({ icon, label, value, hot }: { icon: React.ReactNode; label: string; value: number; hot?: boolean }) {
  return (
    <div className="flex h-12 items-center gap-2.5 rounded-xl border border-line bg-raised px-3.5 shadow-card">
      <span className={cn("grid size-8 place-items-center rounded-lg", hot ? "bg-blob text-white" : "bg-hover text-ink-2")}>{icon}</span>
      <div className="leading-tight">
        <div className="text-[14px] font-semibold tabular-nums">{value}</div>
        <div className="text-[11.5px] text-ink-3">{label}</div>
      </div>
    </div>
  );
}

function UpNext({ topic, progress }: { topic: TopicMeta; progress: TopicProgress }) {
  const blob = useRef<BlobHandle>(null);
  const started = progress.lesson_done;
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="relative overflow-hidden rounded-3xl border border-line bg-raised shadow-card"
      onMouseEnter={() => blob.current?.jump(0.5)}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,color-mix(in_oklab,var(--blob)_14%,transparent),transparent_60%)]" />
      <div className="bg-dots pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-30 [mask-image:linear-gradient(to_left,black,transparent)]" />
      <div className="relative grid items-center gap-6 p-5 sm:grid-cols-[150px_minmax(0,1fr)] sm:p-7 lg:grid-cols-[150px_minmax(0,1fr)_auto]">
        <div className="mx-auto">
          <Blob ref={blob} size={140} mood="happy" accessory="cap" />
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">{started ? "Keep it going" : "Up next"}</div>
          <h2 className="mt-1 font-display text-[26px] font-bold leading-tight tracking-[-0.015em]">{topic.title}</h2>
          <div className="text-[13.5px] text-ink-3">{topic.de}</div>
          <p className="mt-2 max-w-[520px] text-[14.5px] leading-relaxed text-ink-2">{topic.blurb}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={started ? `/study/maths/${topic.slug}/practice` : `/study/maths/${topic.slug}/lesson`}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-blob px-5 text-[14.5px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-[transform,background] hover:bg-blob-deep active:scale-[0.97]"
            >
              {started ? <Dumbbell className="size-4" /> : <BookOpen className="size-4" />}
              {started ? "Practise" : "Start lesson"}
            </Link>
            <Link
              href={`/learn/maths/${topic.slug}`}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-[14px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink"
            >
              Open topic <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
        <div className="hidden place-items-center rounded-2xl border border-line bg-surface/70 px-8 py-6 lg:grid">
          <MathView src={topic.glyph} size="lg" animate={false} />
        </div>
      </div>
    </motion.section>
  );
}

function TopicCard({ topic, progress, delay }: { topic: TopicMeta; progress?: TopicProgress; delay: number }) {
  const mastery = progress?.mastery ?? 0;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: "spring", stiffness: 360, damping: 30 }}>
      <Link
        href={`/learn/maths/${topic.slug}`}
        className="group flex h-full flex-col rounded-2xl border border-line bg-raised p-3 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-pop"
      >
        <div className="relative grid h-[78px] place-items-center overflow-hidden rounded-xl bg-surface transition-colors duration-300 group-hover:bg-blob-soft/60">
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-25" />
          <div className="relative transition-transform duration-300 group-hover:scale-[1.06]">
            <MathView src={topic.glyph} size="md" animate={false} />
          </div>
          {progress?.lesson_done && (
            <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-ok text-white" title="Lesson done">
              <Check className="size-3" strokeWidth={3} />
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col px-1 pb-0.5 pt-3">
          <div className="text-[15px] font-semibold leading-snug">{topic.title}</div>
          <div className="text-[12.5px] text-ink-3">{topic.de}</div>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-ink-2">{topic.blurb}</p>
          <div className="mt-auto flex items-center gap-2.5 pt-3">
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-blob"
                initial={{ width: 0 }}
                animate={{ width: `${mastery}%` }}
                transition={{ delay: delay + 0.2, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
              />
            </div>
            <span className={cn("text-[11.5px] font-medium", mastery >= 85 ? "text-ok" : mastery > 0 ? "text-blob-ink" : "text-ink-3")}>{masteryLabel(mastery)}</span>
            <span className="flex items-center gap-0.5 text-[11.5px] text-ink-3">
              <Clock className="size-3" />
              {topic.minutes}m
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function WeekCard({ days }: { days: LearnDay[] }) {
  const day = useToday();
  const list = Array.from({ length: 7 }, (_, i) => {
    if (!day) return { key: String(i), label: "", xp: 0, isToday: false };
    const d = new Date(`${day}T12:00:00`);
    d.setDate(d.getDate() - (6 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { key, label: WEEKDAYS[d.getDay()], xp: days.find((x) => x.day === key)?.xp ?? 0, isToday: i === 6 };
  });
  const max = Math.max(DAILY_GOAL, ...list.map((d) => d.xp));
  const week = list.reduce((s, d) => s + d.xp, 0);

  return (
    <div className="rounded-2xl border border-line bg-raised p-4 shadow-card">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold">This week</span>
        <span className="text-[12.5px] tabular-nums text-ink-2">{week} XP</span>
      </div>
      <div className="relative mt-4 flex h-[92px] items-end gap-2">
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line-2" style={{ bottom: `${(DAILY_GOAL / max) * 100}%` }} title="Daily goal" />
        {list.map((d, i) => (
          <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <motion.div
              className={cn("w-full rounded-md", d.xp >= DAILY_GOAL ? "bg-blob" : d.xp > 0 ? "bg-blob/45" : "bg-line")}
              initial={{ height: 4 }}
              animate={{ height: Math.max(4, (d.xp / max) * 72) }}
              transition={{ delay: 0.1 + i * 0.05, type: "spring", stiffness: 200, damping: 22 }}
              title={`${d.xp} XP`}
            />
            <span className={cn("text-[10.5px] font-medium", d.isToday ? "text-blob-ink" : "text-ink-3")}>{d.label || "\u00a0"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
