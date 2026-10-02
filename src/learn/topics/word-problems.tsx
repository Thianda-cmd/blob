"use client";

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, RotateCcw, Shuffle } from "lucide-react";
import { Fragment, useId, useState } from "react";
import { Blob, type BlobMood } from "@/components/blob/Blob";
import type { Locale } from "@/i18n/config";
import { resolveText, tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
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

// ---------------------------------------------------------------------------
// Bilingual helpers. Every story is written in both languages side by side:
// `tx(english, german)`, with E()/D() to pull one language out of a Text.

const E = (t: Text) => resolveText(t, "en");
const D = (t: Text) => resolveText(t, "de");

/** The same builder in both languages; a plain string when nothing differs (pure maths). */
function both(build: (l: Locale) => string): Text {
  const en = build("en");
  const de = build("de");
  return en === de ? en : { en, de };
}

/** Joins bilingual pieces. */
const cat = (...parts: Text[]): Text => both((l) => parts.map((p) => resolveText(p, l)).join(""));

/** Display maths with a word on the left, e.g. `"total" = …`: the word is translated, the keys stay. */
const said = (word: Text, rest: string, key = "w"): Text => both((l) => `"${resolveText(word, l)}"#${key} ${rest}`);

/** German genitive of a name: "Mias", "Jonas'". */
const gen = (name: string) => (/[sßxz]$/.test(name) ? `${name}'` : `${name}s`);

/** German hours with the right number: "1 Stunde", "1,5 Stunden". */
const stunden = (h: number) => (h === 1 ? "1 Stunde" : `${de(h)} Stunden`);

const num = (value: number, unit?: Text): AnswerSpec => ({ kind: "number", value: Math.round(value * 1000) / 1000, unit });

const SOLVE = tx("Solve the word problem", "Löse die Textaufgabe");
const ANSWER = tx("**Answer:**", "**Antwort:**");

const TOTAL = tx("total", "Gesamtpreis");
const EACH = tx("each", "pro Person");
const CHANGE = tx("change", "Wechselgeld");
const COST = tx("cost", "Kosten");

/** Puts a sentence that isn't needed right before the question (the last sentence). */
function addExtra(text: string, extra: string): string {
  const i = text.lastIndexOf(". ");
  return i < 0 ? `${extra} ${text}` : `${text.slice(0, i + 2)}${extra} ${text.slice(i + 2)}`;
}

const withExtra = (text: Text, extra: Text): Text => both((l) => addExtra(resolveText(text, l), resolveText(extra, l)));

type Tpl = (rng: Rng) => Exercise;

// ---------------------------------------------------------------------------
// Rule of three (Dreisatz): one line per frame, the values morph in place while
// the operations appear on both sides.

type RuleOfThree = {
  a: number;
  va: number;
  b: number;
  one: Text;
  many: Text;
  unit: Text;
  inverse?: boolean;
  money?: boolean;
  given: Text;
  why: Text;
  oneNote: Text;
  answer: Text;
};

export function ruleOfThree(o: RuleOfThree): Frame[] {
  const f = (v: number) => (o.money ? eur(v * 100) : de(v));
  const v1 = o.inverse ? o.va * o.a : o.va / o.a;
  const vb = o.inverse ? v1 / o.b : v1 * o.b;
  const row = (l: number, unit: Text, r: number, ops?: [string, string]) =>
    both((lang) => {
      const core = `${de(l)}#a "${resolveText(unit, lang)}"#ua \\to#ar ${f(r)}#b "${resolveText(o.unit, lang)}"#ub`;
      return ops ? `\\blob{${ops[0]}} \\quad ${core} \\quad \\blob{${ops[1]}}` : core;
    });
  const div = (n: number, k: string) => `:#${k} ${n}#${k}n`;
  const mul = (n: number, k: string) => `\\cdot#${k} ${n}#${k}n`;
  return [
    { math: row(o.a, o.many, o.va), note: o.given },
    { math: row(o.a, o.many, o.va, [div(o.a, "d1"), o.inverse ? mul(o.a, "d2") : div(o.a, "d2")]), note: o.why },
    { math: row(1, o.one, v1), note: o.oneNote },
    {
      math: row(1, o.one, v1, [mul(o.b, "m1"), o.inverse ? div(o.b, "m2") : mul(o.b, "m2")]),
      note: o.inverse
        ? tx(
            `Now ${o.b} ${E(o.many)}: multiply the left side by ${o.b}, and **divide** the right side by ${o.b}.`,
            `Jetzt für ${o.b} ${D(o.many)}: Multipliziere die linke Seite mit ${o.b}, aber **dividiere** die rechte Seite durch ${o.b}.`,
          )
        : tx(`Now ${o.b} ${E(o.many)}: multiply both sides by ${o.b}.`, `Jetzt für ${o.b} ${D(o.many)}: Multipliziere beide Seiten mit ${o.b}.`),
    },
    { math: row(o.b, o.many, vb), highlight: ["b", "ub"], note: o.answer },
  ];
}

// ---------------------------------------------------------------------------
// Level 1: one step

const GOODS = [
  { one: "croissant", many: "croissants", de: { a: "Ein", one: "Croissant", many: "Croissants" }, prices: [80, 90, 110, 120, 130, 150], max: 8 },
  { one: "cinema ticket", many: "cinema tickets", de: { a: "Eine", one: "Kinokarte", many: "Kinokarten" }, prices: [750, 800, 850, 900, 950, 1100], max: 6 },
  { one: "pack of stickers", many: "packs of stickers", de: { a: "Ein", one: "Päckchen Sticker", many: "Päckchen Sticker" }, prices: [120, 150, 180, 250], max: 6 },
  { one: "notebook", many: "notebooks", de: { a: "Ein", one: "Heft", many: "Hefte" }, prices: [110, 140, 150, 160, 180, 240], max: 8 },
  { one: "pool ticket", many: "pool tickets", de: { a: "Eine", one: "Eintrittskarte fürs Freibad", many: "Eintrittskarten fürs Freibad" }, prices: [350, 400, 450, 550], max: 6 },
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
    text: tx(
      `${name} buys ${n} ${g.many}. One ${g.one} costs ${eur(p)} €. How much does ${name} pay in total?`,
      `${name} kauft ${n} ${g.de.many}. ${g.de.a} ${g.de.one} kostet ${eur(p)} €. Wie viel bezahlt ${name} insgesamt?`,
    ),
    answer: num(total / 100, "€"),
    hint: tx(
      "The same price several times: **multiply** the number of items by the price of one.",
      "Mehrmals derselbe Preis: **Multipliziere** die Anzahl mit dem Preis für ein Stück.",
    ),
    solution: [
      {
        math: said(TOTAL, `=#eq ?#q`),
        note: tx(
          `**Given:** ${n} ${g.many} at ${eur(p)} € each. **Wanted:** the total price.`,
          `**Gegeben:** ${n} ${g.de.many} zu je ${eur(p)} €. **Gesucht:** der Gesamtpreis.`,
        ),
      },
      {
        math: said(TOTAL, `=#eq ${n}#n \\cdot#op ${eur(p)}#p "€"#u`),
        note: tx(`The same price ${n} times: **multiply**.`, `${n}-mal derselbe Preis: **multiplizieren**.`),
      },
      {
        math: said(TOTAL, `=#eq ${eur(total)}#p "€"#u`),
        highlight: ["p", "u"],
        note: tx(
          `$${n} \\cdot ${eur(p)} = ${eur(total)}$. **Answer:** ${name} pays ${eur(total)} € in total. Rough check: $${n} \\cdot ${round} = ${n * round}$, close enough.`,
          `$${n} \\cdot ${eur(p)} = ${eur(total)}$. **Antwort:** ${name} bezahlt insgesamt ${eur(total)} €. Überschlag: $${n} \\cdot ${round} = ${n * round}$, das passt ungefähr.`,
        ),
      },
    ],
  };
};

const SHARES = [
  { what: "a pizza order", de: "eine Pizzabestellung", max: 6 },
  { what: "a present for their teacher", de: "ein Geschenk für ihre Lehrerin", max: 8 },
  { what: "a taxi ride", de: "eine Taxifahrt", max: 4 },
  { what: "a new football", de: "einen neuen Fußball", max: 5 },
  { what: "a trip to the climbing hall", de: "einen Ausflug in die Kletterhalle", max: 8 },
];

const share: Tpl = (rng) => {
  const s = rng.pick(SHARES);
  const n = rng.int(3, s.max);
  const each = rng.int(6, 30) * 50;
  const total = each * n;
  return {
    instruction: SOLVE,
    text: tx(
      `${n} friends share the cost of ${s.what} equally. Altogether it costs ${eur(total)} €. How much does each friend pay?`,
      `${n} Freunde teilen sich die Kosten für ${s.de} gleichmäßig. Das kostet insgesamt ${eur(total)} €. Wie viel bezahlt jeder?`,
    ),
    answer: num(each / 100, "€"),
    hint: tx(
      "Shared **equally** means: divide the total by the number of friends.",
      "**Gleichmäßig** teilen heißt: Teile den Gesamtbetrag durch die Anzahl der Freunde.",
    ),
    solution: [
      {
        math: said(EACH, `=#eq ?#q`),
        note: tx(
          `**Given:** ${eur(total)} € in total, ${n} friends. **Wanted:** the amount for each friend.`,
          `**Gegeben:** ${eur(total)} € insgesamt, ${n} Freunde. **Gesucht:** der Betrag pro Person.`,
        ),
      },
      {
        math: said(EACH, `=#eq ${eur(total)}#t "€"#u :#op ${n}#n`),
        note: tx(`Shared equally between ${n}: **divide** by ${n}.`, `Gleichmäßig auf ${n} verteilt: **Dividiere** durch ${n}.`),
      },
      {
        math: said(EACH, `=#eq ${eur(each)}#t "€"#u`),
        highlight: ["t", "u"],
        note: tx(
          `$${eur(total)} : ${n} = ${eur(each)}$. **Answer:** Each friend pays ${eur(each)} €.`,
          `$${eur(total)} : ${n} = ${eur(each)}$. **Antwort:** Jeder bezahlt ${eur(each)} €.`,
        ),
      },
    ],
  };
};

const BUYS = [
  { what: "a book", de: "ein Buch", min: 650, max: 1490, note: 20 },
  { what: "a T-shirt", de: "ein T-Shirt", min: 890, max: 1790, note: 20 },
  { what: "a board game", de: "ein Brettspiel", min: 1990, max: 3990, note: 50 },
  { what: "a sandwich and a drink", de: "ein belegtes Brötchen und ein Getränk", min: 380, max: 790, note: 10 },
  { what: "a comic", de: "einen Comic", min: 290, max: 680, note: 10 },
];

const change: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  const b = rng.pick(BUYS);
  const p = rng.int(b.min / 10, b.max / 10) * 10;
  const r = b.note * 100 - p;
  return {
    instruction: SOLVE,
    text: tx(
      `${name} buys ${b.what} for ${eur(p)} € and pays with a ${b.note} € note. How much change does ${name} get?`,
      `${name} kauft ${b.de} für ${eur(p)} € und bezahlt mit einem ${b.note}-Euro-Schein. Wie viel Wechselgeld bekommt ${name}?`,
    ),
    answer: num(r / 100, "€"),
    hint: tx(
      "The change is the money that comes back: **subtract** the price from the money paid.",
      "Das Wechselgeld ist das Geld, das du zurückbekommst: **Subtrahiere** den Preis vom bezahlten Betrag.",
    ),
    solution: [
      {
        math: said(CHANGE, `=#eq ?#q`),
        note: tx(
          `**Given:** price ${eur(p)} €, paid with ${b.note} €. **Wanted:** the change.`,
          `**Gegeben:** Preis ${eur(p)} €, bezahlt mit ${b.note} €. **Gesucht:** das Wechselgeld.`,
        ),
      },
      {
        math: said(CHANGE, `=#eq ${b.note}#a "€"#ua -#op ${eur(p)}#b "€"#ub`),
        note: tx("The change is what's left over: **subtract** the price.", "Das Wechselgeld ist das, was übrig bleibt: **Subtrahiere** den Preis."),
      },
      {
        math: said(CHANGE, `=#eq ${eur(r)}#a "€"#ua`),
        highlight: ["a", "ua"],
        note: tx(
          `Count up from ${eur(p)} € to ${b.note} €: that's ${eur(r)} €. **Answer:** ${name} gets ${eur(r)} € change.`,
          `Ergänze von ${eur(p)} € auf ${b.note} €: Das sind ${eur(r)} €. **Antwort:** ${name} bekommt ${eur(r)} € Wechselgeld.`,
        ),
      },
    ],
  };
};

const DURATIONS: { from: number; to: number; text: (a: string, b: string, name: string) => Text; answer: (d: number, name: string) => Text }[] = [
  {
    from: 7,
    to: 9,
    text: (a, b) =>
      tx(
        `The bus for the school trip leaves at ${a} and arrives at ${b}. How many minutes does the ride take?`,
        `Der Bus für die Klassenfahrt fährt um ${a} Uhr los und kommt um ${b} Uhr an. Wie viele Minuten dauert die Fahrt?`,
      ),
    answer: (d) => tx(`The ride takes ${d} minutes.`, `Die Fahrt dauert ${d} Minuten.`),
  },
  {
    from: 15,
    to: 19,
    text: (a, b) =>
      tx(`The film starts at ${a} and ends at ${b}. How long is the film in minutes?`, `Der Film beginnt um ${a} Uhr und endet um ${b} Uhr. Wie viele Minuten dauert der Film?`),
    answer: (d) => tx(`The film is ${d} minutes long.`, `Der Film dauert ${d} Minuten.`),
  },
  {
    from: 9,
    to: 14,
    text: (a, b, name) =>
      tx(
        `${name} starts a bike tour at ${a} and is back home at ${b}. How many minutes was ${name} out?`,
        `${name} startet um ${a} Uhr zu einer Fahrradtour und ist um ${b} Uhr wieder zu Hause. Wie viele Minuten war ${name} unterwegs?`,
      ),
    answer: (d, name) => tx(`${name} was out for ${d} minutes.`, `${name} war ${d} Minuten unterwegs.`),
  },
  {
    from: 10,
    to: 13,
    text: (a, b) =>
      tx(
        `The school's football tournament starts at ${a} and ends at ${b}. How many minutes does it last?`,
        `Das Fußballturnier der Schule beginnt um ${a} Uhr und endet um ${b} Uhr. Wie viele Minuten dauert es?`,
      ),
    answer: (d) => tx(`The tournament lasts ${d} minutes.`, `Das Turnier dauert ${d} Minuten.`),
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
  const said = c.answer(d, name);
  return {
    instruction: SOLVE,
    text: c.text(t1, t2, name),
    answer: num(d, "min"),
    hint: tx("Count in two steps: first up to the next full hour, then the rest.", "Rechne in zwei Schritten: erst bis zur nächsten vollen Stunde, dann den Rest."),
    solution: [
      {
        math: `"${t1}"#t1 \\to#ar2 "${t2}"#t2`,
        note: tx(
          `**Given:** start ${t1}, end ${t2}. **Wanted:** the time in between, in minutes.`,
          `**Gegeben:** Beginn ${t1} Uhr, Ende ${t2} Uhr. **Gesucht:** die Zeit dazwischen in Minuten.`,
        ),
      },
      { math: `"${t1}"#t1 \\to#ar1 "${full}"#tf \\to#ar2 "${t2}"#t2`, note: tx("Go to the next full hour first.", "Rechne zuerst bis zur nächsten vollen Stunde.") },
      {
        math: `${a}#da "min"#ua +#op ${d - a}#db "min"#ub`,
        note: tx(
          `${t1} to ${full} is ${a} min. ${full} to ${t2} is ${d - a} min.`,
          `Von ${t1} bis ${full} Uhr sind es ${a} min. Von ${full} bis ${t2} Uhr sind es ${d - a} min.`,
        ),
      },
      {
        math: `${d}#da "min"#ua`,
        highlight: ["da", "ua"],
        note: tx(`$${a} + ${d - a} = ${d}$. **Answer:** ${E(said)}`, `$${a} + ${d - a} = ${d}$. **Antwort:** ${D(said)}`),
      },
    ],
  };
};

type Conversion = {
  from: string;
  to: string;
  f: number;
  dir: "mul" | "div";
  vals: number[];
  text: (v: string, name: string) => Text;
  answer: (r: string, name: string) => Text;
};

const CONVERSIONS: Conversion[] = [
  {
    from: "m", to: "cm", f: 100, dir: "mul", vals: [1.2, 1.5, 2.4, 3.6, 0.8, 2.75, 1.35],
    text: (v) => tx(`A ribbon is ${v} m long. How long is it in centimetres?`, `Ein Geschenkband ist ${v} m lang. Wie viele Zentimeter sind das?`),
    answer: (r) => tx(`The ribbon is ${r} cm long.`, `Das Geschenkband ist ${r} cm lang.`),
  },
  {
    from: "km", to: "m", f: 1000, dir: "mul", vals: [1.2, 2.5, 0.8, 3.4, 1.25, 0.65],
    text: (v, n) => tx(`${n}'s way to school is ${v} km long. How many metres is that?`, `${gen(n)} Schulweg ist ${v} km lang. Wie viele Meter sind das?`),
    answer: (r, n) => tx(`${n}'s way to school is ${r} m long.`, `${gen(n)} Schulweg ist ${r} m lang.`),
  },
  {
    from: "kg", to: "g", f: 1000, dir: "mul", vals: [1.5, 2.5, 0.5, 0.75, 1.25, 0.25],
    text: (v) => tx(`A bag of potatoes weighs ${v} kg. How many grams is that?`, `Ein Sack Kartoffeln wiegt ${v} kg. Wie viel Gramm sind das?`),
    answer: (r) => tx(`The bag weighs ${r} g.`, `Der Sack wiegt ${r} g.`),
  },
  {
    from: "l", to: "ml", f: 1000, dir: "mul", vals: [1.5, 0.75, 0.5, 2.25, 0.33, 1.25],
    text: (v) => tx(`A bottle holds ${v} l of water. How many millilitres is that?`, `In eine Flasche passen ${v} l Wasser. Wie viele Milliliter sind das?`),
    answer: (r) => tx(`The bottle holds ${r} ml.`, `In die Flasche passen ${r} ml.`),
  },
  {
    from: "h", to: "min", f: 60, dir: "mul", vals: [1.5, 2.5, 0.5, 0.75, 1.25, 1.75],
    text: (v) => tx(`The school concert lasts ${v} hours. How many minutes is that?`, `Das Schulkonzert dauert ${v} Stunden. Wie viele Minuten sind das?`),
    answer: (r) => tx(`The concert lasts ${r} minutes.`, `Das Konzert dauert ${r} Minuten.`),
  },
  {
    from: "cm", to: "m", f: 100, dir: "div", vals: [345, 280, 410, 375, 198, 260],
    text: (v, n) => tx(`${n} jumps ${v} cm in the long jump. How many metres is that?`, `${n} springt beim Weitsprung ${v} cm weit. Wie viele Meter sind das?`),
    answer: (r, n) => tx(`${n} jumps ${r} m.`, `${n} springt ${r} m weit.`),
  },
  {
    from: "g", to: "kg", f: 1000, dir: "div", vals: [2500, 3200, 1800, 4500, 750, 1250],
    text: (v) => tx(`A watermelon weighs ${v} g. How many kilograms is that?`, `Eine Wassermelone wiegt ${v} g. Wie viel Kilogramm sind das?`),
    answer: (r) => tx(`The watermelon weighs ${r} kg.`, `Die Wassermelone wiegt ${r} kg.`),
  },
  {
    from: "min", to: "h", f: 60, dir: "div", vals: [90, 150, 30, 45, 75, 105],
    text: (v) => tx(`The train ride takes ${v} minutes. How many hours is that?`, `Die Zugfahrt dauert ${v} Minuten. Wie viele Stunden sind das?`),
    answer: (r) => tx(`The train ride takes ${r} hours.`, `Die Zugfahrt dauert ${r} Stunden.`),
  },
  {
    from: "ct", to: "€", f: 100, dir: "div", vals: [345, 1280, 95, 560, 2050],
    text: (v, n) => tx(`${n} has ${v} ct in the piggy bank. How many euros is that?`, `${n} hat ${v} ct im Sparschwein. Wie viel Euro sind das?`),
    answer: (r, n) => tx(`${n} has ${r} €.`, `${n} hat ${r} € im Sparschwein.`),
  },
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
  const said = c.answer(de(r), name);
  return {
    instruction: tx("Convert the units", "Rechne die Einheiten um"),
    text: c.text(de(v), name),
    answer: num(r, c.to),
    hint:
      c.dir === "mul"
        ? tx(
            `$1 "${c.from}" = ${c.f} "${c.to}"$. Bigger unit to smaller unit: multiply.`,
            `$1 "${c.from}" = ${c.f} "${c.to}"$. Von der größeren zur kleineren Einheit: multiplizieren.`,
          )
        : tx(
            `$${c.f} "${c.from}" = 1 "${c.to}"$. Smaller unit to bigger unit: divide.`,
            `$${c.f} "${c.from}" = 1 "${c.to}"$. Von der kleineren zur größeren Einheit: dividieren.`,
          ),
    solution: [
      {
        math: fact.math,
        note: tx(
          `**Given:** ${de(v)} ${c.from}. **Wanted:** the same in ${c.to}. The conversion fact: ${fact.text}.`,
          `**Gegeben:** ${de(v)} ${c.from}. **Gesucht:** dieselbe Größe in ${c.to}. Umrechnung: ${fact.text}.`,
        ),
      },
      c.dir === "mul"
        ? {
            math: `${de(v)}#a "${c.from}"#ua =#eq ${de(v)}#n \\cdot#op ${c.f}#b "${c.to}"#ub`,
            note: tx(
              `From a bigger unit to a smaller one you get **more** of them: multiply by ${c.f}.`,
              `Von einer größeren zu einer kleineren Einheit bekommst du **mehr** davon: Multipliziere mit ${c.f}.`,
            ),
          }
        : {
            math: `${de(v)}#a "${c.from}"#ua =#eq ${de(v)}#n :#op ${c.f}#b "${c.to}"#ub`,
            note: tx(
              `From a smaller unit to a bigger one you get **fewer** of them: divide by ${c.f}.`,
              `Von einer kleineren zu einer größeren Einheit bekommst du **weniger** davon: Dividiere durch ${c.f}.`,
            ),
          },
      {
        math: `${de(v)}#a "${c.from}"#ua =#eq ${de(r)}#b "${c.to}"#ub`,
        highlight: ["b", "ub"],
        note: tx(
          `$${de(v)} ${c.dir === "mul" ? "\\cdot" : ":"} ${c.f} = ${de(r)}$. **Answer:** ${E(said)}`,
          `$${de(v)} ${c.dir === "mul" ? "\\cdot" : ":"} ${c.f} = ${de(r)}$. **Antwort:** ${D(said)}`,
        ),
      },
    ],
  };
};

const AREAS = [
  { what: "classroom floor", de: { a: "Ein rechteckiges Klassenzimmer", the: "Das Klassenzimmer" }, u: "m", a: [7, 10], b: [5, 8], k: 1 },
  { what: "vegetable patch", de: { a: "Ein rechteckiges Gemüsebeet", the: "Das Gemüsebeet" }, u: "m", a: [3, 8], b: [2, 4], k: 1 },
  { what: "poster", de: { a: "Ein rechteckiges Plakat", the: "Das Plakat" }, u: "cm", a: [4, 7], b: [3, 5], k: 10 },
  { what: "photo", de: { a: "Ein rechteckiges Foto", the: "Das Foto" }, u: "cm", a: [12, 15], b: [8, 10], k: 1 },
  { what: "football pitch", de: { a: "Ein rechteckiges Fußballfeld", the: "Das Fußballfeld" }, u: "m", a: [10, 10], b: [6, 7], k: 10 },
];

const area: Tpl = (rng) => {
  const s = rng.pick(AREAS);
  const a = rng.int(s.a[0], s.a[1]) * s.k;
  let b = rng.int(s.b[0], s.b[1]) * s.k;
  if (b >= a) b = a - s.k;
  const ab = a * b;
  return {
    instruction: SOLVE,
    text: tx(
      `A rectangular ${s.what} is ${a} ${s.u} long and ${b} ${s.u} wide. What is its area?`,
      `${s.de.a} ist ${a} ${s.u} lang und ${b} ${s.u} breit. Wie groß ist der Flächeninhalt?`,
    ),
    answer: num(ab, `${s.u}²`),
    hint: tx(
      "For a rectangle: area = length · width. The unit gets a little 2.",
      "Für ein Rechteck gilt: Flächeninhalt = Länge · Breite. Die Einheit bekommt eine kleine 2.",
    ),
    solution: [
      {
        math: `A#A =#eq a#a \\cdot#op b#b`,
        note: tx(
          `**Given:** length ${a} ${s.u}, width ${b} ${s.u}. **Wanted:** the area $A$. For a rectangle: $A = a \\cdot b$.`,
          `**Gegeben:** Länge ${a} ${s.u}, Breite ${b} ${s.u}. **Gesucht:** der Flächeninhalt $A$. Für ein Rechteck gilt: $A = a \\cdot b$.`,
        ),
      },
      { math: `A#A =#eq ${a}#a "${s.u}"#ua \\cdot#op ${b}#b "${s.u}"#ub`, note: tx("Put in the length and the width.", "Setze Länge und Breite ein.") },
      {
        math: `A#A =#eq ${ab}#a "${s.u}"#ua^{2#sq}`,
        highlight: ["a", "ua", "sq"],
        note: tx(
          `$${a} \\cdot ${b} = ${ab}$, and $"${s.u}" \\cdot "${s.u}" = "${s.u}"^2$. **Answer:** The ${s.what} has an area of ${ab} ${s.u}².`,
          `$${a} \\cdot ${b} = ${ab}$ und $"${s.u}" \\cdot "${s.u}" = "${s.u}"^2$. **Antwort:** ${s.de.the} hat einen Flächeninhalt von ${ab} ${s.u}².`,
        ),
      },
    ],
  };
};

const PERIMETERS = [
  { what: "sports field", de: "Sportplatz", a: [16, 20], b: [10, 14], k: 5 },
  { what: "garden", de: "Garten", a: [12, 25], b: [6, 11], k: 1 },
  { what: "school yard", de: "Schulhof", a: [7, 12], b: [4, 6], k: 5 },
  { what: "playground", de: "Spielplatz", a: [15, 30], b: [10, 14], k: 1 },
];

const perimeter: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  const s = rng.pick(PERIMETERS);
  const a = rng.int(s.a[0], s.a[1]) * s.k;
  const b = rng.int(s.b[0], s.b[1]) * s.k;
  const p = 2 * a + 2 * b;
  return {
    instruction: SOLVE,
    text: tx(
      `A rectangular ${s.what} is ${a} m long and ${b} m wide. ${name} walks once all the way around it. How far does ${name} walk?`,
      `Ein rechteckiger ${s.de} ist ${a} m lang und ${b} m breit. ${name} läuft einmal ganz um den ${s.de} herum. Wie weit läuft ${name}?`,
    ),
    answer: num(p, "m"),
    hint: tx(
      "All the way around means the perimeter: two lengths and two widths.",
      "Einmal ganz herum heißt: Gesucht ist der Umfang. Das sind zwei Längen und zwei Breiten.",
    ),
    solution: [
      {
        math: `u#U =#eq 2#k1 \\cdot#o1 a#a +#p 2#k2 \\cdot#o2 b#b`,
        note: tx(
          `**Given:** length ${a} m, width ${b} m. **Wanted:** the way around, the perimeter $u$: two lengths and two widths.`,
          `**Gegeben:** Länge ${a} m, Breite ${b} m. **Gesucht:** der Weg einmal herum, also der Umfang $u$: zwei Längen und zwei Breiten.`,
        ),
      },
      { math: `u#U =#eq 2#k1 \\cdot#o1 ${a}#a +#p 2#k2 \\cdot#o2 ${b}#b`, note: tx("Put in the lengths (in m).", "Setze die Längen ein (in m).") },
      {
        math: `u#U =#eq ${2 * a}#a +#p ${2 * b}#b`,
        note: tx(`$2 \\cdot ${a} = ${2 * a}$ and $2 \\cdot ${b} = ${2 * b}$.`, `$2 \\cdot ${a} = ${2 * a}$ und $2 \\cdot ${b} = ${2 * b}$.`),
      },
      {
        math: `u#U =#eq ${p}#a "m"#um`,
        highlight: ["a", "um"],
        note: tx(`$${2 * a} + ${2 * b} = ${p}$. **Answer:** ${name} walks ${p} m.`, `$${2 * a} + ${2 * b} = ${p}$. **Antwort:** ${name} läuft ${p} m.`),
      },
    ],
  };
};

const MOVERS: { v: number[]; t: [number, number]; text: (v: number, t: number, name: string) => Text; answer: (s: number, name: string) => Text }[] = [
  {
    v: [60, 70, 80, 90, 120], t: [2, 4],
    text: (v, t) => tx(`A train travels at ${v} km/h for ${t} hours. How far does it travel?`, `Ein Zug fährt ${t} Stunden lang mit ${v} km/h. Wie weit kommt er?`),
    answer: (s) => tx(`The train travels ${s} km.`, `Der Zug fährt ${s} km weit.`),
  },
  {
    v: [12, 14, 15, 16, 18], t: [2, 4],
    text: (v, t, n) => tx(`${n} cycles at ${v} km/h for ${t} hours. How far does ${n} get?`, `${n} fährt ${t} Stunden lang mit ${v} km/h Fahrrad. Wie weit kommt ${n}?`),
    answer: (s, n) => tx(`${n} cycles ${s} km.`, `${n} kommt ${s} km weit.`),
  },
  {
    v: [3, 4, 5], t: [2, 6],
    text: (v, t) => tx(`A hiking group walks at ${v} km/h for ${t} hours. How far does the group walk?`, `Eine Wandergruppe wandert ${t} Stunden lang mit ${v} km/h. Wie weit kommt die Gruppe?`),
    answer: (s) => tx(`The group walks ${s} km.`, `Die Gruppe wandert ${s} km weit.`),
  },
  {
    v: [50, 60, 80, 100], t: [2, 5],
    text: (v, t) =>
      tx(
        `A coach drives at an average speed of ${v} km/h for ${t} hours. How far does it get?`,
        `Ein Reisebus fährt ${t} Stunden lang mit einer Durchschnittsgeschwindigkeit von ${v} km/h. Wie weit kommt er?`,
      ),
    answer: (s) => tx(`The coach drives ${s} km.`, `Der Reisebus fährt ${s} km weit.`),
  },
];

const distance: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  const c = rng.pick(MOVERS);
  const v = rng.pick(c.v);
  const t = rng.int(c.t[0], c.t[1]);
  const s = v * t;
  const said = c.answer(s, name);
  return {
    instruction: SOLVE,
    text: c.text(v, t, name),
    answer: num(s, "km"),
    hint: tx("Distance = speed · time.", "Strecke = Geschwindigkeit · Zeit."),
    solution: [
      {
        math: `s#S =#eq v#v \\cdot#op t#t`,
        note: tx(
          `**Given:** speed ${v} km/h, time ${t} h. **Wanted:** the distance $s$. Distance = speed · time.`,
          `**Gegeben:** Geschwindigkeit ${v} km/h, Zeit ${t} h. **Gesucht:** die Strecke $s$. Strecke = Geschwindigkeit · Zeit.`,
        ),
      },
      { math: `s#S =#eq ${v}#v "km/h"#uv \\cdot#op ${t}#t "h"#ut`, note: tx("Put in the values with their units.", "Setze die Werte mit ihren Einheiten ein.") },
      {
        math: `s#S =#eq ${s}#v "km"#uv`,
        highlight: ["v", "uv"],
        note: tx(
          `$${v} \\cdot ${t} = ${s}$, and km/h times h gives km. **Answer:** ${E(said)}`,
          `$${v} \\cdot ${t} = ${s}$, und km/h mal h ergibt km. **Antwort:** ${D(said)}`,
        ),
      },
    ],
  };
};

const WISHES = [
  tx("a skateboard", "ein Skateboard"),
  tx("new headphones", "neue Kopfhörer"),
  tx("a football shirt", "ein Fußballtrikot"),
  tx("a video game", "ein Videospiel"),
  tx("inline skates", "Inlineskates"),
  tx("a concert ticket", "eine Konzertkarte"),
];

const saving: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  const r = rng.pick([5, 6, 8, 10, 12, 15]);
  const w = rng.int(4, 12);
  const total = r * w;
  const wish = rng.pick(WISHES);
  const weeks = tx("weeks", "Wochen");
  return {
    instruction: SOLVE,
    text: tx(
      `${name} wants to buy ${E(wish)} for ${total} €. ${name} saves ${r} € every week. How many weeks does ${name} have to save?`,
      `${name} möchte sich ${D(wish)} für ${total} € kaufen. ${name} spart jede Woche ${r} €. Wie viele Wochen muss ${name} sparen?`,
    ),
    answer: num(w, weeks),
    hint: tx(`How often do ${r} € fit into ${total} €?`, `Wie oft passen ${r} € in ${total} €?`),
    solution: [
      {
        math: said(weeks, `=#eq ?#q`),
        note: tx(
          `**Given:** price ${total} €, savings ${r} € per week. **Wanted:** the number of weeks.`,
          `**Gegeben:** Preis ${total} €, ${r} € Sparbetrag pro Woche. **Gesucht:** die Anzahl der Wochen.`,
        ),
      },
      {
        math: said(weeks, `=#eq ${total}#a "€"#ua :#op ${r}#b "€"#ub`),
        note: tx(`How often do ${r} € fit into ${total} €? **Divide**.`, `Wie oft passen ${r} € in ${total} €? **Dividiere**.`),
      },
      {
        math: said(weeks, `=#eq ${w}#a`),
        highlight: ["a"],
        note: tx(
          `$${total} : ${r} = ${w}$. **Answer:** ${name} has to save for ${w} weeks.`,
          `$${total} : ${r} = ${w}$. **Antwort:** ${name} muss ${w} Wochen lang sparen.`,
        ),
      },
    ],
  };
};

// ---------------------------------------------------------------------------
// Level 2: rule of three, speed, units

const UNIT_PRICES: {
  one: Text;
  many: Text;
  /** German subject for "more …, higher price". */
  more: string;
  /** German shop for the distracting opening time. */
  shop: string;
  cents: number[];
  a: [number, number];
  b: [number, number];
  text: (a: number, p: string, b: number) => Text;
  answer: (b: number, p: string) => Text;
}[] = [
  {
    one: tx("notebook", "Heft"), many: tx("notebooks", "Hefte"), more: "Hefte", shop: "Der Laden", cents: [110, 120, 140, 150, 160, 180], a: [2, 6], b: [3, 12],
    text: (a, p, b) => tx(`At the school shop, ${a} notebooks cost ${p} €. How much do ${b} notebooks cost?`, `Im Schreibwarenladen kosten ${a} Hefte ${p} €. Wie viel kosten ${b} Hefte?`),
    answer: (b, p) => tx(`${b} notebooks cost ${p} €.`, `${b} Hefte kosten ${p} €.`),
  },
  {
    one: tx("roll", "Brötchen"), many: tx("rolls", "Brötchen"), more: "Brötchen", shop: "Die Bäckerei", cents: [30, 35, 40, 45, 50, 55], a: [4, 10], b: [3, 15],
    text: (a, p, b) => tx(`At the bakery, ${a} bread rolls cost ${p} €. How much do ${b} bread rolls cost?`, `In der Bäckerei kosten ${a} Brötchen ${p} €. Wie viel kosten ${b} Brötchen?`),
    answer: (b, p) => tx(`${b} bread rolls cost ${p} €.`, `${b} Brötchen kosten ${p} €.`),
  },
  {
    one: "kg", many: "kg", more: "Äpfel", shop: "Der Hofladen", cents: [180, 220, 240, 260, 280, 320], a: [2, 5], b: [3, 8],
    text: (a, p, b) => tx(`${a} kg of apples cost ${p} €. How much do ${b} kg of apples cost?`, `${a} kg Äpfel kosten ${p} €. Wie viel kosten ${b} kg Äpfel?`),
    answer: (b, p) => tx(`${b} kg of apples cost ${p} €.`, `${b} kg Äpfel kosten ${p} €.`),
  },
  {
    one: "m", many: "m", more: "Stoff", shop: "Der Stoffladen", cents: [400, 600, 750, 800, 1200], a: [2, 5], b: [3, 9],
    text: (a, p, b) => tx(`${a} m of fabric cost ${p} €. How much do ${b} m of fabric cost?`, `${a} m Stoff kosten ${p} €. Wie viel kosten ${b} m Stoff?`),
    answer: (b, p) => tx(`${b} m of fabric cost ${p} €.`, `${b} m Stoff kosten ${p} €.`),
  },
  {
    one: tx("ticket", "Fahrkarte"), many: tx("tickets", "Fahrkarten"), more: "Fahrkarten", shop: "Der Kiosk", cents: [250, 280, 320, 350], a: [2, 5], b: [3, 9],
    text: (a, p, b) => tx(`${a} bus tickets cost ${p} €. How much do ${b} bus tickets cost?`, `${a} Busfahrkarten kosten ${p} €. Wie viel kosten ${b} Busfahrkarten?`),
    answer: (b, p) => tx(`${b} bus tickets cost ${p} €.`, `${b} Busfahrkarten kosten ${p} €.`),
  },
];

const dreisatz: Tpl = (rng) => {
  const c = rng.pick(UNIT_PRICES);
  const u = rng.pick(c.cents);
  const a = rng.int(c.a[0], c.a[1]);
  let b = rng.int(c.b[0], c.b[1]);
  if (b === a) b = a + 1;
  let text = c.text(a, eur(a * u), b);
  let given = tx(
    `**Given:** ${a} ${E(c.many)} cost ${eur(a * u)} €. **Wanted:** the price of ${b} ${E(c.many)}.`,
    `**Gegeben:** ${a} ${D(c.many)} kosten ${eur(a * u)} €. **Gesucht:** der Preis für ${b} ${D(c.many)}.`,
  );
  if (rng.chance(0.35)) {
    const t = rng.int(7, 9);
    text = withExtra(text, tx(`The shop opens at ${t} o'clock.`, `${c.shop} öffnet um ${t} Uhr.`));
    given = cat(given, tx(" The opening time doesn't matter.", " Die Öffnungszeit spielt keine Rolle."));
  }
  return {
    instruction: SOLVE,
    text,
    answer: num((b * u) / 100, "€"),
    hint: tx(`Rule of three: first find the price of **one**, then multiply.`, `Dreisatz: Berechne zuerst den Preis für **1 ${D(c.one)}**, dann multipliziere.`),
    solution: ruleOfThree({
      a,
      va: (a * u) / 100,
      b,
      one: c.one,
      many: c.many,
      unit: "€",
      money: true,
      given,
      why: tx(
        `More ${E(c.many)}, higher price: proportional. Go to **one** first: divide both sides by ${a}.`,
        `Mehr ${c.more}, höherer Preis: proportional. Rechne zuerst auf **1 ${D(c.one)}** zurück: Teile beide Seiten durch ${a}.`,
      ),
      oneNote: tx(`So 1 ${E(c.one)} costs ${eur(u)} €.`, `1 ${D(c.one)} kostet also ${eur(u)} €.`),
      answer: cat(ANSWER, " ", c.answer(b, eur(b * u))),
    }),
  };
};

const RECIPES = [
  { what: "flour", unit: "g", per: [50, 75, 100, 125], dish: "pancakes", de: { what: "Mehl", how: "Wie viel", dish: "Pfannkuchen" } },
  { what: "milk", unit: "ml", per: [50, 75, 100, 125, 150], dish: "pancakes", de: { what: "Milch", how: "Wie viel", dish: "Pfannkuchen" } },
  { what: "pasta", unit: "g", per: [100, 125, 150], dish: "spaghetti", de: { what: "Nudeln", how: "Wie viele", dish: "Spaghetti bolognese" } },
  { what: "rice", unit: "g", per: [60, 75, 80], dish: "a rice dish", de: { what: "Reis", how: "Wie viel", dish: "eine Reispfanne" } },
  { what: "butter", unit: "g", per: [15, 20, 25, 30], dish: "a cake", de: { what: "Butter", how: "Wie viel", dish: "einen Kuchen" } },
];

const recipe: Tpl = (rng) => {
  const r = rng.pick(RECIPES);
  const per = rng.pick(r.per);
  const a = rng.int(2, 6);
  let b = rng.int(2, 10);
  if (b === a) b = a + 2;
  let text = tx(
    `A recipe for ${r.dish} for ${a} people needs ${a * per} ${r.unit} of ${r.what}. How much ${r.what} do you need for ${b} people?`,
    `Ein Rezept für ${r.de.dish} reicht für ${a} Personen. Man braucht dafür ${a * per} ${r.unit} ${r.de.what}. ${r.de.how} ${r.de.what} brauchst du für ${b} Personen?`,
  );
  let given = tx(
    `**Given:** ${a} people need ${a * per} ${r.unit}. **Wanted:** the amount for ${b} people.`,
    `**Gegeben:** ${a} Personen brauchen ${a * per} ${r.unit}. **Gesucht:** die Menge für ${b} Personen.`,
  );
  if (rng.chance(0.35)) {
    const m = rng.int(3, 8) * 5;
    text = withExtra(text, tx(`Cooking takes ${m} minutes.`, `Die Zubereitung dauert ${m} Minuten.`));
    given = cat(given, tx(" The cooking time doesn't matter.", " Die Zubereitungszeit spielt keine Rolle."));
  }
  return {
    instruction: SOLVE,
    text,
    answer: num(b * per, r.unit),
    hint: tx("Rule of three: how much does **one** person need?", "Dreisatz: Wie viel braucht **1** Person?"),
    solution: ruleOfThree({
      a,
      va: a * per,
      b,
      one: tx("person", "Person"),
      many: tx("people", "Personen"),
      unit: r.unit,
      given,
      why: tx(
        `More people need more ${r.what}: proportional. Go to **one** person first: divide both sides by ${a}.`,
        `Mehr Personen brauchen mehr ${r.de.what}: proportional. Rechne zuerst auf **1 Person** zurück: Teile beide Seiten durch ${a}.`,
      ),
      oneNote: tx(`1 person needs ${per} ${r.unit}.`, `1 Person braucht ${per} ${r.unit}.`),
      answer: tx(
        `**Answer:** For ${b} people you need ${b * per} ${r.unit} of ${r.what}.`,
        `**Antwort:** Für ${b} Personen brauchst du ${b * per} ${r.unit} ${r.de.what}.`,
      ),
    }),
  };
};

const SPEEDS: { v: number[]; t: [number, number]; text: (s: number, t: number, name: string) => Text; who: (name: string) => Text }[] = [
  {
    v: [12, 14, 15, 16, 18, 20], t: [2, 4],
    text: (s, t, n) => tx(`${n} cycles ${s} km in ${t} hours. What is ${n}'s average speed?`, `${n} fährt in ${t} Stunden ${s} km mit dem Fahrrad. Wie hoch ist ${gen(n)} Durchschnittsgeschwindigkeit?`),
    who: (n) => tx(`${n}'s average speed`, `${gen(n)} Durchschnittsgeschwindigkeit`),
  },
  {
    v: [50, 60, 70, 80, 90, 100], t: [2, 4],
    text: (s, t) => tx(`A car drives ${s} km in ${t} hours. What is its average speed?`, `Ein Auto fährt in ${t} Stunden ${s} km. Wie hoch ist seine Durchschnittsgeschwindigkeit?`),
    who: () => tx("The car's average speed", "Die Durchschnittsgeschwindigkeit des Autos"),
  },
  {
    v: [80, 100, 120, 140, 160], t: [2, 3],
    text: (s, t) => tx(`A train travels ${s} km in ${t} hours. What is its average speed?`, `Ein Zug fährt in ${t} Stunden ${s} km. Wie hoch ist seine Durchschnittsgeschwindigkeit?`),
    who: () => tx("The train's average speed", "Die Durchschnittsgeschwindigkeit des Zuges"),
  },
  {
    v: [4, 5, 6], t: [2, 5],
    text: (s, t, n) => tx(`${n} hikes ${s} km in ${t} hours. What is ${n}'s average speed?`, `${n} wandert in ${t} Stunden ${s} km. Wie hoch ist ${gen(n)} Durchschnittsgeschwindigkeit?`),
    who: (n) => tx(`${n}'s average speed`, `${gen(n)} Durchschnittsgeschwindigkeit`),
  },
];

const speedV: Tpl = (rng) => {
  const name = rng.pick(NAMES);
  const c = rng.pick(SPEEDS);
  const v = rng.pick(c.v);
  const t = rng.int(c.t[0], c.t[1]);
  const s = v * t;
  let text = c.text(s, t, name);
  let given = tx(
    `**Given:** ${s} km in ${t} h. **Wanted:** the speed $v$. Speed = distance : time.`,
    `**Gegeben:** ${s} km in ${t} h. **Gesucht:** die Geschwindigkeit $v$. Geschwindigkeit = Strecke : Zeit.`,
  );
  if (rng.chance(0.3)) {
    const deg = rng.int(18, 28);
    text = withExtra(text, tx(`It is ${deg} °C outside.`, `Draußen sind es ${deg} °C.`));
    given = cat(given, tx(" The temperature doesn't matter.", " Die Temperatur spielt keine Rolle."));
  }
  const who = c.who(name);
  return {
    instruction: SOLVE,
    text,
    answer: num(v, "km/h"),
    hint: tx(
      "Speed = distance : time. In km/h: how many km in **one** hour?",
      "Geschwindigkeit = Strecke : Zeit. Bei km/h heißt das: Wie viele km sind es in **einer** Stunde?",
    ),
    solution: [
      { math: `v#V =#eq \\frac{s#s}{t#t}`, note: given },
      { math: `v#V =#eq \\frac{${s}#s "km"#us}{${t}#t "h"#ut}`, note: tx("Put in the values with their units.", "Setze die Werte mit ihren Einheiten ein.") },
      {
        math: `v#V =#eq ${v}#s "km/h"#us`,
        highlight: ["s", "us"],
        note: tx(
          `$${s} : ${t} = ${v}$, that's km per hour. **Answer:** ${E(who)} is ${v} km/h.`,
          `$${s} : ${t} = ${v}$, also Kilometer pro Stunde. **Antwort:** ${D(who)} beträgt ${v} km/h.`,
        ),
      },
    ],
  };
};

const VEHICLES = [tx("A car", "Ein Auto"), tx("A coach", "Ein Reisebus"), tx("A delivery van", "Ein Lieferwagen")];

const speedT: Tpl = (rng) => {
  const v = rng.pick([60, 80, 100, 120]);
  const halves = rng.int(3, 9);
  const t = halves / 2;
  const s = v * t;
  const what = rng.pick(VEHICLES);
  const minutes = t % 1 ? tx(` That's ${Math.floor(t)} h 30 min.`, ` Das sind ${Math.floor(t)} h 30 min.`) : "";
  return {
    instruction: SOLVE,
    text: tx(
      `${E(what)} drives ${s} km at an average speed of ${v} km/h. How many hours does the journey take?`,
      `${D(what)} fährt ${s} km mit einer Durchschnittsgeschwindigkeit von ${v} km/h. Wie viele Stunden dauert die Fahrt?`,
    ),
    answer: num(t, "h"),
    hint: tx(
      "Time = distance : speed. How often do the km of one hour fit into the whole distance?",
      "Zeit = Strecke : Geschwindigkeit. Wie oft passen die km von einer Stunde in die ganze Strecke?",
    ),
    solution: [
      {
        math: `t#T =#eq \\frac{s#s}{v#v}`,
        note: tx(
          `**Given:** ${s} km at ${v} km/h. **Wanted:** the time $t$. Time = distance : speed.`,
          `**Gegeben:** ${s} km mit ${v} km/h. **Gesucht:** die Zeit $t$. Zeit = Strecke : Geschwindigkeit.`,
        ),
      },
      { math: `t#T =#eq \\frac{${s}#s "km"#us}{${v}#v "km/h"#uv}`, note: tx("Put in the values with their units.", "Setze die Werte mit ihren Einheiten ein.") },
      {
        math: `t#T =#eq ${de(t)}#s "h"#us`,
        highlight: ["s", "us"],
        note: tx(
          `$${s} : ${v} = ${de(t)}$. **Answer:** The journey takes ${de(t)} h.${E(minutes)}`,
          `$${s} : ${v} = ${de(t)}$. **Antwort:** Die Fahrt dauert ${de(t)} h.${D(minutes)}`,
        ),
      },
    ],
  };
};

const COUNTS: {
  big: string;
  small: string;
  f: number;
  vals: number[];
  parts: number[];
  noun: Text;
  text: (v: string, p: number, name: string) => Text;
  answer: (n: number, name: string) => Text;
}[] = [
  {
    big: "l", small: "ml", f: 1000, vals: [1, 1.5, 2, 3], parts: [200, 250, 300], noun: tx("glasses", "Gläser"),
    text: (v, p) =>
      tx(
        `A ${v} l bottle of juice is poured into glasses of ${p} ml. How many glasses can be filled?`,
        `Eine Flasche mit ${v} l Saft wird auf Gläser mit je ${p} ml verteilt. Wie viele Gläser kann man füllen?`,
      ),
    answer: (n) => tx(`${n} glasses can be filled.`, `Man kann ${n} Gläser füllen.`),
  },
  {
    big: "m", small: "cm", f: 100, vals: [2, 3, 4, 5, 6], parts: [20, 25, 40, 50, 75], noun: tx("pieces", "Stücke"),
    text: (v, p, n) =>
      tx(`${n} cuts a ${v} m long ribbon into pieces of ${p} cm. How many pieces does ${n} get?`, `${n} schneidet ein ${v} m langes Band in Stücke von ${p} cm. Wie viele Stücke bekommt ${n}?`),
    answer: (k, n) => tx(`${n} gets ${k} pieces.`, `${n} bekommt ${k} Stücke.`),
  },
  {
    big: "km", small: "cm", f: 100000, vals: [0.6, 0.9, 1.2, 1.5], parts: [50, 60, 75], noun: tx("steps", "Schritte"),
    text: (v, p, n) =>
      tx(
        `${n}'s way to school is ${v} km long. One step of ${n} is ${p} cm long. How many steps is the way to school?`,
        `${gen(n)} Schulweg ist ${v} km lang. ${n} macht ${p} cm lange Schritte. Wie viele Schritte sind es bis zur Schule?`,
      ),
    answer: (k) => tx(`The way to school is ${k} steps.`, `Bis zur Schule sind es ${k} Schritte.`),
  },
  {
    big: "kg", small: "g", f: 1000, vals: [1, 1.5, 2, 2.5], parts: [125, 250, 500], noun: tx("bags", "Tüten"),
    text: (v, p) =>
      tx(`A baker fills ${v} kg of cookies into bags of ${p} g. How many bags does the baker fill?`, `Ein Bäcker füllt ${v} kg Kekse in Tüten zu je ${p} g ab. Wie viele Tüten füllt er?`),
    answer: (k) => tx(`The baker fills ${k} bags.`, `Der Bäcker füllt ${k} Tüten.`),
  },
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
  const said = c.answer(n, name);
  return {
    instruction: SOLVE,
    text: c.text(de(v), p, name),
    answer: num(n, c.noun),
    hint: tx(
      `Use the same unit first: change ${c.big} into ${c.small}. Then divide.`,
      `Bring zuerst alles auf dieselbe Einheit: Rechne ${c.big} in ${c.small} um. Dann dividiere.`,
    ),
    solution: [
      {
        math: `${de(v)}#a "${c.big}"#ua =#eq ${total}#b "${c.small}"#ub`,
        note: tx(
          `**Given:** ${de(v)} ${c.big} and ${p} ${c.small}. **Wanted:** the number of ${E(c.noun)}. Same unit first: $1 "${c.big}" = ${c.f} "${c.small}"$.`,
          `**Gegeben:** ${de(v)} ${c.big} und ${p} ${c.small}. **Gesucht:** die Anzahl der ${D(c.noun)}. Zuerst dieselbe Einheit: $1 "${c.big}" = ${c.f} "${c.small}"$.`,
        ),
      },
      {
        math: `${total}#b "${c.small}"#ub :#op ${p}#p "${c.small}"#up`,
        note: tx(
          `Now divide: how often does ${p} ${c.small} fit into ${total} ${c.small}?`,
          `Jetzt dividieren: Wie oft passen ${p} ${c.small} in ${total} ${c.small}?`,
        ),
      },
      {
        math: `${total}#b "${c.small}"#ub :#op ${p}#p "${c.small}"#up =#eq ${n}#n`,
        highlight: ["n"],
        note: tx(`$${total} : ${p} = ${n}$. **Answer:** ${E(said)}`, `$${total} : ${p} = ${n}$. **Antwort:** ${D(said)}`),
      },
    ],
  };
};

const CENTS = [
  { one: "pencil", many: "pencils", de: { a: "Ein", one: "Bleistift", many: "Bleistifte" }, c: [45, 65, 75, 85, 95] },
  { one: "stamp", many: "stamps", de: { a: "Eine", one: "Briefmarke", many: "Briefmarken" }, c: [85, 95] },
  { one: "bread roll", many: "bread rolls", de: { a: "Ein", one: "Brötchen", many: "Brötchen" }, c: [35, 40, 45, 55] },
  { one: "pack of gum", many: "packs of gum", de: { a: "Ein", one: "Päckchen Kaugummi", many: "Päckchen Kaugummi" }, c: [65, 75, 90] },
];

const centsToEuro: Tpl = (rng) => {
  const g = rng.pick(CENTS);
  const c = rng.pick(g.c);
  const n = rng.int(4, 12);
  const total = n * c;
  return {
    instruction: SOLVE,
    text: tx(
      `One ${g.one} costs ${c} ct. How much do ${n} ${g.many} cost? Give the answer in euros.`,
      `${g.de.a} ${g.de.one} kostet ${c} ct. Wie viel kosten ${n} ${g.de.many}? Gib das Ergebnis in Euro an.`,
    ),
    answer: num(total / 100, "€"),
    hint: tx("Multiply first. Then change cents into euros: 100 ct = 1 €.", "Multipliziere zuerst. Rechne dann Cent in Euro um: 100 ct = 1 €."),
    solution: [
      {
        math: said(TOTAL, `=#eq ${n}#n \\cdot#op ${c}#c "ct"#u`),
        note: tx(
          `**Given:** ${n} ${g.many} at ${c} ct. **Wanted:** the total in €. First multiply.`,
          `**Gegeben:** ${n} ${g.de.many} zu je ${c} ct. **Gesucht:** der Gesamtpreis in €. Zuerst multiplizieren.`,
        ),
      },
      { math: said(TOTAL, `=#eq ${total}#c "ct"#u`), note: tx(`$${n} \\cdot ${c} = ${total}$, so ${total} ct.`, `$${n} \\cdot ${c} = ${total}$, also ${total} ct.`) },
      {
        math: said(TOTAL, `=#eq ${eur(total)}#c "€"#u`),
        highlight: ["c", "u"],
        note: tx(
          `100 ct = 1 €, so divide by 100. **Answer:** ${n} ${g.many} cost ${eur(total)} €.`,
          `100 ct = 1 €, also durch 100 teilen. **Antwort:** ${n} ${g.de.many} kosten ${eur(total)} €.`,
        ),
      },
    ],
  };
};

const TEAMS = [
  { who: "The football club", verb: "trains", de: "Die Fußballmannschaft trainiert" },
  { who: "The swimming team", verb: "trains", de: "Die Schwimmmannschaft trainiert" },
  { who: "The school band", verb: "rehearses", de: "Die Schulband probt" },
  { who: "The dance group", verb: "practises", de: "Die Tanzgruppe übt" },
];

const trainingHours: Tpl = (rng) => {
  const t = rng.pick(TEAMS);
  const k = rng.int(2, 4);
  const m = rng.pick([45, 60, 75, 90, 120]);
  const total = k * m;
  const h = total / 60;
  const time = tx("time", "Zeit");
  return {
    instruction: SOLVE,
    text: tx(
      `${t.who} ${t.verb} ${k} times a week for ${m} minutes each time. How many hours is that per week?`,
      `${t.de} ${k}-mal pro Woche, jedes Mal ${m} Minuten lang. Wie viele Stunden sind das pro Woche?`,
    ),
    answer: num(h, "h"),
    hint: tx(
      "First the minutes per week. Then change into hours: 60 min = 1 h.",
      "Berechne zuerst die Minuten pro Woche. Rechne dann in Stunden um: 60 min = 1 h.",
    ),
    solution: [
      {
        math: said(time, `=#eq ${k}#k \\cdot#op ${m}#m "min"#u`),
        note: tx(
          `**Given:** ${k} times ${m} min. **Wanted:** the time per week in hours. First the minutes.`,
          `**Gegeben:** ${k}-mal ${m} min. **Gesucht:** die Zeit pro Woche in Stunden. Zuerst die Minuten.`,
        ),
      },
      { math: said(time, `=#eq ${total}#m "min"#u`), note: tx(`$${k} \\cdot ${m} = ${total}$ minutes per week.`, `$${k} \\cdot ${m} = ${total}$ Minuten pro Woche.`) },
      {
        math: said(time, `=#eq ${de(h)}#m "h"#u`),
        highlight: ["m", "u"],
        note: tx(
          `60 min = 1 h: $${total} : 60 = ${de(h)}$. **Answer:** That's ${de(h)} hours per week.`,
          `60 min = 1 h: $${total} : 60 = ${de(h)}$. **Antwort:** Das sind ${de(h)} Stunden pro Woche.`,
        ),
      },
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
  one: Text;
  many: Text;
  unit: Text;
  answerUnit: Text;
  money?: boolean;
  P: number[];
  range: [number, number];
  text: (a: number, va: string, b: number) => Text;
  why: (a: number) => Text;
  oneNote: (v: string) => Text;
  answer: (b: number, v: string) => Text;
}[] = [
  {
    one: tx("painter", "Maler"), many: tx("painters", "Maler"), unit: tx("days", "Tage"), answerUnit: tx("days", "Tage"), P: [12, 18, 24, 30, 36, 40, 48], range: [2, 8],
    text: (a, va, b) =>
      tx(
        `${a} painters need ${va} days to paint the school building. How many days would ${b} painters need, if everyone works equally fast?`,
        `${a} Maler brauchen ${va} Tage, um das Schulgebäude zu streichen. Wie viele Tage bräuchten ${b} Maler, wenn alle gleich schnell arbeiten?`,
      ),
    why: (a) =>
      tx(
        `More painters need **less** time: inverse. 1 painter needs ${a} times as long: divide the left side by ${a}, but **multiply** the right side.`,
        `Mehr Maler brauchen **weniger** Zeit: antiproportional. 1 Maler braucht ${a}-mal so lange: Teile die linke Seite durch ${a}, aber **multipliziere** die rechte Seite.`,
      ),
    oneNote: (v) => tx(`1 painter alone would need ${v} days.`, `1 Maler allein bräuchte ${v} Tage.`),
    answer: (b, v) => tx(`${b} painters need ${v} days.`, `${b} Maler brauchen ${v} Tage.`),
  },
  {
    one: tx("pump", "Pumpe"), many: tx("pumps", "Pumpen"), unit: "h", answerUnit: "h", P: [12, 18, 24, 30, 36], range: [2, 6],
    text: (a, va, b) =>
      tx(`${a} pumps empty the swimming pool in ${va} hours. How long do ${b} pumps take?`, `${a} Pumpen leeren das Schwimmbecken in ${va} Stunden. Wie lange brauchen ${b} Pumpen?`),
    why: (a) =>
      tx(
        `More pumps are **faster**: inverse. 1 pump takes ${a} times as long: divide the left side by ${a}, but **multiply** the right side.`,
        `Mehr Pumpen sind **schneller**: antiproportional. 1 Pumpe braucht ${a}-mal so lange: Teile die linke Seite durch ${a}, aber **multipliziere** die rechte Seite.`,
      ),
    oneNote: (v) => tx(`1 pump alone would take ${v} hours.`, `1 Pumpe allein bräuchte ${v} Stunden.`),
    answer: (b, v) => tx(`${b} pumps take ${v} hours.`, `${b} Pumpen brauchen ${v} Stunden.`),
  },
  {
    one: tx("horse", "Pferd"), many: tx("horses", "Pferde"), unit: tx("days", "Tage"), answerUnit: tx("days", "Tage"), P: [24, 30, 36, 48, 60, 72], range: [2, 9],
    text: (a, va, b) =>
      tx(
        `A farmer's hay lasts ${va} days for ${a} horses. How many days does it last for ${b} horses?`,
        `Das Heu einer Bäuerin reicht für ${a} Pferde ${va} Tage. Wie viele Tage reicht es für ${b} Pferde?`,
      ),
    why: (a) =>
      tx(
        `More horses eat the hay **sooner**: inverse. For 1 horse it lasts ${a} times as long: divide left, but **multiply** right.`,
        `Mehr Pferde fressen das Heu **schneller** auf: antiproportional. Für 1 Pferd reicht es ${a}-mal so lange: links teilen, aber rechts **multiplizieren**.`,
      ),
    oneNote: (v) => tx(`For 1 horse the hay would last ${v} days.`, `Für 1 Pferd würde das Heu ${v} Tage reichen.`),
    answer: (b, v) => tx(`For ${b} horses the hay lasts ${v} days.`, `Für ${b} Pferde reicht das Heu ${v} Tage.`),
  },
  {
    one: tx("friend", "Freund"), many: tx("friends", "Freunde"), unit: "€", answerUnit: "€", money: true, P: [36, 48, 60, 72, 90, 96, 120], range: [3, 12],
    text: (a, va, b) =>
      tx(
        `${a} friends share the cost of a party equally. Each of them pays ${va} €. How much would each pay if ${b} friends shared the cost?`,
        `${a} Freunde teilen sich die Kosten für eine Party gleichmäßig. Jeder bezahlt ${va} €. Wie viel müsste jeder bezahlen, wenn sich ${b} Freunde die Kosten teilen würden?`,
      ),
    why: (a) =>
      tx(
        `More friends, each pays **less**: inverse. 1 friend alone would pay ${a} times as much: divide left, but **multiply** right.`,
        `Mehr Freunde, jeder bezahlt **weniger**: antiproportional. 1 Freund allein müsste ${a}-mal so viel bezahlen: links teilen, aber rechts **multiplizieren**.`,
      ),
    oneNote: (v) => tx(`1 friend alone would pay ${v} €.`, `1 Freund allein müsste ${v} € bezahlen.`),
    answer: (b, v) => tx(`With ${b} friends, each pays ${v} €.`, `Bei ${b} Freunden bezahlt jeder ${v} €.`),
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
  const check = `$${a} \\cdot ${f(va)} = ${b} \\cdot ${f(vb)} = ${f(P)}$.`;
  const said = c.answer(b, f(vb));
  return {
    instruction: SOLVE,
    text: c.text(a, f(va), b),
    answer: num(vb, c.answerUnit),
    hint: tx(
      `Careful: more ${E(c.many)} means **less**. What would 1 ${E(c.one)} alone mean? Then go to ${b}.`,
      `Vorsicht: Mehr ${D(c.many)} heißt hier **weniger**. Wie wäre es bei 1 ${D(c.one)} allein? Dann rechne weiter auf ${b}.`,
    ),
    solution: ruleOfThree({
      a,
      va,
      b,
      one: c.one,
      many: c.many,
      unit: c.unit,
      inverse: true,
      money: c.money,
      given: tx(
        `**Given:** ${a} ${E(c.many)} → ${f(va)} ${E(c.unit)}. **Wanted:** the value for ${b} ${E(c.many)}.`,
        `**Gegeben:** ${a} ${D(c.many)} → ${f(va)} ${D(c.unit)}. **Gesucht:** der Wert für ${b} ${D(c.many)}.`,
      ),
      why: c.why(a),
      oneNote: c.oneNote(f(P)),
      answer: tx(`**Answer:** ${E(said)} Check: ${check}`, `**Antwort:** ${D(said)} Probe: ${check}`),
    }),
  };
};

const ITEMS = [
  { many: "bottles of juice", de: "Flaschen Saft", cents: [120, 140, 150, 190] },
  { many: "packs of pasta", de: "Packungen Nudeln", cents: [90, 110, 130] },
  { many: "bars of chocolate", de: "Tafeln Schokolade", cents: [80, 90, 120, 140] },
  { many: "magazines", de: "Zeitschriften", cents: [250, 290, 350] },
  { many: "bags of crisps", de: "Tüten Chips", cents: [130, 150, 180] },
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
  let text = tx(
    `${name} buys ${n1} ${i1.many} at ${eur(p1)} € each and ${n2} ${i2.many} at ${eur(p2)} € each. ${name} pays with a ${note} € note. How much change does ${name} get?`,
    `${name} kauft ${n1} ${i1.de} zu je ${eur(p1)} € und ${n2} ${i2.de} zu je ${eur(p2)} €. ${name} bezahlt mit einem ${note}-Euro-Schein. Wie viel Wechselgeld bekommt ${name}?`,
  );
  let given = tx(
    `**Given:** the two kinds of items and the ${note} € note. **Wanted:** the change.`,
    `**Gegeben:** die zwei Einkäufe und der ${note}-Euro-Schein. **Gesucht:** das Wechselgeld.`,
  );
  if (rng.chance(0.35)) {
    const age = rng.int(11, 16);
    text = withExtra(text, tx(`${name} is ${age} years old.`, `${name} ist ${age} Jahre alt.`));
    given = cat(given, tx(` ${name}'s age doesn't matter.`, ` ${gen(name)} Alter spielt keine Rolle.`));
  }
  given = cat(given, tx(" Step 1: the total cost.", " Schritt 1: die Gesamtkosten."));
  return {
    instruction: SOLVE,
    text,
    answer: num(r / 100, "€"),
    hint: tx("Two steps: first the total cost of everything, then the change.", "Zwei Schritte: erst die Kosten für alles zusammen, dann das Wechselgeld."),
    solution: [
      { math: said(COST, `=#eq ${n1}#n1 \\cdot#o1 ${eur(p1)}#p1 +#pl ${n2}#n2 \\cdot#o2 ${eur(p2)}#p2`), note: given },
      {
        math: said(COST, `=#eq ${eur(c1)}#p1 +#pl ${eur(c2)}#p2`),
        note: tx(
          `$${n1} \\cdot ${eur(p1)} = ${eur(c1)}$ and $${n2} \\cdot ${eur(p2)} = ${eur(c2)}$.`,
          `$${n1} \\cdot ${eur(p1)} = ${eur(c1)}$ und $${n2} \\cdot ${eur(p2)} = ${eur(c2)}$.`,
        ),
      },
      { math: said(COST, `=#eq ${eur(cost)}#p1 "€"#u`), note: tx(`Together everything costs ${eur(cost)} €.`, `Zusammen kostet alles ${eur(cost)} €.`) },
      {
        math: said(CHANGE, `=#eq ${note}#nt "€"#un -#mi ${eur(cost)}#p1 "€"#u`, "w2"),
        note: tx(`Step 2: subtract the cost from the ${note} €.`, `Schritt 2: Ziehe die Kosten von den ${note} € ab.`),
      },
      {
        math: said(CHANGE, `=#eq ${eur(r)}#nt "€"#un`, "w2"),
        highlight: ["nt", "un"],
        note: tx(`**Answer:** ${name} gets ${eur(r)} € change.`, `**Antwort:** ${name} bekommt ${eur(r)} € Wechselgeld.`),
      },
    ],
  };
};

const fenceCost: Tpl = (rng) => {
  const a = rng.int(8, 20);
  const b = rng.int(5, Math.min(12, a - 1));
  const c = rng.pick([5, 6, 8, 10, 12, 15]);
  const p = 2 * a + 2 * b;
  let text = tx(
    `A rectangular garden is ${a} m long and ${b} m wide. It gets a fence all the way around. One metre of fence costs ${c} €. How much does the fence cost?`,
    `Ein rechteckiger Garten ist ${a} m lang und ${b} m breit. Er bekommt rundherum einen Zaun. Ein Meter Zaun kostet ${c} €. Wie viel kostet der Zaun?`,
  );
  let given = tx(
    `**Given:** ${a} m by ${b} m, ${c} € per metre. **Wanted:** the cost.`,
    `**Gegeben:** ${a} m lang, ${b} m breit, ${c} € pro Meter. **Gesucht:** die Kosten.`,
  );
  if (rng.chance(0.35)) {
    const age = rng.int(2, 9);
    text = withExtra(text, tx(`The family's dog is ${age} years old.`, `Der Hund der Familie ist ${age} Jahre alt.`));
    given = cat(given, tx(" The dog's age doesn't matter.", " Das Alter des Hundes spielt keine Rolle."));
  }
  given = cat(given, tx(' Step 1: "all the way around" means the perimeter.', " Schritt 1: „rundherum“ heißt: Du brauchst den Umfang."));
  return {
    instruction: SOLVE,
    text,
    answer: num(p * c, "€"),
    hint: tx(
      "Two steps: the perimeter first ($u = 2 \\cdot a + 2 \\cdot b$), then the price for all the metres.",
      "Zwei Schritte: zuerst der Umfang ($u = 2 \\cdot a + 2 \\cdot b$), dann der Preis für alle Meter.",
    ),
    solution: [
      { math: `u#U =#eq 2#k1 \\cdot#o1 ${a}#a +#p 2#k2 \\cdot#o2 ${b}#b`, note: given },
      { math: `u#U =#eq ${p}#a "m"#um`, note: tx(`$${2 * a} + ${2 * b} = ${p}$: the fence is ${p} m long.`, `$${2 * a} + ${2 * b} = ${p}$: Der Zaun ist ${p} m lang.`) },
      { math: said(COST, `=#eq ${p}#a \\cdot#op ${c}#c "€"#ue`), note: tx(`Step 2: every metre costs ${c} €, so multiply.`, `Schritt 2: Jeder Meter kostet ${c} €, also multiplizieren.`) },
      {
        math: said(COST, `=#eq ${p * c}#a "€"#ue`),
        highlight: ["a", "ue"],
        note: tx(`$${p} \\cdot ${c} = ${p * c}$. **Answer:** The fence costs ${p * c} €.`, `$${p} \\cdot ${c} = ${p * c}$. **Antwort:** Der Zaun kostet ${p * c} €.`),
      },
    ],
  };
};

/** English room, German "the floor of …" in the genitive. */
const ROOMS = [
  tx("kitchen", "einer rechteckigen Küche"),
  tx("bathroom", "eines rechteckigen Badezimmers"),
  tx("hallway", "eines rechteckigen Flurs"),
  tx("classroom", "eines rechteckigen Klassenzimmers"),
];

const tileCost: Tpl = (rng) => {
  const a = rng.int(3, 8);
  const b = rng.int(2, Math.min(6, a - 1));
  const c = rng.pick([15, 20, 25, 30, 40]);
  const ab = a * b;
  const room = rng.pick(ROOMS);
  return {
    instruction: SOLVE,
    text: tx(
      `The floor of a rectangular ${E(room)} is ${a} m long and ${b} m wide. It gets new tiles. One square metre of tiles costs ${c} €. How much do the tiles cost?`,
      `Der Boden ${D(room)} ist ${a} m lang und ${b} m breit. Er bekommt neue Fliesen. Ein Quadratmeter Fliesen kostet ${c} €. Wie viel kosten die Fliesen?`,
    ),
    answer: num(ab * c, "€"),
    hint: tx(
      "Two steps: the area first ($A = a \\cdot b$), then the price for all the square metres.",
      "Zwei Schritte: zuerst der Flächeninhalt ($A = a \\cdot b$), dann der Preis für alle Quadratmeter.",
    ),
    solution: [
      {
        math: `A#A =#eq ${a}#a "m"#ua \\cdot#op ${b}#b "m"#ub`,
        note: tx(
          `**Given:** ${a} m by ${b} m, ${c} € per m². **Wanted:** the cost. Step 1: the area.`,
          `**Gegeben:** ${a} m lang, ${b} m breit, ${c} € pro m². **Gesucht:** die Kosten. Schritt 1: der Flächeninhalt.`,
        ),
      },
      { math: `A#A =#eq ${ab}#a "m"#ua^{2#sq}`, note: tx(`$${a} \\cdot ${b} = ${ab}$: the floor has ${ab} m².`, `$${a} \\cdot ${b} = ${ab}$: Der Boden ist ${ab} m² groß.`) },
      { math: said(COST, `=#eq ${ab}#a \\cdot#op ${c}#c "€"#ue`), note: tx(`Step 2: every m² costs ${c} €, so multiply.`, `Schritt 2: Jeder m² kostet ${c} €, also multiplizieren.`) },
      {
        math: said(COST, `=#eq ${ab * c}#a "€"#ue`),
        highlight: ["a", "ue"],
        note: tx(`$${ab} \\cdot ${c} = ${ab * c}$. **Answer:** The tiles cost ${ab * c} €.`, `$${ab} \\cdot ${c} = ${ab * c}$. **Antwort:** Die Fliesen kosten ${ab * c} €.`),
      },
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
  const frames: Frame[] = [
    {
      math: row(m, s),
      note: tx(
        `**Given:** ${s} km in ${m} min. **Wanted:** km per **hour**, and 1 h = 60 min.`,
        `**Gegeben:** ${s} km in ${m} min. **Gesucht:** km pro **Stunde**, und 1 h = 60 min.`,
      ),
    },
  ];
  if (q > 1) {
    frames.push(
      {
        math: row(m, s, "km", [`:#d1 ${q}#d1n`, `:#d2 ${q}#d2n`]),
        note: tx(
          `${m} min and 60 min are both multiples of ${g} min. Go to ${g} min first: divide both sides by ${q}.`,
          `${m} min und 60 min sind beide Vielfache von ${g} min. Rechne zuerst auf ${g} min: Teile beide Seiten durch ${q}.`,
        ),
      },
      { math: row(g, sg), note: tx(`In ${g} min, ${name} cycles ${de(sg)} km.`, `In ${g} min fährt ${name} ${de(sg)} km.`) },
    );
  }
  frames.push(
    {
      math: row(g, sg, "km", [`\\cdot#m1 ${k}#m1n`, `\\cdot#m2 ${k}#m2n`]),
      note: tx(`60 min are ${k} times ${g} min: multiply both sides by ${k}.`, `60 min sind ${k}-mal ${g} min: Multipliziere beide Seiten mit ${k}.`),
    },
    { math: row(60, v), note: tx(`In 60 min, so in one hour: ${v} km.`, `In 60 min, also in einer Stunde: ${v} km.`) },
    {
      math: `v#V =#eq ${v}#b "km/h"#ub`,
      highlight: ["b", "ub"],
      note: tx(`**Answer:** ${name}'s average speed is ${v} km/h.`, `**Antwort:** ${gen(name)} Durchschnittsgeschwindigkeit beträgt ${v} km/h.`),
    },
  );
  return {
    instruction: SOLVE,
    text: tx(
      `${name} cycles ${de(s)} km in ${m} minutes. What is ${name}'s average speed in km/h?`,
      `${name} fährt in ${m} Minuten ${de(s)} km mit dem Fahrrad. Wie hoch ist ${gen(name)} Durchschnittsgeschwindigkeit in km/h?`,
    ),
    answer: num(v, "km/h"),
    hint: tx(
      "km/h means: km in **60** minutes. Use the rule of three on the minutes.",
      "km/h heißt: km in **60** Minuten. Rechne mit dem Dreisatz von den Minuten auf 60 Minuten hoch.",
    ),
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
    text: tx(
      `${name} runs ${s} km at an average speed of ${v} km/h. How many minutes does the run take?`,
      `${name} läuft ${s} km mit einer Durchschnittsgeschwindigkeit von ${v} km/h. Wie viele Minuten dauert der Lauf?`,
    ),
    answer: num(M, "min"),
    hint: tx(
      "Time = distance : speed gives hours. Then change hours into minutes: 1 h = 60 min.",
      "Zeit = Strecke : Geschwindigkeit ergibt Stunden. Rechne dann Stunden in Minuten um: 1 h = 60 min.",
    ),
    solution: [
      {
        math: `t#T =#eq \\frac{s#s}{v#v}`,
        note: tx(
          `**Given:** ${s} km at ${v} km/h. **Wanted:** the time in minutes. Time = distance : speed.`,
          `**Gegeben:** ${s} km mit ${v} km/h. **Gesucht:** die Zeit in Minuten. Zeit = Strecke : Geschwindigkeit.`,
        ),
      },
      { math: `t#T =#eq \\frac{${s}#s "km"#us}{${v}#v "km/h"#uv}`, note: tx("Put in the values.", "Setze die Werte ein.") },
      { math: `t#T =#eq ${de(th)}#s "h"#us`, note: tx(`$${s} : ${v} = ${de(th)}$, in hours.`, `$${s} : ${v} = ${de(th)}$, in Stunden.`) },
      { math: `t#T =#eq ${de(th)}#s \\cdot#op 60#k "min"#us`, note: tx("1 h = 60 min, so multiply by 60.", "1 h = 60 min, also mal 60.") },
      {
        math: `t#T =#eq ${M}#s "min"#us`,
        highlight: ["s", "us"],
        note: tx(`$${de(th)} \\cdot 60 = ${M}$. **Answer:** The run takes ${M} minutes.`, `$${de(th)} \\cdot 60 = ${M}$. **Antwort:** Der Lauf dauert ${M} Minuten.`),
      },
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
  const balls = tx("balls", "Bälle");
  const restWord = tx("rest", "Rest");
  let text = tx(
    `The football club has ${B} € to spend. First it buys a new goal net for ${net} €. With the rest of the money it buys balls at ${p} € each. How many balls can the club buy${rest ? " at most" : ""}?`,
    `Der Fußballverein hat ${B} € zur Verfügung. Zuerst kauft er ein neues Tornetz für ${net} €. Vom restlichen Geld kauft er Bälle zu je ${p} €. Wie viele Bälle kann der Verein${rest ? " höchstens" : ""} kaufen?`,
  );
  let given = tx(
    `**Given:** ${B} €, the net costs ${net} €, a ball ${p} €. **Wanted:** the number of balls.`,
    `**Gegeben:** ${B} €, das Netz kostet ${net} €, ein Ball ${p} €. **Gesucht:** die Anzahl der Bälle.`,
  );
  if (rng.chance(0.35)) {
    const members = rng.int(8, 25) * 10;
    text = withExtra(text, tx(`The club has ${members} members.`, `Der Verein hat ${members} Mitglieder.`));
    given = cat(given, tx(" The number of members doesn't matter.", " Die Zahl der Mitglieder spielt keine Rolle."));
  }
  given = cat(given, tx(" Step 1: the money left after the net.", " Schritt 1: das Geld, das nach dem Netz übrig bleibt."));
  return {
    instruction: SOLVE,
    text,
    answer: num(k, balls),
    hint: tx(
      "Two steps: what's left after the net? Then: how many balls fit into that?",
      "Zwei Schritte: Wie viel bleibt nach dem Netz übrig? Dann: Wie viele Bälle kann man davon kaufen?",
    ),
    solution: [
      { math: said(restWord, `=#eq ${B}#a "€"#ua -#op ${net}#b "€"#ub`), note: given },
      { math: said(restWord, `=#eq ${left}#a "€"#ua`), note: tx(`$${B} - ${net} = ${left}$. That's what's left.`, `$${B} - ${net} = ${left}$. So viel bleibt übrig.`) },
      {
        math: said(balls, `=#eq ${left}#a "€"#ua :#op2 ${p}#c "€"#uc`, "w2"),
        note: tx(`Step 2: how often do ${p} € fit into ${left} €?`, `Schritt 2: Wie oft passen ${p} € in ${left} €?`),
      },
      {
        math: said(balls, `=#eq ${k}#a`, "w2"),
        highlight: ["a"],
        note: rest
          ? tx(
              `$${k} \\cdot ${p} = ${k * p}$, and ${rest} € are left over. That's not enough for another ball. **Answer:** The club can buy ${k} balls.`,
              `$${k} \\cdot ${p} = ${k * p}$, und ${rest} € ${rest === 1 ? "bleibt" : "bleiben"} übrig. Das reicht nicht für einen weiteren Ball. **Antwort:** Der Verein kann ${k} Bälle kaufen.`,
            )
          : tx(`$${left} : ${p} = ${k}$. **Answer:** The club can buy ${k} balls.`, `$${left} : ${p} = ${k}$. **Antwort:** Der Verein kann ${k} Bälle kaufen.`),
      },
    ],
  };
};

const PLACES = [tx("the seaside", "ans Meer"), tx("Grandma's house", "zu Oma"), tx("the holiday camp", "ins Ferienlager"), tx("the mountains", "in die Berge"), tx("the theme park", "in den Freizeitpark")];

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
  const [dist, va, vb] = rng.pick(options);
  const ta = dist / va;
  const tb = dist / vb;
  const place = rng.pick(PLACES);
  return {
    instruction: SOLVE,
    text: tx(
      `At ${va} km/h, the drive to ${E(place)} takes ${de(ta)} hours. How many hours does the drive take at ${vb} km/h?`,
      `Bei ${va} km/h dauert die Fahrt ${D(place)} ${stunden(ta)}. Wie viele Stunden dauert die Fahrt bei ${vb} km/h?`,
    ),
    answer: num(tb, "h"),
    hint: tx(
      "The distance stays the same. Work it out first: distance = speed · time.",
      "Die Strecke bleibt gleich. Berechne sie zuerst: Strecke = Geschwindigkeit · Zeit.",
    ),
    solution: [
      {
        math: `s#S =#eq ${va}#va "km/h"#uva \\cdot#op ${de(ta)}#ta "h"#uta`,
        note: tx(
          `**Given:** ${de(ta)} h at ${va} km/h. **Wanted:** the time at ${vb} km/h. The distance stays the same, so find it first.`,
          `**Gegeben:** ${de(ta)} h bei ${va} km/h. **Gesucht:** die Zeit bei ${vb} km/h. Die Strecke bleibt gleich, also berechne sie zuerst.`,
        ),
      },
      { math: `s#S =#eq ${dist}#d "km"#ud`, note: tx(`$${va} \\cdot ${de(ta)} = ${dist}$: the drive is ${dist} km long.`, `$${va} \\cdot ${de(ta)} = ${dist}$: Die Strecke ist ${dist} km lang.`) },
      { math: `t#T =#eq \\frac{${dist}#d "km"#ud}{${vb}#vb "km/h"#uvb}`, note: tx("Now time = distance : speed.", "Jetzt gilt: Zeit = Strecke : Geschwindigkeit.") },
      {
        math: `t#T =#eq ${de(tb)}#d "h"#ud`,
        highlight: ["d", "ud"],
        note: tx(
          `$${dist} : ${vb} = ${de(tb)}$. **Answer:** At ${vb} km/h the drive takes ${de(tb)} hours.`,
          `$${dist} : ${vb} = ${de(tb)}$. **Antwort:** Bei ${vb} km/h dauert die Fahrt ${stunden(tb)}.`,
        ),
      },
    ],
  };
};

const FLAT_THINGS = [
  { en: "rug", de: { a: "Ein rechteckiger Teppich", the: "Der Teppich" } },
  { en: "table top", de: { a: "Eine rechteckige Tischplatte", the: "Die Tischplatte" } },
  { en: "banner", de: { a: "Ein rechteckiges Banner", the: "Das Banner" } },
  { en: "poster", de: { a: "Ein rechteckiges Plakat", the: "Das Plakat" } },
];

const mixedArea: Tpl = (rng) => {
  const what = rng.pick(FLAT_THINGS);
  const a = rng.pick([1.5, 2, 2.5, 3, 4]);
  const bcm = rng.pick([40, 50, 60, 80]);
  const bm = bcm / 100;
  const A = Math.round(a * bm * 100) / 100;
  return {
    instruction: SOLVE,
    text: tx(
      `A rectangular ${what.en} is ${de(a)} m long and ${bcm} cm wide. What is its area in m²?`,
      `${what.de.a} ist ${de(a)} m lang und ${bcm} cm breit. Wie groß ist der Flächeninhalt in m²?`,
    ),
    answer: num(A, "m²"),
    hint: tx(
      "Mixed units! Change the cm into m first (100 cm = 1 m), then multiply.",
      "Achtung, gemischte Einheiten! Rechne zuerst cm in m um (100 cm = 1 m), dann multipliziere.",
    ),
    solution: [
      {
        math: `${bcm}#b "cm"#ub =#eq ${de(bm)}#c "m"#uc`,
        note: tx(
          `**Given:** ${de(a)} m and ${bcm} cm. **Wanted:** the area in m². Mixed units, so convert first: 100 cm = 1 m.`,
          `**Gegeben:** ${de(a)} m und ${bcm} cm. **Gesucht:** der Flächeninhalt in m². Gemischte Einheiten, also zuerst umrechnen: 100 cm = 1 m.`,
        ),
      },
      {
        math: `A#A =#eq ${de(a)}#a "m"#ua \\cdot#op ${de(bm)}#c "m"#uc`,
        note: tx("Now both lengths are in m. Area = length · width.", "Jetzt sind beide Längen in m. Flächeninhalt = Länge · Breite."),
      },
      {
        math: `A#A =#eq ${de(A)}#a "m"#ua^{2#sq}`,
        highlight: ["a", "ua", "sq"],
        note: tx(
          `$${de(a)} \\cdot ${de(bm)} = ${de(A)}$. **Answer:** The ${what.en} has an area of ${de(A)} m².`,
          `$${de(a)} \\cdot ${de(bm)} = ${de(A)}$. **Antwort:** ${what.de.the} hat einen Flächeninhalt von ${de(A)} m².`,
        ),
      },
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
// Each story is written in both languages; the tappable parts ({g:…} given,
// {w:…} wanted, {x:…} extra) appear in the same order with the same numbers.

type SpotStory = { text: Text; extras: Text[]; op: Text; calc: string[]; answer: Text };

const SPOT_STORIES: SpotStory[] = [
  {
    text: tx(
      "Mia is {x:13 years old}. She buys {g:4 tickets} for the cinema. One ticket costs {g:9 €}. {w:How much does Mia pay in total?}",
      "Mia ist {x:13 Jahre alt}. Sie kauft {g:4 Karten} fürs Kino. Eine Karte kostet {g:9 €}. {w:Wie viel bezahlt Mia insgesamt?}",
    ),
    extras: [tx("Mia's age doesn't change the price. Cross it out!", "Mias Alter ändert nichts am Preis. Streich es durch!")],
    op: tx("The same price 4 times: **multiply**.", "4-mal derselbe Preis: **multiplizieren**."),
    calc: ['4 \\cdot 9 "€" = 36 "€"'],
    answer: tx("Mia pays 36 € in total.", "Mia bezahlt insgesamt 36 €."),
  },
  {
    text: tx(
      "On a school trip, the {x:26 students} of class 7b cycle {g:48 km}. Their bikes have {x:21 gears}. The tour takes {g:3 hours}. {w:What is their average speed?}",
      "Bei einem Klassenausflug fahren die {x:26 Kinder} der Klasse 7b {g:48 km} mit dem Rad. Ihre Räder haben {x:21 Gänge}. Die Tour dauert {g:3 Stunden}. {w:Wie hoch ist ihre Durchschnittsgeschwindigkeit?}",
    ),
    extras: [
      tx("The number of students doesn't change the speed.", "Die Zahl der Kinder ändert nichts an der Geschwindigkeit."),
      tx("The gears don't matter for this question. Cross them out!", "Die Gänge spielen für diese Frage keine Rolle. Streich sie durch!"),
    ],
    op: tx("Speed is distance divided by time.", "Geschwindigkeit ist Strecke geteilt durch Zeit."),
    calc: ['v = 48 "km" : 3 "h" = 16 "km/h"'],
    answer: tx("They cycle at 16 km/h on average.", "Sie fahren im Schnitt 16 km/h."),
  },
  {
    text: tx(
      "Emma's recipe for {g:12 muffins} needs {g:300 g of flour}. The muffins bake for {x:25 minutes}. Emma wants to bake {g:20 muffins}. {w:How much flour does she need?}",
      "Für {g:12 Muffins} braucht Emma {g:300 g Mehl}. Die Muffins backen {x:25 Minuten} im Ofen. Emma möchte {g:20 Muffins} backen. {w:Wie viel Mehl braucht sie?}",
    ),
    extras: [tx("The baking time has nothing to do with the flour.", "Die Backzeit hat nichts mit dem Mehl zu tun.")],
    op: tx("Rule of three: first 1 muffin, then 20.", "Dreisatz: erst 1 Muffin, dann 20."),
    calc: ['300 "g" : 12 = 25 "g"', '20 \\cdot 25 "g" = 500 "g"'],
    answer: tx("Emma needs 500 g of flour.", "Emma braucht 500 g Mehl."),
  },
  {
    text: tx(
      "The Kaya family's garden is {g:15 m} long and {g:8 m} wide. Their dog Bello is {x:4 years} old. {w:How long is a fence all the way around the garden?}",
      "Der Garten von Familie Kaya ist {g:15 m} lang und {g:8 m} breit. Ihr Hund Bello ist {x:4 Jahre} alt. {w:Wie lang ist ein Zaun einmal rund um den Garten?}",
    ),
    extras: [tx("Bello is cute, but his age doesn't help here!", "Bello ist süß, aber sein Alter hilft hier nicht weiter!")],
    op: tx("All the way around means the perimeter: two lengths and two widths.", "Einmal rundherum heißt: der Umfang. Also zwei Längen und zwei Breiten."),
    calc: ['u = 2 \\cdot 15 "m" + 2 \\cdot 8 "m" = 46 "m"'],
    answer: tx("The fence is 46 m long.", "Der Zaun ist 46 m lang."),
  },
  {
    text: tx(
      "The football club has {x:120 members}. It buys {g:15 new balls}. One ball costs {g:24 €}. {w:How much do the balls cost altogether?}",
      "Der Fußballverein hat {x:120 Mitglieder}. Er kauft {g:15 neue Bälle}. Ein Ball kostet {g:24 €}. {w:Wie viel kosten die Bälle zusammen?}",
    ),
    extras: [tx("The number of members doesn't change the price of the balls.", "Die Zahl der Mitglieder ändert nichts am Preis der Bälle.")],
    op: tx("The same price 15 times: **multiply**.", "15-mal derselbe Preis: **multiplizieren**."),
    calc: ['15 \\cdot 24 "€" = 360 "€"'],
    answer: tx("The balls cost 360 € altogether.", "Die Bälle kosten zusammen 360 €."),
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

const FOUND = [
  tx("Yes, you need that one.", "Ja, die brauchst du."),
  tx("Right, that's given.", "Richtig, das ist gegeben."),
  tx("Good eye! That number matters.", "Gut aufgepasst! Die Zahl ist wichtig."),
  tx("Exactly, that's part of the maths.", "Genau, die gehört zur Rechnung."),
];
const spring = { type: "spring" as const, stiffness: 420, damping: 32 };

function BlobSays({ text, mood }: { text: Text; mood: BlobMood }) {
  const line = useText()(text);
  return (
    <div className="flex items-end gap-2.5">
      <div className="shrink-0">
        <Blob size={52} mood={mood} track={false} accessory="glasses" interactive={false} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={line}
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
          transition={spring}
          style={{ transformOrigin: "bottom left" }}
          className="mb-2 rounded-2xl rounded-bl-md border border-line bg-raised px-3.5 py-2 text-[14px] leading-snug text-ink shadow-card"
        >
          <Inline text={line} />
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
  const t = useText();
  const parts = parseStory(t(story.text));
  const tappable = parts.filter((p): p is Extract<SpotPart, { id: number }> => p.kind !== "text");
  const needed = tappable.filter((p) => p.kind !== "x");
  const [picked, setPicked] = useState<number[]>([]);
  const [crossed, setCrossed] = useState<number[]>([]);
  const [shake, setShake] = useState({ id: -1, n: 0 });
  const [say, setSay] = useState<{ text: Text; mood: BlobMood }>({
    text: tx("Tap every number you need, and the question.", "Tippe auf jede Zahl, die du brauchst, und auf die Frage."),
    mood: "happy",
  });
  const done = needed.every((p) => picked.includes(p.id));
  const found = needed.filter((p) => picked.includes(p.id)).length;

  function tap(p: Extract<SpotPart, { id: number }>) {
    if (done || picked.includes(p.id)) return;
    if (p.kind === "x") {
      if (!crossed.includes(p.id)) setCrossed((c) => [...c, p.id]);
      setShake((s) => ({ id: p.id, n: s.n + 1 }));
      setSay({ text: story.extras[p.extra] ?? tx("That one isn't needed.", "Die brauchst du nicht."), mood: "thinking" });
      return;
    }
    const next = [...picked, p.id];
    setPicked(next);
    const finished = needed.every((q) => next.includes(q.id));
    if (finished) setSay({ text: tx("All found! Now the maths is easy.", "Alles gefunden! Jetzt ist die Rechnung ganz leicht."), mood: "excited" });
    else if (p.kind === "w")
      setSay({ text: tx("That's the question. Now you know what you're looking for.", "Das ist die Frage. Jetzt weißt du, was gesucht ist."), mood: "happy" });
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
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          {t(tx("Story", "Aufgabe"))} {index + 1}
        </span>
        <span className="flex items-center gap-1" aria-label={t(tx(`${found} of ${needed.length} found`, `${found} von ${needed.length} gefunden`))}>
          {needed.map((p, i) => (
            <motion.span key={p.id} animate={{ scale: i < found ? 1 : 0.8 }} className={cn("size-2 rounded-full transition-colors", i < found ? "bg-blob" : "bg-line-2")} />
          ))}
        </span>
        <button onClick={onNext} className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <Shuffle className="size-3.5" /> {t(tx("Another story", "Nächste Aufgabe"))}
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
          <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Given", "Gegeben"))}</div>
          <div className="flex flex-wrap gap-1.5">{needed.filter((p) => p.kind === "g" && picked.includes(p.id)).map(chip)}</div>
        </div>
        <div className="min-h-[86px] rounded-xl border border-dashed border-line-2 p-3">
          <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Wanted", "Gesucht"))}</div>
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
            <Step n={3} label={t(tx("Operation", "Rechenart"))} delay={0.45}>
              <Inline text={story.op} />
            </Step>
            <Step n={4} label={t(tx("Calculate", "Rechnung"))} delay={0.75}>
              <span className="flex flex-col gap-1">
                {story.calc.map((c) => (
                  <MathView key={c} src={c} size="md" animate={false} />
                ))}
              </span>
            </Step>
            <Step n={5} label={t(tx("Answer", "Antwort"))} delay={1.05}>
              <span className="font-medium">{t(story.answer)}</span>
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

type RatioCase = { lHead: Text; rHead: Text; one: Text; many: Text; unit: Text; a: number; va: number; targets: number[]; start: number; money?: boolean };

const PROPORTIONAL: RatioCase[] = [
  { lHead: tx("Apples", "Äpfel"), rHead: tx("Price", "Preis"), one: "kg", many: "kg", unit: "€", a: 3, va: 6, targets: [2, 4, 5, 6, 7, 8, 9, 10], start: 5, money: true },
  { lHead: tx("Notebooks", "Hefte"), rHead: tx("Price", "Preis"), one: tx("notebook", "Heft"), many: tx("notebooks", "Hefte"), unit: "€", a: 4, va: 6, targets: [2, 3, 5, 6, 7, 8, 10, 12], start: 7, money: true },
  { lHead: tx("People", "Personen"), rHead: tx("Pasta", "Nudeln"), one: tx("person", "Person"), many: tx("people", "Personen"), unit: "g", a: 4, va: 500, targets: [2, 3, 5, 6, 7, 8, 10], start: 6 },
  { lHead: tx("Time", "Zeit"), rHead: tx("Printed", "Gedruckt"), one: "min", many: "min", unit: tx("pages", "Seiten"), a: 3, va: 75, targets: [2, 4, 5, 6, 8, 10, 12], start: 8 },
];

const INVERSE_CASES: RatioCase[] = [
  { lHead: tx("Painters", "Maler"), rHead: tx("Time", "Zeit"), one: tx("painter", "Maler"), many: tx("painters", "Maler"), unit: tx("days", "Tage"), a: 4, va: 6, targets: [2, 3, 6, 8, 12], start: 3 },
  { lHead: tx("Pumps", "Pumpen"), rHead: tx("Time", "Zeit"), one: tx("pump", "Pumpe"), many: tx("pumps", "Pumpen"), unit: "h", a: 3, va: 8, targets: [2, 4, 6, 8, 12], start: 4 },
  { lHead: tx("Friends", "Freunde"), rHead: tx("Each pays", "Pro Kopf"), one: tx("friend", "Freund"), many: tx("friends", "Freunde"), unit: "€", a: 6, va: 8, targets: [2, 3, 4, 8, 12, 16], start: 4, money: true },
  { lHead: tx("Horses", "Pferde"), rHead: tx("Hay lasts", "Dauer"), one: tx("horse", "Pferd"), many: tx("horses", "Pferde"), unit: tx("days", "Tage"), a: 5, va: 12, targets: [2, 3, 4, 6, 10, 12], start: 6 },
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
  const say = useText();
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
  const unitL = (n: number) => say(n === 1 ? c.one : c.many);
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
              <span className="relative">{m ? say(tx("More → less", "Mehr → weniger")) : say(tx("More → more", "Mehr → mehr"))}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[13px] text-ink-2">{say(tx("Wanted:", "Gesucht:"))}</span>
          <button
            onClick={() => step(-1)}
            disabled={pos <= 0}
            className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
            aria-label={say(tx("Fewer", "Weniger"))}
          >
            <Minus className="size-3.5" />
          </button>
          <motion.span key={t} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="min-w-6 text-center font-math text-[20px] tabular-nums">
            {t}
          </motion.span>
          <button
            onClick={() => step(1)}
            disabled={pos >= c.targets.length - 1}
            className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
            aria-label={say(tx("More", "Mehr"))}
          >
            <Plus className="size-3.5" />
          </button>
          <span className="ml-1 text-[13px] text-ink-2">{unitL(t)}</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => restart(() => {})}
            className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-hover hover:text-ink"
            aria-label={say(tx("Replay", "Nochmal abspielen"))}
            title={say(tx("Replay", "Nochmal abspielen"))}
          >
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
            <Shuffle className="size-3.5" /> {say(tx("Another example", "Anderes Beispiel"))}
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
            <span>{say(c.lHead)}</span>
            <span />
            <span>{say(c.rHead)}</span>
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
                <span className="flex min-w-0 flex-col items-center justify-center leading-none sm:flex-row sm:items-baseline sm:gap-1.5 sm:leading-normal">
                  <span className="font-math text-[22px] tabular-nums">{row.l}</span>
                  <span className="max-w-full truncate text-[11.5px] leading-tight text-ink-2 sm:text-[13px] sm:leading-normal">{unitL(row.l)}</span>
                </span>
                <span className="text-center text-ink-3">→</span>
                <span className="flex min-w-0 flex-col items-center justify-center leading-none sm:flex-row sm:items-baseline sm:gap-1.5 sm:leading-normal">
                  <span className={cn("font-math text-[22px] tabular-nums", last && "font-semibold text-blob-ink")}>{fmt(row.r)}</span>
                  <span className="max-w-full truncate text-[11.5px] leading-tight text-ink-2 sm:text-[13px] sm:leading-normal">{say(c.unit)}</span>
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
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-blob-ink">
            {inv ? say(tx("Inverse", "Antiproportional")) : say(tx("Proportional", "Proportional"))}
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
            {inv
              ? say(
                  tx(
                    "More on the left means less on the right. So on the right you do the opposite: divide becomes multiply.",
                    "Mehr auf der linken Seite heißt weniger auf der rechten. Rechts rechnest du deshalb umgekehrt: Aus Dividieren wird Multiplizieren.",
                  ),
                )
              : say(
                  tx(
                    "More on the left means more on the right. Do the same on both sides: divide, then multiply.",
                    "Mehr auf der linken Seite heißt mehr auf der rechten. Rechne auf beiden Seiten gleich: erst dividieren, dann multiplizieren.",
                  ),
                )}
          </p>
        </div>
        <div className="rounded-xl bg-surface px-4 py-3">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            {inv ? say(tx("The product stays the same", "Das Produkt bleibt gleich")) : say(tx("The ratio stays the same", "Der Quotient bleibt gleich"))}
          </div>
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
  {
    math: tx(`4#n "tickets"#t \\quad 9#p "€"#u "each"#e`, `4#n "Karten"#t \\quad "je"#e 9#p "€"#u`),
    note: tx("**1. Read** the story carefully. **2. Given:** 4 tickets, 9 € each.", "**1. Lies** die Aufgabe genau. **2. Gegeben:** 4 Karten zu je 9 €."),
  },
  {
    math: tx(`4#n "tickets"#t \\quad 9#p "€"#u "each"#e \\quad \\to#ar \\quad ?#q "€"#u2`, `4#n "Karten"#t \\quad "je"#e 9#p "€"#u \\quad \\to#ar \\quad ?#q "€"#u2`),
    note: tx("**2. Wanted:** the total price. Mark it with a question mark.", "**2. Gesucht:** der Gesamtpreis. Markiere ihn mit einem Fragezeichen."),
  },
  { math: `4#n \\cdot#op 9#p "€"#u`, note: tx("**3. Operation:** the same price 4 times, so **multiply**.", "**3. Rechenart:** 4-mal derselbe Preis, also **multiplizieren**.") },
  { math: `4#n \\cdot#op 9#p "€"#u =#eq 36#r "€"#u2`, note: tx("**4. Calculate:** $4 \\cdot 9 = 36$.", "**4. Rechnen:** $4 \\cdot 9 = 36$.") },
  {
    math: `36#r "€"#u2`,
    highlight: ["r", "u2"],
    note: tx("**5. Answer sentence:** Mia pays 36 € for the tickets. Always with the unit!", "**5. Antwortsatz:** Mia bezahlt 36 € für die Karten. Immer mit Einheit!"),
  },
  {
    math: `36#r "€"#u2 \\approx#ap 4#n \\cdot#op 10#p "€"#u`,
    note: tx(
      '**6. Check:** roughly $4 \\cdot 10 "€" = 40 "€"$. 36 € is close, so the answer makes sense.',
      '**6. Probe:** Überschlag $4 \\cdot 10 "€" = 40 "€"$. 36 € liegt nah dran, das Ergebnis passt also.',
    ),
  },
];

const applesFrames = ruleOfThree({
  a: 3,
  va: 6,
  b: 5,
  one: "kg",
  many: "kg",
  unit: "€",
  money: true,
  given: tx("**Given:** 3 kg of apples cost 6 €. **Wanted:** the price of 5 kg.", "**Gegeben:** 3 kg Äpfel kosten 6 €. **Gesucht:** der Preis für 5 kg."),
  why: tx(
    "Twice the apples, twice the price: **proportional**. Go to **one** first: divide both sides by 3.",
    "Doppelt so viele Äpfel, doppelter Preis: **proportional**. Rechne zuerst auf **1 kg** zurück: Teile beide Seiten durch 3.",
  ),
  oneNote: tx("1 kg costs 2 €. That's the step to **one**.", "1 kg kostet 2 €. Das ist der Schluss auf die **Einheit**."),
  answer: tx("**Answer:** 5 kg of apples cost 10 €.", "**Antwort:** 5 kg Äpfel kosten 10 €."),
});

const paintersFrames = ruleOfThree({
  a: 4,
  va: 6,
  b: 3,
  one: tx("painter", "Maler"),
  many: tx("painters", "Maler"),
  unit: tx("days", "Tage"),
  inverse: true,
  given: tx("**Given:** 4 painters need 6 days. **Wanted:** the time for 3 painters.", "**Gegeben:** 4 Maler brauchen 6 Tage. **Gesucht:** die Zeit für 3 Maler."),
  why: tx(
    "1 painter needs **4 times as long**. So divide the left side by 4, but **multiply** the right side by 4.",
    "1 Maler braucht **4-mal so lange**. Teile also die linke Seite durch 4, aber **multipliziere** die rechte Seite mit 4.",
  ),
  oneNote: tx("1 painter alone would need 24 days.", "1 Maler allein bräuchte 24 Tage."),
  answer: tx(
    "**Answer:** 3 painters need 8 days. Check: $4 \\cdot 6 = 3 \\cdot 8 = 24$. The product stays the same.",
    "**Antwort:** 3 Maler brauchen 8 Tage. Probe: $4 \\cdot 6 = 3 \\cdot 8 = 24$. Das Produkt bleibt gleich.",
  ),
});

const speedFrames: Frame[] = [
  { math: `v#V =#eq \\frac{s#s}{t#t}`, note: tx("Speed = distance : time. $s$ is the distance, $t$ the time.", "Geschwindigkeit = Strecke : Zeit. $s$ ist die Strecke, $t$ die Zeit.") },
  {
    math: `v#V =#eq \\frac{240#s "km"#us}{3#t "h"#ut}`,
    note: tx(
      "A train travels 240 km in 3 hours. Put in the values with their units.",
      "Ein Zug fährt 240 km in 3 Stunden. Setze die Werte mit ihren Einheiten ein.",
    ),
  },
  { math: `v#V =#eq 80#s "km/h"#us`, note: tx("$240 : 3 = 80$, and km : h gives km/h.", "$240 : 3 = 80$, und km : h ergibt km/h.") },
  {
    math: `45#m "min"#um =#eq \\frac{45#m2}{60#d} "h"#uh`,
    note: tx(
      "How far does it get in 45 minutes? Change the minutes into hours first: 1 h = 60 min.",
      "Wie weit kommt der Zug in 45 Minuten? Rechne die Minuten zuerst in Stunden um: 1 h = 60 min.",
    ),
  },
  { math: `45#m "min"#um =#eq 0,75#m2 "h"#uh`, note: tx("$\\frac{45}{60} = \\frac{3}{4} = 0,75$, so 45 min = 0,75 h.", "$\\frac{45}{60} = \\frac{3}{4} = 0,75$, also 45 min = 0,75 h.") },
  { math: `s#S =#eq 80#s "km/h"#us \\cdot#op 0,75#m2 "h"#uh`, note: tx("Distance = speed · time.", "Strecke = Geschwindigkeit · Zeit.") },
  {
    math: `s#S =#eq 60#s "km"#us`,
    highlight: ["s", "us"],
    note: tx(
      "$80 \\cdot 0,75 = 60$ (three quarters of 80). **Answer:** In 45 minutes the train travels 60 km.",
      "$80 \\cdot 0,75 = 60$ (drei Viertel von 80). **Antwort:** In 45 Minuten fährt der Zug 60 km.",
    ),
  },
];

const wordProblems: Topic = {
  ...topicMeta("word-problems"),
  summary: [
    {
      title: tx("Six steps, every time", "Sechs Schritte, jedes Mal"),
      body: tx(
        "**1.** Read carefully. **2.** Given and wanted. **3.** Choose the operation. **4.** Calculate. **5.** Answer sentence with the unit. **6.** Check: does the size make sense?",
        "**1.** Genau lesen. **2.** Gegeben und gesucht. **3.** Rechenart wählen. **4.** Rechnen. **5.** Antwortsatz mit Einheit. **6.** Probe: Passt die Größenordnung?",
      ),
      tone: "rule",
    },
    {
      title: tx("Rule of three: proportional", "Dreisatz: proportional"),
      body: tx(
        "More of one, more of the other. Go to **one** first, then to the amount you want. Same operation on both sides.",
        "Je mehr vom einen, desto mehr vom anderen. Rechne zuerst auf **1** zurück, dann auf die gesuchte Menge. Auf beiden Seiten dieselbe Rechenart.",
      ),
      examples: ['3 "kg" \\to 6 "€"', '1 "kg" \\to 2 "€"', '5 "kg" \\to 10 "€"'],
      tone: "rule",
    },
    {
      title: tx("Inverse proportion", "Dreisatz: antiproportional"),
      body: tx(
        "More workers, less time. On the right side you do the **opposite** operation. The product stays the same.",
        "Je mehr Arbeiter, desto weniger Zeit. Auf der rechten Seite rechnest du **umgekehrt**. Das Produkt bleibt gleich.",
      ),
      examples: [
        tx('4 "painters" \\to 6 "days"', '4 "Maler" \\to 6 "Tage"'),
        tx('1 "painter" \\to 24 "days"', '1 "Maler" \\to 24 "Tage"'),
        tx('3 "painters" \\to 8 "days"', '3 "Maler" \\to 8 "Tage"'),
      ],
      tone: "rule",
    },
    {
      title: tx("Formulas you need", "Formeln, die du brauchst"),
      body: tx(
        "Speed is distance divided by time. A rectangle's area is length times width, its perimeter is all four sides added up.",
        "Geschwindigkeit ist Strecke geteilt durch Zeit. Der Flächeninhalt eines Rechtecks ist Länge mal Breite, der Umfang ist die Summe aller vier Seiten.",
      ),
      examples: ["v = \\frac{s}{t}", "A = a \\cdot b", "u = 2 \\cdot a + 2 \\cdot b"],
      tone: "tip",
    },
    {
      title: tx("Units", "Einheiten"),
      body: tx(
        "Bigger unit to smaller unit: multiply. Smaller to bigger: divide.",
        "Von der größeren zur kleineren Einheit: multiplizieren. Von der kleineren zur größeren: dividieren.",
      ),
      examples: ['1 "km" = 1000 "m" , \\quad 1 "m" = 100 "cm"', '1 "h" = 60 "min" , \\quad 1 "€" = 100 "ct"', '1 "kg" = 1000 "g" , \\quad 1 "l" = 1000 "ml"'],
      tone: "tip",
    },
    {
      title: tx("Classic mistake", "Typischer Fehler"),
      body: tx(
        "Mixing units. Convert first, then calculate. And never forget the unit in your answer.",
        "Einheiten mischen. Erst umrechnen, dann rechnen. Und vergiss nie die Einheit im Antwortsatz.",
      ),
      examples: ['45 "min" \\ne 0,45 "h"', '45 "min" = 0,75 "h"'],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("A plan for every word problem", "Ein Plan für jede Textaufgabe"),
      blob: tx(
        "Word problems look scary, but one plan works every time. Let's walk through it!",
        "Textaufgaben wirken erst mal schwierig, aber ein Plan klappt jedes Mal. Gehen wir ihn zusammen durch!",
      ),
      body: tx(
        "**Mia buys 4 cinema tickets. One ticket costs 9 €. How much does she pay?** Every word problem, same six steps: read, given and wanted, operation, calculate, answer sentence, check.",
        "**Mia kauft 4 Kinokarten. Eine Karte kostet 9 €. Wie viel bezahlt sie?** Bei jeder Textaufgabe dieselben sechs Schritte: lesen, gegeben und gesucht, Rechenart, rechnen, Antwortsatz, Probe.",
      ),
      frames: planFrames,
    },
    {
      type: "widget",
      title: tx("What's given, what's wanted?", "Was ist gegeben, was ist gesucht?"),
      blob: tx("Stories often hide numbers you don't need. Can you spot them?", "Textaufgaben verstecken oft Zahlen, die du gar nicht brauchst. Findest du sie?"),
      body: tx(
        "Tap the numbers you need and the question. Some numbers are only there to confuse you: tap them and they get crossed out.",
        "Tippe auf die Zahlen, die du brauchst, und auf die Frage. Manche Zahlen sollen dich nur verwirren: Tippst du sie an, werden sie durchgestrichen.",
      ),
      widget: GivenWanted,
    },
    {
      type: "check",
      blob: tx("Your turn! Given, wanted, operation…", "Jetzt du! Gegeben, gesucht, Rechenart …"),
      exercise: {
        instruction: SOLVE,
        text: tx(
          "The bus for the school trip costs 375 € in total. The 25 students of class 7a share the cost equally. How much does each student pay?",
          "Der Bus für die Klassenfahrt kostet insgesamt 375 €. Die 25 Schülerinnen und Schüler der Klasse 7a teilen sich die Kosten gleichmäßig. Wie viel bezahlt jeder?",
        ),
        answer: { kind: "number", value: 15, unit: "€" },
        hint: tx(
          "Shared **equally**: divide the total cost by the number of students.",
          "**Gleichmäßig** geteilt: Teile die Gesamtkosten durch die Anzahl der Schülerinnen und Schüler.",
        ),
        solution: [
          {
            math: said(EACH, `=#eq ?#q`),
            note: tx("**Given:** 375 € in total, 25 students. **Wanted:** the amount per student.", "**Gegeben:** 375 € insgesamt, 25 Kinder. **Gesucht:** der Betrag pro Person."),
          },
          { math: said(EACH, `=#eq 375#t "€"#u :#op 25#n`), note: tx("Shared equally: **divide** by 25.", "Gleichmäßig geteilt: **Dividiere** durch 25.") },
          {
            math: said(EACH, `=#eq 15#t "€"#u`),
            highlight: ["t", "u"],
            note: tx("$375 : 25 = 15$. **Answer:** Each student pays 15 €.", "$375 : 25 = 15$. **Antwort:** Jeder bezahlt 15 €."),
          },
        ],
      },
    },
    {
      type: "explain",
      title: tx("The rule of three (Dreisatz)", "Der Dreisatz"),
      blob: tx("This one is a superstar. It solves loads of problems!", "Der Dreisatz ist ein echter Superstar. Damit löst du jede Menge Aufgaben!"),
      body: tx(
        "**3 kg of apples cost 6 €. How much do 5 kg cost?** If one quantity doubles and the other doubles too, they are **proportional**. Then go from the given pair to **one**, and from one to the amount you want.",
        "**3 kg Äpfel kosten 6 €. Wie viel kosten 5 kg?** Wenn sich die eine Größe verdoppelt und die andere auch, sind sie **proportional**. Dann rechnest du vom gegebenen Paar auf **1** zurück und von dort auf die gesuchte Menge.",
      ),
      frames: applesFrames,
    },
    {
      type: "check",
      blob: tx("First the price of one notebook, then seven!", "Erst der Preis für ein Heft, dann für sieben!"),
      exercise: {
        instruction: SOLVE,
        text: tx("4 notebooks cost 6 €. How much do 7 notebooks cost?", "4 Hefte kosten 6 €. Wie viel kosten 7 Hefte?"),
        answer: { kind: "number", value: 10.5, unit: "€" },
        hint: tx("1 notebook costs $6 : 4 = 1,50$ €. Now multiply by 7.", "1 Heft kostet $6 : 4 = 1,50$ €. Jetzt multipliziere mit 7."),
        solution: ruleOfThree({
          a: 4,
          va: 6,
          b: 7,
          one: tx("notebook", "Heft"),
          many: tx("notebooks", "Hefte"),
          unit: "€",
          money: true,
          given: tx("**Given:** 4 notebooks cost 6 €. **Wanted:** the price of 7 notebooks.", "**Gegeben:** 4 Hefte kosten 6 €. **Gesucht:** der Preis für 7 Hefte."),
          why: tx("More notebooks, higher price: proportional. Divide both sides by 4.", "Mehr Hefte, höherer Preis: proportional. Teile beide Seiten durch 4."),
          oneNote: tx("So 1 notebook costs 1,50 €.", "1 Heft kostet also 1,50 €."),
          answer: tx("**Answer:** 7 notebooks cost 10,50 €.", "**Antwort:** 7 Hefte kosten 10,50 €."),
        }),
      },
    },
    {
      type: "explain",
      title: tx("More workers, less time", "Mehr Arbeiter, weniger Zeit"),
      blob: tx("Careful, this one is sneaky. Sometimes more means less!", "Vorsicht, jetzt wird's knifflig. Manchmal heißt mehr nämlich weniger!"),
      body: tx(
        "**4 painters need 6 days. How long do 3 painters need?** More painters need **less** time. When one quantity goes up and the other goes down like this, they are **inverse** (antiproportional). The rule of three still works, but on the right side you do the **opposite**.",
        "**4 Maler brauchen 6 Tage. Wie lange brauchen 3 Maler?** Mehr Maler brauchen **weniger** Zeit. Wenn die eine Größe steigt und die andere dabei sinkt, sind sie **antiproportional** („je mehr, desto weniger“). Der Dreisatz funktioniert trotzdem, aber auf der rechten Seite rechnest du **umgekehrt**.",
      ),
      frames: paintersFrames,
    },
    {
      type: "widget",
      title: tx("Same or opposite?", "Gleich oder umgekehrt?"),
      blob: tx("Flip between the two kinds and watch the arrows on the right!", "Schalte zwischen den beiden Arten hin und her und achte auf die Pfeile rechts!"),
      body: tx(
        "Switch between **more → more** and **more → less**, and change the amount you want. On the right side, is it the same operation or the opposite?",
        "Wechsle zwischen **mehr → mehr** und **mehr → weniger** und ändere die gesuchte Menge. Rechnest du rechts gleich oder umgekehrt?",
      ),
      widget: RatioTable,
    },
    {
      type: "check",
      blob: tx("More pumps, so less time. Think before you calculate!", "Mehr Pumpen, also weniger Zeit. Erst denken, dann rechnen!"),
      exercise: {
        instruction: SOLVE,
        text: tx("3 pumps empty a swimming pool in 8 hours. How many hours do 4 pumps need?", "3 Pumpen leeren ein Schwimmbecken in 8 Stunden. Wie viele Stunden brauchen 4 Pumpen?"),
        answer: { kind: "number", value: 6, unit: "h" },
        hint: tx(
          "1 pump alone would need 3 times as long: $3 \\cdot 8 = 24$ hours. Now share that between 4 pumps.",
          "1 Pumpe allein bräuchte 3-mal so lange: $3 \\cdot 8 = 24$ Stunden. Jetzt teile das auf 4 Pumpen auf.",
        ),
        solution: ruleOfThree({
          a: 3,
          va: 8,
          b: 4,
          one: tx("pump", "Pumpe"),
          many: tx("pumps", "Pumpen"),
          unit: "h",
          inverse: true,
          given: tx("**Given:** 3 pumps need 8 h. **Wanted:** the time for 4 pumps.", "**Gegeben:** 3 Pumpen brauchen 8 h. **Gesucht:** die Zeit für 4 Pumpen."),
          why: tx(
            "More pumps are faster: inverse. 1 pump needs 3 times as long: divide left, but **multiply** right.",
            "Mehr Pumpen sind schneller: antiproportional. 1 Pumpe braucht 3-mal so lange: links teilen, aber rechts **multiplizieren**.",
          ),
          oneNote: tx("1 pump alone would need 24 hours.", "1 Pumpe allein bräuchte 24 Stunden."),
          answer: tx("**Answer:** 4 pumps need 6 hours. Check: $3 \\cdot 8 = 4 \\cdot 6 = 24$.", "**Antwort:** 4 Pumpen brauchen 6 Stunden. Probe: $3 \\cdot 8 = 4 \\cdot 6 = 24$."),
        }),
      },
    },
    {
      type: "explain",
      title: tx("Speed and units", "Geschwindigkeit und Einheiten"),
      blob: tx("Speed problems are everywhere: trains, bikes, school trips.", "Aufgaben zur Geschwindigkeit gibt's überall: Züge, Fahrräder, Klassenfahrten."),
      body: tx(
        "Speed tells you how far you get in **one** hour: $v = \\frac{s}{t}$ (distance : time). Careful with units: for km/h the time has to be in **hours**.",
        "Die Geschwindigkeit sagt dir, wie weit du in **einer** Stunde kommst: $v = \\frac{s}{t}$ (Strecke : Zeit). Achte auf die Einheiten: Für km/h muss die Zeit in **Stunden** angegeben sein.",
      ),
      frames: speedFrames,
    },
    {
      type: "check",
      blob: tx("Last one! Two steps this time.", "Die letzte Aufgabe! Diesmal mit zwei Schritten."),
      exercise: {
        instruction: SOLVE,
        text: tx(
          "A rectangular garden is 12 m long and 7 m wide. It gets a fence all the way around. One metre of fence costs 8 €. How much does the fence cost?",
          "Ein rechteckiger Garten ist 12 m lang und 7 m breit. Er bekommt rundherum einen Zaun. Ein Meter Zaun kostet 8 €. Wie viel kostet der Zaun?",
        ),
        answer: { kind: "number", value: 304, unit: "€" },
        hint: tx(
          "Step 1: the perimeter, $u = 2 \\cdot 12 + 2 \\cdot 7$. Step 2: multiply by the price per metre.",
          "Schritt 1: der Umfang, $u = 2 \\cdot 12 + 2 \\cdot 7$. Schritt 2: Multipliziere mit dem Preis pro Meter.",
        ),
        solution: [
          {
            math: `u#U =#eq 2#k1 \\cdot#o1 12#a +#p 2#k2 \\cdot#o2 7#b`,
            note: tx(
              '**Given:** 12 m by 7 m, 8 € per metre. **Wanted:** the cost. Step 1: "all the way around" means the perimeter.',
              "**Gegeben:** 12 m lang, 7 m breit, 8 € pro Meter. **Gesucht:** die Kosten. Schritt 1: „rundherum“ heißt: Du brauchst den Umfang.",
            ),
          },
          { math: `u#U =#eq 38#a "m"#um`, note: tx("$24 + 14 = 38$: the fence is 38 m long.", "$24 + 14 = 38$: Der Zaun ist 38 m lang.") },
          { math: said(COST, `=#eq 38#a \\cdot#op 8#c "€"#ue`), note: tx("Step 2: every metre costs 8 €, so multiply.", "Schritt 2: Jeder Meter kostet 8 €, also multiplizieren.") },
          {
            math: said(COST, `=#eq 304#a "€"#ue`),
            highlight: ["a", "ue"],
            note: tx("$38 \\cdot 8 = 304$. **Answer:** The fence costs 304 €.", "$38 \\cdot 8 = 304$. **Antwort:** Der Zaun kostet 304 €."),
          },
        ],
      },
    },
  ],
  generate,
};

export default wordProblems;
