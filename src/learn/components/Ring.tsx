"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A progress ring that animates to `value` (0..1). */
export function Ring({
  value,
  size = 44,
  stroke = 4,
  from,
  color = "var(--blob)",
  track = "var(--line)",
  children,
  className,
  delay = 0,
}: {
  value: number;
  size?: number;
  stroke?: number;
  /** Start value for the animation (defaults to 0 on mount). */
  from?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  className?: string;
  delay?: number;
}) {
  const r = (size - stroke) / 2;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: from ?? 0 }}
          animate={{ pathLength: v, opacity: v === 0 ? 0 : 1 }}
          transition={{ type: "spring", stiffness: 70, damping: 18, delay }}
        />
      </svg>
      {children && <span className="absolute inset-0 grid place-items-center">{children}</span>}
    </span>
  );
}
