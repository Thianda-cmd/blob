"use client";

// Widget: the biggest enclosure. A fixed length of fence makes a rectangle, either against
// a house wall (three sides of fence) or free-standing (four sides). Slide the width x:
// the drawing changes shape and the point runs along the parabola A(x). The maximum sits
// at the vertex, exactly halfway between the two zeros.

import { motion } from "motion/react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { clean, mn, nf } from "./kit";
import { BlobLine, HowTo, Label, Segmented, Slider, soft } from "./ui";

type Mode = "wall" | "free";

const LENGTHS = [24, 32, 40];
const DW = 300;
const DH = 175;
const GW = 300;
const GH = 175;

export function FenceMax() {
  const t = useText();
  const l = useLocale();
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const [mode, setMode] = useState<Mode>("wall");
  const [L, setL] = useState(40);
  const [xRaw, setX] = useState(4);
  const xMax = L / 2;
  const x = Math.min(xRaw, xMax);
  const yOf = (w: number) => clean(mode === "wall" ? L - 2 * w : L / 2 - w);
  const area = (w: number) => clean(w * yOf(w));
  const y = yOf(x);
  const A = area(x);
  const xBest = L / 4;
  const Abest = area(xBest);
  const atMax = Math.abs(x - xBest) < 1e-9;

  // Drawing: y runs along the wall (horizontal), x away from it (vertical).
  const s = 210 / L;
  const rw = y * s;
  const rh = x * s;
  const left = (DW - rw) / 2;
  const top = 34;

  // Graph of A(x)
  const gl = 34;
  const gb = 26;
  const gt = 14;
  const gr = 10;
  const gx = (v: number) => gl + (v / xMax) * (GW - gl - gr);
  const gy = (v: number) => GH - gb - (v / (Abest * 1.15)) * (GH - gt - gb);
  const N = 60;
  const curve = Array.from({ length: N + 1 }, (_, i) => {
    const v = (xMax * i) / N;
    return `${i ? "L" : "M"}${gx(v).toFixed(2)},${gy(area(v)).toFixed(2)}`;
  }).join("");

  const term = mode === "wall" ? `A(x) = x \\cdot (${L} - 2x) = -2x^2 + ${L}x` : `A(x) = x \\cdot (${L / 2} - x) = -x^2 + ${L / 2}x`;
  const say: Text = atMax
    ? mode === "wall"
      ? tx(
          `Maximum! With x = ${nf(xBest, "en")} m the area is ${nf(Abest, "en")} m². The vertex lies exactly halfway between the zeros 0 and ${L / 2}. Notice: the side along the wall is twice as long.`,
          `Maximum! Bei x = ${nf(xBest, "de")} m ist die Fläche ${nf(Abest, "de")} m² groß. Der Scheitelpunkt liegt genau in der Mitte zwischen den Nullstellen 0 und ${L / 2}. Und: Die Seite an der Wand ist doppelt so lang.`,
        )
      : tx(
          `Maximum! With x = ${nf(xBest, "en")} m the area is ${nf(Abest, "en")} m²: a square. The vertex lies halfway between the zeros 0 and ${L / 2}.`,
          `Maximum! Bei x = ${nf(xBest, "de")} m ist die Fläche ${nf(Abest, "de")} m² groß: ein Quadrat. Der Scheitelpunkt liegt in der Mitte zwischen den Nullstellen 0 und ${L / 2}.`,
        )
    : x === 0 || x === xMax
      ? tx("No area at all: that's a zero of A(x). The best value lies between the two zeros.", "Gar keine Fläche: Das ist eine Nullstelle von A(x). Der beste Wert liegt zwischen den beiden Nullstellen.")
      : x < xBest
        ? tx("More area is possible: try a bigger x.", "Da geht noch mehr Fläche: Probier ein größeres x.")
        : tx("More area is possible: try a smaller x.", "Da geht noch mehr Fläche: Probier ein kleineres x.");

  return (
    <div className="space-y-4">
      <HowTo
        text={tx(
          "A fixed length of fence makes a rectangular enclosure. Choose the setting and slide the width x: which rectangle has the biggest area?",
          "Mit einem festen Stück Zaun entsteht ein rechteckiges Gehege. Wähl die Situation und verschieb die Breite x: Welches Rechteck hat den größten Flächeninhalt?",
        )}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented
          id={`${id}-mode`}
          label={tx("Setting", "Situation")}
          size="sm"
          value={mode}
          onChange={(m) => setMode(m)}
          options={[
            { value: "wall", label: tx("Against a wall (3 sides)", "An der Hauswand (3 Seiten)") },
            { value: "free", label: tx("Free-standing (4 sides)", "Frei stehend (4 Seiten)") },
          ]}
        />
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-ink-2">{t(tx("Fence", "Zaun"))}</span>
          <Segmented
            id={`${id}-len`}
            label={tx("Fence length", "Zaunlänge")}
            size="sm"
            value={L}
            onChange={(v) => {
              setL(v);
              setX((old) => Math.min(old, v / 2));
            }}
            options={LENGTHS.map((v) => ({ value: v, label: `${v} m` }))}
          />
        </div>
      </div>

      <Slider label={tx("Width x", "Breite x")} value={x} min={0} max={xMax} step={0.5} onChange={setX} display={`${nf(x, l)} m`} valueText={`${nf(x, l)} m`} />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <svg viewBox={`0 0 ${DW} ${DH}`} className="w-full" role="img" aria-label={t(tx("The enclosure seen from above", "Das Gehege von oben"))}>
            <defs>
              <pattern id={`${id}-hatch`} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1={0} y1={0} x2={0} y2={8} stroke="var(--ink-3)" strokeWidth={2} />
              </pattern>
            </defs>
            {mode === "wall" && (
              <g>
                <rect x={10} y={top - 16} width={DW - 20} height={14} fill={`url(#${id}-hatch)`} opacity={0.55} />
                <line x1={10} x2={DW - 10} y1={top - 2} y2={top - 2} stroke="var(--ink-2)" strokeWidth={2.5} />
                <text x={DW - 12} y={top - 20} textAnchor="end" fontSize={10.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                  {t(tx("house wall", "Hauswand"))}
                </text>
              </g>
            )}
            <motion.rect
              initial={false}
              animate={{ x: left, width: Math.max(0.5, rw), height: Math.max(0.5, rh) }}
              transition={soft}
              y={top}
              fill="color-mix(in oklab, var(--ok) 18%, transparent)"
            />
            {/* fence: three or four sides */}
            <motion.path
              initial={false}
              animate={{
                d:
                  mode === "wall"
                    ? `M ${left} ${top} L ${left} ${top + rh} L ${left + rw} ${top + rh} L ${left + rw} ${top}`
                    : `M ${left} ${top} L ${left} ${top + rh} L ${left + rw} ${top + rh} L ${left + rw} ${top} Z`,
              }}
              transition={soft}
              fill="none"
              stroke="var(--blob)"
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <motion.text initial={false} animate={{ x: left - 6, y: top + rh / 2 + 4 }} transition={soft} textAnchor="end" fontSize={12} fill="var(--ink)" className="font-math">
              {`x = ${nf(x, l)}`}
            </motion.text>
            <motion.text initial={false} animate={{ x: left + rw / 2, y: top + rh + 16 }} transition={soft} textAnchor="middle" fontSize={12} fill="var(--ink)" className="font-math">
              {`${nf(y, l)} m`}
            </motion.text>
            {rh > 22 && rw > 60 && (
              <motion.text initial={false} animate={{ x: left + rw / 2, y: top + rh / 2 + 5 }} transition={soft} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
                {`${nf(A, l)} m²`}
              </motion.text>
            )}
          </svg>
        </div>
        <div>
          <svg viewBox={`0 0 ${GW} ${GH}`} className="w-full" role="img" aria-label={t(tx("Graph of the area A(x)", "Graph der Fläche A(x)"))}>
            {[0, 0.5, 1].map((k) => (
              <g key={k}>
                <line x1={gl} x2={GW - gr} y1={gy(Abest * k)} y2={gy(Abest * k)} stroke="var(--line)" strokeWidth={k === 0 ? 1.4 : 0.8} />
                <text x={gl - 5} y={gy(Abest * k) + 4} textAnchor="end" fontSize={10} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                  {nf(Abest * k, l, 0)}
                </text>
              </g>
            ))}
            {[0, xBest, xMax].map((v) => (
              <text key={v} x={gx(v)} y={GH - gb + 14} textAnchor="middle" fontSize={10} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                {nf(v, l)}
              </text>
            ))}
            <text x={GW - gr} y={GH - 2} textAnchor="end" fontSize={10.5} fill="var(--ink-2)" className="font-math">
              x
            </text>
            <text x={gl + 4} y={gt - 2} fontSize={10.5} fill="var(--ink-2)" className="font-math">
              A(x)
            </text>
            <motion.path key={`${mode}${L}`} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7 }} d={curve} fill="none" stroke="var(--blob)" strokeWidth={2.4} />
            {atMax && (
              <g>
                <line x1={gx(xBest)} x2={gx(xBest)} y1={gy(Abest)} y2={gy(0)} stroke="var(--ok)" strokeDasharray="4 3" />
                <text x={gx(xBest)} y={gy(Abest) - 9} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ok)" style={{ fontFamily: "var(--font-sans)" }}>
                  {t(tx("vertex", "Scheitelpunkt"))}
                </text>
              </g>
            )}
            <motion.circle initial={false} animate={{ cx: gx(x), cy: gy(A) }} transition={soft} r={5.5} fill={atMax ? "var(--ok)" : "var(--blob)"} stroke="var(--raised)" strokeWidth={1.5} />
          </svg>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="overflow-x-auto rounded-xl border border-line px-4 py-3">
          <Label>{t(tx("Target function", "Zielfunktion"))}</Label>
          <div className="mt-1">
            <MathView src={term} size="sm" scope={`${id}-term`} />
          </div>
        </div>
        <div className="rounded-xl bg-surface px-4 py-3">
          <Label>{t(tx("Area now", "Fläche jetzt"))}</Label>
          <div className="font-math text-[22px] tabular-nums">
            <MathView src={`${mn(A, l)} "m²"`} size="sm" animate={false} />
          </div>
        </div>
      </div>
      <BlobLine text={say} mood={atMax ? "excited" : "happy"} />
    </div>
  );
}
