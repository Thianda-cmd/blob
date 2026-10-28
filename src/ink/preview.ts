// A small picture of a handwritten note's first sheet for lists and cards: its paper, its strokes
// as simplified SVG paths, its text and where its pictures are, stored in pages.content (a few
// kilobytes at most). And the words in its text boxes, for search.

import type { InkDoc } from "./doc";
import { simplify } from "./geometry";
import { PREVIEW_K, type InkPreview, type Stroke } from "./model";
import { HIGHLIGHT_ALPHA } from "./pens";
import { wrapText } from "./render";

const K = PREVIEW_K;
/** Characters of path data at most (previews travel with every list of pages). */
const BUDGET = 9000;
/** Characters of text at most. */
const TEXT_BUDGET = 1500;

const r1 = (v: number) => Math.round(v * K * 10) / 10;

function pathOf(s: Stroke, tol: number): string {
  const rs = Array.from(s.ws, (w) => w / 2);
  const p = simplify(s.xs, s.ys, rs, tol);
  const n = p.xs.length;
  const f = (v: number) => Math.round(v * K).toString();
  let d = `M${f(p.xs[0])} ${f(p.ys[0])}`;
  if (n === 1) d += `l0 0`;
  for (let i = 1; i < n; i++) d += `L${f(p.xs[i])} ${f(p.ys[i])}`;
  return d;
}

let measure: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null | undefined;
function measurer() {
  if (measure === undefined) {
    try {
      measure = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1).getContext("2d") : document.createElement("canvas").getContext("2d");
    } catch {
      measure = null;
    }
  }
  return measure;
}

function linesOf(doc: InkDoc, sheet: string): InkPreview["lines"] {
  const strokes = doc.on(sheet).filter((t): t is Stroke => t.kind === "stroke");
  for (const tol of [2, 4, 8, 16]) {
    const lines: InkPreview["lines"] = [];
    let size = 0;
    for (const s of strokes) {
      const d = pathOf(s, tol);
      let width = 0;
      for (const w of s.ws) width += w;
      width = Math.round((width / s.ws.length) * K * 100) / 100;
      const alpha = s.tool === "highlighter" ? HIGHLIGHT_ALPHA : s.tool === "pencil" ? s.opacity : 1;
      lines.push([s.color, Math.max(0.05, width), d, Math.round(alpha * 100) / 100]);
      size += d.length + 20;
    }
    if (size <= BUDGET) return lines;
    if (tol === 16) {
      // Still too much: the smallest strokes go first (the picture keeps its shape), the rest stay
      // in their order (highlighters under the ink).
      const bySize = lines.map((_, i) => i).sort((a, b) => lines[a][2].length - lines[b][2].length);
      const drop = new Set<number>();
      for (const i of bySize) {
        if (size <= BUDGET) break;
        drop.add(i);
        size -= lines[i][2].length + 20;
      }
      return lines.filter((_, i) => !drop.has(i));
    }
  }
  return [];
}

export function buildPreview(doc: InkDoc): InkPreview | null {
  const sheet = doc.sheets[0];
  if (!sheet) return null;
  const texts: NonNullable<InkPreview["texts"]> = [];
  const pics: NonNullable<InkPreview["pics"]> = [];
  const ctx = measurer();
  let left = TEXT_BUDGET;
  for (const t of doc.on(sheet.id)) {
    if (t.kind === "image") pics.push([r1(t.x), r1(t.y), r1(t.w), r1(t.h), Math.round(t.rot * 1000) / 1000]);
    if (t.kind !== "text" || left <= 0 || !ctx) continue;
    const text = wrapText(ctx, t).join("\n").slice(0, left);
    left -= text.length;
    texts.push([t.color, r1(t.fs), r1(t.x), r1(t.y), text]);
  }
  const preview: InkPreview = { tpl: sheet.tpl, paper: sheet.paper, sheets: doc.sheets.length, lines: linesOf(doc, sheet.id) };
  if (texts.length) preview.texts = texts;
  if (pics.length) preview.pics = pics;
  return preview;
}

/** The words in a note's text boxes (pages.plain_text: search finds them). */
export function wordsOf(doc: InkDoc): string {
  return doc
    .all()
    .flatMap((i) => (i.kind === "text" ? [i.text] : []))
    .join("\n")
    .slice(0, 20000);
}
