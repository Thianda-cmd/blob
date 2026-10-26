"use client";

import { addDays, addMonths, isSameDay, isSameMonth, startOfDay } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, GraduationCap, PanelRight, Plus, School } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildItems, DEFAULT_FILTERS, taskSpan, type CalItem, type Filters } from "@/calendar/items";
import { itemDays, monthWeeks } from "@/calendar/layout";
import { scopesFor, type EventPatch, type Scope, type Span } from "@/calendar/ops";
import { fromYmd, weekStart, ymd } from "@/calendar/time";
import { blob } from "@/components/blob/bus";
import { TopBar } from "@/components/shell/TopBar";
import { SubjectDot } from "@/components/tasks/pickers";
import { useNow } from "@/components/tasks/useNow";
import { Segmented } from "@/components/ui/Segmented";
import { usePhone, useTouch } from "@/components/ui/useMediaQuery";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { calendarText } from "@/i18n/messages/calendar";
import { tasksText } from "@/i18n/messages/tasks";
import { timetableText } from "@/i18n/messages/timetable";
import type { Row } from "@/lib/offline/sync";
import type { AssignedCard } from "@/lib/tasks";
import type { CalEvent, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Agenda } from "./Agenda";
import { fmt } from "./describe";
import { EventForm, Floating, ItemPeek, ScopeDialog, UndoBar, type EditorTarget } from "./EventEditor";
import { MiniMonth } from "./MiniMonth";
import { MonthGrid } from "./MonthGrid";
import { ticker, ZOOM, type Move } from "./move";
import { TimeGrid, type CommitMode, type Held } from "./TimeGrid";
import { TimetableImport } from "./TimetableImport";
import { useCalendarStore } from "./useCalendarStore";
import { useStored } from "./useStored";

export type View = "day" | "three" | "week" | "month" | "agenda";
const VIEWS: View[] = ["day", "three", "week", "month", "agenda"];
const PHONE_VIEWS: View[] = ["day", "three", "month", "agenda"];
const isView = (v: unknown): v is View => typeof v === "string" && (VIEWS as string[]).includes(v);

type Panel = { kind: "peek"; item: CalItem; rect: DOMRect | null } | { kind: "edit"; target: EditorTarget; rect: DOMRect | null } | null;
type Ask = { kind: "edit" | "delete"; scopes: Scope[]; run: (s: Scope) => void; cancel: () => void } | null;

/**
 * The calendar: events, tasks and project cards in a day, 3-day, week, month or agenda view.
 * Drag in an empty spot to create, drag things to move them, drag their edges to resize (on touch
 * screens: hold first). Everything is saved on the device first and synced (src/lib/offline).
 */
export function CalendarView({
  initialEvents,
  initialTasks,
  cards,
  initialDate,
  initialView,
  openNew,
  openEvent,
  openImport,
}: {
  initialEvents: CalEvent[];
  initialTasks: Task[];
  cards: AssignedCard[];
  initialDate?: string;
  initialView?: string;
  openNew?: boolean;
  openEvent?: string;
  /** ?import=bta: the timetable import (a link from the school's site). */
  openImport?: boolean;
}) {
  const t = useMessages(calendarText);
  const tImport = useMessages(timetableText);
  const tt = useMessages(tasksText);
  const locale = useLocale();
  const { subjects, profile } = useWorkspace();
  const store = useCalendarStore({ initialEvents, initialTasks });
  const now = useNow();
  const phone = usePhone();
  const touch = useTouch();
  const weekStartsOn = profile.week_starts_on ?? 1;

  // Where and what -------------------------------------------------------------------------------

  const [storedView, storeView] = useStored(phone ? "blob-cal-view-phone" : "blob-cal-view");
  const [chosenView, setChosenView] = useState<View | null>(isView(initialView) ? initialView : null);
  const fallback: View = phone ? "day" : "week";
  let view: View = chosenView ?? (isView(storedView) ? storedView : fallback);
  if (phone && view === "week") view = "three";
  const [anchorState, setAnchor] = useState<Date | null>(() => fromYmd(initialDate ?? null));
  const today = now === null ? null : startOfDay(now);
  const anchor = anchorState ?? today;
  const [move, setMove] = useState<Move>(null);
  const [agendaDays, setAgendaDays] = useState(42);

  const [filtersRaw, storeFilters] = useStored("blob-cal-filters");
  const filters: Filters = useMemo(() => {
    try {
      return filtersRaw ? { ...DEFAULT_FILTERS, ...(JSON.parse(filtersRaw) as Partial<Filters>) } : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  }, [filtersRaw]);
  const setFilters = (f: Filters) => storeFilters(JSON.stringify(f));
  const [railStored, storeRail] = useStored("blob-cal-rail");
  const rail = railStored !== "closed";

  const range = useMemo(() => {
    if (!anchor) return null;
    if (view === "day") return { from: anchor, days: 1 };
    if (view === "three") return { from: anchor, days: 3 };
    if (view === "week") return { from: weekStart(anchor, weekStartsOn), days: 7 };
    if (view === "agenda") return { from: anchor, days: agendaDays };
    const weeks = monthWeeks(anchor, weekStartsOn);
    return { from: weeks[0][0], days: weeks.length * 7 };
  }, [anchor, view, weekStartsOn, agendaDays]);

  const days = useMemo(() => (range ? Array.from({ length: Math.min(range.days, 7) }, (_, i) => addDays(range.from, i)) : []), [range]);
  const weeks = useMemo(() => (anchor && view === "month" ? monthWeeks(anchor, weekStartsOn) : []), [anchor, view, weekStartsOn]);

  const items = useMemo(() => {
    if (!range) return [];
    return buildItems({ events: store.events, tasks: store.tasks.tasks, cards, subjects, from: range.from, to: addDays(range.from, range.days), filters });
  }, [range, store.events, store.tasks.tasks, cards, subjects, filters]);

  // Days with something on them, for the small months (two months around the one shown).
  const busy = useMemo(() => {
    const set = new Set<string>();
    if (!anchor) return set;
    const from = addMonths(new Date(anchor.getFullYear(), anchor.getMonth(), 1), -1);
    const all = buildItems({ events: store.events, tasks: store.tasks.tasks, cards, subjects, from, to: addMonths(from, 3), filters });
    for (const i of all) {
      const { first, last } = itemDays(i);
      for (let d = first, n = 0; d <= last && n < 62; d = addDays(d, 1), n++) set.add(ymd(d));
    }
    return set;
  }, [anchor, store.events, store.tasks.tasks, cards, subjects, filters]);

  const exams = useMemo(() => {
    if (!today) return [];
    const end = addDays(today, 31);
    return store.tasks.tasks
      .filter((x) => x.kind === "exam" && !x.done && x.due_at)
      .map((x) => ({ task: x, span: taskSpan(x)! }))
      .filter((x) => x.span && x.span.start >= today && x.span.start < end)
      .sort((a, b) => a.span.start.getTime() - b.span.start.getTime())
      .slice(0, 6);
  }, [store.tasks.tasks, today]);

  // Moving through time --------------------------------------------------------------------------

  const go = useCallback(
    (to: Date, dir?: number) => {
      const from = anchor ?? to;
      setMove({ dir: dir ?? (to > from ? 1 : to < from ? -1 : 0), zoom: 0 });
      setAnchor(startOfDay(to));
    },
    [anchor],
  );

  const step = useCallback(
    (dir: number) => {
      if (!anchor) return;
      if (view === "month") go(addMonths(new Date(anchor.getFullYear(), anchor.getMonth(), 1), dir), dir);
      else if (view === "week") go(addDays(anchor, 7 * dir), dir);
      else if (view === "three") go(addDays(anchor, 3 * dir), dir);
      else if (view === "agenda") go(addDays(anchor, 7 * dir), dir);
      else go(addDays(anchor, dir), dir);
    },
    [anchor, view, go],
  );

  const chooseView = useCallback(
    (v: View) => {
      setMove({ dir: 0, zoom: Math.sign(ZOOM[v] - ZOOM[view]) });
      setChosenView(v);
      storeView(v);
    },
    [storeView, view],
  );

  // Keep the address in step (shareable, and the place to come back to).
  useEffect(() => {
    if (!anchor) return;
    const url = new URL(window.location.href);
    url.searchParams.set("date", ymd(anchor));
    url.searchParams.set("view", view);
    url.searchParams.delete("new");
    url.searchParams.delete("event");
    url.searchParams.delete("import");
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [anchor, view]);

  // Panels -------------------------------------------------------------------------------------

  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [held, setHeld] = useState<Held>(null);
  const [ask, setAsk] = useState<Ask>(null);
  const [importing, setImporting] = useState(!!openImport);
  const closePanel = useCallback(() => setPanel(null), []);

  const open = useCallback((item: CalItem, rect: DOMRect | null) => {
    setSelected(item.key);
    setPanel({ kind: "peek", item, rect });
  }, []);

  const startNew = useCallback(
    (span: Span, rect: DOMRect | null, values?: Partial<CalEvent>) => {
      setSelected(null);
      setPanel({ kind: "edit", target: { mode: "create", span, values }, rect });
    },
    [],
  );

  const newAtNextHour = useCallback(() => {
    const base = anchor && today && !isSameDay(anchor, today) ? anchor : new Date();
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.min(23, (anchor && today && !isSameDay(anchor, today) ? 9 : new Date().getHours() + 1)), 0);
    startNew({ start, end: new Date(start.getTime() + 3600e3), allDay: false }, null);
  }, [anchor, today, startNew]);

  // ?new=1 and ?event=<id> (command palette, notifications, widgets): once, when the calendar is ready.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !anchor) return;
    opened.current = true;
    if (openNew) {
      queueMicrotask(newAtNextHour);
      return;
    }
    if (openEvent) {
      const item = items.find((i) => i.id === openEvent || i.occurrence?.series.id === openEvent || i.task?.id === openEvent);
      if (item) queueMicrotask(() => open(item, null));
    }
  }, [anchor, openNew, openEvent, items, newAtNextHour, open]);

  const askScope = (kind: "edit" | "delete", scopes: Scope[], run: (s: Scope) => void, cancel: () => void = () => {}) => setAsk({ kind, scopes, run, cancel });

  // Changing things ----------------------------------------------------------------------------

  const toggleTask = useCallback((item: CalItem) => item.task && void store.tasks.setDone(item.task.id, !item.done), [store.tasks]);

  const commit = (item: CalItem, span: Span, mode: CommitMode) => {
    setPanel(null);
    if (item.source === "task") return store.moveTask(item, span, t.undo.taskMoved);
    if (item.source !== "event") return;
    if (mode === "copy") return store.duplicate(item, span, t.undo.duplicated);
    const label = mode === "resize" ? t.undo.changed : t.undo.moved;
    if (!item.occurrence) return store.edit(item, { span }, "all", label);
    setHeld({ item, span });
    askScope(
      "edit",
      scopesFor(item),
      (scope) => {
        store.edit(item, { span }, scope, label);
        setHeld(null);
      },
      () => setHeld(null),
    );
  };

  const save = (target: EditorTarget, patch: EventPatch & { span: Span }, changed: { time: boolean; recurrence: boolean }) => {
    setPanel(null);
    if (target.mode === "create") {
      const { span, ...fields } = patch;
      store.create({ ...fields, span }, t.undo.created);
      blob.react("jump", "happy");
      return;
    }
    const item = target.item;
    const { span, ...fields } = patch;
    const p: EventPatch = { ...fields, ...(changed.time ? { span } : {}) };
    if (!item.occurrence) return store.edit(item, p, "all", t.undo.changed);
    askScope("edit", scopesFor(item, changed.recurrence ? p : undefined), (scope) => store.edit(item, p, scope, t.undo.changed));
  };

  const remove = (item: CalItem) => {
    setPanel(null);
    setSelected(null);
    if (item.source === "task" && item.task) {
      const task = item.task;
      store.run(
        { changes: [{ op: "delete", table: "tasks", id: task.id }], undo: [{ op: "insert", table: "tasks", id: task.id, row: task as unknown as Row, restore: true }] },
        tt.deletedBefore ? `${tt.deletedBefore} ${tt.quote(task.title)}${tt.deletedAfter ?? ""}`.trim() : tt.quote(task.title),
      );
      return;
    }
    if (item.source !== "event") return;
    if (!item.occurrence) return store.remove(item, "all", t.undo.deleted);
    askScope("delete", ["this", "following", "all"], (scope) => store.remove(item, scope, t.undo.deleted));
  };

  const duplicate = (item: CalItem) => {
    setPanel(null);
    store.duplicate(item, { start: item.start, end: item.end, allDay: item.allDay }, t.undo.duplicated);
  };

  // Undo bar: the last change, until it times out or is dismissed (Ctrl+Z keeps working).
  const last = store.history[store.history.length - 1] ?? null;
  const [hiddenUndo, setHiddenUndo] = useState<string | null>(null);
  const undo = useCallback(() => {
    const before = store.history[store.history.length - 2];
    if (store.undo()) setHiddenUndo(before?.id ?? null);
  }, [store]);
  const dismissUndo = useCallback(() => setHiddenUndo(last?.id ?? null), [last]);

  // Keys ---------------------------------------------------------------------------------------

  const keys = useRef({ step, chooseView, newAtNextHour, undo, go, remove, selected, items, phone, panel, ask });
  useEffect(() => {
    keys.current = { step, chooseView, newAtNextHour, undo, go, remove, selected, items, phone, panel, ask };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable=true], [role=dialog]") || document.querySelector("[aria-modal=true]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        k.undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "arrowleft" || key === "k" || key === "p") k.step(-1);
      else if (key === "arrowright" || key === "j" || key === "n") k.step(1);
      else if (key === "t") k.go(new Date());
      else if (key === "d") k.chooseView("day");
      else if (key === "x") k.chooseView("three");
      else if (key === "w" && !k.phone) k.chooseView("week");
      else if (key === "m") k.chooseView("month");
      else if (key === "a") k.chooseView("agenda");
      else if (key === "c") k.newAtNextHour();
      else if ((key === "delete" || key === "backspace") && k.selected) {
        const item = k.items.find((i) => i.key === k.selected);
        if (item) k.remove(item);
      } else if (key === "escape") {
        setSelected(null);
        return;
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The first time: Blob explains the gestures.
  const [tipSeen, setTipSeen] = useStored("blob-cal-tip");
  useEffect(() => {
    if (tipSeen || now === null) return;
    const timer = setTimeout(() => {
      blob.say(touch ? t.tipTouch : t.tipDesktop, { mood: "happy", ms: 7000 });
      setTipSeen("1");
    }, 1400);
    return () => clearTimeout(timer);
  }, [tipSeen, now, touch, t, setTipSeen]);

  // Drawing ------------------------------------------------------------------------------------

  const title = anchor ? periodTitle(view, anchor, days, t, locale) : "";
  // Where today is from here: the Today button points there.
  const todayDir =
    !today || !range || !anchor
      ? 0
      : view === "month"
        ? isSameMonth(today, anchor)
          ? 0
          : today < anchor
            ? -1
            : 1
        : today < range.from
          ? -1
          : today >= addDays(range.from, view === "agenda" ? 1 : range.days)
            ? 1
            : 0;
  const viewOptions = (phone ? PHONE_VIEWS : VIEWS).map((v) => ({ value: v, label: t.view[v], title: `${t.view[v]} (${t.viewKey[v]})` }));
  const draft = panel?.kind === "edit" && panel.target.mode === "create" ? panel.target.span : null;
  const rangeKey = range ? `${view}:${ymd(range.from)}` : "none";
  const editing = panel?.kind === "edit" ? panel : null;
  const peek = panel?.kind === "peek" ? panel : null;
  // A peeked item may have changed (or gone) since: show the current copy.
  const peekItem = peek ? (items.find((i) => i.key === peek.item.key) ?? peek.item) : null;

  return (
    <>
      <TopBar
        crumbs={[{ label: t.title, icon: <CalendarDays className="size-3.5 text-ink-3" /> }, ...(phone ? [] : [{ label: <Ticker text={title} dir={move?.dir ?? 0} />, title }])]}
        actions={
          <>
            <TodayButton dir={todayDir} label={t.today} onClick={() => go(new Date())} />
            {!phone && (
              <div className="flex items-center">
                <button type="button" onClick={() => step(-1)} className="grid size-7 place-items-center rounded-lg text-ink-2 hover:bg-hover hover:text-ink" aria-label={t.previous} title={`${t.previous} (←)`}>
                  <ChevronLeft className="size-4" />
                </button>
                <button type="button" onClick={() => step(1)} className="grid size-7 place-items-center rounded-lg text-ink-2 hover:bg-hover hover:text-ink" aria-label={t.next} title={`${t.next} (→)`}>
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
            {!phone && <Segmented value={view} options={viewOptions} onChange={chooseView} label={t.title} className="max-md:hidden" />}
            <button
              type="button"
              onClick={() => setImporting(true)}
              className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink [@media(hover:none)]:h-9"
              title={tImport.buttonTitle}
              aria-label={tImport.buttonTitle}
            >
              <School className="size-4" />
              <span className="max-xl:hidden">{tImport.button}</span>
            </button>
            <button
              type="button"
              onClick={newAtNextHour}
              className="flex h-7 items-center gap-1.5 rounded-lg bg-blob px-2.5 text-[12.5px] font-medium text-white shadow-card hover:bg-blob-deep active:scale-[0.97] [@media(hover:none)]:h-9 [@media(hover:none)]:px-3"
              title={`${t.newEvent} (C)`}
              aria-label={t.newEvent}
            >
              <Plus className="size-4" strokeWidth={2.4} />
              <span className="max-sm:hidden">{t.newEvent}</span>
            </button>
            {!phone && (
              <button
                type="button"
                onClick={() => storeRail(rail ? "closed" : "open")}
                className={cn("grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink max-lg:hidden", rail && "text-ink-2")}
                aria-label={rail ? t.filters.hideRail : t.filters.showRail}
                title={rail ? t.filters.hideRail : t.filters.showRail}
              >
                <PanelRight className="size-4" />
              </button>
            )}
          </>
        }
      />

      {phone && anchor && (
        <PhoneHeader
          view={view}
          anchor={anchor}
          title={title}
          options={viewOptions}
          onView={chooseView}
          onPick={(d) => go(d)}
          busy={busy}
          weekStartsOn={weekStartsOn}
          now={now}
          t={t}
          locale={locale}
          range={range}
          move={move}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {!anchor || !range ? (
            <GridSkeleton />
          ) : view === "month" ? (
            <MonthGrid
              month={anchor}
              weeks={weeks}
              items={items}
              locale={locale}
              t={t}
              now={now}
              touch={touch}
              phone={phone}
              selectedKey={selected}
              held={held}
              draft={draft}
              move={move}
              rangeKey={rangeKey}
              weekNumbers={!phone}
              onOpen={open}
              onNew={(span, rect) => startNew(span, rect)}
              onCommit={commit}
              onToggleTask={toggleTask}
              onDayClick={(d) => {
                go(d);
                chooseView("day");
              }}
              onShift={(months) => step(months)}
            />
          ) : view === "agenda" ? (
            <Agenda
              from={range.from}
              days={range.days}
              items={items}
              locale={locale}
              t={t}
              now={now}
              move={move}
              selectedKey={selected}
              onOpen={open}
              onToggleTask={toggleTask}
              onMore={() => setAgendaDays((d) => Math.min(d + 42, 365))}
              onDayClick={(d) => {
                go(d);
                chooseView("day");
              }}
            />
          ) : (
            <TimeGrid
              days={days}
              items={items}
              locale={locale}
              t={t}
              now={now}
              touch={touch}
              phone={phone}
              selectedKey={selected}
              draft={draft}
              held={held}
              move={move}
              rangeKey={rangeKey}
              viewKey={view}
              header={!(phone && view === "day")}
              weekNumbers={view === "week"}
              onOpen={open}
              onNew={(span, rect) => startNew(span, rect)}
              onCommit={commit}
              onToggleTask={toggleTask}
              onDayClick={(d) => {
                if (view === "day") return;
                go(d);
                chooseView("day");
              }}
              onShift={(n) => go(addDays(anchor, n), Math.sign(n))}
              onBackground={() => {
                setSelected(null);
                setPanel(null);
              }}
            />
          )}
        </div>

        {!phone && rail && anchor && range && (
          <aside className="hidden w-[256px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-line px-3 pb-6 pt-3 lg:flex">
            <MiniMonth value={anchor} range={[range.from, addDays(range.from, range.days)]} busy={busy} weekStartsOn={weekStartsOn} now={now} locale={locale} t={t} onPick={(d) => go(d)} />
            <section>
              <h3 className="mb-1 px-1.5 text-[11.5px] font-medium text-ink-3">{t.filters.show}</h3>
              {(["events", "tasks", "cards", "done"] as const).map((k) => (
                <CheckRow key={k} checked={filters[k]} onChange={(v) => setFilters({ ...filters, [k]: v })} color={k === "events" ? "var(--blob)" : k === "cards" ? "var(--subject-sky)" : "var(--subject-moss)"}>
                  {t.filters[k]}
                </CheckRow>
              ))}
            </section>
            {subjects.length > 0 && (
              <section>
                <h3 className="mb-1 px-1.5 text-[11.5px] font-medium text-ink-3">{t.filters.subjects}</h3>
                {subjects.map((s) => (
                  <CheckRow
                    key={s.id}
                    checked={!filters.hidden.includes(s.id)}
                    onChange={(v) => setFilters({ ...filters, hidden: v ? filters.hidden.filter((x) => x !== s.id) : [...filters.hidden, s.id] })}
                    color={`var(--subject-${s.color})`}
                  >
                    {s.emoji && <span className="mr-1">{s.emoji}</span>}
                    {s.name}
                  </CheckRow>
                ))}
                <CheckRow
                  checked={!filters.hidden.includes("none")}
                  onChange={(v) => setFilters({ ...filters, hidden: v ? filters.hidden.filter((x) => x !== "none") : [...filters.hidden, "none"] })}
                  color="var(--blob)"
                >
                  {t.filters.noSubject}
                </CheckRow>
              </section>
            )}
            <section>
              <h3 className="mb-1.5 flex items-center gap-1.5 px-1.5 text-[11.5px] font-medium text-ink-3">
                <GraduationCap className="size-3.5" /> {t.exams}
              </h3>
              {exams.length === 0 ? (
                <p className="px-1.5 text-[12.5px] text-ink-3">{t.noExams}</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {exams.map(({ task, span }) => {
                    const subject = subjects.find((s) => s.id === task.subject_id);
                    return (
                      <li key={task.id}>
                        <button type="button" onClick={() => go(span.start)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-hover">
                          <span className="grid w-9 shrink-0 text-center leading-none">
                            <span className="text-[10px] font-medium uppercase text-blob-ink">{fmt(span.start, t.format.weekday, locale)}</span>
                            <span className="text-[15px] font-semibold tabular-nums text-ink">{span.start.getDate()}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-ink">{task.title}</span>
                            {subject && (
                              <span className="flex items-center gap-1 text-[11.5px] text-ink-3">
                                <SubjectDot subject={subject} className="size-1.5" /> {subject.name}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>
        )}
      </div>

      <Floating anchor={editing?.rect ?? null} phone={phone} open={!!editing} onClose={closePanel} label={t.newEvent}>
        {editing && (
          <EventForm
            key={editing.target.mode === "edit" ? editing.target.item.key : `new-${editing.target.span.start.getTime()}`}
            target={editing.target}
            subjects={subjects}
            t={t}
            locale={locale}
            phone={phone}
            onSave={(patch, changed) => save(editing.target, patch, changed)}
            onDelete={editing.target.mode === "edit" ? () => remove((editing.target as { item: CalItem }).item) : undefined}
            onCancel={closePanel}
          />
        )}
      </Floating>

      <Floating anchor={peek?.rect ?? null} phone={phone} open={!!peek} onClose={closePanel} label={peekItem?.title ?? ""} width={340}>
        {peekItem && (
          <ItemPeek
            item={peekItem}
            subjects={subjects}
            t={t}
            tasksKind={tt.kind}
            locale={locale}
            phone={phone}
            onEdit={() => setPanel({ kind: "edit", target: { mode: "edit", item: peekItem }, rect: peek!.rect })}
            onDelete={() => remove(peekItem)}
            onDuplicate={() => duplicate(peekItem)}
            onToggleTask={() => toggleTask(peekItem)}
            onClose={closePanel}
          />
        )}
      </Floating>

      <ScopeDialog
        open={!!ask}
        kind={ask?.kind ?? "edit"}
        scopes={ask?.scopes ?? ["this", "following", "all"]}
        t={t}
        onPick={(s) => {
          ask?.run(s);
          setAsk(null);
        }}
        onCancel={() => {
          ask?.cancel();
          setAsk(null);
        }}
      />

      <TimetableImport
        open={importing}
        onClose={() => setImporting(false)}
        store={store}
        onDone={(from) => {
          go(from);
          if (view === "month" || view === "agenda") chooseView(phone ? "three" : "week");
        }}
      />

      <UndoBar entry={last && last.id !== hiddenUndo ? last : null} onUndo={undo} onDismiss={dismissUndo} t={t} raised={phone} />
    </>
  );
}

function periodTitle(view: View, anchor: Date, days: Date[], t: (typeof calendarText)["en"], locale: Parameters<typeof fmt>[2]) {
  if (view === "day") return fmt(anchor, t.format.dayYear, locale);
  if (view === "month") return fmt(anchor, t.format.month, locale);
  const first = days[0] ?? anchor;
  const last = days[days.length - 1] ?? anchor;
  if (view === "agenda" || isSameMonth(first, last)) return fmt(first, t.format.month, locale);
  return first.getFullYear() === last.getFullYear()
    ? `${fmt(first, "MMM", locale)} – ${fmt(last, t.format.monthShort, locale)}`
    : `${fmt(first, t.format.monthShort, locale)} – ${fmt(last, t.format.monthShort, locale)}`;
}

/** The period's name: a new one rolls in from the side the calendar went (a new view: it fades). */
function Ticker({ text, dir }: { text: string; dir: number }) {
  return (
    <span className="relative inline-grid min-w-0 overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.span
          key={text}
          custom={dir}
          variants={ticker}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="truncate capitalize"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** "Today", with an arrow to the side today is on when it's out of sight. */
function TodayButton({ dir, label, onClick }: { dir: number; label: string; onClick: () => void }) {
  const arrow = (side: number) => (
    <AnimatePresence initial={false}>
      {dir === side && (
        <motion.span
          initial={{ width: 0, opacity: 0, x: side * -4 }}
          animate={{ width: "auto", opacity: 1, x: 0 }}
          exit={{ width: 0, opacity: 0, x: side * -4 }}
          transition={{ type: "spring", stiffness: 520, damping: 38 }}
          className="flex overflow-hidden"
        >
          {side < 0 ? <ChevronLeft className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
        </motion.span>
      )}
    </AnimatePresence>
  );
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-0.5 rounded-lg border bg-raised px-2.5 text-[12.5px] font-medium shadow-card transition-colors hover:bg-hover [@media(hover:none)]:h-9",
        dir ? "border-blob/35 text-blob-ink" : "border-line text-ink",
      )}
      title={`${label} (T)`}
    >
      {arrow(-1)}
      {label}
      {arrow(1)}
    </button>
  );
}

function CheckRow({ checked, onChange, color, children }: { checked: boolean; onChange: (v: boolean) => void; color: string; children: React.ReactNode }) {
  return (
    <label className="flex h-7 cursor-pointer items-center gap-2 rounded-lg px-1.5 text-[13px] text-ink-2 hover:bg-hover hover:text-ink [@media(hover:none)]:h-9">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        className="grid size-4 shrink-0 place-items-center rounded-[5px] border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-blob"
        style={{ borderColor: color, background: checked ? color : "transparent" }}
        aria-hidden
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="size-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6.2l2.3 2.3 4.7-5" />
          </svg>
        )}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </label>
  );
}

/** Phones: the period, the views, and a strip of the week's days to tap (swipe it for other weeks). */
function PhoneHeader({
  view,
  anchor,
  title,
  options,
  onView,
  onPick,
  busy,
  weekStartsOn,
  now,
  t,
  locale,
  range,
  move,
}: {
  view: View;
  anchor: Date;
  title: string;
  options: { value: View; label: string }[];
  onView: (v: View) => void;
  onPick: (d: Date) => void;
  busy: Set<string>;
  weekStartsOn: number;
  now: number | null;
  t: (typeof calendarText)["en"];
  locale: Parameters<typeof fmt>[2];
  range: { from: Date; days: number } | null;
  move: Move;
}) {
  const [monthOpen, setMonthOpen] = useState(false);
  const week = weekStart(anchor, weekStartsOn);
  const strip = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const swipe = useRef<{ x: number; id: number } | null>(null);
  return (
    <div className="shrink-0 border-b border-line">
      <div className="flex items-center gap-2 px-3 pb-1.5">
        <button type="button" onClick={() => setMonthOpen((o) => !o)} className="flex min-w-0 items-center gap-1 rounded-lg px-1.5 py-1 font-display text-[18px] font-semibold capitalize tracking-[-0.01em] text-ink" aria-expanded={monthOpen}>
          <Ticker text={view === "day" ? fmt(anchor, t.format.month, locale) : title} dir={move?.dir ?? 0} />
          <motion.span animate={{ rotate: monthOpen ? 180 : 0 }} className="text-ink-3">
            <ChevronDown className="size-4" />
          </motion.span>
        </button>
        <span className="flex-1" />
        <Segmented value={view} options={options.map((o) => ({ ...o, label: o.value === "three" ? "3" : o.label.slice(0, view === o.value ? 12 : 1) }))} onChange={onView} label={t.title} size="sm" />
      </div>
      <AnimatePresence initial={false}>
        {monthOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden px-3">
            <div className="pb-2">
              <MiniMonth
                value={anchor}
                range={range ? [range.from, addDays(range.from, range.days)] : [anchor, anchor]}
                busy={busy}
                weekStartsOn={weekStartsOn}
                now={now}
                locale={locale}
                t={t}
                onPick={(d) => {
                  onPick(d);
                  setMonthOpen(false);
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {(view === "day" || view === "three") && (
        <div
          className="overflow-hidden px-1 pb-1.5"
          style={{ touchAction: "pan-y" }}
          onPointerDown={(e) => {
            if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, id: e.pointerId };
          }}
          onPointerUp={(e) => {
            const s = swipe.current;
            swipe.current = null;
            if (!s || s.id !== e.pointerId) return;
            const dx = e.clientX - s.x;
            if (Math.abs(dx) > 50) onPick(addDays(anchor, dx < 0 ? 7 : -7));
          }}
        >
          {/* Another week slides in from its side; the chosen day's circle glides to the tapped day. */}
          <motion.div key={ymd(week)} initial={move && move.dir ? { x: move.dir * 40, opacity: 0 } : false} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 420, damping: 38 }} className="grid grid-cols-7">
            {strip.map((d) => {
              const on = range ? d >= range.from && d < addDays(range.from, range.days) : false;
              const isToday = now !== null && isSameDay(d, now);
              const chosen = on && isSameDay(d, anchor);
              return (
                <button key={d.getTime()} type="button" onClick={() => onPick(d)} className="flex flex-col items-center gap-0.5 py-0.5">
                  <span className={cn("text-[10.5px] font-medium uppercase", isToday ? "text-blob-ink" : "text-ink-3")}>{fmt(d, t.format.weekdayLetter, locale)}</span>
                  <span
                    className={cn(
                      "relative grid size-8 place-items-center rounded-full text-[14px] font-semibold tabular-nums transition-colors",
                      chosen ? "text-paper" : on ? "bg-blob-soft text-blob-ink" : isToday ? "text-blob-ink" : "text-ink",
                      chosen && isToday && "text-white",
                    )}
                  >
                    {chosen && (
                      <motion.span
                        layoutId="cal-phone-day"
                        className={cn("absolute inset-0 rounded-full", isToday ? "bg-blob" : "bg-ink")}
                        transition={{ type: "spring", stiffness: 560, damping: 38 }}
                      />
                    )}
                    <span className="relative">{d.getDate()}</span>
                    {busy.has(ymd(d)) && <span className={cn("absolute -bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full", chosen ? "bg-ink-3" : "bg-blob")} />}
                  </span>
                </button>
              );
            })}
          </motion.div>
        </div>
      )}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-hidden>
      <div className="h-12 border-b border-line" />
      <div className="h-[30px] border-b border-line" />
      <div className="flex-1 bg-[linear-gradient(to_bottom,var(--line)_1px,transparent_1px)] bg-[length:100%_48px] opacity-60" />
    </div>
  );
}
