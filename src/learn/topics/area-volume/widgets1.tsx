"use client";

// Level 1 widgets: a rectangle on squared paper, the place-value table for area and volume
// units, and a cuboid built from unit cubes next to its net.

import { AnimatePresence, motion } from "motion/react";
import { Check, Hash, RotateCcw, Shuffle } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { Segmented, Stepper, TINT, useNum } from "./ui";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const spring = { type: "spring" as const, stiffness: 320, damping: 30 };

// ---------------------------------------------------------------------------
// Rectangle builder

const CELL = 30;
const COLS = 10;
const ROWS = 6;
const PADL = 44;
const PADT = 10;

type Challenge = { text: Text; ok: (a: number, b: number) => boolean; near?: (a: number, b: number) => Text | null };

const CHALLENGES: Challenge[] = [
  { text: tx("Build a rectangle with $A = 12 \"cm²\"$.", "Baue ein Rechteck mit $A = 12 \"cm²\"$."), ok: (a, b) => a * b === 12 },
  { text: tx("Build a rectangle with $u = 14 \"cm\"$.", "Baue ein Rechteck mit $u = 14 \"cm\"$."), ok: (a, b) => 2 * (a + b) === 14 },
  { text: tx("Build a square with $A = 16 \"cm²\"$.", "Baue ein Quadrat mit $A = 16 \"cm²\"$."), ok: (a, b) => a === 4 && b === 4 },
  {
    text: tx("Build a rectangle with $A = 12 \"cm²\"$ **and** $u = 16 \"cm\"$.", "Baue ein Rechteck mit $A = 12 \"cm²\"$ **und** $u = 16 \"cm\"$."),
    ok: (a, b) => a * b === 12 && 2 * (a + b) === 16,
    near: (a, b) => (a * b === 12 ? tx("The area is right, but the perimeter isn't 16 cm yet.", "Die Fläche stimmt, aber der Umfang ist noch nicht 16 cm.") : null),
  },
  {
    text: tx("With $u = 20 \"cm\"$: build the rectangle with the **largest** area.", "Mit $u = 20 \"cm\"$: Baue das Rechteck mit dem **größten** Flächeninhalt."),
    ok: (a, b) => a === 5 && b === 5,
    near: (a, b) => (2 * (a + b) === 20 ? tx("$u = 20$ cm, good! Can you fit even more squares inside?", "$u = 20$ cm, gut! Passen noch mehr Kästchen hinein?") : null),
  },
];

export function AreaVolumeRectangleBuilder() {
  const t = useText();
  const scope = useId();
  const [a, setA] = useState(5);
  const [b, setB] = useState(3);
  const [numbers, setNumbers] = useState(false);
  const [task, setTask] = useState(0);
  const [drag, setDrag] = useState(false);
  const svg = useRef<SVGSVGElement>(null);

  const W = PADL + COLS * CELL + 12;
  const H = PADT + ROWS * CELL + 30;

  function moveTo(e: PointerEvent) {
    const el = svg.current;
    const ctm = el?.getScreenCTM();
    if (!el || !ctm) return;
    const pt = el.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    setA(clamp(Math.round((p.x - PADL) / CELL), 1, COLS));
    setB(clamp(Math.round((p.y - PADT) / CELL), 1, ROWS));
  }

  function onKey(e: KeyboardEvent) {
    const moves: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setA((v) => clamp(v + m[0], 1, COLS));
    setB((v) => clamp(v + m[1], 1, ROWS));
  }

  const c = CHALLENGES[task];
  const solved = c.ok(a, b);
  const near = !solved && c.near ? c.near(a, b) : null;
  const cells = Array.from({ length: a * b }, (_, i) => ({ x: i % a, y: Math.floor(i / a), n: i + 1 }));

  return (
    <div className="space-y-4">
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,370px)_minmax(0,1fr)]">
        <div className="space-y-2">
          <svg
            ref={svg}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full max-w-[370px] touch-none select-none"
            role="img"
            aria-label={t(tx(`Rectangle ${a} cm by ${b} cm on squared paper`, `Rechteck ${a} cm mal ${b} cm auf Kästchenpapier`))}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              setDrag(true);
              moveTo(e);
            }}
            onPointerMove={(e) => drag && moveTo(e)}
            onPointerUp={() => setDrag(false)}
            onPointerCancel={() => setDrag(false)}
          >
            <motion.rect
              x={PADL}
              y={PADT}
              initial={false}
              animate={{ width: a * CELL, height: b * CELL }}
              transition={spring}
              fill={TINT.soft}
            />
            <g stroke="var(--ink-3)" strokeOpacity={0.45} strokeWidth={0.8}>
              {Array.from({ length: COLS + 1 }, (_, i) => (
                <line key={`v${i}`} x1={PADL + i * CELL} x2={PADL + i * CELL} y1={PADT} y2={PADT + ROWS * CELL} />
              ))}
              {Array.from({ length: ROWS + 1 }, (_, i) => (
                <line key={`h${i}`} x1={PADL} x2={PADL + COLS * CELL} y1={PADT + i * CELL} y2={PADT + i * CELL} />
              ))}
            </g>
            {numbers &&
              cells.map((q) => (
                <motion.text
                  key={`${q.x}-${q.y}`}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(q.n * 0.025, 0.9) }}
                  x={PADL + q.x * CELL + CELL / 2}
                  y={PADT + q.y * CELL + CELL / 2 + 4.5}
                  textAnchor="middle"
                  fontSize={12.5}
                  fill="var(--ink-2)"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {q.n}
                </motion.text>
              ))}
            <motion.rect
              x={PADL}
              y={PADT}
              initial={false}
              animate={{ width: a * CELL, height: b * CELL }}
              transition={spring}
              fill="none"
              stroke="var(--blob)"
              strokeWidth={3}
              rx={1}
            />
            <motion.text initial={false} animate={{ x: PADL + (a * CELL) / 2, y: PADT + b * CELL + 20 }} transition={spring} textAnchor="middle" fontSize={14} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
              {`${a} cm`}
            </motion.text>
            <motion.text initial={false} animate={{ y: PADT + (b * CELL) / 2 + 5 }} transition={spring} x={PADL - 8} textAnchor="end" fontSize={14} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
              {`${b} cm`}
            </motion.text>
            <motion.g initial={false} animate={{ x: PADL + a * CELL, y: PADT + b * CELL }} transition={spring}>
              <circle r={18} fill="var(--blob)" opacity={drag ? 0.2 : 0.1} />
              <circle
                r={8}
                fill="var(--blob)"
                stroke="var(--surface)"
                strokeWidth={2}
                tabIndex={0}
                role="slider"
                aria-label={t(tx("Corner of the rectangle (arrow keys)", "Ecke des Rechtecks (Pfeiltasten)"))}
                aria-valuetext={t(tx(`${a} cm by ${b} cm`, `${a} cm mal ${b} cm`))}
                onKeyDown={onKey}
                style={{ cursor: drag ? "grabbing" : "grab", outline: "none" }}
                className="focus-visible:stroke-ink"
              />
            </motion.g>
          </svg>
          <p className="text-[12.5px] text-ink-3">{t(tx("Drag the purple corner. 1 square = 1 cm².", "Zieh die lila Ecke. 1 Kästchen = 1 cm²."))}</p>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Stepper label="a" name={tx("length", "Länge")} value={a} min={1} max={COLS} unit="cm" onChange={setA} />
            <Stepper label="b" name={tx("width", "Breite")} value={b} min={1} max={ROWS} unit="cm" onChange={setB} />
          </div>
          <div className="space-y-2 rounded-xl border border-line bg-surface px-4 py-3">
            <div className="overflow-x-auto">
              <MathView src={`A#A =#e a#la \\cdot#m b#lb =#e2 ${a}#a \\cdot#m2 ${b}#b =#e3 ${a * b}#r "cm²"#u`} size="md" scope={`${scope}-A`} />
            </div>
            <div className="overflow-x-auto">
              <MathView src={`u#u =#e 2#k1 a#la +#p 2#k2 b#lb =#e2 ${2 * a}#a +#p2 ${2 * b}#b =#e3 ${2 * (a + b)}#r "cm"#un`} size="md" scope={`${scope}-u`} />
            </div>
            <p className="text-[13px] leading-relaxed text-ink-2">
              {t(
                tx(
                  `Area: ${b} rows of ${a} squares. Perimeter: count the edges all the way round.`,
                  `Fläche: ${b} Reihen mit je ${a} Kästchen. Umfang: die Kästchenkanten einmal außen herum.`,
                ),
              )}
            </p>
            <button
              type="button"
              onClick={() => setNumbers((v) => !v)}
              className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px]", numbers ? "border-blob/40 bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover")}
              aria-pressed={numbers}
            >
              <Hash className="size-3.5" />
              {t(tx("Count the squares", "Kästchen zählen"))}
            </button>
          </div>

          <div className={cn("rounded-xl border px-4 py-3 transition-colors", solved ? "border-ok/50 bg-ok/5" : "border-line bg-surface")}>
            <div className="mb-1 flex items-center justify-between gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">
              <span>{t(tx(`Challenge ${task + 1} of ${CHALLENGES.length}`, `Bauauftrag ${task + 1} von ${CHALLENGES.length}`))}</span>
              <AnimatePresence>
                {solved && (
                  <motion.span initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1 normal-case tracking-normal text-ok">
                    <Check className="size-4" /> {t(tx("Done!", "Geschafft!"))}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <p className="text-[15px] leading-relaxed text-ink">
              <Inline text={c.text} />
            </p>
            {near && <p className="mt-1 text-[13px] text-ink-2"><Inline text={near} /></p>}
            {solved && (
              <button
                type="button"
                onClick={() => setTask((v) => (v + 1) % CHALLENGES.length)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blob px-3 py-1.5 text-[13px] font-medium text-white hover:bg-blob/90"
              >
                {task === CHALLENGES.length - 1 ? <RotateCcw className="size-3.5" /> : null}
                {task === CHALLENGES.length - 1 ? t(tx("Start again", "Von vorn")) : t(tx("Next challenge", "Nächster Auftrag"))}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Place-value table for units (Stellenwerttafel)

type Preset = { digits: string; first: number; unit: number };
type UnitSystem = { units: string[]; alt: (string | null)[]; k: number; factor: number; presets: Preset[] };

const AREA_UNITS: UnitSystem = {
  units: ["km²", "ha", "a", "m²", "dm²", "cm²", "mm²"],
  alt: [null, null, null, null, null, null, null],
  k: 2,
  factor: 100,
  presets: [
    { digits: "35", first: 7, unit: 3 },
    { digits: "250", first: 9, unit: 5 },
    { digits: "12", first: 3, unit: 1 },
    { digits: "45", first: 4, unit: 2 },
    { digits: "8", first: 2, unit: 0 },
    { digits: "7", first: 9, unit: 4 },
  ],
};
const VOLUME_UNITS: UnitSystem = {
  units: ["m³", "dm³", "cm³", "mm³"],
  alt: [null, "l", "ml", null],
  k: 3,
  factor: 1000,
  presets: [
    { digits: "25", first: 5, unit: 1 },
    { digits: "750", first: 6, unit: 2 },
    { digits: "12", first: 2, unit: 0 },
    { digits: "45", first: 5, unit: 2 },
  ],
};

type Cell = { i: number; d: string; added: boolean; trailing: boolean };

/** The digits shown in the table when the comma stands after cell c, and the number they read. */
function reading(p: Preset, c: number): { cells: Cell[]; int: string; frac: string } {
  const last = p.first + p.digits.length - 1;
  const cells: Cell[] = [];
  for (let i = Math.min(p.first, c); i <= Math.max(last, c); i++) {
    const k = i - p.first;
    const has = k >= 0 && k < p.digits.length;
    cells.push({ i, d: has ? p.digits[k] : "0", added: !has, trailing: false });
  }
  const int = cells.filter((x) => x.i <= c).map((x) => x.d).join("").replace(/^0+(?=\d)/, "");
  const fracCells = cells.filter((x) => x.i > c);
  let end = fracCells.length;
  while (end > 0 && fracCells[end - 1].d === "0") end--;
  fracCells.slice(end).forEach((x) => (x.trailing = true));
  return { cells, int, frac: fracCells.slice(0, end).map((x) => x.d).join("") };
}

export function AreaVolumeUnitTable() {
  const t = useText();
  const scope = useId();
  const [mode, setMode] = useState<"area" | "volume">("area");
  const [preset, setPreset] = useState(0);
  const sys = mode === "area" ? AREA_UNITS : VOLUME_UNITS;
  const p = sys.presets[preset % sys.presets.length];
  const [unit, setUnit] = useState(p.unit);
  const W = mode === "area" ? 34 : 36;
  const N = sys.units.length * sys.k;
  const comma = unit * sys.k + sys.k - 1;
  const r = reading(p, comma);
  const start = reading(p, p.unit * sys.k + sys.k - 1);
  const de = useLocale() === "de";
  const show = (x: { int: string; frac: string }) => {
    const int = x.int.length >= 5 ? x.int.replace(/\B(?=(\d{3})+$)/g, "\\,") : x.int;
    return x.frac ? `${int}${de ? "," : "."}${x.frac}` : int;
  };
  const name = (i: number) => sys.units[i];
  const steps = unit - p.unit;
  const factor = `${sys.factor ** Math.abs(steps)}`.replace(/\B(?=(\d{3})+$)/g, de ? "." : ",");

  function switchMode(m: "area" | "volume") {
    setMode(m);
    setPreset(0);
    setUnit((m === "area" ? AREA_UNITS : VOLUME_UNITS).presets[0].unit);
  }
  function nextPreset() {
    const n = (preset + 1) % sys.presets.length;
    setPreset(n);
    setUnit(sys.presets[n].unit);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          options={[
            { id: "area", label: tx("Area · 100", "Fläche · 100") },
            { id: "volume", label: tx("Volume · 1000", "Volumen · 1000") },
          ]}
          value={mode}
          onChange={switchMode}
        />
        <button type="button" onClick={nextPreset} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[13px] text-ink-2 hover:bg-hover hover:text-ink">
          <Shuffle className="size-3.5" />
          {t(tx("Another number", "Andere Zahl"))}
        </button>
      </div>

      <div className="relative mx-auto w-full" style={{ maxWidth: N * W }}>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${sys.units.length}, minmax(0, 1fr))` }}>
          {sys.units.map((u, j) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(j)}
              aria-pressed={unit === j}
              className={cn(
                "relative border border-line px-0.5 py-1.5 text-center text-[12.5px] font-semibold transition-colors first:rounded-tl-lg last:rounded-tr-lg sm:text-[14px]",
                unit === j ? "bg-blob text-white" : "bg-surface text-ink-2 hover:bg-hover",
              )}
            >
              {u}
              {sys.alt[j] && <span className={cn("block text-[10.5px] font-medium", unit === j ? "text-white/80" : "text-ink-3")}>= {sys.alt[j]}</span>}
            </button>
          ))}
        </div>
        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}>
          {Array.from({ length: N }, (_, i) => {
            const cell = r.cells.find((x) => x.i === i);
            return (
              <div
                key={i}
                className={cn(
                  "grid h-11 place-items-center border-b border-l border-line text-[18px] font-semibold tabular-nums last:border-r sm:h-12 sm:text-[21px]",
                  i % sys.k === 0 ? "border-l-line-2" : "border-l-line/40",
                  Math.floor(i / sys.k) === unit ? "bg-blob-soft/60" : "bg-raised",
                )}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  {cell && (
                    <motion.span
                      key={`${i}-${cell.d}-${cell.added}`}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: cell.trailing ? 0.35 : 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className={cell.added ? "text-blob" : "text-ink"}
                    >
                      {cell.d}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-0 w-[3px] -translate-x-1/2 rounded-full bg-blob"
            initial={false}
            animate={{ left: `${((comma + 1) / N) * 100}%` }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          />
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -bottom-3 -translate-x-1/2 text-[30px] font-bold leading-none text-blob"
            initial={false}
            animate={{ left: `${((comma + 1) / N) * 100}%` }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            ,
          </motion.span>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-line bg-surface px-4 py-3">
        <div className="overflow-x-auto">
          <MathView
            src={steps === 0 ? `${show(start)}#v "${name(p.unit)}"#u` : `${show(start)}#v0 "${name(p.unit)}"#u0 =#e ${show(r)}#v "${name(unit)}"#u`}
            size="md"
            scope={`${scope}-r`}
          />
        </div>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          {steps === 0
            ? t(tx("Tap another unit in the table. The digits stay where they are, only the comma moves.", "Tippe in der Tafel eine andere Einheit an. Die Ziffern bleiben stehen, nur das Komma wandert."))
            : steps > 0
              ? t(
                  tx(
                    `${steps} step${steps > 1 ? "s" : ""} to a smaller unit: times ${factor}. The comma moves ${steps * sys.k} places to the right${r.cells.some((x) => x.added) ? ", missing places are filled with zeros" : ""}.`,
                    `${steps} Stufe${steps > 1 ? "n" : ""} zur kleineren Einheit: mal ${factor}. Das Komma rückt ${steps * sys.k} Stellen nach rechts${r.cells.some((x) => x.added) ? ", leere Stellen füllst du mit Nullen auf" : ""}.`,
                  ),
                )
              : t(
                  tx(
                    `${-steps} step${steps < -1 ? "s" : ""} to a bigger unit: divided by ${factor}. The comma moves ${-steps * sys.k} places to the left.`,
                    `${-steps} Stufe${steps < -1 ? "n" : ""} zur größeren Einheit: geteilt durch ${factor}. Das Komma rückt ${-steps * sys.k} Stellen nach links.`,
                  ),
                )}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cuboid from unit cubes, and its net

const CU = 26;
const KD = 0.3536;
const MAX = { a: 6, b: 4, c: 5 };

type Pair = "ab" | "ac" | "bc";

export function AreaVolumeCuboidBuilder() {
  const t = useText();
  const num = useNum();
  const scope = useId();
  const [a, setA] = useState(4);
  const [b, setB] = useState(3);
  const [c, setC] = useState(2);
  const [pair, setPair] = useState<Pair | null>(null);

  const W = (MAX.a + KD * MAX.b) * CU + 110;
  const H = (MAX.c + KD * MAX.b) * CU + 34;
  const ox = 50 + ((MAX.a + KD * MAX.b - (a + KD * b)) * CU) / 2;
  const oy = H - 26;
  const P = (x: number, y: number, z: number) => `${ox + (x + KD * y) * CU},${oy - (z + KD * y) * CU}`;
  const poly = (pts: [number, number, number][]) => pts.map(([x, y, z]) => P(x, y, z)).join(" ");

  const cubes: { x: number; y: number; z: number }[] = [];
  for (let y = b - 1; y >= 0; y--) for (let z = 0; z < c; z++) for (let x = 0; x < a; x++) cubes.push({ x, y, z });

  const faces: Record<Pair, { vis: [number, number, number][]; hid: [number, number, number][]; name: Text }> = {
    ab: {
      vis: [[0, 0, c], [a, 0, c], [a, b, c], [0, b, c]],
      hid: [[0, 0, 0], [a, 0, 0], [a, b, 0], [0, b, 0]],
      name: tx("top + bottom", "oben + unten"),
    },
    ac: {
      vis: [[0, 0, 0], [a, 0, 0], [a, 0, c], [0, 0, c]],
      hid: [[0, b, 0], [a, b, 0], [a, b, c], [0, b, c]],
      name: tx("front + back", "vorne + hinten"),
    },
    bc: {
      vis: [[a, 0, 0], [a, b, 0], [a, b, c], [a, 0, c]],
      hid: [[0, 0, 0], [0, b, 0], [0, b, c], [0, 0, c]],
      name: tx("right + left", "rechts + links"),
    },
  };
  const area: Record<Pair, number> = { ab: a * b, ac: a * c, bc: b * c };

  // Net: cross layout with scale N, centred in its box.
  const N = 13;
  const NW = (2 * MAX.a + 2 * MAX.b) * N + 40;
  const NH = (2 * MAX.b + MAX.c) * N + 40;
  const nx = (NW - (2 * a + 2 * b) * N) / 2;
  const ny = (NH - (2 * b + c) * N) / 2;
  const rects: { id: string; pair: Pair; x: number; y: number; w: number; h: number }[] = [
    { id: "left", pair: "bc", x: 0, y: b, w: b, h: c },
    { id: "front", pair: "ac", x: b, y: b, w: a, h: c },
    { id: "right", pair: "bc", x: b + a, y: b, w: b, h: c },
    { id: "back", pair: "ac", x: 2 * b + a, y: b, w: a, h: c },
    { id: "top", pair: "ab", x: b, y: 0, w: a, h: b },
    { id: "bottom", pair: "ab", x: b, y: b + c, w: a, h: b },
  ];
  const base: Record<Pair, string> = { ab: TINT.mid, ac: TINT.soft, bc: TINT.side };
  const O = 2 * (a * b + a * c + b * c);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Stepper label="a" name={tx("length", "Länge")} value={a} min={1} max={MAX.a} unit="cm" onChange={setA} />
        <Stepper label="b" name={tx("width", "Breite")} value={b} min={1} max={MAX.b} unit="cm" onChange={setB} />
        <Stepper label="c" name={tx("height", "Höhe")} value={c} min={1} max={MAX.c} unit="cm" onChange={setC} />
      </div>

      <div className="grid items-end gap-4 md:grid-cols-2">
        <figure className="space-y-1">
          <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[300px]" role="img" aria-label={t(tx(`Cuboid of ${a * b * c} unit cubes`, `Quader aus ${a * b * c} Einheitswürfeln`))}>
            <AnimatePresence initial={false}>
              {cubes.map(({ x, y, z }) => (
                <motion.g key={`${x}-${y}-${z}`} initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring}>
                  <polygon points={poly([[x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1]])} fill={TINT.soft} stroke="var(--ink-2)" strokeWidth={0.8} strokeLinejoin="round" />
                  <polygon points={poly([[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]])} fill={TINT.mid} stroke="var(--ink-2)" strokeWidth={0.8} strokeLinejoin="round" />
                  <polygon points={poly([[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]])} fill={TINT.side} stroke="var(--ink-2)" strokeWidth={0.8} strokeLinejoin="round" />
                </motion.g>
              ))}
            </AnimatePresence>
            <AnimatePresence>
              {pair && (
                <motion.g key={pair} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <polygon points={poly(faces[pair].hid)} fill="none" stroke="var(--blob)" strokeWidth={1.6} strokeDasharray="5 4" />
                  <polygon points={poly(faces[pair].vis)} fill="var(--blob)" fillOpacity={0.45} stroke="var(--blob)" strokeWidth={2.4} />
                </motion.g>
              )}
            </AnimatePresence>
            <text x={ox + (a * CU) / 2} y={oy + 19} textAnchor="middle" fontSize={14} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
              a = {a}
            </text>
            <text x={ox - 7} y={oy - (c * CU) / 2 + 5} textAnchor="end" fontSize={14} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
              c = {c}
            </text>
            <text x={ox + (a + KD * b * 0.5) * CU + 8} y={oy - KD * b * 0.5 * CU + 12} fontSize={14} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
              b = {b}
            </text>
          </svg>
          <figcaption className="text-center text-[12.5px] text-ink-3">
            {t(tx(`${c} layers of ${a} · ${b} = ${a * b} cubes`, `${c} Schichten mit je ${a} · ${b} = ${a * b} Würfeln`))}
          </figcaption>
        </figure>

        <figure className="space-y-1">
          <svg viewBox={`0 0 ${NW} ${NH}`} className="mx-auto w-full max-w-[330px]" role="img" aria-label={t(tx("Net of the cuboid", "Netz des Quaders"))}>
            <g>
              {rects.map((q) => (
                <motion.rect
                  key={q.id}
                  initial={false}
                  animate={{ x: nx + q.x * N, y: ny + q.y * N, width: q.w * N, height: q.h * N, fill: pair === q.pair ? "var(--blob)" : base[q.pair], fillOpacity: pair === q.pair ? 0.5 : 1 }}
                  transition={spring}
                  stroke="var(--ink)"
                  strokeWidth={1.4}
                  onClick={() => setPair((v) => (v === q.pair ? null : q.pair))}
                  style={{ cursor: "pointer" }}
                />
              ))}
              <motion.text initial={false} animate={{ x: nx + (b + a / 2) * N, y: ny + (2 * b + c) * N + 14 }} transition={spring} textAnchor="middle" fontSize={12.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
                a
              </motion.text>
              <motion.text initial={false} animate={{ x: nx + b * N - 5, y: ny + (b + c + b / 2) * N + 4 }} transition={spring} textAnchor="end" fontSize={12.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
                b
              </motion.text>
              <motion.text initial={false} animate={{ x: nx - 5, y: ny + (b + c / 2) * N + 4 }} transition={spring} textAnchor="end" fontSize={12.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
                c
              </motion.text>
            </g>
          </svg>
          <figcaption className="text-center text-[12.5px] text-ink-3">{t(tx("The net: 6 rectangles, always 2 the same", "Das Netz: 6 Rechtecke, immer 2 gleiche"))}</figcaption>
        </figure>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["ab", "ac", "bc"] as Pair[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setPair((v) => (v === id ? null : id))}
            aria-pressed={pair === id}
            className={cn("rounded-lg border px-3 py-1.5 text-[13px] transition-colors", pair === id ? "border-blob bg-blob text-white" : "border-line text-ink-2 hover:bg-hover")}
          >
            {t(faces[id].name)}: 2 · {id[0]} · {id[1]} = 2 · {area[id]}
          </button>
        ))}
      </div>

      <div className="space-y-2 rounded-xl border border-line bg-surface px-4 py-3">
        <div className="overflow-x-auto">
          <MathView src={`V#V =#e a#la \\cdot#m1 b#lb \\cdot#m2 c#lc =#e2 ${a}#a \\cdot#n1 ${b}#b \\cdot#n2 ${c}#c =#e3 ${a * b * c}#r "cm³"#u`} size="md" scope={`${scope}-V`} />
        </div>
        <div className="overflow-x-auto">
          <MathView src={`O#O =#e 2#two \\cdot#m (${a * b}#p1 +#q1 ${a * c}#p2 +#q2 ${b * c}#p3)#br =#e2 ${O}#r "cm²"#u`} size="md" scope={`${scope}-O`} />
        </div>
        <p className="text-[13px] leading-relaxed text-ink-2">
          {t(
            tx(
              `Volume: how many unit cubes fit inside. Surface area: all six faces of the net together, ${num(O)} squares of 1 cm².`,
              `Volumen: Wie viele Einheitswürfel hineinpassen. Oberfläche: alle sechs Flächen des Netzes zusammen, ${num(O)} Kästchen mit je 1 cm².`,
            ),
          )}
        </p>
      </div>
    </div>
  );
}
