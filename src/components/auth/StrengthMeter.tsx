import { motion } from "motion/react";
import type { Strength } from "@/lib/auth/password";
import { cn } from "@/lib/utils";

export function StrengthMeter({ strength, show }: { strength: Strength; show: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 pt-0.5 transition-opacity", show ? "opacity-100" : "opacity-0")} aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-line">
            <motion.div
              className="h-full rounded-full"
              initial={false}
              animate={{
                width: strength.score >= i ? "100%" : "0%",
                backgroundColor: strength.score <= 1 ? "var(--danger)" : strength.score === 2 ? "var(--ink-3)" : "var(--blob)",
              }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          </div>
        ))}
      </div>
      <span className="w-[74px] text-right text-[11.5px] text-ink-3">{strength.label}</span>
    </div>
  );
}
