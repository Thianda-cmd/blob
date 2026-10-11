"use client";

import { Cake, Coffee, FolderKanban, GraduationCap, Repeat2, School, BookOpenCheck, MapPin } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { CalItem } from "@/calendar/items";
import { KIND_ICON } from "@/components/tasks/pickers";
import type { Locale } from "@/i18n/config";
import type { EventKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtRange, fmtTime } from "./describe";

// How calendar items look: blocks in the time grid, bars in the all-day lane and month grid, and
// rows in the agenda. Everything takes the item's colour from `--c`.

export const EVENT_ICON: Partial<Record<EventKind, typeof Cake>> = {
  lesson: School,
  study: BookOpenCheck,
  birthday: Cake,
  break: Coffee,
};

export const colorVar = (color: string) => ({ "--c": color }) as CSSProperties;

/** The small icon in front of a title (event kinds, task kinds, project cards). */
export function ItemIcon({ item, className }: { item: CalItem; className?: string }) {
  if (item.source === "card") return <FolderKanban className={cn("size-3 shrink-0", className)} strokeWidth={2.2} />;
  if (item.source === "task") {
    const Icon = item.exam ? GraduationCap : KIND_ICON[item.task!.kind];
    return <Icon className={cn("size-3 shrink-0", className)} strokeWidth={2.2} />;
  }
  const Icon = EVENT_ICON[item.kind as EventKind];
  return Icon ? <Icon className={cn("size-3 shrink-0", className)} strokeWidth={2.2} /> : null;
}

/** A round tick box for tasks on the calendar (ticks the task off). */
export function TaskTick({ item, onToggle, size = 13 }: { item: CalItem; onToggle?: () => void; size?: number }) {
  return (
    <button
      type="button"
      data-no-drag
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onToggle?.();
      }}
      disabled={!onToggle}
      aria-pressed={item.done}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full border-[1.5px] transition-colors after:absolute after:-inset-1.5 after:content-['']",
        item.done ? "border-[var(--c)] bg-[var(--c)] text-white" : "border-[color-mix(in_oklab,var(--c)_70%,var(--ink-3))] hover:bg-[color-mix(in_oklab,var(--c)_18%,transparent)]",
      )}
      style={{ width: size, height: size }}
    >
      {item.done && (
        <svg viewBox="0 0 12 12" className="size-[70%]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6.2l2.3 2.3 4.7-5" />
        </svg>
      )}
    </button>
  );
}

const repeating = (item: CalItem) => !!item.occurrence;

/** A block in the time grid. */
export function GridBlock({
  item,
  height,
  locale,
  selected,
  ghost,
  dimmed,
  untitled,
  onToggleTask,
  handles,
  fromBefore,
  goesOn,
}: {
  item: CalItem;
  /** Height in pixels (decides how much fits). */
  height: number;
  locale: Locale;
  selected?: boolean;
  ghost?: boolean;
  dimmed?: boolean;
  untitled: string;
  onToggleTask?: () => void;
  /** Resize handles (top, bottom). */
  handles?: ReactNode;
  fromBefore?: boolean;
  goesOn?: boolean;
}) {
  const title = item.title || untitled;
  const tall = height >= 38;
  const marker = item.marker || item.source !== "event";
  return (
    <div
      className={cn(
        "group/block relative flex h-full w-full flex-col overflow-hidden text-left text-[12px] leading-[1.25] transition-[box-shadow,opacity] duration-150",
        marker ? "rounded-md px-1.5" : "rounded-[7px] border-l-[3px] border-[var(--c)] py-[3px] pl-1.5 pr-1",
        marker
          ? item.exam
            ? "bg-blob-soft text-blob-ink ring-1 ring-inset ring-[color-mix(in_oklab,var(--blob)_35%,transparent)]"
            : "bg-[color-mix(in_oklab,var(--c)_10%,var(--raised))] text-ink ring-1 ring-inset ring-[color-mix(in_oklab,var(--c)_35%,transparent)]"
          : "bg-[color-mix(in_oklab,var(--c)_17%,var(--raised))] text-ink",
        !tall && !marker && "py-0",
        selected && "shadow-[0_0_0_2px_var(--c)]",
        ghost && "shadow-pop ring-2 ring-[var(--c)]",
        dimmed && "opacity-35",
        item.done && "opacity-60",
        fromBefore && "rounded-t-none",
        goesOn && "rounded-b-none",
      )}
      style={colorVar(item.color)}
    >
      {marker ? (
        <div className="flex min-h-[20px] items-center gap-1.5">
          {item.source === "task" && <TaskTick item={item} onToggle={onToggleTask} />}
          <ItemIcon item={item} className={item.exam ? "text-blob-ink" : "text-[var(--c)]"} />
          <span className={cn("min-w-0 flex-1 truncate font-medium", item.done && "line-through decoration-ink-3")}>{title}</span>
          {height >= 20 && <span className="shrink-0 text-[11px] tabular-nums text-ink-3">{fmtTime(item.start, locale)}</span>}
        </div>
      ) : tall ? (
        <>
          <span className="flex min-w-0 items-start gap-1 font-semibold">
            <ItemIcon item={item} className="mt-[2px] text-[var(--c)]" />
            <span className={cn("min-w-0", height >= 56 ? "line-clamp-2" : "truncate")}>{title}</span>
          </span>
          <span className="truncate text-[11px] tabular-nums text-ink-2">
            {fmtRange(item.start, item.end, locale)}
            {repeating(item) && <Repeat2 className="ml-1 inline size-2.5 align-[-1px] text-ink-3" />}
          </span>
          {height >= 72 && item.event?.location && (
            <span className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[11px] text-ink-3">
              <MapPin className="size-2.5 shrink-0" />
              <span className="truncate">{item.event.location}</span>
            </span>
          )}
        </>
      ) : (
        <span className="flex min-w-0 items-center gap-1 truncate">
          <span className="truncate font-semibold">{title}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-ink-2">{fmtTime(item.start, locale)}</span>
        </span>
      )}
      {handles}
    </div>
  );
}

/** A bar in the all-day lane or the month grid. */
export function Bar({
  item,
  locale,
  timed,
  selected,
  ghost,
  dimmed,
  untitled,
  onToggleTask,
  fromBefore,
  goesOn,
  handles,
  compact,
}: {
  item: CalItem;
  locale: Locale;
  /** A timed item in the month grid: a dot and its time instead of a filled bar. */
  timed?: boolean;
  /** Narrow cells (phones): the title only. */
  compact?: boolean;
  selected?: boolean;
  ghost?: boolean;
  dimmed?: boolean;
  untitled: string;
  onToggleTask?: () => void;
  fromBefore?: boolean;
  goesOn?: boolean;
  handles?: ReactNode;
}) {
  const title = item.title || untitled;
  return (
    <div
      className={cn(
        "relative flex h-full w-full min-w-0 items-center gap-1 overflow-hidden leading-none transition-[box-shadow,opacity] duration-150",
        compact ? "px-1 text-[10.5px]" : "px-1.5 text-[12px]",
        "rounded-[6px]",
        timed
          ? "text-ink hover:bg-hover"
          : item.exam
            ? "bg-blob-soft font-medium text-blob-ink ring-1 ring-inset ring-[color-mix(in_oklab,var(--blob)_35%,transparent)]"
            : item.source === "event"
              ? "bg-[color-mix(in_oklab,var(--c)_22%,var(--raised))] font-medium text-ink"
              : "bg-[color-mix(in_oklab,var(--c)_9%,var(--raised))] font-medium text-ink ring-1 ring-inset ring-[color-mix(in_oklab,var(--c)_32%,transparent)]",
        selected && "shadow-[0_0_0_2px_var(--c)]",
        ghost && "shadow-pop ring-2 ring-[var(--c)]",
        dimmed && "opacity-35",
        item.done && "opacity-60",
        fromBefore && "rounded-l-none",
        goesOn && "rounded-r-none",
      )}
      style={colorVar(item.color)}
    >
      {item.source === "task" && !compact ? (
        <TaskTick item={item} onToggle={onToggleTask} size={12} />
      ) : timed ? (
        <span className="size-[7px] shrink-0 rounded-full bg-[var(--c)]" />
      ) : null}
      {!compact && <ItemIcon item={item} className={item.exam ? "text-blob-ink" : "text-[var(--c)]"} />}
      {timed && !compact && <span className="shrink-0 tabular-nums text-ink-3">{fmtTime(item.start, locale)}</span>}
      <span className={cn("min-w-0 truncate", item.done && "line-through decoration-ink-3")}>{title}</span>
      {handles}
    </div>
  );
}
