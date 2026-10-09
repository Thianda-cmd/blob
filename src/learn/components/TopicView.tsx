"use client";

import { motion } from "motion/react";
import { ArrowRight, BookOpen, Check, Clock, Dumbbell, GraduationCap, Hourglass, ImageIcon, MousePointerClick, Printer, Timer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SaveCheatSheet, TopicNotes } from "@/components/notes/TopicNotes";
import { TopBar } from "@/components/shell/TopBar";
import { useLocale, useMessages } from "@/i18n/client";
import { learnText } from "@/i18n/messages/learn";
import { showText } from "@/i18n/messages/show";
import { useText } from "@/i18n/useText";
import { type LearnDay, masteryLabel, type TopicProgress } from "@/learn/progress";
import { useTodayXp } from "@/learn/session";
import { studyHref, SUBJECTS, topicHref } from "@/learn/catalog";
import { levelProgress, type LevelRows, suggestedLevel } from "@/learn/levels";
import { showHref, showItems, showTopicHref } from "@/learn/showcase";
import { useTopic } from "@/learn/topics";
import { LEVELS, type Level, type SummaryBlock } from "@/learn/types";
import { cn } from "@/lib/utils";
import { LevelBars } from "./LevelBars";
import { MathView } from "./MathView";
import { Rich } from "./Rich";
import { Ring } from "./Ring";
import { ShareVisual } from "./ShareVisual";
import { TopicGlyph } from "./TopicGlyph";
import { topicNames } from "./topicNames";
import { Tutor } from "./Tutor";

export function TopicView({
  slug,
  progress,
  levels: rows,
  days,
  initialLevel,
}: {
  slug: string;
  progress: TopicProgress;
  levels: LevelRows;
  days: LearnDay[];
  initialLevel?: Level;
}) {
  const topic = useTopic(slug);
  const today = useTodayXp(days);
  const [level, setLevel] = useState<Level>(() => initialLevel ?? suggestedLevel(topic, progress, rows));
  const accuracy = progress.attempts ? Math.round((progress.correct / progress.attempts) * 100) : null;
  const t = useMessages(learnText);
  const tt = useText();
  const locale = useLocale();
  const names = topicNames(topic, locale);
  const subjectName = tt(SUBJECTS.find((s) => s.slug === topic.subject)!.title);

  const meta = topic.levels[level];
  const content = topic.lessons[level];
  const state = levelProgress(slug, level, progress, rows);
  const checks = content?.lesson.filter((s) => s.type === "check").length ?? 0;
  const summary = content?.summary ?? [];
  const tip = summary.find((b) => b.tone === "tip") ?? summary[0];
  const s = useMessages(showText);
  const shareable = meta.minutes ? showItems(topic).filter((i) => i.level === level) : [];

  function choose(l: Level) {
    setLevel(l);
    // Keep the level in the address, so going back from a lesson lands on the same level.
    window.history.replaceState(null, "", topicHref(topic, l));
  }

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
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative grid h-[88px] w-full shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-raised px-3 shadow-card sm:h-[120px] sm:w-[200px]"
              >
                <div className="bg-dots pointer-events-none absolute inset-0 opacity-30" />
                <TopicGlyph topic={topic} size="lg" className="relative" />
              </motion.div>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">
                  {subjectName} · {names.area}
                </div>
                <h1 className="mt-1 hyphens-auto font-display text-[28px] font-bold leading-tight tracking-[-0.02em] break-words sm:text-[32px]">{names.title}</h1>
                {names.school && <div className="text-[15px] text-ink-3 break-words">{names.school}</div>}
                <p className="mt-2 max-w-[560px] text-[15px] leading-relaxed text-ink-2">{tt(topic.blurb)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-raised p-4 shadow-card">
              <Ring value={progress.mastery / 100} size={84} stroke={8}>
                <div className="text-center leading-none">
                  <div className="whitespace-nowrap text-[19px] font-bold tabular-nums">{t.pct(progress.mastery)}</div>
                </div>
              </Ring>
              <div className="min-w-0 space-y-1 text-[13px]">
                <div className="font-semibold text-ink">{masteryLabel(progress.mastery, locale)}</div>
                {/* Below lg the card spans the page: the stats sit side by side instead of leaving it half empty. */}
                <div className="grid gap-x-8 gap-y-1 md:grid-flow-col md:justify-start lg:grid-flow-row">
                  <div className="text-ink-2">
                    {t.topic.tasks(progress.attempts)}
                    {accuracy !== null && ` · ${t.topic.right(t.pct(accuracy))}`}
                  </div>
                  <div className="text-ink-2">{t.topic.bestStreak(progress.best_streak)}</div>
                  <div className="text-ink-3">{t.topic.xpToday(today.xp)}</div>
                </div>
              </div>
            </div>
          </header>

          <section className="mt-8 print:hidden" aria-labelledby="topic-levels">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h2 id="topic-levels" className="font-display text-[19px] font-semibold tracking-[-0.01em]">
                {t.topic.levelsTitle}
              </h2>
              <span className="text-[13px] text-ink-3">{t.topic.levelsText}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] sm:gap-3" role="tablist" aria-labelledby="topic-levels">
              {LEVELS.map((l) => (
                <LevelTab
                  key={l}
                  level={l}
                  name={t.level(l)}
                  depth={tt(topic.levels[l].depth)}
                  written={!!topic.lessons[l] && !!topic.levels[l].minutes}
                  state={levelProgress(slug, l, progress, rows)}
                  selected={l === level}
                  onSelect={() => choose(l)}
                />
              ))}
            </div>
            {meta.blurb && tt(meta.blurb) !== tt(topic.blurb) && (
              <motion.p key={level} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 max-w-[760px] text-[14px] leading-relaxed text-ink-2">
                {tt(meta.blurb)}
              </motion.p>
            )}
          </section>

          <div className="mt-5 grid gap-3 md:grid-cols-3 print:hidden">
            {content && meta.minutes ? (
              <ActionCard
                delay={0}
                icon={<BookOpen className="size-5" />}
                title={t.topic.lesson}
                text={t.topic.lessonText(checks)}
                meta={
                  <>
                    <Clock className="size-3.5" /> {t.minutes(meta.minutes)} · {t.topic.steps(content.lesson.length)}
                    {state.lesson_done && (
                      <span className="ml-auto flex items-center gap-1 font-medium text-ok">
                        <Check className="size-3.5" strokeWidth={3} /> {t.topic.done}
                      </span>
                    )}
                  </>
                }
                href={studyHref(topic, "lesson", level)}
                cta={state.lesson_done ? t.topic.reviewLesson : t.topic.startLesson}
                primary={!state.lesson_done}
              />
            ) : (
              <SoonCard delay={0} title={t.topic.lesson} text={t.topic.lessonSoon} badge={t.topic.comingSoon} />
            )}
            <ActionCard
              delay={0.05}
              icon={<Dumbbell className="size-5" />}
              title={t.topic.practice}
              text={t.topic.practiceText}
              meta={
                <>
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
                    <span className="block h-full rounded-full bg-blob" style={{ width: `${state.mastery}%` }} />
                  </span>
                  {t.topic.levelMastery(masteryLabel(state.mastery, locale))}
                </>
              }
              href={studyHref(topic, "practice", level)}
              cta={t.topic.practise}
              primary={!!content && state.lesson_done}
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
              href={`${studyHref(topic, "practice", level)}&mode=test`}
              cta={t.topic.takeTest}
            />
          </div>

          <TopicNotes topic={topic} level={level} summary={summary} />

          {shareable.length > 0 && (
            <section className="mt-8 print:hidden" aria-labelledby="topic-show">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <h2 id="topic-show" className="font-display text-[19px] font-semibold tracking-[-0.01em]">
                    {s.sectionTitle}
                  </h2>
                  <p className="max-w-[640px] text-[13px] text-ink-3">{s.sectionText}</p>
                </div>
                <Link href={showTopicHref(topic)} className="-my-1.5 flex items-center gap-1 py-1.5 text-[13px] font-medium text-blob-ink hover:underline">
                  {s.allPictures} <ArrowRight className="size-3.5" />
                </Link>
              </div>
              <div key={level} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {shareable.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 8) * 0.03 }}
                    className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-raised pl-3 pr-1.5 shadow-card"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-blob-soft text-blob-ink">
                      {item.kind === "widget" ? <MousePointerClick className="size-3.5" /> : <ImageIcon className="size-3.5" />}
                    </span>
                    <a
                      href={showHref(topic, level, item.id)}
                      target="_blank"
                      rel="noopener"
                      aria-label={s.openPublic(tt(item.title))}
                      title={tt(item.title)}
                      className="min-w-0 flex-1 truncate py-2.5 text-[14px] font-medium hover:text-blob-ink"
                    >
                      {tt(item.title)}
                    </a>
                    <ShareVisual topic={topic} level={level} id={item.id} title={item.title} compact />
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-10">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-[22px] font-bold tracking-[-0.015em]">
                  {t.topic.cheatSheet} <span className="font-medium text-ink-3">· {t.level(level)}</span>
                </h2>
                <p className="text-[13.5px] text-ink-3 print:hidden">{summary.length ? t.topic.cheatSheetText : t.topic.cheatSheetSoon}</p>
              </div>
              {summary.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 print:hidden">
                  <SaveCheatSheet topic={topic} level={level} summary={summary} />
                  <button
                    onClick={() => window.print()}
                    className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
                  >
                    <Printer className="size-4" /> {t.topic.print}
                  </button>
                </div>
              )}
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div key={level} className="grid content-start gap-3 md:grid-cols-2">
                {summary.map((block, i) => (
                  <SummaryCard key={i} block={block} delay={0.1 + Math.min(i, 8) * 0.05} />
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


function LevelTab({
  level,
  name,
  depth,
  written,
  state,
  selected,
  onSelect,
}: {
  level: Level;
  name: string;
  depth: string;
  written: boolean;
  state: TopicProgress;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useMessages(learnText);
  const locale = useLocale();
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        // Phones: one row per level (name and grade on the left, state on the right); wider: three cards side by side.
        "relative flex min-w-0 items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-[border-color,background,box-shadow] sm:flex-col sm:items-start sm:gap-0 sm:px-4 sm:py-3",
        selected ? "border-blob/50 bg-blob-soft/45 shadow-card" : "border-line bg-raised hover:border-line-2",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col sm:w-full sm:flex-none">
        <span className={cn("flex min-w-0 items-center gap-1.5 text-[14px] font-semibold sm:text-[15px]", selected ? "text-blob-ink" : "text-ink")}>
          <LevelBars level={level} className="shrink-0" />
          <span className="truncate">{name}</span>
        </span>
        <span className="mt-0.5 truncate text-[12px] text-ink-3 sm:text-[12.5px]">{depth}</span>
      </span>
      <span className="flex min-w-0 shrink-0 items-center gap-1 text-[12px] font-medium sm:mt-1.5 sm:w-full sm:shrink">
        {!written ? (
          <span className="flex min-w-0 items-center gap-1 text-ink-3">
            <Hourglass className="size-3 shrink-0" /> <span className="truncate">{t.topic.comingSoon}</span>
          </span>
        ) : state.lesson_done ? (
          <span className="flex min-w-0 items-center gap-1 text-ok">
            <Check className="size-3.5 shrink-0" strokeWidth={3} /> <span className="truncate">{t.topic.lessonDone}</span>
          </span>
        ) : (
          <span className={cn("truncate", state.mastery > 0 ? "text-blob-ink" : "text-ink-3")}>{masteryLabel(state.mastery, locale)}</span>
        )}
      </span>
    </button>
  );
}

function SoonCard({ title, text, badge, delay }: { title: string; text: string; badge: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 360, damping: 30 }}
      className="flex flex-col rounded-2xl border border-dashed border-line-2 p-4"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-hover text-ink-3">
          <BookOpen className="size-5" />
        </span>
        <span className="font-display text-[17px] font-semibold text-ink-2">{title}</span>
        <span className="ml-auto rounded-full bg-hover px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{badge}</span>
      </div>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-2">{text}</p>
    </motion.div>
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
