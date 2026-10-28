// Checks the handwriting engine (src/ink): point coding, the stroke outline (filled with the
// nonzero rule it must cover exactly the circles along the line, nothing more and nothing less),
// cutting, selecting and shapes. Run with `npm run check:ink`.

import { decodePoints, encodePoints, fromBase64Url, toBase64Url } from "../src/ink/codec";
import { centerline, cut, inPolygon, outline, simplify, touches, type Line, type PathSink } from "../src/ink/geometry";
import { decodeItem, encodeItem, type Stroke } from "../src/ink/model";

let failed = 0;
let passed = 0;
function ok(cond: unknown, msg: string) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL ${msg}`);
  }
}

// A seeded random source, so failures can be repeated.
let seed = 12345;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

// Point coding ------------------------------------------------------------------------------------

for (const len of [0, 1, 2, 3, 4, 5, 10, 255, 256, 1000]) {
  const bytes = Uint8Array.from({ length: len }, () => Math.floor(rand() * 256));
  const back = fromBase64Url(toBase64Url(bytes));
  ok(back && back.length === len && back.every((b, i) => b === bytes[i]), `base64url round trip (${len} bytes)`);
}
ok(fromBase64Url("a") === null && fromBase64Url("ab!c") === null, "base64url refuses bad text");

for (let round = 0; round < 200; round++) {
  const n = 1 + Math.floor(rand() * 400);
  const xs: number[] = [];
  const ys: number[] = [];
  const ws: number[] = [];
  let x = rand() * 1000;
  let y = rand() * 1414;
  for (let i = 0; i < n; i++) {
    x += (rand() - 0.5) * (round % 7 === 0 ? 400 : 6);
    y += (rand() - 0.5) * (round % 7 === 0 ? 400 : 6);
    xs.push(x);
    ys.push(y);
    ws.push(0.1 + rand() * (round % 5 === 0 ? 120 : 8));
  }
  const text = encodePoints(xs, ys, ws);
  const back = decodePoints(text);
  const close = back && back.xs.length === n && xs.every((v, i) => Math.abs(back.xs[i] - v) <= 0.051 && Math.abs(back.ys[i] - ys[i]) <= 0.051 && Math.abs(back.ws[i] - ws[i]) <= 0.051);
  if (!close) console.log("  points", n, text.slice(0, 40));
  ok(close, `points round trip (${n} points)`);
}
{
  const xs = Array.from({ length: 60 }, (_, i) => 100 + i * 1.7);
  const ys = Array.from({ length: 60 }, (_, i) => 200 + Math.sin(i / 5) * 20);
  const ws = Array.from({ length: 60 }, () => 3);
  const size = encodePoints(xs, ys, ws).length;
  ok(size < 260, `a 60-point stroke is small (${size} characters)`);
}
ok(decodePoints("") === null && decodePoints("AA") === null && decodePoints("Ag") === null && decodePoints("!!!!") === null, "damaged points are refused");
ok(decodePoints(toBase64Url(Uint8Array.from([1, 0x80, 0x80, 0x80, 0x80, 0x80, 1]))) === null, "overlong numbers are refused");

// Items -------------------------------------------------------------------------------------

{
  const id = "11111111-1111-4111-8111-111111111111";
  const sheet = "22222222-2222-4222-8222-222222222222";
  const pts = { xs: Float32Array.from([1, 2, 3]), ys: Float32Array.from([4, 5, 6]), ws: Float32Array.from([2, 2.5, 3]) };
  const stroke: Stroke = { kind: "stroke", id, sheet, seq: 5, tool: "fountain", color: "#123abc", size: 4, opacity: 0.8, shape: null, ...pts, box: { x0: 0, y0: 0, x1: 0, y1: 0 } };
  const wire = encodeItem(stroke);
  const back = decodeItem(JSON.parse(JSON.stringify(wire))) as Stroke;
  ok(back?.kind === "stroke" && back.tool === "fountain" && back.color === "#123abc" && back.opacity === 0.8 && back.xs.length === 3 && Math.abs(back.ws[2] - 3) < 0.06, "a stroke survives sending");
  ok(back.box.x0 < 1 && back.box.x1 > 3, "a stroke's box covers its width");
  ok(decodeItem({ ...wire, data: { ...wire.data, t: "laser" } }) === null, "unknown pens are skipped");
  ok(decodeItem({ ...wire, data: { ...wire.data, c: "red" } })?.kind === "stroke", "an unknown colour falls back to ink");
  ok(decodeItem({ ...wire, sheet: null }) === null, "a stroke needs its sheet");
  ok(decodeItem({ ...wire, deleted: true }) === null, "deleted items are not shown");
  ok(decodeItem({ id, kind: "sheet", sheet: null, seq: 1, data: { tpl: "grid", paper: "cream" } })?.kind === "sheet", "sheets are read");
  ok((decodeItem({ id, kind: "sheet", sheet: null, seq: 1, data: { tpl: "wallpaper" } }) as { tpl: string }).tpl === "blank", "unknown templates become blank");
  ok(decodeItem({ id, kind: "image", sheet, seq: 1, data: { path: "https://evil.example/x.png", x: 0, y: 0, w: 1, h: 1 } }) === null, "pictures only come from the files bucket");
}

// The outline -------------------------------------------------------------------------------------

/** Flattens a path (arcs into short lines) into closed polygons. */
class Flat implements PathSink {
  polys: number[][] = [];
  cur: number[] = [];
  moveTo(x: number, y: number) {
    if (this.cur.length) this.polys.push(this.cur);
    this.cur = [x, y];
  }
  lineTo(x: number, y: number) {
    this.cur.push(x, y);
  }
  arc(cx: number, cy: number, r: number, a0: number, a1: number, ccw = false) {
    let sweep = ccw ? a0 - a1 : a1 - a0;
    sweep = ((sweep % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const steps = Math.max(2, Math.ceil(sweep / 0.05));
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (ccw ? -1 : 1) * (sweep * i) / steps;
      this.cur.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
  }
  closePath() {
    if (this.cur.length) this.polys.push(this.cur);
    this.cur = [];
  }
}

/** Winding number of P around the polygons (nonzero rule: inside when not 0). */
function winding(polys: number[][], px: number, py: number): number {
  let w = 0;
  for (const p of polys) {
    const n = p.length / 2;
    for (let i = 0; i < n; i++) {
      const ax = p[i * 2];
      const ay = p[i * 2 + 1];
      const bx = p[((i + 1) % n) * 2];
      const by = p[((i + 1) % n) * 2 + 1];
      if (ay <= py) {
        if (by > py && (bx - ax) * (py - ay) - (px - ax) * (by - ay) > 0) w++;
      } else if (by <= py && (bx - ax) * (py - ay) - (px - ax) * (by - ay) < 0) w--;
    }
  }
  return w;
}

/** How far P is from being covered by the line's circles (negative inside). */
function coverage(line: Line, px: number, py: number): number {
  let best = Infinity;
  for (let i = 0; i < line.n; i++) {
    const d = Math.hypot(px - line.x[i], py - line.y[i]) - line.r[i];
    if (d < best) best = d;
    if (i + 1 < line.n) {
      for (let k = 1; k < 24; k++) {
        const t = k / 24;
        const x = line.x[i] + (line.x[i + 1] - line.x[i]) * t;
        const y = line.y[i] + (line.y[i + 1] - line.y[i]) * t;
        const r = line.r[i] + (line.r[i + 1] - line.r[i]) * t;
        const e = Math.hypot(px - x, py - y) - r;
        if (e < best) best = e;
      }
    }
  }
  return best;
}

/** Fills the outline and compares every pixel with the circles (a pixel's width of slack at the edge). */
function checkOutline(line: Line, label: string) {
  const flat = new Flat();
  outline(line, flat);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < line.n; i++) {
    x0 = Math.min(x0, line.x[i] - line.r[i]);
    y0 = Math.min(y0, line.y[i] - line.r[i]);
    x1 = Math.max(x1, line.x[i] + line.r[i]);
    y1 = Math.max(y1, line.y[i] + line.r[i]);
  }
  const px = Math.max((x1 - x0) / 90, (y1 - y0) / 90, 0.05);
  let wrong = 0;
  let where = "";
  for (let y = y0 - 2 * px; y <= y1 + 2 * px; y += px) {
    for (let x = x0 - 2 * px; x <= x1 + 2 * px; x += px) {
      const c = coverage(line, x, y);
      if (Math.abs(c) < px * 0.75) continue;
      const filled = winding(flat.polys, x, y) !== 0;
      if (filled !== c < 0) {
        wrong++;
        if (!where) where = ` first at (${x.toFixed(2)}, ${y.toFixed(2)}) ${filled ? "filled but outside" : "inside but empty"}`;
      }
    }
  }
  ok(wrong === 0, `outline covers exactly the circles: ${label} (${wrong} wrong pixels${where})`);
}

function lineOf(pts: [number, number, number][]): Line {
  const n = pts.length;
  return { x: Float64Array.from(pts.map((p) => p[0])), y: Float64Array.from(pts.map((p) => p[1])), r: Float64Array.from(pts.map((p) => p[2])), n };
}

checkOutline(lineOf([[10, 10, 3]]), "a dot");
checkOutline(lineOf([[0, 0, 2], [20, 0, 2]]), "a straight line");
checkOutline(lineOf([[0, 0, 1], [20, 0, 6]]), "a line getting thicker");
checkOutline(lineOf([[0, 0, 2], [20, 0, 2], [20, 20, 2]]), "a right angle");
checkOutline(lineOf([[0, 0, 2], [20, 0, 2], [0, 1, 2]]), "turning back");
checkOutline(lineOf([[0, 0, 2], [20, 0, 2], [20.5, 0, 2], [0, 0.3, 2]]), "turning back on itself");
checkOutline(lineOf([[0, 0, 1], [10, 0, 8], [12, 0, 1], [30, 0, 1]]), "a sudden thick spot");
checkOutline(lineOf([[0, 0, 6], [1, 0, 1], [2, 0, 6], [3, 0, 1]]), "circles inside each other");
checkOutline(lineOf([[0, 0, 3], [0, 0, 3], [0, 0, 5], [10, 10, 2]]), "repeated points");
{
  // A loop: its inside must stay open.
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 40; i++) pts.push([30 * Math.cos((i / 40) * 2.2 * Math.PI), 30 * Math.sin((i / 40) * 2.2 * Math.PI), 2]);
  const line = lineOf(pts);
  checkOutline(line, "a loop");
  const flat = new Flat();
  outline(line, flat);
  ok(winding(flat.polys, 0, 0) === 0, "the inside of a loop stays open");
}
{
  // A spiral going round twice.
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 120; i++) pts.push([(10 + i / 6) * Math.cos(i / 9), (10 + i / 6) * Math.sin(i / 9), 1.5 + (i % 7) / 4]);
  checkOutline(lineOf(pts), "a spiral");
}
const ROUNDS = Number(process.env.INK_ROUNDS) || 120;
for (let round = 0; round < ROUNDS; round++) {
  // Random scribbles: sharp turns, jumps in width, tiny and long steps.
  const n = 2 + Math.floor(rand() * 30);
  const pts: [number, number, number][] = [];
  let x = 0;
  let y = 0;
  let r = 1 + rand() * 4;
  for (let i = 0; i < n; i++) {
    const step = rand() < 0.2 ? rand() * 0.3 : rand() * (round % 3 ? 12 : 3);
    // Mostly gentle turns, sometimes anything (and sometimes straight back).
    const a = round % 4 === 0 ? rand() * Math.PI * 2 : (pts.length ? Math.atan2(y - (pts[pts.length - 2]?.[1] ?? 0), x - (pts[pts.length - 2]?.[0] ?? 0)) : 0) + (rand() - 0.5) * (rand() < 0.1 ? 6.2 : 1.2);
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    if (rand() < 0.3) r = 0.3 + rand() * 7;
    pts.push([x, y, r]);
  }
  checkOutline(lineOf(pts), `scribble #${round}`);
}
{
  // Smoothed lines too (what the screen draws).
  for (let round = 0; round < 40; round++) {
    const n = 3 + Math.floor(rand() * 40);
    const xs: number[] = [];
    const ys: number[] = [];
    const ws: number[] = [];
    let x = 0;
    let y = 0;
    let a = 0;
    for (let i = 0; i < n; i++) {
      a += (rand() - 0.5) * (round % 3 === 0 ? 3 : 1);
      x += Math.cos(a) * (1 + rand() * 5);
      y += Math.sin(a) * (1 + rand() * 5);
      xs.push(x);
      ys.push(y);
      ws.push(1 + rand() * (round % 4 === 0 ? 12 : 4));
    }
    checkOutline(centerline(xs, ys, ws, true), `smoothed stroke #${round}`);
  }
}
{
  // The smoothed line passes through every point.
  const xs = [0, 10, 20, 25, 40];
  const ys = [0, 5, 0, 10, 10];
  const ws = [2, 2, 2, 2, 2];
  const line = centerline(xs, ys, ws, true);
  const hits = xs.every((x, i) => Array.from({ length: line.n }, (_, k) => Math.hypot(line.x[k] - x, line.y[k] - ys[i])).some((d) => d < 1e-6));
  ok(hits, "the smoothed line goes through every point");
  ok(line.n > xs.length, "and has more points in between");
}

// Cutting -----------------------------------------------------------------------------------

{
  const xs = Array.from({ length: 41 }, (_, i) => i);
  const ys = xs.map(() => 0);
  const ws = xs.map(() => 2);
  const line = centerline(xs, ys, ws, false);
  const pieces = cut(line, 20, -5, 20, 5, 2);
  ok(pieces?.length === 2, "erasing across the middle leaves two pieces");
  if (pieces?.length === 2) {
    const endA = pieces[0].xs[pieces[0].xs.length - 1];
    const startB = pieces[1].xs[0];
    ok(Math.abs(endA - (20 - 2 - 0.3)) < 0.05 && Math.abs(startB - (20 + 2 + 0.3)) < 0.05, `cut at the eraser's edge (${endA.toFixed(2)}, ${startB.toFixed(2)})`);
    ok(pieces[0].xs.length <= 3, `a straight piece keeps few points (${pieces[0].xs.length})`);
  }
  ok(cut(line, 20, 10, 25, 10, 2) === null, "an eraser that misses changes nothing");
  ok(cut(line, -10, 0, 50, 0, 2)?.length === 0, "an eraser along the whole line leaves nothing");
  const sparse = centerline([0, 40], [0, 0], [2, 2], false);
  ok(cut(sparse, 20, -5, 20, 5, 1)?.length === 2, "an eraser crossing a long straight piece cuts it");
}
{
  // Touching.
  const xs = Float32Array.from([0, 10, 20]);
  const ys = Float32Array.from([0, 0, 0]);
  const ws = Float32Array.from([4, 4, 4]);
  const box = { x0: -2, y0: -2, x1: 22, y1: 2 };
  ok(touches(xs, ys, ws, box, 5, 3.5, 5, 10, 2), "an eraser touching the line's edge counts");
  ok(!touches(xs, ys, ws, box, 5, 4.5, 5, 10, 2), "one just beside it doesn't");
  ok(touches(xs, ys, ws, box, 5, -10, 5, 10, 0.5), "one crossing between points counts");
}
{
  const s = simplify([0, 1, 2, 3, 4, 5], [0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1]);
  ok(s.xs.length === 2 && s.ws[0] === 2, "a straight line simplifies to its ends");
  const t = simplify([0, 1, 2, 3, 4], [0, 0, 0, 0, 0], [1, 1, 3, 1, 1]);
  ok(t.xs.length === 5 || t.xs.length === 3, "a bump in width is kept");
}

// Selecting ---------------------------------------------------------------------------------

{
  const square = [0, 0, 10, 0, 10, 10, 0, 10];
  ok(inPolygon(5, 5, square) && !inPolygon(15, 5, square) && !inPolygon(-1, -1, square), "inside a lasso");
}

console.log(failed ? `${failed} FAILED, ${passed} passed` : `all ${passed} checks passed`);
process.exit(failed ? 1 : 0);
