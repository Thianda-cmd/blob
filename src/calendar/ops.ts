import { addDays, startOfDay } from "date-fns";
import type { Change, Row } from "@/lib/offline/sync";
import type { CalEvent, Recurrence } from "@/lib/types";
import type { CalItem } from "./items";
import { countBefore, hasOccurrenceBefore, untilBefore } from "./recurrence";
import { MINUTES_PER_DAY, atMinutes, dateFromAllDay, dayDiff, eventSpan, spanToStored } from "./time";

// Changing and deleting events, as lists of row changes for the sync outbox, each with the changes
// that undo it. A repeating event can be changed for one occurrence ("this"), from an occurrence on
// ("following": the series is cut there and a new one starts) or as a whole ("all"). A time change
// for the whole series moves every occurrence by the same amount, along with its removed
// occurrences and changed copies, so those keep matching.

export type Scope = "this" | "following" | "all";

export type Span = { start: Date; end: Date; allDay: boolean };

/** What an edit changes. `span` is the occurrence's new time. */
export type EventPatch = Partial<Pick<CalEvent, "title" | "details" | "location" | "kind" | "color" | "subject_id" | "reminders" | "recurrence">> & { span?: Span };

export type Plan = { changes: Change[]; undo: Change[] };

const FIELDS = ["title", "details", "location", "kind", "color", "subject_id", "reminders"] as const;

const asRow = (e: CalEvent) => e as unknown as Row;
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

class Builder {
  plan: Plan = { changes: [], undo: [] };

  update(e: CalEvent, values: Partial<CalEvent>) {
    const real = Object.fromEntries(Object.entries(values).filter(([k, v]) => !same(e[k as keyof CalEvent], v)));
    if (!Object.keys(real).length) return;
    this.plan.changes.push({ op: "update", table: "events", id: e.id, values: real });
    this.plan.undo.unshift({ op: "update", table: "events", id: e.id, values: Object.fromEntries(Object.keys(real).map((k) => [k, e[k as keyof CalEvent] ?? null])) });
  }

  insert(row: CalEvent) {
    this.plan.changes.push({ op: "insert", table: "events", id: row.id, row: asRow(row) });
    this.plan.undo.unshift({ op: "delete", table: "events", id: row.id });
  }

  remove(e: CalEvent) {
    this.plan.changes.push({ op: "delete", table: "events", id: e.id });
    this.plan.undo.unshift({ op: "insert", table: "events", id: e.id, row: asRow(e), restore: true });
  }
}

/** A complete new event row (the database fills in nothing the screen needs). */
export function newEvent(values: Partial<CalEvent> & Pick<CalEvent, "id" | "user_id" | "starts_at" | "ends_at">): CalEvent {
  const now = new Date().toISOString();
  return {
    subject_id: null,
    title: "",
    details: null,
    location: null,
    kind: "event",
    color: null,
    all_day: false,
    time_zone: null,
    recurrence: null,
    exdates: [],
    series_id: null,
    series_start: null,
    reminders: [],
    deleted_at: null,
    created_at: now,
    updated_at: now,
    ...values,
  };
}

/** Wall-clock difference between two times: whole days plus minutes of the day. */
type Shift = { days: number; minutes: number };

const minuteOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

function shiftBetween(from: Date, to: Date): Shift {
  return { days: dayDiff(startOfDay(to), startOfDay(from)), minutes: minuteOfDay(to) - minuteOfDay(from) };
}

function shifted(d: Date, s: Shift): Date {
  return atMinutes(addDays(startOfDay(d), s.days), minuteOfDay(d) + s.minutes);
}

const noShift = (s: Shift | null) => !s || (s.days === 0 && s.minutes === 0);

/** A stored start (as in exdates and series_start) moved by `s`. */
function shiftStored(stored: string, allDay: boolean, s: Shift): string {
  if (allDay) return spanToStored(true, addDays(dateFromAllDay(stored), s.days), addDays(dateFromAllDay(stored), s.days + 1)).starts_at;
  return shifted(new Date(stored), s).toISOString();
}

/** Weekdays of a weekly series moved by whole days. */
function shiftRecurrence(r: Recurrence | null, startBefore: Date, startAfter: Date): Recurrence | null {
  if (!r || r.freq !== "weekly" || !r.byDay?.length) return r;
  const days = (((startAfter.getDay() - startBefore.getDay()) % 7) + 7) % 7;
  if (!days) return r;
  return { ...r, byDay: [...new Set(r.byDay.map((d) => (d + days) % 7))].sort((a, b) => a - b) };
}

/** The stored times of a span whose start is `start` and length that of `like`. */
function spanLike(start: Date, like: Span): { starts_at: string; ends_at: string; all_day: boolean } {
  if (like.allDay) {
    const days = Math.max(1, dayDiff(like.end, like.start));
    return { ...spanToStored(true, start, addDays(start, days)), all_day: true };
  }
  const s = shiftBetween(like.start, like.end);
  return { ...spanToStored(false, start, shifted(start, s)), all_day: false };
}

function fieldsOf(patch: EventPatch): Partial<CalEvent> {
  const out: Partial<CalEvent> = {};
  for (const k of FIELDS) if (patch[k] !== undefined) (out as Record<string, unknown>)[k] = patch[k];
  return out;
}

const ms = (iso: string) => new Date(iso).getTime();

/** Changed copies of a series. */
const overridesOf = (seriesId: string, all: Iterable<CalEvent>) => [...all].filter((e) => e.series_id === seriesId && !e.deleted_at);

/** The start an occurrence has in its series, as a local time. */
function originalStart(item: CalItem): Date {
  const o = item.occurrence!;
  return o.series.all_day ? dateFromAllDay(o.original) : new Date(o.original);
}

/** The scopes to offer for a change to a repeating event (changing how it repeats can't be "this"). */
export function scopesFor(item: CalItem, patch?: EventPatch): Scope[] {
  if (!item.occurrence) return [];
  if (patch?.recurrence !== undefined) return ["following", "all"];
  return ["this", "following", "all"];
}

/** Whether "following" from this occurrence means the whole series (it is the first). */
function isFirst(item: CalItem, series: CalEvent) {
  return !hasOccurrenceBefore(series, originalStart(item));
}

export function planEdit(item: CalItem, patch: EventPatch, scope: Scope, all: Map<string, CalEvent>, newId: () => string): Plan {
  const b = new Builder();
  const fields = fieldsOf(patch);
  const event = all.get(item.id) ?? item.event!;
  const span = patch.span;

  if (!item.occurrence) {
    b.update(event, { ...fields, ...(patch.recurrence !== undefined ? { recurrence: patch.recurrence } : {}), ...(span ? { ...spanToStored(span.allDay, span.start, span.end), all_day: span.allDay } : {}) });
    return b.plan;
  }

  const series = all.get(item.occurrence.series.id) ?? item.occurrence.series;
  const isOverride = !!event.series_id;
  const original = originalStart(item);

  if (scope === "this") {
    const times = span ? { ...spanToStored(span.allDay, span.start, span.end), all_day: span.allDay } : {};
    if (isOverride) b.update(event, { ...fields, ...times });
    else {
      b.insert(
        newEvent({
          ...copyOf(series),
          ...fields,
          id: newId(),
          user_id: series.user_id,
          series_id: series.id,
          series_start: item.occurrence.original,
          ...spanToStored(item.allDay, item.start, item.end),
          all_day: item.allDay,
          ...times,
        }),
      );
    }
    return b.plan;
  }

  // The new times, as a shift from where this occurrence sits in the series.
  const shift = span ? shiftBetween(original, span.start) : null;
  const seriesSpan = eventSpan(series);
  const lengthLike: Span = span ?? { start: seriesSpan.start, end: seriesSpan.end, allDay: series.all_day };

  if (scope === "all" || isFirst(item, series)) {
    const values: Partial<CalEvent> = { ...fields };
    if (span) {
      const start = shifted(seriesSpan.start, shift!);
      Object.assign(values, spanLike(start, lengthLike));
      values.recurrence = shiftRecurrence(series.recurrence, seriesSpan.start, start);
      if (!noShift(shift)) values.exdates = series.exdates.map((x) => shiftStored(x, series.all_day, shift!));
    }
    if (patch.recurrence !== undefined) values.recurrence = patch.recurrence;
    b.update(series, values);
    for (const o of overridesOf(series.id, all.values())) {
      // The changed occurrence being edited becomes a plain one again at the new time.
      if (o.id === event.id && span) b.remove(o);
      else b.update(o, { ...fields, ...(span && !noShift(shift) ? { series_start: shiftStored(o.series_start!, series.all_day, shift!) } : {}) });
    }
    return b.plan;
  }

  // "following": the series ends before this occurrence and a new one takes over from here.
  const cut = original;
  const r = series.recurrence!;
  b.update(series, { recurrence: { ...r, until: untilBefore(cut), ...(r.count ? { count: countBefore(series, cut) } : {}) } });
  const start = span ? span.start : original;
  const rest: Recurrence = { ...r, ...(r.count ? { count: Math.max(1, r.count - countBefore(series, cut)) } : {}) };
  const s = shift ?? { days: 0, minutes: 0 };
  const next = newEvent({
    ...copyOf(series),
    ...fields,
    id: newId(),
    user_id: series.user_id,
    ...spanLike(start, lengthLike),
    recurrence: patch.recurrence !== undefined ? patch.recurrence : shiftRecurrence(rest, original, start),
    exdates: series.exdates.filter((x) => ms(x) >= cut.getTime()).map((x) => shiftStored(x, series.all_day, s)),
  });
  // A series that only repeats while something holds may stop being one.
  b.insert(next);
  for (const o of overridesOf(series.id, all.values())) {
    if (ms(o.series_start!) < cut.getTime()) continue;
    if (o.id === event.id && span) b.remove(o);
    else b.update(o, { ...fields, series_id: next.id, series_start: shiftStored(o.series_start!, series.all_day, s) });
  }
  return b.plan;
}

export function planDelete(item: CalItem, scope: Scope, all: Map<string, CalEvent>): Plan {
  const b = new Builder();
  const event = all.get(item.id) ?? item.event!;
  if (!item.occurrence) {
    b.remove(event);
    return b.plan;
  }
  const series = all.get(item.occurrence.series.id) ?? item.occurrence.series;
  const isOverride = !!event.series_id;
  if (scope === "this") {
    if (isOverride) b.remove(event);
    b.update(series, { exdates: [...series.exdates, item.occurrence.original] });
    return b.plan;
  }
  if (scope === "all" || isFirst(item, series)) {
    for (const o of overridesOf(series.id, all.values())) b.remove(o);
    b.remove(series);
    return b.plan;
  }
  const cut = originalStart(item);
  const r = series.recurrence!;
  b.update(series, { recurrence: { ...r, until: untilBefore(cut), ...(r.count ? { count: countBefore(series, cut) } : {}) } });
  for (const o of overridesOf(series.id, all.values())) if (ms(o.series_start!) >= cut.getTime()) b.remove(o);
  return b.plan;
}

/** The fields a copy of an event keeps. */
function copyOf(e: CalEvent): Partial<CalEvent> {
  return {
    title: e.title,
    details: e.details,
    location: e.location,
    kind: e.kind,
    color: e.color,
    subject_id: e.subject_id,
    reminders: e.reminders,
    time_zone: e.time_zone,
    all_day: e.all_day,
  };
}

/** A duplicate of an event at another time (Alt-drag), as a plain event. */
export function planDuplicate(item: CalItem, span: Span, newId: () => string): Plan {
  const b = new Builder();
  const e = item.event!;
  b.insert(newEvent({ ...copyOf(e), id: newId(), user_id: e.user_id, ...spanToStored(span.allDay, span.start, span.end), all_day: span.allDay }));
  return b.plan;
}

export function planCreate(row: CalEvent): Plan {
  const b = new Builder();
  b.insert(row);
  return b.plan;
}

/** Default reminders: 10 minutes before, or 9:00 on the day for all-day events. */
export const defaultReminders = (allDay: boolean) => (allDay ? [-540] : [10]);

/** Clamps a timed span to sensible limits (at least 15 minutes, less than 400 days). */
export function clampSpan(span: Span): Span {
  if (span.allDay) {
    const days = Math.min(399, Math.max(1, dayDiff(span.end, span.start)));
    const start = startOfDay(span.start);
    return { start, end: addDays(start, days), allDay: true };
  }
  const min = 15 * 60e3;
  const end = span.end.getTime() - span.start.getTime() < min ? new Date(span.start.getTime() + min) : span.end;
  const max = 399 * MINUTES_PER_DAY * 60e3;
  return { start: span.start, end: end.getTime() - span.start.getTime() > max ? new Date(span.start.getTime() + max) : end, allDay: false };
}
