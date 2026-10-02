// Alkanes as carbon skeletons: a drawn horizontal row with vertical side chains, the tree
// of carbon atoms behind it, the IUPAC name (longest chain, lowest locants, alphabetical
// order, di-/tri-), and the names a student with a typical misconception would give.

import { tx, type Text } from "@/i18n/text";

// ---------------------------------------------------------------------------
// Names and data of the homologous series

export const PARENT_DE = ["Methan", "Ethan", "Propan", "Butan", "Pentan", "Hexan", "Heptan", "Octan", "Nonan", "Decan", "Undecan", "Dodecan"];
export const PARENT_EN = ["methane", "ethane", "propane", "butane", "pentane", "hexane", "heptane", "octane", "nonane", "decane", "undecane", "dodecane"];
/** The stem students learn: meth-, eth-, prop-… */
export const STEM = ["Meth", "Eth", "Prop", "But", "Pent", "Hex", "Hept", "Oct", "Non", "Dec", "Undec", "Dodec"];

/** Name of the unbranched alkane with n carbon atoms (1–12). */
export const alkaneName = (n: number): Text => tx(PARENT_EN[n - 1], PARENT_DE[n - 1]);

/** Accepted spellings for the unbranched alkane with n carbon atoms. */
export function alkaneAccept(n: number): Text[] {
  const out: Text[] = [alkaneName(n)];
  if (n === 8) out.push("Oktan");
  if (n === 10) out.push("Dekan");
  if (n === 11) out.push("Undekan");
  if (n === 12) out.push("Dodekan");
  return out;
}

/** Molecular formula of an alkane with n carbon atoms: "C5H12". */
export const alkaneFormula = (n: number) => `C${n === 1 ? "" : n}H${2 * n + 2}`;

/**
 * Melting and boiling points (°C, at normal pressure, rounded) of the unbranched alkanes
 * methane to decane, as in school tables.
 */
export const MELT = [-182, -183, -188, -138, -130, -95, -91, -57, -54, -30];
export const BOIL = [-162, -89, -42, -1, 36, 69, 98, 126, 151, 174];

/** Boiling points of the branched isomers students meet (°C, rounded), by German name. */
export const BOIL_BRANCHED: Record<string, number> = {
  "2-Methylpropan": -12,
  "2-Methylbutan": 28,
  "2,2-Dimethylpropan": 10,
  "2-Methylpentan": 60,
  "3-Methylpentan": 63,
  "2,2-Dimethylbutan": 50,
  "2,3-Dimethylbutan": 58,
};

/** Number of structural isomers of CnH2n+2 (n = 4…8). */
export const ISOMERS: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 2, 5: 3, 6: 5, 7: 9, 8: 18 };

export type State = "gas" | "liquid" | "solid";
export const stateAt = (n: number, temp: number): State => (temp >= BOIL[n - 1] ? "gas" : temp >= MELT[n - 1] ? "liquid" : "solid");
export const STATE_NAME: Record<State, Text> = {
  gas: tx("gaseous", "gasförmig"),
  liquid: tx("liquid", "flüssig"),
  solid: tx("solid", "fest"),
};

/** Where students meet the first alkanes. */
export const USES: Text[] = [
  tx("natural gas, biogas", "Erdgas, Biogas"),
  tx("in natural gas", "im Erdgas"),
  tx("camping gas", "Campinggas"),
  tx("lighter gas", "Feuerzeuggas"),
  tx("in petrol", "im Benzin"),
  tx("in petrol", "im Benzin"),
  tx("in petrol", "im Benzin"),
  tx("in petrol", "im Benzin"),
  tx("in kerosene", "im Kerosin"),
  tx("in kerosene and diesel", "im Kerosin und Diesel"),
];

// ---------------------------------------------------------------------------
// Skeletons: how a molecule is drawn

/** A side chain hanging off row carbon `at` (0-based): `len` carbons straight up (dir −1) or down (dir 1). */
export type Branch = { at: number; len: number; dir: 1 | -1 };
/** A drawn molecule: `row` carbons in a horizontal line plus vertical side chains. */
export type Skeleton = { row: number; branches: Branch[] };

export type Graph = {
  n: number;
  adj: number[][];
  /** Grid position of each carbon: column (row index) and level (0 = the row, ±k = side chain). */
  pos: { col: number; lvl: number }[];
};

/** The carbon tree of a skeleton. Row carbons are 0…row−1, side-chain carbons follow in order. */
export function graphOf(s: Skeleton): Graph {
  const adj: number[][] = [];
  const pos: Graph["pos"] = [];
  const add = (col: number, lvl: number) => {
    adj.push([]);
    pos.push({ col, lvl });
    return adj.length - 1;
  };
  const link = (a: number, b: number) => {
    adj[a].push(b);
    adj[b].push(a);
  };
  for (let i = 0; i < s.row; i++) {
    add(i, 0);
    if (i > 0) link(i - 1, i);
  }
  for (const b of s.branches) {
    let prev = b.at;
    for (let k = 1; k <= b.len; k++) {
      const c = add(b.at, b.dir * k);
      link(prev, c);
      prev = c;
    }
  }
  return { n: adj.length, adj, pos };
}

/** Hydrogen atoms on a carbon (four bonds in total). */
export const hydrogens = (g: Graph, c: number) => 4 - g.adj[c].length;

/** Condensed group label of a carbon: CH3, CH2, CH, C. */
export const groupLabel = (h: number) => (h === 0 ? "C" : h === 1 ? "CH" : `CH${h}`);

// ---------------------------------------------------------------------------
// IUPAC naming

export type SubName = "methyl" | "ethyl" | "propyl";
const SUB_BY_LEN: Record<number, SubName> = { 1: "methyl", 2: "ethyl", 3: "propyl" };
const SUB_DE: Record<SubName, string> = { methyl: "Methyl", ethyl: "Ethyl", propyl: "Propyl" };
const MULT = ["", "", "di", "tri", "tetra", "penta", "hexa"];

export type Sub = { pos: number; name: SubName };
export type Naming = {
  /** Carbons of the main chain, numbered from 1 in this order. */
  chain: number[];
  subs: Sub[];
  name: Text;
  /** Every side chain is methyl, ethyl or propyl (school level). */
  ok: boolean;
};

/** The path between two carbons of a tree. */
function pathBetween(g: Graph, a: number, b: number): number[] {
  const prev = new Array<number>(g.n).fill(-1);
  const seen = new Array<boolean>(g.n).fill(false);
  const queue = [a];
  seen[a] = true;
  while (queue.length) {
    const v = queue.shift()!;
    if (v === b) break;
    for (const w of g.adj[v])
      if (!seen[w]) {
        seen[w] = true;
        prev[w] = v;
        queue.push(w);
      }
  }
  const out = [b];
  while (out[out.length - 1] !== a) out.push(prev[out[out.length - 1]]);
  return out.reverse();
}

/** All longest carbon chains (each in both directions). */
export function longestChains(g: Graph): number[][] {
  if (g.n === 1) return [[0]];
  const leaves = [...Array(g.n).keys()].filter((v) => g.adj[v].length === 1);
  let best: number[][] = [];
  for (const a of leaves)
    for (const b of leaves) {
      if (a === b) continue;
      const p = pathBetween(g, a, b);
      if (!best.length || p.length > best[0].length) best = [p];
      else if (p.length === best[0].length) best.push(p);
    }
  return best;
}

/** Side chains of a given main chain (numbered in the chain's direction). */
export function subsOf(g: Graph, chain: number[]): { subs: Sub[]; ok: boolean } {
  const inChain = new Set(chain);
  const subs: Sub[] = [];
  let ok = true;
  chain.forEach((c, i) => {
    for (const start of g.adj[c]) {
      if (inChain.has(start)) continue;
      // Walk the side chain; it must be a straight line to have a simple name.
      let len = 1;
      let prev = c;
      let cur = start;
      for (;;) {
        const next = g.adj[cur].filter((w) => w !== prev);
        if (next.length === 0) break;
        if (next.length > 1) {
          ok = false;
          break;
        }
        prev = cur;
        cur = next[0];
        len++;
      }
      const name = SUB_BY_LEN[len];
      if (!name) ok = false;
      subs.push({ pos: i + 1, name: name ?? "propyl" });
    }
  });
  return { subs, ok };
}

const sortedLocants = (subs: Sub[]) => subs.map((s) => s.pos).sort((a, b) => a - b);
const ALPHA: SubName[] = ["ethyl", "methyl", "propyl"];

/** Compare locant lists at the first point of difference. */
function cmpLists(a: number[], b: number[]) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

/** Locants in the order the groups are cited (alphabetical): the tie-break of IUPAC rule 3. */
const citedLocants = (subs: Sub[]) => ALPHA.flatMap((name) => subs.filter((s) => s.name === name).map((s) => s.pos).sort((a, b) => a - b));

export type NameParts = { groups: { name: SubName; locants: number[] }[]; parent: number };

/** Build the name: groups alphabetically, locants with commas, di/tri for repeats. */
export function formatName(p: NameParts, opts: { order?: "alpha" | "locant"; multiplier?: boolean; allLocants?: boolean } = {}): Text {
  const order = opts.order ?? "alpha";
  const groups = [...p.groups].sort((a, b) => (order === "alpha" ? ALPHA.indexOf(a.name) - ALPHA.indexOf(b.name) : a.locants[0] - b.locants[0]));
  const piece = (g: NameParts["groups"][number], de: boolean) => {
    const locs = opts.allLocants === false ? [...new Set(g.locants)] : g.locants;
    const mult = opts.multiplier === false ? "" : MULT[g.locants.length];
    return `${locs.join(",")}-${mult}${de ? SUB_DE[g.name].toLowerCase() : g.name}`;
  };
  const en = groups.map((g) => piece(g, false)).join("-") + PARENT_EN[p.parent - 1];
  const deRaw = groups.map((g) => piece(g, true)).join("-") + (groups.length ? PARENT_DE[p.parent - 1].toLowerCase() : PARENT_DE[p.parent - 1]);
  // German: the first letter of the name is a capital ("2-Methylbutan", "3-Ethyl-2-methylpentan").
  const de = deRaw.replace(/[A-Za-zäöü]/, (c) => c.toUpperCase());
  return tx(en, de);
}

export function partsOf(subs: Sub[], parent: number): NameParts {
  const groups: NameParts["groups"] = [];
  for (const name of ALPHA) {
    const locants = subs.filter((s) => s.name === name).map((s) => s.pos).sort((a, b) => a - b);
    if (locants.length) groups.push({ name, locants });
  }
  return { groups, parent };
}

/** The better numbering direction of one chain (lowest locants, then alphabetical tie-break). */
function bestDirection(g: Graph, chain: number[]) {
  const a = { chain, ...subsOf(g, chain) };
  const rev = [...chain].reverse();
  const b = { chain: rev, ...subsOf(g, rev) };
  const c = cmpLists(sortedLocants(a.subs), sortedLocants(b.subs)) || cmpLists(citedLocants(a.subs), citedLocants(b.subs));
  return c <= 0 ? a : b;
}

/** The IUPAC name of a carbon tree. */
export function nameOf(g: Graph): Naming {
  const chains = longestChains(g);
  let best: ReturnType<typeof bestDirection> | null = null;
  for (const chain of chains) {
    const cand = bestDirection(g, chain);
    if (!best) {
      best = cand;
      continue;
    }
    // More side chains first, then lowest locants, then the alphabetical tie-break.
    const more = cand.subs.length - best.subs.length;
    const cmp = more !== 0 ? -more : cmpLists(sortedLocants(cand.subs), sortedLocants(best.subs)) || cmpLists(citedLocants(cand.subs), citedLocants(best.subs));
    if (cmp < 0) best = cand;
  }
  const b = best!;
  return { chain: b.chain, subs: b.subs, ok: b.ok, name: formatName(partsOf(b.subs, b.chain.length)) };
}

export const nameOfSkeleton = (s: Skeleton) => nameOf(graphOf(s));

// ---------------------------------------------------------------------------
// Typical wrong names, simulated from the molecule

export type WrongName = { kind: "wrongEnd" | "drawnRow" | "noMultiplier" | "oneLocant" | "order" | "unbranched" | "chainPlusBranch"; name: Text };

const enOf = (t: Text) => (typeof t === "string" ? t : t.en);

/** Names a student with a typical misconception would write, each different from the right one. */
export function wrongNames(s: Skeleton): WrongName[] {
  const g = graphOf(s);
  const right = nameOf(g);
  const out: WrongName[] = [];
  const push = (kind: WrongName["kind"], name: Text) => {
    if (enOf(name) === enOf(right.name) || out.some((w) => enOf(w.name) === enOf(name))) return;
    out.push({ kind, name });
  };
  const L = right.chain.length;
  // Counted from the wrong end.
  const reversed = right.subs.map((x) => ({ ...x, pos: L + 1 - x.pos }));
  if (right.subs.length) push("wrongEnd", formatName(partsOf(reversed, L)));
  // Took the drawn horizontal row as the main chain.
  const row = [...Array(s.row).keys()];
  const sameChain = row.length === L && row.every((c) => right.chain.includes(c));
  if (!sameChain && s.row >= 2) {
    const d = bestDirection(g, row);
    if (d.ok) push("drawnRow", formatName(partsOf(d.subs, s.row)));
  }
  const parts = partsOf(right.subs, L);
  // Repeated group without di/tri, or only one locant for it.
  if (parts.groups.some((x) => x.locants.length > 1)) {
    push("noMultiplier", formatName(parts, { multiplier: false }));
    if (parts.groups.some((x) => new Set(x.locants).size < x.locants.length)) push("oneLocant", formatName(parts, { allLocants: false }));
  }
  // Groups ordered by locant instead of alphabetically.
  if (parts.groups.length > 1) push("order", formatName(parts, { order: "locant" }));
  // The name of the unbranched alkane with the same number of carbons.
  if (right.subs.length && g.n <= 12) push("unbranched", alkaneName(g.n));
  // Side-chain carbons counted into the main chain.
  if (right.subs.length === 1 && right.subs[0].name === "methyl" && L + 1 <= 12) push("chainPlusBranch", formatName(partsOf(right.subs, L + 1)));
  return out;
}

// ---------------------------------------------------------------------------
// Condensed structural formula on one line (unbranched or simple branches): CH3–CH(CH3)–CH3

/** One-line condensed formula of the main chain with side chains in brackets, for \ce{…}. */
export function condensedLine(g: Graph, chain: number[]): string {
  const inChain = new Set(chain);
  return chain
    .map((c) => {
      const h = hydrogens(g, c);
      const sides = g.adj[c].filter((w) => !inChain.has(w));
      const pieces = sides.map((start) => {
        // Side chains are straight: CH3, CH2CH3, CH2CH2CH3.
        const parts: string[] = [];
        let prev = c;
        let cur = start;
        for (;;) {
          parts.push(groupLabel(hydrogens(g, cur)));
          const next = g.adj[cur].filter((w) => w !== prev);
          if (!next.length) break;
          prev = cur;
          cur = next[0];
        }
        return parts.join("");
      });
      // Two equal side chains on one carbon: C(CH3)2.
      const side = pieces.length === 2 && pieces[0] === pieces[1] ? `(${pieces[0]})2` : pieces.map((p) => `(${p})`).join("");
      return `${groupLabel(h)}${side}`;
    })
    .join("–");
}

/** Molecular formula of a carbon tree. */
export const formulaOf = (g: Graph) => alkaneFormula(g.n);
