import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Mistake } from "@/learn/types";
import { D, E, joinT, paras, mathN, sayN, wrongNumbers, wrongPairs, wrong, type Wrong, type WrongPair } from "./kit";
import { bar, plain, side, sys, sysStack } from "./sys";

// Level 2 stories with two unknowns: count and value (tickets, coins, animals, mixtures),
// two numbers from their sum and difference, two-digit numbers, and motion problems.

// ---------------------------------------------------------------------------
// Count and value: (I) x + y = N, (II) ax + by = V

export type CV = {
  a: number;
  b: number;
  N: number;
  V: number;
  x: number;
  y: number;
  /** The story with its question. */
  text: Text;
  /** "Use $x$ for … and $y$ for …" */
  vars: Text;
  /** Short plural names of the two kinds ("adult tickets"). */
  xs: Text;
  ys: Text;
  /** The same in the singular, for "per adult ticket" / "pro Erwachsenenkarte". */
  xOne: Text;
  yOne: Text;
  /** Note for (I) and (II). */
  countNote: Text;
  valueNote: Text;
  /** Answer sentence (without "Answer:"). */
  answer: Text;
};

const SOLVE = tx("Solve with a system of equations", "Löse mit einem Gleichungssystem");

const PLACES: [string, string][] = [
  ["At the cinema", "Im Kino"],
  ["At the zoo", "Im Zoo"],
  ["At the museum", "Im Museum"],
  ["At the open-air pool", "Im Freibad"],
  ["At the school concert", "Beim Schulkonzert"],
];

/** Pick x ≠ y and the rest so that N and V come out as wanted. */
function pickXY(rng: Rng, lo: number, hi: number): [number, number] {
  const x = rng.int(lo, hi);
  let y = rng.int(lo, hi);
  if (y === x) y = x + 1 <= hi ? x + 1 : x - 1;
  return [x, y];
}

function tickets(rng: Rng): CV {
  const a = rng.int(7, 14);
  const b = rng.int(3, a - 2);
  const [x, y] = pickXY(rng, 4, 30);
  return ticketsCV(rng.pick(PLACES), a, b, x, y);
}

export function ticketsCV([pe, pd]: [string, string], a: number, b: number, x: number, y: number): CV {
  const N = x + y;
  const V = a * x + b * y;
  return {
    a, b, N, V, x, y,
    text: tx(
      `${pe}, ${N} tickets were sold today. An adult ticket costs ${a} €, a child ticket ${b} €. Altogether ${V} € came in. How many adult tickets and how many child tickets were sold?`,
      `${pd} wurden heute ${N} Karten verkauft. Eine Erwachsenenkarte kostet ${a} €, eine Kinderkarte ${b} €. Insgesamt wurden ${V} € eingenommen. Wie viele Erwachsenen- und wie viele Kinderkarten wurden verkauft?`,
    ),
    vars: tx("Use $x$ for the number of adult tickets and $y$ for the number of child tickets.", "Nimm $x$ für die Anzahl der Erwachsenenkarten und $y$ für die Anzahl der Kinderkarten."),
    xs: tx("adult tickets", "Erwachsenenkarten"),
    ys: tx("child tickets", "Kinderkarten"),
    xOne: tx("adult ticket", "Erwachsenenkarte"),
    yOne: tx("child ticket", "Kinderkarte"),
    countNote: tx(`(I) counts the tickets: ${N} in total.`, `(I) zählt die Karten: insgesamt ${N}.`),
    valueNote: tx(`(II) adds up the money: ${a} € per adult ticket, ${b} € per child ticket.`, `(II) zählt das Geld: ${a} € pro Erwachsenenkarte, ${b} € pro Kinderkarte.`),
    answer: tx(`${x} adult tickets and ${y} child tickets were sold.`, `Es wurden ${x} Erwachsenen- und ${y} Kinderkarten verkauft.`),
  };
}

export const MONEY: { a: number; b: number; en: [string, string]; de: [string, string]; where: [string, string]; max: number }[] = [
  { a: 1, b: 2, en: ["1-euro coins", "2-euro coins"], de: ["1-Euro-Münzen", "2-Euro-Münzen"], where: ["In a piggy bank there are only", "In einer Spardose sind nur"], max: 25 },
  { a: 2, b: 1, en: ["2-euro coins", "1-euro coins"], de: ["2-Euro-Münzen", "1-Euro-Münzen"], where: ["In a piggy bank there are only", "In einer Spardose sind nur"], max: 25 },
  { a: 5, b: 10, en: ["5-euro notes", "10-euro notes"], de: ["5-Euro-Scheine", "10-Euro-Scheine"], where: ["In a till there are only", "In einer Kasse sind nur"], max: 20 },
  { a: 10, b: 20, en: ["10-euro notes", "20-euro notes"], de: ["10-Euro-Scheine", "20-Euro-Scheine"], where: ["In a wallet there are only", "In einem Portemonnaie sind nur"], max: 15 },
  { a: 20, b: 50, en: ["20-euro notes", "50-euro notes"], de: ["20-Euro-Scheine", "50-Euro-Scheine"], where: ["In an envelope there are only", "In einem Umschlag sind nur"], max: 12 },
];

/** "5-Euro-Scheine" → "5-Euro-Schein", "2-Euro-Münzen" → "2-Euro-Münze". */
const one = (de: string) => de.replace(/Scheine$/, "Schein").replace(/Münzen$/, "Münze");

function money(rng: Rng): CV {
  const m = rng.pick(MONEY);
  const [x, y] = pickXY(rng, 2, m.max);
  return moneyCV(m, x, y);
}

export function moneyCV(m: (typeof MONEY)[number], x: number, y: number): CV {
  const N = x + y;
  const V = m.a * x + m.b * y;
  const coins = m.a <= 2;
  return {
    a: m.a, b: m.b, N, V, x, y,
    text: tx(
      `${m.where[0]} ${m.en[0]} and ${m.en[1]}: ${N} ${coins ? "coins" : "notes"} worth ${V} € altogether. How many of each are there?`,
      `${m.where[1]} ${m.de[0]} und ${m.de[1]}: ${N} ${coins ? "Münzen" : "Scheine"} im Wert von zusammen ${V} €. Wie viele sind es von jeder Sorte?`,
    ),
    vars: tx(`Use $x$ for the number of ${m.en[0]} and $y$ for the number of ${m.en[1]}.`, `Nimm $x$ für die Anzahl der ${m.de[0]} und $y$ für die Anzahl der ${m.de[1]}.`),
    xs: tx(m.en[0], m.de[0]),
    ys: tx(m.en[1], m.de[1]),
    xOne: tx(m.en[0].replace(/s$/, ""), one(m.de[0])),
    yOne: tx(m.en[1].replace(/s$/, ""), one(m.de[1])),
    countNote: tx(`(I) counts the ${coins ? "coins" : "notes"}: ${N} in total.`, `(I) zählt die ${coins ? "Münzen" : "Scheine"}: insgesamt ${N}.`),
    valueNote: tx(`(II) adds up their value: each one of the first kind is worth ${m.a} €, each one of the second ${m.b} €.`, `(II) zählt den Wert: Jedes Stück der ersten Sorte ist ${m.a} € wert, jedes der zweiten ${m.b} €.`),
    answer: tx(`There are ${x} ${m.en[0]} and ${y} ${m.en[1]}.`, `Es sind ${x} ${m.de[0]} und ${y} ${m.de[1]}.`),
  };
}

export const COUNTED: { a: number; b: number; en: [string, string, string, string, string]; de: [string, string, string, string, string]; one: { en: [string, string]; de: [string, string] } }[] = [
  // [place sentence, x-kind, y-kind, counted thing (I), counted thing (II)]; one: x-kind and y-kind in the singular
  { a: 2, b: 4, en: ["On a farm there are chickens and rabbits.", "chickens", "rabbits", "heads", "legs"], de: ["Auf einem Bauernhof gibt es Hühner und Kaninchen.", "Hühner", "Kaninchen", "Köpfe", "Beine"], one: { en: ["chicken", "rabbit"], de: ["Huhn", "Kaninchen"] } },
  { a: 2, b: 4, en: ["In a meadow there are geese and sheep.", "geese", "sheep", "heads", "legs"], de: ["Auf einer Wiese stehen Gänse und Schafe.", "Gänse", "Schafe", "Köpfe", "Beine"], one: { en: ["goose", "sheep"], de: ["Gans", "Schaf"] } },
  { a: 2, b: 3, en: ["In the kindergarten yard there are bicycles and tricycles.", "bicycles", "tricycles", "vehicles", "wheels"], de: ["Auf dem Kita-Hof stehen Fahrräder und Dreiräder.", "Fahrräder", "Dreiräder", "Fahrzeuge", "Räder"], one: { en: ["bicycle", "tricycle"], de: ["Fahrrad", "Dreirad"] } },
  { a: 2, b: 4, en: ["A youth hostel has double rooms and four-bed rooms.", "double rooms", "four-bed rooms", "rooms", "beds"], de: ["Eine Jugendherberge hat Zweibett- und Vierbettzimmer.", "Zweibettzimmer", "Vierbettzimmer", "Zimmer", "Betten"], one: { en: ["double room", "four-bed room"], de: ["Zweibettzimmer", "Vierbettzimmer"] } },
  { a: 4, b: 6, en: ["In a café there are tables for 4 and tables for 6.", "tables for 4", "tables for 6", "tables", "seats"], de: ["In einem Café gibt es Vierertische und Sechsertische.", "Vierertische", "Sechsertische", "Tische", "Plätze"], one: { en: ["table for 4", "table for 6"], de: ["Vierertisch", "Sechsertisch"] } },
];

function counted(rng: Rng): CV {
  const c = rng.pick(COUNTED);
  const [x, y] = pickXY(rng, 3, 24);
  return countedCV(c, x, y);
}

export function countedCV(c: (typeof COUNTED)[number], x: number, y: number): CV {
  const N = x + y;
  const V = c.a * x + c.b * y;
  return {
    a: c.a, b: c.b, N, V, x, y,
    text: tx(
      `${c.en[0]} Altogether there are ${N} ${c.en[3]} and ${V} ${c.en[4]}. How many ${c.en[1]} and how many ${c.en[2]} are there?`,
      `${c.de[0]} Zusammen sind es ${N} ${c.de[3]} und ${V} ${c.de[4]}. Wie viele ${c.de[1]} und wie viele ${c.de[2]} sind es?`,
    ),
    vars: tx(`Use $x$ for the number of ${c.en[1]} and $y$ for the number of ${c.en[2]}.`, `Nimm $x$ für die Anzahl der ${c.de[1]} und $y$ für die Anzahl der ${c.de[2]}.`),
    xs: tx(c.en[1], c.de[1]),
    ys: tx(c.en[2], c.de[2]),
    xOne: tx(c.one.en[0], c.one.de[0]),
    yOne: tx(c.one.en[1], c.one.de[1]),
    countNote: tx(`(I) counts the ${c.en[3]}: ${N}.`, `(I) zählt die ${c.de[3]}: ${N}.`),
    valueNote: tx(`(II) counts the ${c.en[4]}: ${c.a} per ${c.one.en[0]}, ${c.b} per ${c.one.en[1]}.`, `(II) zählt die ${c.de[4]}: ${c.a} pro ${c.one.de[0]}, ${c.b} pro ${c.one.de[1]}.`),
    answer: tx(`There are ${x} ${c.en[1]} and ${y} ${c.en[2]}.`, `Es sind ${x} ${c.de[1]} und ${y} ${c.de[2]}.`),
  };
}

const MIX: { en: [string, string, string]; de: [string, string, string]; lo: number; hi: number }[] = [
  // de[1] stands after "mit": dative.
  { en: ["A tea shop mixes black tea", "green tea", "tea"], de: ["Ein Teeladen mischt Schwarztee", "grünem Tee", "Tee"], lo: 6, hi: 24 },
  { en: ["A shop mixes peanuts", "cashews", "nuts"], de: ["Ein Laden mischt Erdnüsse", "Cashewkernen", "Nüsse"], lo: 4, hi: 20 },
  { en: ["A café mixes a cheap coffee", "a fine coffee", "coffee"], de: ["Ein Café mischt einen günstigen Kaffee", "einem edlen Kaffee", "Kaffee"], lo: 8, hi: 30 },
];

function mixture(rng: Rng): CV {
  const m = rng.pick(MIX);
  for (let i = 0; i < 60; i++) {
    const a = rng.int(m.lo, m.hi - 4);
    const b = rng.int(a + 3, m.hi);
    const [x, y] = pickXY(rng, 2, 12);
    const N = x + y;
    const V = a * x + b * y;
    if (V % N !== 0) continue;
    const p = V / N;
    return {
      a, b, N, V, x, y,
      text: tx(
        `${m.en[0]} at ${a} € per kg with ${m.en[1]} at ${b} € per kg. It wants ${N} kg of mixture that costs ${p} € per kg. How many kg of each does it need?`,
        `${m.de[0]} für ${a} € pro kg mit ${m.de[1]} für ${b} € pro kg. Es sollen ${N} kg Mischung entstehen, die ${p} € pro kg kostet. Wie viele kg braucht man von jeder Sorte?`,
      ),
      vars: tx("Use $x$ for the amount of the first kind in kg and $y$ for the amount of the second kind in kg.", "Nimm $x$ für die Menge der ersten Sorte in kg und $y$ für die der zweiten Sorte in kg."),
      xs: tx("kg of the first kind", "kg der ersten Sorte"),
      ys: tx("kg of the second kind", "kg der zweiten Sorte"),
      xOne: tx("kg of the first kind", "kg der ersten Sorte"),
      yOne: tx("kg of the second kind", "kg der zweiten Sorte"),
      countNote: tx(`(I) is the amount: ${N} kg of mixture.`, `(I) ist die Menge: ${N} kg Mischung.`),
      valueNote: tx(`(II) is the money: the mixture is worth $${N} \\cdot ${p} = ${V}$ €, just like its two parts together.`, `(II) ist das Geld: Die Mischung ist $${N} \\cdot ${p} = ${V}$ € wert, genauso viel wie ihre beiden Teile zusammen.`),
      answer: tx(`You need ${x} kg of the first kind and ${y} kg of the second kind.`, `Man braucht ${x} kg der ersten und ${y} kg der zweiten Sorte.`),
    };
  }
  return tickets(rng);
}

const KINDS = [tickets, tickets, money, money, counted, counted, mixture];
export const randomCV = (rng: Rng) => rng.pick(KINDS)(rng);

/** The system (I), (II) of a count-and-value story. */
const cvI = (cv: CV) => `x#x1 +#p1 y#y1 =#e1 ${cv.N}#n1`;
const cvII = (cv: CV) => `${side([[cv.a, "x", "a2"], [cv.b, "y", "b2"]])} =#e2 ${cv.V}#n2`;
export const cvSystem = (cv: CV) => sys(cvI(cv), cvII(cv));

/** Setting up: who is x, what does each equation count. */
export function cvSetup(cv: CV): Frame[] {
  return [
    { math: "x#x1 ,#cm \\quad y#y1", note: cv.vars },
    { math: `\\group{"(I)"#L1 \\, ${cvI(cv)}}#G1`, note: cv.countNote },
    { math: cvSystem(cv), note: cv.valueNote },
  ];
}

/**
 * Substitution (Einsetzungsverfahren): solve (I) for the variable with the smaller number in
 * (II), put it into (II), solve, then go back for the other one.
 */
export function cvSolve(cv: CV, first: Text): Frame[] {
  const { a, b, N, V, x, y } = cv;
  // u is substituted (u = N − w), w is solved for.
  const sub = a > b ? { u: "y", w: "x", cw: a, cu: b, W: x, U: y } : { u: "x", w: "y", cw: b, cu: a, W: y, U: x };
  const { u, w, cw, cu, W, U } = sub;
  const ku = u === "x" ? "x1" : "y1";
  const kw = w === "x" ? "x1" : "y1";
  const solvedI = `${u}#${ku} =#e1 ${N}#n1 -#p1 ${w}#${kw}`;
  const iiTerm = (v: string) => (v === "x" ? [a, "x", "a2"] : [b, "y", "b2"]) as [number, string, string];
  const iiOrder = (wSrc: string, uSrc: string) => (w === "x" ? `${wSrc} +#p2 ${uSrc}` : `${uSrc} +#p2 ${wSrc}`);
  const wTerm = side([iiTerm(w)]);
  const coefU = cu === 1 ? "" : `${cu}#c${u === "x" ? "a2" : "b2"} `;
  const substituted = `${iiOrder(wTerm, `${coefU}(${N}#n1 -#p1 ${w}#${kw})#br`)} =#e2 ${V}#n2`;
  const expanded = `${iiOrder(wTerm, `${cu * N}#cn -#p1 ${cu === 1 ? "" : `${cu}#c${u === "x" ? "a2" : "b2"} `}${w}#${kw}`)} =#e2 ${V}#n2`;
  const K = cw - cu;
  const R = V - cu * N;
  const kSrc = (k: number) => `${k === 1 ? "" : `${k}#k `}${w}#v${w === "x" ? "a2" : "b2"}`;
  const frames: Frame[] = [
    { math: cvSystem(cv), note: joinT(first, tx(`(I) is easy to solve for $${u}$.`, `(I) lässt sich leicht nach $${u}$ auflösen.`)) },
    {
      math: sys(solvedI, cvII(cv)),
      highlight: [ku],
      note: tx(`Solve (I) for $${u}$: subtract $${w}$ on both sides. $${u} = ${N} - ${w}$.`, `Löse (I) nach $${u}$ auf: Subtrahiere auf beiden Seiten $${w}$. $${u} = ${N} - ${w}$.`),
    },
    {
      math: substituted,
      highlight: ["br(", "br)"],
      note: tx(`**Substitute**: in (II), put $(${N} - ${w})$ in place of $${u}$. Keep the brackets!`, `**Einsetzen**: Setze in (II) $(${N} - ${w})$ für $${u}$ ein. Klammern nicht vergessen!`),
    },
  ];
  if (cu !== 1)
    frames.push({
      math: expanded,
      note: tx(`Expand: $${cu}(${N} - ${w}) = ${cu * N} - ${cu}${w}$.`, `Multipliziere aus: $${cu}(${N} - ${w}) = ${cu * N} - ${cu}${w}$.`),
    });
  else if (w === "y") frames.push({ math: expanded, note: tx("Nothing multiplies the bracket: just drop it.", "Vor der Klammer steht kein Faktor: Die Klammer fällt einfach weg.") });
  else frames.push({ math: expanded, note: tx("A plus in front of the bracket: just drop it.", "Vor der Klammer steht ein Plus: Die Klammer fällt einfach weg.") });
  frames.push({
    math: `${kSrc(K)} +#p2 ${cu * N}#cn =#e2 ${V}#n2${bar(`- ${cu * N}`)}`,
    note: tx(`Combine the $${w}$-terms: $${cw}${w} - ${cu === 1 ? "" : cu}${w} = ${K === 1 ? "" : K}${w}$. Then subtract ${cu * N}.`, `Fasse die $${w}$-Terme zusammen: $${cw}${w} - ${cu === 1 ? "" : cu}${w} = ${K === 1 ? "" : K}${w}$. Dann subtrahiere ${cu * N}.`),
  });
  if (K !== 1) frames.push({ math: `${kSrc(K)} =#e2 ${R}#n2${bar(`: ${K}`)}`, note: tx(`Divide both sides by ${K}.`, `Teile beide Seiten durch ${K}.`) });
  frames.push({ math: `${w}#v${w === "x" ? "a2" : "b2"} =#e2 ${W}#n2`, highlight: [`v${w === "x" ? "a2" : "b2"}`, "e2", "n2"], note: tx(`So $${w} = ${W}$.`, `Also ist $${w} = ${W}$.`) });
  frames.push({
    math: `${u}#${ku} =#e1 ${N}#n1 -#p1 ${W}#${kw} =#r ${U}#res`,
    highlight: ["res"],
    note: joinT(
      tx(`Go back to $${u} = ${N} - ${w}$ and put in $${w} = ${W}$: $${u} = ${U}$.`, `Zurück zu $${u} = ${N} - ${w}$, setze $${w} = ${W}$ ein: $${u} = ${U}$.`),
      tx(
        `**Answer:** ${E(cv.answer)} Check: $${x} + ${y} = ${N}$ and $${a} \\cdot ${x} + ${b} \\cdot ${y} = ${V}$.`,
        `**Antwort:** ${D(cv.answer)} Probe: $${x} + ${y} = ${N}$ und $${a} \\cdot ${x} + ${b} \\cdot ${y} = ${V}$.`,
      ),
    ),
  });
  return frames;
}

function cvMistakes(cv: CV, answer: AnswerSpec): Mistake[] {
  const { a, b, N, V, x, y } = cv;
  const list: WrongPair[] = [
    x !== y && {
      v: [y, x],
      title: tx("Swapped", "Vertauscht"),
      say: tx(
        `Ha, the right numbers, just the wrong way round! $x$ is the number of ${E(cv.xs)}, $y$ the number of ${E(cv.ys)}.`,
        `Ha, die richtigen Zahlen, nur andersherum! $x$ zählt die ${D(cv.xs)}, $y$ die ${D(cv.ys)}.`,
      ),
    },
  ];
  if (a > b && b !== 1 && a !== 1) {
    const xw = (V - b * N) / (a - 1);
    list.push({
      v: [xw, N - xw],
      title: tx("Bracket forgotten", "Klammer vergessen"),
      say: tx(
        `Ah, I see! When you put $(${N} - x)$ in for $y$, the ${b} has to multiply **both** parts: $${b}(${N} - x) = ${b * N} - ${b}x$.`,
        `Ah, ich seh's! Wenn du $(${N} - x)$ für $y$ einsetzt, muss die ${b} **beide** Teile malnehmen: $${b}(${N} - x) = ${b * N} - ${b}x$.`,
      ),
    });
  }
  if (a < b && a !== 1 && b !== 1) {
    const yw = (V - a * N) / (b - 1);
    list.push({
      v: [N - yw, yw],
      title: tx("Bracket forgotten", "Klammer vergessen"),
      say: tx(
        `Ah, I see! When you put $(${N} - y)$ in for $x$, the ${a} has to multiply **both** parts: $${a}(${N} - y) = ${a * N} - ${a}y$.`,
        `Ah, ich seh's! Wenn du $(${N} - y)$ für $x$ einsetzt, muss die ${a} **beide** Teile malnehmen: $${a}(${N} - y) = ${a * N} - ${a}y$.`,
      ),
    });
  }
  if (b !== 1)
    list.push({
      v: [x, V - a * x],
      title: tx("Value, not number", "Wert statt Anzahl"),
      say: tx(
        `$x = ${x}$ is right! But $${V} - ${a} \\cdot ${x} = ${V - a * x}$ is what the ${E(cv.ys)} add up to in (II), not how many there are. Divide by ${b}, or use (I).`,
        `$x = ${x}$ stimmt! Aber $${V} - ${a} \\cdot ${x} = ${V - a * x}$ ist das, was die ${D(cv.ys)} in (II) beitragen, nicht, wie viele es sind. Teil durch ${b} oder nimm (I).`,
      ),
    });
  if (a !== 1)
    list.push({
      v: [V - b * y, y],
      title: tx("Value, not number", "Wert statt Anzahl"),
      say: tx(
        `$y = ${y}$ is right! But $${V} - ${b} \\cdot ${y} = ${V - b * y}$ is what the ${E(cv.xs)} add up to in (II), not how many there are. Divide by ${a}, or use (I).`,
        `$y = ${y}$ stimmt! Aber $${V} - ${b} \\cdot ${y} = ${V - b * y}$ ist das, was die ${D(cv.xs)} in (II) beitragen, nicht, wie viele es sind. Teil durch ${a} oder nimm (I).`,
      ),
    });
  if (N % 2 === 0)
    list.push({
      v: [N / 2, N / 2],
      title: tx("Half and half?", "Halbe-halbe?"),
      say: tx(
        `Hmm, half and half fits (I), but not (II): that would give $${a} \\cdot ${N / 2} + ${b} \\cdot ${N / 2} = ${((a + b) * N) / 2}$, not ${V}. A solution has to fit **both** equations.`,
        `Hm, halbe-halbe passt zu (I), aber nicht zu (II): Das gäbe $${a} \\cdot ${N / 2} + ${b} \\cdot ${N / 2} = ${((a + b) * N) / 2}$, nicht ${V}. Eine Lösung muss **beide** Gleichungen erfüllen.`,
      ),
    });
  return wrongPairs(answer, list.filter((w) => w && w.v.every((v) => v >= 0)));
}

export function cvExercise(cv: CV): Exercise {
  const answer: AnswerSpec = { kind: "pair", names: ["x", "y"], values: [cv.x, cv.y] };
  return {
    instruction: SOLVE,
    text: paras(cv.text, cv.vars),
    answer,
    hint: tx("One equation counts, the other adds up the values. Then solve (I) for one variable and substitute.", "Eine Gleichung zählt, die andere addiert die Werte. Löse dann (I) nach einer Variablen auf und setze ein."),
    solution: [...cvSetup(cv), ...cvSolve(cv, "").slice(1)],
    mistakes: cvMistakes(cv, answer),
  };
}

/** "Which system fits the story?" with tempting wrong systems. */
export function cvChoice(cv: CV, rng: Rng): Exercise {
  const { a, b, N, V } = cv;
  const sysPlain = (i: string, ii: string) => `$"(I)" \\; ${i} \\quad "(II)" \\; ${ii}$`;
  const term = (p: number, q: number) => plain(side([[p, "x", "a"], [q, "y", "b"]]));
  const right = sysPlain(`x + y = ${N}`, `${term(a, b)} = ${V}`);
  const xs = cv.xs;
  const ys = cv.ys;
  const wrongs: { o: string; title: Text; say: Text }[] = [
    {
      o: sysPlain(`x + y = ${V}`, `${term(a, b)} = ${N}`),
      title: tx("Count and value swapped", "Anzahl und Wert vertauscht"),
      say: tx(`Careful: ${N} is how many there are, ${V} is what they add up to. Which one belongs to $x + y$?`, `Vorsicht: ${N} ist die Anzahl, ${V} ist das, was sie zusammen ergeben. Was gehört zu $x + y$?`),
    },
    {
      o: sysPlain(`x + y = ${N}`, `${term(b, a)} = ${V}`),
      title: tx("Numbers on the wrong variable", "Zahlen bei der falschen Variablen"),
      say: sayN(({ N: T }) => [
        `Nearly! $x$ counts the ${T(xs)}, and each of them counts ${a} in (II). So the ${a} belongs in front of $x$.`,
        `Fast! $x$ zählt die ${T(xs)}, und pro ${T(cv.xOne)} zählt (II) ${a}. Die ${a} gehört also vor das $x$.`,
      ]),
    },
    b !== 1
      ? {
          o: sysPlain(`x + y = ${N}`, `${term(a, 1)} = ${V}`),
          title: tx("A number missing in (II)", "Eine Zahl fehlt in (II)"),
          say: sayN(({ N: T }) => [`Hmm, in (II) each of the ${T(ys)} counts only 1. But each one counts ${b}.`, `Hm, so zählt (II) nur 1 pro ${T(cv.yOne)}. Es sind aber ${b} pro ${T(cv.yOne)}.`]),
        }
      : {
          o: sysPlain(`x + y = ${N}`, `${term(1, b)} = ${V}`),
          title: tx("A number missing in (II)", "Eine Zahl fehlt in (II)"),
          say: sayN(({ N: T }) => [`Hmm, in (II) each of the ${T(xs)} counts only 1. But each one counts ${a}.`, `Hm, so zählt (II) nur 1 pro ${T(cv.xOne)}. Es sind aber ${a} pro ${T(cv.xOne)}.`]),
        },
    {
      o: sysPlain(`x + y = ${N}`, `${a + b}(x + y) = ${V}`),
      title: tx("Values added up first", "Werte zuerst addiert"),
      say: tx(`Hmm, $${a + b}(x + y)$ treats every single one as worth $${a} + ${b} = ${a + b}$. But each one is worth **either** ${a} **or** ${b}.`, `Hm, $${a + b}(x + y)$ tut so, als wäre jedes einzelne $${a} + ${b} = ${a + b}$ wert. Jedes ist aber **entweder** ${a} **oder** ${b} wert.`),
    },
  ];
  const picked = rng.shuffle(wrongs.filter((w) => w.o !== right)).slice(0, 3);
  const options = rng.shuffle([right, ...picked.map((w) => w.o)]);
  const at = (o: string) => options.indexOf(o);
  return {
    instruction: tx("Which system fits the story?", "Welches Gleichungssystem passt zur Geschichte?"),
    text: paras(cv.text, cv.vars),
    answer: { kind: "choice", options, correct: at(right) },
    mistakes: picked.map((w) => ({ when: { kind: "choice", options, correct: at(w.o) }, title: w.title, say: w.say })),
    hint: tx("Which equation counts, which adds up the values? What does each single one count?", "Welche Gleichung zählt, welche addiert die Werte? Wie viel zählt jedes einzelne?"),
    solution: [...cvSetup(cv), ...cvSolve(cv, tx("That's the system.", "Das ist das Gleichungssystem.")).slice(1)],
  };
}

// ---------------------------------------------------------------------------
// Two numbers from their sum and difference (Additionsverfahren)

export function sumDiffFrames(S: number, Dd: number, lead: Text): { frames: Frame[]; x: number; y: number } {
  const x = (S + Dd) / 2;
  const y = (S - Dd) / 2;
  const frames: Frame[] = [
    { math: sys(`x#x1 +#p1 y#y1 =#e1 ${S}#n1`, `x#x2 -#p2 y#y2 =#e2 ${Dd}#n2`), note: joinT(lead, tx("In (I) there's $+y$, in (II) there's $-y$: adding the two equations makes $y$ vanish.", "In (I) steht $+y$, in (II) $-y$: Addierst du die beiden Gleichungen, fällt $y$ weg.")), highlight: ["p1", "y1", "p2", "y2"] },
    { math: `x#x1 +#px x#x2 +#p1 y#y1 -#p2 y#y2 =#e1 ${S}#n1 +#pn ${Dd}#n2`, note: tx("**Add** (I) and (II): left plus left, right plus right.", "**Addiere** (I) und (II): links plus links, rechts plus rechts.") },
    { math: `2#k x#x1 =#e1 ${S + Dd}#n1${bar(": 2")}`, note: tx(`$y - y = 0$. Left: $2x$, right: $${S} + ${Dd} = ${S + Dd}$.`, `$y - y = 0$. Links: $2x$, rechts: $${S} + ${Dd} = ${S + Dd}$.`) },
    { math: `x#x1 =#e1 ${x}#n1`, highlight: ["x1", "e1", "n1"], note: tx(`So $x = ${x}$.`, `Also ist $x = ${x}$.`) },
    { math: `${x}#x1 +#p1 y#y1 =#e1 ${S}#n1${bar(`- ${x}`)}`, note: tx(`Put $x = ${x}$ into (I).`, `Setze $x = ${x}$ in (I) ein.`) },
    { math: `y#y1 =#e1 ${y}#n1`, highlight: ["y1", "e1", "n1"], note: tx(`So $y = ${y}$.`, `Also ist $y = ${y}$.`) },
  ];
  return { frames, x, y };
}

function sumDiff(rng: Rng): Exercise {
  const y = rng.int(4, 45);
  const x = y + rng.int(3, 30);
  const S = x + y;
  const Dd = x - y;
  const { frames } = sumDiffFrames(S, Dd, "");
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = {
    ...last,
    note: joinT(last.note ?? "", tx(`**Answer:** The numbers are ${x} and ${y}. Check: $${x} + ${y} = ${S}$ and $${x} - ${y} = ${Dd}$.`, `**Antwort:** Die Zahlen heißen ${x} und ${y}. Probe: $${x} + ${y} = ${S}$ und $${x} - ${y} = ${Dd}$.`)),
  };
  const answer: AnswerSpec = { kind: "pair", names: ["x", "y"], values: [x, y] };
  return {
    instruction: SOLVE,
    text: tx(
      `The sum of two numbers is ${S}, their difference is ${Dd}. What are the two numbers?\n\nUse $x$ for the larger number and $y$ for the smaller one.`,
      `Die Summe zweier Zahlen ist ${S}, ihre Differenz ist ${Dd}. Wie heißen die beiden Zahlen?\n\nNimm $x$ für die größere und $y$ für die kleinere Zahl.`,
    ),
    answer,
    hint: tx("(I) $x + y = …$, (II) $x - y = …$. Add the two equations.", "(I) $x + y = …$, (II) $x - y = …$. Addiere die beiden Gleichungen."),
    solution: [{ math: `x#x1 ,#cm \\quad y#y1`, note: tx("Let $x$ be the larger and $y$ the smaller number.", "Sei $x$ die größere und $y$ die kleinere Zahl.") }, ...frames],
    mistakes: wrongPairs(answer, [
      { v: [S / 2, S / 2], title: tx("Half and half?", "Halbe-halbe?"), say: sayN(({ n }) => [`Hmm, ${n(S / 2)} and ${n(S / 2)} add up to ${S}, but their difference is 0, not ${Dd}.`, `Hm, ${n(S / 2)} und ${n(S / 2)} ergeben zusammen ${S}, ihre Differenz ist aber 0, nicht ${Dd}.`]) },
      { v: [S + Dd, S - Dd], title: tx("Forgot to halve", "Halbieren vergessen"), say: tx(`So close! Adding the equations gives $2x = ${S + Dd}$, not $x$. Divide by 2.`, `Ganz knapp! Die Addition ergibt $2x = ${S + Dd}$, noch nicht $x$. Teil durch 2.`) },
      { v: [x, S + x], title: tx("Sign slip in (I)", "Vorzeichenfehler in (I)"), say: tx(`$x = ${x}$ is right! Then $${x} + y = ${S}$, so subtract ${x}: $y = ${S} - ${x}$.`, `$x = ${x}$ stimmt! Dann ist $${x} + y = ${S}$, also subtrahierst du ${x}: $y = ${S} - ${x}$.`) },
    ]),
  };
}

// ---------------------------------------------------------------------------
// Two-digit numbers: tens digit x, units digit y, the number is 10x + y.

export function digitStory(x: number, y: number) {
  const s = x + y;
  const up = y > x;
  const d = Math.abs(9 * (y - x));
  const n = 10 * x + y;
  const sw = 10 * y + x;
  const k = d / 9;
  const text = up
    ? tx(
        `The digit sum of a two-digit number is ${s}. If you swap its two digits, the number gets ${d} bigger. What is the number?`,
        `Die Quersumme einer zweistelligen Zahl ist ${s}. Vertauscht man ihre beiden Ziffern, wird die Zahl um ${d} größer. Wie heißt die Zahl?`,
      )
    : tx(
        `The digit sum of a two-digit number is ${s}. If you swap its two digits, the number gets ${d} smaller. What is the number?`,
        `Die Quersumme einer zweistelligen Zahl ist ${s}. Vertauscht man ihre beiden Ziffern, wird die Zahl um ${d} kleiner. Wie heißt die Zahl?`,
      );
  // (II) 10y + x = 10x + y ± d  →  9y − 9x = ±d  →  y − x = ±k. (I) and (II) stacked: (II) is long.
  const I = `x#x1 +#p1 y#y1 =#e1 ${s}#n1`;
  const frames: Frame[] = [
    {
      math: tx(`"number:"#ln \\, 10#tn x#xn +#pn y#yn \\quad "swapped:"#ls \\, 10#ta y#yb +#pb x#xb`, `"Zahl:"#ln \\, 10#tn x#xn +#pn y#yn \\quad "vertauscht:"#ls \\, 10#ta y#yb +#pb x#xb`),
      note: tx(
        `Let $x$ be the tens digit and $y$ the units digit. The number is $10x + y$ (like $47 = 10 \\cdot 4 + 7$). Swapped, $y$ is the tens digit: $10y + x$.`,
        `Sei $x$ die Zehnerziffer und $y$ die Einerziffer. Die Zahl ist $10x + y$ (so wie $47 = 10 \\cdot 4 + 7$). Vertauscht ist $y$ die Zehnerziffer: $10y + x$.`,
      ),
    },
    {
      math: sysStack(I, `10#ta y#yb +#pb x#xb`, `=#e2 10#tc x#xc +#pc y#yc ${up ? "+" : "-"}#pd ${d}#nd`),
      note: tx(
        `(I) is the digit sum. (II): the swapped number is ${d} ${up ? "bigger" : "smaller"} than the number.`,
        `(I) ist die Quersumme. (II): Die vertauschte Zahl ist um ${d} ${up ? "größer" : "kleiner"} als die Zahl.`,
      ),
    },
    {
      math: sysStack(I, up ? `9#ta y#yb -#pc 9#tc x#xc =#e2 ${d}#nd` : `9#tc x#xc -#pb 9#ta y#yb =#e2 ${d}#nd`, bar(": 9").trim()),
      note: up
        ? tx(`Tidy up (II): all $x$ and $y$ to the left. $10y - y = 9y$ and $10x - x = 9x$.`, `Räum (II) auf: alle $x$ und $y$ nach links. $10y - y = 9y$ und $10x - x = 9x$.`)
        : tx(
            `Tidy up (II): all $x$ and $y$ to the right, the ${d} to the left. $10x - x = 9x$ and $10y - y = 9y$, so $${d} = 9x - 9y$. Written the other way round: $9x - 9y = ${d}$.`,
            `Räum (II) auf: alle $x$ und $y$ nach rechts, die ${d} nach links. $10x - x = 9x$ und $10y - y = 9y$, also $${d} = 9x - 9y$. Andersherum geschrieben: $9x - 9y = ${d}$.`,
          ),
    },
    {
      math: sysStack(I, up ? `-#pc x#xc +#pb y#yb =#e2 ${k}#nd` : `x#xc -#pb y#yb =#e2 ${k}#nd`),
      highlight: up ? ["pc", "xc", "x1"] : ["pb", "yb", "y1"],
      note: tx(
        `Divide by 9. Now ${up ? "$x$" : "$y$"} has opposite signs in (I) and (II): add the equations.`,
        `Teile durch 9. Jetzt hat ${up ? "$x$" : "$y$"} in (I) und (II) entgegengesetzte Vorzeichen: Addiere die Gleichungen.`,
      ),
    },
    {
      math: up ? `2#k y#y1 =#e1 ${s + k}#n1${bar(": 2")}` : `2#k x#x1 =#e1 ${s + k}#n1${bar(": 2")}`,
      note: tx(`(I) + (II): $2${up ? "y" : "x"} = ${s} + ${k} = ${s + k}$.`, `(I) + (II): $2${up ? "y" : "x"} = ${s} + ${k} = ${s + k}$.`),
    },
    {
      math: `x#x1 =#e1 ${x}#n1 ,#cm \\quad y#y1 =#e2 ${y}#n2`,
      note: up
        ? tx(`So $y = ${y}$, and from (I): $x = ${s} - ${y} = ${x}$.`, `Also ist $y = ${y}$, und aus (I): $x = ${s} - ${y} = ${x}$.`)
        : tx(`So $x = ${x}$, and from (I): $y = ${s} - ${x} = ${y}$.`, `Also ist $x = ${x}$, und aus (I): $y = ${s} - ${x} = ${y}$.`),
    },
    {
      math: `10#tn \\cdot#dt ${x}#x1 +#pn ${y}#y1 =#e1 ${n}#res`,
      highlight: ["res"],
      note: tx(
        `**Answer:** The number is ${n}. Check: $${x} + ${y} = ${s}$, and swapped it's ${sw}, which is ${d} ${up ? "more" : "less"}.`,
        `**Antwort:** Die Zahl heißt ${n}. Probe: $${x} + ${y} = ${s}$, und vertauscht ergibt sich ${sw}, das ist ${d} ${up ? "mehr" : "weniger"}.`,
      ),
    },
  ];
  const answer: AnswerSpec = { kind: "number", value: n };
  const wrongs: Wrong[] = [
    wrong(sw, tx("That's the swapped number", "Das ist die vertauschte Zahl"), tx(`Nearly! ${sw} is the number **after** swapping. The question asks for the original number.`, `Fast! ${sw} ist die Zahl **nach** dem Vertauschen. Gefragt ist die ursprüngliche Zahl.`)),
    wrong(x, tx("Only a digit", "Nur eine Ziffer"), tx(`${x} is the tens digit, nice! Now build the number: $10x + y$.`, `${x} ist die Zehnerziffer, stark! Jetzt bau die Zahl zusammen: $10x + y$.`)),
    wrong(y, tx("Only a digit", "Nur eine Ziffer"), tx(`${y} is the units digit, nice! Now build the number: $10x + y$.`, `${y} ist die Einerziffer, stark! Jetzt bau die Zahl zusammen: $10x + y$.`)),
  ];
  return { text, frames, answer, mistakes: wrongNumbers(answer, wrongs), s, d, up, n };
}

function digits(rng: Rng): Exercise {
  let x = 0;
  let y = 0;
  for (let i = 0; i < 30; i++) {
    x = rng.int(1, 9);
    y = rng.int(1, 9);
    if (x !== y && x + y >= 5) break;
  }
  if (x === y) [x, y] = [3, 8];
  const st = digitStory(x, y);
  return {
    instruction: tx("Find the two-digit number", "Bestimme die zweistellige Zahl"),
    text: st.text,
    answer: st.answer,
    hint: tx("Tens digit $x$, units digit $y$: the number is $10x + y$, swapped $10y + x$.", "Zehnerziffer $x$, Einerziffer $y$: Die Zahl ist $10x + y$, vertauscht $10y + x$."),
    solution: st.frames,
    mistakes: st.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Motion: s = v · t. Meeting (towards each other) and catching up.

type Vehicle = { en: string; de: string; lo: number; hi: number; step: number };
export const MEET_PAIRS: { a: Vehicle; b: Vehicle; ts: number[]; minutes?: boolean; place: [string, string] }[] = [
  {
    a: { en: "a car", de: "ein Auto", lo: 60, hi: 120, step: 10 },
    b: { en: "a lorry", de: "ein Lkw", lo: 50, hi: 80, step: 10 },
    ts: [1, 1.5, 2, 2.5, 3],
    place: ["Town A and town B are", "Die Orte A und B liegen"],
  },
  {
    a: { en: "an express train", de: "ein ICE", lo: 140, hi: 200, step: 20 },
    b: { en: "a regional train", de: "ein Regionalzug", lo: 60, hi: 100, step: 20 },
    ts: [0.5, 1, 1.5, 2],
    place: ["Station A and station B are", "Bahnhof A und Bahnhof B liegen"],
  },
  {
    a: { en: "a cyclist", de: "eine Radfahrerin", lo: 12, hi: 24, step: 2 },
    b: { en: "another cyclist", de: "ein Radfahrer", lo: 12, hi: 24, step: 2 },
    ts: [0.25, 0.5, 0.75, 1, 1.5],
    minutes: true,
    place: ["Village A and village B are", "Dorf A und Dorf B liegen"],
  },
  {
    a: { en: "a hiker", de: "eine Wanderin", lo: 3, hi: 5, step: 1 },
    b: { en: "another hiker", de: "ein Wanderer", lo: 3, hi: 5, step: 1 },
    ts: [1, 1.5, 2, 2.5, 3],
    place: ["Hut A and hut B are", "Hütte A und Hütte B liegen"],
  },
];

const pickV = (rng: Rng, v: Vehicle) => v.lo + v.step * rng.int(0, Math.round((v.hi - v.lo) / v.step));
const H = "h";

export type MeetAsk = "time" | "dist";

export function meetFrames(d: number, v1: number, v2: number, minutes: boolean, lead: Text): Frame[] {
  const T = d / (v1 + v2);
  const S = v1 * T;
  const frames: Frame[] = [
    {
      math: "s#S1 =#e1 v#V \\cdot#dt t#t1",
      note: joinT(lead, tx("Distance = speed · time. Let $t$ be the time in hours after the start and $s$ the distance from A in km.", "Weg = Geschwindigkeit · Zeit. Sei $t$ die Zeit in Stunden nach dem Start und $s$ die Entfernung von A in km.")),
    },
    {
      math: sys(`s#S1 =#e1 ${v1}#a t#t1`, `s#S2 =#e2 ${d}#d -#m ${v2}#b t#t2`),
      note: tx(
        `The one from A is $${v1}t$ km away from A. The one from B starts ${d} km from A and comes ${v2} km closer every hour.`,
        `Wer in A startet, ist nach $t$ Stunden $${v1}t$ km von A entfernt. Wer in B startet, beginnt ${d} km von A entfernt und kommt jede Stunde ${v2} km näher.`,
      ),
    },
    {
      math: `${v1}#a t#t1 =#e1 ${d}#d -#m ${v2}#b t#t2${bar(`+ ${v2}t`)}`,
      note: tx("When they meet, both are at the same place: set the right sides equal (equating method).", "Wenn sie sich begegnen, sind beide an derselben Stelle: Setze die rechten Seiten gleich (Gleichsetzungsverfahren)."),
    },
    { math: `${v1 + v2}#a t#t1 =#e1 ${d}#d${bar(`: ${v1 + v2}`)}`, note: tx(`$${v1}t + ${v2}t = ${v1 + v2}t$: together they close the gap by ${v1 + v2} km every hour.`, `$${v1}t + ${v2}t = ${v1 + v2}t$: Zusammen verkürzen sie den Abstand jede Stunde um ${v1 + v2} km.`) },
    {
      math: mathN((n) => `t#t1 =#e1 ${n(T)}#d`),
      highlight: ["t1", "e1", "d"],
      note: minutes
        ? sayN(({ n }) => [`So $t = ${n(T)}$ h, that's ${n(T * 60)} minutes.`, `Also ist $t = ${n(T)}$ h, das sind ${n(T * 60)} Minuten.`])
        : sayN(({ n }) => [`So $t = ${n(T)}$ h.`, `Also ist $t = ${n(T)}$ h.`]),
    },
    {
      math: mathN((n) => `s#S1 =#e1 ${v1}#a \\cdot#dt ${n(T)}#t1 =#r ${n(S)}#res`),
      highlight: ["res"],
      note: sayN(({ n }) => [
        `Put $t$ into (I): they meet ${n(S)} km from A. Check: the other one has gone $${v2} \\cdot ${n(T)} = ${n(v2 * T)}$ km, and $${n(S)} + ${n(v2 * T)} = ${d}$.`,
        `Setze $t$ in (I) ein: Sie treffen sich ${n(S)} km von A entfernt. Probe: Der andere ist $${v2} \\cdot ${n(T)} = ${n(v2 * T)}$ km gefahren, und $${n(S)} + ${n(v2 * T)} = ${d}$.`,
      ]),
    },
  ];
  return frames;
}

function meeting(rng: Rng): Exercise {
  const p = rng.pick(MEET_PAIRS);
  const v1 = pickV(rng, p.a);
  let v2 = pickV(rng, p.b);
  if (v1 === v2) v2 = v2 + p.b.step <= p.b.hi ? v2 + p.b.step : v2 - p.b.step;
  let T = rng.pick(p.ts);
  let d = (v1 + v2) * T;
  // Keep distances friendly: whole km.
  for (let i = 0; i < 8 && !Number.isInteger(d); i++) {
    T = rng.pick(p.ts);
    d = (v1 + v2) * T;
  }
  if (!Number.isInteger(d)) {
    T = 1;
    d = v1 + v2;
  }
  return meetTask(p, v1, v2, T, rng.chance(0.5) ? "time" : "dist");
}

export function meetTask(p: (typeof MEET_PAIRS)[number], v1: number, v2: number, T: number, ask: MeetAsk): Exercise {
  const d = (v1 + v2) * T;
  const S = v1 * T;
  const value = ask === "dist" ? S : p.minutes ? T * 60 : T;
  const unit: Text = ask === "dist" ? "km" : p.minutes ? "min" : H;
  const question =
    ask === "dist"
      ? tx("How far from A do they meet?", "Wie weit von A entfernt begegnen sie sich?")
      : p.minutes
        ? tx("After how many minutes do they meet?", "Nach wie vielen Minuten begegnen sie sich?")
        : tx("After how many hours do they meet?", "Nach wie vielen Stunden begegnen sie sich?");
  const text = sayN(({ N }) => [
    `${p.place[0]} ${d} km apart. At the same moment, ${p.a.en} sets off from A towards B at ${v1} km/h, and ${p.b.en} sets off from B towards A at ${v2} km/h. ${N(question)}`,
    `${p.place[1]} ${d} km auseinander. Gleichzeitig startet ${p.a.de} in A mit ${v1} km/h in Richtung B und ${p.b.de} in B mit ${v2} km/h in Richtung A. ${N(question)}`,
  ]);
  const frames = meetFrames(d, v1, v2, !!p.minutes, "");
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = {
    ...last,
    note: joinT(
      last.note ?? "",
      ask === "dist"
        ? sayN(({ n }) => [`**Answer:** They meet ${n(S)} km from A.`, `**Antwort:** Sie begegnen sich ${n(S)} km von A entfernt.`])
        : p.minutes
          ? sayN(({ n }) => [`**Answer:** They meet after ${n(T * 60)} minutes.`, `**Antwort:** Sie begegnen sich nach ${n(T * 60)} Minuten.`])
          : sayN(({ n }) => [`**Answer:** They meet after ${n(T)} hours.`, `**Antwort:** Sie begegnen sich nach ${n(T)} Stunden.`]),
    ),
  };
  const answer: AnswerSpec = { kind: "number", value, unit };
  const tDiff = v1 !== v2 ? d / Math.abs(v1 - v2) : NaN;
  const wrongs: Wrong[] =
    ask === "dist"
      ? [
          wrong(d - S, tx("Measured from B", "Von B aus gemessen"), sayN(({ n }) => [`Nearly! ${n(d - S)} km is the distance from **B**. The question asks how far from **A**.`, `Fast! ${n(d - S)} km ist die Entfernung von **B**. Gefragt ist die Entfernung von **A**.`])),
          wrong(p.minutes ? T * 60 : T, tx("That's the time", "Das ist die Zeit"), tx("That's when they meet. The question asks **where**: put $t$ into $s = v \\cdot t$.", "Das ist, wann sie sich treffen. Gefragt ist, **wo**: Setz $t$ in $s = v \\cdot t$ ein.")),
          wrong(d / 2, tx("Halfway?", "In der Mitte?"), tx("Halfway would only be right if both were equally fast. The faster one covers more of the way.", "Die Mitte stimmt nur, wenn beide gleich schnell sind. Wer schneller ist, schafft mehr vom Weg.")),
          wrong(v1 * tDiff, tx("Speeds subtracted", "Geschwindigkeiten subtrahiert"), tx("Careful: they drive **towards** each other, so the gap shrinks by **both** speeds together.", "Vorsicht: Sie fahren **aufeinander zu**, der Abstand schrumpft also um **beide** Geschwindigkeiten zusammen.")),
        ]
      : [
          wrong(p.minutes ? T : T * 60, p.minutes ? tx("Hours, not minutes", "Stunden statt Minuten") : tx("Minutes, not hours", "Minuten statt Stunden"), p.minutes ? sayN(({ n }) => [`So close! $t = ${n(T)}$ is in hours. The question asks for minutes: times 60.`, `Ganz knapp! $t = ${n(T)}$ ist in Stunden. Gefragt sind Minuten: mal 60.`]) : tx("Careful with the unit: the question asks for hours.", "Achte auf die Einheit: Gefragt sind Stunden.")),
          wrong(S, tx("That's the distance", "Das ist der Weg"), tx("That's **where** they meet (in km). The question asks **when**.", "Das ist, **wo** sie sich treffen (in km). Gefragt ist, **wann**.")),
          wrong(p.minutes ? tDiff * 60 : tDiff, tx("Speeds subtracted", "Geschwindigkeiten subtrahiert"), tx(`Careful: they move **towards** each other, so every hour the gap shrinks by $${v1} + ${v2}$ km, not by the difference.`, `Vorsicht: Sie bewegen sich **aufeinander zu**, der Abstand schrumpft also jede Stunde um $${v1} + ${v2}$ km, nicht um die Differenz.`)),
          wrong(p.minutes ? (d / v1) * 60 : d / v1, tx("Only one of them moves?", "Nur einer fährt?"), tx("That's how long the one from A would need for the whole way alone. But the other one comes towards it too!", "So lange bräuchte der aus A allein für den ganzen Weg. Der andere kommt ihm aber entgegen!")),
        ];
  return {
    instruction: tx("Solve the motion problem", "Löse die Bewegungsaufgabe"),
    text,
    answer,
    hint: tx("$s = v \\cdot t$ for both. When they meet, both are at the same place: equalise.", "$s = v \\cdot t$ für beide. Wenn sie sich treffen, sind beide an derselben Stelle: gleichsetzen."),
    solution: frames,
    mistakes: wrongNumbers(answer, wrongs),
  };
}

export type Chase = {
  first: (v: number) => [string, string];
  second: (v: number) => [string, string];
  ask: Record<"dist" | "time" | "ride", [string, string]>;
  v1: number[];
  v2: number[];
};
export const CATCH: Chase[] = [
  {
    first: (v) => [`Lina sets off from home by bike at ${v} km/h.`, `Lina fährt mit ${v} km/h mit dem Rad von zu Hause los.`],
    second: (v) => [`her brother follows her on his moped at ${v} km/h.`, `fährt ihr Bruder ihr mit ${v} km/h auf dem Moped hinterher.`],
    ask: {
      dist: ["How far from home does her brother catch up with her?", "Wie weit von zu Hause entfernt holt ihr Bruder sie ein?"],
      time: ["How many hours after Lina's start does her brother catch up with her?", "Wie viele Stunden nach Linas Start holt ihr Bruder sie ein?"],
      ride: ["How many hours does her brother ride until he catches up with her?", "Wie viele Stunden fährt ihr Bruder, bis er sie einholt?"],
    },
    v1: [12, 15, 16, 18, 20],
    v2: [24, 25, 30],
  },
  {
    first: (v) => [`A school class sets off on a hike at ${v} km/h.`, `Eine Schulklasse wandert mit ${v} km/h los.`],
    second: (v) => [`a teacher follows the class by bike at ${v} km/h.`, `fährt ihr eine Lehrerin mit ${v} km/h auf dem Rad hinterher.`],
    ask: {
      dist: ["How far from the start does the teacher catch up with the class?", "Wie weit vom Start entfernt holt die Lehrerin die Klasse ein?"],
      time: ["How many hours after the class set off does the teacher catch up with it?", "Wie viele Stunden nach dem Aufbruch der Klasse holt die Lehrerin sie ein?"],
      ride: ["How many hours does the teacher ride until she catches up with the class?", "Wie viele Stunden fährt die Lehrerin, bis sie die Klasse einholt?"],
    },
    v1: [4, 5],
    v2: [12, 15, 16, 18, 20],
  },
  {
    first: (v) => [`A freight train leaves the station at ${v} km/h.`, `Ein Güterzug verlässt den Bahnhof mit ${v} km/h.`],
    second: (v) => [`an express train follows it on the next track at ${v} km/h.`, `fährt ihm ein ICE mit ${v} km/h auf dem Nachbargleis hinterher.`],
    ask: {
      dist: ["How far from the station does the express train catch up with the freight train?", "Wie weit vom Bahnhof entfernt holt der ICE den Güterzug ein?"],
      time: ["How many hours after the freight train left does the express train catch up with it?", "Wie viele Stunden nach der Abfahrt des Güterzugs holt der ICE ihn ein?"],
      ride: ["How many hours does the express train travel until it catches up with the freight train?", "Wie viele Stunden fährt der ICE, bis er den Güterzug einholt?"],
    },
    v1: [60, 70, 80, 90],
    v2: [120, 140, 160, 180],
  },
];

export function catchFrames(v1: number, v2: number, lag: number, lead: Text): Frame[] {
  const T = (v2 * lag) / (v2 - v1);
  const S = v1 * T;
  return [
    {
      math: "s#S1 =#e1 v#V \\cdot#dt t#t1",
      note: joinT(lead, tx("Let $t$ be the time in hours after the **first** one starts, and $s$ the distance from the start.", "Sei $t$ die Zeit in Stunden nach dem Start des **ersten** und $s$ die Entfernung vom Start.")),
    },
    {
      math: mathN((n) => sys(`s#S1 =#e1 ${v1}#a t#t1`, `s#S2 =#e2 ${v2}#b (t#t2 -#m ${n(lag)}#l)#br`)),
      highlight: ["br(", "t2", "m", "l", "br)"],
      note: sayN(({ n }) => [
        `The second one starts ${n(lag)} h later, so at time $t$ it has been moving for only $t - ${n(lag)}$ hours.`,
        `Wer ${n(lag)} h später startet, ist zur Zeit $t$ erst $t - ${n(lag)}$ Stunden unterwegs.`,
      ]),
    },
    {
      math: mathN((n) => `${v2}#b (t#t2 -#m ${n(lag)}#l)#br =#e1 ${v1}#a t#t1`),
      note: tx("It catches up when both are at the same place: equalise.", "Eingeholt ist, wenn beide an derselben Stelle sind: gleichsetzen."),
    },
    {
      math: mathN((n) => `${v2}#b t#t2 -#m ${n(v2 * lag)}#l =#e1 ${v1}#a t#t1${bar(`- ${v1}t`)}`),
      note: sayN(({ n }) => [`Expand: $${v2}(t - ${n(lag)}) = ${v2}t - ${n(v2 * lag)}$.`, `Multipliziere aus: $${v2}(t - ${n(lag)}) = ${v2}t - ${n(v2 * lag)}$.`]),
    },
    {
      math: mathN((n) => `${v2 - v1}#b t#t2 -#m ${n(v2 * lag)}#l =#e1 0#a${bar(`+ ${n(v2 * lag)}`)}`),
      note: tx(`$${v2}t - ${v1}t = ${v2 - v1}t$: every hour the second one gains ${v2 - v1} km.`, `$${v2}t - ${v1}t = ${v2 - v1}t$: Jede Stunde schrumpft der Abstand um ${v2 - v1} km.`),
    },
    { math: mathN((n) => `${v2 - v1}#b t#t2 =#e1 ${n(v2 * lag)}#l${bar(`: ${v2 - v1}`)}`), note: tx(`Divide by ${v2 - v1}.`, `Teile durch ${v2 - v1}.`) },
    { math: mathN((n) => `t#t2 =#e1 ${n(T)}#l`), highlight: ["t2", "e1", "l"], note: sayN(({ n }) => [`So $t = ${n(T)}$ h after the first start.`, `Also ist $t = ${n(T)}$ h nach dem ersten Start.`]) },
    {
      math: mathN((n) => `s#S1 =#e1 ${v1}#a \\cdot#dt ${n(T)}#t2 =#r ${n(S)}#res`),
      highlight: ["res"],
      note: sayN(({ n }) => [
        `Put $t$ into (I): $s = ${n(S)}$ km. Check: the second one has been moving for $${n(T)} - ${n(lag)} = ${n(T - lag)}$ h, and $${v2} \\cdot ${n(T - lag)} = ${n(v2 * (T - lag))}$ km.`,
        `Setze $t$ in (I) ein: $s = ${n(S)}$ km. Probe: Wer später gestartet ist, war $${n(T)} - ${n(lag)} = ${n(T - lag)}$ h unterwegs, und $${v2} \\cdot ${n(T - lag)} = ${n(v2 * (T - lag))}$ km.`,
      ]),
    },
  ];
}

export type CatchAsk = "dist" | "time" | "ride";

function catching(rng: Rng): Exercise {
  for (let i = 0; i < 80; i++) {
    const c = rng.pick(CATCH);
    const v1 = rng.pick(c.v1);
    const v2 = rng.pick(c.v2);
    const lag = rng.pick([0.5, 1, 1, 2]);
    const T = (v2 * lag) / (v2 - v1);
    const S = v1 * T;
    if (v2 <= v1 || T > 6 || T - lag < 0.5 || !Number.isInteger(T * 2) || !Number.isInteger(S * 2)) continue;
    return catchTask(c, v1, v2, lag, rng.pick<CatchAsk>(["dist", "time", "ride"]));
  }
  return meeting(rng);
}

export function catchTask(c: Chase, v1: number, v2: number, lag: number, ask: CatchAsk): Exercise {
  const T = (v2 * lag) / (v2 - v1);
  const S = v1 * T;
  const lagText = lag === 0.5 ? ["Half an hour later", "Eine halbe Stunde später"] : lag === 1 ? ["One hour later", "Eine Stunde später"] : ["Two hours later", "Zwei Stunden später"];
  const [f1, f2] = c.first(v1);
  const [s1, s2] = c.second(v2);
  const text = tx(`${f1} ${lagText[0]}, ${s1} ${c.ask[ask][0]}`, `${f2} ${lagText[1]} ${s2} ${c.ask[ask][1]}`);
  const frames = catchFrames(v1, v2, lag, "");
  const value = ask === "dist" ? S : ask === "time" ? T : T - lag;
  const answerText =
    ask === "dist"
      ? sayN(({ n }) => [`**Answer:** They are side by side ${n(S)} km from the start.`, `**Antwort:** Der Treffpunkt liegt ${n(S)} km vom Start entfernt.`])
      : ask === "time"
        ? sayN(({ n }) => [`**Answer:** That happens ${n(T)} hours after the first start.`, `**Antwort:** Das passiert ${n(T)} Stunden nach dem ersten Start.`])
        : sayN(({ n }) => [`**Answer:** The ride until catching up takes $${n(T)} - ${n(lag)} = ${n(T - lag)}$ hours.`, `**Antwort:** Die Fahrt bis zum Einholen dauert $${n(T)} - ${n(lag)} = ${n(T - lag)}$ Stunden.`]);
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = { ...last, note: joinT(last.note ?? "", answerText) };
  const answer: AnswerSpec = { kind: "number", value, unit: ask === "dist" ? "km" : H };
  const tSum = lag + (v1 * lag) / (v1 + v2);
  const tNoBracket = lag / (v2 - v1);
  const wrongs: Wrong[] =
    ask === "dist"
      ? [
          wrong(T, tx("That's the time", "Das ist die Zeit"), tx("That's **when** it happens (in hours). The question asks **where**: put $t$ into $s = v \\cdot t$.", "Das ist, **wann** es passiert (in Stunden). Gefragt ist, **wo**: Setz $t$ in $s = v \\cdot t$ ein.")),
          wrong(v1 * lag, tx("Only the head start", "Nur der Vorsprung"), sayN(({ n }) => [`${n(v1 * lag)} km is the head start when the second one sets off. But the first one keeps going until it's caught.`, `${n(v1 * lag)} km ist der Vorsprung beim Start des zweiten. Der erste fährt aber weiter, bis er eingeholt wird.`])),
          wrong(v1 * tSum, tx("Speeds added", "Geschwindigkeiten addiert"), tx("Careful: both go the **same** way, so the gap shrinks only by the **difference** of the speeds.", "Vorsicht: Beide sind in **dieselbe** Richtung unterwegs, der Abstand schrumpft also nur um die **Differenz** der Geschwindigkeiten.")),
        ]
      : [
          wrong(ask === "time" ? T - lag : T, tx("Counted from the other start", "Vom anderen Start gezählt"), ask === "time" ? sayN(({ n }) => [`Nearly! That's how long the **second** one is on the way. Add the ${n(lag)} h head start.`, `Fast! So lange ist der **Verfolger** unterwegs. Rechne die ${n(lag)} h Vorsprung dazu.`]) : sayN(({ n }) => [`Nearly! $t$ counts from the **first** start. The second one set off ${n(lag)} h later.`, `Fast! $t$ zählt ab dem **ersten** Start. Der Verfolger ist ${n(lag)} h später losgefahren.`])),
          wrong(ask === "time" ? tSum : tSum - lag, tx("Speeds added", "Geschwindigkeiten addiert"), tx("Careful: both go the **same** way, so every hour the second one gains only the **difference** of the speeds.", "Vorsicht: Beide sind in **dieselbe** Richtung unterwegs, der Abstand schrumpft also jede Stunde nur um die **Differenz** der Geschwindigkeiten.")),
          wrong(ask === "time" ? tNoBracket : tNoBracket - lag, tx("Bracket forgotten", "Klammer vergessen"), sayN(({ n }) => [`I think you wrote $${v2}t - ${n(lag)}$. But the **whole** riding time is multiplied: $${v2}(t - ${n(lag)})$.`, `Ich glaub, du hast $${v2}t - ${n(lag)}$ geschrieben. Aber die **ganze** Fahrzeit wird multipliziert: $${v2}(t - ${n(lag)})$.`])),
          wrong(S, tx("That's the distance", "Das ist der Weg"), tx("That's **where** it happens (in km). The question asks about the time.", "Das ist, **wo** es passiert (in km). Gefragt ist nach der Zeit.")),
        ];
  return {
    instruction: tx("Solve the motion problem", "Löse die Bewegungsaufgabe"),
    text,
    answer,
    hint: tx("Let $t$ be the time after the first start. The second one is on the way for $t$ minus its delay.", "Sei $t$ die Zeit nach dem ersten Start. Wer später startet, ist $t$ minus die Verspätung unterwegs."),
    solution: frames,
    mistakes: wrongNumbers(answer, wrongs),
  };
}

// ---------------------------------------------------------------------------

/** Level 2 practice: count-and-value systems, the matching system, numbers, digits, motion. */
export function generate2(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.3) return cvExercise(randomCV(rng));
  if (r < 0.46) return cvChoice(randomCV(rng), rng);
  if (r < 0.54) return sumDiff(rng);
  if (r < 0.66) return digits(rng);
  if (r < 0.83) return meeting(rng);
  return catching(rng);
}
