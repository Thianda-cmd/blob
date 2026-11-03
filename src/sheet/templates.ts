// Ready-made spreadsheets for the lab (BTA training, first semesters): calibration curve,
// dilution series, growth curve, replicate measurements with mean and standard deviation, and more.
// Each builds a complete workbook in the user's language with formulas, a smart table and a chart.
//
// CONTRACT: keep the types; SHEET_TEMPLATES is shown by TemplatePicker.
//
// How they are built: plain JSON straight into a Workbook (no ops calls), so a template depends on
// nothing but the document model. Formulas are canonical (English names, "," between arguments,
// "." decimals) and written with the A1 helpers below, so no reference can be off by one. Words
// (sheet names, headers, notes, the texts inside formulas) are in the user's language.
// scripts/check-sheet-templates.ts builds every template in both languages, checks the structure
// and, once the engine calculates, that every formula works and the key numbers are right.
//
// Conventions shared by all templates, so they feel like one family:
//   - row 1 a title, row 2 one sentence on how to use it (grey, italic);
//   - numbered sections ("1. Standards", "2. Kennwerte"…) when a sheet has more than one block;
//   - yellow cells are yours to fill in, green ones are the results worth reading;
//   - units live in the number format ("2,0 mg/L"), so the values stay plain numbers;
//   - a note (Notiz) on headers and results explains the formula or gives a lab tip.

import type { Locale } from "@/i18n/config";
import { tx, type Text } from "@/i18n/text";
import { cellKey, colName } from "./a1";
import { newId } from "./ops";
import { DEFAULT_SIZE } from "./types";
import type { AxisSpec, Cell, CellStyle, ChartSpec, ErrorBarSpec, NumberFormat, RangeRef, SeriesSpec, Sheet, SheetColor, TableSpec, TableStyle, TotalFn, TrendlineSpec, Workbook } from "./types";

export type SheetTemplate = {
  id: string;
  /** lucide icon name hint for the picker (e.g. "trending-up", "flask-conical", "sigma"). Never sparkles or wands. */
  icon: string;
  title: Text;
  description: Text;
  build(locale: Locale): Workbook;
  /** The card's colour in the picker (the main table's colour). */
  color?: SheetColor;
  /** The picker's tiny preview: these rows (from, to; inclusive) and columns of the first sheet. */
  preview?: { rows: [number, number]; cols: number[] };
};

// ----------------------------------------------------------------------------------------------
// Building blocks

type Say = (en: string, de: string) => string;
const sayer =
  (locale: Locale): Say =>
  (en, de) =>
    locale === "de" ? de : en;

// A1 references for formulas (rows and columns 0-based, like everywhere in code).
/** "B6" */
const at = (row: number, col: number) => `${colName(col)}${row + 1}`;
/** "$B$6" */
const fix = (row: number, col: number) => `$${colName(col)}$${row + 1}`;
/** "B6:B11" */
const span = (r0: number, c0: number, r1: number, c1: number) => `${at(r0, c0)}:${at(r1, c1)}`;
/** "$B$6:$B$11" */
const fixSpan = (r0: number, c0: number, r1: number, c1: number) => `${fix(r0, c0)}:${fix(r1, c1)}`;
/** A whole column, fixed: "$B:$B" (keeps working when rows are added below a list). */
const fixCol = (col: number) => `$${colName(col)}:$${colName(col)}`;
/** A text inside a formula, quoted, inner quotes doubled. */
const str = (s: string) => `"${s.replace(/"/g, '""')}"`;

// Number formats
const dec = (decimals: number, unit?: string): NumberFormat => (unit ? { kind: "number", decimals, unit } : { kind: "number", decimals });
const sig = (digits: number, unit?: string): NumberFormat => (unit ? { kind: "significant", digits, unit } : { kind: "significant", digits });
const pct = (decimals: number): NumberFormat => ({ kind: "percent", decimals });
const SHORT_DATE: NumberFormat = { kind: "date", style: "short" };
const GROUPED: NumberFormat = { kind: "number", decimals: 0, group: true };

// Looks
const TITLE: CellStyle = { bold: true, size: 18 };
const SUBTITLE: CellStyle = { italic: true, color: "gray" };
const section = (color: SheetColor): CellStyle => ({ bold: true, size: 14, color });
const HEAD: CellStyle = { bold: true };
const BOLD: CellStyle = { bold: true };
/** Yours to fill in (yellow, like the input fields of a printed lab sheet). */
const INPUT: CellStyle = { fill: "yellow" };
/** A result worth reading. */
const RESULT: CellStyle = { bold: true, fill: "green" };

type CellOpts = { fmt?: NumberFormat; style?: CellStyle; note?: string };

/**
 * A sheet being filled in. Building writes into these fresh objects only; once a template returns
 * its workbook, nothing changes it any more (the editor treats it like any other document).
 */
class Draft {
  readonly sheet: Sheet;

  constructor(name: string) {
    this.sheet = { id: newId(), name, cells: {}, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: DEFAULT_SIZE.rows, cols: DEFAULT_SIZE.cols } };
  }

  get id() {
    return this.sheet.id;
  }

  /** A value, or a formula when the text starts with "=" (stored without it, as the model wants). */
  set(row: number, col: number, value: string | number, opts: CellOpts = {}) {
    const cell: Cell = typeof value === "string" && value.startsWith("=") ? { f: value.slice(1) } : { v: value };
    const style: CellStyle = { ...opts.style };
    if (opts.fmt) style.fmt = opts.fmt;
    if (Object.keys(style).length) cell.s = style;
    if (opts.note) cell.note = opts.note;
    this.sheet.cells[cellKey(row, col)] = cell;
  }

  /** A row of bold header cells starting at `col`, with optional notes. */
  head(row: number, col: number, labels: string[], notes: Record<number, string> = {}) {
    labels.forEach((label, i) => this.set(row, col + i, label, { style: HEAD, note: notes[i] }));
  }

  widths(widths: number[]) {
    widths.forEach((w, col) => (this.sheet.cols[String(col)] = { w }));
  }

  height(row: number, h: number) {
    this.sheet.rows[String(row)] = { h };
  }

  freeze(rows: number) {
    this.sheet.freeze = { rows, cols: 0 };
  }

  /** Title (row 1) and how-to sentence (row 2). */
  intro(title: string, subtitle: string) {
    this.set(0, 0, title, { style: TITLE });
    this.height(0, 36);
    this.set(1, 0, subtitle, { style: SUBTITLE });
  }

  range(r0: number, c0: number, r1 = r0, c1 = c0): RangeRef {
    return { sheetId: this.sheet.id, r0, c0, r1, c1 };
  }
}

function axis(title: string, extra: Partial<AxisSpec> = {}): AxisSpec {
  return { title, min: null, max: null, log: false, grid: true, decimals: null, ...extra };
}

function trendline(type: TrendlineSpec["type"], extra: Partial<TrendlineSpec> = {}): TrendlineSpec {
  return { type, order: 2, period: 2, intercept: null, showEquation: true, showR2: true, forward: 0, backward: 0, name: "", ...extra };
}

function series(y: RangeRef, extra: Partial<SeriesSpec> = {}): SeriesSpec {
  return { id: newId(), name: "", nameRef: null, y, x: null, color: null, marker: "circle", line: "none", labels: false, errorBars: null, trendline: null, ...extra };
}

/** Error bars of ± the amounts in a column (usually the standard deviations next to the means). */
const customErrors = (amounts: RangeRef): ErrorBarSpec => ({ kind: "custom", value: 1, plus: amounts, minus: amounts, direction: "both" });

function chart(sheetId: string, spec: Omit<ChartSpec, "id" | "sheetId">): ChartSpec {
  return { id: newId(), sheetId, ...spec };
}

/** A smart table over rows r0 (header) … r1 and columns c0 … c1; `totals` (one per column) adds a totals row as its last row. */
function table(sheetId: string, name: string, r0: number, c0: number, r1: number, c1: number, style: TableStyle, totals?: TotalFn[]): TableSpec {
  return {
    id: newId(),
    sheetId,
    name,
    area: { r0, c0, r1, c1 },
    columns: Array.from({ length: c1 - c0 + 1 }, (_, i) => ({ id: newId(), total: totals?.[i] ?? "none" })),
    totals: !!totals,
    style,
    banded: true,
    filters: {},
    sort: null,
  };
}

const workbook = (sheets: Draft[], charts: ChartSpec[], tables: TableSpec[]): Workbook => ({ v: 1, sheets: sheets.map((d) => d.sheet), charts, tables });

// ----------------------------------------------------------------------------------------------
// 1. Kalibriergerade (photometry, Lambert-Beer)

function calibration(locale: Locale): Workbook {
  const t = sayer(locale);
  const d = new Draft(t("Calibration", "Kalibrierung"));
  // Header cells need their text plus about 24 px for the smart table's filter button.
  d.widths([190, 120, 120, 160, 190, 170]);
  d.intro(
    t("Calibration curve – photometry (Beer–Lambert law)", "Kalibriergerade – Photometrie nach Lambert-Beer"),
    t(
      "Enter the standards' concentrations and absorbances. Slope, R² and your samples' concentrations follow by themselves.",
      "Trag Konzentrationen und Extinktionen der Standards ein. Steigung, R² und die Konzentrationen deiner Proben rechnen sich von selbst.",
    ),
  );

  // 1. Standards (header row 5, standards in rows 6–11)
  const HEAD_ROW = 4;
  const FIRST = 5;
  const conc = [0, 2, 4, 6, 8, 10];
  const absorbance = [0.003, 0.104, 0.207, 0.318, 0.423, 0.522];
  const LAST = FIRST + conc.length - 1;
  d.set(3, 0, t("1. Standards", "1. Standards"), {
    style: section("blue"),
    note: t(
      "More standards? Type the next one into the empty row right below the table, or insert rows above the last standard (cell menu: “Insert row above”). Slope, R² and the chart include them by themselves.",
      "Mehr Standards? Tipp den nächsten einfach in die leere Zeile direkt unter der Tabelle oder füg über dem letzten Standard Zeilen ein (Zellmenü: „Zeile oberhalb einfügen“). Steigung, R² und Diagramm rechnen sie von selbst mit.",
    ),
  });
  d.head(HEAD_ROW, 0, [t("Standard", "Standard"), t("Concentration", "Konzentration"), t("Absorbance", "Extinktion")], {
    1: t("The standards' concentrations: the x values of the line.", "Die Konzentrationen deiner Standards: die x-Werte der Geraden."),
    2: t(
      "The measured absorbance of each standard: the y values. By the Beer–Lambert law it rises in a straight line with the concentration: A = ε · c · l.",
      "Die gemessene Extinktion jedes Standards: die y-Werte. Nach Lambert-Beer steigt sie linear mit der Konzentration: E = ε · c · d.",
    ),
  });
  conc.forEach((c, i) => {
    const row = FIRST + i;
    d.set(row, 0, i === 0 ? t("S0 (blank)", "S0 (Blindwert)") : `S${i}`, i === 0 ? { note: t("Only solvent and reagent, no analyte.", "Nur Lösungsmittel und Reagenz, ohne Analyt.") } : {});
    d.set(row, 1, c, { fmt: dec(1, "mg/L") });
    d.set(row, 2, absorbance[i], { fmt: dec(3) });
  });
  const xs = span(FIRST, 1, LAST, 1);
  const ys = span(FIRST, 2, LAST, 2);

  // 2. The line's numbers: label in A, value in B
  const K = LAST + 2;
  const SLOPE = K + 1;
  const INTERCEPT = K + 2;
  d.set(K, 0, t("2. The line's numbers", "2. Kennwerte der Geraden"), { style: section("blue") });
  d.set(SLOPE, 0, t("Slope m", "Steigung m"), {
    note: t(
      "=SLOPE(absorbances, concentrations): how much the absorbance rises per mg/L – the sensitivity of the method.",
      "=STEIGUNG(Extinktionen; Konzentrationen): so stark steigt die Extinktion pro mg/L – die Empfindlichkeit der Methode.",
    ),
  });
  d.set(SLOPE, 1, `=SLOPE(${ys},${xs})`, { fmt: dec(4, "L/mg"), style: RESULT });
  d.set(INTERCEPT, 0, t("Intercept b", "Achsenabschnitt b"), {
    note: t("The line's absorbance at 0 mg/L. It should be close to 0 (the blank).", "Die Extinktion der Geraden bei 0 mg/L. Sie sollte nahe 0 liegen (Blindwert)."),
  });
  d.set(INTERCEPT, 1, `=INTERCEPT(${ys},${xs})`, { fmt: dec(4), style: RESULT });
  d.set(K + 3, 0, t("R² (goodness of fit)", "Bestimmtheitsmaß R²"), {
    note: t(
      "How well the standards lie on the line (1 = perfectly). Many procedures ask for R² ≥ 0.99, some for 0.995 or 0.999.",
      "Wie gut die Standards auf der Geraden liegen (1 = perfekt). Viele Vorschriften verlangen R² ≥ 0,99, manche 0,995 oder 0,999.",
    ),
  });
  d.set(K + 3, 1, `=RSQ(${ys},${xs})`, { fmt: dec(4), style: RESULT });
  d.set(K + 4, 0, t("Slope through 0 (LINEST)", "Steigung durch 0 (RGP)"), {
    note: t(
      "The line forced through the origin: =INDEX(LINEST(absorbances, concentrations, FALSE), 1). Use it only when your procedure says so. On the chart: trendline → intercept = 0.",
      "Die Gerade durch den Nullpunkt: =INDEX(RGP(Extinktionen; Konzentrationen; FALSCH); 1). Nur nehmen, wenn deine Vorschrift das verlangt. Im Diagramm: Trendlinie → Schnittpunkt = 0.",
    ),
  });
  d.set(K + 4, 1, `=INDEX(LINEST(${ys},${xs},FALSE),1)`, { fmt: dec(4, "L/mg") });

  // 3. Samples: measured absorbance → concentration → concentration before dilution
  const P = K + 6;
  const P_HEAD = P + 1;
  const P_FIRST = P + 2;
  const samples: [string, number, number][] = [
    [t("Sample A", "Probe A"), 0.287, 1],
    [t("Sample B", "Probe B"), 0.452, 1],
    [t("Sample C", "Probe C"), 0.164, 5],
    [t("Sample D", "Probe D"), 0.638, 1],
  ];
  const P_LAST = P_FIRST + samples.length - 1;
  d.set(P, 0, t("3. Samples", "3. Proben"), { style: section("orange") });
  d.head(P_HEAD, 0, [t("Sample", "Probe"), t("Absorbance", "Extinktion"), t("Concentration", "Konzentration"), t("Dilution factor", "Verdünnungsfaktor"), t("Original concentration", "Ausgangskonzentration"), t("In range?", "Im Messbereich?")], {
    2: t("The line's equation A = m · c + b, solved for c: c = (A − b) / m.", "Die Geradengleichung E = m · c + b nach c umgestellt: c = (E − b) / m."),
    3: t("Diluted the sample 1:5 before measuring? Enter 5. Undiluted: 1.", "Hast du die Probe vor dem Messen 1:5 verdünnt, trag 5 ein. Unverdünnt: 1."),
    4: t("The concentration in the undiluted sample: measured concentration × dilution factor.", "Die Konzentration in der unverdünnten Probe: gemessene Konzentration × Verdünnungsfaktor."),
    5: t(
      "The line is only reliable between the lowest and the highest standard. Above it: dilute the sample and measure again.",
      "Die Gerade gilt nur sicher zwischen dem kleinsten und dem größten Standard. Liegt eine Probe darüber: verdünnen und neu messen.",
    ),
  });
  const yRange = fixSpan(FIRST, 2, LAST, 2);
  samples.forEach(([name, a, dilution], i) => {
    const row = P_FIRST + i;
    const E = at(row, 1);
    d.set(row, 0, name);
    d.set(row, 1, a, { fmt: dec(3) });
    d.set(row, 2, `=IF(${E}="","",(${E}-${fix(INTERCEPT, 1)})/${fix(SLOPE, 1)})`, { fmt: dec(2, "mg/L") });
    d.set(row, 3, dilution);
    d.set(row, 4, `=IF(OR(${E}="",${at(row, 3)}=""),"",${at(row, 2)}*${at(row, 3)})`, { fmt: dec(2, "mg/L"), style: BOLD });
    d.set(row, 5, `=IF(${E}="","",IF(${E}>MAX(${yRange}),${str(t("too high – dilute", "zu hoch – verdünnen"))},IF(${E}<MIN(${yRange}),${str(t("too low", "zu niedrig"))},${str(t("yes", "ja"))})))`);
  });

  const s = d.id;
  return workbook(
    [d],
    [
      chart(s, {
        at: { row: 3, col: 3, dx: 16, dy: 4 },
        size: { w: 460, h: 300 },
        kind: "scatter",
        title: t("Calibration curve", "Kalibriergerade"),
        x: d.range(FIRST, 1, LAST, 1),
        series: [
          series(d.range(FIRST, 2, LAST, 2), { name: t("Standards", "Standards"), color: "blue", trendline: trendline("linear") }),
          // The samples on the same chart: you see at once whether they sit on the line or beyond it.
          series(d.range(P_FIRST, 1, P_LAST, 1), { name: t("Samples", "Proben"), x: d.range(P_FIRST, 2, P_LAST, 2), color: "orange", marker: "diamond" }),
        ],
        xAxis: axis(t("Concentration (mg/L)", "Konzentration (mg/L)")),
        yAxis: axis(t("Absorbance", "Extinktion")),
        legend: "bottom",
      }),
    ],
    [table(s, t("Standards", "Standards"), HEAD_ROW, 0, LAST, 2, "blue"), table(s, t("Samples", "Proben"), P_HEAD, 0, P_LAST, 5, "orange")],
  );
}

// ----------------------------------------------------------------------------------------------
// 2. Bradford-Proteinbestimmung (BSA standards in triplicate, A595)

function bradford(locale: Locale): Workbook {
  const t = sayer(locale);
  const d = new Draft(t("Bradford", "Bradford"));
  // Just wide enough for "Messwert 1", "Verdünnung" and "Blindwert (Mittelwert)" (headers need
  // their text plus about 24 px for the filter button), so the chart beside the table still fits
  // on a 1440 px laptop with the sidebar open.
  d.widths([152, 102, 102, 102, 96, 108, 100]);
  d.intro(
    t("Bradford protein assay", "Bradford-Proteinbestimmung"),
    t(
      "BSA standards in triplicate at 595 nm. Means, blank correction, the line and your samples' protein content follow by themselves.",
      "BSA-Standards in Dreifachbestimmung bei 595 nm. Mittelwerte, Blindwertabzug, Gerade und der Proteingehalt deiner Proben rechnen sich von selbst.",
    ),
  );
  const readings = [t("Reading 1", "Messwert 1"), t("Reading 2", "Messwert 2"), t("Reading 3", "Messwert 3")];

  // 1. Standards
  const HEAD_ROW = 4;
  const FIRST = 5;
  const bsa = [0, 125, 250, 500, 750, 1000];
  const raw = [
    [0.452, 0.448, 0.455],
    [0.583, 0.59, 0.586],
    [0.716, 0.709, 0.72],
    [0.955, 0.948, 0.96],
    [1.161, 1.17, 1.158],
    [1.349, 1.358, 1.346],
  ];
  const LAST = FIRST + bsa.length - 1;
  d.set(3, 0, t("1. BSA standards", "1. BSA-Standards"), {
    style: section("purple"),
    note: t(
      "More standards? Type the next one into the empty row right below the table, or insert rows above the last standard (cell menu: “Insert row above”). The line and the chart include them by themselves.",
      "Mehr Standards? Tipp den nächsten einfach in die leere Zeile direkt unter der Tabelle oder füg über dem letzten Standard Zeilen ein (Zellmenü: „Zeile oberhalb einfügen“). Gerade und Diagramm rechnen sie von selbst mit.",
    ),
  });
  d.head(HEAD_ROW, 0, ["BSA", ...readings, t("Mean", "Mittelwert"), t("SD", "Stabw."), t("Net", "Netto")], {
    0: t("Protein concentration of the BSA standard (bovine serum albumin).", "Proteinkonzentration des BSA-Standards (Rinderserumalbumin)."),
    1: t("Absorbance at 595 nm, three readings per standard.", "Extinktion bei 595 nm, drei Messwerte pro Standard."),
    5: t("Standard deviation of the three readings (STDEV.S). Shown as error bars on the chart.", "Standardabweichung der drei Messwerte (STABW.S). Im Diagramm als Fehlerbalken."),
    6: t(
      "Mean minus the blank (the 0 µg/mL standard): this takes away the dye's own colour.",
      "Mittelwert minus Blindwert (der Standard mit 0 µg/mL): So wird die Eigenfärbung des Farbstoffs abgezogen.",
    ),
  });
  bsa.forEach((c, i) => {
    const row = FIRST + i;
    const reps = span(row, 1, row, 3);
    d.set(row, 0, c, { fmt: dec(0, "µg/mL") });
    raw[i].forEach((a, j) => d.set(row, 1 + j, a, { fmt: dec(3) }));
    d.set(row, 4, `=AVERAGE(${reps})`, { fmt: dec(3) });
    d.set(row, 5, `=STDEV.S(${reps})`, { fmt: dec(3) });
    d.set(row, 6, `=${at(row, 4)}-${fix(FIRST, 4)}`, { fmt: dec(3), style: BOLD });
  });
  const xs = span(FIRST, 0, LAST, 0);
  const net = span(FIRST, 6, LAST, 6);

  // 2. The line's numbers
  const K = LAST + 2;
  const SLOPE = K + 1;
  const INTERCEPT = K + 2;
  const BLANK = K + 4;
  d.set(K, 0, t("2. The line's numbers", "2. Kennwerte der Geraden"), { style: section("purple") });
  // The unit in the label: "0,000900 mL/µg" is too wide for the column (it showed ###).
  d.set(SLOPE, 0, t("Slope m (mL/µg)", "Steigung m (mL/µg)"), {
    note: t("=SLOPE(net absorbances, BSA concentrations): the absorbance per µg/mL protein.", "=STEIGUNG(Netto-Extinktionen; BSA-Konzentrationen): die Extinktion pro µg/mL Protein."),
  });
  d.set(SLOPE, 1, `=SLOPE(${net},${xs})`, { fmt: dec(6), style: RESULT });
  d.set(INTERCEPT, 0, t("Intercept b", "Achsenabschnitt b"));
  d.set(INTERCEPT, 1, `=INTERCEPT(${net},${xs})`, { fmt: dec(4), style: RESULT });
  d.set(K + 3, 0, t("R² (goodness of fit)", "Bestimmtheitsmaß R²"), {
    note: t(
      "The Bradford curve bends slightly over a wide range. If R² is too low, use only the standards in the straight part.",
      "Die Bradford-Kurve ist über einen großen Bereich leicht gekrümmt. Ist R² zu klein, nimm nur die Standards im geraden Teil.",
    ),
  });
  d.set(K + 3, 1, `=RSQ(${net},${xs})`, { fmt: dec(4), style: RESULT });
  d.set(BLANK, 0, t("Blank (mean)", "Blindwert (Mittelwert)"));
  d.set(BLANK, 1, `=${at(FIRST, 4)}`, { fmt: dec(3) });

  // 3. Samples in triplicate
  const P = K + 6;
  const P_HEAD = P + 1;
  const P_FIRST = P + 2;
  const samples: [string, number[], number][] = [
    [t("Lysate A", "Lysat A"), [0.912, 0.905, 0.918], 10],
    [t("Lysate B", "Lysat B"), [0.774, 0.781, 0.769], 10],
    [t("Supernatant", "Überstand"), [0.641, 0.652, 0.646], 1],
  ];
  const P_LAST = P_FIRST + samples.length - 1;
  d.set(P, 0, t("3. Samples", "3. Proben"), { style: section("teal") });
  d.head(P_HEAD, 0, [t("Sample", "Probe"), ...readings, t("Mean", "Mittelwert"), t("Dilution", "Verdünnung"), t("Protein", "Protein")], {
    5: t("The sample's dilution before measuring, e.g. 10 for 1:10.", "Verdünnungsfaktor der Probe vor dem Messen, z. B. 10 für 1:10."),
    6: t(
      "(mean − blank − b) / m × dilution: the protein content of the undiluted sample.",
      "(Mittelwert − Blindwert − b) / m × Verdünnung: der Proteingehalt der unverdünnten Probe.",
    ),
  });
  samples.forEach(([name, values, dilution], i) => {
    const row = P_FIRST + i;
    const reps = span(row, 1, row, 3);
    const mean = at(row, 4);
    d.set(row, 0, name);
    values.forEach((a, j) => d.set(row, 1 + j, a, { fmt: dec(3) }));
    d.set(row, 4, `=IF(COUNT(${reps})=0,"",AVERAGE(${reps}))`, { fmt: dec(3) });
    d.set(row, 5, dilution);
    d.set(row, 6, `=IF(OR(${mean}="",${at(row, 5)}=""),"",(${mean}-${fix(BLANK, 1)}-${fix(INTERCEPT, 1)})/${fix(SLOPE, 1)}*${at(row, 5)})`, { fmt: dec(0, "µg/mL"), style: BOLD });
  });

  const s = d.id;
  return workbook(
    [d],
    [
      chart(s, {
        at: { row: 3, col: 7, dx: 12, dy: 4 },
        size: { w: 350, h: 270 },
        kind: "scatter",
        title: t("BSA calibration", "BSA-Kalibriergerade"),
        x: d.range(FIRST, 0, LAST, 0),
        series: [series(d.range(FIRST, 6, LAST, 6), { name: t("BSA standards", "BSA-Standards"), color: "purple", errorBars: customErrors(d.range(FIRST, 5, LAST, 5)), trendline: trendline("linear") })],
        xAxis: axis("BSA (µg/mL)"),
        yAxis: axis(t("A595 (net)", "A595 (netto)")),
        legend: "none",
      }),
    ],
    [table(s, t("BSA", "BSA"), HEAD_ROW, 0, LAST, 6, "purple"), table(s, t("Samples", "Proben"), P_HEAD, 0, P_LAST, 6, "teal")],
  );
}

// ----------------------------------------------------------------------------------------------
// 3. Messreihe mit Replikaten (mean, SD, CV, column chart with error bars)

function replicates(locale: Locale): Workbook {
  const t = sayer(locale);
  const d = new Draft(t("Measurements", "Messreihe"));
  // "Replicate 1" with the filter button needs 100 px; the chart beside the table fits at 1440 px.
  d.widths([120, 100, 100, 100, 104, 100, 64]);
  d.intro(
    t("Replicate measurements", "Messreihe mit Replikaten"),
    t(
      "Example: an enzyme's activity at different temperatures, three replicates each. Mean, standard deviation and coefficient of variation follow by themselves.",
      "Beispiel: Aktivität eines Enzyms bei verschiedenen Temperaturen, je drei Replikate. Mittelwert, Standardabweichung und Variationskoeffizient rechnen sich von selbst.",
    ),
  );
  const HEAD_ROW = 2;
  const FIRST = 3;
  const rows: [number, number[]][] = [
    [20, [12.1, 11.6, 12.5]],
    [30, [18.4, 19.1, 17.9]],
    [37, [24.8, 25.6, 23.9]],
    [45, [27.2, 26.1, 28.0]],
    [55, [15.3, 17.2, 14.6]],
    [65, [3.1, 2.4, 3.6]],
  ];
  const LAST = FIRST + rows.length - 1;
  d.head(HEAD_ROW, 0, [t("Temperature", "Temperatur"), t("Replicate 1", "Replikat 1"), t("Replicate 2", "Replikat 2"), t("Replicate 3", "Replikat 3"), t("Mean", "Mittelwert"), t("SD (s)", "Stabw. (s)"), t("CV", "VK")], {
    0: t("What you varied. Rename the column for your own series.", "Was du verändert hast. Benenn die Spalte für deine eigene Messreihe um."),
    4: t("=AVERAGE of the three replicates. Empty cells don't count.", "=MITTELWERT der drei Replikate. Leere Zellen zählen nicht mit."),
    5: t(
      "STDEV.S: the standard deviation of a sample (divides by n − 1) – right for replicates.",
      "STABW.S: die Standardabweichung einer Stichprobe (teilt durch n − 1) – richtig für Replikate.",
    ),
    6: t(
      "Coefficient of variation = s / mean. The smaller, the better the replicates agree (rule of thumb: below 5 % very good, above 10 % take a closer look). With very small values it grows quickly.",
      "Variationskoeffizient = s / Mittelwert. Je kleiner, desto besser stimmen die Replikate überein (Faustregel: unter 5 % sehr gut, über 10 % genauer hinschauen). Bei sehr kleinen Messwerten wird er schnell groß.",
    ),
  });
  rows.forEach(([temp, values], i) => {
    const row = FIRST + i;
    const reps = span(row, 1, row, 3);
    d.set(row, 0, temp, { fmt: dec(0, "°C") });
    values.forEach((v, j) => d.set(row, 1 + j, v, { fmt: dec(1) }));
    d.set(row, 4, `=IF(COUNT(${reps})=0,"",AVERAGE(${reps}))`, { fmt: dec(1, "U/mL"), style: BOLD });
    d.set(row, 5, `=IF(COUNT(${reps})<2,"",STDEV.S(${reps}))`, { fmt: dec(2, "U/mL") });
    d.set(row, 6, `=IF(${at(row, 5)}="","",${at(row, 5)}/${at(row, 4)})`, { fmt: pct(1) });
  });
  d.freeze(HEAD_ROW + 1);

  const s = d.id;
  return workbook(
    [d],
    [
      chart(s, {
        // Below the frozen header row (a chart there would slide under it and lose its title).
        at: { row: FIRST, col: 7, dx: 12, dy: 4 },
        size: { w: 420, h: 300 },
        kind: "column",
        title: t("Mean ± standard deviation", "Mittelwert ± Standardabweichung"),
        x: d.range(FIRST, 0, LAST, 0),
        series: [series(d.range(FIRST, 4, LAST, 4), { nameRef: d.range(HEAD_ROW, 4), color: "orange", errorBars: customErrors(d.range(FIRST, 5, LAST, 5)) })],
        xAxis: axis(t("Temperature", "Temperatur"), { grid: false }),
        yAxis: axis(t("Activity (U/mL)", "Aktivität (U/mL)"), { min: 0 }),
        legend: "none",
      }),
    ],
    [table(s, t("Measurements", "Messreihe"), HEAD_ROW, 0, LAST, 6, "orange")],
  );
}

// ----------------------------------------------------------------------------------------------
// 4. Wachstumskurve (OD600 over time, log axis, µ and generation time)

function growth(locale: Locale): Workbook {
  const t = sayer(locale);
  const d = new Draft(t("Growth curve", "Wachstumskurve"));
  d.widths([80, 90, 100, 160, 24, 200, 110]);
  d.intro(
    t("Growth curve", "Wachstumskurve"),
    t(
      "OD600 over time (example: E. coli in LB at 37 °C). The growth rate µ and the generation time g come from the log phase.",
      "OD600 über die Zeit (Beispiel: E. coli in LB bei 37 °C). Wachstumsrate µ und Generationszeit g kommen aus der log-Phase.",
    ),
  );
  const HEAD_ROW = 2;
  const FIRST = 3;
  const hours = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8];
  const od = [0.05, 0.052, 0.061, 0.088, 0.172, 0.351, 0.694, 1.36, 2.15, 2.64, 2.89, 3.05, 3.08, 3.06];
  // The log phase: 1.5–3.5 h (data points 4–8), where ln(OD) rises in a straight line.
  const LOG0 = FIRST + 3;
  const LOG1 = FIRST + 7;
  const phase = (i: number) =>
    i < 3 ? t("lag phase", "lag-Phase") : i < 8 ? t("log phase", "log-Phase") : i < 11 ? t("slowing down", "Verzögerung") : t("stationary phase", "stationäre Phase");
  const LAST = FIRST + hours.length - 1;
  d.head(HEAD_ROW, 0, [t("Time", "Zeit"), "OD600", "ln(OD600)", "Phase"], {
    1: t(
      "Optical density at 600 nm. Above about 1 the photometer gets inaccurate: dilute, measure, and multiply by the dilution factor.",
      "Optische Dichte bei 600 nm. Ab etwa 1 misst das Photometer ungenau: verdünnen, messen und mit dem Verdünnungsfaktor zurückrechnen.",
    ),
    2: t("In the log phase, ln(OD) rises in a straight line over time; its slope is the growth rate µ.", "In der log-Phase steigt ln(OD) linear mit der Zeit; die Steigung ist die Wachstumsrate µ."),
  });
  hours.forEach((h, i) => {
    const row = FIRST + i;
    const inLog = row >= LOG0 && row <= LOG1;
    d.set(row, 0, h, { fmt: dec(1, "h") });
    d.set(row, 1, od[i], { fmt: dec(3) });
    d.set(row, 2, `=IF(${at(row, 1)}>0,LN(${at(row, 1)}),"")`, { fmt: dec(3) });
    d.set(row, 3, phase(i), inLog ? { style: { bold: true, color: "orange" } } : { style: { color: "gray" } });
  });
  d.freeze(HEAD_ROW + 1);

  // Results from the log phase, beside the table
  const lnLog = span(LOG0, 2, LOG1, 2);
  const tLog = span(LOG0, 0, LOG1, 0);
  const MU = FIRST;
  d.set(HEAD_ROW, 5, t("From the log phase", "Aus der log-Phase"), { style: BOLD });
  d.set(MU, 5, t("Growth rate µ", "Wachstumsrate µ"), {
    note: t(
      `The slope of ln(OD600) over time in the log phase: =SLOPE(${lnLog}, ${tLog}). The same number is the exponent of the chart's trendline y = a·e^(µx).`,
      `Die Steigung von ln(OD600) über der Zeit in der log-Phase: =STEIGUNG(${lnLog}; ${tLog}). Dieselbe Zahl steht als Exponent in der Trendlinie y = a·e^(µx).`,
    ),
  });
  d.set(MU, 6, `=SLOPE(${lnLog},${tLog})`, { fmt: dec(3, "1/h"), style: RESULT });
  d.set(MU + 1, 5, t("Generation time g", "Generationszeit g"), {
    note: t("g = ln(2) / µ: how long the cells take to double.", "g = ln(2) / µ: so lange dauert eine Verdopplung."),
  });
  d.set(MU + 1, 6, `=LN(2)/${at(MU, 6)}`, { fmt: dec(2, "h"), style: RESULT });
  d.set(MU + 2, 5, t("… in minutes", "… in Minuten"));
  d.set(MU + 2, 6, `=${at(MU + 1, 6)}*60`, { fmt: dec(0, "min"), style: RESULT });
  d.set(MU + 3, 5, t("R² (ln OD against time)", "R² (ln OD gegen Zeit)"));
  d.set(MU + 3, 6, `=RSQ(${lnLog},${tLog})`, { fmt: dec(4) });
  d.set(MU + 4, 5, t("Log phase from", "log-Phase von"), {
    note: t(
      `Is your log phase somewhere else? Change the rows in the formulas above (${tLog}, ${lnLog}) and in the chart's “log phase” series.`,
      `Liegt deine log-Phase woanders? Ändere die Zeilen in den Formeln darüber (${tLog}, ${lnLog}) und in der Diagrammreihe „log-Phase“.`,
    ),
  });
  d.set(MU + 4, 6, `=${at(LOG0, 0)}`, { fmt: dec(1, "h") });
  d.set(MU + 5, 5, t("to", "bis"));
  d.set(MU + 5, 6, `=${at(LOG1, 0)}`, { fmt: dec(1, "h") });

  const s = d.id;
  return workbook(
    [d],
    [
      chart(s, {
        at: { row: MU + 7, col: 5, dx: 0, dy: 4 },
        size: { w: 420, h: 300 },
        kind: "scatter",
        title: t("Growth curve", "Wachstumskurve"),
        x: d.range(FIRST, 0, LAST, 0),
        series: [
          series(d.range(FIRST, 1, LAST, 1), { nameRef: d.range(HEAD_ROW, 1), color: "blue", line: "straight" }),
          // The log phase once more, with the exponential trendline fitted to just these points.
          series(d.range(LOG0, 1, LOG1, 1), { name: t("log phase", "log-Phase"), x: d.range(LOG0, 0, LOG1, 0), color: "orange", trendline: trendline("exponential") }),
        ],
        xAxis: axis(t("Time (h)", "Zeit (h)")),
        yAxis: axis("OD600", { log: true }),
        legend: "bottom",
      }),
    ],
    [table(s, t("Growth", "Wachstum"), HEAD_ROW, 0, LAST, 3, "green")],
  );
}

// ----------------------------------------------------------------------------------------------
// 5. Verdünnungsreihe (serial dilution, C1·V1 = C2·V2)

function dilution(locale: Locale): Workbook {
  const t = sayer(locale);
  const d = new Draft(t("Dilution series", "Verdünnungsreihe"));
  d.widths([210, 130, 140, 150, 130]);
  d.intro(
    t("Dilution series", "Verdünnungsreihe"),
    t(
      "Fill in the yellow cells: stock, factor and volume. The table tells you what to pipette into each tube.",
      "Füll die gelben Zellen aus: Stammlösung, Faktor und Volumen. Die Tabelle sagt dir, was du in jedes Röhrchen pipettierst.",
    ),
  );

  // 1. Starting point
  const STOCK = 4;
  const FACTOR = 5;
  const VOLUME = 6;
  d.set(3, 0, t("1. Starting point", "1. Angaben"), { style: section("teal") });
  d.set(STOCK, 0, t("Stock concentration", "Stammlösung"));
  d.set(STOCK, 1, 1000, { fmt: dec(0, "µg/mL"), style: INPUT });
  d.set(FACTOR, 0, t("Factor per step", "Faktor pro Stufe"));
  d.set(FACTOR, 1, 2, {
    style: INPUT,
    note: t(
      "2 for a 1:2 series (each tube half as concentrated), 10 for a 1:10 series (e.g. counting bacteria).",
      "2 für eine 1:2-Reihe (jedes Röhrchen halb so konzentriert), 10 für eine 1:10-Reihe (z. B. Keimzahlbestimmung).",
    ),
  });
  d.set(VOLUME, 0, t("Final volume per tube", "Endvolumen je Röhrchen"));
  d.set(VOLUME, 1, 1000, { fmt: dec(0, "µL"), style: INPUT, note: t("What each tube holds after mixing.", "So viel Flüssigkeit ist nach dem Mischen in jedem Röhrchen.") });

  // 2. Pipetting plan, one row per tube
  const HEAD_ROW = 9;
  const FIRST = 10;
  const TUBES = 8;
  const LAST = FIRST + TUBES - 1;
  d.set(HEAD_ROW - 1, 0, t("2. Pipetting plan", "2. Pipettierschema"), { style: section("teal") });
  d.head(HEAD_ROW, 0, [t("Tube", "Röhrchen"), t("Dilution 1:x", "Verdünnung 1:x"), t("Concentration", "Konzentration"), t("Diluent", "Verdünnungsmittel"), t("Transfer", "Übertragen")], {
    0: t(
      "So that every tube ends up with the same volume, take the transfer volume out of the last tube as well and discard it.",
      "Damit alle Röhrchen gleich viel enthalten, nimm aus dem letzten Röhrchen dieselbe Menge heraus und verwirf sie.",
    ),
    1: t("The total dilution of this tube: factor ^ tube number.", "Die Gesamtverdünnung dieses Röhrchens: Faktor ^ Röhrchennummer."),
    3: t("Buffer, water or medium: put it into all tubes first.", "Puffer, Wasser oder Medium: zuerst in alle Röhrchen vorlegen."),
    4: t(
      "From the tube before (for tube 1: from the stock) into the diluent, then mix well.",
      "Aus dem Röhrchen davor (beim ersten aus der Stammlösung) ins vorgelegte Verdünnungsmittel pipettieren und gut mischen.",
    ),
  });
  for (let i = 0; i < TUBES; i++) {
    const row = FIRST + i;
    d.set(row, 0, i + 1, { style: { align: "center" } });
    d.set(row, 1, `=POWER(${fix(FACTOR, 1)},${at(row, 0)})`, { fmt: GROUPED });
    d.set(row, 2, `=${fix(STOCK, 1)}/${at(row, 1)}`, { fmt: sig(3, "µg/mL"), style: BOLD });
    d.set(row, 3, `=${fix(VOLUME, 1)}-${at(row, 4)}`, { fmt: sig(3, "µL") });
    d.set(row, 4, `=${fix(VOLUME, 1)}/${fix(FACTOR, 1)}`, { fmt: sig(3, "µL") });
  }

  // 3. C1·V1 = C2·V2
  const C = LAST + 2;
  const C1 = C + 1;
  const C2 = C + 2;
  const V2 = C + 3;
  const V1 = C + 4;
  d.set(C, 0, t("3. C₁ · V₁ = C₂ · V₂", "3. C₁ · V₁ = C₂ · V₂"), {
    style: section("teal"),
    note: t("Enter C₁ and C₂ in the same unit; V₁ comes out in the unit of V₂.", "C₁ und C₂ in derselben Einheit eingeben; V₁ kommt in der Einheit von V₂ heraus."),
  });
  d.set(C1, 0, t("C₁ stock concentration", "C₁ Ausgangskonzentration"));
  d.set(C1, 1, 1000, { fmt: dec(0, "µg/mL"), style: INPUT });
  d.set(C2, 0, t("C₂ concentration wanted", "C₂ gewünschte Konzentration"));
  d.set(C2, 1, 50, { fmt: dec(0, "µg/mL"), style: INPUT });
  d.set(V2, 0, t("V₂ volume wanted", "V₂ gewünschtes Volumen"));
  d.set(V2, 1, 10, { fmt: dec(1, "mL"), style: INPUT });
  d.set(V1, 0, t("V₁ stock to take", "V₁ Stammlösung nehmen"), { note: t("V₁ = C₂ · V₂ / C₁", "V₁ = C₂ · V₂ / C₁") });
  d.set(V1, 1, `=${at(C2, 1)}*${at(V2, 1)}/${at(C1, 1)}`, { fmt: dec(2, "mL"), style: RESULT });
  d.set(V1 + 1, 0, t("Diluent to add", "Verdünnungsmittel dazu"));
  d.set(V1 + 1, 1, `=${at(V2, 1)}-${at(V1, 1)}`, { fmt: dec(2, "mL"), style: RESULT });

  return workbook([d], [], [table(d.id, t("Dilutions", "Verdünnungen"), HEAD_ROW, 0, LAST, 4, "teal")]);
}

// ----------------------------------------------------------------------------------------------
// 6. Lösungen ansetzen (mass from mol/L, volume and molar mass; % w/v)

function solutions(locale: Locale): Workbook {
  const t = sayer(locale);
  const d = new Draft(t("Solutions", "Lösungen"));
  d.widths([210, 130, 130, 110, 120]);
  d.intro(
    t("Preparing solutions", "Lösungen ansetzen"),
    t(
      "Mass = concentration × volume × molar mass. Enter what you need – the mass to weigh follows by itself.",
      "Einwaage = Konzentration × Volumen × molare Masse. Trag ein, was du brauchst – die Einwaage rechnet sich von selbst.",
    ),
  );

  // 1. Molar solutions
  const HEAD_ROW = 4;
  const FIRST = 5;
  const molar: [string, number, number, number, string?][] = [
    ["NaCl", 58.44, 0.15, 1000],
    [t("Tris (base)", "Tris (Base)"), 121.14, 1, 100, t("Dissolve, set the pH with HCl, then fill up to the final volume.", "Lösen, mit HCl auf den pH einstellen, dann auf das Endvolumen auffüllen.")],
    ["Na₂EDTA · 2 H₂O", 372.24, 0.5, 100, t("Only dissolves at about pH 8: adjust with NaOH.", "Löst sich erst bei etwa pH 8: mit NaOH einstellen.")],
    ["Glucose", 180.16, 0.1, 250],
    ["MgCl₂ · 6 H₂O", 203.3, 1, 50],
    ["NaOH", 40.0, 1, 100, t("Corrosive: goggles and gloves! The solution gets warm while dissolving.", "Ätzend: Schutzbrille und Handschuhe! Beim Lösen wird es warm.")],
  ];
  const LAST = FIRST + molar.length - 1;
  d.set(3, 0, t("1. Molar solutions (mol/L)", "1. Molare Lösungen (mol/L)"), { style: section("blue") });
  d.head(HEAD_ROW, 0, [t("Substance", "Substanz"), t("Molar mass", "Molare Masse"), t("Concentration", "Konzentration"), t("Volume", "Volumen"), t("Mass", "Einwaage")], {
    1: t(
      "On the bottle or in the safety data sheet. Mind the water of crystallisation: MgCl₂ · 6 H₂O weighs much more than MgCl₂!",
      "Steht auf der Flasche oder im Sicherheitsdatenblatt. Achte auf Kristallwasser: MgCl₂ · 6 H₂O wiegt viel mehr als MgCl₂!",
    ),
    3: t("In mL; the formula divides by 1000 to get litres.", "In mL; die Formel teilt durch 1000 und rechnet so in Liter."),
    4: t("m = c · V · M (mol/L · L · g/mol = g)", "m = c · V · M (mol/L · L · g/mol = g)"),
  });
  molar.forEach(([name, mass, conc, volume, note], i) => {
    const row = FIRST + i;
    d.set(row, 0, name, note ? { note } : {});
    d.set(row, 1, mass, { fmt: dec(2, "g/mol") });
    d.set(row, 2, conc, { fmt: dec(2, "mol/L") });
    d.set(row, 3, volume, { fmt: dec(0, "mL") });
    d.set(row, 4, `=IF(COUNT(${span(row, 1, row, 3)})<3,"",${at(row, 2)}*(${at(row, 3)}/1000)*${at(row, 1)})`, { fmt: dec(3, "g"), style: BOLD });
  });

  // 2. Percent solutions (w/v): g per 100 mL
  const P = LAST + 2;
  const P_HEAD = P + 1;
  const P_FIRST = P + 2;
  const percent: [string, number, number, string?][] = [
    [t("Agarose (gel)", "Agarose (Gel)"), 0.01, 100, t("Boil in buffer (e.g. 1× TAE) until the solution is clear.", "In Puffer (z. B. 1× TAE) aufkochen, bis die Lösung klar ist.")],
    [t("NaCl (physiological)", "NaCl (physiologisch)"), 0.009, 500],
    [t("SDS stock", "SDS-Stammlösung"), 0.1, 50],
  ];
  const P_LAST = P_FIRST + percent.length - 1;
  d.set(P, 0, t("2. Percent solutions (w/v)", "2. Prozentuale Lösungen (w/v)"), { style: section("teal") });
  d.head(P_HEAD, 0, [t("Substance", "Substanz"), t("Share (w/v)", "Anteil (w/v)"), t("Volume", "Volumen"), t("Mass", "Einwaage")], {
    1: t("Grams per 100 mL: 1 % (w/v) = 1 g in 100 mL.", "Gramm pro 100 mL: 1 % (w/v) = 1 g in 100 mL."),
    3: t("Share × volume in mL (1 % of 100 mL = 1 g).", "Anteil × Volumen in mL (1 % von 100 mL = 1 g)."),
  });
  percent.forEach(([name, share, volume, note], i) => {
    const row = P_FIRST + i;
    d.set(row, 0, name, note ? { note } : {});
    d.set(row, 1, share, { fmt: pct(1) });
    d.set(row, 2, volume, { fmt: dec(0, "mL") });
    d.set(row, 3, `=IF(COUNT(${span(row, 1, row, 2)})<2,"",${at(row, 1)}*${at(row, 2)})`, { fmt: dec(3, "g"), style: BOLD });
  });

  const s = d.id;
  return workbook([d], [], [table(s, "Molar", HEAD_ROW, 0, LAST, 4, "blue"), table(s, t("Percent", "Prozent"), P_HEAD, 0, P_LAST, 3, "teal")]);
}

// ----------------------------------------------------------------------------------------------
// 7. Mastermix / Pipettierschema (per reaction × (n + 10 %))

function mastermix(locale: Locale): Workbook {
  const t = sayer(locale);
  const d = new Draft(t("Master mix", "Mastermix"));
  d.widths([240, 130, 130, 130]);
  d.intro(
    t("PCR master mix", "Mastermix (PCR)"),
    t(
      "Enter the volumes for one reaction. The extra makes sure the mix is enough for every sample; water tops up by itself.",
      "Trag die Volumina für eine Reaktion ein. Der Überschuss sorgt dafür, dass der Mix für alle Proben reicht; Wasser füllt automatisch auf.",
    ),
  );

  // 1. Reactions
  const N = 4;
  const EXTRA = 5;
  const VOLUME = 6;
  const TEMPLATE = 7;
  const TIMES = 8;
  d.set(3, 0, t("1. Reactions", "1. Ansätze"), { style: section("purple") });
  d.set(N, 0, t("Samples (reactions)", "Proben (Reaktionen)"), { note: t("Count the controls too, e.g. a negative control with water.", "Zähl die Kontrollen mit, z. B. eine Negativkontrolle mit Wasser.") });
  d.set(N, 1, 8, { style: INPUT });
  d.set(EXTRA, 0, t("Extra for pipetting losses", "Überschuss für Pipettierverluste"));
  d.set(EXTRA, 1, 0.1, { fmt: pct(0), style: INPUT, note: t("Liquid stays in tips and on tube walls: make 10 % more than you need.", "In Spitzen und an Gefäßwänden bleibt etwas hängen: setz 10 % mehr an, als du brauchst.") });
  d.set(VOLUME, 0, t("Volume per reaction", "Volumen pro Reaktion"));
  d.set(VOLUME, 1, 25, { fmt: dec(1, "µL"), style: INPUT });
  d.set(TEMPLATE, 0, t("Template DNA per reaction", "Template-DNA pro Reaktion"));
  d.set(TEMPLATE, 1, 2, { fmt: dec(1, "µL"), style: INPUT, note: t("Goes into each tube separately, not into the mix.", "Kommt einzeln in jedes Gefäß, nicht in den Mix.") });
  d.set(TIMES, 0, t("Mix is enough for", "Mix reicht für"), { note: t("Samples × (1 + extra)", "Proben × (1 + Überschuss)") });
  d.set(TIMES, 1, `=${at(N, 1)}*(1+${at(EXTRA, 1)})`, { fmt: dec(1, t("reactions", "Ansätze")), style: RESULT });

  // 2. The mix: per reaction and in total
  const HEAD_ROW = 11;
  const FIRST = 12;
  const parts: [string, string, number | null, string][] = [
    [t("10× PCR buffer (without Mg²⁺)", "10× PCR-Puffer (ohne Mg²⁺)"), "10×", 2.5, t("Final concentration 1× (2.5 µL of 10× in 25 µL).", "Endkonzentration 1× (2,5 µL von 10× in 25 µL).")],
    [t("dNTP mix", "dNTP-Mix"), t("10 mM each", "10 mM je dNTP"), 0.5, t("Final concentration 200 µM of each dNTP.", "Endkonzentration 200 µM je dNTP.")],
    ["MgCl₂", "25 mM", 1.5, t("Final concentration 1.5 mM.", "Endkonzentration 1,5 mM.")],
    [t("Primer forward", "Primer forward"), "10 µM", 1, t("Final concentration 0.4 µM (1 µL of 10 µM in 25 µL).", "Endkonzentration 0,4 µM (1 µL von 10 µM in 25 µL).")],
    [t("Primer reverse", "Primer reverse"), "10 µM", 1, t("Final concentration 0.4 µM.", "Endkonzentration 0,4 µM.")],
    [t("Taq polymerase", "Taq-Polymerase"), "5 U/µL", 0.25, t("Add it last, keep it on ice and don't vortex – mix gently.", "Zuletzt zugeben, auf Eis halten und nicht vortexen – nur vorsichtig mischen.")],
    [
      t("PCR water (nuclease-free)", "PCR-Wasser (nukleasefrei)"),
      "–",
      null,
      t("Calculated: volume per reaction − template − all other components.", "Wird berechnet: Volumen pro Reaktion − Template − alle anderen Komponenten."),
    ],
  ];
  const WATER = FIRST + parts.length - 1;
  const TOTAL = WATER + 1;
  d.set(HEAD_ROW - 1, 0, t("2. Master mix", "2. Mastermix"), { style: section("purple") });
  d.head(HEAD_ROW, 0, [t("Component", "Komponente"), t("Stock", "Stammlösung"), t("Per reaction", "Pro Reaktion"), t("Master mix", "Mastermix")], {
    0: t(
      "Pipetting order: water, buffer, dNTPs, MgCl₂, primers – the polymerase last.",
      "Reihenfolge beim Pipettieren: Wasser, Puffer, dNTPs, MgCl₂, Primer – die Polymerase zuletzt.",
    ),
    3: t("Per reaction × the number of reactions incl. extra.", "Pro Reaktion × Anzahl der Ansätze inkl. Überschuss."),
  });
  parts.forEach(([name, stock, volume, note], i) => {
    const row = FIRST + i;
    d.set(row, 0, name, { note });
    d.set(row, 1, stock);
    d.set(row, 2, volume ?? `=${fix(VOLUME, 1)}-${fix(TEMPLATE, 1)}-SUM(${span(FIRST, 2, WATER - 1, 2)})`, { fmt: dec(2, "µL") });
    d.set(row, 3, `=${at(row, 2)}*${fix(TIMES, 1)}`, { fmt: dec(1, "µL") });
  });
  d.set(TOTAL, 0, t("Total", "Summe"), { style: BOLD });
  d.set(TOTAL, 2, `=SUBTOTAL(109,${span(FIRST, 2, WATER, 2)})`, { fmt: dec(2, "µL"), style: BOLD });
  d.set(TOTAL, 3, `=SUBTOTAL(109,${span(FIRST, 3, WATER, 3)})`, { fmt: dec(1, "µL"), style: BOLD });

  // 3. Into each tube
  const E = TOTAL + 2;
  d.set(E, 0, t("3. Into each tube", "3. In jedes Gefäß"), { style: section("purple") });
  d.set(E + 1, 0, t("Master mix", "Mastermix vorlegen"));
  d.set(E + 1, 1, `=${at(TOTAL, 2)}`, { fmt: dec(2, "µL") });
  d.set(E + 2, 0, t("Template DNA", "Template-DNA dazu"));
  d.set(E + 2, 1, `=${at(TEMPLATE, 1)}`, { fmt: dec(2, "µL") });
  d.set(E + 3, 0, t("Reaction volume", "Reaktionsvolumen"));
  d.set(E + 3, 1, `=${at(E + 1, 1)}+${at(E + 2, 1)}`, { fmt: dec(2, "µL"), style: RESULT });
  d.set(E + 4, 0, t("Check", "Kontrolle"), { note: t("If the components add up to more than the reaction volume, the water turns negative.", "Sind die Komponenten zusammen mehr als das Reaktionsvolumen, wird das Wasser negativ.") });
  d.set(E + 4, 1, `=IF(${at(WATER, 2)}<0,${str(t("too much – water below 0", "zu viel – Wasser unter 0"))},${str(t("fits", "passt"))})`, { style: BOLD });

  return workbook([d], [], [table(d.id, t("MasterMix", "Mastermix"), HEAD_ROW, 0, TOTAL, 3, "purple", ["none", "none", "sum", "sum"])]);
}

// ----------------------------------------------------------------------------------------------
// 8. Noten (weighted averages per subject)

/** Today as a date number (days since 1899-12-30, like Excel), in local time. */
function todaySerial(): number {
  const now = new Date();
  return Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
}

function grades(locale: Locale): Workbook {
  const t = sayer(locale);
  const d = new Draft(t("Grades", "Noten"));
  d.widths([100, 170, 110, 70, 80, 130, 24, 170, 90, 70]);
  d.intro(
    t("Grades", "Notenübersicht"),
    t(
      "Enter each grade with its subject and weight (an exam might count double). The averages per subject follow by themselves.",
      "Trag jede Note mit Fach und Gewicht ein (eine Klausur zählt z. B. doppelt). Die Schnitte pro Fach rechnen sich von selbst.",
    ),
  );
  const bio = t("Biochemistry", "Biochemie");
  const micro = t("Microbiology", "Mikrobiologie");
  const chem = t("Chemistry", "Chemie");
  const mol = t("Molecular biology", "Molekularbiologie");
  const exam = t("Exam", "Klausur");
  const test = t("Test", "Test");
  const oral = t("Oral", "Mündlich");
  const lab = t("Lab practical", "Praktikum");
  const entries: [string, string, number, number][] = [
    [bio, exam, 2.3, 2],
    [micro, test, 1.7, 1],
    [chem, exam, 2.7, 2],
    [bio, oral, 1.3, 1],
    [micro, exam, 2.0, 2],
    [chem, test, 3.0, 1],
    [mol, lab, 1.0, 1],
    [bio, test, 2.0, 1],
    [mol, exam, 1.7, 2],
    [chem, oral, 2.3, 1],
  ];
  const HEAD_ROW = 2;
  const FIRST = 3;
  const LAST = FIRST + entries.length - 1;
  d.head(HEAD_ROW, 0, [t("Date", "Datum"), t("Subject", "Fach"), t("Kind", "Art"), t("Grade", "Note"), t("Weight", "Gewicht"), t("Grade × weight", "Note × Gewicht")], {
    4: t("How often the grade counts: 2 = double (e.g. an exam), 1 = once.", "Wie oft die Note zählt: 2 = doppelt (z. B. Klausur), 1 = einfach."),
  });
  // Example dates: one a week, ending this week.
  const today = todaySerial();
  entries.forEach(([subject, kind, grade, weight], i) => {
    const row = FIRST + i;
    d.set(row, 0, today - (entries.length - 1 - i) * 7, { fmt: SHORT_DATE });
    d.set(row, 1, subject);
    d.set(row, 2, kind);
    d.set(row, 3, grade, { fmt: dec(1) });
    d.set(row, 4, weight);
    d.set(row, 5, `=IF(COUNT(${span(row, 3, row, 4)})<2,"",${at(row, 3)}*${at(row, 4)})`, { fmt: dec(1) });
  });
  d.freeze(HEAD_ROW + 1);

  // Averages per subject (whole columns, so new grades below the list count too)
  const subjects = [bio, chem, micro, mol];
  const S_FIRST = FIRST;
  const S_LAST = S_FIRST + subjects.length - 1;
  const SUBJ = fixCol(1);
  const WEIGHT = fixCol(4);
  const PRODUCT = fixCol(5);
  d.head(HEAD_ROW, 7, [t("Subject", "Fach"), t("Average", "Schnitt"), t("Grades", "Noten")], {
    1: t(
      "Weighted average: SUMIF of grade × weight, divided by the weights of the rows that have a grade.",
      "Gewichteter Schnitt: SUMMEWENN von Note × Gewicht, geteilt durch die Gewichte der Zeilen mit Note.",
    ),
  });
  subjects.forEach((subject, i) => {
    const row = S_FIRST + i;
    const name = at(row, 7);
    d.set(row, 7, subject);
    d.set(row, 8, `=IFERROR(SUMIF(${SUBJ},${name},${PRODUCT})/SUMIFS(${WEIGHT},${SUBJ},${name},${PRODUCT},">0"),"")`, { fmt: dec(2), style: BOLD });
    d.set(row, 9, `=COUNTIF(${SUBJ},${name})`);
  });
  const OVERALL = S_LAST + 2;
  d.set(OVERALL, 7, t("Overall average", "Gesamtschnitt"), { style: BOLD, note: t("All grades, averaged by their weights.", "Alle Noten, nach ihrem Gewicht gemittelt.") });
  d.set(OVERALL, 8, `=IFERROR(SUM(${PRODUCT})/SUMIF(${PRODUCT},">0",${WEIGHT}),"")`, { fmt: dec(2), style: RESULT });

  const s = d.id;
  return workbook(
    [d],
    [
      chart(s, {
        at: { row: OVERALL + 2, col: 7, dx: 0, dy: 4 },
        size: { w: 400, h: 260 },
        kind: "column",
        title: t("Average per subject", "Schnitt pro Fach"),
        x: d.range(S_FIRST, 7, S_LAST, 7),
        series: [series(d.range(S_FIRST, 8, S_LAST, 8), { nameRef: d.range(HEAD_ROW, 8), color: "green", labels: true })],
        xAxis: axis("", { grid: false }),
        yAxis: axis(t("Grade", "Note"), { min: 0 }),
        legend: "none",
      }),
    ],
    [table(s, t("Grades", "Noten"), HEAD_ROW, 0, LAST, 5, "green"), table(s, t("Averages", "Schnitte"), HEAD_ROW, 7, S_LAST, 9, "gray")],
  );
}

// ----------------------------------------------------------------------------------------------

export const SHEET_TEMPLATES: SheetTemplate[] = [
  {
    id: "calibration",
    icon: "trending-up",
    color: "blue",
    title: tx("Calibration curve", "Kalibriergerade"),
    description: tx("Photometry: standards, trendline with equation and R², sample concentrations", "Photometrie: Standards, Trendlinie mit Gleichung und R², Probenkonzentrationen"),
    preview: { rows: [4, 7], cols: [0, 1, 2] },
    build: calibration,
  },
  {
    id: "bradford",
    icon: "flask-conical",
    color: "purple",
    title: tx("Bradford protein assay", "Bradford-Proteinbestimmung"),
    description: tx("BSA standards in triplicate, blank correction, protein content of your samples", "BSA-Standards in Dreifachbestimmung, Blindwertabzug, Proteingehalt der Proben"),
    preview: { rows: [4, 7], cols: [0, 4, 6] },
    build: bradford,
  },
  {
    id: "replicates",
    icon: "sigma",
    color: "orange",
    title: tx("Replicate measurements", "Messreihe mit Replikaten"),
    description: tx("Mean, standard deviation and CV, column chart with error bars", "Mittelwert, Standardabweichung und VK, Säulendiagramm mit Fehlerbalken"),
    preview: { rows: [2, 5], cols: [0, 4, 5] },
    build: replicates,
  },
  {
    id: "growth",
    icon: "activity",
    color: "green",
    title: tx("Growth curve", "Wachstumskurve"),
    description: tx("OD600 over time on a log axis, growth rate and generation time", "OD600 über die Zeit mit log. Achse, Wachstumsrate und Generationszeit"),
    preview: { rows: [2, 5], cols: [0, 1, 2] },
    build: growth,
  },
  {
    id: "dilution",
    icon: "test-tubes",
    color: "teal",
    title: tx("Dilution series", "Verdünnungsreihe"),
    description: tx("Serial dilution with volumes for every tube, plus C₁·V₁ = C₂·V₂", "Serielle Verdünnung mit Volumina für jedes Röhrchen, dazu C₁·V₁ = C₂·V₂"),
    preview: { rows: [9, 12], cols: [0, 1, 2, 3] },
    build: dilution,
  },
  {
    id: "solutions",
    icon: "beaker",
    color: "blue",
    title: tx("Preparing solutions", "Lösungen ansetzen"),
    description: tx("Mass to weigh from mol/L, volume and molar mass – and % (w/v)", "Einwaage aus mol/L, Volumen und molarer Masse – und % (w/v)"),
    preview: { rows: [4, 7], cols: [0, 2, 3, 4] },
    build: solutions,
  },
  {
    id: "mastermix",
    icon: "pipette",
    color: "purple",
    title: tx("PCR master mix", "Mastermix (PCR)"),
    description: tx("Volumes per reaction × number of samples + 10 % extra", "Volumina pro Reaktion × Probenzahl + 10 % Überschuss"),
    preview: { rows: [11, 14], cols: [0, 2, 3] },
    build: mastermix,
  },
  {
    id: "grades",
    icon: "graduation-cap",
    color: "green",
    title: tx("Grades", "Notenübersicht"),
    description: tx("Weighted averages per subject with SUMIF and a chart", "Gewichtete Schnitte pro Fach mit SUMMEWENN und Diagramm"),
    preview: { rows: [2, 5], cols: [1, 3, 4] },
    build: grades,
  },
];
