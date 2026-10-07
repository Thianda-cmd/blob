"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Graph } from "@/learn/visuals/Graph";
import { cn } from "@/lib/utils";
import { setOf } from "./build2";
import { absIneqSet, lin } from "./build3";
import { Caption, fmtNum, Segmented, Slider, texNum, useNarrow } from "./ui";

// ---------------------------------------------------------------------------
// The absolute value as a distance on the number line.

type DistRel = "=" | "<" | ">" | "≤" | "≥";
const geometry = (narrow: boolean, from: number, to: number) => {
  const w = narrow ? 360 : 640;
  const left = narrow ? 18 : 30;
  return { w, left, right: w - left, font: narrow ? 15 : 14, every: narrow && to - from > 12 ? 2 : 1 };
};

/**
 * A number line with a centre a, the two points at distance r, and the solutions of
 * |x − a| = r, < r or > r shaded. Optionally a probe point x with its distance to a.
 */
export function DistanceLine({
  center,
  radius,
  rel,
  from = -9,
  to = 9,
  probe,
  onProbe,
}: {
  center: number;
  radius: number;
  rel: DistRel;
  from?: number;
  to?: number;
  probe?: number | null;
  onProbe?: (x: number) => void;
}) {
  const t = useText();
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const g = geometry(useNarrow(), from, to);
  const Y = 70;
  const nx = (v: number) => g.left + ((v - from) / (to - from)) * (g.right - g.left);
  const lo = center - radius;
  const hi = center + radius;
  const inner = rel === "<" || rel === "≤";
  const outer = rel === ">" || rel === "≥";
  const closed = rel === "=" || rel === "≤" || rel === "≥";
  const spring = { type: "spring" as const, stiffness: 260, damping: 28 };
  const ticks: number[] = [];
  for (let v = from; v <= to; v++) ticks.push(v);
  const lift = Math.min(46, 14 + radius * 6);
  const arc = (x2: number) => `M ${nx(center)} ${Y - 4} Q ${(nx(center) + nx(x2)) / 2} ${Y - lift} ${nx(x2)} ${Y - 4}`;
  const d = probe == null ? 0 : Math.abs(probe - center);
  const holds = probe == null ? false : rel === "=" ? d === radius : rel === "<" ? d < radius : rel === "≤" ? d <= radius : rel === ">" ? d > radius : d >= radius;

  function fromPointer(ev: React.PointerEvent) {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm || !onProbe) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    const raw = from + ((p.x - g.left) / (g.right - g.left)) * (to - from);
    onProbe(Math.max(from, Math.min(to, Math.round(raw * 2) / 2)));
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${g.w} 128`}
      className={cn("block w-full select-none", onProbe && "touch-none", onProbe && (dragging ? "cursor-grabbing" : "cursor-pointer"))}
      role={onProbe ? "slider" : "img"}
      aria-label={onProbe ? t(tx("Test value x", "Testwert x")) : t(tx("Distance on the number line", "Abstand an der Zahlengeraden"))}
      aria-valuemin={onProbe ? from : undefined}
      aria-valuemax={onProbe ? to : undefined}
      aria-valuenow={onProbe && probe != null ? probe : undefined}
      tabIndex={onProbe ? 0 : undefined}
      onKeyDown={(ev) => {
        if (!onProbe || probe == null) return;
        if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
          ev.preventDefault();
          onProbe(Math.min(to, probe + 0.5));
        } else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
          ev.preventDefault();
          onProbe(Math.max(from, probe - 0.5));
        }
      }}
      onPointerDown={(ev) => {
        if (!onProbe) return;
        (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
        setDragging(true);
        fromPointer(ev);
      }}
      onPointerMove={(ev) => dragging && fromPointer(ev)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <line x1={g.left - 14} x2={g.right + 14} y1={Y} y2={Y} stroke="var(--ink-3)" strokeWidth={1.4} />
      <path d={`M ${g.right + 8} ${Y - 5} L ${g.right + 15} ${Y} L ${g.right + 8} ${Y + 5}`} fill="none" stroke="var(--ink-3)" strokeWidth={1.4} />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={nx(v)} x2={nx(v)} y1={Y - 6} y2={Y + 6} stroke="var(--ink-3)" strokeWidth={v === 0 ? 1.6 : 0.9} />
          {(v - from) % g.every === 0 && (
            <text x={nx(v)} y={Y + 24} fontSize={g.font} textAnchor="middle" fill="var(--ink-2)" className="font-math">
              {String(v).replace("-", "−")}
            </text>
          )}
        </g>
      ))}

      {/* solution set */}
      {inner && radius > 0 && (
        <motion.line y1={Y} y2={Y} initial={false} animate={{ x1: nx(lo), x2: nx(hi) }} transition={spring} stroke="var(--blob)" strokeWidth={9} strokeLinecap="round" opacity={0.32} />
      )}
      {outer && (
        <>
          <motion.line y1={Y} y2={Y} initial={false} animate={{ x1: g.left - 12, x2: nx(lo) }} transition={spring} stroke="var(--blob)" strokeWidth={9} strokeLinecap="round" opacity={0.32} />
          <motion.line y1={Y} y2={Y} initial={false} animate={{ x1: nx(hi), x2: g.right + 12 }} transition={spring} stroke="var(--blob)" strokeWidth={9} strokeLinecap="round" opacity={0.32} />
        </>
      )}

      {/* distance arcs */}
      {radius > 0 && (
        <g>
          {[lo, hi].map((x2, i) => (
            <motion.path key={i} initial={false} animate={{ d: arc(x2) }} transition={spring} fill="none" stroke="var(--blob)" strokeWidth={1.6} strokeDasharray="4 3" />
          ))}
          {[lo, hi].map((x2, i) => (
            <motion.text
              key={`r${i}`}
              initial={false}
              animate={{ x: (nx(center) + nx(x2)) / 2, y: Y - lift / 2 - 6 }}
              transition={spring}
              fontSize={g.font}
              textAnchor="middle"
              fill="var(--blob)"
              className="font-math"
              fontStyle="italic"
            >
              {String(radius)}
            </motion.text>
          ))}
        </g>
      )}

      {/* the two boundary points */}
      {(radius > 0 ? [lo, hi] : [center]).map((x2, i) => (
        <motion.circle
          key={`p${i}`}
          initial={false}
          animate={{ cx: nx(x2) }}
          transition={spring}
          cy={Y}
          r={6}
          fill={closed ? "var(--blob)" : "var(--surface)"}
          stroke="var(--blob)"
          strokeWidth={2.4}
        />
      ))}

      {/* the centre */}
      <motion.g initial={false} animate={{ x: nx(center) }} transition={spring}>
        <path d={`M -6 ${Y + 34} L 6 ${Y + 34} L 0 ${Y + 27} Z`} fill="var(--ink-2)" />
        <text y={Y + 50} fontSize={g.font - 2} textAnchor="middle" fill="var(--ink-2)" fontFamily="var(--font-sans)">
          {t(tx("centre", "Mitte"))}
        </text>
      </motion.g>

      {/* the probe x */}
      {probe != null && (
        <g>
          <motion.line
            initial={false}
            animate={{ x1: nx(center), x2: nx(probe) }}
            transition={{ type: "spring", stiffness: 520, damping: 36 }}
            y1={Y + 12}
            y2={Y + 12}
            stroke={holds ? "var(--ok)" : "var(--danger)"}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <motion.g initial={false} animate={{ x: nx(probe) }} transition={{ type: "spring", stiffness: 520, damping: 36 }}>
            <circle cy={Y} r={14} fill={holds ? "var(--ok)" : "var(--danger)"} opacity={dragging ? 0.22 : 0.14} />
            <circle cy={Y} r={7.5} fill={holds ? "var(--ok)" : "var(--danger)"} stroke="var(--raised)" strokeWidth={2.2} />
            <text y={Y - 14} fontSize={g.font} textAnchor="middle" fill={holds ? "var(--ok)" : "var(--danger)"} className="font-math" fontStyle="italic" fontWeight={600}>
              x
            </text>
          </motion.g>
        </g>
      )}
    </svg>
  );
}

const REL_TEX: Record<"=" | "<" | ">", string> = { "=": "=", "<": "<", ">": ">" };

/**
 * A static picture for explain steps (props come from the lesson): the statement, its solution set and
 * the number line. `also` adds a second row with another relation (|x − 2| < 3 and |x − 2| > 3).
 */
export function DistancePicture(props: { center: number; radius: number; rel: "=" | "<" | ">"; also?: "=" | "<" | ">"; from?: number; to?: number }) {
  const { center: a, radius: r, from, to } = props;
  const rels = props.also ? [props.rel, props.also] : [props.rel];
  return (
    <div className="space-y-4">
      {rels.map((rel) => (
        <div key={rel} className="space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
            <MathView src={`|${lin(1, -a)}| ${REL_TEX[rel]} ${r}`} size="lg" animate={false} />
            <MathView src={rel === "=" ? setOf([a - r, a + r]) : absIneqSet(a - r, a + r, rel)} size="md" animate={false} className="text-ink-2" />
          </div>
          <div className="rounded-xl border border-line bg-surface px-2 pt-2">
            <DistanceLine center={a} radius={r} rel={rel} from={from} to={to} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DistanceLab() {
  const t = useText();
  const locale = useLocale();
  const [a, setA] = useState(2);
  const [r, setR] = useState(3);
  const [rel, setRel] = useState<"=" | "<" | ">">("=");
  const [x, setX] = useState(6);
  const d = Math.abs(x - a);
  const holds = rel === "=" ? d === r : rel === "<" ? d < r : d > r;
  const inside = lin(1, -a);
  const statement = `|#b1 ${inside} |#b2 ${REL_TEX[rel]}#rel ${r}#r`;
  const xs = texNum(x, locale);
  const probeLine = `|${x < 0 ? `(${xs})` : xs} ${a >= 0 ? "-" : "+"} ${Math.abs(a)}| = ${texNum(d, locale)}`;
  let set: Text;
  if (rel === "=") set = r === 0 ? setOf([a]) : setOf([a - r, a + r]);
  else if (rel === "<") set = r === 0 ? "L = \\{ \\}" : absIneqSet(a - r, a + r, "<");
  else set = r === 0 ? `L = \\{ x \\,|\\, x \\ne ${a} \\}` : absIneqSet(a - r, a + r, ">");
  const meaning: Record<"=" | "<" | ">", Text> = {
    "=": tx(`All x at distance exactly ${r} from ${fmtNum(a, locale)}.`, `Alle x mit Abstand genau ${r} von ${fmtNum(a, locale)}.`),
    "<": tx(`All x closer than ${r} to ${fmtNum(a, locale)}.`, `Alle x, die näher als ${r} an ${fmtNum(a, locale)} liegen.`),
    ">": tx(`All x further than ${r} from ${fmtNum(a, locale)}.`, `Alle x, die weiter als ${r} von ${fmtNum(a, locale)} entfernt sind.`),
  };

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-ink-2">
        {t(
          tx(
            "|x − a| is the distance between x and a. Move the centre and the distance, pick =, < or >, and drag x to test numbers.",
            "|x − a| ist der Abstand zwischen x und a. Verschieb die Mitte und den Abstand, wähle =, < oder > und zieh x, um Zahlen zu testen.",
          ),
        )}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <MathView src={statement} size="lg" />
        <span className="text-[13.5px] text-ink-2">{t(meaning[rel])}</span>
      </div>

      <div className="rounded-xl border border-line bg-surface px-2 pt-2">
        <DistanceLine center={a} radius={r} rel={rel} probe={x} onProbe={setX} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <MathView src={probeLine} size="md" animate={false} />
        <motion.span
          key={String(holds)}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 520, damping: 22 }}
          className={cn("rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold text-white", holds ? "bg-ok" : "bg-danger")}
        >
          {holds ? t(tx(`${fmtNum(x, locale)} is a solution`, `${fmtNum(x, locale)} ist eine Lösung`)) : t(tx(`${fmtNum(x, locale)} is not a solution`, `${fmtNum(x, locale)} ist keine Lösung`))}
        </motion.span>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Slider name="a" value={a} min={-4} max={4} shown={fmtNum(a, locale)} onChange={setA} label={t(tx("Centre a", "Mitte a"))} />
          <Slider name="r" value={r} min={0} max={5} shown={fmtNum(r, locale)} onChange={setR} label={t(tx("Distance r", "Abstand r"))} />
        </div>
        <div className="space-y-1.5">
          <Caption>{t(tx("Relation", "Relation"))}</Caption>
          <Segmented
            label={t(tx("Relation", "Relation"))}
            value={rel}
            onChange={setRel}
            options={[
              { value: "=", label: "=" },
              { value: "<", label: "<" },
              { value: ">", label: ">" },
            ]}
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${rel}${a}${r}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="pt-1">
              <MathView src={set} size="md" animate={false} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Why squaring brings in false solutions: √(x + a) = x − b on a graph. Squaring
// also solves √(x + a) = −(x − b), the mirrored line: its meeting point is a false solution.

export function RootLab() {
  const t = useText();
  const locale = useLocale();
  const [a, setA] = useState(5);
  const [b, setB] = useState(1);
  const [mirror, setMirror] = useState(true);
  // x + a = (x − b)²  ⇔  x² − (2b + 1)x + b² − a = 0
  const p = -(2 * b + 1);
  const q = b * b - a;
  const D = (p * p) / 4 - q;
  const cands = D < 0 ? [] : D === 0 ? [-p / 2] : [-p / 2 + Math.sqrt(D), -p / 2 - Math.sqrt(D)];
  const rows = cands.map((x) => {
    const left = Math.sqrt(Math.max(0, x + a));
    const right = x - b;
    return { x, left, right, ok: Math.abs(left - right) < 1e-9 };
  });
  const near = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? "=" : "\\approx");
  const eq = `\\sqrt{${lin(1, a)}} = ${lin(1, -b)}`;
  const squared = `${lin(1, a)} = ${b === 0 ? "x^2" : `(${lin(1, -b)})^2`}`;
  const good = rows.filter((r) => r.ok).map((r) => r.x);

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-ink-2">
        {t(
          tx(
            "The curve is the root, the line is the right side. Where they meet is a real solution. Squaring can't tell the line from its mirror image, so where the curve meets the mirrored line, a false solution appears.",
            "Die Kurve ist die Wurzel, die Gerade die rechte Seite. Wo sie sich treffen, liegt eine echte Lösung. Beim Quadrieren lässt sich die Gerade nicht von ihrem Spiegelbild unterscheiden: Wo die Kurve die gespiegelte Gerade trifft, entsteht eine Scheinlösung.",
          ),
        )}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3">
        <MathView src={eq} size="lg" />
        <span className="flex items-center gap-2 text-[13px] text-ink-3">
          {t(tx("squared:", "quadriert:"))}
          <MathView src={squared} size="md" className="text-ink" />
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-start">
        <div className="rounded-xl border border-line bg-surface p-2">
          <Graph
            xRange={[-8, 10]}
            yRange={[-5, 6]}
            height={300}
            functions={[
              { f: (x) => Math.sqrt(x + a), from: -a, key: "root", color: "blob", label: tx("root", "Wurzel") },
              { f: (x) => x - b, key: "line", color: "ink" },
              ...(mirror ? [{ f: (x: number) => b - x, key: "mirror", color: "danger" as const, dashed: true }] : []),
            ]}
            points={rows
              .filter((r) => mirror || r.ok)
              .map((r, i) => ({ x: r.x, y: r.left, key: `c${i}`, color: r.ok ? ("ok" as const) : ("danger" as const), hollow: !r.ok, label: `x = ${fmtNum(r.x, locale)}` }))}
          />
        </div>
        <div className="space-y-4">
          <Slider name="a" value={a} min={-3} max={7} shown={fmtNum(a, locale)} onChange={setA} label={t(tx("Number under the root", "Zahl unter der Wurzel"))} />
          <Slider name="b" value={b} min={-3} max={4} shown={fmtNum(b, locale)} onChange={setB} label={t(tx("Number subtracted on the right", "Rechts abgezogene Zahl"))} />
          <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-ink-2">
            <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} className="size-4 accent-[var(--blob)]" />
            {t(tx("Show the mirrored line (what squaring adds)", "Gespiegelte Gerade zeigen (was das Quadrieren dazunimmt)"))}
          </label>
          <div className="space-y-2 rounded-xl border border-line bg-surface px-4 py-3">
            <Caption>{t(tx("Check", "Probe"))}</Caption>
            {rows.length === 0 && <p className="text-[13.5px] text-ink-2">{t(tx("Squaring gives no candidates at all: no solution.", "Das Quadrieren liefert gar keine Kandidaten: keine Lösung."))}</p>}
            <AnimatePresence initial={false}>
              {rows.map((r, i) => (
                <motion.div key={i} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <MathView src={`x = ${texNum(r.x, locale)}`} size="sm" animate={false} />
                  <MathView
                    src={`\\sqrt{${texNum(r.x + a, locale)}} ${near(r.left)} ${texNum(r.left, locale)} \\quad ${r.x < 0 ? `(${texNum(r.x, locale)})` : texNum(r.x, locale)}${b === 0 ? "" : ` ${b > 0 ? "-" : "+"} ${Math.abs(b)}`} ${near(r.right)} ${texNum(r.right, locale)}`}
                    size="sm"
                    animate={false}
                    className="text-ink-2"
                  />
                  <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-semibold text-white", r.ok ? "bg-ok" : "bg-danger")}>
                    {r.ok ? t(tx("real", "echt")) : t(tx("false", "Scheinlösung"))}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
            <div className="pt-1">
              {good.every((x) => Number.isInteger(x)) ? (
                <MathView src={setOf(good)} size="md" animate={false} />
              ) : (
                <span className="flex items-center gap-2 text-[13.5px] text-ink-2">
                  {t(tx("Real solution:", "Echte Lösung:"))}
                  <MathView src={good.map((x) => `x \\approx ${texNum(x, locale)}`).join(" \\quad ")} size="md" animate={false} className="text-ink" />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
