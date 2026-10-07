import { LEVELS, type Level } from "@/learn/types";
import { cn } from "@/lib/utils";

/** Three little bars, filled up to the level: one for beginner, three for expert. */
export function LevelBars({ level, className }: { level: Level; className?: string }) {
  return (
    <span className={cn("flex items-end gap-[2px]", className)} aria-hidden>
      {LEVELS.map((l) => (
        <span key={l} className={cn("w-[3px] rounded-full", l <= level ? "bg-current" : "bg-current opacity-25")} style={{ height: 4 + l * 3 }} />
      ))}
    </span>
  );
}
