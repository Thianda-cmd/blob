"use client";

import { addDays, getISOWeek, isSameDay, isSameMonth, isWeekend } from "date-fns";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { inLane, type CalItem } from "@/calendar/items";
import { fitLane, itemDays, packLane } from "@/calendar/layout";
import type { Span } from "@/calendar/ops";
import { MINUTES_PER_DAY, atMinutes, dayDiff, minutesInto } from "@/calendar/time";
import type { Locale } from "@/i18n/config";
import type { calendarText } from "@/i18n/messages/calendar";
import { cn } from "@/lib/utils";
import { fmt } from "./describe";
import { track } from "./gesture";
import { Bar } from "./ItemViews";
import type { CommitMode, Held } from "./TimeGrid";

type T = (typeof calendarText)["en"];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const sameSpan = (a: Span, b: Span) => a.allDay === b.allDay && a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();

type Drag = { kind: "create"; span: Span } | { kind: "move" | "copy"; item: CalItem; span: Span };

export function MonthGrid({
  month,
  weeks,
  items,
  locale,
  t,
  now,
  touch,
  phone,
  selectedKey,
  held,
  draft,
  direction,
  rangeKey,
  weekNumbers,
  onOpen,
  onNew,
  onCommit,
  onToggleTask,
  onDayClick,
  onShift,
}: {
  month: Date;
  weeks: Date[][];
  items: CalItem[];
  locale: Locale;
  t: T;
  now: number | null;
  touch: boolean;
  phone: boolean;
  selectedKey: string | null;
  held: Held;
  draft: Span | null;
  direction: number;
  rangeKey: string;
  weekNumbers: boolean;
  onOpen: (item: CalItem, rect: DOMRect) => void;
  onNew: (span: Span, rect: DOMRect) => void;
  onCommit: (item: CalItem, span: Span, mode: CommitMode) => void;
  onToggleTask: (item: CalItem) => void;
  onDayClick: (day: Date) => void;
  /** Months to move (swiping). */
  onShift: (months: number) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState(110);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [more, setMore] = useState<{ day: Date; rect: DOMRect } | null>(null);
  const swipeX = useMotionValue(0);
  const first = weeks[0][0];
  const bar = phone ? 17 : 21;
  const head = phone ? 22 : 26;

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => setRowHeight(el.clientHeight / weeks.length);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [weeks.length]);

  const maxRows = Math.max(1, Math.floor((rowHeight - head - 4) / bar));
  const packed = useMemo(
    () =>
      weeks.map((week) => {
        const { bars } = packLane(items, week);
        return fitLane(bars, 7, maxRows);
      }),
    [weeks, items, maxRows],
  );

  /** The day under a point, counted from the first day shown. */
  const dayAt = (x: number, y: number) => {
    const r = gridRef.current!.getBoundingClientRect();
    const col = clamp(Math.floor(((x - r.left) / r.width) * 7), 0, 6);
    const row = clamp(Math.floor(((y - r.top) / r.height) * weeks.length), 0, weeks.length - 1);
    return row * 7 + col;
  };

  const rectOfDay = (i: number) => {
    const r = gridRef.current!.getBoundingClientRect();
    const w = r.width / 7;
    const h = r.height / weeks.length;
    return new DOMRect(r.left + (i % 7) * w, r.top + Math.floor(i / 7) * h, w, h);
  };

  const startCreate = (e: React.PointerEvent) => {
    const d0 = dayAt(e.clientX, e.clientY);
    let span: Span = { start: addDays(first, d0), end: addDays(first, d0 + 1), allDay: true };
    track(
      e,
      {
        start: () => setDrag({ kind: "create", span }),
        move: (x, y) => {
          const d = dayAt(x, y);
          span = { start: addDays(first, Math.min(d0, d)), end: addDays(first, Math.max(d0, d) + 1), allDay: true };
          setDrag({ kind: "create", span });
        },
        end: () => {
          setDrag(null);
          onNew(span, rectOfDay(dayDiff(span.start, first)));
        },
        cancel: () => setDrag(null),
        tap: () => {
          if (touch) onDayClick(addDays(first, d0));
          else onNew(span, rectOfDay(d0));
        },
        swipe: touch ? swipe : undefined,
      },
      { hold: 400 },
    );
  };

  const startMove = (e: React.PointerEvent, item: CalItem, el: HTMLElement) => {
    const d0 = dayAt(e.clientX, e.clientY);
    const { first: f, last } = itemDays(item);
    const firstDay = dayDiff(f, first);
    const length = dayDiff(last, f) + 1;
    const grab = d0 - firstDay;
    const original: Span = { start: item.start, end: item.end, allDay: item.allDay };
    let span = original;
    track(
      e,
      {
        start: () => {
          if (!item.movable) return false;
          setMore(null);
          setDrag({ kind: "move", item, span });
        },
        move: (x, y, ev) => {
          const newFirst = dayAt(x, y) - grab;
          const shift = newFirst - firstDay;
          span = item.allDay
            ? { start: addDays(first, newFirst), end: addDays(first, newFirst + length), allDay: true }
            : { start: atMinutes(first, minutesInto(first, item.start) + shift * MINUTES_PER_DAY), end: atMinutes(first, minutesInto(first, item.end) + shift * MINUTES_PER_DAY), allDay: false };
          setDrag({ kind: ev.altKey && item.source === "event" ? "copy" : "move", item, span });
        },
        end: (_x, _y, ev) => {
          setDrag(null);
          if (!sameSpan(span, original)) onCommit(item, span, ev.altKey && item.source === "event" ? "copy" : "move");
        },
        cancel: () => setDrag(null),
        tap: () => onOpen(item, el.getBoundingClientRect()),
        swipe: touch ? swipe : undefined,
      },
      { hold: 360 },
    );
  };

  function swipe(dx: number, _dy: number, phase: "move" | "end" | "cancel") {
    if (phase === "move") {
      swipeX.set(dx * 0.9);
      return true;
    }
    if (phase === "end" && Math.abs(dx) > 70) {
      swipeX.set(0);
      onShift(dx < 0 ? 1 : -1);
    } else animate(swipeX, 0, { type: "spring", stiffness: 500, damping: 40 });
    return true;
  }

  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-drag]")) return;
    const el = target.closest<HTMLElement>("[data-key]");
    const item = el ? byKey.get(el.dataset.key!) : undefined;
    if (item && el) return startMove(e, item, el);
    startCreate(e);
  };

  const moving = drag && drag.kind !== "create" ? drag.item.key : held?.item.key;
  const ghost = drag ? drag.span : held ? held.span : draft;
  const ghostItem = drag && drag.kind !== "create" ? drag.item : held?.item;

  return (
    <div className="flex min-h-0 flex-1 flex-col select-none [-webkit-touch-callout:none]">
      <div className="grid shrink-0 border-b border-line" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
        {weeks[0].map((d) => (
          <div key={d.getDay()} className="py-1.5 text-center text-[11px] font-medium uppercase tracking-[0.04em] text-ink-3">
            {fmt(d, phone ? t.format.weekdayLetter : t.format.weekday, locale)}
          </div>
        ))}
      </div>
      <motion.div className="relative min-h-0 flex-1 overflow-hidden" style={{ x: swipeX }} onPointerDown={onPointerDown}>
        <motion.div
          ref={gridRef}
          key={rangeKey}
          initial={{ x: direction * 28, opacity: 0.4 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
          className="grid h-full"
          style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))`, touchAction: "pan-y" }}
          role="grid"
          aria-label={t.gridLabel}
        >
          {weeks.map((week, w) => (
            <div key={week[0].getTime()} className="relative border-b border-line last:border-b-0" role="row">
              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
                {week.map((d, i) => {
                  const isToday = now !== null && isSameDay(d, now);
                  const out = !isSameMonth(d, month);
                  return (
                    <div
                      key={i}
                      role="gridcell"
                      aria-label={fmt(d, t.format.day, locale)}
                      className={cn(
                        "relative border-l border-line first:border-l-transparent",
                        isWeekend(d) && "bg-[color-mix(in_oklab,var(--hover)_30%,transparent)]",
                        out && "bg-[color-mix(in_oklab,var(--hover)_45%,transparent)]",
                      )}
                    >
                      <div className="flex items-center gap-1 px-1.5" style={{ height: head }}>
                        <button
                          type="button"
                          data-no-drag
                          onClick={() => onDayClick(d)}
                          className={cn(
                            "grid h-[22px] min-w-[22px] place-items-center rounded-full px-1 text-[12px] font-medium tabular-nums transition-colors",
                            isToday ? "bg-blob text-white" : out ? "text-ink-3 hover:bg-hover" : "text-ink hover:bg-hover",
                          )}
                        >
                          {d.getDate() === 1 && !phone ? fmt(d, t.format.date, locale) : d.getDate()}
                        </button>
                        {weekNumbers && i === 0 && !phone && <span className="ml-auto text-[10px] text-ink-3">{`${t.weekShort} ${getISOWeek(d)}`}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {packed[w].shown.map((b) => {
                const timed = !inLane(b.item);
                return (
                  <div
                    key={b.item.key}
                    data-key={b.item.key}
                    role="button"
                    tabIndex={0}
                    aria-label={b.item.title || t.untitled}
                    onKeyDown={(e) => e.key === "Enter" && onOpen(b.item, e.currentTarget.getBoundingClientRect())}
                    className={cn("absolute px-[3px]", b.item.movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer")}
                    style={{ top: head + b.row * bar, height: bar - 2, left: `${(b.first / 7) * 100}%`, width: `${((b.last - b.first + 1) / 7) * 100}%`, touchAction: "pan-y" }}
                  >
                    <Bar
                      item={b.item}
                      locale={locale}
                      timed={timed}
                      untitled={t.untitled}
                      selected={selectedKey === b.item.key}
                      dimmed={moving === b.item.key}
                      fromBefore={b.fromBefore}
                      goesOn={b.goesOn}
                      onToggleTask={() => onToggleTask(b.item)}
                    />
                  </div>
                );
              })}
              {packed[w].hidden.map((h, i) =>
                h ? (
                  <button
                    key={`more-${i}`}
                    type="button"
                    data-no-drag
                    onClick={(e) => setMore({ day: week[i], rect: e.currentTarget.getBoundingClientRect() })}
                    className="absolute truncate rounded px-1.5 text-left text-[11px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
                    style={{ top: head + (maxRows - 1) * bar, height: bar - 2, left: `${(i / 7) * 100}%`, width: `${100 / 7}%` }}
                  >
                    {t.more(h)}
                  </button>
                ) : null,
              )}
              {ghost && <MonthGhost span={ghost} item={ghostItem} week={week} top={head} height={bar - 2} t={t} locale={locale} />}
            </div>
          ))}
        </motion.div>
        {typeof document !== "undefined" &&
          createPortal(
        <AnimatePresence>
          {more && (
            <DayList
              key={more.day.getTime()}
              day={more.day}
              rect={more.rect}
              items={items.filter((i) => {
                const { first: f, last } = itemDays(i);
                return f <= more.day && last >= more.day;
              })}
              t={t}
              locale={locale}
              onClose={() => setMore(null)}
              onOpen={(item, rect) => {
                setMore(null);
                onOpen(item, rect);
              }}
              onToggleTask={onToggleTask}
            />
          )}
        </AnimatePresence>,
            document.body,
          )}
      </motion.div>
    </div>
  );
}

function MonthGhost({ span, item, week, top, height, t, locale }: { span: Span; item?: CalItem; week: Date[]; top: number; height: number; t: T; locale: Locale }) {
  const { first, last } = itemDays(span);
  const f = dayDiff(first, week[0]);
  const l = dayDiff(last, week[0]);
  if (l < 0 || f > 6) return null;
  const shown: CalItem = item
    ? { ...item, start: span.start, end: span.end, allDay: span.allDay }
    : { key: "ghost", source: "event", id: "ghost", title: "", start: span.start, end: span.end, allDay: true, color: "var(--blob)", kind: "event", subjectId: null, movable: false, resizable: false, done: false, marker: false, exam: false };
  return (
    <div className="pointer-events-none absolute z-[8] px-[3px]" style={{ top, height, left: `${(Math.max(0, f) / 7) * 100}%`, width: `${((Math.min(6, l) - Math.max(0, f) + 1) / 7) * 100}%` }}>
      <Bar item={shown} locale={locale} untitled={t.untitled} timed={!span.allDay && span.end.getTime() - span.start.getTime() < 864e5} ghost fromBefore={f < 0} goesOn={l > 6} />
    </div>
  );
}

/** Everything on one day, when the cell is too small ("+3 more"). */
function DayList({
  day,
  rect,
  items,
  t,
  locale,
  onClose,
  onOpen,
  onToggleTask,
}: {
  day: Date;
  rect: DOMRect;
  items: CalItem[];
  t: T;
  locale: Locale;
  onClose: () => void;
  onOpen: (item: CalItem, rect: DOMRect) => void;
  onToggleTask: (item: CalItem) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  const width = 240;
  const left = clamp(rect.left + rect.width / 2 - width / 2, 8, window.innerWidth - width - 8);
  const top = clamp(rect.top - 40, 8, window.innerHeight - 320);
  return (
    <motion.div
      ref={ref}
      data-no-drag
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
      transition={{ type: "spring", stiffness: 600, damping: 34 }}
      className="fixed z-[60] max-h-[320px] overflow-y-auto rounded-xl border border-line bg-raised p-2 shadow-pop"
      style={{ left, top, width }}
      role="dialog"
      aria-label={fmt(day, t.format.day, locale)}
    >
      <p className="mb-1.5 px-1 text-[12px] font-semibold text-ink-2">{fmt(day, t.format.day, locale)}</p>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <button key={item.key} type="button" className="h-[22px] text-left" onClick={(e) => onOpen(item, e.currentTarget.getBoundingClientRect())}>
            <Bar item={item} locale={locale} timed={!inLane(item)} untitled={t.untitled} onToggleTask={() => onToggleTask(item)} />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
