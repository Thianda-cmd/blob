"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { useLocale } from "@/i18n/client";
import { useText } from "@/i18n/useText";
import { groupLabel, midTone } from "@/components/ui/surfaces";
import { cn } from "@/lib/utils";
import type { TimelineView } from "../types";
import { EventIcon } from "./EventIcon";

/** "17th century" / "17. Jahrhundert" for a year. */
export function centuryOf(year: number, locale: "en" | "de") {
  const c = Math.floor(year / 100) + 1;
  if (locale === "de") return `${c}. Jahrhundert`;
  const suffix = c % 10 === 1 && c !== 11 ? "st" : c % 10 === 2 && c !== 12 ? "nd" : c % 10 === 3 && c !== 13 ? "rd" : "th";
  return `${c}${suffix} century`;
}

/**
 * The milestones as a vertical line through the centuries. Tapping one picks it; on narrow
 * screens its story opens right under it (`detail`), on wide ones the side panel shows it.
 */
export function TimelineStage({
  view,
  selected,
  onPick,
  seen,
  detail,
}: {
  view: TimelineView;
  selected: string | null;
  onPick: (id: string) => void;
  seen?: Set<string>;
  /** Shown under the picked milestone (narrow screens). */
  detail?: ReactNode;
}) {
  const tt = useText();
  const locale = useLocale();
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!selected) return;
    const el = list.current?.querySelector<HTMLElement>(`[data-event="${selected}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  // A century heading before the first milestone of each century.
  const centuries = view.events.map((e) => centuryOf(e.year, locale));
  return (
    <ol ref={list} className="relative">
      {/* The line. */}
      <span className="pointer-events-none absolute bottom-3 left-[23px] top-3 w-0.5 rounded-full bg-blob/30" aria-hidden />
      {view.events.map((e, i) => {
        const c = centuries[i];
        const head = i === 0 || c !== centuries[i - 1];
        const on = e.id === selected;
        const done = seen?.has(e.id);
        return (
          <Fragment key={e.id}>
            {head && (
              <li className="relative pb-2 pl-14 pt-4 first:pt-0" aria-hidden>
                <span className={groupLabel}>{c}</span>
              </li>
            )}
            <li data-event={e.id} className="relative pb-2">
              <button
                type="button"
                onClick={() => onPick(e.id)}
                aria-pressed={on}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-2xl border p-2 pr-3 text-left transition-[background,border-color,box-shadow] duration-200",
                  on ? "border-blob/50 bg-blob-soft/70 shadow-card" : "border-transparent hover:border-line hover:bg-raised",
                )}
              >
                <span
                  className={cn(
                    "relative z-10 grid size-[34px] shrink-0 place-items-center rounded-full border-2 transition-colors",
                    on ? "border-blob bg-blob text-white dark:border-blob-deep dark:bg-blob-deep" : done ? "border-blob/50 bg-raised text-blob-ink" : "border-line-2 bg-raised text-ink-2 group-hover:border-blob/50",
                  )}
                >
                  <EventIcon kind={e.icon} className="size-4" />
                  {done && !on && (
                    <span className="absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full bg-blob text-white ring-2 ring-paper dark:bg-blob-deep">
                      <Check className="size-2.5" strokeWidth={3.5} />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={cn("shrink-0 font-display text-[15px] font-bold tabular-nums", on ? "text-blob-ink" : "text-ink")}>{e.when ? tt(e.when) : e.year}</span>
                    <span className={cn("truncate text-[12.5px]", midTone)}>{tt(e.who)}</span>
                  </span>
                  <span className="block text-[14px] font-medium leading-snug text-ink-2 group-hover:text-ink">{tt(e.title)}</span>
                </span>
              </button>
              {on && detail && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.22 }} className="overflow-hidden pl-11 pt-2">
                  {detail}
                </motion.div>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
