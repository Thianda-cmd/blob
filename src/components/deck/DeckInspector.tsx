"use client";

import { Clock, ImageIcon, Link2, Trash2, Upload } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { GooSpinner } from "@/components/blob/GooSpinner";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Kbd } from "@/components/ui/Kbd";
import type { Deck, DeckTheme, DeckThemeSpec, Slide, SlideBackground, SlideLayout, SlideTransition } from "@/lib/types";
import { cn } from "@/lib/utils";
import { cleanImageUrl, formatTalkTime, IMAGE_LAYOUTS, LAYOUTS, slidePalette, talkSeconds, type Palette } from "./deck";
import { LayoutGlyph } from "./LayoutGlyph";
import { MotionPanel } from "./MotionPanel";
import { Block, ThemeEditor } from "./ThemeEditor";

export type InspectorTab = "slide" | "theme" | "motion";

const TABS: { id: InspectorTab; label: string }[] = [
  { id: "slide", label: "Slide" },
  { id: "theme", label: "Theme" },
  { id: "motion", label: "Motion" },
];

/** Right-hand panel: the slide (layout, image, background, notes), the deck theme, and motion. */
export function DeckInspector({
  className,
  tab,
  onTab,
  deck,
  palette,
  sections,
  slide,
  index,
  uploading,
  onLayout,
  onChange,
  onUpload,
  onTheme,
  onCustom,
  onDeckTransition,
}: {
  className?: string;
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  deck: Deck;
  palette: Palette;
  sections: Map<string, number>;
  slide: Slide;
  index: number;
  uploading: boolean;
  onLayout: (layout: SlideLayout) => void;
  onChange: (patch: Partial<Slide>) => void;
  onUpload: (file: File) => void;
  onTheme: (theme: DeckTheme) => void;
  onCustom: (spec: DeckThemeSpec) => void;
  onDeckTransition: (t: SlideTransition, everywhere: boolean) => void;
}) {
  const noteCount = deck.slides.filter((s) => s.notes.trim()).length;

  return (
    <aside className={cn("w-[272px] shrink-0 flex-col border-l border-line bg-surface", className)} aria-label="Slide settings">
      <div className="shrink-0 border-b border-line px-3 py-2">
        <div className="relative grid grid-cols-3 rounded-lg bg-hover/70 p-0.5" role="tablist" aria-label="Panels">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => onTab(t.id)}
              className={cn("relative z-10 h-7 rounded-md text-[12.5px] transition-colors", tab === t.id ? "font-medium text-ink" : "text-ink-3 hover:text-ink-2")}
            >
              {tab === t.id && (
                <motion.span
                  layoutId="deck-inspector-tab"
                  className="absolute inset-0 -z-10 rounded-md bg-raised shadow-card"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                />
              )}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-20" role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
        {tab === "slide" && (
          <>
            <Block title="Layout">
              <div className="grid grid-cols-4 gap-x-1 gap-y-1.5" role="radiogroup" aria-label="Slide layout">
                {LAYOUTS.map((l) => {
                  const active = l.id === slide.layout;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      title={l.hint}
                      onClick={() => onLayout(l.id)}
                      className="group rounded-lg p-1 text-center transition-colors hover:bg-hover"
                    >
                      <LayoutGlyph layout={l.id} active={active} className={cn(active ? "ring-2 ring-blob/25" : "group-hover:border-line-2")} />
                      <div className={cn("mt-1 truncate text-[11px]", active ? "font-medium text-ink" : "text-ink-3 group-hover:text-ink-2")}>{l.label}</div>
                    </button>
                  );
                })}
              </div>
            </Block>

            {IMAGE_LAYOUTS.has(slide.layout) && <ImageSection key={slide.id} slide={slide} uploading={uploading} onChange={onChange} onUpload={onUpload} />}

            {slide.layout === "formula" && <FormulaHelp />}

            <BackgroundSection slide={slide} palette={palette} onChange={onChange} />

            <Block
              title={
                <span className="flex items-center justify-between gap-2">
                  Speaker notes <span className="font-normal normal-case tracking-normal">Slide {index + 1}</span>
                </span>
              }
            >
              <Textarea
                value={slide.notes}
                onChange={(e) => onChange({ notes: e.target.value })}
                placeholder="What do you want to say on this slide?"
                aria-label="Speaker notes"
                className="min-h-[132px] px-2.5 text-[13px] leading-relaxed"
              />
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-3">
                <Kbd>S</Kbd> shows them in the speaker view
              </p>
            </Block>

            <div className="space-y-2 px-4 py-4 text-[12.5px] text-ink-2">
              <div className="flex items-center gap-2">
                <Clock className="size-3.5 text-ink-3" />
                <span>
                  {deck.slides.length} {deck.slides.length === 1 ? "slide" : "slides"} · {formatTalkTime(talkSeconds(deck))}
                </span>
              </div>
              <div className="text-[12px] text-ink-3">{noteCount === 0 ? "No speaker notes yet." : `Notes on ${noteCount} of ${deck.slides.length} slides.`}</div>
            </div>
          </>
        )}

        {tab === "theme" && <ThemeEditor theme={deck.theme} custom={deck.custom} slide={slide} onTheme={onTheme} onCustom={onCustom} />}

        {tab === "motion" && (
          <MotionPanel deck={deck} slide={slide} index={index} palette={palette} sections={sections} onSlide={onChange} onDeckTransition={onDeckTransition} />
        )}
      </div>
    </aside>
  );
}

function BackgroundSection({ slide, palette, onChange }: { slide: Slide; palette: Palette; onChange: (patch: Partial<Slide>) => void }) {
  const custom = slide.background && slide.background.startsWith("#") ? slide.background : null;
  const options: { id: SlideBackground | null; label: string }[] = [
    { id: null, label: "Theme" },
    { id: "accent", label: "Accent" },
    { id: "inverse", label: "Inverse" },
  ];
  return (
    <Block title="Background">
      <div className="flex gap-1.5" role="radiogroup" aria-label="Slide background">
        {options.map((o) => {
          const p = slidePalette(palette, o.id);
          const active = slide.background === o.id;
          return (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange({ background: o.id })}
              className="group flex flex-1 flex-col items-center gap-1"
              title={o.id === null ? "Follow the deck theme" : o.id === "accent" ? "The accent colour, for emphasis" : "Swap background and text"}
            >
              <span
                className={cn("grid h-8 w-full place-items-center rounded-md ring-1 transition-shadow", active ? "ring-2 ring-blob" : "ring-ink/12 group-hover:ring-ink/25 dark:ring-white/15")}
                style={{ backgroundColor: p.bg }}
              >
                <span className="h-[3px] w-4 rounded-full" style={{ background: p.accent }} />
              </span>
              <span className={cn("text-[11px]", active ? "font-medium text-ink" : "text-ink-3")}>{o.label}</span>
            </button>
          );
        })}
        <label className="group flex flex-1 cursor-pointer flex-col items-center gap-1" title="Pick any colour">
          <span
            className={cn(
              "relative grid h-8 w-full place-items-center overflow-hidden rounded-md ring-1 transition-shadow",
              custom ? "ring-2 ring-blob" : "ring-ink/12 group-hover:ring-ink/25 dark:ring-white/15",
            )}
            style={{ background: custom ?? "conic-gradient(from 90deg, #f2b8b8, #f5e3a3, #b9e3c2, #b4d3f5, #d6c2f7, #f2b8b8)" }}
          >
            <input
              type="color"
              value={custom ?? palette.bg}
              onChange={(e) => onChange({ background: e.target.value as SlideBackground })}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              aria-label="Custom background colour"
            />
          </span>
          <span className={cn("text-[11px]", custom ? "font-medium text-ink" : "text-ink-3")}>Colour</span>
        </label>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">Text colours adjust to stay readable.</p>
    </Block>
  );
}

function FormulaHelp() {
  const rows: [string, string][] = [
    ["x^2   x_1", "powers, subscripts"],
    ["\\frac{a}{b}", "fraction"],
    ["\\sqrt{x}", "square root"],
    ["\\pi  \\le  \\pm", "symbols"],
    ['"cm"', "plain words"],
    ["\\hl{x}", "highlight"],
  ];
  return (
    <Block title="Formula">
      <p className="mb-2 text-[12.5px] leading-relaxed text-ink-3">Type maths in the box under the formula. One line per step: a build reveals them one by one.</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
        {rows.map(([code, what]) => (
          <div key={code} className="contents">
            <dt className="font-mono text-ink">{code}</dt>
            <dd className="text-ink-3">{what}</dd>
          </div>
        ))}
      </dl>
    </Block>
  );
}

function ImageSection({
  slide,
  uploading,
  onChange,
  onUpload,
}: {
  slide: Slide;
  uploading: boolean;
  onChange: (patch: Partial<Slide>) => void;
  onUpload: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [invalid, setInvalid] = useState(false);

  const applyLink = () => {
    const url = cleanImageUrl(link);
    if (!url) return setInvalid(Boolean(link.trim()));
    onChange({ image: url });
    setLink("");
  };

  return (
    <Block title="Image">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onUpload(file);
        }}
      />
      <div className="relative mb-2.5 grid aspect-video place-items-center overflow-hidden rounded-lg border border-line bg-paper">
        {slide.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- user images from any host
          <img src={slide.image} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <ImageIcon className="size-5 text-ink-3" strokeWidth={1.6} />
        )}
        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-surface/80">
            <GooSpinner size={36} label="Uploading image" />
          </div>
        )}
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" className="flex-1" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload className="size-3.5" /> {slide.image ? "Replace" : "Upload"}
        </Button>
        {slide.image && (
          <Button size="sm" variant="ghost" onClick={() => onChange({ image: null })} aria-label="Remove image" title="Remove image">
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
      <form
        className="relative mt-2"
        onSubmit={(e) => {
          e.preventDefault();
          applyLink();
        }}
      >
        <Link2 className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
        <input
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setInvalid(false);
          }}
          onBlur={() => link.trim() && applyLink()}
          placeholder="Or paste an image link"
          aria-label="Image link"
          aria-invalid={invalid}
          className="h-8 w-full rounded-lg border border-line bg-raised pl-8 pr-2.5 text-[12.5px] text-ink outline-none transition-[border,box-shadow] placeholder:text-ink-3/80 hover:border-line-2 focus:border-blob focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)] aria-[invalid=true]:border-danger"
        />
      </form>
      {invalid ? <p className="mt-1.5 text-[12px] text-danger">That doesn&apos;t look like a link.</p> : <p className="mt-1.5 text-[12px] text-ink-3">PNG, JPG, GIF or WebP, up to 10 MB.</p>}
    </Block>
  );
}
