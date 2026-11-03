"use client";

// The spreadsheet's toolbar: undo, number formats and units, text style and colours, alignment,
// borders, AutoSum, smart tables, charts, sorting, freezing and find (the function library is the
// formula bar's fx right below, and in Σ's menu). Buttons show what the active cell has (bold
// pressed, its format's name); every one has a tooltip with its shortcut. "Tabelle" and
// "Diagramm", what students come for, carry their words when there is room; when the bar gets
// narrower they turn into icons first, then the least used groups move into "Mehr".
// Clicking a tool keeps the keyboard where it was (in the grid or the cell being typed in).
//
// CONTRACT: <Toolbar store={store} /> is placed by SheetEditor. Implemented by the editor chrome.
// Keep it mounted in read-only mode too: it answers the grid's Ctrl+F (find) and Ctrl+1 (formats).

import {
  ALargeSmall,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownAZ,
  ArrowDownZA,
  Bold,
  ChartScatter,
  ChevronDown,
  ChevronRight,
  DecimalsArrowLeft,
  DecimalsArrowRight,
  Ellipsis,
  Grid2x2,
  Hash,
  Italic,
  PaintBucket,
  Redo2,
  Ruler,
  Search,
  Sigma,
  Snowflake,
  Strikethrough,
  Table2,
  Underline,
  Undo2,
  WrapText,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref, type RefObject } from "react";
import { Popover } from "@/components/ui/Menu";
import { useIsMac, useTouch } from "@/components/ui/useMediaQuery";
import { useMessages } from "@/i18n/client";
import { sheetChromeText } from "@/i18n/messages/sheetChrome";
import { sheetColor } from "@/sheet/colors";
import { getCell, sheetById } from "@/sheet/ops";
import type { CellStyle, SheetColor } from "@/sheet/types";
import { SHEET_EVENT, type SheetEventDetail } from "../events";
import { useSheet, type SheetStore } from "../store";
import { makeTableFromSelection } from "../table/actions";
import { changeDecimals, insertFunction, setStyle, sortSelection, toggleStyle, autoSum } from "./actions";
import { FindReplace } from "./FindReplace";
import { FunctionBrowser } from "./FunctionBrowser";
import { FormatPanel, UnitPanel } from "./NumberFormatMenu";
import { Choice, Divider, focusGrid, HoverTips, keepFocus, PanelHeader, SplitButton, ToolButton, useKeys } from "./parts";
import { BorderPanel, ChartPanel, ColorPanel, FreezePanel, SizePanel, SumPanel, makeChart } from "./ToolbarPanels";

// ----------------------------------------------------------------------------------------------
// Which groups fit

export type GroupId = "history" | "format" | "decimals" | "bold" | "styles" | "colors" | "align" | "borders" | "size" | "sum" | "table" | "chart" | "sort" | "freeze" | "find";

/** Left to right. */
const ORDER: GroupId[] = ["history", "format", "decimals", "bold", "styles", "colors", "align", "borders", "size", "sum", "table", "chart", "sort", "freeze", "find"];
/** Most needed first: what a narrow screen keeps on the bar. */
const PRIORITY: GroupId[] = ["history", "sum", "table", "chart", "format", "bold", "colors", "decimals", "styles", "align", "borders", "sort", "find", "size", "freeze"];
/** Groups in the same section sit together; sections have a divider between them. */
const SECTION: Record<GroupId, number> = { history: 0, format: 1, decimals: 1, bold: 2, styles: 2, colors: 2, align: 3, borders: 3, size: 3, sum: 4, table: 4, chart: 4, sort: 5, freeze: 5, find: 6 };

/**
 * How much wider "Tabelle" and "Diagramm" get with their words, from the words' own widths (13 px
 * text): the words plus the gap between icon and word in each button. Measured in the app: 1030 px
 * of content with icons, 1144 px with the words (106 px), and the estimate above is 2 px generous.
 */
export const labelRoom = (words: number) => Math.ceil(words) + 8;

function groupWidth(g: GroupId, u: number, split: number, fmt: number): number {
  switch (g) {
    case "history":
    case "sort":
    case "bold":
    case "styles":
      return 2 * u;
    case "format":
      return fmt;
    case "decimals":
      return 3 * u;
    case "align":
      return 4 * u;
    case "colors":
      return 2 * split;
    case "sum":
    case "chart":
      return split;
    default:
      return u;
  }
}

/**
 * Which groups fit into `width` px (the bar's inside), the most needed first; whether "Tabelle"
 * and "Diagramm" get their words too (`labelExtra` px more: only when everything else fits, so
 * they turn into icons before any group has to move into "Mehr"); and whether the number format
 * button is just an icon (narrow bars).
 */
export function toolbarLayout(width: number, touch: boolean, labelExtra = labelRoom(16 * 8)): { shown: Set<GroupId>; labels: boolean; compact: boolean } {
  const u = touch ? 38 : 34;
  const split = u + (touch ? 20 : 16);
  const compact = width < 560;
  const fmt = compact ? u : touch ? 120 : 110;
  const divider = 7;
  const total = (set: Set<GroupId>) => {
    let w = 0;
    const sections = new Set<number>();
    for (const g of set) {
      w += groupWidth(g, u, split, fmt);
      sections.add(SECTION[g]);
    }
    return w + Math.max(0, sections.size - 1) * divider;
  };
  const shown = new Set<GroupId>();
  for (const g of PRIORITY) {
    shown.add(g);
    const more = shown.size < PRIORITY.length ? u + divider : 0;
    if (shown.size > 1 && total(shown) + more > width) {
      shown.delete(g);
      break;
    }
  }
  const labels = shown.size === PRIORITY.length && total(shown) + labelExtra <= width;
  return { shown, labels, compact };
}

let measureCanvas: HTMLCanvasElement | null = null;

/** The width of the toolbar's words for "Tabelle" and "Diagramm", in its own font. */
function wordsWidth(el: HTMLElement, words: string[]): number {
  measureCanvas ??= document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) return words.join("").length * 8;
  ctx.font = `500 13px ${getComputedStyle(el).fontFamily}`;
  return words.reduce((sum, w) => sum + ctx.measureText(w).width, 0);
}

/** The bar's inside width, and how much room the words of "Tabelle" and "Diagramm" need (0 until measured). */
function useRoom(ref: RefObject<HTMLElement | null>, words: string[]): { width: number; words: number } {
  const [room, setRoom] = useState({ width: 0, words: 0 });
  const key = words.join("\n");
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const list = key.split("\n");
    const ro = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      const w = Math.ceil(wordsWidth(el, list));
      setRoom((old) => (old.width === width && old.words === w ? old : { width, words: w }));
    });
    ro.observe(el);
    // Web fonts arriving later change the words' width.
    const fonts = document.fonts;
    const again = () => setRoom((old) => ({ ...old, words: Math.ceil(wordsWidth(el, list)) }));
    fonts?.addEventListener("loadingdone", again);
    return () => {
      ro.disconnect();
      fonts?.removeEventListener("loadingdone", again);
    };
  }, [ref, key]);
  return room;
}

/** An action of another part of the editor (smart tables); a failure there is logged, never breaks the toolbar. */
function safely(what: string, action: () => unknown) {
  try {
    action();
  } catch (err) {
    console.error(`sheet: ${what} failed`, err);
  }
}

// ----------------------------------------------------------------------------------------------

type PanelId = "format" | "unit" | "color" | "fill" | "borders" | "size" | "sum" | "chart" | "freeze";
type Anchor = PanelId | "more";
type View = PanelId | "list";

/** "A" with a bar of the colour under it (the text colour button). */
function TextColorGlyph({ color }: { color: SheetColor }) {
  return (
    <span className="flex flex-col items-center leading-none" aria-hidden>
      <span className="text-[15px] font-semibold">A</span>
      <span className="mt-[1px] h-[3px] w-[15px] rounded-full" style={{ background: sheetColor(color) }} />
    </span>
  );
}

function FillGlyph({ color }: { color: SheetColor }) {
  return (
    <span className="flex flex-col items-center leading-none" aria-hidden>
      <PaintBucket className="!size-[15px]" />
      <span className="mt-[2px] h-[3px] w-[15px] rounded-full" style={{ background: sheetColor(color) }} />
    </span>
  );
}

export function Toolbar({ store }: { store: SheetStore }): ReactNode {
  const t = useMessages(sheetChromeText);
  const keys = useKeys();
  const mac = useIsMac();
  const touch = useTouch();
  const readOnly = useSheet(store, (s) => s.readOnly);
  const canUndo = useSheet(store, (s) => s.canUndo);
  const canRedo = useSheet(store, (s) => s.canRedo);
  const undoLabel = useSheet(store, (s) => s.undoLabel);
  const redoLabel = useSheet(store, (s) => s.redoLabel);
  const style: CellStyle | undefined = useSheet(store, (s) => getCell(s.workbook, s.sheetId, s.selection.anchor.row, s.selection.anchor.col)?.s);
  const frozen = useSheet(store, (s) => {
    const f = sheetById(s.workbook, s.sheetId)?.freeze;
    return !!f && (f.rows > 0 || f.cols > 0);
  });

  const [open, setOpen] = useState<Anchor | null>(null);
  // What the open popover shows: its own panel, the "Mehr" list, or a panel opened from there. It
  // stays after closing, so the popover keeps its content while it fades out.
  const [panel, setPanel] = useState<{ anchor: Anchor; stack: View[] }>({ anchor: "more", stack: [] });
  const [lastColor, setLastColor] = useState<SheetColor>("red");
  const [lastFill, setLastFill] = useState<SheetColor>("yellow");
  // The find panel: open, a counter that gives its field the keyboard again (Ctrl+F twice), and
  // whether it opens with the replace row (Ctrl+H) or without (Ctrl+F, the button).
  const [find, setFind] = useState({ open: false, nonce: 0, replace: false });
  const [functionsOpen, setFunctionsOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const room = useRoom(root, [t.tableShort, t.chart]);
  const { shown, labels, compact } = toolbarLayout(room.width || 1280, touch, room.words ? labelRoom(room.words) : undefined);
  const overflow = ORDER.filter((g) => !shown.has(g));

  /**
   * Where the keyboard was when a panel opened with the mouse, pen or a finger (the grid, the cell
   * being typed in): it goes back there when the panel closes, also after Escape (which would
   * otherwise leave it on the toolbar button). Opened from the keyboard, it stays on the button.
   */
  const restoreTo = useRef<HTMLElement | null>(null);
  const close = () => {
    setOpen(null);
    const back = restoreTo.current;
    restoreTo.current = null;
    if (!back) return;
    requestAnimationFrame(() => {
      const at = document.activeElement;
      if (back.isConnected && (!at || at === document.body || root.current?.contains(at))) back.focus({ preventScroll: true });
    });
  };
  const show = (anchor: Anchor, stack: View[] = [anchor === "more" ? "list" : anchor]) => {
    setOpen(anchor);
    setPanel({ anchor, stack });
  };
  const toggle = (anchor: Anchor, e?: { detail: number }) => {
    if (open === anchor) {
      close();
      return;
    }
    const at = document.activeElement;
    restoreTo.current = e && e.detail > 0 && at instanceof HTMLElement && !root.current?.contains(at) ? at : null;
    show(anchor);
  };
  const push = (v: View) => setPanel((p) => ({ ...p, stack: [...p.stack, v] }));
  const back = () => setPanel((p) => ({ ...p, stack: p.stack.length > 1 ? p.stack.slice(0, -1) : p.stack }));

  // The grid's Ctrl+F opens find here, Ctrl+1 the number formats (in "Mehr" when they're tucked away there).
  const formatOnBar = useRef(true);
  useEffect(() => {
    formatOnBar.current = shown.has("format");
  });
  useEffect(() => {
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<SheetEventDetail>).detail;
      if (detail?.open === "find" || detail?.open === "replace") setFind((f) => ({ open: true, nonce: f.nonce + 1, replace: detail.open === "replace" }));
      else if (detail?.open === "format" && !store.get().readOnly) {
        const anchor: Anchor = formatOnBar.current ? "format" : "more";
        // Opened from the grid (Ctrl+1): the keyboard goes back to the grid afterwards.
        const at = document.activeElement;
        restoreTo.current = at instanceof HTMLElement && at !== document.body && !root.current?.contains(at) ? at : null;
        setOpen(anchor);
        setPanel({ anchor, stack: anchor === "format" ? ["format"] : ["list", "format"] });
      }
    };
    window.addEventListener(SHEET_EVENT, onEvent);
    return () => window.removeEventListener(SHEET_EVENT, onEvent);
  }, [store]);

  const pickColor = (kind: "color" | "fill", c: SheetColor | null) => {
    if (kind === "color") {
      setStyle(store, { color: c ?? undefined });
      if (c) setLastColor(c);
    } else {
      setStyle(store, { fill: c ?? undefined });
      if (c) setLastFill(c);
    }
    close();
  };

  const titles: Record<PanelId, string> = {
    format: t.numberFormat,
    unit: t.unit,
    color: t.textColor,
    fill: t.fillColor,
    borders: t.borders,
    size: t.fontSize,
    sum: t.autoSumMenu,
    chart: t.chartMenu,
    freeze: t.freeze,
  };

  const viewContent = (v: PanelId): ReactNode => {
    switch (v) {
      case "format":
        return <FormatPanel store={store} onDone={close} onUnit={() => push("unit")} />;
      case "unit":
        return <UnitPanel store={store} onDone={close} />;
      case "color":
        return <ColorPanel kind="color" current={style?.color} onPick={(c) => pickColor("color", c)} />;
      case "fill":
        return <ColorPanel kind="fill" current={style?.fill} onPick={(c) => pickColor("fill", c)} />;
      case "borders":
        return <BorderPanel store={store} onDone={close} />;
      case "size":
        return <SizePanel store={store} onDone={close} />;
      case "sum":
        return (
          <SumPanel
            store={store}
            onDone={close}
            onMore={() => {
              close();
              setFunctionsOpen(true);
            }}
          />
        );
      case "chart":
        return <ChartPanel store={store} onDone={close} />;
      case "freeze":
        return <FreezePanel store={store} onDone={close} />;
    }
  };

  /** What a popover shows: its panel, the "Mehr" list, or a panel opened from either (with a way back). */
  const popoverContent = (): ReactNode => {
    const { stack } = panel;
    const v = stack[stack.length - 1];
    if (!v) return null;
    if (v === "list") return moreList();
    return (
      <div onMouseDown={keepFocus}>
        {stack.length > 1 && <PanelHeader title={titles[v]} onBack={back} backLabel={t.back} />}
        {viewContent(v)}
      </div>
    );
  };

  const popover = (anchor: Anchor, trigger: (ref: Ref<HTMLButtonElement>) => ReactNode, align: "start" | "end" = "start") => (
    <Popover
      open={open === anchor}
      onOpenChange={(v) => (v ? show(anchor) : close())}
      align={align}
      role="dialog"
      label={anchor === "more" ? t.more : titles[anchor]}
      className="p-1.5"
      trigger={({ ref }) => trigger(ref)}
    >
      {panel.anchor === anchor ? popoverContent() : null}
    </Popover>
  );

  const fmtKind = style?.fmt?.kind ?? "general";
  const off = readOnly;

  // ---- the groups, as buttons on the bar

  const bar = (g: GroupId): ReactNode => {
    switch (g) {
      case "history":
        return (
          <>
            <ToolButton label={undoLabel ? t.undoWhat(undoLabel) : t.undo} keys={keys("Mod+Z")} shortcut="Mod+Z" disabled={off || !canUndo} onClick={() => store.undo()}>
              <Undo2 />
            </ToolButton>
            <ToolButton
              label={redoLabel ? t.redoWhat(redoLabel) : t.redo}
              keys={keys(mac ? "Mod+Shift+Z" : "Mod+Y")}
              shortcut={mac ? "Mod+Shift+Z" : "Mod+Y"}
              disabled={off || !canRedo}
              onClick={() => store.redo()}
            >
              <Redo2 />
            </ToolButton>
          </>
        );
      case "format":
        return popover("format", (ref) => (
          <ToolButton
            buttonRef={ref}
            label={t.numberFormat}
            tip={`${t.numberFormat}: ${t.formatShort[fmtKind]}`}
            keys={keys("Mod+1")}
            shortcut="Mod+1"
            popup="dialog"
            expanded={open === "format"}
            disabled={off}
            onClick={(e) => toggle("format", e)}
            className={compact ? undefined : "w-[108px] justify-between px-2 [@media(hover:none)]:w-[116px]"}
          >
            {compact ? (
              <Hash />
            ) : (
              <>
                <span className="truncate">{t.formatShort[fmtKind]}</span>
                <ChevronDown className="!size-3.5 text-ink-3" />
              </>
            )}
          </ToolButton>
        ));
      case "decimals":
        return (
          <>
            <ToolButton label={t.fewerDecimals} disabled={off} onClick={() => changeDecimals(store, -1)}>
              <DecimalsArrowLeft />
            </ToolButton>
            <ToolButton label={t.moreDecimals} disabled={off} onClick={() => changeDecimals(store, 1)}>
              <DecimalsArrowRight />
            </ToolButton>
            {popover("unit", (ref) => (
              <ToolButton buttonRef={ref} label={t.unitTitle} popup="dialog" expanded={open === "unit"} disabled={off} onClick={(e) => toggle("unit", e)}>
                <Ruler />
              </ToolButton>
            ))}
          </>
        );
      case "bold":
        return (
          <>
            <ToolButton label={t.bold} keys={keys("Mod+B")} shortcut="Mod+B" pressed={!!style?.bold} disabled={off} onClick={() => toggleStyle(store, "bold")}>
              <Bold />
            </ToolButton>
            <ToolButton label={t.italic} keys={keys("Mod+I")} shortcut="Mod+I" pressed={!!style?.italic} disabled={off} onClick={() => toggleStyle(store, "italic")}>
              <Italic />
            </ToolButton>
          </>
        );
      case "styles":
        return (
          <>
            <ToolButton label={t.underline} keys={keys("Mod+U")} shortcut="Mod+U" pressed={!!style?.underline} disabled={off} onClick={() => toggleStyle(store, "underline")}>
              <Underline />
            </ToolButton>
            <ToolButton label={t.strike} keys={keys("Mod+5")} shortcut="Mod+5" pressed={!!style?.strike} disabled={off} onClick={() => toggleStyle(store, "strike")}>
              <Strikethrough />
            </ToolButton>
          </>
        );
      case "colors":
        return (
          <>
            {popover("color", (ref) => (
              <SplitButton
                label={t.applyColor(t.colors[lastColor])}
                tip={`${t.textColor}: ${t.colors[lastColor]}`}
                menuLabel={t.textColor}
                onClick={() => setStyle(store, { color: lastColor })}
                expanded={open === "color"}
                onMenu={(e) => toggle("color", e)}
                menuRef={ref}
                disabled={off}
              >
                <TextColorGlyph color={lastColor} />
              </SplitButton>
            ))}
            {popover("fill", (ref) => (
              <SplitButton
                label={t.applyColor(t.colors[lastFill])}
                tip={`${t.fillColor}: ${t.colors[lastFill]}`}
                menuLabel={t.fillColor}
                onClick={() => setStyle(store, { fill: lastFill })}
                expanded={open === "fill"}
                onMenu={(e) => toggle("fill", e)}
                menuRef={ref}
                disabled={off}
              >
                <FillGlyph color={lastFill} />
              </SplitButton>
            ))}
          </>
        );
      case "align":
        return (
          <>
            {(["left", "center", "right"] as const).map((a) => (
              <ToolButton key={a} label={t.align[a]} pressed={style?.align === a} disabled={off} onClick={() => setStyle(store, { align: style?.align === a ? undefined : a })}>
                {a === "left" ? <AlignLeft /> : a === "center" ? <AlignCenter /> : <AlignRight />}
              </ToolButton>
            ))}
            <ToolButton label={t.wrap} pressed={!!style?.wrap} disabled={off} onClick={() => toggleStyle(store, "wrap")}>
              <WrapText />
            </ToolButton>
          </>
        );
      case "borders":
        return popover("borders", (ref) => (
          <ToolButton buttonRef={ref} label={t.borders} popup="menu" expanded={open === "borders"} disabled={off} onClick={(e) => toggle("borders", e)}>
            <Grid2x2 />
          </ToolButton>
        ));
      case "size":
        return popover("size", (ref) => (
          <ToolButton buttonRef={ref} label={t.fontSize} popup="menu" expanded={open === "size"} disabled={off} onClick={(e) => toggle("size", e)}>
            <ALargeSmall />
          </ToolButton>
        ));
      case "sum":
        return popover("sum", (ref) => (
          <SplitButton
            label={t.autoSum}
            tip={`${t.autoSum}: ${t.autoSumTip}`}
            keys={keys("Alt+=")}
            shortcut="Alt+="
            menuLabel={t.autoSumMenu}
            onClick={() => autoSum(store)}
            expanded={open === "sum"}
            onMenu={(e) => toggle("sum", e)}
            menuRef={ref}
            disabled={off}
          >
            <Sigma />
          </SplitButton>
        ));
      case "table":
        return (
          <ToolButton label={t.table} tip={t.tableTip} keys={keys("Mod+T")} shortcut="Mod+T" disabled={off} onClick={() => safely("making a smart table", () => makeTableFromSelection(store))} className={labels ? "px-2" : undefined}>
            <Table2 />
            {labels && <span>{t.tableShort}</span>}
          </ToolButton>
        );
      case "chart":
        return popover("chart", (ref) => (
          <SplitButton
            label={t.chart}
            tip={t.chartTip}
            keys={keys("Alt+F1")}
            shortcut="Alt+F1"
            menuLabel={t.chartMenu}
            onClick={() => makeChart(store)}
            expanded={open === "chart"}
            onMenu={(e) => toggle("chart", e)}
            menuRef={ref}
            disabled={off}
          >
            <ChartScatter />
            {labels && <span>{t.chart}</span>}
          </SplitButton>
        ));
      case "sort":
        return (
          <>
            <ToolButton label={t.sortAsc} disabled={off} onClick={() => sortSelection(store, "asc")}>
              <ArrowDownAZ />
            </ToolButton>
            <ToolButton label={t.sortDesc} disabled={off} onClick={() => sortSelection(store, "desc")}>
              <ArrowDownZA />
            </ToolButton>
          </>
        );
      case "freeze":
        return popover("freeze", (ref) => (
          <ToolButton buttonRef={ref} label={t.freeze} popup="menu" pressed={frozen} expanded={open === "freeze"} disabled={off} onClick={(e) => toggle("freeze", e)}>
            <Snowflake />
          </ToolButton>
        ));
      case "find":
        return (
          <ToolButton
            label={t.find}
            keys={keys("Mod+F")}
            shortcut="Mod+F"
            pressed={find.open}
            onClick={() => {
              if (find.open) focusGrid();
              setFind((f) => ({ open: !f.open, nonce: f.nonce + 1, replace: false }));
            }}
          >
            <Search />
          </ToolButton>
        );
    }
  };

  // ---- the same groups as entries of "Mehr"

  const iconRow = (children: ReactNode) => <div className="flex flex-wrap items-center gap-0.5 px-1 py-0.5">{children}</div>;
  const drill = (icon: ReactNode, label: string, v: PanelId, right?: string) => (
    <Choice role="menuitem" icon={icon} label={label} right={right ?? <ChevronRight className="inline !size-3.5" />} onSelect={() => push(v)} disabled={off} />
  );
  const run = (icon: ReactNode, label: string, action: () => void, disabled = off) => (
    <Choice
      role="menuitem"
      icon={icon}
      label={label}
      disabled={disabled}
      onSelect={() => {
        close();
        action();
      }}
    />
  );

  const entry = (g: GroupId): ReactNode => {
    switch (g) {
      case "history":
        return null;
      case "format":
        return drill(<Hash />, t.numberFormat, "format", t.formatShort[fmtKind]);
      case "decimals":
        return (
          <>
            {iconRow(
              <>
                <ToolButton label={t.fewerDecimals} disabled={off} onClick={() => changeDecimals(store, -1)}>
                  <DecimalsArrowLeft />
                </ToolButton>
                <ToolButton label={t.moreDecimals} disabled={off} onClick={() => changeDecimals(store, 1)}>
                  <DecimalsArrowRight />
                </ToolButton>
              </>,
            )}
            {drill(<Ruler />, t.unitMenu, "unit")}
          </>
        );
      case "colors":
        return (
          <>
            {drill(<TextColorGlyph color={style?.color ?? lastColor} />, t.textColor, "color")}
            {drill(<FillGlyph color={style?.fill ?? lastFill} />, t.fillColor, "fill")}
          </>
        );
      case "borders":
        return drill(<Grid2x2 />, t.borders, "borders");
      case "size":
        return drill(<ALargeSmall />, t.fontSize, "size");
      case "sum":
        return drill(<Sigma />, t.autoSum, "sum");
      case "table":
        return run(<Table2 />, t.table, () => safely("making a smart table", () => makeTableFromSelection(store)));
      case "chart":
        return drill(<ChartScatter />, t.chart, "chart");
      case "sort":
        return (
          <>
            {run(<ArrowDownAZ />, t.sortAsc, () => sortSelection(store, "asc"))}
            {run(<ArrowDownZA />, t.sortDesc, () => sortSelection(store, "desc"))}
          </>
        );
      case "freeze":
        return drill(<Snowflake />, t.freeze, "freeze");
      case "find":
        return run(<Search />, t.find, () => setFind((f) => ({ open: true, nonce: f.nonce + 1, replace: false })), false);
      case "bold":
        // B I and U S share one row when both are tucked away.
        return iconRow(
          <>
            {bar("bold")}
            {overflow.includes("styles") && bar("styles")}
          </>,
        );
      case "styles":
        return overflow.includes("bold") ? null : iconRow(bar("styles"));
      default:
        // Rows of toggles: alignment.
        return iconRow(bar(g));
    }
  };

  const moreList = () => {
    let section = -1;
    return (
      <div className="max-h-[min(70vh,560px)] w-[min(280px,calc(100vw-24px))] overflow-y-auto overscroll-contain" role="menu" aria-label={t.more} onMouseDown={keepFocus}>
        {overflow.map((g) => {
          const sep = section >= 0 && SECTION[g] !== section;
          section = SECTION[g];
          return (
            <Fragment key={g}>
              {sep && <div className="mx-1 my-1 h-px bg-line" />}
              {entry(g)}
            </Fragment>
          );
        })}
      </div>
    );
  };

  // ---- the bar

  const items: ReactNode[] = [];
  let lastSection = -1;
  for (const g of ORDER) {
    if (!shown.has(g)) continue;
    if (lastSection >= 0 && SECTION[g] !== lastSection) items.push(<Divider key={`d-${g}`} />);
    lastSection = SECTION[g];
    items.push(<Fragment key={g}>{bar(g)}</Fragment>);
  }

  /** Arrow keys move between the tools (Home and End to the ends), like a toolbar should. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const buttons = [...(root.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <>
      <div
        ref={root}
        role="toolbar"
        aria-label={t.toolbar}
        aria-orientation="horizontal"
        onMouseDown={keepFocus}
        onKeyDown={onKeyDown}
        className="flex min-w-0 items-center gap-0.5 overflow-hidden rounded-xl border border-line bg-raised px-1.5 py-1 shadow-card"
      >
        {items}
        {overflow.length > 0 && (
          <>
            <Divider />
            {popover(
              "more",
              (ref) => (
                <ToolButton buttonRef={ref} label={t.more} popup="menu" expanded={open === "more"} onClick={(e) => toggle("more", e)}>
                  <Ellipsis />
                </ToolButton>
              ),
              "end",
            )}
          </>
        )}
      </div>
      <HoverTips />
      <FindReplace store={store} open={find.open} focusNonce={find.nonce} withReplace={find.replace} onClose={() => setFind((f) => ({ ...f, open: false }))} anchor={root} />
      <FunctionBrowser
        open={functionsOpen}
        onClose={() => setFunctionsOpen(false)}
        canInsert={!readOnly}
        onPick={(fn) => {
          setFunctionsOpen(false);
          insertFunction(store, fn);
        }}
      />
    </>
  );
}
