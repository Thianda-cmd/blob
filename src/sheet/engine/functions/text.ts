// Text: TEXTKETTE, VERKETTEN, TEXTVERKETTEN, LINKS, RECHTS, TEIL, LÄNGE, GROSS, KLEIN, GROSS2,
// GLÄTTEN, TEXT, WERT, FINDEN, SUCHEN, WECHSELN, ERSETZEN, WIEDERHOLEN, IDENTISCH, FEST, ZEICHEN, CODE.

import { wildcardRegex } from "../criteria";
import { formatFixed, formatWithCode } from "../format";
import { textToNumber } from "../parse";
import { ERR, isErr, mkErr, type CellError, type Scalar, type Value } from "../values";
import { roundExcel } from "./math";
import type { Ctx, FnDef } from "./types";
import { eachValue, toBool, toNum, toStr } from "./util";

const MAX_TEXT = 32767;
const tooLong = (s: string): string | CellError => (s.length > MAX_TEXT ? mkErr("#VALUE!", "too-long") : s);

/** A function of text and number arguments, each lifted over arrays. */
function textFn(name: string, min: number, max: number, kinds: string, f: (a: (string | number | boolean | null)[], ctx: Ctx) => Scalar): FnDef {
  return {
    name,
    min,
    max,
    args: "s",
    impl: (args, ctx) => {
      const vals: (string | number | boolean | null)[] = [];
      for (let i = 0; i < args.length; i++) {
        const k = kinds[Math.min(i, kinds.length - 1)];
        const a = args[i] as Scalar;
        if (k === "t") {
          const s = toStr(a, ctx);
          if (typeof s !== "string") return s;
          vals.push(s);
        } else if (k === "n") {
          const n = toNum(a, ctx);
          if (typeof n !== "number") return n;
          vals.push(n);
        } else if (k === "b") {
          const b = toBool(a, ctx);
          if (isErr(b)) return b;
          vals.push(b);
        } else vals.push(a as string | number | boolean | null);
      }
      return f(vals, ctx);
    },
  };
}

/** Windows-1252 for CHAR/CODE (what Excel on Windows uses for 128–159). */
const CP1252: Record<number, string> = {
  128: "€", 130: "‚", 131: "ƒ", 132: "„", 133: "…", 134: "†", 135: "‡", 136: "ˆ", 137: "‰", 138: "Š", 139: "‹", 140: "Œ", 142: "Ž",
  145: "‘", 146: "’", 147: "“", 148: "”", 149: "•", 150: "–", 151: "—", 152: "˜", 153: "™", 154: "š", 155: "›", 156: "œ", 158: "ž", 159: "Ÿ",
};
const CP1252_REVERSE = new Map(Object.entries(CP1252).map(([k, v]) => [v, Number(k)]));

/** UPPER without turning ß into SS (Excel keeps it). */
const upper = (s: string) => s.split("ß").map((p) => p.toUpperCase()).join("ß");

const isLetter = (ch: string) => /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/.test(ch);

function proper(s: string): string {
  let out = "";
  let prevLetter = false;
  for (const ch of s) {
    const letter = isLetter(ch);
    out += letter ? (prevLetter ? ch.toLowerCase() : ch.toUpperCase()) : ch;
    prevLetter = letter;
  }
  return out;
}

export const TEXT_FNS: FnDef[] = [
  {
    name: "CONCAT",
    min: 1,
    max: 255,
    args: "r",
    impl: (args, ctx) => {
      let out = "";
      let err: CellError | null = null;
      eachValue(args, ctx, (v) => {
        const s = toStr(v, ctx);
        if (typeof s !== "string") {
          err = s;
          return false;
        }
        out += s;
      });
      return err ?? tooLong(out);
    },
  },
  textFn("CONCATENATE", 1, 255, "t", (a) => tooLong(a.join(""))),
  {
    name: "TEXTJOIN",
    min: 3,
    max: 255,
    args: "ssr",
    impl: (args, ctx) => {
      const delim = toStr(args[0] as Scalar, ctx);
      if (typeof delim !== "string") return delim;
      const ignore = toBool(args[1] as Scalar, ctx);
      if (isErr(ignore)) return ignore;
      const parts: string[] = [];
      let err: CellError | null = null;
      eachValue(args.slice(2), ctx, (v) => {
        const s = toStr(v, ctx);
        if (typeof s !== "string") {
          err = s;
          return false;
        }
        if (ignore && s === "") return;
        parts.push(s);
      });
      return err ?? tooLong(parts.join(delim));
    },
  },
  textFn("LEFT", 1, 2, "tn", ([s, n]) => {
    const k = n === undefined ? 1 : Math.trunc(n as number);
    return k < 0 ? ERR.value : (s as string).slice(0, k);
  }),
  textFn("RIGHT", 1, 2, "tn", ([s, n]) => {
    const k = n === undefined ? 1 : Math.trunc(n as number);
    if (k < 0) return ERR.value;
    const str = s as string;
    return k === 0 ? "" : str.slice(Math.max(0, str.length - k));
  }),
  textFn("MID", 3, 3, "tnn", ([s, st, n]) => {
    const start = Math.trunc(st as number);
    const k = Math.trunc(n as number);
    if (start < 1 || k < 0) return ERR.value;
    return (s as string).substr(start - 1, k);
  }),
  textFn("LEN", 1, 1, "t", ([s]) => (s as string).length),
  textFn("UPPER", 1, 1, "t", ([s]) => upper(s as string)),
  textFn("LOWER", 1, 1, "t", ([s]) => (s as string).toLowerCase()),
  textFn("PROPER", 1, 1, "t", ([s]) => proper(s as string)),
  textFn("TRIM", 1, 1, "t", ([s]) => (s as string).replace(/^ +| +$/g, "").replace(/ {2,}/g, " ")),
  textFn("REPT", 2, 2, "tn", ([s, n]) => {
    const k = Math.trunc(n as number);
    if (k < 0) return ERR.value;
    if ((s as string).length * k > MAX_TEXT) return mkErr("#VALUE!", "too-long");
    return (s as string).repeat(k);
  }),
  textFn("EXACT", 2, 2, "t", ([a, b]) => a === b),
  textFn("FIND", 2, 3, "ttn", ([find, within, st]) => {
    const start = st === undefined ? 1 : Math.trunc(st as number);
    const w = within as string;
    if (start < 1 || start > w.length + 1) return ERR.value;
    const i = w.indexOf(find as string, start - 1);
    return i < 0 ? mkErr("#VALUE!", "not-found") : i + 1;
  }),
  textFn("SEARCH", 2, 3, "ttn", ([find, within, st]) => {
    const start = st === undefined ? 1 : Math.trunc(st as number);
    const w = within as string;
    if (start < 1 || start > w.length + 1) return ERR.value;
    const f = find as string;
    if (f === "") return start;
    // Wildcards: the shortest match starting at each position, first position wins.
    const re = wildcardRegex(f);
    const src = re.source.slice(1, -1);
    const lazy = new RegExp(src.replace(/\[\\s\\S\]\*/g, "[\\s\\S]*?"), "i");
    const m = lazy.exec(w.slice(start - 1));
    return m ? m.index + start : mkErr("#VALUE!", "not-found");
  }),
  textFn("SUBSTITUTE", 3, 4, "tttn", ([text, old, rep, inst]) => {
    const s = text as string;
    const o = old as string;
    const r = rep as string;
    if (o === "") return s;
    if (inst === undefined) return tooLong(s.split(o).join(r));
    const k = Math.trunc(inst as number);
    if (k < 1) return ERR.value;
    let idx = -1;
    for (let n = 0; n < k; n++) {
      idx = s.indexOf(o, idx + 1);
      if (idx < 0) return s;
    }
    return tooLong(s.slice(0, idx) + r + s.slice(idx + o.length));
  }),
  textFn("REPLACE", 4, 4, "tnnt", ([text, st, n, rep]) => {
    const start = Math.trunc(st as number);
    const k = Math.trunc(n as number);
    if (start < 1 || k < 0) return ERR.value;
    const s = text as string;
    return tooLong(s.slice(0, start - 1) + (rep as string) + s.slice(start - 1 + k));
  }),
  {
    name: "TEXT",
    min: 2,
    max: 2,
    args: "s",
    impl: ([v, f], ctx) => {
      const fmt = toStr(f as Scalar, ctx);
      if (typeof fmt !== "string") return fmt;
      let value = v as Scalar;
      if (typeof value === "string") {
        const n = textToNumber(value, ctx.locale);
        if (n !== null) value = n;
      }
      if (isErr(value)) return value;
      return formatWithCode(value as number | string | boolean | null, fmt, ctx.locale);
    },
  },
  {
    name: "VALUE",
    min: 1,
    max: 1,
    args: "s",
    impl: ([v], ctx) => {
      if (typeof v === "number") return v;
      if (v === null) return 0;
      if (typeof v === "boolean") return ERR.value;
      if (typeof v === "string") {
        const n = textToNumber(v, ctx.locale);
        return n === null ? mkErr("#VALUE!", "not-a-number") : n;
      }
      return v as Value;
    },
  },
  textFn("FIXED", 1, 3, "nnb", ([x, d, noCommas], ctx) => {
    const dec = d === undefined || d === null ? 2 : Math.trunc(d as number);
    if (dec > 127) return ERR.value;
    const rounded = roundExcel(x as number, dec, "half");
    return formatFixed(rounded, Math.max(0, dec), ctx.locale, !noCommas);
  }),
  textFn("CHAR", 1, 1, "n", ([n]) => {
    const k = Math.trunc(n as number);
    if (k < 1 || k > 255) return ERR.value;
    return CP1252[k] ?? String.fromCharCode(k);
  }),
  textFn("CODE", 1, 1, "t", ([s]) => {
    const str = s as string;
    if (!str) return ERR.value;
    const ch = str[0];
    const mapped = CP1252_REVERSE.get(ch);
    if (mapped !== undefined) return mapped;
    const c = ch.charCodeAt(0);
    return c < 256 ? c : 63;
  }),
];

