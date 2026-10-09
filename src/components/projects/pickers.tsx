"use client";

import { Check, Plus, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Avatar, personName } from "@/components/share/Avatar";
import { Popover } from "@/components/ui/Menu";
import { useMessages } from "@/i18n/client";
import { projectsText } from "@/i18n/messages/projects";
import type { Member, ProjectColumn } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LABEL_COLORS, PRIORITIES, PROJECT_COLORS, boardColor, formatLabel, labelKey, parseLabel, type Label, type LabelColor, type Priority } from "./model";

type Trigger = Parameters<typeof Popover>[0]["trigger"];

/* ---------------------------------------------------------------------------
   Priority
   --------------------------------------------------------------------------- */

/** Signal bars like a phone's: one, two or three filled. High priority is warm, so it stands out. */
export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  if (priority === 0) {
    return (
      <svg viewBox="0 0 16 16" className={cn("size-4 shrink-0 text-ink-3", className)} aria-hidden>
        {[3, 7, 11].map((x) => (
          <rect key={x} x={x} y={7.25} width={2.5} height={1.5} rx={0.75} fill="currentColor" opacity={0.7} />
        ))}
      </svg>
    );
  }
  const color = priority === 3 ? "var(--subject-clay)" : "currentColor";
  return (
    <svg viewBox="0 0 16 16" className={cn("size-4 shrink-0", priority === 3 ? "" : "text-ink-2", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={2.5 + i * 4}
          y={10 - i * 3.5}
          width={3}
          height={3.5 + i * 3.5}
          rx={1}
          fill={i < priority ? color : "currentColor"}
          opacity={i < priority ? 1 : 0.22}
        />
      ))}
    </svg>
  );
}

export function PriorityMenu({ value, onChange, trigger, align = "start" }: { value: Priority; onChange: (p: Priority) => void; trigger: Trigger; align?: "start" | "end" }) {
  const t = useMessages(projectsText);
  return (
    <Popover align={align} className="w-[190px]" trigger={trigger}>
      {(close) =>
        PRIORITIES.map((p) => (
          <PickRow
            key={p}
            active={value === p}
            icon={<PriorityIcon priority={p} />}
            onClick={() => {
              onChange(p);
              close();
            }}
          >
            {t.priorityNames[p]}
          </PickRow>
        ))
      }
    </Popover>
  );
}

/* ---------------------------------------------------------------------------
   Status (column)
   --------------------------------------------------------------------------- */

export function ColumnDot({ column, className }: { column: Pick<ProjectColumn, "color" | "done">; className?: string }) {
  if (column.done) {
    return (
      <span className={cn("grid size-3.5 shrink-0 place-items-center rounded-full", className)} style={{ background: boardColor(column.color) }} aria-hidden>
        <Check className="size-2.5 text-white" strokeWidth={3.5} />
      </span>
    );
  }
  return <span className={cn("size-2.5 shrink-0 rounded-full border-[2.5px]", className)} style={{ borderColor: boardColor(column.color) }} aria-hidden />;
}

export function ColumnMenu({
  value,
  columns,
  onChange,
  trigger,
  align = "start",
}: {
  value: string | null;
  columns: ProjectColumn[];
  onChange: (columnId: string) => void;
  trigger: Trigger;
  align?: "start" | "end";
}) {
  return (
    <Popover align={align} className="w-[220px]" trigger={trigger}>
      {(close) => (
        <div className="max-h-[300px] overflow-y-auto">
          {columns.map((c) => (
            <PickRow
              key={c.id}
              active={value === c.id}
              icon={<ColumnDot column={c} />}
              onClick={() => {
                onChange(c.id);
                close();
              }}
            >
              {c.title}
            </PickRow>
          ))}
        </div>
      )}
    </Popover>
  );
}

/* ---------------------------------------------------------------------------
   Assignees
   --------------------------------------------------------------------------- */

export function AssigneeMenu({
  value,
  members,
  me,
  onChange,
  trigger,
  align = "start",
}: {
  value: string[];
  members: Member[];
  me: string;
  onChange: (ids: string[]) => void;
  trigger: Trigger;
  align?: "start" | "end";
}) {
  const t = useMessages(projectsText);
  // You first: assigning yourself is the most common.
  const list = [...members].sort((a, b) => (a.user_id === me ? -1 : b.user_id === me ? 1 : 0));
  return (
    <Popover align={align} className="w-[240px]" trigger={trigger} role="dialog" label={t.drawer.assign}>
      <div className="max-h-[300px] overflow-y-auto">
        {list.map((m) => {
          const on = value.includes(m.user_id);
          return (
            <PickRow
              key={m.user_id}
              active={on}
              multi
              icon={<Avatar person={m} size={20} />}
              onClick={() => onChange(on ? value.filter((id) => id !== m.user_id) : [...value, m.user_id])}
            >
              {personName(m, t.drawer.someone)}
              {m.user_id === me && <span className="text-ink-3"> ({t.you})</span>}
            </PickRow>
          );
        })}
      </div>
      {members.length < 2 && <p className="border-t border-line px-2 pb-1 pt-2 text-[11.5px] leading-snug text-ink-3">{t.drawer.onlyMembers}</p>}
    </Popover>
  );
}

/* ---------------------------------------------------------------------------
   Labels
   --------------------------------------------------------------------------- */

export function LabelChip({ label, className, onRemove, removeLabel }: { label: Label; className?: string; onRemove?: () => void; removeLabel?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full shrink-0 items-center gap-1 rounded-md border border-line bg-raised pl-1.5 pr-1.5 text-[11.5px] font-medium leading-none text-ink-2",
        onRemove && "pr-0.5",
        className,
      )}
      title={label.name}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: boardColor(label.color) }} />
      <span className="truncate">{label.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="grid size-4 place-items-center rounded text-ink-3 hover:bg-hover hover:text-ink [@media(hover:none)]:size-5"
        >
          <svg viewBox="0 0 10 10" className="size-2" aria-hidden>
            <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  );
}

/** Pick labels from the project's ones, or type a new name and pick its colour. */
export function LabelMenu({
  value,
  known,
  onChange,
  trigger,
  align = "start",
}: {
  value: string[];
  /** Every label in the project. */
  known: Label[];
  onChange: (labels: string[]) => void;
  trigger: Trigger;
  align?: "start" | "end";
}) {
  const t = useMessages(projectsText);
  const [query, setQuery] = useState("");
  const [color, setColor] = useState<LabelColor>("sky");
  const q = query.trim();
  const selected = new Set(value.map(labelKey));
  const list = q ? known.filter((l) => l.name.toLowerCase().includes(q.toLowerCase())) : known;
  const exists = known.some((l) => l.name.toLowerCase() === q.toLowerCase());

  function toggle(label: Label) {
    const key = label.name.toLowerCase();
    onChange(selected.has(key) ? value.filter((raw) => labelKey(raw) !== key) : [...value, label.raw].slice(0, 12));
  }
  function create() {
    if (!q || exists) return;
    onChange([...value, formatLabel(q, color)].slice(0, 12));
    setQuery("");
  }

  return (
    <Popover
      align={align}
      className="w-[260px]"
      trigger={trigger}
      role="dialog"
      label={t.drawer.labels}
      onOpenChange={(open) => {
        if (!open) setQuery("");
      }}
    >
      <div className="relative p-0.5">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
        <input
          autoFocus
          value={query}
          maxLength={40}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (list[0] && (exists || !q)) toggle(list[0]);
            else create();
          }}
          placeholder={t.drawer.labelSearch}
          className="h-8 w-full rounded-md border border-line bg-surface pl-7 pr-2 text-[12.5px] outline-none focus:border-blob"
        />
      </div>
      <div className="mt-1 max-h-[220px] overflow-y-auto">
        {list.map((l) => (
          <PickRow key={l.raw} active={selected.has(l.name.toLowerCase())} multi onClick={() => toggle(l)} icon={<span className="size-2.5 rounded-full" style={{ background: boardColor(l.color) }} />}>
            {l.name}
          </PickRow>
        ))}
        {!q && known.length === 0 && <p className="px-2 py-1.5 text-[12px] leading-snug text-ink-3">{t.drawer.noLabels}</p>}
      </div>
      {q && !exists && (
        <div className="mt-1 border-t border-line pt-1.5">
          <div className="flex items-center gap-1 px-1.5 pb-1.5" role="radiogroup" aria-label={t.drawer.labelColor}>
            {LABEL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={t.colors[c]}
                title={t.colors[c]}
                onClick={() => setColor(c)}
                className={cn("grid size-6 place-items-center rounded-full transition-transform hover:scale-110", color === c && "ring-2 ring-ink/70 ring-offset-1 ring-offset-raised")}
              >
                <span className="size-3.5 rounded-full" style={{ background: boardColor(c) }} />
              </button>
            ))}
          </div>
          <PickRow onClick={create} icon={<Plus className="size-3.5 text-ink-3" />}>
            <span className="flex min-w-0 items-center gap-1.5">
              {t.drawer.createLabel(q)}
              <span className="size-2 shrink-0 rounded-full" style={{ background: boardColor(color) }} />
            </span>
          </PickRow>
        </div>
      )}
    </Popover>
  );
}

export const parseLabels = (raw: string[]) => raw.map(parseLabel).filter((l) => l.name);

/* ---------------------------------------------------------------------------
   Colours
   --------------------------------------------------------------------------- */

export function ColorSwatches({ value, onChange, label, size = "md" }: { value: string; onChange: (c: string) => void; label: string; size?: "sm" | "md" }) {
  const t = useMessages(projectsText);
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
      {PROJECT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={t.colors[c]}
          title={t.colors[c]}
          onClick={() => onChange(c)}
          className={cn(
            "grid place-items-center rounded-full transition-transform hover:scale-110",
            size === "sm" ? "size-6" : "size-8",
            value === c && "ring-2 ring-ink/70 ring-offset-2 ring-offset-raised",
          )}
        >
          <span className={cn("rounded-full", size === "sm" ? "size-4" : "size-5")} style={{ background: boardColor(c) }} />
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Rows
   --------------------------------------------------------------------------- */

export function PickRow({
  active,
  multi,
  onClick,
  icon,
  children,
}: {
  active?: boolean;
  /** Several can be picked (checkboxes) instead of one (radio). */
  multi?: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role={multi ? "menuitemcheckbox" : "menuitemradio"}
      aria-checked={!!active}
      onClick={onClick}
      className={cn(
        "flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-ink-2 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:h-10",
        active && "text-ink",
      )}
    >
      {icon && <span className="grid size-5 shrink-0 place-items-center">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {multi ? (
        <span className={cn("grid size-4 shrink-0 place-items-center rounded-[5px] border-[1.5px]", active ? "border-blob bg-blob" : "border-line-2")}>
          {active && <Check className="size-3 text-white" strokeWidth={3} />}
        </span>
      ) : (
        active && <Check className="size-3.5 shrink-0 text-blob" strokeWidth={2.5} />
      )}
    </button>
  );
}
