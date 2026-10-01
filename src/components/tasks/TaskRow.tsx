"use client";

import { motion } from "motion/react";
import { CalendarPlus, Ellipsis, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/Menu";
import { dueTone, formatDue, formatDueLong, formatTime, isDefaultTime } from "@/lib/tasks";
import type { Subject, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DuePicker, KindBadge, KindOptions, SubjectDot, SubjectPicker } from "./pickers";
import { TaskCheckbox } from "./TaskCheckbox";
import type { TaskPatch } from "./useTaskStore";

/** How long the check animation plays before the row moves to "Done". */
const SETTLE_MS = 560;

export type TaskRowProps = {
  task: Task;
  now: number;
  subjects: Subject[];
  onToggle: (done: boolean) => void;
  onUpdate?: (patch: TaskPatch) => void;
  onDelete?: () => void;
  /** Leave out the subject column (e.g. on a subject page). */
  hideSubject?: boolean;
  /** Compact, read-mostly row for widgets: no inline editing or menus. */
  dense?: boolean;
  /** For narrow columns: the due date shrinks to fit instead of using a fixed column. */
  narrow?: boolean;
};

export function TaskRow({ task, now, subjects, onToggle, onUpdate, onDelete, hideSubject, dense, narrow }: TaskRowProps) {
  const [pending, setPending] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const done = pending ?? task.done;
  const subject = subjects.find((s) => s.id === task.subject_id) ?? null;
  const editable = !dense && !!onUpdate;

  useEffect(() => () => clearTimeout(timer.current), []);

  function toggle(next: boolean) {
    clearTimeout(timer.current);
    if (!next) {
      setPending(null);
      if (task.done) onToggle(false);
      return;
    }
    // Let the jelly play, then move the row.
    setPending(true);
    timer.current = setTimeout(() => {
      onToggle(true);
      setPending(null);
    }, SETTLE_MS);
  }

  function save() {
    setEditing(false);
    const t = draft.trim();
    if (t && t !== task.title) onUpdate?.({ title: t });
    else setDraft(task.title);
  }

  const due = task.due_at ? new Date(task.due_at) : null;
  const tone = due ? dueTone(due, now) : null;
  const showTime = due && !isDefaultTime(due, task.kind);

  // Once it's done, "3 days late" is old news: show the plain date instead.
  const dueText = due ? (done && tone === "late" ? format(due, "MMM d") : formatDue(due, now)) : "";
  const dueLabel = due ? (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate">{dueText}</span>
      {showTime && !done && !narrow && <span className="hidden shrink-0 font-normal text-ink-3 sm:inline">{formatTime(due)}</span>}
    </span>
  ) : null;

  const dueClass = cn(
    "tabular-nums",
    done ? "text-ink-3" : tone === "late" ? "text-danger" : tone === "today" ? "font-medium text-blob-ink" : tone === "soon" ? "text-ink-2" : "text-ink-3",
  );

  return (
    <div
      className={cn(
        "group/row relative flex items-center gap-1.5 rounded-lg pl-1 pr-1 transition-colors",
        dense ? "min-h-9" : "min-h-[38px] hover:bg-hover/60 [&:has([aria-expanded=true])]:bg-hover/60",
      )}
    >
      <TaskCheckbox checked={done} onChange={toggle} size={dense ? 16 : 17} label={done ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`} />

      <div className="flex min-w-0 flex-1 items-center gap-2 py-1.5">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setDraft(task.title);
                setEditing(false);
              }
            }}
            maxLength={200}
            className="-my-1 h-7 min-w-0 flex-1 rounded-md bg-raised px-1.5 text-[14px] text-ink shadow-[0_0_0_1.5px_var(--blob)] outline-none"
            aria-label="Task title"
          />
        ) : (
          <button
            type="button"
            disabled={!editable}
            onClick={() => {
              setDraft(task.title);
              setEditing(true);
            }}
            className={cn(
              "relative min-w-0 max-w-full truncate rounded px-0.5 text-left transition-colors duration-300 disabled:cursor-default",
              dense ? "text-[13.5px]" : "text-[14px]",
              done ? "text-ink-3" : "text-ink",
              editable && "cursor-text",
            )}
            title={task.title}
          >
            {task.title}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute left-0 right-0 top-1/2 h-[1.5px] origin-left rounded-full bg-ink-3"
              initial={false}
              animate={{ scaleX: done ? 1 : 0 }}
              transition={done ? { duration: 0.32, ease: [0.65, 0, 0.35, 1], delay: 0.08 } : { duration: 0.15 }}
            />
          </button>
        )}
        {task.kind !== "homework" && !editing && (
          <KindBadge kind={task.kind} className={cn(done && "opacity-60")} labelClassName={dense ? "hidden @min-[400px]:inline" : "hidden sm:inline"} />
        )}
      </div>

      {dense ? (
        <div className="flex shrink-0 items-center gap-2 pl-1 text-[12.5px]">
          {!hideSubject && subject && (
            <span className="flex max-w-[110px] items-center gap-1.5 text-ink-3" title={subject.name}>
              <SubjectDot subject={subject} />
              <span className="hidden truncate @min-[400px]:inline">{subject.name}</span>
            </span>
          )}
          {due && (
            <span className={cn("min-w-[64px] text-right", dueClass)} title={formatDueLong(due)}>
              {dueText}
            </span>
          )}
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-0.5 text-[12.5px]">
          {!hideSubject && (
            <SubjectPicker
              value={task.subject_id}
              subjects={subjects}
              onChange={(subject_id) => onUpdate?.({ subject_id })}
              trigger={(props) => (
                <button
                  {...props}
                  className={cn(
                    "flex h-7 w-[34px] items-center gap-1.5 rounded-md px-2 text-left transition-colors hover:bg-hover hover:text-ink sm:w-[132px]",
                    subject ? "text-ink-2" : "text-ink-3 opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100 aria-expanded:opacity-100",
                    done && "opacity-70",
                  )}
                  title={subject ? `Subject: ${subject.name}` : "Add subject"}
                >
                  <SubjectDot subject={subject} />
                  <span className="hidden truncate sm:inline">{subject ? subject.name : "Subject"}</span>
                </button>
              )}
            />
          )}
          <DuePicker
            value={task.due_at}
            kind={task.kind}
            onChange={(due_at) => onUpdate?.({ due_at })}
            trigger={(props) => (
              <button
                {...props}
                className={cn(
                  "flex h-7 items-center justify-end gap-1 rounded-md px-2 text-right transition-colors hover:bg-hover",
                  narrow ? "min-w-[60px] max-w-[140px]" : "w-[84px] sm:w-[150px]",
                  due ? dueClass : "text-ink-3 opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100 aria-expanded:opacity-100",
                )}
                title={due ? formatDueLong(due) : "Add a due date"}
              >
                {dueLabel ?? (
                  <>
                    <CalendarPlus className="size-3.5" /> Date
                  </>
                )}
              </button>
            )}
          />
          <Popover
            align="end"
            className="w-[200px]"
            trigger={(props) => (
              <button
                {...props}
                className="grid size-7 place-items-center rounded-md text-ink-3 opacity-0 transition-opacity hover:bg-hover hover:text-ink focus-visible:opacity-100 group-hover/row:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100"
                aria-label="Task options"
                title="Task options"
              >
                <Ellipsis className="size-4" />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuLabel>Type</MenuLabel>
                <KindOptions
                  value={task.kind}
                  onChange={(kind) => {
                    onUpdate?.({ kind });
                    close();
                  }}
                />
                <MenuSeparator />
                <MenuItem
                  icon={<Trash2 />}
                  danger
                  onSelect={() => {
                    close();
                    onDelete?.();
                  }}
                >
                  Delete task
                </MenuItem>
              </>
            )}
          </Popover>
        </div>
      )}
    </div>
  );
}
