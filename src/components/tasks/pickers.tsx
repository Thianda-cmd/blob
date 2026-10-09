"use client";

import { addDays, addWeeks, format, startOfDay, startOfWeek } from "date-fns";
import { Bell, CalendarX2, Check, FolderKanban, GraduationCap, NotebookPen, Search, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Popover } from "@/components/ui/Menu";
import { useLocale, useMessages } from "@/i18n/client";
import { dateLocale } from "@/i18n/format";
import { tasksText } from "@/i18n/messages/tasks";
import { subjectColor } from "@/lib/subjects";
import { DEFAULT_TIME, TASK_KINDS, dueAt, isDefaultTime, type TimeOfDay } from "@/lib/tasks";
import type { Subject, TaskKind } from "@/lib/types";
import { cn } from "@/lib/utils";

type Trigger = Parameters<typeof Popover>[0]["trigger"];

export const KIND_ICON: Record<TaskKind, LucideIcon> = {
  homework: NotebookPen,
  exam: GraduationCap,
  project: FolderKanban,
  reminder: Bell,
};

/** Small label for anything that isn't plain homework. Exams get the accent: they matter most. */
export function KindBadge({ kind, className, labelClassName }: { kind: TaskKind; className?: string; labelClassName?: string }) {
  const t = useMessages(tasksText);
  const Icon = KIND_ICON[kind];
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11.5px] font-medium leading-none",
        kind === "exam" ? "bg-blob-soft text-blob-ink" : "bg-hover text-ink-2",
        className,
      )}
      title={t.kind[kind]}
    >
      <Icon className="size-3" strokeWidth={2.2} />
      <span className={labelClassName}>{t.kind[kind]}</span>
    </span>
  );
}

export function SubjectDot({ subject, className }: { subject: Pick<Subject, "color"> | null | undefined; className?: string }) {
  return (
    <span
      className={cn("size-2 shrink-0 rounded-full", !subject && "border border-dashed border-ink-3 bg-transparent", className)}
      style={subject ? { background: subjectColor(subject.color) } : undefined}
    />
  );
}

/* ---------------------------------------------------------------------------
   Due date
   --------------------------------------------------------------------------- */

function timeOf(due: Date, kind: TaskKind): TimeOfDay | null {
  return isDefaultTime(due, kind) ? null : { h: due.getHours(), m: due.getMinutes() };
}

/**
 * Popover with quick chips (Today / Tomorrow / Next week), a native date and time input,
 * and "Remove date". Reports a full ISO timestamp, using the kind's default time unless one was set.
 */
export function DuePicker({
  value,
  kind,
  onChange,
  trigger,
  align = "end",
  onOpenChange,
  className,
}: {
  value: string | null;
  kind: TaskKind;
  onChange: (due_at: string | null) => void;
  trigger: Trigger;
  align?: "start" | "end";
  onOpenChange?: (open: boolean) => void;
  /** E.g. "z-[80]!" inside a dialog. */
  className?: string;
}) {
  return (
    <Popover align={align} className={cn("w-[284px] p-2", className)} trigger={trigger} onOpenChange={onOpenChange}>
      {(close) => <DuePanel value={value} kind={kind} onChange={onChange} close={close} />}
    </Popover>
  );
}

function DuePanel({ value, kind, onChange, close }: { value: string | null; kind: TaskKind; onChange: (v: string | null) => void; close: () => void }) {
  const t = useMessages(tasksText);
  const locale = useLocale();
  const fmt = { locale: dateLocale(locale) };
  const due = value ? new Date(value) : null;
  const time = due ? timeOf(due, kind) : null;
  // Read once when the panel opens; fine for a popover that lives a few seconds.
  const [today] = useState(() => startOfDay(new Date()));
  const nextWeek = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
  const options: { label: string; day: Date; hint: string }[] = [
    { label: t.due.today, day: today, hint: format(today, t.due.weekday, fmt) },
    { label: t.due.tomorrow, day: addDays(today, 1), hint: format(addDays(today, 1), t.due.weekday, fmt) },
    { label: t.nextWeek, day: nextWeek, hint: format(nextWeek, t.nextWeekHint, fmt) },
  ];
  const set = (day: Date, t: TimeOfDay | null = time) => onChange(dueAt(day, kind, t).toISOString());
  const dayValue = due ? format(due, "yyyy-MM-dd") : "";
  const timeValue = due && time ? format(due, "HH:mm") : "";
  const defaultTime = DEFAULT_TIME[kind];

  return (
    <div>
      <div className="px-1 pb-2 pt-0.5 text-[11.5px] font-medium text-ink-3">{t.dueDate}</div>
      <div className="grid grid-cols-3 gap-1">
        {options.map((o) => {
          const active = due && format(due, "yyyy-MM-dd") === format(o.day, "yyyy-MM-dd");
          return (
            <button
              key={o.label}
              onClick={() => {
                set(o.day);
                close();
              }}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[12.5px] font-medium leading-tight transition-colors",
                active ? "border-blob bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:border-line-2 hover:bg-hover hover:text-ink",
              )}
            >
              {o.label}
              <span className={cn("text-[11px] font-normal", active ? "text-blob-ink/80" : "text-ink-3")}>{o.hint}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_116px] gap-1.5">
        <label className="block">
          <span className="sr-only">{t.date}</span>
          <input
            type="date"
            value={dayValue}
            onChange={(e) => {
              if (!e.target.value) return;
              const [y, m, d] = e.target.value.split("-").map(Number);
              set(new Date(y, m - 1, d));
            }}
            className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-[13px] text-ink outline-none focus:border-blob"
          />
        </label>
        <label className="block">
          <span className="sr-only">{t.time}</span>
          <input
            type="time"
            value={timeValue}
            placeholder={`${String(defaultTime.h).padStart(2, "0")}:${String(defaultTime.m).padStart(2, "0")}`}
            onChange={(e) => {
              const v = e.target.value;
              const day = due ?? today;
              if (!v) return set(day, null);
              const [h, m] = v.split(":").map(Number);
              set(day, { h, m });
            }}
            className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-[13px] text-ink outline-none focus:border-blob"
            title={t.optionalTime}
          />
        </label>
      </div>
      {value && (
        <button
          onClick={() => {
            onChange(null);
            close();
          }}
          className="mt-1.5 flex h-7 w-full items-center gap-2 rounded-lg px-1.5 text-[12.5px] text-ink-3 hover:bg-hover hover:text-ink"
        >
          <CalendarX2 className="size-3.5" /> {t.removeDate}
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Subject
   --------------------------------------------------------------------------- */

export function SubjectPicker({
  value,
  subjects,
  onChange,
  trigger,
  align = "end",
  onOpenChange,
}: {
  value: string | null;
  subjects: Subject[];
  onChange: (subjectId: string | null) => void;
  trigger: Trigger;
  align?: "start" | "end";
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useMessages(tasksText);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const list = q ? subjects.filter((s) => s.name.toLowerCase().includes(q)) : subjects;
  return (
    <Popover
      align={align}
      className="w-[220px]"
      trigger={trigger}
      onOpenChange={(o) => {
        if (!o) setQuery("");
        onOpenChange?.(o);
      }}
    >
      {(close) => (
        <div>
          {subjects.length > 6 && (
            <div className="relative mb-1 p-0.5">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && list[0]) {
                    onChange(list[0].id);
                    close();
                  }
                }}
                placeholder={t.findSubject}
                className="h-7 w-full rounded-md border border-line bg-surface pl-7 pr-2 text-[12.5px] outline-none focus:border-blob"
              />
            </div>
          )}
          <div className="max-h-[260px] overflow-y-auto">
            {list.map((s) => (
              <PickRow
                key={s.id}
                active={value === s.id}
                onClick={() => {
                  onChange(s.id);
                  close();
                }}
                icon={s.emoji ? <span className="text-[13px] leading-none">{s.emoji}</span> : <SubjectDot subject={s} />}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{s.name}</span>
                  {s.emoji && <SubjectDot subject={s} className="size-1.5" />}
                </span>
              </PickRow>
            ))}
            {list.length === 0 && <p className="px-2 py-1.5 text-[12.5px] text-ink-3">{subjects.length ? t.noMatch : t.noSubjectsYet}</p>}
          </div>
          {value && (
            <>
              <div className="mx-1 my-1 h-px bg-line" />
              <PickRow
                onClick={() => {
                  onChange(null);
                  close();
                }}
                icon={<SubjectDot subject={null} />}
              >
                <span className="text-ink-3">{t.noSubject}</span>
              </PickRow>
            </>
          )}
        </div>
      )}
    </Popover>
  );
}

/* ---------------------------------------------------------------------------
   Kind
   --------------------------------------------------------------------------- */

export function KindOptions({ value, onChange }: { value: TaskKind; onChange: (k: TaskKind) => void }) {
  const t = useMessages(tasksText);
  return (
    <>
      {TASK_KINDS.map((k) => {
        const Icon = KIND_ICON[k];
        return (
          <PickRow key={k} active={value === k} onClick={() => onChange(k)} icon={<Icon className={cn("size-4", k === "exam" ? "text-blob-ink" : "text-ink-3")} />}>
            {t.kind[k]}
          </PickRow>
        );
      })}
    </>
  );
}

export function KindPicker({
  value,
  onChange,
  trigger,
  align = "start",
  onOpenChange,
}: {
  value: TaskKind;
  onChange: (k: TaskKind) => void;
  trigger: Trigger;
  align?: "start" | "end";
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Popover align={align} className="w-[180px]" trigger={trigger} onOpenChange={onOpenChange}>
      {(close) => (
        <KindOptions
          value={value}
          onChange={(k) => {
            onChange(k);
            close();
          }}
        />
      )}
    </Popover>
  );
}

function PickRow({ active, onClick, icon, children }: { active?: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      role="menuitemradio"
      aria-checked={!!active}
      onClick={onClick}
      className={cn(
        "flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-ink-2 transition-colors hover:bg-hover hover:text-ink",
        active && "text-ink",
      )}
    >
      <span className="grid size-4 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {active && <Check className="size-3.5 shrink-0 text-blob" strokeWidth={2.5} />}
    </button>
  );
}
