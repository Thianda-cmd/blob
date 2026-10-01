"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import type { Theme } from "@/lib/types";
import { cn } from "@/lib/utils";

// Fixed palettes so each preview shows its own theme no matter which one is active.
const PALETTES = {
  light: { paper: "#f4f3ee", surface: "#fdfcfa", line: "#e3e1d9", ink: "#1c1b18", muted: "#d6d3c9", soft: "#ffeadf" },
  dark: { paper: "#141413", surface: "#1e1e1c", line: "#302f2b", ink: "#edebe4", muted: "#3c3b36", soft: "#3a2014" },
};

const OPTIONS: { value: Theme; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", hint: "Paper white", icon: Sun },
  { value: "dark", label: "Dark", hint: "Easy at night", icon: Moon },
  { value: "system", label: "System", hint: "Match your device", icon: Monitor },
];

/** A tiny Blob workspace: sidebar, a note and the helper in the corner. */
function Mockup({ palette }: { palette: (typeof PALETTES)["light"] }) {
  const p = palette;
  return (
    <div className="absolute inset-0 flex gap-[6%] p-[6%]" style={{ background: p.paper }}>
      <div className="flex w-[26%] flex-col gap-[9%] pt-[4%]">
        <div className="flex items-center gap-[10%]">
          <span className="aspect-square w-[22%] rounded-full" style={{ background: "#ff6a2b" }} />
          <span className="h-[5px] w-[50%] rounded-full" style={{ background: p.ink, opacity: 0.75 }} />
        </div>
        {[78, 60, 70, 52].map((w, i) => (
          <span key={i} className="h-[4px] rounded-full" style={{ width: `${w}%`, background: p.muted }} />
        ))}
      </div>
      <div className="relative flex-1 rounded-[6px] border p-[8%]" style={{ background: p.surface, borderColor: p.line }}>
        <span className="block h-[7px] w-[58%] rounded-full" style={{ background: p.ink, opacity: 0.85 }} />
        <div className="mt-[10%] space-y-[6%]">
          {[92, 80, 86].map((w, i) => (
            <span key={i} className="block h-[4px] rounded-full" style={{ width: `${w}%`, background: p.muted }} />
          ))}
          <span className="block h-[4px] w-[64%] rounded-full" style={{ background: p.soft }} />
        </div>
        <span
          className="absolute bottom-[10%] right-[8%] aspect-[1/0.85] w-[16%] rounded-[50%_50%_46%_46%]"
          style={{ background: "#ff6a2b", boxShadow: "inset -2px -2px 0 rgb(0 0 0 / 0.12)" }}
        />
      </div>
    </div>
  );
}

export function ThemePreview({ theme }: { theme: Theme }) {
  if (theme !== "system") return <Mockup palette={PALETTES[theme]} />;
  return (
    <>
      <Mockup palette={PALETTES.light} />
      <div className="absolute inset-0" style={{ clipPath: "polygon(58% 0, 100% 0, 100% 100%, 42% 100%)" }}>
        <Mockup palette={PALETTES.dark} />
      </div>
    </>
  );
}

/** Light / Dark / System as mini app previews. */
export function ThemePicker({
  value,
  onChange,
  size = "md",
  className,
}: {
  value: Theme;
  onChange: (theme: Theme) => void;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("grid grid-cols-3 gap-3", size === "lg" && "gap-3.5", className)}>
      {OPTIONS.map(({ value: option, label, hint, icon: Icon }) => {
        const selected = value === option;
        return (
          <motion.button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            data-enter="submit"
            onClick={() => onChange(option)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 26 }}
            className={cn(
              "group relative rounded-xl border bg-raised p-1.5 text-left transition-[border-color,box-shadow] duration-200",
              selected
                ? "border-blob shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)]"
                : "border-line hover:border-line-2",
            )}
          >
            <div className={cn("relative aspect-[16/10] overflow-hidden rounded-lg border border-line")}>
              <ThemePreview theme={option} />
            </div>
            <div className={cn("flex items-center gap-2 px-1.5", size === "lg" ? "pb-1 pt-2.5" : "pb-0.5 pt-2")}>
              <Icon className={cn("hidden size-3.5 shrink-0 min-[400px]:block", selected ? "text-blob-ink" : "text-ink-3")} />
              <div className="min-w-0 flex-1">
                <div className={cn("truncate font-medium leading-tight text-ink", size === "lg" ? "text-[14px]" : "text-[13px]")}>{label}</div>
                {size === "lg" && <div className="truncate text-[12px] leading-tight text-ink-3">{hint}</div>}
              </div>
              <span
                className={cn(
                  "hidden size-[18px] shrink-0 place-items-center rounded-full border transition-colors sm:grid",
                  selected ? "border-blob bg-blob" : "border-line-2",
                )}
              >
                <AnimatePresence initial={false}>
                  {selected && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 700, damping: 20 }}
                    >
                      <Check className="size-3 text-white" strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
