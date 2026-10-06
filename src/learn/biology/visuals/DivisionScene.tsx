"use client";

// The animated cell for the "cell-division" topic: a model cell (2n = 4, 6 or 8) going through
// mitosis or meiosis. Every stage is a keyframe (cell outline, nuclear envelopes, centrosomes,
// spindle, every single chromatid); any time in between is interpolated, so a scrubber can
// move the chromosomes continuously and a task can show one stage as a still picture.

import { useMemo } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Chromatid, PAIRS, PARENT_FILL } from "./DivisionChromatid";

export type DivisionKind = "mitosis" | "meiosis";
/** "ndj1": the first pair does not separate in meiosis I; "ndj2": its sister chromatids stay together in meiosis II (left cell). */
export type DivisionVariant = "normal" | "ndj1" | "ndj2";
export type ModelSize = 4 | 6 | 8;

export const MITOSIS_STAGES = ["g1", "s", "g2", "pro", "meta", "ana", "telo", "cyto"] as const;
export const MEIOSIS_STAGES = ["g1", "s", "pro1", "meta1", "ana1", "telo1", "pro2", "meta2", "ana2", "telo2"] as const;
export type MitosisStage = (typeof MITOSIS_STAGES)[number];
export type MeiosisStage = (typeof MEIOSIS_STAGES)[number];
export type Stage = MitosisStage | MeiosisStage;

export const stagesOf = (kind: DivisionKind): readonly Stage[] => (kind === "mitosis" ? MITOSIS_STAGES : MEIOSIS_STAGES);

export type SceneOptions = {
  kind: DivisionKind;
  n2?: ModelSize;
  /** Show crossing-over in prophase I (meiosis). */
  crossing?: boolean;
  variant?: DivisionVariant;
  /** Meiosis: which way each bivalent faces in metaphase I (1 = maternal chromosome to the left pole). */
  orient?: number[];
};

type Ell = { cx: number; cy: number; rx: number; ry: number };
type Nuc = { cx: number; cy: number; r: number; op: number };
type Cent = { x: number; y: number; op: number };
type CT = { x: number; y: number; pa: number; qa: number; cond: number; op: number; swap: number; att: number; pole: number };
type Key = { cells: Ell[]; nuclei: Nuc[]; cents: Cent[]; spin: number[]; cts: CT[]; chi: number };
type Info = { k: number; pair: number; par: 0 | 1; s: -1 | 1; len: number; cf: number; swapAt: number; seed: number };

export type Scene = Key & { info: Info[]; spindles: [number, number][]; w: number; h: number };

const SCALE: Record<ModelSize, number> = { 4: 1, 6: 0.86, 8: 0.7 };
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Chromatin in interphase: where each chromosome lies in the nucleus (offset, p arm direction, bend of the q arm). */
const INTER = [
  { dx: -26, dy: -18, a: 205, b: 34 },
  { dx: 24, dy: 22, a: 335, b: -30 },
  { dx: 22, dy: -30, a: 105, b: 22 },
  { dx: -24, dy: 32, a: 25, b: -26 },
  { dx: -2, dy: 4, a: 262, b: 38 },
  { dx: 42, dy: -4, a: 85, b: -24 },
  { dx: -44, dy: 6, a: 280, b: 26 },
  { dx: 6, dy: 44, a: 170, b: -32 },
];
/** Prophase: condensed chromosomes, still where the nucleus was. */
const PRO = [
  { dx: -32, dy: -26, a: 220 },
  { dx: 30, dy: 26, a: 320 },
  { dx: 26, dy: -32, a: 150 },
  { dx: -30, dy: 30, a: 40 },
  { dx: 0, dy: 0, a: 265 },
  { dx: 46, dy: -2, a: 95 },
  { dx: -48, dy: 2, a: 285 },
  { dx: 4, dy: 46, a: 175 },
];
/** Order of the chromosomes on the metaphase plate in mitosis (homologues don't pair). */
const PLATE: Record<ModelSize, number[]> = { 4: [0, 3, 1, 2], 6: [0, 5, 2, 1, 4, 3], 8: [0, 5, 2, 7, 1, 4, 3, 6] };
/** Prophase I: where each bivalent lies. */
const BIV = [
  { dx: -30, dy: -16, a: 240 },
  { dx: 34, dy: 26, a: 300 },
  { dx: -4, dy: 40, a: 200 },
  { dx: 34, dy: -28, a: 330 },
];
/** After meiosis I: chromosomes in a daughter cell. */
const CELL = [
  { dx: -24, dy: -20, a: 240 },
  { dx: 24, dy: 20, a: 300 },
  { dx: -20, dy: 28, a: 200 },
  { dx: 26, dy: -24, a: 330 },
  { dx: 0, dy: 2, a: 270 },
];
/** Static facts about every chromatid of the model (two per chromosome, the sister s = 1 only exists after S phase). */
function infoOf(n2: ModelSize): Info[] {
  const sc = SCALE[n2];
  const out: Info[] = [];
  for (let k = 0; k < n2; k++) {
    const pair = k >> 1;
    const spec = PAIRS[pair];
    for (const s of [-1, 1] as const) out.push({ k, pair, par: (k & 1) as 0 | 1, s, len: spec.len * sc, cf: spec.cf, swapAt: spec.swapAt, seed: k * 1.9 });
  }
  return out;
}

/** Chromatid of a chromosome lying at (X, Y) with its p arm towards `a`, sisters `d` apart from the middle. */
function ct(info: Info, X: number, Y: number, a: number, d: number, splay: number, cond: number, extra: Partial<CT> = {}): CT {
  const nx = Math.cos(rad(a + 90));
  const ny = Math.sin(rad(a + 90));
  return {
    x: X + info.s * d * nx,
    y: Y + info.s * d * ny,
    pa: a + info.s * splay,
    qa: a + 180 - info.s * splay,
    cond,
    op: 1,
    swap: 0,
    att: 0,
    pole: 0,
    ...extra,
  };
}

/** Stack chromosomes along a line: returns the centre of each, given the extents before/after the centromere. */
function stack(ext: [number, number][], mid: number, gap: number) {
  const total = ext.reduce((s, [a, b]) => s + a + b, 0) + gap * (ext.length - 1);
  let pos = mid - total / 2;
  return ext.map(([a, b]) => {
    const c = pos + a;
    pos += a + b + gap;
    return c;
  });
}

const same = (e: Ell, n: number) => Array.from({ length: n }, () => ({ ...e }));

// ---------------------------------------------------------------------------
// Mitosis (viewBox 440 × 300)

const MW = 440;
const MH = 300;
const MX = 220;
const MY = 150;

function mitosisKeys(n2: ModelSize): Key[] {
  const info = infoOf(n2);
  const sc = SCALE[n2];
  const order = PLATE[n2];
  const plateY = stack(
    order.map((k) => {
      const p = PAIRS[k >> 1];
      return [p.len * sc * p.cf, p.len * sc * (1 - p.cf)];
    }),
    MY,
    14 * sc,
  );
  const yOf = (k: number) => plateY[order.indexOf(k)];
  const N = (cx: number, cy: number, r: number, op: number): Nuc => ({ cx, cy, r, op });
  const off = { op: 0 };
  const inter = (i: Info, cx: number, cy: number, f: number, d: number, cond: number, extra: Partial<CT> = {}) => {
    const p = INTER[i.k];
    return ct(i, cx + p.dx * f, cy + p.dy * f, p.a, d, 0, cond, { qa: p.a + 180 + p.b, ...extra });
  };
  const nucleiInter = [N(MX, MY, 66, 1), N(MX - 104, MY, 42, 0), N(MX + 104, MY, 42, 0)];
  const keys: Key[] = [];
  // G1: one chromatid per chromosome (the sister is hidden on top of it).
  keys.push({
    cells: same({ cx: MX, cy: MY, rx: 158, ry: 108 }, 2),
    nuclei: nucleiInter,
    cents: [
      { x: 290, y: 84, op: 1 },
      { x: 290, y: 84, op: 1 },
    ],
    spin: [0],
    cts: info.map((i) => inter(i, MX, MY, 1, 0, 0.1, i.s > 0 ? off : {})),
    chi: 0,
  });
  // S: replication.
  keys.push({
    cells: same({ cx: MX, cy: MY, rx: 162, ry: 110 }, 2),
    nuclei: nucleiInter,
    cents: [
      { x: 288, y: 84, op: 1 },
      { x: 292, y: 86, op: 1 },
    ],
    spin: [0],
    cts: info.map((i) => inter(i, MX, MY, 1, 1.8, 0.12)),
    chi: 0,
  });
  // G2
  keys.push({
    cells: same({ cx: MX, cy: MY, rx: 162, ry: 110 }, 2),
    nuclei: nucleiInter,
    cents: [
      { x: 280, y: 80, op: 1 },
      { x: 300, y: 92, op: 1 },
    ],
    spin: [0],
    cts: info.map((i) => inter(i, MX, MY, 1, 2.3, 0.2)),
    chi: 0,
  });
  // Prophase: condensed, nuclear envelope dissolving, centrosomes moving apart.
  keys.push({
    cells: same({ cx: MX, cy: MY, rx: 164, ry: 112 }, 2),
    nuclei: [N(MX, MY, 66, 0.3), N(MX - 104, MY, 34, 0), N(MX + 104, MY, 34, 0)],
    cents: [
      { x: 126, y: 102, op: 1 },
      { x: 314, y: 198, op: 1 },
    ],
    spin: [0.55],
    cts: info.map((i) => {
      const p = PRO[i.k];
      return ct(i, MX + p.dx * 0.95, MY + p.dy * 0.95, p.a, 2.8, 7, 1);
    }),
    chi: 0,
  });
  // Metaphase: all chromosomes on the equatorial plane, spindle fibres at every centromere.
  keys.push({
    cells: same({ cx: MX, cy: MY, rx: 166, ry: 120 }, 2),
    nuclei: [N(MX, MY, 66, 0), N(MX - 104, MY, 34, 0), N(MX + 104, MY, 34, 0)],
    cents: [
      { x: 96, y: MY, op: 1 },
      { x: 344, y: MY, op: 1 },
    ],
    spin: [1],
    cts: info.map((i) => ct(i, MX, yOf(i.k), 270, 2.9, 9, 1, { att: 1, pole: i.s < 0 ? 0 : 1 })),
    chi: 0,
  });
  // Anaphase: sister chromatids pulled to opposite poles, arms trailing.
  keys.push({
    cells: same({ cx: MX, cy: MY, rx: 182, ry: 106 }, 2),
    nuclei: [N(MX, MY, 66, 0), N(MX - 104, MY, 34, 0), N(MX + 104, MY, 34, 0)],
    cents: [
      { x: 78, y: MY, op: 1 },
      { x: 362, y: MY, op: 1 },
    ],
    spin: [1],
    cts: info.map((i) => ct(i, MX, MY + (yOf(i.k) - MY) * 0.74, 270, 76, -52, 1, { att: 1, pole: i.s < 0 ? 0 : 1 })),
    chi: 0,
  });
  // Telophase: new nuclear envelopes, the cell pinches in.
  keys.push({
    cells: [
      { cx: 150, cy: MY, rx: 112, ry: 100 },
      { cx: 290, cy: MY, rx: 112, ry: 100 },
    ],
    nuclei: [N(MX, MY, 66, 0), N(MX - 104, MY, 42, 0.75), N(MX + 104, MY, 42, 0.75)],
    cents: [
      { x: 60, y: MY - 6, op: 1 },
      { x: 380, y: MY - 6, op: 1 },
    ],
    spin: [0.4],
    cts: info.map((i) => ct(i, MX, MY + (yOf(i.k) - MY) * 0.3, 270, 100, -42, 0.6, { att: 0.3, pole: i.s < 0 ? 0 : 1 })),
    chi: 0,
  });
  // Cytokinesis: two daughter cells, each with the same chromosomes as the mother cell.
  keys.push({
    cells: [
      { cx: 132, cy: MY, rx: 84, ry: 80 },
      { cx: 308, cy: MY, rx: 84, ry: 80 },
    ],
    nuclei: [N(MX, MY, 66, 0), N(132, MY, 44, 1), N(308, MY, 44, 1)],
    cents: [
      { x: 106, y: 88, op: 1 },
      { x: 282, y: 88, op: 1 },
    ],
    spin: [0],
    cts: info.map((i) => inter(i, i.s < 0 ? 132 : 308, MY, 0.62, 0, 0.1)),
    chi: 0,
  });
  return keys;
}

// ---------------------------------------------------------------------------
// Meiosis (viewBox 520 × 320)

const EW = 520;
const EH = 320;
const EX = 260;
const EY = 160;
const LEFT = 132;
const RIGHT = 388;

function meiosisKeys(n2: ModelSize, crossing: boolean, variant: DivisionVariant, orient: number[]): Key[] {
  const info = infoOf(n2);
  const sc = SCALE[n2];
  const pairs = n2 / 2;
  const o = (pair: number) => (orient[pair] ?? (pair % 2 ? -1 : 1)) as 1 | -1;
  // Which side (-1 left, 1 right) each chromosome goes to in anaphase I.
  const side = (k: number) => {
    const pair = k >> 1;
    if (variant === "ndj1" && pair === 0) return -1;
    return (k & 1 ? 1 : -1) * o(pair);
  };
  // Which gamete (0 top left, 1 bottom left, 2 top right, 3 bottom right) each chromatid ends in.
  const gamete = (i: Info) => {
    const base = side(i.k) < 0 ? 0 : 2;
    if (variant === "ndj2" && i.pair === 0 && base === 0) return 0;
    return base + (i.s > 0 ? 1 : 0);
  };
  const N = (cx: number, cy: number, r: number, op: number): Nuc => ({ cx, cy, r, op });
  const nucleiOff = (n0: number, lr: number, fin: number): Nuc[] => [
    N(EX, EY, 70, n0),
    N(LEFT, EY, 46, lr),
    N(RIGHT, EY, 46, lr),
    N(LEFT, 88, 40, fin),
    N(LEFT, 232, 40, fin),
    N(RIGHT, 88, 40, fin),
    N(RIGHT, 232, 40, fin),
  ];
  const cent = (pts: [number, number][]): Cent[] => pts.map(([x, y]) => ({ x, y, op: 1 }));
  const swapOn = (i: Info) => (crossing && ((i.par === 0 && i.s === o(i.pair)) || (i.par === 1 && i.s === -o(i.pair))) ? 1 : 0);
  const inter = (i: Info, f: number, d: number, cond: number, extra: Partial<CT> = {}) => {
    const p = INTER[i.k];
    return ct(i, EX + p.dx * f, EY + p.dy * f, p.a, d, 0, cond, { qa: p.a + 180 + p.b, ...extra });
  };
  // Metaphase I plate: bivalents stacked from top to bottom.
  const bivOrder = [0, 2, 1, 3].filter((p) => p < pairs);
  const bivY = stack(
    bivOrder.map((p) => [PAIRS[p].len * sc * PAIRS[p].cf, PAIRS[p].len * sc * (1 - PAIRS[p].cf)] as [number, number]),
    EY,
    18 * sc,
  );
  const yBiv = (pair: number) => bivY[bivOrder.indexOf(pair)];
  // Chromosomes per daughter cell after meiosis I.
  const inCell = (sd: number) => Array.from({ length: n2 }, (_, k) => k).filter((k) => side(k) === sd).sort((a, b) => (a >> 1) - (b >> 1) || a - b);
  const slotI = (k: number) => inCell(side(k)).indexOf(k);
  // Metaphase II plates: chromosomes side by side along a horizontal line.
  const plate2 = (sd: number) => {
    const ks = inCell(sd);
    const xs = stack(
      ks.map((k) => {
        const p = PAIRS[k >> 1];
        return [p.len * sc * (1 - p.cf), p.len * sc * p.cf] as [number, number];
      }),
      sd < 0 ? LEFT : RIGHT,
      20 * sc,
    );
    return (k: number) => xs[ks.indexOf(k)];
  };
  const xL = plate2(-1);
  const xR = plate2(1);
  const x2 = (k: number) => (side(k) < 0 ? xL(k) : xR(k));
  const cellX = (k: number) => (side(k) < 0 ? LEFT : RIGHT);
  // Gametes: chromatids per final cell.
  const fin = (g: number) => info.filter((i) => gamete(i) === g);
  const keys: Key[] = [];
  const one = (e: Ell) => same(e, 4);
  const spin = (a: number, b: number) => [a, b, b];

  // G1
  keys.push({
    cells: one({ cx: EX, cy: EY, rx: 172, ry: 120 }),
    nuclei: nucleiOff(1, 0, 0),
    cents: cent([
      [332, 74],
      [332, 74],
      [332, 74],
      [332, 74],
    ]),
    spin: spin(0, 0),
    cts: info.map((i) => inter(i, 1.05, 0, 0.1, i.s > 0 ? { op: 0 } : {})),
    chi: 0,
  });
  // S / G2: replicated.
  keys.push({
    cells: one({ cx: EX, cy: EY, rx: 174, ry: 122 }),
    nuclei: nucleiOff(1, 0, 0),
    cents: cent([
      [322, 70],
      [322, 70],
      [342, 82],
      [342, 82],
    ]),
    spin: spin(0, 0),
    cts: info.map((i) => inter(i, 1.05, 2.1, 0.18)),
    chi: 0,
  });
  // Prophase I: homologues pair up (bivalents), crossing-over.
  keys.push({
    cells: one({ cx: EX, cy: EY, rx: 176, ry: 124 }),
    nuclei: nucleiOff(0.3, 0, 0),
    cents: cent([
      [146, 116],
      [146, 116],
      [374, 204],
      [374, 204],
    ]),
    spin: spin(0.5, 0),
    cts: info.map((i) => {
      const b = BIV[i.pair];
      const a = b.a;
      const h = (i.par === 0 ? -1 : 1) * o(i.pair) * 6.4;
      const X = EX + b.dx + h * Math.cos(rad(a + 90));
      const Y = EY + b.dy + h * Math.sin(rad(a + 90));
      return ct(i, X, Y, a, 2.8, 4, 1, { swap: swapOn(i) });
    }),
    chi: crossing ? 1 : 0,
  });
  // Metaphase I: bivalents on the equatorial plane, each homologue faces one pole.
  keys.push({
    cells: one({ cx: EX, cy: EY, rx: 178, ry: 124 }),
    nuclei: nucleiOff(0, 0, 0),
    cents: cent([
      [118, EY],
      [118, EY],
      [402, EY],
      [402, EY],
    ]),
    spin: spin(1, 0),
    cts: info.map((i) => {
      const h = (i.par === 0 ? -1 : 1) * o(i.pair) * 8.4;
      return ct(i, EX + h, yBiv(i.pair), 270, 2.8, 5, 1, { swap: swapOn(i), att: 1, pole: side(i.k) < 0 ? 0 : 2 });
    }),
    chi: crossing ? 0.5 : 0,
  });
  // Anaphase I: homologous chromosomes (still two chromatids each) move apart.
  keys.push({
    cells: one({ cx: EX, cy: EY, rx: 190, ry: 112 }),
    nuclei: nucleiOff(0, 0, 0),
    cents: cent([
      [96, EY],
      [96, EY],
      [424, EY],
      [424, EY],
    ]),
    spin: spin(1, 0),
    cts: info.map((i) => {
      const together = variant === "ndj1" && i.pair === 0;
      const X = EX + side(i.k) * 90 + (together ? (i.par === 0 ? -8 : 8) : 0);
      return ct(i, X, EY + (yBiv(i.pair) - EY) * 0.82, 270, 2.8, 5, 1, { swap: swapOn(i), att: 1, pole: side(i.k) < 0 ? 0 : 2 });
    }),
    chi: 0,
  });
  // Telophase I and cytokinesis: two cells, each with one chromosome of every pair.
  keys.push({
    cells: [...same({ cx: LEFT, cy: EY, rx: 118, ry: 106 }, 2), ...same({ cx: RIGHT, cy: EY, rx: 118, ry: 106 }, 2)],
    nuclei: nucleiOff(0, 0.55, 0),
    cents: cent([
      [58, EY],
      [58, EY],
      [462, EY],
      [462, EY],
    ]),
    spin: spin(0, 0),
    cts: info.map((i) => {
      const c = CELL[slotI(i.k)];
      return ct(i, cellX(i.k) + c.dx * 0.9, EY + c.dy * 0.9, c.a, 2.7, 6, 0.85, { swap: swapOn(i) });
    }),
    chi: 0,
  });
  // Prophase II
  keys.push({
    cells: [...same({ cx: LEFT, cy: EY, rx: 114, ry: 114 }, 2), ...same({ cx: RIGHT, cy: EY, rx: 114, ry: 114 }, 2)],
    nuclei: nucleiOff(0, 0.15, 0),
    cents: cent([
      [96, 92],
      [168, 230],
      [352, 92],
      [424, 230],
    ]),
    spin: spin(0, 0.5),
    cts: info.map((i) => {
      const c = CELL[slotI(i.k)];
      return ct(i, cellX(i.k) + c.dx * 0.8, EY + c.dy * 0.8, c.a + 20, 2.8, 6, 1, { swap: swapOn(i) });
    }),
    chi: 0,
  });
  // Metaphase II: in both cells the chromosomes line up, spindle now top to bottom.
  keys.push({
    cells: [...same({ cx: LEFT, cy: EY, rx: 110, ry: 122 }, 2), ...same({ cx: RIGHT, cy: EY, rx: 110, ry: 122 }, 2)],
    nuclei: nucleiOff(0, 0, 0),
    cents: cent([
      [LEFT, 78],
      [LEFT, 242],
      [RIGHT, 78],
      [RIGHT, 242],
    ]),
    spin: spin(0, 1),
    cts: info.map((i) => {
      const base = side(i.k) < 0 ? 0 : 2;
      return ct(i, x2(i.k), EY, 0, 2.8, 6, 1, { swap: swapOn(i), att: 1, pole: base + (gamete(i) % 2) });
    }),
    chi: 0,
  });
  // Anaphase II: sister chromatids separate.
  keys.push({
    cells: [...same({ cx: LEFT, cy: EY, rx: 104, ry: 132 }, 2), ...same({ cx: RIGHT, cy: EY, rx: 104, ry: 132 }, 2)],
    nuclei: nucleiOff(0, 0, 0),
    cents: cent([
      [LEFT, 64],
      [LEFT, 256],
      [RIGHT, 64],
      [RIGHT, 256],
    ]),
    spin: spin(0, 1),
    cts: info.map((i) => {
      const base = side(i.k) < 0 ? 0 : 2;
      const down = gamete(i) % 2 === 1;
      const cx = cellX(i.k);
      const X = cx + (x2(i.k) - cx) * 0.75;
      const stuck = variant === "ndj2" && i.pair === 0 && base === 0;
      const d = down ? 1 : -1;
      return {
        x: X + (stuck ? i.s * 6 : 0),
        y: EY + d * 56,
        pa: 0 - d * 52,
        qa: 180 + d * 52,
        cond: 1,
        op: 1,
        swap: swapOn(i),
        att: 1,
        pole: base + (down ? 1 : 0),
      };
    }),
    chi: 0,
  });
  // Telophase II: four haploid cells with single-chromatid chromosomes.
  keys.push({
    cells: [
      { cx: LEFT, cy: 88, rx: 96, ry: 70 },
      { cx: LEFT, cy: 232, rx: 96, ry: 70 },
      { cx: RIGHT, cy: 88, rx: 96, ry: 70 },
      { cx: RIGHT, cy: 232, rx: 96, ry: 70 },
    ],
    nuclei: nucleiOff(0, 0, 1),
    cents: cent([
      [182, 52],
      [182, 268],
      [438, 52],
      [438, 268],
    ]),
    spin: spin(0, 0),
    cts: info.map((i) => {
      // Gametes: the chromatids stand side by side in the nucleus, so you can compare the four cells.
      const g = gamete(i);
      const here = fin(g);
      const slot = here.indexOf(i);
      const cx = g < 2 ? LEFT : RIGHT;
      const cy = g % 2 ? 232 : 88;
      const a = 270 + (slot % 2 ? 6 : -6);
      return { x: cx + (slot - (here.length - 1) / 2) * 12, y: cy - 3, pa: a, qa: a + 180, cond: 0.62, op: 1, swap: swapOn(i), att: 0, pole: 0 };
    }),
    chi: 0,
  });
  return keys;
}

// ---------------------------------------------------------------------------
// Interpolation

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerpAngle = (a: number, b: number, u: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * u;
const ease = (u: number) => u * u * (3 - 2 * u);

function mix(a: Key, b: Key, u: number): Key {
  return {
    cells: a.cells.map((e, i) => ({ cx: lerp(e.cx, b.cells[i].cx, u), cy: lerp(e.cy, b.cells[i].cy, u), rx: lerp(e.rx, b.cells[i].rx, u), ry: lerp(e.ry, b.cells[i].ry, u) })),
    nuclei: a.nuclei.map((n, i) => {
      const m = b.nuclei[i];
      // A nucleus that appears or disappears stays where it is drawn.
      const from = n.op < 0.01 ? m : n;
      const to = m.op < 0.01 ? n : m;
      return { cx: lerp(from.cx, to.cx, u), cy: lerp(from.cy, to.cy, u), r: lerp(from.r, to.r, u), op: lerp(n.op, m.op, u) };
    }),
    cents: a.cents.map((c, i) => ({ x: lerp(c.x, b.cents[i].x, u), y: lerp(c.y, b.cents[i].y, u), op: lerp(c.op, b.cents[i].op, u) })),
    spin: a.spin.map((s, i) => lerp(s, b.spin[i], u)),
    cts: a.cts.map((c, i) => {
      const d = b.cts[i];
      return {
        x: lerp(c.x, d.x, u),
        y: lerp(c.y, d.y, u),
        pa: lerpAngle(c.pa, d.pa, u),
        qa: lerpAngle(c.qa, d.qa, u),
        cond: lerp(c.cond, d.cond, u),
        op: lerp(c.op, d.op, u),
        swap: lerp(c.swap, d.swap, u),
        att: lerp(c.att, d.att, u),
        pole: c.att > 0.01 ? c.pole : d.pole,
      };
    }),
    chi: lerp(a.chi, b.chi, u),
  };
}

export function keysOf(opts: SceneOptions): Key[] {
  const n2 = opts.n2 ?? 4;
  return opts.kind === "mitosis" ? mitosisKeys(n2) : meiosisKeys(n2, !!opts.crossing, opts.variant ?? "normal", opts.orient ?? []);
}

/** The scene at time t (0 = first stage, stages.length - 1 = last; fractions are in between). */
export function sceneAt(opts: SceneOptions, keys: Key[], t: number): Scene {
  const n2 = opts.n2 ?? 4;
  const last = keys.length - 1;
  const tt = Math.min(last, Math.max(0, t));
  const i = Math.min(last - 1, Math.floor(tt));
  const u = ease(tt - i);
  const k = u < 0.0001 ? keys[i] : u > 0.9999 ? keys[i + 1] : mix(keys[i], keys[i + 1], u);
  const mitosis = opts.kind === "mitosis";
  return {
    ...k,
    info: infoOf(n2),
    spindles: mitosis ? [[0, 1]] : [
      [0, 2],
      [0, 1],
      [2, 3],
    ],
    w: mitosis ? MW : EW,
    h: mitosis ? MH : EH,
  };
}

// ---------------------------------------------------------------------------
// Drawing

const r1 = (v: number) => Math.round(v * 10) / 10;

function Centrosome({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 5} y={y - 2} width={10} height={4} rx={1.6} fill="var(--bio-nerve-deep)" stroke="var(--bio-outline)" strokeWidth={0.8} />
      <rect x={x + 1} y={y - 6} width={4} height={10} rx={1.6} fill="var(--bio-nerve-deep)" stroke="var(--bio-outline)" strokeWidth={0.8} />
    </g>
  );
}

/** Polar fibres and asters between two poles. */
function Spindle({ a, b, op }: { a: Cent; b: Cent; op: number }) {
  if (op < 0.02) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const vx = -uy;
  const vy = ux;
  const lines: string[] = [];
  // Polar fibres overlap in the middle; each bulges like a real spindle.
  for (const k of [-2, -1, 1, 2]) {
    const bulge = k * len * 0.11;
    for (const [p, q] of [
      [a, b],
      [b, a],
    ] as const) {
      const ex = p.x + (q.x - p.x) * 0.58 + vx * bulge * 0.8;
      const ey = p.y + (q.y - p.y) * 0.58 + vy * bulge * 0.8;
      const cx = p.x + (q.x - p.x) * 0.3 + vx * bulge * 1.25;
      const cy = p.y + (q.y - p.y) * 0.3 + vy * bulge * 1.25;
      lines.push(`M${r1(p.x)} ${r1(p.y)}Q${r1(cx)} ${r1(cy)} ${r1(ex)} ${r1(ey)}`);
    }
  }
  // Asters: short rays pointing away from the spindle.
  for (const [p, dir] of [
    [a, -1],
    [b, 1],
  ] as const) {
    for (const ang of [-70, -35, 0, 35, 70, 120, -120]) {
      const base = Math.atan2(uy * dir, ux * dir) + rad(ang);
      lines.push(`M${r1(p.x + Math.cos(base) * 5)} ${r1(p.y + Math.sin(base) * 5)}L${r1(p.x + Math.cos(base) * 15)} ${r1(p.y + Math.sin(base) * 15)}`);
    }
  }
  return <path d={lines.join("")} fill="none" stroke="var(--bio-outline)" strokeOpacity={0.3 * op} strokeWidth={1} strokeLinecap="round" />;
}

export function SceneSvg({ scene, title, className }: { scene: Scene; title: Text; className?: string }) {
  const tt = useText();
  const { cells, nuclei, cents, spin, cts, info, spindles, w, h } = scene;
  // Kinetochore fibres: pole to centromere of every attached chromatid.
  const fibres = cts
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.att > 0.02 && c.op > 0.5)
    .map(({ c }) => {
      const p = cents[c.pole];
      return `M${r1(p.x)} ${r1(p.y)}L${r1(c.x)} ${r1(c.y)}`;
    });
  const att = Math.max(0, ...cts.map((c) => c.att));
  // Chiasmata: where the inner non-sister chromatids exchanged pieces.
  const chi = scene.chi > 0.02
    ? Array.from({ length: info.length / 4 }, (_, pair) => {
        const idx = info.map((x, j) => ({ x, j })).filter(({ x }) => x.pair === pair && x.k % 2 === 0);
        const m = idx.find(({ j }) => cts[j].swap > 0.5);
        const pIdx = info.findIndex((x, j) => x.pair === pair && x.k % 2 === 1 && cts[j].swap > 0.5);
        if (!m || pIdx < 0) return null;
        const pts = [m.j, pIdx].map((j) => {
          const c = cts[j];
          const inf = info[j];
          const d = inf.len * (1 - inf.cf) * inf.swapAt + 2;
          return [c.x + Math.cos(rad(c.qa)) * d, c.y + Math.sin(rad(c.qa)) * d];
        });
        return { x: (pts[0][0] + pts[1][0]) / 2, y: (pts[0][1] + pts[1][1]) / 2 };
      }).filter((p): p is { x: number; y: number } => !!p)
    : [];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className ?? "mx-auto block h-auto w-full"} style={{ maxWidth: 640 }} role="img" aria-label={tt(title)}>
      {/* Cell membrane: strokes first, fills on top, so overlapping cells show one outline with a furrow. */}
      {cells.map((e, i) => (
        <ellipse key={`m${i}`} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill="none" stroke="var(--bio-membrane)" strokeWidth={5} />
      ))}
      {cells.map((e, i) => (
        <ellipse key={`f${i}`} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill="var(--bio-cell)" />
      ))}
      {nuclei.map((n, i) =>
        n.op > 0.02 ? (
          <g key={`n${i}`} opacity={n.op}>
            <circle cx={n.cx} cy={n.cy} r={n.r} fill="var(--bio-nucleus)" fillOpacity={0.42} stroke="var(--bio-nucleus-deep)" strokeWidth={1.8} strokeDasharray={n.op < 0.97 ? "5 4" : undefined} />
            <circle cx={n.cx + n.r * 0.32} cy={n.cy - n.r * 0.42} r={n.r * 0.15} fill="var(--bio-nucleus-deep)" opacity={0.55 * n.op} />
          </g>
        ) : null,
      )}
      {spindles.map(([a, b], i) => (
        <Spindle key={`s${i}`} a={cents[a]} b={cents[b]} op={spin[i] ?? 0} />
      ))}
      {fibres.length > 0 && <path d={fibres.join("")} stroke="var(--bio-outline)" strokeOpacity={0.5 * att} strokeWidth={1.1} fill="none" />}
      {cents.map((c, i) => (c.op > 0.02 ? <Centrosome key={`c${i}`} x={c.x} y={c.y} /> : null))}
      {cts.map((c, i) => {
        const inf = info[i];
        return (
          <Chromatid
            key={`t${i}`}
            x={c.x}
            y={c.y}
            pa={c.pa}
            qa={c.qa}
            len={inf.len}
            cf={inf.cf}
            cond={c.cond}
            fill={PARENT_FILL[inf.par]}
            other={PARENT_FILL[1 - inf.par]}
            swap={c.swap}
            swapAt={inf.swapAt}
            seed={inf.seed}
            opacity={c.op}
          />
        );
      })}
      {chi.map((p, i) => (
        <circle key={`x${i}`} cx={p.x} cy={p.y} r={6.5} fill="none" stroke="var(--blob)" strokeWidth={1.8} opacity={scene.chi} />
      ))}
    </svg>
  );
}

/** One stage as a still picture (for tasks): `<DivisionPhase kind="mitosis" stage="ana" n2={6} />`. */
export function DivisionPhase({ kind = "mitosis", stage, n2 = 4, crossing = false, variant = "normal", orient }: { kind?: DivisionKind; stage: Stage; n2?: ModelSize; crossing?: boolean; variant?: DivisionVariant; orient?: number[] }) {
  const opts: SceneOptions = { kind, n2, crossing, variant, orient };
  const keys = useMemo(() => keysOf({ kind, n2, crossing, variant, orient }), [kind, n2, crossing, variant, orient]);
  const t = Math.max(0, stagesOf(kind).indexOf(stage));
  return <SceneSvg scene={sceneAt(opts, keys, t)} title={kind === "mitosis" ? tx("A cell during mitosis", "Eine Zelle in der Mitose") : tx("Cells during meiosis", "Zellen in der Meiose")} className="mx-auto block h-auto w-full max-w-[460px]" />;
}
