/** Small seeded random generator (mulberry32) so an exercise can be recreated from its seed. */
export type Rng = {
  seed: number;
  next: () => number;
  /** Integer in [min, max]. */
  int: (min: number, max: number) => number;
  /** Integer in [min, max] that is not 0 (and not in `except`). */
  nonZero: (min: number, max: number, except?: number[]) => number;
  pick: <T>(items: readonly T[]) => T;
  shuffle: <T>(items: readonly T[]) => T[];
  chance: (p: number) => boolean;
  sign: () => 1 | -1;
};

export function createRng(seed = Math.floor(Math.random() * 2 ** 31)): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    seed,
    next,
    int,
    nonZero(min, max, except = []) {
      for (let i = 0; i < 100; i++) {
        const v = int(min, max);
        if (v !== 0 && !except.includes(v)) return v;
      }
      return max === 0 ? 1 : max;
    },
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle(items) {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function lcm(a: number, b: number) {
  return Math.abs(a * b) / gcd(a, b);
}
