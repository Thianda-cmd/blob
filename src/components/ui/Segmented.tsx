"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils";

/** A row of options with a sliding pill under the chosen one. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex items-center rounded-lg bg-hover p-0.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative rounded-md font-medium transition-colors",
              size === "sm" ? "h-6 px-2 text-[12px]" : "h-7 px-2.5 text-[12.5px] [@media(hover:none)]:h-8",
              on ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-md bg-raised shadow-card"
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
