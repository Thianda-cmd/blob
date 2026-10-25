"use client";

import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Presentation } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deckPalette, normalizeDeck, sectionNumbers } from "@/components/deck/deck";
import { deckFontVars } from "@/components/deck/fonts";
import { SlideView } from "@/components/deck/SlideView";
import { useMessages } from "@/i18n/client";
import { publicText } from "@/i18n/messages/public";
import { cn } from "@/lib/utils";

/**
 * A presentation as anyone with its public link sees it: one big slide to click, swipe or arrow
 * through (full screen too), and every slide below it.
 */
export function PublicDeck({ content }: { content: unknown }) {
  const t = useMessages(publicText).view.deck;
  const deck = useMemo(() => normalizeDeck(content), [content]);
  const palette = useMemo(() => deckPalette(deck.theme, deck.custom), [deck]);
  const sections = useMemo(() => sectionNumbers(deck.slides), [deck]);
  const total = deck.slides.length;
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const swipe = useRef<number | null>(null);

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(total - 1, i))), [total]);
  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void stage.current?.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest("input, textarea, [contenteditable=true]")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && full)) go(index + 1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") go(index - 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(total - 1);
      else if (e.key === "f") toggleFull();
      else return;
      e.preventDefault();
    };
    const onFull = () => setFull(document.fullscreenElement === stage.current);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFull);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFull);
    };
  }, [go, index, total, full, toggleFull]);

  if (!total) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line-2 px-5 py-8 text-[14px] text-ink-3">
        <Presentation className="size-5" /> {t.none}
      </div>
    );
  }
  const slide = deck.slides[Math.min(index, total - 1)];

  return (
    <div className={cn(deckFontVars, "space-y-5")}>
      <div
        ref={stage}
        className={cn("group relative overflow-hidden bg-[#0d0d0c] shadow-pop", full ? "flex items-center justify-center" : "rounded-2xl")}
        onPointerDown={(e) => {
          swipe.current = e.pointerType === "mouse" ? null : e.clientX;
        }}
        onPointerUp={(e) => {
          if (swipe.current === null) return;
          const dx = e.clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        <div className={cn("relative w-full", full ? "h-full" : "aspect-video")}>
          <SlideView slide={slide} palette={palette} mode="present" ordinal={sections.get(slide.id)} />
        </div>
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/55 to-transparent px-3 pb-3 pt-8 text-white transition-opacity",
            "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
          )}
        >
          <div className="flex items-center gap-1">
            <StageButton label={t.prev} onClick={() => go(index - 1)} disabled={index === 0}>
              <ChevronLeft className="size-5" />
            </StageButton>
            <StageButton label={t.next} onClick={() => go(index + 1)} disabled={index >= total - 1}>
              <ChevronRight className="size-5" />
            </StageButton>
          </div>
          <span className="text-[12.5px] font-medium tabular-nums text-white/85" aria-live="polite">
            {t.slide(index + 1, total)}
          </span>
          <StageButton label={full ? t.exitFullscreen : t.fullscreen} onClick={toggleFull}>
            {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </StageButton>
        </div>
      </div>

      {total > 1 && (
        <section aria-label={t.all}>
          <ol className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
            {deck.slides.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={t.slide(i + 1, total)}
                  aria-current={i === index ? "true" : undefined}
                  className={cn(
                    "relative block aspect-video w-full overflow-hidden rounded-lg border bg-surface transition-[box-shadow,border]",
                    i === index ? "border-blob shadow-[0_0_0_2px_var(--blob)]" : "border-line hover:border-line-2",
                  )}
                >
                  <SlideView slide={s} palette={palette} mode="thumb" ordinal={sections.get(s.id)} />
                  <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[10px] font-medium tabular-nums text-white">{i + 1}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function StageButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center rounded-full bg-white/12 text-white backdrop-blur-sm transition-colors hover:bg-white/22 disabled:opacity-35"
    >
      {children}
    </button>
  );
}
