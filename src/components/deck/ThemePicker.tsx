"use client";

import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { Popover } from "@/components/ui/Menu";
import { useMessages } from "@/i18n/client";
import { deckText } from "@/i18n/messages/deck";
import type { DeckTheme, Slide } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PRESETS, presetPalette, type Palette } from "./deck";
import { SlideView } from "./SlideView";

export function ThemeSwatch({ palette, className }: { palette: Palette; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("relative grid size-4 shrink-0 place-items-center rounded-full ring-1 ring-ink/15 dark:ring-white/20", className)}
      style={{ background: palette.bg }}
    >
      <span className="size-1.5 rounded-full" style={{ background: palette.accent }} />
    </span>
  );
}

/** Top-bar theme menu: live previews of the current slide in every preset, plus the deck's custom theme. */
export function ThemePicker({
  theme,
  palette,
  customPalette,
  slide,
  onChange,
  onCustomize,
}: {
  theme: DeckTheme;
  /** The deck's current palette. */
  palette: Palette;
  /** The deck's saved custom theme, if it has one. */
  customPalette: Palette | null;
  slide: Slide;
  onChange: (theme: DeckTheme) => void;
  onCustomize: () => void;
}) {
  const t = useMessages(deckText);
  const options: { id: DeckTheme; label: string; palette: Palette }[] = [
    ...PRESETS.map((p) => ({ id: p.id as DeckTheme, label: t.presetNames[p.id].label, palette: presetPalette(p.id) })),
    ...(customPalette ? [{ id: "custom" as DeckTheme, label: t.custom, palette: customPalette }] : []),
  ];
  const current = theme === "custom" ? t.custom : t.presetNames[theme].label;
  return (
    <Popover
      align="end"
      className="w-[332px] p-2"
      trigger={(props) => (
        <button
          {...props}
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-2 transition-colors hover:bg-hover hover:text-ink aria-expanded:bg-hover aria-expanded:text-ink max-sm:hidden [@media(hover:none)]:h-9"
          title={t.themeTitle(current)}
        >
          <ThemeSwatch palette={palette} />
          <span className="hidden sm:inline">{t.theme}</span>
          <ChevronDown className="size-3.5 text-ink-3" />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-1 pb-2 pt-0.5 text-[12px] font-medium text-ink-3">{t.themeForAll}</div>
          <div className="grid max-h-[min(460px,70vh)] grid-cols-2 gap-1.5 overflow-y-auto pr-0.5">
            {options.map((o) => {
              const active = o.id === theme;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onChange(o.id);
                    close();
                  }}
                  className={cn("group rounded-lg p-1 text-left transition-colors hover:bg-hover", active && "bg-hover/70")}
                >
                  <SlideView
                    slide={slide}
                    palette={o.palette}
                    mode="thumb"
                    width={146}
                    frameClassName={cn("rounded-[5px] ring-1", active ? "ring-2 ring-blob" : "ring-ink/10 dark:ring-white/12")}
                  />
                  <span className="mt-1 flex items-center gap-1 px-0.5 text-[12.5px] text-ink-2 group-hover:text-ink">
                    <span className={cn("truncate", active && "font-medium text-ink")}>{o.label}</span>
                    {active && <Check className="ml-auto size-3.5 shrink-0 text-blob" strokeWidth={2.5} />}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onCustomize();
              close();
            }}
            className="mt-1.5 flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[13px] text-ink-2 transition-colors hover:bg-hover hover:text-ink"
          >
            <SlidersHorizontal className="size-4 text-ink-3" />
            {theme === "custom" ? t.editCustom : t.customizeColours}
          </button>
        </>
      )}
    </Popover>
  );
}
