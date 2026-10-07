"use client";

// Level 3 widgets: pour a pyramid (or cone) into a prism (or cylinder) with the same base and
// height, and scale a cube by a factor k to see k, k² and k³.

import { AnimatePresence, motion } from "motion/react";
import { Check, Droplet, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cos, sin } from "@/lib/stableMath";
import { cn } from "@/lib/utils";
import { Segmented, TINT } from "./ui";

const K = 0.5 * cos(Math.PI / 4);
const E = 0.32;
const r2 = (v: number) => Math.round(v * 100) / 100;
type P = [number, number];
const path = (pts: P[], close = true) => `M${pts.map((p) => `${r2(p[0])},${r2(p[1])}`).join("L")}${close ? "Z" : ""}`;

// ---------------------------------------------------------------------------
// Why a third? Pouring experiment

const S = 28; // px per unit
const A = 4; // base edge / diameter
const H = 5; // height
const GAP = 70;

export function AreaVolumePourLab() {
  const t = useText();
  const scope = useId();
  const [kind, setKind] = useState<"pyr" | "cone">("pyr");
  const [pours, setPours] = useState(0);
  const [guess, setGuess] = useState<number | null>(null);

  const full = pours >= 3;
  const level = (Math.min(pours, 3) / 3) * H;
  const top = 26;
  const baseY = top + (H + K * A) * S; // screen y of the front bottom edge
  const leftX = 22;
  const rightX = leftX + (A + K * A) * S + GAP;
  const W = rightX + (A + K * A) * S + 44;
  const Hh = baseY + 40;

  // Cabinet projection for the square solids, origin at the front-left-bottom corner.
  const pj = (ox: number) => ([x, y, z]: [number, number, number]): P => [ox + (x + K * y) * S, baseY - (z + K * y) * S];

  // Pyramid / cone on the left
  const L = pj(leftX);
  const R = pj(rightX);
  const apex = L([A / 2, A / 2, H]);
  const pyrFront = [L([0, 0, 0]), L([A, 0, 0]), apex];
  const pyrRight = [L([A, 0, 0]), L([A, A, 0]), apex];
  const pyrHidden = [
    [L([0, 0, 0]), L([0, A, 0])],
    [L([0, A, 0]), L([A, A, 0])],
    [L([0, A, 0]), apex],
  ];
  const pyrVisible = [
    [L([0, 0, 0]), L([A, 0, 0])],
    [L([A, 0, 0]), L([A, A, 0])],
    [L([0, 0, 0]), apex],
    [L([A, 0, 0]), apex],
    [L([A, A, 0]), apex],
  ];

  // Round solids: centre of the base ellipse.
  const rr = (A / 2) * S;
  const ry = E * rr;
  const ell = (cx: number, cy: number, t0: number, t1: number, n = 24): P[] => Array.from({ length: n + 1 }, (_, i) => {
    const a = t0 + ((t1 - t0) * i) / n;
    return [cx + rr * cos(a), cy + ry * sin(a)] as P;
  });
  const lcx = leftX + rr + 6;
  const rcx = rightX + rr + 6;
  const by = baseY - 6;
  const coneApex: P = [lcx, by - H * S];
  const tR = Math.asin(Math.min(0.99, (ry * ry) / (H * S) / ry));
  // Screen coordinates: the front half of an ellipse is its lower half (0 < angle < π).
  const coneFront = ell(lcx, by, -tR, Math.PI + tR);

  // Water in the container (animated by level)
  const prismWater = {
    front: path([R([0, 0, 0]), R([A, 0, 0]), R([A, 0, level]), R([0, 0, level])]),
    right: path([R([A, 0, 0]), R([A, A, 0]), R([A, A, level]), R([A, 0, level])]),
    top: path([R([0, 0, level]), R([A, 0, level]), R([A, A, level]), R([0, A, level])]),
  };
  const ly = by - level * S;
  const cylWater = {
    body: path([...ell(rcx, by, 0, Math.PI), ...ell(rcx, ly, Math.PI, 0)]),
    top: path(ell(rcx, ly, 0, 2 * Math.PI, 48)),
  };
  const spring = { type: "spring" as const, stiffness: 90, damping: 18 };


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          options={[
            { id: "pyr", label: tx("Pyramid and prism", "Pyramide und Prisma") },
            { id: "cone", label: tx("Cone and cylinder", "Kegel und Zylinder") },
          ]}
          value={kind}
          onChange={(k) => {
            setKind(k);
            setPours(0);
          }}
        />
      </div>

      {guess === null && pours === 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3">
          <span className="text-[14px] text-ink-2">{t(tx("Guess first: how many fillings of the pointed solid fill the container?", "Rate zuerst: Wie viele Füllungen des spitzen Körpers passen in den Behälter?"))}</span>
          {[2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => setGuess(n)} className="rounded-lg border border-line px-3 py-1 text-[14px] font-semibold hover:bg-hover">
              {n}
            </button>
          ))}
        </div>
      ) : null}

      <svg viewBox={`0 0 ${W} ${Hh}`} className="mx-auto w-full max-w-[460px]" role="img" aria-label={t(tx(`${pours} of 3 fillings poured`, `${pours} von 3 Füllungen umgeschüttet`))}>
        {kind === "pyr" ? (
          <>
            <motion.g key={`p${pours}`} initial={{ opacity: pours ? 0.15 : 1 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }}>
              <path d={path(pyrFront)} fill="color-mix(in oklab, var(--blob) 42%, var(--surface))" />
              <path d={path(pyrRight)} fill="color-mix(in oklab, var(--blob) 30%, var(--surface))" />
            </motion.g>
            {pyrHidden.map((e, i) => (
              <path key={`h${i}`} d={path(e, false)} stroke="var(--ink-3)" strokeDasharray="5 4" strokeWidth={1.3} fill="none" />
            ))}
            {pyrVisible.map((e, i) => (
              <path key={`v${i}`} d={path(e, false)} stroke="var(--ink)" strokeWidth={1.8} fill="none" strokeLinejoin="round" />
            ))}
            {/* prism (container) */}
            <motion.path initial={false} animate={{ d: prismWater.front }} transition={spring} fill="color-mix(in oklab, var(--blob) 42%, var(--surface))" />
            <motion.path initial={false} animate={{ d: prismWater.right }} transition={spring} fill="color-mix(in oklab, var(--blob) 30%, var(--surface))" />
            <motion.path initial={false} animate={{ d: prismWater.top }} transition={spring} fill="color-mix(in oklab, var(--blob) 55%, var(--surface))" opacity={level > 0 ? 1 : 0} />
            {[
              [R([0, A, 0]), R([A, A, 0])],
              [R([0, 0, 0]), R([0, A, 0])],
              [R([0, A, 0]), R([0, A, H])],
            ].map((e, i) => (
              <path key={`ph${i}`} d={path(e as P[], false)} stroke="var(--ink-3)" strokeDasharray="5 4" strokeWidth={1.3} fill="none" />
            ))}
            {[
              [R([0, 0, 0]), R([A, 0, 0]), R([A, 0, H]), R([0, 0, H])],
              [R([A, 0, 0]), R([A, A, 0]), R([A, A, H]), R([A, 0, H])],
              [R([0, 0, H]), R([A, 0, H]), R([A, A, H]), R([0, A, H])],
            ].map((f, i) => (
              <path key={`pv${i}`} d={path(f as P[])} stroke="var(--ink)" strokeWidth={1.8} fill="none" strokeLinejoin="round" />
            ))}
          </>
        ) : (
          <>
            <motion.g key={`c${pours}`} initial={{ opacity: pours ? 0.15 : 1 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }}>
              <path d={path([coneApex, ...coneFront])} fill="color-mix(in oklab, var(--blob) 38%, var(--surface))" />
            </motion.g>
            <path d={path(ell(lcx, by, Math.PI + tR, 2 * Math.PI - tR), false)} stroke="var(--ink-3)" strokeDasharray="5 4" strokeWidth={1.3} fill="none" />
            <path d={path(coneFront, false)} stroke="var(--ink)" strokeWidth={1.8} fill="none" />
            <path d={path([coneFront[0], coneApex, coneFront[coneFront.length - 1]], false)} stroke="var(--ink)" strokeWidth={1.8} fill="none" strokeLinejoin="round" />
            {/* cylinder (container) */}
            <motion.path initial={false} animate={{ d: cylWater.body }} transition={spring} fill="color-mix(in oklab, var(--blob) 38%, var(--surface))" />
            <motion.path initial={false} animate={{ d: cylWater.top }} transition={spring} fill="color-mix(in oklab, var(--blob) 55%, var(--surface))" opacity={level > 0 ? 1 : 0} />
            <path d={path(ell(rcx, by, Math.PI, 2 * Math.PI), false)} stroke="var(--ink-3)" strokeDasharray="5 4" strokeWidth={1.3} fill="none" />
            <path d={path(ell(rcx, by, 0, Math.PI), false)} stroke="var(--ink)" strokeWidth={1.8} fill="none" />
            <path d={path(ell(rcx, by - H * S, 0, 2 * Math.PI, 48))} stroke="var(--ink)" strokeWidth={1.8} fill="none" />
            <path d={path([[rcx - rr, by], [rcx - rr, by - H * S]], false)} stroke="var(--ink)" strokeWidth={1.8} />
            <path d={path([[rcx + rr, by], [rcx + rr, by - H * S]], false)} stroke="var(--ink)" strokeWidth={1.8} />
          </>
        )}
        {/* the pour arrow */}
        <path d={`M${rightX - GAP + 8},${top + 40} Q${rightX - GAP / 2},${top + 10} ${rightX - 8},${top + 40}`} fill="none" stroke="var(--blob)" strokeWidth={2} markerEnd={`url(#${scope}-arr)`} />
        <defs>
          <marker id={`${scope}-arr`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--blob)" />
          </marker>
        </defs>
        {/* thirds on the container */}
        {[1, 2].map((k) => {
          const p = kind === "pyr" ? R([A, 0, (k * H) / 3]) : ([rcx + rr, by - ((k * H) / 3) * S] as P);
          return (
            <g key={k}>
              <line x1={p[0] + 4} x2={p[0] + 12} y1={p[1]} y2={p[1]} stroke="var(--ink-3)" strokeWidth={1.2} />
              <text x={p[0] + 15} y={p[1] + 4} fontSize={11.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                {k}/3
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPours((p) => Math.min(3, p + 1))}
          disabled={full}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blob px-3 py-1.5 text-[13px] font-medium text-white hover:bg-blob/90 disabled:opacity-40"
        >
          <Droplet className="size-3.5" />
          {t(kind === "pyr" ? tx("Fill the pyramid and pour it in", "Pyramide füllen und umschütten") : tx("Fill the cone and pour it in", "Kegel füllen und umschütten"))}
        </button>
        <button
          type="button"
          onClick={() => {
            setPours(0);
            setGuess(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] text-ink-2 hover:bg-hover"
        >
          <RotateCcw className="size-3.5" />
          {t(tx("Empty", "Ausleeren"))}
        </button>
        <span className="ml-1 text-[14px] font-semibold tabular-nums text-ink">{t(tx(`${pours} × poured`, `${pours} × umgeschüttet`))}</span>
      </div>

      <div className={cn("space-y-2 rounded-xl border px-4 py-3 transition-colors", full ? "border-ok/50 bg-ok/5" : "border-line bg-surface")}>
        <AnimatePresence mode="wait" initial={false}>
          {full ? (
            <motion.div key="full" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ok">
                <Check className="size-4" />
                {guess === null
                  ? t(tx("Full after exactly 3 fillings!", "Nach genau 3 Füllungen voll!"))
                  : guess === 3
                    ? t(tx("Full after exactly 3 fillings. You guessed right!", "Nach genau 3 Füllungen voll. Richtig geraten!"))
                    : t(tx(`Full after exactly 3 fillings (you guessed ${guess}).`, `Nach genau 3 Füllungen voll (du hast ${guess} getippt).`))}
              </p>
              <div className="overflow-x-auto">
                <MathView
                  src={
                    kind === "pyr"
                      ? tx('V_{"pyramid"}#V =#e \\frac{1}{3}#f \\cdot#m G#G \\cdot#m2 h#h', 'V_{"Pyramide"}#V =#e \\frac{1}{3}#f \\cdot#m G#G \\cdot#m2 h#h')
                      : tx('V_{"cone"}#V =#e \\frac{1}{3}#f \\cdot#m \\pi#G r#r^{2#sq} \\cdot#m2 h#h', 'V_{"Kegel"}#V =#e \\frac{1}{3}#f \\cdot#m \\pi#G r#r^{2#sq} \\cdot#m2 h#h')
                  }
                  size="md"
                  scope={`${scope}-f`}
                />
              </div>
            </motion.div>
          ) : (
            <motion.p key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[14px] leading-relaxed text-ink-2">
              <Inline
                text={
                  kind === "pyr"
                    ? tx("Both solids have the **same base** $G$ (a square) and the **same height** $h$. Pour the full pyramid into the prism.", "Beide Körper haben die **gleiche Grundfläche** $G$ (ein Quadrat) und die **gleiche Höhe** $h$. Schütte die volle Pyramide in das Prisma.")
                    : tx("Both solids have the **same base** (a circle) and the **same height** $h$. Pour the full cone into the cylinder.", "Beide Körper haben die **gleiche Grundfläche** (einen Kreis) und die **gleiche Höhe** $h$. Schütte den vollen Kegel in den Zylinder.")
                }
              />
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scaling: k, k², k³

const U = 22;

function cubeOf(k: number, ox: number, oy: number) {
  const out: { key: string; faces: string[] }[] = [];
  const pj = (x: number, y: number, z: number): P => [ox + (x + K * y) * U, oy - (z + K * y) * U];
  for (let y = k - 1; y >= 0; y--)
    for (let z = 0; z < k; z++)
      for (let x = 0; x < k; x++)
        out.push({
          key: `${x}-${y}-${z}`,
          faces: [
            path([pj(x, y, z), pj(x + 1, y, z), pj(x + 1, y, z + 1), pj(x, y, z + 1)]),
            path([pj(x, y, z + 1), pj(x + 1, y, z + 1), pj(x + 1, y + 1, z + 1), pj(x, y + 1, z + 1)]),
            path([pj(x + 1, y, z), pj(x + 1, y + 1, z), pj(x + 1, y + 1, z + 1), pj(x + 1, y, z + 1)]),
          ],
        });
  return out;
}

const ROWS: { id: "len" | "area" | "vol"; label: Text; pow: number }[] = [
  { id: "len", label: tx("Every length", "Jede Länge"), pow: 1 },
  { id: "area", label: tx("Every area", "Jede Fläche"), pow: 2 },
  { id: "vol", label: tx("The volume", "Das Volumen"), pow: 3 },
];

export function AreaVolumeScaleLab() {
  const t = useText();
  const scope = useId();
  const [k, setK] = useState(2);
  const MAXK = 4;
  const W = 40 + (1 + K) * U + 40 + (MAXK + K * MAXK) * U + 16;
  const Hh = (MAXK + K * MAXK) * U + 40;
  const oy = Hh - 24;
  const small = cubeOf(1, 30, oy);
  const big = cubeOf(k, 40 + (1 + K) * U + 40, oy);
  const fills = [TINT.soft, TINT.mid, TINT.side];
  const sup = (p: number) => (p === 1 ? "" : p === 2 ? "²" : "³");
  return (
    <div className="space-y-4">
      <label className="flex flex-wrap items-center gap-3 text-[14px] text-ink-2">
        <span>{t(tx("Scale factor", "Streckfaktor"))}</span>
        <input type="range" min={1} max={MAXK} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} aria-valuetext={`k = ${k}`} className="w-44 accent-blob" />
        <motion.span key={k} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-math text-[20px] italic text-ink">
          k = {k}
        </motion.span>
      </label>

      <div className="grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <svg viewBox={`0 0 ${W} ${Hh}`} className="mx-auto w-full max-w-[340px]" role="img" aria-label={t(tx(`A unit cube and a cube made of ${k ** 3} unit cubes`, `Ein Einheitswürfel und ein Würfel aus ${k ** 3} Einheitswürfeln`))}>
          {small.map((c) => (
            <g key={c.key}>
              {c.faces.map((d, i) => (
                <path key={i} d={d} fill={fills[i]} stroke="var(--ink)" strokeWidth={1.2} strokeLinejoin="round" />
              ))}
            </g>
          ))}
          <text x={30 + U / 2} y={oy + 16} textAnchor="middle" fontSize={12.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
            1
          </text>
          <AnimatePresence initial={false}>
            {big.map((c) => (
              <motion.g key={c.key} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ type: "spring", stiffness: 300, damping: 26 }}>
                {c.faces.map((d, i) => (
                  <path key={i} d={d} fill={fills[i]} stroke="var(--ink-2)" strokeWidth={0.8} strokeLinejoin="round" />
                ))}
              </motion.g>
            ))}
          </AnimatePresence>
          <text x={40 + (1 + K) * U + 40 + (k * U) / 2} y={oy + 16} textAnchor="middle" fontSize={12.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
            {k}
          </text>
        </svg>

        <div className="space-y-2.5">
          {ROWS.map((row) => {
            const v = k ** row.pow;
            return (
              <div key={row.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
                  <span className="text-ink-2">{t(row.label)}</span>
                  <span className="font-semibold tabular-nums text-ink">
                    · k{sup(row.pow)} = · {v}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-hover">
                  <motion.div className="h-full rounded-full bg-blob" initial={false} animate={{ width: `${Math.max(2, (v / MAXK ** row.pow) * 100)}%` }} transition={{ type: "spring", stiffness: 200, damping: 26 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-line bg-surface px-4 py-3">
        <div className="overflow-x-auto">
          <MathView src={`a'#a =#e ${k}#k1 \\cdot#m1 a#a2 \\quad A'#A =#e2 ${k}#k2^{2#s2} \\cdot#m2 A#A2 =#e3 ${k * k}#v2 A#A3 \\quad V'#V =#e4 ${k}#k3^{3#s3} \\cdot#m3 V#V2 =#e5 ${k ** 3}#v3 V#V3`} size="md" scope={`${scope}-s`} />
        </div>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          {t(
            tx(
              `One face of the big cube is made of ${k * k} small squares, the whole cube of ${k ** 3} small cubes. This holds for every solid: lengths × k, areas × k², volumes × k³.`,
              `Eine Seitenfläche des großen Würfels besteht aus ${k * k} kleinen Quadraten, der ganze Würfel aus ${k ** 3} kleinen Würfeln. Das gilt für jeden Körper: Längen · k, Flächen · k², Volumen · k³.`,
            ),
          )}
        </p>
      </div>
    </div>
  );
}
