"use client";

import { Bold, ChartScatter, Check, ChevronDown, Italic, NotebookPen, Redo2, RefreshCw, Sheet, Sigma, TableProperties, Undo2, UserPlus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useMessages } from "@/i18n/client";
import { landingText } from "@/i18n/messages/landing";
import { cn } from "@/lib/utils";
import { DemoControl, useDemoPlayer } from "./DemoPlayer";
import { useReducedAfterMount } from "./useTyping";

type T = (typeof landingText)["en"]["sheets"]["demo"];

// Blobxcel on the landing page, drawn by hand (SVG and Tailwind; nothing from @/sheet or the sheet
// components, which would pull in the formula engine). The app's "Kalibriergerade" template: six
// standards in mg/L and what the photometer read. Its regression (b = 0.00119, m = 0.05233,
// R² = 0.99977) and sample A (0.287 → 5.46 mg/L) are worked out once; the labels are in the copy.
const CONC = [0, 2, 4, 6, 8, 10];
const ABS = [0.003, 0.104, 0.207, 0.318, 0.423, 0.522];
const M = 0.05233;
const B = 0.00119;
const SAMPLE = { x: 5.4618, y: 0.287 };

/** The chart's scales in its 300 × 232 viewBox: x 0…12 mg/L, y 0…0.6. */
const X = (v: number) => 44 + (v / 12) * 244;
const Y = (v: number) => 176 - (v / 0.6) * 142;
const TREND = "color-mix(in oklab, var(--sheet-blue) 68%, var(--ink))";
// A smart table in blue, as the app draws one (sheet/table/look.ts), and the grid's chrome.
const HEAD_FILL = "color-mix(in oklab, var(--sheet-blue) 24%, var(--raised))";
const HEAD_INK = "color-mix(in oklab, var(--sheet-blue) 62%, var(--ink))";
const BAND = "color-mix(in oklab, var(--sheet-blue) 7%, var(--raised))";
const TINT = "color-mix(in oklab, var(--blob) 10%, transparent)";
const CHROME = "color-mix(in oklab, var(--hover) 75%, var(--raised))";
const SAMPLE_INK = "color-mix(in oklab, var(--sheet-orange) 70%, var(--ink))";

type Sel = "C7" | "A1:C7" | "B9";
/** One beat of the story: the selection, a pressed tool, the table look, how much chart (0–3), the note. */
type Frame = { sel: Sel; tool?: "table" | "chart"; table?: boolean; chart: number; note?: boolean; ms: number };

const FRAMES: Frame[] = [
  { sel: "C7", chart: 0, ms: 1300 }, // the values are in
  { sel: "A1:C7", chart: 0, ms: 700 }, // selected
  { sel: "A1:C7", tool: "table", table: true, chart: 0, ms: 1100 }, // "Als Tabelle": tint, stripes, filters
  { sel: "A1:C7", tool: "chart", table: true, chart: 1, ms: 1300 }, // "Diagramm": the card, the points
  { sel: "A1:C7", table: true, chart: 2, ms: 1600 }, // the trendline and its equation
  { sel: "B9", table: true, chart: 2, ms: 1600 }, // =STEIGUNG in B9
  { sel: "B9", table: true, chart: 3, ms: 1300 }, // sample A on the line
  { sel: "B9", table: true, chart: 3, note: true, ms: 0 }, // the chart in the lab journal: where it stays
];
const DURATIONS = FRAMES.map((f) => f.ms);
/** The whole story at once: the server's picture (also without JS), the one with reduced motion, and the end. */
const STILL = FRAMES.length - 1;

const num = (v: number, digits: number, dec: string) => v.toFixed(digits).replace(".", dec);
const spring = { type: "spring", stiffness: 420, damping: 30 } as const;

/** Where a cell is in the selection: the selection's outline on its edges, and whether it's tinted. */
function picked(sel: Sel, r: number, c: number): { edge?: string; tint?: boolean } {
  if (sel === "A1:C7") {
    if (r > 7 || c > 3) return {};
    const edges = [r === 1 && "inset 0 2px var(--blob)", r === 7 && "inset 0 -2px var(--blob)", c === 1 && "inset 2px 0 var(--blob)", c === 3 && "inset -2px 0 var(--blob)"];
    return { edge: edges.filter(Boolean).join(",") || undefined, tint: r > 1 || c > 1 };
  }
  const [row, col] = sel === "C7" ? [7, 3] : [9, 2];
  return r === row && c === col ? { edge: "inset 0 0 0 2px var(--blob)" } : {};
}

/** A spreadsheet that fills itself in, becomes a smart table, grows a chart with a trendline and lands in a note. */
export function SheetShowcase() {
  const all = useMessages(landingText).sheets;
  const t = all.demo;
  const still = useReducedAfterMount();
  // The first paint shows the finished picture. Off screen it winds back, and the story plays once
  // from the beginning when it scrolls in, then stays on the finished picture (DemoPlayer).
  const { ref, i, round, player } = useDemoPlayer(DURATIONS, { poster: STILL, still });
  const f = FRAMES[still ? STILL : i];
  const d = t.dec;
  const results = f.sel === "B9";

  const rows: string[][] = [
    t.cols,
    ...CONC.map((c, k) => [k ? `S${k}` : t.blank, `${num(c, 1, d)} mg/L`, num(ABS[k], 3, d)]),
    ["", "", ""],
    [t.slope, `${num(0.0523, 4, d)} L/mg`, ""],
    ["R²", num(0.9998, 4, d), ""],
    // Empty rows below: 11–12 next to the chart from 680 px; on phones 11–19, under the chart.
    ...Array.from({ length: 9 }, () => ["", "", ""]),
  ];
  const selRows = f.sel === "A1:C7" ? [1, 2, 3, 4, 5, 6, 7] : [f.sel === "C7" ? 7 : 9];
  const selCols = f.sel === "A1:C7" ? [1, 2, 3] : [f.sel === "C7" ? 3 : 2];
  const grid = "grid grid-cols-[24px_minmax(0,0.95fr)_minmax(0,1.25fr)_minmax(0,1fr)] @min-[680px]:grid-cols-[32px_112px_128px_120px_repeat(12,72px)]";

  return (
    <div className="@container relative">
      <div ref={ref} role="img" aria-label={t.label} className="relative">
        <div className="overflow-hidden rounded-2xl border border-line bg-raised shadow-card">
          {/* The title bar: the file, saved, share. */}
          <div className="flex h-11 items-center gap-2 border-b border-line px-3 text-[13px] sm:px-4">
            <Sheet className="size-4 shrink-0 text-ink-3" />
            <span className="min-w-0 truncate font-medium">{t.file}</span>
            <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[12px] text-ink-2">
              <Check className="size-3.5 text-ok" strokeWidth={2.4} />
              <span className="@max-[599px]:hidden">{t.saved}</span>
            </span>
            <span className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-line px-2 text-[12px] font-medium shadow-card">
              <UserPlus className="size-3.5" />
              <span className="@max-[599px]:hidden">{t.share}</span>
            </span>
          </div>

          {/* The toolbar (its first groups only on phones), and the formula bar from 600 px. */}
          <div className="px-2 pt-2">
            <div className="flex h-10 items-center gap-0.5 overflow-hidden rounded-xl border border-line bg-raised px-1.5 shadow-card">
              <Tool>
                <Undo2 className="size-4" />
              </Tool>
              <Tool>
                <Redo2 className="size-4" />
              </Tool>
              <Sep />
              <Tool wide>
                {t.general}
                <ChevronDown className="size-3 text-ink-3" />
              </Tool>
              <Sep wide />
              <Tool wide>
                <Bold className="size-4" />
              </Tool>
              <Tool wide>
                <Italic className="size-4" />
              </Tool>
              <Sep wide />
              <Tool wide>
                <Sigma className="size-4" />
              </Tool>
              <Sep wide />
              <Tool on={f.tool === "table"}>
                <TableProperties className="size-4" />
                {t.table}
              </Tool>
              <Tool on={f.tool === "chart"}>
                <ChartScatter className="size-4" />
                {t.chart}
                <ChevronDown className="size-3 opacity-70" />
              </Tool>
            </div>
          </div>
          <div className="px-2 pt-1.5 @max-[599px]:hidden">
            <div className="flex h-9 items-center gap-2 rounded-xl border border-line bg-raised px-1 text-[12.5px] shadow-card">
              <span className="flex h-7 w-14 shrink-0 items-center rounded-lg bg-paper px-2 font-medium tabular-nums">{f.sel.slice(0, 2)}</span>
              <span className="font-math italic text-ink-3">fx</span>
              <span className="min-w-0 truncate tabular-nums">
                {f.sel === "C7" ? (
                  num(ABS[5], 3, d)
                ) : f.sel === "B9" ? (
                  <>
                    {t.formula.fn}
                    <span style={{ color: "var(--sheet-blue)" }}>{t.formula.a}</span>
                    {t.formula.sep}
                    <span style={{ color: "var(--sheet-purple)" }}>{t.formula.b}</span>)
                  </>
                ) : (
                  t.cols[0]
                )}
              </span>
            </div>
          </div>

          {/* The grid: column letters, rows 1–12 with the chart next to the table (from 680 px), or 1–19 with the chart over the empty rows (phones; the smallest ones a little tighter, so "Konzentration", "Absorbance" and "S0 (Blindwert)" fit). */}
          <div className="relative mt-2 overflow-hidden border-t border-line text-[12px] tabular-nums @max-[339px]:text-[11px] @min-[680px]:text-[12.5px]">
            <div className={cn(grid, "h-6 text-[11px]")} style={{ background: CHROME }}>
              <span className="border-b border-r border-line-2" />
              {Array.from({ length: 15 }, (_, c) => (
                <span
                  key={c}
                  className={cn("grid place-items-center border-b border-r border-line-2", c > 2 && "@max-[679px]:hidden", selCols.includes(c + 1) ? "font-semibold text-blob-ink" : "text-ink-3")}
                  style={selCols.includes(c + 1) ? { boxShadow: "inset 0 -2px var(--blob)" } : undefined}
                >
                  {String.fromCharCode(65 + c)}
                </span>
              ))}
            </div>
            {rows.map((row, k) => {
              const r = k + 1;
              const on = selRows.includes(r);
              return (
                <div key={r} className={cn(grid, "h-[26px] @min-[680px]:h-7", r > 12 && "@min-[680px]:hidden")}>
                  <span
                    className={cn("grid place-items-center border-b border-r border-line-2 text-[11px]", on ? "font-semibold text-blob-ink" : "text-ink-3")}
                    style={{ background: CHROME, boxShadow: on ? "inset -2px 0 var(--blob)" : undefined }}
                  >
                    {r}
                  </span>
                  {row.map((text, c) => {
                    const col = c + 1;
                    const head = r === 1;
                    const look = f.table && r <= 7;
                    const result = (r === 9 || r === 10) && col === 2;
                    const sel = picked(f.sel, r, col);
                    const shadows = [sel.edge, look && head && `inset 0 -1px ${HEAD_INK}`].filter(Boolean).join(",");
                    const style: CSSProperties = {
                      backgroundColor: look && head ? HEAD_FILL : look && r % 2 && r > 1 ? BAND : result && results ? "var(--sheet-green-fill)" : undefined,
                      color: look && head ? HEAD_INK : undefined,
                      backgroundImage: sel.tint ? `linear-gradient(${TINT}, ${TINT})` : undefined,
                      boxShadow: shadows || undefined,
                    };
                    return (
                      <span
                        key={c}
                        className={cn(
                          "flex min-w-0 items-center gap-0.5 overflow-hidden whitespace-nowrap border-b border-r border-line px-1.5 transition-[background-color,color] duration-500 @max-[339px]:px-1 @min-[680px]:gap-1 @min-[680px]:px-2",
                          col > 1 && !head && "justify-end",
                          (head || result) && "font-semibold",
                        )}
                        style={style}
                      >
                        <span className={cn("truncate transition-opacity duration-500", result && !results && "opacity-0")}>{text}</span>
                        {head && (
                          <span
                            className={cn("ml-auto grid size-[13px] shrink-0 place-items-center rounded-[4px] border transition-opacity duration-500 @min-[680px]:size-[15px]", !look && "opacity-0")}
                            style={{ borderColor: `color-mix(in oklab, ${HEAD_INK} 35%, transparent)`, color: HEAD_INK }}
                          >
                            <ChevronDown className="size-2.5 @min-[680px]:size-[11px]" />
                          </span>
                        )}
                      </span>
                    );
                  })}
                  {Array.from({ length: 12 }, (_, c) => (
                    <span key={c} className="border-b border-r border-line @max-[679px]:hidden" />
                  ))}
                </div>
              );
            })}

            <div className="absolute inset-x-2 bottom-2 top-[292px] @min-[680px]:bottom-auto @min-[680px]:left-[408px] @min-[680px]:right-auto @min-[680px]:top-[29px] @min-[680px]:w-[clamp(240px,100%_-_424px,400px)] @min-[920px]:w-[clamp(300px,100%_-_692px,400px)]">
              <AnimatePresence initial={false}>
                {f.chart > 0 && (
                  <motion.div
                    key={round}
                    initial={still ? false : { opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.3 } }}
                    transition={spring}
                    className={cn("relative h-full rounded-xl border border-line-2 bg-raised p-1.5 shadow-pop", f.sel === "A1:C7" && "ring-2 ring-blob/70")}
                  >
                    <Chart t={t} level={f.chart} still={still} />
                    {f.sel === "A1:C7" &&
                      ["-left-1 -top-1", "-right-1 -top-1", "-bottom-1 -left-1", "-bottom-1 -right-1"].map((at) => (
                        <span key={at} className={cn("absolute size-2 rounded-[2px] border border-blob bg-raised", at)} />
                      ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* The chart, live in a note: a card next to the window from 920 px, a toast under it before. */}
        <AnimatePresence initial={false}>
          {f.note && (
            <motion.div
              key={round}
              initial={still ? false : { opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              transition={spring}
              className="absolute right-[-20px] top-[132px] w-[clamp(220px,24%,268px)] rounded-xl border border-line bg-raised p-3 shadow-pop @max-[919px]:hidden"
            >
              <div className="flex items-center gap-1.5 font-display text-[13.5px] font-semibold">
                <NotebookPen className="size-3.5 text-ink-3" />
                {t.note}
              </div>
              <p className="mt-0.5 text-[12px] text-ink-2">{t.noteLine}</p>
              <div className="mt-2 rounded-lg border border-line px-2 pb-1.5 pt-1.5">
                <div className="flex items-center gap-1 text-[10.5px] text-ink-2">
                  <ChartScatter className="size-3" />
                  {t.from}
                  <RefreshCw className="ml-auto size-3 text-ink-3" />
                </div>
                <svg viewBox="0 0 220 96" className="mt-1 block h-[84px] w-full">
                  <path d="M14 86H210" stroke="var(--line-2)" />
                  <line x1={14} y1={86 - (B / 0.55) * 78} x2={206} y2={86 - ((M * 10 + B) / 0.55) * 78} stroke={TREND} strokeWidth={1.4} strokeDasharray="4 2.6" />
                  {CONC.map((c, k) => (
                    <circle key={c} cx={14 + c * 19.2} cy={86 - (ABS[k] / 0.55) * 78} r={3} fill="var(--sheet-blue)" />
                  ))}
                </svg>
                <span className="mt-1 inline-block rounded-md bg-blob-soft px-1.5 text-[10.5px] font-semibold leading-[18px] text-blob-ink">{t.r2Line}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Under the window: the "added to the note" toast (before 920 px, where the note card has no
          room) in the middle, and the demo's button on the right, outside the picture. */}
      <div className="relative mt-3 flex h-9 items-center justify-center">
        <div aria-hidden className="@min-[920px]:hidden">
          <AnimatePresence initial={false}>
            {f.note && (
              <motion.div
                key={round}
                initial={still ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.3 } }}
                transition={spring}
                className="flex h-9 items-center gap-2 rounded-xl border border-line bg-raised px-3 text-[12px] font-medium shadow-pop"
              >
                <NotebookPen className="size-3.5 text-blob-ink" />
                {t.added}
                <Check className="size-3.5 text-ok" strokeWidth={2.6} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <DemoControl player={player} name={all.kicker} className="absolute right-0" />
      </div>
    </div>
  );
}

/** A toolbar button (`wide`: only from 600 px); pressed, it turns violet-soft like the app's. */
function Tool({ on, wide, children }: { on?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12.5px] transition-colors duration-200",
        on ? "bg-blob-soft text-blob-ink" : "text-ink-2",
        wide && "@max-[599px]:hidden",
      )}
    >
      {children}
    </span>
  );
}

function Sep({ wide }: { wide?: boolean }) {
  return <span className={cn("mx-1 h-5 w-px shrink-0 bg-line", wide && "@max-[599px]:hidden")} />;
}

/** The scatter chart: axes, the six points, then (level 2) the trendline and its equation, then (3) sample A. */
function Chart({ t, level, still }: { t: T; level: number; still: boolean }) {
  const d = t.dec;
  const sx = X(SAMPLE.x);
  const sy = Y(SAMPLE.y);
  const enter = (delay: number) => ({ initial: still ? false : { opacity: 0 }, animate: { opacity: 1 }, transition: { delay, duration: 0.4 } });
  return (
    <svg viewBox="0 0 300 232" className="block h-full w-full @min-[680px]:aspect-[300/232] @min-[680px]:h-auto">
      <text x={166} y={19} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--ink)">
        {t.chartTitle}
      </text>
      {[0, 1, 2, 3, 4, 5, 6].map((k) => (
        <g key={k}>
          <line x1={44} x2={288} y1={Y(k / 10)} y2={Y(k / 10)} stroke={k ? "var(--line)" : "var(--ink-3)"} />
          <text x={38} y={Y(k / 10) + 3.5} textAnchor="end" fontSize={9.5} fill="var(--ink-2)">
            {num(k / 10, 1, d)}
          </text>
          <line x1={X(k * 2)} x2={X(k * 2)} y1={176} y2={180} stroke="var(--ink-3)" />
          <text x={X(k * 2)} y={191} textAnchor="middle" fontSize={9.5} fill="var(--ink-2)">
            {k * 2}
          </text>
        </g>
      ))}
      <text x={166} y={212} textAnchor="middle" fontSize={10} fontWeight={500} fill="var(--ink-2)">
        {t.xTitle}
      </text>
      <text transform="rotate(-90 12 105)" x={12} y={105} textAnchor="middle" fontSize={10} fontWeight={500} fill="var(--ink-2)">
        {t.yTitle}
      </text>
      {level >= 2 && (
        <motion.line
          x1={X(0)}
          y1={Y(B)}
          initial={still ? false : { x2: X(0), y2: Y(B) }}
          animate={{ x2: X(10), y2: Y(M * 10 + B) }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          stroke={TREND}
          strokeWidth={1.6}
          strokeDasharray="5 3.2"
          strokeLinecap="round"
        />
      )}
      {level >= 3 && (
        <motion.path d={`M44 ${sy}H${sx}V176`} stroke="var(--sheet-orange)" strokeWidth={1} strokeDasharray="2 2.4" fill="none" {...enter(0.25)} />
      )}
      {CONC.map((c, k) => (
        <motion.circle
          key={c}
          cx={X(c)}
          cy={Y(ABS[k])}
          r={3.3}
          fill="var(--sheet-blue)"
          stroke="var(--raised)"
          initial={still ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 520, damping: 16, delay: 0.15 + k * 0.06 }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      ))}
      {level >= 2 && (
        <motion.g {...enter(0.6)}>
          <rect x={52} y={40} width={132} height={34} rx={4} fill="var(--raised)" stroke="var(--line)" />
          <text x={59} y={54} fontSize={10} fontWeight={500} fill={TREND}>
            {t.equation}
          </text>
          <text x={59} y={67} fontSize={10} fontWeight={500} fill={TREND}>
            {t.r2Line}
          </text>
        </motion.g>
      )}
      {level >= 3 && (
        <motion.g
          initial={still ? false : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 480, damping: 15 }}
          style={{ transformBox: "fill-box", transformOrigin: "0% 20%" }}
        >
          <rect x={sx - 4} y={sy - 4} width={8} height={8} transform={`rotate(45 ${sx} ${sy})`} fill="var(--sheet-orange)" stroke="var(--raised)" />
          <rect x={sx + 9} y={sy + 6} width={t.sampleWidth} height={17} rx={8.5} fill="var(--raised)" stroke={`color-mix(in oklab, var(--sheet-orange) 45%, var(--line))`} />
          <text x={sx + 17} y={sy + 18} fontSize={9.5} fontWeight={600} fill={SAMPLE_INK}>
            {t.sample}
          </text>
        </motion.g>
      )}
    </svg>
  );
}
