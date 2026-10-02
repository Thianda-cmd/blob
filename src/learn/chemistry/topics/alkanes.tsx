"use client";

import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { topicMeta } from "@/learn/catalog";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Mistake, Topic } from "@/learn/types";
import {
  alkaneAccept,
  alkaneFormula,
  alkaneName,
  BOIL,
  BOIL_BRANCHED,
  condensedLine,
  formatName,
  graphOf,
  ISOMERS,
  MELT,
  nameOf,
  PARENT_DE,
  PARENT_EN,
  partsOf,
  STATE_NAME,
  stateAt,
  wrongNames,
  type Skeleton,
  type State,
  type WrongName,
} from "../alkanes-core";
import { balanceMistakes, gcdOf, solve, strategy } from "../balancing-core";
import { AlkanesBoiling } from "../visuals/AlkanesBoiling";
import { AlkanesBranchBuilder, AlkanesBuilder } from "../visuals/AlkanesBuilder";
import { visual } from "../visuals/AtomsVisuals";
import { AlkaneDrawing } from "../visuals/AlkanesStructure";

// ---------------------------------------------------------------------------
// Helpers

const en = (t: Text) => resolveText(t, "en");
const de = (t: Text) => resolveText(t, "de");
/** Formula text: "C5H12", "CH4". */
const fml = (c: number, h: number) => `C${c === 1 ? "" : c}H${h}`;

/** Options with the right one first; shuffled when an rng is given. Wrong options with `say` become mistakes. */
type Opt = { text: Text; title?: Text; say?: Text; close?: boolean };
function choice(rng: Rng | null, opts: Opt[]) {
  const order = rng ? rng.shuffle(opts.map((_, i) => i)) : opts.map((_, i) => i);
  const options = order.map((i) => opts[i].text);
  const correct = order.indexOf(0);
  const mistakes: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (i !== 0 && o.say) mistakes.push({ when: { kind: "choice", options, correct: at }, title: o.title, say: o.say, ...(o.close ? { close: true } : {}) });
  });
  return { answer: { kind: "choice", options, correct } as AnswerSpec, mistakes };
}

/** Number mistakes, each kept only when it differs from the answer and the others. */
function numberMistakes(value: number) {
  const list: Mistake[] = [];
  const add = (v: number, title: Text, say: Text, close = false) => {
    if (!Number.isFinite(v) || v <= 0 || v === value || list.some((m) => m.when.kind === "number" && m.when.value === v)) return;
    list.push({ when: { kind: "number", value: v }, title, say, ...(close ? { close: true } : {}) });
  };
  return { list, add };
}

const draw = (skeleton: Skeleton, full = false) => visual(AlkaneDrawing, { skeleton, full });

// ---------------------------------------------------------------------------
// Molecular formula mistakes (alkanes: CnH2n+2)

function formulaMistakes(n: number, opts: { mainChain?: number; nameGiven?: boolean } = {}): Mistake[] {
  const out: Mistake[] = [];
  const right = fml(n, 2 * n + 2);
  const add = (f: string, title: Text, say: Text, close = false) => {
    if (f === right || out.some((m) => m.when.kind === "formula" && m.when.value === f)) return;
    out.push({ when: { kind: "formula", value: f }, title, say, ...(close ? { close: true } : {}) });
  };
  if (opts.mainChain && opts.mainChain !== n) {
    const L = opts.mainChain;
    add(
      fml(L, 2 * L + 2),
      tx("Only the main chain", "Nur die Hauptkette"),
      tx(
        "That's the formula of the main chain alone. The side chains bring carbon and hydrogen atoms too: count **every** C atom, then use $\\ce{C}_n\\ce{H}_{2n+2}$.",
        "Das ist die Formel der Hauptkette allein. Die Seitenketten bringen aber auch C- und H-Atome mit: Zähl **alle** C-Atome und nimm dann $\\ce{C}_n\\ce{H}_{2n+2}$.",
      ),
    );
    if (L + 1 !== n)
      add(
        fml(L + 1, 2 * L + 4),
        tx("Side chains counted once", "Seitenketten nur einmal gezählt"),
        tx("Careful with **di** and **tri**: dimethyl means two methyl groups, so two extra C atoms. Ethyl brings two C atoms.", "Vorsicht bei **di** und **tri**: Dimethyl heißt zwei Methylgruppen, also zwei C-Atome mehr. Ethyl bringt zwei C-Atome mit."),
      );
  }
  add(
    fml(n, 2 * n),
    tx("CₙH₂ₙ isn't an alkane", "CₙH₂ₙ ist kein Alkan"),
    tx(
      "Nearly! Two H atoms are missing. Every C atom carries two H atoms, and the two **ends** of the chain carry one extra each: $2n + 2$.",
      "Fast! Da fehlen zwei H-Atome. Jedes C-Atom trägt zwei H-Atome, und die beiden **Kettenenden** tragen je eins mehr: $2n + 2$.",
    ),
    true,
  );
  add(
    fml(n, 2 * n + 1),
    tx("One end forgotten", "Ein Ende vergessen"),
    tx("So close! You added the extra H for one end of the chain, but a chain has **two** ends.", "Ganz knapp! Du hast das zusätzliche H für ein Kettenende dazugezählt, aber eine Kette hat **zwei** Enden."),
    true,
  );
  if (n > 1)
    add(
      fml(n, 4 * n),
      tx("Not every bond goes to H", "Nicht jede Bindung geht zu H"),
      tx(
        "Carbon does form four bonds, but not all of them go to hydrogen: the C atoms of the chain are also bonded to each other.",
        "Kohlenstoff bildet zwar vier Bindungen, aber nicht alle gehen zu Wasserstoff: Die C-Atome der Kette sind auch miteinander verbunden.",
      ),
    );
  if (opts.nameGiven) {
    for (const m of [n - 1, n + 1]) {
      if (m < 1 || m > 12) continue;
      add(
        fml(m, 2 * m + 2),
        tx("Counted one off", "Um eins verzählt"),
        tx(
          `That's ${PARENT_EN[m - 1]}, the neighbour in the series. The stem tells you the number of C atoms: meth 1, eth 2, prop 3, but 4, pent 5…`,
          `Das ist ${PARENT_DE[m - 1]}, der Nachbar in der Reihe. Der Wortstamm verrät die Zahl der C-Atome: Meth 1, Eth 2, Prop 3, But 4, Pent 5 …`,
        ),
      );
    }
  }
  // Any other hydrogen count nearby: say what the rule is, instead of a generic note.
  for (let h = Math.max(1, 2 * n - 4); h <= 2 * n + 6; h++)
    add(
      fml(n, h),
      tx("Check the H atoms", "Prüf die H-Atome"),
      tx("The number of C atoms fits, the hydrogens don't. For alkanes: twice as many H as C, plus two.", "Die Zahl der C-Atome passt, die der H-Atome nicht. Bei Alkanen gilt: doppelt so viele H wie C, plus zwei."),
    );
  return out;
}

const generalFormula = "\\ce{C}_n \\ce{H}_{2n + 2}";

// ---------------------------------------------------------------------------
// Level 1: names and formulas of the homologous series

function nameFromFormula(rng: Rng): Exercise {
  const n = rng.int(2, 10);
  const f = alkaneFormula(n);
  const mistakes: Mistake[] = [];
  for (const m of [n - 1, n + 1]) {
    if (m < 1 || m > 12) continue;
    mistakes.push({
      when: { kind: "word", accept: alkaneAccept(m) },
      title: tx("Counted one off", "Um eins verzählt"),
      say: tx(
        "Nearly! The name only depends on the number of **C atoms**. Count along the series once more: meth-, eth-, prop-, but-, pent-…",
        "Fast! Der Name hängt nur von der Zahl der **C-Atome** ab. Zähl die Reihe noch mal ab: Meth-, Eth-, Prop-, But-, Pent- …",
      ),
      close: true,
    });
  }
  const h2 = (2 * n + 2) / 2;
  if (h2 !== n + 1 && h2 <= 12)
    mistakes.push({
      when: { kind: "word", accept: alkaneAccept(h2) },
      title: tx("H atoms counted", "H-Atome gezählt"),
      say: tx("The name counts the **carbon** atoms, not the hydrogens.", "Der Name zählt die **Kohlenstoffatome**, nicht die Wasserstoffatome."),
    });
  return {
    instruction: tx("Name the alkane", "Benenne das Alkan"),
    text: tx(`What is the name of the unbranched alkane with this molecular formula?`, `Wie heißt das unverzweigte Alkan mit dieser Summenformel?`),
    math: `\\ce{${f}}`,
    answer: { kind: "word", accept: alkaneAccept(n), placeholder: tx("name", "Name") },
    hint: tx("Count the C atoms. Then: meth- 1, eth- 2, prop- 3, but- 4, then the Greek and Latin numbers. The ending is always **-ane**.", "Zähl die C-Atome. Dann: Meth- 1, Eth- 2, Prop- 3, But- 4, danach die griechischen und lateinischen Zahlwörter. Die Endung ist immer **-an**."),
    solution: [
      { math: `\\ce{C${n}#c H${2 * n + 2}#h}`, highlight: ["c"], note: tx(`The ${n} after the C: ${n} carbon atoms.`, `Die ${n} hinter dem C: ${n} Kohlenstoffatome.`) },
      {
        math: tx(`${n} \\to "${PARENT_EN[n - 1].replace(/ane$/, "-")}"#s`, `${n} \\to "${PARENT_DE[n - 1].replace(/an$/, "-")}"#s`),
        highlight: ["s"],
        note: tx(`${n} carbon atoms: the stem is **${PARENT_EN[n - 1].replace(/ane$/, "-")}**.`, `${n} Kohlenstoffatome: Der Wortstamm ist **${PARENT_DE[n - 1].replace(/an$/, "-")}**.`),
      },
      { math: tx(`"${PARENT_EN[n - 1]}"#s`, `"${PARENT_DE[n - 1]}"#s`), note: tx(`Add the ending of the alkanes: **${PARENT_EN[n - 1]}**.`, `Dazu die Endung der Alkane: **${PARENT_DE[n - 1]}**.`) },
    ],
    mistakes,
  };
}

function formulaFromName(n: number): Exercise {
  return {
    instruction: tx("Write the molecular formula", "Schreib die Summenformel"),
    text: txMap((t) => t(`What is the molecular formula of **${PARENT_EN[n - 1]}**?`, `Wie lautet die Summenformel von **${PARENT_DE[n - 1]}**?`)),
    answer: { kind: "formula", value: alkaneFormula(n), label: tx("Formula:", "Formel:") },
    hint: tx(`The stem tells you the number of C atoms. Alkanes follow $${generalFormula}$.`, `Der Wortstamm verrät die Zahl der C-Atome. Alkane folgen $${generalFormula}$.`),
    solution: [
      {
        math: tx(`"${PARENT_EN[n - 1]}" \\to n = ${n}#n`, `"${PARENT_DE[n - 1]}" \\to n = ${n}#n`),
        note: tx(`${PARENT_EN[n - 1].replace(/ane$/, "-")} stands for ${n} carbon atoms.`, `${PARENT_DE[n - 1].replace(/an$/, "-")} steht für ${n} Kohlenstoffatome.`),
      },
      { math: `\\ce{C}_{${n}#n} \\ce{H}_{2 \\cdot ${n} + 2}`, note: tx("Put it into the general formula of the alkanes.", "Einsetzen in die allgemeine Formel der Alkane.") },
      { math: `\\ce{${alkaneFormula(n)}}`, note: tx(`$2 \\cdot ${n} + 2 = ${2 * n + 2}$ hydrogen atoms.`, `$2 \\cdot ${n} + 2 = ${2 * n + 2}$ Wasserstoffatome.`) },
    ],
    mistakes: formulaMistakes(n, { nameGiven: true }),
  };
}

function formulaFromH(rng: Rng): Exercise {
  const n = rng.int(3, 10);
  const h = 2 * n + 2;
  const out = formulaMistakes(n);
  const wrong = fml(h / 2, h);
  if (!out.some((m) => m.when.kind === "formula" && m.when.value === wrong))
    out.unshift({
      when: { kind: "formula", value: wrong },
      title: tx("Halved the H atoms", "H-Atome halbiert"),
      say: tx("Halving the H atoms gives $n + 1$, not $n$. Remember the **+2** in $2n + 2$: subtract it first, then halve.", "Halbieren ergibt hier $n + 1$, nicht $n$. Denk an das **+2** in $2n + 2$: Zieh es zuerst ab, dann halbieren."),
    });
  return {
    instruction: tx("Write the molecular formula", "Schreib die Summenformel"),
    text: tx(`An unbranched alkane has **${h}** hydrogen atoms in each molecule. What is its molecular formula?`, `Ein unverzweigtes Alkan hat **${h}** Wasserstoffatome im Molekül. Wie lautet seine Summenformel?`),
    answer: { kind: "formula", value: alkaneFormula(n), label: tx("Formula:", "Formel:") },
    hint: tx(`Work backwards from $${generalFormula}$: $2n + 2 = ${h}$.`, `Rechne rückwärts mit $${generalFormula}$: $2n + 2 = ${h}$.`),
    solution: [
      { math: `2n + 2 = ${h}`, note: tx("The H atoms follow $2n + 2$.", "Die H-Atome folgen $2n + 2$.") },
      { math: `2n = ${h - 2} \\quad n = ${n}`, note: tx("Subtract 2, then halve.", "2 abziehen, dann halbieren.") },
      { math: `\\ce{${alkaneFormula(n)}}`, note: tx(`So the alkane is ${PARENT_EN[n - 1]}.`, `Das Alkan ist also ${PARENT_DE[n - 1]}.`) },
    ],
    mistakes: out,
  };
}

function hCount(rng: Rng): Exercise {
  const n = rng.int(3, 12);
  const value = 2 * n + 2;
  const m = numberMistakes(value);
  m.add(2 * n, tx("Ends forgotten", "Kettenenden vergessen"), tx("Every C atom carries two H atoms, right. But the two ends of the chain carry one more each.", "Jedes C-Atom trägt zwei H-Atome, richtig. Aber die beiden Kettenenden tragen je eins mehr."), true);
  m.add(2 * n + 1, tx("One end forgotten", "Ein Ende vergessen"), tx("A chain has **two** ends, and each end carbon carries one extra H atom.", "Eine Kette hat **zwei** Enden, und jedes End-C-Atom trägt ein zusätzliches H-Atom."), true);
  m.add(4 * n, tx("Not every bond goes to H", "Nicht jede Bindung geht zu H"), tx("Four bonds per C atom, yes, but some of them join the C atoms to each other.", "Vier Bindungen pro C-Atom, ja, aber einige davon verbinden die C-Atome untereinander."));
  m.add(n + 2, tx("Only one H per carbon", "Nur ein H pro C-Atom"), tx("In the middle of the chain each C atom has two bonds left for hydrogen, not one.", "In der Mitte der Kette hat jedes C-Atom noch zwei Bindungen für Wasserstoff frei, nicht eine."));
  return {
    instruction: tx("Count the hydrogen atoms", "Zähl die Wasserstoffatome"),
    text: tx(`How many hydrogen atoms does an alkane with **${n}** carbon atoms have?`, `Wie viele Wasserstoffatome hat ein Alkan mit **${n}** Kohlenstoffatomen?`),
    answer: { kind: "number", value },
    hint: tx(`Alkanes: $${generalFormula}$.`, `Alkane: $${generalFormula}$.`),
    solution: [
      { math: generalFormula, note: tx("The general formula of the alkanes.", "Die allgemeine Formel der Alkane.") },
      { math: `2 \\cdot ${n} + 2 = ${value}#v`, highlight: ["v"], note: tx(`${n} carbon atoms: ${value} hydrogen atoms (${alkaneFormula(n)}).`, `${n} Kohlenstoffatome: ${value} Wasserstoffatome (${alkaneFormula(n)}).`) },
    ],
    mistakes: m.list,
  };
}

const STATES: State[] = ["gas", "liquid", "solid"];

function stateTask(rng: Rng): Exercise {
  const n = rng.int(1, 10);
  const right = stateAt(n, 20);
  const name = alkaneName(n);
  const bp = BOIL[n - 1];
  const sayFor = (s: State): Opt => {
    if (s === "liquid" && n === 4)
      return {
        text: STATE_NAME[s],
        title: tx("Lighter trap", "Feuerzeug-Falle"),
        say: tx("In a lighter, butane is liquid because it's under **pressure**. At normal pressure it boils at about −1 °C, so at 20 °C it's a gas.", "Im Feuerzeug ist Butan flüssig, weil es unter **Druck** steht. Bei normalem Druck siedet es schon bei etwa −1 °C, bei 20 °C ist es also gasförmig."),
      };
    if (s === "liquid")
      return { text: STATE_NAME[s], title: tx("Too small to be liquid", "Zu klein für flüssig"), say: tx("Short molecules attract each other only weakly. Methane to butane boil far below 20 °C.", "Kurze Moleküle ziehen sich nur schwach an. Methan bis Butan sieden weit unter 20 °C.") };
    if (s === "gas")
      return {
        text: STATE_NAME[s],
        title: tx("Boils above 20 °C", "Siedet über 20 °C"),
        say: tx("From pentane on, the chains are long enough that the van der Waals forces hold them together at room temperature: they boil above 20 °C.", "Ab Pentan sind die Ketten lang genug, dass die Van-der-Waals-Kräfte sie bei Raumtemperatur zusammenhalten: Sie sieden über 20 °C."),
      };
    return {
      text: STATE_NAME[s],
      title: tx("Not solid yet", "Noch nicht fest"),
      say: tx("Solid at room temperature are only much longer chains, from about 17 C atoms on, like the paraffin in candles.", "Fest sind bei Raumtemperatur erst viel längere Ketten, ab etwa 17 C-Atomen, wie das Paraffin in Kerzen."),
    };
  };
  const opts: Opt[] = [{ text: STATE_NAME[right] }, ...STATES.filter((s) => s !== right).map(sayFor)];
  // Keep the natural order gas, liquid, solid.
  const ordered = STATES.map((s) => opts.find((o) => o.text === STATE_NAME[s])!);
  const options = ordered.map((o) => o.text);
  const correct = STATES.indexOf(right);
  const mistakes: Mistake[] = ordered.flatMap((o, i) => (i === correct || !o.say ? [] : [{ when: { kind: "choice" as const, options, correct: i }, title: o.title, say: o.say }]));
  return {
    instruction: tx("State of matter at room temperature", "Aggregatzustand bei Raumtemperatur"),
    text: txMap((t) => t(`Is **${PARENT_EN[n - 1]}** ($\\ce{${alkaneFormula(n)}}$) a solid, a liquid or a gas at 20 °C?`, `Ist **${PARENT_DE[n - 1]}** ($\\ce{${alkaneFormula(n)}}$) bei 20 °C fest, flüssig oder gasförmig?`)),
    answer: { kind: "choice", options, correct },
    hint: tx("The longer the chain, the higher the boiling point. Methane to butane are gases at room temperature.", "Je länger die Kette, desto höher die Siedetemperatur. Methan bis Butan sind bei Raumtemperatur Gase."),
    solution: [
      {
        math: tx(`"melts:" ${MELT[n - 1]} "°C" \\quad "boils:" ${bp} "°C"`, `"schmilzt:" ${MELT[n - 1]} "°C" \\quad "siedet:" ${bp} "°C"`),
        note: tx(`${en(name)} boils at ${bp < 0 ? "−" : ""}${Math.abs(bp)} °C and melts at ${MELT[n - 1] < 0 ? "−" : ""}${Math.abs(MELT[n - 1])} °C.`, `${de(name)} siedet bei ${bp < 0 ? "−" : ""}${Math.abs(bp)} °C und schmilzt bei ${MELT[n - 1] < 0 ? "−" : ""}${Math.abs(MELT[n - 1])} °C.`),
      },
      {
        math: tx(`20 "°C" \\to "${en(STATE_NAME[right])}"`, `20 "°C" \\to "${de(STATE_NAME[right])}"`),
        note:
          right === "gas"
            ? tx("20 °C is above its boiling point: it's a gas.", "20 °C liegt über der Siedetemperatur: Es ist gasförmig.")
            : tx("20 °C lies between melting and boiling point: it's a liquid.", "20 °C liegt zwischen Schmelz- und Siedetemperatur: Es ist flüssig."),
      },
    ],
    mistakes,
  };
}

type FormKind = "sum" | "condensed" | "structure";

function formulaTypeTask(rng: Rng): Exercise {
  const n = rng.int(3, 5);
  const kind = rng.pick(["sum", "condensed", "structure"] as const);
  const sk: Skeleton = { row: n, branches: [] };
  const g = graphOf(sk);
  const chainLine = `\\ce{${condensedLine(g, [...Array(n).keys()])}}`;
  const NAMES: Record<FormKind | "ratio", Text> = {
    sum: tx("molecular formula", "Summenformel"),
    condensed: tx("condensed structural formula", "Halbstrukturformel"),
    structure: tx("structural formula", "Strukturformel"),
    ratio: tx("ratio formula, like for salts", "Verhältnisformel, wie bei Salzen"),
  };
  // Why the shown formula is not the one the student picked.
  const WHY: Record<FormKind, Record<FormKind, [Text, Text] | null>> = {
    sum: {
      sum: null,
      condensed: [tx("No groups here", "Keine Gruppen zu sehen"), tx("A condensed formula shows the groups along the chain (CH₃, CH₂). Here you only see totals.", "Eine Halbstrukturformel zeigt die Gruppen entlang der Kette (CH₃, CH₂). Hier siehst du nur Gesamtzahlen.")],
      structure: [tx("No bonds here", "Keine Bindungen zu sehen"), tx("A structural formula draws every bond. Here there are no bonds at all, only how many atoms of each kind.", "Eine Strukturformel zeigt jede Bindung. Hier gibt es gar keine Bindungen, nur wie viele Atome von jeder Sorte.")],
    },
    condensed: {
      sum: [tx("More than totals", "Mehr als Gesamtzahlen"), tx("A molecular formula only gives the totals, like $\\ce{C3H8}$. Here you can see the chain and its groups.", "Eine Summenformel nennt nur die Gesamtzahlen, z. B. $\\ce{C3H8}$. Hier siehst du die Kette und ihre Gruppen.")],
      condensed: null,
      structure: [tx("Not every bond is drawn", "Nicht jede Bindung gezeichnet"), tx("A structural formula draws **every** bond, also each C–H bond. Here the H atoms are grouped with their carbon.", "Eine Strukturformel zeigt **jede** Bindung, auch jede C–H-Bindung. Hier sind die H-Atome bei ihrem C-Atom gebündelt.")],
    },
    structure: {
      sum: [tx("Bonds are drawn", "Bindungen sind gezeichnet"), tx("A molecular formula only gives totals, no bonds. Here every single bond is drawn.", "Eine Summenformel nennt nur Gesamtzahlen, keine Bindungen. Hier ist jede einzelne Bindung gezeichnet.")],
      condensed: [tx("Every H on its own", "Jedes H einzeln"), tx("In a condensed formula the H atoms are grouped (CH₃, CH₂). Here each H atom has its own bond.", "In einer Halbstrukturformel sind die H-Atome gebündelt (CH₃, CH₂). Hier hat jedes H-Atom seine eigene Bindung.")],
      structure: null,
    },
  };
  const others = (["sum", "condensed", "structure"] as const).filter((k) => k !== kind);
  const { answer, mistakes } = choice(rng, [
    { text: NAMES[kind] },
    ...others.map((k) => ({ text: NAMES[k], title: WHY[kind][k]![0], say: WHY[kind][k]![1] })),
    { text: NAMES.ratio, title: tx("That's for salts", "Das gibt es bei Salzen"), say: tx("Ratio formulas describe salts (ionic lattices). Alkanes are made of molecules.", "Verhältnisformeln beschreiben Salze (Ionengitter). Alkane bestehen aus Molekülen.") },
  ]);
  const shown = kind === "sum" ? `\\ce{${alkaneFormula(n)}}` : kind === "condensed" ? chainLine : undefined;
  const explain: Record<FormKind, Text> = {
    sum: tx("Only the kinds and numbers of atoms: a **molecular formula**.", "Nur Atomsorten und Anzahlen: eine **Summenformel**."),
    condensed: tx("The chain with its groups CH₃ and CH₂, the C–H bonds aren't drawn: a **condensed structural formula**.", "Die Kette mit ihren Gruppen CH₃ und CH₂, die C–H-Bindungen sind nicht gezeichnet: eine **Halbstrukturformel**."),
    structure: tx("Every atom and every bond is drawn: a **structural formula**.", "Jedes Atom und jede Bindung ist gezeichnet: eine **Strukturformel**."),
  };
  return {
    instruction: tx("Which kind of formula is it?", "Welche Schreibweise ist das?"),
    text: txMap((t) => t(`This is ${PARENT_EN[n - 1]}. Which way of writing it is shown?`, `Das ist ${PARENT_DE[n - 1]}. Welche Schreibweise siehst du?`)),
    math: shown,
    visual: kind === "structure" ? draw(sk, true) : undefined,
    answer,
    hint: tx("Molecular formula: just counts. Condensed: CH₃ and CH₂ groups. Structural: every single bond.", "Summenformel: nur Anzahlen. Halbstrukturformel: CH₃- und CH₂-Gruppen. Strukturformel: jede einzelne Bindung."),
    solution: [
      { math: shown ?? chainLine, note: kind === "structure" ? tx("The same molecule as a condensed formula. In the picture, though, every atom and every bond is drawn: a **structural formula**.", "Dasselbe Molekül als Halbstrukturformel. Im Bild ist dagegen jedes Atom und jede Bindung gezeichnet: eine **Strukturformel**.") : explain[kind] },
      { math: `\\ce{${alkaneFormula(n)}} \\quad ${chainLine}`, note: tx("Molecular formula and condensed formula of the same molecule, side by side.", "Summenformel und Halbstrukturformel desselben Moleküls nebeneinander.") },
    ],
    mistakes,
  };
}

function seriesStepTask(rng: Rng): Exercise {
  const n = rng.int(1, 8);
  const { answer, mistakes } = choice(rng, [
    { text: "$\\ce{CH2}$" },
    { text: "$\\ce{CH3}$", title: tx("That's a methyl group", "Das ist eine Methylgruppe"), say: tx("Compare the formulas: how many H atoms more does the next alkane have? Count them.", "Vergleich die Formeln: Wie viele H-Atome mehr hat das nächste Alkan? Zähl nach.") },
    { text: "$\\ce{CH4}$", title: tx("That's a whole methane", "Das ist ein ganzes Methan"), say: tx("A whole methane molecule isn't added: one C atom and only **two** H atoms come in.", "Es kommt kein ganzes Methanmolekül dazu: ein C-Atom und nur **zwei** H-Atome.") },
    { text: "$\\ce{C}$", title: tx("Hydrogens too", "Auch Wasserstoff"), say: tx("A new C atom needs its own hydrogens too, otherwise it wouldn't have four bonds.", "Ein neues C-Atom braucht auch eigene H-Atome, sonst hätte es keine vier Bindungen.") },
  ]);
  return {
    instruction: tx("The homologous series", "Die homologe Reihe"),
    text: txMap((t) => t(`${PARENT_EN[n - 1][0].toUpperCase() + PARENT_EN[n - 1].slice(1)} and ${PARENT_EN[n]} are neighbours in the homologous series. By which group do they differ?`, `${PARENT_DE[n - 1]} und ${PARENT_DE[n]} sind Nachbarn in der homologen Reihe. Um welche Gruppe unterscheiden sie sich?`)),
    math: `\\ce{${alkaneFormula(n)}} \\to \\ce{${alkaneFormula(n + 1)}}`,
    answer,
    hint: tx("Subtract: how many C and how many H atoms more?", "Zieh ab: wie viele C- und wie viele H-Atome mehr?"),
    solution: [
      { math: `\\ce{${alkaneFormula(n)}} \\to \\ce{${alkaneFormula(n + 1)}}`, note: tx(`One C atom more and ${2 * (n + 1) + 2} − ${2 * n + 2} = 2 H atoms more.`, `Ein C-Atom mehr und ${2 * (n + 1) + 2} − ${2 * n + 2} = 2 H-Atome mehr.`) },
      { math: `+ \\ce{CH2}#g`, highlight: ["g"], note: tx("Neighbours in a homologous series always differ by one **CH₂ group**.", "Nachbarn in einer homologen Reihe unterscheiden sich immer um eine **CH₂-Gruppe**.") },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Level 2: properties

function bpOrderTask(rng: Rng): Exercise {
  const ns = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).slice(0, 4);
  const highest = rng.chance(0.6);
  const best = highest ? Math.max(...ns) : Math.min(...ns);
  const worst = highest ? Math.min(...ns) : Math.max(...ns);
  const opts: Opt[] = [
    { text: txMap((t) => t(`${PARENT_EN[best - 1]} ($\\ce{${alkaneFormula(best)}}$)`, `${PARENT_DE[best - 1]} ($\\ce{${alkaneFormula(best)}}$)`)) },
    ...ns
      .filter((n) => n !== best)
      .map((n) => ({
        text: txMap((t) => t(`${PARENT_EN[n - 1]} ($\\ce{${alkaneFormula(n)}}$)`, `${PARENT_DE[n - 1]} ($\\ce{${alkaneFormula(n)}}$)`)),
        title: n === worst ? tx("The other way round", "Genau andersrum") : tx("Compare the chain lengths", "Vergleich die Kettenlängen"),
        say:
          n === worst
            ? tx("It's the other way round: long chains touch each other over a larger surface, so the van der Waals forces are **stronger** and the boiling point is higher.", "Genau andersrum: Lange Ketten berühren sich auf einer größeren Fläche, die Van-der-Waals-Kräfte sind **stärker** und die Siedetemperatur ist höher.")
            : tx("Close, but another one has a chain that is even " + (highest ? "longer" : "shorter") + ". Compare the numbers of C atoms.", "Nah dran, aber ein anderes hat eine noch " + (highest ? "längere" : "kürzere") + " Kette. Vergleich die Zahl der C-Atome."),
      })),
  ];
  const { answer, mistakes } = choice(rng, opts);
  const sorted = [...ns].sort((a, b) => a - b);
  return {
    instruction: highest ? tx("Highest boiling point", "Höchste Siedetemperatur") : tx("Lowest boiling point", "Niedrigste Siedetemperatur"),
    text: highest ? tx("Which of these alkanes has the **highest** boiling point?", "Welches dieser Alkane hat die **höchste** Siedetemperatur?") : tx("Which of these alkanes has the **lowest** boiling point?", "Welches dieser Alkane hat die **niedrigste** Siedetemperatur?"),
    answer,
    hint: tx("Think of the van der Waals forces: they grow with the size of the molecules.", "Denk an die Van-der-Waals-Kräfte: Sie wachsen mit der Größe der Moleküle."),
    solution: [
      {
        math: sorted.map((n) => `\\ce{${alkaneFormula(n)}}`).join(" \\quad "),
        note: tx("Sorted by chain length. Longer chains: larger contact surface, stronger van der Waals forces, higher boiling point.", "Nach Kettenlänge sortiert. Längere Ketten: größere Berührungsfläche, stärkere Van-der-Waals-Kräfte, höhere Siedetemperatur."),
      },
      {
        math: sorted.map((n) => `${BOIL[n - 1] < 0 ? "-" : ""}${Math.abs(BOIL[n - 1])}${n === best ? "#b" : ""} "°C"`).join(" \\quad "),
        highlight: ["b"],
        note: txMap((t) => t(`The boiling points in order: ${highest ? "highest" : "lowest"} is ${PARENT_EN[best - 1]}.`, `Die Siedetemperaturen der Reihe nach: Am ${highest ? "höchsten" : "niedrigsten"} liegt ${PARENT_DE[best - 1]}.`)),
      },
    ],
    mistakes,
  };
}

function gasesTask(rng: Rng): Exercise {
  let ns: number[] = [];
  for (let i = 0; i < 30; i++) {
    ns = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 10]).slice(0, 5);
    if (ns.some((n) => n <= 4) && ns.some((n) => n >= 5)) break;
  }
  ns.sort((a, b) => a - b);
  const options = ns.map((n) => txMap((t) => t(`${PARENT_EN[n - 1]} ($\\ce{${alkaneFormula(n)}}$)`, `${PARENT_DE[n - 1]} ($\\ce{${alkaneFormula(n)}}$)`)));
  const correct = ns.map((n, i) => (n <= 4 ? i : -1)).filter((i) => i >= 0);
  const mistakes: Mistake[] = [];
  const addSet = (set: number[], title: Text, say: Text) => {
    const s = [...new Set(set)].sort((a, b) => a - b);
    if (!s.length || (s.length === correct.length && s.every((x, i) => x === correct[i]))) return;
    if (mistakes.some((m) => m.when.kind === "multi" && m.when.correct.join() === s.join())) return;
    mistakes.push({ when: { kind: "multi", options, correct: s }, title, say });
  };
  const i5 = ns.indexOf(5);
  if (i5 >= 0) addSet([...correct, i5], tx("Pentane boils at 36 °C", "Pentan siedet bei 36 °C"), tx("Pentane is the first liquid one: it boils only at 36 °C. Below that it stays liquid.", "Pentan ist das erste flüssige: Es siedet erst bei 36 °C. Darunter bleibt es flüssig."));
  const i4 = ns.indexOf(4);
  if (i4 >= 0)
    addSet(
      correct.filter((i) => i !== i4),
      tx("Butane is a gas too", "Butan ist auch ein Gas"),
      tx("Butane (lighter gas) boils at about −1 °C. It's only liquid in the lighter because of the pressure.", "Butan (Feuerzeuggas) siedet schon bei etwa −1 °C. Flüssig ist es im Feuerzeug nur wegen des Drucks."),
    );
  if (correct.length >= 2)
    addSet(
      [correct[0]],
      tx("Not only the smallest", "Nicht nur das kleinste"),
      tx("The smallest one is a gas, right. But it's not alone: look at the boiling points of the next few in the series.", "Das kleinste ist gasförmig, stimmt. Aber es ist nicht allein: Schau dir die Siedetemperaturen der nächsten in der Reihe an."),
    );
  addSet(
    ns.map((n, i) => (n >= 5 ? i : -1)).filter((i) => i >= 0),
    tx("The other way round", "Genau andersrum"),
    tx("It's the small molecules that are gases: weak van der Waals forces, low boiling points.", "Gasförmig sind die kleinen Moleküle: schwache Van-der-Waals-Kräfte, niedrige Siedetemperaturen."),
  );
  return {
    instruction: tx("Gases at room temperature", "Gase bei Raumtemperatur"),
    text: tx("Which of these alkanes are **gases** at 20 °C?", "Welche dieser Alkane sind bei 20 °C **gasförmig**?"),
    answer: { kind: "multi", options, correct },
    hint: tx("Only the first four of the series boil below room temperature.", "Nur die ersten vier der Reihe sieden unter Raumtemperatur."),
    solution: [
      { math: "\\ce{CH4} \\quad \\ce{C2H6} \\quad \\ce{C3H8} \\quad \\ce{C4H10}", note: tx("Methane (−162 °C), ethane (−89 °C), propane (−42 °C) and butane (−1 °C) boil below 20 °C: gases.", "Methan (−162 °C), Ethan (−89 °C), Propan (−42 °C) und Butan (−1 °C) sieden unter 20 °C: gasförmig.") },
      { math: "\\ce{C5H12} \\quad \\ce{C6H14} \\quad \\ce{C7H16} \\quad …", note: tx("From pentane (36 °C) on, the alkanes are liquid at room temperature.", "Ab Pentan (36 °C) sind die Alkane bei Raumtemperatur flüssig.") },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Branched alkanes

type SkOpts = { minRow: number; maxRow: number; subs: [number, number]; ethyl: boolean; trap: "no" | "maybe" | "yes"; maxC?: number };

/** A random school-level branched alkane (methyl and ethyl groups only, at most decane as parent). */
function randomSkeleton(rng: Rng, o: SkOpts): Skeleton {
  for (let tries = 0; tries < 400; tries++) {
    const row = rng.int(o.minRow, o.maxRow);
    const k = rng.int(o.subs[0], o.subs[1]);
    const branches: Skeleton["branches"] = [];
    const bent = o.trap === "yes" || (o.trap === "maybe" && rng.chance(0.35));
    for (let j = 0; j < k + (bent ? 1 : 0); j++) {
      const isTrap = bent && j === 0;
      const at = isTrap ? rng.pick([0, 1, row - 2, row - 1]) : rng.int(1, row - 2);
      const len = isTrap ? rng.pick([1, 2, 2]) : o.ethyl && rng.chance(0.3) ? 2 : 1;
      const dir: 1 | -1 = rng.chance(0.5) ? 1 : -1;
      const free = (d: 1 | -1) => !branches.some((b) => b.at === at && b.dir === d);
      const d = free(dir) ? dir : free((-dir) as 1 | -1) ? ((-dir) as 1 | -1) : null;
      if (d === null) continue;
      branches.push({ at, len, dir: d });
    }
    const sk = { row, branches };
    const g = graphOf(sk);
    const nm = nameOf(g);
    if (!nm.ok || g.n > (o.maxC ?? 10) || nm.chain.length > 10 || nm.chain.length < 3) continue;
    if (nm.subs.length < o.subs[0] || nm.subs.length > o.subs[1]) continue;
    if (nm.subs.some((s) => s.name === "propyl" || (s.name === "ethyl" && !o.ethyl))) continue;
    const isBent = nm.chain.some((c) => g.pos[c].lvl !== 0);
    if (o.trap === "yes" && !isBent) continue;
    if (o.trap === "no" && isBent) continue;
    // The drawing should differ from the right name in a way worth spotting.
    return sk;
  }
  return { row: 4, branches: [{ at: 1, len: 1, dir: -1 }] };
}

const WRONG_SAY: Record<WrongName["kind"], [Text, Text]> = {
  wrongEnd: [
    tx("Counted from the wrong end", "Von der falschen Seite gezählt"),
    tx("I think you numbered from the wrong end. Number the main chain so that the side chains get the **smallest** possible numbers.", "Ich glaub, du hast von der falschen Seite nummeriert. Nummeriere die Hauptkette so, dass die Seitenketten die **kleinstmöglichen** Nummern bekommen."),
  ],
  drawnRow: [
    tx("Not the longest chain", "Nicht die längste Kette"),
    tx("Ah, the classic trap! The straight row isn't the longest chain here. Follow the bonds around the corners too: the main chain may bend.", "Ah, die klassische Falle! Die gerade Reihe ist hier nicht die längste Kette. Folge den Bindungen auch um die Ecken: Die Hauptkette darf abknicken."),
  ],
  noMultiplier: [
    tx("di or tri missing", "di oder tri fehlt"),
    tx("Nearly! When the same group appears more than once, a number word shows how many: **di** (2), **tri** (3), **tetra** (4).", "Fast! Kommt dieselbe Gruppe mehrmals vor, zeigt ein Zahlwort, wie oft: **di** (2), **tri** (3), **tetra** (4)."),
  ],
  oneLocant: [
    tx("One number per group", "Eine Nummer pro Gruppe"),
    tx("Every methyl group gets its own number, even if two sit on the same C atom. The number of locants must match di or tri.", "Jede Methylgruppe bekommt ihre eigene Nummer, auch wenn zwei am selben C-Atom sitzen. Die Zahl der Nummern muss zu di oder tri passen."),
  ],
  order: [
    tx("Alphabetical order", "Alphabetische Reihenfolge"),
    tx("Different side chains are listed **alphabetically** (ethyl before methyl), not by their numbers.", "Verschiedene Seitenketten stehen **alphabetisch** (Ethyl vor Methyl), nicht nach ihren Nummern."),
  ],
  unbranched: [
    tx("That's the unbranched one", "Das ist das unverzweigte"),
    tx("That's the name of the unbranched alkane with the same number of C atoms. This molecule is branched: name the main chain and its side chains.", "Das ist der Name des unverzweigten Alkans mit gleich vielen C-Atomen. Dieses Molekül ist verzweigt: Benenne Hauptkette und Seitenketten."),
  ],
  chainPlusBranch: [
    tx("Branch counted into the chain", "Seitenkette mitgezählt"),
    tx("The C atom of the methyl group doesn't belong to the main chain. Count only the carbons of the longest chain for the stem.", "Das C-Atom der Methylgruppe gehört nicht zur Hauptkette. Für den Stammnamen zählst du nur die C-Atome der längsten Kette."),
  ],
};

const PRIORITY: WrongName["kind"][] = ["drawnRow", "wrongEnd", "noMultiplier", "order", "oneLocant", "chainPlusBranch", "unbranched"];

/** Solution frames for naming a skeleton. */
function namingFrames(sk: Skeleton): Frame[] {
  const g = graphOf(sk);
  const nm = nameOf(g);
  const L = nm.chain.length;
  const line = `\\ce{${condensedLine(g, nm.chain)}}`;
  const bent = nm.chain.some((c) => g.pos[c].lvl !== 0);
  const groups = [...new Set(nm.subs.map((s) => s.name))];
  const frames: Frame[] = [
    {
      math: line,
      note: bent
        ? tx(`The longest chain bends in the drawing. Written straight: **${L}** C atoms, so the stem is **${PARENT_EN[L - 1]}**.`, `Die längste Kette knickt in der Zeichnung ab. Gerade geschrieben: **${L}** C-Atome, also Stammname **${PARENT_DE[L - 1]}**.`)
        : tx(`The longest chain has **${L}** C atoms: the stem is **${PARENT_EN[L - 1]}**.`, `Die längste Kette hat **${L}** C-Atome: Stammname **${PARENT_DE[L - 1]}**.`),
    },
    {
      math: line,
      note: txMap((t, l) => {
        const list = groups
          .map((name) => {
            const locs = nm.subs.filter((x) => x.name === name).map((x) => x.pos).sort((a, b) => a - b).map((p) => `C${p}`);
            const at = locs.length > 1 ? `${locs.slice(0, -1).join(", ")} ${t("and", "und")} ${locs[locs.length - 1]}` : locs[0];
            return `${l === "de" ? name[0].toUpperCase() + name.slice(1) : name} ${t("at", "an")} ${at}`;
          })
          .join(", ");
        return `${t("Number from the end that reaches a side chain first:", "Nummeriere von dem Ende aus, das zuerst eine Seitenkette erreicht:")} ${list}.`;
      }),
    },
  ];
  if (nm.subs.length > 1 && (groups.length > 1 || nm.subs.length > 1))
    frames.push({
      math: line,
      note:
        groups.length > 1
          ? tx("Different groups go in alphabetical order (ethyl before methyl). Equal groups get di, tri, tetra.", "Verschiedene Gruppen kommen alphabetisch (Ethyl vor Methyl). Gleiche Gruppen bekommen di, tri, tetra.")
          : tx(`The same group ${nm.subs.length} times: **${["", "", "di", "tri", "tetra"][nm.subs.length]}** in front, and every group gets its own number.`, `Dieselbe Gruppe ${nm.subs.length}-mal: **${["", "", "Di", "Tri", "Tetra"][nm.subs.length]}** davor, und jede Gruppe bekommt ihre eigene Nummer.`),
    });
  frames.push({ math: tx(`"${en(nm.name)}"#nm`, `"${de(nm.name)}"#nm`), highlight: ["nm"], note: txMap((t, l) => `${t("The name:", "Der Name:")} **${resolveText(nm.name, l)}**.`) });
  return frames;
}

/** "Name this alkane" as multiple choice (typed names would accept 3-methyl… for 2-methyl…, see the report). */
function nameExercise(sk: Skeleton, rng: Rng | null): Exercise {
  const g = graphOf(sk);
  const nm = nameOf(g);
  const wrong = wrongNames(sk).sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));
  const opts: Opt[] = wrong.slice(0, 3).map((w) => ({ text: w.name, title: WRONG_SAY[w.kind][0], say: WRONG_SAY[w.kind][1] }));
  // Few typical slips for this molecule? Add one with a side chain moved by one place.
  if (opts.length < 3 && nm.subs.length) {
    const L = nm.chain.length;
    const moved = nm.subs.map((x, i) => (i === 0 ? { ...x, pos: x.pos + 1 <= L - 1 ? x.pos + 1 : x.pos - 1 } : x));
    const name = formatName(partsOf(moved, L));
    if (en(name) !== en(nm.name) && !opts.some((o) => en(o.text) === en(name)))
      opts.push({ text: name, title: tx("Check the position", "Prüf die Position"), say: tx("Look closely at which C atom of the main chain carries the side chain, and count again.", "Schau genau, an welchem C-Atom der Hauptkette die Seitenkette sitzt, und zähl noch mal.") });
  }
  const { answer, mistakes } = choice(rng, [{ text: nm.name }, ...opts]);
  return {
    instruction: tx("Name the alkane", "Benenne das Alkan"),
    text: tx("Which is the correct IUPAC name of this alkane?", "Welcher IUPAC-Name ist für dieses Alkan richtig?"),
    visual: draw(sk),
    answer,
    hint: tx("1. Longest chain (it may bend!). 2. Number it so the side chains get the smallest numbers. 3. Side chains alphabetically, di/tri for repeats.", "1. Längste Kette (sie darf abknicken!). 2. So nummerieren, dass die Seitenketten die kleinsten Nummern bekommen. 3. Seitenketten alphabetisch, di/tri für gleiche."),
    solution: namingFrames(sk),
    mistakes,
  };
}

function locantTask(rng: Rng): Exercise {
  let sk: Skeleton = { row: 6, branches: [{ at: 3, len: 1, dir: -1 }] };
  for (let i = 0; i < 50; i++) {
    const row = rng.int(5, 8);
    const at = rng.int(1, row - 2);
    if (at === row - 1 - at) continue;
    sk = { row, branches: [{ at, len: 1, dir: rng.chance(0.5) ? 1 : -1 }] };
    break;
  }
  const nm = nameOf(graphOf(sk));
  const value = nm.subs[0].pos;
  const L = nm.chain.length;
  const m = numberMistakes(value);
  m.add(L + 1 - value, WRONG_SAY.wrongEnd[0], tx("That's the number when you count from the other end. Start at the end that is **closer** to the methyl group.", "Das ist die Nummer, wenn du vom anderen Ende zählst. Fang an dem Ende an, das **näher** an der Methylgruppe liegt."));
  m.add(L, tx("That's the chain length", "Das ist die Kettenlänge"), tx("That's how many C atoms the main chain has. Asked is the **number** of the C atom that carries the methyl group.", "So viele C-Atome hat die Hauptkette. Gefragt ist die **Nummer** des C-Atoms, an dem die Methylgruppe hängt."));
  return {
    instruction: tx("Number the main chain", "Nummeriere die Hauptkette"),
    text: tx("At which carbon atom of the main chain is the methyl group? Number the chain correctly.", "An welchem C-Atom der Hauptkette sitzt die Methylgruppe? Nummeriere die Kette richtig."),
    visual: draw(sk),
    answer: { kind: "number", value, label: tx('"C-atom"', '"C-Atom"') },
    hint: tx("Count from the end of the chain that is closer to the side chain.", "Zähl von dem Kettenende aus, das näher an der Seitenkette liegt."),
    solution: [
      { math: `\\ce{${condensedLine(graphOf(sk), nm.chain)}}`, note: tx(`Written so that the numbering starts on the left: the methyl group is at C atom **${value}**.`, `So geschrieben, dass die Nummerierung links beginnt: Die Methylgruppe sitzt an C-Atom **${value}**.`) },
      { math: tx(`"${en(nm.name)}"`, `"${de(nm.name)}"`), note: tx(`From the other end it would be ${L + 1 - value}, which is larger. The name: **${en(nm.name)}**.`, `Vom anderen Ende wäre es ${L + 1 - value}, also größer. Der Name: **${de(nm.name)}**.`) },
    ],
    mistakes: m.list,
  };
}

function longestChainTask(rng: Rng): Exercise {
  const sk = randomSkeleton(rng, { minRow: 4, maxRow: 6, subs: [1, 2], ethyl: true, trap: "yes", maxC: 9 });
  const g = graphOf(sk);
  const nm = nameOf(g);
  const L = nm.chain.length;
  const asWord = rng.chance(0.5) && L >= 2;
  const solution: Frame[] = [
    { math: `\\ce{${condensedLine(g, nm.chain)}}`, note: tx(`Follow the bonds around the corner: the longest chain has **${L}** C atoms. The straight row has only ${sk.row}.`, `Folge den Bindungen um die Ecke: Die längste Kette hat **${L}** C-Atome. Die gerade Reihe hat nur ${sk.row}.`) },
    { math: tx(`${L} \\to "${PARENT_EN[L - 1]}"`, `${L} \\to "${PARENT_DE[L - 1]}"`), note: txMap((t, l) => `${t("Stem:", "Stammname:")} **${l === "de" ? PARENT_DE[L - 1] : PARENT_EN[L - 1]}**. ${t("Full name:", "Ganzer Name:")} ${resolveText(nm.name, l)}.`) },
  ];
  const hint = tx("The main chain doesn't have to be straight. Try every path from one CH₃ end to another.", "Die Hauptkette muss nicht gerade sein. Probier jeden Weg von einem CH₃-Ende zu einem anderen.");
  if (asWord) {
    const mistakes: Mistake[] = [];
    if (sk.row !== L) mistakes.push({ when: { kind: "word", accept: alkaneAccept(sk.row) }, title: WRONG_SAY.drawnRow[0], say: WRONG_SAY.drawnRow[1] });
    if (g.n !== L && g.n <= 12) mistakes.push({ when: { kind: "word", accept: alkaneAccept(g.n) }, title: tx("All carbons counted", "Alle C-Atome gezählt"), say: tx("You counted every C atom. The stem only counts the longest chain, the side chains get their own names.", "Du hast alle C-Atome gezählt. Der Stammname zählt nur die längste Kette, die Seitenketten bekommen eigene Namen.") });
    return {
      instruction: tx("Find the main chain", "Finde die Hauptkette"),
      text: tx("What is the stem name (the name of the main chain) of this alkane? Give the name of the unbranched alkane, e.g. Butane.", "Wie lautet der Stammname (der Name der Hauptkette) dieses Alkans? Gib den Namen des unverzweigten Alkans an, z. B. Butan."),
      visual: draw(sk),
      answer: { kind: "word", accept: alkaneAccept(L), placeholder: tx("stem name", "Stammname") },
      hint,
      solution,
      mistakes,
    };
  }
  const m = numberMistakes(L);
  m.add(sk.row, WRONG_SAY.drawnRow[0], WRONG_SAY.drawnRow[1]);
  m.add(g.n, tx("All carbons counted", "Alle C-Atome gezählt"), tx("That's every C atom in the molecule. The main chain is only the longest **unbranched** path through it.", "Das sind alle C-Atome im Molekül. Die Hauptkette ist nur der längste **unverzweigte** Weg hindurch."));
  return {
    instruction: tx("Find the main chain", "Finde die Hauptkette"),
    text: tx("How many carbon atoms does the longest chain (main chain) of this alkane have?", "Wie viele C-Atome hat die längste Kette (Hauptkette) dieses Alkans?"),
    visual: draw(sk),
    answer: { kind: "number", value: L },
    hint,
    solution,
    mistakes: m.list,
  };
}

function whatsWrongTask(rng: Rng): Exercise {
  for (let tries = 0; tries < 40; tries++) {
    const sk = randomSkeleton(rng, { minRow: 4, maxRow: 6, subs: [1, 3], ethyl: true, trap: "maybe", maxC: 9 });
    const wrong = wrongNames(sk).filter((w) => ["drawnRow", "wrongEnd", "noMultiplier", "oneLocant", "order"].includes(w.kind));
    if (!wrong.length) continue;
    const w = rng.pick(wrong);
    const REASON: Record<string, Text> = {
      drawnRow: tx("The longest chain wasn't used.", "Es wurde nicht die längste Kette gewählt."),
      wrongEnd: tx("The chain was numbered from the wrong end.", "Die Kette wurde von der falschen Seite nummeriert."),
      noMultiplier: tx("The number word (di, tri) is missing.", "Das Zahlwort (di, tri) fehlt."),
      oneLocant: tx("Each group needs its own number.", "Jede Gruppe braucht ihre eigene Nummer."),
      order: tx("The groups aren't in alphabetical order.", "Die Gruppen stehen nicht in alphabetischer Reihenfolge."),
    };
    const LOOK: Record<string, Text> = {
      drawnRow: tx("Look at the chain itself: is the straight row really the longest path?", "Schau dir die Kette selbst an: Ist die gerade Reihe wirklich der längste Weg?"),
      wrongEnd: tx("Look at the numbers: would counting from the other end give smaller ones?", "Schau auf die Nummern: Gäbe es von der anderen Seite kleinere?"),
      noMultiplier: tx("Look at the side chains: how often does the same group appear, and does the name say so?", "Schau auf die Seitenketten: Wie oft kommt dieselbe Gruppe vor, und steht das im Namen?"),
      oneLocant: tx("Count the numbers in front: is there one for every group?", "Zähl die Nummern vorne: Gibt es für jede Gruppe eine?"),
      order: tx("Look at the order of the side chains in the name.", "Schau auf die Reihenfolge der Seitenketten im Namen."),
    };
    const others = rng.shuffle(Object.keys(REASON).filter((k) => k !== w.kind)).slice(0, 2);
    const { answer, mistakes } = choice(rng, [
      { text: REASON[w.kind] },
      ...others.map((k) => ({ text: REASON[k], title: tx("That part is fine", "Das passt"), say: txMap((t, l) => `${t("That part of the name is fine.", "Dieser Teil des Namens passt.")} ${resolveText(LOOK[w.kind], l)}`) })),
      { text: tx("Nothing, the name is correct.", "Nichts, der Name ist richtig."), title: tx("Something's off", "Da stimmt was nicht"), say: LOOK[w.kind] },
    ]);
    return {
      instruction: tx("Find the error", "Finde den Fehler"),
      text: txMap((t, l) => t(`A classmate names this alkane **${resolveText(w.name, l)}**. What's wrong?`, `Ein Mitschüler nennt dieses Alkan **${resolveText(w.name, l)}**. Was ist falsch?`)),
      visual: draw(sk),
      answer,
      hint: tx("Check in order: longest chain, numbering, number words, alphabetical order.", "Prüf der Reihe nach: längste Kette, Nummerierung, Zahlwörter, alphabetische Reihenfolge."),
      solution: [{ math: tx(`"${en(w.name)}"`, `"${de(w.name)}"`), note: REASON[w.kind] }, ...namingFrames(sk)],
      mistakes,
    };
  }
  return nameExercise(randomSkeleton(rng, { minRow: 4, maxRow: 6, subs: [1, 2], ethyl: false, trap: "no" }), rng);
}

/** Named isomers by number of carbon atoms (drawn straight). */
const ISOMER_SKELETONS: Record<number, Skeleton[]> = {
  5: [
    { row: 4, branches: [{ at: 1, len: 1, dir: -1 }] },
    { row: 3, branches: [{ at: 1, len: 1, dir: -1 }, { at: 1, len: 1, dir: 1 }] },
  ],
  6: [
    { row: 5, branches: [{ at: 1, len: 1, dir: -1 }] },
    { row: 5, branches: [{ at: 2, len: 1, dir: -1 }] },
    { row: 4, branches: [{ at: 1, len: 1, dir: -1 }, { at: 1, len: 1, dir: 1 }] },
    { row: 4, branches: [{ at: 1, len: 1, dir: -1 }, { at: 2, len: 1, dir: 1 }] },
  ],
  7: [
    { row: 6, branches: [{ at: 1, len: 1, dir: -1 }] },
    { row: 6, branches: [{ at: 2, len: 1, dir: -1 }] },
    { row: 5, branches: [{ at: 1, len: 1, dir: -1 }, { at: 3, len: 1, dir: 1 }] },
    { row: 5, branches: [{ at: 2, len: 2, dir: -1 }] },
  ],
  8: [
    { row: 7, branches: [{ at: 1, len: 1, dir: -1 }] },
    { row: 5, branches: [{ at: 1, len: 1, dir: -1 }, { at: 1, len: 1, dir: 1 }, { at: 3, len: 1, dir: 1 }] },
  ],
};
const isoName = (sk: Skeleton) => nameOf(graphOf(sk)).name;

function isomerChoiceTask(rng: Rng): Exercise {
  const n = rng.pick([5, 6, 7]);
  const right = rng.pick(ISOMER_SKELETONS[n]);
  const wrongBranched = rng.pick(ISOMER_SKELETONS[n === 5 ? 6 : rng.chance(0.5) ? n - 1 : n + 1]);
  const wb = graphOf(wrongBranched).n;
  const nb = nameOf(graphOf(wrongBranched));
  const unb = rng.pick([n - 1, n + 1]);
  const { answer, mistakes } = choice(rng, [
    { text: isoName(right) },
    {
      text: isoName(wrongBranched),
      title: tx("Count all C atoms", "Zähl alle C-Atome"),
      say: tx(
        `Branched, yes! But count every C atom: main chain ${nb.chain.length} plus side chains makes ${wb}. An isomer needs exactly the same molecular formula.`,
        `Verzweigt, ja! Aber zähl alle C-Atome: Hauptkette ${nb.chain.length} plus Seitenketten macht ${wb}. Ein Isomer braucht genau dieselbe Summenformel.`,
      ),
    },
    {
      text: alkaneName(unb),
      title: tx("Different formula", "Andere Summenformel"),
      say: tx(`${PARENT_EN[unb - 1][0].toUpperCase() + PARENT_EN[unb - 1].slice(1)} is $\\ce{${alkaneFormula(unb)}}$: a different molecular formula, so not an isomer. Isomers have the **same** formula but a different structure.`, `${PARENT_DE[unb - 1]} ist $\\ce{${alkaneFormula(unb)}}$: eine andere Summenformel, also kein Isomer. Isomere haben **dieselbe** Summenformel, aber eine andere Struktur.`),
    },
    {
      text: alkaneName(n),
      title: tx("That's the molecule itself", "Das ist das Molekül selbst"),
      say: tx("That's the very same molecule, not an isomer of it. Look for a **branched** molecule with the same formula.", "Das ist genau dasselbe Molekül, kein Isomer davon. Such ein **verzweigtes** Molekül mit derselben Summenformel."),
    },
  ]);
  const rn = nameOf(graphOf(right));
  return {
    instruction: tx("Find the isomer", "Finde das Isomer"),
    text: txMap((t) => t(`Which substance is an isomer of **${PARENT_EN[n - 1]}** ($\\ce{${alkaneFormula(n)}}$)?`, `Welcher Stoff ist ein Isomer von **${PARENT_DE[n - 1]}** ($\\ce{${alkaneFormula(n)}}$)?`)),
    answer,
    hint: tx("Isomers: same molecular formula, different structure. Count all C atoms of each name: main chain plus side chains.", "Isomere: gleiche Summenformel, andere Struktur. Zähl bei jedem Namen alle C-Atome: Hauptkette plus Seitenketten."),
    solution: [
      { math: `\\ce{${condensedLine(graphOf(right), rn.chain)}}`, note: txMap((t, l) => `${resolveText(rn.name, l)}: ${t("main chain", "Hauptkette")} ${rn.chain.length} + ${t("side chains", "Seitenketten")} ${n - rn.chain.length} = ${n} ${t("C atoms", "C-Atome")}.`) },
      { math: `\\ce{${alkaneFormula(n)}}`, note: tx("Same molecular formula as the unbranched alkane, but branched: an **isomer**.", "Gleiche Summenformel wie das unverzweigte Alkan, aber verzweigt: ein **Isomer**.") },
    ],
    mistakes,
  };
}

function branchedFormulaTask(rng: Rng, level: Level): Exercise {
  const sk = randomSkeleton(rng, { minRow: 4, maxRow: 7, subs: level === 3 ? [2, 3] : [1, 2], ethyl: level === 3, trap: "no", maxC: 10 });
  const g = graphOf(sk);
  const nm = nameOf(g);
  const N = g.n;
  const L = nm.chain.length;
  return {
    instruction: tx("Write the molecular formula", "Schreib die Summenformel"),
    text: txMap((t, l) => t(`What is the molecular formula of **${resolveText(nm.name, l)}**?`, `Wie lautet die Summenformel von **${resolveText(nm.name, l)}**?`)),
    answer: { kind: "formula", value: alkaneFormula(N), label: tx("Formula:", "Formel:") },
    hint: tx("Count the C atoms: main chain plus every side chain (methyl 1 C, ethyl 2 C). Then $\\ce{C}_n\\ce{H}_{2n+2}$.", "Zähl die C-Atome: Hauptkette plus jede Seitenkette (Methyl 1 C, Ethyl 2 C). Dann $\\ce{C}_n\\ce{H}_{2n+2}$."),
    solution: [
      { math: `\\ce{${condensedLine(g, nm.chain)}}`, note: txMap((t) => t(`Draw it: main chain ${L} C atoms, side chains ${N - L} more.`, `Aufzeichnen: Hauptkette ${L} C-Atome, Seitenketten ${N - L} weitere.`)) },
      { math: `n = ${L} + ${N - L} = ${N} \\quad \\ce{C}_{${N}} \\ce{H}_{2 \\cdot ${N} + 2}`, note: tx("Branched alkanes follow the same general formula.", "Verzweigte Alkane folgen derselben allgemeinen Formel.") },
      { math: `\\ce{${alkaneFormula(N)}}`, note: tx(`An isomer of ${PARENT_EN[N - 1]}.`, `Ein Isomer von ${PARENT_DE[N - 1]}.`) },
    ],
    mistakes: formulaMistakes(N, { mainChain: L }),
  };
}

function bpBranchedTask(rng: Rng): Exercise {
  const c6 = rng.chance(0.5);
  const names = c6 ? ["Hexan", "2-Methylpentan", "3-Methylpentan", "2,2-Dimethylbutan"] : ["Pentan", "2-Methylbutan", "2,2-Dimethylpropan"];
  const sks: Skeleton[] = c6 ? [{ row: 6, branches: [] }, ...ISOMER_SKELETONS[6].slice(0, 3)] : [{ row: 5, branches: [] }, ...ISOMER_SKELETONS[5]];
  const bp = (i: number) => (i === 0 ? BOIL[(c6 ? 6 : 5) - 1] : BOIL_BRANCHED[names[i]]);
  const lowest = rng.chance(0.6);
  const idx = sks.map((_, i) => i);
  const best = lowest ? idx.reduce((a, b) => (bp(b) < bp(a) ? b : a)) : 0;
  const opts: Opt[] = [best, ...idx.filter((i) => i !== best)].map((i, j) =>
    j === 0
      ? { text: isoName(sks[i]) }
      : {
          text: isoName(sks[i]),
          title: i === 0 && lowest ? tx("The other way round", "Genau andersrum") : tx("Compare the shapes", "Vergleich die Formen"),
          say:
            i === 0 && lowest
              ? tx("The unbranched chain has the **largest** contact surface, so it boils highest. Branching makes molecules more compact.", "Die unverzweigte Kette hat die **größte** Berührungsfläche, sie siedet also am höchsten. Verzweigung macht Moleküle kompakter.")
              : lowest
                ? tx("Close! Another isomer is even more branched, so even more compact: its van der Waals forces are weaker.", "Fast! Ein anderes Isomer ist noch stärker verzweigt, also noch kompakter: Seine Van-der-Waals-Kräfte sind schwächer.")
                : tx("Branched molecules are more compact and touch each other less. The one with the largest contact surface boils highest.", "Verzweigte Moleküle sind kompakter und berühren sich weniger. Das mit der größten Berührungsfläche siedet am höchsten."),
        },
  );
  const { answer, mistakes } = choice(rng, opts);
  const formula = alkaneFormula(c6 ? 6 : 5);
  return {
    instruction: lowest ? tx("Lowest boiling point", "Niedrigste Siedetemperatur") : tx("Highest boiling point", "Höchste Siedetemperatur"),
    text: txMap((t) => t(`These isomers all have the formula $\\ce{${formula}}$. Which one has the **${lowest ? "lowest" : "highest"}** boiling point?`, `Diese Isomere haben alle die Summenformel $\\ce{${formula}}$. Welches hat die **${lowest ? "niedrigste" : "höchste"}** Siedetemperatur?`)),
    answer,
    hint: tx("Same formula, so the same mass. What differs is the shape: how much surface can two molecules touch?", "Gleiche Summenformel, also gleiche Masse. Unterschiedlich ist die Form: Wie viel Fläche können sich zwei Moleküle berühren?"),
    solution: [
      { math: idx.map((i) => `${bp(i) < 0 ? "-" : ""}${Math.abs(bp(i))}${i === best ? "#b" : ""} "°C"`).join(" \\quad "), highlight: ["b"], note: txMap((t, l) => `${idx.map((i) => `${resolveText(isoName(sks[i]), l)} ${bp(i)} °C`).join(", ")}.`) },
      { math: `\\ce{${formula}}`, note: tx("The more branched, the more compact (nearly ball-shaped) the molecule: smaller contact surface, weaker van der Waals forces, lower boiling point.", "Je stärker verzweigt, desto kompakter (fast kugelig) das Molekül: kleinere Berührungsfläche, schwächere Van-der-Waals-Kräfte, niedrigere Siedetemperatur.") },
    ],
    mistakes,
  };
}

function isomerCountTask(rng: Rng): Exercise {
  const n = rng.pick([4, 5, 6]);
  const value = ISOMERS[n];
  const m = numberMistakes(value);
  m.add(value + 1, tx("Counted one twice", "Eins doppelt gezählt"), tx("Check for doubles: 2-methyl… and the same molecule numbered from the other end (3-methyl… or 4-methyl…) are one and the same isomer.", "Prüf auf Doppelte: 2-Methyl… und dasselbe Molekül von der anderen Seite nummeriert (3- oder 4-Methyl…) sind ein und dasselbe Isomer."));
  m.add(value - 1, tx("The straight one counts too", "Das unverzweigte zählt mit"), tx("Did you leave out the unbranched chain? It has the same formula, so it's one of the isomers too.", "Hast du die unverzweigte Kette weggelassen? Sie hat dieselbe Summenformel, also ist sie auch eines der Isomere."));
  if (n === 6) m.add(value + 2, tx("Doubles or bent chains", "Doppelte oder abgeknickte Ketten"), tx("A chain drawn with a bend is still the same molecule. Name each candidate: same name, same isomer.", "Eine abgeknickt gezeichnete Kette bleibt dasselbe Molekül. Benenne jeden Kandidaten: gleicher Name, gleiches Isomer."));
  const list = n === 4 ? ["Butan", "2-Methylpropan"] : n === 5 ? ["Pentan", "2-Methylbutan", "2,2-Dimethylpropan"] : ["Hexan", "2-Methylpentan", "3-Methylpentan", "2,2-Dimethylbutan", "2,3-Dimethylbutan"];
  const listEn = list.map((x) => x.replace(/an$/, "ane").toLowerCase());
  return {
    instruction: tx("Count the isomers", "Zähl die Isomere"),
    text: txMap((t) => t(`How many different alkanes (isomers) have the molecular formula $\\ce{${alkaneFormula(n)}}$? Include the unbranched one.`, `Wie viele verschiedene Alkane (Isomere) haben die Summenformel $\\ce{${alkaneFormula(n)}}$? Das unverzweigte zählt mit.`)),
    answer: { kind: "number", value },
    hint: tx("Start with the straight chain, then shorten it by one C atom and attach it as a methyl group in every possible place, then by two… Name each one to spot doubles.", "Fang mit der geraden Kette an, kürz sie dann um ein C-Atom und häng es als Methylgruppe an jede mögliche Stelle, dann um zwei … Benenne jedes, um Doppelte zu erkennen."),
    solution: [
      { math: `\\ce{${alkaneFormula(n)}}`, note: tx(`Systematically: longest chain first, then shorter main chains with side chains.`, `Systematisch: zuerst die längste Kette, dann kürzere Hauptketten mit Seitenketten.`) },
      { math: tx(listEn.map((x) => `"${x}"`).join(" \\quad "), list.map((x) => `"${x}"`).join(" \\quad ")), note: tx(`That's **${value}** isomers.`, `Das sind **${value}** Isomere.`) },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Combustion

function combustion(n: number): Exercise {
  const f = alkaneFormula(n);
  const eq = `${f} + O2 -> CO2 + H2O`;
  const coefs = solve(eq)!;
  const st = strategy({ eq })!;
  const mistakes = balanceMistakes({ eq, coefs, kind: "combustion" }, { half: st.half });
  // H atoms written as water molecules: 2n+2 H2O.
  const hw = [1, 2 * n + 1, n, 2 * n + 2];
  const g = gcdOf(hw);
  const hwr = hw.map((x) => x / g);
  if (!mistakes.some((m) => m.when.kind === "balance" && m.when.coefficients.join() === hwr.join()) && hwr.join() !== coefs.join())
    mistakes.push({
      when: { kind: "balance", equation: eq, coefficients: hwr },
      title: tx("H atoms as water molecules", "H-Atome als Wassermoleküle"),
      say: tx(
        `I think you put ${2 * n + 2} in front of $\\ce{H2O}$, one water molecule per H atom. But every $\\ce{H2O}$ takes **two** H atoms.`,
        `Ich glaub, du hast ${2 * n + 2} vor $\\ce{H2O}$ geschrieben, ein Wassermolekül pro H-Atom. Aber jedes $\\ce{H2O}$ nimmt **zwei** H-Atome mit.`,
      ),
    });
  return {
    instruction: tx("Balance the combustion", "Gleiche die Verbrennung aus"),
    text: txMap((t) => t(`Complete combustion of ${PARENT_EN[n - 1]}: ${PARENT_EN[n - 1]} + oxygen → carbon dioxide + water`, `Vollständige Verbrennung von ${PARENT_DE[n - 1]}: ${PARENT_DE[n - 1]} + Sauerstoff → Kohlenstoffdioxid + Wasser`)),
    answer: { kind: "balance", equation: eq, coefficients: coefs },
    hint: tx("**C** first, then **H**, **O** last. A half in front of $\\ce{O2}$? Double everything.", "Zuerst **C**, dann **H**, **O** zuletzt. Ein Halbes vor $\\ce{O2}$? Alles verdoppeln."),
    solution: st.frames,
    mistakes,
  };
}

// ---------------------------------------------------------------------------

function generate(level: Level, rng: Rng): Exercise {
  const r = rng.next();
  if (level === 1) {
    if (r < 0.22) return nameFromFormula(rng);
    if (r < 0.44) return formulaFromName(rng.int(1, 10));
    if (r < 0.58) return hCount(rng);
    if (r < 0.72) return stateTask(rng);
    if (r < 0.86) return formulaTypeTask(rng);
    return seriesStepTask(rng);
  }
  if (level === 2) {
    if (r < 0.2) return nameExercise(randomSkeleton(rng, { minRow: 4, maxRow: 7, subs: [1, 2], ethyl: false, trap: "no", maxC: 9 }), rng);
    if (r < 0.32) return locantTask(rng);
    if (r < 0.5) return combustion(rng.pick([1, 3, 5, 7, 9]));
    if (r < 0.6) return rng.chance(0.5) ? formulaFromName(rng.int(5, 10)) : formulaFromH(rng);
    if (r < 0.7) return bpOrderTask(rng);
    if (r < 0.8) return gasesTask(rng);
    if (r < 0.9) return isomerChoiceTask(rng);
    return branchedFormulaTask(rng, 2);
  }
  if (r < 0.22) return nameExercise(randomSkeleton(rng, { minRow: 4, maxRow: 7, subs: [1, 3], ethyl: true, trap: "maybe", maxC: 10 }), rng);
  if (r < 0.42) return combustion(rng.pick([2, 4, 6, 8, 10]));
  if (r < 0.56) return longestChainTask(rng);
  if (r < 0.7) return whatsWrongTask(rng);
  if (r < 0.8) return bpBranchedTask(rng);
  if (r < 0.88) return isomerCountTask(rng);
  return branchedFormulaTask(rng, 3);
}

// ---------------------------------------------------------------------------
// Lesson

const bondFrames: Frame[] = [
  { math: "\\ce{C#c}", note: tx("A carbon atom has 4 outer electrons. So it forms **four** bonds: carbon is tetravalent.", "Ein Kohlenstoffatom hat 4 Außenelektronen. Es bildet deshalb **vier** Bindungen: Kohlenstoff ist vierbindig.") },
  { math: "\\ce{C#c H4#h}", note: tx("Methane $\\ce{CH4}$: one C atom with four H atoms. The simplest alkane, the main part of natural gas.", "Methan $\\ce{CH4}$: ein C-Atom mit vier H-Atomen. Das einfachste Alkan, Hauptbestandteil von Erdgas.") },
  { math: "\\ce{CH3#a –#b CH3#d}", note: tx("Ethane: two C atoms joined by a **single bond**. Each of them still carries three H atoms.", "Ethan: zwei C-Atome, verbunden durch eine **Einfachbindung**. Jedes trägt noch drei H-Atome.") },
  { math: "\\ce{CH3#a –#b CH2#e –#f CH3#d}", highlight: ["e"], note: tx("Propane: the chain grows. A C atom in the middle has two bonds to its neighbours, so only two H atoms.", "Propan: Die Kette wächst. Ein C-Atom in der Mitte hat zwei Bindungen zu seinen Nachbarn, also nur noch zwei H-Atome.") },
  { math: "\\ce{C3H8}", note: tx("Alkanes contain only C and H (hydrocarbons) and only **single bonds**. That's why they're called **saturated**.", "Alkane enthalten nur C und H (Kohlenwasserstoffe) und nur **Einfachbindungen**. Deshalb heißen sie **gesättigt**.") },
];

const seriesFrames: Frame[] = [
  { math: "\\ce{CH4} \\quad \\ce{C2H6} \\quad \\ce{C3H8} \\quad \\ce{C4H10}", note: tx("Methane, ethane, propane, butane: each next alkane has one more **CH₂ group**.", "Methan, Ethan, Propan, Butan: Jedes nächste Alkan hat eine **CH₂-Gruppe** mehr.") },
  {
    math: "\\ce{C5H12} \\quad \\ce{C6H14} \\quad \\ce{C7H16} \\quad \\ce{C8H18}",
    note: tx("From five C atoms on, the names come from Greek and Latin numbers: pentane (5), hexane (6), heptane (7), octane (8), nonane (9), decane (10). All end in **-ane**.", "Ab fünf C-Atomen kommen die Namen von griechischen und lateinischen Zahlwörtern: Pentan (5), Hexan (6), Heptan (7), Octan (8), Nonan (9), Decan (10). Alle enden auf **-an**."),
  },
  { math: generalFormula, note: tx("A series like this is called a **homologous series**. Its general molecular formula: $\\ce{C}_n\\ce{H}_{2n+2}$.", "So eine Reihe heißt **homologe Reihe**. Ihre allgemeine Summenformel: $\\ce{C}_n\\ce{H}_{2n+2}$.") },
  { math: "\\ce{C}_6 \\ce{H}_{2 \\cdot 6 + 2} = \\ce{C6H14}", note: tx("Why $2n + 2$? Every C atom carries two H atoms, and the two ends one extra each. Hexane: $2 \\cdot 6 + 2 = 14$.", "Warum $2n + 2$? Jedes C-Atom trägt zwei H-Atome, die beiden Enden je eins mehr. Hexan: $2 \\cdot 6 + 2 = 14$.") },
];

const namingLessonFrames: Frame[] = [
  { math: "\\ce{CH3–CH(CH3)–CH2–CH3}", note: tx("The longest chain has **4** C atoms: stem **butane**. One C atom carries a $\\ce{CH3}$ group: a **methyl group**.", "Die längste Kette hat **4** C-Atome: Stammname **Butan**. An einem C-Atom hängt eine $\\ce{CH3}$-Gruppe: eine **Methylgruppe**.") },
  { math: tx('2#l \\quad "methyl"#m \\quad "butane"#p', '2#l \\quad "Methyl"#m \\quad "butan"#p'), highlight: ["l"], note: tx("Number from the end **closer** to the branch: the methyl group sits at C atom 2 (from the other end it would be 3).", "Nummeriere von dem Ende, das der Verzweigung **näher** ist: Die Methylgruppe sitzt an C-Atom 2 (vom anderen Ende wäre es 3).") },
  { math: tx('"2-methylbutane"', '"2-Methylbutan"'), note: tx("Put together: number, hyphen, side chain, stem. **2-Methylbutane**.", "Zusammengesetzt: Nummer, Bindestrich, Seitenkette, Stammname. **2-Methylbutan**.") },
  { math: "\\ce{CH3–CH(CH3)–CH(CH3)–CH3}", note: tx("Two methyl groups? Each one gets its own number, and a number word gives the count: **di** (2), **tri** (3), **tetra** (4).", "Zwei Methylgruppen? Jede bekommt ihre eigene Nummer, und ein Zahlwort sagt, wie viele: **di** (2), **tri** (3), **tetra** (4).") },
  { math: tx('"2,3-dimethylbutane"', '"2,3-Dimethylbutan"'), note: tx("**2,3-Dimethylbutane**: numbers separated by a comma, then dimethyl, then the stem.", "**2,3-Dimethylbutan**: Nummern mit Komma, dann Dimethyl, dann der Stammname.") },
  { math: "\\ce{CH3–CH(CH3)–CH(CH2CH3)–CH2–CH3}", note: tx("Different side chains go in **alphabetical** order: ethyl before methyl. That makes **3-ethyl-2-methylpentane**.", "Verschiedene Seitenketten kommen **alphabetisch**: Ethyl vor Methyl. Das ergibt **3-Ethyl-2-methylpentan**.") },
  {
    math: "\\ce{CH3–CH2–CH2–CH3} \\quad \\ce{CH3–CH(CH3)–CH3}",
    note: tx("Butane and 2-methylpropane both have the formula $\\ce{C4H10}$ but a different structure: they are **isomers**. Their properties differ too: they boil at −1 °C and −12 °C.", "Butan und 2-Methylpropan haben beide die Summenformel $\\ce{C4H10}$, aber eine andere Struktur: Sie sind **Isomere**. Auch ihre Eigenschaften unterscheiden sich: Sie sieden bei −1 °C und −12 °C."),
  },
];

const BUTANE = 4;
const combustionFrames: Frame[] = [
  { math: tx('"butane" + "oxygen" -> "carbon dioxide" + "water"', '"Butan" + "Sauerstoff" -> "Kohlenstoffdioxid" + "Wasser"'), note: tx("In complete combustion, an alkane and oxygen form only carbon dioxide and water.", "Bei der vollständigen Verbrennung bilden ein Alkan und Sauerstoff nur Kohlenstoffdioxid und Wasser.") },
  ...strategy({ eq: `${alkaneFormula(BUTANE)} + O2 -> CO2 + H2O` })!.frames,
];

const propertiesOptions: Text[] = [
  tx("The longer the chain, the higher the boiling point.", "Je länger die Kette, desto höher die Siedetemperatur."),
  tx("Methane to butane are gases at 20 °C.", "Methan bis Butan sind bei 20 °C gasförmig."),
  tx("Alkanes don't dissolve in water.", "Alkane lösen sich nicht in Wasser."),
  tx("Alkane molecules are held together by hydrogen bonds.", "Alkanmoleküle werden durch Wasserstoffbrücken zusammengehalten."),
  tx("The longer the chain, the weaker the van der Waals forces.", "Je länger die Kette, desto schwächer die Van-der-Waals-Kräfte."),
];
const propertiesCheck: Exercise = {
  instruction: tx("Select all true statements", "Wähle alle richtigen Aussagen"),
  text: tx("Which statements about alkanes are true?", "Welche Aussagen über Alkane stimmen?"),
  answer: { kind: "multi", options: propertiesOptions, correct: [0, 1, 2] },
  hint: tx("Alkanes are non-polar. Between their molecules only van der Waals forces act, and those grow with the size of the molecules.", "Alkane sind unpolar. Zwischen ihren Molekülen wirken nur Van-der-Waals-Kräfte, und die wachsen mit der Größe der Moleküle."),
  solution: [
    { math: "\\ce{C4H10}: -1 \"°C\" \\quad \\ce{C8H18}: 126 \"°C\"", note: tx("Longer chains: larger contact surface, stronger van der Waals forces, higher boiling point. Methane to butane boil below 20 °C.", "Längere Ketten: größere Berührungsfläche, stärkere Van-der-Waals-Kräfte, höhere Siedetemperatur. Methan bis Butan sieden unter 20 °C.") },
    { math: tx('\\ce{C–H}: \\quad \\Delta EN = 2.55 - 2.20 = 0.35', '\\ce{C–H}: \\quad \\Delta EN = 2,55 - 2,20 = 0,35'), note: tx("The C–H bond is practically non-polar. No partial charges, no hydrogen bonds: alkanes are **hydrophobic** and don't mix with water.", "Die C–H-Bindung ist praktisch unpolar. Keine Teilladungen, keine Wasserstoffbrücken: Alkane sind **hydrophob** und mischen sich nicht mit Wasser.") },
  ],
  mistakes: [
    {
      when: { kind: "multi", options: propertiesOptions, correct: [0, 1, 2, 3] },
      title: tx("No hydrogen bonds", "Keine Wasserstoffbrücken"),
      say: tx("Hydrogen bonds need H atoms bonded to N, O or F. In alkanes H sits on C, and that bond is practically non-polar: only van der Waals forces act.", "Wasserstoffbrücken brauchen H-Atome an N, O oder F. In Alkanen sitzt H am C, und diese Bindung ist praktisch unpolar: Es wirken nur Van-der-Waals-Kräfte."),
    },
    {
      when: { kind: "multi", options: propertiesOptions, correct: [0, 1] },
      title: tx("What about water?", "Und Wasser?"),
      say: tx("Alkanes are non-polar, water is polar. Think of petrol or oil on a puddle: they don't mix.", "Alkane sind unpolar, Wasser ist polar. Denk an Benzin oder Öl auf einer Pfütze: Die mischen sich nicht."),
    },
    {
      when: { kind: "multi", options: propertiesOptions, correct: [1, 2, 4] },
      title: tx("The other way round", "Genau andersrum"),
      say: tx("Longer chains touch each other over a larger surface, so the van der Waals forces get **stronger**, and the boiling point rises.", "Längere Ketten berühren sich auf einer größeren Fläche, die Van-der-Waals-Kräfte werden also **stärker**, und die Siedetemperatur steigt."),
    },
  ],
};

const TRAP: Skeleton = { row: 4, branches: [{ at: 2, len: 2, dir: 1 }] };

const alkanes: Topic = {
  ...topicMeta("alkanes"),
  summary: [
    {
      title: tx("Alkanes", "Alkane"),
      body: tx(
        "Hydrocarbons with only single bonds (saturated). Carbon is tetravalent: every C atom forms four bonds. General formula $\\ce{C}_n\\ce{H}_{2n+2}$.",
        "Kohlenwasserstoffe mit nur Einfachbindungen (gesättigt). Kohlenstoff ist vierbindig: Jedes C-Atom bildet vier Bindungen. Allgemeine Formel $\\ce{C}_n\\ce{H}_{2n+2}$.",
      ),
      examples: [generalFormula, "\\ce{CH4} \\quad \\ce{C2H6} \\quad \\ce{C3H8} \\quad \\ce{C4H10}"],
      tone: "rule",
    },
    {
      title: tx("The homologous series", "Die homologe Reihe"),
      body: tx(
        "Methane, ethane, propane, butane, pentane, hexane, heptane, octane, nonane, decane. Neighbours differ by one $\\ce{CH2}$ group.",
        "Methan, Ethan, Propan, Butan, Pentan, Hexan, Heptan, Octan, Nonan, Decan. Nachbarn unterscheiden sich um eine $\\ce{CH2}$-Gruppe.",
      ),
      examples: [tx('\\ce{C5H12} \\quad "pentane" \\quad \\ce{C8H18} \\quad "octane"', '\\ce{C5H12} \\quad "Pentan" \\quad \\ce{C8H18} \\quad "Octan"')],
      tone: "rule",
    },
    {
      title: tx("Three ways to write it", "Drei Schreibweisen"),
      body: tx(
        "**Molecular formula**: which atoms, how many. **Condensed structural formula**: the chain with its groups. **Structural formula**: every atom and every bond.",
        "**Summenformel**: welche Atome, wie viele. **Halbstrukturformel**: die Kette mit ihren Gruppen. **Strukturformel**: jedes Atom und jede Bindung.",
      ),
      examples: ["\\ce{C4H10} \\quad \\ce{CH3–CH2–CH2–CH3}"],
      tone: "tip",
    },
    {
      title: tx("Naming branched alkanes", "Verzweigte Alkane benennen"),
      body: tx(
        "1. Longest chain (it may bend) gives the stem. 2. Number it so the side chains get the smallest numbers. 3. Side chains (methyl, ethyl) alphabetically, di/tri/tetra for repeats.",
        "1. Längste Kette (sie darf abknicken) gibt den Stammnamen. 2. So nummerieren, dass die Seitenketten die kleinsten Nummern bekommen. 3. Seitenketten (Methyl, Ethyl) alphabetisch, di/tri/tetra für gleiche.",
      ),
      examples: [tx('\\ce{CH3–CH(CH3)–CH(CH3)–CH3} \\quad "2,3-dimethylbutane"', '\\ce{CH3–CH(CH3)–CH(CH3)–CH3} \\quad "2,3-Dimethylbutan"')],
      tone: "rule",
    },
    {
      title: tx("Properties", "Eigenschaften"),
      body: tx(
        "Only weak van der Waals forces between the molecules: the longer the chain, the stronger they are and the higher the boiling point. Methane to butane are gases at 20 °C, from pentane on liquids. Non-polar, so insoluble in water (hydrophobic).",
        "Zwischen den Molekülen wirken nur schwache Van-der-Waals-Kräfte: Je länger die Kette, desto stärker sind sie und desto höher die Siedetemperatur. Methan bis Butan sind bei 20 °C gasförmig, ab Pentan flüssig. Unpolar, also nicht wasserlöslich (hydrophob).",
      ),
      tone: "tip",
    },
    {
      title: tx("Combustion and classic slips", "Verbrennung und typische Fehler"),
      body: tx(
        "Complete combustion gives carbon dioxide and water. Watch out: alkanes are $\\ce{C}_n\\ce{H}_{2n+2}$, not $\\ce{C}_n\\ce{H}_{2n}$, and number the chain from the end closer to the branch.",
        "Vollständige Verbrennung ergibt Kohlenstoffdioxid und Wasser. Vorsicht: Alkane sind $\\ce{C}_n\\ce{H}_{2n+2}$, nicht $\\ce{C}_n\\ce{H}_{2n}$, und nummeriert wird vom Ende, das der Verzweigung näher ist.",
      ),
      examples: ["\\ce{CH4 + 2O2 -> CO2 + 2H2O}", "\\ce{2C2H6 + 7O2 -> 4CO2 + 6H2O}"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Carbon forms four bonds", "Kohlenstoff bildet vier Bindungen"),
      blob: tx("Carbon is the Lego brick of chemistry. Four connectors, endless chains!", "Kohlenstoff ist der Legostein der Chemie. Vier Anschlüsse, endlose Ketten!"),
      body: tx(
        "Alkanes are **hydrocarbons**: they consist only of carbon and hydrogen atoms. Each C atom forms four covalent bonds, each H atom one.",
        "Alkane sind **Kohlenwasserstoffe**: Sie bestehen nur aus Kohlenstoff- und Wasserstoffatomen. Jedes C-Atom bildet vier Elektronenpaarbindungen, jedes H-Atom eine.",
      ),
      frames: bondFrames,
    },
    {
      type: "widget",
      title: tx("Build an alkane", "Bau dir ein Alkan"),
      blob: tx("Tap plus and watch the chain grow, hydrogens and all!", "Tipp auf Plus und schau, wie die Kette wächst, samt Wasserstoff!"),
      body: tx(
        "Left you see the **structural formula** with every bond. Right: the **molecular formula** (which atoms, how many) and the **condensed structural formula** (the chain with its CH₃ and CH₂ groups).",
        "Links siehst du die **Strukturformel** mit jeder Bindung. Rechts: die **Summenformel** (welche Atome, wie viele) und die **Halbstrukturformel** (die Kette mit ihren CH₃- und CH₂-Gruppen).",
      ),
      widget: AlkanesBuilder,
    },
    {
      type: "explain",
      title: tx("The homologous series", "Die homologe Reihe"),
      blob: tx("Meth, eth, prop, but: the first four you just learn. After that, it's counting!", "Meth, Eth, Prop, But: Die ersten vier lernst du auswendig. Danach wird gezählt!"),
      body: tx("Lined up by chain length, the alkanes form a family whose members differ by one $\\ce{CH2}$ group.", "Nach Kettenlänge sortiert bilden die Alkane eine Familie, deren Mitglieder sich um eine $\\ce{CH2}$-Gruppe unterscheiden."),
      frames: seriesFrames,
    },
    { type: "check", blob: tx("Octane, like in the petrol pump. Formula, please!", "Octan, wie an der Zapfsäule. Die Formel, bitte!"), exercise: formulaFromName(8) },
    {
      type: "widget",
      title: tx("Boiling points and van der Waals forces", "Siedetemperaturen und Van-der-Waals-Kräfte"),
      blob: tx("Drag the temperature line. What's a gas, what's a liquid?", "Zieh die Temperaturlinie. Was ist gasförmig, was flüssig?"),
      body: tx(
        "Between alkane molecules only weak **van der Waals forces** act. The longer the chain, the larger the contact surface and the stronger the attraction: the boiling point rises.\n\nAlkanes are **non-polar**. They don't dissolve in water (**hydrophobic**), but they do mix with fats and oils (lipophilic). They are less dense than water and float on top.",
        "Zwischen Alkanmolekülen wirken nur schwache **Van-der-Waals-Kräfte**. Je länger die Kette, desto größer die Berührungsfläche und desto stärker die Anziehung: Die Siedetemperatur steigt.\n\nAlkane sind **unpolar**. In Wasser lösen sie sich nicht (**hydrophob**), mit Fetten und Ölen mischen sie sich gut (lipophil). Sie haben eine geringere Dichte als Wasser und schwimmen oben.",
      ),
      widget: AlkanesBoiling,
    },
    { type: "check", blob: tx("Pick every statement that's true. Careful, two are traps!", "Wähl jede Aussage, die stimmt. Vorsicht, zwei sind Fallen!"), exercise: propertiesCheck },
    {
      type: "explain",
      title: tx("Branched alkanes and their names", "Verzweigte Alkane und ihre Namen"),
      blob: tx("Chains can branch. The IUPAC rules give every molecule exactly one name.", "Ketten können sich verzweigen. Die IUPAC-Regeln geben jedem Molekül genau einen Namen."),
      body: tx(
        "1. Find the **longest chain**: it gives the stem. 2. **Number** it so the side chains get the smallest numbers. 3. Name the side chains: methyl (–CH₃), ethyl (–C₂H₅), alphabetically, with di, tri, tetra for repeats.",
        "1. Such die **längste Kette**: Sie gibt den Stammnamen. 2. **Nummeriere** sie so, dass die Seitenketten die kleinsten Nummern bekommen. 3. Benenne die Seitenketten: Methyl (–CH₃), Ethyl (–C₂H₅), alphabetisch, mit di, tri, tetra für gleiche.",
      ),
      frames: namingLessonFrames,
    },
    {
      type: "widget",
      title: tx("Branch it yourself", "Verzweige selbst"),
      blob: tx("Hang methyl groups on the chain. Can you find all five isomers of C₆H₁₄?", "Häng Methylgruppen an die Kette. Findest du alle fünf Isomere von C₆H₁₄?"),
      body: tx(
        "Tap a carbon atom of the chain to attach a methyl group. The purple bonds show the main chain, the small numbers its numbering. Try a methyl group at the very end of the chain too!",
        "Tipp auf ein C-Atom der Kette, um eine Methylgruppe anzuhängen. Die lila Bindungen zeigen die Hauptkette, die kleinen Zahlen ihre Nummerierung. Probier auch eine Methylgruppe ganz am Kettenende!",
      ),
      widget: AlkanesBranchBuilder,
    },
    { type: "check", blob: tx("Careful, this one's drawn sneakily. Where's the longest chain?", "Vorsicht, das hier ist gemein gezeichnet. Wo ist die längste Kette?"), exercise: nameExercise(TRAP, createRng(11)) },
    {
      type: "explain",
      title: tx("Burning alkanes", "Alkane verbrennen"),
      blob: tx("Natural gas, petrol, camping gas: alkanes are our fuels.", "Erdgas, Benzin, Campinggas: Alkane sind unsere Brennstoffe."),
      body: tx(
        "With enough oxygen, alkanes burn **completely** to carbon dioxide and water and release a lot of energy. With too little oxygen, poisonous carbon monoxide and soot form as well. Balance: **C** first, then **H**, **O** last.",
        "Mit genug Sauerstoff verbrennen Alkane **vollständig** zu Kohlenstoffdioxid und Wasser und geben dabei viel Energie ab. Bei zu wenig Sauerstoff entstehen auch giftiges Kohlenstoffmonoxid und Ruß. Ausgleichen: zuerst **C**, dann **H**, **O** zuletzt.",
      ),
      frames: combustionFrames,
    },
    { type: "check", blob: tx("Pentane burns. C, then H, then O!", "Pentan brennt. Erst C, dann H, dann O!"), exercise: combustion(5) },
  ],
  generate,
};

export default alkanes;
