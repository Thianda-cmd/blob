"use client";

import { ImageIcon, ImageOff, Link2, Plus, Trash2, Upload, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  createContext,
  Fragment,
  memo,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { GooSpinner } from "@/components/blob/GooSpinner";
import { MathView } from "@/learn/components/MathView";
import type { Slide, SlideItem, SlideLayout } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  bodyLines,
  cleanImageUrl,
  ensureContrast,
  filledItems,
  FONTS,
  ITEM_LAYOUTS,
  mathLines,
  slideItems,
  slidePalette,
  SLIDE_H,
  SLIDE_W,
  type Palette,
} from "./deck";
import { deckFontVars } from "./fonts";
import { buildVariants } from "./motion";

/**
 * One renderer for every place a slide appears: rail thumbnails, the editor canvas
 * (editable), previews and the presenter. Slides are laid out on a fixed 1280×720 design
 * canvas and scaled with a CSS transform so typography is identical at every size.
 *
 * Blocks carry `data-morph` ids so the morph transition can match them between slides.
 */

export type SlideMode = "edit" | "thumb" | "present";

type SlideViewProps = {
  slide: Slide;
  /** The deck palette (the slide's own background override is applied here). */
  palette: Palette;
  mode?: SlideMode;
  /** Rendered width in px. When omitted the slide fits (contain) inside its parent box. */
  width?: number;
  /** Build: how many items are revealed. Omit to show everything. */
  reveal?: number;
  /** Section number for section slides. */
  ordinal?: number;
  onChange?: (patch: Partial<Slide>) => void;
  onUpload?: (file: File) => void;
  uploading?: boolean;
  className?: string;
  frameClassName?: string;
  /** Receives the 1280×720 canvas element once it is laid out (used by the morph transition). */
  canvasRef?: Ref<HTMLDivElement>;
};

const ScaleCtx = createContext(1);

type FieldCtx = {
  mode: SlideMode;
  slide: Slide;
  palette: Palette;
  reveal?: number;
  ordinal?: number;
  onChange?: (patch: Partial<Slide>) => void;
  onUpload?: (file: File) => void;
  uploading?: boolean;
};
const SlideCtx = createContext<FieldCtx | null>(null);
const useSlide = () => useContext(SlideCtx)!;

const PLACEHOLDERS: Record<SlideLayout, { title: string; body: string }> = {
  title: { title: "Presentation title", body: "Subtitle, or your name" },
  section: { title: "Section title", body: "What this part is about" },
  agenda: { title: "Agenda", body: "Add a topic" },
  bullets: { title: "Slide title", body: "Add a point" },
  split: { title: "Slide title", body: "Write a few sentences here, or add an image instead." },
  media: { title: "Slide title", body: "Describe the picture, or make your point next to it." },
  quote: { title: "A quote worth remembering", body: "Who said it" },
  image: { title: "Caption", body: "Add a little more detail (optional)" },
  cover: { title: "A title over your image", body: "A line of context (optional)" },
  columns: { title: "Slide title", body: "" },
  compare: { title: "Compare two things", body: "" },
  steps: { title: "How it works", body: "" },
  timeline: { title: "Timeline", body: "" },
  stats: { title: "By the numbers", body: "" },
  big: { title: "42", body: "What the number means" },
  formula: { title: "Formula title", body: "What each symbol means (optional)" },
  closing: { title: "Thank you", body: "Questions? Add your name or email" },
};

const ITEM_PLACEHOLDERS: Partial<Record<SlideLayout, { head: string[]; text: string[] }>> = {
  columns: { head: ["First idea", "Second idea", "Third idea"], text: ["Explain it in a sentence or two."] },
  compare: { head: ["Pros", "Cons"], text: ["A point in favour", "A point against"] },
  steps: { head: ["Research", "Plan", "Make", "Test", "Share"], text: ["What happens in this step"] },
  timeline: { head: ["1914", "1918", "1939", "1945", "1969", "1989"], text: ["What happened"] },
  stats: { head: ["42%", "3×", "120", "#1"], text: ["of students agree", "faster than before", "pages of notes", "in the region"] },
};

const MATH_PLACEHOLDER = "x = \\frac{-b +- \\sqrt{b^2 - 4ac}}{2a}";

function itemPlaceholder(layout: SlideLayout, i: number, field: keyof SlideItem) {
  const list = ITEM_PLACEHOLDERS[layout]?.[field] ?? [""];
  return list[i % list.length];
}

function canvasVars(p: Palette): CSSProperties {
  const h = FONTS[p.heading];
  const b = FONTS[p.body];
  return {
    "--s-bg": p.bg,
    "--s-title": p.title,
    "--s-fg": p.fg,
    "--s-fg2": p.fg2,
    "--s-fg3": p.fg3,
    "--s-accent": p.accent,
    "--s-on-accent": p.onAccent,
    "--s-line": p.line,
    "--s-panel": p.panel,
    "--s-hfont": h.family,
    "--s-bfont": b.family,
    "--s-hw-m": h.weights[0],
    "--s-hw": h.weights[1],
    "--s-hw-b": h.weights[2],
    "--s-ht": h.track,
  } as CSSProperties;
}

export const SlideView = memo(function SlideView({
  slide,
  palette,
  mode = "present",
  width,
  reveal,
  ordinal,
  onChange,
  onUpload,
  uploading,
  className,
  frameClassName,
  canvasRef,
}: SlideViewProps) {
  const outer = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    if (width || !outer.current) return;
    // The first observation is delivered before the next paint, so there is no flash.
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(outer.current);
    return () => ro.disconnect();
  }, [width]);

  const fit = width ? width / SLIDE_W : box ? Math.min(box.w / SLIDE_W, box.h / SLIDE_H) : 0;
  // Whole-pixel frame, and a canvas scaled to cover it, so no hairline of background peeks out at the edges.
  const frameW = Math.round(SLIDE_W * fit);
  const frameH = Math.round(SLIDE_H * fit);
  const scale = fit ? Math.max(frameW / SLIDE_W, frameH / SLIDE_H) : 0;
  const c = slidePalette(palette, slide.background);

  const frame = (
    <div className={cn("relative shrink-0 overflow-hidden", deckFontVars, frameClassName)} style={{ width: frameW, height: frameH, background: c.bg }}>
      {scale > 0 && (
        <div
          ref={canvasRef}
          data-slide-canvas
          className="group/canvas absolute left-0 top-0 origin-top-left antialiased lining-nums [font-family:var(--s-bfont)]"
          style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})`, color: c.fg, ...canvasVars(c) }}
        >
          <div
            data-slide-bg
            className="absolute inset-0"
            style={{ backgroundColor: c.bg, backgroundImage: c.backdrop ?? undefined, backgroundSize: c.backdropSize ?? undefined }}
          />
          <ScaleCtx.Provider value={scale}>
            <SlideCtx.Provider value={{ mode, slide, palette: c, reveal, ordinal, onChange, onUpload, uploading }}>
              {mode === "edit" ? (
                // Keyed per slide so local UI state resets, with a quick crossfade when you switch.
                <motion.div key={slide.id} className="relative size-full" initial={{ opacity: 0.35 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                  <SlideLayoutView layout={slide.layout} />
                </motion.div>
              ) : (
                <div className="relative size-full">
                  <SlideLayoutView layout={slide.layout} />
                </div>
              )}
            </SlideCtx.Provider>
          </ScaleCtx.Provider>
        </div>
      )}
    </div>
  );

  if (width) return className ? <div className={className}>{frame}</div> : frame;
  return (
    <div ref={outer} className={cn("relative grid size-full place-items-center", className)}>
      {box && frame}
    </div>
  );
});

// Layouts ---------------------------------------------------------------------

const RULE = "rounded-full bg-[var(--s-accent)]";
/** Heading type: the theme's heading font and weight (HF without a colour). */
const HF = "[font-family:var(--s-hfont)] [font-weight:var(--s-hw)]";
const H = `${HF} text-[var(--s-title)]`;

function Rule({ className }: { className: string }) {
  return <div data-morph="rule" data-morph-box className={cn(RULE, "shrink-0", className)} />;
}

const cols = (n: number): CSSProperties => ({ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` });

function SlideLayoutView({ layout }: { layout: SlideLayout }) {
  const { slide, mode, palette, ordinal, onChange } = useSlide();
  const hasImage = Boolean(slide.image);
  const empty = (t: string) => mode === "present" && !t.trim();

  switch (layout) {
    case "title":
      return (
        <div className="flex h-full flex-col justify-center px-[112px] pb-[24px]">
          <Rule className="mb-[44px] h-[8px] w-[80px]" />
          <Text field="title" className={cn(H, "text-[88px] leading-[1.03] tracking-[calc(-0.035em*var(--s-ht))]")} />
          <Text field="body" className="mt-[30px] text-[32px] leading-[1.35] text-[var(--s-fg2)]" />
        </div>
      );

    case "section": {
      const n = String(ordinal ?? 1).padStart(2, "0");
      return (
        <div className="relative flex h-full flex-col justify-center overflow-hidden px-[112px] pb-[24px]">
          <span
            aria-hidden
            data-morph="numeral"
            className="pointer-events-none absolute -bottom-[72px] right-[64px] select-none text-[400px] leading-none lining-nums tracking-[calc(-0.05em*var(--s-ht))] text-[var(--s-line)] [font-family:var(--s-hfont)] [font-weight:var(--s-hw-b)]"
          >
            {n}
          </span>
          <div className="relative max-w-[920px]">
            <Rule className="mb-[40px] h-[8px] w-[80px]" />
            <Text field="title" className={cn(H, "text-[96px] leading-[1.02] tracking-[calc(-0.04em*var(--s-ht))]")} />
            <Text field="body" className="mt-[28px] text-[30px] leading-[1.4] text-[var(--s-fg2)]" />
          </div>
        </div>
      );
    }

    case "agenda": {
      const count = Math.max(1, bodyLines(slide.body).length);
      const size = count <= 4 ? 34 : count <= 6 ? 30 : 26;
      const twoCols = count > 5;
      return (
        <div className="flex h-full flex-col px-[104px] pb-[56px] pt-[84px]">
          <Rule className="mb-[30px] h-[6px] w-[56px]" />
          <Text field="title" className={cn(H, "text-[58px] leading-[1.08] tracking-[calc(-0.03em*var(--s-ht))]")} />
          <LineList
            value={slide.body}
            onValue={(body) => onChange?.({ body })}
            morph="list"
            placeholder={PLACEHOLDERS.agenda.body}
            label="Agenda item"
            fontSize={size}
            build
            className="mt-[48px]"
            listClassName={cn(twoCols ? "grid grid-cols-2 gap-x-[72px]" : "flex flex-col")}
            rowClassName="flex items-baseline gap-[28px] border-t-[2px] border-[var(--s-line)] py-[0.5em]"
            textClassName="leading-[1.3] text-[var(--s-fg)]"
            marker={(i) => (
              <span className="w-[1.6em] shrink-0 tabular-nums lining-nums text-[var(--s-accent)] [font-family:var(--s-hfont)] [font-weight:var(--s-hw)]">
                {String(i + 1).padStart(2, "0")}
              </span>
            )}
          />
        </div>
      );
    }

    case "bullets": {
      const count = bodyLines(slide.body).length;
      const size = count <= 5 ? 34 : count <= 7 ? 29 : 25;
      return (
        <div className="flex h-full flex-col px-[104px] pb-[64px] pt-[84px]">
          <Rule className="mb-[30px] h-[6px] w-[56px]" />
          <Text field="title" className={cn(H, "text-[58px] leading-[1.08] tracking-[calc(-0.03em*var(--s-ht))]")} />
          <LineList
            value={slide.body}
            onValue={(body) => onChange?.({ body })}
            morph="list"
            placeholder={PLACEHOLDERS.bullets.body}
            label="Bullet"
            fontSize={size}
            build
            className="mt-[44px]"
            listClassName={cn("flex flex-col", size >= 34 ? "gap-[20px]" : "gap-[14px]")}
            rowClassName="flex gap-[26px]"
            textClassName="leading-[1.4] text-[var(--s-fg)]"
            marker={() => <span className="mt-[0.5em] size-[12px] shrink-0 rounded-full bg-[var(--s-accent)]" />}
          />
        </div>
      );
    }

    case "split":
      return hasImage ? (
        <div className="grid h-full grid-cols-2">
          <div className="flex min-w-0 flex-col justify-center pl-[96px] pr-[64px]">
            <Rule className="mb-[30px] h-[6px] w-[56px]" />
            <Text field="title" className={cn(H, "text-[54px] leading-[1.08] tracking-[calc(-0.03em*var(--s-ht))]")} />
            <Text field="body" className="mt-[26px] text-[26px] leading-[1.5] text-[var(--s-fg2)]" />
          </div>
          <ImageSlot className="h-full" />
        </div>
      ) : (
        <div className="grid h-full grid-cols-[1fr_1.1fr] gap-[80px] px-[104px]">
          <div className="flex min-w-0 flex-col justify-center">
            <Rule className="mb-[30px] h-[6px] w-[56px]" />
            <Text field="title" className={cn(H, "text-[58px] leading-[1.08] tracking-[calc(-0.03em*var(--s-ht))]")} />
          </div>
          <div className="flex min-w-0 flex-col justify-center border-l-[3px] border-[var(--s-line)] pl-[56px]">
            <Text field="body" className="text-[28px] leading-[1.5] text-[var(--s-fg2)]" />
          </div>
          {mode === "edit" && <AddImageChip />}
        </div>
      );

    case "media":
      return (
        <div className="grid h-full grid-cols-2">
          <ImageSlot className="h-full" />
          <div className="flex min-w-0 flex-col justify-center pl-[72px] pr-[96px]">
            <Rule className="mb-[30px] h-[6px] w-[56px]" />
            <Text field="title" className={cn(H, "text-[54px] leading-[1.08] tracking-[calc(-0.03em*var(--s-ht))]")} />
            <Text field="body" className="mt-[26px] text-[26px] leading-[1.5] text-[var(--s-fg2)]" />
          </div>
        </div>
      );

    case "quote":
      return (
        <div className="flex h-full flex-col justify-center px-[136px] pb-[16px]">
          <svg data-morph="mark" viewBox="0 0 22 16" className="mb-[40px] h-[64px] w-auto shrink-0 self-start fill-[var(--s-accent)]" aria-hidden>
            <path d="M0 16V9.5C0 4.6 2.6 1.4 7.6 0L8.6 2.2C6.2 3.2 5 4.9 4.9 7H9v9zM13 16V9.5c0-4.9 2.6-8.1 7.6-9.5l1 2.2c-2.4 1-3.6 2.7-3.7 4.8H22v9z" />
          </svg>
          <Text
            field="title"
            className="text-[60px] leading-[1.16] tracking-[calc(-0.025em*var(--s-ht))] text-[var(--s-title)] [font-family:var(--s-hfont)] [font-weight:var(--s-hw-m)]"
          />
          {!empty(slide.body) && (
            <div className="mt-[44px] flex items-center gap-[22px]">
              <div className={cn(RULE, "h-[4px] w-[48px] shrink-0")} />
              <div className="min-w-0 flex-1">
                <Text field="body" className="text-[26px] font-medium leading-[1.35] text-[var(--s-fg2)]" />
              </div>
            </div>
          )}
        </div>
      );

    case "image":
      return (
        <div className="flex h-full flex-col p-[56px] pb-[48px]">
          <ImageSlot className="min-h-0 flex-1 rounded-[22px]" />
          {!(empty(slide.title) && empty(slide.body)) && (
            <div className="mt-[30px] shrink-0">
              <Text field="title" className={cn(H, "text-[34px] leading-[1.15] tracking-[calc(-0.02em*var(--s-ht))]")} />
              <Text field="body" className="mt-[14px] text-[22px] leading-[1.4] text-[var(--s-fg2)]" />
            </div>
          )}
        </div>
      );

    case "cover": {
      // Over a photo the text is always white on a soft scrim.
      const overlay = hasImage
        ? ({
            "--s-title": "#ffffff",
            "--s-fg": "#ffffff",
            "--s-fg2": "rgb(255 255 255 / 0.84)",
            "--s-fg3": "rgb(255 255 255 / 0.6)",
            "--s-accent": ensureContrast(palette.accent, "#141414", 3),
          } as CSSProperties)
        : undefined;
      return (
        <div className="relative h-full">
          <div className="absolute inset-0">
            <ImageSlot className="size-full" />
          </div>
          {hasImage && (
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgb(0_0_0/0.74)_0%,rgb(0_0_0/0.38)_36%,transparent_68%)]" />
          )}
          <div className="absolute inset-x-0 bottom-0 px-[88px] pb-[76px]" style={overlay}>
            <Rule className="mb-[28px] h-[6px] w-[56px]" />
            <Text field="title" className={cn(H, "max-w-[1000px] text-[72px] leading-[1.04] tracking-[calc(-0.035em*var(--s-ht))]")} />
            <Text field="body" className="mt-[20px] max-w-[900px] text-[28px] leading-[1.4] text-[var(--s-fg2)]" />
          </div>
        </div>
      );
    }

    case "columns":
      return (
        <div className="flex h-full flex-col px-[104px] pb-[64px] pt-[84px]">
          <Rule className="mb-[30px] h-[6px] w-[56px]" />
          <Text field="title" className={cn(H, "text-[52px] leading-[1.08] tracking-[calc(-0.03em*var(--s-ht))]")} />
          <Items className="mt-[60px] grid grid-rows-[auto_auto] gap-x-[64px]">
            {(i, { field, tools }) => (
              <Reveal i={i} className="group/item relative row-span-2 grid grid-rows-subgrid border-t-[3px] border-[var(--s-line)] pt-[30px]">
                <span className="absolute -top-[3px] left-0 h-[3px] w-[56px] bg-[var(--s-accent)]" />
                {tools}
                {field("head", cn(H, "text-[32px] leading-[1.15] tracking-[calc(-0.02em*var(--s-ht))]"))}
                {field("text", "mt-[16px] text-[24px] leading-[1.5] text-[var(--s-fg2)]")}
              </Reveal>
            )}
          </Items>
        </div>
      );

    case "compare":
      return (
        <div className="flex h-full flex-col px-[96px] pb-[64px] pt-[76px]">
          <Rule className="mb-[28px] h-[6px] w-[56px]" />
          <Text field="title" className={cn(H, "text-[52px] leading-[1.08] tracking-[calc(-0.03em*var(--s-ht))]")} />
          <Items className="mt-[44px] grid min-h-0 flex-1 gap-[32px]">
            {(i, { field, list, tools }) => (
              <Reveal i={i} className="group/item relative flex min-h-0 flex-col overflow-hidden rounded-[28px] bg-[var(--s-panel)] px-[48px] pb-[40px] pt-[44px]">
                {i === 0 && <span className="absolute inset-x-0 top-0 h-[6px] bg-[var(--s-accent)]" />}
                {tools}
                {field("head", cn(HF, "text-[36px] leading-[1.15] tracking-[calc(-0.02em*var(--s-ht))]", i === 0 ? "text-[var(--s-accent)]" : "text-[var(--s-title)]"))}
                {list("mt-[24px]", (
                  <span className={cn("mt-[0.55em] size-[10px] shrink-0 rounded-full", i === 0 ? "bg-[var(--s-accent)]" : "bg-[var(--s-fg3)]")} />
                ))}
              </Reveal>
            )}
          </Items>
        </div>
      );

    case "steps":
      return (
        <div className="flex h-full flex-col px-[96px] pb-[72px] pt-[84px]">
          <Rule className="mb-[30px] h-[6px] w-[56px]" />
          <Text field="title" className={cn(H, "text-[52px] leading-[1.08] tracking-[calc(-0.03em*var(--s-ht))]")} />
          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <Items className="grid grid-rows-[auto_auto_auto] gap-x-[28px]">
              {(i, { field, tools, count }) => (
                <Reveal i={i} className="group/item relative row-span-3 grid grid-rows-subgrid">
                  {tools}
                  <div className="flex items-center gap-[20px]">
                    <span className="grid size-[64px] shrink-0 place-items-center rounded-full bg-[var(--s-accent)] text-[28px] tabular-nums lining-nums text-[var(--s-on-accent)] [font-family:var(--s-hfont)] [font-weight:var(--s-hw)]">
                      {i + 1}
                    </span>
                    {i < count - 1 && <span className="h-[3px] min-w-0 flex-1 rounded-full bg-[var(--s-line)]" />}
                  </div>
                  {field("head", cn(H, "mt-[28px] pr-[12px] text-[30px] leading-[1.15] tracking-[calc(-0.02em*var(--s-ht))]"))}
                  {field("text", "mt-[12px] pr-[12px] text-[22px] leading-[1.45] text-[var(--s-fg2)]")}
                </Reveal>
              )}
            </Items>
          </div>
        </div>
      );

    case "timeline":
      return (
        <div className="flex h-full flex-col px-[96px] pb-[72px] pt-[84px]">
          <Rule className="mb-[30px] h-[6px] w-[56px]" />
          <Text field="title" className={cn(H, "text-[52px] leading-[1.08] tracking-[calc(-0.03em*var(--s-ht))]")} />
          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <Items className="grid grid-rows-[auto_auto_auto]">
              {(i, { field, tools, count }) => (
                <Reveal i={i} className="group/item relative row-span-3 grid grid-rows-subgrid">
                  {tools}
                  {field("head", cn(HF, "pr-[28px] text-[34px] leading-[1.1] tabular-nums lining-nums tracking-[calc(-0.02em*var(--s-ht))] text-[var(--s-accent)]"))}
                  <div className="relative my-[24px] h-[24px]">
                    <span className={cn("absolute top-1/2 h-[3px] -translate-y-1/2 bg-[var(--s-line)]", i === 0 ? "left-[12px]" : "left-0", i === count - 1 ? "right-[28px]" : "right-0")} />
                    <span className="absolute left-0 top-1/2 size-[24px] -translate-y-1/2 rounded-full border-[5px] border-[var(--s-accent)] bg-[var(--s-bg)]" />
                  </div>
                  {field("text", "pr-[28px] text-[22px] leading-[1.45] text-[var(--s-fg2)]")}
                </Reveal>
              )}
            </Items>
          </div>
        </div>
      );

    case "stats": {
      const n = Math.max(1, (mode === "present" ? filledItems(slide) : slideItems(slide)).length);
      const size = n <= 2 ? 140 : n === 3 ? 116 : 92;
      const showTitle = !empty(slide.title);
      return (
        <div className="flex h-full flex-col px-[96px] pb-[80px] pt-[84px]">
          {showTitle && (
            <>
              <Rule className="mb-[30px] h-[6px] w-[56px]" />
              <Text field="title" className={cn(H, "text-[48px] leading-[1.08] tracking-[calc(-0.03em*var(--s-ht))]")} />
            </>
          )}
          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <Items className="grid grid-rows-[auto_auto] gap-x-[56px]">
              {(i, { field, tools }) => (
                <Reveal i={i} className={cn("group/item relative row-span-2 grid grid-rows-subgrid", i > 0 && "border-l-[3px] border-[var(--s-line)] pl-[48px]")}>
                  {tools}
                  {field(
                    "head",
                    "leading-[0.98] lining-nums tracking-[calc(-0.045em*var(--s-ht))] text-[var(--s-accent)] [font-family:var(--s-hfont)] [font-weight:var(--s-hw-b)]",
                    { fontSize: size },
                  )}
                  {field("text", "mt-[20px] text-[26px] leading-[1.4] text-[var(--s-fg2)]")}
                </Reveal>
              )}
            </Items>
          </div>
        </div>
      );
    }

    case "big": {
      const len = (slide.title.trim() || PLACEHOLDERS.big.title).length;
      const size = len <= 4 ? 260 : len <= 7 ? 200 : len <= 12 ? 136 : 96;
      return (
        <div className="flex h-full flex-col items-center justify-center px-[96px] pb-[16px] text-center">
          <Text
            field="title"
            className="w-full text-center leading-[0.95] tracking-[calc(-0.05em*var(--s-ht))] text-[var(--s-accent)] [font-family:var(--s-hfont)] [font-weight:var(--s-hw-b)]"
            style={{ fontSize: size }}
          />
          <div className="mt-[36px] w-full max-w-[900px]">
            <Text field="body" className="text-center text-[36px] leading-[1.3] text-[var(--s-fg2)]" />
          </div>
        </div>
      );
    }

    case "formula": {
      const n = Math.max(1, mathLines(slide.math).length);
      const size = Math.round((n <= 2 ? 72 : n === 3 ? 60 : n <= 5 ? 48 : 40) * (mode === "edit" ? 0.8 : 1));
      return (
        <div className="flex h-full flex-col px-[104px] pb-[56px] pt-[80px]">
          <Rule className="mb-[28px] h-[6px] w-[56px]" />
          <Text field="title" className={cn(H, "text-[46px] leading-[1.1] tracking-[calc(-0.03em*var(--s-ht))]")} />
          <Formula size={size} />
          <div className="mx-auto w-full max-w-[940px] shrink-0">
            <Text field="body" className="text-center text-[24px] leading-[1.45] text-[var(--s-fg2)]" />
          </div>
        </div>
      );
    }

    case "closing":
      return (
        <div className="flex h-full flex-col items-center justify-center px-[120px] pb-[24px] text-center">
          <Rule className="mb-[44px] h-[8px] w-[80px]" />
          <Text field="title" className={cn(H, "w-full text-center text-[104px] leading-[1.02] tracking-[calc(-0.04em*var(--s-ht))]")} />
          <div className="mt-[30px] w-full max-w-[920px]">
            <Text field="body" className="text-center text-[32px] leading-[1.4] text-[var(--s-fg2)]" />
          </div>
        </div>
      );
  }
}

// Builds ----------------------------------------------------------------------

/** One build step. Hidden until the presenter reveals it; a plain block everywhere else. */
function Reveal({ i, className, style, children, li, enabled = true }: { i: number; className?: string; style?: CSSProperties; children: ReactNode; li?: boolean; enabled?: boolean }) {
  const { reveal, slide } = useSlide();
  const reduce = useReducedMotion();
  if (!enabled || reveal === undefined || slide.build === "none") {
    return li ? (
      <li className={className} style={style}>
        {children}
      </li>
    ) : (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  const Tag = li ? motion.li : motion.div;
  return (
    <Tag className={className} style={style} variants={buildVariants(reduce ? "fade" : slide.build)} initial={false} animate={i < reveal ? "shown" : "hidden"}>
      {children}
    </Tag>
  );
}

// Text fields -----------------------------------------------------------------

/** Wrapper that shows a soft outline on hover and focus while editing. */
function EditBox({ children, className }: { children: ReactNode; className?: string }) {
  const { mode } = useSlide();
  return (
    <div
      className={cn(
        "w-full",
        mode === "edit" &&
          "rounded-[10px] outline-offset-[12px] hover:outline-[3px] hover:outline-dashed hover:outline-[color-mix(in_oklab,var(--s-fg)_16%,transparent)] focus-within:outline-[3px]! focus-within:outline-solid! focus-within:outline-[color-mix(in_oklab,var(--s-accent)_55%,transparent)]!",
        className,
      )}
    >
      {children}
    </div>
  );
}

const enterJumps = (e: KeyboardEvent<HTMLTextAreaElement>) => {
  // Enter in a heading jumps to the next field; Shift+Enter keeps a line break.
  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
    e.preventDefault();
    focusNextField(e.currentTarget);
  }
};

/** A text block: a textarea while editing, plain text elsewhere (or a faint placeholder in thumbnails). */
function Field({
  value,
  placeholder,
  onValue,
  label,
  className,
  style,
  morph,
  heading,
}: {
  value: string;
  placeholder: string;
  onValue: (value: string) => void;
  label: string;
  className: string;
  style?: CSSProperties;
  morph?: string;
  heading?: boolean;
}) {
  const { mode } = useSlide();
  if (mode !== "edit") {
    if (!value.trim()) {
      if (mode === "present" || !placeholder) return null;
      return (
        <div data-morph={morph} className={cn(className, "whitespace-pre-wrap break-words opacity-35")} style={style}>
          {placeholder}
        </div>
      );
    }
    return (
      <div data-morph={morph} className={cn(className, "whitespace-pre-wrap break-words")} style={style}>
        {value}
      </div>
    );
  }
  return (
    <EditBox>
      <AutoTextarea
        value={value}
        onValue={onValue}
        placeholder={placeholder}
        aria-label={label}
        className={className}
        style={style}
        onKeyDown={heading ? enterJumps : undefined}
      />
    </EditBox>
  );
}

function Text({ field, className, style }: { field: "title" | "body"; className: string; style?: CSSProperties }) {
  const { slide, onChange } = useSlide();
  return (
    <Field
      value={slide[field]}
      placeholder={PLACEHOLDERS[slide.layout][field]}
      onValue={(v) => onChange?.({ [field]: v })}
      label={field === "title" ? "Slide title" : "Slide text"}
      className={className}
      style={style}
      morph={field}
      heading={field === "title"}
    />
  );
}

function focusNextField(from: HTMLTextAreaElement) {
  const canvas = from.closest("[data-slide-canvas]");
  if (!canvas) return;
  const fields = [...canvas.querySelectorAll("textarea")];
  const next = fields[fields.indexOf(from) + 1];
  if (next) {
    next.focus();
    next.setSelectionRange(next.value.length, next.value.length);
  }
}

function fitHeight(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = `${el.scrollHeight}px`;
}

function AutoTextarea({
  value,
  onValue,
  className,
  style,
  inputRef,
  ...props
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onValue: (value: string) => void;
  inputRef?: (el: HTMLTextAreaElement | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fontSize = style?.fontSize;

  useLayoutEffect(() => {
    fitHeight(ref.current);
  }, [value, fontSize]);

  useEffect(() => {
    // Web fonts change line metrics once they load.
    let alive = true;
    document.fonts?.ready.then(() => alive && fitHeight(ref.current));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        inputRef?.(el);
      }}
      rows={1}
      value={value}
      onChange={(e) => onValue(e.target.value)}
      className={cn(
        className,
        "block w-full resize-none overflow-hidden border-0 bg-transparent p-0 caret-[var(--s-accent)] outline-none placeholder:text-[var(--s-fg3)] placeholder:opacity-60",
      )}
      style={style}
      {...props}
    />
  );
}

// Lists -----------------------------------------------------------------------

const stripMarker = (line: string) => line.replace(/^\s*(?:[-*•‣◦]|\d+[.)])\s+/, "");

/**
 * A list with one line per item (bullets, agenda, compare). While editing, every line is its
 * own textarea: Enter splits, Backspace joins, arrows move, and pasted lists become lines.
 */
function LineList({
  value,
  onValue,
  placeholder,
  label,
  fontSize,
  marker,
  build,
  morph,
  className,
  listClassName,
  rowClassName,
  textClassName,
}: {
  value: string;
  onValue: (value: string) => void;
  placeholder: string;
  label: string;
  fontSize: number;
  marker: (i: number) => ReactNode;
  build?: boolean;
  morph?: string;
  className?: string;
  listClassName?: string;
  rowClassName?: string;
  textClassName?: string;
}) {
  const { mode } = useSlide();
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const pending = useRef<{ i: number; caret: number } | null>(null);

  // Apply focus requested by the last edit (after the new lines rendered).
  useLayoutEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    const el = refs.current[p.i];
    if (!el) return;
    el.focus();
    el.setSelectionRange(p.caret, p.caret);
  });

  if (mode !== "edit") {
    const lines = bodyLines(value);
    if (!lines.length) {
      if (mode === "present") return null;
      return (
        <ul data-morph={morph} className={cn(className, listClassName, "opacity-35")} style={{ fontSize }}>
          <li className={rowClassName}>
            {marker(0)}
            <span className={textClassName}>{placeholder}</span>
          </li>
        </ul>
      );
    }
    return (
      <ul data-morph={morph} className={cn(className, listClassName)} style={{ fontSize }}>
        {lines.map((line, i) => (
          <Reveal key={i} i={i} li enabled={build} className={rowClassName}>
            {marker(i)}
            <span className={cn(textClassName, "min-w-0 flex-1 whitespace-pre-wrap break-words")}>{line}</span>
          </Reveal>
        ))}
      </ul>
    );
  }

  const lines = value.split("\n");
  const commit = (next: string[], focus?: { i: number; caret: number }) => {
    if (focus) pending.current = focus;
    onValue(next.join("\n"));
  };

  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: end, value: v } = el;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit([...lines.slice(0, i), v.slice(0, s), v.slice(end), ...lines.slice(i + 1)], { i: i + 1, caret: 0 });
    } else if (e.key === "Backspace" && s === 0 && end === 0 && i > 0) {
      e.preventDefault();
      const prev = lines[i - 1];
      commit([...lines.slice(0, i - 1), prev + v, ...lines.slice(i + 1)], { i: i - 1, caret: prev.length });
    } else if (e.key === "Delete" && s === v.length && end === v.length && i < lines.length - 1) {
      e.preventDefault();
      commit([...lines.slice(0, i), v + lines[i + 1], ...lines.slice(i + 2)], { i, caret: v.length });
    } else if (e.key === "ArrowUp" && s === 0 && end === 0 && i > 0) {
      e.preventDefault();
      const prev = refs.current[i - 1];
      prev?.focus();
      prev?.setSelectionRange(prev.value.length, prev.value.length);
    } else if (e.key === "ArrowDown" && s === v.length && i < lines.length - 1) {
      e.preventDefault();
      const next = refs.current[i + 1];
      next?.focus();
      next?.setSelectionRange(0, 0);
    }
  };

  const onPaste = (i: number) => (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text/plain");
    if (!pasted.includes("\n")) return;
    e.preventDefault();
    const parts = pasted.replace(/\r\n?/g, "\n").split("\n").map(stripMarker);
    const el = e.currentTarget;
    const before = el.value.slice(0, el.selectionStart);
    const after = el.value.slice(el.selectionEnd);
    const last = parts[parts.length - 1];
    const inserted = parts.length === 1 ? [before + parts[0] + after] : [before + parts[0], ...parts.slice(1, -1), last + after];
    commit([...lines.slice(0, i), ...inserted, ...lines.slice(i + 1)], { i: i + inserted.length - 1, caret: last.length + (parts.length === 1 ? before.length : 0) });
  };

  return (
    <EditBox className={className}>
      <ul className={listClassName} style={{ fontSize }}>
        {lines.map((line, i) => (
          <li key={i} className={rowClassName}>
            {marker(i)}
            <div className="min-w-0 flex-1">
              <AutoTextarea
                inputRef={(el) => {
                  refs.current[i] = el;
                }}
                value={line}
                onValue={(v) => {
                  if (!v.includes("\n")) return commit(lines.map((l, j) => (j === i ? v : l)));
                  const parts = v.split("\n");
                  commit([...lines.slice(0, i), ...parts, ...lines.slice(i + 1)], { i: i + parts.length - 1, caret: parts[parts.length - 1].length });
                }}
                onKeyDown={onKeyDown(i)}
                onPaste={onPaste(i)}
                placeholder={lines.length === 1 ? placeholder : ""}
                aria-label={`${label} ${i + 1}`}
                className={textClassName}
                style={{ fontSize }}
              />
            </div>
          </li>
        ))}
      </ul>
    </EditBox>
  );
}

// Items -----------------------------------------------------------------------

type ItemApi = {
  /** Heading or text of this card. */
  field: (field: keyof SlideItem, className: string, style?: CSSProperties) => ReactNode;
  /** The card's text as a list, one point per line (compare). */
  list: (className: string, marker: ReactNode) => ReactNode;
  /** Remove control while editing (place it inside the card). */
  tools: ReactNode;
  count: number;
};

/**
 * Cards for columns, compare, steps, timeline and stats. The render prop gets a field
 * renderer (heading or text) and a list renderer (one line per point, used by compare).
 */
function Items({
  className,
  children,
}: {
  className: string;
  children: (i: number, api: ItemApi) => ReactNode;
}) {
  const { mode, slide, onChange } = useSlide();
  const spec = ITEM_LAYOUTS[slide.layout]!;
  const all = slideItems(slide);
  const shown = mode === "present" ? filledItems(slide) : all;
  if (!shown.length) return null;

  const set = (i: number, patch: Partial<SlideItem>) => onChange?.({ items: all.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const editing = mode === "edit";

  return (
    <div data-morph="items" className={cn("relative", className)} style={cols(shown.length)}>
      {shown.map((item, i) => {
        const field: ItemApi["field"] = (name, cls, style) => (
          <Field
            value={item[name]}
            placeholder={itemPlaceholder(slide.layout, i, name)}
            onValue={(v) => set(i, { [name]: v })}
            label={`${spec.noun[0].toUpperCase()}${spec.noun.slice(1)} ${i + 1} ${name === "head" ? "heading" : "text"}`}
            className={cls}
            style={style}
            heading={name === "head"}
          />
        );
        const list: ItemApi["list"] = (cls, marker) => (
          <LineList
            value={item.text}
            onValue={(v) => set(i, { text: v })}
            placeholder={itemPlaceholder(slide.layout, i, "text")}
            label={`Point on side ${i + 1}`}
            fontSize={bodyLines(item.text).length > 5 ? 22 : 26}
            className={cls}
            listClassName="flex flex-col gap-[14px]"
            rowClassName="flex gap-[18px]"
            textClassName="leading-[1.4] text-[var(--s-fg)]"
            marker={() => marker}
          />
        );
        const tools =
          editing && all.length > spec.min ? (
            <RemoveItem noun={spec.noun} onRemove={() => onChange?.({ items: all.filter((_, j) => j !== i) })} />
          ) : null;
        return <Fragment key={i}>{children(i, { field, list, tools, count: shown.length })}</Fragment>;
      })}
      {editing && all.length < spec.max && <AddItemChip noun={spec.noun} onAdd={() => onChange?.({ items: [...all, { head: "", text: "" }] })} />}
    </div>
  );
}

/** Hover control that removes a card while editing. Cards are `group/item relative`. */
function RemoveItem({ noun, onRemove }: { noun: string; onRemove: () => void }) {
  return (
    <Ui origin="top right" className="absolute right-[4px] top-[4px] z-10 opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-within/item:opacity-100">
      <button type="button" className={cn(uiButton, "w-7 justify-center px-0 hover:text-danger")} onClick={onRemove} aria-label={`Remove this ${noun}`} title={`Remove this ${noun}`}>
        <X />
      </button>
    </Ui>
  );
}

function AddItemChip({ noun, onAdd }: { noun: string; onAdd: () => void }) {
  return (
    <Ui
      origin="top right"
      className="absolute -bottom-[44px] right-0 opacity-0 transition-opacity group-hover/canvas:opacity-100 has-[button:focus-visible]:opacity-100"
    >
      <button type="button" className={uiButton} onClick={onAdd}>
        <Plus /> Add {noun}
      </button>
    </Ui>
  );
}

// Formula ---------------------------------------------------------------------

function Formula({ size }: { size: number }) {
  const { mode, slide, onChange } = useSlide();
  const lines = mathLines(slide.math);
  const shown = lines.length ? lines : mode === "present" ? [] : [MATH_PLACEHOLDER];
  return (
    <div
      data-morph="math"
      className="flex min-h-0 flex-1 flex-col items-center justify-center-safe gap-[0.32em] py-[28px] text-[var(--s-title)]"
      style={{ fontSize: size, "--blob": "var(--s-accent)", "--blob-ink": "var(--s-accent)" } as CSSProperties}
    >
      {shown.map((src, i) => (
        <Reveal key={`${i}:${src}`} i={i} enabled={lines.length > 0} className={cn("max-w-full", !lines.length && "opacity-35")}>
          <MathView src={src} animate={false} className="text-[1em]!" />
        </Reveal>
      ))}
      {mode === "edit" && (
        <EditBox className="mt-[0.3em] max-w-[880px]">
          <AutoTextarea
            value={slide.math}
            onValue={(math) => onChange?.({ math })}
            placeholder={`${MATH_PLACEHOLDER}   (one line per step)`}
            aria-label="Formula source"
            spellCheck={false}
            className="rounded-[14px] border-[2px] border-[var(--s-line)] bg-[var(--s-panel)] px-[22px] py-[12px] text-center font-mono text-[20px] leading-[1.55] text-[var(--s-fg2)]"
          />
        </EditBox>
      )}
    </div>
  );
}

// Images ----------------------------------------------------------------------

/** App-sized controls inside the scaled canvas: undo the slide scale so buttons stay crisp and clickable. */
function Ui({ children, className, origin = "center" }: { children: ReactNode; className?: string; origin?: string }) {
  const scale = useContext(ScaleCtx);
  return (
    <div className={className} style={{ transform: `scale(${1 / scale})`, transformOrigin: origin }}>
      {children}
    </div>
  );
}

const uiButton =
  "inline-flex h-7 items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 text-[12.5px] font-medium text-ink shadow-card transition-colors hover:bg-hover [&_svg]:size-3.5";

function imageFromDrop(e: DragEvent): File | string | null {
  const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
  if (file) return file;
  const uri = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
  return cleanImageUrl(uri.split("\n")[0] ?? "");
}

function ImageSlot({ className }: { className?: string }) {
  const { mode, slide, onChange, onUpload, uploading } = useSlide();
  const [failed, setFailed] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [linking, setLinking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const src = slide.image;
  const broken = src !== null && failed === src;
  const editing = mode === "edit";

  const accept = (value: File | string | null) => {
    if (!value) return;
    if (typeof value === "string") onChange?.({ image: value });
    else onUpload?.(value);
  };

  const handlers = editing
    ? {
        onDragOver: (e: DragEvent) => {
          e.preventDefault();
          setOver(true);
        },
        onDragLeave: () => setOver(false),
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          setOver(false);
          accept(imageFromDrop(e));
        },
        onPaste: (e: ClipboardEvent) => {
          const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
          if (file) {
            e.preventDefault();
            return accept(file);
          }
          const url = cleanImageUrl(e.clipboardData.getData("text/plain"));
          if (url && !(e.target instanceof HTMLInputElement)) {
            e.preventDefault();
            accept(url);
          }
        },
      }
    : {};

  return (
    <div
      {...handlers}
      data-morph="image"
      data-morph-box
      tabIndex={editing ? 0 : undefined}
      aria-label={editing ? "Slide image. Drop or paste an image here." : undefined}
      style={{ outline: "none" }}
      className={cn(
        "group/img relative overflow-hidden outline-none",
        !src && "bg-[var(--s-panel)]",
        editing && !src && "border-[3px] border-dashed border-[color-mix(in_oklab,var(--s-fg)_18%,transparent)]",
        editing && "focus-visible:ring-[4px] focus-visible:ring-[var(--s-accent)]",
        over && "ring-[6px] ring-[var(--s-accent)]",
        className,
      )}
    >
      {src && !broken && (
        // eslint-disable-next-line @next/next/no-img-element -- user images from any host
        <img src={src} alt={slide.title || ""} draggable={false} onError={() => setFailed(src)} className="absolute inset-0 size-full object-cover" />
      )}

      {(!src || broken) && !editing && (
        <div className="absolute inset-0 grid place-items-center text-[var(--s-fg3)]">
          {broken ? <ImageOff className="size-[72px] opacity-60" strokeWidth={1.4} /> : <ImageIcon className="size-[72px] opacity-50" strokeWidth={1.4} />}
        </div>
      )}

      {editing && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) accept(file);
            }}
          />
          {!src || broken ? (
            <div className="absolute inset-0 grid place-items-center">
              <Ui className="flex flex-col items-center gap-2.5 text-center">
                <div className={cn("grid size-10 place-items-center rounded-full", broken ? "bg-danger/10 text-danger" : "bg-blob-soft text-blob-ink")}>
                  {broken ? <ImageOff className="size-5" /> : <ImageIcon className="size-5" />}
                </div>
                <p className="text-[13px] font-medium text-[var(--s-fg)]">{broken ? "That image didn't load" : "Drop, paste or upload an image"}</p>
                {linking ? (
                  <LinkInput
                    onDone={(url) => {
                      setLinking(false);
                      if (url) accept(url);
                    }}
                  />
                ) : (
                  <div className="flex gap-1.5">
                    <button type="button" className={uiButton} onClick={() => fileRef.current?.click()}>
                      <Upload /> Upload
                    </button>
                    <button type="button" className={uiButton} onClick={() => setLinking(true)}>
                      <Link2 /> Paste link
                    </button>
                    {broken && (
                      <button type="button" className={uiButton} onClick={() => onChange?.({ image: null })} aria-label="Remove image">
                        <Trash2 />
                      </button>
                    )}
                  </div>
                )}
              </Ui>
            </div>
          ) : (
            <Ui
              origin="top right"
              className="absolute right-[20px] top-[20px] flex gap-1 opacity-0 transition-opacity group-hover/img:opacity-100 group-focus-within/img:opacity-100"
            >
              {linking ? (
                <LinkInput
                  onDone={(url) => {
                    setLinking(false);
                    if (url) accept(url);
                  }}
                />
              ) : (
                <>
                  <button type="button" className={uiButton} onClick={() => fileRef.current?.click()}>
                    <Upload /> Replace
                  </button>
                  <button type="button" className={uiButton} onClick={() => setLinking(true)} aria-label="Use an image link" title="Use an image link">
                    <Link2 />
                  </button>
                  <button type="button" className={cn(uiButton, "hover:text-danger")} onClick={() => onChange?.({ image: null })} aria-label="Remove image" title="Remove image">
                    <Trash2 />
                  </button>
                </>
              )}
            </Ui>
          )}
          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-[color-mix(in_oklab,var(--s-bg)_70%,transparent)]">
              <Ui>
                <div className="grid size-16 place-items-center rounded-2xl border border-line bg-raised shadow-pop">
                  <GooSpinner size={44} label="Uploading image" />
                </div>
              </Ui>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LinkInput({ onDone }: { onDone: (url: string | null) => void }) {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const submit = () => {
    if (!value.trim()) return onDone(null);
    const url = cleanImageUrl(value);
    if (!url) return setInvalid(true);
    onDone(url);
  };
  return (
    <form
      className="flex gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setInvalid(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onDone(null);
          }
        }}
        onBlur={() => !value.trim() && onDone(null)}
        placeholder="https://…"
        aria-label="Image link"
        aria-invalid={invalid}
        className="h-7 w-[220px] rounded-lg border border-line bg-raised px-2.5 text-[12.5px] text-ink shadow-card outline-none placeholder:text-ink-3 focus:border-blob aria-[invalid=true]:border-danger"
      />
      <button type="submit" className={cn(uiButton, "border-transparent bg-ink text-paper hover:bg-ink/88")}>
        Add
      </button>
    </form>
  );
}

function AddImageChip() {
  const { onUpload, onChange } = useSlide();
  const fileRef = useRef<HTMLInputElement>(null);
  const [linking, setLinking] = useState(false);
  return (
    <Ui
      origin="bottom right"
      className="absolute bottom-[28px] right-[28px] opacity-0 transition-opacity group-hover/canvas:opacity-100 has-[input:focus]:opacity-100"
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onUpload?.(file);
        }}
      />
      {linking ? (
        <LinkInput
          onDone={(url) => {
            setLinking(false);
            if (url) onChange?.({ image: url });
          }}
        />
      ) : (
        <div className="flex gap-1">
          <button type="button" className={uiButton} onClick={() => fileRef.current?.click()}>
            <Plus /> Image
          </button>
          <button type="button" className={uiButton} onClick={() => setLinking(true)} aria-label="Use an image link" title="Use an image link">
            <Link2 />
          </button>
        </div>
      )}
    </Ui>
  );
}
