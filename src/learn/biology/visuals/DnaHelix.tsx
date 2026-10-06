"use client";

import { animate, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { RotateCcw, Rows3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { BASE_NAME, PAIR } from "@/learn/biology/topics/dna/data";
import { cn } from "@/lib/utils";
import { BASE_COLOR, StepButton } from "./DnaKit";
import { cos, sin } from "@/lib/stableMath";

// ---------------------------------------------------------------------------
// The twisting double helix (lesson widget, level 1)

const TOP = "ATGCCGATTAGC";
const W = 560;
const H = 270;
const CY = 135;
const R = 80;
const X0 = 46;
const DX = 42;
const N = TOP.length;
const MID = (N - 1) / 2;
/** Angle of base pair s (in base pairs from the left) at twist u: 10 base pairs per full turn. */
const angle = (s: number, u: number) => u * (s - MID) * ((2 * Math.PI) / 10);
const r2 = (v: number) => Math.round(v * 100) / 100;

type Seg = { d: string; front: boolean };

/** One backbone as path pieces, split where it passes behind the other strand. */
function backbone(side: 1 | -1, u: number): Seg[] {
  const segs: Seg[] = [];
  let pts: string[] = [];
  let front: boolean | null = null;
  for (let s = -0.6; s <= N - 1 + 0.6 + 1e-9; s += 0.05) {
    const th = angle(s, u);
    const x = X0 + s * DX;
    const y = CY - side * R * cos(th);
    const f = side * sin(th) >= -1e-6;
    if (front !== null && f !== front) {
      pts.push(`${r2(x)},${r2(y)}`);
      segs.push({ d: `M${pts.join(" L")}`, front });
      pts = [];
    }
    front = f;
    pts.push(`${r2(x)},${r2(y)}`);
  }
  if (pts.length > 1) segs.push({ d: `M${pts.join(" L")}`, front: front ?? true });
  return segs;
}

/** Interactive double helix: twist it into a helix or untwist it into a ladder, tap a rung to name the pair. */
export function DnaHelix() {
  const t = useText();
  const reduce = useReducedMotion();
  const [u, setU] = useState(1);
  const [picked, setPicked] = useState<number | null>(null);
  const anim = useRef<AnimationPlaybackControls | null>(null);

  useEffect(() => () => anim.current?.stop(), []);

  const go = (to: number) => {
    anim.current?.stop();
    if (reduce) {
      setU(to);
      return;
    }
    anim.current = animate(u, to, { duration: 1.4 * Math.abs(to - u) + 0.2, ease: [0.45, 0, 0.25, 1], onUpdate: setU });
  };

  const letters = Math.max(0, Math.min(1, (0.4 - u) / 0.4));
  const rails = Math.max(0, Math.min(1, (0.3 - u) / 0.3));
  const strands = [backbone(1, u), backbone(-1, u)];
  const pickedPair = picked !== null ? { top: TOP[picked], bottom: PAIR[TOP[picked]] } : null;

  return (
    <div className="space-y-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[600px]" role="img" aria-label={t(tx("DNA double helix", "DNA-Doppelhelix"))}>
        {/* backbone parts behind */}
        {strands.flatMap((segs, si) =>
          segs.filter((s) => !s.front).map((s, i) => <path key={`b${si}-${i}`} d={s.d} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={10} strokeLinecap="round" opacity={0.35} />),
        )}
        {/* base pairs (rungs) */}
        {[...TOP].map((b, i) => {
          const th = angle(i, u);
          const x = X0 + i * DX;
          const y1 = CY - R * cos(th);
          const y2 = CY + R * cos(th);
          const half = (from: number, to: number, base: string, key: string) => {
            const top = Math.min(from, to);
            const h = Math.abs(to - from);
            const w = 14 + 8 * (1 - u);
            return h > 0.5 ? <rect key={key} x={r2(x - w / 2)} y={r2(top)} width={r2(w)} height={r2(h)} rx={4} fill={BASE_COLOR[base]} stroke="var(--bio-outline)" strokeWidth={1.2} /> : null;
          };
          const gap = 2 * Math.sign(y2 - y1 || 1);
          const on = picked === i;
          return (
            <g
              key={i}
              role="button"
              tabIndex={0}
              aria-label={t(tx(`Base pair ${i + 1}`, `Basenpaar ${i + 1}`))}
              onClick={() => setPicked(on ? null : i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPicked(on ? null : i);
                }
              }}
              className="cursor-pointer outline-none"
              style={{ filter: on ? "drop-shadow(0 0 4px var(--blob))" : undefined }}
            >
              <rect x={x - 14} y={Math.min(y1, y2) - 6} width={28} height={Math.abs(y2 - y1) + 12} fill="transparent" />
              {half(y1, CY - gap, b, "t")}
              {half(CY + gap, y2, PAIR[b], "b")}
              {letters > 0.02 && (
                <g opacity={letters} style={{ pointerEvents: "none" }}>
                  <text x={x} y={(y1 + CY) / 2} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
                    {b}
                  </text>
                  <text x={x} y={(y2 + CY) / 2} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
                    {PAIR[b]}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {/* backbone parts in front */}
        {strands.flatMap((segs, si) =>
          segs.filter((s) => s.front).map((s, i) => <path key={`f${si}-${i}`} d={s.d} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={10} strokeLinecap="round" />),
        )}
        {/* sugars and phosphates on the rails of the ladder */}
        {rails > 0.02 && (
          <g opacity={rails} style={{ pointerEvents: "none" }}>
            {[-1, 1].map((side) =>
              [...TOP].map((_, i) => {
                const x = X0 + i * DX;
                const y = CY + side * R;
                const p = 7;
                return (
                  <g key={`${side}-${i}`}>
                    <polygon
                      points={[0, 1, 2, 3, 4].map((k) => `${r2(x + p * sin((k * 2 * Math.PI) / 5))},${r2(y - p * cos((k * 2 * Math.PI) / 5))}`).join(" ")}
                      fill="var(--bio-sun)"
                      stroke="var(--bio-outline)"
                      strokeWidth={1.2}
                    />
                    {i < N - 1 && <circle cx={x + DX / 2} cy={y} r={5} fill="var(--bio-membrane)" stroke="var(--bio-outline)" strokeWidth={1.2} />}
                  </g>
                );
              }),
            )}
          </g>
        )}
      </svg>

      <div className="flex flex-wrap items-center gap-3">
        <StepButton primary onClick={() => go(u > 0.5 ? 0 : 1)} label={t(u > 0.5 ? tx("Untwist", "Aufdrehen") : tx("Twist", "Verdrehen"))}>
          {u > 0.5 ? <Rows3 className="size-4" /> : <RotateCcw className="size-4" />}
          {t(u > 0.5 ? tx("Untwist into a ladder", "Zur Leiter aufdrehen") : tx("Twist into a helix", "Zur Helix verdrehen"))}
        </StepButton>
        <label className="flex min-w-[180px] flex-1 items-center gap-3 text-[13px] text-ink-3">
          <span className="shrink-0">{t(tx("ladder", "Leiter"))}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(u * 100)}
            onChange={(e) => {
              anim.current?.stop();
              setU(Number(e.target.value) / 100);
            }}
            aria-label={t(tx("Twist", "Verdrehung"))}
            className="h-2 min-w-0 flex-1 cursor-pointer accent-blob"
          />
          <span className="shrink-0">{t(tx("helix", "Helix"))}</span>
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className={cn("min-h-[3rem] rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-snug")} aria-live="polite">
          {pickedPair ? (
            <span className="text-ink">
              <span className="font-semibold">{t(tx(`Base pair ${picked! + 1}:`, `Basenpaar ${picked! + 1}:`))}</span> {t(BASE_NAME[pickedPair.top])} ({pickedPair.top}) {t(tx("and", "und"))} {t(BASE_NAME[pickedPair.bottom])} ({pickedPair.bottom}).{" "}
              <span className="text-ink-2">
                {t(
                  pickedPair.top === "A" || pickedPair.top === "T"
                    ? tx("A always pairs with T.", "A paart immer mit T.")
                    : tx("G always pairs with C.", "G paart immer mit C."),
                )}
              </span>
            </span>
          ) : (
            <span className="text-ink-3">{t(tx("Tap a rung of the ladder to see its base pair.", "Tipp auf eine Sprosse, um ihr Basenpaar zu sehen."))}</span>
          )}
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-2">
          {(["A", "T", "G", "C"] as const).map((b) => (
            <li key={b} className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={{ background: BASE_COLOR[b] }} /> {t(BASE_NAME[b])}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full" style={{ background: "var(--bio-nucleus-deep)" }} /> {t(tx("sugar-phosphate backbone", "Zucker-Phosphat-Rückgrat"))}
          </li>
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A short ladder piece with labelled parts (task picture, level 1)

const LADDER = "ATGCT";
const LX = [80, 160, 240, 320, 400];

const LADDER_PARTS: FigurePart[] = [
  { id: "rail", label: tx("rail: sugar-phosphate backbone", "Holm: Zucker-Phosphat-Rückgrat"), at: [140, 50], tag: [140, 16], info: tx("The two rails are made of sugar and phosphate, always taking turns.", "Die beiden Holme bestehen abwechselnd aus Zucker und Phosphat.") },
  { id: "sugar", label: tx("sugar (deoxyribose)", "Zucker (Desoxyribose)"), at: [80, 170], tag: [40, 204], info: tx("A bit of the rail: each base hangs on a sugar.", "Ein Stück vom Holm: An jedem Zucker hängt eine Base.") },
  { id: "phosphate", label: tx("phosphate", "Phosphat"), at: [280, 170], tag: [280, 206], info: tx("Links one sugar to the next.", "Verbindet einen Zucker mit dem nächsten.") },
  { id: "base", label: tx("base (here cytosine)", "Base (hier Cytosin)"), at: [246, 153], tag: [200, 153], info: tx("One of the four bases A, T, G and C.", "Eine der vier Basen A, T, G und C.") },
  { id: "pair", label: tx("base pair (rung)", "Basenpaar (Sprosse)"), at: [320, 110], tag: [362, 110], info: tx("Two bases that fit together: A–T or G–C.", "Zwei Basen, die zusammenpassen: A–T oder G–C.") },
];

/** Five rungs of the DNA ladder: rails of sugar and phosphate, rungs of base pairs. */
export function DnaLadderFigure({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  const pent = (x: number, y: number, p = 9) =>
    [0, 1, 2, 3, 4].map((k) => `${r2(x + p * sin((k * 2 * Math.PI) / 5))},${r2(y - p * cos((k * 2 * Math.PI) / 5))}`).join(" ");
  const half = (x: number, y: number, h: number, b: string) => (
    <g>
      <rect x={x - 14} y={y} width={28} height={h} rx={5} fill={BASE_COLOR[b]} stroke="var(--bio-outline)" strokeWidth={1.5} />
      <text x={x} y={y + h / 2} textAnchor="middle" dominantBaseline="central" fontSize={16} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
        {b}
      </text>
    </g>
  );
  return (
    <Figure title={tx("A piece of the DNA ladder", "Ein Stück der DNA-Strickleiter")} width={480} height={220} parts={LADDER_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g data-part="rail">
        <line x1={30} y1={50} x2={450} y2={50} stroke="var(--bio-nucleus-deep)" strokeWidth={6} strokeLinecap="round" />
        <line x1={30} y1={170} x2={450} y2={170} stroke="var(--bio-nucleus-deep)" strokeWidth={6} strokeLinecap="round" />
      </g>
      {LX.map((x, i) => {
        const b = LADDER[i];
        const pairPart = i === 3 ? "pair" : undefined;
        return (
          <g key={x} data-part={pairPart}>
            {half(x, 59, 48, b)}
            {i === 2 ? (
              <g data-part="base">{half(x, 113, 48, PAIR[b])}</g>
            ) : (
              half(x, 113, 48, PAIR[b])
            )}
          </g>
        );
      })}
      <g data-part="phosphate">
        {[40, 120, 200, 280, 360, 440].flatMap((x) => [50, 170].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={8} fill="var(--bio-membrane)" stroke="var(--bio-outline)" strokeWidth={1.5} />))}
      </g>
      <g data-part="sugar">
        {LX.flatMap((x) => [50, 170].map((y) => <polygon key={`${x}-${y}`} points={pent(x, y)} fill="var(--bio-sun)" stroke="var(--bio-outline)" strokeWidth={1.5} />))}
      </g>
    </Figure>
  );
}
