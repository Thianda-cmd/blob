// Excel's wildcards without regular expressions: * any text, ? one character, ~ before * ? or ~
// for the sign itself. Used by the criteria of ZÄHLENWENN & Co., the lookups (VERGLEICH,
// SVERWEIS…), SUCHEN, the text filters of smart tables and find & replace.
//
// A RegExp with many stars ("*a*a*a*a*a*a*a*b") backtracks: every extra star multiplies the time,
// and a short formula from an imported file could freeze the sheet for minutes on every open. Here
// a pattern is split at its stars, and each piece between them is looked for once, left to right
// (taking the leftmost place for each piece is always right for * and ?). A piece without "?" is
// found by the browser's own text search in the folded text; one with "?" by a bit-parallel scan
// (Shift-And), which takes about (length of the text) × (length of the piece ÷ 32) steps.

export type GlobOptions = {
  /** Upper and lower case count as different (find's "match case"). Default: the same, like Excel. */
  matchCase?: boolean;
  /** ? stands for one character (code point) instead of one UTF-16 unit, so an emoji counts once. */
  unicode?: boolean;
};

/** One piece of a pattern between stars, ready for the bit-parallel scan. */
type Piece = {
  /** Folded character codes; ANY for "?". */
  items: number[];
  /** The same as text, for the browser's search: null with a "?" (or a character beyond the first 65,536). */
  text: string | null;
  /** For each code that is common in the piece: the positions (bits) where it or a "?" fits. */
  dense: Map<number, Uint32Array>;
  /**
   * The other codes and where they are. A long piece of many different characters would otherwise
   * need a full mask for each of them (32,767 different ones: about 130 MB).
   */
  sparse: Map<number, number[]>;
  /** The positions of the "?". */
  any: Uint32Array;
};

/** A compiled pattern: the pieces between its stars (one piece: no star at all). */
export type Glob = { pieces: Piece[]; unicode: boolean; fold: (code: number) => number };

const ANY = -1;

function piece(items: number[]): Piece {
  const words = Math.max(1, (items.length + 31) >>> 5);
  const any = new Uint32Array(words);
  const at = new Map<number, number[]>();
  items.forEach((c, j) => {
    if (c === ANY) any[j >>> 5] |= 1 << (j & 31);
    else {
      const list = at.get(c);
      if (list) list.push(j);
      else at.set(c, [j]);
    }
  });
  // A code gets its own mask when it is at least every 256th character of the piece: at most 256
  // masks, and a rare code costs fewer steps than a mask is long. Pieces up to 256 characters long
  // (all everyday ones) have only masks.
  const dense = new Map<number, Uint32Array>();
  const sparse = new Map<number, number[]>();
  for (const [c, list] of at) {
    if (list.length * 8 < words) {
      sparse.set(c, list);
      continue;
    }
    const mask = any.slice();
    for (const j of list) mask[j >>> 5] |= 1 << (j & 31);
    dense.set(c, mask);
  }
  return { items, text: items.every((c) => c !== ANY && c <= 0xffff) ? textOf(items) : null, dense, sparse, any };
}

/** Character codes (each below 65,536) as text. */
function textOf(codes: number[]): string {
  let s = "";
  for (let i = 0; i < codes.length; i += 8192) s += String.fromCharCode(...codes.slice(i, i + 8192));
  return s;
}

// Without "match case", characters are compared the way a RegExp with the "i" flag compares them:
// by their upper case (when that is one character and doesn't turn a non-ASCII letter into an ASCII
// one); with "unicode" by their case folding, as the "iu" flags do.
const foldCache = new Map<number, number>();
const foldUnitCache = new Map<number, number>();

function foldUnit(c: number): number {
  if (c < 128) return c >= 97 && c <= 122 ? c - 32 : c;
  let f = foldUnitCache.get(c);
  if (f === undefined) {
    const up = String.fromCharCode(c).toUpperCase();
    f = up.length === 1 && !(up.charCodeAt(0) < 128) ? up.charCodeAt(0) : c;
    foldUnitCache.set(c, f);
  }
  return f;
}

function foldPoint(c: number): number {
  if (c < 128) return c >= 65 && c <= 90 ? c + 32 : c;
  let f = foldCache.get(c);
  if (f === undefined) {
    const single = (s: string) => (s.length === 1 || (s.length === 2 && s.codePointAt(0)! > 0xffff) ? s.codePointAt(0)! : null);
    const ch = String.fromCodePoint(c);
    const up = single(ch.toUpperCase());
    f = (up !== null ? single(String.fromCodePoint(up).toLowerCase()) : null) ?? single(ch.toLowerCase()) ?? c;
    foldCache.set(c, f);
  }
  return f;
}

const same = (c: number) => c;

const cache = new Map<string, Glob>();
/** The characters of all patterns in the cache: long patterns are big once compiled. */
let cached = 0;

/** A pattern with Excel's wildcards, ready to match (remembered: the same pattern is asked for again and again). */
export function compileGlob(pattern: string, opts: GlobOptions = {}): Glob {
  const key = `${opts.matchCase ? 1 : 0}${opts.unicode ? 1 : 0}${pattern}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const unicode = !!opts.unicode;
  const fold = opts.matchCase ? same : unicode ? foldPoint : foldUnit;
  const chars = unicode ? Array.from(pattern, (ch) => ch.codePointAt(0)!) : Array.from({ length: pattern.length }, (_, i) => pattern.charCodeAt(i));
  const pieces: Piece[] = [];
  let items: number[] = [];
  let afterStar = false;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === 126 /* ~ */ && i + 1 < chars.length && (chars[i + 1] === 42 || chars[i + 1] === 63 || chars[i + 1] === 126)) {
      items.push(fold(chars[++i]));
      afterStar = false;
    } else if (c === 42 /* * */) {
      // A run of stars is one star.
      if (!afterStar) {
        pieces.push(piece(items));
        items = [];
      }
      afterStar = true;
    } else {
      items.push(c === 63 /* ? */ ? ANY : fold(c));
      afterStar = false;
    }
  }
  pieces.push(piece(items));
  const glob: Glob = { pieces, unicode, fold };
  if (cache.size >= 2000 || cached + pattern.length > 1_000_000) {
    cache.clear();
    cached = 0;
  }
  cache.set(key, glob);
  cached += pattern.length;
  return glob;
}

/** ı and ſ turn into the ASCII letters I and S in upper case, which a RegExp's "i" doesn't do. */
const UPPER_TO_ASCII = /[ıſ]/;
const SURROGATE = /[\ud800-\udfff]/;
const NOT_ASCII = /[^\x00-\x7f]/;

/**
 * A text as a pattern sees it: folded like the pattern, as text for the browser's own search (its
 * positions must be the pattern's, so not with characters beyond the first 65,536 under
 * `unicode`), and as character codes for the bit-parallel scan, made only when needed.
 */
class Subject {
  /** Its length in the pattern's characters. */
  readonly n: number;
  readonly folded: string | null;
  private list: number[] | null = null;

  constructor(
    private readonly g: Glob,
    private readonly text: string,
  ) {
    let folded: string | null = null;
    if (g.fold === same) folded = g.unicode && SURROGATE.test(text) ? null : text;
    else if (g.fold === foldUnit) {
      // The browser's upper case is the same character by character, unless a character becomes
      // several (ß → SS) or an ASCII letter (ı → I), or lies beyond the first 65,536: the "i" flag
      // folds UTF-16 units one by one, so it leaves those alone.
      const up = text.toUpperCase();
      if (up.length === text.length && !UPPER_TO_ASCII.test(text) && !SURROGATE.test(text)) folded = up;
    } else if (!NOT_ASCII.test(text)) folded = text.toLowerCase();
    if (folded === null && !(g.unicode && SURROGATE.test(text))) folded = textOf(this.codes());
    this.folded = folded;
    this.n = folded !== null ? folded.length : this.codes().length;
  }

  /** The folded character codes (code points with `unicode`). */
  codes(): number[] {
    if (this.list) return this.list;
    const out: number[] = [];
    const fold = this.g.fold;
    if (this.g.unicode) for (const ch of this.text) out.push(fold(ch.codePointAt(0)!));
    else for (let i = 0; i < this.text.length; i++) out.push(fold(this.text.charCodeAt(i)));
    return (this.list = out);
  }
}

/** Does the piece fit the text at this place? */
function fits(p: Piece, s: Subject, at: number): boolean {
  const items = p.items;
  if (at < 0 || at + items.length > s.n) return false;
  if (p.text !== null && s.folded !== null) return s.folded.startsWith(p.text, at);
  const codes = s.codes();
  for (let j = 0; j < items.length; j++) if (items[j] !== ANY && items[j] !== codes[at + j]) return false;
  return true;
}

/**
 * Where a piece fits in the text between from and to: the leftmost start, or with `last` the
 * rightmost; -1 when nowhere. Without "?" the browser's search finds the leftmost one (its search
 * from the right compares naively, so the scan finds the rightmost).
 */
function find(p: Piece, s: Subject, from: number, to: number, last: boolean): number {
  const m = p.items.length;
  if (m === 0) return last ? to : from <= to ? from : -1;
  if (to - from < m) return -1;
  if (!last && p.text !== null && s.folded !== null) {
    const at = s.folded.indexOf(p.text, from);
    return at >= 0 && at + m <= to ? at : -1;
  }
  return scan(p, s.codes(), from, to, last);
}

/** find with Shift-And: bit j of the state says "the last j + 1 characters fit the piece's start". */
function scan(p: Piece, codes: number[], from: number, to: number, last: boolean): number {
  const m = p.items.length;
  const words = p.any.length;
  const state = new Uint32Array(words);
  const shifted = p.sparse.size ? new Uint32Array(words) : null;
  const top = (m - 1) >>> 5;
  const bit = 1 << ((m - 1) & 31);
  let found = -1;
  for (let i = from; i < to; i++) {
    const c = codes[i];
    const mask = p.dense.get(c);
    const rare = !mask && shifted ? p.sparse.get(c) : undefined;
    let carry = 1;
    if (rare) {
      // Shift, keep the "?" positions, then each position where this code stands in the piece.
      for (let w = 0; w < words; w++) {
        const s = state[w];
        const sh = (s << 1) | carry;
        shifted![w] = sh;
        state[w] = sh & p.any[w];
        carry = s >>> 31;
      }
      for (const j of rare) if (shifted![j >>> 5] & (1 << (j & 31))) state[j >>> 5] |= 1 << (j & 31);
    } else {
      const fits = mask ?? p.any;
      for (let w = 0; w < words; w++) {
        const s = state[w];
        state[w] = ((s << 1) | carry) & fits[w];
        carry = s >>> 31;
      }
    }
    if (state[top] & bit) {
      found = i - m + 1;
      if (!last) return found;
    }
  }
  return found;
}

/**
 * Does the text match the pattern? "whole": all of it (ZÄHLENWENN, a filter's "equals"); "begins",
 * "ends" and "contains": the pattern may leave text over at the end, at the start, or both.
 */
export function globTest(g: Glob, text: string, within: "whole" | "begins" | "ends" | "contains" = "whole"): boolean {
  const s = new Subject(g, text);
  const n = s.n;
  const ps = g.pieces;
  const anchorStart = within === "whole" || within === "begins";
  const anchorEnd = within === "whole" || within === "ends";
  if (ps.length === 1 && anchorStart && anchorEnd) return n === ps[0].items.length && fits(ps[0], s, 0);
  let lo = 0;
  let hi = n;
  let i0 = 0;
  let i1 = ps.length - 1;
  if (anchorStart) {
    if (!fits(ps[0], s, 0)) return false;
    lo = ps[0].items.length;
    i0 = 1;
  }
  if (anchorEnd) {
    const end = ps[i1];
    if (end.items.length > hi - lo || !fits(end, s, n - end.items.length)) return false;
    hi = n - end.items.length;
    i1--;
  }
  for (let i = i0; i <= i1; i++) {
    const at = find(ps[i], s, lo, hi, false);
    if (at < 0) return false;
    lo = at + ps[i].items.length;
  }
  return true;
}

/**
 * The first place in the text, from `from` on, where the pattern matches: the leftmost start, and
 * the end as far right as a star can reach (as a greedy RegExp would). Positions count UTF-16
 * units (code points with `unicode`); null when it matches nowhere.
 */
export function globFind(g: Glob, text: string, from = 0): { start: number; end: number } | null {
  return findIn(g, new Subject(g, text), from, true);
}

/** Where the pattern first matches, from `from` on (SUCHEN): only the start, which is quicker to find than the end. -1 when nowhere. */
export function globIndex(g: Glob, text: string, from = 0): number {
  return findIn(g, new Subject(g, text), from, false)?.start ?? -1;
}

/** The first match from `from` on; with `greedy` its end as far right as it goes, else just a match's end. */
function findIn(g: Glob, s: Subject, from: number, greedy: boolean): { start: number; end: number } | null {
  const n = s.n;
  const ps = g.pieces;
  // The leftmost place of the first piece is the start whenever there is a match at all: a later
  // start leaves less room for the rest.
  const start = find(ps[0], s, from, n, false);
  if (start < 0) return null;
  if (ps.length === 1) return { start, end: start + ps[0].items.length };
  let lo = start + ps[0].items.length;
  for (let i = 1; i < ps.length - 1; i++) {
    const at = find(ps[i], s, lo, n, false);
    if (at < 0) return null;
    lo = at + ps[i].items.length;
  }
  const end = ps[ps.length - 1];
  const at = find(end, s, lo, n, greedy);
  return at < 0 ? null : { start, end: at + end.items.length };
}

/** Every match replaced, left to right, without overlaps (find & replace); only for patterns without `unicode`. */
export function globReplace(g: Glob, text: string, replacement: string): string {
  const s = new Subject(g, text);
  const n = s.n;
  let out = "";
  let pos = 0;
  while (pos <= n) {
    const m = findIn(g, s, pos, true);
    if (!m) break;
    out += text.slice(pos, m.start) + replacement;
    if (m.end > m.start) pos = m.end;
    else {
      // An empty match (a pattern of stars only on empty text): keep one character and go on.
      if (m.start >= n) {
        pos = n;
        break;
      }
      out += text[m.start];
      pos = m.start + 1;
    }
    if (pos >= n) break;
  }
  return out + text.slice(pos);
}
