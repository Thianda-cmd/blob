"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Plane, PlaneDot, PlanePath, PlaneTag, TONE, usePlaneGeo, type Pt } from "@/learn/visuals/LinesGraph";
import { cn } from "@/lib/utils";
import { numIn } from "./kit";
import { pt } from "./level2";

// Pictures for level 1 (coordinate system, quadrants, tables of values, proportional graphs).
// Each one makes sense on its own page: own labels, no text from the lesson needed.

export const QUADRANT_FILL = "color-mix(in oklab, var(--blob) 11%, transparent)";

/** The four quadrants as polygons on a ±r plane. */
export const quadrantBox = (q: 1 | 2 | 3 | 4, r = 5): Pt[] => {
  const sx = q === 1 || q === 4 ? 1 : -1;
  const sy = q === 1 || q === 2 ? 1 : -1;
  return [
    [0, 0],
    [sx * r, 0],
    [sx * r, sy * r],
    [0, sy * r],
  ];
};

export const ROMAN = ["", "I", "II", "III", "IV"] as const;

/** Which quadrant a point is in (0 on an axis). */
export const quadrantOf = ([x, y]: Pt): 0 | 1 | 2 | 3 | 4 => (x === 0 || y === 0 ? 0 : x > 0 ? (y > 0 ? 1 : 4) : y > 0 ? 2 : 3);

/** Big faint Roman numerals in the quadrants (SVG, inside a <Plane>). */
export function QuadrantNumerals({ active, r = 5 }: { active?: number; r?: number }) {
  const geo = usePlaneGeo();
  const at = (q: 1 | 2 | 3 | 4): Pt => [(q === 1 || q === 4 ? 1 : -1) * r * 0.62, (q === 1 || q === 2 ? 1 : -1) * r * 0.62];
  return (
    <g fontFamily="var(--font-sans)" fontWeight={700} textAnchor="middle">
      {([1, 2, 3, 4] as const).map((q) => {
        const [x, y] = at(q);
        return (
          <motion.text
            key={q}
            x={geo.sx(x)}
            y={geo.sy(y) + 3}
            fontSize={9}
            initial={false}
            animate={{ opacity: active === undefined ? 0.5 : active === q ? 0.9 : 0.22 }}
            fill={active === q ? "var(--blob)" : "var(--ink-3)"}
          >
            {ROMAN[q]}
          </motion.text>
        );
      })}
    </g>
  );
}

/** Walking from the origin to a point: first along the x-axis, then up or down. */
export function WalkPicture({ x = 3, y = 2, name = "P" }: { x?: number; y?: number; name?: string }) {
  const t = useText();
  const across = Math.abs(x);
  const up = Math.abs(y);
  const right = x >= 0;
  const upward = y >= 0;
  return (
    <div className="mx-auto w-full max-w-[400px]">
      <Plane label={tx(`The way from the origin to ${name}`, `Der Weg vom Ursprung zu ${name}`)}>
        <PlanePath
          shape={() => [
            [0, 0],
            [x, 0],
            [x, y],
          ]}
          stroke={TONE.blob}
          width={1.1}
          draw
        />
        <PlaneDot at={() => [0, 0]} tone="ink" r={1.1} />
        <PlaneDot at={() => [x, y]} tone="blob" r={1.5} pulse={`${x},${y}`} />
      </Plane>
      <div className="sr-only">{t(tx(`${name} is ${across} to the ${right ? "right" : "left"} and ${up} ${upward ? "up" : "down"}.`, `${name} liegt ${across} nach ${right ? "rechts" : "links"} und ${up} nach ${upward ? "oben" : "unten"}.`))}</div>
      <WalkTags x={x} y={y} name={name} />
    </div>
  );
}

/** The labels of the walk, as a legend under the plane (they never cover the grid). */
function WalkTags({ x, y, name }: { x: number; y: number; name: string }) {
  const t = useText();
  const across = Math.abs(x);
  const up = Math.abs(y);
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[14px] text-ink-2">
      <span className="flex items-center gap-1.5">
        <span className="rounded-md bg-blob-soft px-1.5 py-0.5 font-semibold text-blob-ink">1</span>
        {t(tx(`${across} to the ${x >= 0 ? "right" : "left"} (x)`, `${across} nach ${x >= 0 ? "rechts" : "links"} (x)`))}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="rounded-md bg-blob-soft px-1.5 py-0.5 font-semibold text-blob-ink">2</span>
        {t(tx(`${up} ${y >= 0 ? "up" : "down"} (y)`, `${up} nach ${y >= 0 ? "oben" : "unten"} (y)`))}
      </span>
      <span className="text-ink">
        <MathView src={pt(x, y, name)} size="sm" animate={false} />
      </span>
    </div>
  );
}

const SIGNS: Record<1 | 2 | 3 | 4, string> = { 1: "(+ \\; | \\; +)", 2: "(- \\; | \\; +)", 3: "(- \\; | \\; -)", 4: "(+ \\; | \\; -)" };

/** The four quadrants with their numbers and sign patterns. */
export function QuadrantPicture() {
  const t = useText();
  return (
    <div className="mx-auto w-full max-w-[400px]">
      <Plane
        label={tx("The four quadrants of the coordinate system", "Die vier Quadranten des Koordinatensystems")}
        overlay={
          <>
            {([1, 2, 3, 4] as const).map((q) => (
              <PlaneTag key={q} at={() => [(q === 1 || q === 4 ? 1 : -1) * 3.1, (q === 1 || q === 2 ? 1 : -1) * 1.6]}>
                <MathView src={SIGNS[q]} size="sm" animate={false} className="text-ink" />
              </PlaneTag>
            ))}
          </>
        }
      >
        {([1, 2, 3, 4] as const).map((q) => (
          <PlanePath key={q} shape={() => quadrantBox(q)} closed fill={q % 2 ? QUADRANT_FILL : "color-mix(in oklab, var(--ink) 5%, transparent)"} />
        ))}
        <QuadrantNumerals />
      </Plane>
      <p className="mt-2 text-center text-[13.5px] text-ink-2">{t(tx("Numbered counterclockwise, starting top right. Signs: (x | y).", "Gegen den Uhrzeigersinn nummeriert, oben rechts geht es los. Vorzeichen: (x | y)."))}</p>
    </div>
  );
}

/** A table of values. `ys` may have gaps (null) shown as "?"; `mark` highlights one column. */
export function ValueTable({
  rule,
  xs,
  ys,
  mark,
  xLabel = "x",
  yLabel = "y",
}: {
  rule?: Text;
  xs: number[];
  ys: (number | null)[];
  mark?: number;
  xLabel?: Text;
  yLabel?: Text;
}) {
  const t = useText();
  const l = useLocale();
  const cell = (v: number | null) => (v === null ? "?" : numIn(v, l));
  return (
    <div className="space-y-3">
      {rule && (
        <div className="flex justify-center text-ink">
          <MathView src={rule} size="md" animate={false} />
        </div>
      )}
      <div className="mx-auto w-fit max-w-full overflow-x-auto">
        <table className="border-collapse text-[17px]">
          <tbody>
            {[
              { label: xLabel, values: xs as (number | null)[] },
              { label: yLabel, values: ys },
            ].map((row, r) => (
              <tr key={r}>
                <th scope="row" className={cn("max-w-[120px] border border-line bg-surface px-3 py-2 text-left text-[13.5px] font-semibold leading-tight text-ink-2", r === 0 && "rounded-tl-lg")}>
                  <span className={cn(t(row.label).length <= 2 && "font-math text-[18px] italic text-ink")}>{t(row.label)}</span>
                </th>
                {row.values.map((v, i) => (
                  <td
                    key={i}
                    className={cn(
                      "min-w-[48px] border border-line px-2.5 py-2 text-center",
                      mark === i ? "bg-blob-soft" : "bg-raised",
                      v === null && "font-semibold text-blob-ink",
                    )}
                  >
                    <MathView src={cell(v)} size="sm" animate={false} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * A graph from everyday life in the first quadrant (kg → €, hours → km), with its own
 * scale on each axis. Optional: a marked point with dashed lines to both axes.
 */
export function StoryGraph({
  m,
  xMax,
  yMax,
  yStep,
  xLabel,
  yLabel,
  mark,
}: {
  /** y = m · x */
  m: number;
  xMax: number;
  yMax: number;
  /** Grid spacing on the y-axis (the x-axis has one line per unit). */
  yStep: number;
  xLabel: Text;
  yLabel: Text;
  mark?: [number, number];
}) {
  const t = useText();
  const l = useLocale();
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const W = 150;
  const H = 100;
  const sx = (x: number) => (x / xMax) * W;
  const sy = (y: number) => H - (y / yMax) * H;
  const xs = Array.from({ length: Math.floor(xMax) + 1 }, (_, i) => i);
  const ys = Array.from({ length: Math.round(yMax / yStep) + 1 }, (_, i) => i * yStep);
  const labelEvery = ys.length > 11 ? 2 : 1;
  const end = Math.min(xMax, yMax / m);
  return (
    <div className="mx-auto w-full max-w-[520px]">
      <svg viewBox={`-16 -12 ${W + 30} ${H + 26}`} className="w-full overflow-visible" role="img" aria-label={t(tx(`Graph: ${t(yLabel)} against ${t(xLabel)}`, `Graph: ${t(yLabel)} in Abhängigkeit von ${t(xLabel)}`))}>
        <defs>
          <marker id={`sg-${id}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--ink-3)" />
          </marker>
        </defs>
        <g stroke="var(--line)" strokeWidth={0.3}>
          {xs.map((x) => (
            <line key={`x${x}`} x1={sx(x)} x2={sx(x)} y1={0} y2={H} />
          ))}
          {ys.map((y) => (
            <line key={`y${y}`} x1={0} x2={W} y1={sy(y)} y2={sy(y)} />
          ))}
        </g>
        <line x1={0} x2={W + 5} y1={H} y2={H} stroke="var(--ink-3)" strokeWidth={0.5} markerEnd={`url(#sg-${id})`} />
        <line x1={0} x2={0} y1={H} y2={-5} stroke="var(--ink-3)" strokeWidth={0.5} markerEnd={`url(#sg-${id})`} />
        <g fontSize={3.6} fill="var(--ink-3)" fontFamily="var(--font-math)">
          {xs.map((x) => (
            <text key={`lx${x}`} x={sx(x)} y={H + 5} textAnchor="middle">
              {numIn(x, l)}
            </text>
          ))}
          {ys
            .filter((_, i) => i > 0 && i % labelEvery === 0)
            .map((y) => (
              <text key={`ly${y}`} x={-1.8} y={sy(y) + 1.2} textAnchor="end">
                {numIn(y, l)}
              </text>
            ))}
        </g>
        <g fontSize={3.8} fill="var(--ink-2)" fontFamily="var(--font-sans)" fontWeight={600}>
          <text x={W + 2} y={H + 11} textAnchor="end">
            {t(xLabel)}
          </text>
          <text x={2} y={-6}>
            {t(yLabel)}
          </text>
        </g>
        {mark && (
          <g stroke="var(--ink-2)" strokeWidth={0.45} strokeDasharray="1.6 1.2" fill="none">
            <line x1={sx(mark[0])} x2={sx(mark[0])} y1={H} y2={sy(mark[1])} />
            <line x1={0} x2={sx(mark[0])} y1={sy(mark[1])} y2={sy(mark[1])} />
          </g>
        )}
        <motion.line
          x1={0}
          y1={H}
          x2={sx(end)}
          y2={sy(m * end)}
          stroke="var(--blob)"
          strokeWidth={1.1}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
        {mark && <circle cx={sx(mark[0])} cy={sy(mark[1])} r={1.5} fill="var(--ink)" />}
      </svg>
    </div>
  );
}
