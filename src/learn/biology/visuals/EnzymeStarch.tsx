"use client";

// The amylase experiment with the iodine test for starch: test tubes whose colour shows whether
// starch is left (blue-black) or not (yellow-brown, the colour of the iodine solution).
// EnzymeStarchLab is the lesson widget (time runs, saliva splits the starch); EnzymeTubes is the
// static picture for tasks.

import { animate, motion, useReducedMotion } from "motion/react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";

/** Liquid colours (stable in light and dark mode: these are real colours of the test). */
export const LIQUID = {
  starch: "color-mix(in oklab, var(--bio-blood-low) 52%, var(--blob-face))",
  iodine: "color-mix(in oklab, var(--bio-c) 62%, var(--bio-wood))",
  clear: "color-mix(in oklab, var(--ink) 8%, var(--raised))",
};
/** Colour of starch solution with iodine when a share `starch` (0..1) of the starch is left. */
export const iodineColour = (starch: number) => {
  const p = Math.round(Math.min(1, Math.max(0, starch * 1.6)) * 100);
  return p >= 100 ? LIQUID.starch : p <= 0 ? LIQUID.iodine : `color-mix(in oklab, ${LIQUID.starch} ${p}%, ${LIQUID.iodine})`;
};

/** A test tube with a liquid. */
export function Tube({ colour, size = 1, label }: { colour: string; size?: number; label?: string }) {
  const clip = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const W = 64;
  const H = 190;
  const tube = `M12 10 L12 ${H - 32} A20 20 0 0 0 52 ${H - 32} L52 10`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W * size} height={H * size} aria-hidden className="block">
      <defs>
        <clipPath id={clip}>
          <path d={`${tube} Z`} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x={0} y={70} width={W} height={H} style={{ fill: colour, transition: "fill 0.4s linear" }} />
        <rect x={0} y={70} width={W} height={4} style={{ fill: "color-mix(in oklab, var(--raised) 35%, transparent)" }} />
        <rect x={18} y={82} width={5} height={H - 128} rx={2.5} style={{ fill: "color-mix(in oklab, var(--bio-bone) 45%, transparent)" }} />
      </g>
      <path d={tube} fill="none" stroke="var(--ink-3)" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M6 10 L58 10" stroke="var(--ink-3)" strokeWidth={3} strokeLinecap="round" />
      {label && (
        <text x={32} y={44} textAnchor="middle" fontSize={17} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
          {label}
        </text>
      )}
    </svg>
  );
}

export type TubeSpec = { label: string; content: Text; colour: "starch" | "iodine" | "clear" };

/** Test tubes side by side with what's in them (task picture). */
export function EnzymeTubes({ tubes, note }: { tubes: TubeSpec[]; note?: Text }) {
  const t = useText();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-center gap-x-5 gap-y-4">
        {tubes.map((tb) => (
          <div key={tb.label} className="flex w-[118px] flex-col items-center gap-1.5 text-center">
            <Tube colour={LIQUID[tb.colour]} size={0.72} label={tb.label} />
            <span className="text-[13px] leading-snug text-ink-2">{t(tb.content)}</span>
          </div>
        ))}
      </div>
      {note && (
        <p className="text-center text-[13px] text-ink-3">
          <Inline text={note} />
        </p>
      )}
    </div>
  );
}

/** A starch chain cut into maltose (pairs of glucose) as `cut` goes from 0 to 1. */
function StarchChain({ cut }: { cut: number }) {
  const t = useText();
  const units = 12;
  const breaks = Math.round(cut * 5);
  // bonds between the pairs break from the ends inwards: 0-1 | 2-3 | ...
  const order = [4, 0, 2, 3, 1];
  const broken = new Set(order.slice(0, breaks));
  const xs: number[] = [];
  let x = 14;
  for (let i = 0; i < units; i++) {
    xs.push(x);
    const pair = Math.floor(i / 2);
    x += i % 2 === 1 && broken.has(pair) ? 34 : 22;
  }
  return (
    <svg viewBox="0 0 330 56" className="block h-auto w-full" style={{ maxWidth: 380 }} role="img" aria-label={t(tx("Starch chain being split into maltose", "Stärkekette, die in Malzzucker gespalten wird"))}>
      {xs.slice(0, -1).map((xi, i) => {
        const gone = i % 2 === 1 && broken.has(Math.floor(i / 2));
        return <motion.line key={i} x1={xi} x2={xs[i + 1]} y1={28} y2={28} stroke="var(--bio-nerve-deep)" strokeWidth={3} initial={false} animate={{ opacity: gone ? 0 : 1 }} />;
      })}
      {xs.map((xi, i) => (
        <motion.g key={i} initial={false} animate={{ x: xi, y: 28 }} transition={{ type: "spring", stiffness: 120, damping: 16 }}>
          <path d="M -8 -4.6 L 0 -9.2 L 8 -4.6 L 8 4.6 L 0 9.2 L -8 4.6 Z" fill="var(--bio-sun)" stroke="var(--bio-nerve-deep)" strokeWidth={1.6} />
        </motion.g>
      ))}
    </svg>
  );
}

const MINUTES = 10;
/** Share of starch left in the saliva tube after `m` minutes at 37 °C. */
const starchLeft = (m: number) => Math.exp(-0.45 * m);

export function EnzymeStarchLab() {
  const t = useText();
  const reduce = useReducedMotion();
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);

  const s = starchLeft(time);
  const tubes: { label: string; content: Text; colour: string }[] = [
    { label: "A", content: tx("starch + water", "Stärke + Wasser"), colour: LIQUID.starch },
    { label: "B", content: tx("starch + saliva", "Stärke + Speichel"), colour: iodineColour(s) },
    { label: "C", content: tx("starch + boiled saliva", "Stärke + abgekochter Speichel"), colour: LIQUID.starch },
  ];

  const stop = () => {
    ctrl.current?.stop();
    setPlaying(false);
  };
  const play = () => {
    if (playing) return stop();
    const from = time >= MINUTES ? 0 : time;
    if (reduce) {
      setTime(Math.min(MINUTES, Math.floor(from / 2.5) * 2.5 + 2.5));
      return;
    }
    setPlaying(true);
    ctrl.current = animate(from, MINUTES, { duration: (MINUTES - from) * 0.75, ease: "linear", onUpdate: setTime, onComplete: () => setPlaying(false) });
  };

  const info: Text =
    time < 0.5
      ? tx(
          "All three tubes contain starch solution with a few drops of iodine solution: **blue-black**, starch is there. Then water, saliva or boiled saliva is added. Start the clock!",
          "Alle drei Reagenzgläser enthalten Stärkelösung mit ein paar Tropfen Iod-Kaliumiodid-Lösung: **blau-schwarz**, Stärke ist da. Dann kommt Wasser, Speichel oder abgekochter Speichel dazu. Starte die Uhr!",
        )
      : s > 0.3
        ? tx(
            "In tube B the **amylase** from the saliva is at work: it splits the long starch chains into maltose. The blue-black colour starts to fade.",
            "In Glas B arbeitet die **Amylase** aus dem Speichel: Sie spaltet die langen Stärkeketten in Malzzucker. Die blau-schwarze Farbe verblasst langsam.",
          )
        : s > 0.03
          ? tx(
              "Almost all the starch in B is split. A and C stay blue-black: water contains no enzyme, and boiling has **destroyed** the amylase (it's a protein).",
              "Fast die ganze Stärke in B ist gespalten. A und C bleiben blau-schwarz: Wasser enthält kein Enzym, und das Kochen hat die Amylase **zerstört** (sie ist ein Protein).",
            )
          : tx(
              "Done: B is **yellow-brown**, the colour of the iodine solution itself. No starch left! A is the control (Kontrollansatz): it shows that starch doesn't disappear on its own.",
              "Fertig: B ist **gelb-braun**, das ist die Farbe der Iodlösung selbst. Keine Stärke mehr! A ist der Kontrollansatz: Er zeigt, dass die Stärke nicht von allein verschwindet.",
            );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-3">
        <div className="relative mx-auto flex max-w-[460px] items-end justify-around gap-2 pt-1">
          <div className="pointer-events-none absolute inset-x-0 bottom-[44px] top-[78px] rounded-xl" style={{ background: "color-mix(in oklab, var(--bio-water) 18%, transparent)" }} />
          {tubes.map((tb) => (
            <div key={tb.label} className="relative flex w-[112px] flex-col items-center gap-1.5 text-center">
              <Tube colour={tb.colour} size={0.78} label={tb.label} />
              <span className="min-h-[2.6em] text-[12.5px] leading-snug text-ink-2">{t(tb.content)}</span>
            </div>
          ))}
        </div>
        <div className="mt-1 text-center text-[12px] text-ink-3">{t(tx("water bath at 37 °C", "Wasserbad mit 37 °C"))}</div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={play}
          className="flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-[14px] font-semibold text-paper transition-transform hover:bg-ink/88 active:scale-[0.97]"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />} {playing ? t(tx("Pause", "Pause")) : t(tx("Let time run", "Zeit laufen lassen"))}
        </button>
        <label className="flex min-w-[200px] flex-1 items-center gap-3 text-[13px] text-ink-2">
          <input
            type="range"
            min={0}
            max={MINUTES}
            step={0.1}
            value={time}
            onChange={(e) => {
              stop();
              setTime(Number(e.target.value));
            }}
            className="w-full accent-[var(--blob)]"
            aria-label={t(tx("Time in minutes", "Zeit in Minuten"))}
          />
          <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-ink">{Math.floor(time)} min</span>
        </label>
        <button
          type="button"
          onClick={() => {
            stop();
            setTime(0);
          }}
          className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-hover hover:text-ink"
          aria-label={t(tx("Back to the start", "Zurück zum Start"))}
        >
          <RotateCcw className="size-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="rounded-xl border border-line px-3 py-2">
          <div className="mb-1 text-[12px] font-medium text-ink-3">{t(tx("Tube B, zoomed in to the particles", "Glas B, auf Teilchenebene vergrößert"))}</div>
          <StarchChain cut={1 - s} />
          <div className="text-[12px] text-ink-3">
            {s > 0.5 ? t(tx("long starch chain", "lange Stärkekette")) : s > 0.05 ? t(tx("the chain is being cut", "die Kette wird zerschnitten")) : t(tx("maltose: pairs of glucose", "Malzzucker: Zweierstücke aus Traubenzucker"))}
          </div>
        </div>
        <div className="flex gap-3 text-[12.5px] text-ink-2 sm:flex-col">
          <span className="flex items-center gap-2">
            <span className="size-4 rounded-full" style={{ background: LIQUID.starch }} /> {t(tx("blue-black: starch", "blau-schwarz: Stärke"))}
          </span>
          <span className="flex items-center gap-2">
            <span className="size-4 rounded-full" style={{ background: LIQUID.iodine }} /> {t(tx("yellow-brown: no starch", "gelb-braun: keine Stärke"))}
          </span>
        </div>
      </div>

      <motion.p
        key={time < 0.5 ? 0 : s > 0.3 ? 1 : s > 0.03 ? 2 : 3}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("rounded-xl px-3.5 py-2.5 text-[14.5px] leading-relaxed", s <= 0.03 ? "bg-ok/10 text-ink" : "bg-hover/60 text-ink-2")}
        aria-live="polite"
      >
        <Inline text={info} />
      </motion.p>
    </div>
  );
}
