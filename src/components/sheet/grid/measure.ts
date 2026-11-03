// Measuring text the way the grid draws it (one canvas, results remembered): whether text spills
// into the next cells, whether a number fits or shows "###", how tall wrapped text is, and how
// wide a column must be to fit its content.

let ctx: CanvasRenderingContext2D | null = null;
let family = "ui-sans-serif, system-ui, sans-serif";
const widths = new Map<string, number>();

/** The grid's font family as the browser resolved it (set once the grid is on screen). */
export function setMeasureFamily(f: string) {
  if (!f || f === family) return;
  family = f;
  widths.clear();
}

/** Forget what was measured (a web font finished loading: everything is a little different). */
export function resetMeasure() {
  widths.clear();
}

export const LINE_HEIGHT = 1.3;

/** The canvas/CSS font of a cell: size in px (zoomed). */
export function fontOf(size: number, bold: boolean, italic: boolean): string {
  return `${italic ? "italic " : ""}${bold ? "bold " : ""}${size}px ${family}`;
}

function context(): CanvasRenderingContext2D | null {
  if (ctx) return ctx;
  if (typeof document === "undefined") return null;
  ctx = document.createElement("canvas").getContext("2d");
  return ctx;
}

/** Width of one line of text in px. */
function lineWidth(text: string, font: string, size: number): number {
  const key = `${font}\u0000${text}`;
  const known = widths.get(key);
  if (known !== undefined) return known;
  const c = context();
  // No canvas (the server): a fair guess for the font.
  if (!c) return text.length * size * 0.56;
  c.font = font;
  const w = c.measureText(text).width;
  if (widths.size > 20000) widths.clear();
  widths.set(key, w);
  return w;
}

/** Width of text (the widest line) in px. */
export function textWidth(text: string, size: number, bold = false, italic = false): number {
  const font = fontOf(size, bold, italic);
  if (!text.includes("\n")) return lineWidth(text, font, size);
  let max = 0;
  for (const line of text.split("\n")) max = Math.max(max, lineWidth(line, font, size));
  return max;
}

/** How many lines text takes when it wraps at `max` px (words first, long words by letters). */
export function wrappedLines(text: string, max: number, size: number, bold = false, italic = false): number {
  const font = fontOf(size, bold, italic);
  const space = lineWidth(" ", font, size);
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    lines++;
    let used = 0;
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      let w = lineWidth(word, font, size);
      if (used > 0 && used + space + w <= max) {
        used += space + w;
        continue;
      }
      if (used > 0) lines++;
      // A word longer than the line breaks anywhere.
      while (w > max && max > 0) {
        lines++;
        w -= max;
      }
      used = w;
    }
  }
  return Math.max(1, lines);
}
