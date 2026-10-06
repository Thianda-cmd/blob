"use client";

import { AnimatePresence, motion, useSpring, useTransform, type MotionValue } from "motion/react";
import { Check, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";
import { gcdOf, parts } from "../balancing-core";
import { dec } from "../format";
import { molarMass, parseEquation, sideCounts } from "../formula";
import { cos, sin } from "@/lib/stableMath";

// A balancing playground: steppers for each coefficient, live atom counters per element,
// and a beam balance holding the atoms of each side. It only levels out when every kind
// of atom is the same on both sides (and with it the mass: law of conservation of mass).

type Preset = { eq: string; name: Text };

const PRESETS: Preset[] = [
  { eq: "H2 + O2 -> H2O", name: tx("Water", "Wasser") },
  { eq: "N2 + H2 -> NH3", name: tx("Ammonia", "Ammoniak") },
  { eq: "Na + Cl2 -> NaCl", name: tx("Table salt", "Kochsalz") },
  { eq: "CH4 + O2 -> CO2 + H2O", name: tx("Methane burns", "Methan brennt") },
  { eq: "Fe + O2 -> Fe2O3", name: tx("Rust", "Rost") },
  { eq: "Al + HCl -> AlCl3 + H2", name: tx("Metal + acid", "Metall + Säure") },
  { eq: "C2H6 + O2 -> CO2 + H2O", name: tx("Challenge", "Profi") },
];

const MAX = 12;
const MAX_DRAWN = 36;
const round = (x: number) => Math.round(x * 100) / 100;

/** Element tones that work in light and dark mode (fill, text). */
const TONES: [string, string][] = [
  ["var(--blob)", "#fff"],
  ["color-mix(in oklab, var(--ink) 72%, var(--raised))", "var(--raised)"],
  ["color-mix(in oklab, var(--blob) 38%, var(--raised))", "var(--ink)"],
  ["color-mix(in oklab, var(--ink) 16%, var(--raised))", "var(--ink)"],
  ["color-mix(in oklab, var(--blob) 70%, var(--ink))", "#fff"],
];

function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const t = useText();
  return (
    <div className="flex items-center rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        className="grid size-8 place-items-center rounded-l-xl text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30"
        aria-label={t(tx(`Smaller coefficient for ${label}`, `Kleinerer Koeffizient für ${label}`))}
      >
        <Minus className="size-3.5" />
      </button>
      <span className="relative grid h-8 w-7 place-items-center overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={value}
            initial={{ y: -14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 14, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 32 }}
            className={cn("font-math text-[19px] tabular-nums", value > 1 ? "text-blob-ink" : "text-ink-3")}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(MAX, value + 1))}
        disabled={value >= MAX}
        className="grid size-8 place-items-center rounded-r-xl text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30"
        aria-label={t(tx(`Bigger coefficient for ${label}`, `Größerer Koeffizient für ${label}`))}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/** The atoms of one side piled up on a pan (local coordinates: pan rim at y = 0). */
function Pile({ atoms, tone }: { atoms: string[]; tone: (el: string) => [string, string] }) {
  const shown = atoms.slice(0, MAX_DRAWN);
  const perRow = 6;
  const r = 9.4;
  return (
    <g>
      <AnimatePresence initial={false}>
        {shown.map((el, i) => {
          const row = Math.floor(i / perRow);
          const inRow = Math.min(perRow, shown.length - row * perRow);
          const col = i % perRow;
          const x = round((col - (inRow - 1) / 2) * (2 * r + 1.2) + (row % 2 ? r * 0.35 : 0));
          const y = round(-r - 2 - row * (2 * r - 2.4));
          const [fill, ink] = tone(el);
          return (
            <motion.g
              key={`${el}-${i}`}
              initial={{ opacity: 0, scale: 0.3, y: y - 30 }}
              animate={{ opacity: 1, scale: 1, y }}
              exit={{ opacity: 0, scale: 0.3 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              style={{ x }}
            >
              <circle r={r} fill={fill} stroke="var(--raised)" strokeWidth={1} />
              <text textAnchor="middle" dy="0.35em" fontSize={el.length > 1 ? 8.2 : 9.6} fontWeight={600} fill={ink} className="select-none">
                {el}
              </text>
            </motion.g>
          );
        })}
      </AnimatePresence>
      {atoms.length > MAX_DRAWN && (
        <text x={0} y={-112} textAnchor="middle" fontSize={11} className="fill-ink-3">
          +{atoms.length - MAX_DRAWN}
        </text>
      )}
    </g>
  );
}

function Pan({ x, y, atoms, tone, label }: { x: MotionValue<number>; y: MotionValue<number>; atoms: string[]; tone: (el: string) => [string, string]; label: string }) {
  return (
    <motion.g style={{ x, y }}>
      <line x1={0} y1={0} x2={-56} y2={128} stroke="var(--line-2)" strokeWidth={1.2} />
      <line x1={0} y1={0} x2={56} y2={128} stroke="var(--line-2)" strokeWidth={1.2} />
      <circle r={3.2} fill="var(--ink-3)" />
      <g transform="translate(0 128)">
        <Pile atoms={atoms} tone={tone} />
        <path d="M -62 0 Q 0 16 62 0 Z" fill="color-mix(in oklab, var(--ink) 12%, var(--raised))" stroke="var(--line-2)" strokeWidth={1.2} />
        <text y={28} textAnchor="middle" fontSize={11.5} className="fill-ink-3 font-medium">
          {label}
        </text>
      </g>
    </motion.g>
  );
}

export function BalancingScale() {
  const t = useText();
  const locale = useLocale();
  const [pick, setPick] = useState(0);
  const preset = PRESETS[pick];
  const p = parts(preset.eq);
  const species = [...p.left, ...p.right];
  const [coefs, setCoefs] = useState<number[]>(() => species.map(() => 1));
  const eq = useMemo(() => parseEquation(preset.eq)!, [preset.eq]);
  const counts = sideCounts(eq, coefs);
  const elements = [...new Set([...Object.keys(counts.left), ...Object.keys(counts.right)])];
  const tone = (el: string) => TONES[elements.indexOf(el) % TONES.length];
  const off = elements.filter((el) => (counts.left[el] ?? 0) !== (counts.right[el] ?? 0));
  const balanced = off.length === 0;
  const g = gcdOf(coefs);
  const mL = molarMass(counts.left);
  const mR = molarMass(counts.right);
  const pile = (c: Record<string, number>) => elements.flatMap((el) => Array.from({ length: c[el] ?? 0 }, () => el));

  // Heavier side goes down; the spring makes the beam wobble into place.
  const diff = mR - mL;
  const tilt = balanced ? 0 : Math.max(-13, Math.min(13, 13 * Math.tanh(diff / (0.25 * Math.max(mL, mR, 1))) + (Math.abs(diff) < 0.5 ? Math.sign(diff || 1) * 3 : 0)));
  const angle = useSpring(0, { stiffness: 90, damping: 9, mass: 1.1 });
  useEffect(() => {
    angle.set(tilt);
  }, [angle, tilt]);
  const C = { x: 200, y: 34 };
  const HALF = 130;
  const rad = (a: number) => (a * Math.PI) / 180;
  const lx = useTransform(angle, (a) => C.x - HALF * cos(rad(a)));
  const ly = useTransform(angle, (a) => C.y - HALF * sin(rad(a)));
  const rx = useTransform(angle, (a) => C.x + HALF * cos(rad(a)));
  const ry = useTransform(angle, (a) => C.y + HALF * sin(rad(a)));

  const choose = (i: number) => {
    setPick(i);
    setCoefs([...parts(PRESETS[i].eq).left, ...parts(PRESETS[i].eq).right].map(() => 1));
  };
  const set = (i: number, v: number) => setCoefs((c) => c.map((x, j) => (j === i ? v : x)));
  const mass = (m: number) => `${dec(m, locale, 2)} u`;

  const status: { tone: "ok" | "blob" | "ink"; text: Text } = balanced
    ? g > 1
      ? {
          tone: "blob",
          text: tx(
            `Balanced, but it goes smaller: all your numbers can be divided by ${g}.`,
            `Ausgeglichen, aber es geht kleiner: Alle deine Zahlen lassen sich durch ${g} teilen.`,
          ),
        }
      : {
          tone: "ok",
          text: tx(
            "Balanced! Every kind of atom is the same on both sides, so the mass is the same too.",
            "Ausgeglichen! Jede Atomsorte ist links und rechts gleich oft da, also ist auch die Masse gleich.",
          ),
        }
    : {
        tone: "ink",
        text: tx(
          `Not yet: ${off.map((el) => `${el} ${counts.left[el] ?? 0} | ${counts.right[el] ?? 0}`).join(", ")}. Change the big numbers in front.`,
          `Noch nicht: ${off.map((el) => `${el} ${counts.left[el] ?? 0} | ${counts.right[el] ?? 0}`).join(", ")}. Ändere die großen Zahlen davor.`,
        ),
      };

  const speciesCell = (s: string, i: number) => (
    <div key={`${pick}-${i}`} className="flex flex-col items-center gap-1.5">
      <Stepper value={coefs[i]} onChange={(v) => set(i, v)} label={s} />
      <div className="flex h-11 items-center">
        <MathView src={`${coefs[i] > 1 ? `${coefs[i]}#k ` : ""}\\ce{${s}}`} size="md" scope={`bs-${pick}-${i}`} highlight={coefs[i] > 1 ? ["k"] : []} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setCoefs(species.map(() => 1))}
          className="grid size-8 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-hover hover:text-ink"
          aria-label={t(tx("Reset", "Zurücksetzen"))}
          title={t(tx("Reset", "Zurücksetzen"))}
        >
          <RotateCcw className="size-3.5" />
        </button>
        {PRESETS.map((pr, i) => (
          <button
            key={pr.eq}
            type="button"
            onClick={() => choose(i)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              i === pick ? "border-transparent bg-blob text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            {t(pr.name)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-start justify-center gap-x-2 gap-y-3 rounded-xl border border-line bg-surface px-2 py-3 sm:gap-x-3">
        {p.left.map((s, i) => (
          <div key={`l${i}`} className="flex items-start gap-x-2 sm:gap-x-3">
            {i > 0 && <span className="mt-12 text-[22px] text-ink-3">+</span>}
            {speciesCell(s, i)}
          </div>
        ))}
        <span className="mt-12 px-1 text-[22px] text-ink-2">→</span>
        {p.right.map((s, i) => (
          <div key={`r${i}`} className="flex items-start gap-x-2 sm:gap-x-3">
            {i > 0 && <span className="mt-12 text-[22px] text-ink-3">+</span>}
            {speciesCell(s, p.left.length + i)}
          </div>
        ))}
      </div>

      <div className="grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <svg viewBox="0 0 400 262" className="mx-auto w-full max-w-[460px]" role="img" aria-label={t(tx("Beam balance with the atoms of both sides", "Balkenwaage mit den Atomen beider Seiten"))}>
          <path d="M 200 34 L 200 236" stroke="var(--line-2)" strokeWidth={5} strokeLinecap="round" />
          <path d="M 150 248 Q 200 230 250 248 Z" fill="var(--line-2)" />
          <motion.line x1={lx} y1={ly} x2={rx} y2={ry} stroke="var(--ink-2)" strokeWidth={4.5} strokeLinecap="round" />
          <circle cx={200} cy={34} r={7} fill={balanced ? "var(--ok)" : "var(--ink-2)"} className="transition-colors duration-300" />
          <Pan x={lx} y={ly} atoms={pile(counts.left)} tone={tone} label={t(tx("Reactants", "Edukte"))} />
          <Pan x={rx} y={ry} atoms={pile(counts.right)} tone={tone} label={t(tx("Products", "Produkte"))} />
        </svg>

        <div className="space-y-2">
          <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-2 gap-y-1.5 rounded-xl border border-line bg-surface p-3 text-[14px]">
            <span />
            <span className="text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("left", "links"))}</span>
            <span />
            <span className="text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("right", "rechts"))}</span>
            {elements.map((el) => {
              const l = counts.left[el] ?? 0;
              const r = counts.right[el] ?? 0;
              const ok = l === r;
              const [fill, ink] = tone(el);
              return (
                <div key={el} className="contents">
                  <span className="grid size-7 place-items-center rounded-full text-[11.5px] font-semibold" style={{ background: fill, color: ink }}>
                    {el}
                  </span>
                  <motion.span key={`l${l}`} initial={{ scale: 1.35 }} animate={{ scale: 1 }} className="text-center font-math text-[19px] tabular-nums">
                    {l}
                  </motion.span>
                  <span className={cn("grid size-6 place-items-center rounded-full", ok ? "bg-ok/15 text-ok" : "bg-danger/10 text-danger")}>
                    {ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
                  </span>
                  <motion.span key={`r${r}`} initial={{ scale: 1.35 }} animate={{ scale: 1 }} className="text-center font-math text-[19px] tabular-nums">
                    {r}
                  </motion.span>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-2 px-3 text-[12.5px] text-ink-3">
            <span className="w-7">{t(tx("Mass", "Masse"))}</span>
            <span className="text-center tabular-nums">{mass(mL)}</span>
            <span className="w-6" />
            <span className="text-center tabular-nums">{mass(mR)}</span>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={`${pick}-${balanced}-${g}-${off.join()}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className={cn(
            "rounded-xl px-3.5 py-2.5 text-[14px] leading-relaxed",
            status.tone === "ok" ? "bg-ok/10 text-ink" : status.tone === "blob" ? "bg-blob-soft/60 text-ink" : "bg-hover/60 text-ink-2",
          )}
        >
          {status.tone === "ok" && <Check className="mr-1.5 inline size-4 text-ok" strokeWidth={3} />}
          {t(status.text)}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
