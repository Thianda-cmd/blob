"use client";

// Control of the cell cycle: a cell runs round the cycle and is checked at the checkpoints.
// Add DNA damage and switch p53 off to see how a tumour starts.

import { motion, useReducedMotion } from "motion/react";
import { Pause, Play, RotateCcw, StepForward } from "lucide-react";
import { useEffect, useReducer, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

type Damage = "none" | "light" | "severe";
type Status = "run" | "arrest" | "dead";

const C = 130;
const R = 92;
const RING = 30;
/** Phases as arcs (degrees clockwise from the top). */
const ARCS: { id: string; from: number; to: number; fill: string; label: string }[] = [
  { id: "g1", from: 0, to: 150, fill: "var(--bio-leaf)", label: "G1" },
  { id: "s", from: 150, to: 250, fill: "var(--bio-nucleus)", label: "S" },
  { id: "g2", from: 250, to: 300, fill: "var(--bio-vacuole)", label: "G2" },
  { id: "m", from: 300, to: 360, fill: "var(--bio-petal)", label: "M" },
];
/** Where the cell sits after each step. */
const POS = [70, 150, 200, 275, 300, 316, 340, 354];
const CHECKS = [150, 300, 340];

const pt = (deg: number, r: number) => [C + r * Math.sin((deg * Math.PI) / 180), C - r * Math.cos((deg * Math.PI) / 180)] as const;
function arc(from: number, to: number) {
  const [x1, y1] = pt(from, R + RING / 2);
  const [x2, y2] = pt(to, R + RING / 2);
  const [x3, y3] = pt(to, R - RING / 2);
  const [x4, y4] = pt(from, R - RING / 2);
  const big = to - from > 180 ? 1 : 0;
  return `M${x1} ${y1}A${R + RING / 2} ${R + RING / 2} 0 ${big} 1 ${x2} ${y2}L${x3} ${y3}A${R - RING / 2} ${R - RING / 2} 0 ${big} 0 ${x4} ${y4}Z`;
}

const SAY: Record<string, Text> = {
  start: tx("A body cell in G1. Press a button to run it round the cell cycle.", "Eine Körperzelle in G1. Drück einen Knopf, um sie durch den Zellzyklus zu schicken."),
  g1ok: tx("G1 checkpoint: is the cell big enough, are there growth signals, is the DNA intact? Yes: go on to S phase.", "G1-Kontrollpunkt: Ist die Zelle groß genug, gibt es Wachstumssignale, ist die DNA intakt? Ja: weiter in die S-Phase."),
  arrest: tx("The DNA damage activates p53. It stops the cycle at the G1 checkpoint (cell cycle arrest).", "Der DNA-Schaden aktiviert p53. Es stoppt den Zyklus am G1-Kontrollpunkt (Zellzyklus-Arrest)."),
  repaired: tx("Repair enzymes fix the damage. Now p53 lets the cell continue.", "Reparaturenzyme beheben den Schaden. Jetzt lässt p53 die Zelle weiter."),
  dead: tx("Too much damage: p53 triggers apoptosis, programmed cell death. No faulty daughter cells!", "Zu viel Schaden: p53 löst die Apoptose aus, den programmierten Zelltod. Keine fehlerhaften Tochterzellen!"),
  slip: tx("p53 is mutated: nobody stops the cell. It enters S phase with damaged DNA!", "p53 ist mutiert: Niemand stoppt die Zelle. Sie geht mit geschädigter DNA in die S-Phase!"),
  s: tx("S phase: the DNA is replicated.", "S-Phase: Die DNA wird repliziert."),
  sBad: tx("S phase: the damage is copied too. Now it is a mutation that daughter cells inherit.", "S-Phase: Der Schaden wird mitkopiert. Jetzt ist er eine Mutation, die die Tochterzellen erben."),
  g2: tx("G2 phase: the cell gets ready for mitosis.", "G2-Phase: Die Zelle bereitet die Mitose vor."),
  g2ok: tx("G2 checkpoint: has all the DNA been replicated completely? Then mitosis may start.", "G2-Kontrollpunkt: Ist die DNA vollständig repliziert? Dann darf die Mitose beginnen."),
  meta: tx("Mitosis: the chromosomes line up in the equatorial plane.", "Mitose: Die Chromosomen ordnen sich in der Äquatorialebene an."),
  spindle: tx("Spindle checkpoint: is every chromosome attached to spindle fibres from both poles? Only then does anaphase start.", "Spindelkontrollpunkt: Hängt jedes Chromosom an Spindelfasern von beiden Polen? Erst dann beginnt die Anaphase."),
  split: tx("Anaphase, telophase and cytokinesis: two daughter cells.", "Anaphase, Telophase und Cytokinese: zwei Tochterzellen."),
  tumour: tx("Mutations pile up and the cells keep dividing without control: a tumour grows. This is how cancer starts.", "Mutationen häufen sich, und die Zellen teilen sich unkontrolliert weiter: Ein Tumor wächst. So entsteht Krebs."),
};

type State = { step: number; lap: number; damage: Damage; p53: boolean; status: Status; carry: boolean; cells: number; mutations: number; say: string };
type Action = { type: "advance" } | { type: "reset" } | { type: "damage"; value: Damage } | { type: "p53"; value: boolean };
const START: State = { step: 0, lap: 0, damage: "none", p53: true, status: "run", carry: false, cells: 1, mutations: 0, say: "start" };

function reducer(st: State, a: Action): State {
  if (a.type === "reset") return { ...START, damage: st.damage, p53: st.p53 };
  if (a.type === "damage") return { ...st, damage: a.value };
  if (a.type === "p53") return { ...st, p53: a.value };
  if (st.status === "dead") return st;
  if (st.status === "arrest") return st.damage === "light" ? { ...st, damage: "none", status: "run", say: "repaired" } : { ...st, status: "dead", say: "dead" };
  const step = (st.step + 1) % POS.length;
  const next: State = { ...st, step, lap: step === 0 ? st.lap + 1 : st.lap };
  if (step === 1) {
    if (st.damage === "none") return { ...next, say: "g1ok" };
    return st.p53 ? { ...next, status: "arrest", say: "arrest" } : { ...next, carry: true, say: "slip" };
  }
  if (step === 2) return st.carry ? { ...next, carry: false, mutations: st.mutations + 1, say: "sBad" } : { ...next, say: "s" };
  if (step === 7) return { ...next, cells: Math.min(st.cells * 2, 1024), say: st.mutations >= 2 ? "tumour" : "split" };
  return { ...next, say: ["start", "", "", "g2", "g2ok", "meta", "spindle"][step] || "start" };
}

export function DivisionCheckpoints() {
  const t = useText();
  const reduce = useReducedMotion();
  const [st, dispatch] = useReducer(reducer, START);
  const [playing, setPlaying] = useState(false);
  const { step, lap, damage, p53, status, carry, cells, mutations, say } = st;
  const running = playing && status !== "dead";

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => dispatch({ type: "advance" }), 1300);
    return () => clearInterval(id);
  }, [running]);

  const advance = () => dispatch({ type: "advance" });
  const reset = () => {
    dispatch({ type: "reset" });
    setPlaying(false);
  };
  const setDamage = (value: Damage) => dispatch({ type: "damage", value });
  const setP53 = (value: boolean) => dispatch({ type: "p53", value });

  const angle = lap * 360 + POS[step];
  const mutated = mutations > 0;
  const choice = <T extends string | boolean>(value: T, current: T, set: (v: T) => void, label: Text) => (
    <button
      key={String(value)}
      type="button"
      aria-pressed={current === value}
      onClick={() => set(value)}
      className={cn("h-8 rounded-md px-2.5 text-[12.5px] font-medium transition-colors", current === value ? "bg-blob text-white" : "text-ink-2 hover:bg-hover hover:text-ink")}
    >
      {t(label)}
    </button>
  );

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] md:items-start">
      <svg viewBox="0 0 260 260" className="mx-auto block h-auto w-full max-w-[280px]" role="img" aria-label={t(tx("The cell cycle with its checkpoints", "Der Zellzyklus mit seinen Kontrollpunkten"))}>
        {ARCS.map((a) => {
          const [lx, ly] = pt(a.id === "m" ? 322 : (a.from + a.to) / 2, R);
          return (
            <g key={a.id}>
              <path d={arc(a.from, a.to)} fill={a.fill} stroke="var(--raised)" strokeWidth={2} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
                {a.label}
              </text>
            </g>
          );
        })}
        {CHECKS.map((d, i) => {
          const [x1, y1] = pt(d, R - RING / 2 - 4);
          const [x2, y2] = pt(d, R + RING / 2 + 4);
          const stop = i === 0 && status !== "run";
          return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stop ? "var(--danger)" : "var(--blob)"} strokeWidth={stop ? 5 : 3.5} strokeLinecap="round" />;
        })}
        {/* G0: cells that leave the cycle (e.g. nerve cells). */}
        <circle cx={226} cy={26} r={17} fill="var(--raised)" stroke="var(--line-2)" strokeWidth={1.5} strokeDasharray="3 3" />
        <text x={226} y={26} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
          G0
        </text>
        <path d="M209 28 Q 192 26 178 36" fill="none" stroke="var(--line-2)" strokeWidth={1.5} strokeDasharray="3 3" />
        <text x={C} y={C - 10} textAnchor="middle" fontSize={11} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
          {t(tx("cells", "Zellen"))}
        </text>
        <text x={C} y={C + 12} textAnchor="middle" fontSize={22} fontWeight={700} fill={mutated ? "var(--danger)" : "var(--ink)"} style={{ fontFamily: "var(--font-sans)" }}>
          {status === "dead" ? 0 : cells}
        </text>
        <motion.g initial={false} animate={{ rotate: angle }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 70, damping: 16 }} style={{ transformOrigin: `${C}px ${C}px`, transformBox: "view-box" }}>
          <g opacity={status === "dead" ? 0.35 : 1}>
            <circle cx={C} cy={C - R} r={13} fill="var(--bio-cell)" stroke={status === "dead" ? "var(--ink-3)" : mutated ? "var(--danger)" : "var(--bio-membrane)"} strokeWidth={2.5} />
            <circle cx={C} cy={C - R} r={5.5} fill={damage !== "none" || carry ? "var(--danger)" : "var(--bio-nucleus-deep)"} />
          </g>
        </motion.g>
      </svg>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[12.5px] font-semibold text-ink-3">{t(tx("DNA damage", "DNA-Schaden"))}</span>
            <div className="flex rounded-lg border border-line p-0.5">
              {choice<Damage>("none", damage, setDamage, tx("none", "keiner"))}
              {choice<Damage>("light", damage, setDamage, tx("small", "leicht"))}
              {choice<Damage>("severe", damage, setDamage, tx("severe", "schwer"))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[12.5px] font-semibold text-ink-3">p53</span>
            <div className="flex rounded-lg border border-line p-0.5">
              {choice<boolean>(true, p53, setP53, tx("intact", "intakt"))}
              {choice<boolean>(false, p53, setP53, tx("mutated", "mutiert"))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={advance} disabled={status === "dead"} className="flex h-10 items-center gap-1.5 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white active:scale-[0.97] disabled:opacity-40">
            <StepForward className="size-4" /> {t(tx("Next step", "Nächster Schritt"))}
          </button>
          {!reduce && (
            <button type="button" onClick={() => setPlaying(!running)} disabled={status === "dead"} className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-3.5 text-[14px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40">
              {running ? <Pause className="size-4" /> : <Play className="size-4" />} {t(running ? tx("Pause", "Pause") : tx("Run", "Laufen lassen"))}
            </button>
          )}
          <button type="button" onClick={reset} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
            <RotateCcw className="size-4" /> {t(tx("Reset", "Zurücksetzen"))}
          </button>
        </div>

        <motion.p key={`${say}-${step}-${lap}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cn("rounded-xl px-3.5 py-2.5 text-[14px] leading-relaxed", say === "dead" || say === "tumour" || say === "slip" || say === "sBad" ? "bg-danger/10 text-ink" : "bg-surface text-ink-2")} aria-live="polite">
          {t(SAY[say])}
        </motion.p>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
          <span>
            {t(tx("Mutations", "Mutationen"))}: <span className={cn("font-math text-[16px] font-semibold", mutated ? "text-danger" : "text-ink")}>{mutations}</span>
          </span>
          <span>
            {t(tx("Round", "Runde"))}: <span className="font-math text-[16px] font-semibold text-ink">{lap + 1}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-1" aria-hidden>
          {Array.from({ length: Math.min(status === "dead" ? 0 : cells, 64) }, (_, i) => (
            <span key={i} className={cn("size-3 rounded-full border", mutated ? "border-danger bg-danger/30" : "border-[var(--bio-membrane)] bg-[var(--bio-cell)]")} />
          ))}
        </div>
      </div>
    </div>
  );
}
