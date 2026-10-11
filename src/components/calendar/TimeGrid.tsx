"use client";

import { addDays, getISOWeek, isSameDay, isWeekend, startOfDay } from "date-fns";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MARKER_MINUTES, inLane, type CalItem } from "@/calendar/items";
import { fitLane, itemDays, layoutDay, packLane } from "@/calendar/layout";
import type { Span } from "@/calendar/ops";
import { MINUTES_PER_DAY, atMinutes, dayDiff, minutesInto } from "@/calendar/time";
import type { Locale } from "@/i18n/config";
import type { calendarText } from "@/i18n/messages/calendar";
import { cn } from "@/lib/utils";
import { fmt, fmtRange, fmtTime } from "./describe";
import { edgeScroller, track } from "./gesture";
import { Bar, GridBlock, colorVar } from "./ItemViews";

type T = (typeof calendarText)["en"];

export type CommitMode = "move" | "resize" | "copy";

/** A change waiting for an answer (which occurrences of a repeating event): drawn where it will go. */
export type Held = { item: CalItem; span: Span } | null;

type Drag = { kind: "create"; span: Span } | { kind: "move" | "copy" | "resize"; item: CalItem; span: Span };

const LANE_ROW = 24;
const LANE_ROWS = 3;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const sameSpan = (a: Span, b: Span) => a.allDay === b.allDay && a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();
const spanOf = (item: CalItem): Span => ({ start: item.start, end: item.end, allDay: item.allDay });

type Props = {
  days: Date[];
  items: CalItem[];
  locale: Locale;
  t: T;
  now: number | null;
  touch: boolean;
  phone: boolean;
  selectedKey: string | null;
  /** The ghost of an event being created (its editor is open). */
  draft: Span | null;
  held: Held;
  /** Slide direction of the last move through time (-1 back, 1 forward), for the animation. */
  direction: number;
  /** Changes when the visible days change (the content slides). */
  rangeKey: string;
  /** Changes when the view changes (scrolls to the morning or now again). */
  viewKey: string;
  /** Day headers above the columns (the phone shows a week strip instead). */
  header: boolean;
  weekNumbers: boolean;
  onOpen: (item: CalItem, rect: DOMRect) => void;
  onNew: (span: Span, rect: DOMRect) => void;
  onCommit: (item: CalItem, span: Span, mode: CommitMode) => void;
  onToggleTask: (item: CalItem) => void;
  onDayClick: (day: Date) => void;
  /** Move the visible days (swipe: a page; holding a drag at the side: a day). */
  onShift: (days: number) => void;
  onBackground: () => void;
};

export function TimeGrid(props: Props) {
  const { days, items, locale, t, now, touch, phone, selectedKey, draft, held, direction, rangeKey, viewKey, header, weekNumbers } = props;
  const n = days.length;
  const scrollRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(48);
  const [zoom, setZoom] = useState(1);
  const hour = Math.round(fit * zoom);
  const [drag, setDrag] = useState<Drag | null>(null);
  /** Touch: an empty slot tapped once shows "New event"; tapping it again creates one. */
  const [slot, setSlot] = useState<Span | null>(null);
  const [laneOpen, setLaneOpen] = useState(false);
  const [scrollbar, setScrollbar] = useState(0);
  const swipeX = useMotionValue(0);

  // Latest values for handlers that live as long as a gesture.
  const live = useRef({ days, hour, props });
  useLayoutEffect(() => {
    live.current = { days, hour, props };
  });

  // Hour height: about 13 hours fill the screen (11 on phones); Ctrl/⌘ + wheel zooms.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight;
      setFit(clamp(Math.round(h / (phone ? 11 : 13)), phone ? 48 : 40, 76));
      setScrollbar(el.offsetWidth - el.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phone]);

  // Scroll to now (or the morning, or the first thing that day) when the view opens.
  const scrolledFor = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || scrolledFor.current === viewKey || now === null) return;
    scrolledFor.current = viewKey;
    const today = days.find((d) => isSameDay(d, now));
    const first = items.filter((i) => !inLane(i)).reduce((m, i) => Math.min(m, Math.max(0, minutesInto(startOfDay(i.start), i.start))), 7.5 * 60);
    const minute = today ? minutesInto(today, new Date(now)) - 90 : Math.min(first - 30, 7.5 * 60);
    el.scrollTop = Math.max(0, (minute / 60) * hour);
  }, [viewKey, now, days, items, hour]);

  // Ctrl/⌘ + wheel (and trackpad pinch) zooms around the pointer; a sideways swipe changes days.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let sideways = 0;
    let cooldown = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        const minute = ((el.scrollTop + e.clientY - r.top) / live.current.hour) * 60;
        setZoom((z) => {
          const next = clamp(z * (e.deltaY > 0 ? 0.92 : 1.08), 0.6, 2.4);
          const nextHour = Math.round((live.current.hour / z) * next);
          requestAnimationFrame(() => {
            el.scrollTop = (minute / 60) * nextHour - (e.clientY - r.top);
          });
          return next;
        });
        return;
      }
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5) {
        e.preventDefault();
        if (Date.now() < cooldown) return;
        sideways += e.deltaX;
        if (Math.abs(sideways) > 120) {
          live.current.props.onShift(sideways > 0 ? live.current.days.length : -live.current.days.length);
          sideways = 0;
          cooldown = Date.now() + 450;
        }
      } else sideways = 0;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Geometry ------------------------------------------------------------------------------------

  type Point = { zone: "grid" | "lane"; day: number; minutes: number };
  const point = useCallback((x: number, y: number): Point | null => {
    const cols = colsRef.current;
    const scroll = scrollRef.current;
    if (!cols || !scroll) return null;
    const r = cols.getBoundingClientRect();
    const count = live.current.days.length;
    const day = clamp(Math.floor(((x - r.left) / r.width) * count), 0, count - 1);
    if (laneRef.current && y < scroll.getBoundingClientRect().top) return { zone: "lane", day, minutes: 0 };
    return { zone: "grid", day, minutes: clamp(((y - r.top) / live.current.hour) * 60, 0, MINUTES_PER_DAY - 1) };
  }, []);

  /** Where a span is on screen (for anchoring the editor next to it). */
  const rectOf = useCallback((span: Span): DOMRect => {
    const cols = colsRef.current!.getBoundingClientRect();
    const d = live.current.days;
    const w = cols.width / d.length;
    const i = clamp(dayDiff(span.start, d[0]), 0, d.length - 1);
    if (span.allDay || !laneRef.current) {
      const lane = laneRef.current?.getBoundingClientRect() ?? cols;
      const last = clamp(dayDiff(itemDays(span).last, d[0]), i, d.length - 1);
      return new DOMRect(cols.left + i * w, lane.top, (last - i + 1) * w, LANE_ROW);
    }
    const top = cols.top + (minutesInto(d[i], span.start) / 60) * live.current.hour;
    const bottom = cols.top + (Math.min(MINUTES_PER_DAY, minutesInto(d[i], span.end)) / 60) * live.current.hour;
    return new DOMRect(cols.left + i * w, top, w, Math.max(20, bottom - top));
  }, []);

  // Dragging ------------------------------------------------------------------------------------

  const step = (e?: { shiftKey?: boolean }) => (e?.shiftKey ? 5 : 15);

  /** Follows the pointer near the edges: scrolls, and (holding at the side) moves to other days. */
  const follow = useRef<{ scroller: ReturnType<typeof edgeScroller> | null; side: ReturnType<typeof setTimeout> | null; sideDir: number; again: (() => void) | null }>({
    scroller: null,
    side: null,
    sideDir: 0,
    again: null,
  });

  const startFollowing = (again: () => void) => {
    const el = scrollRef.current;
    if (!el) return;
    follow.current.again = again;
    follow.current.scroller = edgeScroller(el, () => follow.current.again?.());
  };
  const keepFollowing = (x: number, y: number) => {
    const f = follow.current;
    f.scroller?.update(y);
    const cols = colsRef.current?.getBoundingClientRect();
    if (!cols) return;
    const dir = x < cols.left + 18 ? -1 : x > cols.right - 18 ? 1 : 0;
    if (dir !== f.sideDir) {
      if (f.side) clearTimeout(f.side);
      f.side = null;
      f.sideDir = dir;
      if (dir) {
        const tick = () => {
          live.current.props.onShift(dir);
          f.again?.();
          f.side = setTimeout(tick, 700);
        };
        f.side = setTimeout(tick, 650);
      }
    }
  };
  const stopFollowing = () => {
    const f = follow.current;
    f.scroller?.stop();
    if (f.side) clearTimeout(f.side);
    f.side = null;
    f.sideDir = 0;
    f.scroller = null;
    f.again = null;
  };
  useEffect(() => stopFollowing, []);

  /** Swiping sideways between days (touch, before a hold turns into a drag). */
  const swipe = (dx: number, _dy: number, phase: "move" | "end" | "cancel") => {
    if (phase === "move") {
      swipeX.set(dx * 0.9);
      return true;
    }
    if (phase === "end" && Math.abs(dx) > Math.min(90, (colsRef.current?.offsetWidth ?? 300) / 5)) {
      swipeX.set(0);
      live.current.props.onShift(dx < 0 ? live.current.days.length : -live.current.days.length);
    } else animate(swipeX, 0, { type: "spring", stiffness: 500, damping: 40 });
    return true;
  };

  const startCreate = (e: React.PointerEvent) => {
    const cols = colsRef.current?.getBoundingClientRect();
    // (Not from the hour labels.)
    if (!cols || e.clientX < cols.left || e.clientX > cols.right) return;
    const p0 = point(e.clientX, e.clientY);
    if (!p0) return;
    const d0 = live.current.days[0];
    const anchorDay = p0.day;
    const anchor = Math.floor(p0.minutes / 15) * 15;
    let span: Span | null = null;
    const compute = (x: number, y: number, ev?: { shiftKey?: boolean }) => {
      const p = point(x, y);
      if (!p) return;
      const k = dayDiff(live.current.days[0], d0);
      if (p0.zone === "lane") {
        const a = anchorDay;
        const b = p.day + k;
        span = { start: addDays(d0, Math.min(a, b)), end: addDays(d0, Math.max(a, b) + 1), allDay: true };
      } else {
        const s = step(ev);
        const cur = clamp(Math.round(p.minutes / s) * s, 0, MINUTES_PER_DAY);
        const from = Math.min(anchor, cur);
        const to = Math.max(anchor + s, cur);
        span = { start: atMinutes(addDays(d0, anchorDay), from), end: atMinutes(addDays(d0, anchorDay), Math.min(MINUTES_PER_DAY, to)), allDay: false };
      }
      setDrag({ kind: "create", span });
    };
    let last = { x: e.clientX, y: e.clientY };
    track(
      e,
      {
        start: () => {
          setSlot(null);
          compute(last.x, last.y);
          startFollowing(() => compute(last.x, last.y));
        },
        move: (x, y, ev) => {
          last = { x, y };
          compute(x, y, ev);
          keepFollowing(x, y);
        },
        end: () => {
          stopFollowing();
          setDrag(null);
          if (span) live.current.props.onNew(span, rectOf(span));
        },
        cancel: () => {
          stopFollowing();
          setDrag(null);
        },
        tap: () => {
          // A click makes an hour from the half hour clicked (a day in the all-day lane).
          const day = addDays(d0, anchorDay);
          const s: Span =
            p0.zone === "lane"
              ? { start: day, end: addDays(day, 1), allDay: true }
              : { start: atMinutes(day, Math.floor(p0.minutes / 30) * 30), end: atMinutes(day, Math.min(MINUTES_PER_DAY, Math.floor(p0.minutes / 30) * 30 + 60)), allDay: false };
          if (touch) {
            if (slot) {
              setSlot(null);
              live.current.props.onBackground();
            } else setSlot(s);
            return;
          }
          live.current.props.onBackground();
          live.current.props.onNew(s, rectOf(s));
        },
        swipe: touch ? swipe : undefined,
      },
      { hold: 380 },
    );
  };

  const startMove = (e: React.PointerEvent, item: CalItem, el: HTMLElement) => {
    const p0 = point(e.clientX, e.clientY);
    if (!p0) return;
    const d0 = live.current.days[0];
    const startWall = minutesInto(d0, item.start);
    const endWall = minutesInto(d0, item.end);
    const { first, last: lastDay } = itemDays(item);
    const firstDay = dayDiff(first, d0);
    const lengthDays = dayDiff(lastDay, first) + 1;
    const grabWall = p0.day * MINUTES_PER_DAY + p0.minutes - startWall;
    const grabDay = p0.day - firstDay;
    const original = spanOf(item);
    const lane = inLane(item);
    let span = original;
    let copy = false;
    let pos = { x: e.clientX, y: e.clientY };

    const compute = (x: number, y: number, ev?: { shiftKey?: boolean; altKey?: boolean }) => {
      const p = point(x, y);
      if (!p) return;
      const k = dayDiff(live.current.days[0], d0);
      const s = step(ev);
      if (p.zone === "grid") {
        const pw = (p.day + k) * MINUTES_PER_DAY + p.minutes;
        if (!lane) {
          const start = Math.round((pw - grabWall) / s) * s;
          span = { start: atMinutes(d0, start), end: atMinutes(d0, start + (endWall - startWall)), allDay: false };
        } else {
          const length = item.source === "event" ? 60 : MARKER_MINUTES;
          const start = Math.round((pw - 15) / s) * s;
          span = { start: atMinutes(d0, start), end: atMinutes(d0, start + length), allDay: false };
        }
      } else {
        const pd = p.day + k;
        if (lane) {
          const firstNew = pd - grabDay;
          span = item.allDay
            ? { start: addDays(d0, firstNew), end: addDays(d0, firstNew + lengthDays), allDay: true }
            : { start: atMinutes(d0, startWall + (firstNew - firstDay) * MINUTES_PER_DAY), end: atMinutes(d0, endWall + (firstNew - firstDay) * MINUTES_PER_DAY), allDay: false };
        } else span = { start: addDays(d0, pd), end: addDays(d0, pd + 1), allDay: true };
      }
      copy = !!ev?.altKey && item.source === "event";
      setDrag({ kind: copy ? "copy" : "move", item, span });
    };

    track(
      e,
      {
        start: () => {
          if (!item.movable) return false;
          setSlot(null);
          setDrag({ kind: "move", item, span: original });
          startFollowing(() => compute(pos.x, pos.y));
        },
        move: (x, y, ev) => {
          pos = { x, y };
          compute(x, y, ev);
          keepFollowing(x, y);
        },
        end: (_x, _y, ev) => {
          stopFollowing();
          setDrag(null);
          copy = !!ev.altKey && item.source === "event";
          if (!sameSpan(span, original)) live.current.props.onCommit(item, span, copy ? "copy" : "move");
        },
        cancel: () => {
          stopFollowing();
          setDrag(null);
        },
        tap: () => {
          setSlot(null);
          live.current.props.onOpen(item, el.getBoundingClientRect());
        },
        swipe: touch ? swipe : undefined,
      },
      { hold: 360 },
    );
  };

  const startResize = (e: React.PointerEvent, item: CalItem, edge: "start" | "end") => {
    e.stopPropagation();
    const d0 = live.current.days[0];
    const startWall = minutesInto(d0, item.start);
    const endWall = minutesInto(d0, item.end);
    const { first, last } = itemDays(item);
    const firstDay = dayDiff(first, d0);
    const lastDay = dayDiff(last, d0);
    const original = spanOf(item);
    const lane = inLane(item);
    let span = original;
    let pos = { x: e.clientX, y: e.clientY };
    const compute = (x: number, y: number, ev?: { shiftKey?: boolean }) => {
      const p = point(x, y);
      if (!p) return;
      const k = dayDiff(live.current.days[0], d0);
      if (!lane && p.zone === "grid") {
        const s = step(ev);
        const pw = Math.round(((p.day + k) * MINUTES_PER_DAY + p.minutes) / s) * s;
        span =
          edge === "end"
            ? { start: item.start, end: atMinutes(d0, Math.max(startWall + 15, pw)), allDay: false }
            : { start: atMinutes(d0, Math.min(endWall - 15, pw)), end: item.end, allDay: false };
      } else if (lane) {
        const pd = p.day + k;
        span =
          edge === "end"
            ? { start: item.start, end: addDays(d0, Math.max(firstDay, pd) + 1), allDay: item.allDay }
            : { start: addDays(d0, Math.min(lastDay, pd)), end: item.end, allDay: item.allDay };
        if (!item.allDay) span = { ...span, start: edge === "start" ? atMinutes(d0, startWall + (Math.min(lastDay, pd) - firstDay) * MINUTES_PER_DAY) : span.start };
      }
      setDrag({ kind: "resize", item, span });
    };
    track(
      e,
      {
        start: () => {
          if (!item.resizable) return false;
          setDrag({ kind: "resize", item, span: original });
          startFollowing(() => compute(pos.x, pos.y));
        },
        move: (x, y, ev) => {
          pos = { x, y };
          compute(x, y, ev);
          keepFollowing(x, y);
        },
        end: () => {
          stopFollowing();
          setDrag(null);
          if (!sameSpan(span, original)) live.current.props.onCommit(item, span, "resize");
        },
        cancel: () => {
          stopFollowing();
          setDrag(null);
        },
      },
      { hold: 0, threshold: 2 },
    );
  };

  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-drag]")) return;
    const blockEl = target.closest<HTMLElement>("[data-key]");
    const item = blockEl ? byKey.get(blockEl.dataset.key!) : undefined;
    const handle = target.closest<HTMLElement>("[data-handle]");
    // A mouse drag here moves things; it shouldn't select text on the page.
    if (e.pointerType === "mouse") e.preventDefault();
    if (item && handle) return startResize(e, item, handle.dataset.handle as "start" | "end");
    if (item && blockEl) return startMove(e, item, blockEl);
    if (target.closest("[data-slot]")) return;
    startCreate(e);
  };

  // What to draw ----------------------------------------------------------------------------------

  const laneItems = useMemo(() => items.filter(inLane), [items]);
  const timedItems = useMemo(() => items.filter((i) => !inLane(i)), [items]);
  const lane = useMemo(() => packLane(laneItems, days), [laneItems, days]);
  const laneFit = useMemo(() => fitLane(lane.bars, n, laneOpen ? Infinity : LANE_ROWS), [lane.bars, n, laneOpen]);
  const laneRows = Math.max(1, laneOpen ? lane.rows : Math.min(lane.rows, LANE_ROWS));
  const columns = useMemo(() => days.map((d) => layoutDay(timedItems, d)), [timedItems, days]);

  const moving = drag && drag.kind !== "create" ? drag.item.key : held?.item.key;
  const ghost: { span: Span; item?: CalItem; kind: string } | null = drag
    ? { span: drag.span, item: drag.kind === "create" ? undefined : drag.item, kind: drag.kind }
    : held
      ? { span: held.span, item: held.item, kind: "held" }
      : draft
        ? { span: draft, kind: "draft" }
        : slot
          ? { span: slot, kind: "slot" }
          : null;

  const today = now === null ? null : days.findIndex((d) => isSameDay(d, now));
  const nowMinutes = now === null || today === null || today < 0 ? null : minutesInto(days[today], new Date(now));
  const handlesFor = (item: CalItem) => item.resizable && (!touch || selectedKey === item.key);

  const gutter = phone ? 44 : 52;
  const slide = { initial: { x: direction * 28, opacity: 0.4 }, animate: { x: 0, opacity: 1 }, transition: { type: "spring" as const, stiffness: 420, damping: 38 } };

  return (
    <div className="flex min-h-0 flex-1 flex-col select-none [-webkit-touch-callout:none]" onPointerDown={onPointerDown}>
      {header && (
        <div className="flex shrink-0 border-b border-line" style={{ paddingRight: scrollbar }}>
          <div className="flex shrink-0 items-end justify-center pb-1 text-[10.5px] font-medium text-ink-3" style={{ width: gutter }}>
            {weekNumbers && `${t.weekShort} ${getISOWeek(days[0])}`}
          </div>
          <motion.div className="min-w-0 flex-1" style={{ x: swipeX }}>
          <motion.div key={rangeKey} {...slide} className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {days.map((d) => {
              const isToday = now !== null && isSameDay(d, now);
              return (
                <button
                  key={d.getTime()}
                  type="button"
                  data-no-drag
                  onClick={() => props.onDayClick(d)}
                  className="group flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 border-l border-line first:border-l-transparent hover:bg-hover/60"
                  aria-label={fmt(d, t.format.day, locale)}
                >
                  <span className={cn("text-[11px] font-medium uppercase tracking-[0.04em]", isToday ? "text-blob-ink" : "text-ink-3")}>{fmt(d, t.format.weekday, locale)}</span>
                  <span
                    className={cn(
                      "grid h-6 min-w-6 place-items-center rounded-full px-1 text-[15px] font-semibold leading-none tabular-nums transition-colors",
                      isToday ? "bg-blob text-white" : "text-ink group-hover:bg-hover",
                    )}
                  >
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </motion.div>
          </motion.div>
        </div>
      )}

      {/* The all-day lane */}
      <div className="flex shrink-0 border-b border-line" style={{ paddingRight: scrollbar }}>
        <div className="flex shrink-0 items-start justify-end pr-2 pt-1.5 text-[10.5px] text-ink-3" style={{ width: gutter }}>
          {lane.rows > LANE_ROWS ? (
            <button type="button" data-no-drag onClick={() => setLaneOpen((o) => !o)} className="rounded px-1 py-0.5 font-medium hover:bg-hover hover:text-ink">
              {laneOpen ? "−" : `+${lane.rows - LANE_ROWS}`}
            </button>
          ) : (
            <span lang={locale} className="text-right leading-[1.15] [hyphens:auto] [overflow-wrap:anywhere]">
              {t.allDay}
            </span>
          )}
        </div>
        <motion.div
          ref={laneRef}
          className="relative flex-1 overflow-hidden"
          animate={{ height: laneRows * LANE_ROW + 6 }}
          initial={false}
          transition={{ type: "spring", stiffness: 520, damping: 44 }}
        >
          <motion.div className="absolute inset-0" style={{ x: swipeX }}>
          <motion.div key={rangeKey} {...slide} className="absolute inset-0">
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden>
              {days.map((d, i) => (
                <div key={i} className={cn("border-l border-line first:border-l-transparent", isWeekend(d) && "bg-[color-mix(in_oklab,var(--hover)_30%,transparent)]")} />
              ))}
            </div>
            {laneFit.shown.map((b) => (
              <div
                key={b.item.key}
                data-key={b.item.key}
                role="button"
                tabIndex={0}
                aria-label={b.item.title || t.untitled}
                onKeyDown={(e) => e.key === "Enter" && props.onOpen(b.item, e.currentTarget.getBoundingClientRect())}
                className={cn("absolute px-[3px]", b.item.movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer", "touch-pan-y")}
                style={{ top: b.row * LANE_ROW + 3, height: LANE_ROW - 3, left: `${(b.first / n) * 100}%`, width: `${((b.last - b.first + 1) / n) * 100}%` }}
              >
                <Bar
                  item={b.item}
                  locale={locale}
                  untitled={t.untitled}
                  selected={selectedKey === b.item.key}
                  dimmed={moving === b.item.key}
                  fromBefore={b.fromBefore}
                  goesOn={b.goesOn}
                  onToggleTask={() => props.onToggleTask(b.item)}
                  handles={b.item.resizable && b.item.allDay && handlesFor(b.item) ? <LaneHandles touch={touch} /> : null}
                />
              </div>
            ))}
            {!laneOpen &&
              laneFit.hidden.map((h, i) =>
                h ? (
                  <button
                    key={`more-${i}`}
                    type="button"
                    data-no-drag
                    onClick={() => setLaneOpen(true)}
                    className="absolute rounded px-1.5 text-left text-[11px] font-medium text-ink-2 hover:bg-hover"
                    style={{ top: (LANE_ROWS - 1) * LANE_ROW + 3, height: LANE_ROW - 3, left: `${(i / n) * 100}%`, width: `${100 / n}%` }}
                  >
                    {t.more(h)}
                  </button>
                ) : null,
              )}
            {ghost && (ghost.span.allDay || ghost.span.end.getTime() - ghost.span.start.getTime() >= 864e5) && <LaneGhost ghost={ghost} days={days} t={t} locale={locale} />}
          </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Hours */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]" style={{ touchAction: "pan-y" }}>
        <div className="relative flex" style={{ height: hour * 24 }}>
          <div className="relative shrink-0" style={{ width: gutter }} aria-hidden>
            {Array.from({ length: 23 }, (_, h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10.5px] tabular-nums text-ink-3" style={{ top: (h + 1) * hour }}>
                {fmtTime(new Date(2000, 0, 1, h + 1), locale)}
              </span>
            ))}
            {nowMinutes !== null && (
              <span className="absolute right-1 z-10 -translate-y-1/2 rounded bg-blob px-1 text-[10px] font-semibold tabular-nums text-white" style={{ top: (nowMinutes / 60) * hour }}>
                {fmtTime(new Date(now!), locale)}
              </span>
            )}
          </div>
          <motion.div className="relative min-w-0 flex-1" style={{ x: swipeX }}>
          <motion.div
            ref={colsRef}
            key={rangeKey}
            {...slide}
            className="relative grid h-full"
            style={{
              gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
              backgroundImage: `linear-gradient(to bottom, var(--line) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--line) 45%, transparent) 1px, transparent 1px)`,
              backgroundSize: `100% ${hour}px, 100% ${hour}px`,
              backgroundPosition: `0 0, 0 ${hour / 2}px`,
            }}
            role="grid"
            aria-label={t.gridLabel}
          >
            {days.map((d, i) => (
              <div
                key={d.getTime()}
                className={cn(
                  "relative border-l border-line first:border-l-transparent",
                  isWeekend(d) && "bg-[color-mix(in_oklab,var(--hover)_30%,transparent)]",
                  today === i && "bg-[color-mix(in_oklab,var(--blob)_3.5%,transparent)]",
                )}
                role="gridcell"
                aria-label={fmt(d, t.format.day, locale)}
              >
                <AnimatePresence initial={false}>
                  {columns[i].map((b) => {
                    const height = Math.max(((b.bottom - b.top) / 60) * hour, b.item.marker ? 22 : 18);
                    return (
                      <motion.div
                        key={b.item.key}
                        data-key={b.item.key}
                        role="button"
                        tabIndex={0}
                        aria-label={`${b.item.title || t.untitled}, ${fmtRange(b.item.start, b.item.end, locale)}`}
                        onKeyDown={(e) => e.key === "Enter" && props.onOpen(b.item, e.currentTarget.getBoundingClientRect())}
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
                        transition={{ type: "spring", stiffness: 520, damping: 36 }}
                        className={cn("absolute px-[2px] pb-px", b.item.movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer", selectedKey === b.item.key && "z-[5]")}
                        style={{
                          top: (b.top / 60) * hour,
                          height,
                          left: `${(b.col / b.cols) * 100}%`,
                          width: `${(b.span / b.cols) * 100}%`,
                          touchAction: "pan-y",
                        }}
                      >
                        <GridBlock
                          item={b.item}
                          height={height}
                          locale={locale}
                          untitled={t.untitled}
                          selected={selectedKey === b.item.key}
                          dimmed={moving === b.item.key}
                          fromBefore={b.fromBefore}
                          goesOn={b.goesOn}
                          onToggleTask={() => props.onToggleTask(b.item)}
                          handles={handlesFor(b.item) && !b.fromBefore && !b.goesOn ? <GridHandles touch={touch} /> : null}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {today === i && nowMinutes !== null && (
                  <div className="pointer-events-none absolute inset-x-0 z-[6] h-0" style={{ top: (nowMinutes / 60) * hour }} aria-label={t.nowLabel}>
                    <div className="absolute inset-x-0 h-[2px] -translate-y-1/2 bg-blob" />
                    <div className="absolute -left-[5px] size-[10px] -translate-y-1/2 rounded-full bg-blob shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_22%,transparent)]" />
                  </div>
                )}
              </div>
            ))}
            {ghost && !ghost.span.allDay && ghost.span.end.getTime() - ghost.span.start.getTime() < 864e5 && (
              <GridGhost
                ghost={ghost}
                days={days}
                hour={hour}
                t={t}
                locale={locale}
                onSlot={(s) => {
                  setSlot(null);
                  props.onNew(s, rectOf(s));
                }}
              />
            )}
          </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/** Resize handles on a block: thin strips at the top and bottom (round knobs on touch screens). */
function GridHandles({ touch }: { touch: boolean }) {
  if (touch) {
    return (
      <>
        <span data-handle="start" className="absolute -top-2 right-3 z-10 grid size-6 place-items-center" style={{ touchAction: "none" }}>
          <span className="size-3 rounded-full border-2 border-[var(--c)] bg-raised" />
        </span>
        <span data-handle="end" className="absolute -bottom-2 left-3 z-10 grid size-6 place-items-center" style={{ touchAction: "none" }}>
          <span className="size-3 rounded-full border-2 border-[var(--c)] bg-raised" />
        </span>
      </>
    );
  }
  return (
    <>
      <span data-handle="start" className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize" />
      <span data-handle="end" className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize items-end justify-center">
        <span className="mb-[2px] h-[3px] w-5 rounded-full bg-[color-mix(in_oklab,var(--c)_60%,transparent)] opacity-0 transition-opacity group-hover/block:opacity-100" />
      </span>
    </>
  );
}

function LaneHandles({ touch }: { touch: boolean }) {
  return (
    <>
      <span data-handle="start" className={cn("absolute inset-y-0 left-0 cursor-ew-resize", touch ? "w-4" : "w-1.5")} style={{ touchAction: "none" }} />
      <span data-handle="end" className={cn("absolute inset-y-0 right-0 cursor-ew-resize", touch ? "w-4" : "w-1.5")} style={{ touchAction: "none" }} />
    </>
  );
}

type Ghost = { span: Span; item?: CalItem; kind: string };

/** Where a drag or a new event would go, in the hours. */
function GridGhost({ ghost, days, hour, t, locale, onSlot }: { ghost: Ghost; days: Date[]; hour: number; t: T; locale: Locale; onSlot: (s: Span) => void }) {
  const n = days.length;
  const color = ghost.item?.color ?? "var(--blob)";
  const segments = days
    .map((d, i) => {
      const top = Math.max(0, minutesInto(d, ghost.span.start));
      const bottom = Math.min(MINUTES_PER_DAY, minutesInto(d, ghost.span.end));
      return bottom > top || (i === 0 && bottom === top && top > 0) ? { i, top, bottom } : null;
    })
    .filter((s): s is { i: number; top: number; bottom: number } => !!s && s.top < MINUTES_PER_DAY);
  return (
    <>
      {segments.map((s, k) => {
        const height = Math.max(((s.bottom - s.top) / 60) * hour, 20);
        const label = k === 0 ? fmtRange(ghost.span.start, ghost.span.end, locale) : null;
        const isSlot = ghost.kind === "slot";
        return (
          <motion.div
            key={`${ghost.kind}-${s.i}`}
            data-slot={isSlot ? "" : undefined}
            className={cn("pointer-events-none absolute z-[8] px-[2px]", isSlot && "pointer-events-auto")}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 600, damping: 36 }}
            style={{ top: (s.top / 60) * hour, height, left: `${(s.i / n) * 100}%`, width: `${100 / n}%`, transitionProperty: "top,height", transitionDuration: "70ms", ...colorVar(color) }}
            onClick={isSlot ? () => onSlot(ghost.span) : undefined}
          >
            {ghost.item && ghost.kind !== "draft" ? (
              <GridBlock item={{ ...ghost.item, start: ghost.span.start, end: ghost.span.end, allDay: false }} height={height} locale={locale} untitled={t.untitled} ghost />
            ) : (
              <div
                className={cn(
                  "flex h-full flex-col overflow-hidden rounded-[7px] border-l-[3px] border-[var(--c)] px-1.5 py-[3px] text-[12px] leading-[1.25]",
                  isSlot ? "bg-[color-mix(in_oklab,var(--c)_10%,var(--raised))] text-blob-ink shadow-card" : "bg-[color-mix(in_oklab,var(--c)_22%,var(--raised))] text-ink shadow-pop",
                )}
              >
                <span className="truncate font-semibold">{isSlot ? `+ ${t.newHere}` : t.untitled}</span>
                {label && height >= 34 && <span className="truncate text-[11px] tabular-nums text-ink-2">{label}</span>}
              </div>
            )}
          </motion.div>
        );
      })}
    </>
  );
}

function LaneGhost({ ghost, days, t, locale }: { ghost: Ghost; days: Date[]; t: T; locale: Locale }) {
  const n = days.length;
  const { first, last } = itemDays(ghost.span);
  const f = clamp(dayDiff(first, days[0]), 0, n - 1);
  const l = clamp(dayDiff(last, days[0]), 0, n - 1);
  if (dayDiff(last, days[0]) < 0 || dayDiff(first, days[0]) > n - 1) return null;
  const item: CalItem = ghost.item
    ? { ...ghost.item, start: ghost.span.start, end: ghost.span.end, allDay: ghost.span.allDay }
    : { key: "ghost", source: "event", id: "ghost", title: "", start: ghost.span.start, end: ghost.span.end, allDay: true, color: "var(--blob)", kind: "event", subjectId: null, movable: false, resizable: false, done: false, marker: false, exam: false };
  return (
    <div className="pointer-events-none absolute z-[8] px-[3px]" style={{ top: 3, height: LANE_ROW - 3, left: `${(f / n) * 100}%`, width: `${((l - f + 1) / n) * 100}%` }}>
      <Bar item={item} locale={locale} untitled={t.untitled} ghost />
    </div>
  );
}
