"use client";

import { addDays, differenceInCalendarDays, format, isSameDay, startOfWeek } from "date-fns";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useLocale, useMessages } from "@/i18n/client";
import { dateLocale } from "@/i18n/format";
import { tasksText } from "@/i18n/messages/tasks";
import { TASK_KINDS, dayKey } from "@/lib/tasks";
import type { Subject, Task, TaskKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KIND_ICON, SubjectDot } from "./pickers";

export function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-line bg-raised/50 p-3.5 dark:bg-raised/40", className)}>
      <div className="mb-2.5 flex h-5 items-center">
        <h2 className="text-[12px] font-semibold text-ink-2">{title}</h2>
        <span className="ml-auto">{action}</span>
      </div>
      {children}
    </section>
  );
}

const HEAT = [0, 14, 26, 40, 56];

/**
 * Two weeks (this one and the next) as a heatmap of open tasks per day. Click a day to filter.
 */
export function CalendarHeat({
  tasks,
  now,
  selected,
  onSelect,
  overdue,
}: {
  /** Open tasks to count. */
  tasks: Task[];
  now: number;
  selected: string | null;
  onSelect: (day: string | null) => void;
  overdue: number;
}) {
  const t = useMessages(tasksText);
  const locale = useLocale();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const counts = new Map<string, { total: number; exams: number }>();
  for (const t of tasks) {
    if (!t.due_at) continue;
    const k = dayKey(t.due_at);
    const c = counts.get(k) ?? { total: 0, exams: 0 };
    c.total++;
    if (t.kind === "exam") c.exams++;
    counts.set(k, c);
  }
  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i));

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 pb-1">
        {t.weekdayInitials.map((d, i) => (
          <span key={i} className={cn("text-center text-[10.5px] font-medium text-ink-3", i >= 5 && "opacity-70")}>
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const key = dayKey(d);
          const c = counts.get(key);
          const total = c?.total ?? 0;
          const isToday = isSameDay(d, now);
          const past = differenceInCalendarDays(d, now) < 0;
          const active = selected === key;
          const heat = HEAT[Math.min(total, HEAT.length - 1)];
          return (
            <motion.button
              key={key}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 600, damping: 20 }}
              onClick={() => onSelect(active ? null : key)}
              title={t.dayTitle(format(d, t.dayTitleFormat, { locale: dateLocale(locale) }), total, c?.exams ?? 0)}
              aria-pressed={active}
              className={cn(
                "relative flex h-[42px] flex-col items-center justify-center rounded-lg text-[12.5px] tabular-nums transition-colors",
                active ? "bg-ink text-paper" : past ? "text-ink-3/70 hover:bg-hover" : "text-ink-2 hover:bg-hover",
                isToday && !active && "font-semibold text-ink ring-[1.5px] ring-inset ring-ink/70",
              )}
              style={!active && heat ? { background: `color-mix(in oklab, var(--blob) ${past ? heat / 2 : heat}%, transparent)` } : undefined}
            >
              <span className="leading-none">{format(d, "d")}</span>
              <span className={cn("mt-1 h-3 text-[10px] font-medium leading-3", active ? "text-paper/75" : total ? "text-ink-2" : "text-transparent")}>
                {total || "·"}
              </span>
              {!!c?.exams && <span className={cn("absolute right-1 top-1 size-1.5 rounded-full", active ? "bg-blob" : "bg-ink")} />}
            </motion.button>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-ink-3">
        {overdue > 0 ? (
          <button
            onClick={() => onSelect(selected === "overdue" ? null : "overdue")}
            className={cn("rounded-md px-1.5 py-0.5 font-medium text-danger hover:bg-danger/10", selected === "overdue" && "bg-danger/10")}
          >
            {t.overdue(overdue)}
          </button>
        ) : (
          <span>{t.nothingOverdue}</span>
        )}
        <span className="ml-auto flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-ink" /> {t.examLegend}
        </span>
        <span className="flex items-center gap-0.5">
          {HEAT.slice(1).map((h) => (
            <span key={h} className="size-2.5 rounded-[3px]" style={{ background: `color-mix(in oklab, var(--blob) ${h}%, transparent)` }} />
          ))}
        </span>
      </div>
    </div>
  );
}

export function WeekProgress({ done, total }: { done: number; total: number }) {
  const t = useMessages(tasksText);
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-ink-2">
          <span className="font-semibold text-ink tabular-nums">{done}</span> {t.weekOf} <span className="tabular-nums">{total}</span> {t.weekDone}
        </span>
        <span className="tabular-nums text-ink-3">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hover">
        <motion.div
          className="h-full rounded-full bg-blob"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 26 }}
        />
      </div>
    </div>
  );
}

export function KindFilter({ counts, value, onChange }: { counts: Record<TaskKind, number>; value: TaskKind | null; onChange: (k: TaskKind | null) => void }) {
  const t = useMessages(tasksText);
  return (
    <div className="grid grid-cols-2 gap-1">
      {TASK_KINDS.map((k) => {
        const Icon = KIND_ICON[k];
        const active = value === k;
        return (
          <button
            key={k}
            onClick={() => onChange(active ? null : k)}
            aria-pressed={active}
            className={cn(
              "flex h-[52px] flex-col justify-between rounded-lg border px-2.5 py-2 text-left transition-colors",
              active ? "border-ink bg-ink text-paper" : "border-line hover:border-line-2 hover:bg-hover/60",
            )}
          >
            <span className="flex items-center justify-between">
              <Icon className={cn("size-3.5", active ? "text-paper/80" : k === "exam" ? "text-blob-ink" : "text-ink-3")} />
              <span className={cn("text-[15px] font-semibold leading-none tabular-nums", active ? "text-paper" : counts[k] ? "text-ink" : "text-ink-3")}>
                {counts[k]}
              </span>
            </span>
            <span className={cn("text-[11.5px] leading-none", active ? "text-paper/80" : "text-ink-3")}>{t.kindPlural[k]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SubjectFilter({
  subjects,
  counts,
  noSubject,
  value,
  onChange,
}: {
  subjects: Subject[];
  counts: Map<string, number>;
  noSubject: number;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const t = useMessages(tasksText);
  const row = (id: string, label: ReactNode, icon: ReactNode, count: number) => {
    const active = value === id;
    return (
      <button
        key={id}
        onClick={() => onChange(active ? null : id)}
        aria-pressed={active}
        className={cn(
          "flex h-7 w-full items-center gap-2 rounded-md px-1.5 text-left text-[13px] transition-colors",
          active ? "bg-hover font-medium text-ink" : "text-ink-2 hover:bg-hover/70 hover:text-ink",
        )}
      >
        <span className="grid size-4 place-items-center">{icon}</span>
        <span className="min-w-0 flex-1 truncate" title={typeof label === "string" ? label : undefined}>
          {label}
        </span>
        <span className={cn("text-[11.5px] tabular-nums", count ? "text-ink-3" : "text-ink-3/50")}>{count}</span>
      </button>
    );
  };
  return (
    <div className="space-y-px">
      {subjects.map((s) =>
        row(s.id, s.name, s.emoji ? <span className="text-[12.5px] leading-none">{s.emoji}</span> : <SubjectDot subject={s} />, counts.get(s.id) ?? 0),
      )}
      {noSubject > 0 && row("none", <span className="text-ink-3">{t.noSubject}</span>, <SubjectDot subject={null} />, noSubject)}
      {subjects.length === 0 && <p className="px-1.5 text-[12.5px] text-ink-3">{t.addSubjectsHint}</p>}
    </div>
  );
}
