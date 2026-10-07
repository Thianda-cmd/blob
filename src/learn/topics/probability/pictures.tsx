"use client";

// Pictures for the probability topic: an urn with balls, a spinner, a tree diagram, a two-way
// table (Vierfeldertafel), Bernoulli paths and the binomial coefficient written the German way.
// They are used as task pictures with fixed props and inside the interactive widgets.

import { motion } from "motion/react";
import { Fragment, useId, type ReactNode } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cos, sin } from "@/lib/stableMath";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Colours of balls and spinner fields (tokens only)

export type Ball = "red" | "green" | "purple";
export const BALL: Record<Ball, { fill: string; name: Text; adj: Text; noun: Text; letter: Text }> = {
  red: { fill: "var(--danger)", name: tx("red", "rot"), adj: tx("red", "rote"), noun: tx("red", "Rot"), letter: "r" },
  green: { fill: "var(--ok)", name: tx("green", "grün"), adj: tx("green", "grüne"), noun: tx("green", "Grün"), letter: "g" },
  purple: { fill: "var(--blob)", name: tx("purple", "lila"), adj: tx("purple", "lila"), noun: tx("purple", "Lila"), letter: tx("p", "l") },
};
export type Field = Ball | "none";
const FIELD_FILL: Record<Field, string> = { ...Object.fromEntries(Object.entries(BALL).map(([k, v]) => [k, v.fill])), none: "var(--surface)" } as Record<Field, string>;

/** Number in the current language: decimal comma in German. */
export function useNum() {
  const locale = useLocale();
  return (v: number, d = 4) => {
    const s = String(Number((Math.round(v * 10 ** d) / 10 ** d).toFixed(d)));
    return locale === "de" ? s.replace(".", ",") : s;
  };
}

// ---------------------------------------------------------------------------
// Urn

/** Ball positions inside the urn, bottom row first (row y and how many fit). */
const ROWS: [number, number][] = [
  [170, 5],
  [148, 6],
  [126, 7],
  [104, 7],
  [82, 6],
  [60, 5],
];
const URN_PATH = "M 86 30 C 86 50, 32 62, 32 114 C 32 162, 66 192, 120 192 C 174 192, 208 162, 208 114 C 208 62, 154 50, 154 30 Z";

function slots(count: number): [number, number][] {
  const out: [number, number][] = [];
  let left = count;
  for (const [y, cap] of ROWS) {
    if (left <= 0) break;
    const k = Math.min(cap, left);
    for (let i = 0; i < k; i++) out.push([120 + (i - (k - 1) / 2) * 23, y]);
    left -= k;
  }
  return out;
}

/** A fixed mix of the balls (the same on server and browser). */
function mix(balls: { color: Ball; n: number }[]): Ball[] {
  const list = balls.flatMap((b) => Array.from({ length: b.n }, () => b.color));
  let s = list.length * 7919 + balls.reduce((a, b, i) => a + b.n * (i + 3) * 131, 17);
  for (let i = list.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** An urn with coloured balls and a legend with the counts. */
export function ProbabilityUrn({ balls, legend = true, className }: { balls: { color: Ball; n: number }[]; legend?: boolean; className?: string }) {
  const t = useText();
  const list = mix(balls.filter((b) => b.n > 0));
  const pos = slots(list.length);
  const label = balls
    .filter((b) => b.n > 0)
    .map((b) => `${b.n} × ${t(BALL[b.color].name)}`)
    .join(", ");
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <svg viewBox="0 0 240 200" className="block h-auto w-full max-w-[230px]" role="img" aria-label={`${t(tx("Urn with", "Urne mit"))} ${label}`}>
        <path d={URN_PATH} fill="var(--surface)" stroke="var(--ink-3)" strokeWidth={2.4} />
        <rect x={74} y={18} width={92} height={14} rx={7} fill="var(--surface)" stroke="var(--ink-3)" strokeWidth={2.4} />
        {list.map((c, i) => (
          <motion.g key={`${i}-${c}`} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 24, delay: Math.min(i, 24) * 0.012 }}>
            <circle cx={pos[i][0]} cy={pos[i][1]} r={10.5} fill={BALL[c].fill} />
            <circle cx={pos[i][0] - 3.4} cy={pos[i][1] - 3.6} r={3} fill="var(--raised)" opacity={0.45} />
          </motion.g>
        ))}
      </svg>
      {legend && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13.5px] text-ink-2">
          {balls
            .filter((b) => b.n > 0)
            .map((b) => (
              <span key={b.color} className="flex items-center gap-1.5">
                <span className="size-3 rounded-full" style={{ background: BALL[b.color].fill }} />
                <span className="tabular-nums">
                  {b.n} × {t(BALL[b.color].name)}
                </span>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spinner (Glücksrad)

export type Sector = { w: number; color: Field; label?: Text };

const SPIN_C = { x: 130, y: 134, r: 100 };
const polar = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [SPIN_C.x + r * cos(a), SPIN_C.y + r * sin(a)] as const;
};

/** A sector path from angle a0 to a1 (degrees, clockwise from the top). */
export function sectorPath(a0: number, a1: number, r = SPIN_C.r) {
  if (a1 - a0 >= 359.999) return `M ${SPIN_C.x - r} ${SPIN_C.y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
  const [x0, y0] = polar(a0, r);
  const [x1, y1] = polar(a1, r);
  return `M ${SPIN_C.x} ${SPIN_C.y} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

export function sectorAngles(sectors: Sector[]) {
  const total = sectors.reduce((s, x) => s + x.w, 0);
  let a = 0;
  return sectors.map((s) => {
    const a0 = a;
    a += (s.w / total) * 360;
    return [a0, a] as const;
  });
}

/** The wheel itself (no pointer), so the spinner widget can rotate it. */
export function SpinnerWheel({
  sectors,
  angles = false,
  onSector,
  focusLabel,
}: {
  sectors: Sector[];
  angles?: boolean;
  onSector?: (i: number) => void;
  focusLabel?: (i: number) => string;
}) {
  const t = useText();
  const span = sectorAngles(sectors);
  return (
    <g>
      {sectors.map((s, i) => {
        const [a0, a1] = span[i];
        const mid = (a0 + a1) / 2;
        const [lx, ly] = polar(mid, SPIN_C.r * (a1 - a0 < 50 ? 0.7 : 0.6));
        const text = s.label ? t(s.label) : angles ? `${Math.round(a1 - a0)}°` : "";
        const interactive = !!onSector;
        return (
          <g
            key={i}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? focusLabel?.(i) : undefined}
            onClick={interactive ? () => onSector(i) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSector(i);
                    }
                  }
                : undefined
            }
            className={interactive ? "cursor-pointer outline-none [&:focus-visible>path]:stroke-[var(--ink)]" : undefined}
          >
            <path d={sectorPath(a0, a1)} fill={FIELD_FILL[s.color]} fillOpacity={s.color === "none" ? 1 : 0.88} stroke="var(--raised)" strokeWidth={2.5} strokeLinejoin="round" style={{ transition: "fill 0.25s" }} />
            {text && (
              <g>
                <rect x={lx - (text.length * 4.6 + 8)} y={ly - 11} width={text.length * 9.2 + 16} height={22} rx={11} fill="var(--raised)" opacity={0.92} />
                <text x={lx} y={ly + 5} textAnchor="middle" fontSize={14} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}>
                  {text}
                </text>
              </g>
            )}
          </g>
        );
      })}
      <circle cx={SPIN_C.x} cy={SPIN_C.y} r={SPIN_C.r} fill="none" stroke="var(--ink-3)" strokeWidth={2} />
      <circle cx={SPIN_C.x} cy={SPIN_C.y} r={6} fill="var(--ink)" />
    </g>
  );
}

export function SpinnerPointer() {
  return <path d={`M ${SPIN_C.x - 11} 14 L ${SPIN_C.x + 11} 14 L ${SPIN_C.x} 40 Z`} fill="var(--ink)" stroke="var(--raised)" strokeWidth={2} strokeLinejoin="round" />;
}

export const SPINNER_VIEW = "0 0 260 244";

/** A spinner with equal or unequal fields (task picture). `angles` writes each field's angle into it. */
export function ProbabilitySpinner({ sectors, angles = false }: { sectors: Sector[]; angles?: boolean }) {
  const t = useText();
  return (
    <svg viewBox={SPINNER_VIEW} className="mx-auto block h-auto w-full max-w-[240px]" role="img" aria-label={t(tx("Spinner", "Glücksrad"))}>
      <SpinnerWheel sectors={sectors} angles={angles} />
      <SpinnerPointer />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Event letters with a bar for the complement ("~K" is K with a bar)

function Letter({ x, y, label, size = 16, fill = "var(--ink)" }: { x: number; y: number; label: string; size?: number; fill?: string }) {
  const bar = label.startsWith("~");
  const ch = bar ? label.slice(1) : label;
  return (
    <g>
      <text x={x} y={y} textAnchor="middle" fontSize={size} fill={fill} className="font-math" style={{ fontStyle: /[A-Za-z]/.test(ch) ? "italic" : "normal" }}>
        {ch}
      </text>
      {bar && <line x1={x - size * 0.32} x2={x + size * 0.36} y1={y - size * 0.86} y2={y - size * 0.86} stroke={fill} strokeWidth={1.4} />}
    </g>
  );
}

/** An event name for HTML: "~A" gets a bar on top. */
export function EventName({ label, className }: { label: string; className?: string }) {
  const bar = label.startsWith("~");
  return <span className={cn("font-math italic", bar && "overline decoration-[1.5px]", className)}>{bar ? label.slice(1) : label}</span>;
}

// ---------------------------------------------------------------------------
// Tree diagram

export type TreeBranch = { node: Text; p: string | number; kids?: TreeBranch[] };

type Laid = { id: string; node: Text; p: string | number; x: number; y: number; px: number; py: number; up: boolean; depth: number; leaf: number | null; path: number[] };

function layoutTree(branches: TreeBranch[], rowH: number, colW: number, pad: number) {
  const out: Laid[] = [];
  let leaf = 0;
  const walk = (list: TreeBranch[], depth: number, px: number, ancestors: number[]): number[] => {
    const ys: number[] = [];
    const placed: { b: TreeBranch; y: number; idx: number }[] = [];
    for (const b of list) {
      const idx = out.length;
      out.push({ id: "", node: b.node, p: b.p, x: 16 + (depth + 1) * colW, y: 0, px, py: 0, up: false, depth, leaf: null, path: [...ancestors, idx] });
      let y: number;
      if (b.kids?.length) {
        const kidYs = walk(b.kids, depth + 1, 16 + (depth + 1) * colW, [...ancestors, idx]);
        y = (kidYs[0] + kidYs[kidYs.length - 1]) / 2;
      } else {
        y = pad + (leaf + 0.5) * rowH;
        out[idx].leaf = leaf++;
      }
      out[idx].y = y;
      ys.push(y);
      placed.push({ b, y, idx });
    }
    // Labels sit above the upper branches (and the middle one) and below the lower ones.
    placed.forEach((p, i) => {
      out[p.idx].up = i <= (list.length - 1) / 2;
      out[p.idx].id = `${p.idx}`;
    });
    return ys;
  };
  walk(branches, 0, 16, []);
  // parent y
  for (const n of out) {
    const parent = n.path.length > 1 ? out[n.path[n.path.length - 2]] : null;
    n.py = parent ? parent.y : NaN;
  }
  const leaves = out.filter((n) => n.leaf !== null).length;
  const rootY = pad + (leaves * rowH) / 2;
  for (const n of out) if (Number.isNaN(n.py)) n.py = rootY;
  return { nodes: out, leaves, rootY };
}

/** A probability on a branch: "3/5" as a stacked fraction, numbers with a decimal comma, "?" highlighted. */
function BranchLabel({ x, y, p, size = 15 }: { x: number; y: number; p: string | number; size?: number }) {
  const num = useNum();
  if (typeof p === "string" && /^\d+\/\d+$/.test(p)) {
    const [a, b] = p.split("/");
    const w = Math.max(a.length, b.length) * size * 0.58 + 6;
    return (
      <g className="font-math" fontSize={size} fill="var(--ink)">
        <text x={x} y={y - 3} textAnchor="middle">
          {a}
        </text>
        <line x1={x - w / 2} x2={x + w / 2} y1={y + 1} y2={y + 1} stroke="var(--ink)" strokeWidth={1.3} />
        <text x={x} y={y + size + 1} textAnchor="middle">
          {b}
        </text>
      </g>
    );
  }
  const text = typeof p === "number" ? num(p) : p;
  const q = text === "?";
  return (
    <g>
      {q && <rect x={x - 13} y={y - 11} width={26} height={22} rx={7} fill="var(--blob)" opacity={0.16} />}
      <text x={x} y={y + 5} textAnchor="middle" fontSize={size} fill={q ? "var(--blob)" : "var(--ink)"} className="font-math" style={{ fontWeight: q ? 700 : 400 }}>
        {text}
      </text>
    </g>
  );
}

/**
 * A tree diagram, drawn left to right. `ends` writes a result behind each leaf (a fraction
 * "9/25", a number or text). `hl` highlights whole paths (leaf indices). With `onLeaf` the
 * leaves are buttons.
 */
export function ProbabilityTree({
  branches,
  ends,
  hl = [],
  onLeaf,
  leafLabel,
}: {
  branches: TreeBranch[];
  ends?: (string | number | null)[];
  hl?: number[];
  onLeaf?: (i: number) => void;
  leafLabel?: (i: number) => string;
}) {
  const t = useText();
  const num = useNum();
  const depth = (b: TreeBranch[]): number => 1 + Math.max(0, ...b.map((x) => (x.kids ? depth(x.kids) : 0)));
  const D = depth(branches);
  const rowH = D >= 3 ? 34 : 50;
  const colW = D >= 3 ? 112 : 150;
  const pad = 20;
  const { nodes, leaves } = layoutTree(branches, rowH, colW, pad);
  const lit = new Set<number>();
  for (const n of nodes) if (n.leaf !== null && hl.includes(n.leaf)) n.path.forEach((i) => lit.add(i));
  const leafX = 16 + D * colW + 28;
  const width = leafX + (ends ? 120 : 60);
  const height = leaves * rowH + 2 * pad;
  const leafNodes = nodes.filter((n) => n.leaf !== null);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto block h-auto w-full" style={{ maxWidth: width * 1.25 }} role="img" aria-label={t(tx("Tree diagram", "Baumdiagramm"))}>
      {/* branches */}
      {nodes.map((n, i) => {
        const on = lit.has(i);
        const zero = n.p === 0 || n.p === "0/1" || (typeof n.p === "string" && /^0\/\d+$/.test(n.p));
        return (
          <line
            key={`l${i}`}
            x1={n.px + 12}
            y1={n.py}
            x2={n.x - 13}
            y2={n.y}
            stroke={on ? "var(--blob)" : "var(--ink-3)"}
            strokeWidth={on ? 3.2 : 1.6}
            strokeDasharray={zero ? "4 4" : undefined}
            style={{ transition: "stroke 0.25s, stroke-width 0.25s" }}
          />
        );
      })}
      {/* probabilities on the branches */}
      {nodes.map((n, i) => {
        const mx = n.px + (n.x - n.px) * 0.5;
        const my = n.py + (n.y - n.py) * 0.5;
        const stacked = typeof n.p === "string" && /^\d+\/\d+$/.test(n.p);
        const flat = Math.abs(n.y - n.py) < 2;
        const off = flat ? -16 : stacked ? 21 : 13;
        return <BranchLabel key={`p${i}`} x={mx} y={flat ? my + off : n.up ? my - off : my + off} p={n.p} size={D >= 3 ? 13.5 : 15} />;
      })}
      {/* root and nodes */}
      <circle cx={16} cy={pad + (leaves * rowH) / 2} r={4} fill="var(--ink)" />
      {nodes.map((n, i) => (
        <g key={`n${i}`}>
          <circle cx={n.x} cy={n.y} r={13} fill={lit.has(i) ? "var(--blob)" : "var(--raised)"} stroke={lit.has(i) ? "var(--blob)" : "var(--ink-3)"} strokeWidth={1.6} style={{ transition: "fill 0.25s" }} />
          <Letter x={n.x} y={n.y + 5.5} label={t(n.node)} size={15} fill={lit.has(i) ? "var(--raised)" : "var(--ink)"} />
        </g>
      ))}
      {/* leaves: the path as a word and the result */}
      {leafNodes.map((n) => {
        const i = n.leaf!;
        const word = n.path.map((k) => t(nodes[k].node));
        const on = hl.includes(i);
        const end = ends?.[i];
        const content = (
          <g>
            {onLeaf && <rect x={leafX - 8} y={n.y - rowH / 2 + 3} width={width - leafX + 4} height={rowH - 6} rx={9} fill={on ? "var(--blob)" : "var(--surface)"} opacity={on ? 0.14 : 1} stroke={on ? "var(--blob)" : "var(--line)"} strokeWidth={1.2} />}
            {word.map((w, k) => (
              <Letter key={k} x={leafX + 6 + k * 13} y={n.y + 5} label={w} size={15} fill={on ? "var(--blob-ink)" : "var(--ink)"} />
            ))}
            {end !== undefined && end !== null && (
              <g>
                <text x={leafX + 12 + word.length * 13} y={n.y + 5} fontSize={15} fill="var(--ink-3)" className="font-math">
                  =
                </text>
                {typeof end === "string" && /^\d+\/\d+$/.test(end) ? (
                  <BranchLabel x={leafX + 40 + word.length * 13} y={n.y - 2} p={end} size={D >= 3 ? 12.5 : 14} />
                ) : (
                  <text x={leafX + 28 + word.length * 13} y={n.y + 5} fontSize={15} fill="var(--ink)" className="font-math">
                    {typeof end === "number" ? num(end) : end}
                  </text>
                )}
              </g>
            )}
          </g>
        );
        return onLeaf ? (
          <g
            key={`f${i}`}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={leafLabel?.(i)}
            onClick={() => onLeaf(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onLeaf(i);
              }
            }}
            className="cursor-pointer outline-none [&:focus-visible>g>rect]:stroke-[var(--ink)]"
          >
            {content}
          </g>
        ) : (
          <Fragment key={`f${i}`}>{content}</Fragment>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Two-way table (Vierfeldertafel)

export type Cell = number | "?" | null;

/**
 * A two-way table: rows A, Ā, total; columns B, B̄, total. `cells` is 3×3 (inner fields, then
 * the totals). Numbers get a decimal comma in German; "?" marks the field to find, null an empty one.
 */
export function ProbabilityFourField({
  cells,
  a = "A",
  b = "B",
  hl = [],
  legend,
}: {
  cells: Cell[][];
  a?: string;
  b?: string;
  hl?: [number, number][];
  legend?: { a: Text; b: Text };
}) {
  const t = useText();
  const num = useNum();
  const isHl = (r: number, c: number) => hl.some(([x, y]) => x === r && y === c);
  const head = (label: ReactNode, key: string) => (
    <th key={key} scope="col" className="border-b border-line px-3 py-2 text-center text-[17px] font-normal text-ink-2">
      {label}
    </th>
  );
  const rows = [<EventName key="a" label={a} />, <EventName key="na" label={`~${a}`} />, <span key="s">Σ</span>];
  return (
    <div className="mx-auto w-full max-w-[420px] space-y-2">
      <table className="w-full border-collapse font-math tabular-nums" aria-label={t(tx("Two-way table", "Vierfeldertafel"))}>
        <thead>
          <tr>
            <th className="border-b border-line" />
            {head(<EventName label={b} />, "b")}
            {head(<EventName label={`~${b}`} />, "nb")}
            {head("Σ", "s")}
          </tr>
        </thead>
        <tbody>
          {cells.map((row, r) => (
            <tr key={r} className={cn(r === 2 && "border-t-2 border-line-2")}>
              <th scope="row" className="border-r border-line px-3 py-2 text-left text-[17px] font-normal text-ink-2">
                {rows[r]}
              </th>
              {row.map((v, c) => {
                const total = r === 2 || c === 2;
                return (
                  <td
                    key={c}
                    className={cn(
                      "px-3 py-2 text-center text-[18px] transition-colors",
                      c === 2 && "border-l-2 border-line-2",
                      total ? "text-ink-2" : "text-ink",
                      isHl(r, c) && "rounded-md bg-blob-soft font-semibold text-blob-ink",
                      v === "?" && "font-bold text-blob-ink",
                    )}
                  >
                    {v === null ? "" : v === "?" ? "?" : num(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {legend && (
        <div className="flex flex-col gap-0.5 px-1 text-[13.5px] text-ink-2">
          <span>
            <EventName label={a} className="text-ink" />: {t(legend.a)}
          </span>
          <span>
            <EventName label={b} className="text-ink" />: {t(legend.b)}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Binomial coefficient, written as German schools do: n over k in round brackets

function Fence({ right }: { right?: boolean }) {
  return (
    <svg viewBox="0 0 10 40" preserveAspectRatio="none" className="w-[0.42em] self-stretch" aria-hidden>
      <path d={right ? "M2 1 C9 10 9 30 2 39" : "M8 1 C1 10 1 30 8 39"} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

/** (n über k) with the two numbers stacked, in round brackets. */
export function Binom({ n, k, className }: { n: ReactNode; k: ReactNode; className?: string }) {
  const t = useText();
  return (
    <span className={cn("inline-flex items-stretch align-middle font-math", className)} role="math" aria-label={`${n} ${t(tx("choose", "über"))} ${k}`}>
      <Fence />
      <span className="flex flex-col items-center justify-center px-[0.08em] text-[0.82em] leading-[1.1]">
        <span>{n}</span>
        <span>{k}</span>
      </span>
      <Fence right />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Bernoulli paths: every path of length n, those with k hits highlighted

/** All paths of a Bernoulli chain (1 = hit, 0 = miss), with the ones that have exactly k hits highlighted. */
export function ProbabilityPaths({ n, k, p }: { n: number; k: number; p: number }) {
  const t = useText();
  const num = useNum();
  const all = Array.from({ length: 2 ** n }, (_, i) =>
    Array.from({ length: n }, (_, j) => ((i >> (n - 1 - j)) & 1) as 0 | 1),
  ).sort((x, y) => y.reduce<number>((s, v) => s + v, 0) - x.reduce<number>((s, v) => s + v, 0));
  const count = all.filter((w) => w.reduce<number>((s, v) => s + v, 0) === k).length;
  const q = 1 - p;
  const result = count * p ** k * q ** (n - k);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-center gap-2">
        {all.map((w, i) => {
          const hits = w.reduce<number>((s, v) => s + v, 0);
          const on = hits === k;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: on ? 1 : 0.45, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn("flex items-center gap-1 rounded-xl border px-2 py-1.5", on ? "border-blob bg-blob-soft" : "border-line bg-surface")}
            >
              {w.map((v, j) => (
                <span
                  key={j}
                  className={cn(
                    "grid size-6 place-items-center rounded-full font-math text-[13px]",
                    v ? "bg-blob text-[color:var(--raised)]" : "border border-ink-3 text-ink-2",
                  )}
                >
                  {v}
                </span>
              ))}
            </motion.div>
          );
        })}
      </div>
      <div className="space-y-1 text-center text-[14px] text-ink-2">
        <div>
          <span className="font-semibold text-blob-ink">1</span> = {t(tx("hit", "Treffer"))} ({num(p)}) · <span className="font-semibold">0</span> = {t(tx("miss", "Niete"))} ({num(q)})
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-2 text-[20px] text-ink">
          <MathView src={`P(X = ${k}) =`} size="md" animate={false} />
          <Binom n={n} k={k} className="text-[24px]" />
          <MathView src={`\\cdot ${num(p)}^{${k}} \\cdot ${num(q)}^{${n - k}} = ${count} \\cdot ${num(p ** k * q ** (n - k), 5)} = ${num(result, 4)}`} size="md" animate={false} />
        </div>
        <div>
          {t(
            tx(
              `${count} paths have exactly ${k} hits. Each has the probability ${num(p)}^${k} · ${num(q)}^${n - k}.`,
              `${count} Pfade haben genau ${k} Treffer. Jeder hat die Wahrscheinlichkeit ${num(p)}^${k} · ${num(q)}^${n - k}.`,
            ),
          )}
        </div>
      </div>
    </div>
  );
}

/** Pips of a die face. */
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

/** A die face drawn at (x, y) with side s. */
export function DieFace({ x, y, s, n, lit = false }: { x: number; y: number; s: number; n: number; lit?: boolean }) {
  return (
    <g>
      <rect x={x - s / 2} y={y - s / 2} width={s} height={s} rx={s * 0.2} fill={lit ? "var(--blob)" : "var(--raised)"} stroke={lit ? "var(--blob)" : "var(--ink-3)"} strokeWidth={1.4} />
      {(PIPS[n] ?? []).map(([dx, dy], i) => (
        <circle key={i} cx={x + dx * s * 0.26} cy={y + dy * s * 0.26} r={s * 0.09} fill={lit ? "var(--raised)" : "var(--ink)"} />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Probability scale from 0 (impossible) to 1 (certain)

/** A scale from impossible to certain with events marked on it. */
export function ProbabilityScale({ marks }: { marks: { p: number; label: Text; frac?: string }[] }) {
  const t = useText();
  const grad = useId().replace(/:/g, "");
  const W = 520;
  const x = (p: number) => 30 + p * (W - 60);
  const sorted = [...marks].sort((a, b) => a.p - b.p);
  return (
    <svg viewBox={`0 0 ${W} 170`} className="mx-auto block h-auto w-full max-w-[620px]" role="img" aria-label={t(tx("Probability scale from 0 to 1", "Wahrscheinlichkeitsskala von 0 bis 1"))}>
      <defs>
        <linearGradient id={grad} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--line)" />
          <stop offset="1" stopColor="var(--blob)" />
        </linearGradient>
      </defs>
      <rect x={30} y={78} width={W - 60} height={12} rx={6} fill={`url(#${grad})`} />
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={72} y2={96} stroke="var(--ink-3)" strokeWidth={1.4} />
          <text x={x(v)} y={112} textAnchor="middle" fontSize={14} fill="var(--ink)" className="font-math">
            {v === 0.5 ? (t(tx("0.5", "0,5"))) : v}
          </text>
        </g>
      ))}
      <text x={x(0)} y={132} textAnchor="middle" fontSize={12.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
        {t(tx("impossible", "unmöglich"))}
      </text>
      <text x={x(1)} y={132} textAnchor="middle" fontSize={12.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
        {t(tx("certain", "sicher"))}
      </text>
      {sorted.map((m, i) => {
        const above = i % 2 === 0;
        const y = above ? 34 : 156;
        return (
          <motion.g key={i} initial={{ opacity: 0, y: above ? -8 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.12 }}>
            <line x1={x(m.p)} x2={x(m.p)} y1={above ? 44 : 96} y2={above ? 78 : 140} stroke="var(--blob)" strokeWidth={1.6} strokeDasharray="3 3" />
            <circle cx={x(m.p)} cy={84} r={6} fill="var(--blob)" stroke="var(--raised)" strokeWidth={2} />
            <text x={Math.min(W - 8, Math.max(8, x(m.p)))} y={y} textAnchor={m.p < 0.08 ? "start" : m.p > 0.92 ? "end" : "middle"} fontSize={13} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}>
              {t(m.label)}
              {m.frac ? ` (${m.frac})` : ""}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}
