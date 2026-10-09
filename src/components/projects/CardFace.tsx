"use client";

import { AlignLeft, CalendarDays, CheckSquare, Paperclip } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, AvatarStack, type Person } from "@/components/share/Avatar";
import { useLocale, useMessages } from "@/i18n/client";
import { projectsText } from "@/i18n/messages/projects";
import type { Peer } from "@/lib/live";
import { dueTone, formatDue, formatDueLong, formatShortDate } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import type { Label, Priority } from "./model";
import { LabelChip, PriorityIcon } from "./pickers";

/** The due date as a small chip: red when late, Blob purple today. */
export function DueChip({ due, now, done, className }: { due: string; now: number | null; done?: boolean; className?: string }) {
  const locale = useLocale();
  const d = new Date(due);
  const tone = now ? dueTone(d, now) : "later";
  const text = now ? (done && tone === "late" ? formatShortDate(d, now, locale) : formatDue(d, now, locale)) : "";
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11.5px] font-medium tabular-nums leading-none",
        done ? "text-ink-3" : tone === "late" ? "bg-danger/10 text-danger" : tone === "today" ? "bg-blob-soft text-blob-ink" : tone === "soon" ? "text-ink-2" : "text-ink-3",
        className,
      )}
      title={formatDueLong(d, locale)}
      suppressHydrationWarning
    >
      <CalendarDays className="size-3" strokeWidth={2.2} />
      {text}
    </span>
  );
}

/**
 * How a card looks on a board (projects and the personal board): labels, title, then a row of small
 * facts (priority, due, checklist, attachments, description) and the people on it. Purely visual:
 * the board wraps it in what makes it draggable and clickable. `watchers`: people looking at it now.
 */
export function CardFace({
  title,
  done,
  labels = [],
  priority = 0,
  due,
  checklist,
  attachments = 0,
  description,
  assignees = [],
  watchers = [],
  now,
  leading,
  extra,
  dragging,
  overlay,
  className,
}: {
  title: ReactNode;
  done?: boolean;
  labels?: Label[];
  priority?: Priority;
  due?: string | null;
  checklist?: { done: number; total: number };
  attachments?: number;
  description?: boolean;
  assignees?: Person[];
  watchers?: Peer[];
  now: number | null;
  /** Before the title (a checkbox on the personal board). */
  leading?: ReactNode;
  /** More facts at the start of the bottom row (a subject, a task kind). */
  extra?: ReactNode;
  /** The placeholder left behind while the card is dragged. */
  dragging?: boolean;
  /** The copy that follows the pointer. */
  overlay?: boolean;
  className?: string;
}) {
  const t = useMessages(projectsText);
  const watcher = watchers[0];
  const facts = priority > 0 || due || (checklist && checklist.total > 0) || attachments > 0 || description || extra || assignees.length > 0;
  return (
    <div
      className={cn(
        "relative rounded-[10px] border bg-raised px-3 pb-2.5 pt-2.5 text-left transition-[border-color,box-shadow,opacity] duration-150",
        dragging
          ? "border-dashed border-line-2 bg-hover/40 opacity-60 shadow-none [&>*]:opacity-40"
          : overlay
            ? "rotate-[1.5deg] cursor-grabbing border-line-2 shadow-[0_2px_4px_rgb(0_0_0/0.06),0_16px_32px_-8px_rgb(0_0_0/0.28)]"
            : "border-line shadow-card group-hover/card:border-line-2",
        className,
      )}
      style={watcher && !dragging ? { boxShadow: `0 0 0 1.5px ${watcher.color}` } : undefined}
    >
      {watcher && !dragging && (
        <span className="absolute -right-1 -top-1.5 flex" title={t.lookingAt(watcher.name)}>
          {watchers.slice(0, 2).map((w, i) => (
            <Avatar key={w.key} person={w} size={18} className={cn("ring-2 ring-raised", i > 0 && "-ml-1.5")} />
          ))}
        </span>
      )}
      {labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {labels.slice(0, 4).map((l) => (
            <LabelChip key={l.raw} label={l} className="h-[18px] text-[11px]" />
          ))}
          {labels.length > 4 && <span className="text-[11px] leading-[18px] text-ink-3">+{labels.length - 4}</span>}
        </div>
      )}
      <div className="flex items-start gap-2">
        {leading}
        <div className={cn("min-w-0 flex-1 break-words text-[13.5px] leading-[1.4]", done ? "text-ink-3" : "text-ink")}>{title}</div>
      </div>
      {facts && (
        <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-3">
          {extra}
          {priority > 0 && (
            <span title={`${t.priority}: ${t.priorityNames[priority]}`} className="-mx-0.5 flex">
              <PriorityIcon priority={priority} />
            </span>
          )}
          {due && <DueChip due={due} now={now} done={done} className="-ml-1" />}
          {checklist && checklist.total > 0 && (
            <span
              className={cn("inline-flex items-center gap-1 tabular-nums", checklist.done === checklist.total && "text-ok")}
              title={t.checklistCount(checklist.done, checklist.total)}
            >
              <CheckSquare className="size-3" strokeWidth={2.2} />
              {checklist.done}/{checklist.total}
            </span>
          )}
          {attachments > 0 && (
            <span className="inline-flex items-center gap-0.5 tabular-nums" title={t.attachmentCount(attachments)}>
              <Paperclip className="size-3" strokeWidth={2.2} />
              {attachments}
            </span>
          )}
          {description && (
            <span title={t.hasDescription}>
              <AlignLeft className="size-3" strokeWidth={2.2} />
            </span>
          )}
          {assignees.length > 0 && (
            <AvatarStack
              people={assignees}
              size={20}
              max={3}
              className="ml-auto"
              label={t.assignedTo(assignees.map((a) => a.full_name || a.name || "?").join(", "))}
            />
          )}
        </div>
      )}
    </div>
  );
}
