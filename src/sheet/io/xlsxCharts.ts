// Charts between Blob and .xlsx files (DrawingML charts, ECMA-376 part 1 §21.2). A Blob chart
// becomes an Excel chart that reads the same cells: scatter, line, column, bar, area or pie, with
// its colours, markers, trendlines (with equation and R², a fixed intercept, forecasts), error
// bars, axis titles, ranges, logarithmic axes, grid lines and legend; it floats where it floated.
// Excel charts come back the same way, as far as Blob draws them.
//
// Elements are written in the order the schema prescribes (Excel refuses a file otherwise).

import type { Locale } from "@/i18n/config";
import { quoteSheetName } from "../a1";
import { chartData } from "../chart/data";
import { EQUATION_DIGITS, r2Decimals } from "../chart/format";
import { isFitError, type Fit, type FitError } from "../chart/regression";
import { COLOR_HEX } from "../colors";
import { isError, type Calc } from "../engine";
import { newId } from "../ops";
import type { AxisSpec, ChartKind, ChartSpec, ErrorBarSpec, RangeRef, SeriesSpec, SheetColor, TrendlineSpec } from "../types";
import { attr, boolAttr, child, children, descendants, escAttr, escText, lookup, numAttr, textOf, XML_HEAD, type XmlEl } from "./xml";
import { nearestSheetColor } from "./xlsxStyles";

const NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_XDR = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
/** English Metric Units per CSS pixel (96 dpi). */
export const EMU = 9525;

const SERIES_PALETTE: SheetColor[] = ["blue", "orange", "green", "purple", "red", "teal", "pink", "brown", "yellow", "gray"];
const hex = (c: SheetColor) => COLOR_HEX[c].light.replace("#", "").toUpperCase();

function colLetters(col: number): string {
  let s = "";
  let n = col + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** A range as a chart formula: 'Blatt 1'!$B$2:$B$9. */
function refFormula(ref: RangeRef, sheetName: (id: string) => string | undefined): string | null {
  const name = sheetName(ref.sheetId);
  if (!name) return null;
  const a = `$${colLetters(ref.c0)}$${ref.r0 + 1}`;
  const b = `$${colLetters(ref.c1)}$${ref.r1 + 1}`;
  return `${quoteSheetName(name)}!${a === b ? a : `${a}:${b}`}`;
}

/** Rich text for titles. */
const rich = (text: string, size = 1200, bold = false) =>
  `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="${bold ? 1 : 0}"/></a:pPr><a:r><a:rPr lang="de-DE" sz="${size}" b="${bold ? 1 : 0}"/><a:t>${escText(text)}</a:t></a:r></a:p></c:rich></c:tx>`;

const title = (text: string, size = 1200, bold = false) => `<c:title>${rich(text, size, bold)}<c:overlay val="0"/></c:title>`;

function numCache(calc: Calc, ref: RangeRef): string {
  const values = calc.values(ref).flat();
  const pts = values
    .map((v, i) => (typeof v === "number" && Number.isFinite(v) ? `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>` : ""))
    .join("");
  return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numCache>`;
}

function strCache(calc: Calc, ref: RangeRef): string {
  const values = calc.values(ref).flat();
  const pts = values
    .map((v, i) => (v === null || isError(v) ? "" : `<c:pt idx="${i}"><c:v>${escText(String(v))}</c:v></c:pt>`))
    .join("");
  return `<c:strCache><c:ptCount val="${values.length}"/>${pts}</c:strCache>`;
}

/** Values from a range, as numbers when all of them are (else as text: category labels). */
function dataRef(tag: "xVal" | "yVal" | "cat" | "val" | "plus" | "minus", ref: RangeRef, f: string, calc: Calc): string {
  const numeric = calc
    .values(ref)
    .flat()
    .every((v) => v === null || typeof v === "number");
  if (tag === "yVal" || tag === "val" || tag === "plus" || tag === "minus" || numeric) return `<c:${tag}><c:numRef><c:f>${escText(f)}</c:f>${numCache(calc, ref)}</c:numRef></c:${tag}>`;
  return `<c:${tag}><c:strRef><c:f>${escText(f)}</c:f>${strCache(calc, ref)}</c:strRef></c:${tag}>`;
}

const TREND_TYPE: Record<TrendlineSpec["type"], string> = { linear: "linear", polynomial: "poly", exponential: "exp", logarithmic: "log", power: "power", movingAverage: "movingAvg" };

/**
 * The number format of a trendline's label (equation and R²), by the rule of Blob's own chart
 * label: every coefficient keeps at least EQUATION_DIGITS (4) significant digits, so Excel shows
 * the same equation as Blob, to those digits. Excel has one format for the whole label: decimals
 * for 4 significant digits of the smallest coefficient, trailing zeros left out
 * ("y = 0,0009463x + 0,0254368", "R² = 0,999786"), or scientific with 4 significant digits when a
 * coefficient is below 0,00001 or from 10 million on (Blob's label writes single coefficients
 * from 0,0001 down scientific; a whole Excel label in scientific notation reads worse than one
 * small number with decimals). When R² is shown it also gets the decimals it needs not to round
 * up to 1 (0,99997 would read "R² = 1,0" with four), as Blob's own chart label does.
 */
export function trendLabelFormat(fit: Fit | FitError | null | undefined, showR2 = true): string {
  if (!fit || isFitError(fit)) return "General";
  const cs = fit.coefficients.filter((c) => Number.isFinite(c) && c !== 0).map(Math.abs);
  const r2 = showR2 && fit.r2 !== null && Number.isFinite(fit.r2) ? r2Decimals(fit.r2, 4, 8) : 4;
  if (cs.some((c) => c < 1e-5 || c >= 1e7)) return `0.${"0".repeat(Math.max(EQUATION_DIGITS - 1, r2 - 1))}E+00`;
  const needed = cs.length ? Math.max(...cs.map((c) => EQUATION_DIGITS - 1 - Math.floor(Math.log10(c)))) : 4;
  const decimals = Math.max(4, r2, Math.min(8, needed));
  return `0.0${"#".repeat(decimals - 1)}`;
}

function trendlineXml(tl: TrendlineSpec, color: string, labelFormat: string): string {
  let x = "<c:trendline>";
  if (tl.name.trim()) x += `<c:name>${escText(tl.name.trim())}</c:name>`;
  x += `<c:spPr><a:ln w="19050" cap="rnd"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:prstDash val="sysDash"/></a:ln></c:spPr>`;
  x += `<c:trendlineType val="${TREND_TYPE[tl.type]}"/>`;
  if (tl.type === "polynomial") x += `<c:order val="${Math.max(2, Math.min(6, Math.round(tl.order)))}"/>`;
  if (tl.type === "movingAverage") x += `<c:period val="${Math.max(2, Math.round(tl.period))}"/>`;
  if (tl.type === "movingAverage") {
    // A moving average has no equation or R² (readers that assume them otherwise show an empty label).
    x += '<c:dispRSqr val="0"/><c:dispEq val="0"/>';
  } else {
    if (tl.forward > 0) x += `<c:forward val="${tl.forward}"/>`;
    if (tl.backward > 0) x += `<c:backward val="${tl.backward}"/>`;
    // An exponential curve's a has to be above 0 (Blob fits it freely otherwise, see regression.ts):
    // a 0 left over from "through the origin" would give Excel a curve it can't draw.
    if (tl.intercept !== null && Number.isFinite(tl.intercept) && (tl.type === "linear" || tl.type === "polynomial" || (tl.type === "exponential" && tl.intercept > 0))) x += `<c:intercept val="${tl.intercept}"/>`;
    // Excel's label has the equation and R² only: Blob's zero crossing (showZero) is left out.
    x += `<c:dispRSqr val="${tl.showR2 ? 1 : 0}"/><c:dispEq val="${tl.showEquation ? 1 : 0}"/>`;
    if (tl.showR2 || tl.showEquation) x += `<c:trendlineLbl><c:numFmt formatCode="${escAttr(labelFormat)}" sourceLinked="0"/></c:trendlineLbl>`;
  }
  return `${x}</c:trendline>`;
}

const ERR_TYPE: Record<ErrorBarSpec["kind"], string> = { fixed: "fixedVal", percent: "percentage", stdev: "stdDev", stderr: "stdErr", custom: "cust" };

function errBarsXml(eb: ErrorBarSpec, scatter: boolean, color: string, calc: Calc, sheetName: (id: string) => string | undefined): string {
  let x = "<c:errBars>";
  if (scatter) x += '<c:errDir val="y"/>';
  x += `<c:errBarType val="${eb.direction}"/><c:errValType val="${ERR_TYPE[eb.kind]}"/><c:noEndCap val="0"/>`;
  if (eb.kind === "custom") {
    const plus = eb.plus ? refFormula(eb.plus, sheetName) : null;
    const minus = eb.minus ? refFormula(eb.minus, sheetName) : plus;
    const minusRef = eb.minus ?? eb.plus;
    if (plus && eb.plus) x += dataRef("plus", eb.plus, plus, calc);
    if (minus && minusRef) x += dataRef("minus", minusRef, minus, calc);
  } else if (eb.kind !== "stderr") x += `<c:val val="${Number.isFinite(eb.value) ? Math.abs(eb.value) : 0}"/>`;
  // A line of their own: without one, readers give them the series' (none, for points without a line).
  x += `<c:spPr><a:ln w="12700" cap="flat"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:round/></a:ln></c:spPr>`;
  return `${x}</c:errBars>`;
}

function axisXml(kind: "val" | "cat", id: number, cross: number, pos: "b" | "l", axis: AxisSpec, opts: { scatterX?: boolean; between?: "midCat" | "between" }): string {
  const tag = kind === "val" ? "valAx" : "catAx";
  let scaling = "<c:scaling>";
  if (kind === "val" && axis.log) scaling += '<c:logBase val="10"/>';
  scaling += '<c:orientation val="minMax"/>';
  if (kind === "val" && axis.max !== null && Number.isFinite(axis.max)) scaling += `<c:max val="${axis.max}"/>`;
  if (kind === "val" && axis.min !== null && Number.isFinite(axis.min)) scaling += `<c:min val="${axis.min}"/>`;
  scaling += "</c:scaling>";
  let x = `<c:${tag}><c:axId val="${id}"/>${scaling}<c:delete val="0"/><c:axPos val="${pos}"/>`;
  if (axis.grid) x += '<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E6E4DC"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>';
  if (axis.title.trim()) x += title(axis.title.trim(), 1000, false);
  const fmt = kind === "val" && axis.decimals !== null && axis.decimals >= 0 ? `0${axis.decimals > 0 ? `.${"0".repeat(Math.min(15, axis.decimals))}` : ""}` : "General";
  x += `<c:numFmt formatCode="${fmt}" sourceLinked="${fmt === "General" ? 1 : 0}"/>`;
  x += '<c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/>';
  x += `<c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="8B8981"/></a:solidFill></a:ln></c:spPr>`;
  x += `<c:crossAx val="${cross}"/><c:crosses val="autoZero"/>`;
  if (kind === "val") x += `<c:crossBetween val="${opts.between ?? (opts.scatterX ? "midCat" : "between")}"/>`;
  else x += '<c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/>';
  return `${x}</c:${tag}>`;
}

const SYMBOL: Record<SeriesSpec["marker"], string> = { circle: "circle", square: "square", triangle: "triangle", diamond: "diamond", none: "none" };

/** The chart part (xl/charts/chartN.xml) of one Blob chart; null when it shows nothing Excel can draw. */
export function chartXml(spec: ChartSpec, calc: Calc, sheetName: (id: string) => string | undefined, chartNo: number, locale: Locale): string | null {
  const scatter = spec.kind === "scatter";
  // The fitted trendlines, for their labels' number format.
  let fits: (Fit | FitError | null)[] = [];
  if (spec.series.some((s) => s.trendline)) {
    try {
      fits = chartData(spec, calc, locale).series.map((s) => s.fit);
    } catch {
      fits = [];
    }
  }
  const pie = spec.kind === "pie";
  const cat = spec.x ? refFormula(spec.x, sheetName) : null;
  const series: string[] = [];
  spec.series.forEach((s, i) => {
    const y = refFormula(s.y, sheetName);
    if (!y) return;
    const color = hex(s.color ?? SERIES_PALETTE[i % SERIES_PALETTE.length]);
    let x = `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>`;
    const nameRef = s.nameRef ? refFormula(s.nameRef, sheetName) : null;
    if (nameRef && s.nameRef) x += `<c:tx><c:strRef><c:f>${escText(nameRef)}</c:f>${strCache(calc, s.nameRef)}</c:strRef></c:tx>`;
    else if (s.name.trim()) x += `<c:tx><c:v>${escText(s.name.trim())}</c:v></c:tx>`;
    // Look: lines or none, markers, bars and areas filled.
    if (spec.kind === "column" || spec.kind === "bar" || spec.kind === "area") x += `<c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr>`;
    else if (!pie) x += `<c:spPr>${s.line === "none" ? '<a:ln w="25400"><a:noFill/></a:ln>' : `<a:ln w="25400" cap="rnd"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:round/></a:ln>`}</c:spPr>`;
    if (spec.kind === "column" || spec.kind === "bar") x += '<c:invertIfNegative val="0"/>';
    if (scatter || spec.kind === "line") {
      x += s.marker === "none" ? '<c:marker><c:symbol val="none"/></c:marker>' : `<c:marker><c:symbol val="${SYMBOL[s.marker]}"/><c:size val="6"/><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:ln></c:spPr></c:marker>`;
    }
    if (pie) {
      // Each slice in the palette's colours, in turn.
      const n = calc.values(s.y).flat().length;
      for (let p = 0; p < Math.min(n, 64); p++) x += `<c:dPt><c:idx val="${p}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${hex(SERIES_PALETTE[p % SERIES_PALETTE.length])}"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`;
    }
    if (s.labels) x += '<c:dLbls><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>';
    if (s.trendline && !pie) x += trendlineXml(s.trendline, hex(s.color ?? SERIES_PALETTE[i % SERIES_PALETTE.length]), trendLabelFormat(fits[i], s.trendline.showR2));
    if (s.errorBars && !pie) x += errBarsXml(s.errorBars, scatter, color, calc, sheetName);
    if (scatter) {
      const xs = s.x ?? spec.x;
      const xf = xs ? refFormula(xs, sheetName) : null;
      if (xs && xf) x += dataRef("xVal", xs, xf, calc);
      x += dataRef("yVal", s.y, y, calc);
      x += `<c:smooth val="${s.line === "smooth" ? 1 : 0}"/>`;
    } else {
      if (spec.x && cat) x += dataRef("cat", spec.x, cat, calc);
      x += dataRef("val", s.y, y, calc);
      if (spec.kind === "line") x += `<c:smooth val="${s.line === "smooth" ? 1 : 0}"/>`;
    }
    series.push(`${x}</c:ser>`);
  });
  if (!series.length) return null;

  let plot: string;
  // Axis ids only need to be unique within the chart; these are also unique in the file.
  const ax1 = 100000 + chartNo * 2;
  const ax2 = ax1 + 1;
  const axisIds = `<c:axId val="${ax1}"/><c:axId val="${ax2}"/>`;
  if (scatter) {
    plot = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${series.join("")}${axisIds}</c:scatterChart>`;
    plot += axisXml("val", ax1, ax2, "b", spec.xAxis, { scatterX: true, between: "midCat" }) + axisXml("val", ax2, ax1, "l", spec.yAxis, { between: "midCat" });
  } else if (pie) {
    plot = `<c:pieChart><c:varyColors val="1"/>${series.slice(0, 1).join("")}<c:firstSliceAng val="0"/></c:pieChart>`;
  } else if (spec.kind === "line") {
    plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series.join("")}<c:marker val="1"/>${axisIds}</c:lineChart>`;
    plot += axisXml("cat", ax1, ax2, "b", spec.xAxis, {}) + axisXml("val", ax2, ax1, "l", spec.yAxis, {});
  } else if (spec.kind === "area") {
    plot = `<c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>${series.join("")}${axisIds}</c:areaChart>`;
    plot += axisXml("cat", ax1, ax2, "b", spec.xAxis, {}) + axisXml("val", ax2, ax1, "l", spec.yAxis, {});
  } else {
    const bar = spec.kind === "bar";
    plot = `<c:barChart><c:barDir val="${bar ? "bar" : "col"}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series.join("")}<c:gapWidth val="80"/>${axisIds}</c:barChart>`;
    plot += axisXml("cat", ax1, ax2, bar ? "l" : "b", spec.xAxis, {}) + axisXml("val", ax2, ax1, bar ? "b" : "l", spec.yAxis, {});
  }

  const legendPos: Record<ChartSpec["legend"], string> = { top: "t", right: "r", bottom: "b", none: "" };
  const legend = spec.legend !== "none" ? `<c:legend><c:legendPos val="${legendPos[spec.legend]}"/><c:overlay val="0"/></c:legend>` : "";
  const head = spec.title.trim() ? `${title(spec.title.trim(), 1400, true)}<c:autoTitleDeleted val="0"/>` : '<c:autoTitleDeleted val="1"/>';
  return (
    XML_HEAD +
    `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">` +
    '<c:roundedCorners val="0"/>' +
    `<c:chart>${head}<c:plotArea><c:layout/>${plot}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
    '<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="E3E1D9"/></a:solidFill></a:ln></c:spPr>' +
    '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1000"><a:solidFill><a:srgbClr val="4B4A44"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="de-DE"/></a:p></c:txPr>' +
    "</c:chartSpace>"
  );
}

/** The drawing part of a sheet: one anchor per chart, at its cell and offset, its size in EMU. */
export function drawingXml(charts: { spec: ChartSpec; rel: string; id: number }[]): string {
  const anchors = charts
    .map(({ spec, rel, id }) => {
      const at = spec.at;
      const name = escAttr(spec.title.trim() || `Diagramm ${id}`);
      return (
        "<xdr:oneCellAnchor>" +
        `<xdr:from><xdr:col>${Math.max(0, at.col)}</xdr:col><xdr:colOff>${Math.max(0, Math.round(at.dx * EMU))}</xdr:colOff><xdr:row>${Math.max(0, at.row)}</xdr:row><xdr:rowOff>${Math.max(0, Math.round(at.dy * EMU))}</xdr:rowOff></xdr:from>` +
        `<xdr:ext cx="${Math.round(Math.max(120, spec.size.w) * EMU)}" cy="${Math.round(Math.max(90, spec.size.h) * EMU)}"/>` +
        `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id + 1}" name="${name}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
        '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
        `<a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" r:id="${rel}"/></a:graphicData></a:graphic></xdr:graphicFrame>` +
        "<xdr:clientData/></xdr:oneCellAnchor>"
      );
    })
    .join("");
  return XML_HEAD + `<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">${anchors}</xdr:wsDr>`;
}

// Import ------------------------------------------------------------------------------------------

/** A chart formula ('Blatt 1'!$B$2:$B$9) → a range on a sheet (by Blob's sheet id). */
export function parseChartRef(f: string, sheetId: (name: string) => string | undefined): RangeRef | null {
  // Trimmed first: spaces matched inside the pattern, next to the sheet name, took seconds on a long one.
  const m = /^(?:'((?:[^']|'')+)'|([^'!]+))!\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?$/.exec(f.trim().replace(/^\(|\)$/g, "").trim());
  if (!m) return null;
  const name = (m[1] ?? m[2] ?? "").replace(/''/g, "'");
  const id = sheetId(name);
  if (!id) return null;
  const col = (s: string) => [...s.toUpperCase()].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
  const c0 = col(m[3]);
  const r0 = Number(m[4]) - 1;
  const c1 = m[5] ? col(m[5]) : c0;
  const r1 = m[6] ? Number(m[6]) - 1 : r0;
  return { sheetId: id, r0: Math.min(r0, r1), c0: Math.min(c0, c1), r1: Math.max(r0, r1), c1: Math.max(c0, c1) };
}

const richText = (el: XmlEl | null) => (el ? descendants(el, "t").map(textOf).join("") : "");

function axisFrom(el: XmlEl | null): AxisSpec {
  const scaling = child(el, "scaling");
  const fmt = attr(child(el, "numFmt"), "formatCode") ?? "General";
  const dec = /^0(?:\.(0+))?$/.exec(fmt);
  return {
    title: richText(child(child(el, "title"), "tx")).trim(),
    min: numAttr(child(scaling, "min"), "val") ?? null,
    max: numAttr(child(scaling, "max"), "val") ?? null,
    log: !!child(scaling, "logBase"),
    grid: !!child(el, "majorGridlines"),
    decimals: dec ? (dec[1]?.length ?? 0) : null,
  };
}

/** A colour in a series' look (its line, fill or marker), matched to Blob's palette. */
function seriesColor(ser: XmlEl, theme: string[]): SheetColor | null {
  const looks = [child(ser, "spPr"), child(child(ser, "marker"), "spPr")];
  const rgb = attr(looks.flatMap((el) => descendants(el, "srgbClr"))[0], "val");
  if (rgb) return nearestSheetColor(rgb, "text");
  const scheme = looks.flatMap((el) => descendants(el, "schemeClr"))[0];
  const val = attr(scheme, "val");
  const idx = val && /^accent([1-6])$/.exec(val);
  return idx ? nearestSheetColor(theme[3 + Number(idx[1])] ?? "4472C4", "text") : null;
}

/**
 * A series' own name (not a cell's): text as Excel writes it (<c:v>), a formula of quoted text as
 * LibreOffice writes it (<c:f>"Standards"</c:f>), or else the name's last value from the file's
 * cache (a reference to a sheet that didn't come along).
 */
function seriesName(tx: XmlEl | null): string {
  const f = textOf(descendants(tx, "f")[0] ?? null).trim();
  const literal = /^"((?:[^"]|"")*)"$/.exec(f);
  if (literal) return literal[1].replace(/""/g, '"').trim();
  const cached = descendants(child(tx, "strRef"), "v")[0];
  return textOf(cached ?? child(tx, "v")).trim();
}

const TREND_FROM: Record<string, TrendlineSpec["type"]> = { linear: "linear", poly: "polynomial", exp: "exponential", log: "logarithmic", power: "power", movingAvg: "movingAverage" };
const ERR_FROM: Record<string, ErrorBarSpec["kind"]> = { fixedVal: "fixed", percentage: "percent", stdDev: "stdev", stdErr: "stderr", cust: "custom" };

/**
 * An Excel chart → a Blob chart floating at `at` with `size` (px), or null when Blob can't draw
 * it (3-D, doughnut, radar, bubble, stock…). Only the first chart type of a combined chart.
 */
export function chartFromXml(
  root: XmlEl,
  sheetIdOf: (name: string) => string | undefined,
  hostSheetId: string,
  at: ChartSpec["at"],
  size: ChartSpec["size"],
  theme: string[],
): ChartSpec | null {
  const chart = child(root, "chart");
  const plotArea = child(chart, "plotArea");
  if (!plotArea) return null;
  const kinds: [string, ChartKind][] = [
    ["scatterChart", "scatter"],
    ["lineChart", "line"],
    ["barChart", "column"],
    ["areaChart", "area"],
    ["pieChart", "pie"],
  ];
  let kind: ChartKind | null = null;
  let group: XmlEl | null = null;
  for (const [tag, k] of kinds) {
    const el = child(plotArea, tag);
    if (el) {
      kind = k;
      group = el;
      break;
    }
  }
  if (!kind || !group) return null;
  if (kind === "column" && attr(child(group, "barDir"), "val") === "bar") kind = "bar";
  const ref = (el: XmlEl | null) => {
    const f = textOf(descendants(el, "f")[0] ?? null).trim();
    return f ? parseChartRef(f, sheetIdOf) : null;
  };
  let sharedX: RangeRef | null = null;
  const series: SeriesSpec[] = [];
  for (const ser of children(group, "ser")) {
    const y = ref(child(ser, kind === "scatter" ? "yVal" : "val"));
    if (!y) continue;
    const xs = ref(child(ser, kind === "scatter" ? "xVal" : "cat"));
    if (!sharedX && xs) sharedX = xs;
    const tx = child(ser, "tx");
    const nameRef = ref(tx);
    const name = nameRef ? "" : seriesName(tx);
    const lineEl = child(child(ser, "spPr"), "ln");
    const noLine = !!child(lineEl, "noFill");
    const symbol = attr(child(child(ser, "marker"), "symbol"), "val") ?? (kind === "scatter" ? "circle" : "none");
    const marker: SeriesSpec["marker"] = symbol === "none" ? "none" : symbol === "square" ? "square" : symbol === "triangle" ? "triangle" : symbol === "diamond" ? "diamond" : "circle";
    const smooth = attr(child(ser, "smooth"), "val") === "1";
    let trendline: TrendlineSpec | null = null;
    const tl = child(ser, "trendline");
    if (tl) {
      const type = lookup(TREND_FROM, attr(child(tl, "trendlineType"), "val") ?? "linear") ?? "linear";
      trendline = {
        type,
        order: numAttr(child(tl, "order"), "val") ?? 2,
        period: numAttr(child(tl, "period"), "val") ?? 2,
        intercept: numAttr(child(tl, "intercept"), "val") ?? null,
        showEquation: boolAttr(child(tl, "dispEq"), "val"),
        showR2: boolAttr(child(tl, "dispRSqr"), "val"),
        // No showZero: Excel has no such label, so it is off.
        forward: numAttr(child(tl, "forward"), "val") ?? 0,
        backward: numAttr(child(tl, "backward"), "val") ?? 0,
        name: textOf(child(tl, "name")).trim(),
      };
    }
    let errorBars: ErrorBarSpec | null = null;
    const eb = children(ser, "errBars").find((e) => (attr(child(e, "errDir"), "val") ?? "y") === "y");
    if (eb) {
      const k = lookup(ERR_FROM, attr(child(eb, "errValType"), "val") ?? "fixedVal") ?? "fixed";
      const dir = attr(child(eb, "errBarType"), "val");
      errorBars = {
        kind: k,
        value: numAttr(child(eb, "val"), "val") ?? (k === "stdev" ? 1 : 0),
        plus: k === "custom" ? ref(child(eb, "plus")) : null,
        minus: k === "custom" ? ref(child(eb, "minus")) : null,
        direction: dir === "plus" || dir === "minus" ? dir : "both",
      };
    }
    // The colour the palette would give it anyway stays automatic (it follows the series' order).
    const color = seriesColor(ser, theme);
    series.push({
      id: newId(),
      name,
      nameRef,
      y,
      x: kind === "scatter" && xs && sharedX && (xs.sheetId !== sharedX.sheetId || xs.r0 !== sharedX.r0 || xs.c0 !== sharedX.c0 || xs.r1 !== sharedX.r1 || xs.c1 !== sharedX.c1) ? xs : null,
      color: color === SERIES_PALETTE[series.length % SERIES_PALETTE.length] ? null : color,
      marker: kind === "scatter" || kind === "line" ? marker : "none",
      line: kind === "scatter" ? (noLine || attr(child(group, "scatterStyle"), "val") === "marker" ? "none" : smooth ? "smooth" : "straight") : kind === "line" ? (noLine ? "none" : smooth ? "smooth" : "straight") : "none",
      labels: attr(child(child(ser, "dLbls"), "showVal"), "val") === "1",
      errorBars,
      trendline,
    });
  }
  if (!series.length) return null;
  const axes = [...children(plotArea, "valAx"), ...children(plotArea, "catAx"), ...children(plotArea, "dateAx")];
  const pos = (a: XmlEl) => attr(child(a, "axPos"), "val");
  const horizontal = axes.find((a) => (kind === "bar" ? pos(a) === "l" || pos(a) === "r" : pos(a) === "b" || pos(a) === "t"));
  const vertical = axes.find((a) => a !== horizontal);
  const legendPos = attr(child(child(chart, "legend"), "legendPos"), "val");
  const titleEl = child(chart, "title");
  let titleText = richText(child(titleEl, "tx")).trim();
  if (!titleText && titleEl && !boolAttr(child(chart, "autoTitleDeleted"), "val") && series.length === 1) titleText = series[0].name;
  return {
    id: newId(),
    sheetId: hostSheetId,
    at,
    size,
    kind,
    title: titleText,
    x: sharedX,
    series: kind === "pie" ? series.slice(0, 1) : series,
    xAxis: kind === "bar" ? axisFrom(vertical ?? null) : axisFrom(horizontal ?? null),
    yAxis: kind === "bar" ? axisFrom(horizontal ?? null) : axisFrom(vertical ?? null),
    legend: !child(chart, "legend") ? "none" : legendPos === "t" ? "top" : legendPos === "r" || legendPos === "tr" ? "right" : "bottom",
  };
}
