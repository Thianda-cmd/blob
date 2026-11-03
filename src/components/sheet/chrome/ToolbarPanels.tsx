"use client";

// The toolbar's smaller panels, shown from their buttons and from "Mehr" on narrow screens:
// text and fill colours, borders, font size, AutoSum's functions, chart types and freezing.

import { Ban, ChartArea, ChartBar, ChartColumn, ChartLine, ChartPie, ChartScatter, Columns3, PanelTop, Rows3, SquareFunction, Unlock } from "lucide-react";
import type { ReactNode } from "react";
import { useMessages } from "@/i18n/client";
import { sheetChromeText } from "@/i18n/messages/sheetChrome";
import { cn } from "@/lib/utils";
import { colName } from "@/sheet/a1";
import { SHEET_COLORS, sheetColor, sheetFill } from "@/sheet/colors";
import { FUNCTION_BY_EN } from "@/sheet/engine";
import { getCell, sheetById } from "@/sheet/ops";
import type { ChartKind, SheetColor } from "@/sheet/types";
import { insertChart } from "../chart/actions";
import { showSheetNotice } from "../notice";
import { useSheet, type SheetStore } from "../store";
import { autoSum, freezePanes, setBorders, setStyle, type BorderPreset, type SumFn } from "./actions";
import { Choice, keepFocus } from "./parts";

// ----------------------------------------------------------------------------------------------
// Colours

/** Text colour or fill: the palette (it follows dark mode), and "Automatisch" / "Keine Füllung". */
export function ColorPanel({ kind, current, onPick }: { kind: "color" | "fill"; current: SheetColor | undefined; onPick: (c: SheetColor | null) => void }) {
  const t = useMessages(sheetChromeText);
  return (
    <div className="w-[min(236px,calc(100vw-24px))] p-1" onMouseDown={keepFocus} role="group" aria-label={kind === "color" ? t.textColor : t.fillColor}>
      <button
        type="button"
        onClick={() => onPick(null)}
        aria-pressed={!current}
        className={cn(
          "mb-1.5 flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] transition-colors [@media(hover:none)]:h-10",
          !current ? "bg-blob-soft text-blob-ink" : "text-ink-2 hover:bg-hover hover:text-ink",
        )}
      >
        {kind === "color" ? (
          <span className="grid size-5 place-items-center rounded-full border border-line-2 text-[11px] font-semibold text-ink">A</span>
        ) : (
          <Ban className="size-4 text-ink-3" />
        )}
        {kind === "color" ? t.automatic : t.noFill}
      </button>
      <div className="grid grid-cols-5 gap-1">
        {SHEET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            aria-label={t.colors[c]}
            aria-pressed={current === c}
            data-tip={t.colors[c]}
            className="grid h-9 place-items-center rounded-lg transition-colors hover:bg-hover [@media(hover:none)]:h-11"
          >
            <span
              className={cn(
                "grid size-6 place-items-center border border-black/10 transition-[box-shadow,transform] dark:border-white/15",
                kind === "color" ? "rounded-full" : "rounded-md",
                current === c && "scale-110 shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--blob)]",
              )}
              style={{ background: kind === "color" ? sheetColor(c) : sheetFill(c) }}
            >
              {kind === "fill" && <span className="text-[11px] font-semibold" style={{ color: sheetColor(c) }}>A</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------------------------
// Borders

/** A little picture of a border preset: the cell grid in light lines, the preset's lines in ink. */
function BorderGlyph({ preset }: { preset: BorderPreset }) {
  const faint = "var(--line-2)";
  const ink = "currentColor";
  const lines: ReactNode[] = [];
  const line = (key: string, x1: number, y1: number, x2: number, y2: number, w = 1.6) => <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ink} strokeWidth={w} strokeLinecap="square" />;
  if (preset === "all") lines.push(line("t", 2, 2, 16, 2), line("b", 2, 16, 16, 16), line("l", 2, 2, 2, 16), line("r", 16, 2, 16, 16), line("h", 2, 9, 16, 9), line("v", 9, 2, 9, 16));
  if (preset === "outside" || preset === "thickOutside") {
    const w = preset === "outside" ? 1.6 : 2.8;
    lines.push(line("t", 2, 2, 16, 2, w), line("b", 2, 16, 16, 16, w), line("l", 2, 2, 2, 16, w), line("r", 16, 2, 16, 16, w));
  }
  if (preset === "bottom") lines.push(line("b", 2, 16, 16, 16));
  if (preset === "doubleBottom") lines.push(line("b1", 2, 14.2, 16, 14.2, 1.1), line("b2", 2, 16.6, 16, 16.6, 1.1));
  return (
    <svg viewBox="0 0 18 18" className="size-[18px]" aria-hidden>
      <rect x="2" y="2" width="14" height="14" fill="none" stroke={faint} strokeWidth="1" strokeDasharray="1.5 1.5" />
      <line x1="9" y1="2" x2="9" y2="16" stroke={faint} strokeWidth="1" strokeDasharray="1.5 1.5" />
      <line x1="2" y1="9" x2="16" y2="9" stroke={faint} strokeWidth="1" strokeDasharray="1.5 1.5" />
      {lines}
    </svg>
  );
}

const BORDERS: BorderPreset[] = ["all", "outside", "thickOutside", "bottom", "doubleBottom", "none"];

export function BorderPanel({ store, onDone }: { store: SheetStore; onDone: () => void }) {
  const t = useMessages(sheetChromeText);
  return (
    <div className="w-[min(260px,calc(100vw-24px))]" role="menu" aria-label={t.borders} onMouseDown={keepFocus}>
      {BORDERS.map((b) => (
        <Choice
          key={b}
          role="menuitem"
          icon={<BorderGlyph preset={b} />}
          label={t.borderKinds[b]}
          onSelect={() => {
            setBorders(store, b);
            onDone();
          }}
        />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------------------------
// Font size

export const SIZES = { small: 11, normal: 13, large: 16, huge: 20 } as const;

export function SizePanel({ store, onDone }: { store: SheetStore; onDone: () => void }) {
  const t = useMessages(sheetChromeText);
  const size = useSheet(store, (s) => getCell(s.workbook, s.sheetId, s.selection.anchor.row, s.selection.anchor.col)?.s?.size ?? SIZES.normal);
  return (
    <div className="w-[min(220px,calc(100vw-24px))]" role="menu" aria-label={t.fontSize} onMouseDown={keepFocus}>
      {(Object.keys(SIZES) as (keyof typeof SIZES)[]).map((k) => (
        <Choice
          key={k}
          label={<span style={{ fontSize: Math.min(SIZES[k], 18) }}>{t.sizes[k]}</span>}
          right={`${SIZES[k]} px`}
          checked={size === SIZES[k]}
          onSelect={() => {
            setStyle(store, { size: k === "normal" ? undefined : SIZES[k] });
            onDone();
          }}
        />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------------------------
// AutoSum

export const SUM_FNS: SumFn[] = ["SUM", "AVERAGE", "COUNT", "MAX", "MIN", "STDEV.S"];

export function SumPanel({ store, onDone, onMore }: { store: SheetStore; onDone: () => void; onMore: () => void }) {
  const t = useMessages(sheetChromeText);
  const locale = useSheet(store, (s) => s.locale);
  return (
    <div className="w-[min(270px,calc(100vw-24px))]" role="menu" aria-label={t.autoSumMenu} onMouseDown={keepFocus}>
      {SUM_FNS.map((fn) => {
        const info = FUNCTION_BY_EN.get(fn);
        return (
          <Choice
            key={fn}
            role="menuitem"
            label={t.sumFns[fn]}
            right={<span className="font-mono text-[12px]">{info ? (locale === "de" ? info.de : info.en) : fn}</span>}
            onSelect={() => {
              onDone();
              autoSum(store, fn);
            }}
          />
        );
      })}
      <div className="mx-1 my-1 h-px bg-line" />
      <Choice role="menuitem" icon={<SquareFunction />} label={t.moreFunctions} onSelect={onMore} />
    </div>
  );
}

// ----------------------------------------------------------------------------------------------
// Charts

export const CHART_KINDS: { kind: ChartKind; icon: ReactNode }[] = [
  { kind: "scatter", icon: <ChartScatter /> },
  { kind: "line", icon: <ChartLine /> },
  { kind: "column", icon: <ChartColumn /> },
  { kind: "bar", icon: <ChartBar /> },
  { kind: "area", icon: <ChartArea /> },
  { kind: "pie", icon: <ChartPie /> },
];

/** A chart from the selection; when there is nothing to chart, say how to pick the data. */
export function makeChart(store: SheetStore, kind?: ChartKind) {
  const t = sheetChromeText[store.get().locale];
  let made = false;
  try {
    made = insertChart(store, kind);
  } catch (err) {
    console.error("sheet: inserting a chart failed", err);
  }
  if (!made && !store.get().readOnly) showSheetNotice(store, t.chartNeedsData);
}

export function ChartPanel({ store, onDone }: { store: SheetStore; onDone: () => void }) {
  const t = useMessages(sheetChromeText);
  return (
    <div className="w-[min(300px,calc(100vw-24px))]" role="menu" aria-label={t.chartMenu} onMouseDown={keepFocus}>
      {CHART_KINDS.map(({ kind, icon }) => (
        <Choice
          key={kind}
          role="menuitem"
          icon={icon}
          label={t.chartKinds[kind]}
          hint={t.chartKindHints[kind]}
          onSelect={() => {
            onDone();
            makeChart(store, kind);
          }}
        />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------------------------
// Freezing

export function FreezePanel({ store, onDone }: { store: SheetStore; onDone: () => void }) {
  const t = useMessages(sheetChromeText);
  const freeze = useSheet(store, (s) => sheetById(s.workbook, s.sheetId)?.freeze);
  const anchor = useSheet(store, (s) => s.selection.anchor);
  const frozen = !!freeze && (freeze.rows > 0 || freeze.cols > 0);
  const here = t.freezeHere(anchor.row > 0 ? t.freezeRows(anchor.row) : "", anchor.col > 0 ? t.freezeCols(colName(anchor.col - 1)) : "");
  const run = (how: "row" | "col" | "here" | "none") => () => {
    freezePanes(store, how);
    onDone();
  };
  return (
    <div className="w-[min(290px,calc(100vw-24px))]" role="menu" aria-label={t.freeze} onMouseDown={keepFocus}>
      <Choice icon={<PanelTop />} label={t.freezeKinds.row} checked={freeze?.rows === 1 && freeze.cols === 0} onSelect={run("row")} />
      <Choice icon={<Columns3 />} label={t.freezeKinds.col} checked={freeze?.cols === 1 && freeze.rows === 0} onSelect={run("col")} />
      <Choice
        icon={<Rows3 />}
        label={t.freezeKinds.here}
        hint={anchor.row > 0 || anchor.col > 0 ? here : t.freezeNothing}
        disabled={anchor.row === 0 && anchor.col === 0}
        checked={!!freeze && frozen && freeze.rows === anchor.row && freeze.cols === anchor.col}
        onSelect={run("here")}
      />
      <div className="mx-1 my-1 h-px bg-line" />
      <Choice role="menuitem" icon={<Unlock />} label={t.freezeKinds.none} disabled={!frozen} onSelect={run("none")} />
    </div>
  );
}
