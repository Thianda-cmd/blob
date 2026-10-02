"use client";

import { animate, AnimatePresence, motion } from "motion/react";
import { Flame, X, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Blob, type BlobHandle } from "@/components/blob/Blob";
import { useLocale, useMessages } from "@/i18n/client";
import { learnText } from "@/i18n/messages/learn";
import { masteryLabel } from "@/learn/progress";
import { cn } from "@/lib/utils";
import { Confetti } from "./Confetti";
import { Ring } from "./Ring";

export type SegmentState = "todo" | "current" | "ok" | "bad";

/** The thin bar at the top of a lesson or practice round. */
export function StudyTopBar({
  exitHref,
  title,
  progress,
  segments,
  xp,
  combo = 0,
}: {
  exitHref: string;
  title: string;
  /** 0..1, for lessons. */
  progress?: number;
  /** One state per question, for practice rounds. */
  segments?: SegmentState[];
  xp: number;
  combo?: number;
}) {
  const t = useMessages(learnText).chrome;
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1360px] items-center gap-4 px-4 sm:px-6">
        <Link
          href={exitHref}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink"
          aria-label={t.leave}
          title={t.leaveEsc}
        >
          <X className="size-5" />
        </Link>
        <span className="hidden max-w-[220px] truncate text-[13px] font-medium text-ink-2 md:block">{title}</span>
        <div className="flex min-w-0 flex-1 items-center">
          {segments ? (
            <div className="flex w-full gap-1">
              {segments.map((s, i) => (
                <span key={i} className="relative h-2 flex-1 overflow-hidden rounded-full bg-line">
                  <motion.span
                    className={cn("absolute inset-0 rounded-full", s === "ok" ? "bg-ok" : s === "bad" ? "bg-danger/70" : "bg-blob")}
                    initial={false}
                    animate={{ scaleX: s === "todo" ? 0 : s === "current" ? 0.35 : 1, opacity: s === "todo" ? 0 : 1 }}
                    style={{ originX: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 28 }}
                  />
                </span>
              ))}
            </div>
          ) : (
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-line">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-blob"
                initial={false}
                animate={{ width: `${Math.max(3, (progress ?? 0) * 100)}%` }}
                transition={{ type: "spring", stiffness: 140, damping: 24 }}
              >
                <span className="absolute inset-x-1.5 top-[3px] h-[2px] rounded-full bg-white/35" />
              </motion.div>
            </div>
          )}
        </div>
        <AnimatePresence>
          {combo >= 2 && (
            <motion.span
              key="combo"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              className="flex items-center gap-1 rounded-full bg-blob-soft px-2.5 py-1 text-[12.5px] font-semibold text-blob-ink"
              title={t.inARow}
            >
              <Flame className="size-3.5" />
              <motion.span key={combo} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                {combo}
              </motion.span>
            </motion.span>
          )}
        </AnimatePresence>
        <span className="flex items-center gap-1 text-[13px] font-semibold tabular-nums text-ink" title={t.sessionXp}>
          <Zap className="size-4 text-blob" />
          <CountUp value={xp} />
        </span>
      </div>
    </header>
  );
}

/** Number that counts up smoothly when it changes. */
export function CountUp({ value, from, duration = 0.6, delay = 0 }: { value: number; from?: number; duration?: number; delay?: number }) {
  const [shown, setShown] = useState(from ?? value);
  const prev = useRef(from ?? value);
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration,
      delay,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration, delay]);
  return <>{shown}</>;
}

export type EndStat = { label: string; value: number; suffix?: string; tone?: "blob" | "ok" | "ink" };

/** The celebration screen at the end of a lesson or round. */
export function SessionEnd({
  title,
  subtitle,
  stats,
  mastery,
  today,
  badge,
  children,
  happy = true,
}: {
  title: string;
  subtitle?: string;
  stats: EndStat[];
  mastery: { from: number; to: number };
  today: { from: number; to: number; goal: number };
  /** Big extra element, e.g. a grade. */
  badge?: ReactNode;
  children?: ReactNode;
  happy?: boolean;
}) {
  const blob = useRef<BlobHandle>(null);
  useEffect(() => {
    const t = setTimeout(() => (happy ? blob.current?.celebrate() : blob.current?.wave()), 350);
    return () => clearTimeout(t);
  }, [happy]);
  const reachedGoal = today.from < today.goal && today.to >= today.goal;
  const m = useMessages(learnText);
  const locale = useLocale();

  return (
    <div className="mx-auto grid w-full max-w-[920px] items-center gap-10 px-5 py-10 md:grid-cols-[260px_minmax(0,1fr)] md:py-16">
      <div className="relative mx-auto grid place-items-center">
        {happy && <Confetti seed={3} />}
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}>
          <Blob ref={blob} size={210} mood={happy ? "excited" : "happy"} accessory="cap" />
        </motion.div>
      </div>
      <div className="space-y-6">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-display text-[34px] font-bold leading-tight tracking-[-0.02em]"
          >
            {title}
          </motion.h1>
          {subtitle && (
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-1.5 text-[15px] text-ink-2">
              {subtitle}
            </motion.p>
          )}
        </div>
        {badge}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.08, type: "spring", stiffness: 380, damping: 26 }}
              className="rounded-2xl border border-line bg-raised px-4 py-3 shadow-card"
            >
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{s.label}</div>
              <div className={cn("mt-0.5 font-display text-[28px] font-bold tabular-nums", s.tone === "blob" ? "text-blob" : s.tone === "ok" ? "text-ok" : "text-ink")}>
                <CountUp value={s.value} from={0} delay={0.35 + i * 0.08} duration={0.9} />
                {s.suffix}
              </div>
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-medium text-ink">{m.chrome.mastery}</span>
              <span className="text-ink-2">
                {masteryLabel(mastery.to, locale)} · <CountUp value={mastery.to} from={mastery.from} delay={0.7} duration={1.1} />
                {m.pctSuffix}
              </span>
            </div>
            <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-line">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-blob"
                initial={{ width: `${mastery.from}%` }}
                animate={{ width: `${mastery.to}%` }}
                transition={{ delay: 0.7, duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Ring value={today.to / today.goal} from={today.from / today.goal} size={48} stroke={5} delay={0.8}>
              <Zap className="size-4 text-blob" />
            </Ring>
            <div className="text-[13px] leading-tight">
              <div className="font-medium text-ink">{reachedGoal ? m.chrome.goalReached : m.dailyGoal}</div>
              <div className="tabular-nums text-ink-2">
                <CountUp value={Math.min(today.to, today.goal * 9)} from={today.from} delay={0.8} /> / {today.goal} XP
              </div>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="flex flex-wrap gap-2">
          {children}
        </motion.div>
      </div>
    </div>
  );
}

/** Big pill buttons used in the study screens. */
export function StudyButton({
  children,
  onClick,
  href,
  variant = "ink",
  className,
  buttonRef,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "ink" | "blob" | "ghost";
  className?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  const cls = cn(
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[14.5px] font-semibold transition-[transform,background] active:scale-[0.97]",
    variant === "ink" && "bg-ink text-paper hover:bg-ink/88 shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]",
    variant === "blob" && "bg-blob text-white hover:bg-blob-deep shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]",
    variant === "ghost" && "text-ink-2 hover:bg-hover hover:text-ink",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button ref={buttonRef} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
