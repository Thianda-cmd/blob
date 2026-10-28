// A small picture of a handwritten note's first sheet for lists and cards: its paper and its
// strokes as simplified SVG paths, stored in pages.content (a few kilobytes at most).

import type { InkDoc } from "./doc";
import { simplify } from "./geometry";
import type { InkPreview, Stroke } from "./model";
import { HIGHLIGHT_ALPHA } from "./pens";

/** Preview units: a quarter of a sheet unit (a sheet is 250 × 353.5), whole numbers. */
export const PREVIEW_K = 0.25;
const K = PREVIEW_K;
/** Characters of path data at most (previews travel with every list of pages). */
const BUDGET = 9000;

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

export function buildPreview(doc: InkDoc): InkPreview | null {
  const sheet = doc.sheets[0];
  if (!sheet) return null;
  const strokes = doc.on(sheet.id).filter((t): t is Stroke => t.kind === "stroke");
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
    if (size <= BUDGET || tol === 16) {
      // Still too much: the smallest strokes go first (the picture keeps its shape), the rest stay
      // in their order (highlighters under the ink).
      if (size > BUDGET) {
        const bySize = lines.map((l, i) => i).sort((a, b) => lines[a][2].length - lines[b][2].length);
        const drop = new Set<number>();
        for (const i of bySize) {
          if (size <= BUDGET) break;
          drop.add(i);
          size -= lines[i][2].length + 20;
        }
        return { tpl: sheet.tpl, paper: sheet.paper, sheets: doc.sheets.length, lines: lines.filter((_, i) => !drop.has(i)) };
      }
      return { tpl: sheet.tpl, paper: sheet.paper, sheets: doc.sheets.length, lines };
    }
  }
  return null;
}

/** Whether a stored preview is one this app can show. */
export function readPreview(content: unknown): InkPreview | null {
  const p = (content as { preview?: unknown } | null)?.preview as InkPreview | undefined;
  if (!p || typeof p !== "object" || !Array.isArray(p.lines)) return null;
  return p;
}
