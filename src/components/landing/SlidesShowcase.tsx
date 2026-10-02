"use client";

import { ChevronLeft, ChevronRight, Pause, Play, Plus } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LAYOUTS, PRESETS, rgba } from "@/components/deck/deck";
import { LayoutGlyph } from "@/components/deck/LayoutGlyph";
import { useMessages } from "@/i18n/client";
import { landingText } from "@/i18n/messages/landing";
import { MathView } from "@/learn/components/MathView";
import type { DeckPreset, SlideLayout } from "@/lib/types";
import { cn } from "@/lib/utils";

type Enter = "fade" | "push" | "zoom" | "morph";
const ENTERS: Enter[] = ["fade", "push", "zoom", "morph"];

/** A five-slide physics deck: every slide shows off another layout, theme and transition. */
const SLIDES: { layout: SlideLayout; theme: DeckPreset; enter: Enter; builds: number }[] = [
  { layout: "title", theme: "ink", enter: "fade", builds: 0 },
  { layout: "timeline", theme: "ink", enter: "morph", builds: 3 },
  { layout: "formula", theme: "chalk", enter: "push", builds: 3 },
  { layout: "stats", theme: "blob", enter: "zoom", builds: 3 },
  { layout: "compare", theme: "paper", enter: "fade", builds: 2 },
];

const ease = [0.22, 1, 0.36, 1] as const;

type Pos = { slide: number; build: number; enter: Enter };

/** One click: the next build on this slide, or the next slide. */
function advance(p: Pos): Pos {
  if (p.build < SLIDES[p.slide].builds) return { ...p, build: p.build + 1 };
  const n = (p.slide + 1) % SLIDES.length;
  return { slide: n, build: 0, enter: SLIDES[n].enter };
}

const slideMotion: Variants = {
  enter: (e: Enter) => (e === "push" ? { x: "100%", opacity: 1, scale: 1 } : e === "zoom" ? { scale: 0.86, opacity: 0, x: 0 } : { opacity: 0, x: 0, scale: 1 }),
  center: { x: 0, scale: 1, opacity: 1, transition: { duration: 0.65, ease } },
  exit: (e: Enter) =>
    e === "push"
      ? { x: "-100%", opacity: 1, transition: { duration: 0.65, ease } }
      : e === "zoom"
        ? { scale: 1.08, opacity: 0, transition: { duration: 0.5, ease } }
        : { opacity: 0, transition: { duration: e === "morph" ? 0.45 : 0.5 } },
};

/** Items that come in one click at a time. */
const buildMotion: Variants = {
  off: { opacity: 0, y: 14 },
  on: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 420, damping: 30 } },
};

function palette(id: DeckPreset) {
  const spec = (PRESETS.find((p) => p.id === id) ?? PRESETS[0]).spec;
  let backgroundImage: string | undefined;
  let backgroundSize: string | undefined;
  if (spec.backdrop === "grid") {
    backgroundImage = `linear-gradient(${rgba(spec.text, 0.07)} 1px, transparent 1px), linear-gradient(90deg, ${rgba(spec.text, 0.07)} 1px, transparent 1px)`;
    backgroundSize = "4cqw 4cqw";
  } else if (spec.backdrop === "glow") {
    backgroundImage = `radial-gradient(90% 80% at 88% 0%, ${rgba("#ffffff", 0.16)}, transparent 62%), linear-gradient(160deg, ${spec.bg}, ${spec.bg2})`;
  }
  return { ...spec, style: { backgroundColor: spec.bg, backgroundImage, backgroundSize, color: spec.text } as CSSProperties };
}

export function SlidesShowcase() {
  const t = useMessages(landingText).slides;
  const root = useRef<HTMLDivElement>(null);
  const visible = useInView(root, { amount: 0.35 });
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<"auto" | "playing" | "paused">("auto");
  const [pos, setPos] = useState<Pos>({ slide: 0, build: 0, enter: SLIDES[0].enter });
  const [secs, setSecs] = useState(0);
  const playing = visible && (mode === "playing" || (mode === "auto" && !reduce));
  const { slide, build } = pos;
  const current = SLIDES[slide];
  const next = SLIDES[(slide + 1) % SLIDES.length];

  useEffect(() => {
    if (!playing) return;
    const holding = build >= current.builds;
    const timer = setTimeout(() => setPos(advance), holding ? 2600 : build === 0 ? 1200 : 950);
    return () => clearTimeout(timer);
  }, [playing, slide, build, current.builds]);

  // The speaker view's timer runs while the deck is "presenting".
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [playing]);

  const back = () => {
    setMode("paused");
    setPos((p) => {
      if (p.build > 0) return { ...p, build: p.build - 1 };
      const n = (p.slide - 1 + SLIDES.length) % SLIDES.length;
      return { slide: n, build: SLIDES[n].builds, enter: "fade" };
    });
  };
  const forward = () => {
    setMode("paused");
    setPos(advance);
  };

  const timer = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <div ref={root} className="grid gap-6 lg:grid-cols-12 lg:gap-8">
      <div className="lg:order-2 lg:col-span-7">
        <div role="group" aria-label={t.stage.label} className="@container relative aspect-video overflow-hidden rounded-xl bg-ink shadow-pop ring-1 ring-line">
          <LayoutGroup id="landing-deck">
            <AnimatePresence initial={false} custom={pos.enter}>
              <motion.div
                key={slide}
                custom={pos.enter}
                variants={slideMotion}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inset-0"
                style={palette(current.theme).style}
              >
                <Slide index={slide} build={build} />
              </motion.div>
            </AnimatePresence>
          </LayoutGroup>
        </div>
        <div className="mt-3 flex items-center gap-1">
          <ToolButton label={t.stage.prev} onClick={back}>
            <ChevronLeft className="size-4" />
          </ToolButton>
          <span className="min-w-[92px] text-center text-[12.5px] tabular-nums text-ink-3">{t.stage.slideOf(slide + 1, SLIDES.length)}</span>
          <ToolButton label={t.stage.next} onClick={forward}>
            <ChevronRight className="size-4" />
          </ToolButton>
          <div className="ml-2 hidden items-center gap-1 sm:flex" aria-hidden>
            {SLIDES.map((s, i) => (
              <span key={i} className={cn("h-1 rounded-full transition-all duration-300", i === slide ? "w-5 bg-blob" : "w-1.5 bg-line-2")} />
            ))}
          </div>
          <div className="ml-auto">
            <ToolButton label={playing ? t.stage.pause : t.stage.play} onClick={() => setMode(playing ? "paused" : "playing")}>
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            </ToolButton>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:order-1 lg:col-span-5">
        <Spec title={t.specs.layouts.title} body={t.specs.layouts.body}>
          <div className="grid grid-cols-6 gap-1">
            {LAYOUTS.map((l) => (
              <LayoutGlyph key={l.id} layout={l.id} active={l.id === current.layout} className={cn("rounded-[3px] transition-transform duration-300", l.id === current.layout && "scale-110")} />
            ))}
          </div>
        </Spec>
        <Spec title={t.specs.themes.title} body={t.specs.themes.body}>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <span
                key={p.id}
                className={cn(
                  "relative grid size-[27px] place-items-center rounded-full ring-1 ring-black/10 transition-shadow duration-300 dark:ring-white/10",
                  p.id === current.theme && "shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--blob)]",
                )}
                style={{ backgroundColor: p.spec.bg }}
              >
                <span className="size-[34%] rounded-full" style={{ backgroundColor: p.spec.accent }} />
              </span>
            ))}
            <span title={t.custom} className="grid size-[27px] place-items-center rounded-full border border-dashed border-line-2 text-ink-3">
              <Plus className="size-3" />
            </span>
          </div>
        </Spec>
        <Spec title={t.specs.motion.title} body={t.specs.motion.body}>
          <div className="flex flex-wrap gap-1">
            {ENTERS.map((e) => (
              <span
                key={e}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11.5px] font-medium transition-colors duration-300",
                  e === pos.enter && build === 0 ? "bg-ink text-paper" : e === pos.enter ? "bg-blob-soft text-blob-ink" : "bg-hover text-ink-2",
                )}
              >
                {t.transitions[e]}
              </span>
            ))}
          </div>
          <div className="mt-2 flex h-3 items-center gap-1">
            {Array.from({ length: current.builds }, (_, i) => (
              <motion.span
                key={`${slide}-${i}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn("size-2 rounded-full transition-colors duration-200", i < build ? "bg-blob" : "bg-line-2")}
              />
            ))}
          </div>
        </Spec>
        <Spec title={t.specs.speaker.title} body={t.specs.speaker.body}>
          <div className="flex gap-2 rounded-lg bg-[#1c1b18] p-2 text-[#edebe4] dark:bg-black/40">
            <div className="min-w-0 flex-1">
              <div className="text-[9.5px] font-medium uppercase tracking-wide text-[#8b8981]">{t.stage.notes}</div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={slide}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  className="mt-0.5 line-clamp-2 text-[11px] leading-snug"
                >
                  {t.deck.notes[slide]}
                </motion.p>
              </AnimatePresence>
            </div>
            <div className="flex w-[52px] shrink-0 flex-col items-end gap-1">
              <span className="font-mono text-[12px] tabular-nums leading-none">{timer}</span>
              <LayoutGlyph layout={next.layout} className="w-[48px] border-white/10 bg-white/90" />
              <span className="sr-only">{t.stage.upNext}</span>
            </div>
          </div>
        </Spec>
      </div>
    </div>
  );
}

function Spec({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border border-line bg-raised p-3.5 shadow-card">
      <div aria-hidden className="min-h-[76px]">
        {children}
      </div>
      <h3 className="mt-3 text-[15px] font-semibold leading-snug tracking-[-0.01em]">{title}</h3>
      <p className="mt-0.5 text-[13.5px] leading-snug text-ink-2">{body}</p>
    </div>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-hover hover:text-ink"
    >
      {children}
    </button>
  );
}

function Slide({ index, build }: { index: number; build: number }) {
  const d = useMessages(landingText).slides.deck;
  const s = SLIDES[index];
  const p = palette(s.theme);
  const muted = rgba(p.text, 0.62);
  const shown = (i: number) => (build > i ? "on" : "off");

  if (s.layout === "title") {
    return (
      <div className="absolute inset-0 flex flex-col justify-center px-[9cqw]">
        <div className="h-[0.7cqw] w-[6cqw] rounded-full" style={{ backgroundColor: p.accent }} />
        <motion.h3 layoutId="landing-deck-title" className="mt-[2.6cqw] w-fit font-display text-[6.8cqw] font-bold leading-[1.05] tracking-[-0.035em]" style={{ color: p.title }}>
          {d.title}
        </motion.h3>
        <p className="mt-[1.8cqw] text-[2.3cqw]" style={{ color: muted }}>
          {d.subtitle}
        </p>
      </div>
    );
  }

  if (s.layout === "timeline") {
    return (
      <div className="absolute inset-0 px-[7cqw] pt-[6.5cqw]">
        <motion.h3 layoutId="landing-deck-title" className="w-fit font-display text-[3.9cqw] font-bold leading-[1.05] tracking-[-0.03em]" style={{ color: p.title }}>
          {d.title}
        </motion.h3>
        <div className="relative mt-[9cqw]">
          <motion.div
            className="absolute left-0 right-0 top-[5.4cqw] h-[0.3cqw] -translate-y-1/2 rounded-full"
            style={{ backgroundColor: rgba(p.text, 0.22), originX: 0 }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.35, duration: 0.8, ease }}
          />
          <div className="grid grid-cols-3 gap-[3cqw]">
            {d.timeline.map((e, i) => (
              <motion.div key={e.year} variants={buildMotion} initial="off" animate={shown(i)}>
                <div className="font-display text-[3.4cqw] font-bold leading-none" style={{ color: p.accent }}>
                  {e.year}
                </div>
                <div className="my-[1.2cqw] flex h-[2cqw] items-center">
                  <span className="size-[1.6cqw] rounded-full" style={{ backgroundColor: p.accent, boxShadow: `0 0 0 0.5cqw ${p.bg}` }} />
                </div>
                <div className="text-[2cqw] leading-snug">{e.text}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (s.layout === "formula") {
    return (
      <div className="absolute inset-0 flex flex-col px-[7cqw] pt-[6.5cqw]">
        <h3 className="font-display text-[3.3cqw] font-semibold tracking-[-0.02em]" style={{ color: p.title }}>
          {d.formulaTitle}
        </h3>
        <div className="mt-[3.6cqw] flex flex-col items-start gap-[1.8cqw]">
          {d.formula.map((src, i) => (
            <motion.div key={i} variants={buildMotion} initial="off" animate={shown(i)}>
              <MathView src={src} animate={false} className={cn("text-[4.6cqw]!", i === d.formula.length - 1 && "rounded-[0.6cqw] px-[1cqw]")} />
            </motion.div>
          ))}
        </div>
        <div className="absolute bottom-[6cqw] right-[7cqw] h-[0.6cqw] w-[5cqw] rounded-full" style={{ backgroundColor: p.accent }} />
      </div>
    );
  }

  if (s.layout === "stats") {
    return (
      <div className="absolute inset-0 px-[7cqw] pt-[6.5cqw]">
        <h3 className="font-display text-[3.3cqw] font-semibold tracking-[-0.02em]" style={{ color: p.title }}>
          {d.statsTitle}
        </h3>
        <div className="mt-[7cqw] grid grid-cols-3 gap-[3cqw]">
          {d.stats.map((stat, i) => (
            <motion.div key={stat.label} variants={buildMotion} initial="off" animate={shown(i)} className="border-t-[0.3cqw] pt-[2cqw]" style={{ borderColor: rgba(p.text, 0.3) }}>
              <div className="font-display text-[7.4cqw] font-bold leading-none tracking-[-0.04em] tabular-nums" style={{ color: p.title }}>
                {stat.value}
              </div>
              <div className="mt-[1.2cqw] text-[1.9cqw]" style={{ color: muted }}>
                {d.unit}
              </div>
              <div className="mt-[0.4cqw] text-[2.3cqw] font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 px-[7cqw] pt-[6.5cqw]">
      <h3 className="font-display text-[3.3cqw] font-semibold tracking-[-0.02em]" style={{ color: p.title }}>
        {d.compareTitle}
      </h3>
      <div className="mt-[4.5cqw] grid grid-cols-2 gap-[2.6cqw]">
        {d.compare.map((side, i) => (
          <motion.div
            key={side.head}
            variants={buildMotion}
            initial="off"
            animate={shown(i)}
            className="rounded-[1.4cqw] p-[3cqw]"
            style={{ backgroundColor: `color-mix(in oklab, ${p.text} 6%, ${p.bg})` }}
          >
            <div className="flex items-center gap-[1.2cqw] font-display text-[2.9cqw] font-semibold" style={{ color: p.title }}>
              <span className="size-[1.3cqw] rounded-full" style={{ backgroundColor: i === 0 ? rgba(p.text, 0.35) : p.accent }} />
              {side.head}
            </div>
            <p className="mt-[1.4cqw] text-[2.1cqw] leading-snug" style={{ color: muted }}>
              {side.body}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
