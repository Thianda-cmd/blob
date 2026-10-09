"use client";

import { ArrowRight, ChevronDown, Flame, Share2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useId, useState } from "react";
import { useLocale, useMessages } from "@/i18n/client";
import { intlLocale } from "@/i18n/format";
import { landingText } from "@/i18n/messages/landing";
import { resolveText } from "@/i18n/text";
import { CATALOG, firstLessonMinutes, isSubject, lessonLevels, subjectCatalog, SUBJECTS, topicHref, type Subject, type SubjectInfo, type TopicMeta } from "@/learn/catalog";
import { MathView } from "@/learn/components/MathView";
import { TopicGlyph } from "@/learn/components/TopicGlyph";
import { LEVELS } from "@/learn/types";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;
const inView = { initial: "off", whileInView: "on", viewport: { once: true, amount: 0.6 } } as const;

/** Understand → practise → test → revise → keep going, each with a tiny picture of the real thing. */
export function LearnStages({ className }: { className?: string }) {
  const t = useMessages(landingText).learn;
  const visuals = [<LineWidget key="u" />, <Levels key="p" label={t.visuals.level} correct={t.visuals.correct} />, <Grade key="t" label={t.visuals.grade} good={t.visuals.good} />, <Sheet key="r" rule={t.visuals.rule} />, <Streak key="k" />];
  return (
    <ol className={cn("flex flex-col justify-between", className)}>
      {t.stages.map((stage, i) => (
        <motion.li
          key={stage.kicker}
          initial={{ opacity: 0, x: 12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: i * 0.06, ease }}
          className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-4 border-t border-line py-3.5 first:border-t-0 first:pt-0 last:pb-0 lg:py-3"
        >
          <div aria-hidden className="grid h-[58px] w-[72px] place-items-center overflow-hidden rounded-xl border border-line bg-raised shadow-card">
            {visuals[i]}
          </div>
          <div className="min-w-0">
            <p className="text-[11.5px] font-medium uppercase tracking-wider text-blob-ink">{stage.kicker}</p>
            <h3 className="mt-0.5 text-[15px] font-semibold leading-snug tracking-[-0.01em]">{stage.title}</h3>
            <p className="mt-0.5 text-[13.5px] leading-snug text-ink-2">{stage.body}</p>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

/** A tiny "Geraden" widget: the line swings with the slider. */
function LineWidget() {
  return (
    <svg viewBox="0 0 64 48" className="h-[46px] w-[60px]">
      <g stroke="var(--line)" strokeWidth="1">
        {[12, 24, 36, 48].map((x) => (
          <line key={`x${x}`} x1={x} y1="4" x2={x} y2="36" />
        ))}
        {[12, 24].map((y) => (
          <line key={`y${y}`} x1="4" y1={y} x2="60" y2={y} />
        ))}
      </g>
      <line x1="4" y1="24" x2="60" y2="24" stroke="var(--ink-3)" strokeWidth="1" />
      <line x1="24" y1="4" x2="24" y2="36" stroke="var(--ink-3)" strokeWidth="1" />
      <motion.g
        style={{ originX: "24px", originY: "20px" }}
        animate={{ rotate: [-28, 16, -28] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <line x1="-6" y1="20" x2="54" y2="20" stroke="var(--blob)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="20" r="2.4" fill="var(--blob)" />
      </motion.g>
      <line x1="8" y1="43" x2="56" y2="43" stroke="var(--line-2)" strokeWidth="2" strokeLinecap="round" />
      <motion.circle cy="43" r="3" fill="var(--raised)" stroke="var(--blob)" strokeWidth="1.5" animate={{ cx: [14, 44, 14] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} />
    </svg>
  );
}

function Levels({ label, correct }: { label: string; correct: string }) {
  return (
    <motion.div {...inView} className="flex flex-col items-center gap-1">
      <div className="flex h-5 items-end gap-[3px]">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            variants={{ off: { scaleY: 0.2 }, on: { scaleY: 1, transition: { delay: 0.15 + i * 0.1, type: "spring", stiffness: 400, damping: 18 } } }}
            style={{ originY: 1, height: 8 + i * 6 }}
            className={cn("w-[7px] rounded-[2px]", i < 2 ? "bg-blob" : "bg-line-2")}
          />
        ))}
      </div>
      <motion.span
        variants={{ off: { opacity: 0, y: 3 }, on: { opacity: 1, y: 0, transition: { delay: 0.55 } } }}
        className="rounded bg-blob-soft px-1 text-[9.5px] font-semibold leading-[14px] text-blob-ink"
      >
        {correct}
      </motion.span>
      <span className="sr-only">{label}</span>
    </motion.div>
  );
}

function Grade({ label, good }: { label: string; good: string }) {
  return (
    <motion.div {...inView} className="flex flex-col items-center leading-none">
      <span className="text-[9.5px] font-medium uppercase tracking-wide text-ink-3">{label}</span>
      <motion.span
        variants={{ off: { scale: 1.6, opacity: 0, rotate: -12 }, on: { scale: 1, opacity: 1, rotate: -6, transition: { delay: 0.2, type: "spring", stiffness: 380, damping: 16 } } }}
        className="font-display text-[24px] font-bold text-blob-ink"
      >
        2
      </motion.span>
      <span className="text-[9.5px] text-ink-2">{good}</span>
    </motion.div>
  );
}

function Sheet({ rule }: { rule: string }) {
  return (
    <motion.div
      {...inView}
      variants={{ off: { y: 14, rotate: 0 }, on: { y: 5, rotate: -5, transition: { delay: 0.15, duration: 0.6, ease } } }}
      className="h-[52px] w-[42px] rounded-[4px] border border-line bg-surface px-1.5 pt-1.5 shadow-card"
    >
      <div className="h-[3px] w-4 rounded-full bg-blob" />
      <div className="mt-1 truncate text-[5.5px] font-semibold leading-none text-ink-2">{rule}</div>
      <div className="mt-1 text-[7px] leading-none text-ink">
        <MathView src="-(a - b)" size="inline" animate={false} />
      </div>
      <div className="mt-1 h-[2px] w-full rounded bg-line" />
      <div className="mt-[3px] h-[2px] w-3/4 rounded bg-line" />
    </motion.div>
  );
}

function Streak() {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <motion.div {...inView} className="relative grid size-[44px] place-items-center">
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
        <motion.circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="var(--blob)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          variants={{ off: { strokeDashoffset: c }, on: { strokeDashoffset: c * 0.25, transition: { delay: 0.2, duration: 1.1, ease } } }}
        />
      </svg>
      <Flame className="size-4 text-blob-ink" strokeWidth={2.2} />
    </motion.div>
  );
}

/** Rows of tiles shown before "Show all", per breakpoint: 3 rows at 2, 3 and 6 columns. */
const CAP = { phone: 6, tablet: 9, desktop: 12 };

/** Hides tiles past the cap of each breakpoint until the list is opened. */
function capClass(i: number) {
  if (i >= CAP.desktop) return "hidden";
  if (i >= CAP.tablet) return "max-lg:hidden";
  if (i >= CAP.phone) return "max-sm:hidden";
  return undefined;
}

/** Where "Show all" is needed: wherever the subject has more topics than that breakpoint shows. */
function toggleClass(n: number) {
  if (n > CAP.desktop) return "flex";
  if (n > CAP.tablet) return "flex lg:hidden";
  if (n > CAP.phone) return "flex sm:hidden";
  return "hidden";
}

/** Each subject's topics as compact tiles with their glyphs and levels; subjects come from the catalog. */
export function TopicGrid() {
  const t = useMessages(landingText).learn.topics;
  const locale = useLocale();
  const scope = useId();
  const live = SUBJECTS.filter((s): s is SubjectInfo & { slug: Subject } => s.live && isSubject(s.slug));
  const soon = SUBJECTS.filter((s) => !s.live).map((s) => resolveText(s.title, locale));
  const [subject, setSubject] = useState<Subject>(live[0].slug);
  const [open, setOpen] = useState(false);
  const catalog = subjectCatalog(subject);
  return (
    <div className="mt-12 lg:mt-14">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em]">{t.title(CATALOG.length)}</h3>
          <p className="mt-0.5 text-[13.5px] text-ink-3">{t.body[subject]}</p>
        </div>
        <div className="flex max-w-full flex-col items-start gap-1.5 sm:items-end">
          {/* Scrolls sideways once more subjects than fit are live. */}
          <div
            className="flex max-w-full overflow-x-auto rounded-xl border border-line bg-raised p-1 shadow-card [scrollbar-width:none]"
            role="tablist"
            aria-label={t.label}
          >
            {live.map((s) => (
              <button
                key={s.slug}
                type="button"
                role="tab"
                aria-selected={subject === s.slug}
                onClick={() => {
                  setSubject(s.slug);
                  setOpen(false);
                }}
                className={cn(
                  "relative flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-[13.5px] font-medium whitespace-nowrap transition-colors",
                  subject === s.slug ? "text-white" : "text-ink-2 hover:text-ink",
                )}
              >
                {subject === s.slug && <motion.span layoutId={`${scope}-subject`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
                <span className="relative">{resolveText(s.title, locale)}</span>
                <span className={cn("relative text-[12px] tabular-nums", subject === s.slug ? "text-white/75" : "text-ink-3")}>{subjectCatalog(s.slug).length}</span>
              </button>
            ))}
          </div>
          <Link href="/learn/french" className="group inline-flex items-center gap-1 px-1 text-[12.5px] font-medium text-blob-ink hover:underline">
            🇫🇷 {t.french} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          {soon.length > 0 && <p className="px-1 text-[12px] text-ink-3">{t.soon(new Intl.ListFormat(intlLocale(locale), { type: "conjunction" }).format(soon))}</p>}
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {catalog.map((topic, i) => (
            <motion.li
              key={topic.slug}
              layout
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: (i % 6) * 0.04 + Math.floor((i % CAP.desktop) / 6) * 0.08, ease }}
              className={open ? undefined : capClass(i)}
            >
              <TopicTile topic={topic} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(
          "mx-auto mt-4 h-9 items-center gap-1.5 rounded-lg border border-line bg-raised px-3.5 text-[13.5px] font-medium text-ink-2 shadow-card transition-colors hover:text-ink",
          toggleClass(catalog.length),
        )}
      >
        {open ? t.less : t.more(catalog.length)}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      <PicturesLink />
    </div>
  );
}

function TopicTile({ topic }: { topic: TopicMeta }) {
  const t = useMessages(landingText).learn.topics;
  const locale = useLocale();
  const ready = lessonLevels(topic).length;
  const minutes = firstLessonMinutes(topic);
  return (
    <Link
      href={topicHref(topic)}
      className="group flex h-full flex-col rounded-xl border border-line bg-raised p-2.5 shadow-card transition-[border-color,translate] duration-200 hover:-translate-y-0.5 hover:border-blob/45"
    >
      <span aria-hidden className="grid h-[52px] place-items-center overflow-hidden rounded-lg bg-surface text-ink transition-colors group-hover:bg-blob-soft/60">
        {topic.icon ? <TopicGlyph topic={topic} size="sm" /> : <MathView src={topic.glyph} size="sm" animate={false} className="text-[17px]! sm:text-[19px]!" />}
      </span>
      <span className="mt-2.5 px-1 text-[13.5px] font-medium leading-snug hyphens-auto break-words">{resolveText(topic.title, locale)}</span>
      <span className="mt-auto flex items-center gap-2 px-1 pb-0.5 pt-1 text-[12px] text-ink-3">
        {minutes > 0 && t.minutes(minutes)}
        {/* One dot per level, like the learning center: a ring when its lesson is ready, dashed while it's being written. */}
        <span className="ml-auto flex items-center gap-[3px]" role="img" aria-label={t.levels(ready, LEVELS.length)} title={t.levels(ready, LEVELS.length)}>
          {LEVELS.map((l) => (
            <span key={l} className={cn("size-2 rounded-full border-[1.5px]", topic.levels[l].minutes ? "border-blob/70" : "border-dashed border-line-2")} />
          ))}
        </span>
      </span>
    </Link>
  );
}

/** The public picture pages (/show): a feature of its own, in the same shape as the CV builder's points. */
function PicturesLink() {
  const t = useMessages(landingText).learn.pictures;
  return (
    <Link
      href="/show"
      className="group mt-6 flex items-center gap-4 rounded-2xl border border-line bg-raised p-3.5 shadow-card transition-colors hover:border-blob/45 sm:p-4"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface text-blob-ink">
        <Share2 className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-medium uppercase tracking-wider text-blob-ink">{t.kicker}</span>
        <span className="mt-0.5 block text-[15px] font-semibold leading-snug tracking-[-0.01em]">{t.title}</span>
        <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-2">{t.body}</span>
      </span>
      <span className="hidden shrink-0 items-center gap-1.5 text-[13.5px] font-medium text-blob-ink group-hover:underline sm:flex">
        {t.cta} <ArrowRight className="size-3.5" />
      </span>
      <ArrowRight className="size-4 shrink-0 text-blob-ink sm:hidden" aria-hidden />
    </Link>
  );
}
