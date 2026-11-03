// UMWANDELN / CONVERT: units like Excel's, with SI prefixes where Excel allows them ("mg", "µl",
// "kPa", "mmol"). Units are case-sensitive, as in Excel ("mg" milligram, "Mg" megagram). A few
// lab units Excel lacks are accepted too ("mol", "bar", "µl" with µ or u).

import { ERR, mkErr, type Scalar } from "../values";
import { clean15 } from "./math";
import type { FnDef } from "./types";
import { toNum, toStr } from "./util";

type Unit = {
  cat: string;
  /** Value in the category's base unit = value × factor + offset. */
  factor: number;
  offset?: number;
  /** Takes SI prefixes (k, m, µ…). */
  prefix?: boolean;
  /** Takes binary prefixes (ki, Mi…): bits and bytes. */
  binary?: boolean;
  /** Prefix power: 2 for areas (cm² = (10⁻²)² m²), 3 for volumes. */
  power?: number;
};

const u = (cat: string, factor: number, opts: Partial<Unit> = {}): Unit => ({ cat, factor, ...opts });

const UNITS: Record<string, Unit> = {
  // Mass (base: gram)
  g: u("mass", 1, { prefix: true }),
  sg: u("mass", 14593.902937206364),
  lbm: u("mass", 453.59237),
  u: u("mass", 1.6605390666e-24, { prefix: true }),
  ozm: u("mass", 28.349523125),
  grain: u("mass", 0.06479891),
  cwt: u("mass", 45359.237),
  shweight: u("mass", 45359.237),
  uk_cwt: u("mass", 50802.34544),
  lcwt: u("mass", 50802.34544),
  hweight: u("mass", 50802.34544),
  stone: u("mass", 6350.29318),
  ton: u("mass", 907184.74),
  uk_ton: u("mass", 1016046.9088),
  LTON: u("mass", 1016046.9088),
  brton: u("mass", 1016046.9088),
  t: u("mass", 1e6, { prefix: true }),
  // Length (base: metre)
  m: u("length", 1, { prefix: true }),
  mi: u("length", 1609.344),
  Nmi: u("length", 1852),
  in: u("length", 0.0254),
  ft: u("length", 0.3048),
  yd: u("length", 0.9144),
  ang: u("length", 1e-10, { prefix: true }),
  ell: u("length", 1.143),
  ly: u("length", 9460730472580800, { prefix: true }),
  parsec: u("length", 30856775814913670, { prefix: true }),
  pc: u("length", 30856775814913670, { prefix: true }),
  Picapt: u("length", 0.0254 / 72),
  Pica: u("length", 0.0254 / 72),
  pica: u("length", 0.0254 / 6),
  survey_mi: u("length", 1609.3472186944373),
  // Time (base: second)
  yr: u("time", 31557600),
  day: u("time", 86400),
  d: u("time", 86400),
  hr: u("time", 3600),
  h: u("time", 3600),
  mn: u("time", 60),
  min: u("time", 60),
  sec: u("time", 1, { prefix: true }),
  s: u("time", 1, { prefix: true }),
  // Pressure (base: pascal)
  Pa: u("pressure", 1, { prefix: true }),
  p: u("pressure", 1, { prefix: true }),
  atm: u("pressure", 101325, { prefix: true }),
  at: u("pressure", 101325, { prefix: true }),
  mmHg: u("pressure", 133.32236842105263, { prefix: true }),
  psi: u("pressure", 6894.757293168361),
  Torr: u("pressure", 133.32236842105263),
  bar: u("pressure", 100000, { prefix: true }),
  // Force (base: newton)
  N: u("force", 1, { prefix: true }),
  dyn: u("force", 1e-5, { prefix: true }),
  dy: u("force", 1e-5, { prefix: true }),
  lbf: u("force", 4.4482216152605),
  pond: u("force", 0.00980665, { prefix: true }),
  // Energy (base: joule)
  J: u("energy", 1, { prefix: true }),
  e: u("energy", 1e-7, { prefix: true }),
  c: u("energy", 4.184, { prefix: true }),
  cal: u("energy", 4.1868, { prefix: true }),
  eV: u("energy", 1.602176634e-19, { prefix: true }),
  ev: u("energy", 1.602176634e-19, { prefix: true }),
  HPh: u("energy", 2684519.537696173),
  hh: u("energy", 2684519.537696173),
  Wh: u("energy", 3600, { prefix: true }),
  wh: u("energy", 3600, { prefix: true }),
  flb: u("energy", 1.3558179483314003),
  BTU: u("energy", 1055.05585262),
  btu: u("energy", 1055.05585262),
  // Power (base: watt)
  W: u("power", 1, { prefix: true }),
  w: u("power", 1, { prefix: true }),
  HP: u("power", 745.6998715822702),
  PS: u("power", 735.49875),
  // Magnetism (base: tesla)
  T: u("magnetism", 1, { prefix: true }),
  ga: u("magnetism", 1e-4, { prefix: true }),
  // Temperature (base: kelvin)
  C: u("temperature", 1, { offset: 273.15 }),
  cel: u("temperature", 1, { offset: 273.15 }),
  F: u("temperature", 5 / 9, { offset: 273.15 - (32 * 5) / 9 }),
  fah: u("temperature", 5 / 9, { offset: 273.15 - (32 * 5) / 9 }),
  K: u("temperature", 1, { prefix: true }),
  kel: u("temperature", 1, { prefix: true }),
  Rank: u("temperature", 5 / 9),
  Reau: u("temperature", 1.25, { offset: 273.15 }),
  // Volume (base: litre)
  l: u("volume", 1, { prefix: true }),
  L: u("volume", 1, { prefix: true }),
  lt: u("volume", 1, { prefix: true }),
  m3: u("volume", 1000, { prefix: true, power: 3 }),
  ang3: u("volume", 1e-27, { prefix: true, power: 3 }),
  tsp: u("volume", 0.00492892159375),
  tspm: u("volume", 0.005),
  tbs: u("volume", 0.01478676478125),
  oz: u("volume", 0.0295735295625),
  cup: u("volume", 0.2365882365),
  pt: u("volume", 0.473176473),
  us_pt: u("volume", 0.473176473),
  uk_pt: u("volume", 0.56826125),
  qt: u("volume", 0.946352946),
  uk_qt: u("volume", 1.1365225),
  gal: u("volume", 3.785411784),
  uk_gal: u("volume", 4.54609),
  in3: u("volume", 0.016387064),
  ft3: u("volume", 28.316846592),
  yd3: u("volume", 764.554857984),
  mi3: u("volume", 4168181825.44058 * 1000),
  barrel: u("volume", 158.987294928),
  bushel: u("volume", 35.23907016688),
  // Area (base: square metre)
  m2: u("area", 1, { prefix: true, power: 2 }),
  ang2: u("area", 1e-20, { prefix: true, power: 2 }),
  ar: u("area", 100, { prefix: true }),
  ha: u("area", 10000),
  in2: u("area", 0.00064516),
  ft2: u("area", 0.09290304),
  yd2: u("area", 0.83612736),
  mi2: u("area", 2589988.110336),
  Nmi2: u("area", 3429904),
  uk_acre: u("area", 4046.8564224),
  us_acre: u("area", 4046.872609874252),
  // Speed (base: metre per second)
  "m/s": u("speed", 1, { prefix: true }),
  "m/sec": u("speed", 1, { prefix: true }),
  "m/h": u("speed", 1 / 3600, { prefix: true }),
  "m/hr": u("speed", 1 / 3600, { prefix: true }),
  mph: u("speed", 0.44704),
  kn: u("speed", 1852 / 3600),
  admkn: u("speed", 0.514773333333333),
  // Information (base: bit)
  bit: u("information", 1, { prefix: true, binary: true }),
  byte: u("information", 8, { prefix: true, binary: true }),
  // Amount of substance (not in Excel, but every lab needs it)
  mol: u("amount", 1, { prefix: true }),
};

const PREFIXES: Record<string, number> = {
  Y: 1e24,
  Z: 1e21,
  E: 1e18,
  P: 1e15,
  T: 1e12,
  G: 1e9,
  M: 1e6,
  k: 1e3,
  h: 1e2,
  da: 1e1,
  e: 1e1,
  d: 1e-1,
  c: 1e-2,
  m: 1e-3,
  u: 1e-6,
  "µ": 1e-6,
  "μ": 1e-6,
  n: 1e-9,
  p: 1e-12,
  f: 1e-15,
  a: 1e-18,
  z: 1e-21,
  y: 1e-24,
};
const BINARY: Record<string, number> = { ki: 2 ** 10, Mi: 2 ** 20, Gi: 2 ** 30, Ti: 2 ** 40, Pi: 2 ** 50, Ei: 2 ** 60, Zi: 2 ** 70, Yi: 2 ** 80 };

/** A unit name → its category, factor and offset; null when unknown. */
export function findUnit(name: string): Unit | null {
  const exact = UNITS[name];
  if (exact) return exact;
  for (const [p, f] of Object.entries(BINARY)) {
    if (!name.startsWith(p)) continue;
    const base = UNITS[name.slice(p.length)];
    if (base?.binary) return { ...base, factor: base.factor * f };
  }
  for (const len of [2, 1]) {
    const p = name.slice(0, len);
    const f = PREFIXES[p];
    if (f === undefined) continue;
    const base = UNITS[name.slice(len)];
    if (base?.prefix) return { ...base, factor: base.factor * Math.pow(f, base.power ?? 1), offset: base.offset };
  }
  return null;
}

/** value in `from` → value in `to`; null when the units are unknown or don't fit together. */
export function convertUnits(value: number, from: string, to: string): number | null {
  const a = findUnit(from);
  const b = findUnit(to);
  if (!a || !b || a.cat !== b.cat) return null;
  const base = value * a.factor + (a.offset ?? 0);
  return (base - (b.offset ?? 0)) / b.factor;
}

export const CONVERT: FnDef[] = [
  {
    name: "CONVERT",
    min: 3,
    max: 3,
    args: "s",
    impl: ([v, f, t], ctx) => {
      const n = toNum(v as Scalar, ctx);
      if (typeof n !== "number") return n;
      const from = toStr(f as Scalar, ctx);
      if (typeof from !== "string") return from;
      const to = toStr(t as Scalar, ctx);
      if (typeof to !== "string") return to;
      const r = convertUnits(n, from, to);
      if (r === null) return mkErr("#N/A", `unit:${findUnit(from) ? to : from}`);
      return Number.isFinite(r) ? clean15(r) : ERR.num;
    },
  },
];

