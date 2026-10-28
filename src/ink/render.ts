// Drawing a handwritten note: paper and its template (lines, grid, dots…), strokes, pictures and
// text boxes, on a 2D canvas whose transform maps sheet units to pixels. The same functions draw
// the screen, previews and exports.

import { centerline, outline, type PathSink } from "./geometry";
import { HIGHLIGHT_ALPHA } from "./pens";
import { INK, MM, SHEET_H, SHEET_W, type Box, type InkColor, type Paper, type Picture, type Stroke, type Template, type TextBox, type Thing } from "./model";

// Paper ---------------------------------------------------------------------------------------

export type Look = {
  /** The paper's colour. */
  paper: string;
  /** Dark paper: light ink, light lines. */
  dark: boolean;
  /** Template lines and dots. */
  line: string;
  /** Stronger lines (millimetre paper's centimetres, Cornell's margins). */
  strong: string;
};

const LIGHT_LINE = "rgba(64, 96, 150, 0.24)";
const LIGHT_STRONG = "rgba(64, 96, 150, 0.42)";
const DARK_LINE = "rgba(236, 233, 224, 0.13)";
const DARK_STRONG = "rgba(236, 233, 224, 0.24)";

/** How a sheet's paper looks; "auto" follows the app (dark when `appDark`). */
export function lookOf(paper: Paper, appDark: boolean): Look {
  const dark = paper === "dark" || (paper === "auto" && appDark);
  const color = paper === "cream" ? "#fbf6e8" : paper === "gray" ? "#eef0f2" : paper === "dark" ? "#1f1f1c" : paper === "auto" && appDark ? "#1f1f1c" : "#fffefc";
  return { paper: color, dark, line: dark ? DARK_LINE : LIGHT_LINE, strong: dark ? DARK_STRONG : LIGHT_STRONG };
}

// Colours ---------------------------------------------------------------------------------------

const adapted = new Map<string, string>();

/**
 * The colour a stroke is shown in. "ink" is black on light paper and white on dark paper; on dark
 * paper, dark colours turn light (same hue), so everything stays readable, like Samsung Notes does.
 */
export function inkColor(color: InkColor, dark: boolean): string {
  if (color === INK) return dark ? "#edebe4" : "#1c1b18";
  if (!dark) return color;
  let out = adapted.get(color);
  if (!out) {
    const [h, s, l] = toHsl(color);
    out = l < 0.6 ? hsl(h, s, Math.min(0.86, 1 - l * 0.72)) : color;
    adapted.set(color, out);
  }
  return out;
}

export function toHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hsl(h: number, s: number, l: number): string {
  const f = (k: number) => {
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min((k + h / 30) % 12 - 3, 9 - ((k + h / 30) % 12), 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Templates -----------------------------------------------------------------------------------

/** A template's lines (x0, y0, x1, y1 …) in two strengths, and dots (x, y …); `pitch`: how far apart the fine ones are. */
export type TemplateLines = { fine: number[]; strong: number[]; dots: number[]; dot: number; pitch: number };

const PITCH: Record<Template, number> = { blank: 0, lined: 8 * MM, narrow: 6 * MM, grid: 5 * MM, dots: 5 * MM, mm: MM, cornell: 8 * MM, music: 2.1 * MM };

const cache = new Map<Template, TemplateLines>();

export function templateLines(tpl: Template): TemplateLines {
  let t = cache.get(tpl);
  if (t) return t;
  t = { fine: [], strong: [], dots: [], dot: 0, pitch: PITCH[tpl] };
  const hline = (to: number[], y: number, x0 = 0, x1 = SHEET_W) => to.push(x0, y, x1, y);
  const vline = (to: number[], x: number, y0 = 0, y1 = SHEET_H) => to.push(x, y0, x, y1);
  switch (tpl) {
    case "lined":
      for (let y = 30 * MM; y <= SHEET_H - 12 * MM; y += 8 * MM) hline(t.fine, y);
      break;
    case "narrow":
      for (let y = 24 * MM; y <= SHEET_H - 10 * MM; y += 6 * MM) hline(t.fine, y);
      break;
    case "grid": {
      const step = 5 * MM;
      const ox = (SHEET_W - Math.floor(SHEET_W / step) * step) / 2;
      const oy = (SHEET_H - Math.floor(SHEET_H / step) * step) / 2;
      for (let x = ox; x <= SHEET_W; x += step) vline(t.fine, x);
      for (let y = oy; y <= SHEET_H; y += step) hline(t.fine, y);
      break;
    }
    case "dots": {
      const step = 5 * MM;
      const ox = (SHEET_W - Math.floor(SHEET_W / step) * step) / 2;
      const oy = (SHEET_H - Math.floor(SHEET_H / step) * step) / 2;
      for (let y = oy; y <= SHEET_H - 1; y += step) for (let x = ox; x <= SHEET_W - 1; x += step) t.dots.push(x, y);
      t.dot = 1.15;
      break;
    }
    case "mm": {
      const x0 = 10 * MM;
      const x1 = SHEET_W - 10 * MM;
      const cols = Math.floor((x1 - x0) / MM / 10) * 10;
      const rows = Math.floor((SHEET_H - 20 * MM) / MM / 10) * 10;
      const left = (SHEET_W - cols * MM) / 2;
      const top = (SHEET_H - rows * MM) / 2;
      for (let i = 0; i <= cols; i++) vline(i % 10 === 0 ? t.strong : t.fine, left + i * MM, top, top + rows * MM);
      for (let j = 0; j <= rows; j++) hline(j % 10 === 0 ? t.strong : t.fine, top + j * MM, left, left + cols * MM);
      break;
    }
    case "cornell": {
      const top = 32 * MM;
      const summary = SHEET_H - 55 * MM;
      for (let y = top + 8 * MM; y <= SHEET_H - 12 * MM; y += 8 * MM) if (Math.abs(y - summary) > 2) hline(t.fine, y);
      hline(t.strong, top);
      hline(t.strong, summary);
      vline(t.strong, 62 * MM, top, summary);
      break;
    }
    case "music": {
      const gap = 2.1 * MM;
      for (let y = 26 * MM; y + 4 * gap <= SHEET_H - 14 * MM; y += 4 * gap + 15 * MM) {
        for (let k = 0; k < 5; k++) hline(t.fine, y + k * gap, 14 * MM, SHEET_W - 14 * MM);
      }
      break;
    }
    case "blank":
      break;
  }
  cache.set(tpl, t);
  return t;
}

/**
 * Paper and template of one sheet, drawn at the context's transform (sheet units). `px` is one
 * device pixel in units: lines never get thinner than that. `clip` limits the work to what shows.
 */
export function drawPaper(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, tpl: Template, look: Look, px: number, clip?: Box) {
  ctx.fillStyle = look.paper;
  ctx.fillRect(0, 0, SHEET_W, SHEET_H);
  const t = templateLines(tpl);
  const c = clip ?? { x0: 0, y0: 0, x1: SHEET_W, y1: SHEET_H };
  const lines = (list: number[], color: string, width: number) => {
    if (!list.length) return;
    ctx.beginPath();
    for (let i = 0; i < list.length; i += 4) {
      const x0 = list[i];
      const y0 = list[i + 1];
      const x1 = list[i + 2];
      const y1 = list[i + 3];
      if (Math.max(x0, x1) < c.x0 || Math.min(x0, x1) > c.x1 || Math.max(y0, y1) < c.y0 || Math.min(y0, y1) > c.y1) continue;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  // Fine lines fade as they crowd together (zoomed far out, small pictures) instead of turning the
  // page grey: gone at 2 device pixels apart, full from 6.
  const fade = t.pitch ? Math.min(1, Math.max(0, (t.pitch / px - 2) / 4)) : 1;
  if (fade > 0) {
    ctx.globalAlpha = fade;
    lines(t.fine, look.line, Math.max(0.62, px));
    ctx.globalAlpha = 1;
  }
  lines(t.strong, look.strong, Math.max(0.9, px * 1.2));
  if (t.dots.length && fade > 0) {
    ctx.globalAlpha = fade;
    ctx.fillStyle = look.strong;
    const r = Math.max(t.dot, px * 0.8);
    ctx.beginPath();
    for (let i = 0; i < t.dots.length; i += 2) {
      const x = t.dots[i];
      const y = t.dots[i + 1];
      if (x < c.x0 - r || x > c.x1 + r || y < c.y0 - r || y > c.y1 + r) continue;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// Strokes -------------------------------------------------------------------------------------

const paths = new WeakMap<Stroke, Path2D>();

/** The stroke's filled outline (sheet units), made once per stroke. */
export function strokePath(s: Stroke): Path2D {
  let p = paths.get(s);
  if (!p) {
    p = new Path2D();
    outline(centerline(s.xs, s.ys, s.ws, !s.shape), p as unknown as PathSink);
    paths.set(s, p);
  }
  return p;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Pencil grain: an alpha pattern, tinted per colour. */
const grains = new Map<string, CanvasPattern | null>();
let grainMask: OffscreenCanvas | HTMLCanvasElement | null = null;

function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function mask(): OffscreenCanvas | HTMLCanvasElement {
  if (grainMask) return grainMask;
  const size = 128;
  const c = makeCanvas(size, size);
  const g = c.getContext("2d") as Ctx;
  const img = g.createImageData(size, size);
  // Seeded noise: the same grain everywhere, on every device.
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // Coarse value noise (paper fibres) plus fine speckle (graphite).
  const coarse = Array.from({ length: 17 * 17 }, rnd);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * 16;
      const gy = (y / size) * 16;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const fx = gx - ix;
      const fy = gy - iy;
      const at = (i: number, j: number) => coarse[((j % 16) * 17 + (i % 16)) % coarse.length];
      const v = at(ix, iy) * (1 - fx) * (1 - fy) + at(ix + 1, iy) * fx * (1 - fy) + at(ix, iy + 1) * (1 - fx) * fy + at(ix + 1, iy + 1) * fx * fy;
      const speck = rnd();
      const a = Math.min(1, Math.max(0, 0.5 + 0.35 * v + 0.35 * (speck - 0.5) - (speck > 0.93 ? 0.4 : 0)));
      const k = (y * size + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 0;
      img.data[k + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  grainMask = c;
  return c;
}

function grain(ctx: Ctx, color: string): CanvasPattern | null {
  if (grains.has(color)) return grains.get(color)!;
  const m = mask();
  const c = makeCanvas(m.width, m.height);
  const g = c.getContext("2d") as Ctx;
  g.drawImage(m, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  const pattern = ctx.createPattern(c as CanvasImageSource, "repeat");
  // One grain pixel is a third of a unit (fixed to the paper, like real graphite).
  pattern?.setTransform(new DOMMatrix([1 / 3, 0, 0, 1 / 3, 0, 0]));
  grains.set(color, pattern);
  return pattern;
}

/** Draws a stroke (the context's transform maps sheet units to pixels). */
export function drawStroke(ctx: Ctx, s: Stroke, dark: boolean, opts?: { color?: string; alpha?: number }) {
  const color = opts?.color ?? inkColor(s.color, dark);
  const alpha = (opts?.alpha ?? 1) * (s.tool === "highlighter" ? (dark ? HIGHLIGHT_ALPHA + 0.08 : HIGHLIGHT_ALPHA) : s.tool === "pencil" ? s.opacity : 1);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = s.tool === "pencil" ? (grain(ctx, color) ?? color) : color;
  ctx.fill(strokePath(s));
  ctx.globalAlpha = 1;
}

// Pictures and text -----------------------------------------------------------------------------

/** Where pictures come from: the loaded image, or null while it loads (then a placeholder shows). */
export type Images = { get(path: string): CanvasImageSource | null };

export function drawPicture(ctx: Ctx, p: Picture, images: Images | null, dark: boolean) {
  const img = images?.get(p.path) ?? null;
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
  if (p.rot) ctx.rotate(p.rot);
  if (img) {
    ctx.drawImage(img, -p.w / 2, -p.h / 2, p.w, p.h);
  } else {
    ctx.fillStyle = dark ? "rgba(255,255,255,0.06)" : "rgba(28,27,24,0.05)";
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
  }
  ctx.restore();
}

/** The font text boxes use (the app's own). */
export let TEXT_FONT = "ui-sans-serif, system-ui, sans-serif";
export function setTextFont(family: string) {
  if (family) TEXT_FONT = family;
}

/** Lines of a text box, wrapped to its width. */
export function wrapText(ctx: Ctx, t: Pick<TextBox, "text" | "w" | "fs">): string[] {
  ctx.font = `${t.fs}px ${TEXT_FONT}`;
  const out: string[] = [];
  for (const para of t.text.split("\n")) {
    const words = para.split(/(\s+)/);
    let line = "";
    for (const word of words) {
      const next = line + word;
      if (line && ctx.measureText(next).width > t.w) {
        out.push(line.trimEnd());
        line = word.trimStart();
        // A single word wider than the box: break it.
        while (ctx.measureText(line).width > t.w && line.length > 1) {
          let k = line.length - 1;
          while (k > 1 && ctx.measureText(line.slice(0, k)).width > t.w) k--;
          out.push(line.slice(0, k));
          line = line.slice(k);
        }
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

export function drawText(ctx: Ctx, t: TextBox, dark: boolean) {
  const lines = wrapText(ctx, t);
  ctx.fillStyle = inkColor(t.color, dark);
  ctx.textBaseline = "top";
  const lh = t.fs * 1.35;
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], t.x, t.y + i * lh + t.fs * 0.17);
}

/** Draws any item on a sheet. */
export function drawThing(ctx: Ctx, t: Thing, dark: boolean, images: Images | null) {
  if (t.kind === "stroke") drawStroke(ctx, t, dark);
  else if (t.kind === "image") drawPicture(ctx, t, images, dark);
  else drawText(ctx, t, dark);
}
