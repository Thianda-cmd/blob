// Splitting a formula into tokens. Works on the canonical form (English names, "," separators,
// "." decimals) and on what people type in German or English; never throws, so unfinished input
// ("SUMME(A1:A", "=WENN(") still gives tokens for colouring and suggestions. Every token keeps
// its position, and joining the tokens' text gives back the input exactly.

import type { Locale } from "@/i18n/config";
import { FUNCTION_BY_DE, FUNCTION_BY_EN } from "./names";
import { errorSpellings, type ErrorCode } from "./values";

/** "canonical" = stored form; "de"/"en" = typed in that language. */
export type LexMode = "canonical" | Locale;

/** Excel's grid: references beyond it aren't references (they would be names). */
export const EXCEL_MAX_ROWS = 1048576;
export const EXCEL_MAX_COLS = 16384;

export type RefInfo = {
  /** Sheet name as written (without quotes), or null for the formula's own sheet. */
  sheet: string | null;
  /** cell: A1; range: A1:B5; cols: A:C; rows: 1:3. */
  kind: "cell" | "range" | "cols" | "rows";
  /** 0-based corners as written (not normalised: B5:A1 stays). For cols, rows are 0…max; for rows, cols are 0…max. */
  r0: number;
  c0: number;
  r1: number;
  c1: number;
  /** $ before each part. */
  ar0: boolean;
  ac0: boolean;
  ar1: boolean;
  ac1: boolean;
};

export type TokKind =
  | "num"
  | "str"
  | "bool"
  | "err"
  | "ref"
  | "fn"
  | "name"
  | "op"
  | "lp"
  | "rp"
  | "lb"
  | "rb"
  /** "," ";" and, inside { } in German, "." or "\": what they separate is up to the parser. */
  | "sep"
  | "ws"
  | "bad";

export type Tok = {
  k: TokKind;
  text: string;
  start: number;
  end: number;
  /** num */
  num?: number;
  /** str: the text without quotes; closed: whether the closing quote is there. */
  str?: string;
  closed?: boolean;
  bool?: boolean;
  err?: ErrorCode;
  ref?: RefInfo;
  /** fn: canonical (English) name when known; name/fn: the name as typed, upper case. */
  fn?: string | null;
  upper?: string;
  /** Inside { } (array constant). */
  inBrace?: boolean;
  /** err: the sheet written before it ("Blatt1!#REF!"). */
  sheet?: string | null;
  /** bad: a German number with "." that could be thousands ("1.000"). */
  ambiguous?: boolean;
};

const ID_START = /[A-Za-z_\u00C0-\u024F]/;
const SHEET_RE = /([A-Za-z_\u00C0-\u024F][A-Za-z0-9_.\u00C0-\u024F]*)!/y;
const WS_RE = /[ \t\r\n\u00A0\u202F]+/y;
const ID_RE = /[A-Za-z_\u00C0-\u024F][A-Za-z0-9_.\u00C0-\u024F]*/y;

const isNameCode = (c: number) =>
  (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 95 || c === 46 || (c >= 0xc0 && c <= 0x24f);

/** Is the character at i part of a name (so a reference before it isn't one: "LOG10(", "A1B")? */
const continuesName = (text: string, i: number) => {
  if (i >= text.length) return false;
  const c = text.charCodeAt(i);
  return c === 40 || isNameCode(c);
};

const validCol = (c: number) => c >= 0 && c < EXCEL_MAX_COLS;
const validRow = (r: number) => r >= 0 && r < EXCEL_MAX_ROWS;

/** Letters of a column (1–3, any case) at i: the 0-based column and where it ends; null when there are none. */
function scanLetters(text: string, i: number): { c: number; end: number } | null {
  let j = i;
  let col = 0;
  while (j < text.length && j - i < 4) {
    const up = text.charCodeAt(j) & ~32;
    if (up >= 65 && up <= 90 && text.charCodeAt(j) < 123) {
      col = col * 26 + (up - 64);
      j++;
    } else break;
  }
  const n = j - i;
  return n >= 1 && n <= 3 ? { c: col - 1, end: j } : null;
}

/** Digits of a row (1–7) at i: the 0-based row and where it ends. */
function scanDigits(text: string, i: number): { r: number; end: number } | null {
  let j = i;
  let row = 0;
  while (j < text.length) {
    const ch = text.charCodeAt(j);
    if (ch < 48 || ch > 57) break;
    row = row * 10 + (ch - 48);
    j++;
    if (j - i > 7) return null;
  }
  return j > i ? { r: row - 1, end: j } : null;
}

/** [$]A[$]1 at i. */
function scanCell(text: string, i: number): { c: number; r: number; ac: boolean; ar: boolean; end: number } | null {
  let j = i;
  const ac = text.charCodeAt(j) === 36;
  if (ac) j++;
  const l = scanLetters(text, j);
  if (!l) return null;
  j = l.end;
  const ar = text.charCodeAt(j) === 36;
  if (ar) j++;
  const d = scanDigits(text, j);
  if (!d) return null;
  return { c: l.c, r: d.r, ac, ar, end: d.end };
}

/** A reference starting at i (after an optional sheet prefix): the RefInfo and where it ends. */
function matchRef(text: string, i: number, sheet: string | null): { ref: RefInfo; end: number } | null {
  const a = scanCell(text, i);
  if (a) {
    if (text.charCodeAt(a.end) === 58) {
      const b = scanCell(text, a.end + 1);
      if (b && !continuesName(text, b.end) && validCol(a.c) && validCol(b.c) && validRow(a.r) && validRow(b.r))
        return { ref: { sheet, kind: "range", r0: a.r, c0: a.c, r1: b.r, c1: b.c, ac0: a.ac, ar0: a.ar, ac1: b.ac, ar1: b.ar }, end: b.end };
    }
    if (!continuesName(text, a.end) && text.charCodeAt(a.end) !== 33 && validCol(a.c) && validRow(a.r))
      return { ref: { sheet, kind: "cell", r0: a.r, c0: a.c, r1: a.r, c1: a.c, ac0: a.ac, ar0: a.ar, ac1: a.ac, ar1: a.ar }, end: a.end };
    return null;
  }
  // Whole columns A:C
  let j = i;
  const ac0 = text.charCodeAt(j) === 36;
  if (ac0) j++;
  const l0 = scanLetters(text, j);
  if (l0 && text.charCodeAt(l0.end) === 58) {
    let k = l0.end + 1;
    const ac1 = text.charCodeAt(k) === 36;
    if (ac1) k++;
    const l1 = scanLetters(text, k);
    if (l1 && !continuesName(text, l1.end) && validCol(l0.c) && validCol(l1.c))
      return { ref: { sheet, kind: "cols", r0: 0, c0: l0.c, r1: EXCEL_MAX_ROWS - 1, c1: l1.c, ac0, ar0: false, ac1, ar1: false }, end: l1.end };
    return null;
  }
  // Whole rows 1:3
  j = i;
  const ar0 = text.charCodeAt(j) === 36;
  if (ar0) j++;
  const d0 = scanDigits(text, j);
  if (d0 && text.charCodeAt(d0.end) === 58) {
    let k = d0.end + 1;
    const ar1 = text.charCodeAt(k) === 36;
    if (ar1) k++;
    const d1 = scanDigits(text, k);
    if (d1 && !continuesName(text, d1.end) && !/[0-9.,]/.test(text[d1.end] ?? "") && validRow(d0.r) && validRow(d1.r))
      return { ref: { sheet, kind: "rows", r0: d0.r, c0: 0, r1: d1.r, c1: EXCEL_MAX_COLS - 1, ar0, ac0: false, ar1, ac1: false }, end: d1.end };
  }
  return null;
}

/** The canonical name of a function as typed: German names count in German (and English names everywhere). */
export function functionFromName(upper0: string, mode: LexMode): string | null {
  // Excel files write newer functions with a prefix (_xlfn.STDEV.S, _xlfn.XLOOKUP).
  const upper = upper0.startsWith("_XL") ? upper0.replace(/^_XL(FN|WS|UDF)\./, "") : upper0;
  const en = FUNCTION_BY_EN.get(upper);
  if (mode === "de") {
    const de = FUNCTION_BY_DE.get(upper);
    if (de) return de.en;
  }
  return en ? en.en : null;
}

const spellingCache = new Map<boolean, { text: string; code: ErrorCode }[]>();
function spellings(german: boolean) {
  let s = spellingCache.get(german);
  if (!s) spellingCache.set(german, (s = errorSpellings(german)));
  return s;
}

function matchError(text: string, i: number, mode: LexMode): { code: ErrorCode; end: number } | null {
  const rest = text.slice(i, i + 8).toUpperCase();
  for (const sp of spellings(mode === "de")) if (rest.startsWith(sp.text)) return { code: sp.code, end: i + sp.text.length };
  return null;
}

const NUM_DOT = /(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?/y;
const NUM_COMMA = /(?:[0-9]+(?:,[0-9]+)?|,[0-9]+)(?:[eE][+-]?[0-9]+)?/y;
/** A "." decimal point typed in German (forgiving); "1.000" with exactly three digits could be thousands and is refused. */
const NUM_DE_DOT = /[0-9]+\.[0-9]+(?:\.[0-9]+)*(?:,[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;

/** Split a formula (without "=") into tokens. */
export function lex(text: string, mode: LexMode): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let braces = 0;
  const n = text.length;
  const lastSignificant = () => {
    for (let k = toks.length - 1; k >= 0; k--) if (toks[k].k !== "ws") return toks[k];
    return null;
  };
  /** Does the next token start an operand (after "(", ",", an operator or the start)? */
  const expectsOperand = () => {
    const t = lastSignificant();
    if (!t) return true;
    if (t.k === "lp" || t.k === "lb" || t.k === "sep") return true;
    if (t.k === "op") return t.text !== "%";
    return false;
  };
  const push = (t: Tok) => {
    if (braces > 0) t.inBrace = true;
    toks.push(t);
  };

  while (i < n) {
    const ch = text[i];
    // Whitespace
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === " " || ch === " ") {
      WS_RE.lastIndex = i;
      WS_RE.exec(text);
      const end = WS_RE.lastIndex;
      push({ k: "ws", text: text.slice(i, end), start: i, end });
      i = end;
      continue;
    }
    // Text in quotes ("" is a quote inside)
    if (ch === '"') {
      let j = i + 1;
      let s = "";
      let closed = false;
      while (j < n) {
        if (text[j] === '"') {
          if (text[j + 1] === '"') {
            s += '"';
            j += 2;
            continue;
          }
          closed = true;
          j++;
          break;
        }
        s += text[j];
        j++;
      }
      push({ k: "str", text: text.slice(i, j), start: i, end: j, str: s, closed });
      i = j;
      continue;
    }
    // 'Sheet name'!A1
    if (ch === "'") {
      let j = i + 1;
      let name = "";
      let closed = false;
      while (j < n) {
        if (text[j] === "'") {
          if (text[j + 1] === "'") {
            name += "'";
            j += 2;
            continue;
          }
          closed = true;
          j++;
          break;
        }
        name += text[j];
        j++;
      }
      if (closed && text[j] === "!") {
        const r = matchRef(text, j + 1, name);
        if (r) {
          push({ k: "ref", text: text.slice(i, r.end), start: i, end: r.end, ref: r.ref });
          i = r.end;
          continue;
        }
        const e = text[j + 1] === "#" ? matchError(text, j + 1, mode) : null;
        if (e && e.code === "#REF!") {
          push({ k: "err", text: text.slice(i, e.end), start: i, end: e.end, err: e.code, sheet: name });
          i = e.end;
          continue;
        }
        push({ k: "bad", text: text.slice(i, j + 1), start: i, end: j + 1 });
        i = j + 1;
        continue;
      }
      push({ k: "bad", text: text.slice(i, j), start: i, end: j });
      i = j;
      continue;
    }
    // Errors: #DIV/0!, #NV…
    if (ch === "#") {
      const e = matchError(text, i, mode);
      if (e) {
        push({ k: "err", text: text.slice(i, e.end), start: i, end: e.end, err: e.code });
        i = e.end;
        continue;
      }
      push({ k: "bad", text: ch, start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === "(" || ch === ")") {
      push({ k: ch === "(" ? "lp" : "rp", text: ch, start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === "{") {
      push({ k: "lb", text: ch, start: i, end: i + 1 });
      braces++;
      i++;
      continue;
    }
    if (ch === "}") {
      braces = Math.max(0, braces - 1);
      toks.push({ k: "rb", text: ch, start: i, end: i + 1 });
      i++;
      continue;
    }
    // Numbers (and whole rows 1:3)
    const isDigit = ch >= "0" && ch <= "9";
    const decimalStart =
      (mode !== "de" && ch === "." && /[0-9]/.test(text[i + 1] ?? "") && expectsOperand()) || (mode === "de" && ch === "," && /[0-9]/.test(text[i + 1] ?? "") && expectsOperand());
    if (isDigit || decimalStart || (ch === "$" && /[0-9]/.test(text[i + 1] ?? ""))) {
      if (isDigit || ch === "$") {
        const r = matchRef(text, i, null);
        if (r && r.ref.kind === "rows") {
          push({ k: "ref", text: text.slice(i, r.end), start: i, end: r.end, ref: r.ref });
          i = r.end;
          continue;
        }
      }
      if (ch !== "$") {
        let end = -1;
        if (mode === "de" && braces === 0) {
          NUM_DE_DOT.lastIndex = i;
          if (NUM_DE_DOT.exec(text)) end = NUM_DE_DOT.lastIndex;
        }
        if (end < 0) {
          const re = mode === "de" ? NUM_COMMA : NUM_DOT;
          re.lastIndex = i;
          if (re.exec(text)) end = re.lastIndex;
        }
        if (end > i) {
          const raw = text.slice(i, end);
          if (mode === "de" && raw.includes(".")) {
            // 1.5 means 1,5; but 1.000 or 1.234,5 are thousands, which formulas don't take: say so.
            const m = /^([0-9]+)\.([0-9]+)([eE][+-]?[0-9]+)?$/.exec(raw);
            if (!m || m[2].length === 3) {
              push({ k: "bad", text: raw, start: i, end, ambiguous: true });
              i = end;
              continue;
            }
          }
          push({ k: "num", text: raw, start: i, end, num: Number(raw.replace(",", ".")) });
          i = end;
          continue;
        }
      }
    }
    // Separators
    if (ch === "," || ch === ";") {
      push({ k: "sep", text: ch, start: i, end: i + 1 });
      i++;
      continue;
    }
    if (braces > 0 && mode === "de" && (ch === "." || ch === "\\")) {
      push({ k: "sep", text: ch, start: i, end: i + 1 });
      i++;
      continue;
    }
    // Operators
    const two = text.slice(i, i + 2);
    if (two === "<>" || two === "<=" || two === ">=") {
      push({ k: "op", text: two, start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if ("+-*/^&=<>%:".includes(ch)) {
      push({ k: "op", text: ch, start: i, end: i + 1 });
      i++;
      continue;
    }
    // Names, functions, references, TRUE/FALSE, Sheet!A1
    if (ID_START.test(ch) || ch === "$") {
      if (ch !== "$") {
        SHEET_RE.lastIndex = i;
        const sm = SHEET_RE.exec(text);
        if (sm) {
          const after = SHEET_RE.lastIndex;
          const r = matchRef(text, after, sm[1]);
          if (r) {
            push({ k: "ref", text: text.slice(i, r.end), start: i, end: r.end, ref: r.ref });
            i = r.end;
            continue;
          }
          const e = text[after] === "#" ? matchError(text, after, mode) : null;
          if (e && e.code === "#REF!") {
            push({ k: "err", text: text.slice(i, e.end), start: i, end: e.end, err: e.code, sheet: sm[1] });
            i = e.end;
            continue;
          }
        }
      }
      const r = matchRef(text, i, null);
      if (r) {
        push({ k: "ref", text: text.slice(i, r.end), start: i, end: r.end, ref: r.ref });
        i = r.end;
        continue;
      }
      if (ch === "$") {
        push({ k: "bad", text: ch, start: i, end: i + 1 });
        i++;
        continue;
      }
      ID_RE.lastIndex = i;
      ID_RE.exec(text);
      let end = ID_RE.lastIndex;
      // "Sheet!" with nothing usable after it: one unknown token (still being typed).
      if (text[end] === "!") {
        push({ k: "bad", text: text.slice(i, end + 1), start: i, end: end + 1 });
        i = end + 1;
        continue;
      }
      // A trailing "." belongs to the name only inside it ("T.TEST"), not at the end ("SUMME.")
      while (end > i + 1 && text[end - 1] === "." && text[end] !== "(") end--;
      const word = text.slice(i, end);
      const upper = word.toUpperCase();
      if (text[end] === "(") {
        push({ k: "fn", text: word, start: i, end, fn: functionFromName(upper, mode), upper });
      } else if (upper === "TRUE" || upper === "FALSE" || (mode === "de" && (upper === "WAHR" || upper === "FALSCH"))) {
        push({ k: "bool", text: word, start: i, end, bool: upper === "TRUE" || upper === "WAHR" });
      } else {
        push({ k: "name", text: word, start: i, end, upper });
      }
      i = end;
      continue;
    }
    push({ k: "bad", text: ch, start: i, end: i + 1 });
    i++;
  }
  return toks;
}
