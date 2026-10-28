// What is drawn on the sheets, kept as tiles: squares of 512 device pixels rendered at a few fixed
// zoom levels (each √2 apart). Scrolling just copies tiles to the screen; zooming shows the
// nearest level scaled until the new one is drawn. A new stroke on top is painted onto the tiles
// it touches; anything else marks its area stale, and stale tiles keep showing until redrawn.

import type { InkDoc } from "./doc";
import { boxesTouch, SHEET_H, SHEET_W, type Box, type Thing } from "./model";
import { drawThing, type Images } from "./render";

export const TILE = 512;

type Canvas = OffscreenCanvas | HTMLCanvasElement;
type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export type Tile = {
  key: string;
  sheet: string;
  level: number;
  i: number;
  j: number;
  canvas: Canvas;
  ctx: Ctx;
  /** Has pixels (maybe old ones: then `stale`). */
  ready: boolean;
  stale: boolean;
  used: number;
};

/** The device pixels per unit of a level. */
export const levelScale = (level: number) => Math.pow(2, level / 2);
/** The level whose tiles are at least as sharp as `scale` device pixels per unit. */
export const levelFor = (scale: number) => Math.ceil(2 * Math.log2(Math.max(scale, 0.05)) - 1e-6);
/** Units a tile covers at a level. */
export const tileUnits = (level: number) => TILE / levelScale(level);

function newCanvas(): Canvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(TILE, TILE);
  const c = document.createElement("canvas");
  c.width = TILE;
  c.height = TILE;
  return c;
}

export class Tiles {
  private map = new Map<string, Tile>();
  private queue: Tile[] = [];
  private queued = new Set<string>();
  private spare: Canvas[] = [];
  private frame = 0;
  /** At most this many tiles stay (each is 1 MB). */
  max = 48;
  dark = false;
  /** Things not to draw (lifted by a selection being moved). */
  hidden: Set<string> = new Set();

  constructor(
    private doc: InkDoc,
    private images: Images | null,
  ) {}

  /** Starts a frame (for least-recently-used eviction). */
  tick() {
    this.frame++;
  }

  get(sheet: string, level: number, i: number, j: number): Tile | undefined {
    const t = this.map.get(`${sheet}:${level}:${i}:${j}`);
    if (t) t.used = this.frame;
    return t;
  }

  /** The tile, asked for (drawn soon when it has no pixels yet or old ones). */
  need(sheet: string, level: number, i: number, j: number, urgent: boolean): Tile {
    const key = `${sheet}:${level}:${i}:${j}`;
    let t = this.map.get(key);
    if (!t) {
      const canvas = this.spare.pop() ?? newCanvas();
      const ctx = canvas.getContext("2d") as Ctx;
      t = { key, sheet, level, i, j, canvas, ctx, ready: false, stale: false, used: this.frame };
      this.map.set(key, t);
    }
    t.used = this.frame;
    if ((!t.ready || t.stale) && !this.queued.has(key)) {
      this.queued.add(key);
      if (urgent) this.queue.unshift(t);
      else this.queue.push(t);
    }
    return t;
  }

  /** Ready tiles of a sheet at other levels that overlap a box (units): shown while the right ones are drawn. */
  fallback(sheet: string, level: number, box: Box): Tile[] {
    const out: Tile[] = [];
    for (const t of this.map.values()) {
      if (t.sheet !== sheet || t.level === level || !t.ready) continue;
      const u = tileUnits(t.level);
      if (boxesTouch(box, { x0: t.i * u, y0: t.j * u, x1: (t.i + 1) * u, y1: (t.j + 1) * u })) out.push(t);
    }
    // Sharpest last (drawn over the blurrier ones).
    return out.sort((a, b) => a.level - b.level);
  }

  get busy() {
    return this.queue.length > 0;
  }

  /** Draws waiting tiles for up to `ms` milliseconds; true when some still wait. */
  work(ms: number): boolean {
    const end = performance.now() + ms;
    while (this.queue.length) {
      const t = this.queue.shift()!;
      this.queued.delete(t.key);
      if (this.map.get(t.key) !== t) continue;
      this.render(t);
      if (performance.now() > end) break;
    }
    this.evict();
    return this.queue.length > 0;
  }

  /** Forgets queued tiles nobody asked for this frame (scrolled past). */
  prune() {
    this.queue = this.queue.filter((t) => {
      const keep = t.used >= this.frame - 1 && this.map.get(t.key) === t;
      if (!keep) this.queued.delete(t.key);
      return keep;
    });
  }

  private transform(t: Tile) {
    const s = levelScale(t.level);
    const u = tileUnits(t.level);
    t.ctx.setTransform(s, 0, 0, s, -t.i * u * s, -t.j * u * s);
  }

  private render(t: Tile) {
    const ctx = t.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, TILE, TILE);
    this.transform(t);
    const u = tileUnits(t.level);
    const box = { x0: t.i * u - 1, y0: t.j * u - 1, x1: (t.i + 1) * u + 1, y1: (t.j + 1) * u + 1 };
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SHEET_W, SHEET_H);
    ctx.clip();
    for (const thing of this.doc.within(t.sheet, box)) {
      if (!this.hidden.has(thing.id)) drawThing(ctx, thing, this.dark, this.images);
    }
    ctx.restore();
    t.ready = true;
    t.stale = false;
  }

  /** Paints new things on top of the tiles that have them in view (cheaper than drawing again). */
  paint(things: Thing[]) {
    for (const t of this.map.values()) {
      if (!t.ready || t.stale) continue;
      const u = tileUnits(t.level);
      const box = { x0: t.i * u, y0: t.j * u, x1: (t.i + 1) * u, y1: (t.j + 1) * u };
      let saved = false;
      for (const thing of things) {
        if (thing.sheet !== t.sheet || !boxesTouch(thing.box, box)) continue;
        if (!saved) {
          t.ctx.save();
          this.transform(t);
          t.ctx.beginPath();
          t.ctx.rect(0, 0, SHEET_W, SHEET_H);
          t.ctx.clip();
          saved = true;
        }
        drawThing(t.ctx, thing, this.dark, this.images);
      }
      if (saved) t.ctx.restore();
    }
  }

  /** The area changed: tiles over it draw again (showing their old pixels meanwhile). */
  invalidate(sheet: string, box: Box) {
    for (const t of this.map.values()) {
      if (t.sheet !== sheet) continue;
      const u = tileUnits(t.level);
      if (boxesTouch(box, { x0: t.i * u, y0: t.j * u, x1: (t.i + 1) * u, y1: (t.j + 1) * u })) t.stale = true;
    }
  }

  /** Everything draws again (light/dark switched, a fresh load). */
  invalidateAll() {
    for (const t of this.map.values()) t.stale = true;
  }

  /** A sheet is gone: its tiles go too. */
  drop(sheet: string) {
    for (const [key, t] of this.map) {
      if (t.sheet !== sheet) continue;
      this.map.delete(key);
      this.queued.delete(key);
      this.spare.push(t.canvas);
    }
    this.queue = this.queue.filter((t) => t.sheet !== sheet);
  }

  private evict() {
    if (this.map.size <= this.max) return;
    const old = [...this.map.values()].filter((t) => t.used < this.frame).sort((a, b) => a.used - b.used);
    for (const t of old) {
      if (this.map.size <= this.max) break;
      this.map.delete(t.key);
      this.queued.delete(t.key);
      if (this.spare.length < 8) this.spare.push(t.canvas);
    }
  }

  clear() {
    this.map.clear();
    this.queue = [];
    this.queued.clear();
    this.spare = [];
  }
}
