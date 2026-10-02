"use client";

import { AlertTriangle, Check, ChevronDown, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Popover } from "@/components/ui/Menu";
import { useLocale, useMessages } from "@/i18n/client";
import { formatNumber } from "@/i18n/format";
import { deckText } from "@/i18n/messages/deck";
import type { DeckBackdrop, DeckFont, DeckPreset, DeckTheme, DeckThemeSpec, Slide } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  BACKDROPS,
  cleanHex,
  contrast,
  ensureContrast,
  FONT_IDS,
  FONTS,
  PRESETS,
  presetPalette,
  miniBackdrop,
  presetSpec,
  readableOn,
  specPalette,
} from "./deck";
import { deckFontVars } from "./fonts";
import { SlideView } from "./SlideView";

/** Theme tab: preset gallery and the custom theme editor. Every change shows live on the canvas. */
export function ThemeEditor({
  theme,
  custom,
  slide,
  onTheme,
  onCustom,
}: {
  theme: DeckTheme;
  custom: DeckThemeSpec | null;
  slide: Slide;
  onTheme: (theme: DeckTheme) => void;
  /** Saves the custom theme and switches the deck to it. */
  onCustom: (spec: DeckThemeSpec) => void;
}) {
  const t = useMessages(deckText);
  const editing = theme === "custom" && custom;
  const base: DeckPreset = theme === "custom" ? "paper" : theme;
  const baseName = t.presetNames[base].label;

  const presets = (
    <>
      <Block title={t.presets}>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={t.theme}>
          {PRESETS.map((p) => {
            const active = p.id === theme;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                title={t.presetNames[p.id].hint}
                onClick={() => onTheme(p.id)}
                className="group rounded-lg p-1 text-left transition-colors hover:bg-hover"
              >
                <SlideView
                  slide={slide}
                  palette={presetPalette(p.id)}
                  mode="thumb"
                  width={108}
                  frameClassName={cn("rounded-[5px] ring-1", active ? "ring-2 ring-blob" : "ring-ink/10 dark:ring-white/12")}
                />
                <span className={cn("mt-1 block truncate px-0.5 text-[12px]", active ? "font-medium text-ink" : "text-ink-2 group-hover:text-ink")}>{t.presetNames[p.id].label}</span>
              </button>
            );
          })}
          {custom && (
            <button
              type="button"
              role="radio"
              aria-checked={theme === "custom"}
              onClick={() => onTheme("custom")}
              className="group rounded-lg p-1 text-left transition-colors hover:bg-hover"
            >
              <SlideView
                slide={slide}
                palette={specPalette(custom)}
                mode="thumb"
                width={108}
                frameClassName={cn("rounded-[5px] ring-1", theme === "custom" ? "ring-2 ring-blob" : "ring-ink/10 dark:ring-white/12")}
              />
              <span className={cn("mt-1 block truncate px-0.5 text-[12px]", theme === "custom" ? "font-medium text-ink" : "text-ink-2 group-hover:text-ink")}>{t.custom}</span>
            </button>
          )}
        </div>
      </Block>

    </>
  );

  return (
    <>
      {!editing && presets}
      {editing ? (
        <>
          <CustomEditor spec={custom} onChange={onCustom} />
          {presets}
        </>
      ) : (
        <Block title={t.customTheme}>
          <p className="mb-2.5 text-[12.5px] leading-relaxed text-ink-3">{t.customIntro(baseName)}</p>
          <Button size="sm" className="w-full" onClick={() => onCustom(presetSpec(base))}>
            {t.customize(baseName)}
          </Button>
          {custom && (
            <button type="button" onClick={() => onTheme("custom")} className="mt-2 w-full text-center text-[12px] text-ink-3 hover:text-ink">
              {t.useSaved}
            </button>
          )}
        </Block>
      )}
    </>
  );
}

function CustomEditor({ spec, onChange }: { spec: DeckThemeSpec; onChange: (spec: DeckThemeSpec) => void }) {
  const t = useMessages(deckText);
  const set = (patch: Partial<DeckThemeSpec>) => onChange({ ...spec, ...patch });

  // Contrast-safe: a background change that makes the text unreadable flips the text to ink or white.
  const setBg = (bg: string) => {
    const patch: Partial<DeckThemeSpec> = { bg };
    if (contrast(spec.text, bg) < 3) patch.text = readableOn(bg) === "#ffffff" ? "#f6f4ee" : "#1c1b18";
    if (contrast(spec.title, bg) < 3) patch.title = readableOn(bg);
    if (contrast(spec.accent, bg) < 1.6) patch.accent = ensureContrast(spec.accent, bg, 3);
    set(patch);
  };

  return (
    <>
      <Block
        title={t.customTheme}
        action={
          <Popover
            align="end"
            className="w-[200px] p-1"
            trigger={(props) => (
              <button {...props} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-normal normal-case tracking-normal text-ink-3 hover:bg-hover hover:text-ink">
                <RotateCcw className="size-3" /> {t.startFrom}
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-2 pb-1 pt-1 text-[11.5px] text-ink-3">{t.replaceWithPreset}</div>
                {PRESETS.map((p) => {
                  const pal = presetPalette(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onChange(presetSpec(p.id));
                        close();
                      }}
                      className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-ink-2 hover:bg-hover hover:text-ink"
                    >
                      <span className="grid size-4 place-items-center rounded-full ring-1 ring-ink/15" style={{ background: pal.bg }}>
                        <span className="size-1.5 rounded-full" style={{ background: pal.accent }} />
                      </span>
                      {t.presetNames[p.id].label}
                    </button>
                  );
                })}
              </>
            )}
          </Popover>
        }
      >
        <div className="mb-1.5 text-[12px] text-ink-3">{t.background}</div>
        <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label={t.backgroundStyle}>
          {BACKDROPS.map((id) => (
            <BackdropTile key={id} id={id} label={t.backdrops[id]} spec={spec} active={spec.backdrop === id} onClick={() => set({ backdrop: id })} />
          ))}
        </div>

        <div className="mt-3 space-y-0.5">
          <ColorRow label={t.background} value={spec.bg} onChange={setBg} />
          {(spec.backdrop === "gradient" || spec.backdrop === "glow") && <ColorRow label={t.blendInto} value={spec.bg2} onChange={(bg2) => set({ bg2 })} />}
          <ColorRow label={t.text} value={spec.text} onChange={(text) => set({ text })} check={{ against: spec.bg, min: 4.5, fix: () => set({ text: ensureContrast(spec.text, spec.bg, 4.5) }) }} />
          <ColorRow label={t.headings} value={spec.title} onChange={(title) => set({ title })} check={{ against: spec.bg, min: 3, fix: () => set({ title: ensureContrast(spec.title, spec.bg, 4.5) }) }} />
          <ColorRow label={t.accent} value={spec.accent} onChange={(accent) => set({ accent })} check={{ against: spec.bg, min: 3, fix: () => set({ accent: ensureContrast(spec.accent, spec.bg, 3) }) }} />
        </div>
      </Block>

      <Block title={t.fonts}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5">
          <FontRow label={t.headings} value={spec.headingFont} onChange={(headingFont) => set({ headingFont })} />
          <FontRow label={t.body} value={spec.bodyFont} onChange={(bodyFont) => set({ bodyFont })} />
        </div>
      </Block>
    </>
  );
}

export function Block({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-3.5">
      <div className="mb-2.5 flex h-4 items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function BackdropTile({ id, label, spec, active, onClick }: { id: DeckBackdrop; label: string; spec: DeckThemeSpec; active: boolean; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={active} title={label} onClick={onClick} className="group flex flex-col items-center gap-1">
      <span
        className={cn("block aspect-[4/3] w-full overflow-hidden rounded-md ring-1 transition-shadow", active ? "ring-2 ring-blob" : "ring-ink/12 group-hover:ring-ink/25 dark:ring-white/15")}
        style={{ backgroundColor: spec.bg, ...miniBackdrop({ ...spec, backdrop: id }) }}
      />
      <span className={cn("text-[10.5px]", active ? "font-medium text-ink" : "text-ink-3")}>{label}</span>
    </button>
  );
}

function ColorRow({
  label,
  value,
  onChange,
  check,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  check?: { against: string; min: number; fix: () => void };
}) {
  const t = useMessages(deckText);
  const locale = useLocale();
  const [draft, setDraft] = useState<string | null>(null);
  const ratio = check ? contrast(value, check.against) : 0;
  const low = check && ratio < check.min;
  const shown = formatNumber(Math.round(ratio * 10) / 10, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <div className="flex h-8 items-center gap-2">
      <label className="relative size-6 shrink-0 cursor-pointer overflow-hidden rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]" style={{ background: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={t.colourOf(label)} />
      </label>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{label}</span>
      {check &&
        (low ? (
          <button
            type="button"
            onClick={check.fix}
            className="flex h-5 items-center gap-1 rounded-md bg-danger/10 px-1.5 text-[11px] font-medium text-danger hover:bg-danger/15"
            title={t.contrastLow(shown)}
          >
            <AlertTriangle className="size-3" /> {t.fix}
          </button>
        ) : (
          <span className="flex items-center gap-0.5 text-[11px] tabular-nums text-ink-3" title={t.contrast(shown)}>
            <Check className="size-3 text-ok" strokeWidth={2.5} />
            {shown}
          </span>
        ))}
      <input
        value={draft ?? value.toUpperCase()}
        onChange={(e) => {
          setDraft(e.target.value);
          const hex = cleanHex(e.target.value);
          if (hex && e.target.value.replace("#", "").length === 6) onChange(hex);
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        spellCheck={false}
        aria-label={t.hexOf(label)}
        className="h-7 w-[74px] rounded-md border border-line bg-raised px-1.5 font-mono text-[11.5px] text-ink-2 outline-none transition-colors hover:border-line-2 focus:border-blob"
      />
    </div>
  );
}

/** One row of the fonts grid (the parent is a two-column grid, so labels of any length line up). */
function FontRow({ label, value, onChange }: { label: string; value: DeckFont; onChange: (font: DeckFont) => void }) {
  const t = useMessages(deckText);
  const f = FONTS[value];
  return (
    <div className="contents">
      <span className="min-w-[62px] text-[12.5px] text-ink-2">{label}</span>
      <Popover
        align="end"
        className={cn("max-h-[360px] w-[244px] overflow-y-auto p-1", deckFontVars)}
        trigger={(props) => (
          <button
            {...props}
            aria-label={t.fontOf(label, f.label)}
            className={cn(
              "flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-line bg-raised px-2.5 text-left text-[13.5px] text-ink transition-colors hover:border-line-2 aria-expanded:border-blob",
              deckFontVars,
            )}
          >
            <span className="min-w-0 flex-1 truncate" style={{ fontFamily: f.family }}>
              {f.label}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-ink-3" />
          </button>
        )}
      >
        {(close) =>
          FONT_IDS.map((id) => {
            const font = FONTS[id];
            const active = id === value;
            return (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(id);
                  close();
                }}
                className={cn("flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left hover:bg-hover", active && "bg-hover")}
              >
                <span className="min-w-0 flex-1 truncate text-[15px] text-ink" style={{ fontFamily: font.family, fontWeight: font.weights[1] }}>
                  {font.label}
                </span>
                <span className="shrink-0 text-[11px] text-ink-3">{t.fontKinds[font.kind]}</span>
                {active && <Check className="size-3.5 text-blob" strokeWidth={2.5} />}
              </button>
            );
          })
        }
      </Popover>
    </div>
  );
}
