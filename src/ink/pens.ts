// The pens: how wide each draws for a given pressure, speed and direction, the sizes and colours
// they offer, and the StrokeBuilder that turns pointer input into a stroke's points.
//
// Widths are worked out while drawing and stored with the points, so a stroke looks the same on
// every device, whatever pen settings it has. Sizes are in units (a sheet is 1000 wide, one unit
// is about 0.21 mm).

import type { InkColor, PenTool } from "./model";

export type PenSpec = {
  tool: PenTool;
  /** The size slider's range and where it starts. */
  min: number;
  max: number;
  size: number;
  /** Whether lines are smoothed between points. */
  smooth: boolean;
};

export const PENS: Record<PenTool, PenSpec> = {
  pen: { tool: "pen", min: 1, max: 12, size: 3, smooth: true },
  fountain: { tool: "fountain", min: 1.5, max: 16, size: 4, smooth: true },
  pencil: { tool: "pencil", min: 1.5, max: 14, size: 3.5, smooth: true },
  calligraphy: { tool: "calligraphy", min: 3, max: 24, size: 8, smooth: true },
  highlighter: { tool: "highlighter", min: 8, max: 60, size: 24, smooth: true },
};

/** Colours offered for pens: "ink" (black, white on dark paper) and colours that read on any paper. */
export const PEN_COLORS: InkColor[] = [
  "ink",
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#db2777",
  "#ca8a04",
  "#92400e",
  "#64748b",
  "#1e3a8a",
];

/** Highlighter colours: light and clear. */
export const HIGHLIGHTER_COLORS: InkColor[] = ["#fde047", "#86efac", "#93c5fd", "#f9a8d4", "#fdba74", "#c4b5fd"];

/** How opaque highlighters are. */
export const HIGHLIGHT_ALPHA = 0.42;

/** The calligraphy nib's angle: thin along "/", thick along "\". */
const NIB = -Math.PI / 4;

/** The S Pen's light touch already counts: pressure feels linear, not too thin when writing softly. */
const curve = (p: number) => Math.pow(Math.min(1, Math.max(0, p)), 0.75);

/** The line's width at a point: pressure 0–1, speed in units per millisecond, direction in radians. */
export function widthAt(tool: PenTool, size: number, pressure: number, speed: number, dir: number): number {
  const p = curve(pressure);
  switch (tool) {
    case "pen":
      return size * (0.72 + 0.5 * p);
    case "fountain": {
      const fast = Math.min(1, Math.max(0, (speed - 0.15) / 1.2));
      return size * (0.28 + 1.3 * Math.pow(p, 1.15)) * (1 - 0.3 * fast);
    }
    case "pencil":
      return size * (0.8 + 0.35 * p);
    case "calligraphy":
      return size * (0.16 + 0.84 * Math.abs(Math.sin(dir - NIB))) * (0.75 + 0.35 * p);
    case "highlighter":
      return size;
  }
}

/** How dark a pencil stroke is (pressed harder, darker). */
export function pencilOpacity(pressures: number[]): number {
  if (!pressures.length) return 0.85;
  const sorted = [...pressures].sort((a, b) => a - b);
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  return Math.min(0.95, Math.max(0.5, 0.45 + 0.6 * curve(p75)));
}

export type InputKind = "pen" | "touch" | "mouse";

/**
 * The 1€ filter (Casiez et al.): smooths jitter at low speed without lagging at high speed.
 * Only fingers get it: a stylus is precise, and its lines should be exactly what was written.
 */
class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;
  constructor(
    private minCutoff: number,
    private beta: number,
    private dCutoff = 1,
  ) {}
  private static alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(x: number, t: number): number {
    if (this.x === null) {
      this.x = x;
      this.t = t;
      return x;
    }
    const dt = Math.max(1e-3, (t - this.t) / 1000);
    this.t = t;
    const dx = (x - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (dx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (x - this.x);
    return this.x;
  }
}

/**
 * Builds a stroke while it is drawn: takes pointer samples (units), keeps the ones that move,
 * smooths finger input, and works out each point's width. `points()` is the stroke so far,
 * `finish()` the final one (its end tapered when there was no pressure to do that).
 */
export class StrokeBuilder {
  readonly xs: number[] = [];
  readonly ys: number[] = [];
  readonly ws: number[] = [];
  readonly pressures: number[] = [];
  private ts: number[] = [];
  private fx: OneEuro | null = null;
  private fy: OneEuro | null = null;
  private speed = 0;
  private dirX = 0;
  private dirY = 0;
  private pressure = -1;
  /** Raw position of the latest sample (the pen is here even if smoothing lags behind). */
  lastX = 0;
  lastY = 0;

  constructor(
    readonly tool: PenTool,
    readonly size: number,
    readonly input: InputKind,
    /** CSS pixels per unit: points closer than a fraction of a pixel add nothing. */
    private scale: number,
  ) {
    if (input === "touch") {
      // In units per second: the filter works on the units the stroke is in.
      this.fx = new OneEuro(1.4, 0.04 * scale);
      this.fy = new OneEuro(1.4, 0.04 * scale);
    }
  }

  get length() {
    return this.xs.length;
  }

  /** Adds a sample; false when it was too close to the last one to matter. */
  add(x: number, y: number, rawPressure: number, t: number): boolean {
    this.lastX = x;
    this.lastY = y;
    // Mice and fingers have no pressure (a mouse says 0.5, a finger whatever its contact is).
    const target = this.input === "pen" ? (rawPressure > 0 ? rawPressure : this.pressure >= 0 ? this.pressure : 0.5) : 0.5;
    this.pressure = this.pressure < 0 ? target : this.pressure + 0.45 * (target - this.pressure);
    if (this.fx && this.fy) {
      x = this.fx.filter(x, t);
      y = this.fy.filter(y, t);
    }
    const n = this.xs.length;
    if (n) {
      const dx = x - this.xs[n - 1];
      const dy = y - this.ys[n - 1];
      const dist = Math.hypot(dx, dy);
      if (dist < 0.3 / this.scale) {
        // Same place: only the pressure changes (pressing harder on a dot).
        this.ws[n - 1] = Math.max(this.ws[n - 1], widthAt(this.tool, this.size, this.pressure, this.speed, this.dir()));
        this.pressures[n - 1] = Math.max(this.pressures[n - 1], this.pressure);
        return false;
      }
      const dt = Math.max(1, t - this.ts[n - 1]);
      this.speed += 0.25 * (dist / dt - this.speed);
      // Direction (calligraphy): smoothed, so slow wobbles don't flip the nib.
      const k = n === 1 ? 1 : 0.35;
      this.dirX += k * (dx / dist - this.dirX);
      this.dirY += k * (dy / dist - this.dirY);
      if (n === 1 && this.tool === "calligraphy") this.ws[0] = widthAt(this.tool, this.size, this.pressures[0], 0, this.dir());
    }
    this.xs.push(x);
    this.ys.push(y);
    this.ts.push(t);
    this.pressures.push(this.pressure);
    this.ws.push(widthAt(this.tool, this.size, this.pressure, this.speed, this.dir()) * this.startTaper(n));
    return true;
  }

  private dir() {
    return this.dirX || this.dirY ? Math.atan2(this.dirY, this.dirX) : 0;
  }

  /** Without pressure, fountain and calligraphy pens start thin, like a nib touching down. */
  private startTaper(i: number) {
    if (this.input === "pen" || (this.tool !== "fountain" && this.tool !== "calligraphy")) return 1;
    return [0.45, 0.65, 0.82, 0.93][i] ?? 1;
  }

  /** The stroke as it will be stored, its end tapered when the input had no pressure. */
  finish(): { xs: Float32Array; ys: Float32Array; ws: Float32Array } {
    const n = this.xs.length;
    const xs = Float32Array.from(this.xs);
    const ys = Float32Array.from(this.ys);
    const ws = Float32Array.from(this.ws);
    // The pen lifted here: end exactly at the last raw position (the filter may lag behind).
    if (n && this.fx) {
      xs[n - 1] = this.lastX;
      ys[n - 1] = this.lastY;
    }
    if (this.input !== "pen" && (this.tool === "fountain" || this.tool === "calligraphy") && n > 4) {
      const taper = [0.4, 0.58, 0.75, 0.9];
      for (let k = 0; k < taper.length; k++) ws[n - 1 - k] *= taper[k];
    }
    return { xs, ys, ws };
  }
}
