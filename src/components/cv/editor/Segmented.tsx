"use client";

import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = { id: T; label: ReactNode; title?: string; disabled?: boolean };

/**
 * A row of options with a sliding pill, like the presentation inspector's tabs. "tabs" switches
 * views (role tablist), "radio" picks a value (role radiogroup).
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  kind = "radio",
  size = "sm",
  className,
  disabled,
  equal = true,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  label: string;
  kind?: "radio" | "tabs";
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
  /** Every option as wide as the widest (false: as wide as its label). */
  equal?: boolean;
}) {
  const pill = useId();
  return (
    <div
      role={kind === "tabs" ? "tablist" : "radiogroup"}
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn("relative grid grid-flow-col rounded-lg bg-hover/70 p-0.5", equal ? "auto-cols-fr" : "auto-cols-auto", disabled && "pointer-events-none opacity-50", className)}
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role={kind === "tabs" ? "tab" : "radio"}
            aria-selected={kind === "tabs" ? active : undefined}
            aria-checked={kind === "radio" ? active : undefined}
            title={o.title}
            disabled={o.disabled || disabled}
            onClick={() => onChange(o.id)}
            className={cn(
              "relative z-10 flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 transition-colors disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0",
              size === "sm" ? "h-7 text-[12.5px]" : "h-9 text-[14px]",
              active ? "font-medium text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {active && (
              <motion.span
                layoutId={pill}
                className="absolute inset-0 -z-10 rounded-md bg-raised shadow-card dark:bg-white/12 dark:ring-1 dark:ring-white/10"
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
              />
            )}
            <span className="flex min-w-0 items-center gap-1.5 truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
