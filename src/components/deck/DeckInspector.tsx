"use client";

import { Clock, ImageIcon, Link2, Trash2, Upload } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { GooSpinner } from "@/components/blob/GooSpinner";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Kbd } from "@/components/ui/Kbd";
import { useMessages } from "@/i18n/client";
import { deckText } from "@/i18n/messages/deck";
import type { Deck, DeckTheme, DeckThemeSpec, Slide, SlideBackground, SlideLayout, SlideTransition } from "@/lib/types";
import { cn } from "@/lib/utils";
import { cleanImageUrl, IMAGE_LAYOUTS, LAYOUTS, slidePalette, talkSeconds, type Palette } from "./deck";
import { LayoutGlyph } from "./LayoutGlyph";
import { MotionPanel } from "./MotionPanel";
import { Block, ThemeEditor } from "./ThemeEditor";

export type InspectorTab = "slide" | "theme" | "motion";

const TABS: InspectorTab[] = ["slide", "theme", "motion"];

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
  const t = useMessages(deckText);
  const noteCount = deck.slides.filter((s) => s.notes.trim()).length;

  return (
    <aside className={cn("w-[272px] shrink-0 flex-col border-l border-line bg-surface", className)} aria-label={t.settings}>
      <div className="shrink-0 border-b border-line px-3 py-2">
        <div className="relative grid grid-cols-3 rounded-lg bg-hover/70 p-0.5" role="tablist" aria-label={t.panels}>
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => onTab(id)}
              className={cn("relative z-10 h-7 rounded-md text-[12.5px] transition-colors", tab === id ? "font-medium text-ink" : "text-ink-3 hover:text-ink-2")}
            >
              {tab === id && (
                <motion.span
                  layoutId="deck-inspector-tab"
                  className="absolute inset-0 -z-10 rounded-md bg-raised shadow-card"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                />
              )}
              {t.tabs[id]}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-20" role="tabpanel" aria-label={t.tabs[tab]}>
        {tab === "slide" && (
          <>
            <Block title={t.layout}>
              <div className="grid grid-cols-4 gap-x-1 gap-y-1.5" role="radiogroup" aria-label={t.slideLayout}>
                {LAYOUTS.map((l) => {
                  const active = l.id === slide.layout;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      title={t.layouts[l.id].hint}
                      onClick={() => onLayout(l.id)}
                      className="group rounded-lg p-1 text-center transition-colors hover:bg-hover"
                    >
                      <LayoutGlyph layout={l.id} active={active} className={cn(active ? "ring-2 ring-blob/25" : "group-hover:border-line-2")} />
                      <div className={cn("mt-1 truncate text-[11px]", active ? "font-medium text-ink" : "text-ink-3 group-hover:text-ink-2")}>{t.layouts[l.id].label}</div>
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
                  {t.notes} <span className="font-normal normal-case tracking-normal">{t.notesSlide(index + 1)}</span>
                </span>
              }
            >
              <Textarea
                value={slide.notes}
                onChange={(e) => onChange({ notes: e.target.value })}
                placeholder={t.notesPlaceholder}
                aria-label={t.notes}
                className="min-h-[132px] px-2.5 text-[13px] leading-relaxed"
              />
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-3">
                <Kbd>S</Kbd> {t.notesKbd}
              </p>
            </Block>

            <div className="space-y-2 px-4 py-4 text-[12.5px] text-ink-2">
              <div className="flex items-center gap-2">
                <Clock className="size-3.5 text-ink-3" />
                <span>
                  {t.slideCount(deck.slides.length)} · {t.talkTime(talkSeconds(deck))}
                </span>
              </div>
              <div className="text-[12px] text-ink-3">{noteCount === 0 ? t.noNotes : t.notesOn(noteCount, deck.slides.length)}</div>
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
  const t = useMessages(deckText);
  const custom = slide.background && slide.background.startsWith("#") ? slide.background : null;
  const options: { id: SlideBackground | null; label: string; hint: string }[] = [
    { id: null, label: t.bgTheme, hint: t.bgThemeHint },
    { id: "accent", label: t.bgAccent, hint: t.bgAccentHint },
    { id: "inverse", label: t.bgInverse, hint: t.bgInverseHint },
  ];
  return (
    <Block title={t.background}>
      <div className="flex gap-1.5" role="radiogroup" aria-label={t.slideBackground}>
        {options.map((o) => {
          const p = slidePalette(palette, o.id);
          const active = slide.background === o.id;
          return (
            <button
              key={o.id ?? "theme"}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange({ background: o.id })}
              className="group flex flex-1 flex-col items-center gap-1"
              title={o.hint}
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
        <label className="group flex flex-1 cursor-pointer flex-col items-center gap-1" title={t.bgColourHint}>
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
              aria-label={t.bgCustom}
            />
          </span>
          <span className={cn("text-[11px]", custom ? "font-medium text-ink" : "text-ink-3")}>{t.bgColour}</span>
        </label>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">{t.readable}</p>
    </Block>
  );
}

function FormulaHelp() {
  const t = useMessages(deckText);
  const rows: [string, string][] = [
    ["x^2   x_1", t.formulaRows.powers],
    ["\\frac{a}{b}", t.formulaRows.fraction],
    ["\\sqrt{x}", t.formulaRows.root],
    ["\\pi  \\le  \\pm", t.formulaRows.symbols],
    ['"cm"', t.formulaRows.words],
    ["\\hl{x}", t.formulaRows.highlight],
  ];
  return (
    <Block title={t.formula}>
      <p className="mb-2 text-[12.5px] leading-relaxed text-ink-3">{t.formulaHelp}</p>
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
  const t = useMessages(deckText);
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
    <Block title={t.image}>
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
            <GooSpinner size={36} label={t.uploadingImage} />
          </div>
        )}
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" className="flex-1" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload className="size-3.5" /> {slide.image ? t.replace : t.upload}
        </Button>
        {slide.image && (
          <Button size="sm" variant="ghost" onClick={() => onChange({ image: null })} aria-label={t.removeImage} title={t.removeImage}>
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
          placeholder={t.imagePaste}
          aria-label={t.imageLink}
          aria-invalid={invalid}
          className="h-8 w-full rounded-lg border border-line bg-raised pl-8 pr-2.5 text-[12.5px] text-ink outline-none transition-[border,box-shadow] placeholder:text-ink-3/80 hover:border-line-2 focus:border-blob focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)] aria-[invalid=true]:border-danger"
        />
      </form>
      {invalid ? <p className="mt-1.5 text-[12px] text-danger">{t.notALink}</p> : <p className="mt-1.5 text-[12px] text-ink-3">{t.imageHint}</p>}
    </Block>
  );
}
