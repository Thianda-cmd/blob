"use client";

import { Check, ChevronDown } from "lucide-react";
import { Popover } from "@/components/ui/Menu";
import type { DeckTheme, Slide } from "@/lib/types";
import { cn } from "@/lib/utils";
import { THEME_COLORS, THEMES } from "./deck";
import { SlideView } from "./SlideView";

export function ThemeSwatch({ theme, className }: { theme: DeckTheme; className?: string }) {
  const c = THEME_COLORS[theme];
  return (
    <span
      aria-hidden
      className={cn("relative grid size-4 shrink-0 place-items-center rounded-full ring-1 ring-ink/15 dark:ring-white/20", className)}
      style={{ background: c.bg }}
    >
      <span className="size-1.5 rounded-full" style={{ background: c.accent }} />
    </span>
  );
}

/** Top-bar theme menu with live previews of the current slide in each theme. */
export function ThemePicker({ theme, slide, onChange }: { theme: DeckTheme; slide: Slide; onChange: (theme: DeckTheme) => void }) {
  return (
    <Popover
      align="end"
      className="w-[268px] p-1.5"
      trigger={(props) => (
        <button
          {...props}
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-2 transition-colors hover:bg-hover hover:text-ink aria-expanded:bg-hover aria-expanded:text-ink"
          title="Deck theme"
        >
          <ThemeSwatch theme={theme} />
          <span className="hidden sm:inline">Theme</span>
          <ChevronDown className="size-3.5 text-ink-3" />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-2 pb-1.5 pt-1 text-[12px] font-medium text-ink-3">Theme for every slide</div>
          {THEMES.map((t) => {
            const active = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(t.id);
                  close();
                }}
                className={cn("flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-hover", active && "bg-hover/70")}
              >
                <SlideView
                  slide={slide}
                  theme={t.id}
                  mode="thumb"
                  width={92}
                  frameClassName={cn("rounded-[5px] ring-1", active ? "ring-2 ring-blob" : "ring-ink/10 dark:ring-white/12")}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-ink">{t.label}</span>
                  <span className="block text-[12px] text-ink-3">{t.hint}</span>
                </span>
                {active && <Check className="mr-1 size-4 shrink-0 text-blob" strokeWidth={2.5} />}
              </button>
            );
          })}
        </>
      )}
    </Popover>
  );
}
