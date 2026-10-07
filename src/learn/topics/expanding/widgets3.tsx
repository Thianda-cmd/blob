"use client";

import { animate, AnimatePresence, motion, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { Minus, Plus, Sparkles } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";

const spring = { type: "spring" as const, stiffness: 320, damping: 30 };

/** n over k. */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

// ---------------------------------------------------------------------------
// The binomial coefficient as German schools write it: n above k in round brackets.

function Fence({ side }: { side: "l" | "r" }) {
  return (
    <span className="flex w-[0.36em] shrink-0 py-[0.04em]" aria-hidden>
      <svg viewBox="0 0 10 20" preserveAspectRatio="none" className="h-full w-full overflow-visible">
        <path d={side === "l" ? "M8 0 C2 5 2 15 8 20" : "M2 0 C8 5 8 15 2 20"} fill="none" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** (n über k), stacked, in the maths font. */
export function Binom({ n, k, className }: { n: ReactNode; k: ReactNode; className?: string }) {
  return (
    <span className={cn("blob-math inline-flex items-stretch align-middle", className)} role="math">
      <Fence side="l" />
      <span className="inline-flex flex-col items-center justify-center px-[0.1em] text-[0.82em] leading-[1.15]">
        <span>{n}</span>
        <span>{k}</span>
      </span>
      <Fence side="r" />
    </span>
  );
}

/** Practice picture: a binomial coefficient to calculate. */
export function ExpandingBinomTask(props: Record<string, unknown>) {
  const t = useText();
  const n = Number(props.n ?? 5);
  const k = Number(props.k ?? 2);
  return (
    <div className="grid place-items-center py-4">
      <div className="flex items-center gap-3 text-[40px] text-ink">
        <Binom n={n} k={k} />
        <span className="blob-math">=</span>
        <span className="blob-math text-ink-3">?</span>
      </div>
      <div className="mt-1 text-[13px] text-ink-3">{t(tx(`read: “${n} choose ${k}”`, `gelesen: „${n} über ${k}“`))}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The square puzzle: x² + bx + c as tiles. Only with c = (b/2)² do they form a full square.

const X = 120;
const UU = 18;
const MAXK = 6;
const MAXC = 36;
const PER_ROW = 13;

function InlineStep({ value, onChange, min, max, step = 1, label }: { value: number; onChange: (n: number) => void; min: number; max: number; step?: number; label: string }) {
  const t = useText();
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-1 py-0.5">
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} className="grid size-7 place-items-center rounded-md text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30" aria-label={t(tx(`${label}: less`, `${label}: weniger`))}>
        <Minus className="size-3.5" />
      </button>
      <motion.span key={value} initial={{ y: -5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="blob-math min-w-6 text-center text-[22px] tabular-nums text-blob-ink">
        {value}
      </motion.span>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} className="grid size-7 place-items-center rounded-md text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30" aria-label={t(tx(`${label}: more`, `${label}: mehr`))}>
        <Plus className="size-3.5" />
      </button>
    </span>
  );
}

/** Lay x², the x-strips and the unit squares out as a square: when does x² + bx + c become (x + b/2)²? */
export function ExpandingSquarePuzzle() {
  const t = useText();
  const scope = useId();
  const [k, setK] = useState(3);
  const [c, setC] = useState(5);
  const full = k * k;
  const perfect = c === full;
  const missing = Math.max(0, full - c);
  const extra = Math.max(0, c - full);
  const side = X + k * UU;
  const pad = 30;
  const trayY = pad + X + MAXK * UU + 18;
  const W = pad + X + MAXK * UU + 12;
  const H = trayY + 3 * (UU + 3) + 6;
  const cells = Array.from({ length: full }, (_, i) => ({ r: Math.floor(i / k), q: i % k }));
  const tiles = Array.from({ length: c }, (_, i) =>
    i < full
      ? { x: pad + X + cells[i].q * UU, y: pad + X + cells[i].r * UU, extra: false }
      : { x: pad + ((i - full) % PER_ROW) * (UU + 3), y: trayY + Math.floor((i - full) / PER_ROW) * (UU + 3), extra: true },
  );
  const term = `x^2 + ${2 * k}x + ${c}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-[22px]">
        <MathView src="x^2 +" size="md" animate={false} />
        <InlineStep value={2 * k} min={2} max={2 * MAXK} step={2} onChange={(v) => setK(v / 2)} label={t(tx("x-coefficient", "x-Koeffizient"))} />
        <MathView src="x +" size="md" animate={false} />
        <InlineStep value={c} min={0} max={MAXC} onChange={setC} label={t(tx("Number at the end", "Zahl am Ende"))} />
        <button
          type="button"
          onClick={() => setC(full)}
          disabled={perfect}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40"
        >
          <Sparkles className="size-3.5" /> {t(tx("Make it a square", "Zum Quadrat machen"))}
        </button>
      </div>

      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,330px)_minmax(0,1fr)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[330px]" role="img" aria-label={t(tx(`Tiles for ${term}`, `Kacheln für ${term}`))}>
          {/* side labels */}
          <text x={pad + X / 2} y={pad - 10} textAnchor="middle" fontSize={16} className="font-math" fill="var(--ink-2)" fontStyle="italic">
            x
          </text>
          <motion.text initial={false} animate={{ x: pad + X + (k * UU) / 2 }} transition={spring} y={pad - 10} textAnchor="middle" fontSize={16} className="font-math" fill="var(--blob-ink)">
            {k}
          </motion.text>
          <text x={pad - 12} y={pad + X / 2 + 5} textAnchor="middle" fontSize={16} className="font-math" fill="var(--ink-2)" fontStyle="italic">
            x
          </text>
          <motion.text initial={false} animate={{ y: pad + X + (k * UU) / 2 + 5 }} transition={spring} x={pad - 12} textAnchor="middle" fontSize={16} className="font-math" fill="var(--blob-ink)">
            {k}
          </motion.text>

          {/* x² */}
          <rect x={pad} y={pad} width={X} height={X} rx={3} fill="color-mix(in oklab, var(--blob) 32%, transparent)" stroke="var(--blob)" strokeWidth={1.5} />
          <text x={pad + X / 2} y={pad + X / 2 + 8} textAnchor="middle" fontSize={24} className="font-math" fill="var(--blob-ink)">
            <tspan fontStyle="italic">x</tspan>
            <tspan dy={-9} fontSize={15}>
              2
            </tspan>
          </text>

          {/* the x-strips: half on the right, half below */}
          <AnimatePresence initial={false}>
            {Array.from({ length: k }, (_, i) => (
              <motion.g key={`r${i}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={spring}>
                <rect x={pad + X + i * UU + 1} y={pad} width={UU - 2} height={X} rx={3} fill="color-mix(in oklab, var(--blob) 16%, transparent)" stroke="var(--blob)" strokeWidth={1.2} />
                <text x={pad + X + i * UU + UU / 2} y={pad + X / 2 + 4} textAnchor="middle" fontSize={11} className="font-math" fontStyle="italic" fill="var(--blob-ink)">
                  x
                </text>
              </motion.g>
            ))}
            {Array.from({ length: k }, (_, i) => (
              <motion.g key={`b${i}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={spring}>
                <rect x={pad} y={pad + X + i * UU + 1} width={X} height={UU - 2} rx={3} fill="color-mix(in oklab, var(--blob) 16%, transparent)" stroke="var(--blob)" strokeWidth={1.2} />
                <text x={pad + X / 2} y={pad + X + i * UU + UU / 2 + 4} textAnchor="middle" fontSize={11} className="font-math" fontStyle="italic" fill="var(--blob-ink)">
                  x
                </text>
              </motion.g>
            ))}
          </AnimatePresence>

          {/* empty places in the corner */}
          {cells.slice(c).map((cell) => (
            <rect
              key={`m${cell.r}-${cell.q}`}
              x={pad + X + cell.q * UU + 2}
              y={pad + X + cell.r * UU + 2}
              width={UU - 4}
              height={UU - 4}
              rx={2}
              fill="none"
              stroke="var(--danger)"
              strokeWidth={1.2}
              strokeDasharray="3 2"
            />
          ))}

          {/* unit squares */}
          <AnimatePresence initial={false}>
            {tiles.map((tile, i) => (
              <motion.rect
                key={`u${i}`}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1, x: tile.x + 1, y: tile.y + 1 }}
                exit={{ opacity: 0, scale: 0.3 }}
                transition={spring}
                width={UU - 2}
                height={UU - 2}
                rx={2.5}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                fill={tile.extra ? "color-mix(in oklab, var(--danger) 14%, transparent)" : "color-mix(in oklab, var(--ink) 12%, transparent)"}
                stroke={tile.extra ? "var(--danger)" : "var(--ink-3)"}
                strokeWidth={1.2}
              />
            ))}
          </AnimatePresence>

          {/* the finished square */}
          <AnimatePresence>
            {perfect && (
              <motion.rect
                key={`sq${k}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                x={pad - 3}
                y={pad - 3}
                width={side + 6}
                height={side + 6}
                rx={6}
                fill="none"
                stroke="var(--ok)"
                strokeWidth={2.5}
              />
            )}
          </AnimatePresence>
          {extra > 0 && (
            <text x={pad} y={trayY - 5} fontSize={11} fill="var(--danger)" fontFamily="var(--font-sans)">
              {t(tx("left over", "übrig"))}
            </text>
          )}
        </svg>

        <div className="min-w-0 space-y-3">
          <div className="min-h-[40px]">
            <MathView src={perfect ? `x^2 + ${2 * k}#m x + ${c}#c = (x + ${k}#k)^2` : `x^2 + ${2 * k}#m x + ${c}#c`} size="md" scope={`${scope}-f`} />
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={perfect ? "ok" : missing ? `m${missing}` : `e${extra}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn("text-[14px] font-medium leading-relaxed", perfect ? "text-ok" : "text-ink")}
            >
              {perfect
                ? t(tx(`A perfect square with side x + ${k}. That's the 1st binomial formula backwards!`, `Ein vollständiges Quadrat mit der Seite x + ${k}. Das ist die 1. binomische Formel rückwärts!`))
                : missing
                  ? t(tx(`${missing} small square${missing === 1 ? " is" : "s are"} missing in the corner. No full square yet.`, `In der Ecke ${missing === 1 ? "fehlt 1 Kästchen" : `fehlen ${missing} Kästchen`}. Noch kein volles Quadrat.`))
                  : t(tx(`${extra} small square${extra === 1 ? " is" : "s are"} left over. These tiles can't form a square.`, `${extra === 1 ? "1 Kästchen ist" : `${extra} Kästchen sind`} übrig. Diese Kacheln ergeben kein Quadrat.`))}
            </motion.p>
          </AnimatePresence>
          <p className="max-w-[420px] text-[13.5px] leading-relaxed text-ink-2">
            {t(
              tx(
                `The ${2 * k} x-strips are split: half on the right, half below. The corner left over is ${k} by ${k}, so it needs exactly ${k} · ${k} = ${full} small squares. Rule: the number at the end must be (half the x-coefficient)².`,
                `Die ${2 * k} x-Streifen werden geteilt: die Hälfte rechts, die Hälfte unten. Die freie Ecke ist ${k} mal ${k} groß, braucht also genau ${k} · ${k} = ${full} Kästchen. Regel: Die Zahl am Ende muss (halber x-Koeffizient)² sein.`,
              ),
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// (a + b)³ as a cube cut into 8 blocks that can be pulled apart (oblique view: front, top and right faces).

const CA = 3;
const CB = 1.35;
const CS = 34;
const GAP = 1.15;
const DEPTH_X = 0.42;
const DEPTH_Z = 0.3;
type CubeKind = 0 | 1 | 2 | 3;
const KIND_LABEL = ["a³", "a²b", "ab²", "b³"];
const KIND_FILL = [
  "color-mix(in oklab, var(--blob) 70%, var(--raised))",
  "color-mix(in oklab, var(--blob) 40%, var(--raised))",
  "color-mix(in oklab, var(--blob) 18%, var(--raised))",
  "color-mix(in oklab, var(--ink) 26%, var(--raised))",
];
const KIND_SIZE = [21, 15, 12, 12];

function cubeBlocks(e: number) {
  const proj = (x: number, y: number, z: number): [number, number] => [18 + (x + DEPTH_X * y) * CS, 264 - (z + DEPTH_Z * y) * CS];
  const out: { id: string; kind: CubeKind; order: number; faces: { d: string; shade: number }[]; label: [number, number] }[] = [];
  for (const i of [0, 1])
    for (const j of [0, 1])
      for (const l of [0, 1]) {
        // index 0 = the a-part (front, left, bottom), 1 = the b-part; b-parts move outwards when pulled apart.
        const span = (n: number) => (n ? [CA + e * GAP, CA + CB + e * GAP] : [0, CA]);
        const [x0, x1] = span(i);
        const [y0, y1] = span(j);
        const [z0, z1] = span(l);
        const poly = (pts: [number, number, number][]) => `M ${pts.map((q) => proj(...q).map((v) => v.toFixed(2)).join(" ")).join(" L ")} Z`;
        const xm = (x0 + x1) / 2;
        const ym = (y0 + y1) / 2;
        const zm = (z0 + z1) / 2;
        const label = j === 0 ? proj(xm, y0, zm) : l === 1 ? proj(xm, ym, z1) : i === 1 ? proj(x1, ym, zm) : proj(xm, ym, z1);
        out.push({
          id: `${i}${j}${l}`,
          kind: (i + j + l) as CubeKind,
          // back to front, bottom to top, left to right
          order: (1 - j) * 100 + l * 10 + i,
          faces: [
            { d: poly([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]), shade: 1 },
            { d: poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]), shade: 0 },
            { d: poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]), shade: 2 },
          ],
          label,
        });
      }
  return out.sort((p, q) => p.order - q.order);
}

const shadeFill = (base: string, shade: number) => (shade === 0 ? `color-mix(in oklab, ${base} 78%, var(--raised))` : shade === 1 ? base : `color-mix(in oklab, ${base} 80%, var(--ink))`);

/** (a + b)³ = a³ + 3a²b + 3ab² + b³, seen in a cube with side a + b. */
export function ExpandingCube() {
  const t = useText();
  const scope = useId();
  const reduce = useReducedMotion();
  const [e, setE] = useState(0.55);
  const [focus, setFocus] = useState<CubeKind | null>(null);
  const run = useRef<AnimationPlaybackControls | null>(null);
  const blocks = cubeBlocks(e);
  const toggle = () => {
    const to = e > 0.3 ? 0 : 1;
    run.current?.stop();
    if (reduce) setE(to);
    else run.current = animate(e, to, { type: "spring", stiffness: 120, damping: 20, onUpdate: setE });
  };
  const terms = ["a^3", "3a^2b", "3ab^2", "b^3"];
  const formula = `(a + b)^3 = ${terms.map((x, i) => (focus === i ? `\\hl{${x}}` : x)).join(" + ")}`;
  const counts = [1, 3, 3, 1];

  return (
    <div className="space-y-4">
      <div className="grid items-center gap-5 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <svg viewBox="0 0 300 280" className="mx-auto w-full max-w-[320px]" role="img" aria-label={t(tx("A cube with edge a + b, cut into 8 blocks", "Ein Würfel mit der Kante a + b, zerlegt in 8 Quader"))}>
          {blocks.map((b) => {
            const dim = focus !== null && focus !== b.kind;
            const hidden = b.id === "010" ? Math.min(1, e * 3) : 1;
            return (
              <motion.g key={b.id} animate={{ opacity: dim ? 0.14 : 1 }} transition={{ duration: 0.25 }}>
                {b.faces.map((f, n) => (
                  <path key={n} d={f.d} fill={shadeFill(KIND_FILL[b.kind], f.shade)} stroke="var(--ink-2)" strokeWidth={0.9} strokeLinejoin="round" />
                ))}
                <text x={b.label[0]} y={b.label[1] + KIND_SIZE[b.kind] / 3} textAnchor="middle" fontSize={KIND_SIZE[b.kind]} className="font-math" fontStyle="italic" fill="var(--ink)" opacity={hidden}>
                  {KIND_LABEL[b.kind]}
                </text>
              </motion.g>
            );
          })}
        </svg>
        <div className="min-w-0 space-y-4">
          <MathView src={formula} size="md" scope={`${scope}-f`} />
          <div className="flex flex-wrap gap-1.5">
            {KIND_LABEL.map((label, i) => (
              <button
                key={label}
                type="button"
                aria-pressed={focus === i}
                onClick={() => setFocus(focus === i ? null : (i as CubeKind))}
                className={cn("h-9 rounded-lg border px-3 font-math text-[15px] transition-colors", focus === i ? "border-blob bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
              >
                {counts[i]} × <span className="italic">{label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(e * 100)}
              onChange={(ev) => {
                run.current?.stop();
                setE(Number(ev.target.value) / 100);
              }}
              aria-label={t(tx("Pull the blocks apart", "Quader auseinanderziehen"))}
              className="h-2 min-w-0 flex-1 cursor-pointer accent-[var(--blob)]"
            />
            <button type="button" onClick={toggle} className="h-9 shrink-0 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
              {e > 0.3 ? t(tx("Put together", "Zusammensetzen")) : t(tx("Pull apart", "Auseinanderziehen"))}
            </button>
          </div>
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            {t(
              tx(
                "Each edge is a + b long. Cut along a and b in all three directions and you get 8 blocks: one big cube a³, three slabs a²b, three rods ab² and one small cube b³. Tap a term to find its blocks.",
                "Jede Kante ist a + b lang. Schneidest du in alle drei Richtungen bei a und b, entstehen 8 Quader: ein großer Würfel a³, drei Platten a²b, drei Stangen ab² und ein kleiner Würfel b³. Tipp auf einen Term, um seine Quader zu finden.",
              ),
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pascal's triangle: every number is the sum of the two above; row n holds the coefficients of (a + b)ⁿ.

const PN = 8;
const DX = 38;
const DY = 36;
const PW = (PN + 1) * DX + 10;
const PH = (PN + 1) * DY + 8;
const px = (n: number, k: number) => PW / 2 + (k - n / 2) * DX;
const py = (n: number) => 22 + n * DY;

/** (a + b)ⁿ written out, the k-th term highlighted. */
function expansionSrc(n: number, mark: number): string {
  const terms = Array.from({ length: n + 1 }, (_, i) => {
    const c = choose(n, i);
    const pa = n - i === 0 ? "" : n - i === 1 ? "a" : `a^${n - i}`;
    const pb = i === 0 ? "" : i === 1 ? "b" : `b^${i}`;
    const body = `${c === 1 ? "" : c}${pa}${pb}` || "1";
    return i === mark ? `\\hl{${body}}` : body;
  });
  return `(a + b)^${n} = ${terms.join(" + ")}`;
}

/** Build Pascal's triangle row by row and see where the numbers of (a + b)ⁿ come from. */
export function ExpandingPascal() {
  const t = useText();
  const scope = useId();
  const [rows, setRows] = useState(5);
  const [sel, setSel] = useState<[number, number]>([4, 2]);
  const n = Math.min(sel[0], rows);
  const k = Math.min(sel[1], n);
  const edge = k === 0 || k === n;
  const select = (nn: number, kk: number) => setSel([nn, kk]);
  const key = (e: KeyboardEvent) => {
    const moves: Record<string, [number, number]> = { ArrowLeft: [n, k - 1], ArrowRight: [n, k + 1], ArrowUp: [n - 1, Math.min(k, n - 1)], ArrowDown: [n + 1, k] };
    const to = moves[e.key];
    if (!to) return;
    e.preventDefault();
    const [nn, kk] = to;
    if (nn >= 0 && nn <= rows && kk >= 0 && kk <= nn) select(nn, kk);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-ink-2">{t(tx("Rows", "Zeilen"))}</span>
        <button type="button" onClick={() => setRows(Math.max(1, rows - 1))} disabled={rows <= 1} className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35" aria-label={t(tx("Remove a row", "Eine Zeile weg"))}>
          <Minus className="size-3.5" />
        </button>
        <button type="button" onClick={() => setRows(Math.min(PN, rows + 1))} disabled={rows >= PN} className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35" aria-label={t(tx("Add the next row", "Nächste Zeile dazu"))}>
          <Plus className="size-3.5" />
        </button>
        <span className="text-[12.5px] text-ink-3">{t(tx("Tap a number. Arrow keys work too.", "Tipp auf eine Zahl. Pfeiltasten gehen auch."))}</span>
      </div>

      <svg
        viewBox={`0 0 ${PW} ${PH}`}
        className="mx-auto block w-full max-w-[420px] rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blob/50"
        tabIndex={0}
        data-own-keys
        onKeyDown={key}
        role="group"
        aria-label={t(tx(`Pascal's triangle, row ${n}, place ${k}: ${choose(n, k)}`, `Pascalsches Dreieck, Zeile ${n}, Stelle ${k}: ${choose(n, k)}`))}
      >
        {/* row band */}
        <motion.rect initial={false} animate={{ y: py(n) - 17, x: px(n, 0) - 21, width: n * DX + 42 }} transition={spring} height={34} rx={17} fill="color-mix(in oklab, var(--blob) 8%, transparent)" />
        {/* lines from the two numbers above */}
        {!edge && (
          <g key={`${n}-${k}`}>
            {[k - 1, k].map((pk) => (
              <motion.path
                key={pk}
                d={`M ${px(n - 1, pk)} ${py(n - 1) + 14} L ${px(n, k)} ${py(n) - 14}`}
                stroke="var(--blob)"
                strokeWidth={2}
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.35 }}
              />
            ))}
          </g>
        )}
        {Array.from({ length: PN + 1 }, (_, r) =>
          Array.from({ length: r + 1 }, (_, q) => {
            const shown = r <= rows;
            const isSel = r === n && q === k;
            const parent = !edge && r === n - 1 && (q === k - 1 || q === k);
            const v = choose(r, q);
            if (!shown) {
              return <circle key={`${r}-${q}`} cx={px(r, q)} cy={py(r)} r={13} fill="none" stroke="var(--line-2)" strokeDasharray="3 3" />;
            }
            return (
              <motion.g
                key={`${r}-${q}`}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...spring, delay: r === rows ? q * 0.05 : 0 }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                onClick={() => select(r, q)}
                className="cursor-pointer"
              >
                <circle cx={px(r, q)} cy={py(r)} r={15} fill={isSel ? "var(--blob-soft)" : parent ? "color-mix(in oklab, var(--blob) 14%, var(--raised))" : "var(--raised)"} stroke={isSel || parent ? "var(--blob)" : "var(--line-2)"} strokeWidth={isSel ? 2.2 : 1.2} />
                <text x={px(r, q)} y={py(r) + 5} textAnchor="middle" fontSize={v >= 10 ? 13 : 14} fontWeight={isSel ? 700 : 500} className="font-math" fill={isSel ? "var(--blob-ink)" : "var(--ink)"}>
                  {v}
                </text>
              </motion.g>
            );
          }),
        )}
      </svg>

      <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[22px] text-ink">
          <Binom n={n} k={k} />
          <span className="blob-math">= {choose(n, k)}</span>
          <span className="text-[13px] text-ink-3">{t(tx(`“${n} choose ${k}”: row ${n}, place ${k} (both counted from 0)`, `„${n} über ${k}“: Zeile ${n}, Stelle ${k} (beide ab 0 gezählt)`))}</span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={`${n}-${k}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[14px] text-ink-2">
            {edge
              ? t(tx("Every row starts and ends with 1.", "Jede Zeile beginnt und endet mit 1."))
              : t(tx(`${choose(n - 1, k - 1)} + ${choose(n - 1, k)} = ${choose(n, k)}: every number is the sum of the two numbers above it.`, `${choose(n - 1, k - 1)} + ${choose(n - 1, k)} = ${choose(n, k)}: Jede Zahl ist die Summe der beiden Zahlen darüber.`))}
          </motion.p>
        </AnimatePresence>
        <div className="overflow-x-auto">
          <MathView src={expansionSrc(n, k)} size="md" scope={`${scope}-x`} />
        </div>
        <p className="text-[13px] text-ink-3">{t(tx(`Row ${n} gives the coefficients of (a + b)^${n}. The highlighted term belongs to the selected number.`, `Zeile ${n} liefert die Koeffizienten von (a + b)^${n}. Der markierte Term gehört zur gewählten Zahl.`))}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The binomial theorem and a calculator for binomial coefficients.

const fact = (n: number) => Array.from({ length: n }, (_, i) => n - i).join(" \\cdot ") || "1";

/** (a + b)ⁿ = Σ (n über k) aⁿ⁻ᵏ bᵏ, and (n über k) = n! : (k! · (n − k)!) worked out for any n and k. */
export function ExpandingBinomCard() {
  const t = useText();
  const [n, setN] = useState(4);
  const [k, setK] = useState(2);
  const kk = Math.min(k, n);
  const value = choose(n, kk);
  const termPow = `a^{${n - kk}} b^{${kk}}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 text-[21px] text-ink">
        <MathView src="(a + b)^n =" size="md" animate={false} />
        <Binom n="n" k="0" />
        <MathView src="a^n +" size="md" animate={false} />
        <Binom n="n" k="1" />
        <MathView src="a^{n-1} b +" size="md" animate={false} />
        <Binom n="n" k="2" />
        <MathView src="a^{n-2} b^2 + \\, ... \\, +" size="md" animate={false} />
        <Binom n="n" k="n" />
        <MathView src="b^n" size="md" animate={false} />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <StepRow label="n" value={n} min={1} max={10} onChange={(v) => setN(v)} />
        <StepRow label="k" value={kk} min={0} max={n} onChange={setK} />
      </div>

      <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[22px] text-ink">
          <Binom n={n} k={kk} />
          <MathView src={`= \\frac{${n}!}{${kk}! \\cdot ${n - kk}!} = \\frac{${fact(n)}}{(${fact(kk)}) \\cdot (${fact(n - kk)})} = ${value}`} size="sm" animate={false} />
        </div>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          {t(
            tx(
              `n! (“n factorial”) is 1 · 2 · … · n, and 0! = 1. So ${n} choose ${kk} is ${value}: the number in row ${n}, place ${kk} of Pascal's triangle. In (a + b)^${n} it stands in front of the term with a^${n - kk} b^${kk}.`,
              `n! („n Fakultät“) ist 1 · 2 · … · n, und 0! = 1. Also ist ${n} über ${kk} gleich ${value}: die Zahl in Zeile ${n}, Stelle ${kk} des Pascalschen Dreiecks. In (a + b)^${n} steht sie vor dem Term mit a^${n - kk} b^${kk}.`,
            ),
          )}
        </p>
        <MathView src={`${value === 1 ? "" : value}${termPow}`} size="md" animate={false} />
      </div>
    </div>
  );
}

function StepRow({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 font-math text-[18px] italic text-ink-2">{label} =</span>
      <InlineStep value={value} min={min} max={max} onChange={onChange} label={label} />
    </div>
  );
}
