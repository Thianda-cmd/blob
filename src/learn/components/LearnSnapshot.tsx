"use client";

import { ArrowRight, Flame, Zap } from "lucide-react";
import Link from "next/link";
import { MATHS_CATALOG } from "@/learn/catalog";
import { DAILY_GOAL, masteryLabel, type LearnDay, type TopicProgress } from "@/learn/progress";
import { useTodayXp } from "@/learn/session";
import { cn } from "@/lib/utils";
import { MathView } from "./MathView";
import { Ring } from "./Ring";

/** Small learning card for the home dashboard: today's goal, streak and the suggested next topic. */
export function LearnSnapshot({ progress, days }: { progress: Record<string, TopicProgress>; days: LearnDay[] }) {
  const today = useTodayXp(days);
  const next =
    MATHS_CATALOG.find((t) => !progress[t.slug]?.lesson_done) ??
    [...MATHS_CATALOG].sort((a, b) => (progress[a.slug]?.mastery ?? 0) - (progress[b.slug]?.mastery ?? 0))[0];
  const started = progress[next.slug]?.lesson_done;
  const mastery = progress[next.slug]?.mastery ?? 0;

  return (
    <Link
      href={`/learn/maths/${next.slug}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-raised shadow-card transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2"
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Ring value={today.xp / DAILY_GOAL} size={34} stroke={4}>
          <Zap className="size-3.5 text-blob" />
        </Ring>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[13.5px] font-semibold tabular-nums">
            {today.xp} <span className="font-normal text-ink-3">/ {DAILY_GOAL} XP today</span>
          </div>
          <div className="text-[12px] text-ink-3">{today.xp >= DAILY_GOAL ? "Daily goal reached. Nice!" : "A short lesson gets you there."}</div>
        </div>
        <span
          className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold", today.streak > 0 ? "bg-blob-soft text-blob-ink" : "bg-hover text-ink-3")}
          title="Day streak"
        >
          <Flame className="size-3.5" />
          {today.streak}
        </span>
      </div>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-blob-ink">{started ? "Keep practising" : "Up next in maths"}</div>
          <div className="mt-0.5 truncate text-[15px] font-semibold">{next.title}</div>
          <div className="truncate text-[12.5px] text-ink-3">
            {next.de} · {masteryLabel(mastery)}
          </div>
        </div>
        <div className="grid h-14 w-24 shrink-0 place-items-center rounded-xl bg-surface transition-colors group-hover:bg-blob-soft/60">
          <MathView src={next.glyph} size="sm" animate={false} />
        </div>
        <ArrowRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
      </div>
    </Link>
  );
}
