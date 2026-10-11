"use client";

import { addDays, isSameDay, startOfDay } from "date-fns";
import { motion } from "motion/react";
import { useMemo } from "react";
import { inLane, type CalItem } from "@/calendar/items";
import { itemDays } from "@/calendar/layout";
import type { Locale } from "@/i18n/config";
import type { calendarText } from "@/i18n/messages/calendar";
import { cn } from "@/lib/utils";
import { fmt, fmtRange, fmtTime } from "./describe";
import { ItemIcon, TaskTick, colorVar } from "./ItemViews";
import type { Move } from "./move";

type T = (typeof calendarText)["en"];

/** Day by day, what's coming: from `from` for `days` days (empty days left out). */
export function Agenda({
  from,
  days,
  items,
  locale,
  t,
  now,
  move,
  selectedKey,
  onOpen,
  onToggleTask,
  onMore,
  onDayClick,
}: {
  from: Date;
  days: number;
  items: CalItem[];
  locale: Locale;
  t: T;
  now: number | null;
  /** How the calendar got here: on the first paint the days are just there (move.ts). */
  move: Move;
  selectedKey: string | null;
  onOpen: (item: CalItem, rect: DOMRect) => void;
  onToggleTask: (item: CalItem) => void;
  onMore: () => void;
  onDayClick: (day: Date) => void;
}) {
  const groups = useMemo(() => {
    const out: { day: Date; items: CalItem[] }[] = [];
    for (let i = 0; i < days; i++) {
      const day = addDays(startOfDay(from), i);
      const list = items.filter((item) => {
        const { first, last } = itemDays(item);
        return first <= day && last >= day;
      });
      if (list.length) out.push({ day, items: list });
    }
    return out;
  }, [from, days, items]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-[860px] px-3 pb-28 pt-3 sm:px-6">
        {groups.length === 0 && <p className="py-16 text-center text-[13.5px] text-ink-3">{t.agendaEmpty}</p>}
        {groups.map(({ day, items: list }, gi) => {
          const isToday = now !== null && isSameDay(day, now);
          return (
            <motion.section
              key={day.getTime()}
              initial={move ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(gi, 10) * 0.025, type: "spring", stiffness: 420, damping: 34 }}
              className="flex gap-3 border-b border-line py-2.5 last:border-b-0 sm:gap-5"
            >
              <button type="button" onClick={() => onDayClick(day)} className="flex w-12 shrink-0 flex-col items-center pt-0.5 sm:w-14">
                <span className={cn("text-[11px] font-medium uppercase tracking-[0.04em]", isToday ? "text-blob-ink" : "text-ink-3")}>{fmt(day, t.format.weekday, locale)}</span>
                <span className={cn("mt-0.5 grid size-8 place-items-center rounded-full text-[17px] font-semibold tabular-nums", isToday ? "bg-blob text-white" : "text-ink")}>{day.getDate()}</span>
              </button>
              <ul className="flex min-w-0 flex-1 flex-col gap-1">
                {list.map((item) => {
                  const whole = inLane(item);
                  return (
                    <li key={item.key}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => onOpen(item, e.currentTarget.getBoundingClientRect())}
                        onKeyDown={(e) => e.key === "Enter" && onOpen(item, e.currentTarget.getBoundingClientRect())}
                        className={cn(
                          "flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-hover [@media(hover:none)]:min-h-12",
                          selectedKey === item.key && "bg-hover",
                          item.done && "opacity-60",
                        )}
                        style={colorVar(item.color)}
                      >
                        {item.source === "task" ? (
                          <TaskTick item={item} onToggle={() => onToggleTask(item)} size={16} />
                        ) : (
                          <span className={cn("w-1 shrink-0 self-stretch rounded-full bg-[var(--c)]", item.exam && "bg-blob")} />
                        )}
                        <span className="w-[84px] shrink-0 text-[12px] tabular-nums text-ink-3">
                          {whole ? t.allDay : item.marker ? fmtTime(item.start, locale) : fmtRange(item.start, item.end, locale)}
                        </span>
                        <span className="flex min-w-0 flex-1 items-center gap-1.5">
                          <ItemIcon item={item} className={item.exam ? "text-blob-ink" : "text-[var(--c)]"} />
                          <span className={cn("truncate text-[13.5px] font-medium text-ink", item.done && "line-through decoration-ink-3")}>{item.title || t.untitled}</span>
                        </span>
                        {item.event?.location && <span className="hidden max-w-[30%] truncate text-[12px] text-ink-3 sm:block">{item.event.location}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </motion.section>
          );
        })}
        <div className="flex justify-center pt-4">
          <button type="button" onClick={onMore} className="h-8 rounded-lg px-3 text-[12.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
            {t.agendaMore}
          </button>
        </div>
      </div>
    </div>
  );
}
