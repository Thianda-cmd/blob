"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { AMINO, aminoLetter, RNA_BASES } from "@/learn/biology/topics/dna/data";
import { cn } from "@/lib/utils";
import { BASE_COLOR, baseTint } from "./DnaKit";
import { cos, sin } from "@/lib/stableMath";

const S = 460;
const C = S / 2;
const RINGS = [
  [0, 62],
  [62, 118],
  [118, 168],
] as const;
const LABEL_R = 174;
const r2 = (v: number) => Math.round(v * 100) / 100;
const pt = (r: number, a: number): [number, number] => [r2(C + r * sin((a * Math.PI) / 180)), r2(C - r * cos((a * Math.PI) / 180))];

function sector(r0: number, r1: number, a0: number, a1: number) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = pt(r1, a0);
  const [x1, y1] = pt(r1, a1);
  if (r0 === 0) return `M${C} ${C} L${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} Z`;
  const [x2, y2] = pt(r0, a1);
  const [x3, y3] = pt(r0, a0);
  return `M${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}

type Cell = { code: string; ring: number; a0: number; a1: number };
const CELLS: Cell[] = [];
RNA_BASES.forEach((b1, i) => {
  CELLS.push({ code: b1, ring: 0, a0: i * 90, a1: (i + 1) * 90 });
  RNA_BASES.forEach((b2, j) => {
    const s2 = i * 90 + j * 22.5;
    CELLS.push({ code: b1 + b2, ring: 1, a0: s2, a1: s2 + 22.5 });
    RNA_BASES.forEach((b3, k) => CELLS.push({ code: b1 + b2 + b3, ring: 2, a0: s2 + k * 5.625, a1: s2 + (k + 1) * 5.625 }));
  });
});

/** Amino acid labels: neighbouring codons with the same amino acid share one label. */
type Label = { one: string; a: number; codons: string[] };
const LABELS: Label[] = [];
for (const c of CELLS.filter((x) => x.ring === 2)) {
  const one = aminoLetter(c.code);
  const prev = LABELS[LABELS.length - 1];
  if (prev && prev.one === one && prev.codons[0].slice(0, 2) === c.code.slice(0, 2)) {
    prev.codons.push(c.code);
    prev.a = (prev.a * (prev.codons.length - 1) + (c.a0 + c.a1) / 2) / prev.codons.length;
  } else LABELS.push({ one, a: (c.a0 + c.a1) / 2, codons: [c.code] });
}

/**
 * The code sun (genetic code): read an mRNA codon from the inside out. Tap the rings or the
 * base buttons to pick a codon; `codon` sets a codon from outside (static picture).
 */
export function DnaCodeSun({ codon, interactive = true, compact = false }: { codon?: string; interactive?: boolean; compact?: boolean }) {
  const t = useText();
  const [own, setOwn] = useState("");
  const sel = codon ?? own;
  const full = sel.length === 3;
  const aa = full ? AMINO[aminoLetter(sel)] : null;
  const onPath = (code: string) => !sel || code.startsWith(sel) || sel.startsWith(code);
  const pick = (code: string) => interactive && setOwn(own === code ? code.slice(0, -1) : code);
  /** Set base i (earlier bases must be chosen first); later bases stay. */
  const setPos = (i: number, b: string) => setOwn(own.slice(0, i) + b + own.slice(i + 1));

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${S} ${S}`} className={cn("mx-auto block h-auto w-full", compact ? "max-w-[380px]" : "max-w-[500px]")} role="img" aria-label={t(tx("Code sun of the genetic code", "Codesonne des genetischen Codes"))}>
        {CELLS.map((c) => {
          const [r0, r1] = RINGS[c.ring];
          const b = c.code[c.code.length - 1];
          const lit = full ? sel.startsWith(c.code) : sel === c.code;
          return (
            <path
              key={c.code}
              d={sector(r0, r1, c.a0, c.a1)}
              fill={baseTint(b, [55, 38, 26][c.ring])}
              stroke={lit ? "var(--blob)" : "var(--raised)"}
              strokeWidth={lit ? 2.4 : 1.2}
              opacity={onPath(c.code) ? 1 : 0.42}
              onClick={() => pick(c.code)}
              className={cn(interactive && "cursor-pointer", "transition-opacity duration-300")}
            />
          );
        })}
        {/* base letters */}
        {CELLS.map((c) => {
          const [r0, r1] = RINGS[c.ring];
          const [x, y] = pt(c.ring === 0 ? 34 : (r0 + r1) / 2, (c.a0 + c.a1) / 2);
          const b = c.code[c.code.length - 1];
          return (
            <text
              key={`t${c.code}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={[26, 18, 11.5][c.ring]}
              fontWeight={c.ring === 2 ? 600 : 700}
              fill="var(--ink)"
              opacity={onPath(c.code) ? 1 : 0.4}
              style={{ fontFamily: "var(--font-sans)", pointerEvents: "none" }}
            >
              {b}
            </text>
          );
        })}
        {/* amino acids around the sun */}
        {LABELS.map((l) => {
          const right = l.a < 180;
          const [x, y] = pt(LABEL_R, l.a);
          const on = full ? l.codons.includes(sel) : !sel || l.codons.some((c) => c.startsWith(sel));
          const isStart = l.codons.includes("AUG");
          const text = l.one === "*" ? t(tx("Stop", "Stopp")) : AMINO[l.one].abbr;
          return (
            <g key={`l${l.codons[0]}`} opacity={on ? 1 : 0.35} style={{ transition: "opacity .3s" }}>
              <text
                x={x}
                y={y}
                transform={`rotate(${right ? l.a - 90 : l.a + 90} ${x} ${y})`}
                textAnchor={right ? "start" : "end"}
                dominantBaseline="central"
                fontSize={13.5}
                fontWeight={full && l.codons.includes(sel) ? 800 : 600}
                fill={l.one === "*" ? "var(--bio-blood)" : isStart ? "var(--blob)" : "var(--ink)"}
                style={{ fontFamily: "var(--font-sans)", pointerEvents: "none" }}
              >
                {isStart ? `${text} ★` : text}
              </text>
            </g>
          );
        })}
      </svg>

      {interactive && (
        <div className="space-y-2.5">
          <div className="grid gap-1.5 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-[62px] shrink-0 text-[12px] text-ink-3">{t(tx(`${["1st", "2nd", "3rd"][i]} base`, `${i + 1}. Base`))}</span>
                {RNA_BASES.map((b) => {
                  const on = sel[i] === b;
                  const allowed = sel.length >= i;
                  return (
                    <button
                      key={b}
                      type="button"
                      disabled={!allowed || codon !== undefined}
                      onClick={() => setPos(i, b)}
                      aria-label={t(tx(`${["1st", "2nd", "3rd"][i]} base ${b}`, `${i + 1}. Base ${b}`))}
                      aria-pressed={on}
                      className={cn("grid size-9 place-items-center rounded-lg border-2 text-[15px] font-semibold text-ink transition-all disabled:opacity-30", on ? "scale-105" : "opacity-80 hover:opacity-100")}
                      style={{ borderColor: on ? "var(--blob)" : BASE_COLOR[b], background: baseTint(b, on ? 40 : 18) }}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <motion.div key={sel} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="min-h-[3rem] rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-snug" aria-live="polite">
            {aa ? (
              <span className="text-ink">
                <span className="font-semibold tracking-wide">{sel}</span> → <span className="font-semibold">{aa.one === "*" ? t(tx("stop codon", "Stoppcodon")) : `${aa.abbr} (${t(aa.name)})`}</span>
                <span className="text-ink-2">
                  {sel === "AUG"
                    ? t(tx(". Also the start codon: every protein begins here.", ". Zugleich das Startcodon: Hier beginnt jedes Protein."))
                    : aa.one === "*"
                      ? t(tx(". No tRNA fits here: the protein is finished.", ". Hier passt keine tRNA: Das Protein ist fertig."))
                      : "."}
                </span>
              </span>
            ) : (
              <span className="text-ink-3">
                {t(
                  sel
                    ? tx(`Codon ${sel}… Now go one ring further out.`, `Codon ${sel}… Jetzt einen Ring weiter nach außen.`)
                    : tx("Pick a codon: first base in the middle, then go outwards ring by ring.", "Wähl ein Codon: die 1. Base in der Mitte, dann Ring für Ring nach außen."),
                )}
              </span>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
