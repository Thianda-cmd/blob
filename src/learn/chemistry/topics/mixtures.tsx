"use client";

import type { ComponentType } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { topicMeta } from "@/learn/catalog";
import { check, type AnswerValue } from "@/learn/engine/answers";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Mistake, SingleLessonTopic as Topic } from "@/learn/types";
import { decText } from "@/learn/chemistry/format";
import { CASES, EXAMPLES, LOOKALIKES, METHODS, MIX_TYPES, PROPS, PURE, type Case, type Method, type MixType, type Prop } from "@/learn/chemistry/mixtures-data";
import { STEPS, namesOf, run, scenario, whyNot, type Scenario, type Step } from "@/learn/chemistry/mixtures-lab";
import { MixturesChroma, ChromaStrip } from "@/learn/chemistry/visuals/MixturesChroma";
import { MixturesLab } from "@/learn/chemistry/visuals/MixturesLab";
import { MixturesPicture, MixturesTypes } from "@/learn/chemistry/visuals/MixturesTypes";

// ---------------------------------------------------------------------------
// Small helpers

function visual<P extends object>(component: ComponentType<P>, props: P) {
  return { component: component as unknown as ComponentType<Record<string, unknown>>, props: props as Record<string, unknown> };
}

const en = (t: Text) => resolveText(t, "en");
const de = (t: Text) => resolveText(t, "de");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "a suspension", "an emulsion" */
const aEn = (w: string) => `${/^[aeiou]/i.test(w) ? "an" : "a"} ${w}`;

function asAnswer(a: AnswerSpec): AnswerValue | null {
  switch (a.kind) {
    case "number":
      return { kind: "text", text: String(a.value) };
    case "choice":
      return { kind: "choice", index: a.correct };
    case "multi":
      return { kind: "multi", indices: a.correct };
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
/** Options with the right one first; shuffled when an rng is given. Wrong options with a `say` become mistakes. */
function choice(rng: Rng | null, opts: Opt[]) {
  const order = rng ? rng.shuffle(opts.map((_, i) => i)) : opts.map((_, i) => i);
  const options = order.map((i) => opts[i].text);
  const correct = order.indexOf(0);
  const list: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (i !== 0 && o.say) list.push({ when: { kind: "choice", options, correct: at }, title: o.title, say: o.say });
  });
  return { answer: { kind: "choice", options, correct } as AnswerSpec, mistakes: list };
}

/** A quoted word for display-language frames: `"Salzwasser"#k`. */
const q = (t: Text, k: string): Text => tx(`"${en(t)}"#${k}`, `"${de(t)}"#${k}`);
/** Join display-language pieces (each may be bilingual). */
const join = (...parts: Text[]): Text => tx(parts.map(en).join(" "), parts.map(de).join(" "));

// ---------------------------------------------------------------------------
// Pure substance or mixture?

const PURE_OR_MIX: Text[] = [tx("Pure substance", "Reinstoff"), tx("Mixture", "Stoffgemisch")];
/** English starts with a capital letter in answer options. */
const capT = (t: Text): Text => tx(cap(en(t)), de(t));

function pureTask(rng: Rng): Exercise {
  const roll = rng.int(0, 2);
  let name: Text;
  let pure: boolean;
  let why: Text;
  if (roll === 0) {
    name = rng.pick(PURE);
    pure = true;
    why = tx(`${cap(en(name))} consists of one kind of particle only. That's why it has a fixed melting and boiling temperature.`, `${cap(de(name))} besteht nur aus einer Teilchensorte. Deshalb hat dieser Stoff eine feste Schmelz- und Siedetemperatur.`);
  } else if (roll === 1) {
    const l = rng.pick(LOOKALIKES);
    name = l.name;
    pure = false;
    why = l.why;
  } else {
    const e = rng.pick(EXAMPLES.filter((x) => x.type !== "gasmix"));
    name = e.name;
    pure = false;
    why = tx(`${cap(en(e.name))} is ${aEn(en(MIX_TYPES[e.type].name))}: several substances mixed together.`, `${cap(de(e.name))} ist ein Gemisch (${de(MIX_TYPES[e.type].name)}), also mehrere Stoffe zusammen.`);
  }
  const answer: AnswerSpec = { kind: "choice", options: PURE_OR_MIX, correct: pure ? 0 : 1 };
  const m = mistakes(answer);
  if (pure) {
    m.add(
      { kind: "choice", options: PURE_OR_MIX, correct: 1 },
      tx("One kind of particle", "Eine Teilchensorte"),
      tx(
        `${cap(en(name))} is made of just one kind of particle. A test: it melts and boils at fixed temperatures, which mixtures don't.`,
        `${cap(de(name))} besteht nur aus einer Teilchensorte. Ein Test: Ein Reinstoff schmilzt und siedet bei festen Temperaturen, ein Gemisch nicht.`,
      ),
    );
  } else {
    m.add(
      { kind: "choice", options: PURE_OR_MIX, correct: 0 },
      roll === 1 ? tx("Looks can deceive", "Der Schein trügt") : tx("More than one substance", "Mehr als ein Stoff"),
      roll === 1 ? why : tx(`Think about what ${en(name)} is made of. More than one substance means a mixture.`, `Überleg, woraus ${de(name)} besteht. Mehr als ein Stoff heißt: Gemisch.`),
    );
  }
  return {
    instruction: tx("Pure substance or mixture?", "Reinstoff oder Stoffgemisch?"),
    text: tx(`Is **${en(name)}** a pure substance or a mixture?`, `Ist **${de(name)}** ein Reinstoff oder ein Stoffgemisch?`),
    answer,
    hint: tx("A pure substance has only one kind of particle. A mixture contains at least two substances, even if it looks uniform.", "Ein Reinstoff hat nur eine Teilchensorte. Ein Gemisch enthält mindestens zwei Stoffe, auch wenn es einheitlich aussieht."),
    solution: [
      { math: q(name, "n"), note: why },
      { math: join(q(name, "n"), "\\Rightarrow#r", q(PURE_OR_MIX[pure ? 0 : 1], "a")), note: pure ? tx("So it's a **pure substance**.", "Also ist es ein **Reinstoff**.") : tx("So it's a **mixture**.", "Also ist es ein **Stoffgemisch**."), highlight: ["a"] },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Homogeneous or heterogeneous?

const HOM_HET: Text[] = [tx("homogeneous", "homogen"), tx("heterogeneous", "heterogen")];

function homTask(rng: Rng, picture: boolean): Exercise {
  const e = rng.pick(EXAMPLES);
  const hom = MIX_TYPES[e.type].homogeneous;
  const answer: AnswerSpec = { kind: "choice", options: HOM_HET, correct: hom ? 0 : 1 };
  const m = mistakes(answer);
  const looksUniform = ["emulsion", "foam"].includes(e.type) || en(e.name) === "blood";
  if (hom) {
    m.add(
      { kind: "choice", options: HOM_HET, correct: 1 },
      tx("Spread down to the particles", "Bis in die Teilchen verteilt"),
      tx(`${cap(en(e.name))}: the parts are mixed down to single particles. Even a microscope shows nothing separate. That's homogeneous.`, `${cap(de(e.name))}: Die Bestandteile sind bis in einzelne Teilchen vermischt. Selbst das Mikroskop zeigt nichts Getrenntes. Das ist homogen.`),
    );
  } else {
    m.add(
      { kind: "choice", options: HOM_HET, correct: 0 },
      looksUniform ? tx("Use a microscope", "Nimm ein Mikroskop") : tx("You can see the parts", "Die Teile sind erkennbar"),
      looksUniform
        ? tx(`${cap(en(e.name))} looks uniform at first glance. But under a microscope you can see separate droplets, bubbles or cells: heterogeneous.`, `${cap(de(e.name))} sieht auf den ersten Blick einheitlich aus. Unter dem Mikroskop siehst du aber einzelne Tröpfchen, Bläschen oder Zellen: heterogen.`)
        : tx(`${cap(en(e.name))}: you can see the different parts, at least with a magnifier or microscope. That's heterogeneous.`, `${cap(de(e.name))}: Die verschiedenen Bestandteile sind erkennbar, zumindest mit Lupe oder Mikroskop. Das ist heterogen.`),
    );
  }
  const T = MIX_TYPES[e.type];
  return {
    instruction: tx("Homogeneous or heterogeneous?", "Homogen oder heterogen?"),
    text: tx(`Is **${en(e.name)}** a homogeneous or a heterogeneous mixture?`, `Ist **${de(e.name)}** ein homogenes oder ein heterogenes Gemisch?`),
    ...(picture ? { visual: visual(MixturesPicture, { type: e.type }) } : {}),
    answer,
    hint: tx("Homogeneous: looks the same everywhere, even under a microscope. Heterogeneous: you can see the parts, at least with a microscope.", "Homogen: überall gleich, selbst unter dem Mikroskop. Heterogen: Die Bestandteile sind erkennbar, zumindest mit dem Mikroskop."),
    solution: [
      { math: join(q(e.name, "n"), "=", q(T.name, "t")), note: tx(`${cap(en(e.name))} is ${aEn(en(T.name))}. ${en(T.what)}`, `${cap(de(e.name))}: ${de(T.name)}. ${de(T.what)}`) },
      { math: join(q(T.name, "t"), "\\Rightarrow#r", q(HOM_HET[hom ? 0 : 1], "h")), note: hom ? tx("Evenly mixed down to the particles: **homogeneous**.", "Bis in die Teilchen gleichmäßig gemischt: **homogen**.") : tx("The parts can be told apart: **heterogeneous**.", "Die Bestandteile lassen sich unterscheiden: **heterogen**."), highlight: ["h"] },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Which kind of mixture?

const CONFUSE: Record<MixType, MixType[]> = {
  solution: ["suspension", "emulsion", "alloy", "gasmix"],
  suspension: ["solution", "emulsion", "smoke", "solidmix"],
  emulsion: ["suspension", "solution", "foam", "fog"],
  alloy: ["solidmix", "solution", "suspension"],
  solidmix: ["alloy", "suspension", "smoke"],
  smoke: ["fog", "suspension", "gasmix"],
  fog: ["smoke", "emulsion", "foam"],
  foam: ["emulsion", "fog", "suspension"],
  gasmix: ["solution", "fog", "smoke"],
};

/** Blob's note when `picked` was chosen for an example of kind `right`. */
function typeSay(right: MixType, picked: MixType, ex: Text): [Text, Text] {
  const P = MIX_TYPES[picked];
  const special: Partial<Record<string, [Text, Text]>> = {
    "emulsion>suspension": [tx("Liquid droplets", "Flüssige Tröpfchen"), tx(`Close! But in ${en(ex)} the tiny bits are **liquid** droplets, not solid particles.`, `Knapp! Aber in ${de(ex)} sind die winzigen Teilchen **flüssige** Tröpfchen, keine festen Körnchen.`)],
    "emulsion>solution": [tx("Look closer", "Schau genauer hin"), tx("It looks uniform, but under a microscope you see tiny droplets. A solution would look uniform even there.", "Es sieht einheitlich aus, aber unter dem Mikroskop siehst du winzige Tröpfchen. Eine Lösung wäre auch dort einheitlich.")],
    "suspension>solution": [tx("Not dissolved", "Nicht gelöst"), tx("The solid doesn't dissolve: it floats around and settles if you leave it standing. A solution would stay clear.", "Der Feststoff löst sich nicht: Er schwebt herum und setzt sich ab, wenn man es stehen lässt. Eine Lösung bliebe klar.")],
    "suspension>emulsion": [tx("Solid bits", "Feste Körnchen"), tx("An emulsion is liquid in liquid. Here **solid** particles float in a liquid.", "Eine Emulsion ist flüssig in flüssig. Hier schweben **feste** Teilchen in einer Flüssigkeit.")],
    "solution>suspension": [tx("Nothing settles", "Nichts setzt sich ab"), tx("It stays clear and nothing settles, however long you wait: the substance is dissolved.", "Es bleibt klar und nichts setzt sich ab, egal wie lange du wartest: Der Stoff ist gelöst.")],
    "solution>emulsion": [tx("Evenly mixed", "Gleichmäßig gemischt"), tx("No droplets, not even under a microscope: it's mixed down to single particles.", "Keine Tröpfchen, nicht mal unter dem Mikroskop: Es ist bis in einzelne Teilchen gemischt.")],
    "smoke>fog": [tx("Solid, not liquid", "Fest, nicht flüssig"), tx("Fog is made of liquid droplets. Here **solid** particles (soot or dust) float in the air.", "Nebel besteht aus flüssigen Tröpfchen. Hier schweben **feste** Teilchen (Ruß oder Staub) in der Luft.")],
    "fog>smoke": [tx("Liquid, not solid", "Flüssig, nicht fest"), tx("Smoke has solid particles. Here tiny **liquid** droplets float in the air.", "Rauch hat feste Teilchen. Hier schweben winzige **flüssige** Tröpfchen in der Luft.")],
    "foam>emulsion": [tx("Gas bubbles", "Gasbläschen"), tx("An emulsion is liquid in liquid. Here **gas** bubbles are trapped.", "Eine Emulsion ist flüssig in flüssig. Hier sind **Gas**bläschen eingeschlossen.")],
    "alloy>solidmix": [tx("Melted together", "Zusammengeschmolzen"), tx("In a mixture of solids the grains lie side by side. In an alloy the metals were melted together and are evenly mixed.", "In einem Gemenge liegen Körner nebeneinander. In einer Legierung sind die Metalle zusammengeschmolzen und gleichmäßig gemischt.")],
    "solidmix>alloy": [tx("Grains side by side", "Körner nebeneinander"), tx("An alloy is metals melted together. Here grains of different solids lie side by side.", "Eine Legierung sind zusammengeschmolzene Metalle. Hier liegen Körner verschiedener Feststoffe nebeneinander.")],
    "gasmix>solution": [tx("No liquid here", "Keine Flüssigkeit"), tx("A solution needs a liquid. Here only gases are mixed.", "Eine Lösung braucht eine Flüssigkeit. Hier sind nur Gase gemischt.")],
  };
  return (
    special[`${right}>${picked}`] ?? [
      tx(`That's ${en(P.parts)}`, `Das ist ${de(P.parts)}`),
      tx(`**${cap(en(P.name))}** means ${en(P.parts)}. Is that what ${en(ex)} is?`, `**${de(P.name)}** heißt: ${de(P.parts)}. Passt das zu ${de(ex)}?`),
    ]
  );
}

function typeChoiceTask(rng: Rng, ex?: { name: Text; type: MixType }): Exercise {
  const e = ex ?? rng.pick(EXAMPLES);
  const wrong = CONFUSE[e.type].slice(0, 3);
  const opts: Opt[] = [{ text: MIX_TYPES[e.type].name }, ...wrong.map((w) => {
    const [title, say] = typeSay(e.type, w, e.name);
    return { text: MIX_TYPES[w].name, title, say };
  })];
  const { answer, mistakes: list } = choice(rng, opts);
  const T = MIX_TYPES[e.type];
  return {
    instruction: tx("Kind of mixture", "Art des Gemischs"),
    text: tx(`What kind of mixture is **${en(e.name)}**?`, `Was für ein Gemisch ist **${de(e.name)}**?`),
    answer,
    hint: tx("What state is the substance that is spread out, and what is it spread in?", "In welchem Aggregatzustand ist der verteilte Stoff, und worin ist er verteilt?"),
    solution: [
      { math: join(q(e.name, "n"), "\\to", q(T.parts, "p")), note: tx(`${cap(en(e.name))}: ${en(T.parts)}.`, `${cap(de(e.name))}: ${de(T.parts)}.`) },
      { math: join(q(T.parts, "p"), "\\Rightarrow#r", q(T.name, "t")), note: tx(`${cap(en(T.parts))}: this kind of mixture is called **${en(T.name)}**.`, `${cap(de(T.parts))}: Diese Gemischart heißt **${de(T.name)}**.`), highlight: ["t"] },
    ],
    mistakes: list,
  };
}

const WORD_TYPES: MixType[] = ["solution", "suspension", "emulsion", "alloy", "smoke", "fog", "foam"];
const TYPE_ACCEPT: Partial<Record<MixType, Text[]>> = {
  solution: [tx("solution", "Lösung")],
  suspension: [tx("suspension", "Suspension")],
  emulsion: [tx("emulsion", "Emulsion")],
  alloy: [tx("alloy", "Legierung")],
  smoke: [tx("smoke", "Rauch")],
  fog: [tx("fog", "Nebel"), "mist"],
  foam: [tx("foam", "Schaum")],
  gasmix: [tx("gas mixture", "Gasgemisch")],
};

function typeWordTask(type: MixType): Exercise {
  const T = MIX_TYPES[type];
  const answer: AnswerSpec = { kind: "word", accept: TYPE_ACCEPT[type]!, placeholder: tx("kind of mixture", "Art des Gemischs") };
  const m = mistakes(answer);
  for (const w of CONFUSE[type]) {
    const acc = TYPE_ACCEPT[w];
    if (!acc) continue;
    const [title, say] = typeSay(type, w, tx("this mixture", "diesem Gemisch"));
    m.add({ kind: "word", accept: acc }, title, say);
  }
  const ex = EXAMPLES.filter((e) => e.type === type).slice(0, 2);
  return {
    instruction: tx("Name the kind of mixture", "Benenne die Art des Gemischs"),
    text: tx(`${en(T.what)} Examples: ${ex.map((e) => en(e.name)).join(", ")}. What is this kind of mixture called?`, `${de(T.what)} Beispiele: ${ex.map((e) => de(e.name)).join(", ")}. Wie heißt diese Art von Gemisch?`),
    visual: visual(MixturesPicture, { type }),
    answer,
    hint: tx(`It's ${en(T.parts)}.`, `Es ist ${de(T.parts)}.`),
    solution: [
      { math: q(T.parts, "p"), note: tx(`The particle picture shows ${en(T.parts)}.`, `Das Teilchenbild zeigt: ${de(T.parts)}.`) },
      { math: join(q(T.parts, "p"), "\\Rightarrow#r", q(T.name, "t")), note: tx(`It's called **${en(T.name)}**.`, `Das heißt **${de(T.name)}**.`), highlight: ["t"] },
    ],
    mistakes: m.list.slice(0, 4),
  };
}

// ---------------------------------------------------------------------------
// Separation methods

function caseChoiceTask(rng: Rng, c: Case): Exercise {
  const all = Object.entries(c.traps) as [Method, Text][];
  const traps = [all[0], ...rng.shuffle(all.slice(1))].slice(0, 3);
  const opts: Opt[] = [{ text: tx(cap(en(METHODS[c.method].name)), de(METHODS[c.method].name)) }];
  for (const [m, say] of traps) opts.push({ text: tx(cap(en(METHODS[m].name)), de(METHODS[m].name)), title: tx("Doesn't work here", "Klappt hier nicht"), say });
  const { answer, mistakes: list } = choice(rng, opts);
  const M = METHODS[c.method];
  return {
    instruction: tx("Choose a separation method", "Wähle ein Trennverfahren"),
    text: tx(`Which method fits? **${en(c.task)}**`, `Welches Verfahren passt? **${de(c.task)}**`),
    answer,
    hint: tx("What is different about the substances: size, density, boiling temperature, solubility, magnetism?", "Worin unterscheiden sich die Stoffe: Teilchengröße, Dichte, Siedetemperatur, Löslichkeit, Magnetisierbarkeit?"),
    solution: [
      { math: join(q(tx("difference:", "Unterschied:"), "u"), q(PROPS[M.prop], "p")), note: tx(`The substances differ in their ${en(PROPS[M.prop])}.`, `Die Stoffe unterscheiden sich in ihrer ${de(PROPS[M.prop])}.`) },
      { math: join(q(PROPS[M.prop], "p"), "\\Rightarrow#r", q(M.name, "m")), note: tx(`So: **${en(M.name)}**. ${en(M.how)}`, `Also: **${de(M.name)}**. ${de(M.how)}`), highlight: ["m"] },
    ],
    mistakes: list,
  };
}

function caseWordTask(c: Case): Exercise {
  const M = METHODS[c.method];
  const answer: AnswerSpec = { kind: "word", accept: [...M.accept, ...(c.also ?? []).flatMap((a) => METHODS[a].accept)], placeholder: tx("separation method", "Trennverfahren") };
  const m = mistakes(answer);
  for (const [w, say] of Object.entries(c.traps) as [Method, Text][]) m.add({ kind: "word", accept: METHODS[w].accept }, tx("Doesn't work here", "Klappt hier nicht"), say);
  return {
    instruction: tx("Name the separation method", "Nenne das Trennverfahren"),
    text: tx(`Which separation method do you use? **${en(c.task)}**`, `Welches Trennverfahren verwendest du? **${de(c.task)}**`),
    answer,
    hint: tx(`Look for the difference: ${en(PROPS[M.prop])}.`, `Such den Unterschied: ${de(PROPS[M.prop])}.`),
    solution: [
      { math: join(q(tx("difference:", "Unterschied:"), "u"), q(PROPS[M.prop], "p")), note: tx(`The substances differ in their ${en(PROPS[M.prop])}.`, `Die Stoffe unterscheiden sich in ihrer ${de(PROPS[M.prop])}.`) },
      { math: join(q(PROPS[M.prop], "p"), "\\Rightarrow#r", q(M.name, "m")), note: tx(`So: **${en(M.name)}**. ${en(M.how)}`, `Also: **${de(M.name)}**. ${de(M.how)}`), highlight: ["m"] },
    ],
    mistakes: m.list.slice(0, 4),
  };
}

/** "sieving and filtering", "settling and decanting as well as centrifuging" */
function listOf(ms: Method[], l: "en" | "de") {
  const names = ms.map((m) => resolveText(METHODS[m].name, l));
  const and = l === "en" ? " as well as " : " sowie ";
  return names.length <= 1 ? names.join("") : names.some((n) => / and | und /.test(n)) ? `${names.slice(0, -1).join(", ")}${and}${names[names.length - 1]}` : `${names.slice(0, -1).join(", ")} ${l === "en" ? "and" : "und"} ${names[names.length - 1]}`;
}

/** Which methods use a property (for Blob's notes). */
const usersOf = (p: Prop) => (Object.keys(METHODS) as Method[]).filter((m) => METHODS[m].prop === p);

function propertyTask(rng: Rng, method: Method): Exercise {
  const M = METHODS[method];
  const pool = (Object.keys(PROPS) as Prop[]).filter((p) => p !== M.prop && !(method === "chroma" && p === "solubility"));
  const wrong = rng.shuffle(pool).slice(0, 3);
  const special: Partial<Record<string, Text>> = {
    "filter>density": tx("A filter doesn't care how heavy the particles are. Its tiny pores hold back what's too **big**.", "Einem Filter ist egal, wie schwer die Teilchen sind. Seine winzigen Poren halten zurück, was zu **groß** ist."),
    "sieve>density": tx("A sieve only lets through what fits through the holes. Heavy or light doesn't matter.", "Ein Sieb lässt nur durch, was durch die Löcher passt. Schwer oder leicht ist egal."),
    "centrifuge>size": tx("Spinning pushes the **denser** parts outwards, like fast settling. It's not about size.", "Schleudern drückt die Teile mit größerer **Dichte** nach außen, wie schnelles Absetzen. Es geht nicht um die Größe."),
    "sediment>size": tx("Settling works because the solid is denser than the liquid: it sinks. That's density, not size.", "Absetzen klappt, weil der Feststoff eine größere Dichte hat als die Flüssigkeit: Er sinkt. Das ist Dichte, nicht Größe."),
    "evaporate>solubility": tx("The salt is dissolved, right. But evaporating works because water boils at a far lower temperature than salt.", "Das Salz ist gelöst, stimmt. Eindampfen klappt aber, weil Wasser bei viel niedrigerer Temperatur siedet als Salz."),
    "distil>solubility": tx("Distilling heats the mixture: the substance with the lower boiling temperature boils off first.", "Beim Destillieren wird erhitzt: Der Stoff mit der niedrigeren Siedetemperatur siedet zuerst."),
    "extract>boiling": tx("In extraction nothing is boiled off. A solvent dissolves one substance out, because it dissolves well in it.", "Beim Extrahieren wird nichts abgedampft. Ein Lösungsmittel löst einen Stoff heraus, weil er sich gut darin löst."),
    "magnet>density": tx("Iron isn't pulled out because it's heavy. A magnet only attracts magnetic metals like iron.", "Eisen wird nicht herausgezogen, weil es schwer ist. Ein Magnet zieht nur magnetische Metalle wie Eisen an."),
    "chroma>size": tx("The dyes are all dissolved and tiny. They travel differently far because they stick differently strongly to the paper.", "Die Farbstoffe sind alle gelöst und winzig. Sie wandern verschieden weit, weil sie unterschiedlich stark am Papier haften."),
  };
  const opts: Opt[] = [{ text: capT(PROPS[M.prop]) }];
  for (const w of wrong) {
    const users = usersOf(w);
    opts.push({
      text: capT(PROPS[w]),
      title: tx("Another property", "Eine andere Eigenschaft"),
      say:
        special[`${method}>${w}`] ??
        tx(`${cap(listOf(users, "en"))} use${users.length === 1 ? "s" : ""} ${en(PROPS[w])}. How does ${en(M.name)} work?`, `${listOf(users, "de")} ${users.length === 1 ? "nutzt" : "nutzen"} die ${de(PROPS[w])}. Wie funktioniert ${de(M.name)}?`),
    });
  }
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Which property?", "Welche Eigenschaft?"),
    text: tx(`Which property of the substances does **${en(M.name)}** use?`, `Welche Stoffeigenschaft nutzt man ${method === "chroma" ? "bei der" : "beim"} **${de(M.name)}**?`),
    answer,
    hint: tx("Picture what happens during this method. Why do the substances end up in different places?", "Stell dir vor, was bei diesem Verfahren passiert. Warum landen die Stoffe an verschiedenen Stellen?"),
    solution: [
      { math: q(M.name, "m"), note: M.how },
      { math: join(q(M.name, "m"), "\\to", q(PROPS[M.prop], "p")), note: tx(`So it uses differences in **${en(PROPS[M.prop])}**.`, `Es nutzt also Unterschiede in der **${de(PROPS[M.prop])}**.`), highlight: ["p"] },
    ],
    mistakes: list,
  };
}

/** A real case: which property does it use? */
function casePropertyTask(rng: Rng, c: Case): Exercise {
  const M = METHODS[c.method];
  const wrong = rng.shuffle((Object.keys(PROPS) as Prop[]).filter((p) => p !== M.prop && !(c.also ?? []).some((a) => METHODS[a].prop === p))).slice(0, 3);
  const { answer, mistakes: list } = choice(rng, [
    { text: capT(PROPS[M.prop]) },
    ...wrong.map((w) => ({
      text: capT(PROPS[w]),
      title: tx("Another property", "Eine andere Eigenschaft"),
      say: tx(
        `${cap(listOf(usersOf(w), "en"))} use${usersOf(w).length === 1 ? "s" : ""} ${en(PROPS[w])}. Which method is behind this case, and what makes the substances go separate ways there?`,
        `${listOf(usersOf(w), "de")} ${usersOf(w).length === 1 ? "nutzt" : "nutzen"} die ${de(PROPS[w])}. Welches Verfahren steckt hinter diesem Fall, und was bringt die Stoffe dort auseinander?`,
      ),
    })),
  ]);
  return {
    instruction: tx("Which property?", "Welche Eigenschaft?"),
    text: tx(`**${en(c.task)}** Which property of the substances does this use?`, `**${de(c.task)}** Welche Stoffeigenschaft nutzt man dabei?`),
    answer,
    hint: tx("First think about which separation method this is.", "Überleg zuerst, welches Trennverfahren das ist."),
    solution: [
      { math: q(M.name, "m"), note: tx(`This is **${en(M.name)}**. ${en(M.how)}`, `Das ist **${de(M.name)}**. ${de(M.how)}`) },
      { math: join(q(M.name, "m"), "\\to", q(PROPS[M.prop], "p")), note: tx(`It uses differences in **${en(PROPS[M.prop])}**.`, `Es nutzt Unterschiede in der **${de(PROPS[M.prop])}**.`), highlight: ["p"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Several steps: salt, sand and iron and friends

const ORDER_SCENARIOS = ["salt-sand-iron", "gravel-sand-salt", "sugar-sand"];
const BEST: Record<string, Step[]> = {
  "salt-sand-iron": ["magnet", "dissolve", "filter", "evaporate"],
  "gravel-sand-salt": ["sieve", "dissolve", "filter", "evaporate"],
  "sugar-sand": ["dissolve", "filter", "evaporate"],
};

const seqText = (steps: Step[]): Text => tx(steps.map((s) => en(STEPS[s].name)).join(" → "), steps.map((s) => de(STEPS[s].name)).join(" → "));

function permutations<T>(list: T[]): T[][] {
  if (list.length <= 1) return [list];
  return list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((p) => [x, ...p]));
}

function stepFrames(sc: Scenario, steps: Step[]): Frame[] {
  const r = run(sc.start, steps);
  return steps.map((s, i) => ({
    math: tx(steps.slice(0, i + 1).map((x, j) => `"${en(STEPS[x].name)}"#s${j}`).join(" \\to "), steps.slice(0, i + 1).map((x, j) => `"${de(STEPS[x].name)}"#s${j}`).join(" \\to ")),
    note: r.log[i].note,
    highlight: [`s${i}`],
  }));
}

function orderTask(rng: Rng, id = rng.pick(ORDER_SCENARIOS)): Exercise {
  const sc = scenario(id);
  const best = BEST[id];
  const failing = rng.shuffle(permutations(best)).filter((p) => whyNot(sc, p));
  const opts: Opt[] = [{ text: seqText(best) }];
  for (const p of failing.slice(0, 3)) opts.push({ text: seqText(p), title: tx("That order doesn't work", "Diese Reihenfolge klappt nicht"), say: whyNot(sc, p)! });
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Order the steps", "Bring die Schritte in die richtige Reihenfolge"),
    text: tx(`You want to separate a mixture of **${en(namesOf(sc.goal))}** so that you get each substance on its own. Which order works?`, `Du willst ein Gemisch aus **${de(namesOf(sc.goal))}** so trennen, dass du jeden Stoff einzeln erhältst. Welche Reihenfolge klappt?`),
    answer,
    hint: tx("Go through each order step by step: is there something for the step to do at that moment?", "Geh jede Reihenfolge Schritt für Schritt durch: Hat der Schritt in dem Moment überhaupt etwas zu tun?"),
    solution: stepFrames(sc, best),
    mistakes: list,
  };
}

function missingStepTask(rng: Rng): Exercise | null {
  const id = rng.pick(ORDER_SCENARIOS);
  const sc = scenario(id);
  const best = BEST[id];
  const gap = rng.int(0, best.length - 1);
  const right = best[gap];
  const tryWith = (s: Step) => [...best.slice(0, gap), s, ...best.slice(gap + 1)];
  const wrong = rng.shuffle(sc.tools.filter((s) => s !== right && whyNot(sc, tryWith(s)))).slice(0, 3);
  if (wrong.length < 3) return null;
  const shown = tx(best.map((s, i) => (i === gap ? "?" : en(STEPS[s].name))).join(" → "), best.map((s, i) => (i === gap ? "?" : de(STEPS[s].name))).join(" → "));
  const { answer, mistakes: list } = choice(rng, [
    { text: STEPS[right].name },
    ...wrong.map((w) => ({ text: STEPS[w].name, title: tx("Doesn't work there", "Klappt da nicht"), say: whyNot(sc, tryWith(w))! })),
  ]);
  return {
    instruction: tx("Find the missing step", "Finde den fehlenden Schritt"),
    text: tx(`To separate **${en(namesOf(sc.goal))}**, one step is missing: ${en(shown)}. Which one?`, `Um **${de(namesOf(sc.goal))}** zu trennen, fehlt ein Schritt: ${de(shown)}. Welcher?`),
    answer,
    hint: tx("What is in the beaker just before the gap, and what has to happen next?", "Was ist direkt vor der Lücke im Becherglas, und was muss als Nächstes passieren?"),
    solution: stepFrames(sc, best),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Filtering: residue and filtrate

const SOLIDS: Text[] = [tx("sand", "Sand"), tx("chalk", "Kreide")];
const SOLUTIONS: { name: Text; solute: Text }[] = [
  { name: tx("salt water", "Salzwasser"), solute: tx("salt", "Salz") },
  { name: tx("sugar water", "Zuckerwasser"), solute: tx("sugar", "Zucker") },
];

function filterTask(rng: Rng): Exercise {
  const solid = rng.pick(SOLIDS);
  const sol = rng.pick(SOLUTIONS);
  const askResidue = rng.chance(0.5);
  const both = tx(`${en(solid)} and ${en(sol.solute)}`, `${de(solid)} und ${de(sol.solute)}`);
  const optsResidue: Opt[] = [
    { text: tx(`The ${en(solid)}`, de(solid)) },
    { text: tx(`The ${en(sol.solute)}`, de(sol.solute)), title: tx("Dissolved passes through", "Gelöstes läuft durch"), say: tx(`The ${en(sol.solute)} is dissolved: its particles are far too small to be caught by the filter.`, `${de(sol.solute)} ist gelöst: Seine Teilchen sind viel zu klein, um vom Filter festgehalten zu werden.`) },
    { text: tx(`The ${en(both)}`, de(both)), title: tx("Only the undissolved part", "Nur das Ungelöste"), say: tx(`Only undissolved solids stay in the filter. The ${en(sol.solute)} runs through with the water.`, `Nur ungelöste Feststoffe bleiben im Filter. ${de(sol.solute)} läuft mit dem Wasser durch.`) },
    { text: tx(`The ${en(sol.name)}`, de(sol.name)), title: tx("That's the filtrate", "Das ist das Filtrat"), say: tx("That's what runs **through** the filter: the filtrate. The residue is what stays behind.", "Das läuft **durch** den Filter: das Filtrat. Der Rückstand ist das, was zurückbleibt.") },
  ];
  const optsFiltrate: Opt[] = [
    { text: tx(`The ${en(sol.name)}`, de(sol.name)) },
    { text: tx("Pure water", "reines Wasser"), title: tx("The dissolved part comes too", "Gelöstes kommt mit"), say: tx(`The ${en(sol.solute)} is dissolved, so it runs through the filter together with the water.`, `${de(sol.solute)} ist gelöst und läuft deshalb zusammen mit dem Wasser durch den Filter.`) },
    { text: tx(`The ${en(solid)}`, de(solid)), title: tx("That's the residue", "Das ist der Rückstand"), say: tx(`The ${en(solid)} stays **in** the filter: that's the residue. The filtrate is what runs through.`, `${de(solid)} bleibt **im** Filter: Das ist der Rückstand. Das Filtrat ist das, was durchläuft.`) },
    { text: tx(`Water with ${en(solid)}`, `${de(solid)}wasser`), title: tx("The filter holds it back", "Der Filter hält es zurück"), say: tx(`The ${en(solid)} doesn't dissolve, so it stays in the filter.`, `${de(solid)} löst sich nicht, deshalb bleibt ${de(solid)} im Filter hängen.`) },
  ];
  const { answer, mistakes: list } = choice(rng, askResidue ? optsResidue : optsFiltrate);
  return {
    instruction: tx("Filtering", "Filtrieren"),
    text: askResidue
      ? tx(`A mixture of ${en(solid)} and ${en(sol.name)} is filtered. What stays in the filter paper (the **residue**)?`, `Ein Gemisch aus ${de(solid)} und ${de(sol.name)} wird filtriert. Was bleibt im Filterpapier zurück (der **Rückstand**)?`)
      : tx(`A mixture of ${en(solid)} and ${en(sol.name)} is filtered. What runs through the filter (the **filtrate**)?`, `Ein Gemisch aus ${de(solid)} und ${de(sol.name)} wird filtriert. Was läuft durch den Filter (das **Filtrat**)?`),
    answer,
    hint: tx("A filter holds back undissolved solids. Dissolved particles are far too small for it.", "Ein Filter hält ungelöste Feststoffe zurück. Gelöste Teilchen sind viel zu klein für ihn."),
    solution: [
      { math: join(q(tx("residue:", "Rückstand:"), "a"), q(solid, "s")), note: tx(`The undissolved ${en(solid)} stays in the filter.`, `Der ungelöste Stoff (${de(solid)}) bleibt im Filter.`) },
      { math: join(q(tx("filtrate:", "Filtrat:"), "b"), q(sol.name, "f")), note: tx(`The dissolved ${en(sol.solute)} runs through with the water: the filtrate is still ${en(sol.name)}.`, `${de(sol.solute)} ist gelöst und läuft mit dem Wasser durch: Das Filtrat ist immer noch ${de(sol.name)}.`) },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Distillation: which substance comes first?

const LIQUIDS: { a: Text; ab: number; b: Text; bb: number }[] = [
  { a: tx("ethanol", "Ethanol"), ab: 78, b: tx("water", "Wasser"), bb: 100 },
  { a: tx("acetone", "Aceton"), ab: 56, b: tx("water", "Wasser"), bb: 100 },
  { a: tx("methanol", "Methanol"), ab: 65, b: tx("water", "Wasser"), bb: 100 },
  { a: tx("water", "Wasser"), ab: 100, b: tx("glycerol", "Glycerin"), bb: 290 },
];

function distilTask(rng: Rng): Exercise {
  const L = rng.pick(LIQUIDS);
  const flip = rng.chance(0.5);
  const [x, xb, y, yb] = flip ? [L.b, L.bb, L.a, L.ab] : [L.a, L.ab, L.b, L.bb];
  const { answer, mistakes: list } = choice(rng, [
    { text: tx(`${cap(en(L.a))} first`, `${de(L.a)} zuerst`) },
    {
      text: tx(`${cap(en(L.b))} first`, `${de(L.b)} zuerst`),
      title: tx("Lower boils first", "Niedriger siedet zuerst"),
      say: tx(`${cap(en(L.b))} boils at ${L.bb} °C. While heating, the temperature reaches the **lower** boiling temperature first.`, `${de(L.b)} siedet bei ${L.bb} °C. Beim Erhitzen wird zuerst die **niedrigere** Siedetemperatur erreicht.`),
    },
    {
      text: tx("Both at the same time", "Beide gleichzeitig"),
      title: tx("Different boiling temperatures", "Verschiedene Siedetemperaturen"),
      say: tx("Then distilling wouldn't separate anything! It works precisely because the two boil at different temperatures.", "Dann würde Destillieren gar nichts trennen! Es klappt gerade, weil die beiden bei verschiedenen Temperaturen sieden."),
    },
    {
      text: tx("Neither, they stay mixed", "Keiner, sie bleiben gemischt"),
      title: tx("Distilling does separate", "Destillieren trennt"),
      say: tx("Distilling separates liquids with different boiling temperatures. One of them boils off first.", "Destillieren trennt Flüssigkeiten mit verschiedenen Siedetemperaturen. Einer von beiden siedet zuerst."),
    },
  ]);
  return {
    instruction: tx("Distilling", "Destillieren"),
    text: tx(
      `A mixture of ${en(x)} (b.p. ${xb} °C) and ${en(y)} (b.p. ${yb} °C) is distilled. Which substance ends up in the distillate first?`,
      `Ein Gemisch aus ${de(x)} (Sdt. ${xb} °C) und ${de(y)} (Sdt. ${yb} °C) wird destilliert. Welcher Stoff landet zuerst im Destillat?`,
    ),
    answer,
    hint: tx("Which boiling temperature is reached first when you heat?", "Welche Siedetemperatur wird beim Erhitzen zuerst erreicht?"),
    solution: [
      { math: tx(`"${en(L.a)}"#a \\; ${L.ab}#ta "°C" < "${en(L.b)}"#b \\; ${L.bb}#tb "°C"`, `"${de(L.a)}"#a \\; ${L.ab}#ta "°C" < "${de(L.b)}"#b \\; ${L.bb}#tb "°C"`), note: tx("Compare the boiling temperatures.", "Vergleich die Siedetemperaturen.") },
      { math: tx(`"${en(L.a)}"#a \\to "distillate"#d`, `"${de(L.a)}"#a \\to "Destillat"#d`), note: tx(`${cap(en(L.a))} boils first, turns liquid again in the condenser and drips into the collecting flask.`, `${de(L.a)} siedet zuerst, wird im Kühler wieder flüssig und tropft in die Vorlage.`), highlight: ["a"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Chromatography: count the dyes

function chromaCountTask(rng: Rng): Exercise {
  const n = rng.int(2, 4);
  const seed = rng.int(1, 40);
  const answer: AnswerSpec = { kind: "number", value: n };
  const m = mistakes(answer);
  m.add({ kind: "number", value: n + 1 }, tx("The start line isn't a dye", "Die Startlinie ist kein Farbstoff"), tx("Did you count the start line or the solvent front too? Only the coloured spots are dyes.", "Hast du die Startlinie oder die Laufmittelfront mitgezählt? Nur die farbigen Flecken sind Farbstoffe."), true);
  m.add({ kind: "number", value: 1 }, tx("It was a mixture", "Es war ein Gemisch"), tx("The ink looked like one colour, but the paper pulled it apart into several spots. Count them!", "Die Tinte sah nach einer Farbe aus, aber das Papier hat sie in mehrere Flecken aufgetrennt. Zähl sie!"));
  return {
    instruction: tx("Read the chromatogram", "Lies das Chromatogramm"),
    text: tx("A dot of felt-tip ink was put on the start line. Here is the paper after the solvent has risen. How many dyes does the ink contain?", "Ein Punkt Filzstifttinte wurde auf die Startlinie gesetzt. So sieht das Papier aus, nachdem das Laufmittel aufgestiegen ist. Wie viele Farbstoffe enthält die Tinte?"),
    visual: visual(ChromaStrip, { n, seed }),
    answer,
    hint: tx("Each spot that travelled up is one dye.", "Jeder Fleck, der nach oben gewandert ist, ist ein Farbstoff."),
    solution: [
      { math: tx(`"spots:"#a \\; ${n}#n`, `"Flecken:"#a \\; ${n}#n`), note: tx(`Count the coloured spots: ${n}.`, `Zähl die farbigen Flecken: ${n}.`) },
      { math: tx(`${n}#n \\; "dyes"#b`, `${n}#n \\; "Farbstoffe"#b`), note: tx("Each dye sticks differently strongly to the paper, so each travels its own distance.", "Jeder Farbstoff haftet unterschiedlich stark am Papier und wandert deshalb unterschiedlich weit."), highlight: ["n"] },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Sea water: salt content

function seaSaltTask(rng: Rng): Exercise {
  const askPercent = rng.chance(0.5);
  if (askPercent) {
    const water = rng.pick([200, 400, 1000, 600]);
    const salt = (water * 35) / 1000;
    const answer: AnswerSpec = { kind: "number", value: 3.5, unit: "%" };
    const m = mistakes(answer);
    m.add({ kind: "number", value: 0.035 }, tx("Times 100 missing", "Mal 100 fehlt"), tx("That's the share as a decimal. As a percentage, multiply by 100.", "Das ist der Anteil als Dezimalzahl. In Prozent musst du noch mal 100 rechnen."), true);
    m.add({ kind: "number", value: water / salt, tolerance: 0.01 }, tx("Upside down", "Verkehrt herum"), tx("You divided the sea water by the salt. The share is part divided by whole: salt ÷ sea water.", "Du hast das Meerwasser durch das Salz geteilt. Der Anteil ist Teil durch Ganzes: Salz ÷ Meerwasser."));
    return {
      instruction: tx("Evaporating sea water", "Meerwasser eindampfen"),
      text: tx(
        `You evaporate ${water} g of sea water. ${en(decText(salt, 1))} g of salt are left in the dish. How many percent of the sea water was salt?`,
        `Du dampfst ${water} g Meerwasser ein. In der Schale bleiben ${de(decText(salt, 1))} g Salz zurück. Wie viel Prozent des Meerwassers waren Salz?`,
      ),
      answer,
      hint: tx("Share in percent = salt ÷ sea water · 100 %.", "Anteil in Prozent = Salz : Meerwasser · 100 %."),
      solution: [
        { math: tx(`\\frac{${en(decText(salt, 1))} "g"}{${water} "g"} \\cdot 100 "%"`, `\\frac{${de(decText(salt, 1))} "g"}{${water} "g"} \\cdot 100 "%"`), note: tx("Salt divided by sea water, times 100 %.", "Salz geteilt durch Meerwasser, mal 100 %.") },
        { math: tx(`= 3.5#r "%"`, `= 3,5#r "%"`), note: tx("About 3.5 % of sea water is dissolved salt.", "Etwa 3,5 % des Meerwassers sind gelöstes Salz."), highlight: ["r"] },
      ],
      mistakes: m.list,
    };
  }
  const kg = rng.pick([2, 4, 10, 20]);
  const value = kg * 35;
  const answer: AnswerSpec = { kind: "number", value, unit: "g" };
  const m = mistakes(answer);
  m.add({ kind: "number", value: kg * 3.5 }, tx("Kilograms and grams", "Kilogramm und Gramm"), tx(`Careful with the units: ${kg} kg are ${kg * 1000} g. Work it out in grams.`, `Achte auf die Einheiten: ${kg} kg sind ${kg * 1000} g. Rechne in Gramm.`), true);
  m.add({ kind: "number", value: kg * 1000 - value }, tx("That's the water", "Das ist das Wasser"), tx("That's how much water evaporates. The question asks for the salt that stays behind.", "So viel Wasser verdampft. Gefragt ist das Salz, das zurückbleibt."));
  m.add({ kind: "number", value: kg * 350 }, tx("Percent slipped", "Prozent verrutscht"), tx("3.5 % means 3.5 out of 100, so 35 g per kilogram. Check the decimal point.", "3,5 % heißt 3,5 von 100, also 35 g pro Kilogramm. Prüf das Komma."), true);
  return {
    instruction: tx("Evaporating sea water", "Meerwasser eindampfen"),
    text: tx(`Sea water contains about 3.5 % salt. How many grams of salt are left when you evaporate ${kg} kg of sea water?`, `Meerwasser enthält etwa 3,5 % Salz. Wie viel Gramm Salz bleiben zurück, wenn du ${kg} kg Meerwasser eindampfst?`),
    answer,
    hint: tx(`${kg} kg = ${kg * 1000} g. 3.5 % of that is salt.`, `${kg} kg = ${kg * 1000} g. Davon sind 3,5 % Salz.`),
    solution: [
      { math: tx(`${kg} "kg" = ${kg * 1000}#g "g"`, `${kg} "kg" = ${kg * 1000}#g "g"`), note: tx("First in grams.", "Erst in Gramm umrechnen.") },
      { math: tx(`${kg * 1000}#g "g" \\cdot 0.035 = ${value}#r "g"`, `${kg * 1000}#g "g" \\cdot 0,035 = ${value}#r "g"`), note: tx(`3.5 % = 0.035. So **${value} g** of salt are left.`, `3,5 % = 0,035. Es bleiben also **${value} g** Salz zurück.`), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Select all that apply

function homMultiTask(rng: Rng): Exercise | null {
  const homs = rng.shuffle(EXAMPLES.filter((e) => MIX_TYPES[e.type].homogeneous)).slice(0, rng.int(2, 3));
  const tricky = rng.shuffle(EXAMPLES.filter((e) => e.type === "emulsion" || e.type === "suspension")).slice(0, 2);
  const others = rng.shuffle(EXAMPLES.filter((e) => !MIX_TYPES[e.type].homogeneous && !tricky.includes(e))).slice(0, 6 - homs.length - tricky.length);
  const picked = rng.shuffle([...homs, ...tricky, ...others]);
  const options = picked.map((e) => e.name);
  const correct = picked.map((e, i) => (MIX_TYPES[e.type].homogeneous ? i : -1)).filter((i) => i >= 0);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  const set = (f: (t: MixType) => boolean) => picked.map((e, i) => (f(e.type) ? i : -1)).filter((i) => i >= 0);
  const uniformLiquid = set((t) => MIX_TYPES[t].homogeneous || t === "emulsion");
  if (uniformLiquid.length) m.add({ kind: "multi", options, correct: uniformLiquid }, tx("Emulsions only look uniform", "Emulsionen sehen nur einheitlich aus"), tx("You included an emulsion. It looks uniform, but under a microscope you see droplets: heterogeneous.", "Du hast eine Emulsion mitgenommen. Sie sieht einheitlich aus, aber unter dem Mikroskop siehst du Tröpfchen: heterogen."));
  const allLiquids = set((t) => MIX_TYPES[t].homogeneous || t === "emulsion" || t === "suspension");
  if (allLiquids.length) m.add({ kind: "multi", options, correct: allLiquids }, tx("Liquid isn't the same as homogeneous", "Flüssig heißt nicht homogen"), tx("Not every liquid mixture is homogeneous. Bits floating in it or droplets make it heterogeneous.", "Nicht jedes flüssige Gemisch ist homogen. Schwebende Körnchen oder Tröpfchen machen es heterogen."));
  const onlyLiquids = set((t) => t === "solution");
  if (onlyLiquids.length && onlyLiquids.length < correct.length) m.add({ kind: "multi", options, correct: onlyLiquids }, tx("Not only solutions", "Nicht nur Lösungen"), tx("Solutions are homogeneous, right. But alloys and gas mixtures like air are evenly mixed too.", "Lösungen sind homogen, stimmt. Aber auch Legierungen und Gasgemische wie Luft sind gleichmäßig gemischt."), true);
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx("Which of these mixtures are **homogeneous**?", "Welche dieser Gemische sind **homogen**?"),
    answer,
    hint: tx("Homogeneous means: no separate parts, not even under a microscope.", "Homogen heißt: keine getrennten Bestandteile, nicht mal unter dem Mikroskop."),
    solution: [
      { math: tx('"homogeneous:"#h \\; "solution, alloy, gas mixture"#k', '"homogen:"#h \\; "Lösung, Legierung, Gasgemisch"#k'), note: tx("Only these kinds are mixed down to the particles.", "Nur diese Gemischarten sind bis in die Teilchen gemischt.") },
      { math: tx(correct.map((i, j) => `"${en(options[i])}"#c${j}`).join(" , "), correct.map((i, j) => `"${de(options[i])}"#c${j}`).join(" , ")), note: tx("These are the homogeneous ones here.", "Diese sind hier homogen.") },
    ],
    mistakes: m.list,
  };
}

function filterMultiTask(rng: Rng): Exercise {
  const can = rng.shuffle(EXAMPLES.filter((e) => e.type === "suspension" && en(e.name) !== "blood")).slice(0, 2);
  const sol = rng.shuffle(EXAMPLES.filter((e) => e.type === "solution")).slice(0, 2);
  const emu = rng.shuffle(EXAMPLES.filter((e) => e.type === "emulsion")).slice(0, 1);
  const extra = rng.chance(0.5) ? [{ name: tx("water with gravel", "Wasser mit Kies"), type: "suspension" as MixType }] : [];
  const picked = rng.shuffle([...can, ...sol, ...emu, ...extra]);
  const options = picked.map((e) => e.name);
  const correct = picked.map((e, i) => (e.type === "suspension" ? i : -1)).filter((i) => i >= 0);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  const withSol = picked.map((e, i) => (e.type !== "emulsion" ? i : -1)).filter((i) => i >= 0);
  m.add({ kind: "multi", options, correct: withSol }, tx("Dissolved passes through", "Gelöstes läuft durch"), tx("You included a solution. Dissolved particles are far too small for a filter: they run straight through.", "Du hast eine Lösung mitgenommen. Gelöste Teilchen sind viel zu klein für einen Filter: Sie laufen einfach durch."));
  const allHet = picked.map((e, i) => (e.type !== "solution" ? i : -1)).filter((i) => i >= 0);
  m.add({ kind: "multi", options, correct: allHet }, tx("Droplets slip through", "Tröpfchen rutschen durch"), tx("Heterogeneous, yes, but an emulsion's droplets are liquid: they squeeze through a paper filter.", "Heterogen, stimmt, aber die Tröpfchen einer Emulsion sind flüssig: Sie quetschen sich durch einen Papierfilter."));
  m.add({ kind: "multi", options, correct: picked.map((_, i) => i) }, tx("Not everything", "Nicht alles"), tx("A filter only holds back **undissolved solid** particles. Check each mixture for that.", "Ein Filter hält nur **ungelöste feste** Teilchen zurück. Prüf jedes Gemisch darauf."));
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx("Which mixtures can you separate by **filtering**?", "Welche Gemische kannst du durch **Filtrieren** trennen?"),
    answer,
    hint: tx("A filter holds back undissolved solid particles: it works for suspensions.", "Ein Filter hält ungelöste feste Teilchen zurück: Das klappt bei Suspensionen."),
    solution: [
      { math: tx('"filter:"#f \\; "undissolved solids"#u', '"Filter:"#f \\; "ungelöste Feststoffe"#u'), note: tx("Only suspensions (solid in liquid, undissolved) can be filtered.", "Nur Suspensionen (fest in flüssig, ungelöst) lassen sich filtrieren.") },
      { math: tx(correct.map((i, j) => `"${en(options[i])}"#c${j}`).join(" , "), correct.map((i, j) => `"${de(options[i])}"#c${j}`).join(" , ")), note: tx("Solutions and emulsions run through the filter.", "Lösungen und Emulsionen laufen durch den Filter.") },
    ],
    mistakes: m.list,
  };
}

function pureMultiTask(rng: Rng): Exercise {
  const pures = rng.shuffle(PURE).slice(0, rng.int(2, 3));
  const looks = rng.shuffle(LOOKALIKES).slice(0, 5 - pures.length);
  const items = rng.shuffle([...pures.map((p) => ({ name: p, pure: true, why: null as Text | null })), ...looks.map((l) => ({ name: l.name, pure: false, why: l.why as Text | null }))]);
  const options = items.map((x) => x.name);
  const correct = items.map((x, i) => (x.pure ? i : -1)).filter((i) => i >= 0);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  items.forEach((x, i) => {
    if (!x.pure && x.why) m.add({ kind: "multi", options, correct: [...correct, i].sort((a, b) => a - b) }, tx("Looks can deceive", "Der Schein trügt"), x.why);
  });
  items.forEach((x, i) => {
    if (x.pure && correct.length > 1) m.add({ kind: "multi", options, correct: correct.filter((j) => j !== i) }, tx("One pure one missing", "Ein Reinstoff fehlt"), tx("Almost! One more is a pure substance. Ask yourself for each one: does it consist of only one kind of particle?", "Fast! Einer ist noch ein Reinstoff. Frag dich bei jedem: Besteht er aus nur einer Teilchensorte?"), true);
  });
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx("Which of these are **pure substances**?", "Welche davon sind **Reinstoffe**?"),
    answer,
    hint: tx("Careful: many mixtures look pure. A pure substance has one kind of particle and fixed melting and boiling temperatures.", "Vorsicht: Viele Gemische sehen rein aus. Ein Reinstoff hat eine Teilchensorte und feste Schmelz- und Siedetemperaturen."),
    solution: [
      { math: tx('"pure substance:"#r \\; "one kind of particle"#t', '"Reinstoff:"#r \\; "eine Teilchensorte"#t'), note: tx("Only one kind of particle, fixed melting and boiling temperatures.", "Nur eine Teilchensorte, feste Schmelz- und Siedetemperatur.") },
      { math: tx(correct.map((i, j) => `"${en(options[i])}"#c${j}`).join(" , "), correct.map((i, j) => `"${de(options[i])}"#c${j}`).join(" , ")), note: tx("These are the pure substances. The others only look pure.", "Das sind die Reinstoffe. Die anderen sehen nur rein aus.") },
    ],
    mistakes: m.list.slice(0, 5),
  };
}

/** Pure substance or mixture, from how it melts. */
function meltRangeTask(rng: Rng): Exercise {
  const item = rng.pick([
    { name: tx("candle wax (paraffin)", "Kerzenwachs (Paraffin)"), from: 52, to: 58, pure: false },
    { name: tx("chocolate", "Schokolade"), from: 30, to: 35, pure: false },
    { name: tx("butter", "Butter"), from: 28, to: 36, pure: false },
    { name: tx("a white powder", "ein weißes Pulver"), from: 801, to: 801, pure: true },
    { name: tx("a yellow powder", "ein gelbes Pulver"), from: 115, to: 115, pure: true },
  ]);
  const range = item.from !== item.to;
  const { answer, mistakes: list } = choice(rng, [
    { text: item.pure ? tx("A pure substance", "Ein Reinstoff") : tx("A mixture", "Ein Stoffgemisch") },
    item.pure
      ? { text: tx("A mixture", "Ein Stoffgemisch"), title: tx("Sharp melting temperature", "Scharfe Schmelztemperatur"), say: tx("It melts at exactly one temperature. That's the fingerprint of a pure substance: mixtures melt over a range.", "Es schmilzt bei genau einer Temperatur. Das ist der Fingerabdruck eines Reinstoffs: Gemische schmelzen in einem Bereich.") }
      : { text: tx("A pure substance", "Ein Reinstoff"), title: tx("Melting range", "Schmelzbereich"), say: tx("A pure substance melts at one exact temperature. Melting over a range of several degrees shows a mixture.", "Ein Reinstoff schmilzt bei einer genauen Temperatur. Schmelzen über mehrere Grad zeigt ein Gemisch.") },
    {
      text: tx("You can't tell from the melting behaviour", "Am Schmelzverhalten kann man das nicht erkennen"),
      title: tx("You can tell!", "Doch, man kann!"),
      say: tx("The melting behaviour is a good test: pure substances have a sharp melting temperature, mixtures a melting range.", "Das Schmelzverhalten ist ein guter Test: Reinstoffe haben eine scharfe Schmelztemperatur, Gemische einen Schmelzbereich."),
    },
  ]);
  return {
    instruction: tx("Pure substance or mixture?", "Reinstoff oder Stoffgemisch?"),
    text: range
      ? tx(`You slowly heat ${en(item.name)}. It doesn't melt at one temperature but gradually between ${item.from} °C and ${item.to} °C. What is it?`, `Du erwärmst ${de(item.name)} langsam. Es schmilzt nicht bei einer Temperatur, sondern nach und nach zwischen ${item.from} °C und ${item.to} °C. Was ist es?`)
      : tx(`You slowly heat ${en(item.name)}. It melts completely at exactly ${item.from} °C, and the temperature stays there while it melts. What is it most likely?`, `Du erwärmst ${de(item.name)} langsam. Es schmilzt vollständig bei genau ${item.from} °C, und die Temperatur bleibt dabei stehen. Was ist es höchstwahrscheinlich?`),
    answer,
    hint: tx("Pure substances have a fixed melting temperature. Mixtures melt over a range.", "Reinstoffe haben eine feste Schmelztemperatur. Gemische schmelzen in einem Temperaturbereich."),
    solution: [
      {
        math: range ? tx(`${item.from} "°C" "to" ${item.to} "°C" \\Rightarrow "melting range"`, `${item.from} "°C" "bis" ${item.to} "°C" \\Rightarrow "Schmelzbereich"`) : tx(`${item.from} "°C" \\Rightarrow "sharp melting temperature"`, `${item.from} "°C" \\Rightarrow "scharfe Schmelztemperatur"`),
        note: range ? tx("It melts over a range of temperatures.", "Es schmilzt über einen Temperaturbereich.") : tx("It melts at one fixed temperature.", "Es schmilzt bei einer festen Temperatur."),
      },
      { math: range ? tx('"mixture"#r', '"Stoffgemisch"#r') : tx('"pure substance"#r', '"Reinstoff"#r'), note: range ? tx("A melting range means a **mixture**.", "Ein Schmelzbereich zeigt ein **Stoffgemisch**.") : tx("A sharp melting temperature means a **pure substance**.", "Eine scharfe Schmelztemperatur zeigt einen **Reinstoff**.") },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Generator

const EASY_CASES = CASES.filter((c) => ["magnet", "evaporate", "sieve", "chroma", "filter"].includes(c.method) && !en(c.task).includes("waste"));
const ALL_METHODS = Object.keys(METHODS) as Method[];

function level1(rng: Rng): Exercise | null {
  switch (rng.int(0, 4)) {
    case 0:
      return pureTask(rng);
    case 1:
      return homTask(rng, true);
    case 2:
      return caseChoiceTask(rng, rng.pick(EASY_CASES));
    case 3:
      return typeWordTask(rng.pick(WORD_TYPES));
    default:
      return chromaCountTask(rng);
  }
}

function level2(rng: Rng): Exercise | null {
  switch (rng.int(0, 6)) {
    case 0:
      return typeChoiceTask(rng);
    case 1:
      return propertyTask(rng, rng.pick(ALL_METHODS));
    case 2:
      return caseWordTask(rng.pick(CASES));
    case 3:
      return homMultiTask(rng);
    case 4:
      return filterTask(rng);
    case 5:
      return distilTask(rng);
    default:
      return caseChoiceTask(rng, rng.pick(CASES));
  }
}

function level3(rng: Rng): Exercise | null {
  switch (rng.int(0, 7)) {
    case 0:
    case 1:
      return orderTask(rng);
    case 2:
      return missingStepTask(rng);
    case 3:
      return filterMultiTask(rng);
    case 4:
      return casePropertyTask(rng, rng.pick(CASES));
    case 5:
      return pureMultiTask(rng);
    case 6:
      return seaSaltTask(rng);
    default:
      return meltRangeTask(rng);
  }
}

function generate(level: Level, rng: Rng): Exercise {
  for (let tries = 0; tries < 30; tries++) {
    const ex = level === 1 ? level1(rng) : level === 2 ? level2(rng) : level3(rng);
    if (ex) return ex;
  }
  return pureTask(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const pureFrames: Frame[] = [
  {
    math: tx('"salt water"#m', '"Salzwasser"#m'),
    note: tx("Salt water looks like a single, clear substance. But is it?", "Salzwasser sieht aus wie ein einziger, klarer Stoff. Aber ist es das?"),
  },
  {
    math: tx('"salt water"#m =#e "water"#w +#p "salt"#s', '"Salzwasser"#m =#e "Wasser"#w +#p "Salz"#s'),
    note: tx("It's made of two substances. Anything made of two or more substances is a **mixture** (Stoffgemisch).", "Es besteht aus zwei Stoffen. Alles, was aus zwei oder mehr Stoffen besteht, ist ein **Stoffgemisch**."),
  },
  {
    math: tx('"water"#w : \\ce{H2O} \\quad "salt"#s : \\ce{NaCl}', '"Wasser"#w : \\ce{H2O} \\quad "Salz"#s : \\ce{NaCl}'),
    note: tx("Water and salt on their own are **pure substances**: each has just one kind of particle.", "Wasser und Salz allein sind **Reinstoffe**: Jeder hat nur eine Teilchensorte."),
  },
  {
    math: tx('"water:"#w \\; 0 "°C" , 100 "°C"', '"Wasser:"#w \\; 0 "°C" , 100 "°C"'),
    note: tx("A pure substance has fixed properties: pure water always melts at 0 °C and boils at 100 °C.", "Ein Reinstoff hat feste Eigenschaften: Reines Wasser schmilzt immer bei 0 °C und siedet bei 100 °C."),
  },
  {
    math: tx('"salt water:"#m \\; "below" 0 "°C" , "above" 100 "°C"', '"Salzwasser:"#m \\; "unter" 0 "°C" , "über" 100 "°C"'),
    note: tx("A mixture's properties depend on how much of each substance is in it. Salt water freezes below 0 °C and boils above 100 °C.", "Die Eigenschaften eines Gemischs hängen davon ab, wie viel von jedem Stoff darin ist. Salzwasser gefriert unter 0 °C und siedet über 100 °C."),
  },
];

const propertyFrames: Frame[] = [
  {
    math: tx('"particle size"#p \\\\ \\to#ar "sieving"#m1 \\; "filtering"#m2', '"Teilchengröße"#p \\\\ \\to#ar "Sieben"#m1 \\; "Filtrieren"#m2'),
    note: tx("Every separation method uses a property in which the substances differ. **Size**: a sieve or a filter lets small things through and holds back big ones.", "Jedes Trennverfahren nutzt eine Eigenschaft, in der sich die Stoffe unterscheiden. **Teilchengröße**: Sieb und Filter lassen Kleines durch und halten Großes zurück."),
    highlight: ["p"],
  },
  {
    math: tx('"density"#p \\\\ \\to#ar "settling"#m1 \\; "decanting"#m2 \\; "centrifuging"#m3', '"Dichte"#p \\\\ \\to#ar "Sedimentieren"#m1 \\; "Dekantieren"#m2 \\; "Zentrifugieren"#m3'),
    note: tx("**Density**: denser solids sink and settle. Then you pour off the liquid. A centrifuge does the same, only much faster.", "**Dichte**: Feststoffe mit größerer Dichte sinken ab (Sedimentieren). Dann gießt du die Flüssigkeit ab (Dekantieren). Eine Zentrifuge macht dasselbe, nur viel schneller."),
    highlight: ["p"],
  },
  {
    math: tx('"boiling temperature"#p \\\\ \\to#ar "evaporating"#m1 \\; "distilling"#m2', '"Siedetemperatur"#p \\\\ \\to#ar "Eindampfen"#m1 \\; "Destillieren"#m2'),
    note: tx("**Boiling temperature**: the liquid boils away, the dissolved solid stays. Distilling also catches the vapour again.", "**Siedetemperatur**: Die Flüssigkeit verdampft, der gelöste Feststoff bleibt. Beim Destillieren wird der Dampf zusätzlich wieder aufgefangen."),
    highlight: ["p"],
  },
  {
    math: tx('"solubility"#p \\\\ \\to#ar "extracting"#m1', '"Löslichkeit"#p \\\\ \\to#ar "Extrahieren"#m1'),
    note: tx("**Solubility**: a solvent dissolves one substance out of a mixture. Making tea or coffee is extracting!", "**Löslichkeit**: Ein Lösungsmittel löst einen Stoff aus einem Gemisch heraus. Tee oder Kaffee kochen ist Extrahieren!"),
    highlight: ["p"],
  },
  {
    math: tx('"magnetism"#p \\\\ \\to#ar "magnetic separation"#m1', '"Magnetisierbarkeit"#p \\\\ \\to#ar "Magnetscheiden"#m1'),
    note: tx("**Magnetism**: iron, nickel and cobalt stick to a magnet.", "**Magnetisierbarkeit**: Eisen, Nickel und Cobalt bleiben am Magneten hängen."),
    highlight: ["p"],
  },
  {
    math: tx('"sticking to paper"#p \\\\ \\to#ar "chromatography"#m1', '"Haftfähigkeit"#p \\\\ \\to#ar "Chromatografie"#m1'),
    note: tx("**Sticking to paper** (adsorption): dyes travel up the paper at different speeds.", "**Haftfähigkeit** (Adsorption): Farbstoffe wandern unterschiedlich schnell im Papier nach oben."),
    highlight: ["p"],
  },
];

const distilFrames: Frame[] = [
  {
    math: tx('"ethanol"#a \\; 78#ta "°C" \\quad "water"#b \\; 100#tb "°C"', '"Ethanol"#a \\; 78#ta "°C" \\quad "Wasser"#b \\; 100#tb "°C"'),
    note: tx("Alcohol (ethanol) and water mix completely: a solution. But their boiling temperatures differ.", "Alkohol (Ethanol) und Wasser mischen sich vollständig: eine Lösung. Ihre Siedetemperaturen sind aber verschieden."),
  },
  {
    math: tx('"heat"#h \\to 78#ta "°C" : "ethanol boils"#a', '"erhitzen"#h \\to 78#ta "°C" : "Ethanol siedet"#a'),
    note: tx("Heat the mixture: the ethanol, with the lower boiling temperature, boils off first.", "Erhitze das Gemisch: Das Ethanol mit der niedrigeren Siedetemperatur siedet zuerst."),
  },
  {
    math: tx('"vapour"#d \\to "condenser"#k \\to "distillate"#x', '"Dampf"#d \\to "Kühler"#k \\to "Destillat"#x'),
    note: tx("The vapour flows into the condenser, is cooled and turns liquid again: the **distillate** drips into the collecting flask.", "Der Dampf strömt in den Kühler, wird abgekühlt und wieder flüssig: Das **Destillat** tropft in die Vorlage."),
  },
  {
    math: tx('"evaporating:"#e \\; "vapour is lost" \\\\ "distilling:"#f \\; "vapour is caught"', '"Eindampfen:"#e \\; "Dampf geht verloren" \\\\ "Destillieren:"#f \\; "Dampf wird aufgefangen"'),
    note: tx("The difference to evaporating: when distilling, you keep **both** parts. That's how drinking water is made from sea water.", "Der Unterschied zum Eindampfen: Beim Destillieren behältst du **beide** Bestandteile. So gewinnt man Trinkwasser aus Meerwasser."),
  },
];

const milk = EXAMPLES.find((e) => en(e.name) === "milk")!;
const checkMilk = typeChoiceTask(createRng(3), milk);
const checkSalt = caseChoiceTask(createRng(8), CASES[1]);
const checkCentrifuge = propertyTask(createRng(4), "centrifuge");
const checkOrder = orderTask(createRng(9), "gravel-sand-salt");

const lesson: Topic["lesson"] = [
  {
    type: "explain",
    title: tx("Pure substance or mixture?", "Reinstoff oder Stoffgemisch?"),
    blob: tx("Most things around you are mixtures. Let's find out why!", "Die meisten Dinge um dich herum sind Gemische. Finden wir heraus, warum!"),
    body: tx(
      "A **pure substance** (Reinstoff) consists of one kind of particle and has fixed properties. A **mixture** contains at least two pure substances.",
      "Ein **Reinstoff** besteht aus einer Teilchensorte und hat feste Eigenschaften. Ein **Stoffgemisch** enthält mindestens zwei Reinstoffe.",
    ),
    frames: pureFrames,
  },
  {
    type: "widget",
    title: tx("Kinds of mixtures", "Arten von Gemischen"),
    blob: tx("Tap the table! Purple shows the substance that is spread out.", "Tipp auf die Tabelle! Lila ist der Stoff, der verteilt ist."),
    body: tx(
      "Mixtures get their names from **what** is spread **in what**: solid, liquid or gas. **Homogeneous** mixtures look the same everywhere, even under a microscope. In **heterogeneous** mixtures you can tell the parts apart.",
      "Gemische bekommen ihren Namen danach, **was** **worin** verteilt ist: fest, flüssig oder gasförmig. **Homogene** Gemische sehen überall gleich aus, selbst unter dem Mikroskop. Bei **heterogenen** Gemischen kann man die Bestandteile unterscheiden.",
    ),
    widget: MixturesTypes,
  },
  { type: "check", blob: tx("Milk looks so smooth. But what's inside?", "Milch sieht so glatt aus. Aber was steckt drin?"), exercise: checkMilk },
  {
    type: "explain",
    title: tx("Every method uses a property", "Jedes Verfahren nutzt eine Eigenschaft"),
    blob: tx("Separating is detective work: find what's different!", "Trennen ist Detektivarbeit: Finde, was verschieden ist!"),
    body: tx("To separate a mixture, look for a property in which its substances differ. Each separation method uses exactly one such difference.", "Um ein Gemisch zu trennen, suchst du eine Eigenschaft, in der sich seine Stoffe unterscheiden. Jedes Trennverfahren nutzt genau so einen Unterschied."),
    frames: propertyFrames,
  },
  {
    type: "widget",
    title: tx("The separation lab", "Das Trennlabor"),
    blob: tx("Salt, sand and iron filings, all mixed up. Can you get each one out on its own?", "Salz, Sand und Eisenspäne, alles durcheinander. Bekommst du jeden Stoff einzeln heraus?"),
    body: tx(
      "Choose steps one after another and watch the beaker. The order matters! When it works, try another mixture.",
      "Wähle die Schritte nacheinander und beobachte das Becherglas. Die Reihenfolge zählt! Wenn es klappt, probier ein anderes Gemisch.",
    ),
    widget: MixturesLab,
  },
  { type: "check", blob: tx("A classic test question. Careful, there's a trap!", "Eine klassische Testfrage. Vorsicht, da ist eine Falle!"), exercise: checkSalt },
  {
    type: "explain",
    title: tx("Distilling", "Destillieren"),
    blob: tx("Two liquids, perfectly mixed. Boiling temperatures to the rescue!", "Zwei Flüssigkeiten, perfekt gemischt. Die Siedetemperaturen retten uns!"),
    frames: distilFrames,
  },
  {
    type: "widget",
    title: tx("Chromatography", "Chromatografie"),
    blob: tx("Is black ink really just black? Let's find out!", "Ist schwarze Tinte wirklich nur schwarz? Finden wir es heraus!"),
    body: tx(
      "A dot of ink sits on paper, the paper stands in water. The water creeps up and carries the dyes along. Each dye sticks differently strongly to the paper, so they separate.",
      "Ein Tintenpunkt sitzt auf Papier, das Papier steht im Wasser. Das Wasser steigt auf und nimmt die Farbstoffe mit. Jeder Farbstoff haftet unterschiedlich stark am Papier, deshalb trennen sie sich.",
    ),
    widget: MixturesChroma,
  },
  { type: "check", blob: tx("Which property makes a centrifuge work?", "Welche Eigenschaft nutzt eine Zentrifuge?"), exercise: checkCentrifuge },
  { type: "check", blob: tx("The final challenge: three substances, one plan!", "Die Abschlussaufgabe: drei Stoffe, ein Plan!"), exercise: checkOrder },
];

// ---------------------------------------------------------------------------

const mixtures: Topic = {
  ...topicMeta("mixtures"),
  summary: [
    {
      title: tx("Pure substance and mixture", "Reinstoff und Stoffgemisch"),
      body: tx(
        "A pure substance has one kind of particle and fixed properties (sharp melting and boiling temperature). A mixture contains at least two pure substances; it melts and boils over a range.",
        "Ein Reinstoff hat eine Teilchensorte und feste Eigenschaften (scharfe Schmelz- und Siedetemperatur). Ein Stoffgemisch enthält mindestens zwei Reinstoffe und schmilzt und siedet in einem Bereich.",
      ),
      examples: [tx('"salt water" = "water" + "salt"', '"Salzwasser" = "Wasser" + "Salz"'), "\\ce{NaCl(aq)}"],
      tone: "rule",
    },
    {
      title: tx("Homogeneous and heterogeneous", "Homogen und heterogen"),
      body: tx(
        "Homogeneous: looks the same everywhere, even under a microscope (solution, alloy, gas mixture). Heterogeneous: the parts can be told apart (suspension, emulsion, foam, smoke, fog, mixture of solids).",
        "Homogen: überall gleich, selbst unter dem Mikroskop (Lösung, Legierung, Gasgemisch). Heterogen: Die Bestandteile sind unterscheidbar (Suspension, Emulsion, Schaum, Rauch, Nebel, Gemenge).",
      ),
      tone: "rule",
    },
    {
      title: tx("Kinds of mixtures", "Gemischarten"),
      body: tx("Named after what is spread in what.", "Benannt danach, was worin verteilt ist."),
      examples: [
        tx('"solid in liquid:" \\; "suspension / solution"', '"fest in flüssig:" \\; "Suspension / Lösung"'),
        tx('"liquid in liquid:" \\; "emulsion / solution"', '"flüssig in flüssig:" \\; "Emulsion / Lösung"'),
        tx('"solid in gas:" \\; "smoke" \\quad "liquid in gas:" \\; "fog"', '"fest in gasförmig:" \\; "Rauch" \\quad "flüssig in gasförmig:" \\; "Nebel"'),
        tx('"gas in liquid:" \\; "foam" \\quad "metals:" \\; "alloy"', '"gasförmig in flüssig:" \\; "Schaum" \\quad "Metalle:" \\; "Legierung"'),
      ],
      tone: "tip",
    },
    {
      title: tx("Separation methods", "Trennverfahren"),
      body: tx("Each method uses one property in which the substances differ.", "Jedes Verfahren nutzt eine Eigenschaft, in der sich die Stoffe unterscheiden."),
      examples: [
        tx('"size:" \\; "sieving, filtering"', '"Teilchengröße:" \\; "Sieben, Filtrieren"'),
        tx('"density:" \\; "settling, decanting, centrifuging"', '"Dichte:" \\; "Sedimentieren, Dekantieren, Zentrifugieren"'),
        tx('"boiling temperature:" \\; "evaporating, distilling"', '"Siedetemperatur:" \\; "Eindampfen, Destillieren"'),
        tx('"solubility:" \\; "extracting" \\quad "magnetism:" \\; "magnet"', '"Löslichkeit:" \\; "Extrahieren" \\quad "Magnetisierbarkeit:" \\; "Magnetscheiden"'),
      ],
      tone: "rule",
    },
    {
      title: tx("Salt, sand and iron", "Salz, Sand und Eisen"),
      body: tx("Magnet first, then dissolve the salt in water, filter off the sand and evaporate the solution.", "Erst der Magnet, dann das Salz in Wasser lösen, den Sand abfiltrieren und die Lösung eindampfen."),
      examples: [tx('"magnet" \\to "dissolve" \\to "filter" \\to "evaporate"', '"Magnet" \\to "Lösen" \\to "Filtrieren" \\to "Eindampfen"')],
      tone: "tip",
    },
    {
      title: tx("Classic mistake", "Typischer Fehler"),
      body: tx(
        "You can't filter out something dissolved: salt water runs straight through a filter. And evaporating loses the water; distilling keeps it.",
        "Gelöstes kann man nicht abfiltrieren: Salzwasser läuft einfach durch den Filter. Und beim Eindampfen ist das Wasser weg, beim Destillieren bleibt es erhalten.",
      ),
      tone: "warning",
    },
  ],
  lesson,
  generate,
};

export default mixtures;

