"use client";

import { resolveText, tx, type Text } from "@/i18n/text";
import { topicMeta } from "@/learn/catalog";
import { byNumber, CATEGORY_NAMES, ELEMENTS, element, mainGroup, shells, type Category, type Element } from "@/learn/chemistry/elements";
import { LookupTable, visual } from "@/learn/chemistry/visuals/AtomsVisuals";
import { eqn, PeriodicTableExplorer, PeriodicTableFamilies, PeriodicTableNobleGas, ROMAN } from "@/learn/chemistry/visuals/PeriodicTableWidgets";
import { check, type AnswerValue } from "@/learn/engine/answers";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Mistake, Topic } from "@/learn/types";

// ---------------------------------------------------------------------------
// Names and helpers

const enName = (e: Element) => resolveText(e.name, "en").toLowerCase();
const deName = (e: Element) => resolveText(e.name, "de");
const anAtom = (e: Element) => `${/^[aeio]/.test(enName(e)) ? "an" : "a"} ${enName(e)} atom`;
const deAtom = (e: Element) => `${deName(e)}atom`;
const el = (s: string) => element(s)!;
const mg = (e: Element) => mainGroup(e)!;
/** The main-group element at a position, if there is one. */
const at = (period: number, group: number) => ELEMENTS.find((e) => e.period === period && mainGroup(e) === group);
/** "$\ce{K}$ (potassium)" / "$\ce{K}$ (Kalium)" */
const symName = (e: Element): Text => tx(`$\\ce{${e.symbol}}$ (${enName(e)})`, `$\\ce{${e.symbol}}$ (${deName(e)})`);
const plEn = (n: number, what: string) => `${n} ${n === 1 ? what : `${what}s`}`;
const plDe = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const ionFormula = (symbol: string, q: number) => (q === 0 ? symbol : Math.abs(q) === 1 ? `${symbol}${q > 0 ? "+" : "-"}` : `${symbol}^${Math.abs(q)}${q > 0 ? "+" : "-"}`);
const NOBLE_OF_PERIOD = ["", "He", "Ne", "Ar", "Kr", "Xe", "Rn"];

const EXTRA_SPELLINGS: Record<string, string[]> = { Ca: ["Kalzium"], Si: ["Silizium"], Al: ["aluminum"], S: ["sulphur"], I: ["Jod"], Cs: ["Cäsium", "cesium"] };
function accept(e: Element): Text[] {
  const a = resolveText(e.name, "en");
  const b = resolveText(e.name, "de");
  return [a === b ? a : e.name, e.symbol, ...(EXTRA_SPELLINGS[e.symbol] ?? [])];
}
const word = (e: Element): AnswerSpec => ({ kind: "word", accept: accept(e), placeholder: tx("name or symbol", "Name oder Symbol") });
const num = (value: number): AnswerSpec => ({ kind: "number", value });
const formula = (value: string): AnswerSpec => ({ kind: "formula", value });

// Typical mistakes, each kept only when it differs from the right answer and the others.
function asAnswer(a: AnswerSpec): AnswerValue | null {
  switch (a.kind) {
    case "number":
      return { kind: "text", text: String(a.value) };
    case "choice":
      return { kind: "choice", index: a.correct };
    case "multi":
      return { kind: "multi", indices: a.correct };
    case "pair":
      return { kind: "list", values: a.values.map(String) };
    case "formula":
      return { kind: "text", text: a.value };
    case "word":
      return { kind: "text", text: resolveText(a.accept[0], "de") };
    default:
      return null;
  }
}
function mistakes(right: AnswerSpec) {
  const list: Mistake[] = [];
  const add = (when: AnswerSpec, title: Text, say: Text, close?: boolean) => {
    const v = asAnswer(when);
    if (!v || check(right, v).correct) return;
    if (list.some((m) => check(m.when, v).correct)) return;
    list.push(close ? { when, title, say, close } : { when, title, say });
  };
  return { list, add };
}

type Opt = { text: Text; title?: Text; say?: Text };
/** Options with the right one first; shuffled when an rng is given. Wrong options with `say` become mistakes. */
function choice(rng: Rng | null, opts: Opt[]) {
  const order = rng ? rng.shuffle(opts.map((_, i) => i)) : opts.map((_, i) => i);
  const options = order.map((i) => opts[i].text);
  const correct = order.indexOf(0);
  const list: Mistake[] = [];
  order.forEach((i, pos) => {
    if (i !== 0 && opts[i].say) list.push({ when: { kind: "choice", options, correct: pos }, title: opts[i].title, say: opts[i].say! });
  });
  return { answer: { kind: "choice", options, correct } as AnswerSpec, mistakes: list };
}

const shellsSrc = (z: number, hl = true) => {
  const s = shells(z);
  return s.map((c, i) => (hl && i === s.length - 1 ? `\\hl{${c}}` : `${c}`)).join(", ");
};

/** Main-group elements (no hydrogen) up to a period. */
const mainElements = (maxPeriod: number) => ELEMENTS.filter((e) => e.period <= maxPeriod && mainGroup(e) !== null && e.z > 1);

// ---------------------------------------------------------------------------
// Position ↔ element

function positionTask(rng: Rng, maxPeriod: number): Exercise {
  const e = rng.pick(mainElements(maxPeriod).filter((x) => x.z > 2));
  const p = e.period;
  const g = mg(e);
  const m = mistakes(word(e));
  const swapped = g <= Math.max(4, maxPeriod) ? at(g, p) : undefined;
  if (swapped)
    m.add(
      word(swapped),
      tx("Period and group swapped", "Periode und Gruppe vertauscht"),
      tx(`You went to period ${g} and main group ${ROMAN[p]}. The period is the **row**, the main group the **column**.`, `Du bist in die ${g}. Periode und die ${ROMAN[p]}. Hauptgruppe gegangen. Die Periode ist die **Zeile**, die Hauptgruppe die **Spalte**.`),
    );
  const up = at(p - 1, g);
  if (up)
    m.add(
      word(up),
      tx("One row off", "Eine Zeile verrutscht"),
      tx("Right column! Count the rows again: hydrogen and helium are period 1.", "Richtige Spalte! Zähl die Zeilen noch mal: Wasserstoff und Helium sind die 1. Periode."),
      true,
    );
  const down = at(p + 1, g);
  if (down && down.period <= Math.max(4, maxPeriod))
    m.add(
      word(down),
      tx("One row off", "Eine Zeile verrutscht"),
      tx("Right column! Count the rows again: hydrogen and helium are period 1.", "Richtige Spalte! Zähl die Zeilen noch mal: Wasserstoff und Helium sind die 1. Periode."),
      true,
    );
  return {
    instruction: tx("Find the element", "Finde das Element"),
    text: tx(`Which element is in period ${p}, main group ${ROMAN[g]}?`, `Welches Element steht in der ${p}. Periode und in der ${ROMAN[g]}. Hauptgruppe?`),
    visual: visual(LookupTable, { periods: Math.max(4, maxPeriod) }),
    answer: word(e),
    hint: tx("Periods are the rows (numbered on the left), main groups the columns (numbered on top).", "Perioden sind die Zeilen (links nummeriert), Hauptgruppen die Spalten (oben nummeriert)."),
    solution: [
      { math: tx(`"period" \\; ${p} \\quad "main group" \\; "${ROMAN[g]}"`, `"Periode" \\; ${p} \\quad "Hauptgruppe" \\; "${ROMAN[g]}"`), note: tx(`Go to row ${p} and column ${ROMAN[g]}.`, `Geh in Zeile ${p} und Spalte ${ROMAN[g]}.`) },
      {
        math: tx(`"period" \\; ${p} \\quad "main group" \\; "${ROMAN[g]}" \\Rightarrow \\ce{${e.symbol}}`, `"Periode" \\; ${p} \\quad "Hauptgruppe" \\; "${ROMAN[g]}" \\Rightarrow \\ce{${e.symbol}}`),
        note: tx(`Where they cross: **${enName(e)}**. Its atom has ${plEn(p, "shell")} and ${plEn(g, "outer electron")}.`, `Wo sie sich kreuzen: **${deName(e)}**. Sein Atom hat ${plDe(p, "Schale", "Schalen")} und ${plDe(g, "Außenelektron", "Außenelektronen")}.`),
      },
    ],
    mistakes: m.list,
  };
}

/** Shells and outer electrons read off the position. */
function shellsOuterExercise(e: Element, highlight: boolean): Exercise {
  const p = e.period;
  const g = mg(e);
  const right: AnswerSpec = { kind: "pair", names: [tx('"shells"', '"Schalen"'), tx('"outer electrons"', '"Außenelektronen"')], values: [p, g] };
  const pair = (a: number, b: number) => ({ ...right, values: [a, b] }) as AnswerSpec;
  const m = mistakes(right);
  m.add(pair(g, p), tx("Swapped", "Vertauscht"), tx("Swapped! The **period** (row) gives the shells, the **main group** (column) the outer electrons.", "Vertauscht! Die **Periode** (Zeile) verrät die Schalen, die **Hauptgruppe** (Spalte) die Außenelektronen."));
  m.add(pair(p, e.z), tx("All electrons counted", "Alle Elektronen gezählt"), tx("Your second number is the atomic number: all the electrons. Only the ones on the outer shell count, and the main group tells you how many.", "Deine zweite Zahl ist die Ordnungszahl, also alle Elektronen. Es zählen nur die auf der Außenschale, und die verrät die Hauptgruppe."));
  m.add(pair(p, 8 - g), tx("Counted the gaps", "Lücken gezählt"), tx("That's how many electrons are **missing** to make 8. The main group number tells you how many are there.", "So viele Elektronen **fehlen** bis zur 8. Die Nummer der Hauptgruppe sagt dir, wie viele da sind."));
  return {
    instruction: tx("Read it off the periodic table", "Lies es am Periodensystem ab"),
    text: tx(`How many shells and how many outer electrons does ${anAtom(e)} have?`, `Wie viele Schalen und wie viele Außenelektronen hat ein ${deAtom(e)}?`),
    visual: visual(LookupTable, { periods: Math.max(4, p), highlight: highlight ? [e.symbol] : [] }),
    answer: right,
    hint: tx("Period = number of shells. Main group = number of outer electrons.", "Periode = Anzahl der Schalen. Hauptgruppe = Anzahl der Außenelektronen."),
    solution: [
      { math: tx(`\\ce{${e.symbol}} \\quad "period" \\; ${p}#p \\quad "main group" \\; "${ROMAN[g]}"#g`, `\\ce{${e.symbol}} \\quad "Periode" \\; ${p}#p \\quad "Hauptgruppe" \\; "${ROMAN[g]}"#g`), note: tx(`Find ${enName(e)}: period ${p}, main group ${ROMAN[g]}.`, `Such ${deName(e)}: ${p}. Periode, ${ROMAN[g]}. Hauptgruppe.`) },
      {
        math: tx(`${p}#p "${p === 1 ? "shell" : "shells"}" \\quad ${g}#g "outer ${g === 1 ? "electron" : "electrons"}"`, `${p}#p "${p === 1 ? "Schale" : "Schalen"}" \\quad ${g}#g "${g === 1 ? "Außenelektron" : "Außenelektronen"}"`),
        note: tx("Period = shells, main group = outer electrons.", "Periode = Schalen, Hauptgruppe = Außenelektronen."),
      },
      { math: `\\ce{${e.symbol}} \\quad ${shellsSrc(e.z)}`, note: tx(`Check with the shell model: ${shells(e.z).join(", ")}.`, `Probe mit dem Schalenmodell: ${shells(e.z).join(", ")}.`) },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Families, metals and nonmetals

type Family = "alkali" | "alkaline-earth" | "halogen" | "noble-gas";
const FAMILIES: Record<Family, { group: number; members: string[] }> = {
  alkali: { group: 1, members: ["Li", "Na", "K", "Rb", "Cs"] },
  "alkaline-earth": { group: 2, members: ["Be", "Mg", "Ca", "Sr", "Ba"] },
  halogen: { group: 7, members: ["F", "Cl", "Br", "I"] },
  "noble-gas": { group: 8, members: ["He", "Ne", "Ar", "Kr", "Xe"] },
};
const famName = (f: Family, l: "en" | "de") => resolveText(CATEGORY_NAMES[f as Category], l);

function familyTask(rng: Rng): Exercise {
  const fam = rng.pick(Object.keys(FAMILIES) as Family[]);
  const e = el(rng.pick(FAMILIES[fam].members));
  const others = (Object.keys(FAMILIES) as Family[]).filter((f) => f !== fam);
  const say = (f: Family): Text => {
    const mix = (fam === "alkali" && f === "alkaline-earth") || (fam === "alkaline-earth" && f === "alkali");
    return mix
      ? tx("Easy to mix up! Alkali metals are main group I, alkaline earth metals main group II. Which column is it in?", "Leicht zu verwechseln! Alkalimetalle sind die I. Hauptgruppe, Erdalkalimetalle die II. In welcher Spalte steht es?")
      : tx(`The ${famName(f, "en").toLowerCase()} are in main group ${ROMAN[FAMILIES[f].group]}. Check which column ${enName(e)} is in.`, `Die ${famName(f, "de")} sind die ${ROMAN[FAMILIES[f].group]}. Hauptgruppe. Schau, in welcher Spalte ${deName(e)} steht.`);
  };
  const c = choice(rng, [{ text: CATEGORY_NAMES[fam as Category] }, ...others.map((f) => ({ text: CATEGORY_NAMES[f as Category], title: tx("Wrong column", "Falsche Spalte"), say: say(f) }))]);
  const g = FAMILIES[fam].group;
  return {
    instruction: tx("Name the family", "Nenne die Elementfamilie"),
    text: tx(`Which family does ${enName(e)} belong to?`, `Zu welcher Elementfamilie gehört ${deName(e)}?`),
    visual: visual(LookupTable, { periods: 6, highlight: [e.symbol] }),
    answer: c.answer,
    hint: tx("Families are columns: I alkali metals, II alkaline earth metals, VII halogens, VIII noble gases.", "Familien sind Spalten: I Alkalimetalle, II Erdalkalimetalle, VII Halogene, VIII Edelgase."),
    solution: [
      {
        math: tx(`\\ce{${e.symbol}} \\Rightarrow "main group ${ROMAN[g]}" \\Rightarrow "${famName(fam, "en").toLowerCase()}"`, `\\ce{${e.symbol}} \\Rightarrow "Hauptgruppe ${ROMAN[g]}" \\Rightarrow "${famName(fam, "de")}"`),
        note: tx(`${resolveText(e.name, "en")} is in main group ${ROMAN[g]}: the **${famName(fam, "en").toLowerCase()}**.`, `${deName(e)} steht in der ${ROMAN[g]}. Hauptgruppe: bei den **${famName(fam, "de")}n**.`),
      },
    ],
    mistakes: c.mistakes,
  };
}

const METALS = ["Li", "Na", "K", "Rb", "Cs", "Mg", "Ca", "Sr", "Ba", "Al", "Sn", "Pb", "Bi"];
const NONMETALS = ["H", "C", "N", "O", "F", "P", "S", "Cl", "Se", "Br", "I", "He", "Ne", "Ar", "Kr", "Xe"];
const METALLOIDS = ["B", "Si", "Ge", "As", "Sb", "Te"];

function metalTask(rng: Rng): Exercise {
  const kind = rng.pick(["metal", "metal", "nonmetal", "nonmetal", "metalloid"] as const);
  const e = el(rng.pick(kind === "metal" ? METALS : kind === "nonmetal" ? NONMETALS : METALLOIDS));
  const opts = { metal: tx("a metal", "ein Metall"), metalloid: tx("a metalloid", "ein Halbmetall"), nonmetal: tx("a nonmetal", "ein Nichtmetall") };
  const order = ["metal", "metalloid", "nonmetal"] as const;
  const options = order.map((k) => opts[k]);
  const correct = order.indexOf(kind);
  const say = (picked: (typeof order)[number]): Text => {
    if (kind === "metalloid") return tx(`Look closely: ${enName(e)} sits right on the staircase between the metals and the nonmetals.`, `Schau genau hin: ${deName(e)} steht direkt an der Treppe zwischen Metallen und Nichtmetallen.`);
    if (picked === "metalloid") return tx("Metalloids only sit on the staircase: boron, silicon, germanium, arsenic, antimony, tellurium.", "Halbmetalle stehen nur an der Treppe: Bor, Silicium, Germanium, Arsen, Antimon, Tellur.");
    if (picked === "nonmetal") return tx(`Nonmetals are only at the top right (plus hydrogen). Look where ${enName(e)} is.`, `Nichtmetalle stehen nur oben rechts (dazu Wasserstoff). Schau, wo ${deName(e)} steht.`);
    return tx(`Metals are on the left and at the bottom. Look where ${enName(e)} is.`, `Metalle stehen links und unten. Schau, wo ${deName(e)} steht.`);
  };
  const list: Mistake[] = order.flatMap((k, i) => (k === kind ? [] : [{ when: { kind: "choice", options, correct: i } as AnswerSpec, title: tx("Look at the position", "Schau auf die Stelle"), say: say(k) }]));
  const why = {
    metal: tx("left or at the bottom: a **metal**. It shines and conducts electricity and heat.", "links oder unten: ein **Metall**. Es glänzt und leitet Strom und Wärme."),
    nonmetal: tx("at the top right: a **nonmetal**. Nonmetals hardly conduct electricity; many are gases.", "oben rechts: ein **Nichtmetall**. Nichtmetalle leiten Strom kaum, viele sind Gase."),
    metalloid: tx("on the staircase: a **metalloid**, with some metal and some nonmetal properties.", "an der Treppe: ein **Halbmetall**, mit Eigenschaften von Metallen und Nichtmetallen."),
  }[kind];
  const whyH = e.symbol === "H" ? tx("Hydrogen is the exception in main group I: a **nonmetal**, a gas.", "Wasserstoff ist die Ausnahme in der I. Hauptgruppe: ein **Nichtmetall**, ein Gas.") : null;
  return {
    instruction: tx("Metal or nonmetal?", "Metall oder Nichtmetall?"),
    text: tx(`Is ${enName(e)} a metal, a metalloid or a nonmetal?`, `Ist ${deName(e)} ein Metall, ein Halbmetall oder ein Nichtmetall?`),
    visual: visual(LookupTable, { periods: 6, highlight: [e.symbol] }),
    answer: { kind: "choice", options, correct },
    hint: tx("Metals: left and bottom. Nonmetals: top right. Metalloids: on the staircase in between.", "Metalle: links und unten. Nichtmetalle: oben rechts. Halbmetalle: an der Treppe dazwischen."),
    solution: [
      {
        math: tx(`\\ce{${e.symbol}} \\Rightarrow "${resolveText(opts[kind], "en").replace(/^an? /, "")}"`, `\\ce{${e.symbol}} \\Rightarrow "${resolveText(opts[kind], "de").replace(/^ein /, "")}"`),
        note: whyH ?? tx(`${resolveText(e.name, "en")} is ${resolveText(why, "en")}`, `${deName(e)} steht ${resolveText(why, "de")}`),
      },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Noble gas configuration

const ION_FORMERS = ["Li", "Na", "K", "Rb", "Mg", "Ca", "Sr", "Ba", "Al", "N", "P", "O", "S", "F", "Cl", "Br", "I"];
const isMetalSide = (e: Element) => mg(e) <= 3;
const ionCharge = (e: Element) => (isMetalSide(e) ? mg(e) : -(8 - mg(e)));

function ionFromGroupTask(rng: Rng): Exercise {
  const e = el(rng.pick(ION_FORMERS));
  const g = mg(e);
  const q = ionCharge(e);
  const k = Math.abs(q);
  const f = ionFormula(e.symbol, q);
  const m = mistakes(formula(f));
  m.add(
    formula(ionFormula(e.symbol, -q)),
    tx("Charge sign flipped", "Vorzeichen vertauscht"),
    q > 0
      ? tx("Nearly! Giving away electrons (they're negative) leaves a **positive** ion.", "Fast! Wer Elektronen abgibt (die sind negativ), wird zum **positiven** Ion.")
      : tx("Nearly! Taking up electrons (they're negative) makes a **negative** ion.", "Fast! Wer Elektronen aufnimmt (die sind negativ), wird zum **negativen** Ion."),
  );
  if (q > 0)
    m.add(
      formula(ionFormula(e.symbol, -(8 - g))),
      tx("The long way", "Der lange Weg"),
      tx(`On paper that works, but taking up ${8 - g} electrons is far harder than giving away ${g}. Metals give away their few outer electrons.`, `Auf dem Papier geht das, aber ${8 - g} Elektronen aufzunehmen ist viel schwerer, als ${g} abzugeben. Metalle geben ihre wenigen Außenelektronen ab.`),
    );
  else {
    m.add(
      formula(ionFormula(e.symbol, g)),
      tx("The long way", "Der lange Weg"),
      tx(`On paper that works, but giving away ${g} electrons is far harder than taking up ${8 - g}. Nonmetals fill their outer shell.`, `Auf dem Papier geht das, aber ${g} Elektronen abzugeben ist viel schwerer, als ${8 - g} aufzunehmen. Nichtmetalle füllen ihre Außenschale auf.`),
    );
    m.add(
      formula(ionFormula(e.symbol, -g)),
      tx("Charge isn't the group number", "Ladung ≠ Gruppennummer"),
      tx(`The charge isn't the main group number. ${resolveText(e.name, "en")} has ${g} outer electrons: how many are missing to reach 8?`, `Die Ladung ist nicht die Nummer der Hauptgruppe. ${deName(e)} hat ${g} Außenelektronen: Wie viele fehlen bis zur 8?`),
    );
  }
  if (k >= 2)
    m.add(
      formula(`${e.symbol}${k}${q > 0 ? "+" : "-"}`),
      tx("Write the charge with ^", "Ladung mit ^ schreiben"),
      tx(`Almost! Without the ^ the ${k} becomes a small index and means ${k} atoms. Put a ^ in front of the charge.`, `Fast! Ohne das ^ wird die ${k} zum kleinen Index und bedeutet ${k} Atome. Setz ein ^ vor die Ladung.`),
      true,
    );
  m.add(
    formula(e.symbol),
    tx("Charge missing", "Ladung fehlt"),
    tx("That's the neutral atom. Once electrons are given away or taken up, the particle carries a charge.", "Das ist das neutrale Atom. Sobald Elektronen abgegeben oder aufgenommen werden, trägt das Teilchen eine Ladung."),
    true,
  );
  const noble = q > 0 ? NOBLE_OF_PERIOD[e.period - 1] : NOBLE_OF_PERIOD[e.period];
  const eq = q > 0 ? eqn(`${e.symbol} -> ${f} + ${k > 1 ? k : ""}e-`) : eqn(`${e.symbol} + ${k > 1 ? k : ""}e- -> ${f}`);
  return {
    instruction: tx("Write the ion", "Schreib das Ion"),
    text: tx(
      `${resolveText(e.name, "en")} reaches the noble gas configuration by forming an ion. Which ion? Write its symbol with the charge.`,
      `${deName(e)} erreicht die Edelgaskonfiguration, indem es ein Ion bildet. Welches Ion? Schreib sein Symbol mit Ladung.`,
    ),
    visual: visual(LookupTable, { periods: Math.max(4, e.period), highlight: [e.symbol] }),
    answer: formula(f),
    hint: tx("Main group I to III: give away the outer electrons. Main group V to VII: take up electrons until there are 8. Type a charge like ^2+ or ^-.", "Hauptgruppe I bis III: Außenelektronen abgeben. Hauptgruppe V bis VII: Elektronen aufnehmen, bis es 8 sind. Tipp eine Ladung wie ^2+ oder ^-."),
    solution: [
      { math: `\\ce{${e.symbol}} \\quad ${shellsSrc(e.z)}`, note: tx(`Main group ${ROMAN[g]}: ${plEn(g, "outer electron")}.`, `${ROMAN[g]}. Hauptgruppe: ${plDe(g, "Außenelektron", "Außenelektronen")}.`) },
      {
        math: eq,
        note:
          q > 0
            ? tx(`Giving away ${k} is easier than taking up ${8 - g}. That leaves a ${k}+ charge.`, `${k} abzugeben ist leichter, als ${8 - g} aufzunehmen. Übrig bleibt die Ladung ${k}+.`)
            : tx(`Taking up ${k} is easier than giving away ${g}. That makes a ${k}− charge.`, `${k} aufzunehmen ist leichter, als ${g} abzugeben. Das ergibt die Ladung ${k}−.`),
      },
      { math: `\\ce{${f}} \\quad ${shellsSrc(e.z - q, false)}`, note: tx(`$\\ce{${f}}$ has the electron arrangement of ${noble}: noble gas configuration.`, `$\\ce{${f}}$ hat die Elektronenverteilung von ${noble}: Edelgaskonfiguration.`) },
    ],
    mistakes: m.list,
  };
}

/** How many electrons are given away (metals) or taken up (nonmetals)? */
function electronsMovedExercise(e: Element): Exercise {
  const g = mg(e);
  const metal = isMetalSide(e);
  const value = metal ? g : 8 - g;
  const m = mistakes(num(value));
  if (metal) {
    m.add(num(8 - g), tx("That's the other way", "Das ist der andere Weg"), tx(`That's how many it would have to **take up** to reach 8. Metals go the short way: they give away their outer electrons.`, `So viele müsste es **aufnehmen**, um auf 8 zu kommen. Metalle nehmen den kurzen Weg: Sie geben ihre Außenelektronen ab.`));
  } else {
    m.add(num(g), tx("Those are its outer electrons", "Das sind seine Außenelektronen"), tx("That's how many outer electrons it has. How many are **missing** to make 8?", "So viele Außenelektronen hat es. Wie viele **fehlen** bis zur 8?"));
  }
  m.add(num(8), tx("8 is the goal", "8 ist das Ziel"), tx("8 is the goal on the outer shell, not the number of electrons that move.", "8 ist das Ziel auf der Außenschale, nicht die Zahl der Elektronen, die wandern."));
  m.add(num(e.z), tx("All electrons", "Alle Elektronen"), tx("That's all its electrons. Only the outer shell changes.", "Das sind alle seine Elektronen. Es ändert sich nur die Außenschale."));
  m.add(num(e.period), tx("That's the period", "Das ist die Periode"), tx("That's the period, the number of shells. The main group tells you the outer electrons.", "Das ist die Periode, also die Zahl der Schalen. Die Außenelektronen verrät die Hauptgruppe."));
  return {
    instruction: tx("Count the electrons", "Zähle die Elektronen"),
    text: metal
      ? tx(`How many electrons does ${anAtom(e)} give away to reach the noble gas configuration?`, `Wie viele Elektronen gibt ein ${deAtom(e)} ab, um die Edelgaskonfiguration zu erreichen?`)
      : tx(`How many electrons does ${anAtom(e)} take up to reach the noble gas configuration?`, `Wie viele Elektronen nimmt ein ${deAtom(e)} auf, um die Edelgaskonfiguration zu erreichen?`),
    visual: visual(LookupTable, { periods: Math.max(4, e.period), highlight: [e.symbol] }),
    answer: num(value),
    hint: metal
      ? tx("The main group tells you its outer electrons. Those are the ones it gives away.", "Die Hauptgruppe verrät die Außenelektronen. Genau die gibt es ab.")
      : tx("The main group tells you its outer electrons. How many are missing to make 8?", "Die Hauptgruppe verrät die Außenelektronen. Wie viele fehlen bis zur 8?"),
    solution: [
      { math: `\\ce{${e.symbol}} \\quad ${shellsSrc(e.z)}`, note: tx(`Main group ${ROMAN[g]}: ${plEn(g, "outer electron")}.`, `${ROMAN[g]}. Hauptgruppe: ${plDe(g, "Außenelektron", "Außenelektronen")}.`) },
      metal
        ? { math: eqn(`${e.symbol} -> ${ionFormula(e.symbol, g)} + ${g > 1 ? g : ""}e-`), note: tx(`It gives away **${g}**. Then the shell below is the outer shell, and it's full.`, `Es gibt **${g}** ab. Dann ist die Schale darunter die Außenschale, und die ist voll.`) }
        : { math: eqn(`${e.symbol} + ${8 - g > 1 ? 8 - g : ""}e- -> ${ionFormula(e.symbol, -(8 - g))}`), note: tx(`$8 - ${g} = ${8 - g}$: it takes up **${8 - g}**, and the outer shell is full.`, `$8 - ${g} = ${8 - g}$: Es nimmt **${8 - g}** auf, dann ist die Außenschale voll.`) },
    ],
    mistakes: m.list,
  };
}

function nobleReachedTask(rng: Rng): Exercise {
  const e = el(rng.pick(ION_FORMERS));
  const metal = isMetalSide(e);
  const noble = el(metal ? NOBLE_OF_PERIOD[e.period - 1] : NOBLE_OF_PERIOD[e.period]);
  const other = el(metal ? NOBLE_OF_PERIOD[e.period] : NOBLE_OF_PERIOD[e.period - 1]);
  const m = mistakes(word(noble));
  m.add(
    word(other),
    metal ? tx("The ion lost a shell", "Das Ion hat eine Schale weniger") : tx("No shell gets lost", "Keine Schale geht verloren"),
    metal
      ? tx("Giving away the outer electrons empties the outer shell: the ion has one shell less. Look at the noble gas one period **up**.", "Gibt das Atom seine Außenelektronen ab, ist die Außenschale leer: Das Ion hat eine Schale weniger. Schau beim Edelgas eine Periode **höher**.")
      : tx("Taking up electrons doesn't remove a shell: the atom fills its last shell. Look at the noble gas of its **own** period.", "Beim Aufnehmen geht keine Schale verloren: Das Atom füllt seine letzte Schale auf. Schau beim Edelgas der **eigenen** Periode."),
  );
  if (metal && noble.symbol !== "He")
    m.add(
      word(el("He")),
      tx("Helium has one shell", "Helium hat nur eine Schale"),
      tx("Helium has a full shell, but only one. Count how many shells the ion still has.", "Helium hat eine volle Schale, aber nur eine. Zähl, wie viele Schalen das Ion noch hat."),
    );
  return {
    instruction: tx("Name the noble gas", "Nenne das Edelgas"),
    text: metal
      ? tx(`${anAtom(e).replace(/^a/, "A")} gives away its outer electrons. Which noble gas does its electron arrangement match then?`, `Ein ${deAtom(e)} gibt seine Außenelektronen ab. Welchem Edelgas gleicht seine Elektronenverteilung dann?`)
      : tx(`${anAtom(e).replace(/^a/, "A")} takes up electrons until its outer shell is full. Which noble gas does its electron arrangement match then?`, `Ein ${deAtom(e)} nimmt Elektronen auf, bis seine Außenschale voll ist. Welchem Edelgas gleicht seine Elektronenverteilung dann?`),
    visual: visual(LookupTable, { periods: Math.max(4, e.period), highlight: [e.symbol] }),
    answer: word(noble),
    hint: tx("Write down the shells before and after. Which noble gas has exactly those?", "Schreib die Schalen vorher und nachher auf. Welches Edelgas hat genau diese?"),
    solution: [
      { math: `\\ce{${e.symbol}} \\quad ${shellsSrc(e.z)}`, note: tx(`${resolveText(e.name, "en")} has the shells ${shells(e.z).join(", ")}.`, `${deName(e)} hat die Schalen ${shells(e.z).join(", ")}.`) },
      {
        math: `\\ce{${ionFormula(e.symbol, ionCharge(e))}} \\quad ${shellsSrc(noble.z, false)} \\quad \\ce{${noble.symbol}} \\quad ${shellsSrc(noble.z, false)}`,
        note: tx(`After that: ${shells(noble.z).join(", ")}. Exactly like **${enName(noble)}**.`, `Danach: ${shells(noble.z).join(", ")}. Genau wie **${deName(noble)}**.`),
      },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Trends (choice)

type TrendQ = (rng: Rng) => { q: Text; hint: Text; opts: Opt[]; frame: Frame };

/** Pick k members of a list, keep their order (top to bottom). */
function someOf(rng: Rng, list: string[], k: number) {
  const picked = new Set(rng.shuffle(list).slice(0, k));
  return list.filter((s) => picked.has(s)).map(el);
}

const TRENDS_BASIC: TrendQ[] = [
  (rng) => {
    const xs = someOf(rng, FAMILIES.alkali.members, 3);
    const best = xs[xs.length - 1];
    return {
      q: tx("Which alkali metal reacts most violently with water?", "Welches Alkalimetall reagiert am heftigsten mit Wasser?"),
      hint: tx("Think about where the single outer electron is: close to the nucleus or far away?", "Denk daran, wo das einzige Außenelektron sitzt: nah am Kern oder weit weg?"),
      opts: [
        { text: symName(best) },
        ...xs.slice(0, -1).map((x, i) => ({
          text: symName(x),
          title: i === 0 ? tx("Trend the wrong way round", "Trend falsch herum") : tx("Not the lowest one", "Nicht das unterste"),
          say:
            i === 0
              ? tx("The other way round! Reactivity of the alkali metals **increases** from top to bottom.", "Andersherum! Die Reaktionsfähigkeit der Alkalimetalle **nimmt** von oben nach unten **zu**.")
              : tx("Good direction, but one of the others is even further down. Reactivity keeps increasing downwards.", "Gute Richtung, aber eins der anderen steht noch weiter unten. Die Reaktionsfähigkeit nimmt nach unten weiter zu."),
        })),
      ],
      frame: { math: xs.map((x) => `\\ce{${x.symbol}}`).join(" < "), note: tx("Further down: more shells, the outer electron is further from the nucleus and leaves more easily.", "Weiter unten: mehr Schalen, das Außenelektron ist weiter vom Kern weg und geht leichter ab.") },
    };
  },
  (rng) => {
    const xs = someOf(rng, FAMILIES.halogen.members, 3);
    const best = xs[0];
    return {
      q: tx("Which halogen is the most reactive?", "Welches Halogen ist am reaktionsfähigsten?"),
      hint: tx("Halogens take up one electron. Where is that easiest: close to the nucleus or far away?", "Halogene nehmen ein Elektron auf. Wo klappt das am besten: nah am Kern oder weit weg?"),
      opts: [
        { text: symName(best) },
        ...xs.slice(1).map((x) => ({
          text: symName(x),
          title: tx("Halogens go the other way", "Halogene laufen andersherum"),
          say: tx("For halogens it's the other way round than for alkali metals: reactivity **decreases** from top to bottom.", "Bei den Halogenen ist es andersherum als bei den Alkalimetallen: Die Reaktionsfähigkeit **nimmt** von oben nach unten **ab**."),
        })),
      ],
      frame: { math: xs.map((x) => `\\ce{${x.symbol}}`).join(" > "), note: tx("Small atoms pull an extra electron in most strongly: the topmost halogen is the most reactive.", "Kleine Atome ziehen ein zusätzliches Elektron am stärksten an: Das oberste Halogen ist am reaktionsfähigsten.") },
    };
  },
  (rng) => {
    const xs = someOf(rng, FAMILIES["alkaline-earth"].members, 3);
    const best = xs[xs.length - 1];
    return {
      q: tx("Which alkaline earth metal reacts most violently with water?", "Welches Erdalkalimetall reagiert am heftigsten mit Wasser?"),
      hint: tx("It works like with the alkali metals.", "Es läuft wie bei den Alkalimetallen."),
      opts: [
        { text: symName(best) },
        ...xs.slice(0, -1).map((x) => ({ text: symName(x), title: tx("Further down is faster", "Weiter unten geht's heftiger"), say: tx("Reactivity of the alkaline earth metals **increases** from top to bottom, just like with the alkali metals.", "Die Reaktionsfähigkeit der Erdalkalimetalle **nimmt** von oben nach unten **zu**, genau wie bei den Alkalimetallen.") })),
      ],
      frame: { math: xs.map((x) => `\\ce{${x.symbol}}`).join(" < "), note: tx("Further down, the 2 outer electrons are further from the nucleus and are given away more easily.", "Weiter unten sind die 2 Außenelektronen weiter vom Kern weg und werden leichter abgegeben.") },
    };
  },
  (rng) => {
    const fam = rng.pick(["alkali", "alkaline-earth", "halogen", "noble-gas"] as Family[]);
    const xs = someOf(rng, FAMILIES[fam].members, 3);
    const best = xs[xs.length - 1];
    return {
      q: tx("Which of these atoms is the largest?", "Welches dieser Atome ist am größten?"),
      hint: tx("All three are in the same main group. Which one has the most shells?", "Alle drei stehen in derselben Hauptgruppe. Welches hat die meisten Schalen?"),
      opts: [{ text: symName(best) }, ...xs.slice(0, -1).map((x) => ({ text: symName(x), title: tx("More shells, bigger atom", "Mehr Schalen, größeres Atom"), say: tx("Further down a main group, each atom has one more shell. More shells make a bigger atom.", "Weiter unten in einer Hauptgruppe hat jedes Atom eine Schale mehr. Mehr Schalen machen das Atom größer.") }))],
      frame: { math: xs.map((x) => `\\ce{${x.symbol}}`).join(" < "), note: tx("Down a main group the atoms get bigger: one more shell per period.", "In einer Hauptgruppe werden die Atome nach unten größer: pro Periode eine Schale mehr.") },
    };
  },
  () => ({
    q: tx("Which halogen is a liquid at room temperature?", "Welches Halogen ist bei Raumtemperatur flüssig?"),
    hint: tx("Melting and boiling points rise from top to bottom: gas, gas, liquid, solid.", "Schmelz- und Siedetemperaturen steigen von oben nach unten: Gas, Gas, flüssig, fest."),
    opts: [
      { text: tx("$\\ce{Br2}$ (bromine)", "$\\ce{Br2}$ (Brom)") },
      { text: tx("$\\ce{I2}$ (iodine)", "$\\ce{I2}$ (Iod)"), title: tx("Iodine is a solid", "Iod ist fest"), say: tx("Iodine is a solid at room temperature: grey-black crystals that give a violet vapour.", "Iod ist bei Raumtemperatur fest: grauschwarze Kristalle mit violettem Dampf.") },
      { text: tx("$\\ce{Cl2}$ (chlorine)", "$\\ce{Cl2}$ (Chlor)"), title: tx("Chlorine is a gas", "Chlor ist ein Gas"), say: tx("Chlorine is a yellow-green gas at room temperature.", "Chlor ist bei Raumtemperatur ein gelbgrünes Gas.") },
      { text: tx("$\\ce{F2}$ (fluorine)", "$\\ce{F2}$ (Fluor)"), title: tx("Fluorine is a gas", "Fluor ist ein Gas"), say: tx("Fluorine is a pale yellow gas, the lightest halogen.", "Fluor ist ein blassgelbes Gas, das leichteste Halogen.") },
    ],
    frame: {
      math: tx('\\ce{F2}, \\ce{Cl2} \\; "gas" \\quad \\hl{\\ce{Br2} \\; "liquid"} \\quad \\ce{I2} \\; "solid"', '\\ce{F2}, \\ce{Cl2} \\; "gasförmig" \\quad \\hl{\\ce{Br2} \\; "flüssig"} \\quad \\ce{I2} \\; "fest"'),
      note: tx("Bromine is a red-brown liquid. The only liquid nonmetal at room temperature!", "Brom ist eine rotbraune Flüssigkeit. Das einzige flüssige Nichtmetall bei Raumtemperatur!"),
    },
  }),
  (rng) => {
    const xs = someOf(rng, FAMILIES.alkali.members, 3);
    const best = xs[xs.length - 1];
    return {
      q: tx("Which of these alkali metals has the lowest melting point?", "Welches dieser Alkalimetalle hat die niedrigste Schmelztemperatur?"),
      hint: tx("Melting points of the alkali metals change steadily down the group.", "Die Schmelztemperaturen der Alkalimetalle ändern sich gleichmäßig in der Gruppe."),
      opts: [{ text: symName(best) }, ...xs.slice(0, -1).map((x) => ({ text: symName(x), title: tx("Trend the wrong way round", "Trend falsch herum"), say: tx("The melting points of the alkali metals **decrease** from top to bottom. Caesium would melt in your hand!", "Die Schmelztemperaturen der Alkalimetalle **sinken** von oben nach unten. Caesium würde schon in der Hand schmelzen!") }))],
      frame: { math: tx('\\group{\\ce{Li} \\; 181 "°C"} \\quad \\group{\\ce{Na} \\; 98 "°C"} \\quad \\group{\\ce{K} \\; 63 "°C"} \\quad \\group{\\ce{Rb} \\; 39 "°C"} \\quad \\group{\\ce{Cs} \\; 28 "°C"}', '\\group{\\ce{Li} \\; 181 "°C"} \\quad \\group{\\ce{Na} \\; 98 "°C"} \\quad \\group{\\ce{K} \\; 63 "°C"} \\quad \\group{\\ce{Rb} \\; 39 "°C"} \\quad \\group{\\ce{Cs} \\; 28 "°C"}'), note: tx("The further down, the lower the melting point.", "Je weiter unten, desto niedriger die Schmelztemperatur.") },
    };
  },
  () => ({
    q: tx("Why do noble gases hardly react?", "Warum reagieren Edelgase kaum?"),
    hint: tx("Look at their outer shell.", "Schau auf ihre Außenschale."),
    opts: [
      { text: tx("Their outer shell is already full.", "Ihre Außenschale ist schon voll.") },
      { text: tx("They have no electrons.", "Sie haben keine Elektronen."), title: tx("They do have electrons", "Elektronen haben sie schon"), say: tx("Noble gases have electrons like every atom. The point is how they're arranged.", "Edelgase haben Elektronen wie jedes Atom. Entscheidend ist, wie sie verteilt sind.") },
      { text: tx("They are metals.", "Sie sind Metalle."), title: tx("Noble gases are nonmetals", "Edelgase sind Nichtmetalle"), say: tx("Noble gases are nonmetals at the far right of the table.", "Edelgase sind Nichtmetalle ganz rechts im Periodensystem.") },
      { text: tx("Their atoms are especially heavy.", "Ihre Atome sind besonders schwer."), title: tx("Mass doesn't matter here", "Die Masse ist egal"), say: tx("Helium is one of the lightest atoms of all, and it doesn't react either. It's about the outer shell.", "Helium ist eines der leichtesten Atome überhaupt und reagiert trotzdem nicht. Es geht um die Außenschale.") },
    ],
    frame: { math: "\\ce{He} \\; \\hl{2} \\quad \\ce{Ne} \\; 2, \\hl{8} \\quad \\ce{Ar} \\; 2, 8, \\hl{8}", note: tx("A full outer shell is very stable: noble gases have no reason to give away or take up electrons.", "Eine volle Außenschale ist sehr stabil: Edelgase haben keinen Grund, Elektronen abzugeben oder aufzunehmen.") },
  }),
];

const TRENDS_HARD: TrendQ[] = [
  (rng) => {
    const xs = someOf(rng, ["Na", "Mg", "Al", "Si", "P", "S", "Cl"], 3);
    return {
      q: tx("These atoms are all in period 3. Which one is the largest?", "Diese Atome stehen alle in der 3. Periode. Welches ist am größten?"),
      hint: tx("Same number of shells. What changes from left to right?", "Gleich viele Schalen. Was ändert sich von links nach rechts?"),
      opts: [
        { text: symName(xs[0]) },
        ...xs.slice(1).map((x) => ({ text: symName(x), title: tx("Smaller to the right", "Nach rechts kleiner"), say: tx("Along a period the atoms get **smaller**: more protons pull the same shells closer to the nucleus.", "Innerhalb einer Periode werden die Atome nach rechts **kleiner**: Mehr Protonen ziehen dieselben Schalen näher an den Kern.") })),
      ],
      frame: { math: xs.map((x) => `\\ce{${x.symbol}}`).join(" > "), note: tx("Same shells, but more and more protons in the nucleus: the atoms shrink from left to right.", "Gleiche Schalen, aber immer mehr Protonen im Kern: Die Atome schrumpfen von links nach rechts.") },
    };
  },
  () => ({
    q: tx("Rubidium is below potassium. How does it react with water?", "Rubidium steht unter Kalium. Wie reagiert es mit Wasser?"),
    hint: tx("Same main group, same behaviour, and the trend goes on.", "Gleiche Hauptgruppe, gleiches Verhalten, und der Trend setzt sich fort."),
    opts: [
      { text: tx("even more violently than potassium", "noch heftiger als Kalium") },
      { text: tx("more calmly than potassium", "ruhiger als Kalium"), title: tx("Trend the wrong way round", "Trend falsch herum"), say: tx("Down the alkali metals, reactivity **increases**. Rubidium is further down than potassium.", "Bei den Alkalimetallen nimmt die Reaktionsfähigkeit nach unten **zu**. Rubidium steht weiter unten als Kalium.") },
      { text: tx("not at all, like a noble gas", "gar nicht, wie ein Edelgas"), title: tx("It's an alkali metal", "Es ist ein Alkalimetall"), say: tx("Rubidium has 1 outer electron, like all alkali metals. It's far from a full outer shell.", "Rubidium hat 1 Außenelektron, wie alle Alkalimetalle. Von einer vollen Außenschale ist es weit entfernt.") },
    ],
    frame: { math: "\\ce{Li} < \\ce{Na} < \\ce{K} < \\hl{\\ce{Rb}} < \\ce{Cs}", note: tx("Rubidium reacts even more violently than potassium: it explodes in water. Same main group, same reaction, stronger trend.", "Rubidium reagiert noch heftiger als Kalium: Es explodiert im Wasser. Gleiche Hauptgruppe, gleiche Reaktion, stärkerer Trend.") },
  }),
  () => ({
    q: tx("Why does potassium react more violently with water than sodium?", "Warum reagiert Kalium heftiger mit Wasser als Natrium?"),
    hint: tx("Compare their shells: 2, 8, 1 and 2, 8, 8, 1.", "Vergleiche ihre Schalen: 2, 8, 1 und 2, 8, 8, 1."),
    opts: [
      { text: tx("Its outer electron is further from the nucleus and leaves more easily.", "Sein Außenelektron ist weiter vom Kern entfernt und geht leichter ab.") },
      { text: tx("It has more outer electrons.", "Es hat mehr Außenelektronen."), title: tx("Both have 1", "Beide haben 1"), say: tx("Both are in main group I: each has exactly 1 outer electron.", "Beide stehen in der I. Hauptgruppe: Jedes hat genau 1 Außenelektron.") },
      { text: tx("It has fewer shells.", "Es hat weniger Schalen."), title: tx("It has more shells", "Es hat mehr Schalen"), say: tx("Potassium is in period 4, sodium in period 3: potassium has **more** shells.", "Kalium steht in der 4. Periode, Natrium in der 3.: Kalium hat **mehr** Schalen.") },
      { text: tx("It takes up electrons more easily.", "Es nimmt leichter Elektronen auf."), title: tx("Metals give electrons away", "Metalle geben Elektronen ab"), say: tx("Alkali metals don't take up electrons: they give their single outer electron away.", "Alkalimetalle nehmen keine Elektronen auf: Sie geben ihr einziges Außenelektron ab.") },
    ],
    frame: { math: "\\ce{Na} \\; 2, 8, \\hl{1} \\quad \\ce{K} \\; 2, 8, 8, \\hl{1}", note: tx("One more shell: the outer electron is further away, the nucleus holds it less tightly.", "Eine Schale mehr: Das Außenelektron ist weiter weg, der Kern hält es weniger fest.") },
  }),
  () => ({
    q: tx("Why is fluorine more reactive than iodine?", "Warum ist Fluor reaktionsfähiger als Iod?"),
    hint: tx("Halogens take up one electron. Where does the nucleus pull hardest?", "Halogene nehmen ein Elektron auf. Wo zieht der Kern am stärksten?"),
    opts: [
      { text: tx("Its atom is small, so the nucleus pulls an extra electron in strongly.", "Sein Atom ist klein, darum zieht der Kern ein zusätzliches Elektron stark an.") },
      { text: tx("It has more outer electrons than iodine.", "Es hat mehr Außenelektronen als Iod."), title: tx("Both have 7", "Beide haben 7"), say: tx("Both are halogens in main group VII: each has 7 outer electrons.", "Beide sind Halogene in der VII. Hauptgruppe: Jedes hat 7 Außenelektronen.") },
      { text: tx("It gives away electrons more easily.", "Es gibt leichter Elektronen ab."), title: tx("Halogens take electrons", "Halogene nehmen Elektronen auf"), say: tx("Halogens don't give electrons away: they take one up to fill their outer shell.", "Halogene geben keine Elektronen ab: Sie nehmen eins auf, um ihre Außenschale zu füllen.") },
    ],
    frame: { math: "\\ce{F} > \\ce{Cl} > \\ce{Br} > \\ce{I}", note: tx("Fluorine's outer shell is close to the nucleus: an incoming electron is pulled in very strongly.", "Die Außenschale von Fluor liegt nah am Kern: Ein neues Elektron wird sehr stark angezogen.") },
  }),
];

function trendTask(rng: Rng, hard: boolean): Exercise {
  const t = rng.pick(hard ? TRENDS_HARD : TRENDS_BASIC)(rng);
  const c = choice(rng, t.opts);
  return { instruction: tx("Use the trends", "Nutze die Trends"), text: t.q, answer: c.answer, hint: t.hint, solution: [t.frame], mistakes: c.mistakes };
}

// ---------------------------------------------------------------------------
// Level 3: riddles, predictions, noble gas ions

function riddleExercise(s: number, o: number): Exercise {
  const e = at(s, o)!;
  const m = mistakes(word(e));
  const swapped = o <= 6 && s <= 8 ? at(o, s) : undefined;
  if (swapped)
    m.add(word(swapped), tx("Shells and outer electrons swapped", "Schalen und Außenelektronen vertauscht"), tx(`That one has ${o} shells and ${s} outer electrons. The shells give the **period** (row), the outer electrons the **main group** (column).`, `Das hat ${o} Schalen und ${s} Außenelektronen. Die Schalen ergeben die **Periode** (Zeile), die Außenelektronen die **Hauptgruppe** (Spalte).`));
  for (const d of [-1, 1]) {
    const near = s + d >= 1 ? at(s + d, o) : undefined;
    if (near && near.period <= 6)
      m.add(word(near), tx("Right column, wrong row", "Richtige Spalte, falsche Zeile"), tx("Right main group! Now count the shells: the number of shells is the period.", "Richtige Hauptgruppe! Jetzt zähl die Schalen: Die Anzahl der Schalen ist die Periode."), true);
  }
  const byZ = byNumber(o);
  if (byZ)
    m.add(word(byZ), tx("Total instead of outer", "Alle statt Außenelektronen"), tx(`That element has ${o} electrons **in total**. You're looking for ${o} on the outer shell, with ${s} shells.`, `Dieses Element hat **insgesamt** ${o} Elektronen. Gesucht sind ${o} auf der Außenschale, bei ${s} Schalen.`));
  return {
    instruction: tx("Solve the riddle", "Löse das Rätsel"),
    text: tx(`My atom has ${s} shells and ${o} outer ${o === 1 ? "electron" : "electrons"}. Which element am I?`, `Mein Atom hat ${s} Schalen und ${plDe(o, "Außenelektron", "Außenelektronen")}. Welches Element bin ich?`),
    visual: visual(LookupTable, { periods: 6 }),
    answer: word(e),
    hint: tx("Number of shells = period. Number of outer electrons = main group.", "Anzahl der Schalen = Periode. Anzahl der Außenelektronen = Hauptgruppe."),
    solution: [
      { math: tx(`${s}#s "shells" \\Rightarrow "period" \\; ${s}#s2`, `${s}#s "Schalen" \\Rightarrow "Periode" \\; ${s}#s2`), note: tx(`${s} shells: period ${s}.`, `${s} Schalen: ${s}. Periode.`) },
      {
        math: tx(`"period" \\; ${s}#s2 \\quad "main group" \\; "${ROMAN[o]}"`, `"Periode" \\; ${s}#s2 \\quad "Hauptgruppe" \\; "${ROMAN[o]}"`),
        note: tx(`${plEn(o, "outer electron")}: main group ${ROMAN[o]}.`, `${plDe(o, "Außenelektron", "Außenelektronen")}: ${ROMAN[o]}. Hauptgruppe.`),
      },
      { math: `\\ce{${e.symbol}} \\quad ${shellsSrc(e.z)}`, note: tx(`That's **${enName(e)}**: ${shells(e.z).join(", ")}.`, `Das ist **${deName(e)}**: ${shells(e.z).join(", ")}.`) },
    ],
    mistakes: m.list,
  };
}

function riddleTask(rng: Rng): Exercise {
  for (;;) {
    const s = rng.int(2, 5);
    const o = rng.int(1, 8);
    if (at(s, o)) return riddleExercise(s, o);
  }
}

const ANION_EN: Record<string, string> = { F: "fluoride", Cl: "chloride", Br: "bromide", I: "iodide", O: "oxide", S: "sulfide" };
const ANION_DE: Record<string, string> = { F: "fluorid", Cl: "chlorid", Br: "bromid", I: "iodid", O: "oxid", S: "sulfid" };
const saltFormula = (m: Element, x: string) => {
  const c = mg(m);
  const d = 8 - mg(el(x));
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const k = gcd(c, d);
  const a = d / k;
  const b = c / k;
  return `${m.symbol}${a > 1 ? a : ""}${x}${b > 1 ? b : ""}`;
};

function analogyTask(rng: Rng): Exercise {
  const hydroxide = rng.chance(0.3);
  const group = rng.pick([1, 2]);
  const metals = group === 1 ? FAMILIES.alkali.members : ["Mg", "Ca", "Sr", "Ba"];
  const [m0, m1] = rng.shuffle(metals).slice(0, 2).map(el);
  if (hydroxide) {
    const f0 = group === 1 ? `${m0.symbol}OH` : `${m0.symbol}(OH)2`;
    const f1 = group === 1 ? `${m1.symbol}OH` : `${m1.symbol}(OH)2`;
    const m = mistakes(formula(f1));
    if (group === 1)
      m.add(formula(`${m1.symbol}(OH)2`), tx("Group I needs one OH", "Gruppe I braucht ein OH"), tx(`${resolveText(m1.name, "en")} is in main group I like ${enName(m0)}: one $\\ce{OH-}$ is enough, as in $\\ce{${f0}}$.`, `${deName(m1)} steht wie ${deName(m0)} in der I. Hauptgruppe: Ein $\\ce{OH-}$ reicht, wie in $\\ce{${f0}}$.`));
    else
      m.add(formula(`${m1.symbol}OH`), tx("Group II needs two OH", "Gruppe II braucht zwei OH"), tx(`${resolveText(m1.name, "en")} is in main group II like ${enName(m0)}: it forms a 2+ ion and needs two $\\ce{OH-}$, as in $\\ce{${f0}}$.`, `${deName(m1)} steht wie ${deName(m0)} in der II. Hauptgruppe: Es bildet ein 2+-Ion und braucht zwei $\\ce{OH-}$, wie in $\\ce{${f0}}$.`));
    m.add(
      formula(group === 1 ? `${m1.symbol}2O` : `${m1.symbol}O`),
      tx("That's the oxide", "Das ist das Oxid"),
      tx("That's the oxide. With water a **hydroxide** forms: the metal ion together with $\\ce{OH-}$ ions.", "Das ist das Oxid. Mit Wasser entsteht ein **Hydroxid**: das Metall-Ion zusammen mit $\\ce{OH-}$-Ionen."),
    );
    return {
      instruction: tx("Predict the formula", "Sag die Formel voraus"),
      text: tx(
        `${resolveText(m0.name, "en")} reacts with water to form hydrogen and ${enName(m0)} hydroxide, $\\ce{${f0}}$. What is the formula of the hydroxide formed when ${enName(m1)} reacts with water?`,
        `${deName(m0)} reagiert mit Wasser zu Wasserstoff und ${deName(m0)}hydroxid, $\\ce{${f0}}$. Welche Formel hat das Hydroxid, das entsteht, wenn ${deName(m1)} mit Wasser reagiert?`,
      ),
      visual: visual(LookupTable, { periods: 6, highlight: [m0.symbol, m1.symbol] }),
      answer: formula(f1),
      hint: tx("Elements of the same main group react in the same way.", "Elemente derselben Hauptgruppe reagieren auf die gleiche Weise."),
      solution: [
        { math: tx(`\\ce{${m0.symbol}}, \\ce{${m1.symbol}} \\quad "main group" \\; "${ROMAN[group]}"`, `\\ce{${m0.symbol}}, \\ce{${m1.symbol}} \\quad "Hauptgruppe" \\; "${ROMAN[group]}"`), note: tx("Both are in the same main group: same outer electrons, same kind of reaction.", "Beide stehen in derselben Hauptgruppe: gleiche Außenelektronen, gleiche Art Reaktion.") },
        { math: `\\ce{${ionFormula(m1.symbol, group)}} \\quad \\ce{OH-}`, note: tx(`${resolveText(m1.name, "en")} forms $\\ce{${ionFormula(m1.symbol, group)}}$, so it needs ${group === 1 ? "one" : "two"} $\\ce{OH-}$.`, `${deName(m1)} bildet $\\ce{${ionFormula(m1.symbol, group)}}$, braucht also ${group === 1 ? "ein" : "zwei"} $\\ce{OH-}$.`) },
        { math: `\\ce{${f1}}`, note: tx(`${resolveText(m1.name, "en")} hydroxide: $\\ce{${f1}}$.`, `${deName(m1)}hydroxid: $\\ce{${f1}}$.`) },
      ],
      mistakes: m.list,
    };
  }
  const nonGroup = rng.pick([6, 7]);
  const pool = nonGroup === 7 ? ["F", "Cl", "Br", "I"] : ["O", "S"];
  const [x0, x1] = rng.shuffle(pool).slice(0, 2);
  const f0 = saltFormula(m0, x0);
  const f1 = saltFormula(m1, x1);
  const c = group;
  const d = 8 - nonGroup;
  const m = mistakes(formula(f1));
  m.add(formula(`${m1.symbol}${x1}`), tx("Charges don't balance", "Ladungen gleichen sich nicht aus"), tx(`Check the charges: $\\ce{${ionFormula(m1.symbol, c)}}$ and $\\ce{${ionFormula(x1, -d)}}$. Just like in $\\ce{${f0}}$, they have to add up to zero.`, `Prüf die Ladungen: $\\ce{${ionFormula(m1.symbol, c)}}$ und $\\ce{${ionFormula(x1, -d)}}$. Genau wie in $\\ce{${f0}}$ müssen sie zusammen null ergeben.`));
  m.add(formula(`${m1.symbol}${x1}2`), tx("The molecule isn't in the salt", "Das Molekül steckt nicht im Salz"), tx(`${resolveText(el(x1).name, "en")} comes as $\\ce{${x1}2}$ molecules, but in the salt there are single ions. Balance the charges, like in $\\ce{${f0}}$.`, `${deName(el(x1))} kommt als $\\ce{${x1}2}$-Molekül vor, im Salz gibt es aber einzelne Ionen. Gleiche die Ladungen aus, wie in $\\ce{${f0}}$.`));
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const k = gcd(c, d);
  {
    const kg = gcd(nonGroup, c);
    m.add(
      formula(`${m1.symbol}${nonGroup / kg > 1 ? nonGroup / kg : ""}${x1}${c / kg > 1 ? c / kg : ""}`),
      tx("Group number used as charge", "Gruppennummer statt Ladung"),
      tx(`${resolveText(el(x1).name, "en")} is in main group ${ROMAN[nonGroup]}, but its ion only carries ${d}−. Balance the charges, not the group numbers.`, `${deName(el(x1))} steht in der ${ROMAN[nonGroup]}. Hauptgruppe, sein Ion trägt aber nur ${d}−. Gleiche die Ladungen aus, nicht die Gruppennummern.`),
    );
  }
  if (c !== d)
    m.add(
      formula(`${m1.symbol}${c / k > 1 ? c / k : ""}${x1}${d / k > 1 ? d / k : ""}`),
      tx("Numbers swapped", "Zahlen vertauscht"),
      tx(`The numbers swapped places. The metal ion carries ${c}+, the ${enName(el(x1))} ion ${d}−: which one do you need more of?`, `Die Zahlen haben die Plätze getauscht. Das Metall-Ion trägt ${c}+, das ${deName(el(x1))}-Ion ${d}−: Von welchem brauchst du mehr?`),
    );
  return {
    instruction: tx("Predict the formula", "Sag die Formel voraus"),
    text: tx(
      `${resolveText(m0.name, "en")} and ${enName(el(x0))} react to form ${enName(m0)} ${ANION_EN[x0]}, $\\ce{${f0}}$. What is the formula of the salt made from ${enName(m1)} and ${enName(el(x1))}?`,
      `${deName(m0)} und ${deName(el(x0))} reagieren zu ${deName(m0)}${ANION_DE[x0]}, $\\ce{${f0}}$. Welche Formel hat das Salz aus ${deName(m1)} und ${deName(el(x1))}?`,
    ),
    visual: visual(LookupTable, { periods: 6, highlight: [m0.symbol, m1.symbol, x0, x1].filter((s, i, a) => a.indexOf(s) === i) }),
    answer: formula(f1),
    hint: tx("Elements of the same main group form ions with the same charge.", "Elemente derselben Hauptgruppe bilden Ionen mit derselben Ladung."),
    solution: [
      {
        math: `\\ce{${m0.symbol}} \\to \\ce{${m1.symbol}} \\quad \\ce{${x0}} \\to \\ce{${x1}}`,
        note: tx(`${resolveText(m1.name, "en")} is in the same main group as ${enName(m0)}${x0 === x1 ? "" : `, ${enName(el(x1))} in the same as ${enName(el(x0))}`}.`, `${deName(m1)} steht in derselben Hauptgruppe wie ${deName(m0)}${x0 === x1 ? "" : `, ${deName(el(x1))} in derselben wie ${deName(el(x0))}`}.`),
      },
      { math: `\\ce{${ionFormula(m1.symbol, c)}} \\quad \\ce{${ionFormula(x1, -d)}}`, note: tx(`So the ions are $\\ce{${ionFormula(m1.symbol, c)}}$ and $\\ce{${ionFormula(x1, -d)}}$.`, `Die Ionen sind also $\\ce{${ionFormula(m1.symbol, c)}}$ und $\\ce{${ionFormula(x1, -d)}}$.`) },
      { math: `\\ce{${f1}}`, note: tx(`Charges balance: ${enName(m1)} ${ANION_EN[x1]}, $\\ce{${f1}}$.`, `Die Ladungen gleichen sich aus: ${deName(m1)}${ANION_DE[x1]}, $\\ce{${f1}}$.`) },
    ],
    mistakes: m.list,
  };
}

const IONS_NE = ["Na+", "Mg^2+", "Al^3+", "F-", "O^2-", "N^3-"];
const IONS_AR = ["K+", "Ca^2+", "Cl-", "S^2-", "P^3-"];
const ionSym = (f: string) => f.match(/^[A-Z][a-z]?/)![0];
const ionQ = (f: string) => {
  const m = f.match(/\^?(\d?)([+-])$/)!;
  return (m[2] === "+" ? 1 : -1) * (m[1] ? Number(m[1]) : 1);
};

function nobleIonsTask(rng: Rng): Exercise {
  const toNe = rng.chance(0.5);
  const noble = el(toNe ? "Ne" : "Ar");
  const right = rng.shuffle(toNe ? IONS_NE : IONS_AR).slice(0, rng.int(2, 3));
  const wrongPool = toNe ? [...IONS_AR, "Li+"] : [...IONS_NE, "Li+"];
  const wrong = rng.shuffle(wrongPool).slice(0, 6 - right.length);
  const all = rng.shuffle([...right, ...wrong]);
  const options = all.map((f) => `$\\ce{${f}}$`);
  const correct = all.map((f, i) => (right.includes(f) ? i : -1)).filter((i) => i >= 0);
  const spec: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(spec);
  const samePeriod = all.map((f, i) => (el(ionSym(f)).period === noble.period ? i : -1)).filter((i) => i >= 0);
  if (samePeriod.length)
    m.add(
      { kind: "multi", options, correct: samePeriod },
      tx("Picked by period", "Nach der Periode ausgewählt"),
      tx(`Careful: positive ions lose their outer shell and end up like the noble gas one period **up**. Only negative ions match the noble gas of their own period.`, `Vorsicht: Positive Ionen verlieren ihre Außenschale und gleichen dem Edelgas eine Periode **höher**. Nur negative Ionen gleichen dem Edelgas ihrer eigenen Periode.`),
    );
  const onlyAnions = correct.filter((i) => ionQ(all[i]) < 0);
  if (onlyAnions.length && onlyAnions.length < correct.length)
    m.add(
      { kind: "multi", options, correct: onlyAnions },
      tx("Positive ions too", "Auch positive Ionen"),
      tx(`Not only negative ions: metal ions of the next period also end up with ${shells(noble.z).join(", ")}. Count their electrons.`, `Nicht nur negative Ionen: Auch Metall-Ionen der nächsten Periode haben am Ende ${shells(noble.z).join(", ")}. Zähl ihre Elektronen.`),
    );
  const count = (f: string) => el(ionSym(f)).z - ionQ(f);
  return {
    instruction: tx("Select all that match", "Wähle alle passenden"),
    text: tx(`Which ions have the same electron arrangement as ${enName(noble)} (${shells(noble.z).join(", ")})?`, `Welche Ionen haben dieselbe Elektronenverteilung wie ${deName(noble)} (${shells(noble.z).join(", ")})?`),
    answer: spec,
    hint: tx("Count the electrons of each ion: protons minus charge.", "Zähl die Elektronen jedes Ions: Protonen minus Ladung."),
    solution: [
      { math: tx(`\\ce{${noble.symbol}} \\quad ${noble.z} "electrons"`, `\\ce{${noble.symbol}} \\quad ${noble.z} "Elektronen"`), note: tx(`${resolveText(noble.name, "en")} has ${noble.z} electrons: ${shells(noble.z).join(", ")}.`, `${deName(noble)} hat ${noble.z} Elektronen: ${shells(noble.z).join(", ")}.`) },
      {
        math: all.map((f, i) => `${i === 3 ? "\\\\ " : i ? "\\quad " : ""}${right.includes(f) ? `\\hl{\\ce{${f}} \\; ${count(f)}}` : `\\group{\\ce{${f}} \\; ${count(f)}}`}`).join(" "),
        note: tx(`Protons minus charge for each ion. The ones with ${noble.z} electrons match.`, `Protonen minus Ladung für jedes Ion. Die mit ${noble.z} Elektronen passen.`),
      },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Generator

function weighted<T>(rng: Rng, items: [number, () => T][]): T {
  const total = items.reduce((s, [w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [w, f] of items) if ((r -= w) < 0) return f();
  return items[items.length - 1][1]();
}

function generate(level: Level, rng: Rng): Exercise {
  if (level === 1)
    return weighted(rng, [
      [3, () => positionTask(rng, 4)],
      [2.5, () => shellsOuterExercise(rng.pick(mainElements(4).filter((e) => e.z > 2)), true)],
      [2.5, () => familyTask(rng)],
      [2, () => metalTask(rng)],
    ]);
  if (level === 2)
    return weighted(rng, [
      [1.5, () => shellsOuterExercise(rng.pick(mainElements(5).filter((e) => e.z > 2)), false)],
      [2, () => ionFromGroupTask(rng)],
      [1.8, () => electronsMovedExercise(el(rng.pick(ION_FORMERS)))],
      [1.5, () => nobleReachedTask(rng)],
      [3, () => trendTask(rng, false)],
    ]);
  return weighted(rng, [
    [2.4, () => riddleTask(rng)],
    [2.4, () => analogyTask(rng)],
    [2, () => nobleIonsTask(rng)],
    [1.8, () => trendTask(rng, true)],
    [1.2, () => positionTask(rng, 6)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const reactCheck = choice(createRng(7), [
  { text: symName(el("K")) },
  { text: symName(el("Li")), title: tx("Trend the wrong way round", "Trend falsch herum"), say: tx("The other way round! Reactivity of the alkali metals **increases** from top to bottom.", "Andersherum! Die Reaktionsfähigkeit der Alkalimetalle **nimmt** von oben nach unten **zu**.") },
  { text: symName(el("Na")), title: tx("Not the lowest one", "Nicht das unterste"), say: tx("Sodium reacts violently, sure. But one of the others is even further down.", "Natrium reagiert heftig, klar. Aber eins der anderen steht noch weiter unten.") },
]);

const lesson: Topic["lesson"] = [
  {
    type: "explain",
    title: tx("Order in the periodic table", "Ordnung im Periodensystem"),
    blob: tx("118 elements, one big map. Let's learn to read it!", "118 Elemente, eine große Karte. Lernen wir, sie zu lesen!"),
    body: tx(
      "The periodic table sorts the elements by their **atomic number**. Its rows and columns tell you how the atoms are built.",
      "Das Periodensystem ordnet die Elemente nach ihrer **Ordnungszahl**. Seine Zeilen und Spalten verraten dir, wie die Atome gebaut sind.",
    ),
    frames: [
      { math: "Z = 1, 2, 3, 4, 5, …, 118", note: tx("Element after element, sorted by atomic number: hydrogen 1, helium 2, lithium 3 …", "Element für Element, sortiert nach der Ordnungszahl: Wasserstoff 1, Helium 2, Lithium 3 …") },
      {
        math: tx('"row" = "period" \\quad "column" = "group"', '"Zeile" = "Periode" \\quad "Spalte" = "Gruppe"'),
        note: tx("The rows are called **periods**, the columns **groups**. In school we use the eight **main groups** I to VIII.", "Die Zeilen heißen **Perioden**, die Spalten **Gruppen**. In der Schule nutzen wir die acht **Hauptgruppen** I bis VIII."),
      },
      {
        math: tx('"period"#p =#e1 "number of shells"#ps', '"Periode"#p =#e1 "Anzahl der Schalen"#ps'),
        note: tx("The period tells you how many shells the atom has.", "Die Periode verrät, wie viele Schalen das Atom hat."),
      },
      {
        math: tx('"period"#p =#e1 "number of shells"#ps \\\\ "main group"#g =#e2 "outer electrons"#gs', '"Periode"#p =#e1 "Anzahl der Schalen"#ps \\\\ "Hauptgruppe"#g =#e2 "Außenelektronen"#gs'),
        note: tx("The main group tells you the number of outer electrons. (Helium is the exception: 2.)", "Die Hauptgruppe verrät die Zahl der Außenelektronen. (Helium ist die Ausnahme: 2.)"),
      },
      {
        math: tx('\\ce{Na} \\quad "period" \\; 3#pv \\quad "main group" \\; "I"#gv', '\\ce{Na} \\quad "Periode" \\; 3#pv \\quad "Hauptgruppe" \\; "I"#gv'),
        note: tx("Sodium: period 3, main group I.", "Natrium: 3. Periode, I. Hauptgruppe."),
      },
      {
        math: tx('\\ce{Na} \\quad 3#pv "shells" \\quad 1#gv "outer electron" \\\\ 2, 8, \\hl{1}', '\\ce{Na} \\quad 3#pv "Schalen" \\quad 1#gv "Außenelektron" \\\\ 2, 8, \\hl{1}'),
        note: tx("So: 3 shells and 1 outer electron, that's 2, 8, 1. The position tells you the atom!", "Also: 3 Schalen und 1 Außenelektron, das ist 2, 8, 1. Die Stelle verrät dir das Atom!"),
      },
    ],
  },
  {
    type: "widget",
    title: tx("Explore the table", "Erkunde das Periodensystem"),
    blob: tx("Tap any element. Its row and column light up.", "Tipp auf irgendein Element. Seine Zeile und Spalte leuchten auf."),
    body: tx("Pick elements and compare: same row, same number of shells. Same column, same number of outer electrons.", "Wähle Elemente und vergleiche: gleiche Zeile, gleich viele Schalen. Gleiche Spalte, gleich viele Außenelektronen."),
    widget: PeriodicTableExplorer,
  },
  {
    type: "check",
    blob: tx("Your turn: read the atom off its position!", "Du bist dran: Lies das Atom an seiner Stelle ab!"),
    exercise: shellsOuterExercise(el("S"), true),
  },
  {
    type: "widget",
    title: tx("Metals, nonmetals and families", "Metalle, Nichtmetalle und Familien"),
    blob: tx("Elements in one column are like a family. They behave alike!", "Elemente einer Spalte sind wie eine Familie. Sie verhalten sich ähnlich!"),
    body: tx("Switch between the tabs. Where are the metals? What do the members of a family have in common?", "Schalte zwischen den Reitern um. Wo stehen die Metalle? Was haben die Mitglieder einer Familie gemeinsam?"),
    widget: PeriodicTableFamilies,
  },
  {
    type: "explain",
    title: tx("Alkali and alkaline earth metals", "Alkali- und Erdalkalimetalle"),
    blob: tx("Safety goggles on! These metals love water a bit too much.", "Schutzbrille auf! Diese Metalle mögen Wasser ein bisschen zu sehr."),
    frames: [
      {
        math: eqn("2Na + 2H2O -> 2NaOH + H2"),
        note: tx("**Alkali metals** (main group I) react violently with water. Hydrogen forms, and the solution turns alkaline: sodium hydroxide solution.", "**Alkalimetalle** (I. Hauptgruppe) reagieren heftig mit Wasser. Es entsteht Wasserstoff, und die Lösung wird alkalisch: Natronlauge."),
      },
      {
        math: "\\ce{Li} < \\ce{Na} < \\ce{K} < \\ce{Rb} < \\ce{Cs}",
        note: tx("Reactivity **increases** from top to bottom: lithium fizzes, sodium whizzes around, potassium catches fire, caesium explodes.", "Die Reaktionsfähigkeit **nimmt** von oben nach unten **zu**: Lithium sprudelt, Natrium flitzt herum, Kalium brennt, Caesium explodiert."),
      },
      {
        math: "\\ce{Li} \\; 2, \\hl{1} \\\\ \\ce{Na} \\; 2, 8, \\hl{1} \\\\ \\ce{K} \\; 2, 8, 8, \\hl{1}",
        note: tx("Why? Further down there are more shells. The single outer electron is further from the nucleus and is given away more easily.", "Warum? Weiter unten gibt es mehr Schalen. Das einzige Außenelektron ist weiter vom Kern entfernt und wird leichter abgegeben."),
      },
      {
        math: eqn("Ca + 2H2O -> Ca(OH)2 + H2"),
        note: tx("**Alkaline earth metals** (main group II) have 2 outer electrons. They react with water too, but more calmly. Here, too, reactivity increases downwards.", "**Erdalkalimetalle** (II. Hauptgruppe) haben 2 Außenelektronen. Auch sie reagieren mit Wasser, aber ruhiger. Auch hier nimmt die Reaktionsfähigkeit nach unten zu."),
      },
    ],
  },
  {
    type: "explain",
    title: tx("Halogens and noble gases", "Halogene und Edelgase"),
    blob: tx("Now the right-hand side: the salt formers and the loners.", "Jetzt die rechte Seite: die Salzbildner und die Einzelgänger."),
    frames: [
      {
        math: eqn("2Na + Cl2 -> 2NaCl"),
        note: tx("**Halogens** (main group VII) have 7 outer electrons and form molecules like $\\ce{Cl2}$. With metals they react to salts: here table salt.", "**Halogene** (VII. Hauptgruppe) haben 7 Außenelektronen und bilden Moleküle wie $\\ce{Cl2}$. Mit Metallen reagieren sie zu Salzen: hier zu Kochsalz."),
      },
      { math: "\\ce{F2} > \\ce{Cl2} > \\ce{Br2} > \\ce{I2}", note: tx("Their reactivity **decreases** from top to bottom. Fluorine is the most reactive element of all.", "Ihre Reaktionsfähigkeit **nimmt** von oben nach unten **ab**. Fluor ist das reaktionsfähigste Element überhaupt.") },
      {
        math: tx('\\ce{F2}, \\ce{Cl2} \\; "gas" \\quad \\ce{Br2} \\; "liquid" \\quad \\ce{I2} \\; "solid"', '\\ce{F2}, \\ce{Cl2} \\; "gasförmig" \\quad \\ce{Br2} \\; "flüssig" \\quad \\ce{I2} \\; "fest"'),
        note: tx("Melting and boiling points rise downwards: at room temperature fluorine and chlorine are gases, bromine is a liquid, iodine a solid.", "Schmelz- und Siedetemperaturen steigen nach unten: Bei Raumtemperatur sind Fluor und Chlor Gase, Brom ist flüssig, Iod fest."),
      },
      {
        math: "\\ce{He} \\; \\hl{2} \\quad \\ce{Ne} \\; 2, \\hl{8} \\quad \\ce{Ar} \\; 2, 8, \\hl{8}",
        note: tx("**Noble gases** (main group VIII) have a full outer shell. They hardly react and exist as single atoms.", "**Edelgase** (VIII. Hauptgruppe) haben eine volle Außenschale. Sie reagieren kaum und kommen als einzelne Atome vor."),
      },
    ],
  },
  {
    type: "check",
    blob: tx("Which one would you rather not drop in water?", "Welches würdest du lieber nicht ins Wasser werfen?"),
    exercise: {
      instruction: tx("Use the trends", "Nutze die Trends"),
      text: tx("Which alkali metal reacts most violently with water?", "Welches Alkalimetall reagiert am heftigsten mit Wasser?"),
      answer: reactCheck.answer,
      hint: tx("Where is the single outer electron furthest from the nucleus?", "Wo ist das einzige Außenelektron am weitesten vom Kern entfernt?"),
      solution: [{ math: "\\ce{Li} < \\ce{Na} < \\hl{\\ce{K}}", note: tx("Potassium is furthest down: its outer electron leaves most easily. It reacts most violently.", "Kalium steht am weitesten unten: Sein Außenelektron geht am leichtesten ab. Es reagiert am heftigsten.") }],
      mistakes: reactCheck.mistakes,
    },
  },
  {
    type: "explain",
    title: tx("The noble gas configuration", "Die Edelgaskonfiguration"),
    blob: tx("Here's the secret behind every reaction!", "Hier kommt das Geheimnis hinter jeder Reaktion!"),
    body: tx(
      "A full outer shell, like in the noble gases, is especially stable. Atoms react so that they reach it: the **noble gas configuration** (octet rule: 8 outer electrons).",
      "Eine volle Außenschale wie bei den Edelgasen ist besonders stabil. Atome reagieren so, dass sie diese erreichen: die **Edelgaskonfiguration** (Oktettregel: 8 Außenelektronen).",
    ),
    frames: [
      { math: "\\ce{Na} \\quad 2, 8, \\hl{1}", note: tx("Sodium has just 1 outer electron.", "Natrium hat nur 1 Außenelektron.") },
      { math: `${eqn("Na -> Na+ + e-")} \\quad 2, 8`, note: tx("It gives that electron away. Now the full L shell is the outer shell: 2, 8, just like **neon**.", "Es gibt dieses Elektron ab. Jetzt ist die volle L-Schale außen: 2, 8, genau wie **Neon**.") },
      { math: "\\ce{Cl} \\quad 2, 8, \\hl{7}", note: tx("Chlorine is missing just one electron.", "Chlor fehlt nur ein Elektron.") },
      { math: `${eqn("Cl + e- -> Cl-")} \\quad 2, 8, 8`, note: tx("It takes one up: 2, 8, 8, just like **argon**.", "Es nimmt eins auf: 2, 8, 8, genau wie **Argon**.") },
      {
        math: `${eqn("Mg -> Mg^2+ + 2e-")} \\\\ ${eqn("O + 2e- -> O^2-")}`,
        note: tx("Metals give away their few outer electrons, nonmetals fill their outer shell. The fewer electrons have to move, the more easily an atom reacts: that's why alkali metals and halogens are so reactive.", "Metalle geben ihre wenigen Außenelektronen ab, Nichtmetalle füllen ihre Außenschale auf. Je weniger Elektronen wandern müssen, desto leichter reagiert ein Atom: Darum sind Alkalimetalle und Halogene so reaktionsfreudig."),
      },
    ],
  },
  {
    type: "widget",
    title: tx("Noble gas lab", "Edelgas-Labor"),
    blob: tx("Give and take electrons until the outer shell is full!", "Gib und nimm Elektronen, bis die Außenschale voll ist!"),
    body: tx("Pick an atom. Give away or take up electrons and watch the shells. Which way is shorter?", "Wähle ein Atom. Gib Elektronen ab oder nimm welche auf und beobachte die Schalen. Welcher Weg ist kürzer?"),
    widget: PeriodicTableNobleGas,
  },
  {
    type: "check",
    blob: tx("How many have to go?", "Wie viele müssen gehen?"),
    exercise: electronsMovedExercise(el("Al")),
  },
  {
    type: "check",
    blob: tx("Last one: a little riddle!", "Die letzte: ein kleines Rätsel!"),
    exercise: riddleExercise(4, 2),
  },
];

// ---------------------------------------------------------------------------

const topic: Topic = {
  ...topicMeta("periodic-table"),
  summary: [
    {
      title: tx("Periods and main groups", "Perioden und Hauptgruppen"),
      body: tx(
        "The elements are sorted by atomic number. **Period** (row) = number of shells. **Main group** (column) = number of outer electrons (helium: 2).",
        "Die Elemente sind nach der Ordnungszahl sortiert. **Periode** (Zeile) = Anzahl der Schalen. **Hauptgruppe** (Spalte) = Anzahl der Außenelektronen (Helium: 2).",
      ),
      examples: [tx('\\ce{S} \\quad "period" \\; 3 , \\; "main group" \\; "VI" \\Rightarrow 2, 8, 6', '\\ce{S} \\quad "Periode" \\; 3 , \\; "Hauptgruppe" \\; "VI" \\Rightarrow 2, 8, 6')],
      tone: "rule",
    },
    {
      title: tx("Metals and nonmetals", "Metalle und Nichtmetalle"),
      body: tx(
        "Metals are on the left and at the bottom, nonmetals at the top right (plus hydrogen). Metalloids such as boron and silicon sit on the staircase in between.",
        "Metalle stehen links und unten, Nichtmetalle oben rechts (dazu Wasserstoff). Halbmetalle wie Bor und Silicium stehen an der Treppe dazwischen.",
      ),
      tone: "rule",
    },
    {
      title: tx("Alkali and alkaline earth metals", "Alkali- und Erdalkalimetalle"),
      body: tx(
        "Main group I (1 outer electron) and II (2 outer electrons). React with water to form hydrogen and an alkaline solution. Reactivity increases from top to bottom.",
        "I. Hauptgruppe (1 Außenelektron) und II. Hauptgruppe (2 Außenelektronen). Reagieren mit Wasser zu Wasserstoff und Lauge. Die Reaktionsfähigkeit nimmt von oben nach unten zu.",
      ),
      examples: [eqn("2Na + 2H2O -> 2NaOH + H2"), eqn("Ca + 2H2O -> Ca(OH)2 + H2")],
      tone: "rule",
    },
    {
      title: tx("Halogens and noble gases", "Halogene und Edelgase"),
      body: tx(
        "Halogens (VII): 7 outer electrons, molecules like $\\ce{Cl2}$, form salts with metals; reactivity decreases from top to bottom. Noble gases (VIII): full outer shell, hardly react.",
        "Halogene (VII): 7 Außenelektronen, Moleküle wie $\\ce{Cl2}$, bilden mit Metallen Salze; die Reaktionsfähigkeit nimmt von oben nach unten ab. Edelgase (VIII): volle Außenschale, reagieren kaum.",
      ),
      examples: [eqn("2Na + Cl2 -> 2NaCl"), "\\ce{F2} > \\ce{Cl2} > \\ce{Br2} > \\ce{I2}"],
      tone: "rule",
    },
    {
      title: tx("Noble gas configuration", "Edelgaskonfiguration"),
      body: tx(
        "Atoms react to reach a full outer shell (8 electrons). Main groups I to III give away their outer electrons, V to VII take up electrons until there are 8.",
        "Atome reagieren so, dass sie eine volle Außenschale (8 Elektronen) bekommen. Hauptgruppe I bis III gibt die Außenelektronen ab, V bis VII nimmt Elektronen auf, bis es 8 sind.",
      ),
      examples: [eqn("Na -> Na+ + e-"), eqn("Cl + e- -> Cl-")],
      tone: "tip",
    },
    {
      title: tx("Don't mix up the trends", "Trends nicht verwechseln"),
      body: tx(
        "Alkali metals get **more** reactive further down, halogens get **less** reactive further down. Metals lose their outer shell; nonmetals keep their shells and fill the last one.",
        "Alkalimetalle werden nach unten **reaktionsfreudiger**, Halogene nach unten **reaktionsträger**. Metalle verlieren ihre Außenschale, Nichtmetalle behalten ihre Schalen und füllen die letzte auf.",
      ),
      examples: ["\\ce{Li} < \\ce{Na} < \\ce{K}", "\\ce{F} > \\ce{Cl} > \\ce{Br}"],
      tone: "warning",
    },
  ],
  lesson,
  generate,
};

export default topic;
