"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Seconds left until `until` (a time on this device's clock), ticking. */
export function useSecondsLeft(until: number | null, every = 250): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [until, every]);
  return until === null ? null : Math.max(0, (until - now) / 1000);
}

/** A ring that empties as the time runs out, with the seconds in the middle. */
export function Countdown({ left, total, size = 88, className }: { left: number; total: number; size?: number; className?: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const share = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const urgent = left <= 5;
  return (
    <div className={cn("relative grid place-items-center", urgent && left > 0 && "quiz-throb", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="var(--raised)" stroke="var(--line)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={urgent ? "#e5484d" : "var(--blob)"} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - share)} style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.3s" }} />
      </svg>
      <span className="relative font-display font-bold tabular-nums text-ink" style={{ fontSize: size * 0.36 }}>
        {Math.ceil(left)}
      </span>
    </div>
  );
}
