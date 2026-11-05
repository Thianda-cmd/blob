"use client";

import { motion } from "motion/react";
import { useId, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A row of options with a sliding pill under the chosen one.
 *
 * Optional, for page view switches (Liste | Board): an `icon` per option; `kind="tabs"` for a
 * switch between views of a page (tablist/tab instead of radiogroup/radio); `fill` to share a full
 * row; `compact` to show only the icons on phones (the label stays for screen readers and as a
 * tooltip), `compact="md"` also on tablets up to 767 px (beside a long button in a TopBar). Without
 * them it renders exactly as before (the calendar and the spreadsheet use it).
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  size = "md",
  kind = "radio",
  fill = false,
  compact = false,
}: {
  value: T;
  options: { value: T; label: string; title?: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
  kind?: "radio" | "tabs";
  fill?: boolean;
  compact?: boolean | "md";
}) {
  const id = useId();
  const tabs = kind === "tabs";
  const anyOn = options.some((o) => o.value === value);
  // Tabs work like tabs (WAI-ARIA): one Tab stop, the arrows (and Home, End) choose the next one.
  const moveTab = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = options.length;
    const to = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    onChange(options[to].value);
    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]")[to]?.focus();
  };
  return (
    <div
      role={tabs ? "tablist" : "radiogroup"}
      aria-label={label}
      className={cn(fill ? "flex w-full" : "inline-flex", "items-center rounded-lg bg-hover p-0.5", className)}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        const iconOnly = compact && !!o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role={tabs ? "tab" : "radio"}
            {...(tabs ? { "aria-selected": on, tabIndex: on || (!anyOn && i === 0) ? 0 : -1, onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => moveTab(e, i) } : { "aria-checked": on })}
            title={o.title ?? (iconOnly ? o.label : undefined)}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative rounded-md font-medium transition-colors",
              // Fingers get taller segments, like every control on touch screens.
              size === "sm" ? "h-6 px-2 text-[12px] [@media(hover:none)]:h-8" : "h-7 px-2.5 text-[12.5px] [@media(hover:none)]:h-9",
              on ? "text-ink" : "text-ink-2 hover:text-ink",
              fill && "flex-1",
              o.icon && "inline-flex items-center justify-center gap-1.5 [&_svg]:size-3.5",
            )}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-md bg-raised shadow-card"
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
              />
            )}
            {o.icon && (
              <span className="relative" aria-hidden>
                {o.icon}
              </span>
            )}
            <span className={cn("relative", iconOnly && (compact === "md" ? "max-md:sr-only" : "max-sm:sr-only"))}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
