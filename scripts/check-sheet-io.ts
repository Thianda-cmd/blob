// Checks getting spreadsheet data in and out (src/sheet/io) and the note embed's pure parts
// (src/sheet/embed.ts) before you commit.
//
//   npm run check:sheet-io
//
//   - clipboard: Excel's and Google Sheets' TSV (German decimal commas, quoted cells with line
//     breaks and quotes), HTML tables from Excel, Sheets, Word and web pages (spans, <br>,
//     entities, Office markup), single values, and copying back out (TSV, HTML)
//   - CSV: separators (";" "," tab, Excel's "sep="), quotes, CRLF, BOM; export in both languages
//   - zip: CRC-32, stored and deflated round trips, a damaged file
//   - XLSX: a full round trip (several sheets, formulas incl. _xlfn functions, dates, number
//     formats, looks, widths, heights, frozen panes, smart tables, notes, charts with trendlines
//     and error bars) and the import of a hand-built file like other programs write (shared
//     formulas, inline strings, table and defined-name references, theme colours, an Excel
//     chart, things Blob skips)
//   - embed: reading block attributes, the table shown in a note, its Markdown
//   - reading files safely: zip and XML limits, crafted names ("constructor"), files of every kind
//     (text and HTML named .xls, old .xls, too many sheets, long formulas, too many series), and
//     long inputs that once took minutes (spaces, unclosed tags)
//   - clipboard numbers: pasting a spreadsheet's full numbers (Excel, LibreOffice, Google Sheets)
//     with its safeguards, copying numbers without their unit (and Excel's markup for them)
//   - round trips: smart-table totals and significant figures through .xlsx
//   - adding to a note: the one-time token; exports with each trendline's equation and R²
// Problems make the script exit with 1.

import { collectLinks } from "@/components/editor/links";
import { sheetEmbedTexts, withSheetEmbeds } from "@/components/editor/sheetEmbedExport";
import { noteSchema, plainTextOf } from "@/components/editor/schema";
import { noteToDocx } from "@/notes/docx";
import { noteToMarkdown } from "@/notes/markdown";
import { calcOf } from "@/components/editor/blocks/sheetEmbedCalc";
import { copySelection, pasteData } from "@/components/sheet/grid/clipboard";
import { appendWorkbook, freshIds, readSheetFile } from "@/components/sheet/importFile";
import { createSheetStore, type SheetStore } from "@/components/sheet/store";
import { sheetIoText } from "@/i18n/messages/sheetIo";
import { chartData } from "@/sheet/chart/data";
import { equationText, isFitError, r2Text } from "@/sheet/chart/regression";
import { addToNoteHref, embedFromParam, embedFromToken, embedTableMarkdown, embedTableModel, embedTarget, forgetEmbedToken, isEmbedToken, itemFromParam, readEmbedAttrs, readEmbedItem, sameItem, sheetItemHref, usedArea } from "@/sheet/embed";
import { createCalc } from "@/sheet/engine";
import { decodeHtmlEntities, parseClipboard, parseHtmlTable, toHtmlTable, toTsv } from "@/sheet/io/clipboard";
import { csvNumberLocale, detectSeparator, parseCsv, sheetToCsv } from "@/sheet/io/csv";
import { readSheetBytes } from "@/sheet/io/readFile";
import { exportXlsx, importXlsx, XlsxError } from "@/sheet/io/xlsx";
import { parseChartRef, trendLabelFormat } from "@/sheet/io/xlsxCharts";
import { importFormula, toFileFormula, type FileTable, type FormulaContext } from "@/sheet/io/xlsxFormulas";
import { fromExcelFormat, fromSigStyle, nearestSheetColor, sigStyleName, toExcelFormat } from "@/sheet/io/xlsxStyles";
import { attr, decodeEntities, lookup, parseXml, textOf, XmlError, xmlBudget } from "@/sheet/io/xml";
import { crc32, deflateRaw, inflateRaw, makeZip, readZip, ZipError } from "@/sheet/io/zip";
import type { Cell, ChartSpec, Sheet, Workbook } from "@/sheet/types";

const problems: string[] = [];
let checks = 0;

function fail(where: string, msg: string) {
  problems.push(`${where}: ${msg}`);
}

function eq(where: string, actual: unknown, expected: unknown) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) fail(where, `expected ${e}\n      got      ${a}`);
}

/** eq, whatever the order of keys in objects. */
function eqSorted(where: string, actual: unknown, expected: unknown) {
  eq(where, sortKeys(actual), sortKeys(expected));
}

function ok(where: string, cond: boolean, msg = "not true") {
  checks++;
  if (!cond) fail(where, msg);
}

const enc = new TextEncoder();
const dec = new TextDecoder();

// Clipboard ---------------------------------------------------------------------------------------

function clipboard() {
  // German Excel: TSV with "\r\n" after every row, decimal commas as shown.
  eq("excel tsv", parseClipboard({ text: "Konzentration\tExtinktion\r\n0,5\t0,123\r\n1,0\t0,247\r\n" }), [
    ["Konzentration", "Extinktion"],
    ["0,5", "0,123"],
    ["1,0", "0,247"],
  ]);
  // A cell with a line break and quotes, an empty cell, a cell starting with a quote that isn't one.
  eq("excel quoted", parseClipboard({ text: 'Probe\t"Zeile 1\nZeile ""2"""\t\r\n"Hallo" sagte sie\tx\r\n' }), [
    ["Probe", 'Zeile 1\nZeile "2"', ""],
    ['"Hallo" sagte sie', "x"],
  ]);
  // Google Sheets: no line break at the end.
  eq("sheets tsv", parseClipboard({ text: "a\tb\nc\td" }), [
    ["a", "b"],
    ["c", "d"],
  ]);
  eq("empty rows kept", parseClipboard({ text: "1\t2\r\n\t\r\n3\t4\r\n" }), [["1", "2"], ["", ""], ["3", "4"]]);
  eq("single value", parseClipboard({ text: "12,5" }), null);
  eq("single value with newline", parseClipboard({ text: "12,5\r\n" }), null);
  eq("one quoted cell with a line break", parseClipboard({ text: '"Zeile 1\nZeile 2"\r\n' }), [["Zeile 1\nZeile 2"]]);
  eq("column without tabs", parseClipboard({ text: "1\n2\n3" }), [["1"], ["2"], ["3"]]);
  eq("csv-ish semicolons", parseClipboard({ text: "Name;Wert\nA;1,5\nB;2,5" }), [["Name", "Wert"], ["A", "1,5"], ["B", "2,5"]]);
  eq("german numbers aren't csv", parseClipboard({ text: "1,5\n2,5" }), [["1,5"], ["2,5"]]);
  eq("english csv", parseClipboard({ text: "Name,Value\nA,1.5\nB,2.5" }), [["Name", "Value"], ["A", "1.5"], ["B", "2.5"]]);
  eq("sentence stays one value", parseClipboard({ text: "Erst das; dann das." }), null);
  eq("nothing", parseClipboard({ text: "" }), null);

  // Excel's HTML: Office markup, styles, conditional comments, <br> inside a cell, entities, spans.
  const excelHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta name=Generator content="Microsoft Excel 15"><style><!--table {mso-displayed-decimal-separator:"\\,";} .xl65 {mso-number-format:"0\\.00";}--></style></head>
<body link="#0563C1"><!--StartFragment-->
<table border=0 cellpadding=0 cellspacing=0 width=256 style='border-collapse: collapse;width:192pt'>
<!--[if gte mso 9]><xml><x:WorksheetOptions/></xml><![endif]-->
 <col width=64 span=4 style='width:48pt'>
 <tr height=20 style='height:15.0pt'>
  <td height=20 class=xl65 width=64 style='height:15.0pt;width:48pt'>Konz.&nbsp;(mg/L)</td>
  <td class=xl66 colspan=2 style='mso-ignore:colspan'>Messung &amp; Wiederholung</td>
  <td>&#956;g</td>
 </tr>
 <tr height=40 style='height:30.0pt'>
  <td height=40 align=right x:num="0.5">0,5</td>
  <td align=right x:num>0,123</td>
  <td align=right x:num>0,125</td>
  <td class=xl67 style='white-space:normal'>Zeile 1<br style='mso-data-placement:same-cell' />
  Zeile 2</td>
 </tr>
<!--EndFragment-->
</table></body></html>`;
  eq("excel html", parseClipboard({ text: "", html: excelHtml }), [
    ["Konz. (mg/L)", "Messung & Wiederholung", "", "μg"],
    ["0,5", "0,123", "0,125", "Zeile 1\nZeile 2"],
  ]);
  // Excel puts both on the clipboard: its TSV is exact and wins.
  eq("excel prefers tsv", parseClipboard({ text: "a  b\tc\r\n", html: excelHtml }), [["a  b", "c"]]);
  // Google Sheets' HTML.
  eq(
    "sheets html",
    parseClipboard({
      html: `<meta charset="utf-8"><google-sheets-html-origin><style type="text/css"><!--td {border: 1px solid #cccccc;}br {mso-data-placement:same-cell;}--></style><table xmlns="http://www.w3.org/1999/xhtml" cellspacing="0" cellpadding="0" dir="ltr" border="1" data-sheets-root="1"><colgroup><col width="100"/></colgroup><tbody><tr style="height:21px;"><td style="overflow:hidden" data-sheets-value="{&quot;1&quot;:2,&quot;2&quot;:&quot;Probe A&quot;}">Probe A</td><td data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:1.5}">1,5</td></tr></tbody></table>`,
    }),
    [["Probe A", "1,5"]],
  );
  // Word: paragraphs inside a cell; its text would break the table, so the HTML wins.
  eq(
    "word html",
    parseClipboard({
      text: "Probe\tWert\r\nA\r\nB\t1\r\n",
      html: `<html xmlns:w="urn:schemas-microsoft-com:office:word"><body><table class=MsoTableGrid><tr><td><p class=MsoNormal>Probe<o:p></o:p></p></td><td><p class=MsoNormal>Wert<o:p></o:p></p></td></tr><tr><td><p class=MsoNormal>A</p><p class=MsoNormal>B</p></td><td><p>1</p></td></tr></table></body></html>`,
    }),
    [["Probe", "Wert"], ["A\nB", "1"]],
  );
  // A web page with rowspan and a nested table.
  eq(
    "rowspan and nested",
    parseClipboard({ html: `<table><tr><th rowspan="2">Gruppe</th><th>x</th></tr><tr><td>1</td></tr><tr><td>A</td><td><table><tr><td>in</td><td>ner</td></tr></table></td></tr></table>` }),
    [["Gruppe", "x"], ["", "1"], ["A", "in ner"]],
  );
  eq("html single cell is one value", parseClipboard({ text: "Hallo", html: "<table><tr><td>Hallo</td></tr></table>" }), null);
  eq("html entities", parseClipboard({ html: "<table><tr><td>&lt;5&gt; &auml;&ouml;&uuml;&szlig; &#8211; &#x2264; &euro;</td><td>a&nbsp;&nbsp;b</td></tr></table>" }), [["<5> äöüß – ≤ €", "a  b"]]);

  // Copying out.
  eq("toTsv", toTsv([["a", "b\tc"], ['say "hi"', "line\nbreak"]]), 'a\t"b\tc"\n"say ""hi"""\t"line\nbreak"');
  eq("tsv round trip", parseClipboard({ text: toTsv([["x", 'Zeile 1\nZeile "2"'], ["1,5", ""]]) }), [["x", 'Zeile 1\nZeile "2"'], ["1,5", ""]]);
  const html = toHtmlTable([["<b>&", "2"], ["Zeile 1\nZeile 2", ""]], [[{ bold: true }, { align: "right" }], [null, null]]);
  ok("toHtmlTable escapes", html.includes("&lt;b&gt;&amp;") && !html.includes("<b>&<"), html);
  ok("toHtmlTable bold and align", html.includes("font-weight:bold") && html.includes("text-align:right"), html);
  ok("toHtmlTable line break", html.includes("Zeile 1<br>Zeile 2"), html);
  eq("html round trip", parseClipboard({ html }), [["<b>&", "2"], ["Zeile 1\nZeile 2", ""]]);
  // Blob's own copy: its exact TSV wins over its HTML (which would fold repeated spaces).
  eq("own copy prefers tsv", parseClipboard({ text: toTsv([["  a  b", "c"]]), html: toHtmlTable([["  a  b", "c"]]) }), [["  a  b", "c"]]);
}

// CSV ---------------------------------------------------------------------------------------------

function csv() {
  eq("separator ;", detectSeparator("Name;Wert\nA;1,5\nB;2,5\n"), ";");
  eq("separator ,", detectSeparator("Name,Value\nA,1.5\nB,2.5\n"), ",");
  eq("separator tab", detectSeparator("Name\tWert\nA\t1,5\n"), "\t");
  eq("separator from sep=", detectSeparator("sep=,\na;b,c\n"), ",");
  eq("separator: one German column", detectSeparator("Wert\n1,5\n2,5\n"), ";");
  eq("quoted separators don't count", detectSeparator('"a,b";c\n"d,e";f\n'), ";");

  eq("german csv with BOM and CRLF", parseCsv("\uFEFFProbe;Konz. (mg/L);Notiz\r\nA;1,5;\"mit ; Semikolon\"\r\nB;2,25;\"zwei\r\nZeilen\"\r\n"), [
    ["Probe", "Konz. (mg/L)", "Notiz"],
    ["A", "1,5", "mit ; Semikolon"],
    ["B", "2,25", "zwei\r\nZeilen"],
  ]);
  eq("english csv", parseCsv('name,value,comment\nA,1.5,"say ""hi"""\nB,2,\n\n'), [
    ["name", "value", "comment"],
    ["A", "1.5", 'say "hi"'],
    ["B", "2", ""],
  ]);
  eq("excel sep line", parseCsv("sep=;\na;b\n1;2\n"), [["a", "b"], ["1", "2"]]);
  eq("one column of German numbers", parseCsv("Wert\n1,5\n2,5\n"), [["Wert"], ["1,5"], ["2,5"]]);
  eq("tsv file", parseCsv("a\tb\n1\t2"), [["a", "b"], ["1", "2"]]);
  eq("numbers: german", csvNumberLocale([["x", "1,5"], ["y", "0,25"], ["z", "1.234,5"]], "en"), "de");
  eq("numbers: english", csvNumberLocale([["x", "1.5"], ["y", "0.250"], ["z", "1,234.5"]], "de"), "en");
  eq("numbers: ambiguous keeps the reader's", csvNumberLocale([["1.234"], ["2,500"], ["7"]], "de"), "de");

  const wb: Workbook = {
    v: 1,
    sheets: [
      sheet("s1", "Blatt 1", {
        "0,0": { v: "Probe" },
        "0,1": { v: "Konz." },
        "0,2": { v: "Datum" },
        "1,0": { v: "A; B" },
        "1,1": { v: 1.5, s: { fmt: { kind: "number", decimals: 2, unit: "mg/L" } } },
        "1,2": { v: 46327, s: { fmt: { kind: "date", style: "short" } } },
        "2,0": { v: "=gefährlich" },
        "2,1": { f: "B2*2" },
        "2,2": { v: -3.25 },
        "3,3": { v: true },
      }),
    ],
    charts: [],
    tables: [],
  };
  const calc = createCalc(wb, { locale: "de" });
  const de = sheetToCsv(wb, calc, "s1", "de");
  eq("csv de", de, "\uFEFFProbe;Konz.;Datum;\r\n\"A; B\";1,50;01.11.2026;\r\n'=gefährlich;3;-3,25;\r\n;;;WAHR\r\n");
  const en = sheetToCsv(wb, createCalc(wb, { locale: "en" }), "s1", "en");
  eq("csv en", en, "\uFEFFProbe,Konz.,Datum,\r\nA; B,1.50,11/1/2026,\r\n'=gefährlich,3,-3.25,\r\n,,,TRUE\r\n");
  eq("csv round trip", parseCsv(de), [
    ["Probe", "Konz.", "Datum", ""],
    ["A; B", "1,50", "01.11.2026", ""],
    ["'=gefährlich", "3", "-3,25", ""],
    ["", "", "", "WAHR"],
  ]);
}

// Zip ---------------------------------------------------------------------------------------------

async function zip() {
  eq("crc32 check value", crc32(enc.encode("123456789")).toString(16), "cbf43926");
  eq("crc32 empty", crc32(new Uint8Array()), 0);
  eq("crc32 quick brown fox", crc32(enc.encode("The quick brown fox jumps over the lazy dog")).toString(16), "414fa339");
  const big = enc.encode("Kalibriergerade ".repeat(2000));
  const files = [
    { name: "a.txt", data: enc.encode("hallo") },
    { name: "dir/b.xml", data: big },
    { name: "leer.txt", data: new Uint8Array() },
    { name: "umlaut/ä.txt", data: enc.encode("äöü") },
  ];
  for (const compress of [false, true]) {
    const bytes = await makeZip(files, { compress });
    const z = readZip(bytes);
    eq(`zip names (compress ${compress})`, z.names, ["a.txt", "dir/b.xml", "leer.txt", "umlaut/ä.txt"]);
    eq(`zip a (compress ${compress})`, await z.text("a.txt"), "hallo");
    eq(`zip big (compress ${compress})`, (await z.get("DIR/B.XML"))?.length, big.length);
    eq(`zip empty (compress ${compress})`, (await z.get("leer.txt"))?.length, 0);
    eq(`zip umlaut (compress ${compress})`, await z.text("umlaut/ä.txt"), "äöü");
    eq(`zip missing (compress ${compress})`, await z.get("nope"), null);
    if (compress) ok("deflate made it smaller", bytes.length < big.length / 4, `${bytes.length} bytes`);
    // The stored CRC matches the data (readZip checks it; a flipped byte must fail).
    const broken = bytes.slice();
    const at = broken.indexOf(0x68); // "h" of "hallo" in the stored or packed data
    broken[at] ^= 0xff;
    let threw = false;
    try {
      await readZip(broken).get("a.txt");
    } catch {
      threw = true;
    }
    if (!compress) ok("a damaged entry is noticed", threw);
  }
  let notZip = false;
  try {
    readZip(enc.encode("not a zip file at all, just text"));
  } catch {
    notZip = true;
  }
  ok("text isn't a zip", notZip);
}

// XLSX --------------------------------------------------------------------------------------------

function sheet(id: string, name: string, cells: Record<string, Cell>, extra: Partial<Sheet> = {}): Sheet {
  return { id, name, cells, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: 200, cols: 26 }, ...extra };
}

function formats() {
  const de = "de" as const;
  eq("fmt number 2", toExcelFormat({ kind: "number", decimals: 2 }, de), { id: 2 });
  eq("fmt number 3 unit", toExcelFormat({ kind: "number", decimals: 3, unit: "mg/L" }, de), { code: '0.000" mg/L"' });
  eq("fmt grouped", toExcelFormat({ kind: "number", decimals: 1, group: true }, de), { code: "#,##0.0" });
  eq("fmt percent 1", toExcelFormat({ kind: "percent", decimals: 1 }, de), { code: "0.0%" });
  eq("fmt sci", toExcelFormat({ kind: "scientific", decimals: 3 }, de), { code: "0.000E+00" });
  eq("fmt significant", toExcelFormat({ kind: "significant", digits: 3 }, de, 0.0012345), { code: "0.00000" });
  eq("fmt significant big", toExcelFormat({ kind: "significant", digits: 3 }, de, 123.45), { code: "0" });
  eq("fmt currency de", toExcelFormat({ kind: "currency", decimals: 2, symbol: "€" }, de), { code: '#,##0.00 "€"' });
  eq("fmt currency en", toExcelFormat({ kind: "currency", decimals: 2, symbol: "$" }, "en"), { code: '"$"#,##0.00' });
  eq("fmt date", toExcelFormat({ kind: "date", style: "short" }, de), { id: 14 });
  eq("fmt date long", toExcelFormat({ kind: "date", style: "long" }, de), { code: "[$-407]d. mmmm yyyy" });
  eq("fmt time", toExcelFormat({ kind: "time", seconds: true }, de), { code: "hh:mm:ss" });
  eq("fmt text", toExcelFormat({ kind: "text" }, de), { id: 49 });

  eq("read 0.00", fromExcelFormat("0.00", de), { kind: "number", decimals: 2 });
  eq("read #,##0.0", fromExcelFormat("#,##0.0", de), { kind: "number", decimals: 1, group: true });
  eq("read unit", fromExcelFormat('0.000" mg/L"', de), { kind: "number", decimals: 3, unit: "mg/L" });
  eq("read unit escaped", fromExcelFormat("0.0\\ \\°\\C", de), { kind: "number", decimals: 1, unit: "°C" });
  eq("read negatives in brackets", fromExcelFormat("#,##0.00_);[Red](#,##0.00)", de), { kind: "number", decimals: 2, group: true });
  eq("read percent", fromExcelFormat("0.0%", de), { kind: "percent", decimals: 1 });
  eq("read sci", fromExcelFormat("0.00E+00", de), { kind: "scientific", decimals: 2 });
  eq("read date", fromExcelFormat("dd/mm/yyyy", de), { kind: "date", style: "short" });
  eq("read date de", fromExcelFormat("DD.MM.YYYY", de), { kind: "date", style: "short" });
  eq("read date long", fromExcelFormat("[$-407]d. mmmm yyyy;@", de), { kind: "date", style: "long" });
  eq("read iso", fromExcelFormat("yyyy-mm-dd", de), { kind: "date", style: "iso" });
  eq("read time", fromExcelFormat("h:mm", de), { kind: "time", seconds: false });
  eq("read time s", fromExcelFormat("[h]:mm:ss", de), { kind: "time", seconds: true });
  eq("read datetime", fromExcelFormat("dd.mm.yyyy hh:mm", de), { kind: "datetime" });
  eq("read text", fromExcelFormat("@", de), { kind: "text" });
  eq("read currency", fromExcelFormat('#,##0.00 "€"', de), { kind: "currency", decimals: 2, symbol: "€" });
  eq("read currency tag", fromExcelFormat("[$€-407] #,##0.00", de), { kind: "currency", decimals: 2, symbol: "€" });
  eq("read accounting de", fromExcelFormat('_-* #,##0.00 €_-;-* #,##0.00 €_-;_-* "-"?? €_-;_-@_-', de), { kind: "currency", decimals: 2, symbol: "€" });
  eq("read fraction", fromExcelFormat("# ?/?", de), undefined);
  eq("read thousands scaling", fromExcelFormat("0,", de), undefined);
  eq("read general", fromExcelFormat("General", de), undefined);
  // Every Blob format survives the trip through a code (significant figures become decimals).
  for (const f of [
    { kind: "number", decimals: 4 },
    { kind: "number", decimals: 0, group: true },
    { kind: "number", decimals: 2, unit: "µmol/L" },
    { kind: "percent", decimals: 3 },
    { kind: "scientific", decimals: 1, unit: "Zellen/mL" },
    { kind: "currency", decimals: 2, symbol: "CHF" },
    { kind: "date", style: "iso" },
    { kind: "date", style: "long" },
    { kind: "time", seconds: false },
  ] as const) {
    const x = toExcelFormat(f, de);
    const back = "code" in x ? fromExcelFormat(x.code, de) : undefined;
    if ("code" in x) eq(`format round trip ${JSON.stringify(f)}`, back, f);
  }

  // Colours: Excel's usual ones land on the palette colour you'd expect.
  const cases: [string, "text" | "fill", string | null][] = [
    ["FF0000", "text", "red"],
    ["C00000", "text", "red"],
    ["000000", "text", null],
    ["FFFFFF", "fill", null],
    ["FFFF00", "fill", "yellow"],
    ["FFC000", "fill", "yellow"],
    ["ED7D31", "fill", "orange"],
    ["92D050", "fill", "green"],
    ["00B050", "text", "green"],
    ["0070C0", "text", "blue"],
    ["4472C4", "fill", "blue"],
    ["7030A0", "text", "purple"],
    ["D9D9D9", "fill", "gray"],
    ["808080", "text", "gray"],
    ["8D5A2B", "text", "brown"],
    ["FF66CC", "text", "pink"],
    ["DDE9FC", "fill", "blue"],
    ["FDE2DF", "fill", "red"],
    ["DCF1E1", "fill", "green"],
    ["0F8A83", "text", "teal"],
  ];
  for (const [rgb, kind, want] of cases) eq(`colour ${rgb} (${kind})`, nearestSheetColor(rgb, kind), want);

  // Formulas: newer functions get their prefix, and lose it again.
  eq("xlfn added", toFileFormula("STDEV.S(A1:A5)+IFS(A1>0,1,TRUE,0)+SUM(B1:B2)"), "_xlfn.STDEV.S(A1:A5)+_xlfn.IFS(A1>0,1,TRUE,0)+SUM(B1:B2)");
  eq("xlfn not in strings", toFileFormula('"STDEV.S(" & CONCAT(A1,"x")'), '"STDEV.S(" & _xlfn.CONCAT(A1,"x")');
  const table: FileTable = { name: "Kalibrierung", sheet: "Daten", area: { r0: 0, c0: 1, r1: 10, c1: 3 }, header: true, totals: true, columns: ["Konz", "Extinktion", "Probe [mg]"] };
  const ctx: FormulaContext = {
    tables: new Map([["KALIBRIERUNG", table]]),
    names: new Map([
      ["STEIGUNG", { global: "Daten!$F$1", local: new Map() }],
      ["FAKTOR", { global: "Daten!$F$2*2", local: new Map([["auswertung", "5"]]) }],
    ]),
    sheet: "Daten",
    row: 4,
    col: 4,
    tableAt: (s, r, c) => (s === "Daten" && r >= 0 && r <= 10 && c >= 1 && c <= 3 ? table : null),
  };
  eq("table column", importFormula("SUM(Kalibrierung[Extinktion])", ctx), { formula: "SUM($C$2:$C$10)" });
  eq("this row", importFormula("Kalibrierung[[#This Row],[Konz]]*2", ctx), { formula: "$B5*2" });
  eq("at column", importFormula("[@Extinktion]/[@Konz]", { ...ctx, col: 2 }), { formula: "$C5/$B5" });
  eq("no such column", importFormula("AVERAGE(Kalibrierung['[mg']])", ctx), { problem: "table-ref" });
  eq("escaped column name", importFormula("MAX(Kalibrierung[Probe '[mg']])", ctx), { formula: "MAX($D$2:$D$10)" });
  eq("column range", importFormula("SUM(Kalibrierung[[Konz]:[Extinktion]])", ctx), { formula: "SUM($B$2:$C$10)" });
  eq("totals and headers", importFormula("Kalibrierung[[#Totals],[Konz]]&Kalibrierung[[#Headers],[Konz]]", ctx), { formula: "$B$11&$B$1" });
  eq("whole table", importFormula("ROWS(Kalibrierung[#All])+ROWS(Kalibrierung)", ctx), { formula: "ROWS($B$1:$D$11)+ROWS($B$2:$D$10)" });
  eq("other sheet", importFormula("SUM(Kalibrierung[Konz])", { ...ctx, sheet: "Auswertung" }), { formula: "SUM(Daten!$B$2:$B$10)" });
  eq("defined names", importFormula("A1*Steigung+faktor", ctx), { formula: "A1*Daten!$F$1+(Daten!$F$2*2)" });
  eq("local name", importFormula("Faktor*2", { ...ctx, sheet: "Auswertung" }), { formula: "5*2" });
  eq("names are not functions or cells", importFormula("STEIGUNG(A1)+B2+TRUE", ctx), { formula: "STEIGUNG(A1)+B2+TRUE" });
  eq("prefixes dropped", importFormula("_xlfn.STDEV.S(A1:A3)+_xlfn._xlws.SORT(B1:B2)", ctx), { formula: "STDEV.S(A1:A3)+SORT(B1:B2)" });
  eq("other files", importFormula("[1]Blatt1!A1+2", ctx), { problem: "external" });
  eq("other files quoted", importFormula("'[2]Blatt 1'!A1", ctx), { problem: "external" });
  eq("unknown column", importFormula("SUM(Kalibrierung[Nope])", ctx), { problem: "table-ref" });
}

/** A workbook with what a lab student uses, for the round trip. */
function labWorkbook(): Workbook {
  const s1 = sheet(
    "s1",
    "Kalibrierung",
    {
      "0,0": { v: "Konzentration (mg/L)", s: { bold: true } },
      "0,1": { v: "Extinktion" },
      "0,2": { v: "Probe" },
      "1,0": { v: 0 },
      "1,1": { v: 0.002, s: { fmt: { kind: "number", decimals: 3 } } },
      "1,2": { v: "Blindwert" },
      "2,0": { v: 5 },
      "2,1": { v: 0.263, s: { fmt: { kind: "number", decimals: 3 } } },
      "2,2": { v: "A" },
      "3,0": { v: 10 },
      "3,1": { v: 0.526, s: { fmt: { kind: "number", decimals: 3 } } },
      "3,2": { v: "B" },
      "4,0": { v: "Mittelwert" },
      "4,1": { f: "SUBTOTAL(101,B2:B4)" },
      "6,0": { v: "Steigung", s: { italic: true, color: "blue" } },
      "6,1": { f: "SLOPE(B2:B4,A2:A4)", s: { fmt: { kind: "number", decimals: 4 }, fill: "yellow", border: { top: "thin", bottom: "double" } } },
      "7,0": { v: "R²", note: "Bestimmtheitsmaß" },
      "7,1": { f: "RSQ(B2:B4,A2:A4)", s: { fmt: { kind: "significant", digits: 4 } } },
      "8,0": { v: "STABW.S" },
      "8,1": { f: "STDEV.S(B2:B4)", s: { fmt: { kind: "scientific", decimals: 2 } } },
      "9,0": { v: "Datum" },
      "9,1": { v: 46327, s: { fmt: { kind: "date", style: "short" } } },
      "10,0": { v: "Uhrzeit" },
      "10,1": { v: 0.6041666666666666, s: { fmt: { kind: "time", seconds: false } } },
      "11,0": { v: "Anteil" },
      "11,1": { v: 0.256, s: { fmt: { kind: "percent", decimals: 1 }, align: "center", valign: "top", wrap: true, size: 18, underline: true, strike: true } },
      "12,0": { v: "Masse" },
      "12,1": { v: 12.5, s: { fmt: { kind: "number", decimals: 2, unit: "mg/L" } } },
      "13,0": { v: "Text \"mit\" <Zeichen> & _x0041_" },
      "13,1": { f: "'Blatt 2 (Rohdaten)'!A1*2" },
      "14,0": { v: "Zeile 1\nZeile 2", s: { wrap: true } },
      "14,1": { v: true },
      "15,0": { v: "007", s: { fmt: { kind: "text" } } },
      "15,1": { f: 'IF(B15,"ja","nein")' },
    },
    { cols: { "0": { w: 180 }, "3": { hidden: true } }, rows: { "0": { h: 40 }, "16": { hidden: true } }, freeze: { rows: 1, cols: 1 } },
  );
  const s2 = sheet("s2", "Blatt 2 (Rohdaten)", { "0,0": { v: 21 }, "1,0": { f: "A1/0" }, "2,0": { v: -0.5 }, "3,0": { v: 1e-7 } });
  const s3 = sheet("s3", "Leer", {});
  return {
    v: 1,
    sheets: [s1, s2, s3],
    charts: [
      {
        id: "c1",
        sheetId: "s1",
        at: { row: 1, col: 5, dx: 12, dy: 4 },
        size: { w: 480, h: 300 },
        kind: "scatter",
        title: "Kalibriergerade",
        x: { sheetId: "s1", r0: 1, c0: 0, r1: 3, c1: 0 },
        series: [
          {
            id: "a",
            name: "",
            nameRef: { sheetId: "s1", r0: 0, c0: 1, r1: 0, c1: 1 },
            y: { sheetId: "s1", r0: 1, c0: 1, r1: 3, c1: 1 },
            x: null,
            color: "purple",
            marker: "diamond",
            line: "none",
            labels: false,
            errorBars: { kind: "percent", value: 5, plus: null, minus: null, direction: "both" },
            trendline: { type: "linear", order: 2, period: 2, intercept: 0, showEquation: true, showR2: true, forward: 2, backward: 0, name: "" },
          },
        ],
        xAxis: { title: "Konzentration (mg/L)", min: 0, max: 12, log: false, grid: true, decimals: null },
        yAxis: { title: "Extinktion", min: null, max: null, log: false, grid: true, decimals: 2 },
        legend: "none",
      },
      {
        id: "c2",
        sheetId: "s2",
        at: { row: 0, col: 2, dx: 0, dy: 0 },
        size: { w: 400, h: 260 },
        kind: "column",
        title: "",
        x: { sheetId: "s1", r0: 1, c0: 2, r1: 3, c1: 2 },
        series: [{ id: "b", name: "Werte", nameRef: null, y: { sheetId: "s1", r0: 1, c0: 0, r1: 3, c1: 0 }, x: null, color: null, marker: "none", line: "none", labels: true, errorBars: null, trendline: null }],
        xAxis: { title: "", min: null, max: null, log: false, grid: false, decimals: null },
        yAxis: { title: "", min: null, max: null, log: true, grid: true, decimals: null },
        legend: "bottom",
      },
    ],
    tables: [
      {
        id: "t1",
        sheetId: "s1",
        name: "Messwerte",
        area: { r0: 0, c0: 0, r1: 4, c1: 2 },
        columns: [
          { id: "c1", total: "none" },
          { id: "c2", total: "average" },
          { id: "c3", total: "none" },
        ],
        totals: true,
        style: "teal",
        banded: false,
        filters: {},
        sort: null,
      },
    ],
  };
}

async function xlsxRoundTrip() {
  const wb = labWorkbook();
  const calc = createCalc(wb, { locale: "de" });
  const blob = await exportXlsx(wb, calc, "de");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  ok("xlsx type", blob.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", blob.type);
  // The parts are where Excel looks for them, and every one is well-formed XML.
  const z = readZip(bytes);
  for (const part of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/sharedStrings.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet3.xml", "xl/tables/table1.xml", "xl/comments1.xml", "xl/drawings/vmlDrawing1.vml", "xl/drawings/drawing1.xml", "xl/charts/chart1.xml", "xl/charts/chart2.xml"]) {
    ok(`part ${part}`, z.has(part), "missing");
  }
  eq("first part", z.names[0], "[Content_Types].xml");
  for (const name of z.names) {
    try {
      parseXml((await z.text(name)) ?? "");
    } catch (e) {
      fail(`xml ${name}`, String(e));
    }
  }
  const sheet1 = (await z.text("xl/worksheets/sheet1.xml")) ?? "";
  ok("stdev.s has its prefix", sheet1.includes("<f>_xlfn.STDEV.S(B2:B4)</f>"), "no _xlfn.STDEV.S");
  ok("cached values", /<f>SLOPE\(B2:B4,A2:A4\)<\/f><v>0\.0524/.test(sheet1), "no cached slope");
  ok("string result", sheet1.includes('t="str"><f>IF(B15,&quot;ja&quot;,&quot;nein&quot;)</f><v>ja</v>') || sheet1.includes('t="str"><f>IF(B15,"ja","nein")</f><v>ja</v>'), "no string result");
  ok("frozen pane", sheet1.includes('xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"'), "no pane");
  const sst = (await z.text("xl/sharedStrings.xml")) ?? "";
  ok("escapes in shared strings", sst.includes("Text &quot;mit&quot; &lt;Zeichen&gt; &amp; _x005F_x0041_") || sst.includes('Text "mit" &lt;Zeichen&gt; &amp; _x005F_x0041_'), "escaping");
  const table = (await z.text("xl/tables/table1.xml")) ?? "";
  ok("table style", table.includes('tableStyleInfo name="Blob teal"'), table);
  ok("table totals formula", table.includes("<totalsRowFormula>SUBTOTAL(101,B2:B4)</totalsRowFormula>"), table);
  const styles = (await z.text("xl/styles.xml")) ?? "";
  ok("custom formats", styles.includes('formatCode="0.00&quot; mg/L&quot;"'), "no unit format");

  const { workbook: back, skipped } = await importXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "de");
  eq("round trip skipped", skipped, []);
  eq("sheet names", back.sheets.map((s) => s.name), ["Kalibrierung", "Blatt 2 (Rohdaten)", "Leer"]);
  const a = wb.sheets[0];
  const b = back.sheets[0];
  // Values, formulas, notes and looks come back exactly; significant figures too, through the
  // named cell style Blob gives them (Excel has no such number format, see sigStyleName).
  ok("significant figures as a named style", styles.includes('<cellStyle name="Blob sig 4" xfId="1"/>'), styles.slice(styles.indexOf("<cellStyles")));
  const expectStyle = (key: string) => a.cells[key]?.s;
  for (const key of Object.keys(a.cells)) {
    const want = a.cells[key];
    const got = b.cells[key];
    eq(`cell ${key} value`, got?.v, want.v);
    eq(`cell ${key} formula`, got?.f, want.f);
    eq(`cell ${key} note`, got?.note, want.note);
    eq(`cell ${key} look`, sortKeys(got?.s), sortKeys(expectStyle(key)));
  }
  eq("no extra cells", Object.keys(b.cells).sort(), Object.keys(a.cells).sort());
  eq("widths", b.cols, { "0": { w: 180 }, "3": { hidden: true } });
  eq("heights", b.rows, { "0": { h: 40 }, "16": { hidden: true } });
  eq("freeze", b.freeze, { rows: 1, cols: 1 });
  eq("sheet 2", back.sheets[1].cells, wb.sheets[1].cells);
  eq("empty sheet", back.sheets[2].cells, {});
  // Charts come back as they were (ids are new).
  eq("charts", back.charts.length, 2);
  const strip = (c: Workbook["charts"][number], ids: Map<string, string>) => ({
    ...c,
    id: undefined,
    sheetId: ids.get(c.sheetId),
    x: c.x && { ...c.x, sheetId: ids.get(c.x.sheetId) },
    series: c.series.map((x) => ({ ...x, id: undefined, y: { ...x.y, sheetId: ids.get(x.y.sheetId) }, nameRef: x.nameRef && { ...x.nameRef, sheetId: ids.get(x.nameRef.sheetId) } })),
  });
  const before = new Map(wb.sheets.map((x) => [x.id, x.name]));
  const after = new Map(back.sheets.map((x) => [x.id, x.name]));
  eq("scatter chart", sortKeys(strip(back.charts[0], after)), sortKeys(strip(wb.charts[0], before)));
  eq("column chart", sortKeys(strip(back.charts[1], after)), sortKeys(strip(wb.charts[1], before)));
  eq("tables", back.tables.length, 1);
  const t = back.tables[0];
  eq("table", { name: t.name, area: t.area, totals: t.totals, style: t.style, banded: t.banded, sheet: t.sheetId === b.id, columns: t.columns.length }, { name: "Messwerte", area: { r0: 0, c0: 0, r1: 4, c1: 2 }, totals: true, style: "teal", banded: false, sheet: true, columns: 3 });
  // The recalculated values agree with Blob's (the file carries Blob's results too).
  const calc2 = createCalc(back, { locale: "de" });
  eq("recalculated slope", calc2.value(b.id, 6, 1), calc.value("s1", 6, 1));
  eq("recalculated cross-sheet", calc2.value(b.id, 13, 1), 42);
}

function sortKeys(o: unknown): unknown {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (!o || typeof o !== "object") return o;
  return Object.fromEntries(
    Object.entries(o as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([k, v]) => [k, sortKeys(v)]),
  );
}

/** A minimal .xlsx as other programs write it (no shared strings part for some, inline strings, shared formulas…). */
async function handBuilt(): Promise<Uint8Array> {
  const parts: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="R1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="/xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookPr date1904="false"/>
  <sheets>
    <sheet name="Daten" sheetId="5" r:id="rIdA"/>
    <sheet name="Diagramm1" sheetId="6" r:id="rIdC"/>
    <sheet name="Auswertung" sheetId="7" r:id="rIdB"/>
  </sheets>
  <definedNames>
    <definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Daten!$A$1:$C$4</definedName>
    <definedName name="Faktor">Daten!$E$1</definedName>
  </definedNames>
</workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdA" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/data.xml"/>
<Relationship Id="rIdB" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/../worksheets/result.xml"/>
<Relationship Id="rIdC" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chartsheet" Target="chartsheets/sheet1.xml"/>
<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rIdT" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
<Relationship Id="rIdTh" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`,
    "xl/theme/theme1.xml": `<?xml version="1.0"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme></a:themeElements></a:theme>`,
    "xl/styles.xml": `<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy;@"/><numFmt numFmtId="165" formatCode="0.000&quot; mg/L&quot;"/></numFmts>
<fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="12"/><color theme="4"/><name val="Arial"/></font><font><i/><sz val="10"/><color indexed="10"/><name val="Arial"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor theme="9" tint="0.59999389629810485"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="medium"><color auto="1"/></top><bottom style="hair"/><diagonal/></border></borders>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="1" fillId="2" borderId="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="10" fontId="2" fillId="0" borderId="0"/>
<xf numFmtId="49" fontId="0" fillId="0" borderId="0"/>
</cellXfs></styleSheet>`,
    "xl/sharedStrings.xml": `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">
<si><t>Konz</t></si>
<si><r><t>Ext</t></r><r><rPr><b/></rPr><t>inktion</t></r><rPh sb="0" eb="1"><t>ignored</t></rPh></si>
<si><t xml:space="preserve"> mit Leerzeichen </t></si>
<si><t>Zeile 1_x000D_
Zeile 2</t></si>
</sst>`,
    "xl/worksheets/data.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">
<sheetViews><sheetView workbookViewId="0"><pane xSplit="0" ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols><col min="1" max="2" width="20" customWidth="1"/><col min="4" max="16384" width="9.140625" style="3"/></cols>
<sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>Doppelt</t></is></c><c r="E1"><v>3</v></c></row>
<row r="2"><c r="A2"><v>1</v></c><c r="B2" s="2"><v>0.1</v></c><c r="C2"><f t="shared" ref="C2:C4" si="0">Tabelle1[[#This Row],[Extinktion]]*2</f><v>0.2</v></c></row>
<row r="3" ht="30" customHeight="1"><c r="A3"><v>2</v></c><c r="B3" s="2"><v>0.2</v></c><c r="C3"><f t="shared" si="0"/><v>0.4</v></c></row>
<row r="4" hidden="1"><c r="A4"><v>3</v></c><c r="B4" s="2"><v>0.3</v></c><c r="C4"><f t="shared" si="0"/><v>0.6</v></c></row>
<row r="6"><c r="A6" t="d"><v>2026-11-01T12:00:00</v></c><c r="B6" s="1"><v>46327</v></c><c r="C6" t="e"><v>#N/A</v></c><c r="D6" t="b"><v>1</v></c></row>
<row r="7"><c r="A7" s="3"><v>0.256</v></c><c r="B7" t="s"><v>2</v></c><c r="C7" t="s"><v>3</v></c><c r="D7" s="4" t="inlineStr"><is><t>007</t></is></c></row>
<row r="8"><c r="A8"><f>SUM(Tabelle1[Konz])*Faktor</f><v>18</v></c><c r="B8"><f>[1]Extern!A1</f><v>99</v></c><c r="C8"><f>_xlfn.AGGREGATE(9,6,A2:A4)</f><v>6</v></c><c r="D8"><f>_xlfn.STDEV.S(A2:A4)</f><v>1</v></c></row>
<row r="9"><c r="A9"><f t="array" ref="A9">SUM(A2:A4*B2:B4)</f><v>1.4</v></c></row>
</sheetData>
<mergeCells count="2"><mergeCell ref="A10:B10"/><mergeCell ref="C10:D11"/></mergeCells>
<conditionalFormatting sqref="B2:B4"><cfRule type="cellIs" dxfId="0" priority="1" operator="greaterThan"><formula>0.2</formula></cfRule></conditionalFormatting>
<dataValidations count="1"><dataValidation type="list" sqref="C2"><formula1>"A,B"</formula1></dataValidation></dataValidations>
<hyperlinks><hyperlink ref="A1" r:id="rIdH"/></hyperlinks>
<drawing r:id="rIdD"/>
<legacyDrawing r:id="rIdV"/>
<tableParts count="1"><tablePart r:id="rIdTab"/></tableParts>
</worksheet>`,
    "xl/worksheets/_rels/data.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdTab" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/>
<Relationship Id="rIdD" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
<Relationship Id="rIdH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.org" TargetMode="External"/>
<Relationship Id="rIdC" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments1.xml"/>
<Relationship Id="rIdV" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing1.vml"/>
</Relationships>`,
    "xl/tables/table1.xml": `<?xml version="1.0"?><table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="Tabelle1" displayName="Tabelle1" ref="A1:C4" totalsRowShown="0">
<autoFilter ref="A1:C4"><filterColumn colId="0"><customFilters and="1"><customFilter operator="greaterThanOrEqual" val="1"/><customFilter operator="lessThanOrEqual" val="2"/></customFilters></filterColumn></autoFilter>
<tableColumns count="3"><tableColumn id="1" name="Konz"/><tableColumn id="2" name="Extinktion"/><tableColumn id="3" name="Doppelt"/></tableColumns>
<tableStyleInfo name="TableStyleMedium7" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`,
    "xl/drawings/drawing1.xml": `<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
<xdr:twoCellAnchor><xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>4</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>9</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame><a:graphic><a:graphicData><c:chart r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>
<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>5</xdr:col><xdr:colOff>95250</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>10</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>17</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame><a:graphic><a:graphicData><c:chart r:id="rId2" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>
<xdr:oneCellAnchor><xdr:from/><xdr:pic><xdr:nvPicPr/></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>
</xdr:wsDr>`,
    "xl/drawings/_rels/drawing1.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart2.xml"/>
</Relationships>`,
    "xl/charts/chart1.xml": `<?xml version="1.0"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart><c:plotArea><c:bar3DChart><c:barDir val="col"/></c:bar3DChart></c:plotArea></c:chart></c:chartSpace>`,
    "xl/charts/chart2.xml": `<?xml version="1.0"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart>
<c:title><c:tx><c:rich><a:p><a:r><a:t>Wachstum</a:t></a:r><a:r><a:t>skurve</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>
<c:plotArea><c:layout/><c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>
<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:strRef><c:f>Daten!$B$1</c:f></c:strRef></c:tx>
<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr>
<c:marker><c:symbol val="triangle"/><c:size val="7"/><c:spPr><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></c:spPr></c:marker>
<c:trendline><c:trendlineType val="poly"/><c:order val="2"/><c:dispRSqr val="1"/><c:dispEq val="0"/></c:trendline>
<c:errBars><c:errDir val="x"/><c:errBarType val="both"/><c:errValType val="fixedVal"/><c:val val="1"/></c:errBars>
<c:errBars><c:errDir val="y"/><c:errBarType val="plus"/><c:errValType val="stdDev"/><c:val val="2"/></c:errBars>
<c:xVal><c:numRef><c:f>Daten!$A$2:$A$4</c:f></c:numRef></c:xVal><c:yVal><c:numRef><c:f>Daten!$B$2:$B$4</c:f></c:numRef></c:yVal><c:smooth val="0"/></c:ser>
<c:axId val="1"/><c:axId val="2"/></c:scatterChart>
<c:valAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/><c:max val="4"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:title><c:tx><c:rich><a:p><a:r><a:t>Zeit (h)</a:t></a:r></a:p></c:rich></c:tx></c:title><c:numFmt formatCode="0.0" sourceLinked="0"/><c:crossAx val="2"/></c:valAx>
<c:valAx><c:axId val="2"/><c:scaling><c:logBase val="10"/><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="General" sourceLinked="1"/><c:crossAx val="1"/></c:valAx>
</c:plotArea><c:legend><c:legendPos val="r"/></c:legend></c:chart></c:chartSpace>`,
    "xl/comments1.xml": `<?xml version="1.0"?><comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><authors><author>Lena</author></authors><commentList><comment ref="B2" authorId="0"><text><r><rPr><b/></rPr><t>Lena:</t></r><r><t xml:space="preserve">
Probe 1:10 verdünnt</t></r></text></comment></commentList></comments>`,
    "xl/drawings/vmlDrawing1.vml": `<xml></xml>`,
    "xl/worksheets/result.xml": `<?xml version="1.0"?><worksheet xmlns="http://purl.oclc.org/ooxml/spreadsheetml/main"><sheetData><row><c><v>1</v></c><c><f>Daten!A2+1</f></c></row></sheetData></worksheet>`,
  };
  return makeZip(Object.entries(parts).map(([name, data]) => ({ name, data: enc.encode(data) })));
}

async function xlsxImport() {
  const bytes = await handBuilt();
  const { workbook, skipped } = await importXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, "de");
  eq("hand sheets", workbook.sheets.map((s) => s.name), ["Daten", "Auswertung"]);
  const d = workbook.sheets[0];
  const c = (k: string) => d.cells[k];
  eq("shared string", c("0,0")?.v, "Konz");
  eq("rich text", c("0,1")?.v, "Extinktion");
  eq("inline string", c("0,2")?.v, "Doppelt");
  eq("spaces kept", c("6,1")?.v, " mit Leerzeichen ");
  eq("escaped line break", c("6,2")?.v, "Zeile 1\r\nZeile 2");
  eq("shared formula master", c("1,2")?.f, "$B2*2");
  eq("shared formula shifted", [c("2,2")?.f, c("3,2")?.f], ["$B3*2", "$B4*2"]);
  eq("date cell", c("5,0"), { s: { fmt: { kind: "date", style: "short" } }, v: 46327.5 });
  eq("date format", c("5,1")?.s?.fmt, { kind: "date", style: "short" });
  eq("error value", c("5,2")?.f, "#N/A");
  eq("boolean", c("5,3")?.v, true);
  eq("percent", c("6,0")?.s?.fmt, { kind: "percent", decimals: 2 });
  eq("indexed colour", c("6,0")?.s?.color, "red");
  eq("text format keeps 007", c("6,3"), { s: { fmt: { kind: "text" } }, v: "007" });
  eq("defined name and table", c("7,0")?.f, "SUM($A$2:$A$4)*Daten!$E$1");
  eq("external kept as value", c("7,1"), { v: 99 });
  eq("unknown function kept as value", c("7,2"), { v: 6 });
  eq("_xlfn dropped", c("7,3")?.f, "STDEV.S(A2:A4)");
  eq("array formula", c("8,0")?.f, "SUM(A2:A4*B2:B4)");
  const look = c("1,1")?.s;
  eq("look", look, { bold: true, size: 16, color: "blue", fill: "green", border: { top: "thick", bottom: "thin" }, align: "center", wrap: true, fmt: { kind: "number", decimals: 3, unit: "mg/L" } });
  eq("note without author", c("1,1")?.note, "Probe 1:10 verdünnt");
  eq("widths", d.cols, { "0": { w: 140 }, "1": { w: 140 } });
  eq("rows: filter-hidden row isn't hidden by hand", d.rows, { "2": { h: 40 } });
  eq("frozen", d.freeze, { rows: 1, cols: 0 });
  const t = workbook.tables[0];
  eq("table", t && { name: t.name, area: t.area, totals: t.totals, style: t.style, banded: t.banded, filter: Object.values(t.filters) }, { name: "Tabelle1", area: { r0: 0, c0: 0, r1: 3, c1: 2 }, totals: false, style: "green", banded: true, filter: [{ kind: "number", op: "between", a: 1, b: 2 }] });
  // The strict namespace and cells without addresses.
  const r = workbook.sheets[1];
  eq("strict sheet", [r.cells["0,0"]?.v, r.cells["0,1"]?.f], [1, "Daten!A2+1"]);
  // The scatter chart comes over (the 3-D one can't).
  eq("imported charts", workbook.charts.length, 1);
  const ch = workbook.charts[0];
  eqSorted(
    "imported chart",
    ch && {
      kind: ch.kind,
      title: ch.title,
      at: ch.at,
      size: ch.size,
      sheet: ch.sheetId === d.id,
      x: ch.x && { ...ch.x, sheetId: ch.x.sheetId === d.id },
      s: ch.series.map((x) => ({ y: { ...x.y, sheetId: x.y.sheetId === d.id }, name: x.nameRef && { ...x.nameRef, sheetId: undefined }, color: x.color, marker: x.marker, line: x.line, tl: x.trendline && [x.trendline.type, x.trendline.order, x.trendline.showR2, x.trendline.showEquation], eb: x.errorBars })),
      xAxis: ch.xAxis,
      yAxis: ch.yAxis,
      legend: ch.legend,
    },
    {
      kind: "scatter",
      title: "Wachstumskurve",
      at: { row: 2, col: 5, dx: 10, dy: 0 },
      // Columns F:J are Excel's 64 px; rows 3–17 are 20 px, but row 3 is 40 px and row 4 hidden.
      size: { w: 64 + 64 + 64 + 64 + 64 - 10, h: 40 + 0 + 20 * 13 },
      sheet: true,
      x: { r0: 1, c0: 0, r1: 3, c1: 0, sheetId: true },
      s: [{ y: { r0: 1, c0: 1, r1: 3, c1: 1, sheetId: true }, name: { r0: 0, c0: 1, r1: 0, c1: 1 }, color: "orange", marker: "triangle", line: "none", tl: ["polynomial", 2, true, false], eb: { kind: "stdev", value: 2, plus: null, minus: null, direction: "plus" } }],
      xAxis: { title: "Zeit (h)", min: 0, max: 4, log: false, grid: false, decimals: 1 },
      yAxis: { title: "", min: null, max: null, log: true, grid: true, decimals: null },
      legend: "right",
    },
  );
  eq("trendline label format", [trendLabelFormat({ type: "linear", coefficients: [0.0022, 0.0524], r2: 0.9998, n: 5, predict: () => 0 }), trendLabelFormat({ type: "linear", coefficients: [12.5, 340], r2: 1, n: 3, predict: () => 0 }), trendLabelFormat({ type: "exponential", coefficients: [3e-7, 0.7], r2: 1, n: 3, predict: () => 0 })], ["0.0#####", "0.0###", "0.000E+00"]);
  // Excel uses one format for equation and R²: with R² shown it gets the decimals that keep 0,99997
  // from reading "1,0" (Blob's own label never shows a false 1 either).
  eq("trendline label format keeps R² below 1", [trendLabelFormat({ type: "linear", coefficients: [12.5, 340], r2: 0.99997, n: 3, predict: () => 0 }), trendLabelFormat({ type: "linear", coefficients: [12.5, 340], r2: 0.99997, n: 3, predict: () => 0 }, false), trendLabelFormat({ type: "linear", coefficients: [12.5, 340], r2: 0.9999996, n: 3, predict: () => 0 }), trendLabelFormat({ type: "exponential", coefficients: [3e-7, 0.7], r2: 0.99997, n: 3, predict: () => 0 })], ["0.0####", "0.0###", "0.0######", "0.0000E+00"]);

  eq("skipped", skipped, [
    "2 verbundene Zellbereiche (der Text steht jeweils in der ersten Zelle)",
    "1 Diagramm, das Blob nicht zeichnen kann (3D, Ring, Netz …)",
    "1 Diagrammblatt",
    "1 Bild",
    "1 bedingte Formatierung",
    "1 Datenüberprüfung (Auswahlliste oder Eingaberegel)",
    "1 Link (der Text bleibt)",
    "1 Formel mit Funktionen, die Blob nicht kennt (AGGREGATE; ihr Ergebnis steht als Wert in der Zelle)",
    "1 Formel mit Bezügen auf andere Dateien (ihr Ergebnis steht als Wert in der Zelle)",
    "1 Matrixformel (nur ihr erstes Ergebnis wird berechnet)",
  ]);

  // Files that aren't .xlsx say so in words.
  const tryImport = async (data: Uint8Array) => {
    try {
      await importXlsx(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, "de");
      return "ok";
    } catch (e) {
      return e instanceof XlsxError ? e.code : `other: ${String(e)}`;
    }
  };
  eq("text file", await tryImport(enc.encode("Name;Wert\n")), "notXlsx");
  const ole = new Uint8Array(4096);
  ole.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  eq("old xls", await tryImport(ole), "oldXls");
  const enc16 = new Uint8Array([..."EncryptionInfo"].flatMap((ch) => [ch.charCodeAt(0), 0]));
  ole.set(enc16, 1024);
  eq("encrypted", await tryImport(ole), "encrypted");
  eq("ods", await tryImport(await makeZip([{ name: "mimetype", data: enc.encode("application/vnd.oasis.opendocument.spreadsheet") }])), "ods");
  eq("word file", await tryImport(await makeZip([{ name: "word/document.xml", data: enc.encode("<w:document/>") }])), "notXlsx");
  eq("broken zip", await tryImport((await handBuilt()).slice(0, 300)), "broken");
}

function xml() {
  const root = parseXml(`<?xml version="1.0"?><!-- c --><!DOCTYPE x [<!ENTITY a "b">]><a:root xmlns:a="u" a:x='1 &amp; 2'><b>t&lt;&#228;&#x2264;</b><![CDATA[<raw>]]><c/><t xml:space="preserve">  </t></a:root>`);
  eq("xml root", [root.name, root.local, attr(root, "a:x"), attr(root, "x")], ["a:root", "root", "1 & 2", "1 & 2"]);
  eq("xml text", textOf(root), "t<ä≤<raw>  ");
  let threw = false;
  try {
    parseXml("<a><b></a");
  } catch {
    threw = true;
  }
  ok("broken xml throws", threw);
  void dec;
}

// Embed ------------------------------------------------------------------------------------------

async function embed() {
  const page = "0b5f3c1e-9a2d-4c7e-8f10-2b3c4d5e6f70";
  // Attributes from documents and addresses are checked.
  eq("item chart", readEmbedItem({ kind: "chart", chartId: "c1" }), { kind: "chart", chartId: "c1" });
  eq("item range normalised", readEmbedItem({ kind: "range", sheetId: "s1", area: { r0: 5, c0: 3, r1: 0, c1: 0 } }), { kind: "range", sheetId: "s1", area: { r0: 0, c0: 0, r1: 5, c1: 3 } });
  eq("item range out of bounds", readEmbedItem({ kind: "range", sheetId: "s1", area: { r0: 0, c0: 0, r1: 99999, c1: 1 } }), null);
  eq("item without id (a fresh block)", readEmbedItem({ kind: "chart" }), null);
  eq("item junk", readEmbedItem({ kind: "chart", chartId: "<script>" }), null);
  eq("attrs need a uuid", readEmbedAttrs({ pageId: "nope", item: { kind: "table", tableId: "t1" } }), null);
  const attrs = { pageId: page, item: { kind: "range" as const, sheetId: "s1", area: { r0: 0, c0: 0, r1: 3, c1: 2 } } };
  const href = addToNoteHref("11111111-2222-4333-8444-555555555555", attrs);
  ok("href", href.startsWith("/p/11111111-2222-4333-8444-555555555555?sheetEmbed=%7B"), href);
  eq("param round trip", embedFromParam(new URL(href, "https://blob.test").searchParams.get("sheetEmbed")), attrs);
  // "Öffnen" on a block: the spreadsheet's address with the item to select.
  for (const item of [attrs.item, { kind: "chart" as const, chartId: "chart1" }, { kind: "table" as const, tableId: "table1" }]) {
    const open = sheetItemHref(page, item);
    ok(`open href ${item.kind}`, open.startsWith(`/p/${page}?sheetItem=`), open);
    eq(`open param round trip ${item.kind}`, itemFromParam(new URL(open, "https://blob.test").searchParams.get("sheetItem")), item);
  }
  eq("open param junk", [itemFromParam("{nope"), itemFromParam(null), itemFromParam('{"kind":"chart","chartId":"<x>"}')], [null, null, null]);
  // Notes calculate in the reader's language: TEXT and VALUE read text the way the reader writes numbers.
  {
    const lw: Workbook = { v: 1, sheets: [sheet("l1", "Blatt 1", { "0,0": { f: 'VALUE("0.523")' }, "0,1": { f: 'VALUE("0,523")' } })], charts: [], tables: [] };
    eq("calcOf German", [calcOf(lw, "de").value("l1", 0, 0), calcOf(lw, "de").value("l1", 0, 1)], [523, 0.523]);
    eq("calcOf English", calcOf(lw, "en").value("l1", 0, 0), 0.523);
    ok("calcOf one per language", calcOf(lw, "de") !== calcOf(lw, "en") && calcOf(lw, "de") === calcOf(lw, "de"));
  }
  eq("param junk", embedFromParam("{not json"), null);
  ok("same item", sameItem({ kind: "table", tableId: "a" }, { kind: "table", tableId: "a" }) && !sameItem({ kind: "table", tableId: "a" }, { kind: "chart", chartId: "a" }));

  // The table a note shows.
  const wb: Workbook = {
    v: 1,
    sheets: [
      sheet(
        "s1",
        "Messung",
        {
          "0,0": { v: "Probe" },
          "0,1": { v: "Extinktion" },
          "0,2": { v: "Notiz" },
          "1,0": { v: "A" },
          "1,1": { v: 0.25, s: { fmt: { kind: "number", decimals: 3 }, bold: true } },
          "1,2": { v: "Zeile 1\nZeile 2", s: { wrap: true } },
          "2,0": { v: "B" },
          "2,1": { v: 0.5, s: { fmt: { kind: "number", decimals: 3 }, color: "red", fill: "yellow" } },
          "3,0": { v: "C" },
          "3,1": { f: "1/0" },
          "4,0": { v: "D|E" },
          "4,1": { v: 1 },
          "5,0": { v: "Summe" },
          "5,1": { f: "SUBTOTAL(109,B2:B5)" },
        },
        { rows: { "2": { hidden: true } }, cols: { "2": { w: 160 } } },
      ),
    ],
    charts: [],
    tables: [
      { id: "t1", sheetId: "s1", name: "Messwerte", area: { r0: 0, c0: 0, r1: 5, c1: 2 }, columns: [{ id: "a", total: "none" }, { id: "b", total: "sum" }, { id: "c", total: "none" }], totals: true, style: "green", banded: true, filters: { a: { kind: "values", values: ["A", "C", "D|E"] } }, sort: null },
    ],
  };
  const calc = createCalc(wb, { locale: "de" });
  const model = embedTableModel(wb, calc, { kind: "table", tableId: "t1" }, "de");
  eq("model parts", model?.rows.map((r) => r.part), ["header", "data", "data", "data", "totals"]);
  eq("model texts", model?.rows.map((r) => r.cells.map((c) => c.text)), [
    ["Probe", "Extinktion", "Notiz"],
    ["A", "0,250", "Zeile 1\nZeile 2"],
    ["C", "#DIV/0!", ""],
    ["D|E", "1", ""],
    ["Summe", "#DIV/0!", ""],
  ]);
  eq("model bands", model?.rows.map((r) => r.band), [0, 0, 1, 0, 0]);
  eq("model looks", model && [sortKeys(model.rows[1].cells[1]), model.rows[2].cells[1].error, model.rows[1].cells[2].wrap], [sortKeys({ text: "0,250", align: "right", bold: true, num: true }), true, true]);
  eq("model frame", model && { title: model.title, where: model.where, style: model.style, widths: model.widths, more: model.moreRows }, { title: "Messwerte", where: "Messung · A1:C6", style: "green", widths: [100, 100, 160], more: 0 });
  const capped = embedTableModel(wb, calc, { kind: "range", sheetId: "s1", area: { r0: 0, c0: 0, r1: 5, c1: 1 } }, "en", { maxRows: 2, maxCols: 1 });
  eq("range capped", capped && { rows: capped.rows.map((r) => r.cells.map((c) => c.text)), moreRows: capped.moreRows, moreCols: capped.moreCols, kind: capped.kind }, { rows: [["Probe"], ["A"]], moreRows: 3, moreCols: 1, kind: "range" });
  eq("gone", embedTarget(wb, { kind: "chart", chartId: "nope" }), { kind: "gone", what: "chart" });
  eq("used area", usedArea(wb.sheets[0]), { r0: 0, c0: 0, r1: 5, c1: 2 });
  eq(
    "markdown",
    model && embedTableMarkdown(model),
    ["| Probe | Extinktion | Notiz |", "| --- | --- | --- |", "| A | **0,250** | Zeile 1<br>Zeile 2 |", "| C | #DIV/0! |  |", "| D\\|E | 1 |  |", "| **Summe** | **#DIV/0!** |  |"].join("\n"),
  );

  // The note's schema knows the block (on the server too), its text is the caption, and its
  // spreadsheet counts as a link (backlinks, public links).
  const schema = noteSchema("de");
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Vorher" }] },
      { type: "sheetEmbed", attrs: { pageId: page, item: { kind: "chart", chartId: "c1" }, size: "l", caption: "Abb. 1: Kalibriergerade" } },
      { type: "sheetEmbed", attrs: { pageId: null, item: { kind: "chart" } } },
    ],
  });
  doc.check();
  eq("plain text", plainTextOf(doc), "Vorher\nAbb. 1: Kalibriergerade");
  eq("links", collectLinks(doc, "ffffffff-ffff-4fff-8fff-ffffffffffff"), [page]);
  eq("defaults", doc.child(2).attrs, { pageId: null, item: { kind: "chart" }, size: "m", caption: "" });
  // The exports that don't know the block yet pass it by without failing.
  const md = noteToMarkdown(doc.toJSON(), { locale: "de", title: "Notiz" });
  ok("markdown export survives", md.includes("Vorher"), md);
  const docx = await noteToDocx(doc.toJSON(), { locale: "de", title: "Notiz", pageHref: (id) => `/p/${id}`, absolute: (h) => h, image: async () => null, drawings: [] });
  ok("word export survives", docx.size > 1000, String(docx.size));

  // The note's exports: embeds become a Markdown table, a link to the chart, or a link where the
  // spreadsheet can't be read; the caption follows.
  const gone = "99999999-9999-4999-8999-999999999999";
  const withChart: Workbook = { ...wb, charts: [{ id: "c1", sheetId: "s1", at: { row: 0, col: 4, dx: 0, dy: 0 }, size: { w: 480, h: 300 }, kind: "scatter", title: "Kalibriergerade", x: null, series: [], xAxis: { title: "", min: null, max: null, log: false, grid: false, decimals: null }, yAxis: { title: "", min: null, max: null, log: false, grid: false, decimals: null }, legend: "none" }] };
  const source = async (id: string) => (id === page ? { wb: withChart, title: "Photometrie" } : null);
  const note = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Messung" }] },
      { type: "sheetEmbed", attrs: { pageId: page, item: { kind: "table", tableId: "t1" }, size: "m", caption: "Tab. 1: Messwerte" } },
      { type: "sheetEmbed", attrs: { pageId: page, item: { kind: "chart", chartId: "c1" }, size: "l", caption: "" } },
      { type: "sheetEmbed", attrs: { pageId: gone, item: { kind: "chart", chartId: "x" }, size: "m", caption: "" } },
      { type: "sheetEmbed", attrs: { pageId: page, item: { kind: "range", sheetId: "s1", area: { r0: 0, c0: 0, r1: 1, c1: 1 } }, size: "m", caption: "" } },
    ],
  };
  const forMd = await withSheetEmbeds(note, "markdown", "de", source);
  const mdOut = noteToMarkdown(forMd.doc, { locale: "de", title: "Notiz", pageHref: (id) => `https://blob.test/p/${id}` });
  ok("markdown table", mdOut.includes("| Probe | Extinktion | Notiz |") && mdOut.includes("| D\\|E | 1 |  |"), mdOut);
  ok("markdown table title", mdOut.includes("**Messwerte** · Messung · A1:C6"), mdOut);
  ok("markdown caption", mdOut.includes("*Tab. 1: Messwerte*"), mdOut);
  ok("markdown chart link", mdOut.includes(`[Diagramm: Kalibriergerade](https://blob.test/p/${page})`), mdOut);
  ok("markdown unreadable link", mdOut.includes(`[Tabelle](https://blob.test/p/${gone})`), mdOut);
  // Cells are named after the spreadsheet they come from (their own title is only the sheet's name).
  ok("markdown range title", mdOut.includes("**Photometrie** · Messung · A1:B2") && !mdOut.includes("**Messung** · Messung"), mdOut);
  const forWord = await withSheetEmbeds({ ...note, content: note.content.slice(0, 2) }, "docx", "de", source);
  const word = await noteToDocx(forWord.doc, { locale: "de", title: "Notiz", pageHref: (id) => `/p/${id}`, absolute: (h) => h, image: async () => null, drawings: [] });
  forWord.done();
  const wordXml = (await readZip(new Uint8Array(await word.arrayBuffer())).text("word/document.xml")) ?? "";
  ok("word table", wordXml.includes("<w:tbl>") && wordXml.includes("Extinktion") && wordXml.includes("Zeile 1"), wordXml.slice(0, 300));
  const plain = await sheetEmbedTexts(schema.nodeFromJSON(note), "de", (id) => `https://blob.test/p/${id}`, source);
  const texts = schema.nodeFromJSON(note).content.content.filter((n) => n.type.name === "sheetEmbed").map(plain);
  ok("text table", texts[0].startsWith("Messwerte · Messung · A1:C6\n\n| Probe |") && texts[0].endsWith("\nTab. 1: Messwerte"), texts[0]);
  eq("text chart", texts[1], `[Diagramm: Kalibriergerade] https://blob.test/p/${page}`);
  eq("text unreadable", texts[2], "");
  ok("text range title", texts[3].startsWith("Photometrie · Messung · A1:B2\n\n| Probe |"), texts[3]);
}

/**
 * Smart tables in .xlsx: Excel "repairs" a file whose table column names repeat or are empty, so
 * they are the header texts as shown, made unique with numbers ("Wert", "Wert2"), and the header
 * cells say the same. Every formula is written through toFileFormula (cells, a totals row) and
 * read back through importFormula, so _xlfn prefixes come and go.
 */
async function xlsxTableNames() {
  const cells: Record<string, Cell> = {
    "0,0": { v: "Wert" },
    "0,1": { v: "Wert" },
    "0,3": { v: "wert" },
    "0,4": { v: 2020 },
    "0,5": { v: "Zeile 1\nZeile 2", s: { wrap: true } },
    "0,6": { v: "  Wert  " },
    "0,7": { v: "Stabw" },
    "0,8": { f: 'CONCAT("Mit","tel")' },
  };
  for (let r = 1; r <= 3; r++) {
    for (let c = 0; c <= 6; c++) cells[`${r},${c}`] = { v: r * 10 + c };
    cells[`${r},7`] = { f: `STDEV.S(A${r + 1}:G${r + 1})` };
    cells[`${r},8`] = { f: `AVERAGE(A${r + 1}:G${r + 1})` };
  }
  cells["4,0"] = { v: "Ergebnis" };
  cells["4,1"] = { f: "SUBTOTAL(109,B2:B4)" };
  cells["4,7"] = { f: "STDEV.S(H2:H4)" };
  const wb: Workbook = {
    v: 1,
    sheets: [sheet("t1", "Daten", cells)],
    charts: [],
    tables: [
      {
        id: "tb1",
        sheetId: "t1",
        name: "Werte",
        area: { r0: 0, c0: 0, r1: 4, c1: 8 },
        totals: true,
        style: "blue",
        banded: true,
        columns: Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, total: i === 1 ? "sum" : "none" })),
        filters: {},
        sort: null,
      },
    ],
  };
  const calc = createCalc(wb, { locale: "de" });
  const bytes = new Uint8Array(await (await exportXlsx(wb, calc, "de")).arrayBuffer());
  const z = readZip(bytes);
  const table = (await z.text("xl/tables/table1.xml")) ?? "";
  const names = [...table.matchAll(/<tableColumn [^>]*name="([^"]*)"/g)].map((m) => m[1]);
  const wanted = ["Wert", "Wert2", "Spalte3", "wert3", "2020", "Zeile 1_x000A_Zeile 2", "Wert4", "Stabw", "Mittel"];
  eq("table column names: shown texts, unique, none empty", names, wanted);
  ok("table column names unique (any case)", new Set(names.map((n) => n.toLowerCase())).size === names.length);
  ok("no empty column name", names.every((n) => n.trim() !== ""));
  ok("totals formula with prefix", table.includes("<totalsRowFormula>_xlfn.STDEV.S(H2:H4)</totalsRowFormula>"), table);
  const sheetXml = (await z.text("xl/worksheets/sheet1.xml")) ?? "";
  const formulas = [...sheetXml.matchAll(/<f>([^<]*)<\/f>/g)].map((m) => m[1]);
  ok("every STDEV.S written with its _xlfn prefix", formulas.filter((f) => f.includes("STDEV.S")).every((f) => /(^|[^.\w])_xlfn\.STDEV\.S\(/.test(f) && !/(^|[^.\w])STDEV\.S\(/.test(f)), formulas.join(" | "));
  ok("a header formula becomes its text", !formulas.some((f) => f.includes("CONCAT")), formulas.join(" | "));
  // Back in: the same header texts in the cells, the table's columns, the formulas without prefixes.
  const { workbook: back } = await importXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "de");
  const b = back.sheets[0];
  eq(
    "header cells say the column names",
    Array.from({ length: 9 }, (_, c) => b.cells[`0,${c}`]?.v),
    ["Wert", "Wert2", "Spalte3", "wert3", "2020", "Zeile 1\nZeile 2", "Wert4", "Stabw", "Mittel"],
  );
  eq("table back", back.tables.map((t) => ({ name: t.name, area: t.area, totals: t.totals, columns: t.columns.length })), [{ name: "Werte", area: { r0: 0, c0: 0, r1: 4, c1: 8 }, totals: true, columns: 9 }]);
  eq("formulas back without prefixes", [b.cells["1,7"]?.f, b.cells["3,8"]?.f, b.cells["4,7"]?.f, b.cells["4,1"]?.f], ["STDEV.S(A2:G2)", "AVERAGE(A4:G4)", "STDEV.S(H2:H4)", "SUBTOTAL(109,B2:B4)"]);
  const calc2 = createCalc(back, { locale: "de" });
  eq("values back", [calc2.value(b.id, 1, 7), calc2.value(b.id, 4, 1)], [calc.value("t1", 1, 7), calc.value("t1", 4, 1)]);
  // Numbers in the header row (a table made from rows 2–4): their shown text, still unique.
  const numbers: Workbook = { ...wb, tables: [{ ...wb.tables[0], area: { r0: 1, c0: 0, r1: 3, c1: 1 }, totals: false, columns: wb.tables[0].columns.slice(0, 2) }] };
  numbers.sheets = [{ ...wb.sheets[0], cells: { ...wb.sheets[0].cells, "1,0": { v: 1.5, s: { fmt: { kind: "number", decimals: 1 } } }, "1,1": { v: 1.5 } } }];
  const t2 = (await readZip(new Uint8Array(await (await exportXlsx(numbers, createCalc(numbers, { locale: "de" }), "de")).arrayBuffer())).text("xl/tables/table1.xml")) ?? "";
  const names2 = [...t2.matchAll(/<tableColumn [^>]*name="([^"]*)"/g)].map((m) => m[1]);
  eq("numbers as header: shown text, unique", names2, ["1,5", "1,52"]);
}

/** Importing a CSV file reads its numbers in the language the file writes them in. */
async function csvImport() {
  const file = (text: string, name = "messung.csv") => new File([text], name, { type: "text/csv" });
  const en = await readSheetFile(file("Konzentration,Extinktion\r\n0.5,0.123\r\n1,1.234\r\n2,2.5\r\n"), "de");
  if ("error" in en) fail("English CSV read in German", en.error);
  else {
    const c = en.workbook.sheets[0].cells;
    eq("English CSV in German: decimals stay decimals", [c["1,0"]?.v, c["1,1"]?.v, c["2,1"]?.v, c["3,1"]?.v], [0.5, 0.123, 1.234, 2.5]);
    eq("sheet named after the file", en.workbook.sheets[0].name, "messung");
  }
  const de = await readSheetFile(file("Konzentration;Extinktion\r\n0,5;0,123\r\n1;1.234,5\r\n"), "en");
  if ("error" in de) fail("German CSV read in English", de.error);
  else eq("German CSV in English", [de.workbook.sheets[0].cells["1,1"]?.v, de.workbook.sheets[0].cells["2,1"]?.v], [0.123, 1234.5]);
  const plain = await readSheetFile(file("a;b\r\n1;2\r\n1.234;5\r\n"), "de");
  if ("error" in plain) fail("whole numbers CSV", plain.error);
  else eq("no decimals shown: the reader's language", plain.workbook.sheets[0].cells["2,0"]?.v, 1234);
}

// Reading files safely ----------------------------------------------------------------------------

/** What a call throws: a zip's or XML's code, else the message; "" when it doesn't. */
async function thrown(fn: () => unknown): Promise<string> {
  try {
    await fn();
    return "";
  } catch (e) {
    if (e instanceof ZipError) return e.code;
    if (e instanceof XmlError) return e.tooBig ? "tooBig" : "broken";
    return e instanceof Error ? e.message : String(e);
  }
}

/** The zip's first central directory entry (its declared sizes are at +20 and +24). */
function centralEntry(zip: Uint8Array, name: string): number {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  for (let i = 0; i + 46 <= zip.length; i++) {
    if (view.getUint32(i, true) !== 0x02014b50) continue;
    const len = view.getUint16(i + 28, true);
    if (dec.decode(zip.subarray(i + 46, i + 46 + len)) === name) return i;
  }
  return -1;
}

/** An .xlsx with some of its parts changed (as a hand-made or crafted file would have them). */
async function patchXlsx(bytes: Uint8Array, change: Record<string, (xml: string) => string>): Promise<Uint8Array> {
  const z = readZip(bytes);
  const parts = await Promise.all(z.names.map(async (name) => ({ name, data: (await z.get(name))! })));
  return makeZip(parts.map((p) => (change[p.name] ? { name: p.name, data: enc.encode(change[p.name](dec.decode(p.data))) } : p)));
}

const xlsxOf = async (wb: Workbook) => new Uint8Array(await (await exportXlsx(wb, createCalc(wb, { locale: "de" }), "de")).arrayBuffer());
const book = (sheets: Sheet[], extra: Partial<Workbook> = {}): Workbook => ({ v: 1, sheets, charts: [], tables: [], ...extra });

async function readingSafely() {
  // Zip: a part is unpacked only within the limits, and stops as soon as it gives more than it says.
  const many = enc.encode("<c/>".repeat(50_000));
  const packed = await makeZip([{ name: "x.xml", data: many }], { compress: true });
  ok("repeated text packs very small", packed.length < 4000, `${packed.length} bytes`);
  eq("a part over the limit for one part: refused before unpacking", await thrown(() => readZip(packed, { part: 100_000 }).get("x.xml")), "tooBig");
  const twice = readZip(packed, { total: 300_000 });
  eq("a read within the limit for all parts", (await twice.get("x.xml"))?.length, many.length);
  eq("…the next one over it: refused", await thrown(() => twice.get("x.xml")), "tooBig");
  const lying = packed.slice();
  new DataView(lying.buffer).setUint32(centralEntry(lying, "x.xml") + 24, 1000, true);
  eq("a part that unpacks to more than it says: stopped while unpacking", await thrown(() => readZip(lying).get("x.xml")), "broken");
  const raw = await deflateRaw(many);
  if (raw) eq("inflating stops at its limit", await thrown(() => inflateRaw(raw, 1000)), "tooBig");

  // XML: one budget of elements and attributes for the whole file, end tags of elements that aren't
  // open skipped at once, and names from the file never reach an object's prototype.
  const budget = xmlBudget(1500);
  parseXml(`<a>${"<c/>".repeat(1000)}</a>`, budget);
  eq("elements count against the file's budget", budget.nodes, 499);
  eq("more elements than the budget: too big, not broken", await thrown(() => parseXml(`<a>${"<c/>".repeat(1000)}</a>`, budget)), "tooBig");
  const attrBudget = xmlBudget(1000);
  parseXml(`<a>${'<c x="1" y="2"/>'.repeat(100)}</a>`, attrBudget);
  eq("…and so do attributes", attrBudget.nodes, 1000 - 1 - 300);
  const crowded = `<a>${`<x ${Array.from({ length: 100 }, (_, i) => `a${i}=""`).join(" ")}/>`.repeat(50)}</a>`;
  eq("elements with 100 attributes each: too big after the budget's worth", await thrown(() => parseXml(crowded, xmlBudget(2000))), "tooBig");
  let t0 = performance.now();
  const stray = parseXml(`<sst><si><t>x</t></si>${"<x>".repeat(60_000)}${"</y>".repeat(60_000)}</sst>`);
  let ms = performance.now() - t0;
  ok("60,000 end tags of elements that aren't open: quick (24 s before)", ms < 3000, `${Math.round(ms)} ms`);
  eq("…what came before them stays", textOf(stray.kids[0] as Exclude<(typeof stray.kids)[number], string>), "x");
  const el = parseXml('<a constructor="1" __proto__="2" toString="3"/>');
  eq("attributes named like an object's own are plain attributes", [attr(el, "constructor"), attr(el, "__proto__"), attr(el, "toString"), attr(el, "valueOf")], ["1", "2", "3", undefined]);
  eq("entities named like an object's own stay as written", decodeEntities("A &constructor; B &toString; &amp;"), "A &constructor; B &toString; &");
  eq("…in pasted HTML too", decodeHtmlEntities("&constructor; &__proto__; &lt;"), "&constructor; &__proto__; <");
  eq("lookup reads a table's own keys only", [lookup({ sum: 1 }, "constructor"), lookup({ sum: 1 }, "__proto__"), lookup({ sum: 1 }, "sum"), lookup({ sum: 1 }, undefined)], [undefined, undefined, 1, undefined]);

  // A file whose kinds are named like an object's own: never a function in the workbook.
  const wb = labWorkbook();
  const crafted = await patchXlsx(await xlsxOf(wb), {
    "xl/tables/table1.xml": (x) =>
      x
        .replace(/totalsRowFunction="[^"]*"/g, 'totalsRowFunction="constructor"')
        .replace(/<autoFilter ref="([^"]*)"\/>/, '<autoFilter ref="$1"><filterColumn colId="1"><customFilters><customFilter operator="constructor" val="1"/></customFilters></filterColumn></autoFilter>'),
    "xl/charts/chart1.xml": (x) => x.replace(/<c:trendlineType val="[^"]*"\/>/, '<c:trendlineType val="constructor"/>').replace(/<c:errValType val="[^"]*"\/>/, '<c:errValType val="toString"/>'),
  });
  const { workbook: odd, skipped } = await importXlsx(crafted, "de");
  const fns: string[] = [];
  const walk = (x: unknown, path: string) => {
    if (typeof x === "function") fns.push(path);
    else if (x && typeof x === "object") for (const k of Object.keys(x)) walk((x as Record<string, unknown>)[k], `${path}.${k}`);
  };
  walk(odd, "wb");
  eq("crafted names: no function anywhere", fns, []);
  eq("crafted totals: what the totals row's cells say", odd.tables[0].columns.map((c) => c.total), ["none", "average", "none"]);
  eq("crafted filter operator: left out, and listed", [odd.tables[0].filters, skipped.some((l) => l.startsWith("1 Filter"))], [{}, true]);
  const series = odd.charts.find((c) => c.title === "Kalibriergerade")?.series[0];
  eq("crafted trendline and error bar kinds: the defaults", [series?.trendline?.type, series?.errorBars?.kind], ["linear", "fixed"]);

  // A part that says it unpacks to 80 MB: the file is refused as too big, at once.
  const plain = await xlsxOf(book([sheet("s1", "Blatt 1", { "0,0": { v: 1 } })]));
  const huge = plain.slice();
  new DataView(huge.buffer).setUint32(centralEntry(huge, "xl/worksheets/sheet1.xml") + 24, 80 * 1024 * 1024, true);
  const bomb = await readSheetBytes(huge, "bombe.xlsx", "de");
  eq("a file that would unpack too big: refused, with the reason", "error" in bomb ? [bomb.error, bomb.message] : bomb, ["tooBig", sheetIoText.de.errors.tooBig]);

  // Files within every limit above that make much from little: one long shared text or one shared
  // formula for thousands of cells, names that use names, a formula or format code of megabytes.
  // Each is refused or left out at once (they took gigabytes, or minutes, before).
  const oneText = await xlsxOf(book([sheet("s1", "Blatt 1", { "0,0": { v: "x" } })]));
  const sheetData = (rows: number, cells: (r: number) => string) => (x: string) =>
    x.replace(/<sheetData>[\s\S]*<\/sheetData>/, `<sheetData>${Array.from({ length: rows }, (_, r) => `<row r="${r + 1}">${cells(r + 1)}</row>`).join("")}</sheetData>`);
  const timed = async <T,>(f: () => Promise<T>): Promise<[T, number]> => {
    const start = performance.now();
    const out = await f();
    return [out, performance.now() - start];
  };
  const sstFile = await patchXlsx(oneText, {
    "xl/sharedStrings.xml": (x) => x.replace(/<si>[\s\S]*<\/si>/, `<si><t>${"A".repeat(32_767)}</t></si>`),
    "xl/worksheets/sheet1.xml": sheetData(200, () => '<c t="s"><v>0</v></c>'.repeat(100)),
  });
  const [sstRead, sstMs] = await timed(() => readSheetBytes(sstFile, "text.xlsx", "de"));
  eq("one 32,767-character text for 20,000 cells (655 million characters): too big", "error" in sstRead ? [sstRead.error, sstRead.message] : sstRead.workbook.sheets.length, ["tooBig", sheetIoText.de.errors.tooBig]);
  ok("…at once", sstMs < 2000, `${Math.round(sstMs)} ms`);
  const sharedFormula = (master: string) =>
    patchXlsx(oneText, {
      "xl/worksheets/sheet1.xml": sheetData(200, (r) => Array.from({ length: 100 }, (_, c) => (r === 1 && c === 0 ? `<c r="A1"><f t="shared" ref="A1:CV200" si="0">${master}</f><v>1</v></c>` : '<c><f t="shared" si="0"/><v>1</v></c>')).join("")),
    });
  const [sharedRead, sharedMs] = await timed(async () => readSheetBytes(await sharedFormula(`${"B1+".repeat(1000)}B1`), "formel.xlsx", "de"));
  eq("one 3,000-character formula shared by 20,000 cells (60 million characters to read): too big", "error" in sharedRead ? [sharedRead.error, sharedRead.message] : sharedRead.workbook.sheets.length, ["tooBig", sheetIoText.de.errors.tooBig]);
  ok("…at once", sharedMs < 6000, `${Math.round(sharedMs)} ms`);
  const [longShared, longSharedMs] = await timed(async () => readSheetBytes(await sharedFormula(`${"B1+".repeat(3000)}B1`), "formel.xlsx", "de"));
  eq("…one too long to keep: the values, listed once for each cell", "error" in longShared ? longShared : [Object.keys(longShared.workbook.sheets[0].cells).length, longShared.workbook.sheets[0].cells["5,5"], longShared.skipped], [20_000, { v: 1 }, ["20000 Formeln mit mehr als 8.192 Zeichen (ihre Ergebnisse stehen als Werte in den Zellen)"]]);
  ok("…at once (the long one isn't moved for each cell)", longSharedMs < 3000, `${Math.round(longSharedMs)} ms`);
  const numCell = await xlsxOf(book([sheet("s1", "Blatt 1", { "0,0": { v: 7 } })]));
  const names = ["NA", "NB", "NC", "ND", "NE"];
  const nested = await patchXlsx(numCell, {
    "xl/workbook.xml": (x) => x.replace("</sheets>", `</sheets><definedNames>${names.map((n, i) => `<definedName name="${n}">${i + 1 < names.length ? Array(50).fill(names[i + 1]).join("+") : "1"}</definedName>`).join("")}</definedNames>`),
    "xl/worksheets/sheet1.xml": sheetData(1, () => '<c r="A1"><f>NA</f><v>7</v></c>'),
  });
  const [nestedRead, nestedMs] = await timed(() => readSheetBytes(nested, "namen.xlsx", "de"));
  eq("a name that uses names 50 times each, four deep (6 million references): its value, listed", "error" in nestedRead ? nestedRead : [nestedRead.workbook.sheets[0].cells["0,0"], nestedRead.skipped], [{ v: 7 }, ["1 Formel mit mehr als 8.192 Zeichen (ihr Ergebnis steht als Wert in der Zelle)"]]);
  ok("…at once", nestedMs < 2000, `${Math.round(nestedMs)} ms`);
  const nestedMany = await patchXlsx(nested, { "xl/worksheets/sheet1.xml": sheetData(100, () => "<c><f>NA</f><v>7</v></c>".repeat(100)) });
  const [manyRead, manyMs] = await timed(() => readSheetBytes(nestedMany, "namen.xlsx", "de"));
  eq("…in 10,000 cells: too big, before reading them all", "error" in manyRead ? manyRead.error : manyRead.skipped, "tooBig");
  ok("…soon", manyMs < 4000, `${Math.round(manyMs)} ms`);
  const longText = await patchXlsx(numCell, { "xl/worksheets/sheet1.xml": sheetData(1, () => `<c r="A1"><f>${"1+".repeat(1_000_000)}1</f><v>5</v></c><c r="B1" t="e"><v>#${"X".repeat(100_000)}</v></c>`) });
  const [longRead, longMs] = await timed(() => readSheetBytes(longText, "riesig.xlsx", "de"));
  eq("a 2-megabyte formula: its value, listed; a 100,000-character error: text", "error" in longRead ? longRead : [longRead.workbook.sheets[0].cells["0,0"], longRead.workbook.sheets[0].cells["0,1"]?.v?.toString().length, longRead.skipped.length], [{ v: 5 }, 32_767, 1]);
  ok("…at once (4.7 GB and 24 s before)", longMs < 2000, `${Math.round(longMs)} ms`);
  t0 = performance.now();
  eq("a format code longer than Excel's 255 characters: general", [fromExcelFormat(`0.0" ${"x".repeat(300)}"`, "de"), fromExcelFormat("0".repeat(2_000_000), "de")], [undefined, undefined]);
  ok("…at once", performance.now() - t0 < 500, `${Math.round(performance.now() - t0)} ms`);
  eq("importFormula: a text far too long isn't read", importFormula("1+".repeat(40_000) + "1", { tables: new Map(), names: new Map(), sheet: "Blatt 1", row: 0, col: 0, tableAt: () => null }), { problem: "long" });

  // Text files and pasted tables: no more than a sheet holds is read (a million lines took 2 GB).
  const [lines, linesMs] = await timed(() => readSheetBytes(enc.encode("a\n".repeat(1_000_000)), "zeilen.csv", "de"));
  eq("a CSV of a million lines: a sheet's worth, and it says so", "error" in lines ? lines : [Object.keys(lines.workbook.sheets[0].cells).length, lines.cutRows], [20_000, 20_000]);
  ok("…at once", linesMs < 3000, `${Math.round(linesMs)} ms`);
  t0 = performance.now();
  const pastedLines = parseClipboard({ text: "a;b\n".repeat(1_000_000) });
  ms = performance.now() - t0;
  eq("a pasted text of a million lines: a sheet's rows", pastedLines?.length, 20_000);
  ok("…at once", ms < 2000, `${Math.round(ms)} ms`);
  const wide = await readSheetBytes(enc.encode(`a${";b".repeat(1_000_000)}\n`), "breit.csv", "de");
  eq("a CSV line of a million values: 200 columns", "error" in wide ? wide : Object.keys(wide.workbook.sheets[0].cells).length, 200);
  t0 = performance.now();
  const spans = parseHtmlTable(`<table>${`<tr>${'<td colspan="200" rowspan="200">x</td>'.repeat(300)}</tr>`.repeat(300)}</table>`);
  ms = performance.now() - t0;
  eq("an HTML table of 90,000 cells spanning 200 x 200: no wider than a sheet (empty rows at the end dropped)", spans ? [spans.length, Math.max(...spans.map((r) => r.length))] : spans, [201, 200]);
  ok("…at once", ms < 2000, `${Math.round(ms)} ms`);
  t0 = performance.now();
  parseHtmlTable(`<table><tr><td>1</td></tr></table>${"<!--".repeat(50_000)}${"<![if x ".repeat(20_000)}`);
  parseClipboard({ text: "1\t2", html: `<table xmlns:x="urn:schemas-microsoft-com:office:excel"><tr><td x:num="1">1</td><td>2</td></tr></table>${"<style>.a{mso-number-format:x".repeat(20_000)}` });
  ms = performance.now() - t0;
  ok("pasted HTML with unclosed comments and styles: quick", ms < 1500, `${Math.round(ms)} ms`);

  // Long runs that took seconds or minutes before: the number style of a CSV, pasted lines, HTML
  // with unclosed tags, chart references.
  const spaces = Array.from({ length: 10 }, () => ["1" + " ".repeat(30_000) + "x"]);
  t0 = performance.now();
  csvNumberLocale(spaces, "de");
  parseClipboard({ text: Array.from({ length: 3 }, () => "1 ".repeat(15_000) + "x,1").join("\n") });
  parseHtmlTable("<table><tr><td>" + "<a b ".repeat(8000) + '<a b="x '.repeat(8000));
  parseChartRef(" ".repeat(30_000) + "x", () => "s1");
  ms = performance.now() - t0;
  ok("long spaces, lines and unclosed tags: quick", ms < 1500, `${Math.round(ms)} ms`);
  const spacesCsv = await readSheetBytes(enc.encode(spaces.map((r) => r[0]).join("\n")), "leer.csv", "de");
  ok("a CSV of long space runs: read", !("error" in spacesCsv), JSON.stringify(spacesCsv).slice(0, 200));
}

// Files of every kind -----------------------------------------------------------------------------

async function fileKinds() {
  const read = (text: string, name: string) => readSheetBytes(enc.encode(text), name, "de");
  const cellsOf = (r: Awaited<ReturnType<typeof read>>) => ("error" in r ? r : r.workbook.sheets[0].cells);
  // Text named .xls (photometers and web tools save it so): read like CSV.
  const photometer = await read("Probe\tExtinktion\nS1\t0,104\nS2\t0,212\n", "Photometer-Export.xls");
  eq(".xls with tab text inside: its rows", "error" in photometer ? photometer : [photometer.kind, photometer.workbook.sheets[0].name, photometer.workbook.sheets[0].cells["1,1"]?.v], ["csv", "Photometer-Export", 0.104]);
  eq(".xls with an HTML table inside: its rows", cellsOf(await read("<html><body><table><tr><td>Probe</td><td>Wert</td></tr><tr><td>A</td><td>0,5</td></tr></table></body></html>", "Web.xls")), { "0,0": { v: "Probe" }, "0,1": { v: "Wert" }, "1,0": { v: "A" }, "1,1": { v: 0.5 } });
  const lims = await read('<?xml version="1.0"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet/></Workbook>', "LIMS.xls");
  eq(".xls with XML inside: a clear message", "error" in lims ? [lims.error, lims.message] : lims, ["failed", sheetIoText.de.errors.notTable]);
  eq("a first value below the detection limit is data, not markup", cellsOf(await read("<NWG;0,5\n<0,1;2\n", "werte.csv")), { "0,0": { v: "<NWG" }, "0,1": { v: 0.5 }, "1,0": { v: "<0,1" }, "1,1": { v: 2 } });
  eq("…so is a first value \"<BG\" (below the measuring range)", cellsOf(await read("<BG\t>MB\n0,1\t2,5\n", "werte.xls")), { "0,0": { v: "<BG" }, "0,1": { v: ">MB" }, "1,0": { v: 0.1 }, "1,1": { v: 2.5 } });
  eq("…and one written with a tag, \"<b>Probe</b>\"", cellsOf(await read("<b>Probe</b>\tWert\nA\t1\n", "werte.csv")), { "0,0": { v: "<b>Probe</b>" }, "0,1": { v: "Wert" }, "1,0": { v: "A" }, "1,1": { v: 1 } });
  // Excel's "Web page" (and tools that write like it): the <html> tag over several lines.
  const webPage = `<html xmlns:v="urn:schemas-microsoft-com:vml"\nxmlns:o="urn:schemas-microsoft-com:office:office"\nxmlns:x="urn:schemas-microsoft-com:office:excel"\nxmlns="http://www.w3.org/TR/REC-html40">\n\n<head>\n<meta name=ProgId content=Excel.Sheet>\n</head>\n<body>\n<table>\n <tr><td>Probe</td><td>Extinktion</td></tr>\n <tr><td>S1</td><td x:num="0.10437">0,104</td></tr>\n</table>\n</body>\n</html>\n`;
  eq("Excel's web page as .xls: its rows, with the full numbers shown as the page shows them", cellsOf(await read(webPage, "Laborexport.xls")), {
    "0,0": { v: "Probe" },
    "0,1": { v: "Extinktion" },
    "1,0": { v: "S1" },
    "1,1": { v: 0.10437, s: { fmt: { kind: "number", decimals: 3 } } },
  });
  const utf16 = "Probe\tµg\nS1\t0,5\n";
  const u16 = new Uint8Array(2 + utf16.length * 2);
  u16.set([0xff, 0xfe]);
  for (let i = 0; i < utf16.length; i++) new DataView(u16.buffer).setUint16(2 + i * 2, utf16.charCodeAt(i), true);
  eq("UTF-16 text (Excel's Unicode text): read", cellsOf(await readSheetBytes(u16, "unicode.txt", "de")), { "0,0": { v: "Probe" }, "0,1": { v: "µg" }, "1,0": { v: "S1" }, "1,1": { v: 0.5 } });
  // An old binary .xls says how to save it; a password-protected .xlsx (also an Office container) says that.
  const ole = new Uint8Array(4096);
  ole.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const old = await readSheetBytes(ole, "Alt.xls", "de");
  eq("old .xls: refused, saying how to save it", "error" in old ? [old.error, old.message] : old, ["oldXls", sheetIoText.de.errors.oldXls]);
  const locked = ole.slice();
  [..."EncryptionInfo"].forEach((ch, i) => (locked[1024 + i * 2] = ch.charCodeAt(0)));
  const pw = await readSheetBytes(locked, "Geheim.xlsx", "de");
  eq("password-protected .xlsx: says so", "error" in pw ? [pw.error, pw.message] : pw, ["failed", sheetIoText.de.errors.encrypted]);

  // More sheets than a spreadsheet holds: the first come in, the rest are listed.
  const many = book(Array.from({ length: 260 }, (_, i) => sheet(`s${i}`, `S${i}`, { "0,0": { v: i } })));
  const manyFile = await xlsxOf(many);
  const all = await readSheetBytes(manyFile, "viele.xlsx", "de");
  eq("260 sheets: 250 come in, the rest are listed", "error" in all ? all : [all.workbook.sheets.length, all.skipped], [250, ["10 Blätter nach den ersten 250 (mehr passen nicht in diese Tabelle)"]]);
  const room = await readSheetBytes(manyFile, "viele.xlsx", "de", { sheetRoom: 3 });
  eq("added to a spreadsheet with room for 3: 3 come in", "error" in room ? room : [room.workbook.sheets.length, room.skipped], [3, ["257 Blätter nach den ersten 3 (mehr passen nicht in diese Tabelle)"]]);
  const full = await readSheetBytes(manyFile, "viele.xlsx", "de", { sheetRoom: 0 });
  eq("no room left: refused, with the reason", "error" in full ? [full.error, full.message] : full, ["full", sheetIoText.de.full(250)]);
  const into = book(many.sheets.slice(0, 248));
  eq("appendWorkbook stops at 250 sheets", appendWorkbook(into, freshIds(book(many.sheets.slice(0, 5))), "de").sheets.length, 250);

  // A formula longer than 8,192 characters (LibreOffice writes such): its value stays, and it is listed.
  const longF = await readSheetBytes(await xlsxOf(book([sheet("s1", "Blatt 1", { "0,0": { v: 1 }, "0,1": { f: "A1" + "+A1".repeat(3000) } })])), "lang.xlsx", "de");
  eq("a formula over 8,192 characters: its value, listed", "error" in longF ? longF : [longF.workbook.sheets[0].cells["0,1"], longF.skipped], [{ v: 3001 }, ["1 Formel mit mehr als 8.192 Zeichen (ihr Ergebnis steht als Wert in der Zelle)"]]);

  // A chart with more series than Blob keeps (one line per well): cut when it comes in, and listed.
  const r = (r0: number, c0: number, r1: number, c1: number) => ({ sheetId: "s1", r0, c0, r1, c1 });
  const wells: Record<string, Cell> = {};
  for (let c = 0; c < 70; c++) for (let row = 0; row < 3; row++) wells[`${row},${c}`] = { v: row + c };
  const chart: ChartSpec = {
    id: "w",
    sheetId: "s1",
    at: { row: 5, col: 0, dx: 0, dy: 0 },
    size: { w: 480, h: 300 },
    kind: "line",
    title: "Platte",
    x: null,
    series: Array.from({ length: 70 }, (_, c) => ({ id: `w${c}`, name: `W${c}`, nameRef: null, y: r(0, c, 2, c), x: null, color: null, marker: "none" as const, line: "straight" as const, labels: false, errorBars: null, trendline: null })),
    xAxis: { title: "", min: null, max: null, log: false, grid: false, decimals: null },
    yAxis: { title: "", min: null, max: null, log: false, grid: true, decimals: null },
    legend: "none",
  };
  const plate = await readSheetBytes(await xlsxOf(book([sheet("s1", "Blatt 1", wells)], { charts: [chart] })), "platte.xlsx", "de");
  eq("70 series in one chart: 64 come in, the rest are listed", "error" in plate ? plate : [plate.workbook.charts[0].series.length, plate.skipped], [64, ["6 Datenreihen (ein Diagramm hat höchstens 64)"]]);
}

// Clipboard numbers -------------------------------------------------------------------------------

const EXCEL_HTML = `<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta name=ProgId content=Excel.Sheet><style><!--.xl65 {mso-number-format:"0\\.00";} --></style></head><body><table>
<!--StartFragment-->
 <tr height=20>
  <td height=20 class=xl65 align=right x:num="0.12345678900000001">0,12</td>
  <td class=xl66 align=right x:num="0.123456">12,35%</td>
  <td class=xl67 align=right x:num="46329">03.11.2026</td>
 </tr>
 <tr height=20>
  <td height=20 class=xl65 align=right x:num="2.6666666666666665">2,67</td>
  <td align=right x:num>3</td>
  <td x:str>Probe 1</td>
 </tr>
<!--EndFragment-->
</table></body></html>`;
const EXCEL_TEXT = "0,12\t12,35%\t03.11.2026\r\n2,67\t3\tProbe 1\r\n";

function clipboardNumbers() {
  const fresh = (cells: Record<string, Cell> = {}, pageId = "clip-d") => createSheetStore({ pageId, workbook: book([sheet("s1", "Blatt 1", cells)]), locale: "de", readOnly: false });
  const cells = (s: SheetStore) => s.get().workbook.sheets[0].cells;
  const paste = (s: SheetStore, data: { text?: string; html?: string }, at = { row: 0, col: 0 }, mode: "all" | "values" | "transpose" = "all") => {
    s.select(at);
    pasteData(s, data, mode);
    return cells(s);
  };
  // Excel copies rounded text and, in its HTML, the full numbers: those are pasted, shown as before.
  const excel = paste(fresh(), { text: EXCEL_TEXT, html: EXCEL_HTML });
  eq("from Excel: the full numbers (Excel's own digits)", [excel["0,0"]?.v, excel["0,1"]?.v, excel["0,2"]?.v, excel["1,0"]?.v, excel["1,1"]?.v, excel["1,2"]?.v], [Number("0.12345678900000001"), 0.123456, 46329, 2.6666666666666665, 3, "Probe 1"]);
  eq("…shown with the decimals they showed", [excel["0,0"]?.s?.fmt, excel["0,1"]?.s?.fmt, excel["1,0"]?.s?.fmt], [{ kind: "number", decimals: 2 }, { kind: "percent", decimals: 2 }, { kind: "number", decimals: 2 }]);
  const lo = paste(fresh(), { text: "0,12\t2,67\n", html: `<table><tr><td sdval="0.123456789" sdnum="1031;0;0,00">0,12</td><td sdval="2.6666666667" sdnum="1031;0;0,00">2,67</td></tr></table>` });
  eq("from LibreOffice (sdval)", [lo["0,0"]?.v, lo["0,1"]?.v], [0.123456789, 2.6666666667]);
  const google = paste(fresh(), { text: "0,12", html: `<google-sheets-html-origin><table data-sheets-root="1"><tr><td data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:0.123456789}">0,12</td></tr></table>` });
  eq("from Google Sheets (data-sheets-value)", google["0,0"]?.v, 0.123456789);
  // Safeguards: an HTML table that doesn't line up with the text, a full number the text doesn't
  // show, a cell whose text means something else (percent cell): the text as typed.
  const shifted = paste(fresh(), { text: EXCEL_TEXT, html: EXCEL_HTML.replace("<!--StartFragment-->", '<!--StartFragment--><tr><td x:num="9">9</td></tr>') });
  eq("HTML with another row count: the text", shifted["0,0"]?.v, 0.12);
  const stale = paste(fresh(), { text: "0,12\t1", html: '<table xmlns:x="urn:schemas-microsoft-com:office:excel"><tr><td x:num="0.5">0,12</td><td x:num="1">1</td></tr></table>' });
  eq("a full number that doesn't give the shown text: the text", stale["0,0"]?.v, 0.12);
  const percentCell = paste(fresh({ "0,0": { s: { fmt: { kind: "percent", decimals: 0 } } } }), { text: "0,12", html: '<table xmlns:x="urn:schemas-microsoft-com:office:excel"><tr><td x:num="0.123456">0,12</td></tr></table>' });
  eq("into a percent cell: as typing it there", percentCell["0,0"]?.v, 0.0012);
  const turned = paste(fresh(), { text: "0,12\t2,67", html: '<table xmlns:x="urn:schemas-microsoft-com:office:excel"><tr><td x:num="0.123456">0,12</td><td x:num="2.666">2,67</td></tr></table>' }, { row: 0, col: 0 }, "transpose");
  eq("transposed: each full number where its text goes", [turned["0,0"]?.v, turned["1,0"]?.v], [0.123456, 2.666]);
  const wideRow = Array.from({ length: 1000 }, (_, i) => String(i)).join("\t");
  const tall = paste(fresh({}, "clip-tall"), { text: wideRow }, { row: 0, col: 0 }, "transpose");
  eq("a row of 1,000 values pasted transposed: all of them (more than a sheet's columns)", [tall["999,0"]?.v, tall["0,1"]], [999, undefined]);
  const across = paste(fresh({}, "clip-across"), { text: wideRow });
  eq("…pasted as it is: as many as a sheet has columns", [across["0,199"]?.v, across["0,200"]], [199, undefined]);

  // Formats as the copy gives them: none for General (the full number shows, as in Excel), Excel's
  // own by class and by name, LibreOffice's and Google Sheets'.
  const xl = (cells: string, style: string) => `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><style><!--${style}--></style></head><body><table><tr>${cells}</tr></table></body></html>`;
  const fromXl = paste(fresh({}, "clip-xl"), {
    text: "0,333333333\t0,12\t12%",
    html: xl('<td x:num="0.33333333333333331">0,333333333</td><td class=xl70 x:num="0.123456">0,12</td><td class="xl71 x" x:num="0.123456">12%</td>', '.xl70\n\t{mso-style-parent:style0;\n\tmso-number-format:Fixed;}\n.xl71 {mso-number-format:"0\\%";}'),
  });
  eq("from Excel: General stays General, Fixed is two decimals, 0% a percent", [fromXl["0,0"], fromXl["0,1"], fromXl["0,2"]], [{ v: 0.3333333333333333 }, { v: 0.123456, s: { fmt: { kind: "number", decimals: 2 } } }, { v: 0.123456, s: { fmt: { kind: "percent", decimals: 0 } } }]);
  const loStandard = paste(fresh({}, "clip-lo"), { text: "0,333333333\t0,12\n", html: '<table><tr><td sdval="0.333333333333333" sdnum="1031;0;Standard">0,333333333</td><td sdval="0.123456" sdnum="1031;0;0,00">0,12</td></tr></table>' });
  eq("from LibreOffice: Standard stays General, its 0,00 the decimals shown", [loStandard["0,0"], loStandard["0,1"]], [{ v: 0.333333333333333 }, { v: 0.123456, s: { fmt: { kind: "number", decimals: 2 } } }]);
  const gFmt = paste(fresh({}, "clip-g"), {
    text: "0,123",
    html: '<google-sheets-html-origin><table data-sheets-root="1"><tr><td data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:0.123456}" data-sheets-numberformat="{&quot;1&quot;:2,&quot;2&quot;:&quot;0.000&quot;,&quot;3&quot;:1}">0,123</td></tr></table>',
  });
  eq("from Google Sheets: its number format", gFmt["0,0"], { v: 0.123456, s: { fmt: { kind: "number", decimals: 3 } } });
  const noStyles = paste(fresh({}, "clip-nostyles"), { text: "0,12", html: '<table xmlns:x="urn:schemas-microsoft-com:office:excel"><tr><td class=xl65 x:num="0.123456789">0,12</td></tr></table>' });
  eq("from Excel's HTML without its styles: the decimals the text shows", noStyles["0,0"], { v: 0.123456789, s: { fmt: { kind: "number", decimals: 2 } } });

  // Copying: numbers without their unit (Excel, LibreOffice and Google Sheets take them as numbers),
  // and Excel's full value and format (with the unit) in the HTML.
  const unit = createSheetStore({
    pageId: "copy-d",
    workbook: book([
      sheet("s1", "Blatt 1", {
        "0,0": { v: 2.0001, s: { fmt: { kind: "number", decimals: 1, unit: "mg/L" } } },
        "0,1": { v: 0.0523285714, s: { fmt: { kind: "number", decimals: 4, unit: "L/mg" }, bold: true } },
        "0,2": { v: "Probe" },
        "0,3": { f: "A1*2", s: { fmt: { kind: "number", decimals: 1, unit: "mg/L" } } },
      }),
    ]),
    locale: "de",
    readOnly: false,
  });
  unit.select({ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 3 }, extra: [] });
  const copied = copySelection(unit, false);
  eq("copy: numbers without their unit", copied.text, "2,0\t0,0523\tProbe\t4,0");
  ok("copy: Excel gets the full numbers", copied.html.includes('x:num="2.0001"') && copied.html.includes('x:num="0.0523285714"') && copied.html.includes('x:num="4.0002"'), copied.html);
  ok("copy: …and the unit as their number format", copied.html.includes(`mso-number-format:"0.0\\" mg/L\\""`) && copied.html.includes(`mso-number-format:"0.0000\\" L/mg\\""`), copied.html);
  ok("copy: text has no number", !/x:num="[^"]*"[^>]*>Probe/.test(copied.html), copied.html);
  // Back into Blob: its own copy (formula, unit and look come along).
  const back = paste(unit, { text: copied.text, html: copied.html }, { row: 2, col: 0 });
  eq("Blob to Blob: its own copy", [back["2,0"], back["2,3"]?.f], [{ v: 2.0001, s: { fmt: { kind: "number", decimals: 1, unit: "mg/L" } } }, "A3*2"]);
  // Blob in another tab (its own copy is something else): the full numbers from the HTML.
  const elsewhere = fresh({ "0,0": { v: "x" } }, "copy-other");
  elsewhere.select({ row: 0, col: 0 });
  copySelection(elsewhere, false);
  const other = paste(fresh({}, "copy-third"), { text: copied.text, html: copied.html });
  eq("Blob to another tab: the full numbers", [other["0,0"]?.v, other["0,1"]?.v, other["0,3"]?.v], [2.0001, 0.0523285714, 4.0002]);
  eq("…with their formats, unit included (the text leaves it out)", [other["0,0"]?.s?.fmt, other["0,1"]?.s?.fmt, other["0,3"]?.s?.fmt], [{ kind: "number", decimals: 1, unit: "mg/L" }, { kind: "number", decimals: 4, unit: "L/mg" }, { kind: "number", decimals: 1, unit: "mg/L" }]);
  // A browser's clipboard may hand over HTML without its styles (Chrome's "Einfügen" from the menu):
  // Blob's formats come along as attributes.
  const unstyled = paste(fresh({}, "copy-unstyled"), { text: copied.text, html: copied.html.replace(/ style='[^']*'/g, "") });
  eq("…also from HTML without its styles", unstyled["0,0"], { v: 2.0001, s: { fmt: { kind: "number", decimals: 1, unit: "mg/L" } } });
  const ownFormat = paste(fresh({ "0,0": { s: { fmt: { kind: "number", decimals: 3 } } } }, "copy-own-format"), { text: copied.text, html: copied.html });
  eq("…a cell's own format stays", ownFormat["0,0"], { v: 2.0001, s: { fmt: { kind: "number", decimals: 3 } } });
  // "Werte einfügen" into another spreadsheet doesn't use Blob's own copy either.
  unit.select({ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 3 }, extra: [] });
  const again = copySelection(unit, false);
  const values = paste(fresh({}, "copy-values"), { text: again.text, html: again.html }, { row: 0, col: 0 }, "values");
  eq("…pasted as values into another spreadsheet: the same", [values["0,0"], values["0,3"]], [{ v: 2.0001, s: { fmt: { kind: "number", decimals: 1, unit: "mg/L" } } }, { v: 4.0002, s: { fmt: { kind: "number", decimals: 1, unit: "mg/L" } } }]);
  // Significant figures, which no format code can say: Blob's named style rides along.
  const sig = createSheetStore({ pageId: "copy-sig", workbook: book([sheet("s1", "Blatt 1", { "0,0": { v: 62.5, s: { fmt: { kind: "significant", digits: 3, unit: "µg/mL" } } } })]), locale: "de", readOnly: false });
  sig.select({ row: 0, col: 0 });
  const sigCopy = copySelection(sig, false);
  ok("copy: significant figures as Blob's named style", sigCopy.html.includes('data-blob-style="Blob sig 3"'), sigCopy.html);
  copySelection(elsewhere, false);
  eq("…back in another tab", paste(fresh({}, "copy-sig-other"), { text: sigCopy.text, html: sigCopy.html })["0,0"], { v: 62.5, s: { fmt: { kind: "significant", digits: 3, unit: "µg/mL" } } });
}

// Round trips through .xlsx -----------------------------------------------------------------------

async function roundTrips() {
  // Smart-table totals: Excel files say "custom" for Blob's own; the totals row's cells say which.
  const totals = book([sheet("s1", "Blatt 1", { "0,0": { v: "Probe" }, "0,1": { v: "µL" }, "0,2": { v: "Mittel" }, "1,1": { v: 2 }, "1,2": { v: 3 }, "2,1": { v: 4 }, "2,2": { v: 5 }, "3,0": { v: "Summe" }, "3,1": { f: "SUBTOTAL(109,B2:B3)" }, "3,2": { f: "SUBTOTAL(101,C2:C3)" } })], {
    tables: [{ id: "t", sheetId: "s1", name: "Mix", area: { r0: 0, c0: 0, r1: 3, c1: 2 }, columns: [{ id: "a", total: "none" }, { id: "b", total: "sum" }, { id: "c", total: "average" }], totals: true, style: "blue", banded: true, filters: {}, sort: null }],
  });
  const { workbook: t } = await importXlsx(await xlsxOf(totals), "de");
  eq("totals: the functions come back", t.tables[0].columns.map((c) => c.total), ["none", "sum", "average"]);
  // Significant figures: a named cell style Excel and LibreOffice keep ("Blob sig 3").
  eq("significant figures' style name", [sigStyleName({ kind: "significant", digits: 3 }), sigStyleName({ kind: "number", decimals: 2 })], ["Blob sig 3", undefined]);
  eq("…read back with the unit", fromSigStyle("Blob sig 3", { kind: "number", decimals: 2, unit: "µg/mL" }), { kind: "significant", digits: 3, unit: "µg/mL" });
  eq("…a percent someone chose in Excel stays", fromSigStyle("Blob sig 3", { kind: "percent", decimals: 1 }), { kind: "percent", decimals: 1 });
  eq("…other styles mean nothing", [fromSigStyle("Normal", undefined), fromSigStyle("Blob sig 99", undefined)], [undefined, undefined]);
  const sig = book([sheet("s1", "Blatt 1", { "0,0": { v: 0.0001234, s: { fmt: { kind: "significant", digits: 3, unit: "µg/mL" } } }, "1,0": { v: 31.25, s: { fmt: { kind: "significant", digits: 3 } } } })]);
  const { workbook: sb } = await importXlsx(await xlsxOf(sig), "de");
  eq("significant figures come back", [sb.sheets[0].cells["0,0"]?.s?.fmt, sb.sheets[0].cells["1,0"]?.s?.fmt], [{ kind: "significant", digits: 3, unit: "µg/mL" }, { kind: "significant", digits: 3 }]);
}

// Adding to a note, and exports -------------------------------------------------------------------

async function embedRequests() {
  // "Add to note" keeps what to add in this tab, under a one-time token in the note's address.
  const kept = new Map<string, string>();
  const g = globalThis as { sessionStorage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> };
  g.sessionStorage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => void kept.set(k, String(v)), removeItem: (k) => void kept.delete(k) };
  try {
    const attrs = { pageId: "0b5f3c1e-9a2d-4c7e-8f10-2b3c4d5e6f70", item: { kind: "chart" as const, chartId: "c1" } };
    const token = new URL(addToNoteHref("11111111-2222-4333-8444-555555555555", attrs), "https://blob.test").searchParams.get("sheetEmbed");
    ok("Add to note: a one-time token, not the attributes", isEmbedToken(token), String(token));
    eq("…which this tab turns into the attributes", token ? embedFromToken(token) : null, attrs);
    eq("…a token is no attributes", embedFromParam(token), null);
    if (token) forgetEmbedToken(token);
    eq("…used once", token ? embedFromToken(token) : "no token", null);
    eq("another tab's token (or a made-up one): nothing", embedFromToken("0123456789abcdef01234567"), null);
    eq("attributes in an address are still read (the note asks first)", embedFromParam(JSON.stringify(attrs)), attrs);
  } finally {
    delete g.sessionStorage;
  }

  // Exports: each trendline's equation and R² under its chart, as the chart's label writes them.
  const page = "0b5f3c1e-9a2d-4c7e-8f10-2b3c4d5e6f70";
  const r = (r0: number, c0: number, r1: number, c1: number) => ({ sheetId: "s1", r0, c0, r1, c1 });
  const data: Record<string, Cell> = { "0,1": { v: "Standards" } };
  [[0, 0.002], [2, 0.105], [4, 0.209], [6, 0.311], [8, 0.418], [10, 0.52]].forEach(([x, y], i) => ((data[`${i + 1},0`] = { v: x }), (data[`${i + 1},1`] = { v: y })));
  const trend = { type: "linear" as const, order: 2, period: 2, intercept: null, showEquation: true, showR2: true, forward: 0, backward: 0, name: "" };
  const spec: ChartSpec = {
    id: "k",
    sheetId: "s1",
    at: { row: 0, col: 3, dx: 0, dy: 0 },
    size: { w: 480, h: 300 },
    kind: "scatter",
    title: "Kalibriergerade",
    x: r(1, 0, 6, 0),
    series: [{ id: "a", name: "", nameRef: r(0, 1, 0, 1), y: r(1, 1, 6, 1), x: null, color: null, marker: "circle", line: "none", labels: false, errorBars: null, trendline: trend }],
    xAxis: { title: "", min: null, max: null, log: false, grid: false, decimals: null },
    yAxis: { title: "", min: null, max: null, log: false, grid: true, decimals: null },
    legend: "none",
  };
  const wb = book([sheet("s1", "Blatt 1", data)], { charts: [spec, { ...spec, id: "k2", series: [{ ...spec.series[0], trendline: { ...trend, showEquation: false } }] }] });
  const fit = chartData(spec, calcOf(wb, "de"), "de").series[0].fit;
  if (!fit || isFitError(fit)) return fail("export trend", "no fit");
  const line = `Standards: ${equationText(fit, "de")} · ${r2Text(fit.r2!, "de")}`;
  ok("the line reads like the chart's label", /^Standards: y = 0,05\d+x \+ 0,00\d+ · R² = 0,999\d+$/.test(line), line);
  const source = async () => ({ wb, title: "Kalibrierung" });
  const note = {
    type: "doc",
    content: [
      { type: "sheetEmbed", attrs: { pageId: page, item: { kind: "chart", chartId: "k" }, size: "m", caption: "Abb. 1" } },
      { type: "sheetEmbed", attrs: { pageId: page, item: { kind: "chart", chartId: "k2" }, size: "m", caption: "" } },
    ],
  };
  const md = noteToMarkdown((await withSheetEmbeds(note, "markdown", "de", source)).doc, { locale: "de", title: "Notiz", pageHref: (id) => `https://blob.test/p/${id}` });
  ok("markdown: equation and R² under the chart, then its caption", md.includes(`[Diagramm: Kalibriergerade](https://blob.test/p/${page})\n\n${line}\n\n*Abb. 1*`), md);
  ok("markdown: a hidden equation stays hidden", md.includes(`\n\nStandards: ${r2Text(fit.r2!, "de")}`), md);
  const schema = noteSchema("de");
  const texts = schema.nodeFromJSON(note).content.content.map(await sheetEmbedTexts(schema.nodeFromJSON(note), "de", (id) => `https://blob.test/p/${id}`, source));
  eq("text: the same line", texts[0], `[Diagramm: Kalibriergerade] https://blob.test/p/${page}\n${line}\nAbb. 1`);
  const forWord = await withSheetEmbeds(note, "docx", "de", source);
  const word = await noteToDocx(forWord.doc, { locale: "de", title: "Notiz", pageHref: (id) => `/p/${id}`, absolute: (h) => h, image: async () => null, drawings: [] });
  forWord.done();
  const wordXml = (await readZip(new Uint8Array(await word.arrayBuffer())).text("word/document.xml")) ?? "";
  ok("Word: the line as text to copy", wordXml.includes(r2Text(fit.r2!, "de")), wordXml.slice(0, 300));
}

async function main() {
  clipboard();
  csv();
  await zip();
  xml();
  formats();
  await xlsxRoundTrip();
  await xlsxTableNames();
  await csvImport();
  await xlsxImport();
  await embed();
  await readingSafely();
  await fileKinds();
  clipboardNumbers();
  await roundTrips();
  await embedRequests();
  if (problems.length) {
    console.error(`check:sheet-io: ${problems.length} problem(s) in ${checks} checks`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`check:sheet-io: all ${checks} checks passed`);
}

void main().catch((e) => {
  console.error("check:sheet-io crashed:", e);
  process.exit(1);
});
