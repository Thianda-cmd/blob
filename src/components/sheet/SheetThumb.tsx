"use client";

// A spreadsheet, small: the first rows and columns of its first sheet as they look (bold,
// colours, smart tables in their colours, numbers on the right), with the column letters and row
// numbers around them, and its first chart as a little card on top. Drawn from the preview saved
// with the spreadsheet (content->preview, src/sheet/doc.ts), so lists don't load the engine.
// An SVG that scales as a whole, like a picture, and follows dark mode through the colour variables.

import { colName } from "@/sheet/a1";
import { cutText, previewLook, type PreviewChart, type SheetPreview } from "@/sheet/doc";
import type { SheetColor } from "@/sheet/types";
import { cn } from "@/lib/utils";

const W = 320;
const H = 200;
/** Header band (column letters) and gutter (row numbers). */
const HEAD = 15;
const GUTTER = 20;
const ROW = 18;
/** Thumbnail px per sheet px. */
const K = 0.58;
const FONT = 9;
/** About how wide a character of FONT is. */
const CHAR = 5.1;

const tint = (c: SheetColor, percent: number) => `color-mix(in oklab, var(--sheet-${c}) ${percent}%, var(--raised))`;
const tableInk = (c: SheetColor) => `color-mix(in oklab, var(--sheet-${c}) 62%, var(--ink))`;

/** Text cut to fit `width` (with an ellipsis when cut); bold letters are wider. */
function fit(text: string, width: number, bold: boolean): string {
  const max = Math.floor((width - 6) / (bold ? CHAR * 1.1 : CHAR));
  if (max <= 0) return "";
  // Cut between characters: half an emoji renders differently on the server and in the browser
  // (React then rebuilds the whole list, error #418).
  return text.length <= max ? text : `${cutText(text, Math.max(1, max - 1))}…`;
}

export function SheetThumb({ preview, className }: { preview: SheetPreview | null | undefined; className?: string }) {
  const rows = preview?.rows ?? [];
  const nRows = Math.floor((H - HEAD) / ROW) + 1;
  // Columns: the preview's widths, then default ones to the edge.
  const xs: number[] = [GUTTER];
  const widths: number[] = [];
  for (let i = 0; xs[i] < W; i++) {
    const w = Math.max(18, (preview?.widths?.[i] ?? 100) * K);
    widths.push(w);
    xs.push(xs[i] + w);
  }
  const nCols = widths.length;

  const cells: React.ReactNode[] = [];
  const fills: React.ReactNode[] = [];
  const lines: React.ReactNode[] = [];
  rows.forEach((line, r) => {
    const y = HEAD + r * ROW;
    line.forEach((text, c) => {
      if (c >= nCols) return;
      const look = previewLook(preview?.look?.[r]?.[c]);
      const x = xs[c];
      const w = widths[c];
      let fill: string | null = null;
      let color = look.color ? `var(--sheet-${look.color})` : "var(--ink)";
      let bold = look.bold;
      if (look.part && look.tableColor) {
        if (look.part === "header") {
          fill = tint(look.tableColor, 24);
          color = look.color ? color : tableInk(look.tableColor);
          bold = true;
          lines.push(<line key={`hl${r}-${c}`} x1={x} x2={x + w} y1={y + ROW - 0.5} y2={y + ROW - 0.5} stroke={tableInk(look.tableColor)} strokeWidth={1} />);
        } else if (look.part === "totals") {
          fill = tint(look.tableColor, 11);
          bold = true;
          lines.push(<line key={`tl${r}-${c}`} x1={x} x2={x + w} y1={y + 0.5} y2={y + 0.5} stroke={tableInk(look.tableColor)} strokeWidth={1} />);
        } else if (look.part === "band") fill = tint(look.tableColor, 7);
      }
      if (look.fill) fill = `var(--sheet-${look.fill}-fill)`;
      if (fill) fills.push(<rect key={`f${r}-${c}`} x={x} y={y} width={w} height={ROW} fill={fill} />);
      if (!text) return;
      // Text on the left spills into empty cells to its right, as on the sheet.
      let room = w;
      if (look.align === "left") for (let k = c + 1; k < nCols && !line[k]; k++) room += widths[k];
      const shown = fit(text, room, bold);
      if (!shown) return;
      const tx = look.align === "right" ? x + w - 3 : look.align === "center" ? x + w / 2 : x + 3;
      cells.push(
        <text
          key={`t${r}-${c}`}
          x={tx}
          y={y + ROW - 5.5}
          textAnchor={look.align === "right" ? "end" : look.align === "center" ? "middle" : "start"}
          fontSize={FONT}
          fontWeight={bold ? 650 : 400}
          fontStyle={look.italic ? "italic" : undefined}
          fill={color}
        >
          {shown}
        </text>,
      );
    });
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMinYMin slice" aria-hidden className={cn("block aspect-[16/10] w-full bg-raised", className)} style={{ fontFamily: "inherit" }}>
      {/* Column letters and row numbers. */}
      <rect x={0} y={0} width={W} height={HEAD} fill="var(--surface)" />
      <rect x={0} y={0} width={GUTTER} height={H} fill="var(--surface)" />
      {fills}
      <g stroke="var(--line)" strokeWidth={0.6}>
        {xs.map((x, i) => (
          <line key={`v${i}`} x1={x} x2={x} y1={0} y2={H} />
        ))}
        {Array.from({ length: nRows + 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} x2={W} y1={HEAD + i * ROW} y2={HEAD + i * ROW} />
        ))}
      </g>
      <g fontSize={7.5} fill="var(--ink-3)" textAnchor="middle">
        {widths.map((w, i) => (
          <text key={`c${i}`} x={xs[i] + w / 2} y={HEAD - 4.5}>
            {colName(i)}
          </text>
        ))}
        {Array.from({ length: nRows }, (_, i) => (
          <text key={`r${i}`} x={GUTTER / 2} y={HEAD + i * ROW + ROW - 6}>
            {i + 1}
          </text>
        ))}
      </g>
      {lines}
      {cells}
      {preview?.chart && <MiniChart chart={preview.chart} />}
    </svg>
  );
}

/** The chart card in the corner: points, lines, columns or a pie, and the trendline. */
function MiniChart({ chart }: { chart: PreviewChart }) {
  const cw = 132;
  const ch = 92;
  const x0 = W - cw - 10;
  const y0 = H - ch - 10;
  const pad = 12;
  const pw = cw - 2 * pad;
  const ph = ch - 2 * pad;
  const color = `var(--sheet-${chart.color})`;
  const px = (v: number) => x0 + pad + (v / 100) * pw;
  const py = (v: number) => y0 + pad + ph - (v / 100) * ph;
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < chart.pts.length; i += 2) pts.push([chart.pts[i], chart.pts[i + 1]]);

  let body: React.ReactNode = null;
  if (chart.kind === "pie") {
    const values = pts.map(([, y]) => Math.max(0, y));
    const total = values.reduce((a, v) => a + v, 0);
    const cx = x0 + cw / 2;
    const cy = y0 + ch / 2;
    const rad = Math.min(cw, ch) / 2 - 10;
    const palette: SheetColor[] = ["blue", "orange", "green", "purple", "red", "teal", "pink", "brown"];
    let a = -Math.PI / 2;
    body =
      total > 0 ? (
        values.map((v, i) => {
          const da = (v / total) * Math.PI * 2;
          const a1 = a + da;
          const d =
            da >= Math.PI * 2 - 1e-6
              ? `M${cx - rad} ${cy}a${rad} ${rad} 0 1 0 ${2 * rad} 0a${rad} ${rad} 0 1 0 ${-2 * rad} 0`
              : `M${cx} ${cy}L${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}A${rad} ${rad} 0 ${da > Math.PI ? 1 : 0} 1 ${cx + rad * Math.cos(a1)} ${cy + rad * Math.sin(a1)}Z`;
          a = a1;
          return <path key={i} d={d} fill={`var(--sheet-${palette[i % palette.length]})`} stroke="var(--raised)" strokeWidth={0.8} />;
        })
      ) : (
        <circle cx={cx} cy={cy} r={rad} fill="none" stroke="var(--line-2)" />
      );
  } else if (chart.kind === "column" || chart.kind === "bar") {
    const n = Math.max(1, pts.length);
    const slot = (chart.kind === "column" ? pw : ph) / n;
    body = pts.map(([, y], i) =>
      chart.kind === "column" ? (
        <rect key={i} x={x0 + pad + i * slot + slot * 0.18} y={py(Math.max(0, y))} width={slot * 0.64} height={Math.max(0.5, py(0) - py(Math.max(0, y)))} rx={1} fill={color} />
      ) : (
        <rect key={i} x={px(0)} y={y0 + pad + i * slot + slot * 0.18} width={Math.max(0.5, px(Math.max(0, y)) - px(0))} height={slot * 0.64} rx={1} fill={color} />
      ),
    );
  } else {
    const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join("");
    body = (
      <>
        {chart.kind === "area" && pts.length > 1 && <path d={`${path}L${px(pts[pts.length - 1][0])} ${py(0)}L${px(pts[0][0])} ${py(0)}Z`} fill={color} opacity={0.22} />}
        {(chart.kind === "line" || chart.kind === "area") && pts.length > 1 && <path d={path} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />}
        {(chart.kind === "scatter" || chart.kind === "line") && pts.map(([x, y], i) => <circle key={i} cx={px(x)} cy={py(y)} r={2.1} fill={color} />)}
      </>
    );
  }

  return (
    <g>
      <rect x={x0} y={y0 + 1.5} width={cw} height={ch} rx={7} fill="rgb(0 0 0 / 0.06)" />
      <rect x={x0} y={y0} width={cw} height={ch} rx={7} fill="var(--raised)" stroke="var(--line-2)" strokeWidth={0.8} />
      {chart.kind !== "pie" && (
        <g stroke="var(--line-2)" strokeWidth={0.8}>
          <line x1={x0 + pad} x2={x0 + pad} y1={y0 + pad - 2} y2={y0 + pad + ph} />
          <line x1={x0 + pad} x2={x0 + pad + pw + 2} y1={y0 + pad + ph} y2={y0 + pad + ph} />
        </g>
      )}
      {body}
      {chart.fit && (
        <line
          x1={px(chart.fit[0])}
          y1={py(Math.max(-8, Math.min(108, chart.fit[1])))}
          x2={px(chart.fit[2])}
          y2={py(Math.max(-8, Math.min(108, chart.fit[3])))}
          stroke="var(--ink-2)"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
      )}
    </g>
  );
}
