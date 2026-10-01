"use client";

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, RotateCcw, Shuffle } from "lucide-react";
import { Fragment, useId, useState } from "react";
import { Blob, type BlobMood } from "@/components/blob/Blob";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { topicMeta } from "@/learn/catalog";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Topic } from "@/learn/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Numbers and names. Stories use the German decimal comma ("2,5 km", "7,50 €").

const NAMES = [
  "Mia", "Leon", "Emma", "Noah", "Lina", "Elias", "Hannah", "Paul", "Sophie", "Ben", "Emilia", "Finn", "Lea", "Jonas", "Amira",
  "Can", "Zeynep", "Luca", "Ida", "Mats", "Aylin", "Milan", "Nele", "Yusuf", "Clara", "Theo", "Leni", "Omar", "Jana", "Malik",
];

/** German number style: decimal comma, at most two decimals ("2,5", "0,75"). */
function de(v: number): string {
  return String(Math.round(v * 100) / 100).replace(".", ",");
}

/** Euros from cents: "7,50" or "12". */
function eur(cents: number): string {
  const c = Math.round(cents);
  return c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace(".", ",");
}

const num = (value: number, unit?: string): AnswerSpec => ({ kind: "number", value: Math.round(value * 1000) / 1000, unit });

const SOLVE = "Solve the word problem";

/** Puts a sentence that isn't needed right before the question (the last sentence). */
function withExtra(text: string, extra: string): string {
  const i = text.lastIndexOf(". ");
  return i < 0 ? `${extra} ${text}` : `${text.slice(0, i + 2)}${extra} ${text.slice(i + 2)}`;
}

type Tpl = (rng: Rng) => Exercise;

// ---------------------------------------------------------------------------
// Rule of three (Dreisatz): one line per frame, the values morph in place while
// the operations appear on both sides.

type RuleOfThree = {
  a: number;
  va: number;
  b: number;
  one: string;
  many: string;
  unit: string;
  inverse?: boolean;
  money?: boolean;
  given: string;
  why: string;
  oneNote: string;
  answer: string;
};

export function ruleOfThree(o: RuleOfThree): Frame[] {
  const f = (v: number) => (o.money ? eur(v * 100) : de(v));
  const v1 = o.inverse ? o.va * o.a : o.va / o.a;
  const vb = o.inverse ? v1 / o.b : v1 * o.b;
  const row = (l: number, unit: string, r: number, ops?: [string, string]) => {
    const core = `${de(l)}#a "${unit}"#ua \\to#ar ${f(r)}#b "${o.unit}"#ub`;
    return ops ? `\\blob{${ops[0]}} \\quad ${core} \\quad \\blob{${ops[1]}}` : core;
  };
  const div = (n: number, k: string) => `:#${k} ${n}#${k}n`;
  const mul = (n: number, k: string) => `\\cdot#${k} ${n}#${k}n`;
  return [
    { math: row(o.a, o.many, o.va), note: o.given },
    { math: row(o.a, o.many, o.va, [div(o.a, "d1"), o.inverse ? mul(o.a, "d2") : div(o.a, "d2")]), note: o.why },
    { math: row(1, o.one, v1), note: o.oneNote },
    {
      math: row(1, o.one, v1, [mul(o.b, "m1"), o.inverse ? div(o.b, "m2") : mul(o.b, "m2")]),
      note: o.inverse
        ? `Now ${o.b} ${o.many}: multiply the left side by ${o.b}, and **divide** the right side by ${o.b}.`
        : `Now ${o.b} ${o.many}: multiply both sides by ${o.b}.`,
    },
    { math: row(o.b, o.many, vb), highlight: ["b", "ub"], note: o.answer },
  ];
}

// ---------------------------------------------------------------------------
// Level 1: one step

const GOODS = [
  { one: "croissant", many: "croissants", prices: [80, 90, 110, 120, 130, 150], max: 8 },
  { one: "cinema ticket", many: "cinema tickets", prices: [750, 800, 850, 900, 950, 1100], max: 6 },
  { one: "pack of stickers", many: "packs of stickers", prices: [120, 150, 180, 250], max: 6 },
  { one: "notebook", many: "notebooks", prices: [110, 140, 150, 160, 180, 240], max: 8 },
  { one: "pool ticket", many: "pool tickets", prices: [350, 400, 450, 550], max: 6 },
];

const buyMany: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  const g = rng.pick(GOODS);
  const n = rng.int(3, g.max);
  const p = rng.pick(g.prices);
  const total = n * p;
  const round = Math.max(1, Math.round(p / 100));
  return {
    instruction: SOLVE,
    text: `${name} buys ${n} ${g.many}. One ${g.one} costs ${eur(p)} €. How much does ${name} pay in total?`,
    answer: num(total / 100, "€"),
    hint: "The same price several times: **multiply** the number of items by the price of one.",
    solution: [
      { math: `"total"#w =#eq ?#q`, note: `**Given:** ${n} ${g.many} at ${eur(p)} € each. **Wanted:** the total price.` },
      { math: `"total"#w =#eq ${n}#n \\cdot#op ${eur(p)}#p "€"#u`, note: `The same price ${n} times: **multiply**.` },
      {
        math: `"total"#w =#eq ${eur(total)}#p "€"#u`,
        highlight: ["p", "u"],
        note: `$${n} \\cdot ${eur(p)} = ${eur(total)}$. **Answer:** ${name} pays ${eur(total)} € in total. Rough check: $${n} \\cdot ${round} = ${n * round}$, close enough.`,
      },
    ],
  };
};

const SHARES = [
  { what: "a pizza order", max: 6 },
  { what: "a present for their teacher", max: 8 },
  { what: "a taxi ride", max: 4 },
  { what: "a new football", max: 5 },
  { what: "a trip to the climbing hall", max: 8 },
];

const share: Tpl = (rng) => {
  const s = rng.pick(SHARES);
  const n = rng.int(3, s.max);
  const each = rng.int(6, 30) * 50;
  const total = each * n;
  return {
    instruction: SOLVE,
    text: `${n} friends share the cost of ${s.what} equally. Altogether it costs ${eur(total)} €. How much does each friend pay?`,
    answer: num(each / 100, "€"),
    hint: "Shared **equally** means: divide the total by the number of friends.",
    solution: [
      { math: `"each"#w =#eq ?#q`, note: `**Given:** ${eur(total)} € in total, ${n} friends. **Wanted:** the amount for each friend.` },
      { math: `"each"#w =#eq ${eur(total)}#t "€"#u :#op ${n}#n`, note: `Shared equally between ${n}: **divide** by ${n}.` },
      { math: `"each"#w =#eq ${eur(each)}#t "€"#u`, highlight: ["t", "u"], note: `$${eur(total)} : ${n} = ${eur(each)}$. **Answer:** Each friend pays ${eur(each)} €.` },
    ],
  };
};

const BUYS = [
  { what: "a book", min: 650, max: 1490, note: 20 },
  { what: "a T-shirt", min: 890, max: 1790, note: 20 },
  { what: "a board game", min: 1990, max: 3990, note: 50 },
  { what: "a sandwich and a drink", min: 380, max: 790, note: 10 },
  { what: "a comic", min: 290, max: 680, note: 10 },
];

const change: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  const b = rng.pick(BUYS);
  const p = rng.int(b.min / 10, b.max / 10) * 10;
  const r = b.note * 100 - p;
  return {
    instruction: SOLVE,
    text: `${name} buys ${b.what} for ${eur(p)} € and pays with a ${b.note} € note. How much change does ${name} get?`,
    answer: num(r / 100, "€"),
    hint: "The change is the money that comes back: **subtract** the price from the money paid.",
    solution: [
      { math: `"change"#w =#eq ?#q`, note: `**Given:** price ${eur(p)} €, paid with ${b.note} €. **Wanted:** the change.` },
      { math: `"change"#w =#eq ${b.note}#a "€"#ua -#op ${eur(p)}#b "€"#ub`, note: "The change is what's left over: **subtract** the price." },
      {
        math: `"change"#w =#eq ${eur(r)}#a "€"#ua`,
        highlight: ["a", "ua"],
        note: `Count up from ${eur(p)} € to ${b.note} €: that's ${eur(r)} €. **Answer:** ${name} gets ${eur(r)} € change.`,
      },
    ],
  };
};

const DURATIONS: { from: number; to: number; text: (a: string, b: string, name: string) => string; answer: (d: number, name: string) => string }[] = [
  {
    from: 7,
    to: 9,
    text: (a, b) => `The bus for the school trip leaves at ${a} and arrives at ${b}. How many minutes does the ride take?`,
    answer: (d) => `The ride takes ${d} minutes.`,
  },
  {
    from: 15,
    to: 19,
    text: (a, b) => `The film starts at ${a} and ends at ${b}. How long is the film in minutes?`,
    answer: (d) => `The film is ${d} minutes long.`,
  },
  {
    from: 9,
    to: 14,
    text: (a, b, name) => `${name} starts a bike tour at ${a} and is back home at ${b}. How many minutes was ${name} out?`,
    answer: (d, name) => `${name} was out for ${d} minutes.`,
  },
  {
    from: 10,
    to: 13,
    text: (a, b) => `The school's football tournament starts at ${a} and ends at ${b}. How many minutes does it last?`,
    answer: (d) => `The tournament lasts ${d} minutes.`,
  },
];

const clock = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

const duration: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  const c = rng.pick(DURATIONS);
  const h = rng.int(c.from, c.to);
  const m = rng.int(1, 11) * 5;
  let d = rng.int(7, 34) * 5;
  while ((m + d) % 60 === 0 || m + d <= 60) d += 5;
  const start = h * 60 + m;
  const end = start + d;
  const a = 60 - m;
  const full = `${h + 1}:00`;
  const t1 = clock(start);
  const t2 = clock(end);
  return {
    instruction: SOLVE,
    text: c.text(t1, t2, name),
    answer: num(d, "min"),
    hint: "Count in two steps: first up to the next full hour, then the rest.",
    solution: [
      { math: `"${t1}"#t1 \\to#ar2 "${t2}"#t2`, note: `**Given:** start ${t1}, end ${t2}. **Wanted:** the time in between, in minutes.` },
      { math: `"${t1}"#t1 \\to#ar1 "${full}"#tf \\to#ar2 "${t2}"#t2`, note: "Go to the next full hour first." },
      { math: `${a}#da "min"#ua +#op ${d - a}#db "min"#ub`, note: `${t1} to ${full} is ${a} min. ${full} to ${t2} is ${d - a} min.` },
      { math: `${d}#da "min"#ua`, highlight: ["da", "ua"], note: `$${a} + ${d - a} = ${d}$. **Answer:** ${c.answer(d, name)}` },
    ],
  };
};

type Conversion = {
  from: string;
  to: string;
  f: number;
  dir: "mul" | "div";
  vals: number[];
  text: (v: string, name: string) => string;
  answer: (r: string, name: string) => string;
};

const CONVERSIONS: Conversion[] = [
  { from: "m", to: "cm", f: 100, dir: "mul", vals: [1.2, 1.5, 2.4, 3.6, 0.8, 2.75, 1.35], text: (v) => `A ribbon is ${v} m long. How long is it in centimetres?`, answer: (r) => `The ribbon is ${r} cm long.` },
  { from: "km", to: "m", f: 1000, dir: "mul", vals: [1.2, 2.5, 0.8, 3.4, 1.25, 0.65], text: (v, n) => `${n}'s way to school is ${v} km long. How many metres is that?`, answer: (r, n) => `${n}'s way to school is ${r} m long.` },
  { from: "kg", to: "g", f: 1000, dir: "mul", vals: [1.5, 2.5, 0.5, 0.75, 1.25, 0.25], text: (v) => `A bag of potatoes weighs ${v} kg. How many grams is that?`, answer: (r) => `The bag weighs ${r} g.` },
  { from: "l", to: "ml", f: 1000, dir: "mul", vals: [1.5, 0.75, 0.5, 2.25, 0.33, 1.25], text: (v) => `A bottle holds ${v} l of water. How many millilitres is that?`, answer: (r) => `The bottle holds ${r} ml.` },
  { from: "h", to: "min", f: 60, dir: "mul", vals: [1.5, 2.5, 0.5, 0.75, 1.25, 1.75], text: (v) => `The school concert lasts ${v} hours. How many minutes is that?`, answer: (r) => `The concert lasts ${r} minutes.` },
  { from: "cm", to: "m", f: 100, dir: "div", vals: [345, 280, 410, 375, 198, 260], text: (v, n) => `${n} jumps ${v} cm in the long jump. How many metres is that?`, answer: (r, n) => `${n} jumps ${r} m.` },
  { from: "g", to: "kg", f: 1000, dir: "div", vals: [2500, 3200, 1800, 4500, 750, 1250], text: (v) => `A watermelon weighs ${v} g. How many kilograms is that?`, answer: (r) => `The watermelon weighs ${r} kg.` },
  { from: "min", to: "h", f: 60, dir: "div", vals: [90, 150, 30, 45, 75, 105], text: (v) => `The train ride takes ${v} minutes. How many hours is that?`, answer: (r) => `The train ride takes ${r} hours.` },
  { from: "ct", to: "€", f: 100, dir: "div", vals: [345, 1280, 95, 560, 2050], text: (v, n) => `${n} has ${v} ct in the piggy bank. How many euros is that?`, answer: (r, n) => `${n} has ${r} €.` },
];

const convert: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  const c = rng.pick(CONVERSIONS);
  const v = rng.pick(c.vals);
  const r = c.dir === "mul" ? v * c.f : v / c.f;
  const fact =
    c.dir === "mul"
      ? { math: `1#a "${c.from}"#ua =#eq ${c.f}#b "${c.to}"#ub`, text: `$1 "${c.from}" = ${c.f} "${c.to}"$` }
      : { math: `${c.f}#a "${c.from}"#ua =#eq 1#b "${c.to}"#ub`, text: `$${c.f} "${c.from}" = 1 "${c.to}"$` };
  return {
    instruction: "Convert the units",
    text: c.text(de(v), name),
    answer: num(r, c.to),
    hint: c.dir === "mul" ? `$1 "${c.from}" = ${c.f} "${c.to}"$. Bigger unit to smaller unit: multiply.` : `$${c.f} "${c.from}" = 1 "${c.to}"$. Smaller unit to bigger unit: divide.`,
    solution: [
      { math: fact.math, note: `**Given:** ${de(v)} ${c.from}. **Wanted:** the same in ${c.to}. The conversion fact: ${fact.text}.` },
      c.dir === "mul"
        ? { math: `${de(v)}#a "${c.from}"#ua =#eq ${de(v)}#n \\cdot#op ${c.f}#b "${c.to}"#ub`, note: `From a bigger unit to a smaller one you get **more** of them: multiply by ${c.f}.` }
        : { math: `${de(v)}#a "${c.from}"#ua =#eq ${de(v)}#n :#op ${c.f}#b "${c.to}"#ub`, note: `From a smaller unit to a bigger one you get **fewer** of them: divide by ${c.f}.` },
      {
        math: `${de(v)}#a "${c.from}"#ua =#eq ${de(r)}#b "${c.to}"#ub`,
        highlight: ["b", "ub"],
        note: `$${de(v)} ${c.dir === "mul" ? "\\cdot" : ":"} ${c.f} = ${de(r)}$. **Answer:** ${c.answer(de(r), name)}`,
      },
    ],
  };
};

const AREAS = [
  { what: "classroom floor", u: "m", a: [7, 10], b: [5, 8], k: 1 },
  { what: "vegetable patch", u: "m", a: [3, 8], b: [2, 4], k: 1 },
  { what: "poster", u: "cm", a: [4, 7], b: [3, 5], k: 10 },
  { what: "photo", u: "cm", a: [12, 15], b: [8, 10], k: 1 },
  { what: "football pitch", u: "m", a: [10, 10], b: [6, 7], k: 10 },
];

const area: Tpl = (rng) => {
  const s = rng.pick(AREAS);
  const a = rng.int(s.a[0], s.a[1]) * s.k;
  let b = rng.int(s.b[0], s.b[1]) * s.k;
  if (b >= a) b = a - s.k;
  const ab = a * b;
  return {
    instruction: SOLVE,
    text: `A rectangular ${s.what} is ${a} ${s.u} long and ${b} ${s.u} wide. What is its area?`,
    answer: num(ab, `${s.u}²`),
    hint: "For a rectangle: area = length · width. The unit gets a little 2.",
    solution: [
      { math: `A#A =#eq a#a \\cdot#op b#b`, note: `**Given:** length ${a} ${s.u}, width ${b} ${s.u}. **Wanted:** the area $A$. For a rectangle: $A = a \\cdot b$.` },
      { math: `A#A =#eq ${a}#a "${s.u}"#ua \\cdot#op ${b}#b "${s.u}"#ub`, note: "Put in the length and the width." },
      {
        math: `A#A =#eq ${ab}#a "${s.u}"#ua^{2#sq}`,
        highlight: ["a", "ua", "sq"],
        note: `$${a} \\cdot ${b} = ${ab}$, and $"${s.u}" \\cdot "${s.u}" = "${s.u}"^2$. **Answer:** The ${s.what} has an area of ${ab} ${s.u}².`,
      },
    ],
  };
};

const PERIMETERS = [
  { what: "sports field", a: [16, 20], b: [10, 14], k: 5 },
  { what: "garden", a: [12, 25], b: [6, 11], k: 1 },
  { what: "school yard", a: [7, 12], b: [4, 6], k: 5 },
  { what: "playground", a: [15, 30], b: [10, 14], k: 1 },
];

const perimeter: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  const s = rng.pick(PERIMETERS);
  const a = rng.int(s.a[0], s.a[1]) * s.k;
  const b = rng.int(s.b[0], s.b[1]) * s.k;
  const p = 2 * a + 2 * b;
  return {
    instruction: SOLVE,
    text: `A rectangular ${s.what} is ${a} m long and ${b} m wide. ${name} walks once all the way around it. How far does ${name} walk?`,
    answer: num(p, "m"),
    hint: "All the way around means the perimeter: two lengths and two widths.",
    solution: [
      { math: `u#U =#eq 2#k1 \\cdot#o1 a#a +#p 2#k2 \\cdot#o2 b#b`, note: `**Given:** length ${a} m, width ${b} m. **Wanted:** the way around, the perimeter $u$: two lengths and two widths.` },
      { math: `u#U =#eq 2#k1 \\cdot#o1 ${a}#a +#p 2#k2 \\cdot#o2 ${b}#b`, note: "Put in the lengths (in m)." },
      { math: `u#U =#eq ${2 * a}#a +#p ${2 * b}#b`, note: `$2 \\cdot ${a} = ${2 * a}$ and $2 \\cdot ${b} = ${2 * b}$.` },
      { math: `u#U =#eq ${p}#a "m"#um`, highlight: ["a", "um"], note: `$${2 * a} + ${2 * b} = ${p}$. **Answer:** ${name} walks ${p} m.` },
    ],
  };
};

const MOVERS: { v: number[]; t: [number, number]; text: (v: number, t: number, name: string) => string; answer: (s: number, name: string) => string }[] = [
  { v: [60, 70, 80, 90, 120], t: [2, 4], text: (v, t) => `A train travels at ${v} km/h for ${t} hours. How far does it travel?`, answer: (s) => `The train travels ${s} km.` },
  { v: [12, 14, 15, 16, 18], t: [2, 4], text: (v, t, n) => `${n} cycles at ${v} km/h for ${t} hours. How far does ${n} get?`, answer: (s, n) => `${n} cycles ${s} km.` },
  { v: [3, 4, 5], t: [2, 6], text: (v, t) => `A hiking group walks at ${v} km/h for ${t} hours. How far does the group walk?`, answer: (s) => `The group walks ${s} km.` },
  { v: [50, 60, 80, 100], t: [2, 5], text: (v, t) => `A coach drives at an average speed of ${v} km/h for ${t} hours. How far does it get?`, answer: (s) => `The coach drives ${s} km.` },
];

const distance: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  const c = rng.pick(MOVERS);
  const v = rng.pick(c.v);
  const t = rng.int(c.t[0], c.t[1]);
  const s = v * t;
  return {
    instruction: SOLVE,
    text: c.text(v, t, name),
    answer: num(s, "km"),
    hint: "Distance = speed · time.",
    solution: [
      { math: `s#S =#eq v#v \\cdot#op t#t`, note: `**Given:** speed ${v} km/h, time ${t} h. **Wanted:** the distance $s$. Distance = speed · time.` },
      { math: `s#S =#eq ${v}#v "km/h"#uv \\cdot#op ${t}#t "h"#ut`, note: "Put in the values with their units." },
      { math: `s#S =#eq ${s}#v "km"#uv`, highlight: ["v", "uv"], note: `$${v} \\cdot ${t} = ${s}$, and km/h times h gives km. **Answer:** ${c.answer(s, name)}` },
    ],
  };
};

const WISHES = ["a skateboard", "new headphones", "a football shirt", "a video game", "inline skates", "a concert ticket"];

const saving: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  const r = rng.pick([5, 6, 8, 10, 12, 15]);
  const w = rng.int(4, 12);
  const total = r * w;
  return {
    instruction: SOLVE,
    text: `${name} wants to buy ${rng.pick(WISHES)} for ${total} €. ${name} saves ${r} € every week. How many weeks does ${name} have to save?`,
    answer: num(w, "weeks"),
    hint: `How often do ${r} € fit into ${total} €?`,
    solution: [
      { math: `"weeks"#w =#eq ?#q`, note: `**Given:** price ${total} €, savings ${r} € per week. **Wanted:** the number of weeks.` },
      { math: `"weeks"#w =#eq ${total}#a "€"#ua :#op ${r}#b "€"#ub`, note: `How often do ${r} € fit into ${total} €? **Divide**.` },
      { math: `"weeks"#w =#eq ${w}#a`, highlight: ["a"], note: `$${total} : ${r} = ${w}$. **Answer:** ${name} has to save for ${w} weeks.` },
    ],
  };
};

// ---------------------------------------------------------------------------
// Level 2: rule of three, speed, units

const UNIT_PRICES: { one: string; many: string; cents: number[]; a: [number, number]; b: [number, number]; text: (a: number, p: string, b: number) => string; answer: (b: number, p: string) => string }[] = [
  { one: "notebook", many: "notebooks", cents: [110, 120, 140, 150, 160, 180], a: [2, 6], b: [3, 12], text: (a, p, b) => `At the school shop, ${a} notebooks cost ${p} €. How much do ${b} notebooks cost?`, answer: (b, p) => `${b} notebooks cost ${p} €.` },
  { one: "roll", many: "rolls", cents: [30, 35, 40, 45, 50, 55], a: [4, 10], b: [3, 15], text: (a, p, b) => `At the bakery, ${a} bread rolls cost ${p} €. How much do ${b} bread rolls cost?`, answer: (b, p) => `${b} bread rolls cost ${p} €.` },
  { one: "kg", many: "kg", cents: [180, 220, 240, 260, 280, 320], a: [2, 5], b: [3, 8], text: (a, p, b) => `${a} kg of apples cost ${p} €. How much do ${b} kg of apples cost?`, answer: (b, p) => `${b} kg of apples cost ${p} €.` },
  { one: "m", many: "m", cents: [400, 600, 750, 800, 1200], a: [2, 5], b: [3, 9], text: (a, p, b) => `${a} m of fabric cost ${p} €. How much do ${b} m of fabric cost?`, answer: (b, p) => `${b} m of fabric cost ${p} €.` },
  { one: "ticket", many: "tickets", cents: [250, 280, 320, 350], a: [2, 5], b: [3, 9], text: (a, p, b) => `${a} bus tickets cost ${p} €. How much do ${b} bus tickets cost?`, answer: (b, p) => `${b} bus tickets cost ${p} €.` },
];

const dreisatz: Tpl = (rng) => {
  const c = rng.pick(UNIT_PRICES);
  const u = rng.pick(c.cents);
  const a = rng.int(c.a[0], c.a[1]);
  let b = rng.int(c.b[0], c.b[1]);
  if (b === a) b = a + 1;
  let text = c.text(a, eur(a * u), b);
  let given = `**Given:** ${a} ${c.many} cost ${eur(a * u)} €. **Wanted:** the price of ${b} ${c.many}.`;
  if (rng.chance(0.35)) {
    const t = rng.int(7, 9);
    text = withExtra(text, `The shop opens at ${t} o'clock.`);
    given += " The opening time doesn't matter.";
  }
  return {
    instruction: SOLVE,
    text,
    answer: num((b * u) / 100, "€"),
    hint: `Rule of three: first find the price of **one**, then multiply.`,
    solution: ruleOfThree({
      a,
      va: (a * u) / 100,
      b,
      one: c.one,
      many: c.many,
      unit: "€",
      money: true,
      given,
      why: `More ${c.many}, higher price: proportional. Go to **one** first: divide both sides by ${a}.`,
      oneNote: `So 1 ${c.one} costs ${eur(u)} €.`,
      answer: `**Answer:** ${c.answer(b, eur(b * u))}`,
    }),
  };
};

const RECIPES = [
  { what: "flour", unit: "g", per: [50, 75, 100, 125], dish: "pancakes" },
  { what: "milk", unit: "ml", per: [50, 75, 100, 125, 150], dish: "pancakes" },
  { what: "pasta", unit: "g", per: [100, 125, 150], dish: "spaghetti" },
  { what: "rice", unit: "g", per: [60, 75, 80], dish: "a rice dish" },
  { what: "butter", unit: "g", per: [15, 20, 25, 30], dish: "a cake" },
];

const recipe: Tpl = (rng) => {
  const r = rng.pick(RECIPES);
  const per = rng.pick(r.per);
  const a = rng.int(2, 6);
  let b = rng.int(2, 10);
  if (b === a) b = a + 2;
  let text = `A recipe for ${r.dish} for ${a} people needs ${a * per} ${r.unit} of ${r.what}. How much ${r.what} do you need for ${b} people?`;
  let given = `**Given:** ${a} people need ${a * per} ${r.unit}. **Wanted:** the amount for ${b} people.`;
  if (rng.chance(0.35)) {
    text = withExtra(text, `Cooking takes ${rng.int(3, 8) * 5} minutes.`);
    given += " The cooking time doesn't matter.";
  }
  return {
    instruction: SOLVE,
    text,
    answer: num(b * per, r.unit),
    hint: "Rule of three: how much does **one** person need?",
    solution: ruleOfThree({
      a,
      va: a * per,
      b,
      one: "person",
      many: "people",
      unit: r.unit,
      given,
      why: `More people need more ${r.what}: proportional. Go to **one** person first: divide both sides by ${a}.`,
      oneNote: `1 person needs ${per} ${r.unit}.`,
      answer: `**Answer:** For ${b} people you need ${b * per} ${r.unit} of ${r.what}.`,
    }),
  };
};

const SPEEDS: { v: number[]; t: [number, number]; text: (s: number, t: number, name: string) => string; who: (name: string) => string }[] = [
  { v: [12, 14, 15, 16, 18, 20], t: [2, 4], text: (s, t, n) => `${n} cycles ${s} km in ${t} hours. What is ${n}'s average speed?`, who: (n) => `${n}'s average speed` },
  { v: [50, 60, 70, 80, 90, 100], t: [2, 4], text: (s, t) => `A car drives ${s} km in ${t} hours. What is its average speed?`, who: () => "The car's average speed" },
  { v: [80, 100, 120, 140, 160], t: [2, 3], text: (s, t) => `A train travels ${s} km in ${t} hours. What is its average speed?`, who: () => "The train's average speed" },
  { v: [4, 5, 6], t: [2, 5], text: (s, t, n) => `${n} hikes ${s} km in ${t} hours. What is ${n}'s average speed?`, who: (n) => `${n}'s average speed` },
];

const speedV: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  const c = rng.pick(SPEEDS);
  const v = rng.pick(c.v);
  const t = rng.int(c.t[0], c.t[1]);
  const s = v * t;
  let text = c.text(s, t, name);
  let given = `**Given:** ${s} km in ${t} h. **Wanted:** the speed $v$. Speed = distance : time.`;
  if (rng.chance(0.3)) {
    text = withExtra(text, `It is ${rng.int(18, 28)} °C outside.`);
    given += " The temperature doesn't matter.";
  }
  return {
    instruction: SOLVE,
    text,
    answer: num(v, "km/h"),
    hint: "Speed = distance : time. In km/h: how many km in **one** hour?",
    solution: [
      { math: `v#V =#eq \\frac{s#s}{t#t}`, note: given },
      { math: `v#V =#eq \\frac{${s}#s "km"#us}{${t}#t "h"#ut}`, note: "Put in the values with their units." },
      { math: `v#V =#eq ${v}#s "km/h"#us`, highlight: ["s", "us"], note: `$${s} : ${t} = ${v}$, that's km per hour. **Answer:** ${c.who(name)} is ${v} km/h.` },
    ],
  };
};

const speedT: Tpl = (rng) => {
  const v = rng.pick([60, 80, 100, 120]);
  const halves = rng.int(3, 9);
  const t = halves / 2;
  const s = v * t;
  const what = rng.pick(["A car", "A coach", "A delivery van"]);
  const minutes = t % 1 ? ` That's ${Math.floor(t)} h 30 min.` : "";
  return {
    instruction: SOLVE,
    text: `${what} drives ${s} km at an average speed of ${v} km/h. How many hours does the journey take?`,
    answer: num(t, "h"),
    hint: "Time = distance : speed. How often do the km of one hour fit into the whole distance?",
    solution: [
      { math: `t#T =#eq \\frac{s#s}{v#v}`, note: `**Given:** ${s} km at ${v} km/h. **Wanted:** the time $t$. Time = distance : speed.` },
      { math: `t#T =#eq \\frac{${s}#s "km"#us}{${v}#v "km/h"#uv}`, note: "Put in the values with their units." },
      { math: `t#T =#eq ${de(t)}#s "h"#us`, highlight: ["s", "us"], note: `$${s} : ${v} = ${de(t)}$. **Answer:** The journey takes ${de(t)} h.${minutes}` },
    ],
  };
};

const COUNTS: { big: string; small: string; f: number; vals: number[]; parts: number[]; noun: string; text: (v: string, p: number, name: string) => string; answer: (n: number, name: string) => string }[] = [
  { big: "l", small: "ml", f: 1000, vals: [1, 1.5, 2, 3], parts: [200, 250, 300], noun: "glasses", text: (v, p) => `A ${v} l bottle of juice is poured into glasses of ${p} ml. How many glasses can be filled?`, answer: (n) => `${n} glasses can be filled.` },
  { big: "m", small: "cm", f: 100, vals: [2, 3, 4, 5, 6], parts: [20, 25, 40, 50, 75], noun: "pieces", text: (v, p, n) => `${n} cuts a ${v} m long ribbon into pieces of ${p} cm. How many pieces does ${n} get?`, answer: (k, n) => `${n} gets ${k} pieces.` },
  { big: "km", small: "cm", f: 100000, vals: [0.6, 0.9, 1.2, 1.5], parts: [50, 60, 75], noun: "steps", text: (v, p, n) => `${n}'s way to school is ${v} km long. One step of ${n} is ${p} cm long. How many steps is the way to school?`, answer: (k) => `The way to school is ${k} steps.` },
  { big: "kg", small: "g", f: 1000, vals: [1, 1.5, 2, 2.5], parts: [125, 250, 500], noun: "bags", text: (v, p) => `A baker fills ${v} kg of cookies into bags of ${p} g. How many bags does the baker fill?`, answer: (k) => `The baker fills ${k} bags.` },
];

const unitsCount: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  const c = rng.pick(COUNTS);
  let v = rng.pick(c.vals);
  let p = rng.pick(c.parts);
  for (let i = 0; i < 20 && Math.round(v * c.f) % p !== 0; i++) {
    v = rng.pick(c.vals);
    p = rng.pick(c.parts);
  }
  if (Math.round(v * c.f) % p !== 0) {
    v = c.vals[0];
    p = c.parts[0];
  }
  const total = Math.round(v * c.f);
  const n = total / p;
  return {
    instruction: SOLVE,
    text: c.text(de(v), p, name),
    answer: num(n, c.noun),
    hint: `Use the same unit first: change ${c.big} into ${c.small}. Then divide.`,
    solution: [
      {
        math: `${de(v)}#a "${c.big}"#ua =#eq ${total}#b "${c.small}"#ub`,
        note: `**Given:** ${de(v)} ${c.big} and ${p} ${c.small}. **Wanted:** the number of ${c.noun}. Same unit first: $1 "${c.big}" = ${c.f} "${c.small}"$.`,
      },
      { math: `${total}#b "${c.small}"#ub :#op ${p}#p "${c.small}"#up`, note: `Now divide: how often does ${p} ${c.small} fit into ${total} ${c.small}?` },
      { math: `${total}#b "${c.small}"#ub :#op ${p}#p "${c.small}"#up =#eq ${n}#n`, highlight: ["n"], note: `$${total} : ${p} = ${n}$. **Answer:** ${c.answer(n, name)}` },
    ],
  };
};

const CENTS = [
  { one: "pencil", many: "pencils", c: [45, 65, 75, 85, 95] },
  { one: "stamp", many: "stamps", c: [85, 95] },
  { one: "bread roll", many: "bread rolls", c: [35, 40, 45, 55] },
  { one: "pack of gum", many: "packs of gum", c: [65, 75, 90] },
];

const centsToEuro: Tpl = (rng) => {
  const g = rng.pick(CENTS);
  const c = rng.pick(g.c);
  const n = rng.int(4, 12);
  const total = n * c;
  return {
    instruction: SOLVE,
    text: `One ${g.one} costs ${c} ct. How much do ${n} ${g.many} cost? Give the answer in euros.`,
    answer: num(total / 100, "€"),
    hint: "Multiply first. Then change cents into euros: 100 ct = 1 €.",
    solution: [
      { math: `"total"#w =#eq ${n}#n \\cdot#op ${c}#c "ct"#u`, note: `**Given:** ${n} ${g.many} at ${c} ct. **Wanted:** the total in €. First multiply.` },
      { math: `"total"#w =#eq ${total}#c "ct"#u`, note: `$${n} \\cdot ${c} = ${total}$, so ${total} ct.` },
      { math: `"total"#w =#eq ${eur(total)}#c "€"#u`, highlight: ["c", "u"], note: `100 ct = 1 €, so divide by 100. **Answer:** ${n} ${g.many} cost ${eur(total)} €.` },
    ],
  };
};

const TEAMS = [
  { who: "The football club", verb: "trains" },
  { who: "The swimming team", verb: "trains" },
  { who: "The school band", verb: "rehearses" },
  { who: "The dance group", verb: "practises" },
];

const trainingHours: Tpl = (rng) => {
  const t = rng.pick(TEAMS);
  const k = rng.int(2, 4);
  const m = rng.pick([45, 60, 75, 90, 120]);
  const total = k * m;
  const h = total / 60;
  return {
    instruction: SOLVE,
    text: `${t.who} ${t.verb} ${k} times a week for ${m} minutes each time. How many hours is that per week?`,
    answer: num(h, "h"),
    hint: "First the minutes per week. Then change into hours: 60 min = 1 h.",
    solution: [
      { math: `"time"#w =#eq ${k}#k \\cdot#op ${m}#m "min"#u`, note: `**Given:** ${k} times ${m} min. **Wanted:** the time per week in hours. First the minutes.` },
      { math: `"time"#w =#eq ${total}#m "min"#u`, note: `$${k} \\cdot ${m} = ${total}$ minutes per week.` },
      { math: `"time"#w =#eq ${de(h)}#m "h"#u`, highlight: ["m", "u"], note: `60 min = 1 h: $${total} : 60 = ${de(h)}$. **Answer:** That's ${de(h)} hours per week.` },
    ],
  };
};

// ---------------------------------------------------------------------------
// Level 3: inverse proportion, two steps, mixed units

const divisors = (n: number, lo: number, hi: number) => {
  const out: number[] = [];
  for (let d = lo; d <= hi; d++) if (n % d === 0) out.push(d);
  return out;
};

const INVERSE: {
  one: string;
  many: string;
  unit: string;
  answerUnit: string;
  money?: boolean;
  P: number[];
  range: [number, number];
  text: (a: number, va: string, b: number) => string;
  why: (a: number) => string;
  oneNote: (v: string) => string;
  answer: (b: number, v: string) => string;
}[] = [
  {
    one: "painter", many: "painters", unit: "days", answerUnit: "days", P: [12, 18, 24, 30, 36, 40, 48], range: [2, 8],
    text: (a, va, b) => `${a} painters need ${va} days to paint the school building. How many days would ${b} painters need, if everyone works equally fast?`,
    why: (a) => `More painters need **less** time: inverse. 1 painter needs ${a} times as long: divide the left side by ${a}, but **multiply** the right side.`,
    oneNote: (v) => `1 painter alone would need ${v} days.`,
    answer: (b, v) => `${b} painters need ${v} days.`,
  },
  {
    one: "pump", many: "pumps", unit: "h", answerUnit: "h", P: [12, 18, 24, 30, 36], range: [2, 6],
    text: (a, va, b) => `${a} pumps empty the swimming pool in ${va} hours. How long do ${b} pumps take?`,
    why: (a) => `More pumps are **faster**: inverse. 1 pump takes ${a} times as long: divide the left side by ${a}, but **multiply** the right side.`,
    oneNote: (v) => `1 pump alone would take ${v} hours.`,
    answer: (b, v) => `${b} pumps take ${v} hours.`,
  },
  {
    one: "horse", many: "horses", unit: "days", answerUnit: "days", P: [24, 30, 36, 48, 60, 72], range: [2, 9],
    text: (a, va, b) => `A farmer's hay lasts ${va} days for ${a} horses. How many days does it last for ${b} horses?`,
    why: (a) => `More horses eat the hay **sooner**: inverse. For 1 horse it lasts ${a} times as long: divide left, but **multiply** right.`,
    oneNote: (v) => `For 1 horse the hay would last ${v} days.`,
    answer: (b, v) => `For ${b} horses the hay lasts ${v} days.`,
  },
  {
    one: "friend", many: "friends", unit: "€", answerUnit: "€", money: true, P: [36, 48, 60, 72, 90, 96, 120], range: [3, 12],
    text: (a, va, b) => `${a} friends share the cost of a party equally. Each of them pays ${va} €. How much would each pay if ${b} friends shared the cost?`,
    why: (a) => `More friends, each pays **less**: inverse. 1 friend alone would pay ${a} times as much: divide left, but **multiply** right.`,
    oneNote: (v) => `1 friend alone would pay ${v} €.`,
    answer: (b, v) => `With ${b} friends, each pays ${v} €.`,
  },
];

const inverse: Tpl = (rng) => {
  const c = rng.pick(INVERSE);
  let P = rng.pick(c.P);
  let ds = divisors(P, c.range[0], c.range[1]);
  for (let i = 0; i < 20 && ds.length < 2; i++) {
    P = rng.pick(c.P);
    ds = divisors(P, c.range[0], c.range[1]);
  }
  const [a, b] = rng.shuffle(ds);
  const va = P / a;
  const vb = P / b;
  const f = (v: number) => (c.money ? eur(v * 100) : de(v));
  return {
    instruction: SOLVE,
    text: c.text(a, f(va), b),
    answer: num(vb, c.answerUnit),
    hint: `Careful: more ${c.many} means **less**. What would 1 ${c.one} alone mean? Then go to ${b}.`,
    solution: ruleOfThree({
      a,
      va,
      b,
      one: c.one,
      many: c.many,
      unit: c.unit,
      inverse: true,
      money: c.money,
      given: `**Given:** ${a} ${c.many} → ${f(va)} ${c.unit}. **Wanted:** the value for ${b} ${c.many}.`,
      why: c.why(a),
      oneNote: c.oneNote(f(P)),
      answer: `**Answer:** ${c.answer(b, f(vb))} Check: $${a} \\cdot ${f(va)} = ${b} \\cdot ${f(vb)} = ${f(P)}$.`,
    }),
  };
};

const ITEMS = [
  { many: "bottles of juice", cents: [120, 140, 150, 190] },
  { many: "packs of pasta", cents: [90, 110, 130] },
  { many: "bars of chocolate", cents: [80, 90, 120, 140] },
  { many: "magazines", cents: [250, 290, 350] },
  { many: "bags of crisps", cents: [130, 150, 180] },
];

const twoStepShopping: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  const [i1, i2] = rng.shuffle(ITEMS);
  const n1 = rng.int(2, 4);
  const n2 = rng.int(2, 4);
  const p1 = rng.pick(i1.cents);
  const p2 = rng.pick(i2.cents);
  const c1 = n1 * p1;
  const c2 = n2 * p2;
  const cost = c1 + c2;
  const note = cost <= 900 ? 10 : cost <= 1900 ? 20 : 50;
  const r = note * 100 - cost;
  let text = `${name} buys ${n1} ${i1.many} at ${eur(p1)} € each and ${n2} ${i2.many} at ${eur(p2)} € each. ${name} pays with a ${note} € note. How much change does ${name} get?`;
  let given = `**Given:** the two kinds of items and the ${note} € note. **Wanted:** the change.`;
  if (rng.chance(0.35)) {
    text = withExtra(text, `${name} is ${rng.int(11, 16)} years old.`);
    given += ` ${name}'s age doesn't matter.`;
  }
  given += " Step 1: the total cost.";
  return {
    instruction: SOLVE,
    text,
    answer: num(r / 100, "€"),
    hint: "Two steps: first the total cost of everything, then the change.",
    solution: [
      { math: `"cost"#w =#eq ${n1}#n1 \\cdot#o1 ${eur(p1)}#p1 +#pl ${n2}#n2 \\cdot#o2 ${eur(p2)}#p2`, note: given },
      { math: `"cost"#w =#eq ${eur(c1)}#p1 +#pl ${eur(c2)}#p2`, note: `$${n1} \\cdot ${eur(p1)} = ${eur(c1)}$ and $${n2} \\cdot ${eur(p2)} = ${eur(c2)}$.` },
      { math: `"cost"#w =#eq ${eur(cost)}#p1 "€"#u`, note: `Together everything costs ${eur(cost)} €.` },
      { math: `"change"#w2 =#eq ${note}#nt "€"#un -#mi ${eur(cost)}#p1 "€"#u`, note: `Step 2: subtract the cost from the ${note} €.` },
      { math: `"change"#w2 =#eq ${eur(r)}#nt "€"#un`, highlight: ["nt", "un"], note: `**Answer:** ${name} gets ${eur(r)} € change.` },
    ],
  };
};

const fenceCost: Tpl = (rng) => {
  const a = rng.int(8, 20);
  const b = rng.int(5, Math.min(12, a - 1));
  const c = rng.pick([5, 6, 8, 10, 12, 15]);
  const p = 2 * a + 2 * b;
  let text = `A rectangular garden is ${a} m long and ${b} m wide. It gets a fence all the way around. One metre of fence costs ${c} €. How much does the fence cost?`;
  let given = `**Given:** ${a} m by ${b} m, ${c} € per metre. **Wanted:** the cost.`;
  if (rng.chance(0.35)) {
    text = withExtra(text, `The family's dog is ${rng.int(2, 9)} years old.`);
    given += " The dog's age doesn't matter.";
  }
  given += ' Step 1: "all the way around" means the perimeter.';
  return {
    instruction: SOLVE,
    text,
    answer: num(p * c, "€"),
    hint: "Two steps: the perimeter first ($u = 2 \\cdot a + 2 \\cdot b$), then the price for all the metres.",
    solution: [
      { math: `u#U =#eq 2#k1 \\cdot#o1 ${a}#a +#p 2#k2 \\cdot#o2 ${b}#b`, note: given },
      { math: `u#U =#eq ${p}#a "m"#um`, note: `$${2 * a} + ${2 * b} = ${p}$: the fence is ${p} m long.` },
      { math: `"cost"#w =#eq ${p}#a \\cdot#op ${c}#c "€"#ue`, note: `Step 2: every metre costs ${c} €, so multiply.` },
      { math: `"cost"#w =#eq ${p * c}#a "€"#ue`, highlight: ["a", "ue"], note: `$${p} \\cdot ${c} = ${p * c}$. **Answer:** The fence costs ${p * c} €.` },
    ],
  };
};

const tileCost: Tpl = (rng) => {
  const a = rng.int(3, 8);
  const b = rng.int(2, Math.min(6, a - 1));
  const c = rng.pick([15, 20, 25, 30, 40]);
  const ab = a * b;
  const room = rng.pick(["kitchen", "bathroom", "hallway", "classroom"]);
  return {
    instruction: SOLVE,
    text: `The floor of a rectangular ${room} is ${a} m long and ${b} m wide. It gets new tiles. One square metre of tiles costs ${c} €. How much do the tiles cost?`,
    answer: num(ab * c, "€"),
    hint: "Two steps: the area first ($A = a \\cdot b$), then the price for all the square metres.",
    solution: [
      { math: `A#A =#eq ${a}#a "m"#ua \\cdot#op ${b}#b "m"#ub`, note: `**Given:** ${a} m by ${b} m, ${c} € per m². **Wanted:** the cost. Step 1: the area.` },
      { math: `A#A =#eq ${ab}#a "m"#ua^{2#sq}`, note: `$${a} \\cdot ${b} = ${ab}$: the floor has ${ab} m².` },
      { math: `"cost"#w =#eq ${ab}#a \\cdot#op ${c}#c "€"#ue`, note: `Step 2: every m² costs ${c} €, so multiply.` },
      { math: `"cost"#w =#eq ${ab * c}#a "€"#ue`, highlight: ["a", "ue"], note: `$${ab} \\cdot ${c} = ${ab * c}$. **Answer:** The tiles cost ${ab * c} €.` },
    ],
  };
};

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

const speedMinutes: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  const m = rng.pick([15, 20, 30, 40, 45, 90]);
  const g = gcd(m, 60);
  const options: number[] = [];
  for (let v = 12; v <= 30; v++) if ((v * g) % 60 === 0) options.push(v);
  const v = rng.pick(options);
  const s = (v * m) / 60;
  const sg = (v * g) / 60;
  const k = 60 / g;
  const q = m / g;
  const row = (l: number, r: number, unit = "km", ops?: [string, string]) => {
    const core = `${l}#a "min"#ua \\to#ar ${r}#b "${unit}"#ub`;
    return ops ? `\\blob{${ops[0]}} \\quad ${core} \\quad \\blob{${ops[1]}}` : core;
  };
  const frames: Frame[] = [{ math: row(m, s), note: `**Given:** ${s} km in ${m} min. **Wanted:** km per **hour**, and 1 h = 60 min.` }];
  if (q > 1) {
    frames.push(
      { math: row(m, s, "km", [`:#d1 ${q}#d1n`, `:#d2 ${q}#d2n`]), note: `${m} min and 60 min are both multiples of ${g} min. Go to ${g} min first: divide both sides by ${q}.` },
      { math: row(g, sg), note: `In ${g} min, ${name} cycles ${de(sg)} km.` },
    );
  }
  frames.push(
    { math: row(g, sg, "km", [`\\cdot#m1 ${k}#m1n`, `\\cdot#m2 ${k}#m2n`]), note: `60 min are ${k} times ${g} min: multiply both sides by ${k}.` },
    { math: row(60, v), note: `In 60 min, so in one hour: ${v} km.` },
    { math: `v#V =#eq ${v}#b "km/h"#ub`, highlight: ["b", "ub"], note: `**Answer:** ${name}'s average speed is ${v} km/h.` },
  );
  return {
    instruction: SOLVE,
    text: `${name} cycles ${de(s)} km in ${m} minutes. What is ${name}'s average speed in km/h?`,
    answer: num(v, "km/h"),
    hint: "km/h means: km in **60** minutes. Use the rule of three on the minutes.",
    solution: frames,
  };
};

const runMinutes: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  let v = rng.pick([6, 8, 9, 10, 12]);
  let M = rng.pick([30, 45, 75, 90, 105, 120]);
  for (let i = 0; i < 20 && (v * M) % 60 !== 0; i++) {
    v = rng.pick([6, 8, 9, 10, 12]);
    M = rng.pick([30, 45, 75, 90, 105, 120]);
  }
  if ((v * M) % 60 !== 0) {
    v = 8;
    M = 45;
  }
  const s = (v * M) / 60;
  const th = M / 60;
  return {
    instruction: SOLVE,
    text: `${name} runs ${s} km at an average speed of ${v} km/h. How many minutes does the run take?`,
    answer: num(M, "min"),
    hint: "Time = distance : speed gives hours. Then change hours into minutes: 1 h = 60 min.",
    solution: [
      { math: `t#T =#eq \\frac{s#s}{v#v}`, note: `**Given:** ${s} km at ${v} km/h. **Wanted:** the time in minutes. Time = distance : speed.` },
      { math: `t#T =#eq \\frac{${s}#s "km"#us}{${v}#v "km/h"#uv}`, note: "Put in the values." },
      { math: `t#T =#eq ${de(th)}#s "h"#us`, note: `$${s} : ${v} = ${de(th)}$, in hours.` },
      { math: `t#T =#eq ${de(th)}#s \\cdot#op 60#k "min"#us`, note: "1 h = 60 min, so multiply by 60." },
      { math: `t#T =#eq ${M}#s "min"#us`, highlight: ["s", "us"], note: `$${de(th)} \\cdot 60 = ${M}$. **Answer:** The run takes ${M} minutes.` },
    ],
  };
};

const budget: Tpl = (rng) => {
  const p = rng.pick([12, 15, 18, 20, 24, 25]);
  const k = rng.int(8, 25);
  const net = rng.int(8, 24) * 5;
  const rest = rng.chance(0.4) ? rng.int(1, p - 1) : 0;
  const B = net + k * p + rest;
  const left = B - net;
  let text = `The football club has ${B} € to spend. First it buys a new goal net for ${net} €. With the rest of the money it buys balls at ${p} € each. How many balls can the club buy${rest ? " at most" : ""}?`;
  let given = `**Given:** ${B} €, the net costs ${net} €, a ball ${p} €. **Wanted:** the number of balls.`;
  if (rng.chance(0.35)) {
    text = withExtra(text, `The club has ${rng.int(8, 25) * 10} members.`);
    given += " The number of members doesn't matter.";
  }
  given += " Step 1: the money left after the net.";
  return {
    instruction: SOLVE,
    text,
    answer: num(k, "balls"),
    hint: "Two steps: what's left after the net? Then: how many balls fit into that?",
    solution: [
      { math: `"rest"#w =#eq ${B}#a "€"#ua -#op ${net}#b "€"#ub`, note: given },
      { math: `"rest"#w =#eq ${left}#a "€"#ua`, note: `$${B} - ${net} = ${left}$. That's what's left.` },
      { math: `"balls"#w2 =#eq ${left}#a "€"#ua :#op2 ${p}#c "€"#uc`, note: `Step 2: how often do ${p} € fit into ${left} €?` },
      {
        math: `"balls"#w2 =#eq ${k}#a`,
        highlight: ["a"],
        note: rest
          ? `$${k} \\cdot ${p} = ${k * p}$, and ${rest} € are left over. That's not enough for another ball. **Answer:** The club can buy ${k} balls.`
          : `$${left} : ${p} = ${k}$. **Answer:** The club can buy ${k} balls.`,
      },
    ],
  };
};

const PLACES = ["the seaside", "Grandma's house", "the holiday camp", "the mountains", "the theme park"];

const speedInverse: Tpl = (rng) => {
  const options: [number, number, number][] = [];
  for (const D of [120, 180, 240, 300, 360])
    for (const va of [40, 60, 80, 90, 100, 120])
      for (const vb of [40, 60, 80, 90, 100, 120]) {
        if (va === vb) continue;
        const ta = D / va;
        const tb = D / vb;
        if ((ta * 2) % 1 === 0 && (tb * 2) % 1 === 0 && ta >= 1 && tb >= 1 && ta <= 6 && tb <= 6) options.push([D, va, vb]);
      }
  const [D, va, vb] = rng.pick(options);
  const ta = D / va;
  const tb = D / vb;
  return {
    instruction: SOLVE,
    text: `At ${va} km/h, the drive to ${rng.pick(PLACES)} takes ${de(ta)} hours. How many hours does the drive take at ${vb} km/h?`,
    answer: num(tb, "h"),
    hint: "The distance stays the same. Work it out first: distance = speed · time.",
    solution: [
      { math: `s#S =#eq ${va}#va "km/h"#uva \\cdot#op ${de(ta)}#ta "h"#uta`, note: `**Given:** ${de(ta)} h at ${va} km/h. **Wanted:** the time at ${vb} km/h. The distance stays the same, so find it first.` },
      { math: `s#S =#eq ${D}#d "km"#ud`, note: `$${va} \\cdot ${de(ta)} = ${D}$: the drive is ${D} km long.` },
      { math: `t#T =#eq \\frac{${D}#d "km"#ud}{${vb}#vb "km/h"#uvb}`, note: "Now time = distance : speed." },
      { math: `t#T =#eq ${de(tb)}#d "h"#ud`, highlight: ["d", "ud"], note: `$${D} : ${vb} = ${de(tb)}$. **Answer:** At ${vb} km/h the drive takes ${de(tb)} hours.` },
    ],
  };
};

const mixedArea: Tpl = (rng) => {
  const what = rng.pick(["rug", "table top", "banner", "poster"]);
  const a = rng.pick([1.5, 2, 2.5, 3, 4]);
  const bcm = rng.pick([40, 50, 60, 80]);
  const bm = bcm / 100;
  const A = Math.round(a * bm * 100) / 100;
  return {
    instruction: SOLVE,
    text: `A rectangular ${what} is ${de(a)} m long and ${bcm} cm wide. What is its area in m²?`,
    answer: num(A, "m²"),
    hint: "Mixed units! Change the cm into m first (100 cm = 1 m), then multiply.",
    solution: [
      { math: `${bcm}#b "cm"#ub =#eq ${de(bm)}#c "m"#uc`, note: `**Given:** ${de(a)} m and ${bcm} cm. **Wanted:** the area in m². Mixed units, so convert first: 100 cm = 1 m.` },
      { math: `A#A =#eq ${de(a)}#a "m"#ua \\cdot#op ${de(bm)}#c "m"#uc`, note: "Now both lengths are in m. Area = length · width." },
      { math: `A#A =#eq ${de(A)}#a "m"#ua^{2#sq}`, highlight: ["a", "ua", "sq"], note: `$${de(a)} \\cdot ${de(bm)} = ${de(A)}$. **Answer:** The ${what} has an area of ${de(A)} m².` },
    ],
  };
};

const LEVELS: Record<Level, Tpl[]> = {
  1: [buyMany, share, change, duration, convert, area, perimeter, distance, saving],
  2: [dreisatz, recipe, speedV, speedT, unitsCount, centsToEuro, trainingHours, dreisatz],
  3: [inverse, twoStepShopping, fenceCost, tileCost, speedMinutes, runMinutes, budget, speedInverse, mixedArea, inverse],
};

function generate(level: Level, rng: Rng): Exercise {
  for (let tries = 0; tries < 20; tries++) {
    const ex = rng.pick(LEVELS[level])(rng);
    const v = ex.answer.kind === "number" ? ex.answer.value : 1;
    if (Number.isFinite(v) && v > 0 && v < 100000) return ex;
  }
  return buyMany(rng);
}

// ---------------------------------------------------------------------------
// Widget 1: spot what's given, what's wanted, and what isn't needed.

type SpotStory = { text: string; extras: string[]; op: string; calc: string[]; answer: string };

const SPOT_STORIES: SpotStory[] = [
  {
    text: "Mia is {x:13 years old}. She buys {g:4 tickets} for the cinema. One ticket costs {g:9 €}. {w:How much does Mia pay in total?}",
    extras: ["Mia's age doesn't change the price. Cross it out!"],
    op: "The same price 4 times: **multiply**.",
    calc: ['4 \\cdot 9 "€" = 36 "€"'],
    answer: "Mia pays 36 € in total.",
  },
  {
    text: "On a school trip, the {x:26 students} of class 7b cycle {g:48 km}. Their bikes have {x:21 gears}. The tour takes {g:3 hours}. {w:What is their average speed?}",
    extras: ["The number of students doesn't change the speed.", "The gears don't matter for this question. Cross them out!"],
    op: "Speed is distance divided by time.",
    calc: ['v = 48 "km" : 3 "h" = 16 "km/h"'],
    answer: "They cycle at 16 km/h on average.",
  },
  {
    text: "Emma's recipe for {g:12 muffins} needs {g:300 g of flour}. The muffins bake for {x:25 minutes}. Emma wants to bake {g:20 muffins}. {w:How much flour does she need?}",
    extras: ["The baking time has nothing to do with the flour."],
    op: "Rule of three: first 1 muffin, then 20.",
    calc: ['300 "g" : 12 = 25 "g"', '20 \\cdot 25 "g" = 500 "g"'],
    answer: "Emma needs 500 g of flour.",
  },
  {
    text: "The Kaya family's garden is {g:15 m} long and {g:8 m} wide. Their dog Bello is {x:4 years} old. {w:How long is a fence all the way around the garden?}",
    extras: ["Bello is cute, but his age doesn't help here!"],
    op: "All the way around means the perimeter: two lengths and two widths.",
    calc: ['u = 2 \\cdot 15 "m" + 2 \\cdot 8 "m" = 46 "m"'],
    answer: "The fence is 46 m long.",
  },
  {
    text: "The football club has {x:120 members}. It buys {g:15 new balls}. One ball costs {g:24 €}. {w:How much do the balls cost altogether?}",
    extras: ["The number of members doesn't change the price of the balls."],
    op: "The same price 15 times: **multiply**.",
    calc: ['15 \\cdot 24 "€" = 360 "€"'],
    answer: "The balls cost 360 € altogether.",
  },
];

type SpotPart = { kind: "text"; text: string } | { kind: "g" | "w" | "x"; text: string; id: number; extra: number };

function parseStory(src: string): SpotPart[] {
  const out: SpotPart[] = [];
  const re = /\{([gwx]):([^}]+)\}/g;
  let last = 0;
  let id = 0;
  let extra = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m.index > last) out.push({ kind: "text", text: src.slice(last, m.index) });
    const kind = m[1] as "g" | "w" | "x";
    out.push({ kind, text: m[2], id: id++, extra: kind === "x" ? extra++ : -1 });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ kind: "text", text: src.slice(last) });
  return out;
}

const FOUND = ["Yes, you need that one.", "Right, that's given.", "Good eye! That number matters.", "Exactly, that's part of the maths."];
const spring = { type: "spring" as const, stiffness: 420, damping: 32 };

function BlobSays({ text, mood }: { text: string; mood: BlobMood }) {
  return (
    <div className="flex items-end gap-2.5">
      <div className="shrink-0">
        <Blob size={52} mood={mood} track={false} accessory="glasses" interactive={false} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={text}
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
          transition={spring}
          style={{ transformOrigin: "bottom left" }}
          className="mb-2 rounded-2xl rounded-bl-md border border-line bg-raised px-3.5 py-2 text-[14px] leading-snug text-ink shadow-card"
        >
          <Inline text={text} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function GivenWanted() {
  const [n, setN] = useState(0);
  return <SpotRound key={n} story={SPOT_STORIES[n % SPOT_STORIES.length]} index={n % SPOT_STORIES.length} onNext={() => setN((v) => v + 1)} />;
}

function SpotRound({ story, index, onNext }: { story: SpotStory; index: number; onNext: () => void }) {
  const scope = useId();
  const parts = parseStory(story.text);
  const tappable = parts.filter((p): p is Extract<SpotPart, { id: number }> => p.kind !== "text");
  const needed = tappable.filter((p) => p.kind !== "x");
  const [picked, setPicked] = useState<number[]>([]);
  const [crossed, setCrossed] = useState<number[]>([]);
  const [shake, setShake] = useState({ id: -1, n: 0 });
  const [say, setSay] = useState<{ text: string; mood: BlobMood }>({ text: "Tap every number you need, and the question.", mood: "happy" });
  const done = needed.every((p) => picked.includes(p.id));
  const found = needed.filter((p) => picked.includes(p.id)).length;

  function tap(p: Extract<SpotPart, { id: number }>) {
    if (done || picked.includes(p.id)) return;
    if (p.kind === "x") {
      if (!crossed.includes(p.id)) setCrossed((c) => [...c, p.id]);
      setShake((s) => ({ id: p.id, n: s.n + 1 }));
      setSay({ text: story.extras[p.extra] ?? "That one isn't needed.", mood: "thinking" });
      return;
    }
    const next = [...picked, p.id];
    setPicked(next);
    const finished = needed.every((q) => next.includes(q.id));
    if (finished) setSay({ text: "All found! Now the maths is easy.", mood: "excited" });
    else if (p.kind === "w") setSay({ text: "That's the question. Now you know what you're looking for.", mood: "happy" });
    else setSay({ text: FOUND[next.length % FOUND.length], mood: "happy" });
  }

  const chip = (p: Extract<SpotPart, { id: number }>) => (
    <motion.span
      key={p.id}
      layoutId={`${scope}-${p.id}`}
      layout="position"
      transition={spring}
      className={cn(
        "inline-flex rounded-lg px-2.5 py-1 text-[14.5px] font-medium leading-snug",
        p.kind === "w" ? "bg-blob text-white" : "bg-blob-soft text-blob-ink",
      )}
    >
      {p.text}
    </motion.span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">Story {index + 1}</span>
        <span className="flex items-center gap-1" aria-label={`${found} of ${needed.length} found`}>
          {needed.map((p, i) => (
            <motion.span key={p.id} animate={{ scale: i < found ? 1 : 0.8 }} className={cn("size-2 rounded-full transition-colors", i < found ? "bg-blob" : "bg-line-2")} />
          ))}
        </span>
        <button onClick={onNext} className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <Shuffle className="size-3.5" /> Another story
        </button>
      </div>

      <div className="rounded-xl border border-line bg-surface px-5 py-4 text-[17px] leading-[1.95] text-ink">
        {parts.map((p, i) => {
          if (p.kind === "text") return <Fragment key={`t${i}`}>{p.text}</Fragment>;
          if (picked.includes(p.id)) {
            return (
              <span
                key={p.id}
                className={cn(
                  "rounded-md px-1 py-0.5 font-medium [box-decoration-break:clone]",
                  p.kind === "w" ? "bg-blob text-white" : "bg-blob-soft text-blob-ink",
                )}
              >
                {p.text}
              </span>
            );
          }
          if (crossed.includes(p.id)) {
            return (
              <motion.span
                key={`${p.id}-${shake.id === p.id ? shake.n : 0}`}
                initial={{ x: 0 }}
                animate={shake.id === p.id ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                transition={{ duration: 0.4 }}
                className="inline-block text-ink-3 line-through decoration-danger decoration-2"
              >
                {p.text}
              </motion.span>
            );
          }
          return (
            <motion.span
              key={p.id}
              layoutId={`${scope}-${p.id}`}
              role="button"
              tabIndex={0}
              onClick={() => tap(p)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  tap(p);
                }
              }}
              className="cursor-pointer rounded-md underline decoration-ink-3/60 decoration-dotted decoration-2 underline-offset-[5px] transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-blob"
            >
              {p.text}
            </motion.span>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-h-[86px] rounded-xl border border-dashed border-line-2 p-3">
          <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Given</div>
          <div className="flex flex-wrap gap-1.5">{needed.filter((p) => p.kind === "g" && picked.includes(p.id)).map(chip)}</div>
        </div>
        <div className="min-h-[86px] rounded-xl border border-dashed border-line-2 p-3">
          <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Wanted</div>
          <div className="flex flex-wrap gap-1.5">{needed.filter((p) => p.kind === "w" && picked.includes(p.id)).map(chip)}</div>
        </div>
      </div>

      <BlobSays text={say.text} mood={say.mood} />

      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.35 }}
            className="space-y-3 rounded-xl border border-blob/25 bg-blob-soft/40 p-4"
          >
            <Step n={3} label="Operation" delay={0.45}>
              <Inline text={story.op} />
            </Step>
            <Step n={4} label="Calculate" delay={0.75}>
              <span className="flex flex-col gap-1">
                {story.calc.map((c) => (
                  <MathView key={c} src={c} size="md" animate={false} />
                ))}
              </span>
            </Step>
            <Step n={5} label="Answer" delay={1.05}>
              <span className="font-medium">{story.answer}</span>
            </Step>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Step({ n, label, delay, children }: { n: number; label: string; delay: number; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay }} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex w-28 shrink-0 items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-blob-ink">
        <span className="grid size-5 place-items-center rounded-full bg-blob text-[11px] text-white">{n}</span>
        {label}
      </span>
      <span className="min-w-0 text-[15px] text-ink">{children}</span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Widget 2: the rule-of-three table, proportional or inverse.

type RatioCase = { lHead: string; rHead: string; one: string; many: string; unit: string; a: number; va: number; targets: number[]; start: number; money?: boolean };

const PROPORTIONAL: RatioCase[] = [
  { lHead: "Apples", rHead: "Price", one: "kg", many: "kg", unit: "€", a: 3, va: 6, targets: [2, 4, 5, 6, 7, 8, 9, 10], start: 5, money: true },
  { lHead: "Notebooks", rHead: "Price", one: "notebook", many: "notebooks", unit: "€", a: 4, va: 6, targets: [2, 3, 5, 6, 7, 8, 10, 12], start: 7, money: true },
  { lHead: "People", rHead: "Pasta", one: "person", many: "people", unit: "g", a: 4, va: 500, targets: [2, 3, 5, 6, 7, 8, 10], start: 6 },
  { lHead: "Time", rHead: "Printed", one: "min", many: "min", unit: "pages", a: 3, va: 75, targets: [2, 4, 5, 6, 8, 10, 12], start: 8 },
];

const INVERSE_CASES: RatioCase[] = [
  { lHead: "Painters", rHead: "Time", one: "painter", many: "painters", unit: "days", a: 4, va: 6, targets: [2, 3, 6, 8, 12], start: 3 },
  { lHead: "Pumps", rHead: "Time", one: "pump", many: "pumps", unit: "h", a: 3, va: 8, targets: [2, 4, 6, 8, 12], start: 4 },
  { lHead: "Friends", rHead: "Each pays", one: "friend", many: "friends", unit: "€", a: 6, va: 8, targets: [2, 3, 4, 8, 12, 16], start: 4, money: true },
  { lHead: "Horses", rHead: "Hay lasts", one: "horse", many: "horses", unit: "days", a: 5, va: 12, targets: [2, 3, 4, 6, 10, 12], start: 6 },
];

const RH = 54;
const GAP = 34;
const HEAD = 30;
const ARC_W = 84;
const rowY = (i: number) => HEAD + i * (RH + GAP) + RH / 2;
const TABLE_H = HEAD + 3 * RH + 2 * GAP;

function Arc({ side, from, label, delay, marker }: { side: "l" | "r"; from: number; label: string; delay: number; marker: string }) {
  const y1 = rowY(from) + 12;
  const y2 = rowY(from + 1) - 12;
  const inner = side === "l" ? ARC_W - 6 : 6;
  const outer = side === "l" ? ARC_W - 50 : 50;
  const d = `M ${inner} ${y1} C ${outer} ${y1}, ${outer} ${y2}, ${inner} ${y2}`;
  const lx = side === "l" ? ARC_W - 47 : 47;
  return (
    <g>
      <motion.path
        d={d}
        fill="none"
        stroke="var(--blob)"
        strokeWidth={2}
        strokeLinecap="round"
        markerEnd={`url(#${marker})`}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay, duration: 0.5, ease: "easeOut" }}
      />
      <motion.text
        x={lx}
        y={(y1 + y2) / 2 + 6}
        textAnchor={side === "l" ? "end" : "start"}
        fontSize={18}
        className="fill-blob-ink font-math"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...spring, delay: delay + 0.15 }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        {label}
      </motion.text>
    </g>
  );
}

function RatioTable() {
  const scope = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const [inv, setInv] = useState(false);
  const [idx, setIdx] = useState(0);
  const [target, setTarget] = useState<number | null>(null);
  const [run, setRun] = useState(0);
  const [moved, setMoved] = useState(false);
  const cases = inv ? INVERSE_CASES : PROPORTIONAL;
  const c = cases[idx % cases.length];
  const t = target !== null && c.targets.includes(target) ? target : c.start;
  const pos = c.targets.indexOf(t);
  const v1 = inv ? c.va * c.a : c.va / c.a;
  const vt = inv ? v1 / t : v1 * t;
  const fmt = (v: number) => (c.money ? eur(v * 100) : de(v));
  const unitL = (n: number) => (n === 1 ? c.one : c.many);
  const at = (d: number) => (moved ? 0 : d);
  const marker = `${scope}-arrow`;
  const rows = [
    { l: c.a, r: c.va },
    { l: 1, r: v1 },
    { l: t, r: vt },
  ];
  const ops: [string, string][] = [
    [`: ${c.a}`, inv ? `· ${c.a}` : `: ${c.a}`],
    [`· ${t}`, inv ? `: ${t}` : `· ${t}`],
  ];

  function restart(fn: () => void) {
    fn();
    setMoved(false);
    setRun((r) => r + 1);
  }

  function step(dir: 1 | -1) {
    const next = c.targets[pos + dir];
    if (next === undefined) return;
    setTarget(next);
    setMoved(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex rounded-lg border border-line p-0.5">
          {[false, true].map((m) => (
            <button
              key={String(m)}
              onClick={() =>
                restart(() => {
                  setInv(m);
                  setIdx(0);
                  setTarget(null);
                })
              }
              className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", inv === m ? "text-white" : "text-ink-2 hover:text-ink")}
            >
              {inv === m && <motion.span layoutId={`${scope}-mode`} className="absolute inset-0 rounded-md bg-blob" transition={spring} />}
              <span className="relative">{m ? "More → less" : "More → more"}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[13px] text-ink-2">Wanted:</span>
          <button onClick={() => step(-1)} disabled={pos <= 0} className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35" aria-label="Fewer">
            <Minus className="size-3.5" />
          </button>
          <motion.span key={t} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="min-w-6 text-center font-math text-[20px] tabular-nums">
            {t}
          </motion.span>
          <button onClick={() => step(1)} disabled={pos >= c.targets.length - 1} className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35" aria-label="More">
            <Plus className="size-3.5" />
          </button>
          <span className="ml-1 text-[13px] text-ink-2">{unitL(t)}</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => restart(() => {})} className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-hover hover:text-ink" aria-label="Replay" title="Replay">
            <RotateCcw className="size-3.5" />
          </button>
          <button
            onClick={() =>
              restart(() => {
                setIdx((i) => i + 1);
                setTarget(null);
              })
            }
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
          >
            <Shuffle className="size-3.5" /> Another example
          </button>
        </div>
      </div>

      <div key={`${inv}-${idx}-${run}`} className="mx-auto grid max-w-[560px] grid-cols-[84px_minmax(0,1fr)_84px]">
        <svg width={ARC_W} height={TABLE_H} className="overflow-visible" aria-hidden>
          <defs>
            <marker id={marker} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--blob)" />
            </marker>
          </defs>
          <Arc side="l" from={0} label={ops[0][0]} delay={0.45} marker={marker} />
          <Arc key={`l${t}`} side="l" from={1} label={ops[1][0]} delay={at(1.35)} marker={marker} />
        </svg>
        <div className="relative" style={{ height: TABLE_H }}>
          <div className="grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] text-center text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3" style={{ height: HEAD }}>
            <span>{c.lHead}</span>
            <span />
            <span>{c.rHead}</span>
          </div>
          {rows.map((row, i) => {
            const last = i === 2;
            return (
              <motion.div
                key={last ? `row-${t}` : `row-${i}`}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...spring, delay: last ? at(1.8) : i * 0.9 }}
                className={cn(
                  "absolute inset-x-0 grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-center rounded-xl border",
                  last ? "border-blob/40 bg-blob-soft/60" : i === 1 ? "border-dashed border-line-2 bg-surface" : "border-line bg-surface",
                )}
                style={{ top: rowY(i) - RH / 2, height: RH }}
              >
                <span className="flex items-baseline justify-center gap-1.5">
                  <span className="font-math text-[22px] tabular-nums">{row.l}</span>
                  <span className="truncate text-[13px] text-ink-2">{unitL(row.l)}</span>
                </span>
                <span className="text-center text-ink-3">→</span>
                <span className="flex items-baseline justify-center gap-1.5">
                  <span className={cn("font-math text-[22px] tabular-nums", last && "font-semibold text-blob-ink")}>{fmt(row.r)}</span>
                  <span className="truncate text-[13px] text-ink-2">{c.unit}</span>
                </span>
              </motion.div>
            );
          })}
        </div>
        <svg width={ARC_W} height={TABLE_H} className="overflow-visible" aria-hidden>
          <Arc side="r" from={0} label={ops[0][1]} delay={0.45} marker={marker} />
          <Arc key={`r${t}`} side="r" from={1} label={ops[1][1]} delay={at(1.35)} marker={marker} />
        </svg>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-surface px-4 py-3">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-blob-ink">{inv ? "Inverse" : "Proportional"}</div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
            {inv
              ? "More on the left means less on the right. So on the right you do the opposite: divide becomes multiply."
              : "More on the left means more on the right. Do the same on both sides: divide, then multiply."}
          </p>
        </div>
        <div className="rounded-xl bg-surface px-4 py-3">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{inv ? "The product stays the same" : "The ratio stays the same"}</div>
          <div className="mt-1.5">
            <MathView
              key={`${inv}-${idx}`}
              src={
                inv
                  ? `${c.a}#a \\cdot#d1 ${fmt(c.va)}#b =#e1 ${t}#c \\cdot#d2 ${fmt(vt)}#d =#e2 ${fmt(c.a * c.va)}#p`
                  : `${fmt(c.va)}#b :#d1 ${c.a}#a =#e1 ${fmt(vt)}#d :#d2 ${t}#c =#e2 ${fmt(v1)}#p`
              }
              size="md"
              scope={`${scope}-check`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson

const planFrames: Frame[] = [
  { math: `4#n "tickets"#t \\quad 9#p "€"#u "each"#e`, note: "**1. Read** the story carefully. **2. Given:** 4 tickets, 9 € each." },
  { math: `4#n "tickets"#t \\quad 9#p "€"#u "each"#e \\quad \\to#ar \\quad ?#q "€"#u2`, note: "**2. Wanted:** the total price. Mark it with a question mark." },
  { math: `4#n \\cdot#op 9#p "€"#u`, note: "**3. Operation:** the same price 4 times, so **multiply**." },
  { math: `4#n \\cdot#op 9#p "€"#u =#eq 36#r "€"#u2`, note: "**4. Calculate:** $4 \\cdot 9 = 36$." },
  { math: `36#r "€"#u2`, highlight: ["r", "u2"], note: "**5. Answer sentence:** Mia pays 36 € for the tickets. Always with the unit!" },
  { math: `36#r "€"#u2 \\approx#ap 4#n \\cdot#op 10#p "€"#u`, note: '**6. Check:** roughly $4 \\cdot 10 "€" = 40 "€"$. 36 € is close, so the answer makes sense.' },
];

const applesFrames = ruleOfThree({
  a: 3,
  va: 6,
  b: 5,
  one: "kg",
  many: "kg",
  unit: "€",
  money: true,
  given: "**Given:** 3 kg of apples cost 6 €. **Wanted:** the price of 5 kg.",
  why: "Twice the apples, twice the price: **proportional**. Go to **one** first: divide both sides by 3.",
  oneNote: "1 kg costs 2 €. That's the step to **one**.",
  answer: "**Answer:** 5 kg of apples cost 10 €.",
});

const paintersFrames = ruleOfThree({
  a: 4,
  va: 6,
  b: 3,
  one: "painter",
  many: "painters",
  unit: "days",
  inverse: true,
  given: "**Given:** 4 painters need 6 days. **Wanted:** the time for 3 painters.",
  why: "1 painter needs **4 times as long**. So divide the left side by 4, but **multiply** the right side by 4.",
  oneNote: "1 painter alone would need 24 days.",
  answer: "**Answer:** 3 painters need 8 days. Check: $4 \\cdot 6 = 3 \\cdot 8 = 24$. The product stays the same.",
});

const speedFrames: Frame[] = [
  { math: `v#V =#eq \\frac{s#s}{t#t}`, note: "Speed = distance : time. $s$ is the distance, $t$ the time." },
  { math: `v#V =#eq \\frac{240#s "km"#us}{3#t "h"#ut}`, note: "A train travels 240 km in 3 hours. Put in the values with their units." },
  { math: `v#V =#eq 80#s "km/h"#us`, note: "$240 : 3 = 80$, and km : h gives km/h." },
  { math: `45#m "min"#um =#eq \\frac{45#m2}{60#d} "h"#uh`, note: "How far does it get in 45 minutes? Change the minutes into hours first: 1 h = 60 min." },
  { math: `45#m "min"#um =#eq 0,75#m2 "h"#uh`, note: "$\\frac{45}{60} = \\frac{3}{4} = 0,75$, so 45 min = 0,75 h." },
  { math: `s#S =#eq 80#s "km/h"#us \\cdot#op 0,75#m2 "h"#uh`, note: "Distance = speed · time." },
  { math: `s#S =#eq 60#s "km"#us`, highlight: ["s", "us"], note: "$80 \\cdot 0,75 = 60$ (three quarters of 80). **Answer:** In 45 minutes the train travels 60 km." },
];

const wordProblems: Topic = {
  ...topicMeta("word-problems"),
  summary: [
    {
      title: "Six steps, every time",
      body: "**1.** Read carefully. **2.** Given and wanted. **3.** Choose the operation. **4.** Calculate. **5.** Answer sentence with the unit. **6.** Check: does the size make sense?",
      tone: "rule",
    },
    {
      title: "Rule of three: proportional",
      body: "More of one, more of the other. Go to **one** first, then to the amount you want. Same operation on both sides.",
      examples: ['3 "kg" \\to 6 "€"', '1 "kg" \\to 2 "€"', '5 "kg" \\to 10 "€"'],
      tone: "rule",
    },
    {
      title: "Inverse proportion",
      body: "More workers, less time. On the right side you do the **opposite** operation. The product stays the same.",
      examples: ['4 "painters" \\to 6 "days"', '1 "painter" \\to 24 "days"', '3 "painters" \\to 8 "days"'],
      tone: "rule",
    },
    {
      title: "Formulas you need",
      body: "Speed is distance divided by time. A rectangle's area is length times width, its perimeter is all four sides added up.",
      examples: ["v = \\frac{s}{t}", "A = a \\cdot b", "u = 2 \\cdot a + 2 \\cdot b"],
      tone: "tip",
    },
    {
      title: "Units",
      body: "Bigger unit to smaller unit: multiply. Smaller to bigger: divide.",
      examples: ['1 "km" = 1000 "m" , \\quad 1 "m" = 100 "cm"', '1 "h" = 60 "min" , \\quad 1 "€" = 100 "ct"', '1 "kg" = 1000 "g" , \\quad 1 "l" = 1000 "ml"'],
      tone: "tip",
    },
    {
      title: "Classic mistake",
      body: "Mixing units. Convert first, then calculate. And never forget the unit in your answer.",
      examples: ['45 "min" \\ne 0,45 "h"', '45 "min" = 0,75 "h"'],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: "A plan for every word problem",
      blob: "Word problems look scary, but one plan works every time. Let's walk through it!",
      body: "**Mia buys 4 cinema tickets. One ticket costs 9 €. How much does she pay?** Every word problem, same six steps: read, given and wanted, operation, calculate, answer sentence, check.",
      frames: planFrames,
    },
    {
      type: "widget",
      title: "What's given, what's wanted?",
      blob: "Stories often hide numbers you don't need. Can you spot them?",
      body: "Tap the numbers you need and the question. Some numbers are only there to confuse you: tap them and they get crossed out.",
      widget: GivenWanted,
    },
    {
      type: "check",
      blob: "Your turn! Given, wanted, operation…",
      exercise: {
        instruction: SOLVE,
        text: "The bus for the school trip costs 375 € in total. The 25 students of class 7a share the cost equally. How much does each student pay?",
        answer: { kind: "number", value: 15, unit: "€" },
        hint: "Shared **equally**: divide the total cost by the number of students.",
        solution: [
          { math: `"each"#w =#eq ?#q`, note: "**Given:** 375 € in total, 25 students. **Wanted:** the amount per student." },
          { math: `"each"#w =#eq 375#t "€"#u :#op 25#n`, note: "Shared equally: **divide** by 25." },
          { math: `"each"#w =#eq 15#t "€"#u`, highlight: ["t", "u"], note: "$375 : 25 = 15$. **Answer:** Each student pays 15 €." },
        ],
      },
    },
    {
      type: "explain",
      title: "The rule of three (Dreisatz)",
      blob: "This one is a superstar. It solves loads of problems!",
      body: "**3 kg of apples cost 6 €. How much do 5 kg cost?** If one quantity doubles and the other doubles too, they are **proportional**. Then go from the given pair to **one**, and from one to the amount you want.",
      frames: applesFrames,
    },
    {
      type: "check",
      blob: "First the price of one notebook, then seven!",
      exercise: {
        instruction: SOLVE,
        text: "4 notebooks cost 6 €. How much do 7 notebooks cost?",
        answer: { kind: "number", value: 10.5, unit: "€" },
        hint: "1 notebook costs $6 : 4 = 1,50$ €. Now multiply by 7.",
        solution: ruleOfThree({
          a: 4,
          va: 6,
          b: 7,
          one: "notebook",
          many: "notebooks",
          unit: "€",
          money: true,
          given: "**Given:** 4 notebooks cost 6 €. **Wanted:** the price of 7 notebooks.",
          why: "More notebooks, higher price: proportional. Divide both sides by 4.",
          oneNote: "So 1 notebook costs 1,50 €.",
          answer: "**Answer:** 7 notebooks cost 10,50 €.",
        }),
      },
    },
    {
      type: "explain",
      title: "More workers, less time",
      blob: "Careful, this one is sneaky. Sometimes more means less!",
      body: "**4 painters need 6 days. How long do 3 painters need?** More painters need **less** time. When one quantity goes up and the other goes down like this, they are **inverse** (antiproportional). The rule of three still works, but on the right side you do the **opposite**.",
      frames: paintersFrames,
    },
    {
      type: "widget",
      title: "Same or opposite?",
      blob: "Flip between the two kinds and watch the arrows on the right!",
      body: "Switch between **more → more** and **more → less**, and change the amount you want. On the right side, is it the same operation or the opposite?",
      widget: RatioTable,
    },
    {
      type: "check",
      blob: "More pumps, so less time. Think before you calculate!",
      exercise: {
        instruction: SOLVE,
        text: "3 pumps empty a swimming pool in 8 hours. How many hours do 4 pumps need?",
        answer: { kind: "number", value: 6, unit: "h" },
        hint: "1 pump alone would need 3 times as long: $3 \\cdot 8 = 24$ hours. Now share that between 4 pumps.",
        solution: ruleOfThree({
          a: 3,
          va: 8,
          b: 4,
          one: "pump",
          many: "pumps",
          unit: "h",
          inverse: true,
          given: "**Given:** 3 pumps need 8 h. **Wanted:** the time for 4 pumps.",
          why: "More pumps are faster: inverse. 1 pump needs 3 times as long: divide left, but **multiply** right.",
          oneNote: "1 pump alone would need 24 hours.",
          answer: "**Answer:** 4 pumps need 6 hours. Check: $3 \\cdot 8 = 4 \\cdot 6 = 24$.",
        }),
      },
    },
    {
      type: "explain",
      title: "Speed and units",
      blob: "Speed problems are everywhere: trains, bikes, school trips.",
      body: "Speed tells you how far you get in **one** hour: $v = \\frac{s}{t}$ (distance : time). Careful with units: for km/h the time has to be in **hours**.",
      frames: speedFrames,
    },
    {
      type: "check",
      blob: "Last one! Two steps this time.",
      exercise: {
        instruction: SOLVE,
        text: "A rectangular garden is 12 m long and 7 m wide. It gets a fence all the way around. One metre of fence costs 8 €. How much does the fence cost?",
        answer: { kind: "number", value: 304, unit: "€" },
        hint: "Step 1: the perimeter, $u = 2 \\cdot 12 + 2 \\cdot 7$. Step 2: multiply by the price per metre.",
        solution: [
          { math: `u#U =#eq 2#k1 \\cdot#o1 12#a +#p 2#k2 \\cdot#o2 7#b`, note: '**Given:** 12 m by 7 m, 8 € per metre. **Wanted:** the cost. Step 1: "all the way around" means the perimeter.' },
          { math: `u#U =#eq 38#a "m"#um`, note: "$24 + 14 = 38$: the fence is 38 m long." },
          { math: `"cost"#w =#eq 38#a \\cdot#op 8#c "€"#ue`, note: "Step 2: every metre costs 8 €, so multiply." },
          { math: `"cost"#w =#eq 304#a "€"#ue`, highlight: ["a", "ue"], note: "$38 \\cdot 8 = 304$. **Answer:** The fence costs 304 €." },
        ],
      },
    },
  ],
  generate,
};

export default wordProblems;
