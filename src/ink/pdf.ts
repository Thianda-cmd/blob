// Exporting a handwritten note: a PDF with one A4 page per sheet, everything as vectors (lines,
// strokes, text) and pictures embedded, or one sheet as a PNG picture. "Automatic" paper is
// exported white (for printing); dark paper stays dark.

import type { InkDoc } from "./doc";
import { centerline, outline, type PathSink } from "./geometry";
import { SHEET_H, SHEET_W, type Sheet, type Thing } from "./model";
import { HIGHLIGHT_ALPHA } from "./pens";
import { drawPaper, drawThing, inkColor, lookOf, templateLines, TEXT_FONT, type Images } from "./render";

const PAGE_W = 595.276;
const PAGE_H = 841.89;
const K = PAGE_W / SHEET_W;

const enc = new TextEncoder();

const num = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};

function rgb(color: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(color);
  if (m) {
    const n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const a = /rgba?\(([^)]+)\)/.exec(color);
  if (a) {
    const [r, g, b] = a[1].split(",").map((v) => parseFloat(v));
    return [r / 255, g / 255, b / 255];
  }
  return [0, 0, 0];
}

function alphaOf(color: string): number {
  const a = /rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/.exec(color);
  return a ? parseFloat(a[1]) : 1;
}

/** PDF path operators from our paths (arcs as Bézier curves). */
class PdfPath implements PathSink {
  out: string[] = [];
  private x = 0;
  private y = 0;
  moveTo(x: number, y: number) {
    this.out.push(`${num(x)} ${num(y)} m`);
    this.x = x;
    this.y = y;
  }
  lineTo(x: number, y: number) {
    this.out.push(`${num(x)} ${num(y)} l`);
    this.x = x;
    this.y = y;
  }
  arc(cx: number, cy: number, r: number, a0: number, a1: number, ccw = false) {
    let sweep = ccw ? a0 - a1 : a1 - a0;
    sweep = ((sweep % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (sweep < 1e-9) sweep = 0;
    const sx = cx + r * Math.cos(a0);
    const sy = cy + r * Math.sin(a0);
    if (Math.hypot(sx - this.x, sy - this.y) > 1e-6) this.lineTo(sx, sy);
    const dir = ccw ? -1 : 1;
    const parts = Math.max(1, Math.ceil(sweep / (Math.PI / 2)));
    const step = (sweep / parts) * dir;
    const k = (4 / 3) * Math.tan(step / 4);
    let a = a0;
    for (let i = 0; i < parts; i++) {
      const b = a + step;
      const x1 = cx + r * (Math.cos(a) - k * Math.sin(a));
      const y1 = cy + r * (Math.sin(a) + k * Math.cos(a));
      const x2 = cx + r * (Math.cos(b) + k * Math.sin(b));
      const y2 = cy + r * (Math.sin(b) - k * Math.cos(b));
      const x3 = cx + r * Math.cos(b);
      const y3 = cy + r * Math.sin(b);
      this.out.push(`${num(x1)} ${num(y1)} ${num(x2)} ${num(y2)} ${num(x3)} ${num(y3)} c`);
      a = b;
      this.x = x3;
      this.y = y3;
    }
  }
  closePath() {
    this.out.push("h");
  }
}

/** Text in the PDF's built-in Helvetica (Windows-1252: German and most Western letters). */
function pdfString(text: string): string {
  let out = "";
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    const code = c < 256 ? c : WIN[ch] ?? 63;
    if (code === 40 || code === 41 || code === 92) out += "\\" + String.fromCharCode(code);
    else if (code < 32 || code > 126) out += "\\" + code.toString(8).padStart(3, "0");
    else out += String.fromCharCode(code);
  }
  return `(${out})`;
}

const WIN: Record<string, number> = { "€": 128, "‚": 130, "„": 132, "…": 133, "‘": 145, "’": 146, "“": 147, "”": 148, "–": 150, "—": 151, "•": 149 };

type Obj = { id: number; parts: Uint8Array[] };

async function deflate(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

/** A picture as JPEG bytes on the paper's colour (PDF pictures here have no transparency). */
async function jpegOf(img: CanvasImageSource, w: number, h: number, paper: string): Promise<{ bytes: Uint8Array; w: number; h: number } | null> {
  const maxSide = 2400;
  const k = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * k));
  const ch = Math.max(1, Math.round(h * k));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0, cw, ch);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) return null;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w: cw, h: ch };
}

/** The whole note as a PDF. */
export async function exportPdf(doc: InkDoc, images: Images & { ready?: (paths: string[]) => Promise<void> }, title: string): Promise<Blob> {
  const paths = doc.all().flatMap((t) => (t.kind === "image" ? [t.path] : []));
  if (paths.length && images.ready) await images.ready(paths);
  const objects: Obj[] = [];
  let next = 1;
  const reserve = () => next++;
  const add = (id: number, ...parts: (string | Uint8Array)[]) => objects.push({ id, parts: parts.map((p) => (typeof p === "string" ? enc.encode(p) : p)) });
  const catalog = reserve();
  const pagesId = reserve();
  const font = reserve();
  add(font, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
  const alphas = new Map<number, number>();
  const gs = (a: number) => {
    const key = Math.round(a * 100) / 100;
    let id = alphas.get(key);
    if (!id) {
      id = reserve();
      alphas.set(key, id);
      add(id, `<< /Type /ExtGState /ca ${key} /CA ${key} >>`);
    }
    return `/A${Math.round(key * 100)} gs`;
  };
  const pageIds: number[] = [];
  const measure = document.createElement("canvas").getContext("2d")!;

  for (const sheet of doc.sheets) {
    const look = lookOf(sheet.paper === "auto" ? "white" : sheet.paper, false);
    const ops: string[] = [];
    const xobjects: string[] = [];
    ops.push("q", `${num(K)} 0 0 ${num(-K)} 0 ${num(PAGE_H)} cm`);
    if (sheet.paper !== "auto" && sheet.paper !== "white") {
      const [r, g, b] = rgb(look.paper);
      ops.push(`${num(r)} ${num(g)} ${num(b)} rg 0 0 ${SHEET_W} ${SHEET_H} re f`);
    }
    // The template.
    const t = templateLines(sheet.tpl);
    const lines = (list: number[], color: string, width: number) => {
      if (!list.length) return;
      const [r, g, b] = rgb(color);
      ops.push("q", gs(alphaOf(color)), `${num(r)} ${num(g)} ${num(b)} RG ${num(width)} w`);
      for (let i = 0; i < list.length; i += 4) ops.push(`${num(list[i])} ${num(list[i + 1])} m ${num(list[i + 2])} ${num(list[i + 3])} l`);
      ops.push("S", "Q");
    };
    lines(t.fine, look.line, 0.62);
    lines(t.strong, look.strong, 0.9);
    if (t.dots.length) {
      const [r, g, b] = rgb(look.strong);
      ops.push("q", gs(alphaOf(look.strong)), `${num(r)} ${num(g)} ${num(b)} rg`);
      const p = new PdfPath();
      for (let i = 0; i < t.dots.length; i += 2) {
        p.moveTo(t.dots[i] + t.dot, t.dots[i + 1]);
        p.arc(t.dots[i], t.dots[i + 1], t.dot, 0, Math.PI * 2 - 1e-6);
        p.closePath();
      }
      ops.push(...p.out, "f", "Q");
    }
    ops.push(`0 0 ${SHEET_W} ${SHEET_H} re W n`);
    for (const thing of doc.on(sheet.id)) await thingOps(thing, ops, xobjects, look, images, gs, measure, reserve, add);
    ops.push("Q");
    const raw = enc.encode(ops.join("\n"));
    const packed = await deflate(raw);
    const content = reserve();
    add(content, `<< /Length ${(packed ?? raw).length}${packed ? " /Filter /FlateDecode" : ""} >>\nstream\n`, packed ?? raw, "\nendstream");
    const page = reserve();
    pageIds.push(page);
    const ext = [...alphas].map(([a, id]) => `/A${Math.round(a * 100)} ${id} 0 R`).join(" ");
    add(page, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(PAGE_W)} ${num(PAGE_H)}] /Contents ${content} 0 R /Resources << /Font << /F1 ${font} 0 R >> /ExtGState << ${ext} >> /XObject << ${xobjects.join(" ")} >> >> >>`);
  }
  add(pagesId, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  const info = reserve();
  add(info, `<< /Title ${pdfString(title)} /Producer (Blob) >>`);
  add(catalog, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  // Pages were written in the order they were made; the file lists objects by number.
  objects.sort((a, b) => a.id - b.id);
  const chunks: Uint8Array[] = [enc.encode("%PDF-1.4\n%âãÏÓ\n")];
  let offset = chunks[0].length;
  const offsets: number[] = [];
  for (const o of objects) {
    offsets[o.id] = offset;
    const head = enc.encode(`${o.id} 0 obj\n`);
    const tail = enc.encode("\nendobj\n");
    chunks.push(head, ...o.parts, tail);
    offset += head.length + tail.length + o.parts.reduce((s, p) => s + p.length, 0);
  }
  const size = next;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let id = 1; id < size; id++) xref += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  chunks.push(enc.encode(`${xref}trailer\n<< /Size ${size} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${offset}\n%%EOF\n`));
  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

async function thingOps(
  thing: Thing,
  ops: string[],
  xobjects: string[],
  look: ReturnType<typeof lookOf>,
  images: Images,
  gs: (a: number) => string,
  measure: CanvasRenderingContext2D,
  reserve: () => number,
  add: (id: number, ...parts: (string | Uint8Array)[]) => void,
) {
  if (thing.kind === "stroke") {
    const color = inkColor(thing.color, look.dark);
    const [r, g, b] = rgb(color);
    const alpha = thing.tool === "highlighter" ? HIGHLIGHT_ALPHA : thing.tool === "pencil" ? thing.opacity : 1;
    const p = new PdfPath();
    outline(centerline(thing.xs, thing.ys, thing.ws, !thing.shape), p);
    ops.push("q");
    if (alpha < 1) ops.push(gs(alpha));
    ops.push(`${num(r)} ${num(g)} ${num(b)} rg`, ...p.out, "f", "Q");
    return;
  }
  if (thing.kind === "image") {
    const img = images.get(thing.path);
    if (!img) return;
    const size = img as { naturalWidth?: number; width?: number; naturalHeight?: number; height?: number };
    const jpeg = await jpegOf(img, size.naturalWidth || Number(size.width) || 1000, size.naturalHeight || Number(size.height) || 1000, look.paper);
    if (!jpeg) return;
    const id = reserve();
    add(id, `<< /Type /XObject /Subtype /Image /Width ${jpeg.w} /Height ${jpeg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.bytes.length} >>\nstream\n`, jpeg.bytes, "\nendstream");
    const name = `/I${id}`;
    xobjects.push(`${name} ${id} 0 R`);
    const c = Math.cos(thing.rot);
    const s = Math.sin(thing.rot);
    const cx = thing.x + thing.w / 2;
    const cy = thing.y + thing.h / 2;
    // Turn around the middle, then the picture (upside down in our flipped space: drawn with -h).
    ops.push("q", `${num(c)} ${num(s)} ${num(-s)} ${num(c)} ${num(cx)} ${num(cy)} cm`, `${num(thing.w)} 0 0 ${num(-thing.h)} ${num(-thing.w / 2)} ${num(thing.h / 2)} cm`, `${name} Do`, "Q");
    return;
  }
  // Text: wrapped as on screen, in Helvetica.
  const [r, g, b] = rgb(inkColor(thing.color, look.dark));
  measure.font = `${thing.fs}px ${TEXT_FONT}`;
  const lines: string[] = [];
  for (const para of thing.text.split("\n")) {
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const nextLine = line + word;
      if (line && measure.measureText(nextLine).width > thing.w) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else line = nextLine;
    }
    lines.push(line);
  }
  ops.push("q", `${num(r)} ${num(g)} ${num(b)} rg`, "BT", `/F1 ${num(thing.fs)} Tf`);
  const lh = thing.fs * 1.35;
  lines.forEach((line, i) => {
    ops.push(`1 0 0 -1 ${num(thing.x)} ${num(thing.y + i * lh + thing.fs * 0.95)} Tm ${pdfString(line)} Tj`);
  });
  ops.push("ET", "Q");
}

/** One sheet as a PNG picture (about 2000 pixels wide). */
export async function exportPng(doc: InkDoc, sheet: Sheet, images: Images & { ready?: (paths: string[]) => Promise<void> }, dark: boolean): Promise<Blob> {
  const things = doc.on(sheet.id);
  const paths = things.flatMap((t) => (t.kind === "image" ? [t.path] : []));
  if (paths.length && images.ready) await images.ready(paths);
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = SHEET_W * scale;
  canvas.height = Math.round(SHEET_H * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const look = lookOf(sheet.paper, dark);
  drawPaper(ctx, sheet.tpl, look, 1 / scale);
  for (const t of things) drawThing(ctx, t, look.dark, images);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no png"))), "image/png"));
}
