"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { Bold } from "./FlowerKit";

// Self-incompatibility with S-alleles. The style (pistil) of a cherry tree has the genotype
// S1S2. Pollen comes from different donors. Gametophytic SI (cherry): a pollen tube stops in the
// style if its own S-allele is also in the style. Sporophytic SI (cabbage): the pollen grain
// carries the S-proteins of both alleles of its parent plant and is rejected on the stigma if
// either matches.

type Mode = "gameto" | "sporo";
type Donor = "S1S2" | "S1S3" | "S3S4";
const STYLE = [1, 2];
const DONORS: Record<Donor, [number, number]> = { S1S2: [1, 2], S1S3: [1, 3], S3S4: [3, 4] };
const SUB = ["", "₁", "₂", "₃", "₄"];
const sName = (n: number) => `S${SUB[n]}`;
const COLOR = ["", "var(--bio-a)", "var(--bio-t)", "var(--bio-g)", "var(--bio-c)"];

const GX = (i: number) => 113 + i * 27;
const SX = (i: number) => 172 + i * 3.2;
const OVULES: [number, number][] = [
  [140, 300],
  [158, 322],
  [176, 334],
  [194, 334],
  [212, 322],
  [230, 300],
];
const STOP = [128, 150, 172, 138, 160, 182];

function tubePath(i: number, ok: boolean) {
  const g = GX(i);
  const s = SX(i);
  const start = `M ${g} 52 C ${g} 68, ${s} 72, ${s} 92`;
  if (!ok) return `${start} L ${s} ${STOP[i]}`;
  const [ox, oy] = OVULES[i];
  return `${start} L ${s} 262 C ${s} 286, ${ox} ${oy - 26}, ${ox} ${oy - 9}`;
}

export function compatibleShare(mode: Mode, donor: [number, number], style: number[] = STYLE) {
  if (mode === "sporo") return donor.some((a) => style.includes(a)) ? 0 : 1;
  return donor.filter((a) => !style.includes(a)).length / 2;
}

export function FlowerIncompat({ startMode = "gameto", startDonor = "S1S3" }: { startMode?: Mode; startDonor?: Donor }) {
  const t = useText();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>(startMode);
  const [donor, setDonor] = useState<Donor>(startDonor);
  const alleles = DONORS[donor];
  const grains = [0, 1, 2, 3, 4, 5].map((i) => alleles[i % 2]);
  const ok = grains.map((a) => (mode === "gameto" ? !STYLE.includes(a) : !alleles.some((x) => STYLE.includes(x))));
  const n = ok.filter(Boolean).length;
  const kids = [...new Set(STYLE.flatMap((s) => alleles.filter((a) => (mode === "gameto" ? !STYLE.includes(a) : n > 0)).map((a) => `${sName(Math.min(s, a))}${sName(Math.max(s, a))}`)))];
  const run = `${mode}-${donor}`;

  const seg = <T extends string>(value: T, set: (v: T) => void, items: [T, Text][]) => (
    <div className="flex flex-wrap rounded-xl border border-line bg-surface p-1">
      {items.map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => set(id)}
          className={cn("h-8 rounded-lg px-2.5 text-[13px] font-medium transition-colors", value === id ? "bg-blob text-white shadow-card" : "text-ink-2 hover:bg-hover hover:text-ink")}
        >
          {t(label)}
        </button>
      ))}
    </div>
  );

  const explain: Text =
    mode === "gameto"
      ? tx(
          "**Gametophytic SI** (cherry, apple, tobacco): every pollen grain is judged by its **own** S-allele. The style makes S-RNases; if the tube carries an allele that is also in the style, its RNA is destroyed and it stops in the style.",
          "**Gametophytische SI** (Kirsche, Apfel, Tabak): Jedes Pollenkorn wird nach seinem **eigenen** S-Allel beurteilt. Der Griffel bildet S-RNasen; trägt der Schlauch ein Allel, das auch im Griffel vorkommt, wird seine RNA abgebaut und er stoppt im Griffel.",
        )
      : tx(
          "**Sporophytic SI** (cabbage and other crucifers): the pollen coat carries S-proteins of **both** alleles of the parent plant (made by the anther wall). If either matches the stigma, the grain is rejected right on the stigma. (Simplified: both alleles act equally.)",
          "**Sporophytische SI** (Kohl und andere Kreuzblütler): Die Pollenhülle trägt S-Proteine **beider** Allele der Elternpflanze (gebildet von der Wand des Staubbeutels). Passt eines davon zur Narbe, wird das Korn schon auf der Narbe abgewiesen. (Vereinfacht: Beide Allele wirken gleich stark.)",
        );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {seg(mode, setMode, [
          ["gameto", tx("gametophytic (cherry)", "gametophytisch (Kirsche)")],
          ["sporo", tx("sporophytic (cabbage)", "sporophytisch (Kohl)")],
        ])}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
        <span>{t(tx("Pollen from a plant with:", "Pollen von einer Pflanze mit:"))}</span>
        {seg(donor, setDonor, [
          ["S1S2", tx("S₁S₂ (same tree)", "S₁S₂ (derselbe Baum)")],
          ["S1S3", "S₁S₃"],
          ["S3S4", "S₃S₄"],
        ])}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(200px,250px)] md:items-center">
        <svg viewBox="70 0 220 380" className="mx-auto block h-auto w-full" style={{ maxWidth: 300 }} role="img" aria-label={t(tx("Pistil with pollen tubes", "Stempel mit Pollenschläuchen"))}>
          {/* ovary with ovules */}
          <ellipse cx={180} cy={312} rx={72} ry={60} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={2} />
          <ellipse cx={180} cy={314} rx={60} ry={48} fill="var(--bio-cell)" stroke="var(--bio-leaf-deep)" strokeWidth={1} />
          {OVULES.map(([x, y]) => (
            <ellipse key={x} cx={x} cy={y} rx={8} ry={10} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.2} />
          ))}
          {/* style and stigma with the genotype S1S2 */}
          <path d="M 167 262 L 168 70 L 192 70 L 193 262 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} />
          <path d="M 96 64 C 96 40, 264 40, 264 64 C 240 74, 120 74, 96 64 Z" fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} />
          <text x={199} y={226} fontSize={12} fontWeight={700} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
            {t(tx("style", "Griffel"))}
          </text>
          <text x={199} y={242} fontSize={12} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
            S₁S₂
          </text>
          {/* tubes */}
          {grains.map((a, i) => (
            <motion.path
              key={`${run}-${i}`}
              d={tubePath(i, ok[i])}
              fill="none"
              stroke={COLOR[a]}
              strokeWidth={3}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: mode === "sporo" && !ok[i] ? 0 : 1, opacity: mode === "sporo" && !ok[i] ? 0 : 1 }}
              transition={reduce ? { duration: 0 } : { duration: ok[i] ? 2.2 : 1.2, delay: i * 0.12, ease: "easeInOut" }}
            />
          ))}
          {/* stops */}
          {grains.map((_, i) =>
            ok[i] ? null : (
              <motion.g
                key={`${run}-x${i}`}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: reduce ? 0 : mode === "gameto" ? 1.3 + i * 0.12 : 0.4 + i * 0.08 }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              >
                {(() => {
                  const x = mode === "gameto" ? SX(i) : GX(i);
                  const y = mode === "gameto" ? STOP[i] + 2 : 32;
                  return <path d={`M ${x - 4} ${y - 4} L ${x + 4} ${y + 4} M ${x + 4} ${y - 4} L ${x - 4} ${y + 4}`} stroke="var(--danger)" strokeWidth={2.4} strokeLinecap="round" />;
                })()}
              </motion.g>
            ),
          )}
          {/* pollen grains with their S-allele */}
          {grains.map((a, i) => (
            <g key={`g${i}`}>
              <circle cx={GX(i)} cy={50} r={9} fill={COLOR[a]} stroke="var(--bio-outline)" strokeWidth={1.3} />
              <text x={GX(i)} y={18} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
                {sName(a)}
              </text>
            </g>
          ))}
        </svg>
        <div className="space-y-2 text-[13.5px] leading-snug">
          <div className="rounded-xl border border-line bg-surface px-3 py-2" aria-live="polite">
            <div className="font-semibold text-ink">
              {t(tx(`${n} of 6 pollen tubes reach the ovules (${Math.round((n / 6) * 100)}\u00a0%)`, `${n} von 6 Pollenschläuchen erreichen die Samenanlagen (${Math.round((n / 6) * 100)}\u00a0%)`))}
            </div>
            <div className="mt-1 text-ink-2">
              {n === 0
                ? t(tx("No seeds: this pollen is rejected.", "Keine Samen: Dieser Pollen wird abgewiesen."))
                : t(tx(`Possible offspring: ${kids.join(", ")}`, `Mögliche Nachkommen: ${kids.join(", ")}`))}
            </div>
          </div>
          <p className="text-ink-2">
            <Bold text={t(explain)} />
          </p>
        </div>
      </div>
    </div>
  );
}
