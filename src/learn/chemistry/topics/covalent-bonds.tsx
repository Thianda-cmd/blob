"use client";

import { tx, txMap, type Text } from "@/i18n/text";
import { topicMeta } from "@/learn/catalog";
import { element, valenceElectrons } from "@/learn/chemistry/elements";
import { parseFormula, sameCounts } from "@/learn/chemistry/formula";
import { CovalentBondsDipole, CovalentBondsLewisLab, CovalentBondsShare, valenceSum } from "@/learn/chemistry/visuals/CovalentBondsLab";
import { atomIon, ionFormula } from "@/learn/chemistry/ionic-bonds-ions";
import { bondPairs, CovalentBondsLewisVisual, lonePairs, MOLECULES, valenceTotal } from "@/learn/chemistry/visuals/CovalentBondsLewis";
import { bondKind, CovalentBondsPolarity, deltaEn, en1, IONIC_MIN, NONPOLAR_MAX, type BondKind } from "@/learn/chemistry/visuals/CovalentBondsPolarity";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Mistake, RichText, SingleLessonTopic as Topic } from "@/learn/types";

// ---------------------------------------------------------------------------
// Helpers

const EN = (t: Text) => (typeof t === "string" ? t : t.en);
const DE = (t: Text) => (typeof t === "string" ? t : t.de);
const ce = (f: string) => `\\ce{${f}}`;
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
/** A decimal in both languages: "1.2" / "1,2". */
const d1 = (v: number) => ({ en: v.toFixed(1), de: v.toFixed(1).replace(".", ",") });
const elName = (sym: string) => element(sym)!.name;
const valence = (sym: string) => valenceElectrons(element(sym)!) ?? 0;
/** Number of bonds in the octet rule (hydrogen: duet). */
const valency = (sym: string) => (sym === "H" ? 1 : 8 - valence(sym));
const lowerEn = (t: Text) => EN(t).toLowerCase();

const sameFormula = (a: string, b: string) => {
  const x = parseFormula(a);
  const y = parseFormula(b);
  return x.ok && y.ok && sameCounts(x.species.counts, y.species.counts) && x.species.charge === y.species.charge;
};

function collector(right: AnswerSpec) {
  const out: Mistake[] = [];
  const same = (a: AnswerSpec, b: AnswerSpec): boolean => {
    if (a.kind === "formula" && b.kind === "formula") return sameFormula(a.value, b.value);
    if (a.kind === "number" && b.kind === "number") return Math.abs(a.value - b.value) < 1e-9;
    if (a.kind === "choice" && b.kind === "choice") return a.correct === b.correct;
    if (a.kind === "multi" && b.kind === "multi") return [...a.correct].sort().join() === [...b.correct].sort().join();
    return false;
  };
  const add = (when: AnswerSpec, title: Text, say: Text, close?: boolean) => {
    if (when.kind === "formula" && !parseFormula(when.value).ok) return;
    if (when.kind === "number" && (!Number.isFinite(when.value) || when.value <= 0)) return;
    if (when.kind === "choice" && when.correct < 0) return;
    if (when.kind === "multi" && !when.correct.length) return;
    if (same(right, when) || out.some((m) => same(m.when, when))) return;
    out.push(close ? { when, title, say, close } : { when, title, say });
  };
  return { out, add };
}

const lewisVisual = (mol: string, lonePairs = true) => ({ component: CovalentBondsLewisVisual, props: { mol, lonePairs } });

// ---------------------------------------------------------------------------
// Valency (Bindigkeit)

const VALENCY_ELEMENTS = ["H", "C", "N", "O", "F", "Cl", "Br", "I", "S", "P", "Si"];

function valencyFrames(sym: string): Frame[] {
  const name = elName(sym);
  if (sym === "H") {
    return [
      { math: `${ce("H")} : \\; 2#e - 1#v = 1#n`, note: tx("Hydrogen has 1 electron and fills up to 2, like helium (the duet rule).", "Wasserstoff hat 1 Elektron und füllt bis 2 auf, wie Helium (Duettregel).") },
      { math: `${ce("H")} : \\; 1#n`, note: tx("1 electron missing, so **1 bond**.", "1 Elektron fehlt, also **1 Bindung**.") },
    ];
  }
  const v = valence(sym);
  return [
    {
      math: `${ce(sym)} : \\; 8#e - ${v}#v = ${8 - v}#n`,
      note: tx(
        `${EN(name)}: main group ${ROMAN[v]}, so ${v} outer electrons. ${8 - v} are missing for the octet.`,
        `${DE(name)}: Hauptgruppe ${ROMAN[v]}, also ${v} Außenelektronen. Zum Oktett fehl${8 - v === 1 ? "t" : "en"} ${8 - v}.`,
      ),
    },
    {
      math: `${ce(sym)} : \\; ${8 - v}#n`,
      note: tx(
        `Each bond adds one shared electron, so ${EN(name).toLowerCase()} forms **${8 - v} bond${8 - v === 1 ? "" : "s"}**.`,
        `Jede Bindung bringt ein gemeinsames Elektron dazu, also bildet ${DE(name)} **${8 - v} Bindung${8 - v === 1 ? "" : "en"}**.`,
      ),
    },
  ];
}

function valencyTask(sym: string): Exercise {
  const value = valency(sym);
  const answer: AnswerSpec = { kind: "number", value };
  const { out, add } = collector(answer);
  const v = valence(sym);
  const name = elName(sym);
  if (sym === "H") {
    add(
      { kind: "number", value: 7 },
      tx("Octet rule for hydrogen", "Oktettregel bei Wasserstoff"),
      tx("Hydrogen doesn't go for 8! It only fills its first shell, up to 2 like helium.", "Wasserstoff will keine 8! Es füllt nur seine erste Schale auf, bis 2 wie Helium."),
    );
    add(
      { kind: "number", value: 2 },
      tx("Electrons, not bonds", "Elektronen, nicht Bindungen"),
      tx("2 is the number of electrons hydrogen wants in total. It already has 1 of them.", "2 ist die Zahl der Elektronen, die Wasserstoff insgesamt haben will. Eins davon hat es schon."),
    );
  } else {
    add(
      { kind: "number", value: v },
      tx("Outer electrons counted", "Außenelektronen gezählt"),
      tx(
        `${v} is the number of outer electrons. The number of bonds is how many electrons are **missing** to the octet.`,
        `${v} ist die Zahl der Außenelektronen. Die Zahl der Bindungen ist, wie viele Elektronen bis zum Oktett **fehlen**.`,
      ),
    );
    const lone = (v - (8 - v)) / 2;
    if (lone > 0)
      add(
        { kind: "number", value: lone },
        tx("Lone pairs counted", "Freie Paare gezählt"),
        tx(
          `That's the number of lone pairs the atom keeps. Bonds come from its **single** electrons.`,
          `Das ist die Zahl der freien Elektronenpaare, die das Atom behält. Bindungen entstehen aus seinen **einzelnen** Elektronen.`,
        ),
      );
  }
  return {
    instruction: tx("Find the valency", "Bestimm die Bindigkeit"),
    text: tx(`How many bonds does ${/^[aeiou]/i.test(EN(name)) ? "an" : "a"} **${lowerEn(name)}** atom form in a molecule?`, `Wie viele Bindungen bildet ein **${DE(name)}atom** in einem Molekül?`),
    answer,
    hint: sym === "H" ? tx("Hydrogen wants 2 electrons, like helium.", "Wasserstoff will 2 Elektronen, wie Helium.") : tx("How many electrons are missing for the octet?", "Wie viele Elektronen fehlen bis zum Oktett?"),
    solution: valencyFrames(sym),
    mistakes: out,
  };
}

// ---------------------------------------------------------------------------
// Molecular formulas from two elements

/** [central atom, outer atom] that form one molecule by the octet rule. */
const FORMULA_PAIRS_2: [string, string][] = [
  ["N", "H"],
  ["O", "H"],
  ["S", "H"],
  ["P", "H"],
  ["C", "H"],
  ["Si", "H"],
  ["C", "Cl"],
  ["N", "Cl"],
  ["P", "Cl"],
  ["Cl", "H"],
  ["Br", "H"],
];
const FORMULA_PAIRS_3: [string, string][] = [
  ["Si", "Cl"],
  ["P", "Br"],
  ["N", "F"],
  ["S", "Cl"],
  ["O", "F"],
  ["C", "Br"],
  ["Si", "F"],
];

/** Hydrogen compounds are written as H₂O, H₂S, HCl… in school; others centre first. */
function moleculeFormula(center: string, outer: string): string {
  const n = valency(center);
  if (outer === "H" && ["O", "S", "Cl", "Br", "F", "I"].includes(center)) return `H${n > 1 ? n : ""}${center}`;
  return `${center}${outer}${n > 1 ? n : ""}`;
}

function formulaTask(center: string, outer: string): Exercise {
  const value = moleculeFormula(center, outer);
  const n = valency(center);
  const answer: AnswerSpec = { kind: "formula", value };
  const { out, add } = collector(answer);
  const cName = elName(center);
  const oName = elName(outer);
  const v = valence(center);
  if (v !== n && center !== "P") {
    add(
      { kind: "formula", value: `${center}${outer}${v}` },
      tx("Outer electrons as bonds", "Außenelektronen als Bindungen"),
      tx(
        `I think you gave ${EN(cName).toLowerCase()} one bond per outer electron (${v}). But it only needs as many bonds as electrons are **missing** to 8.`,
        `Ich glaub, du hast ${DE(cName)} pro Außenelektron eine Bindung gegeben (${v}). Es braucht aber nur so viele Bindungen, wie Elektronen bis 8 **fehlen**.`,
      ),
    );
  }
  if (n > 1) {
    add(
      { kind: "formula", value: `${center}${outer}` },
      tx("One of each", "Von jedem eins"),
      tx(
        `One of each isn't enough: ${EN(cName).toLowerCase()} forms several bonds, ${EN(oName).toLowerCase()} only ${valency(outer)}. How many partners does it need?`,
        `Eins zu eins reicht nicht: ${DE(cName)} bildet mehrere Bindungen, ${DE(oName)} nur ${valency(outer)}. Wie viele Partner braucht es?`,
      ),
    );
    add(
      { kind: "formula", value: `${center}${n}${outer}` },
      tx("Index on the wrong atom", "Index am falschen Atom"),
      tx(
        `The number belongs to the atom that's there **several times**. One ${EN(cName).toLowerCase()} atom binds several ${EN(oName).toLowerCase()} atoms.`,
        `Die Zahl gehört zu dem Atom, das **mehrmals** vorkommt. Ein ${DE(cName)}atom bindet mehrere ${DE(oName)}atome.`,
      ),
    );
  } else {
    add(
      { kind: "formula", value: `H${center}2` },
      tx(`${center}₂ is the element`, `${center}₂ ist das Element`),
      tx(
        `${EN(cName)} as an element is $${ce(`${center}2`)}$. In this molecule each ${EN(cName).toLowerCase()} atom forms just one bond: with hydrogen.`,
        `${DE(cName)} als Element ist $${ce(`${center}2`)}$. In diesem Molekül bildet jedes ${DE(cName)}atom nur eine Bindung: mit Wasserstoff.`,
      ),
    );
  }
  const frames: Frame[] = [
    {
      math: `${ce(center)} : \\; ${n}#n \\quad ${ce(outer)} : \\; ${valency(outer)}#m`,
      note: tx(
        `Valency: ${EN(cName).toLowerCase()} forms ${n} bond${n === 1 ? "" : "s"}, ${EN(oName).toLowerCase()} forms ${valency(outer)}.`,
        `Bindigkeit: ${DE(cName)} bildet ${n} Bindung${n === 1 ? "" : "en"}, ${DE(oName)} bildet ${valency(outer)}.`,
      ),
    },
    {
      math: ce(value),
      note:
        n === 1
          ? tx(`One bond each: $${ce(value)}$. Both atoms reach a noble gas configuration.`, `Je eine Bindung: $${ce(value)}$. Beide Atome erreichen Edelgaskonfiguration.`)
          : tx(
              `So one ${EN(cName).toLowerCase()} atom binds ${n} ${EN(oName).toLowerCase()} atoms: $${ce(value)}$. Every atom reaches a noble gas configuration.`,
              `Also bindet ein ${DE(cName)}atom ${n} ${DE(oName)}atome: $${ce(value)}$. Jedes Atom erreicht Edelgaskonfiguration.`,
            ),
    },
  ];
  return {
    instruction: tx("Write the molecular formula", "Gib die Summenformel an"),
    text: tx(
      `Which molecule do **${lowerEn(cName)}** and **${lowerEn(oName)}** form according to the octet rule?`,
      `Welches Molekül bilden **${DE(cName)}** und **${DE(oName)}** nach der Oktettregel?`,
    ),
    answer,
    hint: tx("Work out how many bonds each atom forms: 8 minus the main group number (hydrogen: 1).", "Bestimm, wie viele Bindungen jedes Atom bildet: 8 minus Hauptgruppennummer (Wasserstoff: 1)."),
    solution: frames,
    mistakes: out,
  };
}

// ---------------------------------------------------------------------------
// Bond order in diatomic molecules

const BOND_NAMES: Text[] = [tx("single bond", "Einfachbindung"), tx("double bond", "Doppelbindung"), tx("triple bond", "Dreifachbindung")];

function bondOrderTask(id: string): Exercise {
  const m = MOLECULES[id];
  const order = m.bonds[0].order;
  const options: RichText[] = BOND_NAMES;
  const answer: AnswerSpec = { kind: "choice", options, correct: order - 1 };
  const { out, add } = collector(answer);
  const els = [...new Set(m.atoms.map((a) => a.el))];
  const heavy = els.find((e) => e !== "H") ?? "H";
  const need = valency(heavy);
  const heavyName = elName(heavy);
  for (let k = 1; k <= 3; k++) {
    if (k === order) continue;
    if (k < order)
      add(
        { kind: "choice", options, correct: k - 1 },
        tx("Not enough pairs", "Zu wenige Paare"),
        tx(
          `With ${k === 1 ? "one shared pair" : "two shared pairs"}, each ${lowerEn(heavyName)} atom would have only ${8 - need + k} electrons around it. It needs ${need} more than it has.`,
          `Mit ${k === 1 ? "einem gemeinsamen Paar" : "zwei gemeinsamen Paaren"} hätte jedes ${DE(heavyName)}atom nur ${8 - need + k} Elektronen um sich. Ihm fehlen aber ${need}.`,
        ),
      );
    else
      add(
        { kind: "choice", options, correct: k - 1 },
        tx("Too many pairs", "Zu viele Paare"),
        els.includes("H")
          ? tx("Hydrogen can only form **one** bond: it only fills up to 2 electrons.", "Wasserstoff kann nur **eine** Bindung bilden: Er füllt nur bis 2 Elektronen auf.")
          : tx(
              `That would give each ${lowerEn(heavyName)} atom more than 8 electrons. It's only missing ${need}.`,
              `Dann hätte jedes ${DE(heavyName)}atom mehr als 8 Elektronen. Ihm fehl${need === 1 ? "t" : "en"} nur ${need}.`,
            ),
      );
  }
  const total = valenceTotal(m);
  return {
    instruction: tx("Choose the bond", "Wähl die Bindung"),
    text: tx(`Which bond holds the atoms together in the $${ce(m.formula)}$ molecule?`, `Welche Bindung hält die Atome im $${ce(m.formula)}$-Molekül zusammen?`),
    answer,
    hint: tx("How many electrons is each atom missing for its noble gas configuration?", "Wie viele Elektronen fehlen jedem Atom bis zur Edelgaskonfiguration?"),
    solution: [
      {
        math: `${ce(m.formula)} : \\; ${valenceSum(id).replace(/ = .*/, "")} = ${total}`,
        note: tx(`${total} outer electrons, that's ${total / 2} pairs.`, `${total} Valenzelektronen, das sind ${total / 2} Paare.`),
      },
      {
        math: `${total / 2} = ${order}#b + ${lonePairs(m)}#l`,
        note: tx(
          `Each ${lowerEn(heavyName)} atom is missing ${need}: ${order} shared pair${order === 1 ? "" : "s"}, the rest as lone pairs. That's a **${EN(BOND_NAMES[order - 1])}**.`,
          `Jedem ${DE(heavyName)}atom fehl${need === 1 ? "t" : "en"} ${need}: ${order} gemeinsame${order === 1 ? "s Paar" : " Paare"}, der Rest als freie Paare. Das ist eine **${DE(BOND_NAMES[order - 1])}**.`,
        ),
      },
    ],
    mistakes: out,
  };
}

// ---------------------------------------------------------------------------
// Counting electrons and pairs in Lewis formulas

function valenceTask(id: string): Exercise {
  const m = MOLECULES[id];
  const value = valenceTotal(m);
  const answer: AnswerSpec = { kind: "number", value };
  const { out, add } = collector(answer);
  const kinds = [...new Set(m.atoms.map((a) => a.el))];
  add(
    { kind: "number", value: kinds.reduce((s, el) => s + valence(el), 0) },
    tx("Each kind counted once", "Jede Sorte nur einmal"),
    tx("You counted each element once. But every single atom brings its own outer electrons: look at the indices.", "Du hast jedes Element einmal gezählt. Aber jedes einzelne Atom bringt seine Außenelektronen mit: Schau auf die Indizes."),
  );
  add(
    { kind: "number", value: m.atoms.reduce((s, a) => s + element(a.el)!.z, 0) },
    tx("All electrons counted", "Alle Elektronen gezählt"),
    tx("That's every electron, including the inner shells. For the Lewis formula only the **outer** electrons count.", "Das sind alle Elektronen, auch die der inneren Schalen. Für die Lewis-Formel zählen nur die **Außenelektronen**."),
  );
  add(
    { kind: "number", value: value / 2 },
    tx("Pairs instead of electrons", "Paare statt Elektronen"),
    tx("That's already the number of electron **pairs**. The question asks for the electrons.", "Das ist schon die Zahl der Elektronen**paare**. Gefragt sind die Elektronen."),
  );
  return {
    instruction: tx("Count the outer electrons", "Zähl die Valenzelektronen"),
    text: tx(`How many outer electrons does one $${ce(m.formula)}$ molecule have in total?`, `Wie viele Valenzelektronen hat ein $${ce(m.formula)}$-Molekül insgesamt?`),
    answer,
    hint: tx("Main group number = outer electrons. Multiply by how often each atom appears.", "Hauptgruppennummer = Außenelektronen. Multipliziere mit der Anzahl jedes Atoms."),
    solution: [
      {
        math: ce(m.formula),
        note: txMap((t) =>
          [...new Set(m.atoms.map((a) => a.el))]
            .map((el) => {
              const n = m.atoms.filter((a) => a.el === el).length;
              return t(`${n} × ${el} with ${valence(el)} each`, `${n} × ${el} mit je ${valence(el)}`);
            })
            .join(", ") + ".",
        ),
      },
      { math: `${ce(m.formula)} : \\; ${valenceSum(id)}`, note: tx(`${value} outer electrons in total.`, `Insgesamt ${value} Valenzelektronen.`) },
    ],
    mistakes: out,
  };
}

/** Lone pairs to add to a skeleton (only bonds shown), or to count in a full structure. */
function lonePairTask(id: string, skeleton: boolean): Exercise {
  const m = MOLECULES[id];
  const value = lonePairs(m);
  const bp = bondPairs(m);
  const total = valenceTotal(m);
  const answer: AnswerSpec = { kind: "number", value };
  const { out, add } = collector(answer);
  add(
    { kind: "number", value: 2 * value },
    tx("Electrons instead of pairs", "Elektronen statt Paare"),
    tx("You counted single electrons. Two electrons make **one** pair.", "Du hast einzelne Elektronen gezählt. Zwei Elektronen sind **ein** Paar."),
  );
  add(
    { kind: "number", value: value + bp },
    tx("Bonding pairs included", "Bindende Paare mitgezählt"),
    tx("That's all the pairs. Only the **lone** pairs are asked for: the bonding pairs between atoms don't count here.", "Das sind alle Paare. Gefragt sind nur die **freien** Paare: Die bindenden Paare zwischen den Atomen zählen hier nicht."),
  );
  const heavy = m.atoms.filter((a) => a.el !== "H");
  if (skeleton) add(
    { kind: "number", value: 4 * heavy.length },
    tx("Bonds forgotten in the octet", "Bindungen im Oktett vergessen"),
    tx("Every atom needs 8 electrons, right. But the shared pairs count towards the octet too, so fewer lone pairs are needed.", "Jedes Atom braucht 8 Elektronen, stimmt. Aber die gemeinsamen Paare zählen fürs Oktett mit, also braucht es weniger freie Paare."),
  );
  if (skeleton && heavy.length === 1 && valence(heavy[0].el) % 2 === 0)
    add(
      { kind: "number", value: valence(heavy[0].el) / 2 },
      tx("Bonding electrons forgotten", "Bindungselektronen vergessen"),
      tx(
        `You made pairs from all ${valence(heavy[0].el)} outer electrons of ${heavy[0].el}. But some of them are already in the bonds to H.`,
        `Du hast aus allen ${valence(heavy[0].el)} Außenelektronen von ${heavy[0].el} Paare gemacht. Aber einige davon stecken schon in den Bindungen zum H.`,
      ),
    );
  return {
    instruction: skeleton ? tx("Complete the Lewis formula", "Vervollständige die Lewis-Formel") : tx("Count the lone pairs", "Zähl die freien Paare"),
    text: skeleton
      ? tx(`The lone pairs are missing in this Lewis formula of $${ce(m.formula)}$. How many lone pairs does it need in total?`, `In dieser Lewis-Formel von $${ce(m.formula)}$ fehlen die freien Elektronenpaare. Wie viele freie Paare braucht sie insgesamt?`)
      : tx(`How many lone pairs does this $${ce(m.formula)}$ molecule have in total?`, `Wie viele freie Elektronenpaare hat dieses $${ce(m.formula)}$-Molekül insgesamt?`),
    answer,
    hint: skeleton
      ? tx("Count the outer electrons, halve them, and subtract the bonding pairs.", "Zähl die Valenzelektronen, halbier sie und zieh die bindenden Paare ab.")
      : tx("Lone pairs sit at one atom only, not between two atoms.", "Freie Paare sitzen nur an einem Atom, nicht zwischen zwei Atomen."),
    solution: [
      { math: `${ce(m.formula)} : \\; ${valenceSum(id)}`, note: tx(`${total} outer electrons.`, `${total} Valenzelektronen.`) },
      { math: `${total} : 2 = ${total / 2}#p`, note: tx(`That's ${total / 2} electron pairs.`, `Das sind ${total / 2} Elektronenpaare.`) },
      {
        math: `${total / 2}#p - ${bp}#b = ${value}#l`,
        note:
          value === 1
            ? tx(`${bp} of them are bonding pairs (count every line between atoms). The last one is a lone pair.`, `${bp} davon sind bindende Paare (zähl jeden Strich zwischen den Atomen). Das letzte ist ein freies Paar.`)
            : tx(
                `${bp} of them are bonding pairs (count every line between atoms). The other ${value} are lone pairs.`,
                `${bp} davon sind bindende Paare (zähl jeden Strich zwischen den Atomen). Die übrigen ${value} sind freie Paare.`,
              ),
      },
    ],
    mistakes: out,
    visual: lewisVisual(id, !skeleton),
  };
}

function bondingPairTask(id: string): Exercise {
  const m = MOLECULES[id];
  const value = bondPairs(m);
  const answer: AnswerSpec = { kind: "number", value };
  const { out, add } = collector(answer);
  add(
    { kind: "number", value: m.bonds.length },
    tx("Connections, not pairs", "Verbindungen, nicht Paare"),
    tx("You counted the connections between atoms. But a double bond is **two** pairs, a triple bond three.", "Du hast die Verbindungen zwischen Atomen gezählt. Aber eine Doppelbindung sind **zwei** Paare, eine Dreifachbindung drei."),
  );
  add(
    { kind: "number", value: 2 * value },
    tx("Electrons instead of pairs", "Elektronen statt Paare"),
    tx("That's the number of bonding **electrons**. Each line stands for a pair of two.", "Das ist die Zahl der bindenden **Elektronen**. Jeder Strich steht für ein Paar aus zwei."),
  );
  add(
    { kind: "number", value: value + lonePairs(m) },
    tx("Lone pairs included", "Freie Paare mitgezählt"),
    tx("Only the pairs **between** atoms are bonding pairs. The dots at a single atom are lone pairs.", "Nur die Paare **zwischen** Atomen sind bindende Paare. Die Punkte an einem einzelnen Atom sind freie Paare."),
  );
  return {
    instruction: tx("Count the bonding pairs", "Zähl die bindenden Paare"),
    text: tx(`How many bonding electron pairs does this $${ce(m.formula)}$ molecule have?`, `Wie viele bindende Elektronenpaare hat dieses $${ce(m.formula)}$-Molekül?`),
    answer,
    hint: tx("Every line between two atoms is one shared pair.", "Jeder Strich zwischen zwei Atomen ist ein gemeinsames Paar."),
    solution: [
      {
        math: ce(m.formula),
        note: txMap((t) => {
          const kinds = ([1, 2, 3] as const)
            .map((o) => [o, m.bonds.filter((x) => x.order === o).length] as const)
            .filter(([, n]) => n > 0)
            .map(([o, n]) => `${n} ${t(["single bond", "double bond", "triple bond"][o - 1] + (n > 1 ? "s" : ""), ["Einfachbindung", "Doppelbindung", "Dreifachbindung"][o - 1] + (n > 1 ? "en" : ""))}`);
          return `${kinds.join(t(" and ", " und "))}. ${t("Each line is one shared pair.", "Jeder Strich ist ein gemeinsames Paar.")}`;
        }),
      },
      {
        math: m.bonds.length > 1 ? `${m.bonds.map((x) => x.order).join(" + ")} = ${value}` : `${ce(m.formula)} : \\; ${value}`,
        note: tx(`${value} bonding pairs.`, `${value} bindende Paare.`),
      },
    ],
    mistakes: out,
    visual: lewisVisual(id, true),
  };
}

// ---------------------------------------------------------------------------
// Electronegativity

const POLAR_PAIRS: [string, string][] = [
  ["H", "Cl"],
  ["H", "O"],
  ["H", "N"],
  ["C", "O"],
  ["H", "Br"],
  ["C", "Cl"],
  ["C", "F"],
  ["S", "O"],
  ["P", "Cl"],
  ["Cl", "F"],
  ["P", "O"],
];
const NONPOLAR_PAIRS: [string, string][] = [
  ["Cl", "Cl"],
  ["H", "H"],
  ["Br", "Cl"],
  ["N", "Cl"],
  ["C", "S"],
  ["P", "H"],
  ["C", "I"],
  ["O", "O"],
];
const IONIC_PAIRS: [string, string][] = [
  ["Na", "Cl"],
  ["K", "Cl"],
  ["Li", "F"],
  ["Na", "F"],
  ["Mg", "O"],
  ["Ca", "O"],
  ["K", "Br"],
  ["Na", "O"],
  ["Ca", "F"],
  ["Mg", "F"],
  ["Na", "Br"],
  ["Ca", "Cl"],
  ["Li", "Cl"],
  ["K", "O"],
  ["Ba", "O"],
];

const enLine = (a: string, b: string): Text =>
  a === b
    ? tx(`$${ce("EN")}(${ce(a)}) = ${d1(en1(a)).en}$`, `$${ce("EN")}(${ce(a)}) = ${d1(en1(a)).de}$`)
    : tx(`$${ce("EN")}(${ce(a)}) = ${d1(en1(a)).en}$ and $${ce("EN")}(${ce(b)}) = ${d1(en1(b)).en}$`, `$${ce("EN")}(${ce(a)}) = ${d1(en1(a)).de}$ und $${ce("EN")}(${ce(b)}) = ${d1(en1(b)).de}$`);

/** "ΔEN = 3.2 − 2.2 = 1.0" with the bigger value first. */
function deltaMath(a: string, b: string): Text {
  const [hi, lo] = en1(a) >= en1(b) ? [a, b] : [b, a];
  const d = deltaEn(a, b);
  const line = (l: "en" | "de") => `\\Delta${ce("EN")} = ${d1(en1(hi))[l]} - ${d1(en1(lo))[l]} = ${d1(d)[l]}`;
  return { en: line("en"), de: line("de") };
}

const bondLabel = (a: string, b: string) => `${a}–${b}`;
const KIND_OPTIONS: RichText[] = [tx("nonpolar covalent bond", "unpolare Elektronenpaarbindung"), tx("polar covalent bond", "polare Elektronenpaarbindung"), tx("ionic bond", "Ionenbindung")];
const KIND_INDEX: Record<BondKind, number> = { nonpolar: 0, polar: 1, ionic: 2 };

function classifyTask(a: string, b: string): Exercise {
  const d = deltaEn(a, b);
  const kind = bondKind(d);
  const options = KIND_OPTIONS;
  const answer: AnswerSpec = { kind: "choice", options, correct: KIND_INDEX[kind] };
  const { out, add } = collector(answer);
  const D = d1(d);
  const say: Record<BondKind, Partial<Record<BondKind, [Text, Text]>>> = {
    nonpolar: {
      polar: [
        tx("Difference too small for polar", "Differenz zu klein für polar"),
        tx(`Look at the numbers again: ΔEN is only ${D.en}. Below ${d1(NONPOLAR_MAX).en} both atoms pull about equally hard.`, `Schau noch mal auf die Zahlen: ΔEN ist nur ${D.de}. Unter ${d1(NONPOLAR_MAX).de} ziehen beide Atome etwa gleich stark.`),
      ],
      ionic: [
        tx("No ions here", "Hier entstehen keine Ionen"),
        tx(`Ions need a big difference (above ${d1(IONIC_MIN).en}), usually a metal and a nonmetal. Here ΔEN is just ${D.en}.`, `Für Ionen braucht es einen großen Unterschied (über ${d1(IONIC_MIN).de}), meist Metall und Nichtmetall. Hier ist ΔEN nur ${D.de}.`),
      ],
    },
    polar: {
      nonpolar: [
        tx("The difference matters", "Die Differenz zählt"),
        tx(`ΔEN = ${D.en} is clearly above ${d1(NONPOLAR_MAX).en}: one atom pulls the shared pair closer than the other.`, `ΔEN = ${D.de} liegt deutlich über ${d1(NONPOLAR_MAX).de}: Ein Atom zieht das gemeinsame Paar stärker zu sich als das andere.`),
      ],
      ionic: [
        tx("Not big enough for ions", "Nicht groß genug für Ionen"),
        tx(`For an ionic bond ΔEN would have to be above ${d1(IONIC_MIN).en}. Here two nonmetal atoms still share their electrons, just unevenly.`, `Für eine Ionenbindung müsste ΔEN über ${d1(IONIC_MIN).de} liegen. Hier teilen sich zwei Nichtmetallatome ihre Elektronen noch, nur ungleich.`),
      ],
    },
    ionic: {
      polar: [
        tx("Too big for sharing", "Zu groß zum Teilen"),
        tx(`ΔEN = ${D.en} is above ${d1(IONIC_MIN).en}. A metal and a nonmetal: the electrons change sides completely.`, `ΔEN = ${D.de} liegt über ${d1(IONIC_MIN).de}. Metall und Nichtmetall: Die Elektronen wechseln ganz die Seite.`),
      ],
      nonpolar: [
        tx("A huge difference", "Ein riesiger Unterschied"),
        tx(`ΔEN = ${D.en} is huge! A metal next to a nonmetal: nothing is shared fairly here.`, `ΔEN = ${D.de} ist riesig! Ein Metall neben einem Nichtmetall: Hier wird nichts fair geteilt.`),
      ],
    },
  };
  for (const [wrong, [title, s]] of Object.entries(say[kind]) as [BondKind, [Text, Text]][]) add({ kind: "choice", options, correct: KIND_INDEX[wrong] }, title, s);
  // The less electronegative atom becomes δ+ (or the cation), the other δ− (or the anion).
  const [plus, minus] = en1(a) >= en1(b) ? [b, a] : [a, b];
  const ion = (sym: string) => ce(ionFormula({ f: sym, charge: atomIon(sym).charge }));
  return {
    instruction: tx("Classify the bond", "Bestimm die Bindungsart"),
    text: txMap((t, l) => `${t(`Which kind of bond forms between **${a}** and **${b}**?`, `Welche Bindung liegt zwischen **${a}** und **${b}** vor?`)}\n\n${(l === "en" ? EN : DE)(enLine(a, b))}`),
    answer,
    hint: tx(`Work out ΔEN. Rule of thumb: below ${d1(NONPOLAR_MAX).en} nonpolar, up to ${d1(IONIC_MIN).en} polar, above that ionic.`, `Berechne ΔEN. Faustregel: unter ${d1(NONPOLAR_MAX).de} unpolar, bis ${d1(IONIC_MIN).de} polar, darüber ionisch.`),
    solution: [
      { math: deltaMath(a, b), note: tx(`The difference in electronegativity: ${D.en}.`, `Der Unterschied in der Elektronegativität: ${D.de}.`) },
      {
        math:
          kind === "polar" ? `${ce(`${plus}^{δ+}`)} - ${ce(`${minus}^{δ-}`)}` : kind === "ionic" ? `${ion(plus)} \\quad ${ion(minus)}` : `${ce(a)} - ${ce(b)}`,
        note:
          kind === "nonpolar"
            ? tx(`Below ${d1(NONPOLAR_MAX).en}: the shared pair stays in the middle. **Nonpolar** covalent bond.`, `Unter ${d1(NONPOLAR_MAX).de}: Das gemeinsame Paar bleibt in der Mitte. **Unpolare** Elektronenpaarbindung.`)
            : kind === "polar"
              ? tx(`Between ${d1(NONPOLAR_MAX).en} and ${d1(IONIC_MIN).en}: ${minus} pulls the pair closer and gets δ−. **Polar** covalent bond.`, `Zwischen ${d1(NONPOLAR_MAX).de} und ${d1(IONIC_MIN).de}: ${minus} zieht das Paar näher zu sich und wird δ−. **Polare** Elektronenpaarbindung.`)
              : tx(`Above ${d1(IONIC_MIN).en}: the electrons change sides completely, ions form. **Ionic bond**.`, `Über ${d1(IONIC_MIN).de}: Die Elektronen wechseln ganz die Seite, es entstehen Ionen. **Ionenbindung**.`),
      },
    ],
    mistakes: out,
  };
}

function partialTask(a: string, b: string, rng: Rng): Exercise {
  const order = rng.chance(0.5) ? [a, b] : [b, a];
  const options: RichText[] = order.map((s) => `$${ce(s)}$`);
  const neg = en1(a) > en1(b) ? a : b;
  const pos = neg === a ? b : a;
  const answer: AnswerSpec = { kind: "choice", options, correct: order.indexOf(neg) };
  const { out, add } = collector(answer);
  add(
    { kind: "choice", options, correct: order.indexOf(pos) },
    tx("The other end", "Das andere Ende"),
    tx("δ− sits where the shared electrons are pulled to: at the atom with the **higher** electronegativity.", "δ− sitzt dort, wohin die gemeinsamen Elektronen gezogen werden: beim Atom mit der **höheren** Elektronegativität."),
  );
  return {
    instruction: tx("Find δ−", "Finde δ−"),
    text: txMap((t, l) => `${t(`In the bond **${bondLabel(a, b)}**, which atom carries the partial negative charge δ−?`, `Welches Atom trägt in der Bindung **${bondLabel(a, b)}** die negative Teilladung δ−?`)}\n\n${(l === "en" ? EN : DE)(enLine(a, b))}`),
    answer,
    hint: tx("Which atom pulls the shared electron pair more strongly?", "Welches Atom zieht das gemeinsame Elektronenpaar stärker an?"),
    solution: [
      { math: deltaMath(a, b), note: tx(`${neg} has the higher electronegativity.`, `${neg} hat die höhere Elektronegativität.`) },
      { math: `${ce(`${pos}^{δ+}`)} - ${ce(`${neg}^{δ-}`)}`, note: tx(`The pair is pulled towards ${neg}: ${neg} is δ−, ${pos} is δ+.`, `Das Paar wird zu ${neg} gezogen: ${neg} ist δ−, ${pos} ist δ+.`) },
    ],
    mistakes: out,
  };
}

function deltaTask(a: string, b: string): Exercise {
  const d = deltaEn(a, b);
  const answer: AnswerSpec = { kind: "number", value: d, tolerance: 0.001 };
  const { out, add } = collector(answer);
  add(
    { kind: "number", value: Math.round((en1(a) + en1(b)) * 10) / 10, tolerance: 0.001 },
    tx("Added instead of subtracted", "Addiert statt subtrahiert"),
    tx("ΔEN is the **difference**: the bigger value minus the smaller one.", "ΔEN ist die **Differenz**: der größere Wert minus der kleinere."),
  );
  return {
    instruction: tx("Calculate ΔEN", "Berechne ΔEN"),
    text: txMap((t, l) => `${t(`Calculate the electronegativity difference for the bond between **${a}** and **${b}**.`, `Berechne die Elektronegativitätsdifferenz für die Bindung zwischen **${a}** und **${b}**.`)}\n\n${(l === "en" ? EN : DE)(enLine(a, b))}`),
    answer,
    hint: tx("Bigger value minus smaller value.", "Größerer Wert minus kleinerer Wert."),
    solution: [
      { math: deltaMath(a, b), note: tx(`ΔEN = ${d1(d).en}.`, `ΔEN = ${d1(d).de}.`) },
      {
        math: { en: `\\Delta${ce("EN")} = ${d1(d).en}`, de: `\\Delta${ce("EN")} = ${d1(d).de}` },
        note: {
          nonpolar: tx(`Below ${d1(NONPOLAR_MAX).en}: a nonpolar bond.`, `Unter ${d1(NONPOLAR_MAX).de}: eine unpolare Bindung.`),
          polar: tx(`Between ${d1(NONPOLAR_MAX).en} and ${d1(IONIC_MIN).en}: a polar covalent bond.`, `Zwischen ${d1(NONPOLAR_MAX).de} und ${d1(IONIC_MIN).de}: eine polare Elektronenpaarbindung.`),
          ionic: tx(`Above ${d1(IONIC_MIN).en}: an ionic bond.`, `Über ${d1(IONIC_MIN).de}: eine Ionenbindung.`),
        }[bondKind(d)],
      },
    ],
    mistakes: out,
  };
}

// ---------------------------------------------------------------------------
// Dipoles

const DIPOLE_OPTIONS: RichText[] = [
  tx("Yes: the bonds are polar and the centres of charge don't coincide.", "Ja: Die Bindungen sind polar und die Ladungsschwerpunkte fallen nicht zusammen."),
  tx("No: the bonds are polar, but the molecule is symmetric, so the partial charges cancel.", "Nein: Die Bindungen sind polar, aber das Molekül ist symmetrisch, also heben sich die Teilladungen auf."),
  tx("No: the bonds are nonpolar.", "Nein: Die Bindungen sind unpolar."),
  tx("Yes: every molecule made of different atoms is a dipole.", "Ja: Jedes Molekül aus verschiedenen Atomen ist ein Dipol."),
];

/** Molecule → index of the right statement. CH₄ is left out (nearly nonpolar and symmetric). */
const DIPOLE_CASES: [string, number][] = [
  ["H2O", 0],
  ["NH3", 0],
  ["HCl", 0],
  ["HBr", 0],
  ["PCl3", 0],
  ["CO2", 1],
  ["CCl4", 1],
  ["CS2", 2],
  ["Cl2", 2],
  ["N2", 2],
];

function dipoleTask(id: string, correct: number): Exercise {
  const m = MOLECULES[id];
  const options = DIPOLE_OPTIONS;
  const answer: AnswerSpec = { kind: "choice", options, correct };
  const { out, add } = collector(answer);
  const shape = m.shape ?? tx("linear", "linear");
  const two = m.atoms.length === 2;
  if (correct === 0) {
    add(
      { kind: "choice", options, correct: 1 },
      tx("Not symmetric", "Nicht symmetrisch"),
      two
        ? tx(`$${ce(m.formula)}$ has just one polar bond: one end δ+, the other δ−. Nothing can cancel that out.`, `$${ce(m.formula)}$ hat nur eine polare Bindung: ein Ende δ+, das andere δ−. Da kann sich nichts aufheben.`)
        : tx(`Look at the shape: $${ce(m.formula)}$ is ${EN(shape)}. The δ+ and δ− ends don't balance each other out.`, `Schau auf die Form: $${ce(m.formula)}$ ist ${DE(shape)}. Die δ+- und δ−-Seiten gleichen sich nicht aus.`),
    );
    add(
      { kind: "choice", options, correct: 2 },
      tx("The bonds are polar", "Die Bindungen sind polar"),
      tx("Check the electronegativities: the atoms are different enough, so the bonds **are** polar.", "Prüf die Elektronegativitäten: Die Atome unterscheiden sich genug, die Bindungen **sind** polar."),
    );
    add(
      { kind: "choice", options, correct: 3 },
      tx("Right answer, wrong reason", "Richtig, aber falsch begründet"),
      tx("It is a dipole, but not for that reason: $\\ce{CO2}$ has different atoms too and isn't a dipole. What really matters is the shape.", "Es ist ein Dipol, aber nicht deshalb: $\\ce{CO2}$ hat auch verschiedene Atome und ist kein Dipol. Entscheidend ist die Form."),
    );
  } else if (correct === 1) {
    add(
      { kind: "choice", options, correct: 0 },
      tx("Polar bonds alone aren't enough", "Polare Bindungen reichen nicht"),
      tx(`The bonds are polar, true. But $${ce(m.formula)}$ is ${EN(shape)} and perfectly symmetric: the partial charges cancel out.`, `Die Bindungen sind polar, stimmt. Aber $${ce(m.formula)}$ ist ${DE(shape)} und völlig symmetrisch: Die Teilladungen heben sich auf.`),
    );
    add(
      { kind: "choice", options, correct: 3 },
      tx("Different atoms aren't enough", "Verschiedene Atome reichen nicht"),
      tx("Different atoms give polar bonds, but the shape decides. In a symmetric molecule the charge centres coincide.", "Verschiedene Atome ergeben polare Bindungen, aber die Form entscheidet. In einem symmetrischen Molekül fallen die Ladungsschwerpunkte zusammen."),
    );
    add(
      { kind: "choice", options, correct: 2 },
      tx("These bonds are polar", "Diese Bindungen sind polar"),
      tx("Right that it's no dipole, but the bonds themselves are polar. Compare the electronegativities.", "Richtig, kein Dipol, aber die Bindungen selbst sind polar. Vergleich die Elektronegativitäten."),
    );
  } else {
    add(
      { kind: "choice", options, correct: 0 },
      tx("No polar bonds", "Keine polaren Bindungen"),
      tx("Without polar bonds there are no partial charges at all. Compare the electronegativities of the atoms.", "Ohne polare Bindungen gibt es gar keine Teilladungen. Vergleich die Elektronegativitäten der Atome."),
    );
    add(
      { kind: "choice", options, correct: 1 },
      tx("Check the bonds first", "Prüf zuerst die Bindungen"),
      tx("No dipole, right. But the reason is simpler: the bonds aren't polar in the first place.", "Kein Dipol, richtig. Aber der Grund ist einfacher: Die Bindungen sind gar nicht erst polar."),
    );
    add(
      { kind: "choice", options, correct: 3 },
      tx("Not a dipole", "Kein Dipol"),
      tx("Without polar bonds there's nothing that could make a dipole.", "Ohne polare Bindungen kann gar kein Dipol entstehen."),
    );
  }
  const els = [...new Set(m.atoms.map((a) => a.el))];
  const [x, y] = els.length > 1 ? els : [els[0], els[0]];
  return {
    instruction: tx("Dipole or not?", "Dipol oder nicht?"),
    text: txMap((t, l) => `${t(`Is $${ce(m.formula)}$ a dipole molecule?`, `Ist $${ce(m.formula)}$ ein Dipolmolekül?`)}\n\n${(l === "en" ? EN : DE)(enLine(x, y))}`),
    answer,
    hint: tx("Two questions: are the bonds polar? And is the molecule symmetric?", "Zwei Fragen: Sind die Bindungen polar? Und ist das Molekül symmetrisch?"),
    solution: [
      {
        math: deltaMath(x, y),
        note:
          correct === 2
            ? tx("Practically no difference in electronegativity: the bonds are nonpolar.", "Praktisch kein Unterschied in der Elektronegativität: Die Bindungen sind unpolar.")
            : tx("The bonds are polar.", "Die Bindungen sind polar."),
      },
      {
        math: ce(m.formula),
        note:
          correct === 0
            ? two
              ? tx("One end δ+, the other δ−: the centres of positive and negative charge are apart. A **dipole**.", "Ein Ende δ+, das andere δ−: Die Schwerpunkte der positiven und negativen Ladung liegen auseinander. Ein **Dipol**.")
              : tx(`The molecule is ${EN(shape)}: the centres of positive and negative charge are apart. A **dipole**.`, `Das Molekül ist ${DE(shape)}: Die Schwerpunkte der positiven und negativen Ladung liegen auseinander. Ein **Dipol**.`)
            : correct === 1
              ? tx(`But the molecule is ${EN(shape)} and symmetric: the partial charges cancel. **No dipole**.`, `Aber das Molekül ist ${DE(shape)} und symmetrisch: Die Teilladungen heben sich auf. **Kein Dipol**.`)
              : tx("No partial charges, so **no dipole**.", "Keine Teilladungen, also **kein Dipol**."),
      },
    ],
    mistakes: out,
    visual: lewisVisual(id, true),
  };
}

const POLAR_MOLS = ["HCl", "H2O", "NH3", "HBr", "CO2", "PCl3"];
const IONIC_SALTS = ["NaCl", "KBr", "MgO", "CaF2", "LiF"];
const NONPOLAR_MOLS = ["Cl2", "N2", "O2", "H2", "Br2", "CS2"];

function polarMultiTask(rng: Rng): Exercise {
  const polar = rng.shuffle(POLAR_MOLS).slice(0, rng.int(2, 3));
  const ionic = rng.shuffle(IONIC_SALTS).slice(0, rng.int(1, 2));
  const nonpolar = rng.shuffle(NONPOLAR_MOLS).slice(0, 6 - polar.length - ionic.length);
  const all = rng.shuffle([...polar, ...ionic, ...nonpolar]);
  const options: RichText[] = all.map((f) => `$${ce(f)}$`);
  const correct = all.map((f, i) => (polar.includes(f) ? i : -1)).filter((i) => i >= 0);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const { out, add } = collector(answer);
  const idx = (list: string[]) => all.map((f, i) => (list.includes(f) ? i : -1)).filter((i) => i >= 0);
  add(
    { kind: "multi", options, correct: idx([...polar, ...ionic]) },
    tx("Salts picked too", "Salze mitgewählt"),
    tx("Careful with metal + nonmetal: there ΔEN is above 1.7. Those are ionic bonds, not covalent ones.", "Vorsicht bei Metall + Nichtmetall: Dort ist ΔEN über 1,7. Das sind Ionenbindungen, keine Elektronenpaarbindungen."),
  );
  if (polar.includes("CO2"))
    add(
      { kind: "multi", options, correct: idx(polar.filter((f) => f !== "CO2")) },
      tx("CO₂ forgotten", "CO₂ vergessen"),
      tx("$\\ce{CO2}$ isn't a dipole, but its C=O bonds are polar: ΔEN = 0.8. The question is about the bonds.", "$\\ce{CO2}$ ist kein Dipol, aber seine C=O-Bindungen sind polar: ΔEN = 0,8. Gefragt ist nach den Bindungen."),
    );
  if (nonpolar.includes("CS2"))
    add(
      { kind: "multi", options, correct: idx([...polar, "CS2"]) },
      tx("CS₂ looks polar", "CS₂ sieht polar aus"),
      tx("$\\ce{CS2}$ has different atoms, but C and S have the same electronegativity (2.6). Its bonds are nonpolar.", "$\\ce{CS2}$ hat verschiedene Atome, aber C und S haben dieselbe Elektronegativität (2,6). Seine Bindungen sind unpolar."),
    );
  add(
    { kind: "multi", options, correct: idx([...polar, ...nonpolar.filter((f) => f !== "CS2")]) },
    tx("Equal atoms aren't polar", "Gleiche Atome sind nicht polar"),
    tx("Two identical atoms pull exactly equally hard. Molecules like $\\ce{Cl2}$ have nonpolar bonds.", "Zwei gleiche Atome ziehen genau gleich stark. Moleküle wie $\\ce{Cl2}$ haben unpolare Bindungen."),
  );
  return {
    instruction: tx("Select all that apply", "Wähl alle passenden aus"),
    text: tx("Which substances contain **polar covalent bonds**?", "Welche Stoffe enthalten **polare Elektronenpaarbindungen**?"),
    answer,
    hint: tx("Sort them first: metal + nonmetal (ionic), equal or similar atoms (nonpolar), different nonmetals (polar).", "Sortier zuerst: Metall + Nichtmetall (ionisch), gleiche oder ähnliche Atome (unpolar), verschiedene Nichtmetalle (polar)."),
    solution: [
      { math: polar.map(ce).join(" \\quad "), note: tx("Different nonmetal atoms with ΔEN between 0.4 and 1.7: polar.", "Verschiedene Nichtmetallatome mit ΔEN zwischen 0,4 und 1,7: polar.") },
      { math: ionic.map(ce).join(" \\quad "), note: tx("Metal + nonmetal, ΔEN above 1.7: ionic bonds.", "Metall + Nichtmetall, ΔEN über 1,7: Ionenbindungen.") },
      { math: nonpolar.map(ce).join(" \\quad "), note: tx("Equal atoms or (almost) equal EN: nonpolar.", "Gleiche Atome oder (fast) gleiche EN: unpolar.") },
    ],
    mistakes: out,
  };
}

// ---------------------------------------------------------------------------
// Generator

const DIATOMIC = ["H2", "F2", "Cl2", "Br2", "I2", "HCl", "HF", "HBr", "O2", "N2", "O2", "N2"];
const SMALL = ["H2O", "NH3", "CH4", "HCl", "Cl2", "N2", "O2", "CO2", "HF", "H2S", "PH3"];
const SKELETON_2 = ["H2O", "NH3", "HCl", "Cl2", "CO2", "N2", "O2", "H2S", "PH3", "HF", "HBr", "F2", "CS2"];
const SKELETON_3 = ["CCl4", "PCl3", "NCl3", "HCN", "CO2", "CS2"];
const VALENCE_MOLS = ["H2O", "NH3", "CH4", "CO2", "N2", "O2", "Cl2", "HCl", "H2S", "PH3", "CCl4", "HCN", "PCl3", "CS2", "SiH4"];

function level1(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.3) return valencyTask(rng.pick(VALENCY_ELEMENTS));
  if (r < 0.5) return bondOrderTask(rng.pick(DIATOMIC));
  if (r < 0.7) return partialTask(...rng.pick(POLAR_PAIRS), rng);
  if (r < 0.85) return lonePairTask(rng.pick(SMALL), false);
  return bondingPairTask(rng.pick(["H2O", "NH3", "CH4", "CO2", "N2", "O2", "HCN"]));
}

function level2(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.26) return formulaTask(...rng.pick(FORMULA_PAIRS_2));
  if (r < 0.44) return valenceTask(rng.pick(VALENCE_MOLS));
  if (r < 0.62) return lonePairTask(rng.pick(SKELETON_2), true);
  if (r < 0.86) {
    const pool = rng.pick([POLAR_PAIRS, POLAR_PAIRS, NONPOLAR_PAIRS, IONIC_PAIRS]);
    const [a, b] = rng.pick(pool);
    return rng.chance(0.5) ? classifyTask(a, b) : classifyTask(b, a);
  }
  const [a, b] = rng.pick([...POLAR_PAIRS, ...IONIC_PAIRS]);
  return deltaTask(a, b);
}

function level3(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.3) return dipoleTask(...rng.pick(DIPOLE_CASES));
  if (r < 0.5) return polarMultiTask(rng);
  if (r < 0.68) return lonePairTask(rng.pick(SKELETON_3), true);
  if (r < 0.86) return formulaTask(...rng.pick(FORMULA_PAIRS_3));
  const [a, b] = rng.pick([...POLAR_PAIRS, ...NONPOLAR_PAIRS, ...IONIC_PAIRS]);
  return classifyTask(a, b);
}

function generate(level: Level, rng: Rng): Exercise {
  return level === 1 ? level1(rng) : level === 2 ? level2(rng) : level3(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const valencyFramesLesson: Frame[] = [
  { math: `${ce("Cl")} : \\; 8#e - 7#v = 1#n`, note: tx("**Chlorine**, main group VII: 1 electron is missing, so **1 bond**.", "**Chlor**, Hauptgruppe VII: Es fehlt 1 Elektron, also **1 Bindung**.") },
  { math: `${ce("O")} : \\; 8#e - 6#v = 2#n`, note: tx("**Oxygen**, main group VI: 2 missing, **2 bonds**.", "**Sauerstoff**, Hauptgruppe VI: 2 fehlen, **2 Bindungen**.") },
  { math: `${ce("N")} : \\; 8#e - 5#v = 3#n`, note: tx("**Nitrogen**, main group V: **3 bonds**.", "**Stickstoff**, Hauptgruppe V: **3 Bindungen**.") },
  { math: `${ce("C")} : \\; 8#e - 4#v = 4#n`, note: tx("**Carbon**, main group IV: **4 bonds**.", "**Kohlenstoff**, Hauptgruppe IV: **4 Bindungen**.") },
  { math: `${ce("H")} : \\; 2#e - 1#v = 1#n`, note: tx("**Hydrogen** only fills up to 2, like helium (duet rule): **1 bond**.", "**Wasserstoff** füllt nur bis 2 auf, wie Helium (Duettregel): **1 Bindung**.") },
  {
    math: `${ce("HCl")} \\quad ${ce("H2O")} \\quad ${ce("NH3")} \\quad ${ce("CH4")}`,
    note: tx("That's why the hydrogen compounds look like this: one H for Cl, two for O, three for N, four for C.", "Deshalb sehen die Wasserstoffverbindungen so aus: ein H für Cl, zwei für O, drei für N, vier für C."),
  },
];

const recipeFrames: Frame[] = [
  { math: `${ce("NH3")} : \\; 5 + 3 \\cdot 1 = 8#t`, note: tx("**1.** Count the outer electrons: N brings 5, each H brings 1. That's 8.", "**1.** Zähl die Valenzelektronen: N bringt 5 mit, jedes H 1. Das sind 8.") },
  { math: `8#t : 2 = 4#p`, note: tx("**2.** Make pairs: 4 electron pairs.", "**2.** Bilde Paare: 4 Elektronenpaare.") },
  {
    math: `4#p = 3#b + 1#l`,
    note: tx("**3.** Three pairs make the N–H bonds. **4.** The last pair stays at N as a lone pair. Check: N has 8, each H has 2.", "**3.** Drei Paare bilden die N–H-Bindungen. **4.** Das letzte Paar bleibt als freies Paar am N. Check: N hat 8, jedes H 2."),
  },
  { math: `${ce("N2")} : \\; 2 \\cdot 5 = 10#t \\quad \\to \\quad 5#p`, note: tx("Now nitrogen, $\\ce{N2}$: 10 outer electrons, 5 pairs.", "Jetzt Stickstoff, $\\ce{N2}$: 10 Valenzelektronen, 5 Paare.") },
  {
    math: `5#p = 3#b + 2#l`,
    note: tx(
      "With one shared pair each N would have only 6 electrons around it. Each N is missing 3: so they share **3 pairs**, a **triple bond**. One lone pair per N is left.",
      "Mit einem gemeinsamen Paar hätte jedes N nur 6 Elektronen um sich. Jedem N fehlen 3: Also teilen sie **3 Paare**, eine **Dreifachbindung**. Pro N bleibt ein freies Paar.",
    ),
  },
  {
    math: `${ce("O2")} : \\; 2 \\cdot 6 = 12#t \\quad \\to \\quad 6#p = 2#b + 4#l`,
    note: tx("Oxygen is missing 2 per atom: a **double bond** and two lone pairs on each O.", "Sauerstoff fehlen pro Atom 2: eine **Doppelbindung** und an jedem O zwei freie Paare."),
  },
];

const enFrames: Frame[] = [
  {
    math: tx(`${ce("H")} : 2.2 \\quad ${ce("Cl")} : 3.2`, `${ce("H")} : 2,2 \\quad ${ce("Cl")} : 3,2`),
    note: tx("Hydrogen chloride: chlorine has the higher electronegativity.", "Chlorwasserstoff: Chlor hat die höhere Elektronegativität."),
  },
  { math: deltaMath("H", "Cl"), note: tx("The difference is ΔEN = 1.0.", "Die Differenz ist ΔEN = 1,0.") },
  {
    math: `${ce("H^{δ+}")} - ${ce("Cl^{δ-}")}`,
    note: tx(
      "Chlorine pulls the shared pair closer: it gets a partial negative charge **δ−**, hydrogen **δ+**. A **polar** covalent bond.",
      "Chlor zieht das gemeinsame Paar näher zu sich: Es bekommt eine negative Teilladung **δ−**, Wasserstoff **δ+**. Eine **polare** Elektronenpaarbindung.",
    ),
  },
  {
    math: `${ce("Cl")} - ${ce("Cl")} : \\; \\Delta${ce("EN")} = 0`,
    note: tx("Two equal atoms pull equally hard: the pair stays in the middle. A **nonpolar** bond.", "Zwei gleiche Atome ziehen gleich stark: Das Paar bleibt in der Mitte. Eine **unpolare** Bindung."),
  },
];

function dipoleMultiLesson(): Exercise {
  const list = ["H2O", "CO2", "NH3", "CH4"];
  const options: RichText[] = list.map((f) => `$${ce(f)}$`);
  const answer: AnswerSpec = { kind: "multi", options, correct: [0, 2] };
  const { out, add } = collector(answer);
  add(
    { kind: "multi", options, correct: [0, 1, 2] },
    tx("CO₂ is symmetric", "CO₂ ist symmetrisch"),
    tx("$\\ce{CO2}$ has polar bonds, but it's linear: the two δ− ends cancel each other. No dipole!", "$\\ce{CO2}$ hat polare Bindungen, aber es ist linear: Die beiden δ−-Enden heben sich auf. Kein Dipol!"),
  );
  add(
    { kind: "multi", options, correct: [0] },
    tx("NH₃ forgotten", "NH₃ vergessen"),
    tx("Look at ammonia again: it's a pyramid with the lone pair on top. δ− at N, δ+ at the H atoms below.", "Schau dir Ammoniak noch mal an: Es ist eine Pyramide mit dem freien Paar oben. δ− am N, δ+ an den H-Atomen darunter."),
  );
  add(
    { kind: "multi", options, correct: [0, 1, 2, 3] },
    tx("Not every molecule", "Nicht jedes Molekül"),
    tx("Not all of them! Symmetric molecules like $\\ce{CO2}$ and $\\ce{CH4}$ aren't dipoles.", "Nicht alle! Symmetrische Moleküle wie $\\ce{CO2}$ und $\\ce{CH4}$ sind keine Dipole."),
  );
  add(
    { kind: "multi", options, correct: [0, 2, 3] },
    tx("CH₄ is symmetric", "CH₄ ist symmetrisch"),
    tx("$\\ce{CH4}$ has nearly nonpolar bonds and is a perfect tetrahedron. No dipole.", "$\\ce{CH4}$ hat nahezu unpolare Bindungen und ist ein perfektes Tetraeder. Kein Dipol."),
  );
  return {
    instruction: tx("Select all that apply", "Wähl alle passenden aus"),
    text: tx("Which of these molecules are dipoles?", "Welche dieser Moleküle sind Dipole?"),
    answer,
    hint: tx("Polar bonds **and** an unsymmetric shape. Which ones are bent or a pyramid?", "Polare Bindungen **und** eine unsymmetrische Form. Welche sind gewinkelt oder eine Pyramide?"),
    solution: [
      { math: `${ce("H2O")} \\quad ${ce("NH3")}`, note: tx("Water (bent) and ammonia (pyramid): the charge centres are apart. Dipoles.", "Wasser (gewinkelt) und Ammoniak (Pyramide): Die Ladungsschwerpunkte liegen auseinander. Dipole.") },
      { math: `${ce("CO2")} \\quad ${ce("CH4")}`, note: tx("Carbon dioxide (linear) and methane (tetrahedral) are symmetric: no dipoles.", "Kohlenstoffdioxid (linear) und Methan (tetraedrisch) sind symmetrisch: keine Dipole.") },
    ],
    mistakes: out,
  };
}

const covalentBonds: Topic = {
  ...topicMeta("covalent-bonds"),
  summary: [
    {
      title: tx("The covalent bond", "Die Elektronenpaarbindung"),
      body: tx(
        "Nonmetal atoms share **electron pairs**. A shared pair counts for both atoms, so both reach the octet (hydrogen: 2).",
        "Nichtmetallatome teilen sich **Elektronenpaare**. Ein gemeinsames Paar zählt für beide Atome, so erreichen beide das Oktett (Wasserstoff: 2).",
      ),
      examples: [ce("H + H -> H2"), ce("Cl + Cl -> Cl2")],
      tone: "rule",
    },
    {
      title: tx("Valency", "Bindigkeit"),
      body: tx("Bonds = electrons missing to the octet = 8 minus the main group number. Hydrogen: 1.", "Bindungen = Elektronen, die bis zum Oktett fehlen = 8 minus Hauptgruppennummer. Wasserstoff: 1."),
      examples: [`${ce("H")}: 1 \\quad ${ce("O")}: 2 \\quad ${ce("N")}: 3 \\quad ${ce("C")}: 4`, `${ce("H2O")} \\quad ${ce("NH3")} \\quad ${ce("CH4")}`],
      tone: "rule",
    },
    {
      title: tx("Lewis formula in 4 steps", "Lewis-Formel in 4 Schritten"),
      body: tx(
        "1. Count the outer electrons. 2. Halve: electron pairs. 3. Bonding pairs between the atoms. 4. The rest as lone pairs, until every atom has 8 (H: 2).",
        "1. Valenzelektronen zählen. 2. Halbieren: Elektronenpaare. 3. Bindende Paare zwischen die Atome. 4. Den Rest als freie Paare verteilen, bis jedes Atom 8 hat (H: 2).",
      ),
      examples: [`${ce("NH3")}: 5 + 3 \\cdot 1 = 8 \\to 4 = 3 + 1`, `${ce("CO2")}: 4 + 2 \\cdot 6 = 16 \\to 8 = 4 + 4`],
      tone: "tip",
    },
    {
      title: tx("Multiple bonds", "Mehrfachbindungen"),
      body: tx("If one shared pair isn't enough for the octet, atoms share two (double bond) or three (triple bond).", "Reicht ein gemeinsames Paar nicht fürs Oktett, teilen die Atome zwei (Doppelbindung) oder drei (Dreifachbindung)."),
      examples: [tx(`${ce("Cl2")}: "single" \\quad ${ce("O2")}: "double" \\quad ${ce("N2")}: "triple"`, `${ce("Cl2")}: "einfach" \\quad ${ce("O2")}: "doppelt" \\quad ${ce("N2")}: "dreifach"`)],
      tone: "rule",
    },
    {
      title: tx("Electronegativity and polarity", "Elektronegativität und Polarität"),
      body: tx(
        "Rule of thumb for ΔEN: below 0.4 nonpolar, 0.4 to 1.7 polar (δ+ / δ−), above 1.7 ionic. The more electronegative atom gets δ−.",
        "Faustregel für ΔEN: unter 0,4 unpolar, 0,4 bis 1,7 polar (δ+ / δ−), über 1,7 ionisch. Das elektronegativere Atom wird δ−.",
      ),
      examples: [tx(`${ce("Cl2")}: 0 \\quad ${ce("HCl")}: 1.0 \\quad ${ce("NaCl")}: 2.3`, `${ce("Cl2")}: 0 \\quad ${ce("HCl")}: 1,0 \\quad ${ce("NaCl")}: 2,3`), `${ce("H^{δ+}")} - ${ce("Cl^{δ-}")}`],
      tone: "rule",
    },
    {
      title: tx("Polar bonds don't make every molecule a dipole", "Polare Bindungen machen noch keinen Dipol"),
      body: tx(
        "A dipole needs polar bonds **and** an unsymmetric shape. $\\ce{CO2}$ is linear, so its partial charges cancel. Bent $\\ce{H2O}$ is a dipole.",
        "Ein Dipol braucht polare Bindungen **und** eine unsymmetrische Form. $\\ce{CO2}$ ist linear, die Teilladungen heben sich auf. Das gewinkelte $\\ce{H2O}$ ist ein Dipol.",
      ),
      examples: [tx(`${ce("H2O")}, ${ce("NH3")}, ${ce("HCl")}: "dipole"`, `${ce("H2O")}, ${ce("NH3")}, ${ce("HCl")}: "Dipol"`), tx(`${ce("CO2")}, ${ce("CH4")}, ${ce("CCl4")}: "no dipole"`, `${ce("CO2")}, ${ce("CH4")}, ${ce("CCl4")}: "kein Dipol"`)],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "widget",
      title: tx("Sharing instead of giving", "Teilen statt abgeben"),
      blob: tx("Two nonmetal atoms, both hungry for electrons. Who gives one away? Nobody. They share!", "Zwei Nichtmetallatome, beide wollen Elektronen. Wer gibt eins ab? Keiner. Sie teilen!"),
      body: tx(
        "Between nonmetal atoms no electrons change sides. Instead each atom puts a single electron into a **shared electron pair**. This **covalent bond** holds the atoms together in a **molecule**. Press the button!",
        "Zwischen Nichtmetallatomen wechseln keine Elektronen die Seite. Stattdessen steuert jedes Atom ein einzelnes Elektron zu einem **gemeinsamen Elektronenpaar** bei. Diese **Elektronenpaarbindung** (Atombindung) hält die Atome im **Molekül** zusammen. Drück den Knopf!",
      ),
      widget: CovalentBondsShare,
    },
    {
      type: "explain",
      title: tx("How many bonds? The valency", "Wie viele Bindungen? Die Bindigkeit"),
      blob: tx("Count what's missing to 8. That's how many bonds an atom forms.", "Zähl, was bis 8 fehlt. So viele Bindungen bildet das Atom."),
      body: tx(
        "Each bond brings one more electron to the atom. So an atom forms as many bonds as it is missing electrons for the octet. This number is called the **valency** (Bindigkeit).",
        "Jede Bindung bringt dem Atom ein Elektron mehr. Ein Atom bildet also so viele Bindungen, wie ihm Elektronen bis zum Oktett fehlen. Diese Zahl heißt **Bindigkeit**.",
      ),
      frames: valencyFramesLesson,
    },
    {
      type: "check",
      blob: tx("Sulfur sits right below oxygen. Does that help?", "Schwefel steht direkt unter Sauerstoff. Hilft dir das?"),
      exercise: formulaTask("S", "H"),
    },
    {
      type: "explain",
      title: tx("Lewis formulas step by step", "Lewis-Formeln Schritt für Schritt"),
      blob: tx("Four steps, and every Lewis formula works out. Promise!", "Vier Schritte, und jede Lewis-Formel klappt. Versprochen!"),
      body: tx(
        "In a **Lewis formula** every bonding pair is a line between two atoms. **Lone pairs** belong to one atom only. If single bonds aren't enough for the octet, atoms share two or three pairs: **double** and **triple bonds**.",
        "In einer **Lewis-Formel** ist jedes bindende Elektronenpaar ein Strich zwischen zwei Atomen. **Freie Elektronenpaare** gehören nur zu einem Atom. Reichen Einfachbindungen nicht fürs Oktett, teilen Atome zwei oder drei Paare: **Doppel-** und **Dreifachbindungen**.",
      ),
      frames: recipeFrames,
    },
    {
      type: "widget",
      title: tx("Explore Lewis formulas", "Lewis-Formeln erkunden"),
      blob: tx("Switch between dots and lines, and let me check the octet for you.", "Schalte zwischen Punkten und Strichen um und lass mich das Oktett für dich prüfen."),
      body: tx(
        "Pick a molecule. With **Check the octet**, each ring shows all the electrons around one atom: the shared pairs count in both rings.",
        "Wähl ein Molekül. Mit **Oktett prüfen** zeigt jeder Ring alle Elektronen um ein Atom: Die gemeinsamen Paare zählen in beiden Ringen mit.",
      ),
      widget: CovalentBondsLewisLab,
    },
    {
      type: "check",
      blob: tx("Your turn! Fill in the lone pairs in water, in your head.", "Du bist dran! Ergänz die freien Paare im Wasser, im Kopf."),
      exercise: lonePairTask("H2O", true),
    },
    {
      type: "explain",
      title: tx("Electronegativity: who pulls harder?", "Elektronegativität: Wer zieht stärker?"),
      blob: tx("Not all atoms share fairly. Some pull the pair closer!", "Nicht alle Atome teilen fair. Manche ziehen das Paar näher zu sich!"),
      body: tx(
        "**Electronegativity** (EN) measures how strongly an atom attracts the shared electrons of a bond. It increases from left to right in a period and from bottom to top in a group. Fluorine is the champion (4.0).",
        "Die **Elektronegativität** (EN) gibt an, wie stark ein Atom die gemeinsamen Elektronen einer Bindung anzieht. Sie steigt in einer Periode von links nach rechts und in einer Hauptgruppe von unten nach oben. Spitzenreiter ist Fluor (4,0).",
      ),
      frames: enFrames,
    },
    {
      type: "widget",
      title: tx("From nonpolar to ionic", "Von unpolar bis ionisch"),
      blob: tx("Drag the slider and watch the electron pair. At some point it just jumps over!", "Zieh am Regler und beobachte das Elektronenpaar. Irgendwann springt es einfach rüber!"),
      body: tx(
        "The difference ΔEN decides the kind of bond. Rule of thumb: below 0.4 nonpolar, 0.4 to 1.7 polar, above 1.7 ionic. The borders are fuzzy, not sharp.",
        "Die Differenz ΔEN entscheidet über die Bindungsart. Faustregel: unter 0,4 unpolar, 0,4 bis 1,7 polar, über 1,7 ionisch. Die Grenzen sind fließend.",
      ),
      widget: CovalentBondsPolarity,
    },
    {
      type: "check",
      blob: tx("Nitrogen and hydrogen, like in ammonia. What kind of bond?", "Stickstoff und Wasserstoff, wie im Ammoniak. Welche Bindung?"),
      exercise: classifyTask("N", "H"),
    },
    {
      type: "widget",
      title: tx("Dipole molecules", "Dipolmoleküle"),
      blob: tx("Polar bonds are only half the story. The shape decides!", "Polare Bindungen sind nur die halbe Geschichte. Die Form entscheidet!"),
      body: tx(
        "A molecule is a **dipole** if it has polar bonds and its centres of positive and negative charge don't coincide. In symmetric molecules the partial charges cancel out.",
        "Ein Molekül ist ein **Dipol**, wenn es polare Bindungen hat und die Schwerpunkte der positiven und negativen Ladung nicht zusammenfallen. In symmetrischen Molekülen heben sich die Teilladungen auf.",
      ),
      widget: CovalentBondsDipole,
    },
    {
      type: "check",
      blob: tx("Last one! Think about the shapes you just saw.", "Die letzte! Denk an die Formen, die du gerade gesehen hast."),
      exercise: dipoleMultiLesson(),
    },
  ],
  generate,
};

export default covalentBonds;
