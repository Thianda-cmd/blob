"use client";

import { tx, txMap, type Text } from "@/i18n/text";
import { topicMeta } from "@/learn/catalog";
import { checkWord } from "@/learn/chemistry/check";
import { element } from "@/learn/chemistry/elements";
import { parseFormula, sameCounts } from "@/learn/chemistry/formula";
import {
  atomIon,
  BINARY,
  chargeSuffix,
  CONFUSED_ANION,
  ION_ELEMENTS,
  ionCe,
  ionFormula,
  nameOf,
  NOBLE,
  nobleFor,
  part,
  POLY_HARD,
  POLY_SIMPLE,
  ROMAN,
  ROMAN_NUMERALS,
  salt,
  saltName,
  saltNames,
  type Ion,
  type Salt,
} from "@/learn/chemistry/ionic-bonds-ions";
import { IonicBondsBuilder } from "@/learn/chemistry/visuals/IonicBondsBuilder";
import { IonicBondsLattice } from "@/learn/chemistry/visuals/IonicBondsLattice";
import { IonicBondsAtom, IonicBondsTransfer } from "@/learn/chemistry/visuals/IonicBondsTransfer";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Mistake, RichText, Topic } from "@/learn/types";

// ---------------------------------------------------------------------------
// Small helpers

const EN = (t: Text) => (typeof t === "string" ? t : t.en);
const DE = (t: Text) => (typeof t === "string" ? t : t.de);
const ce = (f: string) => `\\ce{${f}}`;
const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const signed = (n: number) => (n > 0 ? `+${n}` : `-${Math.abs(n)}`);
/** "1 electron" / "2 electrons". */
const electronsEn = (n: number) => `${n} electron${n === 1 ? "" : "s"}`;
const electronsDe = (n: number) => `${n} Elektron${n === 1 ? "" : "en"}`;

const elName = (sym: string) => element(sym)!.name;

/** Cation name without the Roman numeral: "iron" / "Eisen". */
const baseName = (ion: Ion): Text => tx(EN(ion.name).replace(/\(.*\)/, ""), DE(ion.name).replace(/\(.*\)/, ""));

const sameFormula = (a: string, b: string) => {
  const x = parseFormula(a);
  const y = parseFormula(b);
  return x.ok && y.ok && sameCounts(x.species.counts, y.species.counts) && x.species.charge === y.species.charge;
};

/** Collects typical wrong answers, skipping ones that equal the right answer or each other. */
function collector(right: AnswerSpec) {
  const out: Mistake[] = [];
  const same = (a: AnswerSpec, b: AnswerSpec): boolean => {
    if (a.kind === "formula" && b.kind === "formula") return sameFormula(a.value, b.value);
    if (a.kind === "number" && b.kind === "number") return Math.abs(a.value - b.value) < 1e-9;
    if (a.kind === "choice" && b.kind === "choice") return a.correct === b.correct;
    if (a.kind === "word" && b.kind === "word") return b.accept.some((w) => checkWord(a.accept, EN(w)).correct || checkWord(a.accept, DE(w)).correct);
    return false;
  };
  const add = (when: AnswerSpec, title: Text, say: Text, close?: boolean) => {
    if (when.kind === "formula" && !parseFormula(when.value).ok) return;
    if (when.kind === "number" && (!Number.isFinite(when.value) || when.value <= 0)) return;
    if (same(right, when) || out.some((m) => same(m.when, when))) return;
    out.push(close ? { when, title, say, close } : { when, title, say });
  };
  return { out, add };
}

// ---------------------------------------------------------------------------
// Ions from atoms

const INSTR_ION = tx("Write the ion", "Gib das Ion an");

function ionExercise(sym: string): Exercise {
  const ion = atomIon(sym);
  const name = ion.name;
  const g = ion.group;
  const R = ROMAN_NUMERALS[g];
  const n = Math.abs(ion.charge);
  const metal = ion.charge > 0;
  const value = ionFormula({ f: sym, charge: ion.charge });
  const noble = nobleFor(ion.z - ion.charge)!;
  const shellText = ion.shells.map((s, i) => (i === ion.shells.length - 1 ? `${s}#o` : `${s}`)).join(", ");
  const equation = metal ? ce(`${sym} -> ${value} + ${n > 1 ? n : ""}e-`) : ce(`${sym} + ${n > 1 ? n : ""}e- -> ${value}`);

  const solution: Frame[] = [
    {
      math: `${ce(sym)} \\quad (${shellText})`,
      highlight: ["o"],
      note: tx(
        `${EN(name)} is in main group ${R}: ${electronsEn(g)} on the outer shell.`,
        `${DE(name)} steht in Hauptgruppe ${R}: ${g} Elektron${g === 1 ? "" : "en"} auf der Außenschale.`,
      ),
    },
    {
      math: equation,
      note: metal
        ? tx(
            `Giving away ${electronsEn(n)} is much easier than taking ${8 - g}. Then the full shell below is on the outside, like ${EN(noble.name).toLowerCase()}.`,
            `${electronsDe(n)} abzugeben ist viel leichter, als ${8 - g} aufzunehmen. Dann liegt die volle Schale darunter außen, wie bei ${DE(noble.name)}.`,
          )
        : tx(
            `Taking ${electronsEn(n)} is much easier than giving away ${g}. Then the outer shell is full, like ${EN(noble.name).toLowerCase()}.`,
            `${electronsDe(n)} aufzunehmen ist viel leichter, als ${g} abzugeben. Dann ist die Außenschale voll, wie bei ${DE(noble.name)}.`,
          ),
    },
    {
      math: ce(value),
      note: metal
        ? tx(`${electronsEn(n)} fewer than protons: the charge is $${signed(n)}$. The ion is $${ce(value)}$.`, `${electronsDe(n)} weniger als Protonen: Die Ladung ist $${signed(n)}$. Das Ion ist $${ce(value)}$.`)
        : tx(`${electronsEn(n)} more than protons: the charge is $${signed(-n)}$. The ion is $${ce(value)}$.`, `${electronsDe(n)} mehr als Protonen: Die Ladung ist $${signed(-n)}$. Das Ion ist $${ce(value)}$.`),
    },
  ];

  const answer: AnswerSpec = { kind: "formula", value };
  const { out, add } = collector(answer);
  add(
    { kind: "formula", value: `${sym}${chargeSuffix(-ion.charge)}` },
    tx("Sign flipped", "Vorzeichen vertauscht"),
    metal
      ? tx(
          "Ah, I see: you made it negative. But metal atoms **give** electrons away. Fewer electrons than protons means a **positive** charge.",
          "Ah, ich seh's: Du hast es negativ gemacht. Aber Metallatome **geben** Elektronen ab. Weniger Elektronen als Protonen heißt **positive** Ladung.",
        )
      : tx(
          "Careful with the sign! Nonmetal atoms **take** electrons. More electrons than protons means a **negative** charge.",
          "Achtung beim Vorzeichen! Nichtmetallatome **nehmen** Elektronen auf. Mehr Elektronen als Protonen heißt **negative** Ladung.",
        ),
  );
  if (!metal) {
    add(
      { kind: "formula", value: `${sym}${chargeSuffix(g)}` },
      tx("Group number as charge", "Hauptgruppe als Ladung"),
      tx(
        `I think you took the main group number as the charge. For that, ${EN(name).toLowerCase()} would have to give away all ${g} outer electrons. Taking a few is much easier!`,
        `Ich glaub, du hast die Hauptgruppennummer als Ladung genommen. Dafür müsste ${DE(name)} alle ${g} Außenelektronen abgeben. Ein paar aufzunehmen ist viel leichter!`,
      ),
    );
    add(
      { kind: "formula", value: `${sym}${chargeSuffix(-g)}` },
      tx("Outer electrons as charge", "Außenelektronen als Ladung"),
      tx(
        `Hmm, ${g} is the number of outer electrons the atom already has. The charge only counts the electrons it **takes in**. How many are missing to 8?`,
        `Hm, ${g} ist die Zahl der Außenelektronen, die das Atom schon hat. Die Ladung zählt nur die Elektronen, die es **aufnimmt**. Wie viele fehlen bis 8?`,
      ),
    );
  } else {
    add(
      { kind: "formula", value: `${sym}${chargeSuffix(-(8 - g))}` },
      tx("Filled up instead of given away", "Aufgefüllt statt abgegeben"),
      tx(
        `You filled the shell up to 8. On paper that works, but taking ${8 - g} electrons is far harder than giving away ${g}. Metals give!`,
        `Du hast die Schale bis 8 aufgefüllt. Auf dem Papier geht das, aber ${8 - g} Elektronen aufzunehmen ist viel schwerer, als ${g} abzugeben. Metalle geben ab!`,
      ),
    );
  }
  if (n > 1) {
    add(
      { kind: "formula", value: `${sym}${n}${metal ? "+" : "-"}` },
      tx("Charge written as an index", "Ladung als Index geschrieben"),
      tx(
        "Right idea! But put a ^ before the charge number. Without it, the number becomes an index and means several atoms.",
        "Richtige Idee! Aber setz ein ^ vor die Ladungszahl. Ohne wird die Zahl zum Index und bedeutet mehrere Atome.",
      ),
      true,
    );
  }

  return {
    instruction: INSTR_ION,
    text: tx(`Which ion does ${article(EN(name))} **${EN(name).toLowerCase()}** atom form?`, `Welches Ion bildet ein **${DE(name)}atom**?`),
    answer,
    hint: tx(
      `Main group ${R} means ${electronsEn(g)} on the outer shell. Give away or take: which needs fewer electrons?`,
      `Hauptgruppe ${R} heißt ${g} Außenelektron${g === 1 ? "" : "en"}. Abgeben oder aufnehmen: Was braucht weniger Elektronen?`,
    ),
    solution,
    mistakes: out,
    visual: { component: IonicBondsAtom, props: { z: ion.z } },
  };
}

function electronsInIon(sym: string): Exercise {
  const ion = atomIon(sym);
  const z = ion.z;
  const q = ion.charge;
  const n = Math.abs(q);
  const value = z - q;
  const f = ionFormula({ f: sym, charge: q });
  const noble = nobleFor(value)!;
  const metal = q > 0;
  const answer: AnswerSpec = { kind: "number", value };
  const { out, add } = collector(answer);
  add(
    { kind: "number", value: z + q },
    tx("Added instead of subtracted", "Addiert statt subtrahiert"),
    metal
      ? tx("You added the electrons. But **+** means electrons were **given away**, so the ion has fewer than the atom.", "Du hast die Elektronen dazugezählt. Aber **+** heißt: Elektronen wurden **abgegeben**, das Ion hat also weniger als das Atom.")
      : tx("You took electrons away. But **−** means extra electrons were **taken in**, so the ion has more than the atom.", "Du hast Elektronen abgezogen. Aber **−** heißt: Es wurden zusätzliche Elektronen **aufgenommen**, das Ion hat also mehr als das Atom."),
  );
  add(
    { kind: "number", value: z },
    tx("That's the atom", "Das ist das Atom"),
    tx("That's the number for the neutral atom. Now take the charge into account: the ion has gained or lost electrons.", "Das ist die Zahl für das neutrale Atom. Jetzt kommt noch die Ladung dazu: Das Ion hat Elektronen gewonnen oder verloren."),
  );
  const massNumber = Math.round(element(sym)!.mass);
  add(
    { kind: "number", value: massNumber - q },
    tx("Mass number used", "Massenzahl erwischt"),
    tx(
      `Looks like you started from the mass number (${massNumber}). Electrons are counted from the **atomic number**, which equals the number of protons.`,
      `Sieht so aus, als wärst du von der Massenzahl (${massNumber}) ausgegangen. Elektronen zählst du über die **Ordnungszahl**, die gleich der Protonenzahl ist.`,
    ),
  );
  return {
    instruction: tx("Count the electrons", "Zähl die Elektronen"),
    text: tx(`How many electrons does the ion $${ce(f)}$ have?`, `Wie viele Elektronen hat das Ion $${ce(f)}$?`),
    answer,
    hint: metal
      ? tx("Start with the atomic number. A positive charge means electrons were given away.", "Fang bei der Ordnungszahl an. Eine positive Ladung heißt: Elektronen wurden abgegeben.")
      : tx("Start with the atomic number. A negative charge means electrons were taken in.", "Fang bei der Ordnungszahl an. Eine negative Ladung heißt: Elektronen wurden aufgenommen."),
    solution: [
      {
        math: `${ce(sym)} : \\; ${z}#z \\ce{e-}`,
        note: tx(`${cap(article(EN(ion.name)))} ${EN(ion.name).toLowerCase()} atom has atomic number ${z}: ${z} protons and ${z} electrons.`, `Ein ${DE(ion.name)}atom hat die Ordnungszahl ${z}: ${z} Protonen und ${z} Elektronen.`),
      },
      {
        math: `${ce(f)} : \\; ${z}#z ${metal ? "-" : "+"}#op ${n}#d = ${value}#r`,
        note: metal
          ? tx(`The ion has given away ${electronsEn(n)}: $${z} - ${n} = ${value}$.`, `Das Ion hat ${electronsDe(n)} abgegeben: $${z} - ${n} = ${value}$.`)
          : tx(`The ion has taken in ${electronsEn(n)}: $${z} + ${n} = ${value}$.`, `Das Ion hat ${electronsDe(n)} aufgenommen: $${z} + ${n} = ${value}$.`),
      },
      {
        math: `${value}#r \\ce{e-} \\quad \\to \\quad ${ce(noble.symbol)}`,
        note: tx(`${value} electrons, the same as the noble gas ${EN(noble.name).toLowerCase()}.`, `${value} Elektronen, so viele wie das Edelgas ${DE(noble.name)}.`),
      },
    ],
    mistakes: out,
  };
}

function nobleChoice(sym: string, rng: Rng): Exercise {
  const ion = atomIon(sym);
  const f = ionFormula({ f: sym, charge: ion.charge });
  const electrons = ion.z - ion.charge;
  const k = NOBLE.findIndex((x) => x.z === electrons);
  const metal = ion.charge > 0;
  // A window of 4 noble gases around the right one, including the typical wrong neighbour.
  const start = Math.max(0, Math.min(NOBLE.length - 4, metal ? k - 1 : k - 2));
  const pool = NOBLE.slice(start, start + 4);
  const order = rng.chance(0.5) ? pool : rng.shuffle(pool);
  const options: RichText[] = order.map((x) => tx(`${EN(x.name).toLowerCase()} ($${ce(x.symbol)}$)`, `${DE(x.name)} ($${ce(x.symbol)}$)`));
  const correct = order.findIndex((x) => x.z === electrons);
  const answer: AnswerSpec = { kind: "choice", options, correct };
  const { out, add } = collector(answer);
  const ownPeriod = metal ? NOBLE[k + 1] : undefined;
  const before = !metal ? NOBLE[k - 1] : undefined;
  const iOwn = ownPeriod ? order.indexOf(ownPeriod) : -1;
  const iBefore = before ? order.indexOf(before) : -1;
  if (iOwn >= 0) {
    add(
      { kind: "choice", options, correct: iOwn },
      tx("One shell too many", "Eine Schale zu viel"),
      tx(
        `That's the noble gas at the end of ${EN(ion.name).toLowerCase()}'s own period. But $${ce(f)}$ gave its outer electrons away: it's one shell **smaller** now.`,
        `Das ist das Edelgas am Ende der eigenen Periode von ${DE(ion.name)}. Aber $${ce(f)}$ hat seine Außenelektronen abgegeben: Es hat jetzt eine Schale **weniger**.`,
      ),
    );
  }
  if (iBefore >= 0) {
    add(
      { kind: "choice", options, correct: iBefore },
      tx("One shell too few", "Eine Schale zu wenig"),
      tx(
        `That's the noble gas one period up. But $${ce(f)}$ **took** electrons: it fills its own outer shell, up to the noble gas at the end of its **own** period.`,
        `Das ist das Edelgas eine Periode darüber. Aber $${ce(f)}$ hat Elektronen **aufgenommen**: Es füllt seine eigene Außenschale auf, bis zum Edelgas am Ende der **eigenen** Periode.`,
      ),
    );
  }
  const noble = NOBLE[k];
  return {
    instruction: tx("Find the noble gas", "Finde das Edelgas"),
    text: tx(`The ion $${ce(f)}$ has the same electron configuration as which noble gas?`, `Das Ion $${ce(f)}$ hat dieselbe Elektronenkonfiguration wie welches Edelgas?`),
    answer,
    hint: tx("Count the electrons of the ion. Which noble gas has exactly that many?", "Zähl die Elektronen des Ions. Welches Edelgas hat genau so viele?"),
    solution: [
      {
        math: `${ce(f)} : \\; ${ion.z} ${metal ? "-" : "+"} ${Math.abs(ion.charge)} = ${electrons}#r`,
        note: tx(`$${ce(f)}$ has ${electrons} electrons.`, `$${ce(f)}$ hat ${electrons} Elektronen.`),
      },
      {
        math: `${electrons}#r \\ce{e-} \\quad \\to \\quad ${ce(noble.symbol)}`,
        note: tx(
          `${EN(noble.name)} has atomic number ${noble.z}: the same ${electrons} electrons on the same shells.`,
          `${DE(noble.name)} hat die Ordnungszahl ${noble.z}: dieselben ${electrons} Elektronen auf denselben Schalen.`,
        ),
      },
    ],
    mistakes: out,
  };
}

// ---------------------------------------------------------------------------
// Salt formulas

const INSTR_FORMULA = tx("Write the formula", "Stell die Formel auf");

/** Why each ion has its charge, for the first solution frame. */
function chargeReason(ion: Ion): Text {
  const f = `$${ionCe(ion)}$`;
  if (ion.poly) return tx(`${cap(EN(ion.name))} is ${f} (learn it by heart).`, `${DE(ion.name)} ist ${f} (auswendig lernen).`);
  if (ion.roman) return tx(`The Roman numeral is the charge: ${f}.`, `Die römische Zahl ist die Ladung: ${f}.`);
  const el = element(ion.f)!;
  if (el.group === 12 || el.group === 11) return tx(`${EN(el.name)} always forms ${f}.`, `${DE(el.name)} bildet immer ${f}.`);
  const g = el.group! <= 2 ? el.group! : el.group! - 10;
  return tx(`${EN(el.name)}: main group ${ROMAN_NUMERALS[g]}, so ${f}.`, `${DE(el.name)}: Hauptgruppe ${ROMAN_NUMERALS[g]}, also ${f}.`);
}

/** One ion n times in the final formula, keyed so the count glides into the index. */
function keyedPart(ion: Ion, n: number, key: string) {
  if (n === 1) return ce(ion.f);
  return ion.poly ? `(${ce(ion.f)})_{${n}#${key}}` : `${ce(ion.f)}_{${n}#${key}}`;
}

function saltFrames(s: Salt, fromName: boolean): Frame[] {
  const { cat, an, nc, na, lcm: l } = s;
  const c = cat.charge;
  const a = -an.charge;
  const ions = `${ionCe(cat)} \\quad ${ionCe(an)}`;
  const frames: Frame[] = [
    {
      math: ions,
      note: fromName
        ? txMap((t, loc) => `${(loc === "en" ? EN : DE)(chargeReason(cat))} ${(loc === "en" ? EN : DE)(chargeReason(an))}`)
        : tx(`The charges: $${signed(c)}$ and $${signed(-a)}$.`, `Die Ladungen: $${signed(c)}$ und $${signed(-a)}$.`),
    },
  ];
  if (c === a) {
    frames.push({ math: `1#nc ${ionCe(cat)} \\quad 1#na ${ionCe(an)}`, note: tx(`$${signed(c)}$ and $${signed(-a)}$ cancel directly: one of each.`, `$${signed(c)}$ und $${signed(-a)}$ gleichen sich direkt aus: von jedem eins.`) });
  } else {
    frames.push({
      math: tx(`${ions} \\quad "LCM" = ${l}`, `${ions} \\quad "kgV" = ${l}`),
      note: tx(
        `The charges have to cancel. The lowest common multiple of ${c} and ${a} is ${l}.`,
        `Die Ladungen müssen sich ausgleichen. Das kleinste gemeinsame Vielfache von ${c} und ${a} ist ${l}.`,
      ),
    });
    frames.push({
      math: `${nc}#nc ${ionCe(cat)} \\quad ${na}#na ${ionCe(an)}`,
      note: tx(
        `$${nc} \\cdot (+${c}) = +${l}$ and $${na} \\cdot (-${a}) = -${l}$: neutral.`,
        `$${nc} \\cdot (+${c}) = +${l}$ und $${na} \\cdot (-${a}) = -${l}$: neutral.`,
      ),
    });
  }
  const brackets = (cat.poly && nc > 1) || (an.poly && na > 1);
  frames.push({
    math: `${keyedPart(cat, nc, "nc")} ${keyedPart(an, na, "na")}`,
    note: brackets
      ? tx(
          `The ion numbers become the indices: $${ce(s.formula)}$. The polyatomic ion goes in **brackets**, because its index counts the whole group.`,
          `Die Ionenzahlen werden zu Indizes: $${ce(s.formula)}$. Das Molekül-Ion kommt in **Klammern**, weil sein Index für die ganze Gruppe gilt.`,
        )
      : tx(`The ion numbers become the indices (a 1 isn't written): $${ce(s.formula)}$.`, `Die Ionenzahlen werden zu Indizes (eine 1 schreibt man nicht): $${ce(s.formula)}$.`),
  });
  return frames;
}

const DIATOMIC = new Set(["F", "Cl", "Br", "I", "O", "N"]);

function saltMistakes(s: Salt, answer: AnswerSpec): Mistake[] {
  const { cat, an, nc, na } = s;
  const c = cat.charge;
  const a = -an.charge;
  const { out, add } = collector(answer);
  if (DIATOMIC.has(an.f) && na === 1 && !an.poly) {
    add(
      { kind: "formula", value: part(cat, nc) + `${an.f}2` },
      tx(`The gas is ${an.f}₂, the ion isn't`, `${an.f}₂ ist das Gas, nicht das Ion`),
      tx(
        `Ah, ${EN(an.elementName!)} as a gas is $${ce(`${an.f}2`)}$. But in the salt there are single $${ionCe(an)}$ ions. Count them by their charge.`,
        `Ah, ${DE(an.elementName!)} als Gas ist $${ce(`${an.f}2`)}$. Aber im Salz gibt es einzelne $${ionCe(an)}$-Ionen. Zähl sie über ihre Ladung ab.`,
      ),
    );
  }
  if (cat.roman && c > 1) {
    add(
      { kind: "formula", value: part(cat, c) + part(an, 1) },
      tx("Roman numeral = charge", "Römische Zahl = Ladung"),
      tx(
        `The Roman numeral isn't the number of ${EN(baseName(cat))} atoms. It's the **charge** of the ion: (${ROMAN_NUMERALS[c]}) means $${ionCe(cat)}$.`,
        `Die römische Zahl ist nicht die Anzahl der ${DE(baseName(cat))}-Atome. Sie ist die **Ladung** des Ions: (${ROMAN_NUMERALS[c]}) heißt $${ionCe(cat)}$.`,
      ),
    );
  }
  add(
    { kind: "formula", value: part(cat, 1) + part(an, 1) },
    tx("Charges don't cancel", "Ladungen nicht ausgeglichen"),
    tx(
      `One of each isn't neutral yet: $${ionCe(cat)}$ brings $+${c}$, $${ionCe(an)}$ brings $-${a}$. Use the lowest common multiple of the charges.`,
      `Eins zu eins ist noch nicht neutral: $${ionCe(cat)}$ bringt $+${c}$, $${ionCe(an)}$ bringt $-${a}$. Nimm das kleinste gemeinsame Vielfache der Ladungen.`,
    ),
  );
  add(
    { kind: "formula", value: part(cat, na) + part(an, nc) },
    tx("Indices swapped", "Indizes vertauscht"),
    tx(
      `Close, but the numbers sit at the wrong ions: ${na} × $(+${c})$ and ${nc} × $(-${a})$ don't cancel. Each charge number goes **crosswise** to the other ion.`,
      `Knapp daneben: Die Zahlen stehen bei den falschen Ionen. ${na} · $(+${c})$ und ${nc} · $(-${a})$ gleichen sich nicht aus. Jede Ladungszahl wandert **über Kreuz** zum anderen Ion.`,
    ),
  );
  for (const ion of [an, cat]) {
    const digit = ion.poly ? Number(ion.f.match(/[0-9]+$/)?.[0] ?? 0) : 0;
    if (!digit || digit === Math.abs(ion.charge)) continue;
    const fake = { ...ion, charge: Math.sign(ion.charge) * digit };
    const other = ion === an ? cat : an;
    const l = lcmOf(Math.abs(fake.charge), Math.abs(other.charge));
    const wrong = ion === an ? part(cat, l / c) + part(an, l / digit) : part(cat, l / digit) + part(an, l / a);
    add(
      { kind: "formula", value: wrong },
      tx("Charge of the polyatomic ion", "Ladung des Molekül-Ions"),
      tx(
        `I think you took the ${digit} in $${ce(ion.f)}$ as the charge. That ${digit} only counts atoms in the group: ${EN(ion.name)} is $${ionCe(ion)}$.`,
        `Ich glaub, du hast die ${digit} in $${ce(ion.f)}$ als Ladung genommen. Die ${digit} zählt nur die Atome in der Gruppe: ${DE(ion.name)} ist $${ionCe(ion)}$.`,
      ),
    );
  }
  return out;
}

const lcmOf = (x: number, y: number): number => {
  const g = (p: number, q: number): number => (q === 0 ? p : g(q, p % q));
  return (x * y) / g(x, y);
};

function formulaFromIons(s: Salt): Exercise {
  const answer: AnswerSpec = { kind: "formula", value: s.formula };
  return {
    instruction: INSTR_FORMULA,
    text: tx(`Write the formula of the salt made of $${ionCe(s.cat)}$ and $${ionCe(s.an)}$ ions.`, `Stell die Verhältnisformel des Salzes aus $${ionCe(s.cat)}$- und $${ionCe(s.an)}$-Ionen auf.`),
    answer,
    hint: tx("Plus and minus have to cancel. How many of each ion do you need?", "Plus und Minus müssen sich ausgleichen. Wie viele von jedem Ion brauchst du?"),
    solution: saltFrames(s, false),
    mistakes: saltMistakes(s, answer),
  };
}

function formulaFromName(s: Salt): Exercise {
  const answer: AnswerSpec = { kind: "formula", value: s.formula };
  const name = saltName(s);
  const hint = s.cat.roman
    ? tx("The Roman numeral is the charge of the metal ion. Then make the charges cancel.", "Die römische Zahl ist die Ladung des Metall-Ions. Dann gleichst du die Ladungen aus.")
    : s.cat.poly || s.an.poly
      ? tx(
          "Polyatomic ions: $\\ce{OH-}$, $\\ce{NO3-}$, $\\ce{SO4^2-}$, $\\ce{CO3^2-}$, $\\ce{PO4^3-}$, $\\ce{NH4+}$. Need more than one? Brackets!",
          "Molekül-Ionen: $\\ce{OH-}$, $\\ce{NO3-}$, $\\ce{SO4^2-}$, $\\ce{CO3^2-}$, $\\ce{PO4^3-}$, $\\ce{NH4+}$. Brauchst du mehr als eins? Klammern!",
        )
      : tx("First find both ion charges from the main groups. Then make them cancel.", "Bestimm zuerst beide Ionenladungen über die Hauptgruppen. Dann gleichst du sie aus.");
  return {
    instruction: INSTR_FORMULA,
    text: tx(`Write the formula of **${EN(name)}**.`, `Stell die Verhältnisformel von **${DE(name)}** auf.`),
    answer,
    hint,
    solution: saltFrames(s, true),
    mistakes: saltMistakes(s, answer),
  };
}

// ---------------------------------------------------------------------------
// Names

const INSTR_NAME = tx("Name the compound", "Benenne die Verbindung");

const PREFIX_EN = ["", "", "di", "tri", "tetra"];
const PREFIX_DE = ["", "", "di", "tri", "tetra"];

const CONFUSED_WHY: Record<string, Text> = {
  S: tx("Sulfate is $\\ce{SO4^2-}$ and contains oxygen. A plain sulfur ion gets the ending -ide.", "Sulfat ist $\\ce{SO4^2-}$ und enthält Sauerstoff. Ein reines Schwefel-Ion bekommt die Endung -id."),
  SO4: tx("Sulfide is the plain $\\ce{S^2-}$ ion. $\\ce{SO4^2-}$ with its four O atoms has a different name.", "Sulfid ist das einfache $\\ce{S^2-}$-Ion. $\\ce{SO4^2-}$ mit seinen vier O-Atomen heißt anders."),
  N: tx("Nitrate is $\\ce{NO3-}$ and contains oxygen. A plain nitrogen ion gets the ending -ide.", "Nitrat ist $\\ce{NO3-}$ und enthält Sauerstoff. Ein reines Stickstoff-Ion bekommt die Endung -id."),
  NO3: tx("Nitride is the plain $\\ce{N^3-}$ ion. $\\ce{NO3-}$ contains oxygen and has its own name.", "Nitrid ist das einfache $\\ce{N^3-}$-Ion. $\\ce{NO3-}$ enthält Sauerstoff und hat einen eigenen Namen."),
  Cl: tx("Chlorate would be $\\ce{ClO3-}$, with oxygen. Here there's only chlorine.", "Chlorat wäre $\\ce{ClO3-}$, mit Sauerstoff. Hier gibt es nur Chlor."),
  CO3: tx("A carbide contains no oxygen. $\\ce{CO3^2-}$ has three O atoms.", "Ein Carbid enthält keinen Sauerstoff. $\\ce{CO3^2-}$ hat drei O-Atome."),
};

function nameFromFormula(s: Salt): Exercise {
  const accept = saltNames(s);
  const answer: AnswerSpec = { kind: "word", accept };
  const { out, add } = collector(answer);
  const { cat, an, nc, na } = s;
  if (an.elementName) {
    add(
      { kind: "word", accept: [nameOf(cat, an, cat.name, an.elementName)] },
      tx("Element name instead of ion name", "Elementname statt Ionenname"),
      tx(
        `Nearly! The anion gets its own name: not "${EN(an.elementName)}", but a name ending in **-ide**.`,
        `Fast! Das Anion bekommt einen eigenen Namen: nicht „${DE(an.elementName)}“, sondern einen Namen mit der Endung **-id**.`,
      ),
    );
  }
  const confused = CONFUSED_ANION[an.id];
  if (confused) {
    add(
      { kind: "word", accept: [nameOf(cat, an, cat.name, confused)] },
      tx("A different ion", "Ein anderes Ion"),
      txMap((t, loc) => `${t(`Careful: ${EN(confused).toLowerCase()} is a different ion!`, `Vorsicht: ${DE(confused)} ist ein anderes Ion!`)} ${(loc === "en" ? EN : DE)(CONFUSED_WHY[an.id])}`),
    );
  }
  if (!cat.poly && !an.poly && (nc > 1 || na > 1)) {
    const en = `${nc > 1 ? PREFIX_EN[nc] : ""}${EN(cat.name)} ${na > 1 ? PREFIX_EN[na] : ""}${EN(an.name)}`;
    const de = nc > 1 ? `${cap(PREFIX_DE[nc])}${lower(DE(cat.name))}${na > 1 ? PREFIX_DE[na] : ""}${lower(DE(an.name))}` : `${DE(cat.name)}${na > 1 ? PREFIX_DE[na] : ""}${lower(DE(an.name))}`;
    add(
      { kind: "word", accept: [tx(en, de)] },
      tx("No number words", "Keine Zahlwörter"),
      tx(
        "Salt names don't need di- or tri-: the ion charges already fix the ratio. Just cation name + anion name.",
        "In Salznamen brauchst du kein di- oder tri-: Die Ionenladungen legen das Verhältnis schon fest. Einfach Kationenname + Anionenname.",
      ),
    );
  }
  const anionNote: Text = an.poly
    ? tx(`$${ionCe(an)}$ is the ${EN(an.name)} ion.`, `$${ionCe(an)}$ ist das ${DE(an.name)}-Ion.`)
    : tx(`$${ionCe(an)}$ comes from ${EN(an.elementName!)}: ${EN(an.name)}.`, `$${ionCe(an)}$ kommt von ${DE(an.elementName!)}: ${DE(an.name)}.`);
  const name = saltName(s);
  return {
    instruction: INSTR_NAME,
    math: ce(s.formula),
    answer,
    hint: tx("Cation first, then the anion. Nonmetal anions end in -ide.", "Erst das Kation, dann das Anion. Anionen von Nichtmetallen enden auf -id."),
    solution: [
      {
        math: `${ionCe(cat)} \\quad ${ionCe(an)}`,
        note: txMap((t, loc) => `${t(`The cation is ${EN(cat.name)}.`, `Das Kation ist ${DE(cat.name)}.`)} ${(loc === "en" ? EN : DE)(anionNote)}`),
      },
      {
        math: tx(`${ce(s.formula)} \\to "${EN(name)}"`, `${ce(s.formula)} \\to "${DE(name)}"`),
        note: tx(`Cation + anion, no number words: **${EN(name)}**.`, `Kation + Anion, ohne Zahlwörter: **${DE(name)}**.`),
      },
    ],
    mistakes: out,
  };
}

/** Name a salt of a metal with several charges: which Roman numeral? Without `rng` the options stay sorted. */
function romanChoice(s: Salt, rng?: Rng): Exercise {
  const { cat, an, nc, na } = s;
  const q = cat.charge;
  const a = -an.charge;
  const total = na * a;
  const reasons = new Map<number, { title: Text; say: Text }>();
  const metal = baseName(cat);
  if (nc !== q)
    reasons.set(nc, {
      title: tx("Index read as charge", "Index als Ladung gelesen"),
      say: tx(
        `I think you read the index ${nc} of ${EN(metal)} as the charge. The index only counts atoms. Work out the charge from the anions instead.`,
        `Ich glaub, du hast den Index ${nc} beim ${DE(metal)} als Ladung gelesen. Der Index zählt nur Atome. Rechne die Ladung lieber über die Anionen aus.`,
      ),
    });
  if (na !== q && !reasons.has(na))
    reasons.set(na, {
      title: tx("Crossed back", "Rückwärts gekreuzt"),
      say: tx(
        `You crossed the indices back. That only works if the formula wasn't reduced! Better: total anion charge divided by the number of ${EN(metal)} ions.`,
        `Du hast die Indizes zurückgekreuzt. Das klappt nur, wenn die Formel nicht gekürzt wurde! Sicherer: Gesamtladung der Anionen geteilt durch die Zahl der ${DE(metal)}-Ionen.`,
      ),
    });
  if (total !== q && !reasons.has(total) && total <= 8)
    reasons.set(total, {
      title: tx("Not shared out", "Nicht aufgeteilt"),
      say: tx(
        `Good start: the anions bring $-${total}$ in total. But that charge is shared by ${nc} ${EN(metal)} ions.`,
        `Guter Anfang: Die Anionen bringen insgesamt $-${total}$. Aber diese Ladung teilen sich ${nc} ${DE(metal)}-Ionen.`,
      ),
    });
  const numbers = [q, ...reasons.keys()];
  for (const filler of [1, 2, 3, 4]) if (numbers.length < 4 && !numbers.includes(filler)) numbers.push(filler);
  const order = [...numbers].sort((x, y) => x - y);
  const shown = rng?.chance(0.3) ? rng.shuffle(order) : order;
  const anName = an.name;
  const options: RichText[] = shown.map((n) => tx(`${EN(metal)}(${ROMAN_NUMERALS[n]}) ${EN(anName)}`, `${DE(metal)}(${ROMAN_NUMERALS[n]})-${lower(DE(anName))}`));
  const answer: AnswerSpec = { kind: "choice", options, correct: shown.indexOf(q) };
  const { out, add } = collector(answer);
  for (const [n, r] of reasons) add({ kind: "choice", options, correct: shown.indexOf(n) }, r.title, r.say);
  const name = saltName(s);
  return {
    instruction: INSTR_NAME,
    text: tx("Which name is right?", "Welcher Name ist richtig?"),
    math: ce(s.formula),
    answer,
    hint: tx(`Start with the anion: $${ionCe(an)}$. How much charge do all of them bring together?`, `Fang beim Anion an: $${ionCe(an)}$. Wie viel Ladung bringen alle zusammen?`),
    solution: [
      { math: ce(s.formula), note: tx(`The anion has a fixed charge: $${ionCe(an)}$.`, `Das Anion hat eine feste Ladung: $${ionCe(an)}$.`) },
      {
        math: `${na}#na \\cdot (-${a}) = -${total}#t`,
        note:
          na === 1
            ? tx(`One ${EN(an.name)} ion brings $-${total}$.`, `Ein ${DE(an.name)}-Ion bringt $-${total}$.`)
            : tx(`${na} ${EN(an.name)} ions bring $-${total}$ in total.`, `${na} ${DE(an.name)}-Ionen bringen zusammen $-${total}$.`),
      },
      {
        math: `+${total}#t : ${nc}#nc = +${q} \\quad \\Rightarrow \\quad ${ionCe(cat)}`,
        note:
          nc === 1
            ? tx(`One ${EN(metal)} ion has to balance that on its own: it's $${ionCe(cat)}$.`, `Ein ${DE(metal)}-Ion muss das allein ausgleichen: Es ist $${ionCe(cat)}$.`)
            : tx(`${nc} ${EN(metal)} ions share $+${total}$: each one is $${ionCe(cat)}$.`, `${nc} ${DE(metal)}-Ionen teilen sich $+${total}$: Jedes ist $${ionCe(cat)}$.`),
      },
      {
        math: tx(`${ce(s.formula)} \\to "${EN(name)}"`, `${ce(s.formula)} \\to "${DE(name)}"`),
        note: tx(`The charge goes into the name as a Roman numeral: **${EN(name)}**.`, `Die Ladung kommt als römische Zahl in den Namen: **${DE(name)}**.`),
      },
    ],
    mistakes: out,
  };
}

// ---------------------------------------------------------------------------
// Counting in formulas

function atomsInFormula(s: Salt, el: string): Exercise {
  const polyIon = s.cat.poly && s.nc > 1 ? s.cat : s.an;
  const n = polyIon === s.cat ? s.nc : s.na;
  const inner = parseFormula(polyIon.f);
  const k = inner.ok ? (inner.species.counts[el] ?? 0) : 0;
  const value = k * n;
  const answer: AnswerSpec = { kind: "number", value };
  const { out, add } = collector(answer);
  add(
    { kind: "number", value: k },
    tx("Bracket index forgotten", "Index der Klammer vergessen"),
    tx(`You counted one $${ce(polyIon.f)}$ group. But the ${n} after the bracket means **${n}** of them.`, `Du hast eine $${ce(polyIon.f)}$-Gruppe gezählt. Aber die ${n} hinter der Klammer heißt: **${n}** davon.`),
  );
  add(
    { kind: "number", value: k + n },
    tx("Added instead of multiplied", "Addiert statt multipliziert"),
    tx(`The index after the bracket **multiplies** everything inside. ${k} + ${n} isn't it.`, `Der Index hinter der Klammer **multipliziert** alles in der Klammer. ${k} + ${n} passt nicht.`),
  );
  const elN = elName(el);
  return {
    instruction: tx("Count the atoms", "Zähl die Atome"),
    text: tx(`How many ${EN(elN).toLowerCase()} atoms are in one formula unit of $${ce(s.formula)}$?`, `Wie viele ${DE(elN)}atome stecken in einer Formeleinheit $${ce(s.formula)}$?`),
    answer,
    hint: tx("The number after a bracket counts for everything inside it.", "Die Zahl hinter einer Klammer gilt für alles in der Klammer."),
    solution: [
      { math: ce(s.formula), note: tx(`The ${n} after the bracket stands for ${n} $${ce(polyIon.f)}$ groups.`, `Die ${n} hinter der Klammer steht für ${n} $${ce(polyIon.f)}$-Gruppen.`) },
      {
        math: `${n}#n \\cdot ${k}#k = ${value}#v`,
        note: tx(`Each group has ${k} ${el} atom${k === 1 ? "" : "s"}: $${n} \\cdot ${k} = ${value}$.`, `Jede Gruppe hat ${k} ${el}-Atom${k === 1 ? "" : "e"}: $${n} \\cdot ${k} = ${value}$.`),
      },
    ],
    mistakes: out,
  };
}

function ionsInFormula(s: Salt): Exercise {
  const value = s.nc + s.na;
  const answer: AnswerSpec = { kind: "number", value };
  const { out, add } = collector(answer);
  const parsed = parseFormula(s.formula);
  const atoms = parsed.ok ? Object.values(parsed.species.counts).reduce((x, y) => x + y, 0) : 0;
  add(
    { kind: "number", value: atoms },
    tx("Atoms counted", "Atome gezählt"),
    tx(`You counted atoms. But a polyatomic ion like $${ionCe(s.cat.poly ? s.cat : s.an)}$ counts as **one** ion.`, `Du hast Atome gezählt. Aber ein Molekül-Ion wie $${ionCe(s.cat.poly ? s.cat : s.an)}$ zählt als **ein** Ion.`),
  );
  const polyN = s.an.poly ? s.na : s.nc;
  if (polyN > 1)
    add(
      { kind: "number", value: value - polyN + 1 },
      tx("Bracket index forgotten", "Index der Klammer vergessen"),
      tx("The index after the bracket counts the polyatomic ions. Each group in brackets is one ion.", "Der Index hinter der Klammer zählt die Molekül-Ionen. Jede Gruppe in der Klammer ist ein Ion."),
    );
  add(
    { kind: "number", value: 2 },
    tx("Kinds of ions", "Ionensorten"),
    tx("There are two **kinds** of ions, right. But how many ions of each kind are in one formula unit?", "Es gibt zwei **Sorten** Ionen, stimmt. Aber wie viele Ionen von jeder Sorte stecken in einer Formeleinheit?"),
  );
  const ions = `${s.nc > 1 ? s.nc : ""}${ionFormula(s.cat)} + ${s.na > 1 ? s.na : ""}${ionFormula(s.an)}`;
  return {
    instruction: tx("Count the ions", "Zähl die Ionen"),
    text: tx(`How many ions make up one formula unit of $${ce(s.formula)}$?`, `Aus wie vielen Ionen besteht eine Formeleinheit $${ce(s.formula)}$?`),
    answer,
    hint: tx("Split the formula into its ions. A group in brackets stays together as one ion.", "Zerleg die Formel in ihre Ionen. Eine Gruppe in Klammern bleibt als ein Ion zusammen."),
    solution: [
      { math: ce(s.formula), note: tx("Split it into cations and anions.", "Zerleg sie in Kationen und Anionen.") },
      { math: ce(ions), note: tx(`${s.nc} × $${ionCe(s.cat)}$ and ${s.na} × $${ionCe(s.an)}$.`, `${s.nc} × $${ionCe(s.cat)}$ und ${s.na} × $${ionCe(s.an)}$.`) },
      { math: `${s.nc} + ${s.na} = ${value}`, note: tx(`${value} ions in total.`, `Insgesamt ${value} Ionen.`) },
    ],
    mistakes: out,
  };
}

function electronsTransferred(s: Salt): Exercise {
  const { cat, an, nc, na } = s;
  const c = cat.charge;
  const a = -an.charge;
  const value = nc * c;
  const answer: AnswerSpec = { kind: "number", value };
  const { out, add } = collector(answer);
  const metal = elName(cat.f);
  const non = elName(an.f);
  if (nc > 1)
    add(
      { kind: "number", value: c },
      tx("Only one metal atom", "Nur ein Metallatom"),
      tx(`That's what **one** ${EN(metal).toLowerCase()} atom gives. But there are ${nc} of them in the formula unit.`, `So viel gibt **ein** ${DE(metal)}atom ab. Aber in der Formeleinheit stecken ${nc} davon.`),
    );
  if (na > 1)
    add(
      { kind: "number", value: a },
      tx("Only one anion", "Nur ein Anion"),
      tx(`That's what **one** ${EN(non).toLowerCase()} atom takes. But there are ${na} of them.`, `So viel nimmt **ein** ${DE(non)}atom auf. Aber es sind ${na} davon.`),
    );
  add(
    { kind: "number", value: c + a },
    tx("Charges added", "Ladungen addiert"),
    tx("Adding the two charge numbers doesn't count electrons. Count what all metal atoms give away together.", "Die beiden Ladungszahlen zu addieren zählt keine Elektronen. Zähl, was alle Metallatome zusammen abgeben."),
  );
  add(
    { kind: "number", value: nc + na },
    tx("Ions counted", "Ionen gezählt"),
    tx("That's the number of ions. Each metal atom gives away more than one electron, though.", "Das ist die Zahl der Ionen. Jedes Metallatom gibt aber mehr als ein Elektron ab."),
  );
  const k = (n: number) => (n > 1 ? `${n}` : "");
  return {
    instruction: tx("Count the electrons", "Zähl die Elektronen"),
    text: tx(
      `$${ce(s.formula)}$ forms from the elements. How many electrons move from the ${EN(metal).toLowerCase()} atoms to the ${EN(non).toLowerCase()} atoms for **one** formula unit?`,
      `$${ce(s.formula)}$ entsteht aus den Elementen. Wie viele Elektronen gehen bei **einer** Formeleinheit von den ${DE(metal)}atomen auf die ${DE(non)}atome über?`,
    ),
    answer,
    hint: tx("How many electrons does one metal atom give away? And how many metal atoms are there?", "Wie viele Elektronen gibt ein Metallatom ab? Und wie viele Metallatome sind es?"),
    solution: [
      {
        math: ce(`${k(nc)}${cat.f} -> ${k(nc)}${ionFormula(cat)} + ${k(value)}e-`),
        note:
          nc === 1
            ? tx(`The ${EN(metal).toLowerCase()} atom gives away ${electronsEn(c)}.`, `Das ${DE(metal)}atom gibt ${electronsDe(c)} ab.`)
            : tx(`Each ${EN(metal).toLowerCase()} atom gives away ${electronsEn(c)}: $${nc} \\cdot ${c} = ${value}$.`, `Jedes ${DE(metal)}atom gibt ${electronsDe(c)} ab: $${nc} \\cdot ${c} = ${value}$.`),
      },
      {
        math: ce(`${k(na)}${an.f} + ${k(value)}e- -> ${k(na)}${ionFormula(an)}`),
        note:
          na === 1
            ? tx(`The ${EN(non).toLowerCase()} atom takes exactly these ${value} electrons.`, `Das ${DE(non)}atom nimmt genau diese ${value} Elektronen auf.`)
            : tx(
                `The ${na} ${EN(non).toLowerCase()} atoms take exactly these ${value} electrons ($${na} \\cdot ${a} = ${value}$).`,
                `Die ${na} ${DE(non)}atome nehmen genau diese ${value} Elektronen auf ($${na} \\cdot ${a} = ${value}$).`,
              ),
      },
    ],
    mistakes: out,
  };
}

// ---------------------------------------------------------------------------
// Concepts: ions, the lattice, salt properties

type Concept = { q: Text; right: Text; wrong: [Text, Text, Text][]; frames: Frame[] };

const CONCEPTS_1: Concept[] = [
  {
    q: tx("A metal reacts with a nonmetal. What happens to the electrons?", "Ein Metall reagiert mit einem Nichtmetall. Was passiert mit den Elektronen?"),
    right: tx("The metal atoms give electrons to the nonmetal atoms.", "Die Metallatome geben Elektronen an die Nichtmetallatome ab."),
    wrong: [
      [
        tx("The nonmetal atoms give electrons to the metal atoms.", "Die Nichtmetallatome geben Elektronen an die Metallatome ab."),
        tx("Wrong way round", "Andersherum"),
        tx("It's the other way round: metal atoms have few outer electrons and give them away. Nonmetal atoms take them.", "Genau andersherum: Metallatome haben wenige Außenelektronen und geben sie ab. Nichtmetallatome nehmen sie auf."),
      ],
      [
        tx("The atoms share electron pairs.", "Die Atome teilen sich Elektronenpaare."),
        tx("That's the covalent bond", "Das ist die Elektronenpaarbindung"),
        tx("Sharing pairs happens between nonmetal atoms. Metal + nonmetal: the electrons change sides completely.", "Elektronenpaare teilen sich Nichtmetallatome. Bei Metall + Nichtmetall wechseln die Elektronen ganz die Seite."),
      ],
      [
        tx("Protons move from the metal to the nonmetal.", "Protonen wandern vom Metall zum Nichtmetall."),
        tx("Protons stay put", "Protonen bleiben, wo sie sind"),
        tx("Protons stay in the nucleus! In these reactions only electrons move.", "Protonen bleiben im Atomkern! Bei diesen Reaktionen bewegen sich nur Elektronen."),
      ],
    ],
    frames: [
      { math: ce("Na -> Na+ + e-"), note: tx("The metal atom gives its outer electron away.", "Das Metallatom gibt sein Außenelektron ab.") },
      { math: ce("Cl + e- -> Cl-"), note: tx("The nonmetal atom takes it. That's an electron transfer.", "Das Nichtmetallatom nimmt es auf. Das ist ein Elektronenübergang.") },
    ],
  },
  {
    q: tx("What is an anion?", "Was ist ein Anion?"),
    right: tx("A negatively charged ion", "Ein negativ geladenes Ion"),
    wrong: [
      [tx("A positively charged ion", "Ein positiv geladenes Ion"), tx("That's a cation", "Das ist ein Kation"), tx("That's a cation. Anions have taken electrons in, so they're negative.", "Das ist ein Kation. Anionen haben Elektronen aufgenommen, darum sind sie negativ.")],
      [tx("An atom without a charge", "Ein Atom ohne Ladung"), tx("Ions are charged", "Ionen sind geladen"), tx("An atom without a charge isn't an ion at all. Ions always carry a charge.", "Ein Atom ohne Ladung ist gar kein Ion. Ionen tragen immer eine Ladung.")],
      [tx("A metal atom", "Ein Metallatom"), tx("Metals make cations", "Metalle bilden Kationen"), tx("Metal atoms give electrons away and become cations. Anions come from nonmetal atoms.", "Metallatome geben Elektronen ab und werden zu Kationen. Anionen entstehen aus Nichtmetallatomen.")],
    ],
    frames: [
      { math: ce("O + 2e- -> O^2-"), note: tx("An atom takes electrons in: more electrons than protons.", "Ein Atom nimmt Elektronen auf: mehr Elektronen als Protonen.") },
      { math: `${ce("O^2-")} \\quad ${ce("Cl-")} \\quad ${ce("SO4^2-")}`, note: tx("So it's negative: an **anion**. Positive ions are cations.", "Also ist es negativ: ein **Anion**. Positive Ionen sind Kationen.") },
    ],
  },
  {
    q: tx("Which particles make up a salt crystal?", "Aus welchen Teilchen besteht ein Salzkristall?"),
    right: tx("Positive and negative ions", "Aus positiven und negativen Ionen"),
    wrong: [
      [tx("Molecules", "Aus Molekülen"), tx("No molecules in salts", "Keine Moleküle im Salz"), tx("Salts have no molecules. A formula like NaCl only gives the ratio of the ions in the lattice.", "Salze haben keine Moleküle. Eine Formel wie NaCl gibt nur das Verhältnis der Ionen im Gitter an.")],
      [tx("Neutral atoms", "Aus neutralen Atomen"), tx("The atoms became ions", "Aus Atomen wurden Ionen"), tx("The atoms have already given and taken electrons. In the crystal they're charged ions.", "Die Atome haben schon Elektronen abgegeben und aufgenommen. Im Kristall sind sie geladene Ionen.")],
      [tx("Only negative ions", "Nur aus negativen Ionen"), tx("Plus and minus", "Plus und Minus"), tx("Only negative ions would push each other away! Positive and negative ions alternate and attract each other.", "Nur negative Ionen würden sich gegenseitig abstoßen! Positive und negative Ionen wechseln sich ab und ziehen sich an.")],
    ],
    frames: [
      { math: `${ce("Na+")} \\quad ${ce("Cl-")}`, note: tx("Table salt is made of sodium ions and chloride ions.", "Kochsalz besteht aus Natrium-Ionen und Chlorid-Ionen.") },
      { math: ce("NaCl"), note: tx("In the ionic lattice they alternate: the formula gives the ratio 1 : 1.", "Im Ionengitter wechseln sie sich ab: Die Formel gibt das Verhältnis 1 : 1 an.") },
    ],
  },
];

const CONCEPTS_2: Concept[] = [
  {
    q: tx("Why does molten salt conduct electricity, but solid salt doesn't?", "Warum leitet eine Salzschmelze den Strom, festes Salz aber nicht?"),
    right: tx("In the solid the ions are fixed in the lattice; in the melt they can move.", "Im Feststoff sitzen die Ionen fest im Gitter, in der Schmelze sind sie beweglich."),
    wrong: [
      [tx("Solid salt has no ions; they only form when it melts.", "Festes Salz hat keine Ionen, sie entstehen erst beim Schmelzen."), tx("The ions are always there", "Die Ionen sind immer da"), tx("The ions are there all the time, also in the solid. They just can't move there.", "Die Ionen sind die ganze Zeit da, auch im Feststoff. Sie können sich dort nur nicht bewegen.")],
      [tx("The melt contains free electrons, like a metal.", "Die Schmelze enthält freie Elektronen, wie ein Metall."), tx("Ions, not electrons", "Ionen, nicht Elektronen"), tx("Not electrons: in a salt melt the moving **ions** carry the charge.", "Keine Elektronen: In der Salzschmelze tragen die beweglichen **Ionen** die Ladung.")],
      [tx("Heat makes every substance conduct electricity.", "Hitze macht jeden Stoff leitfähig."), tx("Not every substance", "Nicht jeder Stoff"), tx("Melted sugar doesn't conduct at all. It's about charged particles that can move.", "Geschmolzener Zucker leitet gar nicht. Es kommt auf geladene Teilchen an, die sich bewegen können.")],
    ],
    frames: [
      { math: ce("NaCl(s)"), note: tx("Solid: the ions sit fixed in the lattice. No charge can flow.", "Fest: Die Ionen sitzen fest im Gitter. Es kann keine Ladung fließen.") },
      { math: ce("NaCl(l)"), note: tx("Molten: the ions move freely and carry the current to the poles.", "Geschmolzen: Die Ionen sind frei beweglich und tragen den Strom zu den Polen.") },
    ],
  },
  {
    q: tx("Why is a salt crystal brittle?", "Warum ist ein Salzkristall spröde?"),
    right: tx("A blow shifts the layers, so ions with the same charge meet and repel each other.", "Ein Schlag verschiebt die Schichten, sodass gleich geladene Ionen aufeinandertreffen und sich abstoßen."),
    wrong: [
      [tx("The ionic bond is very weak.", "Die Ionenbindung ist sehr schwach."), tx("The bond is strong", "Die Bindung ist stark"), tx("The ionic bond is actually strong: that's why salts melt so late. Think about what happens when the layers shift.", "Die Ionenbindung ist eigentlich stark: Darum schmelzen Salze so spät. Überleg, was passiert, wenn sich die Schichten verschieben.")],
      [tx("The ions are held by shared electron pairs that snap.", "Die Ionen hängen an gemeinsamen Elektronenpaaren, die reißen."), tx("No shared pairs", "Keine gemeinsamen Paare"), tx("In a salt there are no shared electron pairs. The ions attract each other through their charges.", "In einem Salz gibt es keine gemeinsamen Elektronenpaare. Die Ionen ziehen sich über ihre Ladungen an.")],
      [tx("Salt crystals contain tiny air bubbles.", "Salzkristalle enthalten winzige Luftbläschen."), tx("Not air", "Keine Luft"), tx("It's not about air. Picture the layers sliding: which charges end up next to each other?", "Mit Luft hat das nichts zu tun. Stell dir vor, wie die Schichten verrutschen: Welche Ladungen liegen dann nebeneinander?")],
    ],
    frames: [
      { math: `${ce("Na+")} \\; ${ce("Cl-")} \\; ${ce("Na+")}`, note: tx("In the lattice, opposite charges sit next to each other.", "Im Gitter liegen entgegengesetzte Ladungen nebeneinander.") },
      { math: `${ce("Na+")} \\; ${ce("Na+")} \\quad ${ce("Cl-")} \\; ${ce("Cl-")}`, note: tx("A blow shifts a layer: now equal charges meet, repel, and the crystal breaks.", "Ein Schlag verschiebt eine Schicht: Jetzt treffen gleiche Ladungen aufeinander, stoßen sich ab und der Kristall bricht.") },
    ],
  },
  {
    q: tx("Why do salts have high melting points?", "Warum haben Salze hohe Schmelztemperaturen?"),
    right: tx("Many oppositely charged ions attract each other strongly in all directions.", "Viele entgegengesetzt geladene Ionen ziehen sich stark in alle Richtungen an."),
    wrong: [
      [tx("Salt molecules are very heavy.", "Salzmoleküle sind sehr schwer."), tx("No molecules in salts", "Keine Moleküle im Salz"), tx("Salts aren't made of molecules. The ions in the lattice hold on to each other through their charges.", "Salze bestehen nicht aus Molekülen. Die Ionen im Gitter halten über ihre Ladungen zusammen.")],
      [tx("The ions repel each other.", "Die Ionen stoßen sich ab."), tx("Attraction, not repulsion", "Anziehung, nicht Abstoßung"), tx("Repulsion would make it fall apart easily. It's the attraction between plus and minus that's strong.", "Abstoßung würde das Gitter leicht zerfallen lassen. Stark ist die Anziehung zwischen Plus und Minus.")],
      [tx("Salt crystals are always very large.", "Salzkristalle sind immer sehr groß."), tx("Size doesn't matter", "Die Größe ist egal"), tx("A tiny salt crystal melts at the same temperature as a big one. It's about the forces between the ions.", "Ein winziger Salzkristall schmilzt bei derselben Temperatur wie ein großer. Es geht um die Kräfte zwischen den Ionen.")],
    ],
    frames: [
      { math: `${ce("NaCl")} : \\; 801 "°C"`, note: tx("Table salt melts at 801 °C.", "Kochsalz schmilzt bei 801 °C.") },
      { math: `${ce("Na+")} \\; ${ce("Cl-")}`, note: tx("Every ion is pulled by all its neighbours. To melt, you need a lot of energy to break up the lattice.", "Jedes Ion wird von allen Nachbarn angezogen. Zum Schmelzen brauchst du viel Energie, um das Gitter aufzubrechen.") },
    ],
  },
  {
    q: tx("What holds the ions together in an ionic bond?", "Was hält die Ionen in einer Ionenbindung zusammen?"),
    right: tx("The attraction between positive and negative charges", "Die Anziehung zwischen positiven und negativen Ladungen"),
    wrong: [
      [tx("Shared electron pairs", "Gemeinsame Elektronenpaare"), tx("That's the covalent bond", "Das ist die Elektronenpaarbindung"), tx("Shared pairs hold molecules together. In salts, the electrons have changed sides and the charges attract.", "Gemeinsame Paare halten Moleküle zusammen. In Salzen haben die Elektronen die Seite gewechselt, und die Ladungen ziehen sich an.")],
      [tx("Magnetic forces", "Magnetische Kräfte"), tx("Electric, not magnetic", "Elektrisch, nicht magnetisch"), tx("Not magnetism: it's electric attraction between charged ions.", "Kein Magnetismus: Es ist die elektrische Anziehung zwischen geladenen Ionen.")],
      [tx("The water in the crystal", "Das Wasser im Kristall"), tx("No water needed", "Kein Wasser nötig"), tx("Dry salt holds together perfectly well. Plus attracts minus, that's all it takes.", "Trockenes Salz hält prima zusammen. Plus zieht Minus an, mehr braucht es nicht.")],
    ],
    frames: [
      { math: `${ce("Na+")} \\quad ${ce("Cl-")}`, note: tx("Opposite charges attract each other.", "Entgegengesetzte Ladungen ziehen sich an.") },
      { math: ce("NaCl"), note: tx("This attraction in all directions is the **ionic bond**.", "Diese Anziehung in alle Richtungen ist die **Ionenbindung**.") },
    ],
  },
  {
    q: tx("Why does salt water conduct electricity?", "Warum leitet Salzwasser den elektrischen Strom?"),
    right: tx("The dissolved ions can move freely.", "Die gelösten Ionen sind frei beweglich."),
    wrong: [
      [tx("Water itself conducts very well.", "Wasser selbst leitet sehr gut."), tx("Pure water barely conducts", "Reines Wasser leitet kaum"), tx("Pure water hardly conducts at all. It's the ions from the salt that carry the charge.", "Reines Wasser leitet fast gar nicht. Die Ionen aus dem Salz tragen die Ladung.")],
      [tx("The salt releases free electrons.", "Das Salz setzt freie Elektronen frei."), tx("Ions, not electrons", "Ionen, nicht Elektronen"), tx("Not electrons: in a salt solution the moving ions carry the current.", "Keine Elektronen: In einer Salzlösung tragen die beweglichen Ionen den Strom.")],
      [tx("Salt molecules move to the poles.", "Salzmoleküle wandern zu den Polen."), tx("No salt molecules", "Keine Salzmoleküle"), tx("Close, something does move to the poles! But salts aren't made of molecules, they're made of ions.", "Fast, es wandert wirklich etwas zu den Polen! Aber Salze bestehen nicht aus Molekülen, sondern aus Ionen.")],
    ],
    frames: [
      { math: ce("NaCl(s) -> Na+(aq) + Cl-(aq)"), note: tx("When salt dissolves, the lattice falls apart into single ions.", "Beim Lösen zerfällt das Gitter in einzelne Ionen.") },
      { math: `${ce("Na+(aq)")} \\to "−" \\quad ${ce("Cl-(aq)")} \\to "+"`, note: tx("They move freely: cations to the minus pole, anions to the plus pole.", "Sie sind frei beweglich: Kationen wandern zum Minuspol, Anionen zum Pluspol.") },
    ],
  },
];

function conceptChoice(c: Concept, rng: Rng): Exercise {
  const order = rng.shuffle([0, 1, 2, 3]);
  const all: Text[] = [c.right, ...c.wrong.map((w) => w[0])];
  const options: RichText[] = order.map((i) => all[i]);
  const answer: AnswerSpec = { kind: "choice", options, correct: order.indexOf(0) };
  const { out, add } = collector(answer);
  c.wrong.forEach(([, title, say], j) => add({ kind: "choice", options, correct: order.indexOf(j + 1) }, title, say));
  return {
    instruction: tx("Choose the right answer", "Wähl die richtige Antwort"),
    text: c.q,
    answer,
    hint: tx("Think of the particles: charged ions, and whether they can move.", "Denk an die Teilchen: geladene Ionen, und ob sie sich bewegen können."),
    solution: c.frames,
    mistakes: out,
  };
}

function neighbours(): Exercise {
  const answer: AnswerSpec = { kind: "number", value: 6 };
  const { out, add } = collector(answer);
  add({ kind: "number", value: 1 }, tx("Ratio isn't neighbours", "Verhältnis ist nicht Nachbarn"), tx("The formula NaCl only gives the ratio 1 : 1. In the lattice each ion has several direct neighbours.", "Die Formel NaCl gibt nur das Verhältnis 1 : 1 an. Im Gitter hat jedes Ion mehrere direkte Nachbarn."));
  add({ kind: "number", value: 4 }, tx("Only the flat picture", "Nur das flache Bild"), tx("In a flat drawing you see 4 neighbours. But the lattice is three-dimensional: there's one above and one below, too.", "In einer flachen Zeichnung siehst du 4 Nachbarn. Aber das Gitter ist räumlich: Darüber und darunter sitzt auch noch je eins."));
  add({ kind: "number", value: 8 }, tx("Corners of a cube", "Ecken eines Würfels"), tx("8 would be the corners of a cube around the ion. In the NaCl lattice the nearest neighbours sit on the faces: left, right, front, back, top, bottom.", "8 wären die Ecken eines Würfels um das Ion. Im NaCl-Gitter sitzen die nächsten Nachbarn auf den Flächen: links, rechts, vorn, hinten, oben, unten."));
  return {
    instruction: tx("Look at the lattice", "Schau dir das Gitter an"),
    text: tx("In the sodium chloride lattice, how many chloride ions surround each sodium ion directly?", "Von wie vielen Chlorid-Ionen ist im Natriumchlorid-Gitter jedes Natrium-Ion direkt umgeben?"),
    answer,
    hint: tx("Picture a cube-shaped lattice: left, right, front, back, top, bottom.", "Stell dir ein würfelförmiges Gitter vor: links, rechts, vorn, hinten, oben, unten."),
    solution: [
      { math: `${ce("Na+")} : \\; 4#n`, note: tx("In one layer: 4 chloride ions around each sodium ion.", "In einer Schicht: 4 Chlorid-Ionen um jedes Natrium-Ion.") },
      { math: `${ce("Na+")} : \\; 4#n + 2 = 6`, note: tx("Plus one above and one below: 6. Chemists call this the coordination number.", "Dazu eins darüber und eins darunter: 6. Das nennt man die Koordinationszahl.") },
    ],
    mistakes: out,
  };
}

// ---------------------------------------------------------------------------
// Generator

const toSalts = (list: [string, string][]) => list.map(([c, a]) => salt(c, a));
const BINARY_SALTS = toSalts(BINARY);
const POLY_SIMPLE_SALTS = toSalts(POLY_SIMPLE);
const HARD_SALTS = toSalts(POLY_HARD);
const ROMAN_SALTS = toSalts(ROMAN);
const ROMAN_BINARY = ROMAN_SALTS.filter((s) => !s.an.poly);

/** Salts with a bracketed group, for counting tasks: [salt, element only found in that group]. */
const COUNTABLE: [Salt, string][] = [...POLY_SIMPLE_SALTS, ...HARD_SALTS].flatMap((s): [Salt, string][] => {
  const group = s.cat.poly && s.nc > 1 ? s.cat : s.an.poly && s.na > 1 ? s.an : null;
  if (!group) return [];
  const other = group === s.cat ? s.an : s.cat;
  const inGroup = parseFormula(group.f);
  const inOther = parseFormula(other.f);
  if (!inGroup.ok || !inOther.ok) return [];
  return Object.keys(inGroup.species.counts)
    .filter((el) => !(el in inOther.species.counts))
    .map((el): [Salt, string] => [s, el]);
});

const BRACKETED = [...POLY_SIMPLE_SALTS, ...HARD_SALTS].filter((s) => (s.an.poly && s.na > 1) || (s.cat.poly && s.nc > 1));
const TRANSFER = BINARY_SALTS.filter((s) => s.nc * s.cat.charge >= 2);

function level1(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.3) return ionExercise(rng.pick(ION_ELEMENTS));
  if (r < 0.48) return electronsInIon(rng.pick(ION_ELEMENTS));
  if (r < 0.63) return nobleChoice(rng.pick(ION_ELEMENTS), rng);
  if (r < 0.9) return formulaFromIons(rng.pick(BINARY_SALTS));
  return conceptChoice(rng.pick(CONCEPTS_1), rng);
}

function level2(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.26) return formulaFromName(rng.pick(BINARY_SALTS));
  if (r < 0.46) return formulaFromName(rng.pick(POLY_SIMPLE_SALTS));
  if (r < 0.66) return nameFromFormula(rng.pick(rng.chance(0.6) ? BINARY_SALTS : POLY_SIMPLE_SALTS));
  if (r < 0.82) return conceptChoice(rng.pick(CONCEPTS_2), rng);
  if (r < 0.95) {
    const [s, el] = rng.pick(COUNTABLE);
    return atomsInFormula(s, el);
  }
  return neighbours();
}

function level3(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.32) return formulaFromName(rng.pick(HARD_SALTS));
  if (r < 0.44) return formulaFromName(rng.pick(ROMAN_BINARY));
  if (r < 0.68) return romanChoice(rng.pick(ROMAN_SALTS), rng);
  if (r < 0.84) return electronsTransferred(rng.pick(TRANSFER));
  return ionsInFormula(rng.pick(BRACKETED));
}

function generate(level: Level, rng: Rng): Exercise {
  return level === 1 ? level1(rng) : level === 2 ? level2(rng) : level3(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const nobleFrames: Frame[] = [
  { math: `${ce("Na")} \\quad (2, 8, 1#o)`, highlight: ["o"], note: tx("**Sodium** has the shells 2, 8, 1: only **one** outer electron.", "**Natrium** hat die Schalen 2, 8, 1: nur **ein** Außenelektron.") },
  { math: ce("Na -> Na+ + e-"), note: tx("It gives this electron away. What's left is a positively charged ion, a **cation**.", "Es gibt dieses Elektron ab. Übrig bleibt ein positiv geladenes Ion, ein **Kation**.") },
  {
    math: tx(`${ce("Na+")} \\quad (2, 8) \\quad "like" \\; ${ce("Ne")}`, `${ce("Na+")} \\quad (2, 8) \\quad "wie" \\; ${ce("Ne")}`),
    note: tx("Now the full 8-shell is on the outside: just like the noble gas **neon**. That's a **noble gas configuration**.", "Jetzt ist die volle 8er-Schale ganz außen: genau wie beim Edelgas **Neon**. Das ist eine **Edelgaskonfiguration**."),
  },
  { math: `${ce("Cl")} \\quad (2, 8, 7#o)`, highlight: ["o"], note: tx("**Chlorine** has 7 outer electrons. Just **one** is missing for a full shell.", "**Chlor** hat 7 Außenelektronen. Zur vollen Schale fehlt nur **eins**.") },
  {
    math: ce("Cl + e- -> Cl-"),
    note: tx("It takes one electron and becomes a negatively charged ion, an **anion**: 2, 8, 8 like **argon**.", "Es nimmt ein Elektron auf und wird zum negativ geladenen Ion, einem **Anion**: 2, 8, 8 wie **Argon**."),
  },
  {
    math: `${ce("Na+")} \\quad ${ce("Mg^2+")} \\quad ${ce("Al^3+")}`,
    note: tx("The rule for metals: main group I, II, III gives away 1, 2, 3 electrons. Charge $+1$, $+2$, $+3$.", "Die Regel für Metalle: Hauptgruppe I, II, III gibt 1, 2, 3 Elektronen ab. Ladung $+1$, $+2$, $+3$."),
  },
  {
    math: `${ce("N^3-")} \\quad ${ce("O^2-")} \\quad ${ce("F-")}`,
    note: tx("Nonmetals in main group V, VI, VII take 3, 2, 1 electrons: charge = group number minus 8.", "Nichtmetalle der Hauptgruppen V, VI, VII nehmen 3, 2, 1 Elektronen auf: Ladung = Hauptgruppennummer minus 8."),
  },
];

const polyFrames: Frame[] = [
  { math: `${ce("Ca^2+")} \\quad ${ce("OH-")}`, note: tx("Calcium hydroxide: $\\ce{Ca^2+}$ and the hydroxide ion $\\ce{OH-}$.", "Calciumhydroxid: $\\ce{Ca^2+}$ und das Hydroxid-Ion $\\ce{OH-}$.") },
  { math: `${ce("Ca^2+")} \\quad ${ce("OH-")} \\quad ${ce("OH-")}`, note: tx("To balance $+2$ you need **two** hydroxide ions.", "Für den Ausgleich von $+2$ brauchst du **zwei** Hydroxid-Ionen.") },
  {
    math: ce("Ca(OH)2"),
    note: tx("Two OH groups: the group goes in **brackets**, the 2 behind it. $\\ce{Ca(OH)2}$ contains 1 Ca, 2 O and 2 H.", "Zwei OH-Gruppen: Die Gruppe kommt in **Klammern**, die 2 dahinter. $\\ce{Ca(OH)2}$ enthält 1 Ca, 2 O und 2 H."),
  },
  { math: `${ce("Ca(OH)2")} \\ne ${ce("CaOH2")}`, note: tx("Without brackets the 2 would only belong to the H. That's a different formula!", "Ohne Klammern gehört die 2 nur zum H. Das ist eine andere Formel!") },
  {
    math: tx(`${ce("Al^3+")} \\quad ${ce("SO4^2-")} \\quad "LCM" = 6`, `${ce("Al^3+")} \\quad ${ce("SO4^2-")} \\quad "kgV" = 6`),
    note: tx("Aluminium sulfate: charges $+3$ and $-2$, lowest common multiple 6.", "Aluminiumsulfat: Ladungen $+3$ und $-2$, kleinstes gemeinsames Vielfaches 6."),
  },
  {
    math: `${ce("Al")}_{2#a} (${ce("SO4")})_{3#b}`,
    note: tx("2 aluminium ions, 3 sulfate ions: $\\ce{Al2(SO4)3}$. Never change the inside of the group: sulfate stays $\\ce{SO4}$.", "2 Aluminium-Ionen, 3 Sulfat-Ionen: $\\ce{Al2(SO4)3}$. Am Inneren der Gruppe änderst du nie etwas: Sulfat bleibt $\\ce{SO4}$."),
  },
];

const nameFrames: Frame[] = [
  {
    math: tx(`${ce("MgCl2")} \\to "magnesium chloride"`, `${ce("MgCl2")} \\to "Magnesiumchlorid"`),
    note: tx("Cation + anion with **-ide**. No di- or tri-: the charges already fix the ratio.", "Kation + Anion mit **-id**. Kein di- oder tri-: Die Ladungen legen das Verhältnis schon fest."),
  },
  {
    math: tx(`${ce("CaCO3")} \\to "calcium carbonate"`, `${ce("CaCO3")} \\to "Calciumcarbonat"`),
    note: tx("With a polyatomic ion, just use its name. Limestone is calcium carbonate.", "Mit Molekül-Ion nimmst du einfach dessen Namen. Kalkstein ist Calciumcarbonat."),
  },
  { math: ce("FeCl3"), note: tx("Iron can form $\\ce{Fe^2+}$ and $\\ce{Fe^3+}$, copper $\\ce{Cu+}$ and $\\ce{Cu^2+}$. The name has to say which one.", "Eisen kann $\\ce{Fe^2+}$ und $\\ce{Fe^3+}$ bilden, Kupfer $\\ce{Cu+}$ und $\\ce{Cu^2+}$. Der Name muss sagen, welches.") },
  { math: `${ce("FeCl3")} : \\; 3 \\cdot (-1) = -3 \\quad \\Rightarrow \\quad ${ce("Fe^3+")}`, note: tx("Three chloride ions bring $-3$. So the iron ion must be $+3$.", "Drei Chlorid-Ionen bringen $-3$. Also muss das Eisen-Ion $+3$ sein.") },
  {
    math: tx(`${ce("FeCl3")} \\to "iron(III) chloride"`, `${ce("FeCl3")} \\to "Eisen(III)-chlorid"`),
    note: tx("The charge goes into the name as a Roman numeral: **iron(III) chloride**.", "Die Ladung kommt als römische Zahl in den Namen: **Eisen(III)-chlorid**."),
  },
];

const ionicBonds: Topic = {
  ...topicMeta("ionic-bonds"),
  summary: [
    {
      title: tx("Ions: the noble gas goal", "Ionen: Ziel Edelgaskonfiguration"),
      body: tx(
        "Metal atoms **give** electrons and become positive **cations**. Nonmetal atoms **take** electrons and become negative **anions**. Both end up with a full outer shell like a noble gas.",
        "Metallatome **geben** Elektronen ab und werden zu positiven **Kationen**. Nichtmetallatome **nehmen** Elektronen auf und werden zu negativen **Anionen**. Beide haben danach eine volle Außenschale wie ein Edelgas.",
      ),
      examples: [ce("Na -> Na+ + e-"), ce("Cl + e- -> Cl-")],
      tone: "rule",
    },
    {
      title: tx("Charge from the main group", "Ladung aus der Hauptgruppe"),
      body: tx("Main groups I, II, III: $+1$, $+2$, $+3$. Main groups V, VI, VII: $-3$, $-2$, $-1$.", "Hauptgruppen I, II, III: $+1$, $+2$, $+3$. Hauptgruppen V, VI, VII: $-3$, $-2$, $-1$."),
      examples: [`${ce("Na+")} \\quad ${ce("Mg^2+")} \\quad ${ce("Al^3+")}`, `${ce("N^3-")} \\quad ${ce("O^2-")} \\quad ${ce("Cl-")}`],
      tone: "rule",
    },
    {
      title: tx("Ionic bond and lattice", "Ionenbindung und Ionengitter"),
      body: tx(
        "Opposite charges attract in all directions and form an **ionic lattice**. Salts are hard, brittle, melt at high temperatures and conduct electricity only when molten or dissolved.",
        "Entgegengesetzte Ladungen ziehen sich in alle Richtungen an und bilden ein **Ionengitter**. Salze sind hart, spröde, schmelzen erst bei hohen Temperaturen und leiten den Strom nur als Schmelze oder Lösung.",
      ),
      examples: [ce("NaCl(s)"), ce("NaCl(l) -> Na+ + Cl-")],
      tone: "rule",
    },
    {
      title: tx("Formula: charges cancel", "Verhältnisformel: Ladungen ausgleichen"),
      body: tx(
        "Find the lowest common multiple of the charges. The numbers of ions become the indices. Shortcut: cross the charge numbers, then reduce.",
        "Bestimm das kleinste gemeinsame Vielfache der Ladungen. Die Ionenzahlen werden zu Indizes. Abkürzung: Ladungszahlen über Kreuz schreiben, dann kürzen.",
      ),
      examples: [`2 ${ce("Al^3+")} \\quad 3 ${ce("O^2-")} \\quad \\to \\quad ${ce("Al2O3")}`, `${ce("Ca^2+")} \\quad 2 ${ce("Cl-")} \\quad \\to \\quad ${ce("CaCl2")}`],
      tone: "rule",
    },
    {
      title: tx("Polyatomic ions need brackets", "Molekül-Ionen brauchen Klammern"),
      body: tx(
        "More than one of them? Put the group in brackets with the index behind it. Never change the inside of the group.",
        "Mehr als eins davon? Setz die Gruppe in Klammern und den Index dahinter. Am Inneren der Gruppe änderst du nie etwas.",
      ),
      examples: [`${ce("OH-")} \\; ${ce("NO3-")} \\; ${ce("SO4^2-")} \\; ${ce("CO3^2-")} \\; ${ce("PO4^3-")} \\; ${ce("NH4+")}`, `${ce("Ca(OH)2")} \\ne ${ce("CaOH2")}`],
      tone: "warning",
    },
    {
      title: tx("Naming salts", "Salze benennen"),
      body: tx(
        "Cation + anion, nonmetal anions end in **-ide**, no di- or tri-. Metals with several charges get a Roman numeral.",
        "Kation + Anion, Anionen von Nichtmetallen enden auf **-id**, ohne di- oder tri-. Metalle mit mehreren Ladungen bekommen eine römische Zahl.",
      ),
      examples: [
        tx(`${ce("MgCl2")} \\to "magnesium chloride"`, `${ce("MgCl2")} \\to "Magnesiumchlorid"`),
        tx(`${ce("Fe2O3")} \\to "iron(III) oxide"`, `${ce("Fe2O3")} \\to "Eisen(III)-oxid"`),
      ],
      tone: "tip",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Why atoms give and take electrons", "Warum Atome Elektronen abgeben und aufnehmen"),
      blob: tx("Noble gases are the cool kids of chemistry. Everyone wants their electron setup!", "Edelgase sind die Stars der Chemie. Alle wollen ihre Elektronenverteilung!"),
      body: tx(
        "Noble gases hardly react: their outer shell is full (8 electrons, helium 2). Other atoms reach this **noble gas configuration** by giving away or taking electrons. They become **ions**: charged particles.",
        "Edelgase reagieren kaum: Ihre Außenschale ist voll besetzt (8 Elektronen, Helium 2). Andere Atome erreichen diese **Edelgaskonfiguration**, indem sie Elektronen abgeben oder aufnehmen. Dabei werden sie zu **Ionen**: geladenen Teilchen.",
      ),
      frames: nobleFrames,
    },
    {
      type: "widget",
      title: tx("Watch the electrons jump", "Schau den Elektronen beim Springen zu"),
      blob: tx("Pick a pair and press the button. Count the electrons on the outer shells!", "Wähl ein Paar und drück den Knopf. Zähl die Elektronen auf den Außenschalen!"),
      body: tx(
        "This is an **electron transfer**: the metal atom gives, the nonmetal atom takes. The numbers under each atom are its shells.",
        "Das ist ein **Elektronenübergang**: Das Metallatom gibt ab, das Nichtmetallatom nimmt auf. Die Zahlen unter jedem Atom sind seine Schalen.",
      ),
      widget: IonicBondsTransfer,
    },
    {
      type: "check",
      blob: tx("Your turn! Sulfur sits in main group VI.", "Du bist dran! Schwefel steht in Hauptgruppe VI."),
      exercise: ionExercise("S"),
    },
    {
      type: "widget",
      title: tx("The ionic lattice", "Das Ionengitter"),
      blob: tx("Now let's smash a salt crystal. For science!", "Jetzt zerschlagen wir einen Salzkristall. Für die Wissenschaft!"),
      body: tx(
        "Positive and negative ions attract each other in **all directions**: that's the **ionic bond**. Countless ions line up in a regular **ionic lattice**, a salt crystal. Try the hammer and the flame.",
        "Positive und negative Ionen ziehen sich in **alle Richtungen** an: Das ist die **Ionenbindung**. Unzählige Ionen ordnen sich zu einem regelmäßigen **Ionengitter**, einem Salzkristall. Probier den Hammer und die Flamme aus.",
      ),
      widget: IonicBondsLattice,
    },
    {
      type: "explain",
      title: tx("Salt formulas: the charges cancel", "Verhältnisformeln: Die Ladungen gleichen sich aus"),
      blob: tx("Think of a charge balance. Plus and minus have to match exactly.", "Stell dir eine Ladungswaage vor. Plus und Minus müssen genau gleich sein."),
      body: tx(
        "A salt is neutral overall. Its formula gives the smallest whole-number ratio of the ions. Example: **aluminium oxide**.",
        "Ein Salz ist nach außen neutral. Seine **Verhältnisformel** gibt das kleinste ganzzahlige Verhältnis der Ionen an. Beispiel: **Aluminiumoxid**.",
      ),
      frames: saltFrames(salt("Al", "O"), true),
    },
    {
      type: "widget",
      title: tx("Build a salt", "Bau ein Salz"),
      blob: tx("Add ions until the charge blocks match up. Then I'll tell you the name!", "Nimm Ionen dazu, bis die Ladungsblöcke gleich lang sind. Dann verrat ich dir den Namen!"),
      body: tx("Choose a cation and an anion. Each block is one charge. When plus and minus are equal, the salt is neutral.", "Wähl ein Kation und ein Anion. Jeder Block ist eine Ladung. Wenn Plus und Minus gleich sind, ist das Salz neutral."),
      widget: IonicBondsBuilder,
    },
    {
      type: "check",
      blob: tx("Sodium oxide. Which charges do the two ions have?", "Natriumoxid. Welche Ladungen haben die beiden Ionen?"),
      exercise: formulaFromName(salt("Na", "O")),
    },
    {
      type: "explain",
      title: tx("Ions made of several atoms", "Ionen aus mehreren Atomen"),
      blob: tx("Some ions come as a team. The team always sticks together!", "Manche Ionen treten im Team auf. Das Team bleibt immer zusammen!"),
      body: tx(
        "These **polyatomic ions** carry one charge for the whole group. Learn them by heart: hydroxide $\\ce{OH-}$, nitrate $\\ce{NO3-}$, sulfate $\\ce{SO4^2-}$, carbonate $\\ce{CO3^2-}$, phosphate $\\ce{PO4^3-}$ and ammonium $\\ce{NH4+}$.",
        "Diese **Molekül-Ionen** tragen eine Ladung für die ganze Gruppe. Lern sie auswendig: Hydroxid $\\ce{OH-}$, Nitrat $\\ce{NO3-}$, Sulfat $\\ce{SO4^2-}$, Carbonat $\\ce{CO3^2-}$, Phosphat $\\ce{PO4^3-}$ und Ammonium $\\ce{NH4+}$.",
      ),
      frames: polyFrames,
    },
    {
      type: "check",
      blob: tx("Magnesium nitrate. Nitrate is one of the team ions: brackets ready?", "Magnesiumnitrat. Nitrat ist eines der Team-Ionen: Klammern bereit?"),
      exercise: formulaFromName(salt("Mg", "NO3")),
    },
    {
      type: "explain",
      title: tx("Naming salts", "Salze benennen"),
      blob: tx("Names are easier than they look. Cation first, then the anion.", "Namen sind leichter, als sie aussehen. Erst das Kation, dann das Anion."),
      body: tx(
        "The anion of a nonmetal gets the ending **-ide**: chloride, bromide, iodide, fluoride, oxide (oxygen), sulfide (sulfur), nitride (nitrogen). Polyatomic ions keep their own names.",
        "Das Anion eines Nichtmetalls bekommt die Endung **-id**: Chlorid, Bromid, Iodid, Fluorid, Oxid (Sauerstoff), Sulfid (Schwefel), Nitrid (Stickstoff). Molekül-Ionen behalten ihren eigenen Namen.",
      ),
      frames: nameFrames,
    },
    {
      type: "check",
      blob: tx("Last one! Rust is mostly this compound. What's it called?", "Die letzte! Rost besteht vor allem aus diesem Stoff. Wie heißt er?"),
      exercise: romanChoice(salt("Fe3", "O")),
    },
  ],
  generate,
};

export default ionicBonds;
