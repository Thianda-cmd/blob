"use client";

import { addMonths, isSameDay, isSameMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { monthWeeks } from "@/calendar/layout";
import { ymd } from "@/calendar/time";
import type { Locale } from "@/i18n/config";
import type { calendarText } from "@/i18n/messages/calendar";
import { cn } from "@/lib/utils";
import { fmt } from "./describe";

type T = (typeof calendarText)["en"];

/** A small month to jump around with. Days with something on them get a dot. */
export function MiniMonth({
  value,
  range,
  busy,
  weekStartsOn,
  now,
  locale,
  t,
  onPick,
}: {
  value: Date;
  /** The days the main view shows (highlighted). */
  range: [Date, Date];
  /** Local yyyy-mm-dd of days with something on them. */
  busy: Set<string>;
  weekStartsOn: number;
  now: number | null;
  locale: Locale;
  t: T;
  onPick: (day: Date) => void;
}) {
  const [shown, setShown] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  // Follow the main view when it moves to another month.
  const [lastValue, setLastValue] = useState(value);
  if (!isSameDay(lastValue, value)) {
    setLastValue(value);
    if (!isSameMonth(value, shown)) setShown(new Date(value.getFullYear(), value.getMonth(), 1));
  }
  const weeks = monthWeeks(shown, weekStartsOn);
  return (
    <div className="select-none">
      <div className="mb-1 flex items-center gap-1 pl-1.5">
        <span className="flex-1 text-[13px] font-semibold capitalize text-ink">{fmt(shown, t.format.month, locale)}</span>
        <button type="button" onClick={() => setShown((m) => addMonths(m, -1))} className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink" aria-label={t.previous}>
          <ChevronLeft className="size-3.5" />
        </button>
        <button type="button" onClick={() => setShown((m) => addMonths(m, 1))} className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink" aria-label={t.next}>
          <ChevronRight className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center">
        {weeks[0].map((d) => (
          <span key={d.getDay()} className="pb-0.5 text-[10.5px] font-medium text-ink-3">
            {fmt(d, t.format.weekdayLetter, locale)}
          </span>
        ))}
        {weeks.flat().map((d) => {
          const inRange = d >= range[0] && d < range[1];
          const isToday = now !== null && isSameDay(d, now);
          return (
            <button
              key={d.getTime()}
              type="button"
              onClick={() => onPick(d)}
              className={cn(
                "relative mx-auto my-px grid size-7 place-items-center rounded-full text-[11.5px] tabular-nums transition-colors",
                isToday ? "bg-blob font-semibold text-white" : inRange ? "bg-blob-soft font-medium text-blob-ink" : isSameMonth(d, shown) ? "text-ink hover:bg-hover" : "text-ink-3 hover:bg-hover",
              )}
            >
              {d.getDate()}
              {busy.has(ymd(d)) && !isToday && <span className="absolute bottom-[3px] left-1/2 size-[3px] -translate-x-1/2 rounded-full bg-current opacity-60" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
