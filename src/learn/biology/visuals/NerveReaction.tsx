"use client";

// Level 1 widget for "nervous-system": the ruler-drop test. A ruler falls between your fingers;
// you grab it as soon as you see it move. From how far it fell we get your reaction time, and the
// chain stimulus → eye → nerve → brain → nerve → muscle lights up step by step.

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Hand, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { Note } from "./NerveKit";

const CM = 5; // viewBox units per centimetre
const GRAB_Y = 232; // where the fingers are
const LENGTH = 50; // cm
const G = 981; // cm/s²
const MISS = 46; // cm: then it has slipped through

type Phase = "idle" | "wait" | "fall" | "caught" | "missed" | "early";

const CHAIN: { what: Text; detail: Text }[] = [
  { what: tx("Stimulus", "Reiz"), detail: tx("the ruler moves", "das Lineal bewegt sich") },
  { what: tx("Sense organ", "Sinnesorgan"), detail: tx("eye", "Auge") },
  { what: tx("Nerve", "Nerv"), detail: tx("optic nerve", "Sehnerv") },
  { what: tx("Brain", "Gehirn"), detail: tx("recognises and decides", "erkennt und entscheidet") },
  { what: tx("Nerve", "Nerv"), detail: tx("to the hand", "zur Hand") },
  { what: tx("Muscles", "Muskeln"), detail: tx("fingers grab", "Finger greifen zu") },
];

const fmt = (v: number, locale: string, digits = 2) => v.toFixed(digits).replace(".", locale === "de" ? "," : ".");

export function NerveReaction() {
  const t = useText();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [fallen, setFallen] = useState(0); // cm
  const [times, setTimes] = useState<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const start = useRef(0);

  const stopAll = () => {
    if (timer.current) clearTimeout(timer.current);
    if (frame.current) cancelAnimationFrame(frame.current);
    timer.current = null;
    frame.current = null;
  };
  useEffect(() => stopAll, []);

  const tick = () => {
    const s = (performance.now() - start.current) / 1000;
    const d = 0.5 * G * s * s;
    if (d >= MISS) {
      setFallen(MISS + 6);
      setPhase("missed");
      frame.current = null;
      return;
    }
    setFallen(d);
    frame.current = requestAnimationFrame(tick);
  };

  const press = () => {
    if (phase === "idle" || phase === "caught" || phase === "missed" || phase === "early") {
      stopAll();
      setFallen(0);
      setPhase("wait");
      const delay = 1100 + Math.random() * 2200;
      timer.current = setTimeout(() => {
        start.current = performance.now();
        setPhase("fall");
        frame.current = requestAnimationFrame(tick);
      }, delay);
      return;
    }
    if (phase === "wait") {
      stopAll();
      setPhase("early");
      return;
    }
    if (phase === "fall") {
      const s = (performance.now() - start.current) / 1000;
      stopAll();
      const d = Math.min(MISS, 0.5 * G * s * s);
      setFallen(d);
      setPhase("caught");
      setTimes((old) => [...old.slice(-3), Math.sqrt((2 * d) / G)]);
    }
  };

  const time = times.length ? times[times.length - 1] : 0;
  const best = times.length ? Math.min(...times) : 0;
  const button: Text =
    phase === "wait" ? tx("Watch the ruler…", "Schau aufs Lineal …") : phase === "fall" ? tx("Grab it!", "Zugreifen!") : phase === "idle" ? tx("Start", "Start") : tx("Again", "Noch mal");
  const note: Text =
    phase === "idle"
      ? tx("Your fingers are open around the ruler. Press **Start**. At some moment the ruler drops. Grab it as fast as you can: tap the button again (or the ruler).", "Deine Finger sind geöffnet, das Lineal hängt dazwischen. Drück auf **Start**. Irgendwann fällt das Lineal. Greif so schnell du kannst zu: Tipp noch mal auf den Knopf (oder aufs Lineal).")
      : phase === "wait"
        ? tx("Wait for it… Don't guess, react to what you **see**!", "Warte ab … Nicht raten, reagier auf das, was du **siehst**!")
        : phase === "fall"
          ? tx("It's falling!", "Es fällt!")
          : phase === "early"
            ? tx("Too early! That was a guess, not a reaction. A reaction always needs a **stimulus** first.", "Zu früh! Das war geraten, keine Reaktion. Eine Reaktion braucht immer zuerst einen **Reiz**.")
            : phase === "missed"
              ? tx("Slipped through! Try again. Most people need between 0.15 and 0.3 seconds.", "Durchgerutscht! Versuch es noch mal. Die meisten Menschen brauchen zwischen 0,15 und 0,3 Sekunden.")
              : tx(
                  `Caught after **${fmt(fallen, "en", 0)} cm**: your reaction time was **${fmt(time, "en")} s**. In that time the signal ran from your eye through nerves to the brain and from there to your finger muscles.`,
                  `Nach **${fmt(fallen, "de", 0)} cm** gefangen: Deine Reaktionszeit war **${fmt(time, "de")} s**. In dieser Zeit lief das Signal vom Auge über Nerven ins Gehirn und von dort zu deinen Fingermuskeln.`,
                );

  // How far along the chain the signal is: lights up after a catch.
  const lit = phase === "caught" ? CHAIN.length : phase === "fall" ? 2 : 0;
  const closed = phase === "caught";
  const y = GRAB_Y - LENGTH * CM + Math.min(fallen, MISS + 30) * CM;

  return (
    <div className="space-y-4">
      <div className="grid gap-5 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center">
        <svg
          viewBox="0 0 200 300"
          className="mx-auto block h-auto w-full max-w-[200px] cursor-pointer touch-manipulation select-none"
          role="img"
          aria-label={t(tx("A ruler hanging between two fingers", "Ein Lineal hängt zwischen zwei Fingern"))}
          onPointerDown={(e) => {
            e.preventDefault();
            if (phase === "fall" || phase === "wait") press();
          }}
        >
          <rect x={0} y={0} width={200} height={300} rx={14} fill="var(--bio-cell)" opacity={0.5} />
          <g transform={`translate(0 ${y.toFixed(1)})`}>
            <rect x={80} y={0} width={40} height={LENGTH * CM} rx={3} fill="var(--bio-sun)" opacity={0.85} stroke="var(--bio-wood-deep)" strokeWidth={1.4} />
            {Array.from({ length: LENGTH + 1 }, (_, cm) => {
              const yy = LENGTH * CM - cm * CM;
              const big = cm % 5 === 0;
              return (
                <g key={cm}>
                  <line x1={80} x2={80 + (big ? 13 : 7)} y1={yy} y2={yy} stroke="var(--bio-outline)" strokeWidth={big ? 1.2 : 0.8} />
                  {big && cm > 0 && cm < LENGTH && (
                    <text x={106} y={yy} fontSize={9.5} textAnchor="middle" dominantBaseline="central" fill="var(--bio-outline)" style={{ fontFamily: "var(--font-sans)" }}>
                      {cm}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          {/* thumb and index finger */}
          <motion.g initial={false} animate={{ x: closed ? 14 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 26 }}>
            <rect x={30} y={GRAB_Y - 11} width={50} height={22} rx={11} fill="var(--bio-flesh)" stroke="var(--bio-flesh-deep)" strokeWidth={1.6} />
            <path d={`M70 ${GRAB_Y - 7} q6 7 0 14`} fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={1.2} />
          </motion.g>
          <motion.g initial={false} animate={{ x: closed ? -14 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 26 }}>
            <rect x={120} y={GRAB_Y - 10} width={62} height={20} rx={10} fill="var(--bio-flesh)" stroke="var(--bio-flesh-deep)" strokeWidth={1.6} />
            <path d={`M130 ${GRAB_Y - 6} q-6 6 0 12`} fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={1.2} />
          </motion.g>
          <line x1={20} x2={30} y1={GRAB_Y} y2={GRAB_Y} stroke="var(--blob)" strokeWidth={2} />
          <line x1={186} x2={196} y1={GRAB_Y} y2={GRAB_Y} stroke="var(--blob)" strokeWidth={2} />
        </svg>

        <div className="min-w-0 space-y-4">
          <button
            type="button"
            onClick={press}
            className={cn(
              "flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold transition-colors active:scale-[0.98] sm:max-w-[320px]",
              phase === "fall" ? "bg-blob text-white" : phase === "wait" ? "border border-line bg-surface text-ink-2" : "bg-ink text-paper",
            )}
          >
            {phase === "caught" || phase === "missed" || phase === "early" ? <RotateCcw className="size-4" /> : <Hand className="size-5" />}
            {t(button)}
          </button>
          {times.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13.5px] text-ink-2">
              <span>
                {t(tx("Last tries:", "Letzte Versuche:"))}{" "}
                <span className="font-math tabular-nums text-ink">{times.map((v) => `${fmt(v, locale)} s`).join(" · ")}</span>
              </span>
              <span>
                {t(tx("Best:", "Bestzeit:"))} <span className="font-math font-semibold tabular-nums text-blob-ink">{fmt(best, locale)} s</span>
              </span>
            </div>
          )}
          <ol className="flex flex-wrap items-center gap-1.5" aria-label={t(tx("From stimulus to response", "Vom Reiz zur Reaktion"))}>
            {CHAIN.map((c, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <motion.span
                  initial={false}
                  animate={{ scale: i < lit ? 1 : 0.97 }}
                  transition={reduce ? { duration: 0 } : { delay: phase === "caught" ? i * 0.18 : 0, type: "spring", stiffness: 400, damping: 22 }}
                  className={cn("block rounded-lg border px-2.5 py-1.5 text-[12.5px] leading-tight transition-colors duration-300", i < lit ? "border-blob/40 bg-blob-soft text-ink" : "border-line bg-surface text-ink-3")}
                  style={{ transitionDelay: phase === "caught" && !reduce ? `${i * 180}ms` : "0ms" }}
                >
                  <span className="block font-semibold">{t(c.what)}</span>
                  <span className="block">{t(c.detail)}</span>
                </motion.span>
                {i < CHAIN.length - 1 && <ArrowRight className={cn("size-3.5 shrink-0", i < lit - 1 ? "text-blob" : "text-ink-3")} />}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <Note id={`${phase}-${times.length}`} text={note} accent={phase === "caught"} />
      {phase === "caught" && (
        <p className="text-[13px] leading-relaxed text-ink-3">
          {t(tx("A reflex is much faster: there the signal takes a shortcut and doesn't have to wait for you to decide.", "Ein Reflex ist viel schneller: Da nimmt das Signal eine Abkürzung und muss nicht erst auf deine Entscheidung warten."))}
        </p>
      )}
    </div>
  );
}
