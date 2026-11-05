"use client";

import { motion } from "motion/react";
import { ArrowRight, BookOpenCheck, Check, GraduationCap, Layers, Map as MapIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageBody, PageHeader } from "@/components/shell/PageHeader";
import { TopBar } from "@/components/shell/TopBar";
import { card, cardLift, midTone } from "@/components/ui/surfaces";
import { useMessages } from "@/i18n/client";
import { atlasText } from "@/i18n/messages/atlas";
import { learnText } from "@/i18n/messages/learn";
import { useText } from "@/i18n/useText";
import { Ring } from "@/learn/components/Ring";
import { okFill } from "@/learn/components/tones";
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
          { label: l.learn, href: "/learn", icon: <GraduationCap className="size-3.5 text-ink-3" /> },
          { label: t.atlas, icon: <MapIcon className="size-3.5 text-ink-3" /> },
        ]}
      />
      <PageBody>
        {/* The title, and how far you are beside it (below it on phones). */}
        <div className="flex flex-wrap items-end justify-between gap-x-8">
          <PageHeader className="min-w-0 flex-1 basis-64" title={t.atlas} meta={t.tagline} />
          <div className="mb-5 flex flex-wrap gap-2 sm:mb-6">
            <Stat ring={totalItems ? seenItems / totalItems : 0} icon={<Layers className="size-3.5 text-blob" />} value={seenItems} of={totalItems} label={t.seen} />
            <Stat ring={today.xp / DAILY_GOAL} icon={<BookOpenCheck className="size-3.5 text-blob" />} value={today.xp} of={`${DAILY_GOAL} XP`} label={l.dailyGoal} />
          </div>
        </div>

        <div className="space-y-9">
          {areas.map((area) => {
            const models = ATLAS.filter((m) => m.area === area);
            if (!models.length) return null;
            return (
              <section key={area}>
                <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">{tt(ATLAS_AREAS[area].title)}</h2>
                  <span className={cn("text-[13px]", midTone)}>{tt(ATLAS_AREAS[area].blurb)}</span>
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
      </PageBody>
    </>
  );
}

/** A number with a ring for how far it is, in a small raised card (the Atlas's "entdeckt" and the daily goal; also on a model's page). */
export function Stat({ ring, icon, value, of, label, color, title }: { ring: number; icon: ReactNode; value: number; of: number | string; label: string; color?: string; title?: string }) {
  return (
    <div className={cn(card, "flex h-12 items-center gap-2.5 pl-2 pr-3.5")} title={title}>
      <Ring value={ring} size={34} stroke={4} color={color}>
        {icon}
      </Ring>
      <div className="leading-tight">
        <div className="text-[14px] font-semibold tabular-nums">
          {value}
          <span className={cn("font-normal", midTone)}> / {of}</span>
        </div>
        <div className={cn("text-[11.5px]", midTone)}>{label}</div>
      </div>
    </div>
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
        className={cn(card, cardLift, "group flex h-full flex-col overflow-hidden")}
      >
        <div className={cn("relative overflow-hidden border-b border-line bg-surface", compact ? "px-6 pt-3" : "px-8 pt-5")}>
          <AtlasArt slug={meta.slug} className="relative mx-auto max-w-[300px] transition-transform duration-300 motion-safe:group-hover:scale-[1.04]" />
          {done && (
            <span className={cn("absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-card", okFill)}>
              <Check className="size-3" strokeWidth={3} /> {t.allExplored}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <div className="hyphens-auto font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] break-words">{tt(meta.title)}</div>
          <div className={cn("mt-0.5 text-[13px] leading-snug", midTone)}>{tt(meta.subtitle)}</div>
          {!compact && <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-ink-2">{tt(meta.blurb)}</p>}
          <div className="mt-auto pt-4">
            <div className={cn("flex items-center justify-between gap-2 text-[12px]", midTone)}>
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
                {t.explore} <ArrowRight className="size-3.5 transition-transform motion-safe:group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
