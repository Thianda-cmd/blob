"use client";

import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import type { Locale } from "@/i18n/config";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { smoothFracExits } from "../equations/level1";
import { choice, clean, dec, FormulaBoard, money, numberMistakes, type Opt } from "./kit";
import { RectangleLab, UndoMachine } from "./widgets1";

// ---------------------------------------------------------------------------
// Everyday formulas (Klasse 6–7). Each knows its letters, their units and which
// letters can be found in ONE step. Tokens are keyed by letter (la, lb, …), so a
// letter glides when it moves and turns into its value in place when we insert.

type Dim = "len" | "area" | "vol" | "time" | "dist" | "speed" | "money" | "count";
type LenUnit = "cm" | "m";
type Values = Record<string, number>;

type RHS =
  /** a · b, 4 · a, v · t (numbers stand in front) */
  | { op: "prod"; f: (string | number)[] }
  /** s : t */
  | { op: "quot"; n: string; d: string }
  /** a + b + c */
  | { op: "sum"; t: string[] }
  /** 2 · a + 2 · b */
  | { op: "perim" }
  /** a · a */
  | { op: "square" };

type F1 = {
  key: string;
  legend: Text;
  subject: string;
  rhs: RHS;
  /** Letters that can be found in one step. */
  solve: string[];
  dims: Record<string, Dim>;
};

const RECT_A: F1 = {
  key: "rectA",
  legend: tx("Area $A$ of a rectangle with the sides $a$ and $b$.", "Flächeninhalt $A$ eines Rechtecks mit den Seiten $a$ und $b$."),
  subject: "A",
  rhs: { op: "prod", f: ["a", "b"] },
  solve: ["a", "b"],
  dims: { A: "area", a: "len", b: "len" },
};
const RECT_U: F1 = {
  key: "rectU",
  legend: tx("Perimeter $u$ of a rectangle with the sides $a$ and $b$.", "Umfang $u$ eines Rechtecks mit den Seiten $a$ und $b$."),
  subject: "u",
  rhs: { op: "perim" },
  solve: [],
  dims: { u: "len", a: "len", b: "len" },
};
const SQ_A: F1 = {
  key: "sqA",
  legend: tx("Area $A$ of a square with the side $a$.", "Flächeninhalt $A$ eines Quadrats mit der Seite $a$."),
  subject: "A",
  rhs: { op: "square" },
  solve: [],
  dims: { A: "area", a: "len" },
};
const SQ_U: F1 = {
  key: "sqU",
  legend: tx("Perimeter $u$ of a square with the side $a$.", "Umfang $u$ eines Quadrats mit der Seite $a$."),
  subject: "u",
  rhs: { op: "prod", f: [4, "a"] },
  solve: ["a"],
  dims: { u: "len", a: "len" },
};
const SPEED: F1 = {
  key: "speed",
  legend: tx("Speed $v$: distance $s$ divided by time $t$.", "Geschwindigkeit $v$: Strecke $s$ geteilt durch Zeit $t$."),
  subject: "v",
  rhs: { op: "quot", n: "s", d: "t" },
  solve: ["s"],
  dims: { v: "speed", s: "dist", t: "time" },
};
const DIST: F1 = {
  key: "dist",
  legend: tx("Distance $s$ at the speed $v$ in the time $t$.", "Strecke $s$ bei der Geschwindigkeit $v$ in der Zeit $t$."),
  subject: "s",
  rhs: { op: "prod", f: ["v", "t"] },
  solve: ["v", "t"],
  dims: { s: "dist", v: "speed", t: "time" },
};
const PRICE: F1 = {
  key: "price",
  legend: tx("Total price $G$ for $n$ items at the price $p$ each.", "Gesamtpreis $G$ für $n$ Stück zum Stückpreis $p$."),
  subject: "G",
  rhs: { op: "prod", f: ["n", "p"] },
  solve: ["n", "p"],
  dims: { G: "money", n: "count", p: "money" },
};
const DIAM: F1 = {
  key: "diam",
  legend: tx("Diameter $d$ of a circle with the radius $r$.", "Durchmesser $d$ eines Kreises mit dem Radius $r$."),
  subject: "d",
  rhs: { op: "prod", f: [2, "r"] },
  solve: ["r"],
  dims: { d: "len", r: "len" },
};
const TRI_U: F1 = {
  key: "triU",
  legend: tx("Perimeter $u$ of a triangle with the sides $a$, $b$ and $c$.", "Umfang $u$ eines Dreiecks mit den Seiten $a$, $b$ und $c$."),
  subject: "u",
  rhs: { op: "sum", t: ["a", "b", "c"] },
  solve: ["c", "a"],
  dims: { u: "len", a: "len", b: "len", c: "len" },
};
const CUBOID: F1 = {
  key: "cuboid",
  legend: tx("Volume $V$ of a cuboid with the edges $a$, $b$ and $c$.", "Volumen $V$ eines Quaders mit den Kanten $a$, $b$ und $c$."),
  subject: "V",
  rhs: { op: "prod", f: ["a", "b", "c"] },
  solve: ["c"],
  dims: { V: "vol", a: "len", b: "len", c: "len" },
};

const ALL = [RECT_A, RECT_U, SQ_A, SQ_U, SPEED, DIST, PRICE, DIAM, TRI_U, CUBOID];
const SOLVABLE: [F1, string][] = ALL.flatMap((f) => f.solve.map((x) => [f, x] as [F1, string]));

// ---------------------------------------------------------------------------
// Units and numbers

function unitOf(dim: Dim, lu: LenUnit): string {
  switch (dim) {
    case "len":
      return lu;
    case "area":
      return `${lu}²`;
    case "vol":
      return `${lu}³`;
    case "time":
      return "h";
    case "dist":
      return "km";
    case "speed":
      return "km/h";
    case "money":
      return "€";
    case "count":
      return "";
  }
}

const fmt = (v: number, dim: Dim, l: Locale) => (dim === "money" ? money(v, l) : dec(v, l));

/** A value with its unit as display source, keyed like its letter: 6#la "cm"#ula. */
const valueSrc = (x: string, v: number, dim: Dim, lu: LenUnit, l: Locale, key = `l${x}`) => {
  const u = unitOf(dim, lu);
  return `${fmt(v, dim, l)}#${key}${u ? ` "${u}"#u${key}` : ""}`;
};

/** The same in a sentence: "$a = 6 "cm"$". */
const given = (x: string, v: number, dim: Dim, lu: LenUnit, l: Locale) => {
  const u = unitOf(dim, lu);
  return `$${x} = ${fmt(v, dim, l)}${u ? ` "${u}"` : ""}$`;
};

/** Every letter of the formula with a value: the inputs plus the subject worked out. */
function complete(f: F1, vals: Values): Values {
  const r = f.rhs;
  const v = (x: string | number) => (typeof x === "number" ? x : vals[x]);
  const s =
    r.op === "prod" ? r.f.reduce<number>((p, x) => p * v(x), 1) : r.op === "quot" ? vals[r.n] / vals[r.d] : r.op === "sum" ? r.t.reduce((p, x) => p + vals[x], 0) : r.op === "perim" ? 2 * vals.a + 2 * vals.b : vals.a * vals.a;
  return { ...vals, [f.subject]: clean(s) };
}

const SPEEDS = [15, 20, 25, 30, 40, 45, 50, 60, 70, 75, 80, 90, 100, 120];
const PRICES = [0.5, 0.8, 1.2, 1.25, 1.5, 2, 2.5, 3.5, 4, 4.5];

function pickValues(f: F1, rng: Rng): Values {
  switch (f.key) {
    case "rectA":
    case "rectU": {
      const a = rng.int(3, 15);
      const b = rng.int(2, 12);
      return complete(f, { a, b: b === a ? a - 1 : b });
    }
    case "sqA":
      return complete(f, { a: rng.int(2, 15) });
    case "sqU":
      return complete(f, { a: rng.int(2, 25) });
    case "speed": {
      const v = rng.pick(SPEEDS);
      const t = rng.int(2, 5);
      return complete(f, { s: v * t, t });
    }
    case "dist":
      return complete(f, { v: rng.pick(SPEEDS), t: rng.int(2, 5) });
    case "price":
      return complete(f, { n: rng.int(2, 9), p: rng.pick(PRICES) });
    case "diam":
      return complete(f, { r: rng.int(2, 15) });
    case "triU":
      for (;;) {
        const a = rng.int(3, 14);
        const b = rng.int(3, 14);
        const c = rng.int(3, 14);
        if (a + b > c && b + c > a && a + c > b && new Set([a, b, c]).size > 1) return complete(f, { a, b, c });
      }
    default:
      return complete(f, { a: rng.int(2, 9), b: rng.int(2, 9), c: rng.int(2, 9) });
  }
}

// ---------------------------------------------------------------------------
// Display sources

const L = (x: string, target?: string) => (x === target ? `\\blob{${x}#l${x}}` : `${x}#l${x}`);

/** The right-hand side, keyed. `val` replaces a letter by its value (keeping the key). */
function rhsSrc(r: RHS, target?: string, val?: (x: string, key: string) => string): string {
  const leaf = (x: string, key = `l${x}`) => (val ? val(x, key) : x === target ? `\\blob{${x}#${key}}` : `${x}#${key}`);
  switch (r.op) {
    case "prod":
      return r.f.map((x, i) => `${i ? ` \\cdot#o${i} ` : ""}${typeof x === "number" ? `${x}#c${i}` : leaf(x)}`).join("");
    case "quot":
      return `${leaf(r.n)} :#o1 ${leaf(r.d)}`;
    case "sum":
      return r.t.map((x, i) => `${i ? ` +#o${i} ` : ""}${leaf(x)}`).join("");
    case "perim":
      return `2#c1 \\cdot#o1 ${leaf("a")} +#o2 2#c2 \\cdot#o3 ${leaf("b")}`;
    case "square":
      return `${leaf("a", "la1")} \\cdot#o1 ${leaf("a", "la2")}`;
  }
}

/** Plain display (no keys): "A = a \cdot b". */
const formulaSrc = (f: F1, target?: string) => `${f.subject === target ? `\\blob{${f.subject}}` : f.subject} = ${rhsSrc(f.rhs, target).replace(/#[A-Za-z0-9_-]+/g, "")}`;

const head = (f: F1) => `${f.subject}#S =#eq`;

// ---------------------------------------------------------------------------
// Insert and calculate

function resultNote(f: F1, vals: Values, lu: LenUnit): Text {
  const r = f.rhs;
  return txMap((t, l) => {
    const n = (x: string | number) => (typeof x === "number" ? String(x) : fmt(vals[x], f.dims[x], l));
    const res = fmt(vals[f.subject], f.dims[f.subject], l);
    const sum =
      r.op === "prod"
        ? r.f.map(n).join(" \\cdot ")
        : r.op === "quot"
          ? `${n(r.n)} : ${n(r.d)}`
          : r.op === "sum"
            ? r.t.map(n).join(" + ")
            : r.op === "perim"
              ? `${fmt(2 * vals.a, "len", l)} + ${fmt(2 * vals.b, "len", l)}`
              : `${n("a")} \\cdot ${n("a")}`;
    const dim = f.dims[f.subject];
    const unit =
      dim === "area"
        ? t(` Units: $"${lu}" \\cdot "${lu}" = "${lu}²"$.`, ` Einheiten: $"${lu}" \\cdot "${lu}" = "${lu}²"$.`)
        : dim === "vol"
          ? t(` Units: $"${lu}" \\cdot "${lu}" \\cdot "${lu}" = "${lu}³"$.`, ` Einheiten: $"${lu}" \\cdot "${lu}" \\cdot "${lu}" = "${lu}³"$.`)
          : dim === "speed"
            ? t(` Units: $"km" : "h" = "km/h"$, kilometres per hour.`, ` Einheiten: $"km" : "h" = "km/h"$, Kilometer pro Stunde.`)
            : dim === "dist"
              ? t(` Units: $"km/h" \\cdot "h" = "km"$.`, ` Einheiten: $"km/h" \\cdot "h" = "km"$.`)
              : "";
    return t(`Work it out: $${sum} = ${res}$.${unit}`, `Ausrechnen: $${sum} = ${res}$.${unit}`);
  });
}

/** Frames: the formula, the values put in, (point before line,) the result with its unit. */
function calcFrames(f: F1, vals: Values, lu: LenUnit, intro?: Text): Frame[] {
  const S = f.subject;
  const inputs = Object.keys(f.dims).filter((x) => x !== S);
  const frames: Frame[] = [
    { math: `${head(f)} ${rhsSrc(f.rhs)}`, note: intro ?? f.legend },
    {
      math: txMap((_, l) => `${head(f)} ${rhsSrc(f.rhs, undefined, (x, key) => valueSrc(x, vals[x], f.dims[x], lu, l, key))}`),
      note: txMap((t, l) => `${t("Put in the values:", "Setz die Werte ein:")} ${inputs.map((x) => given(x, vals[x], f.dims[x], lu, l)).join(", ")}.`),
    },
  ];
  if (f.rhs.op === "perim") {
    frames.push({
      math: txMap((_, l) => `${head(f)} ${valueSrc("p1", 2 * vals.a, "len", lu, l, "la")} +#o2 ${valueSrc("p2", 2 * vals.b, "len", lu, l, "lb")}`),
      note: txMap((t, l) =>
        t(
          `Multiply first, then add (Punkt vor Strich): $2 \\cdot ${dec(vals.a, l)} = ${dec(2 * vals.a, l)}$ and $2 \\cdot ${dec(vals.b, l)} = ${dec(2 * vals.b, l)}$.`,
          `Punkt vor Strich: erst $2 \\cdot ${dec(vals.a, l)} = ${dec(2 * vals.a, l)}$ und $2 \\cdot ${dec(vals.b, l)} = ${dec(2 * vals.b, l)}$, dann addieren.`,
        ),
      ),
    });
  }
  frames.push({
    math: txMap((_, l) => `${head(f)} ${valueSrc(S, vals[S], f.dims[S], lu, l, "res")}`),
    note: resultNote(f, vals, lu),
  });
  return frames;
}

// ---------------------------------------------------------------------------
// Rearranging in one step: undo the operation around the letter with its opposite.

type Undo = {
  /** The other letters/numbers around the target. */
  others: (string | number)[];
  /** The opposite operation: ":" (divide by the others), "·" (multiply), "−" (subtract them). */
  inv: ":" | "·" | "−";
};

function undoOf(f: F1, target: string): Undo {
  const r = f.rhs;
  if (r.op === "prod") return { others: r.f.filter((x) => x !== target), inv: ":" };
  if (r.op === "quot") return { others: [r.d], inv: "·" };
  if (r.op === "sum") return { others: r.t.filter((x) => x !== target), inv: "−" };
  throw new Error("not one step");
}

/** Key of a factor/summand where it stands in the formula. */
function keyIn(f: F1, x: string | number) {
  if (typeof x === "string") return `l${x}`;
  return `c${f.rhs.op === "prod" ? f.rhs.f.indexOf(x) : 0}`;
}

const show = (x: string | number) => String(x);

/** The divisor or factor in maths, plain: "4", "v", "(a \cdot b)". */
function opText(u: Undo, bracket = true) {
  if (u.inv === "−") return u.others.map((x) => `- ${x}`).join(" ");
  const body = u.others.map(show).join(" \\cdot ");
  return u.others.length > 1 && bracket ? `(${body})` : body;
}

/** The answer as display source without keys: "u : 4", "v \cdot t", "u - a - b". */
function answerSrc(f: F1, target: string) {
  const u = undoOf(f, target);
  if (u.inv === "−") return `${f.subject} ${opText(u)}`;
  return `${f.subject} ${u.inv === ":" ? ":" : "\\cdot"} ${opText(u)}`;
}

/** The answer for the checker: "u/4", "v*t", "u-a-b", "V/(a*b)". */
function answerPlain(f: F1, target: string) {
  const u = undoOf(f, target);
  if (u.inv === "−") return `${f.subject}${u.others.map((x) => `-${x}`).join("")}`;
  const body = u.others.map(show).join("*");
  return `${f.subject}${u.inv === ":" ? "/" : "*"}${u.others.length > 1 ? `(${body})` : body}`;
}

/** Keyed source of the moved part on the subject's side, using the keys it had in the formula. */
function movedSrc(f: F1, u: Undo) {
  if (u.inv === "−") return u.others.map((x, i) => `-#m${i} ${x}#${keyIn(f, x)}`).join(" ");
  const body = u.others.map((x, i) => `${i ? " \\cdot#mm " : ""}${x}#${keyIn(f, x)}`).join("");
  return `${u.inv === ":" ? ":#m0" : "\\cdot#m0"} ${u.others.length > 1 ? `(${body})#mb` : body}`;
}

/** The step after the bar: | : 4, | · t, | − a − b. */
function barSrc(u: Undo) {
  if (u.inv === "−") return u.others.map((x, i) => `-#m${i} ${x}#q${i}`).join(" ");
  const body = u.others.map((x, i) => `${i ? " \\cdot#qm " : ""}${x}#q${i}`).join("");
  return `${u.inv === ":" ? ":#m0" : "\\cdot#m0"} ${u.others.length > 1 ? `(${body})#qb` : body}`;
}

function rearrangeFrames(f: F1, target: string): Frame[] {
  const u = undoOf(f, target);
  const S = f.subject;
  const T = target;
  const op = opText(u);
  const opNoBracket = opText(u, false);
  const result = answerSrc(f, T);
  const start = `${head(f)} ${rhsSrc(f.rhs, T)}`;
  const what =
    u.inv === ":"
      ? tx(`$${T}$ is **multiplied** by $${opNoBracket}$.`, `$${T}$ wird mit $${opNoBracket}$ **multipliziert**.`)
      : u.inv === "·"
        ? tx(`$${T}$ is **divided** by $${op}$.`, `$${T}$ wird durch $${op}$ **geteilt**.`)
        : tx(`$${u.others.join("$ and $")}$ are **added** to $${T}$.`, `Zu $${T}$ werden $${u.others.join("$ und $")}$ **addiert**.`);
  const how =
    u.inv === ":"
      ? tx(`The opposite of $\\cdot$ is $:$. Divide **both** sides by $${op}$.`, `Die Umkehrung von $\\cdot$ ist $:$. Teile **beide** Seiten durch $${op}$.`)
      : u.inv === "·"
        ? tx(`The opposite of $:$ is $\\cdot$. Multiply **both** sides by $${op}$.`, `Die Umkehrung von $:$ ist $\\cdot$. Multipliziere **beide** Seiten mit $${op}$.`)
        : tx(`The opposite of plus is minus. Subtract $${u.others.join("$ and $")}$ on **both** sides.`, `Die Umkehrung von Plus ist Minus. Subtrahiere auf **beiden** Seiten $${u.others.join("$ und $")}$.`);
  const cancel =
    u.inv === ":"
      ? tx(`On the right, $\\cdot ${opNoBracket}$ and $: ${op}$ cancel out. $${T}$ is on its own!`, `Rechts heben sich $\\cdot ${opNoBracket}$ und $: ${op}$ auf. $${T}$ steht allein!`)
      : u.inv === "·"
        ? tx(`On the right, $: ${op}$ and $\\cdot ${op}$ cancel out. $${T}$ is on its own!`, `Rechts heben sich $: ${op}$ und $\\cdot ${op}$ auf. $${T}$ steht allein!`)
        : tx(`On the right, plus and minus cancel out. $${T}$ is on its own!`, `Rechts heben sich Plus und Minus auf. $${T}$ steht allein!`);
  const frac = u.inv === ":" ? `\\frac{${S}}{${opNoBracket}}` : "";
  return [
    { math: start, note: tx(`We want $${T}$ on its own. ${resolveText(what, "en")}`, `Wir wollen $${T}$ allein haben. ${resolveText(what, "de")}`) },
    { math: `${start} \\quad |#bar \\, ${barSrc(u)}`, note: how, highlight: ["bar", "m0", "m1", "q0", "q1", "qm", "qb(", "qb)"] },
    { math: `${S}#S ${movedSrc(f, u)} =#eq ${L(T, T)}`, note: cancel },
    {
      math: `${L(T, T)} =#eq ${S}#S ${movedSrc(f, u)}`,
      note: frac
        ? tx(`Swap the sides. Done: $${T} = ${result}$. As a fraction: $${T} = ${frac}$.`, `Seiten tauschen. Fertig: $${T} = ${result}$. Als Bruch: $${T} = ${frac}$.`)
        : tx(`Swap the sides. Done: $${T} = ${result}$.`, `Seiten tauschen. Fertig: $${T} = ${result}$.`),
    },
  ];
}

/** Rearranged, then the values put in and worked out. */
function missingFrames(f: F1, target: string, vals: Values, lu: LenUnit): Frame[] {
  const u = undoOf(f, target);
  const S = f.subject;
  const T = target;
  const frames = rearrangeFrames(f, T);
  const known = [S, ...u.others.filter((x): x is string => typeof x === "string")];
  const putIn = (l: Locale) => {
    const moved = movedSrc(f, u).replace(/(^|[\s(])([A-Za-z])#(l[A-Za-z])/g, (_, sp, x, key) => `${sp}${valueSrc(x, vals[x], f.dims[x], lu, l, key)}`);
    return `${L(T, T)} =#eq ${valueSrc(S, vals[S], f.dims[S], lu, l, "S")} ${moved}`;
  };
  const sum = (l: Locale) => {
    const n = (x: string | number) => (typeof x === "number" ? String(x) : fmt(vals[x], f.dims[x], l));
    if (u.inv === "−") return `${n(S)} ${u.others.map((x) => `- ${n(x)}`).join(" ")}`;
    const body = u.others.map(n).join(" \\cdot ");
    return `${n(S)} ${u.inv === ":" ? ":" : "\\cdot"} ${u.others.length > 1 ? `(${body})` : body}`;
  };
  frames.push(
    {
      math: txMap((_, l) => putIn(l)),
      note: txMap((t, l) => `${t("Now put in what you know:", "Jetzt setzt du ein, was du kennst:")} ${known.map((x) => given(x, vals[x], f.dims[x], lu, l)).join(", ")}.`),
    },
    {
      math: txMap((_, l) => `${L(T, T)} =#eq ${valueSrc(T, vals[T], f.dims[T], lu, l, "res")}`),
      note: txMap((t, l) => t(`Work it out: $${sum(l)} = ${fmt(vals[T], f.dims[T], l)}$. So ${given(T, vals[T], f.dims[T], lu, l)}.`, `Ausrechnen: $${sum(l)} = ${fmt(vals[T], f.dims[T], l)}$. Also ist ${given(T, vals[T], f.dims[T], lu, l)}.`)),
    },
  );
  return smoothFracExits(frames);
}

// ---------------------------------------------------------------------------
// Typical mistakes

type Slip = { plain: string; src: string; value: (v: Values) => number; title: Text; say: Text; close?: boolean; typedOnly?: boolean };

/** Wrong one-step rearrangements a beginner makes, as formulas (for choice, expr and number tasks). */
function rearrangeSlips(f: F1, target: string): Slip[] {
  const u = undoOf(f, target);
  const S = f.subject;
  const T = target;
  const o = u.others;
  const op = opText(u);
  const val = (v: Values, x: string | number) => (typeof x === "number" ? x : v[x]);
  const prod = (v: Values) => o.reduce<number>((p, x) => p * val(v, x), 1);
  if (u.inv === ":") {
    const slips: Slip[] = [
      {
        plain: `${S}*${o.map(show).join("*")}`,
        src: `${S} \\cdot ${o.map(show).join(" \\cdot ")}`,
        value: (v) => v[S] * prod(v),
        title: tx("Multiplied instead of divided", "Mal statt geteilt"),
        say: tx(
          `Ah, I see what happened! $${T}$ is **multiplied** by $${opText(u, false)}$, so you undo it with the opposite: **divide** by $${op}$.`,
          `Ah, ich seh, was passiert ist! $${T}$ wird mit $${opText(u, false)}$ **multipliziert**. Das machst du mit der Umkehrung rückgängig: **teile** durch $${op}$.`,
        ),
      },
      {
        plain: `(${o.map(show).join("*")})/${S}`,
        src: `${op} : ${S}`,
        value: (v) => prod(v) / v[S],
        title: tx("The wrong way round", "Andersherum"),
        say: tx(
          `Nearly! You need $${S}$ divided **by** $${op}$, not $${op}$ divided by $${S}$. What you divide by comes second.`,
          `Fast! Du brauchst $${S}$ geteilt **durch** $${op}$, nicht $${op}$ geteilt durch $${S}$. Wodurch du teilst, kommt nach dem Geteilt-Zeichen.`,
        ),
      },
    ];
    if (o.length === 1) {
      slips.push({
        plain: `${S}-${o[0]}`,
        src: `${S} - ${o[0]}`,
        value: (v) => v[S] - val(v, o[0]),
        title: tx("Wrong opposite", "Falsche Umkehrung"),
        say: tx(
          `Hmm, you subtracted $${o[0]}$. But $${T}$ is **multiplied** by $${o[0]}$, and the opposite of times is **divided by**, not minus.`,
          `Hmm, du hast $${o[0]}$ abgezogen. $${T}$ wird aber mit $${o[0]}$ **multipliziert**, und die Umkehrung von Mal ist **Geteilt**, nicht Minus.`,
        ),
      });
    } else {
      slips.push(
        {
          plain: `${S}/${o.join("*")}`,
          src: "",
          value: (v) => (v[S] / val(v, o[0])) * val(v, o[1]),
          title: tx("Brackets missing", "Klammern fehlen"),
          say: tx(
            `I think you meant the right thing, but typed like that only $${o[0]}$ is divided. Put $${o.join(" \\cdot ")}$ in brackets: $: (${o.join(" \\cdot ")})$.`,
            `Ich glaub, du meinst das Richtige, aber so getippt wird nur durch $${o[0]}$ geteilt. Setz $${o.join(" \\cdot ")}$ in Klammern: $: (${o.join(" \\cdot ")})$.`,
          ),
          close: true,
          typedOnly: true,
        },
        {
          plain: `${S}-${o.join("-")}`,
          src: `${S} - ${o.join(" - ")}`,
          value: (v) => v[S] - val(v, o[0]) - val(v, o[1]),
          title: tx("Wrong opposite", "Falsche Umkehrung"),
          say: tx(
            `Hmm, you subtracted. But $${T}$ is **multiplied** by $${o.join("$ and $")}$, so you **divide** by $${op}$.`,
            `Hmm, du hast subtrahiert. $${T}$ wird aber mit $${o.join("$ und $")}$ **multipliziert**, also **teilst** du durch $${op}$.`,
          ),
        },
      );
    }
    return slips;
  }
  if (u.inv === "·") {
    const D = String(o[0]);
    return [
      {
        plain: `${S}/${D}`,
        src: `${S} : ${D}`,
        value: (v) => v[S] / v[D],
        title: tx("Divided instead of multiplied", "Geteilt statt mal"),
        say: tx(
          `Ah, I see what happened! $${T}$ is **divided** by $${D}$, so you undo it with the opposite: **multiply** by $${D}$.`,
          `Ah, ich seh, was passiert ist! $${T}$ wird durch $${D}$ **geteilt**. Das machst du mit der Umkehrung rückgängig: **multipliziere** mit $${D}$.`,
        ),
      },
      {
        plain: `${D}/${S}`,
        src: `${D} : ${S}`,
        value: (v) => v[D] / v[S],
        title: tx("Divided the wrong way", "Falsch herum geteilt"),
        say: tx(
          `Hmm, that's $${D}$ divided by $${S}$. But $${T}$ is divided by $${D}$, so you **multiply** both sides by $${D}$.`,
          `Hmm, das ist $${D}$ geteilt durch $${S}$. $${T}$ wird aber durch $${D}$ geteilt, also **multiplizierst** du beide Seiten mit $${D}$.`,
        ),
      },
      {
        plain: `${S}+${D}`,
        src: `${S} + ${D}`,
        value: (v) => v[S] + v[D],
        title: tx("Wrong opposite", "Falsche Umkehrung"),
        say: tx(`The opposite of **divided by** $${D}$ is **times** $${D}$, not plus.`, `Die Umkehrung von **geteilt durch** $${D}$ ist **mal** $${D}$, nicht plus.`),
      },
    ];
  }
  // A sum: u = a + b + c → c = u − a − b.
  const [p, q] = o.map(String);
  return [
    {
      plain: `${S}+${p}+${q}`,
      src: `${S} + ${p} + ${q}`,
      value: (v) => v[S] + v[p] + v[q],
      title: tx("Sign didn't change", "Vorzeichen nicht gewechselt"),
      say: tx(
        `Ah, I see what happened! $${p}$ and $${q}$ were **added**. To take them away again, you **subtract** them: $- ${p} - ${q}$.`,
        `Ah, ich seh, was passiert ist! $${p}$ und $${q}$ wurden **addiert**. Um sie wieder wegzunehmen, **subtrahierst** du sie: $- ${p} - ${q}$.`,
      ),
    },
    {
      plain: `${S}-${p}+${q}`,
      src: `${S} - ${p} + ${q}`,
      value: (v) => v[S] - v[p] + v[q],
      title: tx("Only one subtracted", "Nur eins abgezogen"),
      say: tx(`Nearly! $${q}$ has to be **subtracted** too, just like $${p}$.`, `Fast! $${q}$ musst du genauso **abziehen** wie $${p}$.`),
      close: true,
    },
    {
      plain: `${p}+${q}-${S}`,
      src: `${p} + ${q} - ${S}`,
      value: (v) => v[p] + v[q] - v[S],
      title: tx("The wrong way round", "Andersherum"),
      say: tx(
        `Careful: start with the whole $${S}$ and take $${p}$ and $${q}$ away. $${p} + ${q} - ${S}$ goes the wrong way.`,
        `Vorsicht: Du startest mit dem ganzen $${S}$ und nimmst $${p}$ und $${q}$ weg. $${p} + ${q} - ${S}$ geht falsch herum.`,
      ),
    },
  ];
}

/** Wrong results when inserting into a formula: the area instead of the perimeter, plus instead of times… */
function calcSlips(f: F1, vals: Values): { value: number; title: Text; say: Text }[] {
  const { a, b, c, r, s, t, v, n, p } = vals;
  const PERIMETER = tx("That's the perimeter", "Das ist der Umfang");
  const AREA = tx("That's the area", "Das ist der Flächeninhalt");
  const PLUS = tx("Added instead of multiplied", "Plus statt mal");
  switch (f.key) {
    case "rectA":
      return [
        { value: 2 * a + 2 * b, title: PERIMETER, say: tx("Ooh, you worked out the **perimeter**, the way around the edge. The area is the space inside: $A = a \\cdot b$.", "Oh, du hast den **Umfang** berechnet, also den Weg außen herum. Der Flächeninhalt ist die Fläche innen: $A = a \\cdot b$.") },
        { value: a + b, title: PLUS, say: tx("Ah, I see what happened! You added the sides. For the area you **multiply**: $A = a \\cdot b$.", "Ah, ich seh, was passiert ist! Du hast die Seiten addiert. Für den Flächeninhalt **multiplizierst** du: $A = a \\cdot b$.") },
      ];
    case "rectU":
      return [
        { value: a * b, title: AREA, say: tx("Ooh, that's the **area**, the space inside. The perimeter is the way around the edge: $u = 2 \\cdot a + 2 \\cdot b$.", "Oh, das ist der **Flächeninhalt**, also die Fläche innen. Der Umfang ist der Weg außen herum: $u = 2 \\cdot a + 2 \\cdot b$.") },
        { value: a + b, title: tx("Only half the way round", "Nur der halbe Weg"), say: tx("Nearly! $a + b$ only gets you halfway round. A rectangle has **two** sides of each length.", "Fast! Mit $a + b$ bist du erst halb herum. Ein Rechteck hat von jeder Seitenlänge **zwei** Seiten.") },
      ];
    case "sqA":
      return [
        { value: 4 * a, title: PERIMETER, say: tx("Ooh, that's the **perimeter** of the square. The area is the space inside: $A = a \\cdot a$.", "Oh, das ist der **Umfang** des Quadrats. Der Flächeninhalt ist die Fläche innen: $A = a \\cdot a$.") },
        { value: 2 * a, title: tx("a · a is not 2 · a", "a · a ist nicht 2 · a"), say: tx("Careful: $a \\cdot a$ means $a$ **times itself**, not $2 \\cdot a$.", "Vorsicht: $a \\cdot a$ heißt $a$ **mal sich selbst**, nicht $2 \\cdot a$.") },
      ];
    case "sqU":
      return [
        { value: a * a, title: AREA, say: tx("Ooh, that's the **area** of the square. The perimeter is the way around: four sides, $u = 4 \\cdot a$.", "Oh, das ist der **Flächeninhalt** des Quadrats. Der Umfang ist der Weg außen herum: vier Seiten, $u = 4 \\cdot a$.") },
        { value: 2 * a, title: tx("Four sides", "Vier Seiten"), say: tx("Nearly! A square has **four** equal sides, so $u = 4 \\cdot a$.", "Fast! Ein Quadrat hat **vier** gleich lange Seiten, also $u = 4 \\cdot a$.") },
      ];
    case "speed":
      return [
        { value: s * t, title: tx("Multiplied instead of divided", "Mal statt geteilt"), say: tx("Ah, I see what happened! You multiplied. Speed is distance **divided by** time: $v = s : t$.", "Ah, ich seh, was passiert ist! Du hast multipliziert. Geschwindigkeit ist Strecke **geteilt durch** Zeit: $v = s : t$.") },
        { value: s - t, title: tx("Minus instead of divided", "Minus statt geteilt"), say: tx("Hmm, you subtracted. Speed is distance **divided by** time: $v = s : t$.", "Hmm, du hast subtrahiert. Geschwindigkeit ist Strecke **geteilt durch** Zeit: $v = s : t$.") },
      ];
    case "dist":
      return [
        { value: v / t, title: tx("Divided instead of multiplied", "Geteilt statt mal"), say: tx("In $t$ hours you get $t$ times as far as in one hour, so **multiply**: $s = v \\cdot t$.", "In $t$ Stunden kommst du $t$-mal so weit wie in einer Stunde, also **multiplizierst** du: $s = v \\cdot t$.") },
        { value: v + t, title: PLUS, say: tx("Ah, I see what happened! You added. Distance is speed **times** time: $s = v \\cdot t$.", "Ah, ich seh, was passiert ist! Du hast addiert. Strecke ist Geschwindigkeit **mal** Zeit: $s = v \\cdot t$.") },
      ];
    case "price":
      return [{ value: n + p, title: PLUS, say: tx("Ah, I see what happened! You added. $n$ items cost $n$ **times** the price of one: $G = n \\cdot p$.", "Ah, ich seh, was passiert ist! Du hast addiert. $n$ Stück kosten $n$-**mal** den Stückpreis: $G = n \\cdot p$.") }];
    case "diam":
      return [
        { value: r / 2, title: tx("Halved instead of doubled", "Halbiert statt verdoppelt"), say: tx("Careful: the diameter goes right across the circle, so it is **twice** the radius: $d = 2 \\cdot r$.", "Vorsicht: Der Durchmesser geht einmal ganz durch den Kreis, er ist also **doppelt** so lang wie der Radius: $d = 2 \\cdot r$.") },
        { value: r + 2, title: PLUS, say: tx("Hmm, you added 2. The diameter is $2$ **times** the radius: $d = 2 \\cdot r$.", "Hmm, du hast 2 addiert. Der Durchmesser ist $2$-**mal** der Radius: $d = 2 \\cdot r$.") },
      ];
    case "triU":
      return [{ value: a + b, title: tx("A side is missing", "Eine Seite fehlt"), say: tx("Nearly! The way around a triangle has **three** sides: $u = a + b + c$.", "Fast! Der Weg um ein Dreieck herum hat **drei** Seiten: $u = a + b + c$.") }];
    default:
      return [
        { value: a * b, title: tx("Only the base", "Nur die Grundfläche"), say: tx("Nearly! $a \\cdot b$ is only the floor of the cuboid. Multiply by the height $c$ too.", "Fast! $a \\cdot b$ ist nur die Grundfläche des Quaders. Multipliziere noch mit der Höhe $c$.") },
        { value: a + b + c, title: PLUS, say: tx("Ah, I see what happened! You added the edges. For the volume you **multiply**: $V = a \\cdot b \\cdot c$.", "Ah, ich seh, was passiert ist! Du hast die Kanten addiert. Für das Volumen **multiplizierst** du: $V = a \\cdot b \\cdot c$.") },
      ];
  }
}

// ---------------------------------------------------------------------------
// Task shapes

const lenUnit = (rng: Rng): LenUnit => (rng.chance(0.5) ? "cm" : "m");

function numberAnswer(f: F1, x: string, vals: Values, lu: LenUnit): Extract<AnswerSpec, { kind: "number" }> {
  const u = unitOf(f.dims[x], lu);
  return { kind: "number", value: vals[x], label: `${x} =`, ...(u ? { unit: u } : {}) };
}

/** Put the values into a formula and calculate. */
function calcTask(f: F1, vals: Values, lu: LenUnit): Exercise {
  const S = f.subject;
  const inputs = Object.keys(f.dims).filter((x) => x !== S);
  const right = numberAnswer(f, S, vals, lu);
  return {
    instruction: tx("Calculate", "Berechne"),
    text: txMap((t, l) => `${resolveText(f.legend, l)} ${t("Given:", "Gegeben:")} ${inputs.map((x) => given(x, vals[x], f.dims[x], lu, l)).join(", ")}. ${t(`Calculate $${S}$.`, `Berechne $${S}$.`)}`),
    math: formulaSrc(f),
    answer: right,
    hint: tx("Put each value into the formula in place of its letter. Then calculate, and don't forget the unit.", "Setz jeden Wert für seinen Buchstaben in die Formel ein. Dann rechne aus und vergiss die Einheit nicht."),
    solution: calcFrames(f, vals, lu),
    mistakes: numberMistakes(right, calcSlips(f, vals)),
  };
}

/** Rearrange in one step (answer: the formula). */
function rearrangeTask(f: F1, target: string): Exercise {
  const u = undoOf(f, target);
  const slips = rearrangeSlips(f, target);
  const mistakes: Mistake[] = slips.map((s) => ({ when: { kind: "expr", value: s.plain, positive: true }, title: s.title, say: s.say, ...(s.close ? { close: true } : {}) }));
  return {
    instruction: tx("Rearrange the formula", "Stelle die Formel um"),
    text: txMap((t, l) => `${resolveText(f.legend, l)} ${t(`Solve for $${target}$.`, `Stelle nach $${target}$ um.`)}`),
    answer: { kind: "expr", value: answerPlain(f, target), prefix: `${target} =`, positive: true },
    hint:
      u.inv === ":"
        ? tx(`$${target}$ is multiplied by $${opText(u, false)}$. What is the opposite of times?`, `$${target}$ wird mit $${opText(u, false)}$ multipliziert. Was ist die Umkehrung von Mal?`)
        : u.inv === "·"
          ? tx(`$${target}$ is divided by $${u.others[0]}$. What is the opposite of divided by?`, `$${target}$ wird durch $${u.others[0]}$ geteilt. Was ist die Umkehrung von Geteilt?`)
          : tx(`$${u.others.join("$ and $")}$ are added to $${target}$. Take them away on both sides.`, `Zu $${target}$ werden $${u.others.join("$ und $")}$ addiert. Nimm sie auf beiden Seiten weg.`),
    solution: smoothFracExits(rearrangeFrames(f, target)),
    visual: { component: FormulaBoard, props: { src: formulaSrc(f, target) } },
    mistakes,
  };
}

/** Rearrange, then calculate the letter from the others. */
function missingTask(f: F1, target: string, vals: Values, lu: LenUnit): Exercise {
  const known = Object.keys(f.dims).filter((x) => x !== target);
  const right = numberAnswer(f, target, vals, lu);
  const slips = rearrangeSlips(f, target).filter((s) => !s.typedOnly);
  return {
    instruction: tx("Calculate the missing value", "Berechne die fehlende Größe"),
    text: txMap((t, l) => `${resolveText(f.legend, l)} ${t("Given:", "Gegeben:")} ${known.map((x) => given(x, vals[x], f.dims[x], lu, l)).join(", ")}. ${t(`Calculate $${target}$.`, `Berechne $${target}$.`)}`),
    answer: right,
    hint: tx(`First solve $${formulaSrc(f)}$ for $${target}$ with the opposite operation. Then put in the numbers.`, `Stell $${formulaSrc(f)}$ zuerst mit der Umkehroperation nach $${target}$ um. Dann setzt du die Zahlen ein.`),
    solution: missingFrames(f, target, vals, lu),
    visual: { component: FormulaBoard, props: { src: formulaSrc(f, target) } },
    mistakes: numberMistakes(
      right,
      slips.map((s) => ({ value: s.value(vals), title: s.title, say: s.say, close: s.close, tolerance: Number.isInteger(clean(s.value(vals) * 100)) ? undefined : 0.01 })),
    ),
  };
}

/** Which rearranged formula is right? */
function choiceTask(f: F1, target: string, rng: Rng | null): Exercise {
  const slips = rearrangeSlips(f, target).filter((s) => !s.typedOnly);
  const opts: Opt[] = [{ text: `$${target} = ${answerSrc(f, target)}$` }, ...slips.slice(0, 3).map((s) => ({ text: `$${target} = ${s.src}$`, title: s.title, say: s.say }))];
  const c = choice(rng, opts);
  return {
    instruction: tx("Which formula is right?", "Welche Formel stimmt?"),
    text: tx(`Which formula gives $${target}$?`, `Mit welcher Formel berechnest du $${target}$?`),
    math: formulaSrc(f, target),
    answer: c.answer,
    hint: tx(`Look at what happens to $${target}$ in the formula. Undo it with the opposite operation on both sides.`, `Schau, was in der Formel mit $${target}$ passiert. Mach es mit der Umkehroperation auf beiden Seiten rückgängig.`),
    solution: smoothFracExits(rearrangeFrames(f, target)),
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Word problems: the story decides which formula you need.

type Story = {
  f: F1;
  /** The letter asked for (the subject unless the story asks backwards). */
  ask?: string;
  lu?: LenUnit;
  /** Values for the story (the formula's inputs). */
  pick: (r: Rng) => Values;
  text: (v: Values, l: Locale) => string;
  /** Why this formula: the first note of the solution. */
  why: Text;
};

const NAMES = ["Lena", "Tom", "Mia", "Ben", "Emma", "Paul", "Lea", "Finn", "Anna", "Leon", "Elif", "Noah"];

const m2 = (l: Locale, v: number) => dec(v, l);

const STORIES: Story[] = [
  {
    f: RECT_U,
    lu: "m",
    pick: (r) => ({ a: r.int(8, 25), b: r.int(4, 12) }),
    text: (v, l) =>
      l === "de"
        ? `${NAMES[v.k]}s Familie möchte ihren rechteckigen Garten einzäunen. Er ist ${m2(l, v.a)} m lang und ${m2(l, v.b)} m breit. Wie viele Meter Zaun braucht die Familie?`
        : `${NAMES[v.k]}'s family wants to put a fence around their rectangular garden. It is ${m2(l, v.a)} m long and ${m2(l, v.b)} m wide. How many metres of fence do they need?`,
    why: tx("The fence goes **around** the garden: that's the perimeter.", "Der Zaun geht **um** den Garten herum: Das ist der Umfang."),
  },
  {
    f: RECT_A,
    lu: "m",
    pick: (r) => ({ a: r.int(5, 15), b: r.int(3, 9) }),
    text: (v, l) =>
      l === "de"
        ? `${NAMES[v.k]} will eine rechteckige Rasenfläche mit Rollrasen auslegen. Sie ist ${m2(l, v.a)} m lang und ${m2(l, v.b)} m breit. Wie viele Quadratmeter Rollrasen braucht ${NAMES[v.k]}?`
        : `${NAMES[v.k]} wants to cover a rectangular lawn with turf. It is ${m2(l, v.a)} m long and ${m2(l, v.b)} m wide. How many square metres of turf are needed?`,
    why: tx("The turf covers the **inside** of the lawn: that's the area.", "Der Rollrasen bedeckt die Fläche **innen**: Das ist der Flächeninhalt."),
  },
  {
    f: RECT_A,
    lu: "m",
    pick: (r) => ({ a: r.int(6, 12), b: r.int(5, 9) }),
    text: (v, l) =>
      l === "de"
        ? `Ein Klassenzimmer ist ${m2(l, v.a)} m lang und ${m2(l, v.b)} m breit. Der Boden bekommt neues Linoleum. Wie viele Quadratmeter sind das?`
        : `A classroom is ${m2(l, v.a)} m long and ${m2(l, v.b)} m wide. The floor gets new lino. How many square metres is that?`,
    why: tx("The lino covers the whole floor: that's the area.", "Das Linoleum bedeckt den ganzen Boden: Das ist der Flächeninhalt."),
  },
  {
    f: RECT_U,
    lu: "cm",
    pick: (r) => ({ a: r.int(20, 60), b: r.int(15, 45) }),
    text: (v, l) =>
      l === "de"
        ? `Ein Poster ist ${m2(l, v.a)} cm breit und ${m2(l, v.b)} cm hoch. ${NAMES[v.k]} klebt ein Band einmal ganz um den Rand. Wie lang muss das Band sein?`
        : `A poster is ${m2(l, v.a)} cm wide and ${m2(l, v.b)} cm high. ${NAMES[v.k]} glues a ribbon all the way round its edge. How long must the ribbon be?`,
    why: tx("The ribbon goes **around** the edge: that's the perimeter.", "Das Band geht **um** den Rand herum: Das ist der Umfang."),
  },
  {
    f: SQ_U,
    lu: "m",
    pick: (r) => ({ a: r.int(2, 9) }),
    text: (v, l) =>
      l === "de"
        ? `Ein quadratischer Sandkasten hat eine Seitenlänge von ${m2(l, v.a)} m. Wie lang ist die Holzumrandung ringsherum?`
        : `A square sandpit has sides of ${m2(l, v.a)} m. How long is the wooden border all the way round?`,
    why: tx("The border goes around all **four** sides: $u = 4 \\cdot a$.", "Die Umrandung geht um alle **vier** Seiten: $u = 4 \\cdot a$."),
  },
  {
    f: SQ_A,
    lu: "cm",
    pick: (r) => ({ a: r.pick([10, 12, 15, 20, 25, 30]) }),
    text: (v, l) =>
      l === "de"
        ? `Eine quadratische Fliese hat eine Seitenlänge von ${m2(l, v.a)} cm. Wie groß ist ihr Flächeninhalt?`
        : `A square tile has sides of ${m2(l, v.a)} cm. What is its area?`,
    why: tx("Area of a square: side times side.", "Flächeninhalt eines Quadrats: Seite mal Seite."),
  },
  {
    f: SPEED,
    pick: (r) => {
      const v = r.pick([12, 14, 15, 16, 18, 20]);
      const t = r.int(2, 4);
      return { s: v * t, t };
    },
    text: (v, l) =>
      l === "de"
        ? `${NAMES[v.k]} fährt mit dem Fahrrad ${m2(l, v.s)} km in ${m2(l, v.t)} Stunden. Wie hoch ist die Durchschnittsgeschwindigkeit?`
        : `${NAMES[v.k]} cycles ${m2(l, v.s)} km in ${m2(l, v.t)} hours. What is the average speed?`,
    why: tx("Speed is distance divided by time.", "Geschwindigkeit ist Strecke geteilt durch Zeit."),
  },
  {
    f: SPEED,
    pick: (r) => {
      const v = r.pick([80, 90, 100, 110, 120, 150]);
      const t = r.int(2, 5);
      return { s: v * t, t };
    },
    text: (v, l) =>
      l === "de"
        ? `Ein Zug legt ${m2(l, v.s)} km in ${m2(l, v.t)} Stunden zurück. Wie schnell fährt er im Durchschnitt?`
        : `A train covers ${m2(l, v.s)} km in ${m2(l, v.t)} hours. How fast does it go on average?`,
    why: tx("Speed is distance divided by time.", "Geschwindigkeit ist Strecke geteilt durch Zeit."),
  },
  {
    f: DIST,
    pick: (r) => ({ v: r.pick([60, 70, 80, 90, 100, 120]), t: r.int(2, 5) }),
    text: (v, l) =>
      l === "de"
        ? `Ein Auto fährt ${m2(l, v.t)} Stunden lang mit durchschnittlich ${m2(l, v.v)} km/h. Wie weit kommt es?`
        : `A car drives for ${m2(l, v.t)} hours at an average of ${m2(l, v.v)} km/h. How far does it get?`,
    why: tx("Each hour it covers $v$ kilometres, so distance is speed times time.", "Jede Stunde schafft es $v$ Kilometer, also ist die Strecke Geschwindigkeit mal Zeit."),
  },
  {
    f: PRICE,
    pick: (r) => ({ n: r.int(3, 9), p: r.pick([0.8, 1.2, 1.25, 1.5, 2.5, 3.5]) }),
    text: (v, l) =>
      l === "de"
        ? `${NAMES[v.k]} kauft ${m2(l, v.n)} Hefte zu je ${money(v.p, l)} €. Wie viel kostet das zusammen?`
        : `${NAMES[v.k]} buys ${m2(l, v.n)} exercise books at ${money(v.p, l)} € each. How much is that altogether?`,
    why: tx("Total price = number of items times the price of one.", "Gesamtpreis = Anzahl mal Stückpreis."),
  },
  {
    f: DIST,
    ask: "t",
    pick: (r) => ({ v: r.pick([50, 60, 80, 90, 100, 120]), t: r.int(2, 5) }),
    text: (v, l) =>
      l === "de"
        ? `Ein Reisebus fährt ${m2(l, v.s)} km mit einer Durchschnittsgeschwindigkeit von ${m2(l, v.v)} km/h. Wie viele Stunden dauert die Fahrt?`
        : `A coach travels ${m2(l, v.s)} km at an average speed of ${m2(l, v.v)} km/h. How many hours does the journey take?`,
    why: tx("Start from $s = v \\cdot t$ and get $t$ on its own.", "Du startest mit $s = v \\cdot t$ und bringst $t$ allein auf eine Seite."),
  },
  {
    f: PRICE,
    ask: "p",
    pick: (r) => ({ n: r.int(4, 10), p: r.pick([0.3, 0.4, 0.45, 0.5, 0.6, 0.8]) }),
    text: (v, l) =>
      l === "de"
        ? `${m2(l, v.n)} Brötchen kosten zusammen ${money(v.G, l)} €. Wie viel kostet ein Brötchen?`
        : `${m2(l, v.n)} bread rolls cost ${money(v.G, l)} € altogether. How much does one roll cost?`,
    why: tx("Start from $G = n \\cdot p$ and get the price $p$ of one roll on its own.", "Du startest mit $G = n \\cdot p$ und bringst den Stückpreis $p$ allein auf eine Seite."),
  },
  {
    f: CUBOID,
    lu: "cm",
    pick: (r) => ({ a: r.pick([20, 25, 30, 35]), b: r.pick([10, 12, 15, 20]), c: r.pick([8, 10, 12]) }),
    text: (v, l) =>
      l === "de"
        ? `Ein Schuhkarton ist ${m2(l, v.a)} cm lang, ${m2(l, v.b)} cm breit und ${m2(l, v.c)} cm hoch. Wie groß ist sein Volumen?`
        : `A shoebox is ${m2(l, v.a)} cm long, ${m2(l, v.b)} cm wide and ${m2(l, v.c)} cm high. What is its volume?`,
    why: tx("A shoebox is a cuboid: volume = length times width times height.", "Ein Schuhkarton ist ein Quader: Volumen = Länge mal Breite mal Höhe."),
  },
];

function storyTask(st: Story, rng: Rng): Exercise {
  return storyExercise(st, complete(st.f, st.pick(rng)), rng.int(0, NAMES.length - 1));
}

function storyExercise(st: Story, vals: Values, k: number): Exercise {
  const f = st.f;
  const lu = st.lu ?? "m";
  const x = st.ask ?? f.subject;
  const right = numberAnswer(f, x, vals, lu);
  const backwards = x !== f.subject;
  const frames = backwards ? missingFrames(f, x, vals, lu) : calcFrames(f, vals, lu);
  frames[0] = { ...frames[0], note: txMap((_, l) => `${resolveText(st.why, l)} ${resolveText(frames[0].note, l)}`) };
  const slips = backwards
    ? rearrangeSlips(f, x)
        .filter((s) => !s.typedOnly)
        .map((s) => ({ value: s.value(vals), title: s.title, say: s.say, close: s.close, tolerance: Number.isInteger(clean(s.value(vals) * 100)) ? undefined : 0.01 }))
    : calcSlips(f, vals);
  return {
    instruction: tx("Solve the word problem", "Löse die Sachaufgabe"),
    text: txMap((_, l) => st.text({ ...vals, k }, l)),
    answer: right,
    hint: backwards
      ? tx("Which formula connects the numbers? Rearrange it for what is asked, then put in the numbers.", "Welche Formel verbindet die Zahlen? Stell sie nach der gesuchten Größe um und setz dann ein.")
      : tx("Inside or around? Pick the right formula, put in the numbers and keep the unit.", "Innen oder außen herum? Nimm die passende Formel, setz die Zahlen ein und behalte die Einheit."),
    solution: frames,
    mistakes: numberMistakes(right, slips),
  };
}

// ---------------------------------------------------------------------------

export function generate1(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.22) {
    const f = rng.pick(ALL);
    const lu = lenUnit(rng);
    return calcTask(f, pickValues(f, rng), lu);
  }
  if (r < 0.42) return storyTask(rng.pick(STORIES), rng);
  const [f, x] = rng.pick(SOLVABLE);
  if (r < 0.62) return rearrangeTask(f, x);
  if (r < 0.82) return missingTask(f, x, pickValues(f, rng), lenUnit(rng));
  return choiceTask(f, x, rng);
}

// ---------------------------------------------------------------------------
// Lesson

const speedVals = complete(SPEED, { s: 150, t: 2 });
const priceVals = complete(PRICE, { n: 3, p: 2.4 });

/** New keys for a second example on the same board, so its tokens fade in instead of morphing. */
const rekey = (frames: Frame[], sfx: string): Frame[] =>
  frames.map((fr) => ({ ...fr, math: txMap((_, l) => resolveText(fr.math, l).replace(/#([A-Za-z0-9_-]+)/g, `#$1${sfx}`)), highlight: fr.highlight?.map((k) => k + sfx) }));

/** Speed first, then the price: two formulas from everyday life on one board. */
const everydayFrames: Frame[] = [
  ...calcFrames(SPEED, speedVals, "m", tx("Speed: distance divided by time. A car drives $150$ km in $2$ hours.", "Geschwindigkeit: Strecke geteilt durch Zeit. Ein Auto fährt $150$ km in $2$ Stunden.")),
  ...rekey(calcFrames(PRICE, priceVals, "m", tx("Prices work the same way: $3$ exercise books at $2.40$ € each.", "Preise funktionieren genauso: $3$ Hefte zu je $2,40$ €.")), "x"),
];

const squareVals: Values = { u: 36, a: 9 };

export const level1: LevelLesson = {
  summary: [
    {
      title: tx("Put in the values", "Werte einsetzen"),
      body: tx("Replace each letter by its value, with the unit. Then calculate.", "Ersetze jeden Buchstaben durch seinen Wert, mit Einheit. Dann rechne aus."),
      examples: ["A = a \\cdot b", 'A = 6 "cm" \\cdot 4 "cm" = 24 "cm²"'],
      tone: "rule",
    },
    {
      title: tx("Formulas you need", "Formeln, die du brauchst"),
      body: tx(
        "Rectangle: area and perimeter. Speed: distance divided by time. Price: number times price of one.",
        "Rechteck: Flächeninhalt und Umfang. Geschwindigkeit: Strecke durch Zeit. Preis: Anzahl mal Stückpreis.",
      ),
      examples: ["A = a \\cdot b \\quad \\quad u = 2 \\cdot a + 2 \\cdot b", "v = s : t \\quad \\quad G = n \\cdot p"],
      tone: "rule",
    },
    {
      title: tx("Units", "Einheiten"),
      body: tx("Lengths in cm or m, areas in cm² or m². Speed in km/h.", "Längen in cm oder m, Flächen in cm² oder m². Geschwindigkeit in km/h."),
      examples: ['"cm" \\cdot "cm" = "cm²"', '"km" : "h" = "km/h"'],
      tone: "tip",
    },
    {
      title: tx("Rearrange with the opposite", "Umstellen mit der Umkehroperation"),
      body: tx("Times is undone by divided by, plus by minus. Always on **both** sides.", "Mal machst du mit Geteilt rückgängig, Plus mit Minus. Immer auf **beiden** Seiten."),
      examples: ["u = 4 \\cdot a \\quad | \\, : 4", "u : 4 = a", "a = u : 4"],
      tone: "rule",
    },
    {
      title: tx("Area or perimeter?", "Flächeninhalt oder Umfang?"),
      body: tx("Area is the inside (cm²), perimeter is the way around (cm). Read the question carefully.", "Der Flächeninhalt ist innen (cm²), der Umfang ist der Weg außen herum (cm). Lies die Frage genau."),
      examples: ['A = 6 "cm" \\cdot 4 "cm" = 24 "cm²"', 'u = 2 \\cdot 6 "cm" + 2 \\cdot 4 "cm" = 20 "cm"'],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Formulas: rules with letters", "Formeln: Rechenregeln mit Buchstaben"),
      blob: tx("A formula is like a recipe: values in, result out!", "Eine Formel ist wie ein Rezept: Werte rein, Ergebnis raus!"),
      body: tx(
        "A formula tells you how to work out a quantity. Its letters stand for quantities: $A$ for the area, $a$ and $b$ for the sides. To use it, you **put in** the values with their units.",
        "Eine Formel sagt dir, wie du eine Größe ausrechnest. Ihre Buchstaben stehen für Größen: $A$ für den Flächeninhalt, $a$ und $b$ für die Seiten. Um sie zu benutzen, **setzt** du die Werte mit ihren Einheiten **ein**.",
      ),
      frames: calcFrames(RECT_A, complete(RECT_A, { a: 6, b: 4 }), "cm", tx("The area of a rectangle: side times side. Here $a = 6$ cm and $b = 4$ cm.", "Der Flächeninhalt eines Rechtecks: Seite mal Seite. Hier ist $a = 6$ cm und $b = 4$ cm.")),
    },
    {
      type: "widget",
      title: tx("The rectangle lab", "Das Rechteck-Labor"),
      blob: tx("Drag the corner and watch both formulas change!", "Zieh an der Ecke und schau, wie sich beide Formeln ändern!"),
      body: tx(
        "Drag the purple corner to change the sides $a$ and $b$. The area counts the squares inside, the perimeter is the way around the edge.",
        "Zieh an der lila Ecke, um die Seiten $a$ und $b$ zu ändern. Der Flächeninhalt zählt die Kästchen innen, der Umfang ist der Weg einmal außen herum.",
      ),
      widget: RectangleLab,
    },
    {
      type: "explain",
      title: tx("Perimeter: multiply before you add", "Umfang: Punkt vor Strich"),
      blob: tx("Formulas follow the usual rules of arithmetic.", "In Formeln gelten die üblichen Rechenregeln."),
      body: tx(
        "The way around a rectangle: two sides $a$ and two sides $b$. As always, multiply before you add (Punkt vor Strich), and the unit comes along in every line.",
        "Der Weg um ein Rechteck: zweimal die Seite $a$ und zweimal die Seite $b$. Wie immer gilt Punkt vor Strich, und die Einheit wandert in jeder Zeile mit.",
      ),
      frames: calcFrames(RECT_U, complete(RECT_U, { a: 5, b: 3 }), "cm"),
    },
    {
      type: "check",
      blob: tx("Your turn. Inside or around?", "Du bist dran. Innen oder außen herum?"),
      exercise: calcTask(RECT_A, complete(RECT_A, { a: 8, b: 5 }), "m"),
    },
    {
      type: "explain",
      title: tx("Speed and price", "Geschwindigkeit und Preis"),
      blob: tx("Formulas aren't only for shapes. They're everywhere!", "Formeln gibt es nicht nur für Figuren. Sie sind überall!"),
      body: tx(
        "Speed is distance divided by time: $v = s : t$. A price is the number of items times the price of one: $G = n \\cdot p$. Same idea: put in, work out, add the unit.",
        "Geschwindigkeit ist Strecke geteilt durch Zeit: $v = s : t$. Ein Preis ist Anzahl mal Stückpreis: $G = n \\cdot p$. Immer gleich: einsetzen, ausrechnen, Einheit dazu.",
      ),
      frames: everydayFrames,
    },
    {
      type: "check",
      blob: tx("Which formula fits this story?", "Welche Formel passt zu dieser Geschichte?"),
      exercise: storyExercise(STORIES[7], complete(SPEED, { s: 360, t: 3 }), 0),
    },
    {
      type: "explain",
      title: tx("Backwards: rearrange in one step", "Rückwärts: in einem Schritt umstellen"),
      blob: tx("What if you know the result and want a value inside?", "Und wenn du das Ergebnis kennst und einen Wert in der Formel suchst?"),
      body: tx(
        "A square has the perimeter $u = 36$ cm. How long is a side? Then you **rearrange** the formula: undo the operation around the letter with its **opposite**, on both sides.",
        "Ein Quadrat hat den Umfang $u = 36$ cm. Wie lang ist eine Seite? Dann **stellst** du die Formel **um**: Mach die Rechnung am Buchstaben mit ihrer **Umkehroperation** rückgängig, auf beiden Seiten.",
      ),
      frames: missingFrames(SQ_U, "a", squareVals, "cm"),
    },
    {
      type: "widget",
      title: tx("The undo machine", "Die Umkehr-Maschine"),
      blob: tx("Every operation has an opposite. Find it!", "Jede Rechenart hat eine Umkehrung. Finde sie!"),
      body: tx(
        "Pick the operation that gets the purple letter on its own. Whatever you pick happens on **both** sides of the equals sign.",
        "Wähle die Rechnung, mit der der lila Buchstabe allein steht. Was du wählst, passiert auf **beiden** Seiten des Gleichheitszeichens.",
      ),
      widget: UndoMachine,
    },
    {
      type: "check",
      blob: tx("One step does it. Which opposite do you need?", "Ein Schritt reicht. Welche Umkehrung brauchst du?"),
      exercise: rearrangeTask(DIST, "t"),
    },
    {
      type: "check",
      blob: tx("Last one: rearrange, then put in the numbers.", "Die letzte: erst umstellen, dann einsetzen."),
      exercise: missingTask(RECT_A, "b", complete(RECT_A, { a: 9, b: 6 }), "cm"),
    },
  ],
};
