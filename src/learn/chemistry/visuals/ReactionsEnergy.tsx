"use client";

import { animate, motion, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import { FlaskConical, Play, RotateCcw, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

// Energy diagrams (Energiediagramme): reactants and products as energy levels with the
// "energy hill" of the activation energy between them. The widget lets students switch
// exothermic/endothermic, drag a catalyst onto the diagram and push the particles over
// the hill; `EnergyDiagram` is the same picture without controls, for tasks.

export type EnergyKind = "exo" | "endo";

const LEVELS: Record<EnergyKind, { r: number; p: number; peak: number; cat: number }> = {
  exo: { r: 58, p: 18, peak: 93, cat: 73 },
  endo: { r: 22, p: 62, peak: 95, cat: 79 },
};

const X0 = 58;
const W = 390;
const Y0 = 252;
const K = 2.02;
const xs = (t: number) => X0 + t * W;
const ys = (e: number) => Y0 - e * K;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Energy along the reaction: plateau, hill, plateau. */
function energyAt(t: number, r: number, p: number, peak: number) {
  const u = Math.min(1, Math.max(0, (t - 0.32) / 0.36));
  const s = u * u * (3 - 2 * u);
  const b = Math.exp(-(((t - 0.5) / 0.12) ** 2));
  return r + (p - r) * s + (peak - (r + p) / 2) * b;
}

/** Highest point of the curve. */
function topOf(r: number, p: number, peak: number) {
  let best = { t: 0.5, e: -Infinity };
  for (let i = 300; i <= 700; i++) {
    const t = i / 1000;
    const e = energyAt(t, r, p, peak);
    if (e > best.e) best = { t, e };
  }
  return best;
}

function pathOf(r: number, p: number, peak: number) {
  let d = "";
  for (let i = 0; i <= 96; i++) {
    const t = i / 96;
    d += `${i ? "L" : "M"} ${r2(xs(t))} ${r2(ys(energyAt(t, r, p, peak)))} `;
  }
  return d.trim();
}

/** A motion value that springs to `target` whenever it changes (starts there, so static use doesn't animate). */
function useSpringTo(target: number) {
  const v = useSpring(target, { stiffness: 170, damping: 22 });
  useEffect(() => {
    v.set(target);
  }, [v, target]);
  return v;
}

type Curve = { r: MotionValue<number>; p: MotionValue<number>; peak: MotionValue<number>; ghost: MotionValue<number> };

function useCurve(kind: EnergyKind, catalyst: boolean): Curve {
  const L = LEVELS[kind];
  return { r: useSpringTo(L.r), p: useSpringTo(L.p), peak: useSpringTo(catalyst ? L.cat : L.peak), ghost: useSpringTo(L.peak) };
}

function Diagram({
  curve,
  catalyst,
  labels,
  tags,
  children,
  dropping,
}: {
  curve: Curve;
  catalyst: boolean;
  /** Arrow labels; default E_A and ΔE. */
  labels?: { ea?: string; de?: string };
  /** Peak labels [without, with catalyst]. */
  tags?: [string, string];
  children?: React.ReactNode;
  dropping?: boolean;
}) {
  const t = useText();
  const id = useId().replace(/:/g, "");
  const { r, p, peak, ghost } = curve;
  const d = useTransform([r, p, peak], ([a, b, c]: number[]) => pathOf(a, b, c));
  const dGhost = useTransform([r, p, ghost], ([a, b, c]: number[]) => pathOf(a, b, c));
  const topX = useTransform([r, p, peak], ([a, b, c]: number[]) => r2(xs(topOf(a, b, c).t)));
  const topY = useTransform([r, p, peak], ([a, b, c]: number[]) => r2(ys(topOf(a, b, c).e)));
  const ghostX = useTransform([r, p, ghost], ([a, b, c]: number[]) => r2(xs(topOf(a, b, c).t)));
  const ghostY = useTransform([r, p, ghost], ([a, b, c]: number[]) => r2(ys(topOf(a, b, c).e)));
  const yR = useTransform(r, (v) => r2(ys(v)));
  const yP = useTransform(p, (v) => r2(ys(v)));
  const eaTip = useTransform(topY, (v) => v + 3);
  const eaLabelY = useTransform([yR, topY], ([a, b]: number[]) => r2((a + b) / 2 + 4));
  const eaLabelX = useTransform(topX, (v) => v - 9);
  const deLabelY = useTransform([yR, yP], ([a, b]: number[]) => r2((a + b) / 2 + 4));
  const reactLabelY = useTransform(yR, (v) => v - 9);
  const prodLabelY = useTransform(yP, (v) => v - 9);
  const ghostOpacity = useSpringTo(catalyst || tags ? 1 : 0);
  const tagX = useTransform(topX, (v) => v + 16);
  const tagSideY = useTransform(topY, (v) => v + 8);
  const ghostTagY = useTransform(ghostY, (v) => v - 10);
  const xDE = xs(0.935);
  const ea = labels?.ea ?? "E_A";
  const de = labels?.de ?? "ΔE";
  const sub = (s: string) =>
    s.includes("_") ? (
      <>
        {s.split("_")[0]}
        <tspan fontSize="0.72em" dy="0.3em">
          {s.split("_")[1]}
        </tspan>
      </>
    ) : (
      s
    );

  return (
    <svg viewBox="0 0 470 290" className={cn("w-full rounded-xl transition-colors", dropping && "bg-blob-soft/50")} role="img" aria-label={t(tx("Energy diagram", "Energiediagramm"))}>
      <defs>
        <marker id={`${id}-h`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--blob)" />
        </marker>
        <marker id={`${id}-a`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--ink-3)" />
        </marker>
      </defs>
      {/* axes */}
      <line x1={X0 - 16} y1={Y0 + 18} x2={X0 - 16} y2={22} stroke="var(--ink-3)" strokeWidth={1.4} markerEnd={`url(#${id}-a)`} />
      <line x1={X0 - 16} y1={Y0 + 18} x2={xs(1) + 12} y2={Y0 + 18} stroke="var(--ink-3)" strokeWidth={1.4} markerEnd={`url(#${id}-a)`} />
      <text x={X0 - 8} y={26} fontSize={14} className="fill-ink-3">
        {t(tx("Energy", "Energie"))}
      </text>
      <text x={xs(1) + 8} y={Y0 + 36} fontSize={14} textAnchor="end" className="fill-ink-3">
        {t(tx("Course of reaction", "Reaktionsverlauf"))}
      </text>

      {/* reference line at the reactants' level */}
      <motion.line x1={xs(0.22)} x2={xDE + 8} y1={yR} y2={yR} stroke="var(--line-2)" strokeWidth={1.2} strokeDasharray="4 4" />

      {/* curve without catalyst (faint when the catalyst is on) */}
      <motion.path d={dGhost} fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="6 5" style={{ opacity: ghostOpacity }} />
      <motion.path d={d} fill="none" stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />

      <motion.text x={xs(0)} y={reactLabelY} textAnchor="start" fontSize={15} fontWeight={600} className="fill-ink">
        {t(tx("Reactants", "Edukte"))}
      </motion.text>
      <motion.text x={xs(0.8)} y={prodLabelY} textAnchor="middle" fontSize={15} fontWeight={600} className="fill-ink">
        {t(tx("Products", "Produkte"))}
      </motion.text>

      {/* activation energy */}
      <motion.line x1={topX} x2={topX} y1={yR} y2={eaTip} stroke="var(--blob)" strokeWidth={2} markerEnd={`url(#${id}-h)`} markerStart={`url(#${id}-h)`} />
      <motion.text x={eaLabelX} y={eaLabelY} textAnchor="end" fontSize={16} fontWeight={600} className="fill-blob-ink">
        {sub(ea)}
      </motion.text>

      {/* reaction energy */}
      <motion.line x1={xDE} x2={xDE} y1={yR} y2={yP} stroke="var(--blob)" strokeWidth={2} markerEnd={`url(#${id}-h)`} />
      <motion.text x={xDE - 9} y={deLabelY} textAnchor="end" fontSize={16} fontWeight={600} className="fill-blob-ink">
        {de}
      </motion.text>

      {tags ? (
        <>
          <motion.text x={ghostX} y={ghostTagY} textAnchor="middle" fontSize={13} fontWeight={700} className="fill-ink-2">
            {tags[0]}
          </motion.text>
          <motion.text x={tagX} y={tagSideY} textAnchor="start" fontSize={13} fontWeight={700} className="fill-ink-2">
            {tags[1]}
          </motion.text>
        </>
      ) : (
        catalyst && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} fontSize={13}>
            <line x1={300} x2={324} y1={30} y2={30} stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="6 5" />
            <text x={330} y={34.5} className="fill-ink-3">
              {t(tx("without catalyst", "ohne Katalysator"))}
            </text>
            <line x1={300} x2={324} y1={50} y2={50} stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />
            <text x={330} y={54.5} className="fill-ink-2">
              {t(tx("with catalyst", "mit Katalysator"))}
            </text>
          </motion.g>
        )
      )}
      {children}
    </svg>
  );
}

/** A static energy diagram for tasks. */
export function EnergyDiagram({ kind, catalyst = false, labels, tags }: { kind: EnergyKind; catalyst?: boolean; labels?: { ea?: string; de?: string }; tags?: [string, string] }) {
  const curve = useCurve(kind, catalyst || Boolean(tags));
  return (
    <div className="mx-auto max-w-[480px]">
      <Diagram curve={curve} catalyst={catalyst} labels={labels} tags={tags} />
    </div>
  );
}

type Run = "idle" | "running" | "made" | "failed";

/** Where the particles wait on the reactants' level. */
const START = 0.17;

/** The lesson widget: exo/endo, catalyst (drag it onto the diagram) and a push over the energy hill. */
export function ReactionsEnergy() {
  const t = useText();
  const [kind, setKind] = useState<EnergyKind>("exo");
  const [catalyst, setCatalyst] = useState(false);
  const [supply, setSupply] = useState(26);
  const [run, setRun] = useState<Run>("idle");
  const [dropping, setDropping] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const curve = useCurve(kind, catalyst);
  const s = useMotionValue(START);
  const ballX = useTransform(s, (v) => r2(xs(v)));
  const ballY = useTransform([s, curve.r, curve.p, curve.peak], ([v, a, b, c]: number[]) => r2(ys(energyAt(v, a, b, c)) - 10));
  const supplyY = useTransform(curve.r, (v) => r2(ys(Math.min(100, v + supply))));

  const L = LEVELS[kind];
  const top = topOf(L.r, L.p, catalyst ? L.cat : L.peak);
  const ea = top.e - L.r;

  const reset = () => {
    s.stop();
    s.set(START);
    setRun("idle");
  };
  const push = () => {
    s.set(START);
    setRun("running");
    if (supply >= ea - 0.5) {
      animate(s, 0.93, { duration: 2, ease: [0.5, 0, 0.3, 1] }).then(() => setRun("made"));
    } else {
      let tm = START;
      for (let v = START; v <= top.t; v += 0.002) {
        if (energyAt(v, L.r, L.p, catalyst ? L.cat : L.peak) - L.r > supply) break;
        tm = v;
      }
      animate(s, [START, tm, START], { duration: 1.9, times: [0, 0.5, 1], ease: ["easeOut", "easeIn"] }).then(() => setRun("failed"));
    }
  };
  const toggleCatalyst = (on: boolean) => {
    setCatalyst(on);
    reset();
  };
  const inZone = (x: number, y: number) => {
    const b = zone.current?.getBoundingClientRect();
    return Boolean(b && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom);
  };

  const info: Text =
    run === "made"
      ? kind === "exo"
        ? tx(
            "Made it! The particles get over the hill and the reaction runs. The energy it releases can push the next particles over: it keeps going by itself.",
            "Geschafft! Die Teilchen kommen über den Berg und die Reaktion läuft. Die frei werdende Energie stößt die nächsten Teilchen an: Sie läuft von selbst weiter.",
          )
        : tx(
            "Made it! But the products sit higher than the reactants: the reaction keeps taking in energy. Stop heating and it stops.",
            "Geschafft! Aber die Produkte liegen höher als die Edukte: Die Reaktion nimmt ständig Energie auf. Hörst du auf zu erhitzen, stoppt sie.",
          )
      : run === "failed"
        ? tx(
            "Not enough energy: the particles don't get over the hill and roll back. No reaction. Give more energy, or try a catalyst.",
            "Zu wenig Energie: Die Teilchen schaffen den Berg nicht und rollen zurück. Keine Reaktion. Gib mehr Energie oder probier einen Katalysator.",
          )
        : catalyst
          ? tx(
              "With a catalyst the hill is lower: the activation energy drops and the reaction starts more easily and runs faster. Look at ΔE: it stays exactly the same.",
              "Mit Katalysator ist der Berg niedriger: Die Aktivierungsenergie sinkt, die Reaktion springt leichter an und läuft schneller. Schau auf ΔE: Es bleibt genau gleich.",
            )
          : kind === "exo"
            ? tx(
                "Exothermic: the products have less energy than the reactants. The difference ΔE is released as heat or light. But first the particles need a push over the hill: the activation energy.",
                "Exotherm: Die Produkte haben weniger Energie als die Edukte. Der Unterschied ΔE wird frei, als Wärme oder Licht. Aber zuerst brauchen die Teilchen einen Schubs über den Berg: die Aktivierungsenergie.",
              )
            : tx(
                "Endothermic: the products have more energy than the reactants. The reaction takes in the difference ΔE from its surroundings, so you have to keep supplying energy.",
                "Endotherm: Die Produkte haben mehr Energie als die Edukte. Die Reaktion nimmt den Unterschied ΔE aus der Umgebung auf. Du musst also ständig Energie zuführen.",
              );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex rounded-lg border border-line p-0.5">
          {(["exo", "endo"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                reset();
              }}
              className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", kind === k ? "text-ink" : "text-ink-3 hover:text-ink")}
            >
              {kind === k && <motion.span layoutId="energy-kind" className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">{k === "exo" ? t(tx("Exothermic", "Exotherm")) : t(tx("Endothermic", "Endotherm"))}</span>
            </button>
          ))}
        </div>

        {catalyst ? (
          <button
            type="button"
            onClick={() => toggleCatalyst(false)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-blob px-3.5 text-[13px] font-semibold text-white"
          >
            <FlaskConical className="size-4" /> {t(tx("Catalyst on", "Katalysator dabei"))} <X className="size-3.5 opacity-80" />
          </button>
        ) : (
          <motion.button
            type="button"
            drag
            dragSnapToOrigin
            dragElastic={0.6}
            whileDrag={{ scale: 1.08, zIndex: 30 }}
            onDrag={(_, info) => setDropping(inZone(info.point.x - window.scrollX, info.point.y - window.scrollY))}
            onDragEnd={(_, info) => {
              setDropping(false);
              if (inZone(info.point.x - window.scrollX, info.point.y - window.scrollY)) toggleCatalyst(true);
            }}
            onTap={() => toggleCatalyst(true)}
            className="relative flex h-9 cursor-grab touch-none items-center gap-1.5 rounded-full border-2 border-dashed border-blob/60 bg-blob-soft px-3.5 text-[13px] font-semibold text-blob-ink shadow-card active:cursor-grabbing"
          >
            <FlaskConical className="size-4" /> {t(tx("Drag the catalyst onto the diagram", "Zieh den Katalysator ins Diagramm"))}
          </motion.button>
        )}
      </div>

      <div ref={zone} className="rounded-xl border border-line bg-surface p-1.5 sm:p-3">
        <div className="mx-auto max-w-[620px]">
        <Diagram curve={curve} catalyst={catalyst} dropping={dropping}>
          <motion.line x1={xs(0.03)} x2={xs(0.5)} y1={supplyY} y2={supplyY} stroke="var(--blob)" strokeWidth={1.4} strokeDasharray="2 4" opacity={0.8} />
          <motion.circle cx={ballX} cy={ballY} r={10} fill="var(--blob)" stroke="var(--raised)" strokeWidth={2} />
        </Diagram>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex min-w-[220px] flex-1 items-center gap-3 text-[13px] text-ink-2">
          <span className="shrink-0">{t(tx("Energy you supply", "Zugeführte Energie"))}</span>
          <input
            type="range"
            min={0}
            max={80}
            value={supply}
            onChange={(e) => {
              setSupply(Number(e.target.value));
              if (run !== "running") reset();
            }}
            className="w-full accent-[var(--blob)]"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={push}
            disabled={run === "running"}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-[14px] font-semibold text-paper transition-transform hover:bg-ink/88 active:scale-[0.97] disabled:opacity-50"
          >
            <Play className="size-4" /> {t(tx("Push", "Anstoßen"))}
          </button>
          <button
            type="button"
            onClick={reset}
            className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-hover hover:text-ink"
            aria-label={t(tx("Back to the start", "Zurück zum Start"))}
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
      </div>

      <motion.p
        key={`${kind}-${catalyst}-${run}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-xl px-3.5 py-2.5 text-[14px] leading-relaxed",
          run === "made" ? "bg-ok/10 text-ink" : run === "failed" ? "bg-danger/[0.07] text-ink" : "bg-hover/60 text-ink-2",
        )}
      >
        {t(info)}
      </motion.p>
    </div>
  );
}
