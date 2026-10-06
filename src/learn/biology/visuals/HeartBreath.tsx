"use client";

// Breathing in and out (level 1): the lungs fill and empty, the bars compare inhaled and exhaled
// air, and a limewater test shows the carbon dioxide in exhaled air. A static bar chart serves
// as a task picture.

import { animate, motion, useReducedMotion } from "motion/react";
import { RotateCcw, Wind } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { dec } from "@/learn/chemistry/format";
import { cn } from "@/lib/utils";
import { HeartAirways } from "./HeartAirways";
import { Chip, MainButton, noise, SoftButton, svgText } from "./HeartShared";

export type Gas = "n2" | "o2" | "co2" | "other";
export const AIR: Record<"in" | "out", Record<Gas, number>> = {
  in: { n2: 78, o2: 21, co2: 0.04, other: 1 },
  out: { n2: 78, o2: 16, co2: 4, other: 1 },
};
export const GAS_NAME: Record<Gas, Text> = {
  n2: tx("nitrogen", "Stickstoff"),
  o2: tx("oxygen", "Sauerstoff"),
  co2: tx("carbon dioxide", "Kohlenstoffdioxid"),
  other: tx("noble gases", "Edelgase"),
};
const GAS_COL: Record<Gas, string> = { n2: "var(--ink-3)", o2: "var(--bio-water-deep)", co2: "var(--bio-mito-deep)", other: "var(--bio-nucleus-deep)" };

/** Percent for display: "0,04 %" / "0.04 %". */
const pct = (v: number, l: "de" | "en") => `${dec(v, l, 2)} %`;

function Bars({ which, active, ask }: { which: "in" | "out"; active: boolean; ask?: Gas }) {
  const t = useText();
  const locale = useLocale();
  const gases: Gas[] = ["n2", "o2", "co2", "other"];
  return (
    <div className={cn("rounded-xl border px-3.5 py-3 transition-colors", active ? "border-blob/50 bg-blob-soft/50" : "border-line bg-surface")}>
      <div className="mb-2 text-[13.5px] font-semibold text-ink">{which === "in" ? t(tx("Inhaled air", "Einatemluft")) : t(tx("Exhaled air", "Ausatemluft"))}</div>
      <div className="space-y-1.5">
        {gases.map((g) => {
          const v = AIR[which][g];
          return (
            <div key={g} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3.6rem] items-center gap-2 text-[12.5px]">
              <span className="truncate text-ink-2">{t(GAS_NAME[g])}</span>
              <span className="h-3 overflow-hidden rounded-full bg-hover">
                <motion.span className="block h-full rounded-full" style={{ background: GAS_COL[g] }} initial={false} animate={{ width: `${Math.max(v, 0.8)}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
              </span>
              <span className={cn("text-right font-math tabular-nums", g === "o2" || g === "co2" ? "font-semibold text-ink" : "text-ink-2")}>{ask === g ? "?" : pct(v, locale)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Inhaled vs exhaled air as two bar charts (one value may be hidden as "?"). */
export function HeartAirBars({ ask, askIn }: { ask?: Gas; askIn?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Bars which="in" active={false} ask={askIn ? ask : undefined} />
      <Bars which="out" active={false} ask={askIn ? undefined : ask} />
    </div>
  );
}

/** A test tube with limewater; `cloud` 0 … 1 makes it milky. */
function Tube({ x, cloud, bubbling, label }: { x: number; cloud: number; bubbling: boolean; label: string }) {
  return (
    <g>
      <path d={`M${x - 22} 20 L${x - 22} 150 C${x - 22} 176 ${x + 22} 176 ${x + 22} 150 L${x + 22} 20`} fill="none" stroke="var(--bio-outline)" strokeWidth={2} />
      <path d={`M${x - 21} 60 L${x - 21} 150 C${x - 21} 174 ${x + 21} 174 ${x + 21} 150 L${x + 21} 60 Z`} fill="var(--bio-vacuole)" />
      <path d={`M${x - 21} 60 L${x - 21} 150 C${x - 21} 174 ${x + 21} 174 ${x + 21} 150 L${x + 21} 60 Z`} fill="var(--bio-bone)" opacity={cloud * 0.95} />
      <path d={`M${x - 6} 0 L${x - 6} 156`} stroke="var(--ink-3)" strokeWidth={3} strokeLinecap="round" />
      {bubbling &&
        [0, 1, 2, 3, 4].map((i) => (
          <motion.circle
            key={i}
            cx={x - 4 + noise(i, x) * 10}
            r={3 + noise(i, x + 1) * 2}
            fill="none"
            stroke="var(--bio-outline)"
            strokeWidth={1}
            initial={{ cy: 156, opacity: 0 }}
            animate={{ cy: [156, 66], opacity: [0, 1, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22, ease: "easeOut" }}
          />
        ))}
      <text x={x} y={196} textAnchor="middle" fontSize={12} fill="var(--ink-2)" style={svgText}>
        {label}
      </text>
    </g>
  );
}

export function HeartBreathWidget() {
  const t = useText();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [breath, setBreath] = useState(0);
  const [cloud, setCloud] = useState<{ in: number; out: number }>({ in: 0, out: 0 });
  const [bubbling, setBubbling] = useState<"in" | "out" | null>(null);
  const ctrl = useRef<ReturnType<typeof animate>[]>([]);
  useEffect(() => () => ctrl.current.forEach((c) => c.stop()), []);

  const breathe = (p: "in" | "out") => {
    setPhase(p);
    const to = p === "in" ? 1 : 0;
    if (reduce) return setBreath(to);
    ctrl.current.push(animate(breath, to, { duration: 1.6, ease: "easeInOut", onUpdate: setBreath }));
  };
  const blow = (which: "in" | "out") => {
    if (bubbling) return;
    setBubbling(which);
    const target = which === "out" ? 1 : 0.04;
    const run = animate(cloud[which], target, {
      duration: reduce ? 0.01 : 2.4,
      onUpdate: (v) => setCloud((c) => ({ ...c, [which]: v })),
      onComplete: () => setBubbling(null),
    });
    ctrl.current.push(run);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center">
        <div className="relative">
          <HeartAirways mode="plain" breath={breath} />
          <motion.div
            className="pointer-events-none absolute left-[22%] top-[17%] text-blob"
            initial={false}
            animate={{ x: phase === "in" ? 8 : -14, opacity: reduce ? 1 : [0.2, 1, 0.2] }}
            transition={{ duration: 1.6, repeat: reduce ? 0 : Infinity }}
          >
            <Wind className={cn("size-6", phase === "in" ? "" : "-scale-x-100")} />
          </motion.div>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Chip on={phase === "in"} onClick={() => breathe("in")}>
              {t(tx("Breathe in", "Einatmen"))}
            </Chip>
            <Chip on={phase === "out"} onClick={() => breathe("out")}>
              {t(tx("Breathe out", "Ausatmen"))}
            </Chip>
          </div>
          <Bars which="in" active={phase === "in"} />
          <Bars which="out" active={phase === "out"} />
          <p className="text-[13px] leading-relaxed text-ink-2">
            {t(
              tx(
                "Your body keeps about 5 % of the oxygen and gives off about 4 % carbon dioxide. Exhaled air still contains plenty of oxygen: that's why rescue breaths work.",
                "Dein Körper behält etwa 5 % Sauerstoff und gibt etwa 4 % Kohlenstoffdioxid ab. In der Ausatemluft ist noch viel Sauerstoff: Darum funktioniert die Atemspende.",
              ),
            )}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-3.5">
        <div className="text-[14px] font-semibold text-ink">{t(tx("Experiment: limewater", "Versuch: Kalkwasser"))}</div>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
          {t(tx("Limewater turns milky when carbon dioxide bubbles through it. Pump room air through one tube and blow your breath through the other.", "Kalkwasser wird milchig trüb, wenn Kohlenstoffdioxid hindurchperlt. Pumpe Raumluft durch das eine Röhrchen und puste deine Atemluft durch das andere."))}
        </p>
        <div className="mt-2 grid items-center gap-3 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <svg viewBox="0 0 220 204" className="mx-auto block h-auto w-full max-w-[240px]" role="img" aria-label={t(tx("Two test tubes with limewater", "Zwei Reagenzgläser mit Kalkwasser"))}>
            <Tube x={60} cloud={cloud.in} bubbling={bubbling === "in"} label={t(tx("room air", "Raumluft"))} />
            <Tube x={160} cloud={cloud.out} bubbling={bubbling === "out"} label={t(tx("exhaled air", "Ausatemluft"))} />
          </svg>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <MainButton onClick={() => blow("in")} disabled={!!bubbling} className="h-9 text-[13px]">
                {t(tx("Pump room air", "Raumluft pumpen"))}
              </MainButton>
              <MainButton onClick={() => blow("out")} disabled={!!bubbling} className="h-9 text-[13px]">
                {t(tx("Blow into it", "Hineinpusten"))}
              </MainButton>
              <SoftButton onClick={() => setCloud({ in: 0, out: 0 })} disabled={!!bubbling} label={t(tx("Fresh limewater", "Frisches Kalkwasser"))}>
                <RotateCcw className="size-4" />
              </SoftButton>
            </div>
            <p className="min-h-[2.8rem] text-[13.5px] leading-relaxed text-ink-2" aria-live="polite">
              {cloud.out > 0.6
                ? t(tx("Exhaled air turns limewater milky: it contains much more carbon dioxide than room air.", "Ausatemluft trübt das Kalkwasser: Sie enthält viel mehr Kohlenstoffdioxid als Raumluft."))
                : cloud.in > 0.02 && !bubbling
                  ? t(tx("Room air: the limewater stays almost clear. There is only very little carbon dioxide in it (0.04 %).", "Raumluft: Das Kalkwasser bleibt fast klar. Darin ist nur sehr wenig Kohlenstoffdioxid (0,04 %)."))
                  : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
