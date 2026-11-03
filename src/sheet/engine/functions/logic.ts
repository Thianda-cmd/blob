// Logik: WENN, WENNS, UND, ODER, NICHT, XODER, WENNFEHLER, WENNNV, ERSTERWERT, WAHR, FALSCH.
// WENN and friends only evaluate the branch they need (like Excel), and work element by element
// on arrays inside SUMMENPRODUKT and the like.

import type { Node } from "../parser";
import { compareValues, ERR, isErr, isMatrix, type CellError, type Scalar, type Value } from "../values";
import type { Ctx, FnDef } from "./types";
import { broadcast, eachValue, first, toBool, valueOf } from "./util";

/** An argument that was left empty (WENN(A1;;1)) counts as 0. */
const branch = (nodes: Node[], i: number, ctx: Ctx, missing: Value): Value => {
  if (i >= nodes.length) return missing;
  const n = nodes[i];
  return n.t === "miss" ? 0 : ctx.ev(n);
};

function logical(args: Value[], ctx: Ctx, combine: (vals: boolean[]) => boolean): Value {
  const vals: boolean[] = [];
  let err: CellError | null = null;
  eachValue(args, ctx, (v, inRange) => {
    if (isErr(v)) {
      err = v;
      return false;
    }
    if (typeof v === "boolean") vals.push(v);
    else if (typeof v === "number") vals.push(v !== 0);
    else if (!inRange) {
      if (v === null) vals.push(false);
      else {
        const b = toBool(v, ctx);
        if (isErr(b)) {
          err = b;
          return false;
        }
        vals.push(b);
      }
    }
  });
  if (err) return err;
  if (!vals.length) return ERR.value;
  return combine(vals);
}

export const LOGIC: FnDef[] = [
  {
    name: "IF",
    min: 2,
    max: 3,
    args: "s",
    lazy: (nodes, ctx) => {
      const c = valueOf(ctx.ev(nodes[0]), ctx);
      if (isMatrix(c) && (c.length > 1 || c[0].length > 1)) {
        const t = valueOf(branch(nodes, 1, ctx, false), ctx);
        const f = valueOf(branch(nodes, 2, ctx, false), ctx);
        return broadcast([c, t, f], ([cv, tv, fv]) => {
          if (isErr(cv)) return cv;
          const b = toBool(cv, ctx);
          if (isErr(b)) return b;
          return b ? tv : fv;
        });
      }
      const cv = first(c);
      if (isErr(cv)) return cv;
      const b = toBool(cv, ctx);
      if (isErr(b)) return b;
      return b ? branch(nodes, 1, ctx, false) : branch(nodes, 2, ctx, false);
    },
  },
  {
    name: "IFS",
    min: 2,
    max: 254,
    args: "s",
    lazy: (nodes, ctx) => {
      for (let i = 0; i + 1 < nodes.length; i += 2) {
        const cv = first(valueOf(ctx.ev(nodes[i]), ctx));
        if (isErr(cv)) return cv;
        const b = toBool(cv, ctx);
        if (isErr(b)) return b;
        if (b) return branch(nodes, i + 1, ctx, 0);
      }
      return { error: "#N/A", detail: "no-match" };
    },
  },
  {
    name: "IFERROR",
    min: 2,
    max: 2,
    args: "s",
    lazy: (nodes, ctx) => {
      const v = valueOf(ctx.ev(nodes[0]), ctx);
      if (isMatrix(v)) {
        if (!v.some((row) => row.some((x) => isErr(x)))) return v;
        const alt = valueOf(branch(nodes, 1, ctx, 0), ctx);
        return broadcast([v, alt], ([x, a]) => (isErr(x) ? a : x));
      }
      return isErr(v) ? branch(nodes, 1, ctx, 0) : v;
    },
  },
  {
    name: "IFNA",
    min: 2,
    max: 2,
    args: "s",
    lazy: (nodes, ctx) => {
      const isNa = (x: Scalar) => isErr(x) && x.error === "#N/A";
      const v = valueOf(ctx.ev(nodes[0]), ctx);
      if (isMatrix(v)) {
        if (!v.some((row) => row.some(isNa))) return v;
        const alt = valueOf(branch(nodes, 1, ctx, 0), ctx);
        return broadcast([v, alt], ([x, a]) => (isNa(x) ? a : x));
      }
      return isNa(v) ? branch(nodes, 1, ctx, 0) : v;
    },
  },
  {
    name: "SWITCH",
    min: 3,
    max: 254,
    args: "s",
    lazy: (nodes, ctx) => {
      const x = first(valueOf(ctx.ev(nodes[0]), ctx));
      if (isErr(x)) return x;
      let i = 1;
      for (; i + 1 < nodes.length; i += 2) {
        const v = first(valueOf(nodes[i].t === "miss" ? null : ctx.ev(nodes[i]), ctx));
        if (isErr(v)) return v;
        const sameKind = typeof v === typeof x || v === null || x === null;
        if (sameKind && compareValues(x, v) === 0) return branch(nodes, i + 1, ctx, 0);
      }
      if (i < nodes.length) return branch(nodes, i, ctx, 0);
      return { error: "#N/A", detail: "no-match" };
    },
  },
  { name: "AND", min: 1, max: 255, args: "r", impl: (args, ctx) => logical(args, ctx, (vals) => vals.every(Boolean)) },
  { name: "OR", min: 1, max: 255, args: "r", impl: (args, ctx) => logical(args, ctx, (vals) => vals.some(Boolean)) },
  { name: "XOR", min: 1, max: 255, args: "r", impl: (args, ctx) => logical(args, ctx, (vals) => vals.filter(Boolean).length % 2 === 1) },
  {
    name: "NOT",
    min: 1,
    max: 1,
    args: "s",
    impl: ([v], ctx) => {
      const b = toBool(v as Scalar, ctx);
      return isErr(b) ? b : !b;
    },
  },
  { name: "TRUE", min: 0, max: 0, args: "s", impl: () => true },
  { name: "FALSE", min: 0, max: 0, args: "s", impl: () => false },
];
