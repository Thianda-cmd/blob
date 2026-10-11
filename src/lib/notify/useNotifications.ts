"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { blob } from "@/components/blob/bus";
import { useNow } from "@/components/tasks/useNow";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { deviceTimeZone } from "@/calendar/time";
import { fmt, fmtTime } from "@/components/calendar/describe";
import { useLocale, useMessages } from "@/i18n/client";
import { notifyText } from "@/i18n/messages/notify";
import { calendarText } from "@/i18n/messages/calendar";
import { blobApp, isPhoneApp } from "@/lib/native";
import { useRows } from "@/lib/offline/useSync";
import { createClient } from "@/lib/supabase/client";
import type { CalEvent, Task } from "@/lib/types";
import { SUSPENDED, today as dayOf } from "@/notes/study/srs";
import { addDays, differenceInCalendarDays } from "date-fns";
import { plan, prefsOf, type NotifyWords } from "./plan";
import { publishWidget } from "@/lib/widget/publish";
import { widgetData } from "@/lib/widget/snapshot";
import { NOTIFY_EXTRA_KEY, notifyPermission, onNotificationTap, requestNotifyPermission, scheduleNotifications } from "./scheduler";

const ASKED = "blob-notify-asked";

type Extra = { cardsDue: Record<string, number>; learnDays: { day: string; xp: number }[] };

/** The counts from last time (without a connection the widgets and reminders still have them). */
function keptExtra(): Extra | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(NOTIFY_EXTRA_KEY) ?? "null") as Extra | null;
  } catch {
    return null;
  }
}

/**
 * Inside the apps: keeps the device's notifications in step with your calendar, tasks, cards and
 * learning (whenever they change), opens the right page when one is tapped, and keeps your time
 * zone on the profile. Does nothing in a browser.
 */
export function useNotifications() {
  const { userId, profile, setProfile, subjects } = useWorkspace();
  const router = useRouter();
  const locale = useLocale();
  const t = useMessages(notifyText);
  const tc = useMessages(calendarText);
  const events = useRows<CalEvent>("events");
  const tasks = useRows<Task>("tasks");
  const now = useNow();
  const hour = now === null ? null : Math.floor(now / 3600e3);
  const [extra, setExtra] = useState<Extra | null>(keptExtra);
  const prefs = useMemo(() => prefsOf(profile.notify), [profile.notify]);
  const app = typeof window !== "undefined" && !!blobApp();

  // The time zone on the profile follows the device (for anything the server works out).
  const tzDone = useRef(false);
  useEffect(() => {
    if (tzDone.current) return;
    tzDone.current = true;
    const tz = deviceTimeZone();
    if (tz && tz !== profile.time_zone) void setProfile({ time_zone: tz });
  }, [profile.time_zone, setProfile]);

  // Cards due and learning days: now and every hour.
  useEffect(() => {
    if (!app || hour === null) return;
    let alive = true;
    void (async () => {
      const db = createClient();
      const d0 = dayOf(new Date());
      const d1 = dayOf(addDays(new Date(), 1));
      const count = (day: string) => db.from("card_reviews").select("card_id", { count: "exact", head: true }).gt("reviews", 0).lte("due_on", day).lt("due_on", SUSPENDED);
      const since = dayOf(addDays(new Date(), -40));
      const [c0, c1, days] = await Promise.all([count(d0), count(d1), db.from("learn_days").select("day, xp").gte("day", since)]);
      if (!alive || c0.error || c1.error || days.error) return;
      const next: Extra = { cardsDue: { [d0]: c0.count ?? 0, [d1]: c1.count ?? 0 }, learnDays: (days.data ?? []) as Extra["learnDays"] };
      setExtra(next);
      try {
        localStorage.setItem(NOTIFY_EXTRA_KEY, JSON.stringify(next));
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [app, hour, userId]);

  const words: NotifyWords = useMemo(
    () => ({
      ...t,
      time: (d: Date) => fmtTime(d, locale),
      day: (d: Date, from: Date) => {
        const diff = differenceInCalendarDays(d, from);
        return diff === 0 ? t.today : diff === 1 ? t.tomorrow : fmt(d, tc.format.dayShort, locale);
      },
    }),
    [t, tc, locale],
  );

  // Plan and hand to the system, a moment after things settle.
  useEffect(() => {
    if (!app || !extra || now === null) return;
    const timer = setTimeout(async () => {
      const planned = plan({ now: new Date(), events, tasks, cardsDue: extra.cardsDue, learnDays: extra.learnDays, prefs, words, subjects });
      let permission = await notifyPermission();
      // Phones: ask once, when there is something to remind of.
      if (permission === "prompt" && planned.length && isPhoneApp(blobApp())) {
        let asked = false;
        try {
          asked = localStorage.getItem(ASKED) === "1";
          localStorage.setItem(ASKED, "1");
        } catch {}
        if (!asked) {
          blob.say(t.ask, { mood: "happy", ms: 6000 });
          await new Promise((r) => setTimeout(r, 1800));
          permission = await requestNotifyPermission();
        }
      }
      if (permission === "granted") await scheduleNotifications(planned, t.channels);
    }, 2500);
    return () => clearTimeout(timer);
    // `now` ticks every 30 s: re-plan only when the hour turns (or the data changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, extra, events, tasks, prefs, words, subjects, hour]);

  // The home and lock screen widgets (phones): the coming days, the streak, the cards to review.
  useEffect(() => {
    if (!app || now === null || !isPhoneApp(blobApp())) return;
    const timer = setTimeout(() => {
      void publishWidget(
        widgetData({ now: new Date(), events, tasks, subjects, cardsDue: extra?.cardsDue ?? {}, learnDays: extra?.learnDays ?? [], words: t.widget, locale }),
      );
    }, 3000);
    return () => clearTimeout(timer);
    // As above: again when the hour turns, not every 30 s.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, extra, events, tasks, subjects, t, locale, hour]);

  // Tapping a notification opens its page.
  useEffect(() => {
    if (!app) return;
    let off: (() => void) | null = null;
    let alive = true;
    void onNotificationTap((link) => router.push(link)).then((fn) => {
      if (alive) off = fn;
      else fn();
    });
    return () => {
      alive = false;
      off?.();
    };
  }, [app, router]);
}
