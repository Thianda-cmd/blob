"use client";

import { motion } from "motion/react";
import { ArrowRight, BookOpen, Check, Clock, Dumbbell, GraduationCap, Printer, Timer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TopBar } from "@/components/shell/TopBar";
import { useLocale, useMessages } from "@/i18n/client";
import { learnText } from "@/i18n/messages/learn";
import { useText } from "@/i18n/useText";
import { type LearnDay, levelFor, masteryLabel, type TopicProgress } from "@/learn/progress";
import { useTodayXp } from "@/learn/session";
import { studyHref, SUBJECTS } from "@/learn/catalog";
import { getTopic } from "@/learn/topics";
import type { Level, SummaryBlock } from "@/learn/types";
import { cn } from "@/lib/utils";
import { MathView } from "./MathView";
import { Rich } from "./Rich";
import { Ring } from "./Ring";
import { topicNames } from "./topicNames";
import { Tutor } from "./Tutor";

export function TopicView({ slug, progress, days }: { slug: string; progress: TopicProgress; days: LearnDay[] }) {
  const topic = getTopic(slug)!;
  const today = useTodayXp(days);
  const [level, setLevel] = useState<Level | null>(null);
  const accuracy = progress.attempts ? Math.round((progress.correct / progress.attempts) * 100) : null;
  const checks = topic.lesson.filter((s) => s.type === "check").length;
  const suggested = levelFor(progress.mastery);
  const tip = topic.summary.find((b) => b.tone === "tip") ?? topic.summary[0];
  const t = useMessages(learnText);
  const tt = useText();
  const locale = useLocale();
  const names = topicNames(topic, locale);
  const subjectName = tt(SUBJECTS.find((s) => s.slug === topic.subject)!.title);
  const levelName = (l: Level) => t.levels[l];

  return (
    <>
      <TopBar
        className="print:hidden"
        crumbs={[
          { label: t.learn, href: "/learn", icon: <GraduationCap className="size-3.5" /> },
          { label: subjectName, href: `/learn/${topic.subject}` },
          { label: names.title },
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
                <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">
                  {subjectName} · {names.area}
                </div>
                <h1 className="mt-1 font-display text-[32px] font-bold leading-tight tracking-[-0.02em]">{names.title}</h1>
                {names.school && <div className="text-[15px] text-ink-3">{names.school}</div>}
                <p className="mt-2 max-w-[560px] text-[15px] leading-relaxed text-ink-2">{tt(topic.blurb)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-raised p-4 shadow-card">
              <Ring value={progress.mastery / 100} size={84} stroke={8}>
                <div className="text-center leading-none">
                  <div className="whitespace-nowrap text-[19px] font-bold tabular-nums">{t.pct(progress.mastery)}</div>
                </div>
              </Ring>
              <div className="space-y-1 text-[13px]">
                <div className="font-semibold text-ink">{masteryLabel(progress.mastery, locale)}</div>
                <div className="text-ink-2">
                  {t.topic.tasks(progress.attempts)}
                  {accuracy !== null && ` · ${t.topic.right(t.pct(accuracy))}`}
                </div>
                <div className="text-ink-2">{t.topic.bestStreak(progress.best_streak)}</div>
                <div className="text-ink-3">{t.topic.xpToday(today.xp)}</div>
              </div>
            </div>
          </header>

          <div className="mt-7 grid gap-3 md:grid-cols-3 print:hidden">
            <ActionCard
              delay={0}
              icon={<BookOpen className="size-5" />}
              title={t.topic.lesson}
              text={t.topic.lessonText(checks)}
              meta={
                <>
                  <Clock className="size-3.5" /> {t.minutes(topic.minutes)} · {t.topic.steps(topic.lesson.length)}
                  {progress.lesson_done && (
                    <span className="ml-auto flex items-center gap-1 font-medium text-ok">
                      <Check className="size-3.5" strokeWidth={3} /> {t.topic.done}
                    </span>
                  )}
                </>
              }
              href={studyHref(topic, "lesson")}
              cta={progress.lesson_done ? t.topic.reviewLesson : t.topic.startLesson}
              primary={!progress.lesson_done}
            />
            <ActionCard
              delay={0.05}
              icon={<Dumbbell className="size-5" />}
              title={t.topic.practice}
              text={t.topic.practiceText}
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
                      title={l ? levelName(l) : t.topic.adapts(suggested)}
                      aria-pressed={level === l}
                    >
                      {l ? t.topic.levelShort(l) : t.topic.auto}
                    </button>
                  ))}
                </div>
              }
              href={`${studyHref(topic, "practice")}${level ? `?level=${level}` : ""}`}
              cta={level ? t.topic.practiseLevel(levelName(level)) : t.topic.practise}
              primary={progress.lesson_done}
            />
            <ActionCard
              delay={0.1}
              icon={<Timer className="size-5" />}
              title={t.topic.quickTest}
              text={t.topic.quickTestText}
              meta={
                <>
                  <Clock className="size-3.5" /> {t.topic.aboutMinutes(6)}
                </>
              }
              href={`${studyHref(topic, "practice")}?mode=test`}
              cta={t.topic.takeTest}
            />
          </div>

          <section className="mt-10">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-[22px] font-bold tracking-[-0.015em]">{t.topic.cheatSheet}</h2>
                <p className="text-[13.5px] text-ink-3 print:hidden">{t.topic.cheatSheetText}</p>
              </div>
              <button
                onClick={() => window.print()}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink print:hidden"
              >
                <Printer className="size-4" /> {t.topic.print}
              </button>
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div className="grid content-start gap-3 md:grid-cols-2">
                {topic.summary.map((block, i) => (
                  <SummaryCard key={i} block={block} delay={0.1 + i * 0.05} />
                ))}
              </div>
              <aside className="hidden xl:block print:hidden">
                <div className="sticky top-6">
                  <Tutor say={tip ? `${tt(tip.title)}: ${tt(tip.body)}`.trim() : null} accessory="glasses" size={140} />
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
  const t = useMessages(learnText);
  const tt = useText();
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
        <h3 className="text-[14.5px] font-semibold">{tt(block.title)}</h3>
        {tone !== "rule" && (
          <span className={cn("rounded-full px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide", tone === "tip" ? "bg-blob/15 text-blob-ink" : "bg-danger/10 text-danger")}>
            {tone === "tip" ? t.topic.tip : t.topic.watchOut}
          </span>
        )}
      </div>
      {block.body && <Rich text={block.body} className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2" />}
      {block.examples && block.examples.length > 0 && (
        <div className="mt-3 space-y-1.5 rounded-xl bg-surface/80 px-3.5 py-3">
          {block.examples.map((ex, i) => (
            <div key={i} className="overflow-x-auto">
              <MathView src={ex} size="sm" animate={false} />
            </div>
          ))}
        </div>
      )}
    </motion.article>
  );
}
