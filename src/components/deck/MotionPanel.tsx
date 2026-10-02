"use client";

import { AnimatePresence, useReducedMotion } from "motion/react";
import { Check, ChevronDown, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Popover } from "@/components/ui/Menu";
import { useMessages } from "@/i18n/client";
import { deckText } from "@/i18n/messages/deck";
import type { Deck, Slide, SlideBuild, SlideTransition } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BUILD_LAYOUTS, BUILDS, buildUnits, TRANSITIONS, type Palette } from "./deck";
import { MORPH_MS, type StageCustom } from "./motion";
import { SlideView } from "./SlideView";
import { StageCanvas, StageSlide } from "./Stage";
import { Block } from "./ThemeEditor";

const PREVIEW_W = 240;

/** Motion tab: how this slide arrives (transition) and how its content appears (build). */
export function MotionPanel({
  deck,
  slide,
  index,
  palette,
  sections,
  onSlide,
  onDeckTransition,
}: {
  deck: Deck;
  slide: Slide;
  index: number;
  palette: Palette;
  sections: Map<string, number>;
  onSlide: (patch: Partial<Slide>) => void;
  /** Change the deck default; `everywhere` also clears every slide's own choice. */
  onDeckTransition: (t: SlideTransition, everywhere: boolean) => void;
}) {
  const t = useMessages(deckText);
  const [run, setRun] = useState(0);
  const prev = index > 0 ? deck.slides[index - 1] : null;
  const effective = slide.transition ?? deck.transition;
  const units = buildUnits(slide);
  const canBuild = BUILD_LAYOUTS.has(slide.layout);
  const overrides = deck.slides.filter((s) => s.transition !== null).length;

  const pickTransition = (id: SlideTransition) => {
    onSlide({ transition: id === deck.transition ? null : id });
    setRun((r) => r + 1);
  };
  const pickBuild = (b: SlideBuild) => {
    onSlide({ build: b });
    setRun((r) => r + 1);
  };

  return (
    <>
      <Block
        title={t.preview}
        action={
          <button
            type="button"
            onClick={() => setRun((r) => r + 1)}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] text-ink-3 hover:bg-hover hover:text-ink"
          >
            <Play className="size-3 fill-current" /> {t.replay}
          </button>
        }
      >
        <MotionPreview key={`${run}:${slide.id}:${effective}:${slide.build}`} prev={prev} slide={slide} palette={palette} sections={sections} kind={effective} />
        <p className="mt-2 text-[12px] text-ink-3">{prev ? t.previewFromTo(index, index + 1) : t.firstSlide}</p>
      </Block>

      <Block title={t.transition}>
        <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label={t.transitionAria}>
          {TRANSITIONS.map((id) => (
            <Chip key={id} active={id === effective} onClick={() => pickTransition(id)} hint={t.transitions[id].hint} mark={id === deck.transition} markLabel={t.deckDefaultMark}>
              {t.transitions[id].label}
            </Chip>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-2 text-[12px] text-ink-3">
          <span className="min-w-0 flex-1">{slide.transition === null ? t.usesDefault : t.onlyHere}</span>
          {slide.transition !== null && (
            <button type="button" onClick={() => onSlide({ transition: null })} className="shrink-0 text-ink-3 underline-offset-2 hover:text-ink hover:underline">
              {t.reset}
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[12.5px] text-ink-2">{t.deckDefault}</span>
          <Popover
            align="end"
            className="w-[230px] p-1"
            trigger={(props) => (
              <button
                {...props}
                className="ml-auto flex h-7 items-center gap-1.5 rounded-lg border border-line bg-raised px-2 text-[12.5px] text-ink transition-colors hover:border-line-2 aria-expanded:border-blob"
              >
                {t.transitions[deck.transition].label}
                <ChevronDown className="size-3.5 text-ink-3" />
              </button>
            )}
          >
            {(close) => (
              <>
                {TRANSITIONS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={id === deck.transition}
                    onClick={() => {
                      onDeckTransition(id, false);
                      setRun((r) => r + 1);
                      close();
                    }}
                    className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-ink-2 hover:bg-hover hover:text-ink"
                  >
                    <span className="flex-1">{t.transitions[id].label}</span>
                    {id === deck.transition && <Check className="size-3.5 text-blob" strokeWidth={2.5} />}
                  </button>
                ))}
                {overrides > 0 && (
                  <>
                    <div className="mx-1 my-1 h-px bg-line" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onDeckTransition(deck.transition, true);
                        close();
                      }}
                      className="flex h-8 w-full items-center rounded-lg px-2 text-left text-[12.5px] text-ink-2 hover:bg-hover hover:text-ink"
                    >
                      {t.useEverywhere(overrides)}
                    </button>
                  </>
                )}
              </>
            )}
          </Popover>
        </div>
      </Block>

      <Block title={t.build}>
        <div className={cn("grid grid-cols-2 gap-1", !canBuild && "pointer-events-none opacity-45")} role="radiogroup" aria-label={t.buildAria} aria-disabled={!canBuild}>
          {BUILDS.map((id) => (
            <Chip key={id} active={id === slide.build} onClick={() => pickBuild(id)} hint={t.builds[id].hint} disabled={!canBuild}>
              {t.builds[id].label}
            </Chip>
          ))}
        </div>
        <p className="mt-2.5 text-[12px] leading-relaxed text-ink-3">
          {!canBuild ? t.buildUnsupported : slide.build === "none" ? t.buildPick : units === 0 ? t.buildEmpty : t.buildClicks(units)}
        </p>
      </Block>
    </>
  );
}

function Chip({
  children,
  active,
  onClick,
  hint,
  mark,
  markLabel,
  disabled,
}: {
  children: string;
  active: boolean;
  onClick: () => void;
  hint: string;
  mark?: boolean;
  markLabel?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      title={hint}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative h-8 rounded-lg border px-1 text-[12.5px] transition-colors",
        active ? "border-blob bg-blob-soft font-medium text-blob-ink" : "border-line bg-raised text-ink-2 hover:border-line-2 hover:text-ink",
      )}
    >
      {children}
      {mark && <span className="absolute right-1 top-1 size-1 rounded-full bg-ink-3" aria-label={markLabel} />}
    </button>
  );
}

const hasContent = (s: Slide) => Boolean(s.title.trim() || s.body.trim() || s.math.trim() || s.image || s.items.some((it) => it.head.trim() || it.text.trim()));

/** Plays previous slide → this slide with the chosen transition, then each build step. */
function MotionPreview({ prev, slide, palette, sections, kind }: { prev: Slide | null; slide: Slide; palette: Palette; sections: Map<string, number>; kind: SlideTransition }) {
  const reduce = useReducedMotion();
  const units = buildUnits(slide);
  const [phase, setPhase] = useState<"prev" | "slide">(prev && !reduce ? "prev" : "slide");
  const [step, setStep] = useState(reduce ? units : 0);
  const canvases = useRef(new Map<number, HTMLElement>());

  useEffect(() => {
    if (reduce) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const t0 = prev ? 700 : 250;
    if (prev) timers.push(setTimeout(() => setPhase("slide"), t0));
    const settle = kind === "none" ? 200 : kind === "morph" ? MORPH_MS : 700;
    for (let i = 1; i <= units; i++) timers.push(setTimeout(() => setStep(i), t0 + settle + (i - 1) * 620));
    return () => timers.forEach(clearTimeout);
  }, [reduce, prev, units, kind]);

  const custom: StageCustom = { dir: 1, kind: reduce ? "fade" : kind };
  const prevUnits = prev ? buildUnits(prev) : 0;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#0b0b0a] ring-1 ring-line" aria-hidden>
      <AnimatePresence initial={false} custom={custom}>
        {phase === "prev" && prev ? (
          <StageSlide key="prev" custom={custom}>
            <StageCanvas index={0} morphFrom={null} canvases={canvases}>
              {(ref) => (
                <SlideView
                  slide={prev}
                  palette={palette}
                  mode={hasContent(prev) ? "present" : "thumb"}
                  width={PREVIEW_W}
                  reveal={prevUnits || undefined}
                  ordinal={sections.get(prev.id)}
                  canvasRef={ref}
                />
              )}
            </StageCanvas>
          </StageSlide>
        ) : (
          <StageSlide key="slide" custom={custom}>
            <StageCanvas index={1} morphFrom={kind === "morph" && prev && !reduce ? 0 : null} canvases={canvases}>
              {(ref) => (
                <SlideView
                  slide={slide}
                  palette={palette}
                  mode={hasContent(slide) ? "present" : "thumb"}
                  width={PREVIEW_W}
                  reveal={units ? step : undefined}
                  ordinal={sections.get(slide.id)}
                  canvasRef={ref}
                />
              )}
            </StageCanvas>
          </StageSlide>
        )}
      </AnimatePresence>
    </div>
  );
}
