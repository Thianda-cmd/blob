"use client";

import { motion } from "motion/react";
import { ArrowRight, BookOpen, Check, Clock, Dumbbell, GraduationCap, Hourglass, ImageIcon, Map as MapIcon, MousePointerClick, Printer, Timer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SaveCheatSheet, TopicNotes } from "@/components/notes/TopicNotes";
import { PageBody, pageTitleClass } from "@/components/shell/PageHeader";
import { TopBar } from "@/components/shell/TopBar";
import { buttonClass } from "@/components/ui/Button";
import { card, midTone, panel } from "@/components/ui/surfaces";
import { useLocale, useMessages } from "@/i18n/client";
import { atlasText } from "@/i18n/messages/atlas";
import { learnText } from "@/i18n/messages/learn";
import { showText } from "@/i18n/messages/show";
import { useText } from "@/i18n/useText";
import { type LearnDay, masteryLabel, type TopicProgress } from "@/learn/progress";
import { useTodayXp } from "@/learn/session";
import { atlasForTopic, atlasHref } from "@/learn/atlas/catalog";
import { AtlasArt } from "@/learn/atlas/components/AtlasArt";
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
  const a = useMessages(atlasText);
  const atlasModels = atlasForTopic(slug);

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
          { label: t.learn, href: "/learn", icon: <GraduationCap className="size-3.5 text-ink-3" /> },
          { label: subjectName, href: `/learn/${topic.subject}` },
          { label: names.title },
        ]}
      />
      <PageBody className="print:max-w-none print:p-0">
          <header className="grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-6 print:hidden">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              <div className="grid h-[88px] w-full shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-raised px-3 shadow-card sm:h-[112px] sm:w-[188px]">
                <TopicGlyph topic={topic} size="lg" />
              </div>
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-blob-ink">
                  {subjectName} · {names.area}
                </p>
                <h1 className={cn(pageTitleClass, "mt-0.5 hyphens-auto break-words")}>{names.title}</h1>
                {names.school && <div className={cn("text-[13.5px] break-words", midTone)}>{names.school}</div>}
                <p className="mt-1.5 max-w-[560px] text-[14px] leading-relaxed text-ink-2">{tt(topic.blurb)}</p>
              </div>
            </div>
            <div className={cn(card, "flex items-center gap-4 p-4")}>
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
                  <div className={midTone}>{t.topic.xpToday(today.xp)}</div>
                </div>
              </div>
            </div>
          </header>

          <section className="mt-8 print:hidden" aria-labelledby="topic-levels">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h2 id="topic-levels" className={sectionTitle}>
                {t.topic.levelsTitle}
              </h2>
              <span className={cn("text-[13px]", midTone)}>{t.topic.levelsText}</span>
            </div>
            {/* One level at a time: buttons that say whether they're on (the whole page below follows the level). */}
            <div className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] sm:gap-3" role="group" aria-labelledby="topic-levels">
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

          {atlasModels.length > 0 && (
            <section className="mt-8 print:hidden" aria-labelledby="topic-atlas">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <h2 id="topic-atlas" className={cn(sectionTitle, "flex items-center gap-2")}>
                    <MapIcon className="size-4 text-blob-ink" /> {a.related}
                  </h2>
                  <p className={cn("max-w-[640px] text-[13px]", midTone)}>{a.relatedText}</p>
                </div>
                <Link href="/learn/atlas" className="-my-1.5 flex items-center gap-1 py-1.5 text-[13px] font-medium text-blob-ink hover:underline">
                  {a.openAtlas} <ArrowRight className="size-3.5" />
                </Link>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {atlasModels.map((m) => (
                  <Link
                    key={m.slug}
                    href={atlasHref(m.slug)}
                    className="group flex min-w-0 items-center gap-3 rounded-xl border border-line bg-raised p-2 pr-3 shadow-card transition-[border-color,transform] hover:border-blob/40 motion-safe:hover:-translate-y-0.5"
                  >
                    <span className="w-[84px] shrink-0 rounded-lg bg-surface p-1">
                      <AtlasArt slug={m.slug} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold group-hover:text-blob-ink">{tt(m.title)}</span>
                      <span className={cn("line-clamp-2 text-[12.5px] leading-snug", midTone)}>{tt(m.subtitle)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {shareable.length > 0 && (
            <section className="mt-8 print:hidden" aria-labelledby="topic-show">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <h2 id="topic-show" className={sectionTitle}>
                    {s.sectionTitle}
                  </h2>
                  <p className={cn("max-w-[640px] text-[13px]", midTone)}>{s.sectionText}</p>
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
                <h2 className={cn(sectionTitle, "print:text-[22px] print:font-bold")}>
                  {t.topic.cheatSheet} <span className={cn("font-medium", midTone)}>· {t.level(level)}</span>
                </h2>
                <p className={cn("text-[13px] print:hidden", midTone)}>{summary.length ? t.topic.cheatSheetText : t.topic.cheatSheetSoon}</p>
              </div>
              {summary.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 print:hidden">
                  <SaveCheatSheet topic={topic} level={level} summary={summary} />
                  <button type="button" onClick={() => window.print()} className={buttonClass("ghost", "sm")}>
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
      </PageBody>
    </>
  );
}

/** A section's title on the topic page (17 px, like every section on an overview page). */
const sectionTitle = "font-display text-[17px] font-semibold tracking-[-0.01em] text-ink";


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
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        // Phones: one row per level (name and grade on the left, state on the right); wider: three cards side by side.
        "relative flex min-w-0 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-[border-color,background,box-shadow] sm:flex-col sm:items-start sm:gap-0 sm:px-4 sm:py-3",
        selected ? "border-blob/50 bg-blob-soft/60 shadow-card" : "border-line bg-raised shadow-card hover:border-line-2",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col sm:w-full sm:flex-none">
        <span className={cn("flex min-w-0 items-center gap-1.5 text-[14px] font-semibold sm:text-[15px]", selected ? "text-blob-ink" : "text-ink")}>
          <LevelBars level={level} className="shrink-0" />
          <span className="truncate">{name}</span>
        </span>
        <span className={cn("mt-0.5 truncate text-[12px] sm:text-[12.5px]", midTone)}>{depth}</span>
      </span>
      <span className="flex min-w-0 shrink-0 items-center gap-1 text-[12px] font-medium sm:mt-1.5 sm:w-full sm:shrink">
        {!written ? (
          <span className={cn("flex min-w-0 items-center gap-1", midTone)}>
            <Hourglass className="size-3 shrink-0" /> <span className="truncate">{t.topic.comingSoon}</span>
          </span>
        ) : state.lesson_done ? (
          <span className="flex min-w-0 items-center gap-1 text-ok">
            <Check className="size-3.5 shrink-0" strokeWidth={3} /> <span className="truncate">{t.topic.lessonDone}</span>
          </span>
        ) : (
          <span className={cn("truncate", state.mastery > 0 ? "text-blob-ink" : midTone)}>{masteryLabel(state.mastery, locale)}</span>
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
      className={cn(panel, "flex flex-col p-4")}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-lg bg-hover text-ink-3">
          <BookOpen className="size-5" />
        </span>
        <span className="font-display text-[17px] font-semibold text-ink-2">{title}</span>
        <span className="ml-auto rounded-full bg-hover px-2 py-0.5 text-[11.5px] font-medium text-ink-2">{badge}</span>
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
      className={cn("flex flex-col rounded-xl border p-4 shadow-card", primary ? "border-blob/35 bg-blob-soft/40" : "border-line bg-raised")}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn("grid size-9 place-items-center rounded-lg", primary ? "bg-blob text-white dark:bg-blob-deep" : "bg-hover text-ink-2")}>{icon}</span>
        <span className="font-display text-[17px] font-semibold">{title}</span>
      </div>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-2">{text}</p>
      <div className={cn("mt-3 flex min-h-7 items-center gap-1.5 text-[12.5px]", midTone)}>{meta}</div>
      {/* The suggested next step is the card's one violet button; the others are plain. */}
      <Link href={href} className={buttonClass(primary ? "blob" : "secondary", "md", "group mt-3 w-full [@media(hover:none)]:h-10")}>
        {cta}
        <ArrowRight className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
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
        "relative overflow-hidden rounded-xl border p-4 break-inside-avoid",
        tone === "rule" && "border-line bg-raised shadow-card",
        tone === "tip" && "border-blob/25 bg-blob-soft/35",
        tone === "warning" && "border-danger/25 bg-danger/[0.04]",
      )}
    >
      {tone === "rule" && <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-blob" />}
      <div className="flex items-center gap-2">
        <h3 className="text-[14.5px] font-semibold">{tt(block.title)}</h3>
        {tone !== "rule" && (
          <span className={cn("rounded-full px-1.5 py-px text-[11px] font-medium", tone === "tip" ? "bg-blob/15 text-blob-ink" : "bg-danger/10 text-danger")}>
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
