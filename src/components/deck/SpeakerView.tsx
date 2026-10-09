"use client";

import { ChevronLeft, ChevronRight, Keyboard, LayoutGrid, Minus, MonitorUp, Pause, Play, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useState, type ReactNode, type Ref } from "react";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { intlLocale } from "@/i18n/format";
import { presentText } from "@/i18n/messages/present";
import type { Deck } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Palette } from "./deck";
import { SlideView } from "./SlideView";

export type Timer = { acc: number; since: number | null };

function useElapsed(timer: Timer) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const tick = () => setSecs(Math.floor((timer.acc + (timer.since === null ? 0 : Date.now() - timer.since)) / 1000));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 250);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [timer]);
  return secs;
}

function useClock(locale: Locale) {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString(intlLocale(locale), { hour: "2-digit", minute: "2-digit" }));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [locale]);
  return time;
}

const fmt = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

/**
 * Presenter-only view: the slide as the audience sees it, what the next click shows,
 * notes, a timer and a clock. Runs in the presenting window (S) or a second window.
 */
export function SpeakerView({
  deck,
  palette,
  sections,
  index,
  step,
  units,
  title,
  timer,
  blank,
  remote,
  canvasRef,
  onTimer,
  onPrev,
  onNext,
  onOverview,
  onHelp,
  onPopOut,
  onExit,
}: {
  deck: Deck;
  palette: Palette;
  sections: Map<string, number>;
  index: number;
  step: number;
  units: number[];
  title: string;
  timer: Timer;
  blank: "black" | "white" | null;
  /** True when this is the second window (the audience sees another window). */
  remote: boolean;
  canvasRef?: Ref<HTMLDivElement>;
  onTimer: (action: "toggle" | "reset") => void;
  onPrev: () => void;
  onNext: () => void;
  onOverview: () => void;
  onHelp: () => void;
  onPopOut: () => void;
  onExit: () => void;
}) {
  const t = useMessages(presentText);
  const locale = useLocale();
  const total = deck.slides.length;
  const ended = index >= total;
  const slide = deck.slides[Math.min(index, total - 1)];
  const built = units[index] ?? 0;
  const moreBuilds = !ended && step < built;
  const next = moreBuilds ? slide : deck.slides[index + 1];
  const nextStep = moreBuilds ? step + 1 : 0;
  const elapsed = useElapsed(timer);
  const clock = useClock(locale);
  const [notesSize, setNotesSize] = useState(20);
  const progress = ended ? 1 : (index + (built ? step / built : 1)) / total;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0b0b0a] text-[#f1efe8]" data-theme="dark">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/8 px-4 text-[13px]">
        <span className="min-w-0 truncate font-medium text-white/85" title={title}>
          {title}
        </span>
        <span className="hidden shrink-0 rounded-md bg-white/6 px-1.5 py-0.5 text-[11.5px] text-white/50 sm:inline">{t.speakerView}</span>
        <div className="mx-auto flex items-center gap-1 rounded-xl border border-white/10 bg-[#161614] py-1 pl-3 pr-1">
          <span className={cn("min-w-[64px] font-mono text-[17px] tabular-nums tracking-tight", timer.since === null ? "text-white/45" : "text-white")} aria-label={t.elapsed}>
            {fmt(elapsed)}
          </span>
          <SmallButton label={timer.since === null ? t.resumeTimer : t.pauseTimer} onClick={() => onTimer("toggle")}>
            {timer.since === null ? <Play className="fill-current" /> : <Pause className="fill-current" />}
          </SmallButton>
          <SmallButton label={t.resetTimer} onClick={() => onTimer("reset")}>
            <RotateCcw />
          </SmallButton>
        </div>
        <span className="hidden shrink-0 tabular-nums text-white/50 sm:inline" suppressHydrationWarning>
          {clock}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <SmallButton label={remote ? t.showHere : t.openAudience} onClick={onPopOut}>
            <MonitorUp />
          </SmallButton>
          <SmallButton label={t.allSlidesKey} onClick={onOverview}>
            <LayoutGrid />
          </SmallButton>
          <SmallButton label={t.shortcutsKey} onClick={onHelp}>
            <Keyboard />
          </SmallButton>
          <SmallButton label={remote ? t.closeSpeaker : t.exitEsc} onClick={onExit}>
            <X />
          </SmallButton>
        </div>
      </header>

      {/* Landscape: slide | next + notes. Portrait (phones, upright tablets): the slide on top, then next and notes. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-4 p-4 sm:landscape:grid-cols-[minmax(0,1.65fr)_minmax(260px,1fr)] sm:landscape:grid-rows-1">
        <section className="flex min-h-0 flex-col" aria-label={t.currentSlide}>
          <PaneLabel>
            <span className="shrink-0 whitespace-nowrap font-medium text-white/85">{ended ? t.endOfPresentation : t.slideOf(index + 1, total)}</span>
            {built > 0 && !ended && (
              <span className="flex items-center gap-1" aria-label={t.buildOf(step, built)}>
                {Array.from({ length: built }, (_, i) => (
                  <span key={i} className={cn("size-1.5 rounded-full transition-colors", i < step ? "bg-blob" : "bg-white/20")} />
                ))}
              </span>
            )}
            {blank && <span className="ml-auto min-w-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[11.5px] leading-snug text-white/80">{t.blankScreen(blank)}</span>}
          </PaneLabel>
          <div className="relative min-h-0 flex-1 max-sm:aspect-video max-sm:flex-none portrait:aspect-video portrait:flex-none">
            {ended ? (
              <EndCard />
            ) : (
              <SlideView
                slide={slide}
                palette={palette}
                mode="present"
                reveal={built ? step : undefined}
                ordinal={sections.get(slide.id)}
                canvasRef={canvasRef}
                frameClassName="rounded-lg ring-1 ring-white/10"
              />
            )}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-4 sm:portrait:flex-row" aria-label={t.nextAndNotes}>
          <div className="shrink-0 max-sm:portrait:w-1/2 sm:portrait:w-2/5">
            <PaneLabel>
              <span>{moreBuilds ? t.nextClick(step + 1, built) : next ? t.nextSlide(index + 2) : ended ? "" : t.nextEnd}</span>
            </PaneLabel>
            {/* Short windows (a phone on its side) cap the preview, so the notes keep some room. */}
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-white/[0.03] [@media(max-height:560px)]:max-h-[28vh]">
              {next && !ended ? (
                <SlideView
                  slide={next}
                  palette={palette}
                  mode="present"
                  reveal={moreBuilds ? nextStep : (units[index + 1] ?? 0) ? 0 : undefined}
                  ordinal={sections.get(next.id)}
                  frameClassName="rounded-lg opacity-90 ring-1 ring-white/10"
                />
              ) : (
                <div className="grid size-full place-items-center text-[13px] text-white/40">{ended ? t.thatWasLast : t.endOfPresentation}</div>
              )}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-white/8 bg-[#161614]">
            <div className="flex h-10 shrink-0 items-center gap-1 border-b border-white/8 pl-4 pr-1.5 text-[12.5px] text-white/50">
              <span className="font-medium text-white/80">{t.notes}</span>
              <span className="ml-auto" />
              <SmallButton label={t.smallerNotes} onClick={() => setNotesSize((s) => Math.max(14, s - 2))}>
                <Minus />
              </SmallButton>
              <SmallButton label={t.largerNotes} onClick={() => setNotesSize((s) => Math.min(40, s + 2))}>
                <Plus />
              </SmallButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 leading-[1.55] text-white/90" style={{ fontSize: notesSize }}>
              {!ended && slide.notes.trim() ? <p className="whitespace-pre-wrap">{slide.notes}</p> : <p className="text-white/35">{ended ? t.nothingLeft : t.noNotes}</p>}
            </div>
          </div>
        </aside>
      </div>

      <footer className="flex h-14 shrink-0 items-center gap-3 border-t border-white/8 px-4">
        <button
          type="button"
          onClick={(e) => (e.detail > 0 && e.currentTarget.blur(), onPrev())}
          disabled={index === 0 && step === 0}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-[#1c1b18] px-3 text-[13px] text-white/80 transition-colors hover:bg-[#262623] hover:text-white disabled:opacity-35"
        >
          <ChevronLeft className="size-4" /> {t.back}
        </button>
        <div className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/8">
          <div className="absolute inset-y-0 left-0 rounded-full bg-blob transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
        <button
          type="button"
          onClick={(e) => (e.detail > 0 && e.currentTarget.blur(), onNext())}
          disabled={ended}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blob px-4 text-[13px] font-medium text-white transition-colors hover:bg-blob-deep disabled:opacity-35"
        >
          {moreBuilds ? t.reveal : t.next} <ChevronRight className="size-4" />
        </button>
      </footer>
    </div>
  );
}

function PaneLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 flex min-h-5 shrink-0 items-center gap-2.5 text-[12.5px] tabular-nums text-white/50">{children}</div>;
}

function EndCard() {
  const t = useMessages(presentText);
  return <div className="grid size-full place-items-center rounded-lg bg-white/[0.03] text-[14px] text-white/45">{t.endCard}</div>;
}

export function SmallButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={(e) => {
        if (e.detail > 0) e.currentTarget.blur();
        onClick();
      }}
      className={cn(
        "grid size-7 place-items-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white [&_svg]:size-3.5",
        active && "bg-white/10 text-white",
      )}
    >
      {children}
    </button>
  );
}
