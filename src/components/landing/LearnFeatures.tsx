"use client";

import { Flame } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useLocale, useMessages } from "@/i18n/client";
import { landingText } from "@/i18n/messages/landing";
import { resolveText } from "@/i18n/text";
import { MATHS_CATALOG, topicHref } from "@/learn/catalog";
import { MathView } from "@/learn/components/MathView";
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

/** The 12 maths topics as compact tiles with their glyphs. */
export function TopicGrid() {
  const t = useMessages(landingText).learn.topics;
  const locale = useLocale();
  return (
    <div className="mt-14">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em]">{t.title}</h3>
        <p className="text-[13.5px] text-ink-3">{t.body}</p>
      </div>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3">
        {MATHS_CATALOG.map((topic, i) => (
          <motion.li
            key={topic.slug}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45, delay: (i % 6) * 0.04 + Math.floor(i / 6) * 0.08, ease }}
          >
            <Link
              href={topicHref(topic)}
              className="group flex h-full flex-col rounded-xl border border-line bg-raised p-2.5 shadow-card transition-[border-color,translate] duration-200 hover:-translate-y-0.5 hover:border-blob/45"
            >
              <span aria-hidden className="grid h-[52px] place-items-center overflow-hidden rounded-lg bg-surface text-ink transition-colors group-hover:bg-blob-soft/60">
                <MathView src={topic.glyph} size="sm" animate={false} className="text-[17px]! sm:text-[19px]!" />
              </span>
              <span className="mt-2.5 px-1 text-[13.5px] font-medium leading-snug">{resolveText(topic.title, locale)}</span>
              <span className="mt-auto px-1 pb-0.5 pt-1 text-[12px] text-ink-3">{t.minutes(topic.minutes)}</span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
