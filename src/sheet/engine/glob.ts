// Excel's wildcards without regular expressions: * any text, ? one character, ~ before * ? or ~
// for the sign itself. Used by the criteria of ZÄHLENWENN & Co., the lookups (VERGLEICH,
// SVERWEIS…), SUCHEN, the text filters of smart tables and find & replace.
//
// A RegExp with many stars ("*a*a*a*a*a*a*a*b") backtracks: every extra star multiplies the time,
// and a short formula from an imported file could freeze the sheet for minutes on every open. Here
// a pattern is split at its stars, and each piece between them is looked for once, left to right
// (taking the leftmost place for each piece is always right for * and ?). Each piece is found with
// a bit-parallel scan (Shift-And), so matching takes about (length of the text) × (length of the
// pattern ÷ 32) steps at worst, and just the length of the text for everyday patterns.

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
  /** For each code in the piece: the positions (bits) where it or a "?" fits. */
  masks: Map<number, Uint32Array>;
  /** The positions of the "?". */
  any: Uint32Array;
};

/** A compiled pattern: the pieces between its stars (one piece: no star at all). */
export type Glob = { pieces: Piece[]; unicode: boolean; fold: (code: number) => number };

const ANY = -1;

function piece(items: number[]): Piece {
  const words = Math.max(1, (items.length + 31) >>> 5);
  const any = new Uint32Array(words);
  const masks = new Map<number, Uint32Array>();
  items.forEach((c, j) => {
    if (c === ANY) any[j >>> 5] |= 1 << (j & 31);
  });
  items.forEach((c, j) => {
    if (c === ANY) return;
    let mask = masks.get(c);
    if (!mask) masks.set(c, (mask = any.slice()));
    mask[j >>> 5] |= 1 << (j & 31);
  });
  return { items, masks, any };
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
  if (cache.size > 2000) cache.clear();
  cache.set(key, glob);
  return glob;
}

/** The text as folded character codes (code points with `unicode`). */
function codesOf(g: Glob, text: string): number[] {
  const out: number[] = [];
  if (g.unicode) for (const ch of text) out.push(g.fold(ch.codePointAt(0)!));
  else for (let i = 0; i < text.length; i++) out.push(g.fold(text.charCodeAt(i)));
  return out;
}

function fitsAt(p: Piece, codes: number[], at: number): boolean {
  const items = p.items;
  if (at < 0 || at + items.length > codes.length) return false;
  for (let j = 0; j < items.length; j++) if (items[j] !== ANY && items[j] !== codes[at + j]) return false;
  return true;
}

/**
 * Where a piece fits in codes[from, to): the leftmost start, or with `last` the rightmost; -1 when
 * nowhere. Shift-And: bit j of the state says "the last j + 1 characters fit the piece's start".
 */
function find(p: Piece, codes: number[], from: number, to: number, last: boolean): number {
  const m = p.items.length;
  if (m === 0) return last ? to : from <= to ? from : -1;
  if (to - from < m) return -1;
  const words = p.any.length;
  const state = new Uint32Array(words);
  const top = (m - 1) >>> 5;
  const bit = 1 << ((m - 1) & 31);
  let found = -1;
  for (let i = from; i < to; i++) {
    const mask = p.masks.get(codes[i]) ?? p.any;
    let carry = 1;
    for (let w = 0; w < words; w++) {
      const s = state[w];
      state[w] = ((s << 1) | carry) & mask[w];
      carry = s >>> 31;
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
  const codes = codesOf(g, text);
  const n = codes.length;
  const ps = g.pieces;
  const anchorStart = within === "whole" || within === "begins";
  const anchorEnd = within === "whole" || within === "ends";
  if (ps.length === 1 && anchorStart && anchorEnd) return n === ps[0].items.length && fitsAt(ps[0], codes, 0);
  let lo = 0;
  let hi = n;
  let i0 = 0;
  let i1 = ps.length - 1;
  if (anchorStart) {
    if (!fitsAt(ps[0], codes, 0)) return false;
    lo = ps[0].items.length;
    i0 = 1;
  }
  if (anchorEnd) {
    const end = ps[i1];
    if (end.items.length > hi - lo || !fitsAt(end, codes, n - end.items.length)) return false;
    hi = n - end.items.length;
    i1--;
  }
  for (let i = i0; i <= i1; i++) {
    const at = find(ps[i], codes, lo, hi, false);
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
  return findIn(g, codesOf(g, text), from);
}

function findIn(g: Glob, codes: number[], from: number): { start: number; end: number } | null {
  const n = codes.length;
  const ps = g.pieces;
  // The leftmost place of the first piece is the start whenever there is a match at all: a later
  // start leaves less room for the rest.
  const start = find(ps[0], codes, from, n, false);
  if (start < 0) return null;
  if (ps.length === 1) return { start, end: start + ps[0].items.length };
  let lo = start + ps[0].items.length;
  for (let i = 1; i < ps.length - 1; i++) {
    const at = find(ps[i], codes, lo, n, false);
    if (at < 0) return null;
    lo = at + ps[i].items.length;
  }
  const end = ps[ps.length - 1];
  const at = find(end, codes, lo, n, true);
  return at < 0 ? null : { start, end: at + end.items.length };
}

/** Every match replaced, left to right, without overlaps (find & replace); only for patterns without `unicode`. */
export function globReplace(g: Glob, text: string, replacement: string): string {
  const codes = codesOf(g, text);
  const n = codes.length;
  let out = "";
  let pos = 0;
  while (pos <= n) {
    const m = findIn(g, codes, pos);
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
