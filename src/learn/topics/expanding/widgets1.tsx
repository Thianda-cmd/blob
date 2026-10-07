"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Minus, Plus, RotateCcw, Shuffle } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";

const spring = { type: "spring" as const, stiffness: 320, damping: 30 };

/** A small − value + control. */
export function Stepper({ label, value, min, max, onChange, unit }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; unit?: string }) {
  const t = useText();
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 text-[13px] text-ink-2">{label}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        aria-label={t(tx(`${label}: less`, `${label}: weniger`))}
      >
        <Minus className="size-3.5" />
      </button>
      <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="min-w-7 text-center font-math text-[19px] tabular-nums text-ink">
        {value}
        {unit}
      </motion.span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        aria-label={t(tx(`${label}: more`, `${label}: mehr`))}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/** Two options as a sliding pill. */
export function Toggle<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: Text }[]; onChange: (v: T) => void }) {
  const t = useText();
  const scope = useId();
  return (
    <div className="flex rounded-lg border border-line p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", value === o.id ? "text-ink" : "text-ink-3 hover:text-ink")}
        >
          {value === o.id && <motion.span layoutId={`${scope}-pill`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
          <span className="relative">{t(o.label)}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Split the rectangle: 6 · 13 = 6 · 10 + 6 · 3, counted in unit squares.

const U = 22;
const PADL = 34;
const PADT = 34;
const MAX_COLS = 16;
const MAX_ROWS = 8;

/** A rectangle of unit squares with a split line you can drag: the two parts always add up to the whole. */
export function ExpandingSplitRect() {
  const t = useText();
  const scope = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(13);
  const [split, setSplit] = useState(7);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const s = Math.max(1, Math.min(split, cols - 1));
  const r = cols - s;
  const W = PADL + MAX_COLS * U + 12;
  const H = PADT + MAX_ROWS * U + 14;
  const gw = cols * U;
  const gh = rows * U;
  const xSplit = PADL + s * U;

  const moveTo = (clientX: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const x = new DOMPoint(clientX, 0).matrixTransform(ctm.inverse()).x;
    setSplit(Math.max(1, Math.min(cols - 1, Math.round((x - PADL) / U))));
  };
  const down = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    moveTo(e.clientX);
  };
  const key = (e: KeyboardEvent) => {
    const by = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : 0;
    if (e.key === "Home") setSplit(1);
    else if (e.key === "End") setSplit(cols - 1);
    else if (by) setSplit(Math.max(1, Math.min(cols - 1, s + by)));
    else return;
    e.preventDefault();
  };
  const easy = s === 10 || r === 10;
  const label = (n: number) => (n >= 3 ? 15 : 12);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Stepper label={t(tx("Height", "Höhe"))} value={rows} min={2} max={MAX_ROWS} onChange={setRows} />
        <Stepper
          label={t(tx("Width", "Breite"))}
          value={cols}
          min={4}
          max={MAX_COLS}
          onChange={(n) => {
            setCols(n);
            setSplit((x) => Math.min(x, n - 1));
          }}
        />
      </div>

      <div className="grid items-center gap-5 md:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={cn("w-full max-w-[400px] select-none", dragging ? "cursor-grabbing" : "cursor-pointer")}
          style={{ touchAction: "pan-y" }}
          onPointerDown={down}
          onPointerMove={(e) => dragging && moveTo(e.clientX)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          role="img"
          aria-label={t(tx(`A rectangle of ${rows} by ${cols} squares, split into ${s} and ${r} columns`, `Ein Rechteck aus ${rows} mal ${cols} Kästchen, geteilt in ${s} und ${r} Spalten`))}
        >
          {/* the two parts */}
          <motion.rect initial={false} animate={{ width: s * U, height: gh }} transition={spring} x={PADL} y={PADT} fill="color-mix(in oklab, var(--blob) 24%, transparent)" />
          <motion.rect initial={false} animate={{ x: xSplit, width: r * U, height: gh }} transition={spring} y={PADT} fill="color-mix(in oklab, var(--ink) 7%, transparent)" />
          {/* unit squares */}
          {Array.from({ length: MAX_COLS + 1 }, (_, i) => (
            <motion.line key={`v${i}`} initial={false} animate={{ opacity: i <= cols ? 1 : 0, y2: PADT + gh }} transition={spring} x1={PADL + i * U} x2={PADL + i * U} y1={PADT} stroke="var(--line-2)" strokeWidth={1} />
          ))}
          {Array.from({ length: MAX_ROWS + 1 }, (_, j) => (
            <motion.line key={`h${j}`} initial={false} animate={{ opacity: j <= rows ? 1 : 0, x2: PADL + gw }} transition={spring} y1={PADT + j * U} y2={PADT + j * U} x1={PADL} stroke="var(--line-2)" strokeWidth={1} />
          ))}
          <motion.rect initial={false} animate={{ width: gw, height: gh }} transition={spring} x={PADL} y={PADT} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} rx={2} />

          {/* side lengths */}
          <motion.text initial={false} animate={{ x: PADL + (s * U) / 2 }} transition={spring} y={PADT - 12} textAnchor="middle" fontSize={17} className="font-math" fill="var(--blob-ink)">
            {s}
          </motion.text>
          <motion.text initial={false} animate={{ x: xSplit + (r * U) / 2 }} transition={spring} y={PADT - 12} textAnchor="middle" fontSize={17} className="font-math" fill="var(--ink-2)">
            {r}
          </motion.text>
          <motion.text initial={false} animate={{ y: PADT + gh / 2 + 6 }} transition={spring} x={PADL - 14} textAnchor="middle" fontSize={17} className="font-math" fill="var(--ink-2)">
            {rows}
          </motion.text>

          {/* areas */}
          <motion.text initial={false} animate={{ x: PADL + (s * U) / 2, y: PADT + gh / 2 + 6 }} transition={spring} textAnchor="middle" fontSize={label(s) + 2} fontWeight={600} className="font-math" fill="var(--blob-ink)">
            {rows * s}
          </motion.text>
          <motion.text initial={false} animate={{ x: xSplit + (r * U) / 2, y: PADT + gh / 2 + 6 }} transition={spring} textAnchor="middle" fontSize={label(r) + 2} fontWeight={600} className="font-math" fill="var(--ink)">
            {rows * r}
          </motion.text>

          {/* the split line with its handle */}
          <motion.g initial={false} animate={{ x: xSplit }} transition={{ type: "spring", stiffness: 500, damping: 38 }}>
            <line x1={0} x2={0} y1={PADT - 4} y2={PADT + gh + 4} stroke="var(--blob)" strokeWidth={3} strokeLinecap="round" />
            <g
              role="slider"
              tabIndex={0}
              aria-label={t(tx("Split line", "Trennlinie"))}
              aria-valuemin={1}
              aria-valuemax={cols - 1}
              aria-valuenow={s}
              aria-valuetext={t(tx(`${s} and ${r} columns`, `${s} und ${r} Spalten`))}
              onKeyDown={key}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="cursor-grab outline-none"
            >
              {focused && <circle cx={0} cy={PADT + gh + 10} r={13} fill="none" stroke="var(--blob)" strokeWidth={2} opacity={0.5} />}
              <circle cx={0} cy={PADT + gh + 10} r={9} fill="var(--blob)" stroke="var(--raised)" strokeWidth={2} />
              <path d={`M -3 ${PADT + gh + 7} l -3 3 l 3 3 M 3 ${PADT + gh + 7} l 3 3 l -3 3`} stroke="var(--raised)" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </motion.g>
        </svg>

        <div className="min-w-0 space-y-3">
          <div className="space-y-1">
            <MathView src={`${rows}#h \\cdot#d ${cols}#w =#e1 ${rows}#h2 \\cdot#d2 (\\blob{${s}#s} +#p ${r}#r)#br`} size="md" scope={`${scope}-a`} />
            <div>
              <MathView src={`=#e2 \\blob{${rows}#h3 \\cdot#d3 ${s}#s2} +#p2 ${rows}#h4 \\cdot#d4 ${r}#r2`} size="md" scope={`${scope}-b`} />
            </div>
            <div>
              <MathView src={`=#e3 \\blob{${rows * s}#A} +#p3 ${rows * r}#B =#e4 ${rows * cols}#T`} size="md" scope={`${scope}-c`} />
            </div>
          </div>
          <p className="max-w-[420px] text-[13.5px] leading-relaxed text-ink-2">
            {easy
              ? t(tx("Split at 10: now both products are easy to do in your head!", "Geteilt bei 10: Jetzt gehen beide Produkte leicht im Kopf!"))
              : t(
                  tx(
                    "Drag the purple line (or use the arrow keys). The two parts change, but together they always cover the whole rectangle. Can you find a split that makes the maths easy?",
                    "Zieh die lila Linie (oder nimm die Pfeiltasten). Die beiden Teile ändern sich, aber zusammen bedecken sie immer das ganze Rechteck. Findest du eine Teilung, mit der das Rechnen leicht wird?",
                  ),
                )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Algebra tiles: collect like terms by sorting tiles; a plus and a minus tile cancel out.

type Kind = "x" | "1";
type Group = { id: number; kind: Kind; n: number };

const PRESETS: Omit<Group, "id">[][] = [
  [
    { kind: "x", n: 3 },
    { kind: "1", n: 2 },
    { kind: "x", n: 5 },
    { kind: "1", n: -7 },
  ],
  [
    { kind: "x", n: 2 },
    { kind: "1", n: -3 },
    { kind: "x", n: -1 },
    { kind: "1", n: 5 },
  ],
  [
    { kind: "1", n: 4 },
    { kind: "x", n: -2 },
    { kind: "1", n: -1 },
    { kind: "x", n: 4 },
  ],
  [
    { kind: "x", n: 1 },
    { kind: "1", n: 6 },
    { kind: "x", n: -3 },
    { kind: "1", n: -2 },
  ],
];
const MAX_TILES = 20;

const withIds = (list: Omit<Group, "id">[], from: number): Group[] => list.map((g, i) => ({ ...g, id: from + i }));

/** Display source of a list of groups, keyed per group so terms glide when they are combined. */
function groupsSrc(groups: Group[]): string {
  const live = groups.filter((g) => g.n !== 0);
  if (!live.length) return "0#zero";
  return live
    .map((g, i) => {
      const abs = Math.abs(g.n);
      const sign = g.n < 0 ? `-#s${g.id} ` : i === 0 ? "" : `+#s${g.id} `;
      const body = g.kind === "x" ? `${abs === 1 ? "" : `${abs}#c${g.id} `}x#v${g.id}` : `${abs}#c${g.id}`;
      return `${sign}${body}`;
    })
    .join(" ");
}

function collected(groups: Group[]): Group[] {
  const out: Group[] = [];
  for (const kind of ["x", "1"] as const) {
    const of = groups.filter((g) => g.kind === kind);
    const n = of.reduce((s, g) => s + g.n, 0);
    if (of.length && n !== 0) out.push({ id: of[0].id, kind, n });
  }
  return out;
}

type Tile = { id: string; kind: Kind; neg: boolean };

const tilesOf = (g: Group): Tile[] => Array.from({ length: Math.abs(g.n) }, (_, i) => ({ id: `${g.id}-${i}`, kind: g.kind, neg: g.n < 0 }));

function TileView({ tile, layoutId }: { tile: Tile; layoutId: string }) {
  const x = tile.kind === "x";
  return (
    <motion.div
      layout
      layoutId={layoutId}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.3, transition: { duration: 0.25 } }}
      transition={spring}
      className={cn(
        "grid shrink-0 place-items-center rounded-[5px] border-[1.5px] font-math text-[12px] leading-none",
        x ? "h-[54px] w-[22px]" : "size-[22px]",
        tile.neg ? "border-danger text-danger" : x ? "border-blob text-blob-ink" : "border-ink-3 text-ink-2",
      )}
      style={{
        background: tile.neg
          ? "color-mix(in oklab, var(--danger) 14%, transparent)"
          : x
            ? "color-mix(in oklab, var(--blob) 26%, transparent)"
            : "color-mix(in oklab, var(--ink) 8%, transparent)",
      }}
    >
      <span className={x ? "italic" : ""}>{tile.neg ? `−${tile.kind}` : tile.kind}</span>
    </motion.div>
  );
}

/** Build a term from x-tiles and 1-tiles, then collect it: like tiles go together, + and − tiles cancel. */
export function ExpandingTiles() {
  const t = useText();
  const scope = useId();
  const [example, setExample] = useState(0);
  const [groups, setGroups] = useState<Group[]>(() => withIds(PRESETS[0], 0));
  const [nextId, setNextId] = useState(PRESETS[0].length);
  const [mode, setMode] = useState<"written" | "collected">("written");
  const count = groups.reduce((s, g) => s + Math.abs(g.n), 0);
  const result = collected(groups);

  const addTile = (kind: Kind, sign: 1 | -1) => {
    if (count >= MAX_TILES) return;
    setMode("written");
    const last = groups[groups.length - 1];
    if (last && last.kind === kind && Math.sign(last.n) === sign) {
      setGroups(groups.map((g) => (g.id === last.id ? { ...g, n: g.n + sign } : g)));
    } else {
      setGroups([...groups, { id: nextId, kind, n: sign }]);
      setNextId(nextId + 1);
    }
  };
  const loadExample = () => {
    const next = (example + 1) % PRESETS.length;
    setExample(next);
    setGroups(withIds(PRESETS[next], nextId));
    setNextId(nextId + PRESETS[next].length);
    setMode("written");
  };

  // Collected view: per kind, the tiles that survive (the first ones of the winning sign); the rest cancel in pairs.
  const rows = (["x", "1"] as const).map((kind) => {
    const all = groups.filter((g) => g.kind === kind).flatMap(tilesOf);
    const pos = all.filter((x) => !x.neg);
    const neg = all.filter((x) => x.neg);
    const keep = pos.length >= neg.length ? pos.slice(neg.length) : neg.slice(pos.length);
    return { kind, keep, pairs: Math.min(pos.length, neg.length) };
  });
  const pairs = rows.reduce((s, r) => s + r.pairs, 0);

  const pad = (n: number, kind: Kind) => (kind === "x" ? (Math.abs(n) === 1 ? `${n < 0 ? "−" : ""}x` : `${n < 0 ? "−" : ""}${Math.abs(n)}x`) : `${n < 0 ? "−" : ""}${Math.abs(n)}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Toggle
          value={mode}
          onChange={setMode}
          options={[
            { id: "written", label: tx("As written", "Wie notiert") },
            { id: "collected", label: tx("Collected", "Zusammengefasst") },
          ]}
        />
        <button type="button" onClick={loadExample} className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <Shuffle className="size-3.5" /> {t(tx("Another example", "Anderes Beispiel"))}
        </button>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-3 flex min-h-[44px] items-center justify-center">
          <MathView src={mode === "written" ? groupsSrc(groups) : groupsSrc(result)} size="lg" scope={`${scope}-term`} />
        </div>
        <LayoutGroup id={`${scope}-tiles`}>
          <div className="min-h-[150px]">
            {mode === "written" ? (
              <div className="flex flex-wrap items-end justify-center gap-x-4 gap-y-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {groups.map((g, gi) => (
                    <motion.div layout key={g.id} className="flex flex-col items-center gap-1.5" transition={spring}>
                      <div className="flex max-w-[180px] flex-wrap items-end justify-center gap-[3px]">
                        <AnimatePresence initial={false} mode="popLayout">
                          {tilesOf(g).map((tile) => (
                            <TileView key={tile.id} tile={tile} layoutId={`${scope}-${tile.id}`} />
                          ))}
                        </AnimatePresence>
                      </div>
                      <span className={cn("font-math text-[14px]", g.n < 0 ? "text-danger" : "text-ink-2")}>
                        {gi > 0 && g.n > 0 ? "+" : ""}
                        {pad(g.n, g.kind)}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((row) => (
                  <div key={row.kind} className="flex min-h-[58px] items-center gap-3">
                    <span className="w-16 shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{row.kind === "x" ? t(tx("x-terms", "x-Terme")) : t(tx("Numbers", "Zahlen"))}</span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-[3px]">
                      <AnimatePresence initial={false} mode="popLayout">
                        {row.keep.map((tile) => (
                          <TileView key={tile.id} tile={tile} layoutId={`${scope}-${tile.id}`} />
                        ))}
                      </AnimatePresence>
                      {!row.keep.length && <span className="font-math text-[15px] text-ink-3">0</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </LayoutGroup>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ["x", 1],
            ["x", -1],
            ["1", 1],
            ["1", -1],
          ] as const
        ).map(([kind, sign]) => (
          <button
            key={`${kind}${sign}`}
            type="button"
            onClick={() => addTile(kind, sign)}
            disabled={count >= MAX_TILES}
            className={cn(
              "h-9 min-w-12 rounded-lg border px-3 font-math text-[16px] transition-colors disabled:opacity-35",
              sign < 0 ? "border-danger/40 text-danger hover:bg-hover" : "border-line text-ink hover:bg-hover",
            )}
            aria-label={t(kind === "x" ? (sign > 0 ? tx("Add an x-tile", "x-Kachel hinzufügen") : tx("Add a minus-x-tile", "Minus-x-Kachel hinzufügen")) : sign > 0 ? tx("Add a 1-tile", "1er-Kachel hinzufügen") : tx("Add a minus-1-tile", "Minus-1-Kachel hinzufügen"))}
          >
            {sign > 0 ? "+" : "−"}
            <span className={kind === "x" ? "italic" : ""}>{kind}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setGroups([]);
            setMode("written");
          }}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <RotateCcw className="size-3.5" /> {t(tx("Clear", "Leeren"))}
        </button>
      </div>

      <p className="text-[13.5px] leading-relaxed text-ink-2">
        {mode === "written"
          ? t(
              tx(
                "Each long tile is an x, each small one a 1, red ones are negative. Build your own term with the buttons, then tap “Collected”: like tiles go together.",
                "Jede lange Kachel ist ein x, jede kleine eine 1, rote sind negativ. Bau mit den Knöpfen deinen eigenen Term und tipp dann auf „Zusammengefasst“: Gleichartige Kacheln kommen zusammen.",
              ),
            )
          : pairs > 0
            ? t(
                tx(
                  `x-tiles and 1-tiles never mix: they are different kinds. And ${pairs === 1 ? "one plus tile and one minus tile" : `${pairs} pairs of a plus and a minus tile`} cancelled out, because +1 − 1 = 0.`,
                  `x-Kacheln und 1er-Kacheln mischen sich nie: Sie sind verschiedene Sorten. Und ${pairs === 1 ? "eine Plus- und eine Minus-Kachel haben" : `${pairs} Paare aus Plus- und Minus-Kachel haben`} sich aufgehoben, denn +1 − 1 = 0.`,
                ),
              )
            : t(tx("x-tiles and 1-tiles never mix: they are different kinds. So x-terms and numbers stay separate.", "x-Kacheln und 1er-Kacheln mischen sich nie: Sie sind verschiedene Sorten. x-Terme und Zahlen bleiben also getrennt."))}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A rectangle split into two parts (explain steps and practice tasks).

/** Labels are display-language maths ("x", "4", "2x"). `inner` writes the part areas inside. */
export function ExpandingAreaPic(props: Record<string, unknown>) {
  const t = useText();
  const h = String(props.h ?? "3");
  const w = (props.w as [string, string]) ?? ["x", "4"];
  const inner = props.inner as [string, string] | undefined;
  const caption = props.caption as Text | undefined;
  const isNum = (s: string) => /^\d+$/.test(s);
  const len = (s: string, unit: number, fallback: number) => (isNum(s) ? Math.max(28, Math.min(130, Number(s) * unit)) : fallback);
  const w1 = len(w[0], 22, 150);
  const w2 = len(w[1], 22, 150);
  const hh = len(h, 18, 110);
  const scale = Math.min(1, 300 / (w1 + w2));
  const A = w1 * scale;
  const B = w2 * scale;
  const Hh = Math.max(40, hh * Math.min(1, scale + 0.15));
  const pad = 30;
  const W = A + B + pad + 10;
  const HH = Hh + pad + 10;
  /** Digits upright, letters italic (school style): "2x" → 2 and an italic x. */
  const label = (s: string) =>
    s
      .replace(/\^2/g, "²")
      .split(/([A-Za-z])/)
      .filter(Boolean)
      .map((part, i) => (/^[A-Za-z]$/.test(part) ? <tspan key={i} fontStyle="italic">{part}</tspan> : <tspan key={i}>{part}</tspan>));
  return (
    <figure className="mx-auto max-w-[420px]">
      <svg viewBox={`0 0 ${W} ${HH}`} className="w-full" role="img" aria-label={t(tx(`Rectangle with height ${h} and width ${w[0]} + ${w[1]}`, `Rechteck mit der Höhe ${h} und der Breite ${w[0]} + ${w[1]}`))}>
        <g transform={`translate(${pad} ${pad - 6})`}>
          <rect x={0} y={0} width={A} height={Hh} rx={4} fill="color-mix(in oklab, var(--blob) 24%, transparent)" stroke="var(--blob)" strokeWidth={1.5} />
          <rect x={A} y={0} width={B} height={Hh} rx={4} fill="color-mix(in oklab, var(--ink) 7%, transparent)" stroke="var(--ink-3)" strokeWidth={1.5} />
          <text x={A / 2} y={-9} textAnchor="middle" fontSize={16} className="font-math" fill="var(--blob-ink)">
            {label(w[0])}
          </text>
          <text x={A + B / 2} y={-9} textAnchor="middle" fontSize={16} className="font-math" fill="var(--ink-2)">
            {label(w[1])}
          </text>
          <text x={-13} y={Hh / 2 + 5} textAnchor="middle" fontSize={16} className="font-math" fill="var(--ink-2)">
            {label(h)}
          </text>
          {inner && (
            <>
              <text x={A / 2} y={Hh / 2 + 6} textAnchor="middle" fontSize={17} fontWeight={600} className="font-math" fill="var(--blob-ink)">
                {label(inner[0])}
              </text>
              <text x={A + B / 2} y={Hh / 2 + 6} textAnchor="middle" fontSize={17} fontWeight={600} className="font-math" fill="var(--ink)">
                {label(inner[1])}
              </text>
            </>
          )}
        </g>
      </svg>
      {caption && <figcaption className="mt-2 text-center text-[13px] text-ink-2">{t(caption)}</figcaption>}
    </figure>
  );
}
