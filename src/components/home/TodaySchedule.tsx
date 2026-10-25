"use client";

import { addDays, startOfDay } from "date-fns";
import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { buildItems } from "@/calendar/items";
import { ymd } from "@/calendar/time";
import { fmtRange } from "@/components/calendar/describe";
import { ItemIcon } from "@/components/calendar/ItemViews";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { projectLinksText } from "@/i18n/messages/projectLinks";
import type { CalEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const SHOWN = 5;

/**
 * Home: today's events from the calendar (lessons, appointments, birthdays), the ones already over
 * faded and the one going on now marked. Once today's are over, tomorrow's (what to pack for school).
 * Nothing at all when neither day has any. `now` is the browser's clock (null on the server, so the
 * day is the student's own).
 */
export function TodaySchedule({ events, now, title }: { events: CalEvent[]; now: number | null; title: (children: React.ReactNode, action?: React.ReactNode) => React.ReactNode }) {
  const t = useMessages(projectLinksText);
  const locale = useLocale();
  const { subjects } = useWorkspace();
  // The day only changes at midnight; `now` ticks every minute.
  const dayStart = now ? startOfDay(now).getTime() : null;
  const [today, tomorrow] = useMemo(() => {
    if (dayStart === null) return [[], []];
    const day = (offset: number) => {
      const from = addDays(new Date(dayStart), offset);
      return buildItems({ events, tasks: [], cards: [], subjects, from, to: addDays(from, 1) }).filter((i) => i.source === "event");
    };
    return [day(0), day(1)];
  }, [events, subjects, dayStart]);
  if (!now || dayStart === null) return null;
  const left = today.filter((i) => i.allDay || i.end.getTime() > now);
  const next = !left.length;
  const items = next ? tomorrow : today;
  if (!items.length) return null;
  const day = addDays(new Date(dayStart), next ? 1 : 0);

  // Past ones only while there is room: what is still to come matters more.
  const upcoming = next ? items : left;
  const shown = (upcoming.length >= SHOWN ? upcoming : [...items.filter((i) => !upcoming.includes(i)).slice(-(SHOWN - upcoming.length)), ...upcoming]).slice(0, SHOWN);
  const more = items.length - shown.length;
  const link = `/calendar?date=${ymd(day)}&view=day`;

  return (
    <div className="mb-7">
      {title(
        next ? t.tomorrow : t.today,
        <Link href={link} className="flex items-center gap-1 text-[12.5px] font-medium text-ink-3 hover:text-ink [@media(hover:none)]:-my-2 [@media(hover:none)]:py-2">
          {t.calendar} <ArrowRight className="size-3" />
        </Link>,
      )}
      <ul className="overflow-hidden rounded-xl border border-line bg-raised shadow-card">
        {shown.map((item) => {
          const past = !item.allDay && item.end.getTime() <= now;
          const current = !item.allDay && item.start.getTime() <= now && item.end.getTime() > now;
          return (
            <li key={item.key} className="border-b border-line last:border-b-0">
              <Link href={`${link}&event=${item.occurrence?.series.id ?? item.id}`} className={cn("flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-hover/60", past && "opacity-55")}>
                <span className="w-[86px] shrink-0 text-[12px] tabular-nums text-ink-3">
                  {item.allDay ? t.allDay : fmtRange(item.start, item.end, locale)}
                </span>
                <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ background: item.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
                    <ItemIcon item={item} className="text-ink-3" />
                    <span className="truncate">{item.title}</span>
                  </span>
                  {item.event?.location && (
                    <span className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-3">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{item.event.location}</span>
                    </span>
                  )}
                </span>
                {current && <span className="shrink-0 rounded-full bg-blob-soft px-2 py-0.5 text-[11px] font-semibold text-blob-ink">{t.now}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      {more > 0 && (
        <Link href={link} className="mt-1.5 block px-1 text-[12px] font-medium text-ink-3 hover:text-ink">
          {t.more(more)}
        </Link>
      )}
    </div>
  );
}
