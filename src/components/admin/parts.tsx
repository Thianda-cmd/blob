"use client";

import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Globe, Power, Server } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useLocale, useMessages } from "@/i18n/client";
import { formatNumber } from "@/i18n/format";
import { adminText } from "@/i18n/messages/admin";
import type { DayCount } from "@/lib/oauth/admin-types";
import { cn } from "@/lib/utils";
import { axisDay, chartDay } from "./format";

/** The scrolling page frame every admin screen uses (inside the app shell, under the TopBar). */
export function AdminPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1080px] px-4 pb-28 pt-6 sm:px-8 lg:px-12 lg:pt-10">{children}</div>
    </div>
  );
}

export function StatTile({ label, value, sub, icon, delay = 0 }: { label: string; value: number | string; sub?: ReactNode; icon: ReactNode; delay?: number }) {
  const locale = useLocale();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32, delay }}
      className="h-full min-w-0 rounded-xl border border-line bg-raised p-4 shadow-card"
    >
      <div className="flex items-start gap-1.5 text-[12.5px] leading-tight text-ink-3 [&_svg]:mt-px [&_svg]:size-3.5 [&_svg]:shrink-0">
        {icon}
        <span className="min-w-0">{label}</span>
      </div>
      <div className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.025em] text-ink">{typeof value === "number" ? formatNumber(value, locale) : value}</div>
      {sub && <div className="mt-2 flex items-center gap-1 text-[12px] leading-snug text-ink-3">{sub}</div>}
    </motion.div>
  );
}

/** A tick top that reads well and halves into a whole number: 4, 6, 8, 10, 20, 40… */
function niceTop(max: number) {
  if (max <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 4, 6, 8, 10]) if (step * pow >= max) return step * pow;
  return 10 * pow;
}

/** Sign-ins per day as calm purple columns, with a tooltip per day and a table for screen readers. */
export function SignInChart({ series, className }: { series: DayCount[]; className?: string }) {
  const t = useMessages(adminText).chart;
  const locale = useLocale();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...series.map((d) => d.count));
  const top = niceTop(max);
  const total = series.reduce((sum, d) => sum + d.count, 0);
  const n = series.length;
  const ticks = [top, top / 2, 0];
  const mid = Math.floor((n - 1) / 2);
  const hovered = hover === null ? null : series[hover];

  return (
    <section className={cn("rounded-xl border border-line bg-raised p-4 shadow-card sm:p-5", className)} aria-labelledby="signin-chart-title">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 id="signin-chart-title" className="text-[14px] font-semibold text-ink">
            {t.title}
          </h2>
          <p className="text-[12px] text-ink-3">{t.sub}</p>
        </div>
        <div className="text-[12.5px] text-ink-2">{t.total(total)}</div>
      </div>

      <div className="mt-4 flex gap-2" aria-hidden>
        {/* y ticks */}
        <div className="relative h-[150px] w-6 shrink-0 text-right text-[11px] tabular-nums text-ink-3">
          {ticks.map((v) => (
            <span key={v} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${(1 - v / top) * 100}%` }}>
              {formatNumber(v, locale, { maximumFractionDigits: 1 })}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-[150px]" onPointerLeave={() => setHover(null)}>
            {ticks.map((v) => (
              <div key={v} className={cn("absolute inset-x-0 h-px", v === 0 ? "bg-line-2" : "bg-line/70")} style={{ top: `${(1 - v / top) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {series.map((d, i) => {
                const pct = (d.count / top) * 100;
                return (
                  <div key={d.day} className="relative flex h-full min-w-0 flex-1 items-end justify-center" onPointerEnter={() => setHover(i)}>
                    {hover === i && <div className="absolute inset-0 rounded-[4px] bg-hover/50" />}
                    {d.count > 0 && (
                      <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ type: "spring", stiffness: 240, damping: 30, delay: 0.1 + i * 0.012 }}
                        className={cn("relative w-full max-w-[24px] rounded-t-[4px] transition-colors", hover === i ? "bg-blob-deep" : "bg-blob")}
                        style={{ height: `${pct}%`, originY: 1 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {max === 0 && <div className="absolute inset-x-0 top-[38%] text-center text-[12.5px] text-ink-3">{t.empty}</div>}
            <AnimatePresence>
              {hovered && hover !== null && (
                <motion.div
                  key="tip"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={{ type: "spring", stiffness: 600, damping: 36 }}
                  className={cn(
                    "pointer-events-none absolute z-10 mb-2 whitespace-nowrap rounded-lg border border-line bg-raised px-2.5 py-1.5 shadow-pop",
                    hover < 4 ? "-translate-x-[12%]" : hover > n - 5 ? "-translate-x-[88%]" : "-translate-x-1/2",
                  )}
                  style={{ left: `${((hover + 0.5) / n) * 100}%`, bottom: `${Math.max((hovered.count / top) * 100, 0)}%` }}
                >
                  <div className="text-[11.5px] text-ink-3">{hover === n - 1 ? t.today : chartDay(hovered.day, locale)}</div>
                  <div className="text-[13px] font-semibold text-ink">{t.count(hovered.count)}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="relative mt-2 h-4 text-[11px] text-ink-3">
            <span className="absolute left-0">{series[0] ? axisDay(series[0].day, locale) : ""}</span>
            <span className="absolute -translate-x-1/2" style={{ left: `${((mid + 0.5) / n) * 100}%` }}>
              {series[mid] ? axisDay(series[mid].day, locale) : ""}
            </span>
            <span className="absolute right-0">{t.today}</span>
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>{t.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.day}</th>
            <th scope="col">{t.title}</th>
          </tr>
        </thead>
        <tbody>
          {series.map((d) => (
            <tr key={d.day}>
              <td>{chartDay(d.day, locale)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const pill = "inline-flex h-5.5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11.5px] font-medium [&_svg]:size-3";

export function TypeBadge({ confidential }: { confidential: boolean }) {
  const t = useMessages(adminText);
  return (
    <span className={cn(pill, "border border-line text-ink-2")}>
      {confidential ? <Server /> : <Globe />}
      {confidential ? t.type.confidential : t.type.public}
    </span>
  );
}

export function TrustedBadge() {
  const t = useMessages(adminText);
  return (
    <span className={cn(pill, "bg-blob-soft text-blob-ink")}>
      <BadgeCheck />
      {t.badge.trusted}
    </span>
  );
}

export function DisabledBadge() {
  const t = useMessages(adminText);
  return (
    <span className={cn(pill, "bg-hover text-ink-2")}>
      <Power />
      {t.badge.disabled}
    </span>
  );
}

export function Avatar({ name, src, size = 36 }: { name: string; src: string | null; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- avatar from storage
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-blob-soft font-semibold text-blob-ink" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/** A titled card used across the admin screens. */
export function Panel({ title, sub, action, children, className, id }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("overflow-hidden rounded-xl border border-line bg-raised shadow-card", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pb-1 pt-4 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-[14px] font-semibold text-ink">{title}</h2>}
            {sub && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
