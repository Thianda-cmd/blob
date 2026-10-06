// Pedigrees (Stammbäume): a small family model, a generator that simulates real inheritance
// for a given mode, and a solver that decides which modes of inheritance fit a pedigree.
//
// Genotypes are counted as the number of "disease alleles" a person carries:
//   autosomal: 0, 1 or 2 for everybody
//   X-linked:  0, 1 or 2 for women (two X), 0 or 1 for men (one X, hemizygous)
// For the dominant modes the disease allele is the dominant one (A), for the recessive modes
// it is the recessive one (a).

import type { Rng } from "@/learn/engine/rng";

export type Mode = "AD" | "AR" | "XD" | "XR";
export const MODES: Mode[] = ["AD", "AR", "XD", "XR"];
export type Sex = "m" | "f";

export type Person = {
  sex: Sex;
  affected: boolean;
  /** Indices of the parents; null for the founders and for partners who married in. */
  father: number | null;
  mother: number | null;
  /** Generation: 0 = I, 1 = II, 2 = III. */
  gen: number;
  /** Horizontal position in slots (layout units of one person width). */
  x: number;
  /** Status not known yet (e.g. too young): drawn with a question mark. */
  unknown?: boolean;
  /** Known heterozygous carrier: drawn half filled. */
  carrier?: boolean;
  /** A child that isn't born yet (sex unknown): drawn as a diamond with "?". */
  unborn?: boolean;
};

/** A couple: [left partner, right partner]. */
export type Couple = [number, number];
/** A family tree. Person i is drawn with the number i + 1 (numbered generation by generation, left to right). */
export type Pedigree = { people: Person[]; couples: Couple[]; width: number };

export const isX = (mode: Mode) => mode === "XD" || mode === "XR";
export const isDominant = (mode: Mode) => mode === "AD" || mode === "XD";

/** Genotypes (disease allele counts) a person can have, given the phenotype. */
export function options(mode: Mode, p: Pick<Person, "sex" | "affected" | "unknown">): number[] {
  const male = p.sex === "m";
  if (isX(mode) && male) return p.unknown ? [0, 1] : p.affected ? [1] : [0];
  if (p.unknown) return [0, 1, 2];
  if (isDominant(mode)) return p.affected ? [1, 2] : [0];
  return p.affected ? [2] : [0, 1];
}

/** Is a person with `d` disease alleles affected? */
export function affectedBy(mode: Mode, sex: Sex, d: number) {
  if (isX(mode) && sex === "m") return d === 1;
  return isDominant(mode) ? d >= 1 : d === 2;
}

/** Alleles a parent with d disease alleles can pass on (0 = normal, 1 = disease allele). */
const gametes = (d: number) => (d === 0 ? [0] : d === 1 ? [0, 1] : [1]);

/** Can a child with genotype cd come from these parents? */
export function canDescend(mode: Mode, childSex: Sex, cd: number, fd: number, md: number): boolean {
  if (isX(mode)) {
    if (childSex === "m") return gametes(md).includes(cd);
    return gametes(md).some((b) => fd + b === cd);
  }
  return gametes(fd).some((a) => gametes(md).some((b) => a + b === cd));
}

/** Probability that a child with genotype cd comes from these parents. */
export function descendProb(mode: Mode, childSex: Sex, cd: number, fd: number, md: number): number {
  const g = (d: number) => (d === 0 ? [1, 0] : d === 1 ? [0.5, 0.5] : [0, 1]);
  const m = g(md);
  if (isX(mode)) {
    if (childSex === "m") return m[cd] ?? 0;
    return cd - fd >= 0 && cd - fd <= 1 ? m[cd - fd] : 0;
  }
  const f = g(fd);
  let p = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) if (a + b === cd) p += f[a] * m[b];
  return p;
}

/**
 * Is there any genotype assignment that fits every person? `fixed` pins some people to a genotype.
 * People are numbered generation by generation, so parents always come before their children.
 */
export function consistent(ped: Pedigree, mode: Mode, fixed?: Map<number, number>): boolean {
  const { people } = ped;
  const g: number[] = new Array(people.length).fill(-1);
  const order = people.map((_, i) => i).sort((a, b) => people[a].gen - people[b].gen || a - b);
  const go = (k: number): boolean => {
    if (k === order.length) return true;
    const i = order[k];
    const p = people[i];
    const opts = fixed?.has(i) ? options(mode, p).filter((d) => d === fixed.get(i)) : options(mode, p);
    for (const d of opts) {
      if (p.father !== null && p.mother !== null && !canDescend(mode, p.sex, d, g[p.father], g[p.mother])) continue;
      g[i] = d;
      if (go(k + 1)) return true;
    }
    g[i] = -1;
    return false;
  };
  return go(0);
}

/** For every person: the genotypes that occur in at least one assignment that fits the whole tree. */
export function possibleGenotypes(ped: Pedigree, mode: Mode): number[][] {
  return ped.people.map((p, i) => options(mode, p).filter((d) => consistent(ped, mode, new Map([[i, d]]))));
}

export const possibleModes = (ped: Pedigree, modes: Mode[] = MODES) => modes.filter((m) => consistent(ped, m));

/** A family of three (father, mother, child) that alone rules a mode out. */
export type Trio = { father: number; mother: number; child: number };

/** The first trio (by the child's number) that cannot occur under this mode. */
export function exclusion(ped: Pedigree, mode: Mode): Trio | null {
  const { people } = ped;
  for (let c = 0; c < people.length; c++) {
    const p = people[c];
    if (p.father === null || p.mother === null) continue;
    const f = people[p.father];
    const m = people[p.mother];
    const ok = options(mode, f).some((fd) => options(mode, m).some((md) => options(mode, p).some((cd) => canDescend(mode, p.sex, cd, fd, md))));
    if (!ok) return { father: p.father, mother: p.mother, child: c };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Building family trees

type Shape = { people: Omit<Person, "affected">[]; couples: Couple[]; width: number };

/**
 * A three-generation family: a couple (I), their 2–4 children (II), one or two of whom have a
 * partner and children of their own (III). Laid out so that no lines cross.
 */
export function familyShape(rng: Rng, maxSlots = 9): Shape {
  for (let attempt = 0; attempt < 50; attempt++) {
    const n2 = rng.int(2, 4);
    const marriedIdx = rng.shuffle([...Array(n2).keys()]).slice(0, n2 >= 3 && rng.chance(0.45) ? 2 : 1);
    const kids = Array.from({ length: n2 }, (_, i) => (marriedIdx.includes(i) ? rng.int(marriedIdx.length > 1 ? 1 : 2, marriedIdx.length > 1 ? 3 : 4) : 0));
    const widths = kids.map((k, i) => (marriedIdx.includes(i) ? Math.max(2, k) : 1));
    const width = widths.reduce((s, w) => s + w, 0);
    if (width > maxSlots || width < 3) continue;

    const people: Omit<Person, "affected">[] = [];
    const couples: Couple[] = [];
    const add = (p: Omit<Person, "affected">) => people.push(p) - 1;
    const sex = (): "m" | "f" => (rng.chance(0.5) ? "m" : "f");

    // Generation II and III, unit by unit.
    let start = 0;
    const sibX: number[] = [];
    const sibs: number[] = [];
    const later: (() => void)[] = [];
    for (let i = 0; i < n2; i++) {
      const w = widths[i];
      const c = start + w / 2;
      const s = sex();
      if (!marriedIdx.includes(i)) {
        sibX.push(c);
        sibs.push(add({ sex: s, father: null, mother: null, gen: 1, x: c }));
      } else {
        const spouseLeft = i === 0;
        const sibPos = spouseLeft ? c + 0.5 : c - 0.5;
        const spPos = spouseLeft ? c - 0.5 : c + 0.5;
        sibX.push(sibPos);
        const sib = add({ sex: s, father: null, mother: null, gen: 1, x: sibPos });
        sibs.push(sib);
        const sp = add({ sex: s === "m" ? "f" : "m", father: null, mother: null, gen: 1, x: spPos });
        couples.push(spouseLeft ? [sp, sib] : [sib, sp]);
        const k = kids[i];
        const dad = s === "m" ? sib : sp;
        const mum = s === "m" ? sp : sib;
        later.push(() => {
          for (let j = 0; j < k; j++) add({ sex: sex(), father: dad, mother: mum, gen: 2, x: c - (k - 1) / 2 + j });
        });
      }
      start += w;
    }
    later.forEach((f) => f());
    // Generation I above the middle of the siblings.
    const mid = (Math.min(...sibX) + Math.max(...sibX)) / 2;
    const f1 = add({ sex: "m", father: null, mother: null, gen: 0, x: mid - 0.5 });
    const m1 = add({ sex: "f", father: null, mother: null, gen: 0, x: mid + 0.5 });
    couples.push([f1, m1]);
    for (const s of sibs) {
      people[s].father = f1;
      people[s].mother = m1;
    }
    return renumber({ people, couples, width });
  }
  throw new Error("no family shape");
}

/** Renumber people generation by generation, left to right. */
function renumber<T extends Omit<Person, "affected">>(shape: { people: T[]; couples: Couple[]; width: number }) {
  const order = shape.people.map((_, i) => i).sort((a, b) => shape.people[a].gen - shape.people[b].gen || shape.people[a].x - shape.people[b].x);
  const to = new Map(order.map((old, i) => [old, i]));
  const people = order.map((old) => {
    const p = shape.people[old];
    return { ...p, father: p.father === null ? null : to.get(p.father)!, mother: p.mother === null ? null : to.get(p.mother)! };
  });
  const couples = shape.couples.map(([a, b]) => [to.get(a)!, to.get(b)!] as Couple);
  return { people, couples, width: shape.width };
}

/** Pick a genotype from weighted choices. */
function weighted(rng: Rng, items: [number, number][]): number {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [v, w] of items) if ((r -= w) < 0) return v;
  return items[items.length - 1][0];
}

/** Starting genotypes for founders and partners who married in, so that the trait shows up. */
function founderGenotype(rng: Rng, mode: Mode, sex: Sex, role: "founder" | "partner"): number {
  const male = sex === "m";
  switch (mode) {
    case "AD":
      return role === "founder" ? weighted(rng, [[1, 6], [0, 4]]) : weighted(rng, [[0, 7], [1, 3]]);
    case "AR":
      return role === "founder" ? weighted(rng, [[1, 7], [2, 2], [0, 1]]) : weighted(rng, [[0, 4], [1, 4], [2, 2]]);
    case "XD":
      return male ? (role === "founder" ? weighted(rng, [[1, 6], [0, 4]]) : weighted(rng, [[0, 7], [1, 3]])) : role === "founder" ? weighted(rng, [[1, 6], [0, 4]]) : weighted(rng, [[0, 7], [1, 3]]);
    case "XR":
      return male ? (role === "founder" ? weighted(rng, [[1, 5], [0, 5]]) : weighted(rng, [[0, 6], [1, 4]])) : role === "founder" ? weighted(rng, [[1, 7], [0, 2], [2, 1]]) : weighted(rng, [[0, 4], [1, 5], [2, 1]]);
  }
}

/** Simulates inheritance through a family shape: every child gets one allele from each parent. */
export function simulate(rng: Rng, shape: Shape, mode: Mode): { ped: Pedigree; geno: number[] } {
  const geno: number[] = new Array(shape.people.length).fill(0);
  const order = shape.people.map((_, i) => i).sort((a, b) => shape.people[a].gen - shape.people[b].gen || a - b);
  const pass = (d: number) => (d === 0 ? 0 : d === 2 ? 1 : rng.chance(0.5) ? 1 : 0);
  for (const i of order) {
    const p = shape.people[i];
    if (p.father === null || p.mother === null) {
      geno[i] = founderGenotype(rng, mode, p.sex, p.gen === 0 ? "founder" : "partner");
      continue;
    }
    const fromMother = pass(geno[p.mother]);
    if (isX(mode)) geno[i] = p.sex === "m" ? fromMother : geno[p.father] + fromMother;
    else geno[i] = pass(geno[p.father]) + fromMother;
  }
  const people = shape.people.map((p, i) => ({ ...p, affected: affectedBy(mode, p.sex, geno[i]) }));
  return { ped: { people, couples: shape.couples, width: shape.width }, geno };
}

/** A family tree with a believable number of affected people in more than one generation. */
function lively(ped: Pedigree) {
  const n = ped.people.length;
  const aff = ped.people.filter((p) => p.affected);
  const gens = new Set(aff.map((p) => p.gen));
  return aff.length >= 2 && aff.length <= Math.ceil(n * 0.55) && gens.size >= 2;
}

/**
 * A pedigree generated under `mode` whose set of still possible modes (among `among`) passes `accept`.
 * Retries with new families until it fits.
 */
export function generatePedigree(rng: Rng, mode: Mode, among: Mode[], accept: (possible: Mode[], ped: Pedigree) => boolean, maxSlots = 9): Pedigree {
  let last: Pedigree | null = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const { ped } = simulate(rng, familyShape(rng, maxSlots), mode);
    if (!lively(ped)) continue;
    last = ped;
    if (accept(possibleModes(ped, among), ped)) return ped;
  }
  return last ?? simulate(rng, familyShape(rng, maxSlots), mode).ped;
}

/** Children of a couple. */
export const childrenOf = (ped: Pedigree, a: number, b: number) =>
  ped.people.map((p, i) => [p, i] as const).filter(([p]) => (p.father === a && p.mother === b) || (p.father === b && p.mother === a)).map(([, i]) => i);

/** The other partner of a person, if they have one. */
export function partnerOf(ped: Pedigree, i: number): number | null {
  const c = ped.couples.find(([a, b]) => a === i || b === i);
  return c ? (c[0] === i ? c[1] : c[0]) : null;
}
