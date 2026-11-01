"use client";

import { motion } from "motion/react";
import { ArrowRight, BookOpenCheck, Check, GraduationCap, Layers, Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { useMessages } from "@/i18n/client";
import { atlasText } from "@/i18n/messages/atlas";
import { learnText } from "@/i18n/messages/learn";
import { useText } from "@/i18n/useText";
import { Ring } from "@/learn/components/Ring";
import { DAILY_GOAL, type LearnDay, type TopicProgress } from "@/learn/progress";
import { useTodayXp } from "@/learn/session";
import { cn } from "@/lib/utils";
import { ATLAS, ATLAS_AREAS, atlasHref, type AtlasArea, type AtlasMeta } from "../catalog";
import type { AtlasStats } from "../content";
import { useAllSeen } from "../seen";
import { AtlasArt } from "./AtlasArt";

/** The Atlas: every model, by area, with how much of each you have explored. */
export function AtlasHome({ stats, progress, days }: { stats: AtlasStats[]; progress: Record<string, TopicProgress>; days: LearnDay[] }) {
  const t = useMessages(atlasText);
  const l = useMessages(learnText);
  const tt = useText();
  const today = useTodayXp(days);
  const seen = useAllSeen();
  const areas = Object.keys(ATLAS_AREAS) as AtlasArea[];
  const totalItems = stats.reduce((n, s) => n + s.items, 0);
  const seenItems = ATLAS.reduce((n, m) => n + Math.min(seen[m.slug]?.length ?? 0, stats.find((s) => s.slug === m.slug)?.items ?? 0), 0);

  return (
    <>
      <TopBar
        crumbs={[
          { label: l.learn, href: "/learn", icon: <GraduationCap className="size-3.5" /> },
          { label: t.atlas, icon: <MapIcon className="size-3.5" /> },
        ]}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-2 sm:px-8">
          <header className="relative overflow-hidden rounded-3xl border border-line bg-raised p-5 shadow-card sm:p-7">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_120%_at_100%_0%,color-mix(in_oklab,var(--blob)_14%,transparent),transparent_60%)]" aria-hidden />
            <div className="bg-dots pointer-events-none absolute inset-y-0 right-0 w-2/3 opacity-25 [mask-image:linear-gradient(to_left,black,transparent)]" aria-hidden />
            <div className="relative grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">
                  <MapIcon className="size-3.5" /> {t.eyebrow}
                </div>
                <h1 className="mt-1 font-display text-[32px] font-bold leading-none tracking-[-0.02em] sm:text-[38px]">{t.atlas}</h1>
                <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-ink-2">{t.intro}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex h-14 items-center gap-3 rounded-2xl border border-line bg-surface/80 pl-2.5 pr-4">
                  <Ring value={totalItems ? seenItems / totalItems : 0} size={40} stroke={4.5}>
                    <Layers className="size-4 text-blob" />
                  </Ring>
                  <div className="leading-tight">
                    <div className="text-[15px] font-semibold tabular-nums">
                      {seenItems}
                      <span className="font-normal text-ink-3"> / {totalItems}</span>
                    </div>
                    <div className="text-[11.5px] text-ink-3">{t.seen}</div>
                  </div>
                </div>
                <div className="flex h-14 items-center gap-3 rounded-2xl border border-line bg-surface/80 pl-2.5 pr-4">
                  <Ring value={today.xp / DAILY_GOAL} size={40} stroke={4.5}>
                    <BookOpenCheck className="size-4 text-blob" />
                  </Ring>
                  <div className="leading-tight">
                    <div className="text-[15px] font-semibold tabular-nums">
                      {today.xp}
                      <span className="font-normal text-ink-3"> / {DAILY_GOAL} XP</span>
                    </div>
                    <div className="text-[11.5px] text-ink-3">{l.dailyGoal}</div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {areas.map((area) => {
            const models = ATLAS.filter((m) => m.area === area);
            if (!models.length) return null;
            return (
              <section key={area} className="mt-9">
                <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <h2 className="font-display text-[20px] font-semibold tracking-[-0.01em]">{tt(ATLAS_AREAS[area].title)}</h2>
                  <span className="text-[13px] text-ink-3">{tt(ATLAS_AREAS[area].blurb)}</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17.5rem),1fr))] gap-4">
                  {models.map((m, i) => (
                    <ModelCard key={m.slug} meta={m} stats={stats.find((s) => s.slug === m.slug)} seen={seen[m.slug]?.length ?? 0} progress={progress[m.slug]} delay={i * 0.04} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** A model's card: its picture, what's inside and how far you are. */
export function ModelCard({ meta, stats, seen, progress, delay = 0, compact = false }: { meta: AtlasMeta; stats?: AtlasStats; seen: number; progress?: TopicProgress; delay?: number; compact?: boolean }) {
  const t = useMessages(atlasText);
  const l = useMessages(learnText);
  const tt = useText();
  const items = stats?.items ?? 0;
  const share = items ? Math.min(1, seen / items) : 0;
  const done = progress?.lesson_done || (items > 0 && seen >= items);
  const counts = stats
    ? [stats.parts && t.structures(stats.parts), stats.steps && t.steps(stats.steps), stats.events && t.milestones(stats.events)].filter(Boolean).join(" · ")
    : "";
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: "spring", stiffness: 340, damping: 30 }}>
      <Link
        href={atlasHref(meta.slug)}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-pop"
      >
        <div className={cn("relative overflow-hidden bg-surface", compact ? "px-6 pt-3" : "px-8 pt-5")}>
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-25" aria-hidden />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_70%_at_50%_100%,color-mix(in_oklab,var(--blob)_10%,transparent),transparent_70%)]" aria-hidden />
          <AtlasArt slug={meta.slug} className="relative mx-auto max-w-[300px] transition-transform duration-300 group-hover:scale-[1.04]" />
          {done && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-ok px-2 py-0.5 text-[11px] font-semibold text-white shadow-card">
              <Check className="size-3" strokeWidth={3} /> {t.allExplored}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <div className="hyphens-auto font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] break-words">{tt(meta.title)}</div>
          <div className="mt-0.5 text-[13px] leading-snug text-ink-3">{tt(meta.subtitle)}</div>
          {!compact && <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-ink-2">{tt(meta.blurb)}</p>}
          <div className="mt-auto pt-4">
            <div className="flex items-center justify-between gap-2 text-[12px] text-ink-3">
              <span className="truncate">{counts}</span>
              {progress && progress.attempts > 0 && <span className="shrink-0 font-medium text-blob-ink">{t.quizScore(l.pct(progress.mastery))}</span>}
            </div>
            <div className="mt-2 flex items-center gap-2.5">
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <motion.div
                  className={cn("absolute inset-y-0 left-0 rounded-full", done ? "bg-ok" : "bg-blob")}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(share * 100)}%` }}
                  transition={{ delay: delay + 0.2, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-ink-2 transition-colors group-hover:text-blob-ink">
                {t.explore} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
