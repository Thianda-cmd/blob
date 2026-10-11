"use client";

import { addDays, addMinutes, differenceInMinutes, format, startOfDay } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import {
  AlignLeft,
  Bell,
  CalendarDays,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FolderKanban,
  MapPin,
  Palette,
  Pencil,
  Plus,
  Repeat2,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { CalItem } from "@/calendar/items";
import { defaultReminders, type EventPatch, type Scope, type Span } from "@/calendar/ops";
import { weekdaysOf } from "@/calendar/recurrence";
import { fromYmd, ymd } from "@/calendar/time";
import { KindBadge, SubjectDot, SubjectPicker } from "@/components/tasks/pickers";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { inputClass } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import type { Locale } from "@/i18n/config";
import type { calendarText } from "@/i18n/messages/calendar";
import { SUBJECT_COLOR_KEYS, subjectColor } from "@/lib/subjects";
import type { CalEvent, EventKind, Recurrence, RepeatFreq, Subject, SubjectColor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { REMINDER_CHOICES, describeReminder, describeRepeat, fmt, fmtRange, fmtTime, orderWeek, weekdayName } from "./describe";
import { EVENT_ICON, colorVar } from "./ItemViews";

type T = (typeof calendarText)["en"];

/* ---------------------------------------------------------------------------
   Where editors show: next to the thing on a desktop, a sheet on a phone
   --------------------------------------------------------------------------- */

export function Floating({ anchor, phone, open, onClose, label, children, width = 380 }: { anchor: DOMRect | null; phone: boolean; open: boolean; onClose: () => void; label: string; children: ReactNode; width?: number }) {
  if (phone)
    return (
      <Sheet open={open} onClose={onClose} label={label}>
        {children}
      </Sheet>
    );
  return (
    <FloatingPanel anchor={anchor} open={open} onClose={onClose} label={label} width={width}>
      {children}
    </FloatingPanel>
  );
}

function FloatingPanel({ anchor, open, onClose, label, children, width }: { anchor: DOMRect | null; open: boolean; onClose: () => void; label: string; children: ReactNode; width: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; from: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const h = ref.current?.offsetHeight ?? 360;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const a = anchor ?? new DOMRect(vw / 2 - 1, vh / 3, 2, 2);
      let left: number;
      let from = -12;
      if (a.right + 12 + width <= vw - 8) left = a.right + 12;
      else if (a.left - 12 - width >= 8) {
        left = a.left - 12 - width;
        from = 12;
      } else left = Math.min(vw - width - 8, Math.max(8, a.left + a.width / 2 - width / 2));
      const top = Math.max(8, Math.min(a.top - 8, vh - h - 8));
      setPos({ left, top, from });
    };
    place();
    const ro = typeof ResizeObserver === "undefined" || !ref.current ? null : new ResizeObserver(place);
    if (ref.current) ro?.observe(ref.current);
    window.addEventListener("resize", place);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [open, anchor, width]);

  // A click outside closes it (not one in a menu it opened).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (ref.current?.contains(t) || t.closest?.("[role=menu], [role=listbox], [data-keep-editor], .z-\\[80\\]")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".z-\\[80\\]")) {
        e.stopPropagation();
        onClose();
      }
    };
    // (Later, so the click that opened it doesn't close it.)
    const timer = setTimeout(() => document.addEventListener("pointerdown", onDown, true));
    window.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="dialog"
          aria-label={label}
          initial={{ opacity: 0, scale: 0.96, x: pos?.from ?? -12 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
          transition={{ type: "spring", stiffness: 520, damping: 36 }}
          className="fixed z-[66] flex max-h-[calc(100dvh-16px)] flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-pop"
          style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ---------------------------------------------------------------------------
   The form
   --------------------------------------------------------------------------- */

type Form = {
  title: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  /** All-day: the last day (inclusive). */
  endDate: string;
  endTime: string;
  recurrence: Recurrence | null;
  reminders: number[];
  subject_id: string | null;
  color: SubjectColor | null;
  kind: EventKind;
  location: string;
  details: string;
};

const hhmm = (d: Date) => format(d, "HH:mm");
const at = (date: string, time: string) => {
  const d = fromYmd(date) ?? startOfDay(new Date());
  const [h, m] = (time || "00:00").split(":").map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h || 0, m || 0);
};

function formFrom(span: Span, e: Partial<CalEvent> | null): Form {
  const lastDay = span.allDay ? addDays(span.end, -1) : span.end;
  return {
    title: e?.title ?? "",
    allDay: span.allDay,
    startDate: ymd(span.start),
    startTime: hhmm(span.allDay ? new Date(2000, 0, 1, 9) : span.start),
    endDate: ymd(lastDay < span.start ? span.start : lastDay),
    endTime: hhmm(span.allDay ? new Date(2000, 0, 1, 10) : span.end),
    recurrence: e?.recurrence ?? null,
    reminders: e?.reminders ?? defaultReminders(span.allDay),
    subject_id: e?.subject_id ?? null,
    color: e?.color ?? null,
    kind: e?.kind ?? "event",
    location: e?.location ?? "",
    details: e?.details ?? "",
  };
}

function spanOfForm(f: Form): Span {
  if (f.allDay) {
    const start = fromYmd(f.startDate) ?? startOfDay(new Date());
    const last = fromYmd(f.endDate) ?? start;
    return { start, end: addDays(last < start ? start : last, 1), allDay: true };
  }
  return { start: at(f.startDate, f.startTime), end: at(f.endDate, f.endTime), allDay: false };
}

export type EditorTarget = { mode: "create"; span: Span; values?: Partial<CalEvent> } | { mode: "edit"; item: CalItem };

/** Creating or changing an event. `onSave` gets the values (and the new time). */
export function EventForm({
  target,
  subjects,
  t,
  locale,
  phone,
  onSave,
  onDelete,
  onCancel,
}: {
  target: EditorTarget;
  subjects: Subject[];
  t: T;
  locale: Locale;
  phone: boolean;
  onSave: (patch: EventPatch & { span: Span }, changed: { time: boolean; recurrence: boolean }) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const initial = target.mode === "create" ? formFrom(target.span, target.values ?? null) : formFrom({ start: target.item.start, end: target.item.end, allDay: target.item.allDay }, { ...target.item.event!, recurrence: target.item.occurrence?.series.recurrence ?? target.item.event!.recurrence });
  const [f, setF] = useState<Form>(initial);
  const [more, setMore] = useState(target.mode === "edit" || !phone);
  const set = (patch: Partial<Form>) => setF((cur) => ({ ...cur, ...patch }));
  const span = spanOfForm(f);
  const bad = !f.allDay && span.end <= span.start;
  const title = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Phones: the keyboard covers half the sheet, so the title only takes focus for new events.
    if (target.mode === "create") requestAnimationFrame(() => title.current?.focus());
  }, [target.mode]);

  /** Moving the start keeps the length. */
  const setStart = (date: string, time: string) => {
    const before = spanOfForm(f);
    if (f.allDay) {
      const days = Math.max(0, Math.round((before.end.getTime() - before.start.getTime()) / 864e5) - 1);
      const start = fromYmd(date);
      set({ startDate: date, endDate: start ? ymd(addDays(start, days)) : f.endDate });
      return;
    }
    const length = Math.max(15, differenceInMinutes(before.end, before.start));
    const end = addMinutes(at(date, time), length);
    set({ startDate: date, startTime: time, endDate: ymd(end), endTime: hhmm(end) });
  };

  const save = () => {
    if (bad) return;
    const changedTime = target.mode === "edit" && (span.start.getTime() !== target.item.start.getTime() || span.end.getTime() !== target.item.end.getTime() || span.allDay !== target.item.allDay);
    const changedRepeat = JSON.stringify(f.recurrence) !== JSON.stringify(initial.recurrence);
    const patch: EventPatch & { span: Span } = {
      title: f.title.trim().slice(0, 200),
      kind: f.kind,
      color: f.color,
      subject_id: f.subject_id,
      reminders: [...new Set(f.reminders)].slice(0, 5).sort((a, b) => a - b),
      location: f.location.trim().slice(0, 200) || null,
      details: f.details.trim().slice(0, 4000) || null,
      span,
      ...(changedRepeat || target.mode === "create" ? { recurrence: f.recurrence } : {}),
    };
    onSave(patch, { time: target.mode === "create" || changedTime, recurrence: changedRepeat });
  };

  const color = f.color ? subjectColor(f.color) : f.subject_id ? subjectColor(subjects.find((s) => s.id === f.subject_id)?.color) : "var(--blob)";
  const subject = subjects.find((s) => s.id === f.subject_id) ?? null;

  return (
    <form
      className="flex flex-col"
      style={colorVar(color)}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          save();
        }
      }}
    >
      <div className="flex items-start gap-2 px-4 pb-2 pt-4">
        <span className="mt-2.5 size-3 shrink-0 rounded-[4px] bg-[var(--c)]" />
        <input
          ref={title}
          value={f.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={t.form.title}
          aria-label={t.form.titleLabel}
          maxLength={200}
          enterKeyHint="done"
          className="min-w-0 flex-1 bg-transparent py-1 font-display text-[19px] font-semibold tracking-[-0.01em] text-ink outline-none placeholder:text-ink-3/70"
        />
        {!phone && (
          <button type="button" onClick={onCancel} className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink" aria-label={t.form.close}>
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 px-4 pb-3">
        {/* Time */}
        <Row icon={<Clock className="size-4" />}>
          <div className="flex flex-col gap-2">
            <label className="flex w-fit cursor-pointer items-center gap-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={f.allDay} onChange={(e) => {
                const allDay = e.target.checked;
                const usual = JSON.stringify(f.reminders) === JSON.stringify(defaultReminders(f.allDay));
                set({ allDay, reminders: usual ? defaultReminders(allDay) : f.reminders, endDate: allDay ? f.endDate : f.startDate });
              }} className="size-4 accent-[var(--blob)]" />
              {t.allDay}
            </label>
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5">
              <span className="text-[12px] text-ink-3">{t.form.starts}</span>
              <div className="flex gap-1.5">
                <input type="date" required value={f.startDate} onChange={(e) => e.target.value && setStart(e.target.value, f.startTime)} className={cn(inputClass, "h-9 min-w-0 px-2 text-[13px]")} style={{ flex: "1 1 0" }} aria-label={`${t.form.starts} ${t.form.date}`} />
                {!f.allDay && <input type="time" required step={300} value={f.startTime} onChange={(e) => e.target.value && setStart(f.startDate, e.target.value)} className={cn(inputClass, "h-9 shrink-0 px-2 text-[13px]")} style={{ width: 108 }} aria-label={`${t.form.starts} ${t.form.time}`} />}
              </div>
              <span className="text-[12px] text-ink-3">{t.form.ends}</span>
              <div className="flex gap-1.5">
                <input type="date" required value={f.endDate} min={f.startDate} onChange={(e) => e.target.value && set({ endDate: e.target.value })} className={cn(inputClass, "h-9 min-w-0 px-2 text-[13px]")} style={{ flex: "1 1 0" }} aria-label={`${t.form.ends} ${t.form.date}`} />
                {!f.allDay && <input type="time" required step={300} value={f.endTime} onChange={(e) => e.target.value && set({ endTime: e.target.value })} className={cn(inputClass, "h-9 shrink-0 px-2 text-[13px]")} style={{ width: 108 }} aria-label={`${t.form.ends} ${t.form.time}`} aria-invalid={bad} />}
              </div>
            </div>
            {bad && <p className="text-[12px] text-danger">{t.form.endBeforeStart}</p>}
          </div>
        </Row>

        {/* Repeat */}
        <Row icon={<Repeat2 className="size-4" />}>
          <RepeatField value={f.recurrence} start={span.start} onChange={(recurrence) => set({ recurrence })} t={t} locale={locale} />
        </Row>

        {!more ? (
          <button type="button" onClick={() => setMore(true)} className="ml-7 w-fit rounded-md px-1.5 py-1 text-[12.5px] font-medium text-blob-ink hover:bg-blob-soft">
            {t.form.moreOptions}
          </button>
        ) : (
          <>
            <Row icon={<Bell className="size-4" />}>
              <ReminderField value={f.reminders} allDay={f.allDay} onChange={(reminders) => set({ reminders })} t={t} locale={locale} />
            </Row>
            <Row icon={<CalendarDays className="size-4" />}>
              <div className="flex flex-wrap gap-1.5">
                {(["event", "lesson", "study", "birthday", "break"] as EventKind[]).map((k) => {
                  const Icon = EVENT_ICON[k] ?? CalendarDays;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => set({ kind: k })}
                      className={cn("blob-chip gap-1", f.kind === k && "is-on")}
                      aria-pressed={f.kind === k}
                    >
                      <Icon className="size-3.5" />
                      {t.kind[k]}
                    </button>
                  );
                })}
              </div>
            </Row>
            <Row icon={<SubjectDot subject={subject} className="size-3" />}>
              <SubjectPicker
                value={f.subject_id}
                subjects={subjects}
                onChange={(subject_id) => set({ subject_id })}
                align="start"
                trigger={(p) => (
                  <button {...p} type="button" className="flex h-8 w-fit items-center gap-2 rounded-lg px-2 text-[13px] text-ink hover:bg-hover">
                    {subject ? (
                      <>
                        {subject.emoji && <span>{subject.emoji}</span>}
                        {subject.name}
                      </>
                    ) : (
                      <span className="text-ink-3">{t.form.noSubject}</span>
                    )}
                  </button>
                )}
              />
            </Row>
            <Row icon={<Palette className="size-4" />}>
              <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={t.form.color}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={f.color === null}
                  title={t.form.autoColor}
                  onClick={() => set({ color: null })}
                  className={cn("grid size-6 place-items-center rounded-full border border-dashed border-ink-3 text-ink-3", f.color === null && "ring-2 ring-blob ring-offset-2 ring-offset-raised")}
                >
                  <span className="size-2 rounded-full bg-[var(--c)]" />
                </button>
                {SUBJECT_COLOR_KEYS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={f.color === c}
                    aria-label={c}
                    onClick={() => set({ color: c })}
                    className={cn("size-6 rounded-full transition-transform hover:scale-110", f.color === c && "ring-2 ring-[var(--c)] ring-offset-2 ring-offset-raised")}
                    style={{ background: subjectColor(c) }}
                  />
                ))}
              </div>
            </Row>
            <Row icon={<MapPin className="size-4" />}>
              <input value={f.location} onChange={(e) => set({ location: e.target.value })} maxLength={200} placeholder={t.form.location} className={cn(inputClass, "h-9 text-[13.5px]")} />
            </Row>
            <Row icon={<AlignLeft className="size-4" />}>
              <textarea value={f.details} onChange={(e) => set({ details: e.target.value })} maxLength={4000} rows={3} placeholder={t.form.details} className={cn(inputClass, "min-h-[72px] resize-y py-2 text-[13.5px]")} />
            </Row>
          </>
        )}
      </div>

      <div className={cn("sticky bottom-0 flex items-center gap-2 border-t border-line bg-raised px-4 py-3", phone && "pb-[max(12px,env(safe-area-inset-bottom))]")}>
        {onDelete && (
          <Button type="button" variant="ghost" size="sm" onClick={onDelete} className="text-danger hover:bg-[color-mix(in_oklab,var(--danger)_10%,transparent)]">
            <Trash2 className="size-3.5" /> {t.form.delete}
          </Button>
        )}
        <span className="flex-1" />
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t.form.cancel}
        </Button>
        <Button type="submit" variant="blob" size="sm" disabled={bad}>
          {target.mode === "create" ? t.form.create : t.form.save}
        </Button>
      </div>
    </form>
  );
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-2 grid size-4 shrink-0 place-items-center text-ink-3">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

type RepeatChoice = "never" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly" | "custom";

function choiceOf(r: Recurrence | null, start: Date): RepeatChoice {
  if (!r) return "never";
  if (r.until || r.count || (r.interval ?? 1) !== 1) return "custom";
  if (r.freq === "daily") return "daily";
  if (r.freq === "weekly") {
    const days = weekdaysOf(r, start);
    if (days.join() === "1,2,3,4,5") return "weekdays";
    if (days.length === 1 && days[0] === start.getDay()) return "weekly";
    return "custom";
  }
  return r.freq;
}

function RepeatField({ value, start, onChange, t, locale }: { value: Recurrence | null; start: Date; onChange: (r: Recurrence | null) => void; t: T; locale: Locale }) {
  const choice = choiceOf(value, start);
  const [custom, setCustom] = useState(choice === "custom");
  const pick = (c: RepeatChoice) => {
    setCustom(c === "custom");
    if (c === "never") onChange(null);
    else if (c === "daily") onChange({ freq: "daily" });
    else if (c === "weekdays") onChange({ freq: "weekly", byDay: [1, 2, 3, 4, 5] });
    else if (c === "weekly") onChange({ freq: "weekly", byDay: [start.getDay()] });
    else if (c === "monthly") onChange({ freq: "monthly" });
    else if (c === "yearly") onChange({ freq: "yearly" });
    else onChange(value ?? { freq: "weekly", byDay: [start.getDay()] });
  };
  const r = value;
  return (
    <div className="flex flex-col gap-2">
      <select value={custom ? "custom" : choice} onChange={(e) => pick(e.target.value as RepeatChoice)} className={cn(inputClass, "h-9 px-2 text-[13px]")} aria-label={t.form.repeat}>
        <option value="never">{t.repeat.never}</option>
        <option value="daily">{t.repeat.daily}</option>
        <option value="weekdays">{t.repeat.weekdays}</option>
        <option value="weekly">{t.repeat.weekly(weekdayName(start.getDay(), locale))}</option>
        <option value="monthly">{t.repeat.monthly(start.getDate())}</option>
        <option value="yearly">{t.repeat.yearly(fmt(start, t.format.monthDay, locale))}</option>
        <option value="custom">{t.repeat.custom}</option>
      </select>
      {custom && r && (
        <div className="flex flex-col gap-2 rounded-xl bg-hover/60 p-2.5 text-[13px]">
          <div className="flex items-center gap-2">
            <span className="text-ink-2">{t.repeat.every}</span>
            <input
              type="number"
              min={1}
              max={99}
              value={r.interval ?? 1}
              onChange={(e) => onChange({ ...r, interval: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
              className={cn(inputClass, "h-8 px-2 text-[13px]")}
              style={{ width: 64 }}
            />
            <select
              value={r.freq}
              onChange={(e) => {
                const freq = e.target.value as RepeatFreq;
                onChange({ ...r, freq, byDay: freq === "weekly" ? (r.byDay?.length ? r.byDay : [start.getDay()]) : undefined });
              }}
              className={cn(inputClass, "h-8 px-2 text-[13px]")}
              style={{ width: "auto" }}
            >
              {(["daily", "weekly", "monthly", "yearly"] as const).map((fq) => (
                <option key={fq} value={fq}>
                  {t.repeat.unit[fq](r.interval ?? 1)}
                </option>
              ))}
            </select>
          </div>
          {r.freq === "weekly" && (
            <div className="flex flex-wrap gap-1" role="group" aria-label={t.repeat.on}>
              {orderWeek([0, 1, 2, 3, 4, 5, 6]).map((d) => {
                const on = weekdaysOf(r, start).includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const cur = weekdaysOf(r, start);
                      const next = on ? cur.filter((x) => x !== d) : [...cur, d];
                      if (next.length) onChange({ ...r, byDay: next.sort((a, b) => a - b) });
                    }}
                    className={cn("grid size-8 place-items-center rounded-full text-[12px] font-medium transition-colors", on ? "bg-blob text-white" : "bg-raised text-ink-2 hover:bg-line")}
                  >
                    {weekdayName(d, locale, "short").slice(0, 2)}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink-2">{t.repeat.ends}</span>
            <select
              value={r.until ? "on" : r.count ? "after" : "never"}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "never") onChange({ ...r, until: null, count: null });
                else if (v === "on") onChange({ ...r, count: null, until: ymd(addDays(start, 90)) });
                else onChange({ ...r, until: null, count: 10 });
              }}
              className={cn(inputClass, "h-8 px-2 text-[13px]")}
              style={{ width: "auto" }}
            >
              <option value="never">{t.repeat.endsNever}</option>
              <option value="on">{t.repeat.endsOn}</option>
              <option value="after">{t.repeat.endsAfter}</option>
            </select>
            {r.until && <input type="date" value={r.until} min={ymd(start)} onChange={(e) => e.target.value && onChange({ ...r, until: e.target.value })} className={cn(inputClass, "h-8 px-2 text-[13px]")} style={{ width: "auto" }} />}
            {r.count ? (
              <span className="flex items-center gap-1.5">
                <input type="number" min={1} max={999} value={r.count} onChange={(e) => onChange({ ...r, count: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })} className={cn(inputClass, "h-8 px-2 text-[13px]")} style={{ width: 64 }} />
                <span className="text-ink-2">{t.repeat.times(r.count)}</span>
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function ReminderField({ value, allDay, onChange, t, locale }: { value: number[]; allDay: boolean; onChange: (v: number[]) => void; t: T; locale: Locale }) {
  const choices = (allDay ? REMINDER_CHOICES.allDay : REMINDER_CHOICES.timed).filter((c) => !value.includes(c));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.length === 0 && <span className="text-[13px] text-ink-3">{t.form.noReminders}</span>}
      {value.map((m) => (
        <span key={m} className="inline-flex h-7 items-center gap-1 rounded-full bg-hover pl-2.5 pr-1 text-[12.5px] text-ink">
          {describeReminder(m, allDay, t, locale)}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== m))} className="grid size-5 place-items-center rounded-full text-ink-3 hover:bg-line hover:text-ink" aria-label={t.form.delete}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      {value.length < 5 && choices.length > 0 && (
        <label className="relative inline-flex h-7 cursor-pointer items-center gap-1 rounded-full px-2 text-[12.5px] font-medium text-blob-ink hover:bg-blob-soft">
          <Plus className="size-3.5" />
          {t.form.addReminder}
          <select
            value=""
            onChange={(e) => e.target.value !== "" && onChange([...value, Number(e.target.value)].sort((a, b) => a - b))}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={t.form.addReminder}
          >
            <option value="" disabled>
              {t.form.addReminder}
            </option>
            {choices.map((c) => (
              <option key={c} value={c}>
                {describeReminder(c, allDay, t, locale)}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Looking at something
   --------------------------------------------------------------------------- */

export function ItemPeek({
  item,
  subjects,
  t,
  tasksKind,
  locale,
  phone,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleTask,
  onClose,
}: {
  item: CalItem;
  subjects: Subject[];
  t: T;
  tasksKind: Record<string, string>;
  locale: Locale;
  phone: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleTask: () => void;
  onClose: () => void;
}) {
  const subject = subjects.find((s) => s.id === item.subjectId) ?? null;
  const e = item.event;
  const series = item.occurrence?.series;
  const when = item.allDay
    ? sameDay(item.start, addDays(item.end, -1))
      ? fmt(item.start, t.format.day, locale)
      : `${fmt(item.start, t.format.dayShort, locale)} – ${fmt(addDays(item.end, -1), t.format.dayShort, locale)}`
    : item.marker || item.source !== "event"
      ? `${fmt(item.start, t.format.day, locale)} · ${fmtTime(item.start, locale)}`
      : sameDay(item.start, item.end)
        ? `${fmt(item.start, t.format.day, locale)} · ${fmtRange(item.start, item.end, locale)}`
        : `${fmt(item.start, t.format.dayShort, locale)} ${fmtTime(item.start, locale)} – ${fmt(item.end, t.format.dayShort, locale)} ${fmtTime(item.end, locale)}`;

  return (
    <div className="flex flex-col" style={colorVar(item.color)}>
      <div className="flex items-center justify-end gap-0.5 px-2 pt-2">
        {item.source === "event" && (
          <>
            <IconAction label={t.form.edit} onClick={onEdit}>
              <Pencil className="size-4" />
            </IconAction>
            <IconAction label={t.form.duplicate} onClick={onDuplicate}>
              <Copy className="size-4" />
            </IconAction>
          </>
        )}
        {item.source !== "card" && (
          <IconAction label={item.source === "task" ? t.task.delete : t.form.delete} onClick={onDelete}>
            <Trash2 className="size-4" />
          </IconAction>
        )}
        {!phone && (
          <IconAction label={t.form.close} onClick={onClose}>
            <X className="size-4" />
          </IconAction>
        )}
      </div>
      <div className="flex flex-col gap-3 px-5 pb-5 pt-1">
        <div className="flex items-start gap-3">
          <span className={cn("mt-[7px] size-3 shrink-0 rounded-[4px] bg-[var(--c)]", item.exam && "bg-blob")} />
          <div className="min-w-0">
            <h2 className={cn("break-words font-display text-[19px] font-semibold leading-snug tracking-[-0.01em] text-ink", item.done && "line-through decoration-ink-3")}>{item.title || t.untitled}</h2>
            <p className="mt-0.5 text-[13px] text-ink-2">{when}</p>
            {series && <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-ink-3"><Repeat2 className="size-3.5" />{describeRepeat(series.recurrence, eventStart(series), t, locale)}</p>}
          </div>
        </div>
        {item.source === "task" && (
          <div className="flex flex-wrap items-center gap-2 pl-6">
            <KindBadge kind={item.task!.kind} />
            <button type="button" onClick={onToggleTask} className={cn("blob-chip gap-1", item.done && "is-on")}>
              <Check className="size-3.5" />
              {item.done ? t.task.done : t.task.markDone}
            </button>
          </div>
        )}
        {item.source === "card" && item.card && (
          <p className="flex items-center gap-2 pl-6 text-[13px] text-ink-2">
            <FolderKanban className="size-4 text-ink-3" />
            {t.task.fromProject(item.card.project.title)}
          </p>
        )}
        {subject && (
          <p className="flex items-center gap-2 pl-6 text-[13px] text-ink-2">
            <SubjectDot subject={subject} className="size-2.5" />
            {subject.emoji && <span>{subject.emoji}</span>}
            {subject.name}
          </p>
        )}
        {e?.location && (
          <p className="flex items-start gap-2 pl-6 text-[13px] text-ink-2">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
            <span className="break-words">{e.location}</span>
          </p>
        )}
        {e && e.reminders.length > 0 && (
          <p className="flex items-start gap-2 pl-6 text-[13px] text-ink-2">
            <Bell className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
            <span>{e.reminders.map((m) => describeReminder(m, e.all_day, t, locale)).join(" · ")}</span>
          </p>
        )}
        {(e?.details || item.task?.details) && (
          <p className="whitespace-pre-wrap break-words pl-6 text-[13px] leading-relaxed text-ink-2">{e?.details ?? item.task?.details}</p>
        )}
        {item.source === "task" && (
          <Link href="/tasks" className="ml-6 flex w-fit items-center gap-1.5 text-[12.5px] font-medium text-blob-ink hover:underline">
            <ExternalLink className="size-3.5" /> {t.task.openTasks}
          </Link>
        )}
        {item.source === "card" && item.card && (
          <Link href={`/projects/${item.card.project.id}?card=${item.card.id}`} className="ml-6 flex w-fit items-center gap-1.5 text-[12.5px] font-medium text-blob-ink hover:underline">
            <ExternalLink className="size-3.5" /> {t.task.openProject}
          </Link>
        )}
        {item.source === "task" && <span className="sr-only">{tasksKind[item.task!.kind]}</span>}
      </div>
    </div>
  );
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const eventStart = (e: CalEvent) => (e.all_day ? new Date(new Date(e.starts_at).getUTCFullYear(), new Date(e.starts_at).getUTCMonth(), new Date(e.starts_at).getUTCDate()) : new Date(e.starts_at));

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink [@media(hover:none)]:size-10">
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------------------
   Which occurrences of a repeating event
   --------------------------------------------------------------------------- */

export function ScopeDialog({ open, kind, scopes, t, onPick, onCancel }: { open: boolean; kind: "edit" | "delete"; scopes: Scope[]; t: T; onPick: (s: Scope) => void; onCancel: () => void }) {
  const [choice, setChoice] = useState<Scope>(scopes[0] ?? "this");
  const [lastScopes, setLastScopes] = useState(scopes);
  if (lastScopes !== scopes) {
    setLastScopes(scopes);
    setChoice(scopes[0] ?? "this");
  }
  return (
    <Dialog open={open} onClose={onCancel} className="max-w-[340px]" labelledBy="scope-title">
      <form
        className="p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onPick(choice);
        }}
      >
        <h2 id="scope-title" className="font-display text-[17px] font-semibold text-ink">
          {kind === "edit" ? t.scope.editTitle : t.scope.deleteTitle}
        </h2>
        <div className="mt-3 flex flex-col gap-1" role="radiogroup">
          {scopes.map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-[13.5px] text-ink hover:bg-hover">
              <input type="radio" name="scope" checked={choice === s} onChange={() => setChoice(s)} className="size-4 accent-[var(--blob)]" />
              {t.scope[s]}
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {t.scope.cancel}
          </Button>
          <Button type="submit" variant={kind === "delete" ? "danger" : "blob"} size="sm" autoFocus>
            {t.scope.ok}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ---------------------------------------------------------------------------
   "Event moved · Undo"
   --------------------------------------------------------------------------- */

export function UndoBar({ entry, onUndo, onDismiss, t, raised }: { entry: { id: string; label: string } | null; onUndo: () => void; onDismiss: () => void; t: T; raised?: boolean }) {
  useEffect(() => {
    if (!entry) return;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [entry, onDismiss]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {entry && (
        <motion.div
          key={entry.id}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.15 } }}
          transition={{ type: "spring", stiffness: 520, damping: 32 }}
          className={cn(
            "fixed left-1/2 z-[65] flex -translate-x-1/2 items-center gap-1 rounded-xl border border-line bg-raised py-1 pl-3.5 pr-1 text-[13px] text-ink shadow-pop",
            raised ? "bottom-[calc(76px+env(safe-area-inset-bottom))]" : "bottom-6",
          )}
          role="status"
        >
          <span className="max-w-[220px] truncate">{entry.label}</span>
          <button type="button" onClick={onUndo} className="ml-2 flex h-7 items-center gap-1.5 rounded-lg px-2 font-medium text-blob-ink hover:bg-blob-soft">
            <Undo2 className="size-3.5" /> {t.undo.undo}
          </button>
          <button type="button" onClick={onDismiss} className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink" aria-label={t.form.close}>
            <X className="size-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
