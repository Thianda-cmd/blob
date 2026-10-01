"use client";

import { motion } from "motion/react";
import { ArrowRight, BookOpen, Check, Clock, Dumbbell, GraduationCap, Printer, Timer } from "lucide-react";
import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { useState } from "react";
import { type LearnDay, levelFor, masteryLabel, type TopicProgress } from "@/learn/progress";
import { useTodayXp } from "@/learn/session";
import { getTopic } from "@/learn/topics";
import type { Level, SummaryBlock } from "@/learn/types";
import { cn } from "@/lib/utils";
import { MathView } from "./MathView";
import { Rich } from "./Rich";
import { Ring } from "./Ring";
import { Tutor } from "./Tutor";

const LEVEL_NAMES: Record<Level, string> = { 1: "Basics", 2: "Standard", 3: "Challenge" };

export function TopicView({ slug, progress, days }: { slug: string; progress: TopicProgress; days: LearnDay[] }) {
  const topic = getTopic(slug)!;
  const today = useTodayXp(days);
  const [level, setLevel] = useState<Level | null>(null);
  const accuracy = progress.attempts ? Math.round((progress.correct / progress.attempts) * 100) : null;
  const checks = topic.lesson.filter((s) => s.type === "check").length;
  const suggested = levelFor(progress.mastery);
  const tip = topic.summary.find((b) => b.tone === "tip") ?? topic.summary[0];

  return (
    <>
      <TopBar
        className="print:hidden"
        crumbs={[
          { label: "Learn", href: "/learn", icon: <GraduationCap className="size-3.5" /> },
          { label: "Maths", href: "/learn" },
          { label: topic.title },
        ]}
      />
      <div className="min-h-0 flex-1 overflow-y-auto print:overflow-visible">
        <div className="mx-auto w-full max-w-[1240px] px-5 pb-16 pt-3 sm:px-8 print:max-w-none print:p-0">
          <header className="mt-2 grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto] print:hidden">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative grid h-[120px] w-full shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-raised shadow-card sm:w-[200px]"
              >
                <div className="bg-dots pointer-events-none absolute inset-0 opacity-30" />
                <MathView src={topic.glyph} size="lg" animate={false} className="relative" />
              </motion.div>
              <div className="min-w-0">
                <h1 className="font-display text-[32px] font-bold leading-tight tracking-[-0.02em]">{topic.title}</h1>
                <div className="text-[15px] text-ink-3">{topic.de}</div>
                <p className="mt-2 max-w-[560px] text-[15px] leading-relaxed text-ink-2">{topic.blurb}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-raised p-4 shadow-card">
              <Ring value={progress.mastery / 100} size={84} stroke={8}>
                <div className="text-center leading-none">
                  <div className="text-[19px] font-bold tabular-nums">{progress.mastery}%</div>
                </div>
              </Ring>
              <div className="space-y-1 text-[13px]">
                <div className="font-semibold text-ink">{masteryLabel(progress.mastery)}</div>
                <div className="text-ink-2">
                  {progress.attempts} tasks{accuracy !== null && ` · ${accuracy}% right`}
                </div>
                <div className="text-ink-2">Best streak {progress.best_streak}</div>
                <div className="text-ink-3">{today.xp} XP today</div>
              </div>
            </div>
          </header>

          <div className="mt-7 grid gap-3 md:grid-cols-3 print:hidden">
            <ActionCard
              delay={0}
              icon={<BookOpen className="size-5" />}
              title="Lesson"
              text={`Blob explains it step by step, with ${checks} quick checks along the way.`}
              meta={
                <>
                  <Clock className="size-3.5" /> {topic.minutes} min · {topic.lesson.length} steps
                  {progress.lesson_done && (
                    <span className="ml-auto flex items-center gap-1 font-medium text-ok">
                      <Check className="size-3.5" strokeWidth={3} /> Done
                    </span>
                  )}
                </>
              }
              href={`/study/maths/${slug}/lesson`}
              cta={progress.lesson_done ? "Review lesson" : "Start lesson"}
              primary={!progress.lesson_done}
            />
            <ActionCard
              delay={0.05}
              icon={<Dumbbell className="size-5" />}
              title="Practice"
              text="10 fresh tasks every time. They get harder as you get better."
              meta={
                <div className="flex w-full items-center gap-1">
                  {([null, 1, 2, 3] as const).map((l) => (
                    <button
                      key={String(l)}
                      onClick={(e) => {
                        e.preventDefault();
                        setLevel(l);
                      }}
                      className={cn(
                        "rounded-md px-2 py-1 text-[12px] font-medium transition-colors",
                        level === l ? "bg-ink text-paper" : "text-ink-2 hover:bg-hover hover:text-ink",
                      )}
                      title={l ? LEVEL_NAMES[l] : `Adapts to you (now level ${suggested})`}
                    >
                      {l ? `L${l}` : "Auto"}
                    </button>
                  ))}
                </div>
              }
              href={`/study/maths/${slug}/practice${level ? `?level=${level}` : ""}`}
              cta={level ? `Practise ${LEVEL_NAMES[level].toLowerCase()}` : "Practise"}
              primary={progress.lesson_done}
            />
            <ActionCard
              delay={0.1}
              icon={<Timer className="size-5" />}
              title="Quick test"
              text="8 tasks from easy to hard. One try each, no hints, and you get a grade."
              meta={
                <>
                  <Clock className="size-3.5" /> about 6 min
                </>
              }
              href={`/study/maths/${slug}/practice?mode=test`}
              cta="Take the test"
            />
          </div>

          <section className="mt-10">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-[22px] font-bold tracking-[-0.015em]">Cheat sheet</h2>
                <p className="text-[13.5px] text-ink-3 print:hidden">Everything that matters, on one page.</p>
              </div>
              <button
                onClick={() => window.print()}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink print:hidden"
              >
                <Printer className="size-4" /> Print
              </button>
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div className="grid content-start gap-3 md:grid-cols-2">
                {topic.summary.map((block, i) => (
                  <SummaryCard key={block.title} block={block} delay={0.1 + i * 0.05} />
                ))}
              </div>
              <aside className="hidden xl:block print:hidden">
                <div className="sticky top-6">
                  <Tutor say={tip ? `${tip.title}: ${tip.body ?? ""}`.trim() : null} accessory="glasses" size={140} />
                </div>
              </aside>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function ActionCard({
  icon,
  title,
  text,
  meta,
  href,
  cta,
  primary,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  meta: React.ReactNode;
  href: string;
  cta: string;
  primary?: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 360, damping: 30 }}
      className={cn("flex flex-col rounded-2xl border p-4 shadow-card", primary ? "border-blob/35 bg-blob-soft/40" : "border-line bg-raised")}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn("grid size-9 place-items-center rounded-xl", primary ? "bg-blob text-white" : "bg-hover text-ink-2")}>{icon}</span>
        <span className="font-display text-[17px] font-semibold">{title}</span>
      </div>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-2">{text}</p>
      <div className="mt-3 flex min-h-7 items-center gap-1.5 text-[12.5px] text-ink-3">{meta}</div>
      <Link
        href={href}
        className={cn(
          "group mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition-[transform,background] active:scale-[0.98]",
          primary ? "bg-blob text-white hover:bg-blob-deep" : "bg-ink text-paper hover:bg-ink/88",
        )}
      >
        {cta}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </motion.div>
  );
}

function SummaryCard({ block, delay }: { block: SummaryBlock; delay: number }) {
  const tone = block.tone ?? "rule";
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 360, damping: 30 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 break-inside-avoid",
        tone === "rule" && "border-line bg-raised shadow-card",
        tone === "tip" && "border-blob/25 bg-blob-soft/35",
        tone === "warning" && "border-danger/25 bg-danger/[0.04]",
      )}
    >
      {tone === "rule" && <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-blob" />}
      <div className="flex items-center gap-2">
        <h3 className="text-[14.5px] font-semibold">{block.title}</h3>
        {tone !== "rule" && (
          <span className={cn("rounded-full px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide", tone === "tip" ? "bg-blob/15 text-blob-ink" : "bg-danger/10 text-danger")}>
            {tone === "tip" ? "Tip" : "Watch out"}
          </span>
        )}
      </div>
      {block.body && <Rich text={block.body} className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2" />}
      {block.examples && block.examples.length > 0 && (
        <div className="mt-3 space-y-1.5 rounded-xl bg-surface/80 px-3.5 py-3">
          {block.examples.map((ex) => (
            <div key={ex} className="overflow-x-auto">
              <MathView src={ex} size="sm" animate={false} />
            </div>
          ))}
        </div>
      )}
    </motion.article>
  );
}
