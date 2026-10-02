"use client";

import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { topicMeta } from "@/learn/catalog";
import { COMMON, IONS_HEAVY, IONS_MAIN, ISOTOPES_HEAVY, ISOTOPES_LIGHT, MIXTURES, STABLE } from "@/learn/chemistry/atoms-data";
import { byNumber, element, shells, type Element } from "@/learn/chemistry/elements";
import { dec } from "@/learn/chemistry/format";
import { ionShells } from "@/learn/chemistry/visuals/AtomShells";
import { AtomsBuilder } from "@/learn/chemistry/visuals/AtomsBuilder";
import { AtomsShellFiller } from "@/learn/chemistry/visuals/AtomsShellFiller";
import { ElementTile, LookupTable, NuclideCard, visual } from "@/learn/chemistry/visuals/AtomsVisuals";
import { check, type AnswerValue } from "@/learn/engine/answers";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Mistake, Topic } from "@/learn/types";

// ---------------------------------------------------------------------------
// Notation and names

// Particle symbols as upright text: p⁺, n, e⁻.
const P = '"p⁺"';
const N = '"n"';
const E = '"e⁻"';
const SHELL = ["K", "L", "M", "N"];

const enName = (e: Element) => resolveText(e.name, "en").toLowerCase();
const deName = (e: Element) => resolveText(e.name, "de");
/** "a sodium atom", "an oxygen atom" */
const anAtom = (e: Element) => `${/^[aeio]/.test(enName(e)) ? "an" : "a"} ${enName(e)} atom`;
/** "Natriumatom" */
const deAtom = (e: Element) => `${deName(e)}atom`;
const el = (symbol: string) => element(symbol)!;

const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const plEn = (n: number, what: string) => pl(n, what, `${what}s`);
const plDe = (n: number, what: string) => pl(n, what, `${what}en`);

/** "2+", "−", "3−" */
const chargeText = (q: number) => `${Math.abs(q)}${q > 0 ? "+" : "−"}`;
/** Formula of a single-atom ion: "Na+", "Mg^2+", "Cl-". */
const ionFormula = (symbol: string, q: number) => (q === 0 ? symbol : Math.abs(q) === 1 ? `${symbol}${q > 0 ? "+" : "-"}` : `${symbol}^${Math.abs(q)}${q > 0 ? "+" : "-"}`);
const multDe = (q: number) => `${["", "einfach", "zweifach", "dreifach"][Math.abs(q)]} ${q > 0 ? "positiv" : "negativ"}`;

/** Accepted answers for an element name: its name (both languages), symbol and common spellings. */
const EXTRA_SPELLINGS: Record<string, string[]> = {
  Ca: ["Kalzium"],
  Si: ["Silizium"],
  Al: ["aluminum"],
  S: ["sulphur"],
  I: ["Jod"],
  Cs: ["Cäsium", "cesium"],
};
function accept(e: Element): Text[] {
  const a = resolveText(e.name, "en");
  const b = resolveText(e.name, "de");
  return [a === b ? a : e.name, e.symbol, ...(EXTRA_SPELLINGS[e.symbol] ?? [])];
}

const num = (value: number, tolerance?: number): AnswerSpec => (tolerance ? { kind: "number", value, tolerance } : { kind: "number", value });
const word = (e: Element): AnswerSpec => ({ kind: "word", accept: accept(e), placeholder: tx("name or symbol", "Name oder Symbol") });
const formula = (value: string): AnswerSpec => ({ kind: "formula", value });

// ---------------------------------------------------------------------------
// Typical mistakes: each one is only kept when it differs from the right answer and the others.

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

/** Options with the right one first, shuffled; wrong options with a `say` become mistakes. */
type Opt = { text: Text; title?: Text; say?: Text };
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

// ---------------------------------------------------------------------------
// Counting particles in a nuclide symbol

type Particle = "p" | "n" | "e";

function countExercise(z: number, a: number, ask: Particle): Exercise {
  const e = byNumber(z);
  const n = a - z;
  const value = ask === "n" ? n : z;
  const m = mistakes(num(value));
  const whatEn = { p: "protons", n: "neutrons", e: "electrons" }[ask];
  const whatDe = { p: "Protonen", n: "Neutronen", e: "Elektronen" }[ask];
  let solution: Frame[];
  let hint: Text;
  if (ask === "p") {
    hint = tx("The bottom number is the atomic number. It is the number of protons.", "Die untere Zahl ist die Ordnungszahl. Sie ist die Zahl der Protonen.");
    solution = [
      { math: `${P} =#e1 Z#Z`, note: tx("The number of protons is the atomic number $Z$, the number at the bottom left.", "Die Zahl der Protonen ist die Ordnungszahl $Z$, die Zahl unten links.") },
      { math: `${P} =#e1 ${z}#Z`, note: tx(`So ${anAtom(e)} has **${plEn(z, "proton")}**. That's what makes it ${enName(e)}.`, `Ein ${deAtom(e)} hat also **${plDe(z, "Proton")}**. Genau das macht es zu ${deName(e)}.`) },
    ];
    m.add(
      num(a),
      tx("Mass number taken", "Massenzahl erwischt"),
      tx("Ah, that's the top number, the **mass number**. It counts protons and neutrons together. The protons are the bottom number.", "Ah, das ist die obere Zahl, die **Massenzahl**. Sie zählt Protonen und Neutronen zusammen. Die Protonen stehen unten."),
    );
    m.add(
      num(n),
      tx("Those are the neutrons", "Das sind die Neutronen"),
      tx("You worked out the neutrons, nice! But the question was about the protons, and those you can read off directly.", "Du hast die Neutronen ausgerechnet, schön! Gefragt waren aber die Protonen, und die kannst du direkt ablesen."),
    );
  } else if (ask === "n") {
    hint = tx("Neutrons = mass number (top) minus atomic number (bottom).", "Neutronen = Massenzahl (oben) minus Ordnungszahl (unten).");
    solution = [
      { math: "N#N =#e1 A#A -#m Z#Z", note: tx("Neutrons: mass number $A$ (top) minus atomic number $Z$ (bottom).", "Neutronen: Massenzahl $A$ (oben) minus Ordnungszahl $Z$ (unten).") },
      { math: `N#N =#e1 ${a}#A -#m ${z}#Z`, note: tx(`Read them off: $A = ${a}$ and $Z = ${z}$.`, `Ablesen: $A = ${a}$ und $Z = ${z}$.`) },
      { math: `N#N =#e1 ${n}#r`, note: tx(`**${plEn(n, "neutron")}** in the nucleus.`, `**${plDe(n, "Neutron")}** im Kern.`) },
    ];
    m.add(
      num(a),
      tx("Neutrons aren't the mass number", "Neutronen ≠ Massenzahl"),
      tx("Classic trap! The mass number counts protons **and** neutrons. Take the protons away and only the neutrons are left.", "Die klassische Falle! Die Massenzahl zählt Protonen **und** Neutronen. Zieh die Protonen ab, dann bleiben die Neutronen übrig."),
    );
    m.add(
      num(z),
      tx("Those are the protons", "Das sind die Protonen"),
      tx("That's the atomic number, so the number of protons. The neutrons are the difference between the two numbers.", "Das ist die Ordnungszahl, also die Zahl der Protonen. Die Neutronen sind der Unterschied zwischen den beiden Zahlen."),
    );
    m.add(
      num(a + z),
      tx("Added instead of subtracted", "Addiert statt abgezogen"),
      tx("I think you added both numbers. But the protons are already inside the mass number, so take them away.", "Ich glaub, du hast beide Zahlen addiert. Die Protonen stecken aber schon in der Massenzahl, also zieh sie ab."),
    );
  } else {
    hint = tx("A neutral atom has as many electrons as protons.", "Ein neutrales Atom hat genauso viele Elektronen wie Protonen.");
    solution = [
      { math: `${E} =#e1 ${P} =#e2 Z#Z`, note: tx("In a neutral atom there are as many electrons as protons.", "Im neutralen Atom gibt es genauso viele Elektronen wie Protonen.") },
      { math: `${E} =#e1 ${P} =#e2 ${z}#Z`, note: tx(`**${plEn(z, "electron")}**, just like the atomic number.`, `**${plDe(z, "Elektron")}**, genau wie die Ordnungszahl.`) },
    ];
    m.add(
      num(a),
      tx("Mass number taken", "Massenzahl erwischt"),
      tx("That's the mass number. Electrons aren't counted in it, they're far too light. A neutral atom has as many electrons as **protons**.", "Das ist die Massenzahl. Elektronen zählen da nicht mit, sie sind viel zu leicht. Ein neutrales Atom hat so viele Elektronen wie **Protonen**."),
    );
    m.add(
      num(n),
      tx("Those are the neutrons", "Das sind die Neutronen"),
      tx("You worked out the neutrons. In a neutral atom the electrons match the **protons**, not the neutrons.", "Du hast die Neutronen ausgerechnet. Im neutralen Atom passen die Elektronen zu den **Protonen**, nicht zu den Neutronen."),
    );
    m.add(
      num(0),
      tx("The electrons are there", "Die Elektronen sind da"),
      tx("The electrons don't show up in the nuclide symbol, but they're there! A neutral atom has as many electrons as protons.", "Im Kernsymbol tauchen die Elektronen nicht auf, aber es gibt sie! Ein neutrales Atom hat so viele Elektronen wie Protonen."),
    );
  }
  return {
    instruction: { p: tx("Count the protons", "Zähle die Protonen"), n: tx("Count the neutrons", "Zähle die Neutronen"), e: tx("Count the electrons", "Zähle die Elektronen") }[ask],
    text: tx(`The nuclide symbol shows ${anAtom(e)}. How many ${whatEn} does it have?`, `Das Kernsymbol zeigt ein ${deAtom(e)}. Wie viele ${whatDe} hat es?`),
    visual: visual(NuclideCard, { symbol: e.symbol, a, z, size: 76 }),
    answer: num(value),
    hint,
    solution,
    mistakes: m.list,
  };
}

function countTask(rng: Rng): Exercise {
  const z = rng.int(2, 20);
  const a = rng.chance(0.7) ? COMMON[z] : rng.pick(STABLE[z]);
  return countExercise(z, a, rng.pick(["p", "n", "n", "e"] as const));
}

// ---------------------------------------------------------------------------
// Which element? From protons (or electrons) and neutrons

function elementTask(rng: Rng): Exercise {
  let z = rng.int(3, 20);
  let a = rng.pick(STABLE[z]);
  for (let i = 0; i < 6 && a - z === z; i++) {
    z = rng.int(3, 20);
    a = rng.pick(STABLE[z]);
  }
  const e = byNumber(z);
  const n = a - z;
  const viaE = rng.chance(0.4);
  const m = mistakes(word(e));
  if (n >= 1)
    m.add(
      word(byNumber(n)),
      tx("Went by the neutrons", "Nach den Neutronen gesucht"),
      tx(`You looked up ${n}, the number of neutrons. But only the **protons** decide which element it is.`, `Du hast ${n} nachgeschlagen, die Zahl der Neutronen. Welches Element es ist, entscheiden aber nur die **Protonen**.`),
    );
  m.add(
    word(byNumber(a)),
    tx("That's the mass number", "Das ist die Massenzahl"),
    tx(`You added up to ${a}: that's the mass number. In the periodic table you need the atomic number, the number of protons.`, `Du hast auf ${a} addiert: Das ist die Massenzahl. Im Periodensystem brauchst du die Ordnungszahl, also die Zahl der Protonen.`),
  );
  return {
    instruction: tx("Name the element", "Benenne das Element"),
    text: viaE
      ? tx(`A neutral atom has ${z} electrons and ${n} neutrons. Which element is it?`, `Ein neutrales Atom hat ${z} Elektronen und ${n} Neutronen. Um welches Element handelt es sich?`)
      : tx(`The nucleus of an atom contains ${z} protons and ${n} neutrons. Which element is it?`, `Der Kern eines Atoms enthält ${z} Protonen und ${n} Neutronen. Um welches Element handelt es sich?`),
    visual: visual(LookupTable, { periods: 4 }),
    answer: word(e),
    hint: viaE
      ? tx("In a neutral atom: electrons = protons = atomic number. Look it up in the table.", "Im neutralen Atom gilt: Elektronen = Protonen = Ordnungszahl. Schlag sie in der Tabelle nach.")
      : tx("Only the protons decide the element. Their number is the atomic number.", "Nur die Protonen entscheiden über das Element. Ihre Zahl ist die Ordnungszahl."),
    solution: [
      {
        math: viaE ? `${E} =#e0 ${P} =#e1 Z#Z =#e2 ${z}#z` : `${P} =#e1 Z#Z =#e2 ${z}#z`,
        note: viaE
          ? tx(`Neutral atom: as many protons as electrons, so $Z = ${z}$. The neutrons don't matter here.`, `Neutrales Atom: genauso viele Protonen wie Elektronen, also $Z = ${z}$. Die Neutronen spielen hier keine Rolle.`)
          : tx(`The atomic number is the number of protons: $Z = ${z}$. The neutrons don't matter here.`, `Die Ordnungszahl ist die Zahl der Protonen: $Z = ${z}$. Die Neutronen spielen hier keine Rolle.`),
      },
      {
        math: `Z#Z =#e2 ${z}#z \\Rightarrow#r \\ce{${e.symbol}#s}`,
        note: tx(`Number ${z} in the periodic table is **${enName(e)}** ($\\ce{${e.symbol}}$).`, `Nummer ${z} im Periodensystem ist **${deName(e)}** ($\\ce{${e.symbol}}$).`),
      },
    ],
    mistakes: m.list,
  };
}

/** Mass number and neutrons given: which element? */
function nucleusMassTask(rng: Rng): Exercise {
  let z = rng.int(3, 20);
  let a = rng.pick(STABLE[z]);
  for (let i = 0; i < 8 && a - z === z; i++) {
    z = rng.int(3, 20);
    a = rng.pick(STABLE[z]);
  }
  const e = byNumber(z);
  const n = a - z;
  const m = mistakes(word(e));
  m.add(
    word(byNumber(n)),
    tx("Neutrons as atomic number", "Neutronen als Ordnungszahl"),
    tx(`You looked up ${n}, the number of neutrons. The element is decided by the protons: mass number minus neutrons.`, `Du hast ${n} nachgeschlagen, die Zahl der Neutronen. Das Element bestimmen die Protonen: Massenzahl minus Neutronen.`),
  );
  m.add(
    word(byNumber(a)),
    tx("Looked up the mass number", "Massenzahl nachgeschlagen"),
    tx(`You looked up ${a}. But that's the mass number, protons and neutrons together. Take the neutrons away first.`, `Du hast ${a} nachgeschlagen. Das ist aber die Massenzahl, Protonen und Neutronen zusammen. Zieh zuerst die Neutronen ab.`),
  );
  return {
    instruction: tx("Name the element", "Benenne das Element"),
    text: tx(`An atom has the mass number ${a} and ${n} neutrons. Which element is it?`, `Ein Atom hat die Massenzahl ${a} und ${n} Neutronen. Um welches Element handelt es sich?`),
    visual: visual(LookupTable, { periods: 4 }),
    answer: word(e),
    hint: tx("Mass number = protons + neutrons. Work out the protons first.", "Massenzahl = Protonen + Neutronen. Rechne zuerst die Protonen aus."),
    solution: [
      { math: "Z#Z =#e1 A#A -#m N#N", note: tx("Protons = mass number minus neutrons.", "Protonen = Massenzahl minus Neutronen.") },
      { math: `Z#Z =#e1 ${a}#A -#m ${n}#N`, note: tx(`$A = ${a}$, $N = ${n}$.`, `$A = ${a}$, $N = ${n}$.`) },
      { math: `Z#Z =#e1 ${z}#r \\Rightarrow#to \\ce{${e.symbol}#s}`, note: tx(`Atomic number ${z}: that's **${enName(e)}**.`, `Ordnungszahl ${z}: Das ist **${deName(e)}**.`) },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Particle facts (concepts)

type FactQ = { q: Text; opts: Opt[]; hint: Text; frame: Frame };

const PROTON = tx("the proton", "das Proton");
const NEUTRON = tx("the neutron", "das Neutron");
const ELECTRON = tx("the electron", "das Elektron");

const FACTS: FactQ[] = [
  {
    q: tx("Which particle is negatively charged?", "Welches Teilchen ist negativ geladen?"),
    opts: [
      { text: ELECTRON },
      { text: PROTON, title: tx("Protons are positive", "Protonen sind positiv"), say: tx('Protons are positive, that\'s what the plus in $"p⁺"$ stands for.', 'Protonen sind positiv, dafür steht das Plus in $"p⁺"$.') },
      { text: NEUTRON, title: tx("Neutrons are neutral", "Neutronen sind neutral"), say: tx("Neutrons have no charge at all. The name gives it away: neutral.", "Neutronen haben gar keine Ladung. Der Name verrät es schon: neutral.") },
    ],
    hint: tx("Look at the little sign on each particle's symbol.", "Schau auf das kleine Zeichen am Symbol jedes Teilchens."),
    frame: { math: `${P} \\quad ${N} \\quad \\hl{${E}}`, note: tx("Protons are positive, neutrons have no charge, **electrons are negative**.", "Protonen sind positiv, Neutronen ungeladen, **Elektronen negativ**.") },
  },
  {
    q: tx("Which particle has no electric charge?", "Welches Teilchen ist elektrisch ungeladen?"),
    opts: [
      { text: NEUTRON },
      { text: PROTON, title: tx("Protons are positive", "Protonen sind positiv"), say: tx("A proton carries a positive charge, $+1$.", "Ein Proton trägt eine positive Ladung, $+1$.") },
      { text: ELECTRON, title: tx("Electrons are negative", "Elektronen sind negativ"), say: tx("An electron carries a negative charge, $-1$.", "Ein Elektron trägt eine negative Ladung, $-1$.") },
    ],
    hint: tx("Its name sounds like the answer.", "Sein Name klingt schon nach der Antwort."),
    frame: { math: `${P} \\quad \\hl{${N}} \\quad ${E}`, note: tx("The **neutron** has no charge. Its name says it: neutral.", "Das **Neutron** ist ungeladen. Sein Name sagt es: neutral.") },
  },
  {
    q: tx("Where are the neutrons in an atom?", "Wo befinden sich die Neutronen in einem Atom?"),
    opts: [
      { text: tx("in the nucleus", "im Atomkern") },
      {
        text: tx("around the nucleus, with the electrons", "in der Atomhülle bei den Elektronen"),
        title: tx("Mixed up with electrons", "Mit Elektronen verwechselt"),
        say: tx("Around the nucleus there are only electrons. Neutrons sit **in** the nucleus, right next to the protons.", "In der Atomhülle sind nur Elektronen. Neutronen sitzen **im** Kern, direkt bei den Protonen."),
      },
      {
        text: tx("on the outermost shell", "auf der äußersten Schale"),
        title: tx("Only electrons on shells", "Auf Schalen nur Elektronen"),
        say: tx("Only electrons move on the shells. Neutrons are packed into the nucleus together with the protons.", "Auf den Schalen bewegen sich nur Elektronen. Neutronen stecken mit den Protonen im Kern."),
      },
    ],
    hint: tx("Protons and neutrons are close friends: they sit together.", "Protonen und Neutronen sind dicke Freunde: Sie sitzen zusammen."),
    frame: {
      math: tx(`"nucleus:" \\; ${P} , \\hl{${N}} \\quad "around it:" \\; ${E}`, `"Atomkern:" \\; ${P} , \\hl{${N}} \\quad "Atomhülle:" \\; ${E}`),
      note: tx("Protons and neutrons sit together in the nucleus. Only electrons are on the shells.", "Protonen und Neutronen sitzen zusammen im Atomkern. Auf den Schalen sind nur Elektronen."),
    },
  },
  {
    q: tx("Which particles decide which element an atom belongs to?", "Welche Teilchen legen fest, zu welchem Element ein Atom gehört?"),
    opts: [
      { text: tx("the protons", "die Protonen") },
      {
        text: tx("the neutrons", "die Neutronen"),
        title: tx("Neutrons can vary", "Neutronen können variieren"),
        say: tx("The number of neutrons can change (isotopes), and it's still the same element.", "Die Zahl der Neutronen kann sich ändern (Isotope), und es bleibt trotzdem dasselbe Element."),
      },
      {
        text: tx("the electrons", "die Elektronen"),
        title: tx("Electrons come and go", "Elektronen kommen und gehen"),
        say: tx("An atom can give away or take up electrons. It becomes an ion, but stays the same element.", "Ein Atom kann Elektronen abgeben oder aufnehmen. Dann wird es ein Ion, bleibt aber dasselbe Element."),
      },
    ],
    hint: tx("Think of the atomic number. What does it count?", "Denk an die Ordnungszahl. Was zählt sie?"),
    frame: {
      math: tx(`\\hl{${P}} \\Rightarrow "element" \\quad ${N} \\Rightarrow "isotope" \\quad ${E} \\Rightarrow "ion"`, `\\hl{${P}} \\Rightarrow "Element" \\quad ${N} \\Rightarrow "Isotop" \\quad ${E} \\Rightarrow "Ion"`),
      note: tx("Change the protons: a new element. Change the neutrons: another isotope. Change the electrons: an ion.", "Ändere die Protonen: ein neues Element. Ändere die Neutronen: ein anderes Isotop. Ändere die Elektronen: ein Ion."),
    },
  },
  {
    q: tx("Which particle has almost no mass?", "Welches Teilchen hat fast keine Masse?"),
    opts: [
      { text: ELECTRON },
      {
        text: NEUTRON,
        title: tx("No charge isn't no mass", "Ungeladen heißt nicht leicht"),
        say: tx("Neutrons have no charge, but they do have mass: about as much as a proton.", "Neutronen haben keine Ladung, aber sehr wohl Masse: etwa so viel wie ein Proton."),
      },
      {
        text: PROTON,
        title: tx("Protons are heavy", "Protonen sind schwer"),
        say: tx("A proton has a mass of about 1 u, around 1800 times as much as an electron.", "Ein Proton hat eine Masse von etwa 1 u, rund 1800-mal so viel wie ein Elektron."),
      },
    ],
    hint: tx("Two of them weigh about 1 u each.", "Zwei von ihnen wiegen jeweils etwa 1 u."),
    frame: {
      math: `${P} \\approx 1 "u" \\quad ${N} \\approx 1 "u" \\quad \\hl{${E}} \\approx 0 "u"`,
      note: tx("Protons and neutrons have a mass of about 1 u each. An electron is about 1800 times lighter.", "Protonen und Neutronen haben jeweils etwa 1 u. Ein Elektron ist rund 1800-mal leichter."),
    },
  },
  {
    q: tx("Why is an atom electrically neutral?", "Warum ist ein Atom nach außen elektrisch neutral?"),
    opts: [
      { text: tx("It has as many electrons as protons.", "Es hat gleich viele Elektronen wie Protonen.") },
      {
        text: tx("It has as many neutrons as protons.", "Es hat gleich viele Neutronen wie Protonen."),
        title: tx("Neutrons have no charge", "Neutronen sind ungeladen"),
        say: tx("Neutrons have no charge, so they don't count here. It's about the protons ($+$) and the electrons ($-$).", "Neutronen sind ungeladen, sie zählen hier nicht. Es geht um die Protonen ($+$) und die Elektronen ($-$)."),
      },
      {
        text: tx("The neutrons cancel out the charges.", "Die Neutronen gleichen die Ladungen aus."),
        title: tx("Neutrons can't cancel", "Neutronen gleichen nichts aus"),
        say: tx("Neutrons can't cancel anything: they have no charge. Each proton's $+$ is balanced by an electron's $-$.", "Neutronen können nichts ausgleichen: Sie haben keine Ladung. Jedes $+$ eines Protons gleicht ein $-$ eines Elektrons aus."),
      },
    ],
    hint: tx("Which two particles carry a charge?", "Welche beiden Teilchen tragen eine Ladung?"),
    frame: { math: "(+11) + (-11) = 0", note: tx("Sodium: 11 protons and 11 electrons. The charges cancel out exactly.", "Natrium: 11 Protonen und 11 Elektronen. Die Ladungen heben sich genau auf.") },
  },
  {
    q: tx("What does the mass number tell you?", "Was gibt die Massenzahl an?"),
    opts: [
      { text: tx("the number of protons and neutrons", "die Anzahl der Protonen und Neutronen") },
      {
        text: tx("the number of protons", "die Anzahl der Protonen"),
        title: tx("That's the atomic number", "Das ist die Ordnungszahl"),
        say: tx("That's the **atomic number**. The mass number also counts the neutrons.", "Das ist die **Ordnungszahl**. Die Massenzahl zählt auch die Neutronen mit."),
      },
      {
        text: tx("the number of neutrons", "die Anzahl der Neutronen"),
        title: tx("Protons count too", "Protonen zählen mit"),
        say: tx("Classic trap! The protons count too. Neutrons = mass number minus atomic number.", "Die klassische Falle! Die Protonen zählen mit. Neutronen = Massenzahl minus Ordnungszahl."),
      },
      {
        text: tx("the number of protons, neutrons and electrons", "die Anzahl der Protonen, Neutronen und Elektronen"),
        title: tx("Electrons are too light", "Elektronen sind zu leicht"),
        say: tx("Electrons are so light that they don't count. Only the particles in the nucleus do.", "Elektronen sind so leicht, dass sie nicht mitzählen. Nur die Teilchen im Kern zählen."),
      },
    ],
    hint: tx("The mass of an atom sits almost entirely in its nucleus.", "Die Masse eines Atoms steckt fast komplett im Kern."),
    frame: { math: "A = Z + N", note: tx("Mass number = protons + neutrons, the particles in the nucleus.", "Massenzahl = Protonen + Neutronen, also die Teilchen im Kern.") },
  },
  {
    q: tx("What does the atomic number tell you?", "Was gibt die Ordnungszahl an?"),
    opts: [
      { text: tx("the number of protons", "die Anzahl der Protonen") },
      {
        text: tx("the number of neutrons", "die Anzahl der Neutronen"),
        title: tx("Neutrons can vary", "Neutronen können variieren"),
        say: tx("The neutrons can vary within one element. The atomic number counts the protons.", "Die Neutronen können bei einem Element verschieden sein. Die Ordnungszahl zählt die Protonen."),
      },
      {
        text: tx("the number of protons and neutrons", "die Anzahl der Protonen und Neutronen"),
        title: tx("That's the mass number", "Das ist die Massenzahl"),
        say: tx("Protons and neutrons together: that's the **mass number**.", "Protonen und Neutronen zusammen: Das ist die **Massenzahl**."),
      },
      {
        text: tx("the number of shells", "die Anzahl der Schalen"),
        title: tx("That's the period", "Das ist die Periode"),
        say: tx("The number of shells is the period. The atomic number counts the protons.", "Die Zahl der Schalen ist die Periode. Die Ordnungszahl zählt die Protonen."),
      },
    ],
    hint: tx("It is also the element's number in the periodic table.", "Sie ist auch die Nummer des Elements im Periodensystem."),
    frame: { math: `Z = ${P} = ${E}`, note: tx("The atomic number counts the protons (and, in a neutral atom, the electrons).", "Die Ordnungszahl zählt die Protonen (und im neutralen Atom auch die Elektronen).") },
  },
  {
    q: tx("What is most of an atom made of?", "Woraus besteht ein Atom zum größten Teil?"),
    opts: [
      { text: tx("empty space", "aus leerem Raum") },
      {
        text: tx("protons", "aus Protonen"),
        title: tx("The nucleus is tiny", "Der Kern ist winzig"),
        say: tx("Nearly all the **mass** is in the nucleus, but the nucleus is tiny. Most of the atom is empty space.", "Fast die ganze **Masse** steckt im Kern, aber der Kern ist winzig. Der größte Teil des Atoms ist leer."),
      },
      {
        text: tx("neutrons", "aus Neutronen"),
        title: tx("The nucleus is tiny", "Der Kern ist winzig"),
        say: tx("Nearly all the **mass** is in the nucleus, but the nucleus is tiny. Most of the atom is empty space.", "Fast die ganze **Masse** steckt im Kern, aber der Kern ist winzig. Der größte Teil des Atoms ist leer."),
      },
      {
        text: tx("electrons", "aus Elektronen"),
        title: tx("Electrons are tiny", "Elektronen sind winzig"),
        say: tx("Electrons are tiny and very light. Between them and the nucleus there's mostly nothing.", "Elektronen sind winzig und sehr leicht. Zwischen ihnen und dem Kern ist fast nichts."),
      },
    ],
    hint: tx("Rutherford shot particles at a thin gold foil. Almost all went straight through.", "Rutherford schoss Teilchen auf eine dünne Goldfolie. Fast alle flogen einfach hindurch."),
    frame: {
      math: tx(`"atom:" \\; 10^{-10} "m" \\quad "nucleus:" \\; 10^{-14} "m"`, `"Atom:" \\; 10^{-10} "m" \\quad "Kern:" \\; 10^{-14} "m"`),
      note: tx("The nucleus is about 10 000 times smaller than the whole atom. Most of the atom is empty space.", "Der Kern ist etwa 10 000-mal kleiner als das ganze Atom. Der größte Teil des Atoms ist leer."),
    },
  },
];

function factTask(rng: Rng): Exercise {
  const f = rng.pick(FACTS);
  const c = choice(rng, f.opts);
  return { instruction: tx("Pick the right answer", "Wähle die richtige Antwort"), text: f.q, answer: c.answer, hint: f.hint, solution: [f.frame], mistakes: c.mistakes };
}

// ---------------------------------------------------------------------------
// Isotopes: neutrons from the name and the periodic-table tile

function isotopeNeutronTask(rng: Rng, heavy: boolean): Exercise {
  const [sym, a] = rng.pick(heavy ? ISOTOPES_HEAVY : ISOTOPES_LIGHT);
  const e = el(sym);
  const z = e.z;
  const n = a - z;
  const rounded = Math.round(e.mass);
  const m = mistakes(num(n));
  m.add(
    num(a),
    tx("Neutrons aren't the mass number", "Neutronen ≠ Massenzahl"),
    tx(`Classic trap! ${a} is the mass number: protons and neutrons together. Take the protons away.`, `Die klassische Falle! ${a} ist die Massenzahl: Protonen und Neutronen zusammen. Zieh die Protonen ab.`),
  );
  m.add(num(z), tx("Those are the protons", "Das sind die Protonen"), tx("That's the atomic number, the protons. Neutrons = mass number minus atomic number.", "Das ist die Ordnungszahl, also die Protonen. Neutronen = Massenzahl minus Ordnungszahl."));
  if (rounded !== a)
    m.add(
      num(rounded - z),
      tx("Used the atomic mass", "Atommasse genommen"),
      txMap(
        (t, l) =>
          `${t("You used", "Du hast")} ${dec(e.mass, l)} u ${t("from the tile. That's the average of all isotopes. This isotope has its own mass number, right in its name:", "von der Kachel genommen. Das ist der Mittelwert aller Isotope. Dieses Isotop hat seine eigene Massenzahl, direkt im Namen:")} ${a}.`,
      ),
    );
  m.add(num(a + z), tx("Added instead of subtracted", "Addiert statt abgezogen"), tx("You added the two numbers. The protons are already part of the mass number, so subtract them.", "Du hast die beiden Zahlen addiert. Die Protonen sind schon in der Massenzahl enthalten, also zieh sie ab."));
  return {
    instruction: tx("Neutrons of an isotope", "Neutronen eines Isotops"),
    text: tx(`How many neutrons are in an atom of ${enName(e)}-${a}?`, `Wie viele Neutronen hat ein Atom des Isotops ${deName(e)}-${a}?`),
    visual: visual(ElementTile, { symbol: sym }),
    answer: num(n),
    hint: tx(`The number in "${enName(e)}-${a}" is the mass number. The atomic number is on the tile.`, `Die Zahl in „${deName(e)}-${a}“ ist die Massenzahl. Die Ordnungszahl steht auf der Kachel.`),
    solution: [
      { math: tx(`"${enName(e)}-${a}" \\Rightarrow A#A =#e1 ${a}#av`, `"${deName(e)}-${a}" \\Rightarrow A#A =#e1 ${a}#av`), note: tx("The number after the name is the **mass number**.", "Die Zahl hinter dem Namen ist die **Massenzahl**.") },
      { math: `A#A =#e1 ${a}#av \\quad Z#Z =#e2 ${z}#zv`, note: tx(`The tile gives the atomic number: $Z = ${z}$.`, `Die Kachel liefert die Ordnungszahl: $Z = ${z}$.`) },
      {
        math: `N =#e3 ${a}#av -#m ${z}#zv =#e4 ${n}#r`,
        note: txMap(
          (t, l) =>
            `${t(`$N = A - Z$: **${plEn(n, "neutron")}**. The`, `$N = A - Z$: **${plDe(n, "Neutron")}**. Die`)} ${dec(e.mass, l)} u ${t("on the tile are an average over all isotopes, so don't use them here.", "auf der Kachel sind ein Mittelwert aller Isotope, die brauchst du hier nicht.")}`,
        ),
      },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Ions: protons and electrons, symbol with charge

function ionPairTask(rng: Rng): Exercise {
  const [sym, a, q] = rng.pick(IONS_MAIN);
  const z = el(sym).z;
  const e = z - q;
  const right: AnswerSpec = { kind: "pair", names: [tx('"protons"', '"Protonen"'), tx('"electrons"', '"Elektronen"')], values: [z, e] };
  const pair = (x: number, y: number): AnswerSpec => ({ ...right, values: [x, y] }) as AnswerSpec;
  const m = mistakes(right);
  m.add(
    pair(z, z + q),
    tx("Charge read the wrong way", "Ladung falsch herum gedeutet"),
    q > 0
      ? tx("Ooh, classic trap! A **plus** charge means electrons are **missing**, not extra. Electrons carry the minus, so losing them leaves the ion positive.", "Oh, die klassische Falle! Eine **positive** Ladung heißt, dass Elektronen **fehlen**, nicht dass welche dazukommen. Elektronen tragen das Minus, wer welche abgibt, bleibt positiv zurück.")
      : tx("Ooh, classic trap! A **minus** charge means **extra** electrons: each electron brings a negative charge along.", "Oh, die klassische Falle! Eine **negative** Ladung heißt, dass **zusätzliche** Elektronen da sind: Jedes Elektron bringt eine negative Ladung mit."),
  );
  m.add(pair(z, z), tx("Charge overlooked", "Ladung übersehen"), tx("That would be the neutral atom. Look at the charge at the top right: it tells you how many electrons are missing or extra.", "Das wäre das neutrale Atom. Schau auf die Ladung oben rechts: Sie verrät, wie viele Elektronen fehlen oder dazukommen."));
  m.add(pair(a, a - q), tx("Started from the mass number", "Von der Massenzahl ausgegangen"), tx("You started from the top number, the mass number. The protons are the atomic number at the bottom left.", "Du bist von der oberen Zahl ausgegangen, der Massenzahl. Die Protonen sind die Ordnungszahl unten links."));
  m.add(pair(z, a - z), tx("Those are the neutrons", "Das sind die Neutronen"), tx("Your second number is the number of neutrons. The question asks for the electrons.", "Deine zweite Zahl ist die Zahl der Neutronen. Gefragt sind aber die Elektronen."));
  const k = Math.abs(q);
  return {
    instruction: tx("Protons and electrons of an ion", "Protonen und Elektronen eines Ions"),
    text: tx("This is the nuclide symbol of an ion. How many protons and how many electrons does it have?", "Das ist das Kernsymbol eines Ions. Wie viele Protonen und wie viele Elektronen hat es?"),
    visual: visual(NuclideCard, { symbol: sym, a, z, charge: q, size: 76 }),
    answer: right,
    hint: tx("Protons: the bottom number. A **positive** charge means electrons are **missing**, a negative charge means **extra** electrons.", "Protonen: die untere Zahl. Eine **positive** Ladung heißt, es **fehlen** Elektronen, eine negative heißt, es sind **zusätzliche** da."),
    solution: [
      { math: `${P} =#e1 Z#Z =#e2 ${z}#zv`, note: tx(`Protons = atomic number = ${z}. The charge doesn't change that.`, `Protonen = Ordnungszahl = ${z}. Daran ändert die Ladung nichts.`) },
      {
        math: `${E} =#e1 ${z}#zv ${q > 0 ? "-" : "+"}#m ${k}#qv =#e2 ${e}#r`,
        note:
          q > 0
            ? tx(`Charge ${chargeText(q)}: ${plEn(k, "electron")} fewer than protons. **${plEn(e, "electron")}**.`, `Ladung ${chargeText(q)}: ${plDe(k, "Elektron")} weniger als Protonen. **${plDe(e, "Elektron")}**.`)
            : tx(`Charge ${chargeText(q)}: ${plEn(k, "electron")} more than protons. **${plEn(e, "electron")}**.`, `Ladung ${chargeText(q)}: ${plDe(k, "Elektron")} mehr als Protonen. **${plDe(e, "Elektron")}**.`),
      },
    ],
    mistakes: m.list,
  };
}

function ionFormulaTask(rng: Rng, heavy: boolean): Exercise {
  const [sym, a, q] = rng.pick(heavy ? IONS_HEAVY : IONS_MAIN);
  const z = el(sym).z;
  const n = a - z;
  const e = z - q;
  const k = Math.abs(q);
  const right = ionFormula(sym, q);
  const m = mistakes(formula(right));
  m.add(
    formula(ionFormula(sym, -q)),
    tx("Charge sign flipped", "Vorzeichen der Ladung vertauscht"),
    q > 0
      ? tx("Nearly! Fewer electrons than protons means **positive**: there's less minus than plus.", "Fast! Weniger Elektronen als Protonen heißt **positiv**: Es gibt weniger Minus als Plus.")
      : tx("Nearly! More electrons than protons means **negative**: every extra electron brings a minus.", "Fast! Mehr Elektronen als Protonen heißt **negativ**: Jedes zusätzliche Elektron bringt ein Minus mit."),
  );
  if (e >= 1)
    m.add(
      formula(byNumber(e).symbol),
      tx("Element found from the electrons", "Element über die Elektronen gesucht"),
      tx(`You looked up ${e}, the number of electrons. But the element is decided by the **protons**: electrons can come and go.`, `Du hast ${e} nachgeschlagen, die Zahl der Elektronen. Das Element bestimmen aber die **Protonen**: Elektronen können kommen und gehen.`),
    );
  m.add(
    formula(sym),
    tx("Charge missing", "Ladung fehlt"),
    tx(`Right element! But ${z} protons and ${e} electrons don't balance, so the particle carries a charge.`, `Richtiges Element! Aber ${z} Protonen und ${e} Elektronen gleichen sich nicht aus, also trägt das Teilchen eine Ladung.`),
    true,
  );
  if (k >= 2)
    m.add(
      formula(`${sym}${k}${q > 0 ? "+" : "-"}`),
      tx("Write the charge with ^", "Ladung mit ^ schreiben"),
      tx(`Almost! Without the ^ the ${k} turns into a small index and means ${k} atoms. Put a ^ in front of the charge.`, `Fast! Ohne das ^ wird die ${k} zum kleinen Index und bedeutet ${k} Atome. Setz ein ^ vor die Ladung.`),
      true,
    );
  const ql = q > 0 ? `+${k}` : `-${k}`;
  return {
    instruction: tx("Write the symbol with charge", "Schreib das Symbol mit Ladung"),
    text: tx(
      `A particle has ${z} protons, ${n} neutrons and ${e} electrons. Which particle is it? Write its symbol with the charge.`,
      `Ein Teilchen hat ${z} Protonen, ${n} Neutronen und ${e} Elektronen. Welches Teilchen ist es? Schreib sein Symbol mit Ladung.`,
    ),
    visual: visual(LookupTable, heavy ? { periods: 6, full: true } : { periods: 4 }),
    answer: formula(right),
    hint: tx("The protons tell you the element. Charge = protons − electrons. Type the charge after a ^, for example ^2+ or ^-.", "Die Protonen verraten das Element. Ladung = Protonen − Elektronen. Tipp die Ladung hinter ein ^, zum Beispiel ^2+ oder ^-."),
    solution: [
      { math: `${z}#pv ${P} \\Rightarrow#r \\ce{${sym}#s}`, note: tx(`${z} protons: atomic number ${z} is **${enName(el(sym))}**.`, `${z} Protonen: Ordnungszahl ${z} ist **${deName(el(sym))}**.`) },
      {
        math: tx(`"charge" =#eq ${z}#pv -#m ${e}#ev =#eq2 ${ql}#q`, `"Ladung" =#eq ${z}#pv -#m ${e}#ev =#eq2 ${ql}#q`),
        note: tx(`${z} positive protons, ${e} negative electrons: charge ${chargeText(q)}.`, `${z} positive Protonen, ${e} negative Elektronen: Ladung ${chargeText(q)}.`),
      },
      { math: `\\ce{${right}}`, note: tx(`So it's the ion $\\ce{${right}}$. The ${n} neutrons don't change anything here.`, `Es ist also das Ion $\\ce{${right}}$. Die ${n} Neutronen ändern daran nichts.`) },
    ],
    mistakes: m.list,
  };
}

/** The element an ion comes from, given its electrons and charge. */
function ionElementTask(rng: Rng): Exercise {
  const pool = IONS_MAIN.filter(([s], i) => IONS_MAIN.findIndex(([t]) => t === s) === i);
  const [sym, , q] = rng.pick(pool);
  const e0 = el(sym);
  const z = e0.z;
  const e = z - q;
  const k = Math.abs(q);
  const m = mistakes(word(e0));
  m.add(
    word(byNumber(e)),
    tx("Looked up the electrons", "Elektronen nachgeschlagen"),
    q > 0
      ? tx(`You looked up ${e}, the number of electrons. In a positive ion electrons are missing, so that's not the atomic number.`, `Du hast ${e} nachgeschlagen, die Zahl der Elektronen. Einem positiven Ion fehlen aber Elektronen, das ist also nicht die Ordnungszahl.`)
      : tx(`You looked up ${e}, the number of electrons. A negative ion has extra electrons, so that's not the atomic number.`, `Du hast ${e} nachgeschlagen, die Zahl der Elektronen. Ein negatives Ion hat zusätzliche Elektronen, das ist also nicht die Ordnungszahl.`),
  );
  if (e - q >= 1)
    m.add(
      word(byNumber(e - q)),
      tx("Charge the wrong way round", "Ladung falsch herum"),
      q > 0
        ? tx("Careful with the sign: a positive ion has **given away** electrons, so it has **more** protons than electrons.", "Vorsicht mit dem Vorzeichen: Ein positives Ion hat Elektronen **abgegeben**, es hat also **mehr** Protonen als Elektronen.")
        : tx("Careful with the sign: a negative ion has **taken up** electrons, so it has **fewer** protons than electrons.", "Vorsicht mit dem Vorzeichen: Ein negatives Ion hat Elektronen **aufgenommen**, es hat also **weniger** Protonen als Elektronen."),
    );
  return {
    instruction: tx("Find the element", "Finde das Element"),
    text: tx(`An ion has ${e} electrons and a charge of ${chargeText(q)}. Which element does it come from?`, `Ein Ion hat ${e} Elektronen und ist ${multDe(q)} geladen (${chargeText(q)}). Von welchem Element stammt es?`),
    visual: visual(LookupTable, { periods: 4 }),
    answer: word(e0),
    hint: tx("A positive ion has given electrons away, a negative ion has taken some up. Work out the number of protons first.", "Ein positives Ion hat Elektronen abgegeben, ein negatives hat welche aufgenommen. Rechne zuerst die Zahl der Protonen aus."),
    solution: [
      {
        math: `Z#Z =#e1 ${e}#ev ${q > 0 ? "+" : "-"}#m ${k}#qv`,
        note:
          q > 0
            ? tx(`Charge ${chargeText(q)}: ${plEn(k, "electron")} missing, so there are ${k} more protons than electrons.`, `Ladung ${chargeText(q)}: Es fehlen ${plDe(k, "Elektron")}, also gibt es ${k} Protonen mehr als Elektronen.`)
            : tx(`Charge ${chargeText(q)}: ${plEn(k, "electron")} extra, so there are ${k} fewer protons than electrons.`, `Ladung ${chargeText(q)}: ${plDe(k, "Elektron")} zu viel, also gibt es ${k} Protonen weniger als Elektronen.`),
      },
      { math: `Z#Z =#e1 ${z}#r \\Rightarrow#to \\ce{${sym}#s}`, note: tx(`Atomic number ${z}: **${enName(e0)}**. The ion is $\\ce{${ionFormula(sym, q)}}$.`, `Ordnungszahl ${z}: **${deName(e0)}**. Das Ion ist $\\ce{${ionFormula(sym, q)}}$.`) },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// The shell model

const shellLine = (layers: number[], hlLast = false, upTo = layers.length) =>
  layers
    .slice(0, upTo)
    .map((c, j) => `\\group{"${SHELL[j]}:" ${hlLast && j === layers.length - 1 ? `\\hl{${c}#s${j}}` : `${c}#s${j}`}}`)
    .join(" \\quad ");
const fmtShells = (layers: number[]) => layers.map((c, j) => `${SHELL[j]}: ${c}`).join(" · ");

/** Fill the shells of a neutral atom frame by frame. */
function fillFrames(z: number, finalNote?: Text): Frame[] {
  const layers = shells(z);
  const frames: Frame[] = [
    { math: `${z}#tot ${E}`, note: tx(`Atomic number ${z}: **${plEn(z, "electron")}** to place, from the inside out.`, `Ordnungszahl ${z}: **${plDe(z, "Elektron")}** sind zu verteilen, von innen nach außen.`) },
  ];
  let left = z;
  layers.forEach((c, i) => {
    left -= c;
    const full = c === [2, 8, 8, 8][i] && (i < 2 || left > 0);
    const capEn = i === 2 && z >= 19 ? " It could hold 18, but the outermost shell holds at most 8." : "";
    const capDe = i === 2 && z >= 19 ? " Sie könnte 18 fassen, aber die äußerste Schale trägt höchstens 8." : "";
    frames.push({
      math: shellLine(layers, false, i + 1),
      note: tx(
        `${SHELL[i]} shell: ${plEn(c, "electron")}${full ? " (full)" : ""}.${capEn} ${left ? `${left} left.` : "All placed!"}`,
        `${SHELL[i]}-Schale: ${plDe(c, "Elektron")}${full ? " (voll)" : ""}.${capDe} ${left ? `Noch ${left} übrig.` : "Alle verteilt!"}`,
      ),
    });
  });
  if (finalNote) frames.push({ math: shellLine(layers, true), note: finalNote });
  return frames;
}

/** Electrons filled into shells with the given capacities (to simulate wrong rules). */
function capFill(z: number, caps: number[]): number[] {
  const out: number[] = [];
  let left = z;
  for (const c of caps) {
    if (left <= 0) break;
    out.push(Math.min(c, left));
    left -= c;
  }
  return out;
}

function shellsExercise(rng: Rng, z: number): Exercise {
  const e = byNumber(z);
  const layers = shells(z);
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const cands: Opt[] = [];
  if (z > 10 && z <= 18)
    cands.push({
      text: fmtShells([2, z - 2]),
      title: tx("L shell overfilled", "L-Schale überfüllt"),
      say: tx("The L shell holds at most **8** electrons. Once it's full, the next shell starts.", "Auf die L-Schale passen höchstens **8** Elektronen. Ist sie voll, beginnt die nächste Schale."),
    });
  if (z > 2)
    cands.push({
      text: fmtShells(capFill(z, [8, 8, 8, 8])),
      title: tx("K shell overfilled", "K-Schale überfüllt"),
      say: tx("The innermost shell, K, only has room for **2** electrons.", "Die innerste Schale, K, hat nur Platz für **2** Elektronen."),
    });
  if (z >= 19)
    cands.push({
      text: fmtShells([2, 8, z - 10]),
      title: tx("Outer shell over 8", "Außenschale über 8"),
      say: tx("The M shell could take 18, but the **outermost** shell never holds more than 8. So the next electrons start a new shell.", "Die M-Schale könnte 18 fassen, aber auf der **äußersten** Schale sind nie mehr als 8 Elektronen. Darum beginnen die nächsten eine neue Schale."),
    });
  const rev = [...layers].reverse();
  if (rev.join() !== layers.join())
    cands.push({
      text: fmtShells(rev),
      title: tx("Filled from the outside", "Von außen aufgefüllt"),
      say: tx("The shells fill **from the inside out**: first K, right at the nucleus, then L, then M.", "Die Schalen werden **von innen nach außen** besetzt: zuerst K direkt am Kern, dann L, dann M."),
    });
  {
    const d = z === 20 || (z > 1 && rng.chance(0.5)) ? -1 : 1;
    const s = shells(z + d);
    cands.push({
      text: fmtShells(s),
      title: tx("Miscounted", "Verzählt"),
      say: tx(`Count again: your numbers add up to ${sum(s)}, but ${anAtom(e)} has ${z} electrons.`, `Zähl noch mal nach: Deine Zahlen ergeben zusammen ${sum(s)}, ein ${deAtom(e)} hat aber ${z} Elektronen.`),
    });
  }
  const seen = new Set([fmtShells(layers)]);
  const picked: Opt[] = [];
  for (const c of rng.shuffle(cands)) {
    const key = resolveText(c.text, "en");
    if (seen.has(key) || picked.length >= 3) continue;
    seen.add(key);
    picked.push(c);
  }
  const c = choice(rng, [{ text: fmtShells(layers) }, ...picked]);
  return {
    instruction: tx("Pick the electron arrangement", "Wähle die Elektronenverteilung"),
    text: tx(`How are the electrons of ${anAtom(e)} arranged on the shells? (atomic number ${z})`, `Wie sind die Elektronen eines ${deAtom(e)}s auf die Schalen verteilt? (Ordnungszahl ${z})`),
    answer: c.answer,
    hint: tx("Fill from the inside out: K holds 2, L holds 8, and the outermost shell never more than 8.", "Fülle von innen nach außen: K fasst 2, L fasst 8, und die äußerste Schale nie mehr als 8."),
    solution: fillFrames(z),
    mistakes: c.mistakes,
  };
}

function shellsIonExercise(rng: Rng): Exercise {
  const pool = IONS_MAIN.filter(([s], i) => IONS_MAIN.findIndex(([t]) => t === s) === i);
  const [sym, , q] = rng.pick(pool);
  const z = el(sym).z;
  const k = Math.abs(q);
  const f = ionFormula(sym, q);
  const neutral = shells(z);
  const ion = ionShells(z, q);
  const cands: Opt[] = [
    {
      text: fmtShells(neutral),
      title: tx("That's the neutral atom", "Das ist das neutrale Atom"),
      say:
        q > 0
          ? tx(`That's the neutral atom. The ion has **given away** ${plEn(k, "electron")} from its outer shell.`, `Das ist das neutrale Atom. Das Ion hat ${plDe(k, "Elektron")} von der Außenschale **abgegeben**.`)
          : tx(`That's the neutral atom. The ion has **taken up** ${plEn(k, "electron")} on its outer shell.`, `Das ist das neutrale Atom. Das Ion hat ${plDe(k, "Elektron")} auf der Außenschale **aufgenommen**.`),
    },
    {
      text: fmtShells(shells(z + q)),
      title: tx("Wrong direction", "Falsche Richtung"),
      say:
        q > 0
          ? tx("A **positive** charge means electrons were **given away**, not taken up.", "Eine **positive** Ladung heißt, dass Elektronen **abgegeben** wurden, nicht aufgenommen.")
          : tx("A **negative** charge means electrons were **taken up**, not given away.", "Eine **negative** Ladung heißt, dass Elektronen **aufgenommen** wurden, nicht abgegeben."),
    },
  ];
  if (q > 0 && neutral.length >= 2) {
    const inner = [...neutral];
    inner[inner.length - 2] -= k;
    cands.push({
      text: fmtShells(inner),
      title: tx("Taken from an inner shell", "Von innen weggenommen"),
      say: tx("Atoms give away electrons from the **outer** shell, the ones furthest from the nucleus.", "Atome geben Elektronen von der **äußeren** Schale ab, also die, die am weitesten vom Kern weg sind."),
    });
  }
  if (q < 0) {
    cands.push({
      text: fmtShells([...neutral, k]),
      title: tx("New shell opened", "Neue Schale angefangen"),
      say: tx("The extra electrons go onto the outer shell. It still has room until it holds 8.", "Die zusätzlichen Elektronen kommen auf die Außenschale. Dort ist noch Platz, bis 8 erreicht sind."),
    });
  }
  const seen = new Set([fmtShells(ion)]);
  const picked = cands.filter((c) => {
    const key = resolveText(c.text, "en");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const c = choice(rng, [{ text: fmtShells(ion) }, ...picked.slice(0, 3)]);
  const noble = { 2: "He", 10: "Ne", 18: "Ar" }[ion.reduce((s, x) => s + x, 0)];
  return {
    instruction: tx("Pick the electron arrangement", "Wähle die Elektronenverteilung"),
    text: tx(`How are the electrons of the ion $\\ce{${f}}$ arranged on the shells? (atomic number ${z})`, `Wie sind die Elektronen des Ions $\\ce{${f}}$ auf die Schalen verteilt? (Ordnungszahl ${z})`),
    answer: c.answer,
    hint: tx("Start with the neutral atom. A positive ion has given away outer electrons, a negative ion has taken some up.", "Fang beim neutralen Atom an. Ein positives Ion hat Außenelektronen abgegeben, ein negatives hat welche aufgenommen."),
    solution: [
      { math: `\\ce{${sym}} \\quad ${shellLine(neutral)}`, note: tx(`The neutral ${enName(el(sym))} atom: ${neutral.join(", ")}.`, `Das neutrale ${deAtom(el(sym))}: ${neutral.join(", ")}.`) },
      {
        math: `\\ce{${f}} \\quad ${shellLine(ion)}`,
        note:
          q > 0
            ? tx(`Charge ${chargeText(q)}: ${plEn(k, "electron")} leave the outer shell. Now it's arranged like ${noble}.`, `Ladung ${chargeText(q)}: ${plDe(k, "Elektron")} verlassen die Außenschale. Jetzt ist die Verteilung wie bei ${noble}.`)
            : tx(`Charge ${chargeText(q)}: ${plEn(k, "electron")} join the outer shell. Now it's arranged like ${noble}.`, `Ladung ${chargeText(q)}: ${plDe(k, "Elektron")} kommen auf die Außenschale. Jetzt ist die Verteilung wie bei ${noble}.`),
      },
    ],
    mistakes: c.mistakes,
  };
}

function outerExercise(z: number): Exercise {
  const e = byNumber(z);
  const layers = shells(z);
  const outer = layers[layers.length - 1];
  const m = mistakes(num(outer));
  m.add(num(z), tx("All electrons counted", "Alle Elektronen gezählt"), tx("That's all the electrons. Only the ones on the **outermost** shell are outer electrons.", "Das sind alle Elektronen. Außenelektronen sind nur die auf der **äußersten** Schale."));
  if (z >= 19)
    m.add(
      num(z - 10),
      tx("M shell overfilled", "M-Schale überfüllt"),
      tx("The outermost shell never holds more than 8 electrons. Once M has 8, the N shell starts.", "Auf der äußersten Schale sind nie mehr als 8 Elektronen. Hat M 8, beginnt die N-Schale."),
    );
  m.add(num(layers.length), tx("Number of shells", "Anzahl der Schalen"), tx("That's the number of shells. Count the electrons on the last shell.", "Das ist die Zahl der Schalen. Zähl die Elektronen auf der letzten Schale."));
  if (outer < 8)
    m.add(num(8 - outer), tx("Counted the gaps", "Lücken gezählt"), tx("That's how many are **missing** to make 8. The question is how many are already there.", "So viele **fehlen** bis zur 8. Gefragt ist, wie viele schon da sind."));
  if (z > 10 && z < 19) m.add(num(8), tx("That's the L shell", "Das ist die L-Schale"), tx("8 is the L shell. Outer electrons sit on the very last shell.", "8 ist die L-Schale. Außenelektronen sitzen auf der allerletzten Schale."));
  return {
    instruction: tx("Count the outer electrons", "Bestimme die Außenelektronen"),
    text: tx(`How many outer electrons does ${anAtom(e)} have? (atomic number ${z})`, `Wie viele Außenelektronen hat ein ${deAtom(e)}? (Ordnungszahl ${z})`),
    answer: num(outer),
    hint: tx("Distribute the electrons: K holds 2, L 8, then M. The outer electrons are on the last shell.", "Verteile die Elektronen: K fasst 2, L 8, dann M. Die Außenelektronen sitzen auf der letzten Schale."),
    solution: fillFrames(z, tx(`The last shell holds **${plEn(outer, "outer electron")}**.`, `Auf der letzten Schale: **${plDe(outer, "Außenelektron")}**.`)),
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Average atomic mass from an isotope mixture

function averageMassTask(rng: Rng): Exercise {
  const [sym, parts] = rng.pick(MIXTURES);
  const e = el(sym);
  const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
  const exactValue = r4(parts.reduce((s, [A, p]) => s + (A * p) / 100, 0));
  const right = Math.round(exactValue * 10) / 10;
  const abs = 0.051;
  const nm = (v: number) => num(v, abs / v);
  const m = mistakes(nm(right));
  const plain = r4(parts.reduce((s, [A]) => s + A, 0) / parts.length);
  if (Math.abs(plain - exactValue) > 0.15)
    m.add(nm(plain), tx("Plain average", "Einfacher Mittelwert"), tx("You took the plain average. But the isotopes aren't equally common: weight each mass number with its share.", "Du hast den einfachen Mittelwert genommen. Die Isotope sind aber nicht gleich häufig: Gewichte jede Massenzahl mit ihrem Anteil."));
  if (parts.length === 2) {
    const swapped = r4((parts[0][0] * parts[1][1] + parts[1][0] * parts[0][1]) / 100);
    m.add(nm(swapped), tx("Shares swapped", "Anteile vertauscht"), tx("I think you swapped the shares. Each percentage belongs to the isotope right next to it.", "Ich glaub, du hast die Anteile vertauscht. Jeder Prozentwert gehört zu dem Isotop direkt daneben."));
  }
  m.add(
    nm(r4(exactValue * 100)),
    tx("Percent not turned into a decimal", "Prozent nicht umgerechnet"),
    tx("Looks like you multiplied by the percentages themselves. Turn each one into a decimal first: 75% is 0.75.", "Sieht so aus, als hättest du mit den Prozentzahlen selbst gerechnet. Mach aus jeder erst eine Dezimalzahl: 75 % sind 0,75."),
  );
  const top = parts.reduce((b, x) => (x[1] > b[1] ? x : b))[0];
  if (Math.abs(top - exactValue) > 0.3)
    m.add(nm(top), tx("Only the common isotope", "Nur das häufigste Isotop"), tx("You took only the most common isotope. The rarer ones count too, just less.", "Du hast nur das häufigste Isotop genommen. Die selteneren zählen auch mit, nur weniger."));
  const pct = (p: number, l: "en" | "de") => (l === "de" ? `${dec(p, l, 1)} %` : `${dec(p, l, 1)}%`);
  const list = (l: "en" | "de") => {
    const items = parts.map(([A, p]) => `${pct(p, l)} ${l === "de" ? deName(e) : enName(e)}-${A}`);
    return `${items.slice(0, -1).join(", ")} ${l === "de" ? "und" : "and"} ${items[items.length - 1]}`;
  };
  const sumSrc = (l: "en" | "de", products: boolean) =>
    parts.map(([A, p], i) => (products ? `${dec(r4((A * p) / 100), l, 4)}#p${i}` : `${dec(p / 100, l, 3)}#p${i} \\cdot ${A}#a${i}`)).join(" + ");
  const rounded = right;
  const exact = Math.abs(rounded - exactValue) < 1e-9;
  return {
    instruction: tx("Average atomic mass", "Mittlere Atommasse"),
    text: txMap((t, l) =>
      t(
        `Natural ${enName(e)} is a mixture of ${list(l)}. Work out the average atomic mass. Use the mass numbers as the masses in u and round to one decimal place.`,
        `Natürliches ${deName(e)} ist ein Gemisch aus ${list(l)}. Berechne die mittlere Atommasse. Rechne mit den Massenzahlen als Massen in u und runde auf eine Nachkommastelle.`,
      ),
    ),
    answer: { kind: "number", value: right, tolerance: abs / right, unit: "u" },
    hint: tx("Multiply each mass number by its share (75% is 0.75) and add everything up.", "Multipliziere jede Massenzahl mit ihrem Anteil (75 % sind 0,75) und addiere alles."),
    solution: [
      { math: txMap((_, l) => `m =#e1 ${sumSrc(l, false)}`), note: tx("Each isotope counts with its share: a percentage as a decimal.", "Jedes Isotop zählt mit seinem Anteil: den Prozentwert als Dezimalzahl.") },
      { math: txMap((_, l) => `m =#e1 ${sumSrc(l, true)}`), note: tx("Multiply.", "Ausmultiplizieren.") },
      {
        math: txMap((_, l) => `m ${exact ? "=" : "\\approx"}#e1 ${dec(rounded, l, 1)}#r "u"`),
        note: txMap(
          (t, l) =>
            `${t("Average atomic mass: about", "Mittlere Atommasse: etwa")} **${dec(rounded, l, 1)} u**. ${t("The periodic table lists", "Im Periodensystem stehen")} ${dec(e.mass, l)} u${t(": it uses the exact isotope masses and shares.", ", weil dort mit den genauen Isotopenmassen und Anteilen gerechnet wird.")}`,
        ),
      },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Isotopes: select all true statements

type Stmt = "sameP" | "diffN" | "diffA" | "sameE" | "sameChem" | "diffEl" | "diffP" | "sameN" | "diffOuter" | "sameA";
const STATEMENTS: Record<Stmt, Text> = {
  sameP: tx("They have the same number of protons.", "Sie haben gleich viele Protonen."),
  diffN: tx("They have different numbers of neutrons.", "Sie haben unterschiedlich viele Neutronen."),
  diffA: tx("They have different mass numbers.", "Sie haben verschiedene Massenzahlen."),
  sameE: tx("They have the same number of electrons.", "Sie haben gleich viele Elektronen."),
  sameChem: tx("They react the same way chemically.", "Sie reagieren chemisch gleich."),
  diffEl: tx("They are atoms of two different elements.", "Es sind Atome zweier verschiedener Elemente."),
  diffP: tx("They have different numbers of protons.", "Sie haben unterschiedlich viele Protonen."),
  sameN: tx("They have the same number of neutrons.", "Sie haben gleich viele Neutronen."),
  diffOuter: tx("They have different numbers of outer electrons.", "Sie haben unterschiedlich viele Außenelektronen."),
  sameA: tx("They have the same mass number.", "Sie haben dieselbe Massenzahl."),
};
const TRUE_STMTS: Stmt[] = ["sameP", "diffN", "diffA", "sameE", "sameChem"];
const FALSE_STMTS: Stmt[] = ["diffEl", "diffP", "sameN", "diffOuter", "sameA"];
const ISOTOPE_PAIRS: [string, number, number][] = [
  ["H", 1, 2], ["H", 1, 3], ["C", 12, 13], ["C", 12, 14], ["N", 14, 15], ["O", 16, 18], ["Li", 6, 7], ["B", 10, 11],
  ["Ne", 20, 22], ["Mg", 24, 26], ["Cl", 35, 37], ["K", 39, 41], ["Cu", 63, 65], ["Br", 79, 81], ["U", 235, 238],
];

function isotopeMultiTask(rng: Rng): Exercise {
  const [sym, a1, a2] = rng.pick(ISOTOPE_PAIRS);
  const e = el(sym);
  const z = e.z;
  const trues = rng.shuffle(TRUE_STMTS).slice(0, rng.int(2, 3));
  const falses = rng.shuffle(FALSE_STMTS).slice(0, 5 - trues.length);
  const ids = rng.shuffle([...trues, ...falses]);
  const options = ids.map((s) => STATEMENTS[s]);
  const idx = (list: Stmt[]) => ids.map((s, i) => (list.includes(s) ? i : -1)).filter((i) => i >= 0);
  const correct = idx(trues);
  const right: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(right);
  const variant = (drop: Stmt[], addIn: Stmt[]) => idx([...trues.filter((s) => !drop.includes(s)), ...addIn]);
  const tryAdd = (set: number[], title: Text, say: Text) => {
    if (set.length) m.add({ kind: "multi", options, correct: set }, title, say);
  };
  tryAdd(
    variant(["sameP"], ["diffP", "diffEl"]),
    tx("Isotopes are one element", "Isotope sind ein Element"),
    tx("Isotopes always belong to the **same element**, so they have the same number of protons. Only the neutrons differ.", "Isotope gehören immer zum **selben Element**, haben also gleich viele Protonen. Nur die Neutronen sind verschieden."),
  );
  tryAdd(
    variant(["sameE", "sameChem"], ["diffOuter"]),
    tx("Neutrons don't touch the shells", "Neutronen ändern die Hülle nicht"),
    tx("The neutrons sit in the nucleus and don't change the electron shells. Same protons means same electrons, so isotopes react the same way.", "Die Neutronen sitzen im Kern und ändern nichts an der Atomhülle. Gleich viele Protonen heißt gleich viele Elektronen, darum reagieren Isotope gleich."),
  );
  tryAdd(
    variant(["diffN", "diffA"], ["sameN", "sameA"]),
    tx("The difference is the neutrons", "Der Unterschied sind die Neutronen"),
    tx("Isotopes differ exactly in their number of neutrons, and so in their mass number.", "Isotope unterscheiden sich genau in der Zahl ihrer Neutronen und damit in der Massenzahl."),
  );
  return {
    instruction: tx("Select all true statements", "Wähle alle richtigen Aussagen"),
    text: tx(`Which statements about atoms of ${enName(e)}-${a1} and ${enName(e)}-${a2} are true?`, `Welche Aussagen über Atome von ${deName(e)}-${a1} und ${deName(e)}-${a2} stimmen?`),
    answer: right,
    hint: tx("Isotopes are atoms of the same element. What can differ, and what can't?", "Isotope sind Atome desselben Elements. Was kann sich unterscheiden, was nicht?"),
    solution: [
      { math: `\\ce{^{${a1}}${sym}} \\quad \\ce{^{${a2}}${sym}}`, note: tx(`Same symbol, same element: both have **${plEn(z, "proton")}**.`, `Gleiches Symbol, gleiches Element: Beide haben **${plDe(z, "Proton")}**.`) },
      {
        math: `${z} ${P} , \\hl{${a1 - z}} ${N} \\quad ${z} ${P} , \\hl{${a2 - z}} ${N}`,
        note: tx(`Different numbers of neutrons (${a1 - z} and ${a2 - z}), so different mass numbers. As neutral atoms both have ${z} electrons, arranged the same way: that's why they react the same.`, `Unterschiedlich viele Neutronen (${a1 - z} und ${a2 - z}), also verschiedene Massenzahlen. Als neutrale Atome haben beide ${z} Elektronen, gleich verteilt: Darum reagieren sie gleich.`),
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
  for (const [w, f] of items) {
    if ((r -= w) < 0) return f();
  }
  return items[items.length - 1][1]();
}

function generate(level: Level, rng: Rng): Exercise {
  if (level === 1)
    return weighted(rng, [
      [4, () => countTask(rng)],
      [2.5, () => elementTask(rng)],
      [3.5, () => factTask(rng)],
    ]);
  if (level === 2)
    return weighted(rng, [
      [1.5, () => isotopeNeutronTask(rng, false)],
      [1.7, () => ionPairTask(rng)],
      [1.7, () => ionFormulaTask(rng, false)],
      [2, () => shellsExercise(rng, rng.int(3, 18))],
      [1.6, () => outerExercise(rng.int(3, 20))],
      [1.5, () => nucleusMassTask(rng)],
    ]);
  return weighted(rng, [
    [2, () => averageMassTask(rng)],
    [1.6, () => ionElementTask(rng)],
    [1.6, () => shellsIonExercise(rng)],
    [0.8, () => shellsExercise(rng, rng.pick([19, 20]))],
    [1.6, () => isotopeMultiTask(rng)],
    [1.2, () => isotopeNeutronTask(rng, true)],
    [1.2, () => ionFormulaTask(rng, true)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const isotopeCheck = choice(createRng(3), [
  { text: tx("the number of neutrons", "die Anzahl der Neutronen") },
  {
    text: tx("the number of protons", "die Anzahl der Protonen"),
    title: tx("Same protons", "Gleich viele Protonen"),
    say: tx("Both are carbon, so both have 6 protons. Different protons would mean a different element.", "Beide sind Kohlenstoff, haben also 6 Protonen. Andere Protonen hieße: ein anderes Element."),
  },
  {
    text: tx("the number of electrons", "die Anzahl der Elektronen"),
    title: tx("Same electrons", "Gleich viele Elektronen"),
    say: tx("Neutral atoms have as many electrons as protons: 6 in both. The difference hides in the nucleus.", "Neutrale Atome haben so viele Elektronen wie Protonen: bei beiden 6. Der Unterschied steckt im Kern."),
  },
  {
    text: tx("the element", "das Element"),
    title: tx("Same element", "Gleiches Element"),
    say: tx("Isotopes always belong to the same element. Here both are carbon.", "Isotope gehören immer zum selben Element. Hier sind beide Kohlenstoff."),
  },
]);

const lesson: Topic["lesson"] = [
  {
    type: "explain",
    title: tx("What's inside an atom?", "Was steckt in einem Atom?"),
    blob: tx("Let's zoom in. Way, way in!", "Lass uns reinzoomen. Ganz, ganz tief!"),
    body: tx(
      "Every atom has a tiny **nucleus** in the middle. The **electrons** move in the space around it. An atom is almost empty: if it were as big as a football stadium, the nucleus would be about the size of a pea.",
      "Jedes Atom hat in der Mitte einen winzigen **Atomkern**. Drumherum, in der **Atomhülle**, bewegen sich die **Elektronen**. Ein Atom ist fast leer: Wäre es so groß wie ein Fußballstadion, wäre der Kern nur etwa so groß wie eine Erbse.",
    ),
    frames: [
      { math: `${P} \\quad ${N} \\quad ${E}`, note: tx('Three kinds of particles: **protons** $"p⁺"$, **neutrons** $"n"$ and **electrons** $"e⁻"$.', 'Drei Sorten Teilchen: **Protonen** $"p⁺"$, **Neutronen** $"n"$ und **Elektronen** $"e⁻"$.') },
      {
        math: tx(`"nucleus:" \\; ${P} , ${N} \\quad "around it:" \\; ${E}`, `"Atomkern:" \\; ${P} , ${N} \\quad "Atomhülle:" \\; ${E}`),
        note: tx("Protons and neutrons sit together in the nucleus. The electrons move around it.", "Protonen und Neutronen sitzen zusammen im Atomkern. Die Elektronen bewegen sich in der Atomhülle drumherum."),
      },
      { math: `${P} \\; (+1) \\quad ${N} \\; (0) \\quad ${E} \\; (-1)`, note: tx("Charges: a proton carries **+1**, an electron **−1**, a neutron has **no charge**.", "Ladungen: Ein Proton trägt **+1**, ein Elektron **−1**, ein Neutron ist **ungeladen**.") },
      {
        math: `${P} \\approx 1 "u" \\quad ${N} \\approx 1 "u" \\quad ${E} \\approx 0 "u"`,
        note: tx("Protons and neutrons both have a mass of about **1 u** (atomic mass unit). An electron is about 1800 times lighter: almost nothing.", "Protonen und Neutronen haben beide etwa **1 u** (atomare Masseneinheit). Ein Elektron ist rund 1800-mal leichter: fast nichts."),
      },
      { math: `11 ${P} \\quad 11 ${E}`, note: tx("A sodium atom has 11 protons and 11 electrons.", "Ein Natriumatom hat 11 Protonen und 11 Elektronen.") },
      { math: "(+11) + (-11) = 0", note: tx("The charges cancel out exactly. Every atom is electrically **neutral**.", "Die Ladungen heben sich genau auf. Jedes Atom ist nach außen elektrisch **neutral**.") },
    ],
  },
  {
    type: "explain",
    title: tx("Atomic number and mass number", "Ordnungszahl und Massenzahl"),
    blob: tx("Two numbers tell you everything about the nucleus.", "Zwei Zahlen verraten dir alles über den Kern."),
    frames: [
      {
        math: tx('Z#Z =#e1 "number of protons"#tz', 'Z#Z =#e1 "Anzahl der Protonen"#tz'),
        note: tx("The **atomic number** $Z$ counts the protons. It decides the element: every atom with 11 protons is sodium.", "Die **Ordnungszahl** $Z$ zählt die Protonen. Sie bestimmt das Element: Jedes Atom mit 11 Protonen ist Natrium."),
      },
      {
        math: tx('A#A =#e2 "protons"#tp +#pl "neutrons"#tn', 'A#A =#e2 "Protonen"#tp +#pl "Neutronen"#tn'),
        note: tx("The **mass number** $A$ counts protons and neutrons together: all the particles in the nucleus.", "Die **Massenzahl** $A$ zählt Protonen und Neutronen zusammen: alle Teilchen im Kern."),
      },
      { math: "A#A =#e2 Z#Z +#pl N#N", note: tx("In short: $A = Z + N$, with $N$ the number of neutrons.", "Kurz: $A = Z + N$, mit $N$ als Zahl der Neutronen.") },
      { math: "N#N =#e2 A#A -#pl Z#Z", note: tx("Turned around: **neutrons $N = A - Z$**. You'll need this one a lot!", "Umgestellt: **Neutronen $N = A - Z$**. Die brauchst du ständig!"), highlight: ["N"] },
      { math: "N#N =#e2 23#A -#pl 11#Z", note: tx("Sodium-23: mass number $A = 23$, atomic number $Z = 11$.", "Natrium-23: Massenzahl $A = 23$, Ordnungszahl $Z = 11$.") },
      { math: "N#N =#e2 12#r", note: tx("So a sodium-23 atom has **12 neutrons**. In the nuclide symbol, $A$ is written top left and $Z$ bottom left. You'll see it next.", "Ein Atom Natrium-23 hat also **12 Neutronen**. Im Kernsymbol steht $A$ oben links und $Z$ unten links. Gleich siehst du es.") },
    ],
  },
  {
    type: "widget",
    title: tx("Build your own atom", "Bau dein eigenes Atom"),
    blob: tx("Your atom lab is open! What happens when you add a proton?", "Dein Atomlabor ist offen! Was passiert, wenn du ein Proton dazugibst?"),
    body: tx(
      "Add and remove protons, neutrons and electrons. Watch the element, the mass number and the charge change. Which change makes a new element, which an isotope, which an ion?",
      "Nimm Protonen, Neutronen und Elektronen dazu oder weg. Schau, wie sich Element, Massenzahl und Ladung ändern. Welche Änderung macht ein neues Element, welche ein Isotop, welche ein Ion?",
    ),
    widget: AtomsBuilder,
  },
  {
    type: "check",
    blob: tx("Your turn! Read the nuclide symbol carefully.", "Du bist dran! Lies das Kernsymbol genau."),
    exercise: countExercise(17, 35, "n"),
  },
  {
    type: "explain",
    title: tx("Isotopes: same element, different mass", "Isotope: gleiches Element, andere Masse"),
    blob: tx("Not every carbon atom is the same. Sneaky, right?", "Nicht jedes Kohlenstoffatom ist gleich. Ganz schön raffiniert, oder?"),
    body: tx(
      "Atoms of the same element always have the same number of protons. The number of neutrons can differ. Such atoms are called **isotopes**.",
      "Atome desselben Elements haben immer gleich viele Protonen. Die Zahl der Neutronen kann sich aber unterscheiden. Solche Atome heißen **Isotope**.",
    ),
    frames: [
      { math: `"C-12:" \\; 6#p1 ${P} \\;\\; 6#n1 ${N}`, note: tx("Carbon-12: 6 protons, 6 neutrons. About 99% of all carbon atoms look like this.", "Kohlenstoff-12: 6 Protonen, 6 Neutronen. Etwa 99 % aller Kohlenstoffatome sehen so aus.") },
      {
        math: `"C-12:" \\; 6#p1 ${P} \\;\\; 6#n1 ${N} \\\\ "C-13:" \\; 6#p2 ${P} \\;\\; 7#n2 ${N}`,
        note: tx("Carbon-13: still 6 protons, so still carbon. But 7 neutrons.", "Kohlenstoff-13: immer noch 6 Protonen, also immer noch Kohlenstoff. Aber 7 Neutronen."),
      },
      {
        math: `"C-12:" \\; 6#p1 ${P} \\;\\; 6#n1 ${N} \\\\ "C-13:" \\; 6#p2 ${P} \\;\\; 7#n2 ${N} \\\\ "C-14:" \\; 6#p3 ${P} \\;\\; 8#n3 ${N}`,
        note: tx("Carbon-14 has 8 neutrons. It's radioactive and helps to date old bones and wood.", "Kohlenstoff-14 hat 8 Neutronen. Es ist radioaktiv und hilft, das Alter von alten Knochen und Holz zu bestimmen."),
      },
      {
        math: `"C-12:" \\; 6#p1 ${P} \\;\\; 6#n1 ${N} \\\\ "C-13:" \\; 6#p2 ${P} \\;\\; 7#n2 ${N} \\\\ "C-14:" \\; 6#p3 ${P} \\;\\; 8#n3 ${N}`,
        highlight: ["n1", "n2", "n3"],
        note: tx("Same protons, different neutrons: these are the **isotopes** of carbon. They react the same way, only their mass differs.", "Gleiche Protonen, verschiedene Neutronen: Das sind die **Isotope** des Kohlenstoffs. Sie reagieren gleich, nur ihre Masse ist verschieden."),
      },
      {
        math: tx('76 "%" \\; \\ce{^{35}Cl} \\quad 24 "%" \\; \\ce{^{37}Cl}', '76 "%" \\; \\ce{^{35}Cl} \\quad 24 "%" \\; \\ce{^{37}Cl}'),
        note: tx("Chlorine is a mix of two isotopes: about 76% chlorine-35 and 24% chlorine-37.", "Chlor ist ein Gemisch aus zwei Isotopen: etwa 76 % Chlor-35 und 24 % Chlor-37."),
      },
      {
        math: tx('76 "%" \\; \\ce{^{35}Cl} \\quad 24 "%" \\; \\ce{^{37}Cl} \\Rightarrow 35.45 "u"', '76 "%" \\; \\ce{^{35}Cl} \\quad 24 "%" \\; \\ce{^{37}Cl} \\Rightarrow 35,45 "u"'),
        note: tx("That's why the periodic table says 35.45 u for chlorine: it's the **average** of its isotopes, not a mass number.", "Darum steht im Periodensystem 35,45 u für Chlor: Das ist der **Mittelwert** seiner Isotope, keine Massenzahl."),
      },
    ],
  },
  {
    type: "check",
    blob: tx("Quick one about isotopes.", "Eine schnelle Frage zu Isotopen."),
    exercise: {
      instruction: tx("Pick the right answer", "Wähle die richtige Antwort"),
      text: tx("Carbon-12 and carbon-14 are isotopes. What is different about their atoms?", "Kohlenstoff-12 und Kohlenstoff-14 sind Isotope. Was ist bei ihren Atomen verschieden?"),
      answer: isotopeCheck.answer,
      hint: tx("The number in the name is the mass number. What makes it bigger without changing the element?", "Die Zahl im Namen ist die Massenzahl. Was macht sie größer, ohne das Element zu ändern?"),
      solution: [
        { math: `\\ce{^{12}C} \\quad 6 ${P} , \\hl{6} ${N} \\\\ \\ce{^{14}C} \\quad 6 ${P} , \\hl{8} ${N}`, note: tx("Both have 6 protons and 6 electrons. Only the **neutrons** differ: 6 and 8.", "Beide haben 6 Protonen und 6 Elektronen. Nur die **Neutronen** unterscheiden sich: 6 und 8.") },
      ],
      mistakes: isotopeCheck.mistakes,
    },
  },
  {
    type: "explain",
    title: tx("The shell model", "Das Schalenmodell"),
    blob: tx("Electrons don't just fly around randomly. They have their places!", "Elektronen schwirren nicht einfach wild herum. Sie haben ihre Plätze!"),
    body: tx(
      "In the **shell model** (Bohr model) the electrons move on shells around the nucleus. From the inside out they are called K, L, M and N.",
      "Im **Schalenmodell** (bohrsches Atommodell) bewegen sich die Elektronen auf Schalen um den Kern. Von innen nach außen heißen sie K, L, M und N.",
    ),
    frames: [
      { math: '\\group{"K:" 2#k} \\quad \\group{"L:" 8#l} \\quad \\group{"M:" 18#m} \\quad \\group{"N:" 32#n}', note: tx("Each shell holds a maximum number of electrons, $2n^2$: K holds 2, L holds 8, M holds 18.", "Jede Schale fasst höchstens $2n^2$ Elektronen: K fasst 2, L fasst 8, M fasst 18.") },
      { math: '\\ce{Na} \\quad Z = 11 \\quad 11#tot "e⁻"', note: tx("Sodium: atomic number 11, so 11 electrons to place. They fill the shells **from the inside out**.", "Natrium: Ordnungszahl 11, also 11 Elektronen zu verteilen. Sie besetzen die Schalen **von innen nach außen**.") },
      { math: '\\group{"K:" 2#k}', note: tx("K first: 2 electrons, then it's full. 9 left.", "Zuerst K: 2 Elektronen, dann ist sie voll. Noch 9 übrig.") },
      { math: '\\group{"K:" 2#k} \\quad \\group{"L:" 8#l}', note: tx("L takes 8. 1 left.", "L nimmt 8. Noch 1 übrig.") },
      { math: '\\group{"K:" 2#k} \\quad \\group{"L:" 8#l} \\quad \\group{"M:" \\hl{1#m}}', note: tx("The last one goes onto M. It's sodium's only **outer electron**.", "Das letzte kommt auf M. Es ist das einzige **Außenelektron** von Natrium.") },
      {
        math: '\\ce{Ca} \\quad \\group{"K:" 2} \\quad \\group{"L:" 8} \\quad \\group{"M:" 8} \\quad \\group{"N:" \\hl{2}}',
        note: tx("One more rule: the **outermost** shell never holds more than **8** electrons. So calcium (20) is 2, 8, 8, 2 and not 2, 8, 10.", "Noch eine Regel: Auf der **äußersten** Schale sind nie mehr als **8** Elektronen. Darum hat Calcium (20) die Verteilung 2, 8, 8, 2 und nicht 2, 8, 10."),
      },
    ],
  },
  {
    type: "widget",
    title: tx("Fill the shells", "Schalen auffüllen"),
    blob: tx("Slide through the first 20 elements. Watch what happens at 19!", "Geh die ersten 20 Elemente durch. Pass auf, was bei 19 passiert!"),
    body: tx(
      "Each step adds one electron (and one proton, so it's the next element). Watch which shell the new electron lands on.",
      "Jeder Schritt bringt ein Elektron mehr (und ein Proton, also das nächste Element). Schau, auf welcher Schale das neue Elektron landet.",
    ),
    widget: AtomsShellFiller,
  },
  {
    type: "check",
    blob: tx("Now you place the electrons!", "Jetzt verteilst du die Elektronen!"),
    exercise: shellsExercise(createRng(16), 16),
  },
  {
    type: "explain",
    title: tx("Outer electrons", "Außenelektronen"),
    blob: tx("The outer shell is where the action is.", "Auf der Außenschale spielt die Musik."),
    body: tx(
      "The electrons on the outermost shell are the **outer electrons** (valence electrons). They decide how an atom reacts.",
      "Die Elektronen auf der äußersten Schale sind die **Außenelektronen** (Valenzelektronen). Sie entscheiden, wie ein Atom reagiert.",
    ),
    frames: [
      { math: "\\ce{Li} \\quad 2, \\hl{1}", note: tx("Lithium: 2 electrons on K, **1** on L. That one is its outer electron.", "Lithium: 2 Elektronen auf K, **1** auf L. Das ist sein Außenelektron.") },
      { math: "\\ce{Li} \\quad 2, \\hl{1} \\\\ \\ce{Na} \\quad 2, 8, \\hl{1}", note: tx("Sodium: 2, 8, 1. Again **1** outer electron.", "Natrium: 2, 8, 1. Wieder **1** Außenelektron.") },
      {
        math: "\\ce{Li} \\quad 2, \\hl{1} \\\\ \\ce{Na} \\quad 2, 8, \\hl{1} \\\\ \\ce{K} \\quad 2, 8, 8, \\hl{1}",
        note: tx("Potassium: 2, 8, 8, 1. All three have **1 outer electron**, and they react very similarly: violently with water!", "Kalium: 2, 8, 8, 1. Alle drei haben **1 Außenelektron**, und sie reagieren sehr ähnlich: heftig mit Wasser!"),
      },
      {
        math: "\\ce{He} \\quad \\hl{2} \\\\ \\ce{Ne} \\quad 2, \\hl{8} \\\\ \\ce{Ar} \\quad 2, 8, \\hl{8}",
        note: tx("Helium, neon, argon: their outer shell is full. These **noble gases** hardly react at all. Outer electrons are the key to the periodic table!", "Helium, Neon, Argon: Ihre Außenschale ist voll. Diese **Edelgase** reagieren kaum. Die Außenelektronen sind der Schlüssel zum Periodensystem!"),
      },
    ],
  },
  {
    type: "check",
    blob: tx("Last one! Mind the rule for the outermost shell.", "Die letzte! Denk an die Regel für die äußerste Schale."),
    exercise: outerExercise(20),
  },
];

// ---------------------------------------------------------------------------

const topic: Topic = {
  ...topicMeta("atoms"),
  summary: [
    {
      title: tx("Three building blocks", "Drei Bausteine"),
      body: tx(
        "Protons ($+1$) and neutrons (no charge) form the tiny **nucleus**. Electrons ($-1$) move around it. Protons and neutrons have about 1 u each, electrons almost nothing.",
        "Protonen ($+1$) und Neutronen (ungeladen) bilden den winzigen **Atomkern**. Elektronen ($-1$) bewegen sich in der Atomhülle. Protonen und Neutronen haben je etwa 1 u, Elektronen fast nichts.",
      ),
      examples: [`${P} \\approx 1 "u" \\quad ${N} \\approx 1 "u" \\quad ${E} \\approx 0 "u"`],
      tone: "rule",
    },
    {
      title: tx("Atomic number and mass number", "Ordnungszahl und Massenzahl"),
      body: tx(
        "Atomic number $Z$ = protons (= electrons in a neutral atom). Mass number $A$ = protons + neutrons. So: **neutrons $N = A - Z$**.",
        "Ordnungszahl $Z$ = Protonen (= Elektronen im neutralen Atom). Massenzahl $A$ = Protonen + Neutronen. Also: **Neutronen $N = A - Z$**.",
      ),
      examples: ["N = A - Z", "\\ce{^{23}Na} \\quad N = 23 - 11 = 12"],
      tone: "rule",
    },
    {
      title: tx("Isotopes", "Isotope"),
      body: tx(
        "Atoms of the same element with different numbers of neutrons: same $Z$, different $A$. They react the same way.",
        "Atome desselben Elements mit unterschiedlich vielen Neutronen: gleiches $Z$, verschiedenes $A$. Sie reagieren chemisch gleich.",
      ),
      examples: ["\\ce{^{12}C} \\quad \\ce{^{13}C} \\quad \\ce{^{14}C}", "\\ce{^{35}Cl} \\quad \\ce{^{37}Cl}"],
      tone: "rule",
    },
    {
      title: tx("Shell model", "Schalenmodell"),
      body: tx(
        "Electrons fill the shells from the inside out: K holds 2, L holds 8, M up to 18 ($2n^2$). The outermost shell never holds more than 8.",
        "Elektronen besetzen die Schalen von innen nach außen: K fasst 2, L fasst 8, M bis zu 18 ($2n^2$). Die äußerste Schale trägt nie mehr als 8.",
      ),
      examples: ['\\ce{Na} \\quad \\group{"K:" 2} \\quad \\group{"L:" 8} \\quad \\group{"M:" 1}', '\\ce{Ca} \\quad \\group{"K:" 2} \\quad \\group{"L:" 8} \\quad \\group{"M:" 8} \\quad \\group{"N:" 2}'],
      tone: "rule",
    },
    {
      title: tx("Outer electrons", "Außenelektronen"),
      body: tx(
        "The electrons on the outermost shell. They decide how an atom reacts. A full outer shell (noble gas) hardly reacts. Charge of an ion = protons − electrons.",
        "Die Elektronen auf der äußersten Schale. Sie entscheiden, wie ein Atom reagiert. Eine volle Außenschale (Edelgas) reagiert kaum. Ladung eines Ions = Protonen − Elektronen.",
      ),
      examples: ["\\ce{Li} \\; 2, 1 \\quad \\ce{Na} \\; 2, 8, 1 \\quad \\ce{K} \\; 2, 8, 8, 1"],
      tone: "tip",
    },
    {
      title: tx("Classic mistake", "Typischer Fehler"),
      body: tx(
        "The mass number is **not** the number of neutrons! And the atomic mass in the periodic table (35.45 u for chlorine) is an average over the isotopes, not a mass number.",
        "Die Massenzahl ist **nicht** die Zahl der Neutronen! Und die Atommasse im Periodensystem (35,45 u bei Chlor) ist ein Mittelwert der Isotope, keine Massenzahl.",
      ),
      examples: ["\\ce{^{35}Cl} \\quad N = 35 - 17 = 18"],
      tone: "warning",
    },
  ],
  lesson,
  generate,
};

export default topic;
