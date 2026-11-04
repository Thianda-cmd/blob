// Information: ISTLEER, ISTZAHL, ISTTEXT, ISTKTEXT, ISTFEHLER, ISTFEHL, ISTNV, ISTLOG, ISTGERADE,
// ISTUNGERADE, ISTFORMEL, NV.

import { ERR, isErr, isRef, type Scalar } from "../values";
import type { FnDef } from "./types";
import { toNum } from "./util";

const is = (name: string, test: (v: Scalar) => boolean): FnDef => ({ name, min: 1, max: 1, args: "s", takesErrors: true, impl: ([v]) => test(v as Scalar) });

export const INFO: FnDef[] = [
  is("ISBLANK", (v) => v === null),
  is("ISNUMBER", (v) => typeof v === "number"),
  is("ISTEXT", (v) => typeof v === "string"),
  // Empty cells, true/false and errors aren't text either.
  is("ISNONTEXT", (v) => typeof v !== "string"),
  is("ISERROR", (v) => isErr(v)),
  // Every error but #N/A.
  is("ISERR", (v) => isErr(v) && v.error !== "#N/A"),
  is("ISNA", (v) => isErr(v) && v.error === "#N/A"),
  is("ISLOGICAL", (v) => typeof v === "boolean"),
  {
    name: "ISEVEN",
    min: 1,
    max: 1,
    args: "s",
    impl: ([v], ctx) => {
      if (typeof v === "boolean") return ERR.value;
      const n = toNum(v as Scalar, ctx);
      return typeof n === "number" ? Math.trunc(n) % 2 === 0 : n;
    },
  },
  {
    name: "ISODD",
    min: 1,
    max: 1,
    args: "s",
    impl: ([v], ctx) => {
      if (typeof v === "boolean") return ERR.value;
      const n = toNum(v as Scalar, ctx);
      return typeof n === "number" ? Math.abs(Math.trunc(n) % 2) === 1 : n;
    },
  },
  {
    name: "ISFORMULA",
    min: 1,
    max: 1,
    args: "r",
    impl: ([r], ctx) => (isRef(r) ? ctx.formula(r.sheet, r.r0, r.c0) !== undefined : ERR.value),
  },
  { name: "NA", min: 0, max: 0, args: "s", impl: () => ERR.na },
];
