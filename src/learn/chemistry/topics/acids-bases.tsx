"use client";

import type { ComponentType } from "react";
import type { Locale } from "@/i18n/config";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { topicMeta } from "@/learn/catalog";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Mistake, SingleLessonTopic as Topic } from "@/learn/types";
import {
  ACIDS,
  AMMONIUM,
  CLEAR_CUT,
  COLOUR,
  HYDROXIDES,
  INDICATOR_RANGES,
  NATURE,
  PROTOLYSES,
  acid,
  base,
  indicator,
  natureOf,
  neutralisation,
  saltCounts,
  saltFormula,
  saltName,
  shade,
  type Acid,
  type Base,
  type ColourId,
  type IndicatorId,
  type Nature,
} from "../acids-bases-data";
import { balanceMistakes, coefSrc } from "../balancing-core";
import { dec } from "../format";
import { parseFormula, sameCounts } from "../formula";
import { AcidsBasesNeutralise } from "../visuals/AcidsBasesNeutralise";
import { AcidsBasesPh, IndicatorTube } from "../visuals/AcidsBasesPh";
import { AcidsBasesProtonHop } from "../visuals/AcidsBasesProtonHop";

// ---------------------------------------------------------------------------
// Helpers

/** Build display maths in both languages: m(r => `"${r(word)}" …`). */
const m = (build: (r: (t: Text) => string, l: Locale) => string): Text => txMap((_, l) => build((t) => resolveText(t, l), l));
const en = (t: Text) => resolveText(t, "en");
const de = (t: Text) => resolveText(t, "de");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Unit for display maths: mol/L in English, mol/l as in most German school books. */
const MOL = tx('"mol/L"', '"mol/l"');
const ce = (s: string) => `\\ce{${s}}`;
/** Inline formula for rich text. */
const f$ = (s: string) => `$\\ce{${s}}$`;

type Wrong = { text: Text; title: Text; say: Text; close?: boolean };

/** One right option and typical wrong ones, shuffled (or in the given order when rng is null). */
function oneOf(rng: Rng | null, right: Text, wrongs: Wrong[]): { answer: AnswerSpec; mistakes: Mistake[] } {
  const items = [{ text: right, w: null as Wrong | null }, ...wrongs.map((w) => ({ text: w.text, w }))];
  const order = rng ? rng.shuffle(items) : items;
  const options = order.map((o) => o.text);
  return {
    answer: { kind: "choice", options, correct: order.findIndex((o) => o.w === null) },
    mistakes: order.flatMap((o, i): Mistake[] => (o.w ? [{ when: { kind: "choice", options, correct: i }, title: o.w.title, say: o.w.say, close: o.w.close }] : [])),
  };
}

/** Typical wrong numbers: dropped when they equal the right value or an earlier mistake. */
function numberMistakes(right: number, list: [number, Text, Text, boolean?][]): Mistake[] {
  const out: Mistake[] = [];
  for (const [v, title, say, close] of list) {
    if (!Number.isFinite(v) || Math.abs(v - right) < 1e-9) continue;
    if (out.some((o) => o.when.kind === "number" && Math.abs(o.when.value - v) < 1e-9)) continue;
    out.push({ when: { kind: "number", value: v }, title, say, close });
  }
  return out;
}

/** Typical wrong formulas: dropped when they mean the same as the right one or an earlier mistake. */
function formulaMistakes(right: string, list: [string, Text, Text, boolean?][]): Mistake[] {
  const same = (a: string, b: string) => {
    const x = parseFormula(a);
    const y = parseFormula(b);
    return x.ok && y.ok && sameCounts(x.species.counts, y.species.counts) && x.species.charge === y.species.charge;
  };
  const out: Mistake[] = [];
  for (const [v, title, say, close] of list) {
    if (!parseFormula(v).ok || same(v, right) || out.some((o) => o.when.kind === "formula" && same(o.when.value, v))) continue;
    out.push({ when: { kind: "formula", value: v }, title, say, close });
  }
  return out;
}

const sameSet = (a: number[], b: number[]) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

function multiMistakes(options: Text[], right: number[], list: [number[], Text, Text][]): Mistake[] {
  const out: Mistake[] = [];
  for (const [picked, title, say] of list) {
    if (!picked.length || sameSet(picked, right) || out.some((o) => o.when.kind === "multi" && sameSet(o.when.correct, picked))) continue;
    out.push({ when: { kind: "multi", options, correct: [...picked].sort((a, b) => a - b) }, title, say });
  }
  return out;
}

const NATURES: Nature[] = ["acidic", "neutral", "alkaline"];
const NATURE_OPTS: Record<Nature, Text> = {
  acidic: tx("The solution is acidic.", "Die Lösung ist sauer."),
  neutral: tx("The solution is neutral.", "Die Lösung ist neutral."),
  alkaline: tx("The solution is alkaline.", "Die Lösung ist alkalisch."),
};
/** The nature as a quoted word for display maths. */
const NATURE_MATH: Record<Nature, Text> = {
  acidic: tx('"acidic"', '"sauer"'),
  neutral: tx('"neutral: neither acidic nor alkaline"', '"neutral: weder sauer noch alkalisch"'),
  alkaline: tx('"alkaline"', '"alkalisch"'),
};
/** The pH scale in three lines. */
const SCALE: Text = tx('"acidic:" \\; "pH" < 7 \\\\ "neutral:" \\; "pH" = 7 \\\\ "alkaline:" \\; "pH" > 7', '"sauer:" \\; "pH" < 7 \\\\ "neutral:" \\; "pH" = 7 \\\\ "alkalisch:" \\; "pH" > 7');

/** Fixed-order options acidic / neutral / alkaline with mistakes for some wrong ones. */
function natureChoice(right: Nature, wrong: Partial<Record<Nature, { title: Text; say: Text; close?: boolean }>>) {
  const options = NATURES.map((n) => NATURE_OPTS[n]);
  const mistakes: Mistake[] = [];
  NATURES.forEach((n, i) => {
    const w = wrong[n];
    if (n !== right && w) mistakes.push({ when: { kind: "choice", options, correct: i }, title: w.title, say: w.say, close: w.close });
  });
  return { answer: { kind: "choice", options, correct: NATURES.indexOf(right) } as AnswerSpec, mistakes };
}

const SCALE_WRONG = {
  title: tx("Scale the wrong way round", "Skala falsch herum"),
  say: tx(
    "Careful, the pH scale runs the other way: **small** pH values are acidic, **large** ones alkaline. The lower the number, the more $\\ce{H3O+}$ ions.",
    "Vorsicht, die pH-Skala läuft andersherum: **Kleine** pH-Werte sind sauer, **große** alkalisch. Je kleiner die Zahl, desto mehr $\\ce{H3O+}$-Ionen.",
  ),
};

/** Colour names for answer options (German and English differ in every option). */
const colourOpt = (id: ColourId): Text => (id === "pink" ? tx("pink (red-violet)", "pink (rotviolett)") : id === "orange" ? tx("orange", "orangefarben") : COLOUR[id]);

const tube = (hex: string | null, caption: Text) => ({ component: IndicatorTube as unknown as ComponentType<Record<string, unknown>>, props: { hex, caption } });

// ---------------------------------------------------------------------------
// Level 1: acidic, neutral, alkaline

function classifyPh(rng: Rng): Exercise {
  const ph = rng.pick([0, 1, 2, 3, 4, 5, 6, 7, 7, 8, 9, 10, 11, 12, 13, 14]);
  const nature = natureOf(ph);
  const near = ph === 6 || ph === 8;
  const wrong: Partial<Record<Nature, { title: Text; say: Text; close?: boolean }>> = {};
  if (nature === "neutral") {
    const middle = {
      title: tx("7 is the middle", "7 ist die Mitte"),
      say: tx("pH 7 sits exactly in the middle of the scale from 0 to 14: there are just as many $\\ce{H3O+}$ as $\\ce{OH-}$ ions.", "pH 7 liegt genau in der Mitte der Skala von 0 bis 14: Es gibt gleich viele $\\ce{H3O+}$- wie $\\ce{OH-}$-Ionen."),
    };
    wrong.acidic = middle;
    wrong.alkaline = middle;
  } else {
    wrong[nature === "acidic" ? "alkaline" : "acidic"] = SCALE_WRONG;
    wrong.neutral = near
      ? {
          title: tx("Only exactly 7 is neutral", "Nur genau 7 ist neutral"),
          say: tx(`Close to 7, yes! But only pH 7 itself is neutral. pH ${ph} is a little to one side of the middle.`, `Nah an der 7, stimmt! Aber neutral ist nur pH 7 selbst. pH ${ph} liegt ein bisschen neben der Mitte.`),
          close: true,
        }
      : {
          title: tx("Neutral is the middle", "Neutral ist die Mitte"),
          say: tx(`Neutral is only the middle of the scale, pH 7. pH ${ph} is far from it.`, `Neutral ist nur die Mitte der Skala, pH 7. pH ${ph} ist weit davon entfernt.`),
        };
  }
  const rel = ph < 7 ? "<" : ph > 7 ? ">" : "=";
  return {
    instruction: tx("Acidic, neutral or alkaline?", "Sauer, neutral oder alkalisch?"),
    text: tx(`A solution has a pH of **${ph}**. What does that tell you?`, `Eine Lösung hat den pH-Wert **${ph}**. Was sagt dir das?`),
    ...natureChoice(nature, wrong),
    hint: tx("The scale runs from 0 to 14. Which value is the middle, and which side is acidic?", "Die Skala geht von 0 bis 14. Welcher Wert ist die Mitte, und welche Seite ist sauer?"),
    solution: [
      { math: SCALE, note: tx("Below 7 acidic, exactly 7 neutral, above 7 alkaline (basic).", "Unter 7 sauer, genau 7 neutral, über 7 alkalisch (basisch).") },
      {
        math: m((r) => `"pH" = ${ph} ${ph === 7 ? "" : `${rel} 7 `}\\Rightarrow ${r(NATURE_MATH[nature])}`),
        note: tx(`So the solution is **${en(NATURE[nature])}**.`, `Die Lösung ist also **${de(NATURE[nature])}**.`),
      },
    ],
  };
}

function classifySubstance(rng: Rng): Exercise {
  const x = rng.pick(CLEAR_CUT);
  const wrong: Partial<Record<Nature, { title: Text; say: Text }>> = {};
  for (const n of NATURES) {
    if (n === x.nature) continue;
    wrong[n] =
      x.nature === "neutral"
        ? { title: tx("Think about what's in it", "Denk an die Inhaltsstoffe"), say: txMap((t, l) => `${t("Hmm, is there anything in it that gives or takes protons?", "Hm, steckt darin etwas, das Protonen abgibt oder aufnimmt?")} ${resolveText(x.why, l)}`) }
        : n === "neutral"
          ? { title: tx("Not neutral", "Nicht neutral"), say: txMap((t, l) => `${t("There's more in it than just water.", "Da ist mehr drin als nur Wasser.")} ${resolveText(x.why, l)}`) }
          : { title: tx("The other side of the scale", "Die andere Seite der Skala"), say: txMap((t, l) => `${t("Think about what's in it:", "Denk an die Inhaltsstoffe:")} ${resolveText(x.why, l)}`) };
  }
  return {
    instruction: tx("Acidic, neutral or alkaline?", "Sauer, neutral oder alkalisch?"),
    text: tx(`Is **${en(x.name)}** acidic, neutral or alkaline?`, `Ist **${de(x.name)}** sauer, neutral oder alkalisch?`),
    ...natureChoice(x.nature, wrong),
    hint: tx("Acids contain or form $\\ce{H3O+}$ ions, alkaline solutions $\\ce{OH-}$ ions. Which does this one have more of?", "Säuren enthalten oder bilden $\\ce{H3O+}$-Ionen, alkalische Lösungen $\\ce{OH-}$-Ionen. Wovon hat diese Lösung mehr?"),
    solution: [
      { math: SCALE, note: x.why },
      { math: m((r) => `"${r(x.name)}" \\Rightarrow ${r(NATURE_MATH[x.nature])}`), note: tx(`So ${en(x.name)} is **${en(NATURE[x.nature])}**.`, `${cap(de(x.name))} ist also **${de(NATURE[x.nature])}**.`) },
    ],
  };
}

/** Typical pH values that give an indicator's clear colour on each side. */
const CLEAR_PH: Record<IndicatorId, Record<Nature, number[]>> = {
  universal: { acidic: [1, 2], neutral: [7], alkaline: [12, 13] },
  bromothymol: { acidic: [2, 3, 4, 5], neutral: [7], alkaline: [9, 10, 11, 12] },
  phenolphthalein: { acidic: [1, 2, 3, 4, 5], neutral: [7], alkaline: [10, 11, 12] },
  litmus: { acidic: [1, 2, 3], neutral: [7], alkaline: [10, 11, 12, 13] },
};

const IND_IDS: IndicatorId[] = ["universal", "bromothymol", "phenolphthalein", "litmus"];

/** The indicator's colours as a display line: "acidic: yellow · neutral: green · alkaline: blue". */
const chart = (id: IndicatorId): Text => {
  const c = INDICATOR_RANGES[id];
  return m((r, l) =>
    l === "de"
      ? `"sauer: ${r(COLOUR[c.acidic])}" \\quad "neutral: ${r(COLOUR[c.neutral])}" \\quad "alkalisch: ${r(COLOUR[c.alkaline])}"`
      : `"acidic: ${r(COLOUR[c.acidic])}" \\quad "neutral: ${r(COLOUR[c.neutral])}" \\quad "alkaline: ${r(COLOUR[c.alkaline])}"`,
  );
};

function indicatorColour(rng: Rng): Exercise {
  const id = rng.pick(IND_IDS);
  const nature = rng.pick(NATURES);
  const ph = rng.pick(CLEAR_PH[id][nature]);
  const ranges = INDICATOR_RANGES[id];
  const right = ranges[nature];
  const ind = indicator(id).name;
  const pool: ColourId[] = [...new Set([ranges.acidic, ranges.neutral, ranges.alkaline])];
  // Distractors the indicator never shows anywhere on the scale.
  const shown = new Set(Array.from({ length: 15 }, (_, i) => shade(id, i).id));
  const extras: ColourId[] = (["red", "yellow", "green", "blue", "violet", "colourless", "pink"] as ColourId[]).filter((c) => !pool.includes(c) && !shown.has(c));
  while (pool.length < 4) pool.push(extras.splice(rng.int(0, extras.length - 1), 1)[0]);
  const wrongs: Wrong[] = pool
    .filter((c) => c !== right)
    .map((c) => {
      const side = (NATURES.find((n) => n !== nature && ranges[n] === c) ?? null) as Nature | null;
      if (id === "phenolphthalein" && c === "pink")
        return {
          text: colourOpt(c),
          title: tx("Phenolphthalein is choosy", "Phenolphthalein ist wählerisch"),
          say: tx("Phenolphthalein only changes colour in **alkaline** solutions. Is this solution alkaline?", "Phenolphthalein ändert seine Farbe nur in **alkalischen** Lösungen. Ist diese Lösung alkalisch?"),
        };
      if (side && side !== "neutral" && nature !== "neutral")
        return { text: colourOpt(c), title: tx("Other end of the scale", "Anderes Ende der Skala"), say: tx(`That's the colour in ${en(NATURE[side])} solutions. Is pH ${ph} really ${en(NATURE[side])}?`, `Das ist die Farbe in ${side === "acidic" ? "sauren" : "alkalischen"} Lösungen. Ist pH ${ph} wirklich ${de(NATURE[side])}?`) };
      if (side === "neutral")
        return { text: colourOpt(c), title: tx("That's neutral", "Das ist neutral"), say: tx(`That colour means neutral, pH 7. But pH ${ph} is not neutral.`, `Diese Farbe bedeutet neutral, pH 7. Aber pH ${ph} ist nicht neutral.`) };
      if (side)
        return { text: colourOpt(c), title: tx("Neutral is the middle", "Neutral ist die Mitte"), say: tx(`That's the colour in ${en(NATURE[side])} solutions. pH 7 is right in the middle.`, `Das ist die Farbe in ${side === "acidic" ? "sauren" : "alkalischen"} Lösungen. pH 7 liegt genau in der Mitte.`) };
      return {
        text: colourOpt(c),
        title: tx("Not this indicator's colour", "Nicht die Farbe dieses Indikators"),
        say: tx(`${cap(en(ind))} never turns ${en(COLOUR[c])}, whatever the pH. Which of its colours belongs to pH ${ph}?`, `${de(ind)} wird bei keinem pH-Wert ${de(COLOUR[c])}. Welche seiner Farben gehört zu pH ${ph}?`),
      };
    });
  const { answer, mistakes } = oneOf(rng, colourOpt(right), wrongs);
  return {
    instruction: tx("Which colour?", "Welche Farbe?"),
    text: tx(`You add a few drops of **${en(ind)}** to a solution with pH ${ph}. Which colour do you see?`, `Du gibst ein paar Tropfen **${de(ind)}** zu einer Lösung mit pH ${ph}. Welche Farbe siehst du?`),
    answer,
    mistakes,
    hint: tx(`First decide: is pH ${ph} acidic, neutral or alkaline? Then remember the colours of ${en(ind)}.`, `Entscheide zuerst: Ist pH ${ph} sauer, neutral oder alkalisch? Dann denk an die Farben von ${de(ind)}.`),
    solution: [
      { math: m((r) => `"pH" = ${ph} \\Rightarrow ${r(NATURE_MATH[nature])}`), note: tx(`pH ${ph} is ${en(NATURE[nature])}.`, `pH ${ph} ist ${de(NATURE[nature])}.`) },
      { math: chart(id), note: tx(`${cap(en(ind))} shows these colours. So here: **${en(COLOUR[right])}**.`, `${de(ind)} zeigt diese Farben. Hier also: **${de(COLOUR[right])}**.`) },
    ],
  };
}

function indicatorReads(rng: Rng): Exercise {
  const id = rng.pick(IND_IDS);
  const nature: Nature = id === "phenolphthalein" ? "alkaline" : rng.pick(NATURES);
  const ph = rng.pick(CLEAR_PH[id][nature]);
  const col = shade(id, ph);
  const ind = indicator(id).name;
  const colour = COLOUR[INDICATOR_RANGES[id][nature]];
  const wrong: Partial<Record<Nature, { title: Text; say: Text }>> = {};
  for (const n of NATURES) {
    if (n === nature) continue;
    wrong[n] =
      n !== "neutral" && nature !== "neutral"
        ? { title: tx("Colours mixed up", "Farben vertauscht"), say: tx(`Nearly: you swapped the two ends. Which colour does ${en(ind)} show in acids, which in alkaline solutions?`, `Knapp daneben: Du hast die beiden Enden vertauscht. Welche Farbe zeigt ${de(ind)} in Säuren, welche in alkalischen Lösungen?`) }
        : n === "neutral"
          ? { title: tx("Not the neutral colour", "Nicht die Neutralfarbe"), say: tx(`In a neutral solution ${en(ind)} looks different. ${cap(en(colour))} means the solution is on one side of 7.`, `In einer neutralen Lösung sieht ${de(ind)} anders aus. ${cap(de(colour))} heißt: Die Lösung liegt auf einer Seite der 7.`) }
          : { title: tx("That's the neutral colour", "Das ist die Neutralfarbe"), say: tx(`${cap(en(colour))} is the colour ${en(ind)} shows right in the middle of the scale.`, `${cap(de(colour))} ist die Farbe, die ${de(ind)} genau in der Mitte der Skala zeigt.`) };
  }
  return {
    instruction: tx("Read the indicator", "Lies den Indikator ab"),
    text: tx(`You add **${en(ind)}** to a solution. It turns **${en(colour)}**. What do you know about the solution?`, `Du gibst **${de(ind)}** zu einer Lösung. Sie färbt sich **${de(colour)}**. Was weißt du über die Lösung?`),
    visual: tube(col.hex, tx(`${cap(en(ind))}: ${en(colour)}`, `${de(ind)}: ${de(colour)}`)),
    ...natureChoice(nature, wrong),
    hint: tx(`Remember the three colours of ${en(ind)}: acidic, neutral and alkaline.`, `Denk an die drei Farben von ${de(ind)}: sauer, neutral und alkalisch.`),
    solution: [
      { math: chart(id), note: tx(`The colours of ${en(ind)}.`, `Die Farben von ${de(ind)}.`) },
      { math: m((r) => `"${r(colour)}" \\Rightarrow ${r(NATURE_MATH[nature])}`), note: tx(`${cap(en(colour))} means: the solution is **${en(NATURE[nature])}**.`, `${cap(de(colour))} heißt: Die Lösung ist **${de(NATURE[nature])}**.`) },
    ],
  };
}

type Concept = { q: Text; right: Text; wrongs: Wrong[]; math: Text; note: Text; hint: Text };

const CONCEPTS_1: Concept[] = [
  {
    q: tx("According to Brønsted, an **acid** is a particle that…", "Nach Brønsted ist eine **Säure** ein Teilchen, das …"),
    right: tx("gives away protons ($\\ce{H+}$).", "Protonen ($\\ce{H+}$) abgibt."),
    wrongs: [
      { text: tx("takes up protons ($\\ce{H+}$).", "Protonen ($\\ce{H+}$) aufnimmt."), title: tx("That's the base", "Das ist die Base"), say: tx("Taking protons up is what a **base** does. The acid is the other partner in the proton hand-over.", "Protonen aufnehmen macht die **Base**. Die Säure ist der andere Partner bei der Protonenübergabe.") },
      { text: tx("gives away electrons.", "Elektronen abgibt."), title: tx("Electrons are another story", "Elektronen sind eine andere Geschichte"), say: tx("Giving away electrons is oxidation, that's redox chemistry. Acids and bases are about **protons**.", "Elektronen abgeben ist eine Oxidation, das gehört zu den Redoxreaktionen. Bei Säuren und Basen geht es um **Protonen**.") },
      { text: tx("forms hydroxide ions in water.", "in Wasser Hydroxid-Ionen bildet."), title: tx("That makes it alkaline", "Das macht es alkalisch"), say: tx("Hydroxide ions $\\ce{OH-}$ make a solution **alkaline**. That's the job of bases, not acids.", "Hydroxid-Ionen $\\ce{OH-}$ machen eine Lösung **alkalisch**. Das ist der Job der Basen, nicht der Säuren.") },
    ],
    hint: tx("Think of $\\ce{HCl}$ in water: what does it hand over?", "Denk an $\\ce{HCl}$ in Wasser: Was gibt es ab?"),
    math: "\\ce{HCl + H2O -> H3O+ + Cl-}",
    note: tx("An acid is a **proton donor**: $\\ce{HCl}$ gives its proton to water.", "Eine Säure ist ein **Protonendonator**: $\\ce{HCl}$ gibt sein Proton an Wasser ab."),
  },
  {
    q: tx("According to Brønsted, a **base** is…", "Nach Brønsted ist eine **Base** …"),
    right: tx("a proton acceptor.", "ein Protonenakzeptor."),
    wrongs: [
      { text: tx("a proton donor.", "ein Protonendonator."), title: tx("Donor and acceptor swapped", "Donator und Akzeptor vertauscht"), say: tx("Close, but swapped: the **donor** gives protons away, that's the acid. The base takes them.", "Knapp, aber vertauscht: Der **Donator** gibt Protonen ab, das ist die Säure. Die Base nimmt sie auf."), close: true },
      { text: tx("a particle that takes up electrons.", "ein Teilchen, das Elektronen aufnimmt."), title: tx("Electrons are another story", "Elektronen sind eine andere Geschichte"), say: tx("Taking up electrons is reduction, that's redox chemistry. Bases are about **protons**.", "Elektronen aufnehmen ist eine Reduktion, das gehört zu den Redoxreaktionen. Bei Basen geht es um **Protonen**.") },
      { text: tx("always a metal hydroxide like NaOH.", "immer ein Metallhydroxid wie NaOH."), title: tx("Not only hydroxides", "Nicht nur Hydroxide"), say: tx("Ammonia $\\ce{NH3}$ has no OH at all and is still a base: it takes a proton from water.", "Ammoniak $\\ce{NH3}$ hat gar kein OH und ist trotzdem eine Base: Es nimmt ein Proton vom Wasser auf.") },
    ],
    hint: tx("Think of ammonia in water: what does it do with a proton?", "Denk an Ammoniak in Wasser: Was macht es mit einem Proton?"),
    math: "\\ce{NH3 + H2O <=> NH4+ + OH-}",
    note: tx("A base is a **proton acceptor**: ammonia takes a proton from water.", "Eine Base ist ein **Protonenakzeptor**: Ammoniak nimmt ein Proton vom Wasser auf."),
  },
  {
    q: tx("Which particles make a solution **acidic**?", "Welche Teilchen machen eine Lösung **sauer**?"),
    right: tx("oxonium ions $\\ce{H3O+}$", "Oxonium-Ionen $\\ce{H3O+}$"),
    wrongs: [
      { text: tx("hydroxide ions $\\ce{OH-}$", "Hydroxid-Ionen $\\ce{OH-}$"), title: tx("That's alkaline", "Das ist alkalisch"), say: tx("Hydroxide ions make a solution **alkaline**. Acids form the other kind of ion in water.", "Hydroxid-Ionen machen eine Lösung **alkalisch**. Säuren bilden in Wasser die andere Ionensorte.") },
      { text: tx("chloride ions $\\ce{Cl-}$", "Chlorid-Ionen $\\ce{Cl-}$"), title: tx("Only what's left over", "Nur der Rest"), say: tx("Chloride ions are what's left of HCl after it gave away its proton. They are also in table salt, and salt water isn't acidic.", "Chlorid-Ionen bleiben von HCl übrig, nachdem es sein Proton abgegeben hat. Sie stecken auch im Kochsalz, und Salzwasser ist nicht sauer.") },
      { text: tx("sodium ions $\\ce{Na+}$", "Natrium-Ionen $\\ce{Na+}$"), title: tx("Just a spectator", "Nur ein Zuschauer"), say: tx("Sodium ions don't give or take protons. They are in salt water too, which is neutral.", "Natrium-Ionen geben keine Protonen ab und nehmen keine auf. Sie sind auch im Salzwasser, und das ist neutral.") },
    ],
    hint: tx("What does every acid form when it gives its proton to water?", "Was bildet jede Säure, wenn sie ihr Proton an Wasser abgibt?"),
    math: "\\ce{HCl + H2O -> H3O+ + Cl-}",
    note: tx("Every acid forms **oxonium ions** $\\ce{H3O+}$ in water. They make the solution acidic.", "Jede Säure bildet in Wasser **Oxonium-Ionen** $\\ce{H3O+}$. Sie machen die Lösung sauer."),
  },
  {
    q: tx("Which particles make a solution **alkaline**?", "Welche Teilchen machen eine Lösung **alkalisch**?"),
    right: tx("hydroxide ions $\\ce{OH-}$", "Hydroxid-Ionen $\\ce{OH-}$"),
    wrongs: [
      { text: tx("oxonium ions $\\ce{H3O+}$", "Oxonium-Ionen $\\ce{H3O+}$"), title: tx("That's acidic", "Das ist sauer"), say: tx("Oxonium ions make a solution **acidic**. Alkaline solutions have more of the other kind.", "Oxonium-Ionen machen eine Lösung **sauer**. Alkalische Lösungen haben mehr von der anderen Sorte.") },
      { text: tx("sodium ions $\\ce{Na+}$", "Natrium-Ionen $\\ce{Na+}$"), title: tx("Just a spectator", "Nur ein Zuschauer"), say: tx("Sodium ions come along with NaOH, but they're in neutral salt water too. The other ion from NaOH is the one that matters.", "Natrium-Ionen kommen mit NaOH mit, aber sie sind auch im neutralen Salzwasser. Entscheidend ist das andere Ion aus NaOH.") },
      { text: tx("water molecules $\\ce{H2O}$", "Wassermoleküle $\\ce{H2O}$"), title: tx("Water is neutral", "Wasser ist neutral"), say: tx("Pure water is neutral. It's the ions formed in it that make a difference.", "Reines Wasser ist neutral. Den Unterschied machen die Ionen, die darin entstehen.") },
    ],
    hint: tx("Which ion do sodium hydroxide and ammonia both produce in water?", "Welches Ion bilden Natriumhydroxid und Ammoniak beide in Wasser?"),
    math: "\\ce{NaOH(s) -> Na+ (aq) + OH- (aq)}",
    note: tx("**Hydroxide ions** $\\ce{OH-}$ make a solution alkaline.", "**Hydroxid-Ionen** $\\ce{OH-}$ machen eine Lösung alkalisch."),
  },
  {
    q: tx("An oxonium ion meets a hydroxide ion. What forms?", "Ein Oxonium-Ion trifft auf ein Hydroxid-Ion. Was entsteht?"),
    right: tx("two water molecules", "zwei Wassermoleküle"),
    wrongs: [
      { text: tx("a salt", "ein Salz"), title: tx("The salt comes from the others", "Das Salz kommt von den anderen"), say: tx("A salt forms from the **other** ions in the solution, like $\\ce{Na+}$ and $\\ce{Cl-}$. Count the atoms in $\\ce{H3O+}$ and $\\ce{OH-}$ together.", "Ein Salz bilden die **anderen** Ionen in der Lösung, z. B. $\\ce{Na+}$ und $\\ce{Cl-}$. Zähl die Atome in $\\ce{H3O+}$ und $\\ce{OH-}$ zusammen.") },
      { text: tx("hydrogen and oxygen", "Wasserstoff und Sauerstoff"), title: tx("No gases here", "Hier entsteht kein Gas"), say: tx("No bubbles in a neutralisation! Only a proton changes partner. Count the atoms: 4 H and 2 O.", "Bei einer Neutralisation blubbert nichts! Nur ein Proton wechselt den Partner. Zähl die Atome: 4 H und 2 O.") },
      { text: tx("a hydrogen peroxide molecule $\\ce{H2O2}$", "ein Wasserstoffperoxid-Molekül $\\ce{H2O2}$"), title: tx("Count the H", "Zähl die H-Atome"), say: tx("Count again: $\\ce{H3O+}$ and $\\ce{OH-}$ together have **4** H and 2 O.", "Zähl noch mal: $\\ce{H3O+}$ und $\\ce{OH-}$ haben zusammen **4** H und 2 O."), close: true },
    ],
    hint: tx("The proton hops from $\\ce{H3O+}$ to $\\ce{OH-}$. What do both particles turn into?", "Das Proton springt von $\\ce{H3O+}$ zu $\\ce{OH-}$. Was wird aus beiden Teilchen?"),
    math: "\\ce{H3O+ + OH- -> 2H2O}",
    note: tx("The proton hops from $\\ce{H3O+}$ to $\\ce{OH-}$: two water molecules. That's the heart of every **neutralisation**.", "Das Proton springt von $\\ce{H3O+}$ zu $\\ce{OH-}$: zwei Wassermoleküle. Das ist der Kern jeder **Neutralisation**."),
  },
];

const CONCEPTS_2: Concept[] = [
  {
    q: tx("You dilute an acidic solution with a lot of water. What happens to its pH?", "Du verdünnst eine saure Lösung mit viel Wasser. Was passiert mit dem pH-Wert?"),
    right: tx("It rises towards 7.", "Er steigt Richtung 7."),
    wrongs: [
      { text: tx("It falls.", "Er sinkt."), title: tx("Fewer ions per litre", "Weniger Ionen pro Liter"), say: tx("More water spreads the $\\ce{H3O+}$ ions out: **fewer** per litre. Fewer $\\ce{H3O+}$ means less acidic, so which way does the pH go?", "Mehr Wasser verteilt die $\\ce{H3O+}$-Ionen: **weniger** pro Liter. Weniger $\\ce{H3O+}$ heißt weniger sauer, in welche Richtung geht der pH-Wert dann?") },
      { text: tx("It stays the same.", "Er bleibt gleich."), title: tx("Concentration counts", "Die Konzentration zählt"), say: tx("The ions are still there, but now in much more water. The pH depends on how many ions there are **per litre**.", "Die Ionen sind noch da, aber jetzt in viel mehr Wasser. Der pH-Wert hängt davon ab, wie viele Ionen **pro Liter** da sind.") },
      { text: tx("It rises above 7, the solution turns alkaline.", "Er steigt über 7, die Lösung wird alkalisch."), title: tx("Water can't make it alkaline", "Wasser macht nichts alkalisch"), say: tx("Water itself is neutral. Diluting brings the pH closer and closer to 7, but never past it.", "Wasser selbst ist neutral. Verdünnen bringt den pH-Wert immer näher an 7, aber nie darüber hinaus.") },
    ],
    hint: tx("The pH depends on how many $\\ce{H3O+}$ ions there are **per litre**.", "Der pH-Wert hängt davon ab, wie viele $\\ce{H3O+}$-Ionen **pro Liter** da sind."),
    math: m((r) => `c(\\ce{H3O+}) = 10^{-2} ${r(MOL)} \\to 10^{-3} ${r(MOL)}`),
    note: tx("Diluting spreads the oxonium ions over more water. Fewer per litre: the pH rises, but stays below 7.", "Verdünnen verteilt die Oxonium-Ionen auf mehr Wasser. Weniger pro Liter: Der pH-Wert steigt, bleibt aber unter 7."),
  },
  {
    q: tx("Water can act as an acid **and** as a base. What does that mean?", "Wasser kann als Säure **und** als Base reagieren. Was heißt das?"),
    right: tx("It can give away a proton or take one up, depending on its partner.", "Es kann je nach Partner ein Proton abgeben oder aufnehmen."),
    wrongs: [
      { text: tx("It is acidic and alkaline at the same time.", "Es ist gleichzeitig sauer und alkalisch."), title: tx("Particles, not solutions", "Teilchen, nicht Lösungen"), say: tx("Pure water is neutral. The point is what a water **molecule** does: with HCl it takes a proton, with $\\ce{NH3}$ it gives one.", "Reines Wasser ist neutral. Es geht darum, was ein Wasser**molekül** tut: Mit HCl nimmt es ein Proton auf, mit $\\ce{NH3}$ gibt es eins ab.") },
      { text: tx("It contains both H⁺ and OH⁻ ions in large amounts.", "Es enthält viele H⁺- und OH⁻-Ionen."), title: tx("Only very few ions", "Nur ganz wenige Ionen"), say: tx("Pure water contains only very few ions. Look at what water does in a reaction with HCl and with ammonia.", "Reines Wasser enthält nur sehr wenige Ionen. Schau dir an, was Wasser bei der Reaktion mit HCl und mit Ammoniak tut.") },
      { text: tx("It can give away electrons or take them up.", "Es kann Elektronen abgeben oder aufnehmen."), title: tx("Protons, not electrons", "Protonen, nicht Elektronen"), say: tx("Acids and bases are about **protons**. Electrons belong to redox reactions.", "Bei Säuren und Basen geht es um **Protonen**. Elektronen gehören zu den Redoxreaktionen.") },
    ],
    hint: tx("What does water do with HCl, and what does it do with ammonia?", "Was macht Wasser mit HCl, und was macht es mit Ammoniak?"),
    math: "\\ce{H2O + H2O <=> H3O+ + OH-}",
    note: tx("Water is an **ampholyte**: with HCl it is the base, with ammonia the acid. It even swaps protons with itself, just very rarely.", "Wasser ist ein **Ampholyt**: Mit HCl ist es die Base, mit Ammoniak die Säure. Es tauscht sogar mit sich selbst Protonen aus, nur ganz selten."),
  },
];

function concept(rng: Rng, list: Concept[]): Exercise {
  const c = rng.pick(list);
  const { answer, mistakes } = oneOf(rng, c.right, c.wrongs);
  return {
    instruction: tx("Choose the right answer", "Wähle die richtige Antwort"),
    text: c.q,
    answer,
    mistakes,
    hint: c.hint,
    solution: [{ math: c.math, note: c.note }],
  };
}

type IonName = { formula: string; accept: Text[]; wrong: [Text[], Text, Text][]; from: string; note: Text };

const ION_NAMES: IonName[] = [
  {
    formula: "H3O+",
    accept: [tx("oxonium ion", "Oxonium-Ion"), tx("hydronium ion", "Hydronium-Ion"), tx("oxonium", "Oxonium"), tx("hydronium", "Hydronium")],
    wrong: [
      [
        [tx("hydrogen ion", "Wasserstoff-Ion"), tx("proton", "Proton"), tx("H+ ion", "H-Ion")],
        tx("Proton plus water", "Proton plus Wasser"),
        tx("That's the bare proton $\\ce{H+}$. In water it never stays alone: it sits on a water molecule. That particle has its own name.", "Das ist das nackte Proton $\\ce{H+}$. In Wasser bleibt es nie allein: Es sitzt auf einem Wassermolekül. Dieses Teilchen hat einen eigenen Namen."),
      ],
      [[tx("hydroxide ion", "Hydroxid-Ion"), tx("hydroxide", "Hydroxid")], tx("That's the other one", "Das ist das andere"), tx("Hydroxide is $\\ce{OH-}$, the ion of alkaline solutions. $\\ce{H3O+}$ is the ion of acids.", "Hydroxid ist $\\ce{OH-}$, das Ion der alkalischen Lösungen. $\\ce{H3O+}$ ist das Ion der Säuren.")],
    ],
    from: "HCl + H2O -> H3O+ + Cl-",
    note: tx("Water takes up a proton: the **oxonium ion** $\\ce{H3O+}$.", "Wasser nimmt ein Proton auf: das **Oxonium-Ion** $\\ce{H3O+}$."),
  },
  {
    formula: "OH-",
    accept: [tx("hydroxide ion", "Hydroxid-Ion"), tx("hydroxide", "Hydroxid")],
    wrong: [
      [[tx("oxide ion", "Oxid-Ion"), tx("oxide", "Oxid")], tx("There's an H too", "Da ist noch ein H"), tx("The oxide ion is $\\ce{O^2-}$ on its own. Here an H is attached as well, and the name says so.", "Das Oxid-Ion ist $\\ce{O^2-}$ allein. Hier hängt noch ein H dran, und das steckt auch im Namen.")],
      [[tx("oxonium ion", "Oxonium-Ion"), tx("oxonium", "Oxonium")], tx("That's the other one", "Das ist das andere"), tx("Oxonium is $\\ce{H3O+}$, the ion of acids. $\\ce{OH-}$ is the ion of alkaline solutions.", "Oxonium ist $\\ce{H3O+}$, das Ion der Säuren. $\\ce{OH-}$ ist das Ion der alkalischen Lösungen.")],
      [[tx("hydride ion", "Hydrid-Ion"), tx("hydride", "Hydrid")], tx("Hydride is H⁻", "Hydrid ist H⁻"), tx("A hydride ion is $\\ce{H-}$ alone. This one has an oxygen atom.", "Ein Hydrid-Ion ist $\\ce{H-}$ allein. Dieses hier hat ein Sauerstoffatom.")],
    ],
    from: "NH3 + H2O <=> NH4+ + OH-",
    note: tx("Water that has lost a proton: the **hydroxide ion** $\\ce{OH-}$.", "Wasser, das ein Proton abgegeben hat: das **Hydroxid-Ion** $\\ce{OH-}$."),
  },
  {
    formula: "NH4+",
    accept: [tx("ammonium ion", "Ammonium-Ion"), tx("ammonium", "Ammonium")],
    wrong: [[[tx("ammonia", "Ammoniak")], tx("One proton more", "Ein Proton mehr"), tx("Ammonia is $\\ce{NH3}$, the neutral molecule. After it takes up a proton it is an ion with a slightly different name.", "Ammoniak ist $\\ce{NH3}$, das neutrale Molekül. Nachdem es ein Proton aufgenommen hat, ist es ein Ion mit einem etwas anderen Namen.")]],
    from: "NH3 + H2O <=> NH4+ + OH-",
    note: tx("Ammonia takes up a proton: the **ammonium ion** $\\ce{NH4+}$.", "Ammoniak nimmt ein Proton auf: das **Ammonium-Ion** $\\ce{NH4+}$."),
  },
];

/** The anion of an acid as a name task. */
function anionNameOf(a: Acid): IonName {
  const stemWrong: Record<string, [Text[], Text, Text][]> = {
    HCl: [[[tx("chlorine", "Chlor")], tx("Element or ion?", "Element oder Ion?"), tx("Chlorine is the element, $\\ce{Cl2}$. The negative ion gets an ending.", "Chlor ist das Element, $\\ce{Cl2}$. Das negative Ion bekommt eine Endung.")]],
    HNO3: [[[tx("nitride ion", "Nitrid-Ion"), tx("nitride", "Nitrid")], tx("Oxygen inside", "Mit Sauerstoff"), tx("Nitride is $\\ce{N^3-}$ alone. This ion contains oxygen atoms, and that changes the ending.", "Nitrid ist $\\ce{N^3-}$ allein. Dieses Ion enthält Sauerstoffatome, und das ändert die Endung.")]],
    H2SO4: [
      [[tx("sulfide ion", "Sulfid-Ion"), tx("sulfide", "Sulfid")], tx("Oxygen inside", "Mit Sauerstoff"), tx("Sulfide is $\\ce{S^2-}$ alone. This ion contains oxygen atoms, and that changes the ending.", "Sulfid ist $\\ce{S^2-}$ allein. Dieses Ion enthält Sauerstoffatome, und das ändert die Endung.")],
      [[tx("hydrogen sulfate ion", "Hydrogensulfat-Ion"), tx("hydrogen sulfate", "Hydrogensulfat")], tx("No H left", "Kein H mehr"), tx("Hydrogen sulfate is $\\ce{HSO4-}$, with one H left. This ion has given away both protons.", "Hydrogensulfat ist $\\ce{HSO4-}$, mit einem H. Dieses Ion hat beide Protonen abgegeben.")],
    ],
    H3PO4: [[[tx("phosphide ion", "Phosphid-Ion"), tx("phosphide", "Phosphid")], tx("Oxygen inside", "Mit Sauerstoff"), tx("Phosphide is $\\ce{P^3-}$ alone. This ion contains oxygen atoms, and that changes the ending.", "Phosphid ist $\\ce{P^3-}$ allein. Dieses Ion enthält Sauerstoffatome, und das ändert die Endung.")]],
    H2CO3: [[[tx("hydrogen carbonate ion", "Hydrogencarbonat-Ion"), tx("hydrogen carbonate", "Hydrogencarbonat")], tx("No H left", "Kein H mehr"), tx("Hydrogen carbonate is $\\ce{HCO3-}$, with one H left. This ion has given away both protons.", "Hydrogencarbonat ist $\\ce{HCO3-}$, mit einem H. Dieses Ion hat beide Protonen abgegeben.")]],
    CH3COOH: [[[tx("formate ion", "Formiat-Ion"), tx("formate", "Formiat")], tx("That's formic acid", "Das ist Ameisensäure"), tx("Formate comes from formic acid, $\\ce{HCOOH}$, with one carbon atom. This ion has two.", "Formiat kommt von der Ameisensäure, $\\ce{HCOOH}$, mit einem Kohlenstoffatom. Dieses Ion hat zwei.")]],
  };
  return {
    formula: a.anion,
    accept: [a.anionName, tx(a.stem.en, cap(a.stem.de)), tx(`${a.stem.en}ion`, `${cap(a.stem.de)}ion`)],
    wrong: [
      ...(stemWrong[a.formula] ?? []),
      [[a.name], tx("Acid or ion?", "Säure oder Ion?"), tx(`That's the acid, $\\ce{${a.formula}}$. What's left after it has given away its protons has its own name.`, `Das ist die Säure, $\\ce{${a.formula}}$. Was nach der Protonenabgabe übrig bleibt, hat einen eigenen Namen.`)],
    ],
    from: a.formula === "H2SO4" ? "H2SO4 + 2H2O -> 2H3O+ + SO4^2-" : a.formula === "HCl" ? "HCl + H2O -> H3O+ + Cl-" : a.formula === "HNO3" ? "HNO3 + H2O -> H3O+ + NO3-" : `${a.formula} -> ${a.protons > 1 ? a.protons : ""}H+ + ${a.anion}`,
    note: tx(`${cap(en(a.name))} leaves the **${en(a.anionName)}** behind.`, `Von ${de(a.name)} bleibt das **${de(a.anionName)}** übrig.`),
  };
}

function ionName(rng: Rng): Exercise {
  const x = rng.chance(0.45) ? rng.pick(ION_NAMES) : anionNameOf(rng.pick(ACIDS));
  const mistakes: Mistake[] = x.wrong.map(([accept, title, say]) => ({ when: { kind: "word", accept }, title, say }));
  return {
    instruction: tx("Name the ion", "Benenne das Ion"),
    math: ce(x.formula),
    answer: { kind: "word", accept: x.accept, placeholder: tx("name of the ion", "Name des Ions") },
    mistakes,
    hint: tx("Which reaction does this ion come from? Positive ions from proton uptake, negative ones from proton loss.", "Aus welcher Reaktion stammt dieses Ion? Positive Ionen entstehen durch Protonenaufnahme, negative durch Protonenabgabe."),
    solution: [
      { math: ce(x.from), note: x.note },
      { math: m((r) => `${ce(x.formula)} \\quad "${r(x.accept[0])}"`), note: tx("That's its name.", "So heißt es.") },
    ],
  };
}

function acidName(rng: Rng): Exercise {
  const a = rng.pick(ACIDS);
  const mistakes: Mistake[] = [];
  if (a.lookalike)
    mistakes.push({
      when: { kind: "word", accept: [a.lookalike.name] },
      title: tx("A close relative", "Ein naher Verwandter"),
      say: tx(`${cap(en(a.lookalike.name))} is $\\ce{${a.lookalike.formula}}$. Compare the formulas carefully.`, `${de(a.lookalike.name)} ist $\\ce{${a.lookalike.formula}}$. Vergleich die Formeln genau.`),
    });
  mistakes.push({
    when: { kind: "word", accept: [a.anionName, tx(a.stem.en, cap(a.stem.de))] },
    title: tx("That's the anion", "Das ist das Anion"),
    say: tx(`${cap(a.stem.en)} is the ion that's left once the acid has given away its protons. The acid itself has a different name.`, `${cap(a.stem.de)} ist das Ion, das übrig bleibt, wenn die Säure ihre Protonen abgegeben hat. Die Säure selbst heißt anders.`),
  });
  return {
    instruction: tx("Name the acid", "Benenne die Säure"),
    math: ce(a.formula),
    answer: { kind: "word", accept: [a.name, ...a.alt], placeholder: tx("name of the acid", "Name der Säure") },
    mistakes,
    hint: tx(`Where do you meet it? For example ${en(a.everyday)}.`, `Wo begegnet sie dir? Zum Beispiel ${de(a.everyday)}.`),
    solution: [{ math: m((r) => `${ce(a.formula)} \\quad "${r(a.name)}"`), note: tx(`$\\ce{${a.formula}}$ is **${en(a.name)}**. You find it ${en(a.everyday)}.`, `$\\ce{${a.formula}}$ ist **${de(a.name)}**. Du findest sie ${de(a.everyday)}.`) }],
  };
}

/** c(H3O+) as display maths, as a power of ten. */
const concPower = (n: number, key = "") => m((r) => `c(\\ce{H3O+}) = 10^{-#m ${n}#e${key}} ${r(MOL)}`);

function phFromPower(rng: Rng): Exercise {
  const n = rng.int(1, 13);
  return {
    instruction: tx("Find the pH", "Bestimme den pH-Wert"),
    math: m((r) => `c(\\ce{H3O+}) = 10^{-${n}} ${r(MOL)}`),
    answer: { kind: "number", value: n, label: '"pH" =' },
    mistakes: numberMistakes(n, [
      [-n, tx("pH without the minus", "pH ohne Minus"), tx("The minus belongs to the exponent. The pH is the exponent **without** its minus sign, so here it's positive.", "Das Minus gehört zum Exponenten. Der pH-Wert ist der Exponent **ohne** Minuszeichen, hier also positiv."), true],
      [14 - n, tx("Counted from the other end", "Vom anderen Ende gezählt"), tx("Looks like you counted from the other end of the scale. Read the pH straight off the $\\ce{H3O+}$ exponent.", "Sieht so aus, als hättest du vom anderen Ende der Skala gezählt. Lies den pH-Wert direkt am Exponenten von $\\ce{H3O+}$ ab.")],
    ]),
    hint: tx("Look at the exponent of the power of ten.", "Schau auf den Exponenten der Zehnerpotenz."),
    solution: [
      { math: concPower(n), note: tx(`The exponent is $-${n}$.`, `Der Exponent ist $-${n}$.`), highlight: ["m", "e"] },
      { math: m((r) => `c(\\ce{H3O+}) = 10^{-#m ${n}#e2} ${r(MOL)} \\quad \\Rightarrow \\quad "pH" = ${n}#e`), note: tx(`The pH is the exponent without the minus: pH ${n}. (That's what $"pH" = -"lg" \\, c$ means.)`, `Der pH-Wert ist der Exponent ohne Minus: pH ${n}. (Das bedeutet $"pH" = -"lg" \\, c$.)`) },
    ],
  };
}

// ---------------------------------------------------------------------------
// Level 2: formulas, protolysis, neutralisation, powers of ten

/** The acid with one extra proton (what a student gets by adding instead of removing H+). */
const gained = (a: Acid) => (a.formula === "CH3COOH" ? "CH3COOH2+" : a.formula.replace(/^H(\d*)/, (_, d: string) => `H${(d ? Number(d) : 1) + 1}`) + "+");
const chargeStr = (q: number) => (q === 0 ? "" : `^${Math.abs(q) > 1 ? Math.abs(q) : ""}${q > 0 ? "+" : "-"}`);

function anionFormula(rng: Rng): Exercise {
  const a = rng.pick(ACIDS);
  const p = a.protons;
  const list: [string, Text, Text, boolean?][] = [
    [`${a.core}${chargeStr(p)}`, tx("Sign of the charge", "Vorzeichen der Ladung"), tx("The protons leave as $\\ce{H+}$, but their electrons stay behind. So the rest is **negative**, not positive.", "Die Protonen gehen als $\\ce{H+}$, aber ihre Elektronen bleiben da. Der Rest ist also **negativ**, nicht positiv."), true],
    [a.core, tx("Charge missing", "Ladung fehlt"), tx("Each proton leaves its electron behind, so the rest is charged. How many protons left?", "Jedes Proton lässt sein Elektron zurück, also ist der Rest geladen. Wie viele Protonen sind gegangen?")],
    [gained(a), tx("Acids give, they don't take", "Säuren geben ab, nicht auf"), tx("You added a proton! An acid is a proton **donor**: it gives its protons away.", "Du hast ein Proton dazugegeben! Eine Säure ist ein Protonen**donator**: Sie gibt ihre Protonen ab.")],
  ];
  if (p > 1) list.unshift([`${a.core}^-`, tx("Count the protons", "Zähl die Protonen"), tx(`One negative charge for each proton that leaves. $\\ce{${a.formula}}$ can give away **${p}**.`, `Für jedes Proton, das geht, eine negative Ladung. $\\ce{${a.formula}}$ kann **${p}** abgeben.`)]);
  if (a.half) list.unshift([a.half.formula, tx("Only one proton", "Nur ein Proton"), tx(`That's the ${en(a.half.name)}: only **one** proton gone. The task asks for all of them.`, `Das ist das ${de(a.half.name)}: Nur **ein** Proton ist weg. Gefragt ist nach allen.`), true]);
  const steps = `${a.formula} -> ${p > 1 ? p : ""}H+ + ${a.anion}`;
  return {
    instruction: tx("Write the anion", "Schreib das Anion auf"),
    text: tx(`Which anion is left when **${en(a.name)}** has given away every proton it can? Write the formula with its charge.`, `Welches Anion bleibt übrig, wenn **${de(a.name)}** alle Protonen abgegeben hat, die sie abgeben kann? Schreib die Formel mit Ladung.`),
    math: ce(a.formula),
    answer: { kind: "formula", value: a.anion },
    mistakes: formulaMistakes(a.anion, list),
    hint:
      a.formula === "CH3COOH"
        ? tx("Only the H at the very end, in the COOH group, can leave. Each proton that leaves adds one negative charge.", "Nur das H ganz am Ende, in der COOH-Gruppe, kann gehen. Jedes Proton, das geht, bringt eine negative Ladung.")
        : tx("Take all the H at the front away. Each proton that leaves adds one negative charge.", "Nimm alle H vorne weg. Jedes Proton, das geht, bringt eine negative Ladung."),
    solution: [
      { math: ce(a.formula), note: tx(`${cap(en(a.name))} can give away ${p} proton${p > 1 ? "s" : ""}.`, `${de(a.name)} kann ${p === 1 ? "ein Proton" : `${p} Protonen`} abgeben.`) },
      { math: ce(steps), note: tx(`Each proton leaves as $\\ce{H+}$ without its electron. ${p} proton${p > 1 ? "s" : ""} gone: charge ${p > 1 ? p : ""}−. That's the **${en(a.anionName)}**.`, `Jedes Proton geht als $\\ce{H+}$ ohne sein Elektron. ${p === 1 ? "Ein Proton" : `${p} Protonen`} weg: Ladung ${p > 1 ? p : ""}−. Das ist das **${de(a.anionName)}**.`) },
    ],
  };
}

type Gap = { eq: string; missing: number; level: 2 | 3; wrong: [string, Text, Text, boolean?][] };

const SIGN = (what: Text) => [tx("Sign of the charge", "Vorzeichen der Ladung"), what] as const;

const GAPS: Gap[] = [
  {
    eq: "HCl + H2O -> H3O+ + Cl-",
    missing: 3,
    level: 2,
    wrong: [
      ["Cl+", ...SIGN(tx("The proton leaves its electron behind with the chlorine: so the chlorine ends up **negative**.", "Das Proton lässt sein Elektron beim Chlor zurück: Das Chlor wird also **negativ**.")), true],
      ["Cl", tx("Charge missing", "Ladung fehlt"), tx("Check the charges: left 0, right +1 from $\\ce{H3O+}$. The other product must make up for that.", "Prüf die Ladungen: links 0, rechts +1 vom $\\ce{H3O+}$. Das andere Produkt muss das ausgleichen.")],
      ["OH-", tx("Who loses the proton?", "Wer verliert das Proton?"), tx("Here water **takes** the proton, it doesn't lose one. The missing particle is what's left of the acid.", "Hier **nimmt** das Wasser das Proton auf, es gibt keins ab. Das fehlende Teilchen ist der Rest der Säure.")],
    ],
  },
  {
    eq: "HNO3 + H2O -> H3O+ + NO3-",
    missing: 3,
    level: 2,
    wrong: [
      ["NO3+", ...SIGN(tx("The proton leaves its electron behind: so the nitrate ends up **negative**.", "Das Proton lässt sein Elektron zurück: Das Nitrat wird also **negativ**.")), true],
      ["NO3", tx("Charge missing", "Ladung fehlt"), tx("Check the charges: left 0, right +1 from $\\ce{H3O+}$. The other product must make up for that.", "Prüf die Ladungen: links 0, rechts +1 vom $\\ce{H3O+}$. Das andere Produkt muss das ausgleichen.")],
      ["H2NO3+", tx("Acids give, they don't take", "Säuren geben ab, nicht auf"), tx("You gave the acid an extra proton. But nitric acid is the proton **donor**: it gives one away.", "Du hast der Säure ein Proton dazugegeben. Aber Salpetersäure ist der Protonen**donator**: Sie gibt eins ab.")],
    ],
  },
  {
    eq: "HNO3 + H2O -> H3O+ + NO3-",
    missing: 2,
    level: 2,
    wrong: [
      ["H+", tx("Protons don't stay alone", "Protonen bleiben nicht allein"), tx("In water a proton never stays on its own: it sits on a water molecule. Which ion is that?", "In Wasser bleibt ein Proton nie allein: Es sitzt auf einem Wassermolekül. Welches Ion ist das?"), true],
      ["OH-", tx("Who takes the proton?", "Wer nimmt das Proton?"), tx("Water **takes** the proton here, so it gains an H. You took one away.", "Wasser **nimmt** hier das Proton auf, es bekommt also ein H dazu. Du hast eins weggenommen.")],
      ["H3O", tx("Charge missing", "Ladung fehlt"), tx("The proton brings a positive charge along. Check: left 0, right −1 from $\\ce{NO3-}$.", "Das Proton bringt eine positive Ladung mit. Prüf: links 0, rechts −1 vom $\\ce{NO3-}$.")],
    ],
  },
  {
    eq: "HCl + H2O -> H3O+ + Cl-",
    missing: 2,
    level: 2,
    wrong: [
      ["H+", tx("Protons don't stay alone", "Protonen bleiben nicht allein"), tx("In water a proton never stays on its own: it sits on a water molecule. Which ion is that?", "In Wasser bleibt ein Proton nie allein: Es sitzt auf einem Wassermolekül. Welches Ion ist das?"), true],
      ["H2O+", tx("Count the H", "Zähl die H-Atome"), tx("Water has 2 H, and the proton adds one more.", "Wasser hat 2 H, und das Proton bringt noch eins dazu."), true],
      ["OH-", tx("Who takes the proton?", "Wer nimmt das Proton?"), tx("Water **takes** the proton here, so it gains an H. You took one away.", "Wasser **nimmt** hier das Proton auf, es bekommt also ein H dazu. Du hast eins weggenommen.")],
    ],
  },
  {
    eq: "NH3 + H2O <=> NH4+ + OH-",
    missing: 2,
    level: 2,
    wrong: [
      ["NH2-", tx("Ammonia takes, it doesn't give", "Ammoniak nimmt, gibt nicht ab"), tx("Ammonia is the **base** here: it takes a proton from water. You took one away from it.", "Ammoniak ist hier die **Base**: Es nimmt ein Proton vom Wasser auf. Du hast ihm eins weggenommen.")],
      ["NH4-", ...SIGN(tx("A proton is positive: ammonia gets **positive** when it takes one up.", "Ein Proton ist positiv: Ammoniak wird **positiv**, wenn es eins aufnimmt.")), true],
      ["NH4", tx("Charge missing", "Ladung fehlt"), tx("The proton brings its positive charge along. Check: left 0, right −1 from $\\ce{OH-}$.", "Das Proton bringt seine positive Ladung mit. Prüf: links 0, rechts −1 vom $\\ce{OH-}$.")],
    ],
  },
  {
    eq: "NH3 + H2O <=> NH4+ + OH-",
    missing: 3,
    level: 2,
    wrong: [
      ["H3O+", tx("Water gives this time", "Diesmal gibt Wasser ab"), tx("With ammonia, water is the proton **donor**. It loses an H instead of gaining one.", "Mit Ammoniak ist Wasser der Protonen**donator**. Es verliert ein H, statt eins zu bekommen.")],
      ["OH+", ...SIGN(tx("Water lost a proton, a positive particle. What's left is **negative**.", "Das Wasser hat ein Proton verloren, ein positives Teilchen. Was übrig bleibt, ist **negativ**.")), true],
      ["O^2-", tx("Only one proton", "Nur ein Proton"), tx("Water gives away just **one** proton here, so one H stays on the oxygen.", "Wasser gibt hier nur **ein** Proton ab, also bleibt ein H am Sauerstoff."), true],
    ],
  },
  {
    eq: "CH3COOH + H2O <=> H3O+ + CH3COO-",
    missing: 3,
    level: 3,
    wrong: [
      ["CH3COO+", ...SIGN(tx("The proton leaves its electron behind: the acetate ends up **negative**.", "Das Proton lässt sein Elektron zurück: Das Acetat wird **negativ**.")), true],
      ["CH3COO", tx("Charge missing", "Ladung fehlt"), tx("Check the charges: left 0, right +1 from $\\ce{H3O+}$. The other product must make up for that.", "Prüf die Ladungen: links 0, rechts +1 vom $\\ce{H3O+}$. Das andere Produkt muss das ausgleichen.")],
      ["CH3COOH2+", tx("Acids give, they don't take", "Säuren geben ab, nicht auf"), tx("You gave the acid an extra proton. But acetic acid is the proton **donor**.", "Du hast der Säure ein Proton dazugegeben. Aber Essigsäure ist der Protonen**donator**.")],
    ],
  },
  {
    eq: "H2SO4 + 2H2O -> 2H3O+ + SO4^2-",
    missing: 3,
    level: 3,
    wrong: [
      ["HSO4-", tx("Only one proton", "Nur ein Proton"), tx("Look at the right side: **two** $\\ce{H3O+}$ formed. So sulfuric acid gave away both protons.", "Schau auf die rechte Seite: **zwei** $\\ce{H3O+}$ sind entstanden. Die Schwefelsäure hat also beide Protonen abgegeben."), true],
      ["SO4^-", tx("Count the charges", "Zähl die Ladungen"), tx("Two protons left, so two electrons stayed behind. Check: right side $2 \\cdot (+1)$ plus your ion must be 0.", "Zwei Protonen sind gegangen, also sind zwei Elektronen geblieben. Prüf: rechts $2 \\cdot (+1)$ plus dein Ion muss 0 ergeben."), true],
      ["SO4^2+", ...SIGN(tx("The protons leave their electrons behind: the sulfate is **negative**.", "Die Protonen lassen ihre Elektronen zurück: Das Sulfat ist **negativ**.")), true],
    ],
  },
  {
    eq: "H2O + H2O <=> H3O+ + OH-",
    missing: 3,
    level: 3,
    wrong: [
      ["H3O+", tx("One gives, one takes", "Einer gibt, einer nimmt"), tx("One water molecule takes a proton ($\\ce{H3O+}$), the **other** gives it. What's left of the giver?", "Ein Wassermolekül nimmt ein Proton auf ($\\ce{H3O+}$), das **andere** gibt es ab. Was bleibt vom Geber übrig?")],
      ["OH+", ...SIGN(tx("The giver loses a positive proton: it ends up **negative**.", "Der Geber verliert ein positives Proton: Er wird **negativ**.")), true],
      ["H2O", tx("Something changed", "Da hat sich was geändert"), tx("Count the atoms: left 4 H, right only 3 H plus yours. One water molecule has lost a proton.", "Zähl die Atome: links 4 H, rechts nur 3 H plus deine. Ein Wassermolekül hat ein Proton verloren.")],
    ],
  },
];

/** Species of an equation, with their coefficients, in order. */
function speciesOf(eq: string) {
  const [l, r] = eq.split(/->|<=>/);
  const side = (s: string) =>
    s
      .split(" + ")
      .map((x) => x.trim())
      .map((x) => {
        const mm = x.match(/^(\d*)(.*)$/)!;
        return { coef: mm[1], formula: mm[2] };
      });
  return { left: side(l), right: side(r), arrow: eq.includes("<=>") ? "<=>" : "->" };
}

/** The equation with one species replaced by a box. */
function gapSrc(eq: string, missing: number) {
  const s = speciesOf(eq);
  const all = [...s.left, ...s.right];
  const piece = (x: { coef: string; formula: string }, i: number) => (i === missing ? `${x.coef ? `${x.coef} ` : ""}\\box{?}` : `\\ce{${x.coef}${x.formula}}`);
  const L = s.left.map((x, i) => piece(x, i)).join(" + ");
  const R = s.right.map((x, i) => piece(x, s.left.length + i)).join(" + ");
  return { src: `${L} \\ce{${s.arrow}} ${R}`, formula: all[missing].formula };
}

function protolysisGap(rng: Rng, level: Level): Exercise {
  const g = rng.pick(GAPS.filter((x) => x.level <= level && (level < 3 || x.level === 3 || rng.chance(0.3))));
  const { src, formula } = gapSrc(g.eq, g.missing);
  const acidSide = g.eq.startsWith("NH3") || g.eq.startsWith("H2O + H2O");
  return {
    instruction: tx("Complete the equation", "Vervollständige die Gleichung"),
    math: src,
    answer: { kind: "formula", value: formula },
    mistakes: formulaMistakes(formula, g.wrong),
    hint: acidSide
      ? tx("Who gives the proton, who takes it? The taker gets one H and one + more, the giver loses them.", "Wer gibt das Proton ab, wer nimmt es auf? Der Nehmer bekommt ein H und ein + dazu, der Geber verliert beides.")
      : tx("The acid hands one proton to water. The taker gets one H and one + more, the giver loses them.", "Die Säure gibt ein Proton an Wasser ab. Der Nehmer bekommt ein H und ein + dazu, der Geber verliert beides."),
    solution: [
      { math: src, note: tx("Follow the proton: who loses an H, who gains one?", "Verfolge das Proton: Wer verliert ein H, wer bekommt eins?") },
      { math: ce(g.eq), note: tx(`The missing particle is $\\ce{${formula}}$. Check the charges: both sides add up to the same total.`, `Das fehlende Teilchen ist $\\ce{${formula}}$. Prüf die Ladungen: Beide Seiten ergeben zusammen dieselbe Ladung.`) },
    ],
  };
}

/** Frames for balancing a neutralisation: protons meet hydroxide ions, then count water. */
function neutralFrames(eq: string, coefs: number[], a: Acid, b: Base): Frame[] {
  const q = b.cation!.charge;
  const p = a.protons;
  const salt = saltFormula(b, a);
  const { cations, anions } = saltCounts(b, a);
  const water = coefs[3];
  return [
    { math: coefSrc(eq, [1, 1, 1, 1]), note: tx("Acid + base → salt + water. Start with the salt.", "Säure + Base → Salz + Wasser. Fang beim Salz an.") },
    {
      math: coefSrc(eq, [coefs[0], coefs[1], 1, 1]),
      note: tx(
        `$\\ce{${salt}}$ contains ${cations} $\\ce{${b.cation!.symbol}}$ and ${anions} $\\ce{${a.core}}$. So you need ${coefs[1]} $\\ce{${b.formula}}$ and ${coefs[0]} $\\ce{${a.formula}}$.`,
        `$\\ce{${salt}}$ enthält ${cations} $\\ce{${b.cation!.symbol}}$ und ${anions} $\\ce{${a.core}}$. Du brauchst also ${coefs[1]} $\\ce{${b.formula}}$ und ${coefs[0]} $\\ce{${a.formula}}$.`,
      ),
    },
    {
      math: coefSrc(eq, coefs),
      note: tx(
        `Now count: ${coefs[0]} × ${p} = ${coefs[0] * p} $\\ce{H+}$ meet ${coefs[1]} × ${q} = ${coefs[1] * q} $\\ce{OH-}$. Each pair makes one water molecule: ${water} $\\ce{H2O}$.`,
        `Jetzt zählen: ${coefs[0]} · ${p} = ${coefs[0] * p} $\\ce{H+}$ treffen auf ${coefs[1]} · ${q} = ${coefs[1] * q} $\\ce{OH-}$. Jedes Paar bildet ein Wassermolekül: ${water} $\\ce{H2O}$.`,
      ),
    },
  ];
}

const polyCore = (a: Acid) => (/[A-Z].*[A-Z]|\d/.test(a.core) ? [a.core] : undefined);

/** Typical slips when balancing a neutralisation. */
function neutralMistakes(eq: string, coefs: number[], a: Acid, b: Base): Mistake[] {
  const out = balanceMistakes({ eq, coefs, kind: "neutralisation", units: polyCore(a) });
  const same = (x: number[]) => x.every((v, i) => v === coefs[i]);
  const ones = [1, 1, 1, 1];
  if (!same(ones) && !out.some((o) => o.when.kind === "balance" && o.when.coefficients.every((v) => v === 1)))
    out.push({
      when: { kind: "balance", equation: eq, coefficients: ones },
      title: tx("One of each?", "Von allem eins?"),
      say: tx(
        `Each $\\ce{H+}$ of the acid needs its own $\\ce{OH-}$. $\\ce{${a.formula}}$ brings ${a.protons} $\\ce{H+}$, $\\ce{${b.formula}}$ brings ${b.cation!.charge} $\\ce{OH-}$. Start with the salt $\\ce{${saltFormula(b, a)}}$.`,
        `Jedes $\\ce{H+}$ der Säure braucht sein eigenes $\\ce{OH-}$. $\\ce{${a.formula}}$ bringt ${a.protons} $\\ce{H+}$ mit, $\\ce{${b.formula}}$ bringt ${b.cation!.charge} $\\ce{OH-}$ mit. Fang beim Salz $\\ce{${saltFormula(b, a)}}$ an.`,
      ),
    });
  return out;
}

const NEUTRAL_L2: [string, string][] = [
  ["H2SO4", "NaOH"],
  ["H2SO4", "KOH"],
  ["HCl", "Ca(OH)2"],
  ["HNO3", "Ca(OH)2"],
  ["HCl", "Mg(OH)2"],
  ["H2SO4", "Ca(OH)2"],
  ["H2CO3", "NaOH"],
];
const NEUTRAL_L3: [string, string][] = [
  ["H3PO4", "NaOH"],
  ["H3PO4", "KOH"],
  ["H3PO4", "Ca(OH)2"],
  ["H3PO4", "Mg(OH)2"],
  ["CH3COOH", "Ca(OH)2"],
  ["HNO3", "Mg(OH)2"],
];

function neutraliseBalance(rng: Rng, level: Level): Exercise {
  const [af, bf] = rng.pick(level === 3 ? NEUTRAL_L3 : NEUTRAL_L2);
  const a = acid(af);
  const b = base(bf);
  const { equation, coefficients } = neutralisation(b, a);
  return {
    instruction: tx("Balance the neutralisation", "Gleiche die Neutralisation aus"),
    text: tx(`${cap(en(a.name))} is neutralised with ${en(b.name)}. Fill in the coefficients.`, `${de(a.name)} wird mit ${de(b.name)} neutralisiert. Ergänze die Koeffizienten.`),
    answer: { kind: "balance", equation, coefficients },
    mistakes: neutralMistakes(equation, coefficients, a, b),
    hint: tx(
      `Start with the salt. Then: each $\\ce{H+}$ of the acid and each $\\ce{OH-}$ of the base form one water molecule.`,
      `Fang beim Salz an. Dann gilt: Jedes $\\ce{H+}$ der Säure und jedes $\\ce{OH-}$ der Base bilden ein Wassermolekül.`,
    ),
    solution: neutralFrames(equation, coefficients, a, b),
  };
}

/** Wrong anions for salt names: [stem en, stem de, title, say]. */
const SALT_TRAPS: Record<string, { stem: [string, string]; title: Text; say: Text }[]> = {
  HCl: [{ stem: ["chlorate", "chlorat"], title: tx("Chlorate is something else", "Chlorat ist etwas anderes"), say: tx("Chlorates contain oxygen ($\\ce{ClO3-}$). Hydrochloric acid has none: its anion is $\\ce{Cl-}$.", "Chlorate enthalten Sauerstoff ($\\ce{ClO3-}$). Salzsäure hat keinen: Ihr Anion ist $\\ce{Cl-}$.") }],
  HNO3: [
    { stem: ["nitrite", "nitrit"], title: tx("Nitrite is something else", "Nitrit ist etwas anderes"), say: tx("Nitrite is $\\ce{NO2-}$, from nitrous acid. Count the oxygen atoms in nitric acid.", "Nitrit ist $\\ce{NO2-}$, von der Salpetrigen Säure. Zähl die Sauerstoffatome in der Salpetersäure.") },
    { stem: ["nitride", "nitrid"], title: tx("Where's the oxygen?", "Wo ist der Sauerstoff?"), say: tx("A nitride contains only $\\ce{N^3-}$, no oxygen. The anion of nitric acid is $\\ce{NO3-}$.", "Ein Nitrid enthält nur $\\ce{N^3-}$, keinen Sauerstoff. Das Anion der Salpetersäure ist $\\ce{NO3-}$.") },
  ],
  H2SO4: [
    { stem: ["sulfite", "sulfit"], title: tx("Sulfite is something else", "Sulfit ist etwas anderes"), say: tx("Sulfite is $\\ce{SO3^2-}$, from sulfurous acid. Sulfuric acid has four oxygen atoms.", "Sulfit ist $\\ce{SO3^2-}$, von der Schwefligen Säure. Schwefelsäure hat vier Sauerstoffatome.") },
    { stem: ["sulfide", "sulfid"], title: tx("Where's the oxygen?", "Wo ist der Sauerstoff?"), say: tx("A sulfide contains only $\\ce{S^2-}$, no oxygen. The anion of sulfuric acid is $\\ce{SO4^2-}$.", "Ein Sulfid enthält nur $\\ce{S^2-}$, keinen Sauerstoff. Das Anion der Schwefelsäure ist $\\ce{SO4^2-}$.") },
  ],
  H3PO4: [{ stem: ["phosphide", "phosphid"], title: tx("Where's the oxygen?", "Wo ist der Sauerstoff?"), say: tx("A phosphide contains only $\\ce{P^3-}$, no oxygen. The anion of phosphoric acid is $\\ce{PO4^3-}$.", "Ein Phosphid enthält nur $\\ce{P^3-}$, keinen Sauerstoff. Das Anion der Phosphorsäure ist $\\ce{PO4^3-}$.") }],
  CH3COOH: [{ stem: ["formate", "formiat"], title: tx("That's formic acid", "Das ist Ameisensäure"), say: tx("Formates come from formic acid, $\\ce{HCOOH}$. Acetic acid gives a different anion.", "Formiate kommen von der Ameisensäure, $\\ce{HCOOH}$. Essigsäure liefert ein anderes Anion.") }],
};

function saltNameChoice(rng: Rng): Exercise {
  const a = rng.pick(ACIDS.filter((x) => SALT_TRAPS[x.formula]));
  const b = rng.pick(HYDROXIDES);
  const right = saltName(b, a);
  const c = b.cation!.name;
  const wrongs: Wrong[] = SALT_TRAPS[a.formula].map((w) => ({ text: tx(`${c.en} ${w.stem[0]}`, `${c.de}${w.stem[1]}`), title: w.title, say: w.say }));
  wrongs.push({
    text: b.name,
    title: tx("That's the base", "Das ist die Base"),
    say: tx("That's the base you started with. In the salt, the metal ion of the base meets the **anion of the acid**.", "Das ist die Base, mit der du angefangen hast. Im Salz trifft das Metall-Ion der Base auf das **Anion der Säure**."),
  });
  const other = rng.pick(HYDROXIDES.filter((x) => x.cation!.symbol !== b.cation!.symbol));
  if (wrongs.length < 3)
    wrongs.push({
      text: saltName(other, a),
      title: tx("Which metal?", "Welches Metall?"),
      say: tx(`The metal in the salt comes from the base. Which metal is in $\\ce{${b.formula}}$?`, `Das Metall im Salz kommt aus der Base. Welches Metall steckt in $\\ce{${b.formula}}$?`),
    });
  const { answer, mistakes } = oneOf(rng, right, wrongs);
  const { equation, coefficients } = neutralisation(b, a);
  return {
    instruction: tx("Name the salt", "Benenne das Salz"),
    text: tx(`${cap(en(a.name))} reacts with ${en(b.name)}. Which salt forms?`, `${de(a.name)} reagiert mit ${de(b.name)}. Welches Salz entsteht?`),
    answer,
    mistakes,
    hint: tx("Salt name = metal of the base + anion of the acid.", "Salzname = Metall der Base + Anion der Säure."),
    solution: [
      { math: coefSrc(equation, coefficients), note: tx("Acid + base → salt + water.", "Säure + Base → Salz + Wasser.") },
      {
        math: m((r) => `\\ce{${saltFormula(b, a)}} \\quad "${r(right)}"`),
        note: tx(`$\\ce{${b.cation!.symbol}${chargeStr(b.cation!.charge)}}$ from the base, $\\ce{${a.anion}}$ (${en(a.anionName)}) from the acid: **${en(right)}**.`, `$\\ce{${b.cation!.symbol}${chargeStr(b.cation!.charge)}}$ aus der Base, $\\ce{${a.anion}}$ (${de(a.anionName)}) aus der Säure: **${de(right)}**.`),
      },
    ],
  };
}

function phFromDecimal(rng: Rng): Exercise {
  const n = rng.int(1, 5);
  const c = 10 ** -n;
  const cText = m((r, l) => `c(\\ce{H3O+}) = ${dec(c, l, n)} ${r(MOL)}`);
  return {
    instruction: tx("Find the pH", "Bestimme den pH-Wert"),
    math: cText,
    answer: { kind: "number", value: n, label: '"pH" =' },
    mistakes: numberMistakes(n, [
      [n - 1, tx("Count the decimal places", "Zähl die Nachkommastellen"), tx("Close! It looks like you counted only the zeros after the comma. The exponent is the number of **decimal places**, and the 1 counts too.", "Fast! Sieht so aus, als hättest du nur die Nullen nach dem Komma gezählt. Der Exponent ist die Zahl der **Nachkommastellen**, und die 1 zählt mit."), true],
      [-n, tx("pH without the minus", "pH ohne Minus"), tx("The pH is the exponent of the power of ten **without** its minus sign, so it's positive here.", "Der pH-Wert ist der Exponent der Zehnerpotenz **ohne** Minuszeichen, hier also positiv."), true],
    ]),
    hint: tx("Write the concentration as a power of ten first.", "Schreib die Konzentration zuerst als Zehnerpotenz."),
    solution: [
      { math: cText, note: tx(`${n} decimal place${n > 1 ? "s" : ""}.`, `${n} Nachkommastelle${n > 1 ? "n" : ""}.`) },
      { math: m((r, l) => `c(\\ce{H3O+}) = ${dec(c, l, n)} ${r(MOL)} = 10^{-#m ${n}#e} ${r(MOL)}`), note: tx(`As a power of ten: $10^{-${n}}$.`, `Als Zehnerpotenz: $10^{-${n}}$.`) },
      { math: m((r) => `c(\\ce{H3O+}) = 10^{-#m ${n}#e2} ${r(MOL)} \\quad \\Rightarrow \\quad "pH" = ${n}#e`), note: tx(`The pH is the exponent without the minus: **pH ${n}**.`, `Der pH-Wert ist der Exponent ohne Minus: **pH ${n}**.`) },
    ],
  };
}

function exponentFromPh(rng: Rng): Exercise {
  const n = rng.int(1, 13);
  return {
    instruction: tx("Find the concentration", "Bestimme die Konzentration"),
    text: tx(`A solution has pH ${n}. Give the $\\ce{H3O+}$ concentration as a power of ten: what is the exponent $x$?`, `Eine Lösung hat den pH-Wert ${n}. Gib die $\\ce{H3O+}$-Konzentration als Zehnerpotenz an: Wie groß ist der Exponent $x$?`),
    math: m((r) => `c(\\ce{H3O+}) = 10^{x} ${r(MOL)}`),
    answer: { kind: "number", value: -n, label: "x =" },
    mistakes: numberMistakes(-n, [
      [n, tx("The minus is missing", "Das Minus fehlt"), tx("Almost! $10^{" + n + "}$ would be a huge number. Concentrations of $\\ce{H3O+}$ are tiny, so the exponent is negative.", "Fast! $10^{" + n + "}$ wäre eine riesige Zahl. $\\ce{H3O+}$-Konzentrationen sind winzig, der Exponent ist also negativ."), true],
      [-(14 - n), tx("That's the hydroxide ions", "Das sind die Hydroxid-Ionen"), tx("That would be the concentration of the $\\ce{OH-}$ ions. The question is about $\\ce{H3O+}$, and its exponent comes straight from the pH.", "Das wäre die Konzentration der $\\ce{OH-}$-Ionen. Gefragt ist nach $\\ce{H3O+}$, und dessen Exponent kommt direkt aus dem pH-Wert.")],
    ]),
    hint: tx(`For example, pH ${n === 3 ? 5 : 3} means $10^{-${n === 3 ? 5 : 3}}$ mol/L. It works the same for every pH.`, `Zum Beispiel heißt pH ${n === 3 ? 5 : 3}: $10^{-${n === 3 ? 5 : 3}}$ mol/l. Das geht bei jedem pH-Wert genauso.`),
    solution: [
      { math: m((r) => `"pH" = ${n}#e \\quad \\Rightarrow \\quad c(\\ce{H3O+}) = 10^{x} ${r(MOL)}`), note: tx("The pH is the exponent without the minus.", "Der pH-Wert ist der Exponent ohne Minus.") },
      { math: m((r) => `"pH" = ${n}#e2 \\quad \\Rightarrow \\quad c(\\ce{H3O+}) = 10^{-#m ${n}#e} ${r(MOL)}`), note: tx(`So $x = -${n}$.`, `Also ist $x = -${n}$.`) },
    ],
  };
}

function factorBetween(rng: Rng, level: Level): Exercise {
  const d = level === 3 ? rng.int(3, 5) : rng.int(1, 2);
  const a = rng.int(1, Math.max(1, 7 - d));
  const b = a + d;
  const F = 10 ** d;
  const fmt = (v: number, l: Locale) => new Intl.NumberFormat(l === "de" ? "de-DE" : "en-GB").format(v);
  return {
    instruction: tx("Compare the solutions", "Vergleiche die Lösungen"),
    text: m((r, l) =>
      l === "de"
        ? `Lösung A hat pH ${a}, Lösung B hat pH ${b}. Um welchen Faktor ist die $\\ce{H3O+}$-Konzentration in Lösung A größer als in Lösung B?`
        : `Solution A has pH ${a}, solution B has pH ${b}. By what factor is the $\\ce{H3O+}$ concentration in solution A higher than in solution B?`,
    ),
    math: tx(`"solution A: pH" = ${a} \\quad "solution B: pH" = ${b}`, `"Lösung A: pH" = ${a} \\quad "Lösung B: pH" = ${b}`),
    answer: { kind: "number", value: F },
    mistakes: numberMistakes(F, [
      [d, tx("Steps, not the factor", "Schritte, nicht der Faktor"), tx(`${d} is the number of pH steps. But **each** step is a factor of 10, so the factors multiply.`, `${d} ist die Zahl der pH-Schritte. Aber **jeder** Schritt bedeutet Faktor 10, und die Faktoren werden multipliziert.`)],
      [10 * d, tx("A factor of 10 for every step", "Faktor 10 bei jedem Schritt"), tx(`Not $${d} \\cdot 10$: each step multiplies by 10 again, so it's $10 \\cdot 10 \\cdot …$`, `Nicht $${d} \\cdot 10$: Jeder Schritt multipliziert wieder mit 10, also $10 \\cdot 10 \\cdot …$`)],
      [1 / F, tx("The other way round", "Andersherum"), tx("That's how much **less** solution B has compared with A. Lower pH means more $\\ce{H3O+}$, so A has more.", "So viel **weniger** hat Lösung B im Vergleich zu A. Kleinerer pH-Wert heißt mehr $\\ce{H3O+}$, also hat A mehr."), true],
    ]),
    hint: tx("One pH step means a factor of 10 in the $\\ce{H3O+}$ concentration.", "Ein pH-Schritt bedeutet Faktor 10 bei der $\\ce{H3O+}$-Konzentration."),
    solution: [
      { math: m((r) => `c_A = 10^{-${a}} ${r(MOL)} \\quad c_B = 10^{-${b}} ${r(MOL)}`), note: tx("Write both concentrations as powers of ten.", "Schreib beide Konzentrationen als Zehnerpotenz.") },
      {
        math: m((_, l) => `\\frac{10^{-${a}}}{10^{-${b}}} = 10^{${d}} = ${fmt(F, l)}`),
        note: tx(`${d} pH step${d > 1 ? "s" : ""}, each a factor of 10: solution A has **${fmt(F, "en")} times** as many $\\ce{H3O+}$ ions.`, `${d} pH-Schritt${d > 1 ? "e" : ""}, jeder ein Faktor 10: Lösung A hat **${fmt(F, "de")}-mal** so viele $\\ce{H3O+}$-Ionen.`),
      },
    ],
  };
}

const NON_ACIDS: { f: string; kind: "hydroxide" | "nh3" | "salt" | "ch4" }[] = [
  { f: "NaOH", kind: "hydroxide" },
  { f: "KOH", kind: "hydroxide" },
  { f: "Ca(OH)2", kind: "hydroxide" },
  { f: "NH3", kind: "nh3" },
  { f: "NaCl", kind: "salt" },
  { f: "KNO3", kind: "salt" },
  { f: "Na2SO4", kind: "salt" },
  { f: "CH4", kind: "ch4" },
];

function whichAreAcids(rng: Rng): Exercise {
  const acids = rng.shuffle(ACIDS).slice(0, 3);
  const withH = rng.shuffle(NON_ACIDS.filter((x) => x.kind !== "salt"));
  const others = [withH[0], ...rng.shuffle(NON_ACIDS.filter((x) => x !== withH[0])).slice(0, 2)];
  const items = rng.shuffle([...acids.map((a) => ({ f: a.formula, acid: true, kind: "acid" })), ...others.map((o) => ({ f: o.f, acid: false, kind: o.kind }))]);
  const options = items.map((x) => f$(x.f));
  const right = items.flatMap((x, i) => (x.acid ? [i] : []));
  const idx = (pred: (x: (typeof items)[number]) => boolean) => items.flatMap((x, i) => (pred(x) ? [i] : []));
  const list = (pred: (x: (typeof items)[number]) => boolean) =>
    items
      .filter(pred)
      .map((x) => f$(x.f))
      .join(", ");
  const bases = list((x) => x.kind === "hydroxide" || x.kind === "nh3");
  const ch4 = items.some((x) => x.kind === "ch4");
  const salts = list((x) => x.kind === "salt");
  const allH: Text = txMap((t) =>
    [
      t("You picked everything with an H in it. But not every H can leave as a proton:", "Du hast alles mit einem H gewählt. Aber nicht jedes H kann als Proton gehen:"),
      bases ? t(`${bases} ${bases.includes(",") ? "are bases" : "is a base"}, they take protons up.`, `${bases} ${bases.includes(",") ? "sind Basen" : "ist eine Base"}, sie nehmen Protonen auf.`) : "",
      ch4 ? t("Methane gives away no protons at all.", "Methan gibt gar keine Protonen ab.") : "",
    ]
      .filter(Boolean)
      .join(" "),
  );
  const mistakes = multiMistakes(options, right, [
    [idx((x) => x.acid || x.kind === "hydroxide" || x.kind === "nh3" || x.kind === "ch4"), tx("Not every H is a proton to give", "Nicht jedes H ist ein abgebbares Proton"), allH],
    [idx((x) => x.acid || x.kind === "hydroxide"), tx("OH means hydroxide", "OH heißt Hydroxid"), tx("An OH group in a formula like $\\ce{NaOH}$ is a hydroxide ion: that makes a **base**, not an acid.", "Eine OH-Gruppe in einer Formel wie $\\ce{NaOH}$ ist ein Hydroxid-Ion: Das macht eine **Base**, keine Säure.")],
    [idx((x) => x.acid && x.f !== "CH3COOH"), tx("Acetic acid is one too", "Essigsäure gehört dazu"), tx("$\\ce{CH3COOH}$ is acetic acid! Its acidic H sits at the end, in the COOH group.", "$\\ce{CH3COOH}$ ist Essigsäure! Ihr saures H sitzt am Ende, in der COOH-Gruppe.")],
    [idx((x) => x.acid || x.kind === "salt"), tx("Salts aren't acids", "Salze sind keine Säuren"), tx(`Salts like ${salts} have no H that could leave. They are what's left after a neutralisation.`, `Salze wie ${salts} haben kein H, das abgegeben werden könnte. Sie bleiben nach einer Neutralisation übrig.`)],
  ]);
  const rest: Text = txMap((t) =>
    [
      bases ? t(`${bases}: bases, they take protons up.`, `${bases}: Basen, sie nehmen Protonen auf.`) : "",
      salts ? t(`${salts}: salts, no proton to give.`, `${salts}: Salze, kein Proton zum Abgeben.`) : "",
      ch4 ? t("$\\ce{CH4}$: gives no protons at all.", "$\\ce{CH4}$: gibt gar keine Protonen ab.") : "",
    ]
      .filter(Boolean)
      .join(" "),
  );
  return {
    instruction: tx("Find the acids", "Finde die Säuren"),
    text: tx("Which of these substances are acids (proton donors in water)?", "Welche dieser Stoffe sind Säuren (Protonendonatoren in Wasser)?"),
    answer: { kind: "multi", options, correct: right },
    mistakes,
    hint: tx("An acid has an H it can hand over as $\\ce{H+}$. Hydroxides and ammonia take protons instead.", "Eine Säure hat ein H, das sie als $\\ce{H+}$ abgeben kann. Hydroxide und Ammoniak nehmen dagegen Protonen auf."),
    solution: [
      { math: acids.map((a) => ce(a.formula)).join(" \\quad "), note: tx(`These are acids: ${acids.map((a) => en(a.name)).join(", ")}.`, `Das sind Säuren: ${acids.map((a) => de(a.name)).join(", ")}.`) },
      { math: others.map((o) => ce(o.f)).join(" \\quad "), note: rest },
    ],
  };
}

function whoIsAcid(rng: Rng, level: Level): Exercise {
  const p = rng.pick(PROTOLYSES.filter((x) => x.level <= level));
  const askAcid = rng.chance(0.6);
  const target = askAcid ? p.donor : p.acceptor;
  const other = askAcid ? p.acceptor : p.donor;
  const distinct = [...new Set(p.species)];
  const rightF = p.species[target];
  const water = p.species[other] === "H2O";
  const wrongs: Wrong[] = distinct
    .filter((s) => s !== rightF)
    .map((s) => {
      const i = p.species.indexOf(s);
      if (i === other)
        return {
          text: f$(s),
          title: askAcid ? tx("That's the base", "Das ist die Base") : tx("That's the acid", "Das ist die Säure"),
          say: askAcid
            ? water
              ? tx("Water **takes** the proton here, so it's the base. Which particle loses an H?", "Wasser **nimmt** hier das Proton auf, ist also die Base. Welches Teilchen verliert ein H?")
              : tx(`$\\ce{${s}}$ takes the proton up: that's the base. The acid is the one that gives it away.`, `$\\ce{${s}}$ nimmt das Proton auf: Das ist die Base. Die Säure ist das Teilchen, das es abgibt.`)
            : water
              ? tx("Here water **gives** the proton away: it plays the acid. Which particle gains an H?", "Hier **gibt** Wasser das Proton ab: Es spielt die Säure. Welches Teilchen bekommt ein H dazu?")
              : tx(`$\\ce{${s}}$ gives the proton away: that's the acid. The base is the one that takes it.`, `$\\ce{${s}}$ gibt das Proton ab: Das ist die Säure. Die Base ist das Teilchen, das es aufnimmt.`),
        };
      return {
        text: f$(s),
        title: tx("That's a product", "Das ist ein Produkt"),
        say: tx("That particle is on the right, after the reaction. Look at the particles before the arrow: who loses an H, who gains one?", "Dieses Teilchen steht rechts, nach der Reaktion. Schau auf die Teilchen vor dem Pfeil: Wer verliert ein H, wer bekommt eins?"),
      };
    });
  const { answer, mistakes } = oneOf(rng, f$(rightF), wrongs);
  const [l, r] = p.ce.split(/ -> | <=> /);
  const arrow = p.ce.includes("<=>") ? "<=>" : "->";
  const lefts = l.split(" + ");
  const marked = lefts.map((s, i) => (i === target ? `\\hl{\\ce{${s}}}` : `\\ce{${s}}`)).join(" + ");
  return {
    instruction: askAcid ? tx("Find the acid", "Finde die Säure") : tx("Find the base", "Finde die Base"),
    text: askAcid
      ? tx("Which particle acts as the **acid** (proton donor) in this reaction?", "Welches Teilchen reagiert in dieser Reaktion als **Säure** (Protonendonator)?")
      : tx("Which particle acts as the **base** (proton acceptor) in this reaction?", "Welches Teilchen reagiert in dieser Reaktion als **Base** (Protonenakzeptor)?"),
    math: ce(p.ce),
    answer,
    mistakes,
    hint: tx("Compare left and right: which particle has one H fewer afterwards, which one H more?", "Vergleiche links und rechts: Welches Teilchen hat danach ein H weniger, welches ein H mehr?"),
    solution: [
      { math: ce(p.ce), note: p.why },
      { math: `${marked} \\ce{${arrow} ${r}}`, note: askAcid ? tx(`$\\ce{${rightF}}$ gives the proton away: it's the **acid**.`, `$\\ce{${rightF}}$ gibt das Proton ab: Es ist die **Säure**.`) : tx(`$\\ce{${rightF}}$ takes the proton: it's the **base**.`, `$\\ce{${rightF}}$ nimmt das Proton auf: Es ist die **Base**.`) },
    ],
  };
}

// ---------------------------------------------------------------------------
// Level 3

function saltFormulaTask(rng: Rng): Exercise {
  const pairs: [string, string][] = [
    ["H3PO4", "Ca(OH)2"],
    ["H3PO4", "Mg(OH)2"],
    ["H3PO4", "NaOH"],
    ["H3PO4", "KOH"],
    ["H2SO4", "NaOH"],
    ["H2SO4", "KOH"],
    ["H2CO3", "NaOH"],
    ["HNO3", "Ca(OH)2"],
    ["HNO3", "Mg(OH)2"],
    ["HCl", "Ca(OH)2"],
    ["CH3COOH", "Ca(OH)2"],
  ];
  const [af, bf] = rng.pick(pairs);
  const a = acid(af);
  const b = base(bf);
  const salt = saltFormula(b, a);
  const { cations, anions } = saltCounts(b, a);
  const q = b.cation!.charge;
  const swapped = saltFormula(b, a, { cations: anions, anions: cations });
  const one = saltFormula(b, a, { cations: 1, anions: 1 });
  const mistakes = formulaMistakes(salt, [
    [one, tx("Charges don't cancel", "Ladungen gleichen sich nicht aus"), tx(`One of each doesn't work: $\\ce{${b.cation!.symbol}${chargeStr(q)}}$ and $\\ce{${a.anion}}$ have different charges. In a salt they must add up to zero.`, `Je eins geht nicht: $\\ce{${b.cation!.symbol}${chargeStr(q)}}$ und $\\ce{${a.anion}}$ haben verschiedene Ladungen. In einem Salz müssen sie sich zu null ergänzen.`)],
    [swapped, tx("Numbers swapped", "Zahlen vertauscht"), tx("The idea is right, but the numbers are swapped. Check: the positive and negative charges must add up to zero.", "Die Idee stimmt, aber die Zahlen sind vertauscht. Prüf: Die positiven und negativen Ladungen müssen zusammen null ergeben."), true],
    [`${b.cation!.symbol}${cations > 1 ? cations : ""}H${a.core}`.replace(/H(CH3COO)/, "$1H"), tx("The protons are gone", "Die Protonen sind weg"), tx("In the salt there's no acidic H left: all protons went into water molecules.", "Im Salz ist kein saures H mehr: Alle Protonen sind in Wassermoleküle gewandert.")],
  ]);
  return {
    instruction: tx("Write the salt's formula", "Schreib die Formel des Salzes"),
    text: tx(`${cap(en(a.name))} is neutralised with ${en(b.name)}. Which salt forms? Write its formula.`, `${de(a.name)} wird mit ${de(b.name)} neutralisiert. Welches Salz entsteht? Schreib seine Formel.`),
    math: `\\ce{${a.formula} + ${b.formula} ->} \\box{?} \\ce{+ H2O}`,
    answer: { kind: "formula", value: salt },
    mistakes,
    hint: tx(`The salt is made of $\\ce{${b.cation!.symbol}${chargeStr(q)}}$ and $\\ce{${a.anion}}$. How many of each make the charges cancel?`, `Das Salz besteht aus $\\ce{${b.cation!.symbol}${chargeStr(q)}}$ und $\\ce{${a.anion}}$. Wie viele von jedem braucht es, damit sich die Ladungen ausgleichen?`),
    solution: [
      { math: `\\ce{${b.cation!.symbol}${chargeStr(q)}} \\quad \\ce{${a.anion}}`, note: tx("The metal ion from the base, the anion from the acid.", "Das Metall-Ion aus der Base, das Anion aus der Säure.") },
      { math: `${cations} \\cdot (+${q}) + ${anions} \\cdot (-${a.protons}) = 0`, note: tx(`${cations} × (+${q}) and ${anions} × (−${a.protons}) cancel out.`, `${cations} · (+${q}) und ${anions} · (−${a.protons}) gleichen sich aus.`) },
      { math: ce(salt), note: tx(`The salt is **${en(saltName(b, a))}**, $\\ce{${salt}}$.`, `Das Salz ist **${de(saltName(b, a))}**, $\\ce{${salt}}$.`) },
    ],
  };
}

function dilution(rng: Rng): Exercise {
  const p = rng.int(1, 3);
  const k = rng.int(1, Math.min(3, 5 - p));
  const F = 10 ** k;
  const fmt = (v: number, l: Locale) => new Intl.NumberFormat(l === "de" ? "de-DE" : "en-GB").format(v);
  return {
    instruction: tx("Find the new pH", "Bestimme den neuen pH-Wert"),
    text: m((_, l) =>
      l === "de"
        ? `Salzsäure mit pH ${p} wird mit Wasser auf das ${fmt(F, l)}-Fache ihres Volumens verdünnt. Welchen pH-Wert hat die Lösung danach?`
        : `Hydrochloric acid with pH ${p} is diluted with water to ${fmt(F, l)} times its volume. What is the pH afterwards?`,
    ),
    answer: { kind: "number", value: p + k, label: '"pH" =' },
    mistakes: numberMistakes(p + k, [
      [p - k, tx("Diluting makes it less acidic", "Verdünnen macht weniger sauer"), tx("The $\\ce{H3O+}$ ions spread over more water: **fewer** per litre. Less acidic means the pH goes **up**.", "Die $\\ce{H3O+}$-Ionen verteilen sich auf mehr Wasser: **weniger** pro Liter. Weniger sauer heißt, der pH-Wert steigt.")],
      [p, tx("The pH does change", "Der pH-Wert ändert sich"), tx("The ions are still there, but in much more water. The pH depends on the concentration, the ions **per litre**.", "Die Ionen sind noch da, aber in viel mehr Wasser. Der pH-Wert hängt von der Konzentration ab, also von den Ionen **pro Liter**.")],
      [p + 1, tx("One step per factor of 10", "Ein Schritt pro Faktor 10"), tx(`Right direction! But each factor of 10 is one pH step, and ${fmt(F, "en")} is $10^{${k}}$.`, `Richtige Richtung! Aber jeder Faktor 10 ist ein pH-Schritt, und ${fmt(F, "de")} ist $10^{${k}}$.`), true],
    ]),
    hint: tx("Diluting to 10 times the volume makes the $\\ce{H3O+}$ concentration 10 times smaller.", "Verdünnen auf das 10-Fache macht die $\\ce{H3O+}$-Konzentration 10-mal kleiner."),
    solution: [
      { math: m((r) => `c(\\ce{H3O+}) = 10^{-${p}} ${r(MOL)}`), note: tx(`pH ${p} at the start.`, `Am Anfang pH ${p}.`) },
      { math: m((r, l) => `c(\\ce{H3O+}) = 10^{-${p}} : ${fmt(F, l)} = 10^{-${p + k}} ${r(MOL)}`), note: tx(`${fmt(F, "en")} times the volume: the concentration is ${fmt(F, "en")} times smaller.`, `Das ${fmt(F, "de")}-Fache Volumen: Die Konzentration wird ${fmt(F, "de")}-mal kleiner.`) },
      { math: m((r) => `c(\\ce{H3O+}) = 10^{-${p + k}} ${r(MOL)} \\quad \\Rightarrow \\quad "pH" = ${p + k}`), note: tx(`So **pH ${p + k}**: less acidic, but still below 7.`, `Also **pH ${p + k}**: weniger sauer, aber immer noch unter 7.`) },
    ],
  };
}

type IonBalance = { eq: string; coefs: number[]; wrong: [number[], Text, Text, boolean?][]; note: Text };

const ION_BALANCES: IonBalance[] = [
  {
    eq: "H2SO4 + H2O -> H3O+ + SO4^2-",
    coefs: [1, 2, 2, 1],
    wrong: [[[1, 1, 1, 1], tx("Two protons, two water molecules", "Zwei Protonen, zwei Wassermoleküle"), tx("Sulfuric acid gives away **two** protons. Each one needs its own water molecule to land on.", "Schwefelsäure gibt **zwei** Protonen ab. Jedes braucht sein eigenes Wassermolekül, auf dem es landet.")]],
    note: tx("Two protons go to two water molecules: two $\\ce{H3O+}$. Charges: left 0, right $2 \\cdot (+1) + (-2) = 0$.", "Zwei Protonen gehen an zwei Wassermoleküle: zwei $\\ce{H3O+}$. Ladungen: links 0, rechts $2 \\cdot (+1) + (-2) = 0$."),
  },
  {
    eq: "H3O+ + OH- -> H2O",
    coefs: [1, 1, 2],
    wrong: [[[1, 1, 1], tx("Count the H", "Zähl die H-Atome"), tx("Count the H atoms on the left: 3 + 1 = 4. How many water molecules is that?", "Zähl die H-Atome links: 3 + 1 = 4. Wie viele Wassermoleküle sind das?"), true]],
    note: tx("4 H and 2 O on the left: that's two water molecules. The charges $+1$ and $-1$ cancel.", "Links 4 H und 2 O: Das sind zwei Wassermoleküle. Die Ladungen $+1$ und $-1$ heben sich auf."),
  },
  {
    eq: "H2O -> H3O+ + OH-",
    coefs: [2, 1, 1],
    wrong: [[[1, 1, 1], tx("It takes two", "Es braucht zwei"), tx("One water molecule gives a proton, **another** one takes it. So two water molecules meet.", "Ein Wassermolekül gibt ein Proton ab, ein **anderes** nimmt es auf. Es treffen sich also zwei Wassermoleküle.")]],
    note: tx("Autoprotolysis: two water molecules swap a proton. This happens only very rarely, which is why pure water has so few ions.", "Autoprotolyse: Zwei Wassermoleküle tauschen ein Proton aus. Das passiert nur sehr selten, deshalb hat reines Wasser so wenige Ionen."),
  },
];

function ionBalance(rng: Rng, level: Level): Exercise {
  const amm = level === 3 && rng.chance(0.5);
  if (amm) {
    const x = rng.pick(AMMONIUM.filter((y) => y.coefficients[0] > 1));
    const a = acid(x.acid);
    return {
      instruction: tx("Balance the equation", "Gleiche die Gleichung aus"),
      text: tx(`Ammonia reacts with ${en(a.name)} to form ${en(x.name)}, a fertiliser. Fill in the coefficients.`, `Ammoniak reagiert mit ${de(a.name)} zu ${de(x.name)}, einem Dünger. Ergänze die Koeffizienten.`),
      answer: { kind: "balance", equation: x.equation, coefficients: x.coefficients },
      mistakes: [
        {
          when: { kind: "balance", equation: x.equation, coefficients: [1, 1, 1] },
          title: tx("One proton per ammonia", "Ein Proton pro Ammoniak"),
          say: tx(`Each $\\ce{NH3}$ takes **one** proton. $\\ce{${a.formula}}$ has ${a.protons} to give. How many $\\ce{NH3}$ do you need?`, `Jedes $\\ce{NH3}$ nimmt **ein** Proton auf. $\\ce{${a.formula}}$ hat ${a.protons} abzugeben. Wie viele $\\ce{NH3}$ brauchst du?`),
        },
        ...balanceMistakes({ eq: x.equation, coefs: x.coefficients, units: [a.core] }),
      ],
      hint: tx("Here the base is ammonia: each $\\ce{NH3}$ takes one proton and becomes $\\ce{NH4+}$. No water forms!", "Hier ist Ammoniak die Base: Jedes $\\ce{NH3}$ nimmt ein Proton auf und wird zu $\\ce{NH4+}$. Es entsteht kein Wasser!"),
      solution: [
        { math: coefSrc(x.equation, [1, 1, 1]), note: tx(`$\\ce{${a.formula}}$ has ${a.protons} protons, each $\\ce{NH3}$ takes one.`, `$\\ce{${a.formula}}$ hat ${a.protons} Protonen, jedes $\\ce{NH3}$ nimmt eins.`) },
        { math: coefSrc(x.equation, x.coefficients), note: tx(`So ${a.protons} $\\ce{NH3}$: ${a.protons} $\\ce{NH4+}$ ions for one $\\ce{${a.anion}}$.`, `Also ${a.protons} $\\ce{NH3}$: ${a.protons} $\\ce{NH4+}$-Ionen für ein $\\ce{${a.anion}}$.`) },
      ],
    };
  }
  const x = level === 3 ? rng.pick(ION_BALANCES) : ION_BALANCES[1];
  return {
    instruction: tx("Balance the equation", "Gleiche die Gleichung aus"),
    text: tx("Balance it: count the atoms, then check that the charges match on both sides.", "Gleiche aus: Zähl die Atome und prüf dann, ob die Ladungen auf beiden Seiten übereinstimmen."),
    answer: { kind: "balance", equation: x.eq, coefficients: x.coefs },
    mistakes: x.wrong.map(([c, title, say, close]) => ({ when: { kind: "balance", equation: x.eq, coefficients: c }, title, say, close })),
    hint: tx("Follow the protons: where does each one end up?", "Verfolge die Protonen: Wo landet jedes einzelne?"),
    solution: [
      { math: coefSrc(x.eq, x.coefs.map(() => 1)), note: tx("Count H and O on both sides.", "Zähl H und O auf beiden Seiten.") },
      { math: coefSrc(x.eq, x.coefs), note: x.note },
    ],
  };
}

function conclude(rng: Rng): Exercise {
  type Case = { id: IndicatorId; colour: ColourId; ph: number; right: number };
  const cases: Case[] = [
    { id: "phenolphthalein", colour: "colourless", ph: 4, right: 3 },
    { id: "phenolphthalein", colour: "colourless", ph: 7, right: 3 },
    { id: "phenolphthalein", colour: "pink", ph: 11, right: 2 },
    { id: "bromothymol", colour: "yellow", ph: 3, right: 0 },
    { id: "bromothymol", colour: "green", ph: 7, right: 1 },
    { id: "litmus", colour: "blue", ph: 12, right: 2 },
    { id: "universal", colour: "violet", ph: 13, right: 2 },
  ];
  const c = rng.pick(cases);
  const ind = indicator(c.id).name;
  const colour = COLOUR[c.colour];
  const options: Text[] = [NATURE_OPTS.acidic, NATURE_OPTS.neutral, NATURE_OPTS.alkaline, tx("It is acidic or neutral, you can't tell which.", "Sie ist sauer oder neutral, genauer geht es nicht.")];
  const trap = c.id === "phenolphthalein" && c.colour === "colourless";
  const mistakes: Mistake[] = [];
  const add = (i: number, title: Text, say: Text, close = false) => i !== c.right && mistakes.push({ when: { kind: "choice", options, correct: i }, title, say, close });
  if (trap) {
    add(0, tx("Neutral is possible too", "Neutral geht auch"), tx("Phenolphthalein also stays colourless in **neutral** water. So colourless alone doesn't prove the solution is acidic.", "Phenolphthalein bleibt auch in **neutralem** Wasser farblos. Farblos allein beweist also nicht, dass die Lösung sauer ist."), true);
    add(1, tx("Acidic is possible too", "Sauer geht auch"), tx("Phenolphthalein also stays colourless in **acids**. So colourless alone doesn't prove the solution is neutral.", "Phenolphthalein bleibt auch in **Säuren** farblos. Farblos allein beweist also nicht, dass die Lösung neutral ist."), true);
    add(2, tx("Colourless isn't alkaline", "Farblos ist nicht alkalisch"), tx("In alkaline solutions phenolphthalein turns pink. Colourless rules that out.", "In alkalischen Lösungen färbt sich Phenolphthalein pink. Farblos schließt das aus."));
  } else {
    const say = tx(`Think about the colours of ${en(ind)}: in which range does it look ${en(colour)}?`, `Denk an die Farben von ${de(ind)}: In welchem Bereich sieht er ${de(colour)} aus?`);
    [0, 1, 2].forEach((i) => add(i, tx("Check the colour chart", "Prüf die Farbskala"), say));
    add(3, tx("This colour is clear", "Diese Farbe ist eindeutig"), tx(`${cap(en(colour))} is a clear signal for ${en(ind)}: you can say exactly which range it is.`, `${cap(de(colour))} ist bei ${de(ind)} ein eindeutiges Signal: Du kannst genau sagen, welcher Bereich es ist.`));
  }
  return {
    instruction: tx("What can you conclude?", "Was kannst du folgern?"),
    text: tx(`You test a solution with **${en(ind)}**. It ${c.colour === "colourless" ? "stays" : "turns"} **${en(colour)}**. What can you say for sure?`, `Du prüfst eine Lösung mit **${de(ind)}**. Sie ${c.colour === "colourless" ? "bleibt" : "färbt sich"} **${de(colour)}**. Was kannst du sicher sagen?`),
    visual: tube(shade(c.id, c.ph).hex, tx(`${cap(en(ind))}: ${en(colour)}`, `${de(ind)}: ${de(colour)}`)),
    answer: { kind: "choice", options, correct: c.right },
    mistakes,
    hint: tx(`In which pH range does ${en(ind)} show this colour? Is it only one range?`, `In welchem pH-Bereich zeigt ${de(ind)} diese Farbe? Ist es nur ein Bereich?`),
    solution: [
      { math: chart(c.id), note: tx(`The colours of ${en(ind)}.`, `Die Farben von ${de(ind)}.`) },
      {
        math: m((r) => `"${r(colour)}" \\Rightarrow ${trap ? r(tx('"acidic or neutral"', '"sauer oder neutral"')) : r(NATURE_MATH[(["acidic", "neutral", "alkaline"] as Nature[])[c.right]])}`),
        note: trap
          ? tx("Phenolphthalein is colourless in acidic **and** in neutral solutions. To tell them apart, you'd need another indicator, like universal indicator.", "Phenolphthalein ist in sauren **und** in neutralen Lösungen farblos. Um das zu unterscheiden, brauchst du einen anderen Indikator, z. B. Universalindikator.")
          : tx(`${cap(en(colour))} only appears in one range, so the answer is clear.`, `${cap(de(colour))} kommt nur in einem Bereich vor, die Antwort ist also eindeutig.`),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// The generator

function generate(level: Level, rng: Rng): Exercise {
  if (level === 1) {
    return rng.pick([
      () => classifyPh(rng),
      () => classifySubstance(rng),
      () => indicatorColour(rng),
      () => indicatorReads(rng),
      () => concept(rng, CONCEPTS_1),
      () => ionName(rng),
      () => acidName(rng),
      () => phFromPower(rng),
    ])();
  }
  if (level === 2) {
    return rng.pick([
      () => anionFormula(rng),
      () => protolysisGap(rng, 2),
      () => neutraliseBalance(rng, 2),
      () => saltNameChoice(rng),
      () => phFromDecimal(rng),
      () => exponentFromPh(rng),
      () => factorBetween(rng, 2),
      () => whichAreAcids(rng),
      () => whoIsAcid(rng, 2),
      () => (rng.chance(0.5) ? concept(rng, CONCEPTS_2.slice(0, 1)) : ionBalance(rng, 2)),
    ])();
  }
  return rng.pick([
    () => neutraliseBalance(rng, 3),
    () => saltFormulaTask(rng),
    () => factorBetween(rng, 3),
    () => dilution(rng),
    () => ionBalance(rng, 3),
    () => whoIsAcid(rng, 3),
    () => conclude(rng),
    () => protolysisGap(rng, 3),
    () => concept(rng, CONCEPTS_2),
  ])();
}

// ---------------------------------------------------------------------------
// Lesson

const lessonCheckBalance = neutralisation(base("Ca(OH)2"), acid("HCl"));

const acidsBases: Topic = {
  ...topicMeta("acids-bases"),
  summary: [
    {
      title: tx("Acids and bases (Brønsted)", "Säuren und Basen (Brønsted)"),
      body: tx(
        "An **acid** gives away protons $\\ce{H+}$: a proton donor. A **base** takes them up: a proton acceptor. Such a proton transfer is called a **protolysis**.",
        "Eine **Säure** gibt Protonen $\\ce{H+}$ ab: ein Protonendonator. Eine **Base** nimmt sie auf: ein Protonenakzeptor. So einen Protonenübergang nennt man **Protolyse**.",
      ),
      examples: ["\\ce{HCl + H2O -> H3O+ + Cl-}", "\\ce{NH3 + H2O <=> NH4+ + OH-}"],
      tone: "rule",
    },
    {
      title: tx("The pH scale", "Die pH-Skala"),
      body: tx(
        "Oxonium ions $\\ce{H3O+}$ make a solution acidic, hydroxide ions $\\ce{OH-}$ alkaline. The pH is the exponent of $c(\\ce{H3O+})$ without the minus. **One pH step = factor 10.**",
        "Oxonium-Ionen $\\ce{H3O+}$ machen eine Lösung sauer, Hydroxid-Ionen $\\ce{OH-}$ alkalisch. Der pH-Wert ist der Exponent von $c(\\ce{H3O+})$ ohne Minus. **Ein pH-Schritt = Faktor 10.**",
      ),
      examples: [SCALE, m((r) => `c(\\ce{H3O+}) = 10^{-3} ${r(MOL)} \\Rightarrow "pH" = 3`)],
      tone: "rule",
    },
    {
      title: tx("Indicators", "Indikatoren"),
      body: tx(
        "**Universal indicator**: red, orange, yellow, green, blue, violet (from acidic to alkaline). **Bromothymol blue**: yellow, green, blue. **Phenolphthalein**: colourless, in alkaline solutions pink. **Litmus**: red, violet, blue.",
        "**Universalindikator**: rot, orange, gelb, grün, blau, violett (von sauer bis alkalisch). **Bromthymolblau**: gelb, grün, blau. **Phenolphthalein**: farblos, in alkalischen Lösungen pink. **Lackmus**: rot, violett, blau.",
      ),
      tone: "tip",
    },
    {
      title: tx("Acids and their anions", "Säuren und ihre Säurerest-Ionen"),
      body: tx(
        "Charge of the anion = number of protons given away. Hydrochloric acid: chloride. Nitric acid: nitrate. Sulfuric acid: sulfate. Carbonic acid: carbonate. Phosphoric acid: phosphate. Acetic acid: acetate.",
        "Ladung des Anions = Zahl der abgegebenen Protonen. Salzsäure: Chlorid. Salpetersäure: Nitrat. Schwefelsäure: Sulfat. Kohlensäure: Carbonat. Phosphorsäure: Phosphat. Essigsäure: Acetat.",
      ),
      examples: ["\\ce{H2SO4 + 2H2O -> 2H3O+ + SO4^2-}", "\\ce{Cl-} \\quad \\ce{NO3-} \\quad \\ce{SO4^2-} \\quad \\ce{CO3^2-} \\quad \\ce{PO4^3-} \\quad \\ce{CH3COO-}"],
      tone: "rule",
    },
    {
      title: tx("Neutralisation: acid + alkali", "Neutralisation: Säure + Lauge"),
      body: tx(
        "Acid + alkali → salt + water. At its heart: $\\ce{H3O+ + OH- -> 2H2O}$. Salt name = metal of the base + anion of the acid.",
        "Säure + Lauge → Salz + Wasser. Im Kern: $\\ce{H3O+ + OH- -> 2H2O}$. Salzname = Metall der Base + Säurerest-Ion.",
      ),
      examples: ["\\ce{HCl + NaOH -> NaCl + H2O}", "\\ce{H2SO4 + 2KOH -> K2SO4 + 2H2O}"],
      tone: "rule",
    },
    {
      title: tx("Classic traps", "Typische Fallen"),
      body: tx(
        "A **smaller** pH means **more** acidic. Phenolphthalein that stays colourless doesn't prove an acid: neutral water leaves it colourless too.",
        "Ein **kleinerer** pH-Wert heißt **saurer**. Bleibt Phenolphthalein farblos, ist das kein Beweis für eine Säure: Auch in neutralem Wasser bleibt es farblos.",
      ),
      examples: [m((r) => `"pH" = 2 : \\; c(\\ce{H3O+}) = 10^{-2} ${r(MOL)}`), m((r) => `"pH" = 5 : \\; c(\\ce{H3O+}) = 10^{-5} ${r(MOL)}`)],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Acids give away protons", "Säuren geben Protonen ab"),
      blob: tx("Acids and bases are all about one tiny particle: the proton. Let's follow it!", "Bei Säuren und Basen dreht sich alles um ein winziges Teilchen: das Proton. Lass es uns verfolgen!"),
      body: tx(
        "According to **Brønsted**, an **acid** is a particle that gives away a proton $\\ce{H+}$: a **proton donor**. A **base** takes a proton up: a **proton acceptor**.",
        "Nach **Brønsted** ist eine **Säure** ein Teilchen, das ein Proton $\\ce{H+}$ abgibt: ein **Protonendonator**. Eine **Base** nimmt ein Proton auf: ein **Protonenakzeptor**.",
      ),
      frames: [
        { math: "\\ce{HCl + H2O}", note: tx("Hydrogen chloride gas meets water.", "Chlorwasserstoff-Gas trifft auf Wasser.") },
        { math: "\\ce{HCl + H2O}", note: tx("The $\\ce{HCl}$ molecule hands its **proton** over to a water molecule.", "Das $\\ce{HCl}$-Molekül gibt sein **Proton** an ein Wassermolekül ab."), highlight: ["H#0"], arrows: [["H#0", "O#0"]] },
        {
          math: "\\ce{HCl + H2O -> H3O+ + Cl-}",
          note: tx(
            "Water becomes an **oxonium ion** $\\ce{H3O+}$, and what's left of $\\ce{HCl}$ is a **chloride ion** $\\ce{Cl-}$. The solution is called hydrochloric acid.",
            "Aus dem Wasser wird ein **Oxonium-Ion** $\\ce{H3O+}$, von $\\ce{HCl}$ bleibt ein **Chlorid-Ion** $\\ce{Cl-}$ übrig. Die Lösung heißt Salzsäure.",
          ),
        },
        { math: "\\hl{\\ce{HCl}} \\ce{+ H2O -> H3O+ + Cl-}", note: tx("$\\ce{HCl}$ gives the proton away: it is the **acid** (proton donor).", "$\\ce{HCl}$ gibt das Proton ab: Es ist die **Säure** (Protonendonator).") },
        { math: "\\ce{HCl +} \\hl{\\ce{H2O}} \\ce{-> H3O+ + Cl-}", note: tx("Water takes the proton up: here it is the **base** (proton acceptor). A proton transfer like this is called a **protolysis**.", "Wasser nimmt das Proton auf: Hier ist es die **Base** (Protonenakzeptor). So einen Protonenübergang nennt man **Protolyse**.") },
      ],
    },
    {
      type: "widget",
      title: tx("Watch the proton hop", "Schau dem Proton beim Springen zu"),
      blob: tx("Pick a reaction and let the proton jump. Who gives, who takes?", "Wähl eine Reaktion und lass das Proton springen. Wer gibt, wer nimmt?"),
      body: tx(
        "The proton leaves its electron behind. That's why the donor ends up one charge more negative and the acceptor one charge more positive.",
        "Das Proton lässt sein Elektron zurück. Deshalb wird der Donator um eine Ladung negativer und der Akzeptor um eine Ladung positiver.",
      ),
      widget: AcidsBasesProtonHop,
    },
    {
      type: "explain",
      title: tx("Acidic, alkaline, neutral", "Sauer, alkalisch, neutral"),
      blob: tx("Two ions decide everything: H₃O⁺ and OH⁻.", "Zwei Ionen entscheiden alles: H₃O⁺ und OH⁻."),
      frames: [
        { math: "\\ce{HNO3 + H2O ->} \\hl{\\ce{H3O+}} \\ce{+ NO3-}", note: tx("Every acid forms **oxonium ions** $\\ce{H3O+}$ in water. They make a solution **acidic**.", "Jede Säure bildet in Wasser **Oxonium-Ionen** $\\ce{H3O+}$. Sie machen eine Lösung **sauer**.") },
        { math: "\\ce{NH3 + H2O <=> NH4+ +} \\hl{\\ce{OH-}}", note: tx("**Ammonia** is a base: it takes a proton from water. This forms **hydroxide ions** $\\ce{OH-}$. They make a solution **alkaline** (basic).", "**Ammoniak** ist eine Base: Es nimmt ein Proton vom Wasser auf. Dabei entstehen **Hydroxid-Ionen** $\\ce{OH-}$. Sie machen eine Lösung **alkalisch** (basisch).") },
        { math: "\\ce{NaOH(s) -> Na+ (aq) +} \\hl{\\ce{OH- (aq)}}", note: tx("Hydroxides like sodium hydroxide bring their $\\ce{OH-}$ ions along when they dissolve. Their solutions are alkaline, for example sodium hydroxide solution.", "Hydroxide wie Natriumhydroxid bringen ihre $\\ce{OH-}$-Ionen gleich mit, wenn sie sich lösen. Ihre Lösungen heißen **Laugen**, z. B. Natronlauge.") },
        { math: "\\ce{H2O + H2O <=> H3O+ + OH-}", note: tx("Even pure water swaps protons, but only very rarely. There are very few ions, and exactly as many $\\ce{H3O+}$ as $\\ce{OH-}$.", "Sogar reines Wasser tauscht Protonen aus, aber nur sehr selten. Es gibt ganz wenige Ionen, und genauso viele $\\ce{H3O+}$ wie $\\ce{OH-}$.") },
        { math: "c(\\ce{H3O+}) = c(\\ce{OH-})", note: tx("Equal amounts: the solution is **neutral**. More $\\ce{H3O+}$: acidic. More $\\ce{OH-}$: alkaline.", "Gleich viele: Die Lösung ist **neutral**. Mehr $\\ce{H3O+}$: sauer. Mehr $\\ce{OH-}$: alkalisch.") },
      ],
    },
    {
      type: "check",
      blob: tx("Your turn! Follow the proton.", "Du bist dran! Verfolge das Proton."),
      exercise: {
        instruction: tx("Complete the equation", "Vervollständige die Gleichung"),
        math: gapSrc("HNO3 + H2O -> H3O+ + NO3-", 3).src,
        answer: { kind: "formula", value: "NO3-" },
        mistakes: formulaMistakes("NO3-", GAPS[1].wrong),
        hint: tx("Nitric acid gives one proton to water. What's left of $\\ce{HNO3}$? Don't forget the charge.", "Salpetersäure gibt ein Proton an Wasser ab. Was bleibt von $\\ce{HNO3}$ übrig? Vergiss die Ladung nicht."),
        solution: [
          { math: gapSrc("HNO3 + H2O -> H3O+ + NO3-", 3).src, note: tx("$\\ce{HNO3}$ loses its H as a proton $\\ce{H+}$.", "$\\ce{HNO3}$ verliert sein H als Proton $\\ce{H+}$.") },
          { math: "\\ce{HNO3 + H2O -> H3O+ + NO3-}", note: tx("The electron stays behind: the **nitrate ion** $\\ce{NO3-}$. Charges: left 0, right $+1 - 1 = 0$.", "Das Elektron bleibt zurück: das **Nitrat-Ion** $\\ce{NO3-}$. Ladungen: links 0, rechts $+1 - 1 = 0$.") },
        ],
      },
    },
    {
      type: "explain",
      title: tx("The pH value", "Der pH-Wert"),
      blob: tx("Tiny numbers, big differences. The pH makes them easy.", "Winzige Zahlen, große Unterschiede. Der pH-Wert macht sie handlich."),
      body: tx(
        "The **concentration** $c(\\ce{H3O+})$ tells you how many oxonium ions there are per litre (in mol/L). In acids it is a very small number.",
        "Die **Konzentration** $c(\\ce{H3O+})$ sagt dir, wie viele Oxonium-Ionen pro Liter da sind (in mol/l). In Säuren ist sie eine sehr kleine Zahl.",
      ),
      frames: [
        { math: m((r, l) => `c(\\ce{H3O+}) = ${dec(0.001, l, 3)} ${r(MOL)}`), note: tx("For example 0.001 mol/L. Lots of zeros, hard to compare.", "Zum Beispiel 0,001 mol/l. Viele Nullen, schwer zu vergleichen.") },
        { math: concPower(3), note: tx("As a power of ten: $0.001 = 10^{-3}$.", "Als Zehnerpotenz: $0,001 = 10^{-3}$."), highlight: ["m", "e"] },
        { math: m((r) => `c(\\ce{H3O+}) = 10^{-#m 3#e2} ${r(MOL)} \\quad \\Rightarrow \\quad "pH" = 3#e`), note: tx("The **pH value** is this exponent without the minus: pH 3. (Mathematically: $\"pH\" = -\"lg\" \\, c(\\ce{H3O+})$.)", "Der **pH-Wert** ist dieser Exponent ohne Minus: pH 3. (Mathematisch: $\"pH\" = -\"lg\" \\, c(\\ce{H3O+})$.)") },
        { math: m((r) => `"pH 3:" \\; 10^{-3} ${r(MOL)} \\\\ "pH 4:" \\; 10^{-4} ${r(MOL)}`), note: tx("One step up the scale: **10 times fewer** $\\ce{H3O+}$ ions. pH 3 is 10 times more acidic than pH 4, and 100 times more than pH 5.", "Ein Schritt höher auf der Skala: **10-mal weniger** $\\ce{H3O+}$-Ionen. pH 3 ist 10-mal saurer als pH 4 und 100-mal saurer als pH 5.") },
        { math: SCALE, note: tx("Small pH: many $\\ce{H3O+}$, acidic. pH 7: neutral, like pure water. Large pH: alkaline. The scale usually runs from 0 to 14.", "Kleiner pH-Wert: viele $\\ce{H3O+}$, sauer. pH 7: neutral, wie reines Wasser. Großer pH-Wert: alkalisch. Die Skala reicht meist von 0 bis 14.") },
      ],
    },
    {
      type: "widget",
      title: tx("Colour it in: indicators", "Farbe bekennen: Indikatoren"),
      blob: tx("Slide through the scale and switch indicators. Which one is the most useful?", "Schieb über die Skala und wechsle den Indikator. Welcher ist am nützlichsten?"),
      body: tx(
        "**Indicators** are dyes that change colour with the pH. Universal indicator shows the whole range, the others mainly tell acidic from alkaline.",
        "**Indikatoren** sind Farbstoffe, die ihre Farbe mit dem pH-Wert ändern. Universalindikator zeigt den ganzen Bereich, die anderen unterscheiden vor allem sauer und alkalisch.",
      ),
      widget: AcidsBasesPh,
    },
    {
      type: "check",
      blob: tx("Count carefully. Every decimal place counts!", "Zähl genau. Jede Nachkommastelle zählt!"),
      exercise: {
        instruction: tx("Find the pH", "Bestimme den pH-Wert"),
        math: m((r, l) => `c(\\ce{H3O+}) = ${dec(0.0001, l, 4)} ${r(MOL)}`),
        answer: { kind: "number", value: 4, label: '"pH" =' },
        mistakes: numberMistakes(4, [
          [3, tx("Count the decimal places", "Zähl die Nachkommastellen"), tx("Close! It looks like you counted only the zeros after the comma. The exponent is the number of **decimal places**, and the 1 counts too.", "Fast! Sieht so aus, als hättest du nur die Nullen nach dem Komma gezählt. Der Exponent ist die Zahl der **Nachkommastellen**, und die 1 zählt mit."), true],
          [-4, tx("pH without the minus", "pH ohne Minus"), tx("The pH is the exponent **without** its minus sign, so it's positive here.", "Der pH-Wert ist der Exponent **ohne** Minuszeichen, hier also positiv."), true],
          [10, tx("Counted from the other end", "Vom anderen Ende gezählt"), tx("Lots of $\\ce{H3O+}$ means acidic, so the pH must be below 7. Read it straight off the exponent.", "Viele $\\ce{H3O+}$ heißt sauer, der pH-Wert muss also unter 7 liegen. Lies ihn direkt am Exponenten ab.")],
        ]),
        hint: tx("Write 0.0001 as a power of ten first.", "Schreib 0,0001 zuerst als Zehnerpotenz."),
        solution: [
          { math: m((r, l) => `c(\\ce{H3O+}) = ${dec(0.0001, l, 4)} ${r(MOL)} = 10^{-#m 4#e} ${r(MOL)}`), note: tx("Four decimal places: $10^{-4}$.", "Vier Nachkommastellen: $10^{-4}$.") },
          { math: m((r) => `c(\\ce{H3O+}) = 10^{-#m 4#e2} ${r(MOL)} \\quad \\Rightarrow \\quad "pH" = 4#e`), note: tx("The exponent without the minus: **pH 4**, acidic.", "Der Exponent ohne Minus: **pH 4**, sauer.") },
        ],
      },
    },
    {
      type: "explain",
      title: tx("Acids and their anions", "Säuren und ihre Säurerest-Ionen"),
      blob: tx("Some acids have more than one proton to give. Watch the charge grow!", "Manche Säuren haben mehr als ein Proton abzugeben. Achte darauf, wie die Ladung wächst!"),
      frames: [
        { math: "\\ce{H2SO4 + H2O -> H3O+ + HSO4-}", note: tx("Sulfuric acid gives away a first proton. The **hydrogen sulfate ion** $\\ce{HSO4-}$ remains.", "Schwefelsäure gibt ein erstes Proton ab. Das **Hydrogensulfat-Ion** $\\ce{HSO4-}$ bleibt übrig.") },
        { math: "\\ce{HSO4- + H2O -> H3O+ + SO4^2-}", note: tx("It still has a proton to give. Then the **sulfate ion** $\\ce{SO4^2-}$ remains: two protons gone, charge 2−.", "Es hat noch ein Proton übrig. Dann bleibt das **Sulfat-Ion** $\\ce{SO4^2-}$: zwei Protonen weg, Ladung 2−.") },
        { math: "\\ce{H2SO4 + 2H2O -> 2H3O+ + SO4^2-}", note: tx("Both steps together. The rule: **charge of the anion = number of protons given away**.", "Beide Schritte zusammen. Die Regel: **Ladung des Anions = Zahl der abgegebenen Protonen**.") },
        {
          math: [
            ["HCl", "Cl-"],
            ["CH3COOH", "CH3COO-"],
            ["HNO3", "NO3-"],
            ["H2SO4", "SO4^2-"],
            ["H2CO3", "CO3^2-"],
            ["H3PO4", "PO4^3-"],
          ]
            .map(([x, y], i) => `\\group{\\ce{${x}} \\to \\ce{${y}}}${i % 2 ? " \\\\ " : " \\quad "}`)
            .join("")
            .replace(/ \\\\ $/, ""),
          note: tx(
            "Chloride, acetate, nitrate, sulfate, carbonate, phosphate. In acetic acid only the H of the COOH group can leave, so acetate is just 1−.",
            "Chlorid, Acetat, Nitrat, Sulfat, Carbonat, Phosphat. Bei Essigsäure kann nur das H der COOH-Gruppe gehen, deshalb ist Acetat nur 1−.",
          ),
        },
      ],
    },
    {
      type: "explain",
      title: tx("Neutralisation: acid meets alkali", "Neutralisation: Säure trifft Lauge"),
      blob: tx("Acid plus alkali: they cancel each other out, and you get salt water!", "Säure plus Lauge: Sie heben sich gegenseitig auf, und heraus kommt Salzwasser!"),
      frames: [
        { math: "\\ce{H3O+ + OH- -> 2H2O}", note: tx("Oxonium ions and hydroxide ions react to form **water**. This is called **neutralisation**, and it releases heat: it's exothermic.", "Oxonium-Ionen und Hydroxid-Ionen reagieren zu **Wasser**. Das nennt man **Neutralisation**, und dabei wird Wärme frei: Sie ist exotherm.") },
        { math: "\\ce{HCl + NaOH -> NaCl + H2O}", note: tx("The $\\ce{Na+}$ and $\\ce{Cl-}$ ions just stay in the solution. When the water evaporates, **sodium chloride** remains: table salt.", "Die $\\ce{Na+}$- und $\\ce{Cl-}$-Ionen bleiben einfach in der Lösung. Dampft man das Wasser ein, bleibt **Natriumchlorid** übrig: Kochsalz.") },
        { math: tx('"acid" + "alkali" -> "salt" + "water"', '"Säure" + "Lauge" -> "Salz" + "Wasser"'), note: tx("That's the general pattern. Salt name = metal of the base + anion of the acid.", "Das ist das allgemeine Muster. Salzname = Metall der Base + Säurerest-Ion.") },
        { math: coefSrc("H2SO4 + NaOH -> Na2SO4 + H2O", [1, 1, 1, 1]), note: tx("Sulfuric acid and sodium hydroxide give **sodium sulfate**. But the equation isn't balanced yet.", "Schwefelsäure und Natriumhydroxid ergeben **Natriumsulfat**. Aber die Gleichung ist noch nicht ausgeglichen.") },
        { math: coefSrc("H2SO4 + NaOH -> Na2SO4 + H2O", [1, 2, 1, 2]), note: tx("Sulfuric acid brings **two** protons, so it needs **two** $\\ce{OH-}$: two NaOH. Two $\\ce{H+}$ meet two $\\ce{OH-}$: two water molecules.", "Schwefelsäure bringt **zwei** Protonen mit, braucht also **zwei** $\\ce{OH-}$: zwei NaOH. Zwei $\\ce{H+}$ treffen auf zwei $\\ce{OH-}$: zwei Wassermoleküle.") },
      ],
    },
    {
      type: "widget",
      title: tx("Neutralise it, drop by drop", "Neutralisiere Tropfen für Tropfen"),
      blob: tx("Careful: one drop too many and it tips over to alkaline!", "Vorsicht: Ein Tropfen zu viel und es kippt ins Alkalische!"),
      body: tx(
        "Add sodium hydroxide solution to hydrochloric acid. Bromothymol blue shows you when it's exactly neutral.",
        "Gib Natronlauge zu Salzsäure. Bromthymolblau zeigt dir, wann die Lösung genau neutral ist.",
      ),
      widget: AcidsBasesNeutralise,
    },
    {
      type: "check",
      blob: tx("Last one! Calcium hydroxide brings two OH⁻.", "Die letzte! Calciumhydroxid bringt zwei OH⁻ mit."),
      exercise: {
        instruction: tx("Balance the neutralisation", "Gleiche die Neutralisation aus"),
        text: tx("Hydrochloric acid is neutralised with calcium hydroxide. Fill in the coefficients.", "Salzsäure wird mit Calciumhydroxid neutralisiert. Ergänze die Koeffizienten."),
        answer: { kind: "balance", equation: lessonCheckBalance.equation, coefficients: lessonCheckBalance.coefficients },
        mistakes: neutralMistakes(lessonCheckBalance.equation, lessonCheckBalance.coefficients, acid("HCl"), base("Ca(OH)2")),
        hint: tx("Start with the salt $\\ce{CaCl2}$: how many HCl does it need? Then count the water.", "Fang beim Salz $\\ce{CaCl2}$ an: Wie viele HCl braucht es? Dann zählst du das Wasser."),
        solution: neutralFrames(lessonCheckBalance.equation, lessonCheckBalance.coefficients, acid("HCl"), base("Ca(OH)2")),
      },
    },
  ],
  generate,
};

export default acidsBases;
