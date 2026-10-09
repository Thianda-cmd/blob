"use client";

import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { AvatarStack, type Person } from "@/components/share/Avatar";
import { useMessages } from "@/i18n/client";
import { projectsText } from "@/i18n/messages/projects";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DueChip } from "./CardFace";
import { byPosition, checklistProgress } from "./model";
import { ColumnDot, LabelChip, PriorityIcon, parseLabels } from "./pickers";
import type { Board } from "./useBoard";

type SortKey = "title" | "status" | "assignees" | "due" | "priority" | "labels";

/** The board as a table: one row per card, sortable by any column. Click a row to open the card. */
export function ListView({
  board,
  visible,
  now,
  openId,
  onOpen,
}: {
  board: Board;
  visible: (card: Task) => boolean;
  now: number | null;
  openId: string | null;
  onOpen: (cardId: string) => void;
}) {
  const t = useMessages(projectsText);
  const { columns, cards, members } = board;
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const people = useMemo(() => new Map<string, Person>(members.map((m) => [m.user_id, m])), [members]);
  const columnIndex = useMemo(() => new Map(columns.map((c, i) => [c.id, i])), [columns]);

  const rows = useMemo(() => {
    const status = (c: Task) => columnIndex.get(c.column_id ?? "") ?? 0;
    const list = cards.filter(visible);
    const boardOrder = (a: Task, b: Task) => status(a) - status(b) || byPosition(a, b);
    if (!sort) return list.sort(boardOrder);
    const cmp: Record<SortKey, (a: Task, b: Task) => number> = {
      title: (a, b) => a.title.localeCompare(b.title),
      status: (a, b) => status(a) - status(b),
      assignees: (a, b) => (people.get(a.assignees[0])?.full_name ?? "~").localeCompare(people.get(b.assignees[0])?.full_name ?? "~"),
      // Cards without a date go last either way.
      due: (a, b) => (a.due_at && b.due_at ? a.due_at.localeCompare(b.due_at) : a.due_at ? -sort.dir : b.due_at ? sort.dir : 0),
      priority: (a, b) => a.priority - b.priority,
      labels: (a, b) => (parseLabels(a.labels)[0]?.name ?? "~").localeCompare(parseLabels(b.labels)[0]?.name ?? "~"),
    };
    return list.sort((a, b) => cmp[sort.key](a, b) * sort.dir || boardOrder(a, b));
  }, [cards, visible, sort, columnIndex, people]);

  const header: { key: SortKey; label: string; className?: string }[] = [
    { key: "title", label: t.list.title },
    { key: "status", label: t.list.status },
    { key: "assignees", label: t.list.assignees },
    { key: "due", label: t.list.due },
    { key: "priority", label: t.list.priority },
    { key: "labels", label: t.list.labels },
  ];
  const grid = "md:grid md:grid-cols-[minmax(0,1fr)_150px_112px_104px_96px_minmax(0,170px)] md:items-center md:gap-3";

  if (!cards.length) return <p className="px-4 py-10 text-center text-[13.5px] text-ink-3 sm:px-8">{t.list.empty}</p>;

  return (
    <div className="h-full overflow-y-auto px-4 pb-24 sm:px-8 lg:px-10" role="table" aria-label={board.project.title}>
      <div role="row" className={cn("sticky top-0 z-10 hidden h-9 border-b border-line bg-surface text-[12px] font-medium text-ink-3", grid)}>
        {header.map((h) => {
          const active = sort?.key === h.key;
          return (
            <span key={h.key} role="columnheader" aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : "none"}>
              <button
                type="button"
                onClick={() => setSort((s) => (s?.key === h.key ? (s.dir === 1 ? { key: h.key, dir: -1 } : null) : { key: h.key, dir: 1 }))}
                className={cn("-ml-1.5 flex h-7 items-center gap-1 rounded-md px-1.5 hover:bg-hover hover:text-ink", active && "text-ink")}
                title={t.list.sortBy(h.label)}
              >
                {h.label}
                {active && (sort!.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
              </button>
            </span>
          );
        })}
      </div>
      {rows.length === 0 && <p className="py-10 text-center text-[13.5px] text-ink-3">{t.nothingMatches}</p>}
      <div role="rowgroup">
        {rows.map((card) => {
          const column = columns.find((c) => c.id === card.column_id) ?? columns[0];
          const done = card.done || !!column?.done;
          const assignees = card.assignees.map((id) => people.get(id)).filter((p): p is Person => !!p);
          const labels = parseLabels(card.labels);
          const progress = checklistProgress(card.checklist);
          return (
            <div
              key={card.id}
              role="row"
              tabIndex={0}
              onClick={() => onOpen(card.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(card.id);
                }
              }}
              className={cn(
                "group relative -mx-2 flex cursor-pointer flex-col gap-1.5 rounded-lg border-b border-line/70 px-2 py-2.5 outline-none transition-colors hover:bg-hover/50 focus-visible:bg-hover/60 focus-visible:ring-2 focus-visible:ring-blob md:min-h-11 md:py-1.5",
                grid,
                openId === card.id && "bg-blob-soft/50 hover:bg-blob-soft/60",
              )}
            >
              <span role="cell" className={cn("flex min-w-0 items-center gap-2 text-[13.5px]", done ? "text-ink-3" : "text-ink")}>
                {done && <Check className="size-3.5 shrink-0 text-ok" strokeWidth={2.6} />}
                <span className="truncate font-medium" title={card.title}>
                  {card.title}
                </span>
                {progress.total > 0 && (
                  <span className={cn("shrink-0 text-[11.5px] tabular-nums text-ink-3", progress.done === progress.total && "text-ok")}>
                    {progress.done}/{progress.total}
                  </span>
                )}
              </span>
              {/* Phones: the facts in one line under the title. */}
              <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-ink-2 md:contents">
                <span role="cell" className="flex min-w-0 items-center gap-1.5">
                  {column && <ColumnDot column={column} />}
                  <span className="truncate">{column?.title}</span>
                </span>
                <span role="cell" className={cn("flex min-w-0 items-center", !assignees.length && "max-md:hidden")}>
                  {assignees.length > 0 ? <AvatarStack people={assignees} size={22} max={4} /> : <span className="text-ink-3">–</span>}
                </span>
                <span role="cell" className={cn("flex min-w-0 items-center", !card.due_at && "max-md:hidden")}>
                  {card.due_at ? <DueChip due={card.due_at} now={now} done={done} className="-ml-1.5" /> : <span className="text-ink-3">–</span>}
                </span>
                <span role="cell" className={cn("flex min-w-0 items-center gap-1.5", card.priority === 0 && "max-md:hidden")} title={t.priorityNames[card.priority]}>
                  {card.priority > 0 ? (
                    <>
                      <PriorityIcon priority={card.priority} />
                      <span className="hidden truncate lg:inline">{t.priorityNames[card.priority]}</span>
                    </>
                  ) : (
                    <span className="text-ink-3">–</span>
                  )}
                </span>
                <span role="cell" className={cn("flex min-w-0 flex-wrap gap-1 overflow-hidden md:h-5", !labels.length && "max-md:hidden")}>
                  {labels.slice(0, 3).map((l) => (
                    <LabelChip key={l.raw} label={l} />
                  ))}
                  {labels.length > 3 && <span className="text-[11px] text-ink-3">+{labels.length - 3}</span>}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
