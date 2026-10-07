"use client";

// Level 1 widget: square and cube numbers as real squares and cubes. Change the side length and the
// picture grows; the formula and the list of square (or cube) numbers follow.

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { cos, sin } from "@/lib/stableMath";
import { NumStepper, Segmented, spring } from "./ui";

type Mode = "square" | "cube";

const MAX: Record<Mode, number> = { square: 10, cube: 6 };
const W = 276;
const H = 250;
const SQ = 22; // side of one small square
const CU = 19; // edge of one small cube
const C30 = cos(Math.PI / 6);
const S30 = sin(Math.PI / 6);

const smooth = { type: "spring" as const, stiffness: 240, damping: 28 };

function SquarePicture({ n }: { n: number }) {
  // shifted right so a two-digit side label fits on the left
  const ox = (W - 10 * SQ) / 2 + 8;
  const bottom = H - 22;
  const cells = Array.from({ length: n * n }, (_, i) => ({ i: i % n, j: Math.floor(i / n) }));
  return (
    <>
      <AnimatePresence initial={false}>
        {cells.map(({ i, j }) => (
          <motion.rect
            key={`${i}-${j}`}
            x={ox + i * SQ + 1}
            y={bottom - (j + 1) * SQ + 1}
            width={SQ - 2}
            height={SQ - 2}
            rx={3.5}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.15 } }}
            transition={{ ...smooth, delay: (i + j) * 0.012 }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            fill={(i + j) % 2 === 0 ? "var(--blob)" : "color-mix(in oklab, var(--blob) 55%, transparent)"}
          />
        ))}
      </AnimatePresence>
      {/* side lengths */}
      <motion.text initial={false} animate={{ x: ox + (n * SQ) / 2 }} transition={smooth} y={bottom + 18} textAnchor="middle" fontSize={15} fill="var(--ink-2)" className="font-math">
        {n}
      </motion.text>
      <motion.text initial={false} animate={{ y: bottom - (n * SQ) / 2 + 5 }} transition={smooth} x={ox - 9} textAnchor="end" fontSize={15} fill="var(--ink-2)" className="font-math">
        {n}
      </motion.text>
    </>
  );
}

/** Isometric projection: x runs right-down, y left-down, z up. */
function iso(n: number) {
  const ox = W / 2;
  const oy = H - 16 - n * CU;
  return (x: number, y: number, z: number) => [ox + (x - y) * CU * C30, oy + (x + y) * CU * S30 - z * CU] as const;
}

function CubePicture({ n }: { n: number }) {
  const p = iso(n);
  const poly = (pts: (readonly [number, number])[]) => `M${pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join("L")}Z`;
  const top = poly([p(0, 0, n), p(n, 0, n), p(n, n, n), p(0, n, n)]);
  const right = poly([p(n, 0, 0), p(n, n, 0), p(n, n, n), p(n, 0, n)]);
  const left = poly([p(0, n, 0), p(n, n, 0), p(n, n, n), p(0, n, n)]);
  const lines: { key: string; a: readonly [number, number]; b: readonly [number, number] }[] = [];
  for (let i = 1; i < n; i++) {
    lines.push({ key: `tx${i}`, a: p(i, 0, n), b: p(i, n, n) });
    lines.push({ key: `ty${i}`, a: p(0, i, n), b: p(n, i, n) });
    lines.push({ key: `ry${i}`, a: p(n, i, 0), b: p(n, i, n) });
    lines.push({ key: `rz${i}`, a: p(n, 0, i), b: p(n, n, i) });
    lines.push({ key: `lx${i}`, a: p(i, n, 0), b: p(i, n, n) });
    lines.push({ key: `lz${i}`, a: p(0, n, i), b: p(n, n, i) });
  }
  const [ex, ey] = p(n, n / 2, 0);
  const [hx, hy] = p(n, 0, n / 2);
  const [dx, dy] = p(n / 2, n, 0);
  return (
    <>
      <motion.path initial={false} animate={{ d: top }} transition={smooth} fill="color-mix(in oklab, var(--blob) 38%, transparent)" stroke="var(--blob)" strokeWidth={1.4} strokeLinejoin="round" />
      <motion.path initial={false} animate={{ d: left }} transition={smooth} fill="var(--blob)" stroke="var(--blob)" strokeWidth={1.4} strokeLinejoin="round" />
      <motion.path initial={false} animate={{ d: right }} transition={smooth} fill="color-mix(in oklab, var(--blob) 70%, transparent)" stroke="var(--blob)" strokeWidth={1.4} strokeLinejoin="round" />
      <AnimatePresence initial={false}>
        {lines.map((l) => (
          <motion.line
            key={l.key}
            initial={{ opacity: 0, x1: l.a[0], y1: l.a[1], x2: l.b[0], y2: l.b[1] }}
            animate={{ opacity: 0.85, x1: l.a[0], y1: l.a[1], x2: l.b[0], y2: l.b[1] }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={smooth}
            stroke="var(--raised)"
            strokeWidth={1.2}
          />
        ))}
      </AnimatePresence>
      {/* edge lengths on the three visible edges at the bottom and front */}
      <motion.text initial={false} animate={{ x: ex + 10, y: ey + 16 }} transition={smooth} fontSize={15} fill="var(--ink-2)" className="font-math">
        {n}
      </motion.text>
      <motion.text initial={false} animate={{ x: dx - 10, y: dy + 16 }} transition={smooth} textAnchor="end" fontSize={15} fill="var(--ink-2)" className="font-math">
        {n}
      </motion.text>
      <motion.text initial={false} animate={{ x: hx + 9, y: hy + 5 }} transition={smooth} fontSize={15} fill="var(--ink-2)" className="font-math">
        {n}
      </motion.text>
    </>
  );
}

/** Square and cube numbers you can build: change the side length, the picture and the formula follow. */
export function SquareCubeBuilder() {
  const t = useText();
  const scope = useId();
  const [mode, setMode] = useState<Mode>("square");
  const [side, setSide] = useState(4);
  const n = Math.min(side, MAX[mode]);
  const e = mode === "square" ? 2 : 3;
  const value = n ** e;
  const factors = Array.from({ length: e }, (_, i) => (i === 0 ? `${n}#f${i}` : `\\cdot#d${i} ${n}#f${i}`)).join(" ");
  const formula = `${n}#b^{${e}#e} =#eq ${factors} =#eq2 \\blob{${value}#r}`;
  const list = Array.from({ length: MAX[mode] }, (_, i) => i + 1);

  const caption =
    mode === "square"
      ? tx(
          `A square with side $${n}$ is made of $${n} \\cdot ${n} = ${value}$ small squares. That's why $${n}^2$ is read „${n} squared“, and $${value}$ is a **square number**.`,
          `Ein Quadrat mit der Seitenlänge $${n}$ besteht aus $${n} \\cdot ${n} = ${value}$ kleinen Quadraten. Deshalb liest man $${n}^2$ als „${n} hoch 2“ oder „${n} Quadrat“, und $${value}$ ist eine **Quadratzahl**.`,
        )
      : tx(
          `A cube with edge $${n}$ is made of $${n} \\cdot ${n} \\cdot ${n} = ${value}$ small cubes: $${n * n}$ in each layer, $${n}$ layers. That's why $${n}^3$ is read „${n} cubed“, and $${value}$ is a **cube number**.`,
          `Ein Würfel mit der Kantenlänge $${n}$ besteht aus $${n} \\cdot ${n} \\cdot ${n} = ${value}$ kleinen Würfeln: $${n * n}$ in jeder Schicht, $${n}$ Schichten. Deshalb liest man $${n}^3$ als „${n} hoch 3“, und $${value}$ ist eine **Kubikzahl**.`,
        );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Segmented
          scope={scope}
          label={tx("Squares or cubes", "Quadrate oder Würfel")}
          value={mode}
          onChange={setMode}
          options={[
            { id: "square", label: t(tx("Square  n²", "Quadrat  n²")) },
            { id: "cube", label: t(tx("Cube  n³", "Würfel  n³")) },
          ]}
        />
        <NumStepper label="n =" name={tx("side length", "Seitenlänge")} value={n} min={1} max={MAX[mode]} onChange={setSide} />
      </div>

      <div className="grid items-center gap-5 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-xl border border-line bg-surface">
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-25" />
          <svg viewBox={`0 0 ${W} ${H}`} className="relative w-full" role="img" aria-label={t(mode === "square" ? tx(`A square of ${n} by ${n} small squares`, `Ein Quadrat aus ${n} mal ${n} kleinen Quadraten`) : tx(`A cube of ${n} by ${n} by ${n} small cubes`, `Ein Würfel aus ${n} mal ${n} mal ${n} kleinen Würfeln`))}>
            {mode === "square" ? <SquarePicture n={n} /> : <CubePicture n={n} />}
          </svg>
        </div>
        <div className="min-w-0 space-y-4">
          <MathView src={formula} size="lg" scope={`${scope}-f`} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={`${mode}${n}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[14px] leading-relaxed text-ink-2">
              <Inline text={t(caption)} />
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          {t(mode === "square" ? tx("Square numbers", "Quadratzahlen") : tx("Cube numbers", "Kubikzahlen"))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {list.map((k) => {
            const on = k === n;
            return (
              <button
                key={`${mode}${k}`}
                onClick={() => setSide(k)}
                className={cn("relative h-9 min-w-11 rounded-lg border px-2.5 font-math text-[16px] tabular-nums transition-colors", on ? "border-transparent text-white" : "border-line text-ink hover:bg-blob-soft")}
                aria-pressed={on}
                aria-label={`${k}${mode === "square" ? "²" : "³"} = ${k ** e}`}
              >
                {on && <motion.span layoutId={`${scope}-chip`} className="absolute inset-0 rounded-lg bg-blob" transition={spring} />}
                <span className="relative">{k ** e}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
