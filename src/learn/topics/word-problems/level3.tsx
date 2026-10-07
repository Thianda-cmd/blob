"use client";

// Level 3 (Klasse 10 and Oberstufe): modelling. Choose a linear, quadratic or exponential
// model from a table or a story and judge its limits, find the best value with a parabola
// (the vertex), and estimate with a plan (Fermi problems).

import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson } from "@/learn/types";
import { choice, clean, D, E, fixedChoice, mb, mistakesFor, NAMES, nf, numAns, txs, visual, weighted, type Opt, type Say } from "./kit";
import { FenceMax } from "./FenceMax";
import { FermiLab } from "./FermiLab";
import { ModelCycle } from "./ModelCycle";
import { ModelLab } from "./ModelLab";
import { ValueTable } from "./ValueTable";

type Tpl = (rng: Rng) => Exercise;

/** a·x² + b·x + c in the display language (zero terms left out). */
function polySrc(s: Say, [a, b, c]: [number, number, number], v = "x") {
  const parts: string[] = [];
  ([
    [a, 2],
    [b, 1],
    [c, 0],
  ] as [number, number][]).forEach(([k, p]) => {
    if (Math.abs(k) < 1e-12) return;
    const abs = Math.abs(k);
    const num = p > 0 && abs === 1 ? "" : s.m(abs);
    const body = `${num}${p === 2 ? `${v}^2` : p === 1 ? v : ""}`;
    parts.push(parts.length ? `${k < 0 ? "-" : "+"} ${body}` : `${k < 0 ? "-" : ""}${body}`);
  });
  return parts.join(" ") || "0";
}

const expSrc = (s: Say, a: number, q: number, v = "x") => (a === 1 ? `${s.m(q)}^${v}` : `${s.m(a)} \\cdot ${s.m(q)}^${v}`);

// ---------------------------------------------------------------------------
// Which model fits the table?

type Family = "lin" | "quad" | "exp";
type Model = { fam: Family; f: (x: number) => number; src: (s: Say) => string };

const lin = (m: number, b: number): Model => ({ fam: "lin", f: (x) => m * x + b, src: (s) => polySrc(s, [0, m, b]) });
const quad = (a: number, b: number, c: number): Model => ({ fam: "quad", f: (x) => a * x * x + b * x + c, src: (s) => polySrc(s, [a, b, c]) });
const expo = (a: number, q: number): Model => ({ fam: "exp", f: (x) => a * q ** x, src: (s) => expSrc(s, a, q) });

const nice = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9;
const XS = [0, 1, 2, 3, 4];

/** The table test as frames: the steps between the values, then the formula. */
function testFrames(m: Model, ys: number[]): Frame[] {
  const val = (s: Say, i: number) => s.m(ys[i], `v${i}`);
  const values = mb((s) => ys.map((_, i) => val(s, i)).join(" \\quad "));
  const d1 = ys.slice(1).map((y, i) => clean(y - ys[i]));
  const d2 = d1.slice(1).map((y, i) => clean(y - d1[i]));
  const sign = (s: Say, v: number) => `${v < 0 ? "-" : "+"} ${s.m(Math.abs(v))}`;
  const formula = mb((s) => `f(x) =#eq ${m.src(s)}`);
  if (m.fam === "lin") {
    return [
      { math: values, note: tx("The values for x = 0, 1, 2, 3, 4. Look at the steps from value to value.", "Die Werte für x = 0, 1, 2, 3, 4. Schau auf die Schritte von Wert zu Wert.") },
      {
        math: mb((s) => ys.map((_, i) => (i ? `\\blob{${sign(s, d1[i - 1])}} ${val(s, i)}` : val(s, i))).join(" \\; ")),
        note: txs((s) => `Always ${sign(s, d1[0]).replace(" ", "")}: the **differences** are constant, so it's **linear**.`, (s) => `Immer ${sign(s, d1[0]).replace(" ", "")}: Die **Differenzen** sind gleich, also **linear**.`),
      },
      { math: formula, highlight: [], note: txs((s) => `Slope = the difference ${s.n(d1[0])}, y-intercept = f(0) = ${s.n(ys[0])}.`, (s) => `Steigung = die Differenz ${s.n(d1[0])}, y-Achsenabschnitt = f(0) = ${s.n(ys[0])}.`) },
    ];
  }
  if (m.fam === "exp") {
    const q = clean(ys[1] / ys[0]);
    return [
      { math: values, note: tx("The values for x = 0, 1, 2, 3, 4. The differences change, so try the ratios.", "Die Werte für x = 0, 1, 2, 3, 4. Die Differenzen ändern sich, also probier die Quotienten.") },
      {
        math: mb((s) => ys.map((_, i) => (i ? `\\blob{\\cdot ${s.m(q)}} ${val(s, i)}` : val(s, i))).join(" \\; ")),
        note: txs((s) => `Always · ${s.n(q)}: the **ratios** are constant, so it's **exponential**.`, (s) => `Immer · ${s.n(q)}: Die **Quotienten** sind gleich, also **exponentiell**.`),
      },
      { math: formula, note: txs((s) => `Start value a = f(0) = ${s.n(ys[0])}, growth factor q = ${s.n(q)}: $f(x) = a \\cdot q^x$.`, (s) => `Anfangswert a = f(0) = ${s.n(ys[0])}, Wachstumsfaktor q = ${s.n(q)}: $f(x) = a \\cdot q^x$.`) },
    ];
  }
  return [
    { math: values, note: tx("The values for x = 0, 1, 2, 3, 4. Look at the steps from value to value.", "Die Werte für x = 0, 1, 2, 3, 4. Schau auf die Schritte von Wert zu Wert.") },
    {
      math: mb((s) => ys.map((_, i) => (i ? `\\blob{${sign(s, d1[i - 1])}} ${val(s, i)}` : val(s, i))).join(" \\; ")),
      note: tx("The differences aren't constant, and the ratios aren't either.", "Die Differenzen sind nicht gleich, die Quotienten auch nicht."),
    },
    {
      math: mb((s) => d1.map((d, i) => `${s.m(d)}#d${i}`).join(" \\quad ")),
      note: txs((s) => `But the differences of the differences are: always ${sign(s, d2[0]).replace(" ", "")}.`, (s) => `Aber die Differenzen der Differenzen: immer ${sign(s, d2[0]).replace(" ", "")}.`),
    },
    { math: formula, note: tx("Constant **second differences**: it's **quadratic**.", "Gleiche **2. Differenzen**: Das ist **quadratisch**.") },
  ];
}

const TABLE_INSTR = tx("Which model fits?", "Welches Modell passt?");

/** With rng the options are shuffled; without one the right option goes to `rightAt`. */
function modelChoiceExercise(rng: Rng | null, right: Model, distractors: { m: Model; title: Text; say: Text }[], rightAt = 0): Exercise {
  const ys = XS.map((x) => clean(right.f(x)));
  const opts: Opt[] = [{ text: mb((s) => `$f(x) = ${right.src(s)}$`) }];
  for (const d of distractors) {
    const differs = XS.some((x) => Math.abs(d.m.f(x) - right.f(x)) > 1e-9);
    if (differs) opts.push({ text: mb((s) => `$f(x) = ${d.m.src(s)}$`), title: d.title, say: d.say });
  }
  const four = opts.slice(0, 4);
  const at = Math.min(rightAt, four.length - 1);
  const { answer, mistakes } = rng ? choice(rng, four) : fixedChoice([...four.slice(1, at + 1), four[0], ...four.slice(at + 1)], at);
  return {
    instruction: TABLE_INSTR,
    text: tx("A series of measurements gave this table. Which function describes it exactly?", "Eine Messreihe hat diese Wertetabelle ergeben. Welche Funktion beschreibt sie genau?"),
    visual: visual(ValueTable, { rows: [{ label: "x", values: XS }, { label: "f(x)", values: ys }] }),
    answer,
    mistakes,
    hint: tx(
      "Constant differences: linear. Constant ratios: exponential. Constant second differences: quadratic.",
      "Gleiche Differenzen: linear. Gleiche Quotienten: exponentiell. Gleiche 2. Differenzen: quadratisch.",
    ),
    solution: testFrames(right, ys),
  };
}

const ONLY_FIRST = tx("Only the first step checked", "Nur den ersten Schritt geprüft");
const sayLin = tx("This one only fits the first two values. Check all the steps: are the **differences** really all the same?", "Die passt nur zu den ersten beiden Werten. Prüf alle Schritte: Sind die **Differenzen** wirklich alle gleich?");
const sayQuad = tx("This one only fits the first two values. Insert x = 2 and compare with the table.", "Die passt nur zu den ersten beiden Werten. Setz x = 2 ein und vergleiche mit der Tabelle.");
const sayExp = tx("Only the first ratio fits. Check the other ratios too.", "Nur der erste Quotient passt. Prüf auch die anderen Quotienten.");

const modelChoice: Tpl = (rng) => {
  for (let tries = 0; tries < 60; tries++) {
    const fam = rng.pick<Family>(["lin", "quad", "exp"]);
    if (fam === "lin") {
      const m = rng.nonZero(-5, 6, [1, -1]);
      const b = rng.int(1, 20);
      if (b + 4 * m <= 0 || b === m) continue;
      const q = (b + m) / b;
      return modelChoiceExercise(rng, lin(m, b), [
        { m: quad(m, 0, b), title: ONLY_FIRST, say: sayQuad },
        { m: lin(b, m), title: tx("Slope and intercept swapped", "Steigung und Achsenabschnitt vertauscht"), say: tx(`Check x = 0: the table says f(0) = ${b}. The number on its own is f(0), the number in front of x is the step.`, `Prüf x = 0: Laut Tabelle ist f(0) = ${b}. Die Zahl allein ist f(0), die Zahl vor dem x ist der Schritt.`) },
        nice(q) && q > 0 ? { m: expo(b, q), title: ONLY_FIRST, say: sayExp } : { m: lin(m + (m > 0 ? 1 : -1), b), title: tx("Check every value", "Prüf jeden Wert"), say: tx("Insert x = 2: does it give the value in the table?", "Setz x = 2 ein: Kommt der Wert aus der Tabelle heraus?") },
      ]);
    }
    if (fam === "quad") {
      const a = rng.pick([1, 2, 3, -1]);
      const b = rng.pick([0, 0, 1, 2, -1]);
      const c = rng.int(1, 12) + (a < 0 ? 20 : 0);
      if (a === c) continue;
      const ys = XS.map((x) => a * x * x + b * x + c);
      if (ys.some((y) => y <= 0)) continue;
      const q = ys[1] / ys[0];
      return modelChoiceExercise(rng, quad(a, b, c), [
        { m: lin(a + b, c), title: ONLY_FIRST, say: sayLin },
        nice(q) ? { m: expo(c, q), title: ONLY_FIRST, say: sayExp } : { m: quad(a, b + 1, c), title: tx("Check every value", "Prüf jeden Wert"), say: tx("Insert x = 2: does it give the value in the table?", "Setz x = 2 ein: Kommt der Wert aus der Tabelle heraus?") },
        { m: quad(c, b, a), title: tx("a and c swapped", "a und c vertauscht"), say: tx(`Check x = 0: the table says f(0) = ${c}, so the number on its own must be ${c}.`, `Prüf x = 0: Laut Tabelle ist f(0) = ${c}, die Zahl allein muss also ${c} sein.`) },
      ]);
    }
    const [a, q] = rng.pick<[number, number]>([
      [1, 2],
      [2, 2],
      [3, 2],
      [5, 2],
      [1, 3],
      [2, 3],
      [4, 3],
      [16, 1.5],
      [32, 1.5],
      [64, 0.5],
      [80, 0.5],
      [160, 0.5],
      [96, 0.5],
    ]);
    if (a === q) continue;
    const d = clean(a * q - a);
    return modelChoiceExercise(rng, expo(a, q), [
      { m: lin(d, a), title: ONLY_FIRST, say: sayLin },
      { m: quad(d, 0, a), title: ONLY_FIRST, say: sayQuad },
      a === 1
        ? { m: expo(a, q + 1), title: tx("Check every value", "Prüf jeden Wert"), say: tx("Insert x = 2: does it give the value in the table?", "Setz x = 2 ein: Kommt der Wert aus der Tabelle heraus?") }
        : { m: expo(q, a), title: tx("Start value and factor swapped", "Anfangswert und Faktor vertauscht"), say: tx(`Check x = 0: f(0) is the start value, here ${a}. The factor is what you multiply by in each step.`, `Prüf x = 0: f(0) ist der Anfangswert, hier ${a}. Der Faktor ist das, womit du bei jedem Schritt multiplizierst.`) },
    ]);
  }
  return modelChoiceExercise(rng, expo(3, 2), [{ m: lin(3, 3), title: ONLY_FIRST, say: sayLin }]);
};

// ---------------------------------------------------------------------------
// Use the model (linear, exponential, quadratic)

const MODEL_INSTR = tx("Use the model", "Rechne mit dem Modell");

type LinCtx = {
  intro: (S: number, r: number) => Text;
  when: Text;
  zero: Text;
  unit: string;
  unitWord: Text;
  start: number[];
  rate: number[];
  per: string;
  perWord: Text;
  time: Text;
};

const LIN_CTX: LinCtx[] = [
  {
    intro: (S, r) => tx(`A water tank holds ${S} litres. Every minute, ${r} litres flow out.`, `Ein Wassertank enthält ${S} Liter. Pro Minute fließen ${r} Liter ab.`),
    when: tx("When is the tank empty?", "Wann ist der Tank leer?"),
    zero: tx("Empty means f(t) = 0.", "Leer heißt f(t) = 0."),
    unit: "l",
    unitWord: tx("litres", "Liter"),
    start: [600, 800, 900, 1200, 1500],
    rate: [20, 25, 30, 40, 50, 60],
    per: "min",
    perWord: tx("minute", "Minute"),
    time: tx("minutes", "Minuten"),
  },
  {
    intro: (S, r) => tx(`A phone battery is charged to ${S} %. Every hour, ${r} % are used up.`, `Ein Handyakku ist auf ${S} % geladen. Pro Stunde werden ${r} % verbraucht.`),
    when: tx("When is the battery empty?", "Wann ist der Akku leer?"),
    zero: tx("Empty means f(t) = 0.", "Leer heißt f(t) = 0."),
    unit: "%",
    unitWord: "%",
    start: [100],
    rate: [4, 5, 10, 20, 25],
    per: "h",
    perWord: tx("hour", "Stunde"),
    time: tx("hours", "Stunden"),
  },
  {
    intro: (S, r) => tx(`A candle is ${S} cm tall. Every hour, ${r} cm burn down.`, `Eine Kerze ist ${S} cm hoch. Pro Stunde brennen ${r} cm ab.`),
    when: tx("When has the candle burnt down?", "Wann ist die Kerze abgebrannt?"),
    zero: tx("Burnt down means f(t) = 0.", "Abgebrannt heißt f(t) = 0."),
    unit: "cm",
    unitWord: "cm",
    start: [20, 24, 30, 36],
    rate: [2, 3, 4, 6],
    per: "h",
    perWord: tx("hour", "Stunde"),
    time: tx("hours", "Stunden"),
  },
];

const linModel: Tpl = (rng) => {
  for (;;) {
    const c = rng.pick(LIN_CTX);
    const S = rng.pick(c.start);
    const r = rng.pick(c.rate);
    if (S % r !== 0 || S / r > 40) continue;
    const T = S / r;
    const story = c.intro(S, r);
    if (rng.chance(0.5)) {
      const answer = numAns(T, c.per);
      const mk = mistakesFor(answer);
      mk.add(S * r, tx("Multiplied instead of divided", "Multipliziert statt geteilt"), tx(`Set up the equation: ${S} − ${r}t = 0. Solving it means **dividing**: t = ${S} : ${r}.`, `Stell die Gleichung auf: ${S} − ${r}t = 0. Beim Lösen wird **geteilt**: t = ${S} : ${r}.`));
      mk.add(S - r, tx("Only one step", "Nur ein Schritt"), tx(`${S} − ${r} is what's left after **one** ${E(c.perWord)}. Set the whole model equal to 0.`, `${S} − ${r} ist, was nach **einer** ${D(c.perWord)} übrig ist. Setz das ganze Modell gleich 0.`));
      return {
        instruction: MODEL_INSTR,
        text: txs((s) => `${s.t(story)} Set up a linear model. ${s.t(c.when)}`, (s) => `${s.t(story)} Stell ein lineares Modell auf. ${s.t(c.when)}`),
        answer,
        mistakes: mk.list,
        hint: tx(`Start value minus ${r} per ${c.per}: f(t) = ${S} − ${r}t. Then solve f(t) = 0.`, `Anfangswert minus ${r} pro ${c.per}: f(t) = ${S} − ${r}t. Dann f(t) = 0 lösen.`),
        solution: [
          { math: `f(t)#f =#eq ${S}#s -#m ${r}#r t#t`, note: tx(`The same amount every ${E(c.perWord)}: linear. Start ${S}, minus ${r} per ${c.per}.`, `Jede ${D(c.perWord)} gleich viel: linear. Start ${S}, minus ${r} pro ${c.per}.`) },
          { math: `${S}#s -#m ${r}#r t#t =#eq 0#z`, note: c.zero },
          { math: `t#t =#eq ${T}#z`, highlight: ["z"], note: txs((s) => `${S} : ${r} = ${T}. **Answer:** after ${T} ${s.t(c.time)}. The model only works for 0 ≤ t ≤ ${T}.`, (s) => `${S} : ${r} = ${T}. **Antwort:** nach ${T} ${s.t(c.time)}. Das Modell gilt nur für 0 ≤ t ≤ ${T}.`) },
        ],
      };
    }
    const t = rng.int(2, Math.max(2, T - 1));
    const v = S - r * t;
    const answer = numAns(v, c.unit);
    const mk = mistakesFor(answer);
    mk.add(S + r * t, tx("Added instead of subtracted", "Addiert statt abgezogen"), tx("It gets **less** over time: the rate is subtracted.", "Es wird mit der Zeit **weniger**: Die Rate wird abgezogen."));
    mk.add(r * t, tx("What's gone, not what's left", "Was weg ist, nicht was übrig ist"), tx(`${r} · ${t} = ${r * t} is what's **gone**. The question asks what's left.`, `${r} · ${t} = ${r * t} ist, was **weg** ist. Gefragt ist, was übrig ist.`));
    mk.add(S - r, tx("Only one step", "Nur ein Schritt"), tx(`That's after one ${E(c.perWord)}. Insert t = ${t} into the model.`, `Das ist nach einer ${D(c.perWord)}. Setz t = ${t} ins Modell ein.`));
    return {
      instruction: MODEL_INSTR,
      text: txs((s) => `${s.t(story)} How much is left after ${t} ${s.t(c.time)}?`, (s) => `${s.t(story)} Wie viel ist nach ${t} ${s.t(c.time)} noch übrig?`),
      answer,
      mistakes: mk.list,
      hint: tx(`Linear model: f(t) = ${S} − ${r}t. Insert t = ${t}.`, `Lineares Modell: f(t) = ${S} − ${r}t. Setz t = ${t} ein.`),
      solution: [
        { math: `f(t)#f =#eq ${S}#s -#m ${r}#r t#t`, note: tx(`Linear model: start ${S}, minus ${r} per ${c.per}.`, `Lineares Modell: Start ${S}, minus ${r} pro ${c.per}.`) },
        { math: `f(${t})#f =#eq ${S}#s -#m ${r}#r \\cdot#d ${t}#t`, note: tx(`Insert t = ${t}.`, `t = ${t} einsetzen.`) },
        { math: `f(${t})#f =#eq ${v}#z "${c.unit}"#u`, highlight: ["z", "u"], note: txs((s) => `**Answer:** after ${t} ${s.t(c.time)}, ${v} ${s.t(c.unitWord)} are left.`, (s) => `**Antwort:** Nach ${t} ${s.t(c.time)} sind noch ${v} ${s.t(c.unitWord)} übrig.`) },
      ],
    };
  }
};

const EXP_CTX = [
  {
    start: [100, 200, 300, 500, 1000],
    q: 2,
    pers: tx("hours", "Stunden"),
    unit: tx("bacteria", "Bakterien"),
    story: (a: number) => tx(`A bacterial culture starts with ${a} bacteria. Their number doubles every hour.`, `Eine Bakterienkultur beginnt mit ${a} Bakterien. Ihre Anzahl verdoppelt sich jede Stunde.`),
    ask: tx("How many bacteria are there after", "Wie viele Bakterien sind es nach"),
  },
  {
    start: [2, 3, 5],
    q: 2,
    pers: tx("weeks", "Wochen"),
    unit: "m²",
    story: (a: number) => tx(`Water lilies cover ${a} m² of a lake. The area doubles every week.`, `Seerosen bedecken ${a} m² eines Sees. Die Fläche verdoppelt sich jede Woche.`),
    ask: tx("How big is the area after", "Wie groß ist die Fläche nach"),
  },
  {
    start: [2, 3, 4, 5],
    q: 3,
    pers: tx("days", "Tage"),
    persDat: "Tagen",
    unit: tx("people", "Personen"),
    story: (a: number) => tx(`${a} people start a chain message. Every day the number of people who have it triples.`, `${a} Personen starten einen Kettenbrief. Jeden Tag verdreifacht sich die Zahl der Personen, die ihn haben.`),
    ask: tx("How many people have it after", "Wie viele Personen haben ihn nach"),
  },
  {
    start: [400, 600, 800, 1000],
    q: 0.5,
    pers: tx("4-hour periods", "Vier-Stunden-Abschnitte"),
    unit: "mg",
    story: (a: number) => tx(`A patient takes ${a} mg of a medicine. Every 4 hours, the amount in the blood halves.`, `Ein Patient nimmt ${a} mg eines Medikaments. Alle 4 Stunden halbiert sich die Menge im Blut.`),
    ask: tx("How much is still in the blood after", "Wie viel ist nach"),
  },
];

const expModel: Tpl = (rng) => {
  for (;;) {
    const c = rng.pick(EXP_CTX);
    const a = rng.pick(c.start);
    const n = c.q === 0.5 ? rng.int(2, 4) : c.q === 3 ? rng.int(3, 5) : rng.int(3, 7);
    const v = a * c.q ** n;
    if (!nice(v) || v > 200000) continue;
    const hours = c.q === 0.5 ? 4 * n : n;
    const after = c.q === 0.5 ? tx(`${hours} hours`, `${hours} Stunden`) : tx(`${n} ${E(c.pers)}`, `${n} ${"persDat" in c ? c.persDat : D(c.pers)}`);
    const answer = numAns(v, c.unit);
    const mk = mistakesFor(answer);
    if (c.q > 1) {
      mk.add(a * c.q * n, tx("Multiplied by the time", "Mit der Zeit multipliziert"), txs((s) => `${s.n(a)} · ${c.q} · ${n}? Exponential growth means **· ${c.q} in every step**: ${s.n(a)} · ${c.q}^${n}.`, (s) => `${s.n(a)} · ${c.q} · ${n}? Exponentiell heißt **in jedem Schritt · ${c.q}**: ${s.n(a)} · ${c.q} hoch ${n}.`));
      mk.add(a + a * (c.q - 1) * n, tx("Linear thinking", "Linear gedacht"), tx("You added the same amount each time. But the amount grows with the number: multiply in every step.", "Du hast jedes Mal gleich viel dazugezählt. Die Zunahme wächst aber mit: In jedem Schritt wird multipliziert."));
    } else {
      if (a - (a / 2) * n >= 0) mk.add(a - (a / 2) * n, tx("Linear thinking", "Linear gedacht"), tx("You took away the same amount each time. But halving takes away less and less: halve in every step.", "Du hast jedes Mal gleich viel abgezogen. Beim Halbieren wird es aber immer weniger: In jedem Schritt halbieren."));
      mk.add(a / (2 * n), tx("Divided by the time", "Durch die Zeit geteilt"), tx(`Halving ${n} times means · 0.5 in every step: ${a} · 0.5^${n}.`, `${n}-mal halbieren heißt in jedem Schritt · 0,5: ${a} · 0,5 hoch ${n}.`));
    }
    mk.add(a * c.q ** (n - 1), tx("One step missing", "Ein Schritt zu wenig"), txs((s) => `Nearly! Count the steps again: after ${s.t(after)} there are **${n}** steps, so the exponent is ${n}.`, (s) => `Fast! Zähl die Schritte noch mal: Nach ${s.t(after)} sind es **${n}** Schritte, der Exponent ist also ${n}.`), true);
    mk.add(a * c.q ** (n + 1), tx("One step too many", "Ein Schritt zu viel"), txs((s) => `Nearly! At the start (t = 0) the value is ${s.n(a)}. After ${s.t(after)} it's ${n} steps, not ${n + 1}.`, (s) => `Fast! Am Anfang (t = 0) ist der Wert ${s.n(a)}. Nach ${s.t(after)} sind es ${n} Schritte, nicht ${n + 1}.`), true);
    const qs = c.q === 0.5 ? mb((s) => s.m(0.5)) : String(c.q);
    return {
      instruction: MODEL_INSTR,
      text: txs((s) => `${s.t(c.story(a))} ${s.t(c.ask)} ${s.t(after)}?`, (s) => `${s.t(c.story(a))} ${s.t(c.ask)} ${s.t(after)}${c.q === 0.5 ? " noch im Blut" : ""}?`),
      answer,
      mistakes: mk.list,
      hint: txs((s) => `Exponential model: f(n) = ${s.n(a)} · ${s.t(qs)}ⁿ with n = number of steps.`, (s) => `Exponentielles Modell: f(n) = ${s.n(a)} · ${s.t(qs)}ⁿ mit n = Anzahl der Schritte.`),
      solution: [
        {
          math: mb((s) => `f(n)#f =#eq ${s.m(a, "a")} \\cdot#d ${s.m(c.q, "q")}^{n#n}`),
          note: txs(
            (s) => `The same **factor** ${s.n(c.q)} in every step: exponential. Start value ${s.n(a)}, n = number of ${s.t(c.pers)}.`,
            (s) => `In jedem Schritt derselbe **Faktor** ${s.n(c.q)}: exponentiell. Anfangswert ${s.n(a)}, n = Anzahl der ${s.t(c.pers)}.`,
          ),
        },
        { math: mb((s) => `f(${n})#f =#eq ${s.m(a, "a")} \\cdot#d ${s.m(c.q, "q")}^{${n}#n}`), note: txs((s) => `After ${s.t(after)}: n = ${n}.`, (s) => `Nach ${s.t(after)}: n = ${n}.`) },
        { math: mb((s) => `f(${n})#f =#eq ${s.m(a, "a")} \\cdot#d ${s.m(c.q ** n, "q", 4)}`), note: txs((s) => `${s.n(c.q)}^${n} = ${s.n(c.q ** n, 4)}.`, (s) => `${s.n(c.q)} hoch ${n} = ${s.n(c.q ** n, 4)}.`) },
        { math: mb((s) => `f(${n})#f =#eq ${s.m(v, "v")} "${s.t(c.unit)}"#u`), highlight: ["v", "u"], note: txs((s) => `**Answer:** ${s.n(v)} ${s.t(c.unit)}.`, (s) => `**Antwort:** ${s.n(v)} ${s.t(c.unit)}.`) },
      ],
    };
  }
};

const quadNext: Tpl = (rng) => {
  for (;;) {
    const a = rng.pick([1, 2, 3, -1, -2]);
    const b = rng.int(-3, 6);
    const c = rng.int(0, 15) + (a < 0 ? 30 : 0);
    const ys = [0, 1, 2, 3].map((x) => a * x * x + b * x + c);
    const target = rng.pick([4, 5]);
    const v = a * target * target + b * target + c;
    const d = ys.slice(1).map((y, i) => y - ys[i]);
    if (d[0] === d[1] || ys.some((y) => y < 0) || v < 0 || Math.abs(v) > 300) continue;
    const dd = d[1] - d[0];
    const next: number[] = [];
    let last = ys[3];
    let diff = d[2];
    for (let x = 4; x <= target; x++) {
      diff += dd;
      last += diff;
      next.push(last);
    }
    const answer = numAns(v);
    const mk = mistakesFor(answer);
    mk.add(ys[3] + d[2] * (target - 3), tx("Continued with the last difference", "Mit der letzten Differenz weitergerechnet"), tx(`The differences grow by ${dd} each time, so the next difference isn't ${d[2]} again.`, `Die Differenzen wachsen jedes Mal um ${dd}, die nächste Differenz ist also nicht wieder ${d[2]}.`));
    if (target === 5) mk.add(next[0], tx("Stopped one step early", "Einen Schritt zu früh aufgehört"), tx(`${next[0]} is f(4). The question asks for f(5): one more step.`, `${next[0]} ist f(4). Gefragt ist f(5): noch ein Schritt.`), true);
    return {
      instruction: MODEL_INSTR,
      text: tx(`The table belongs to a quadratic function. What is its value at x = ${target}?`, `Die Tabelle gehört zu einer quadratischen Funktion. Welchen Wert hat sie bei x = ${target}?`),
      visual: visual(ValueTable, { rows: [{ label: "x", values: [0, 1, 2, 3, ...(target === 5 ? [4, 5] : [4])] }, { label: "f(x)", values: [...ys, ...(target === 5 ? [null, null] : [null])] }] }),
      answer,
      mistakes: mk.list,
      hint: tx("Quadratic: the differences change by the same amount each time (constant second differences). Continue the pattern.", "Quadratisch: Die Differenzen ändern sich jedes Mal um gleich viel (gleiche 2. Differenzen). Setz das Muster fort."),
      solution: [
        { math: d.map((x, i) => `${x}#d${i}`).join(" \\quad "), note: tx(`The differences of the table: ${d.join(", ")}.`, `Die Differenzen der Tabelle: ${d.join(", ")}.`) },
        { math: `${d.map((x, i) => `${x}#d${i}`).join(" \\quad ")} \\quad \\blob{${d[2] + dd}#d3}${target === 5 ? ` \\quad \\blob{${d[2] + 2 * dd}#d4}` : ""}`, note: tx(`They change by ${dd} each time: the next ${target === 5 ? "differences are" : "difference is"} ${target === 5 ? `${d[2] + dd} and ${d[2] + 2 * dd}` : d[2] + dd}.`, `Sie ändern sich jedes Mal um ${dd}: ${target === 5 ? `Die nächsten Differenzen sind ${d[2] + dd} und ${d[2] + 2 * dd}` : `Die nächste Differenz ist ${d[2] + dd}`}.`) },
        { math: `f(${target}) =#eq ${v}#v`, highlight: ["v"], note: tx(`${target === 5 ? `${ys[3]} + ${d[2] + dd} = ${next[0]}, then ${next[0]} + ${d[2] + 2 * dd} = ${v}.` : `${ys[3]} + ${d[2] + dd} = ${v}.`} Check: $f(x) = ${polySrcEn([a, b, c])}$.`, `${target === 5 ? `${ys[3]} + ${d[2] + dd} = ${next[0]}, dann ${next[0]} + ${d[2] + 2 * dd} = ${v}.` : `${ys[3]} + ${d[2] + dd} = ${v}.`} Probe: $f(x) = ${polySrcEn([a, b, c])}$.`) },
      ],
    };
  }
};

/** Integer polynomial source (same in both languages). */
const polySrcEn = (k: [number, number, number]) => polySrc({ l: "en", de: false, t: E, n: (v) => String(v), m: (v) => String(v), e: (v) => String(v) }, k);

// ---------------------------------------------------------------------------
// Optimising with a parabola

const OPT_INSTR = tx("Find the best value", "Finde den besten Wert");

const fenceWall: Tpl = (rng) => {
  const L = rng.pick([20, 24, 28, 32, 36, 40, 48, 60, 80, 100]);
  const x = L / 4;
  const y = L / 2;
  const A = clean((L * L) / 8);
  const what = rng.pick([
    { en: "a rectangular run for rabbits", de: "ein rechteckiges Freigehege für Kaninchen" },
    { en: "a rectangular vegetable patch", de: "ein rechteckiges Gemüsebeet" },
    { en: "a rectangular chicken run", de: "einen rechteckigen Hühnerauslauf" },
  ]);
  const askArea = rng.chance(0.7);
  const answer = numAns(askArea ? A : y, askArea ? "m²" : "m");
  const mk = mistakesFor(answer);
  if (askArea) {
    mk.add(x, tx("The width, not the area", "Die Breite statt der Fläche"), tx(`${x} m is the best width x. The question asks for the **area**: insert x into A(x).`, `${x} m ist die beste Breite x. Gefragt ist der **Flächeninhalt**: Setz x in A(x) ein.`));
    mk.add((L / 4) ** 2, tx("Fenced on four sides", "Mit vier Zaunseiten gerechnet"), tx("The house wall saves one side: only three sides need fence. So y = " + `${L} − 2x, not ${L / 2} − x.`, "Die Hauswand spart eine Seite: Nur drei Seiten brauchen Zaun. Also y = " + `${L} − 2x, nicht ${L / 2} − x.`));
    if (L % 3 === 0) mk.add((L / 3) ** 2, tx("A square isn't best here", "Ein Quadrat ist hier nicht optimal"), tx("With a wall, three equal sides aren't the best. Set up A(x) = x(" + `${L} − 2x) and find the vertex.`, "Mit Hauswand sind drei gleich lange Seiten nicht am besten. Stell A(x) = x(" + `${L} − 2x) auf und finde den Scheitelpunkt.`));
  } else {
    mk.add(x, tx("The other side", "Die andere Seite"), tx(`${x} m is the width x (away from the wall). The side **along** the wall is ${L} − 2x.`, `${x} m ist die Breite x (weg von der Wand). Die Seite **an** der Wand ist ${L} − 2x.`));
    mk.add(A, tx("The area, not the side", "Die Fläche statt der Seite"), tx("That's the biggest area. The question asks for the length of the side along the wall.", "Das ist der größte Flächeninhalt. Gefragt ist die Länge der Seite an der Wand."));
  }
  return {
    instruction: OPT_INSTR,
    text: tx(
      `With ${L} m of fence, ${what.en} is built against a house wall. The wall forms one side, so only three sides need fence. ${askArea ? "How big can the area be at most?" : "How long should the side along the wall be for the biggest area?"}`,
      `Mit ${L} m Zaun soll an einer Hauswand ${what.de} entstehen. Die Wand bildet eine Seite, nur drei Seiten brauchen Zaun. ${askArea ? "Wie groß kann die Fläche höchstens werden?" : "Wie lang sollte die Seite an der Wand für die größte Fläche sein?"}`,
    ),
    answer,
    mistakes: mk.list,
    hint: tx(`Width x, side along the wall y = ${L} − 2x. Area A(x) = x(${L} − 2x): find the vertex.`, `Breite x, Seite an der Wand y = ${L} − 2x. Fläche A(x) = x(${L} − 2x): Finde den Scheitelpunkt.`),
    solution: [
      { math: `2x#a +#p y#y =#eq ${L}#L`, note: tx(`Two widths x and one side y need fence: ${L} m together.`, `Zwei Breiten x und eine Seite y brauchen Zaun: zusammen ${L} m.`) },
      { math: `A(x)#A =#eq x#x \\cdot#d (${L}#L -#m 2x#a)#br`, note: tx(`y = ${L} − 2x, so the area depends only on x.`, `y = ${L} − 2x, also hängt die Fläche nur von x ab.`) },
      { math: `x_1#z1 =#e1 0 , \\quad x_2#z2 =#e2 ${L / 2}`, note: tx(`Zeros: x = 0 or ${L} − 2x = 0, so x = ${L / 2}.`, `Nullstellen: x = 0 oder ${L} − 2x = 0, also x = ${L / 2}.`) },
      { math: mb((s) => `x_S#xs =#e3 \\frac{0 + ${L / 2}}{2} =#e4 ${s.m(x)}`), note: tx("The vertex lies halfway between the zeros.", "Der Scheitelpunkt liegt in der Mitte zwischen den Nullstellen.") },
      {
        math: mb((s) => (askArea ? `A(${s.m(x)}) =#e5 ${s.m(x)} \\cdot ${s.m(y)} =#e6 ${s.m(A, "r")} "m²"#u` : `y =#e5 ${L} - 2 \\cdot ${s.m(x)} =#e6 ${s.m(y, "r")} "m"#u`)),
        highlight: ["r", "u"],
        note: txs(
          (s) => `**Answer:** ${askArea ? `At most ${s.n(A)} m² (with x = ${s.n(x)} m and y = ${s.n(y)} m).` : `The side along the wall should be ${s.n(y)} m long (and x = ${s.n(x)} m).`}`,
          (s) => `**Antwort:** ${askArea ? `Höchstens ${s.n(A)} m² (mit x = ${s.n(x)} m und y = ${s.n(y)} m).` : `Die Seite an der Wand sollte ${s.n(y)} m lang sein (und x = ${s.n(x)} m).`}`,
        ),
      },
    ],
  };
};

const fenceFree: Tpl = (rng) => {
  const L = rng.pick([16, 20, 24, 28, 32, 36, 40, 60, 80]);
  const x = L / 4;
  const A = x * x;
  const answer = numAns(A, "m²");
  const mk = mistakesFor(answer);
  mk.add((L / 2) ** 2, tx("The whole half as one side", "Die halbe Länge als eine Seite"), tx(`Two sides x and y together are half the fence: x + y = ${L / 2}. Each side alone is shorter.`, `Zwei Seiten x und y sind zusammen der halbe Zaun: x + y = ${L / 2}. Jede Seite allein ist kürzer.`));
  mk.add((L * L) / 8, tx("Calculated with a wall", "Mit Hauswand gerechnet"), tx("Here the fence goes all the way round: four sides, so y = " + `${L / 2} − x.`, "Hier geht der Zaun ganz herum: vier Seiten, also y = " + `${L / 2} − x.`));
  mk.add(x, tx("The side, not the area", "Die Seite statt der Fläche"), tx(`${x} m is the best side length. The question asks for the area.`, `${x} m ist die beste Seitenlänge. Gefragt ist der Flächeninhalt.`));
  return {
    instruction: OPT_INSTR,
    text: tx(
      `A rectangular plot is to be fenced in with ${L} m of fence all the way round. How big can the area be at most?`,
      `Ein rechteckiges Grundstück soll mit ${L} m Zaun ganz eingezäunt werden. Wie groß kann die Fläche höchstens werden?`,
    ),
    answer,
    mistakes: mk.list,
    hint: tx(`2x + 2y = ${L}, so y = ${L / 2} − x. A(x) = x(${L / 2} − x): find the vertex.`, `2x + 2y = ${L}, also y = ${L / 2} − x. A(x) = x(${L / 2} − x): Finde den Scheitelpunkt.`),
    solution: [
      { math: `2x#a +#p 2y#y =#eq ${L}#L`, note: tx("Four sides of fence.", "Vier Seiten Zaun.") },
      { math: `A(x)#A =#eq x#x \\cdot#d (${L / 2}#L -#m x#a)#br`, note: tx(`y = ${L / 2} − x.`, `y = ${L / 2} − x.`) },
      { math: `x_S#xs =#e3 \\frac{0 + ${L / 2}}{2} =#e4 ${x}`, note: tx(`Zeros 0 and ${L / 2}, the vertex halfway between.`, `Nullstellen 0 und ${L / 2}, der Scheitelpunkt in der Mitte.`) },
      { math: `A(${x}) =#e5 ${x} \\cdot ${x} =#e6 ${A}#r "m²"#u`, highlight: ["r", "u"], note: tx(`**Answer:** at most ${A} m². The best rectangle is a square with sides of ${x} m.`, `**Antwort:** höchstens ${A} m². Das beste Rechteck ist ein Quadrat mit ${x} m Seitenlänge.`) },
    ],
  };
};

const throwMax: Tpl = (rng) => {
  const v = rng.pick([10, 15, 20, 25, 30]);
  const h0 = rng.pick([0, 1, 1.5, 2]);
  const ts = v / 10;
  const H = clean((v * v) / 20 + h0);
  const askTime = rng.chance(0.3);
  const what = rng.pick([
    { en: "A ball is thrown straight up", de: "Ein Ball wird senkrecht nach oben geworfen", er: true },
    { en: "A water rocket is launched straight up", de: "Eine Wasserrakete startet senkrecht nach oben", er: false },
    { en: "A stone is tossed straight up", de: "Ein Stein wird senkrecht nach oben geworfen", er: true },
  ]);
  const pron = what.er ? "er" : "sie";
  const answer = numAns(askTime ? ts : H, askTime ? "s" : "m");
  const mk = mistakesFor(answer);
  const term = (s: Say) => `-5t^2 + ${v}t${h0 ? ` + ${s.m(h0)}` : ""}`;
  if (askTime) {
    mk.add(H, tx("The height, not the time", "Die Höhe statt der Zeit"), tx("That's the greatest height. The question asks **when** it's reached.", "Das ist die größte Höhe. Gefragt ist, **wann** sie erreicht wird."));
    mk.add(v / 5, tx("Back down, not the top", "Wieder unten statt ganz oben"), tx("At that time it's back at its start height. The top lies exactly halfway in between.", `Dann ist ${pron} wieder auf der Abwurfhöhe. Der höchste Punkt liegt genau in der Mitte.`));
  } else {
    mk.add(ts, tx("The time, not the height", "Die Zeit statt der Höhe"), txs((s) => `Good start: the top is reached after ${s.n(ts)} s. Now insert t = ${s.n(ts)} to get the **height**.`, (s) => `Guter Anfang: Der höchste Punkt ist nach ${s.n(ts)} s erreicht. Jetzt t = ${s.n(ts)} einsetzen, dann hast du die **Höhe**.`));
    if (h0) mk.add(H - h0, tx("Start height forgotten", "Abwurfhöhe vergessen"), txs((s) => `Nearly! The + ${s.n(h0)} m (the height it starts from) still belongs to it.`, (s) => `Fast! Die + ${s.n(h0)} m (die Abwurfhöhe) gehören noch dazu.`), true);
    mk.add(clean(-5 * ts + v * ts + h0), tx("t² forgotten", "t² vergessen"), txs((s) => `Careful with −5t²: at t = ${s.n(ts)} that's −5 · ${s.n(ts * ts)}, not −5 · ${s.n(ts)}.`, (s) => `Vorsicht bei −5t²: Bei t = ${s.n(ts)} ist das −5 · ${s.n(ts * ts)}, nicht −5 · ${s.n(ts)}.`));
  }
  return {
    instruction: OPT_INSTR,
    text: txs(
      (s) => `${what.en}. Its height in metres after t seconds is h(t) = ${term(s).replace(/\^2/, "²").replace(/-/g, "−")}. ${askTime ? "After how many seconds does it reach its greatest height?" : "How high does it fly at most?"}`,
      (s) => `${what.de}. Die Höhe in Metern nach t Sekunden ist h(t) = ${term(s).replace(/\^2/, "²").replace(/-/g, "−")}. ${askTime ? `Nach wie vielen Sekunden erreicht ${pron} die größte Höhe?` : `Wie hoch fliegt ${pron} höchstens?`}`,
    ),
    answer,
    mistakes: mk.list,
    hint: tx(`Without the start height: −5t² + ${v}t = −5t(t − ${v / 5}). The vertex lies halfway between the zeros.`, `Ohne die Abwurfhöhe: −5t² + ${v}t = −5t(t − ${v / 5}). Der Scheitelpunkt liegt in der Mitte zwischen den Nullstellen.`),
    solution: [
      { math: mb((s) => `h(t)#h =#eq ${term(s)}`), note: tx("The parabola opens downwards: its vertex is the highest point.", "Die Parabel ist nach unten geöffnet: Ihr Scheitelpunkt ist der höchste Punkt.") },
      { math: `-5t^2 + ${v}t =#eq -5t(t - ${v / 5})`, note: tx(`Without the start height: zeros at t = 0 and t = ${v / 5}. ${h0 ? "The start height only shifts the parabola up, the vertex stays at the same t." : ""}`.trim(), `Ohne Abwurfhöhe: Nullstellen bei t = 0 und t = ${v / 5}. ${h0 ? "Die Abwurfhöhe schiebt die Parabel nur nach oben, der Scheitel bleibt beim selben t." : ""}`.trim()) },
      { math: mb((s) => `t_S#ts =#e2 \\frac{0 + ${v / 5}}{2} =#e3 ${s.m(ts, "t")}`), highlight: askTime ? ["t"] : [], note: txs((s) => `Halfway between the zeros: after ${s.n(ts)} s.`, (s) => `In der Mitte zwischen den Nullstellen: nach ${s.n(ts)} s.`) },
      {
        math: mb((s) => `h(${s.m(ts)}) =#e4 -5 \\cdot ${s.m(ts * ts)} + ${v} \\cdot ${s.m(ts)}${h0 ? ` + ${s.m(h0)}` : ""} =#e5 ${s.m(H, "r")}`),
        highlight: askTime ? [] : ["r"],
        note: txs(
          (s) => `**Answer:** ${askTime ? `after ${s.n(ts)} s, at a height of ${s.n(H)} m.` : `at most ${s.n(H)} m high (after ${s.n(ts)} s).`}`,
          (s) => `**Antwort:** ${askTime ? `nach ${s.n(ts)} s, in ${s.n(H)} m Höhe.` : `höchstens ${s.n(H)} m hoch (nach ${s.n(ts)} s).`}`,
        ),
      },
    ],
  };
};

const revenue: Tpl = (rng) => {
  for (;;) {
    const p0 = rng.pick([6, 8, 9, 10, 12]);
    const k = rng.pick([10, 20, 25, 30, 50]);
    const xs = rng.int(1, 3);
    const n0 = k * (p0 - 2 * xs);
    if (n0 < 60 || n0 > 600) continue;
    const price = p0 - xs;
    const E2 = price * (n0 + k * xs);
    const askPrice = rng.chance(0.5);
    const what = rng.pick([
      { en: "A school cinema club sells", de: "Ein Schulkino verkauft", item: tx("tickets", "Karten"), each: tx("a ticket", "pro Karte") },
      { en: "A football club sells", de: "Ein Fußballverein verkauft", item: tx("scarves", "Schals"), each: tx("a scarf", "pro Schal") },
      { en: "A café sells", de: "Ein Café verkauft", item: tx("cakes", "Kuchenstücke"), each: tx("a piece", "pro Stück") },
    ]);
    const answer = numAns(askPrice ? price : E2, "€");
    const mk = mistakesFor(answer);
    if (askPrice) {
      mk.add(xs, tx("The reduction, not the price", "Die Senkung statt des Preises"), tx(`${xs} € is how much the price drops. The new price is ${p0} € − ${xs} €.`, `${xs} € ist die Preissenkung. Der neue Preis ist ${p0} € − ${xs} €.`));
      mk.add(p0, tx("Old price kept", "Alter Preis behalten"), tx(`At ${p0} € the revenue is ${p0 * n0} €. A slightly lower price brings in more: find the vertex of E(x).`, `Bei ${p0} € sind es ${p0 * n0} € Einnahmen. Ein etwas niedrigerer Preis bringt mehr: Finde den Scheitelpunkt von E(x).`));
      mk.add(E2, tx("The revenue, not the price", "Die Einnahmen statt des Preises"), tx("That's the biggest revenue. The question asks for the best price.", "Das sind die größten Einnahmen. Gefragt ist der beste Preis."));
    } else {
      mk.add(p0 * n0, tx("Old revenue", "Alte Einnahmen"), tx(`That's the revenue at the old price. A lower price brings more ${E(what.item)}: find the vertex of E(x).`, `Das sind die Einnahmen beim alten Preis. Ein niedrigerer Preis bringt mehr verkaufte ${D(what.item)}: Finde den Scheitelpunkt von E(x).`));
      mk.add(price, tx("The price, not the revenue", "Der Preis statt der Einnahmen"), tx(`${price} € is the best price. The question asks for the revenue: price · number sold.`, `${price} € ist der beste Preis. Gefragt sind die Einnahmen: Preis · Anzahl.`));
    }
    return {
      instruction: OPT_INSTR,
      text: txs(
        (s) => `${what.en} ${n0} ${s.t(what.item)} a week at ${p0} € each. For every 1 € the price goes down, ${k} more are sold. ${askPrice ? "Which price brings in the most money?" : "What is the biggest possible revenue per week?"}`,
        (s) => `${what.de} pro Woche ${n0} ${s.t(what.item)} zu je ${p0} €. Pro 1 € Preissenkung werden ${k} mehr verkauft. ${askPrice ? "Bei welchem Preis sind die Einnahmen am größten?" : "Wie hoch sind die größtmöglichen Einnahmen pro Woche?"}`,
      ),
      answer,
      mistakes: mk.list,
      hint: tx(`x = reduction in €. Revenue E(x) = (${p0} − x)(${n0} + ${k}x). The zeros are x = ${p0} and x = −${n0 / k}.`, `x = Preissenkung in €. Einnahmen E(x) = (${p0} − x)(${n0} + ${k}x). Die Nullstellen sind x = ${p0} und x = −${n0 / k}.`),
      solution: [
        { math: `E(x)#E =#eq (${p0}#p -#m x#x)#b1 \\cdot#d (${n0}#n +#q ${k}x#k)#b2`, note: tx("Revenue = price · number sold, both depend on the reduction x.", "Einnahmen = Preis · Anzahl, beide hängen von der Senkung x ab.") },
        { math: `x_1#z1 =#e1 ${p0} , \\quad x_2#z2 =#e2 -${n0 / k}`, note: tx(`E(x) = 0 when ${p0} − x = 0 or ${n0} + ${k}x = 0.`, `E(x) = 0, wenn ${p0} − x = 0 oder ${n0} + ${k}x = 0.`) },
        { math: `x_S#xs =#e3 \\frac{${p0} + (-${n0 / k})}{2} =#e4 ${xs}`, note: tx("The vertex lies halfway between the zeros.", "Der Scheitelpunkt liegt in der Mitte zwischen den Nullstellen.") },
        {
          math: `E(${xs}) =#e5 ${price} \\cdot ${n0 + k * xs} =#e6 ${E2}#r "€"#u`,
          highlight: ["r", "u"],
          note: tx(
            `**Answer:** ${askPrice ? `The best price is ${p0} € − ${xs} € = ${price} €` : `At most ${E2} € a week (at ${price} € each)`}: ${n0 + k * xs} sold, ${E2} € revenue.`,
            `**Antwort:** ${askPrice ? `Der beste Preis ist ${p0} € − ${xs} € = ${price} €` : `Höchstens ${E2} € pro Woche (bei ${price} € pro Stück)`}: ${n0 + k * xs} verkauft, ${E2} € Einnahmen.`,
          ),
        },
      ],
    };
  }
};

// ---------------------------------------------------------------------------
// Fermi estimates

const FERMI_INSTR = tx("Estimate with a plan", "Schätze mit einem Plan");

type FermiCase = { question: (rng: Rng) => { text: Text; steps: { math: (s: Say) => string; note: Text }[]; value: number; unit: Text; forgot: { v: number; say: Text }[] } };

const FERMI: FermiCase[] = [
  {
    question: (rng) => {
      const S = rng.pick([400, 500, 600, 800, 1000, 1200]);
      const l = 0.5;
      const days = 190;
      const v = S * l * days;
      return {
        text: tx(
          `How many litres of water do the ${S} students of a school drink during school hours in one school year? Assume half a litre per student and school day, and 190 school days.`,
          `Wie viele Liter Wasser trinken die ${S} Schülerinnen und Schüler einer Schule während der Schulzeit in einem Schuljahr? Nimm einen halben Liter pro Person und Schultag und 190 Schultage an.`,
        ),
        steps: [
          { math: (s) => `${S} \\cdot ${s.m(0.5)} = ${S / 2}`, note: tx(`Per school day: ${S / 2} litres.`, `Pro Schultag: ${S / 2} Liter.`) },
          { math: (s) => `${S / 2} \\cdot 190 = ${s.m(v)}`, note: txs((s) => `In 190 school days: ${s.n(v)} litres.`, (s) => `In 190 Schultagen: ${s.n(v)} Liter.`) },
        ],
        value: v,
        unit: tx("litres", "Liter"),
        forgot: [{ v: S / 2, say: tx("That's just one school day. Multiply by the number of school days.", "Das ist nur ein Schultag. Multipliziere noch mit der Zahl der Schultage.") }],
      };
    },
  },
  {
    question: (rng) => {
      const P = rng.pick([100000, 200000, 300000, 500000]);
      const v = P * 12;
      return {
        text: tx(
          `How many pizzas are eaten in a city with ${nf(P, "en", 0)} inhabitants in one year? Assume every inhabitant eats one pizza a month.`,
          `Wie viele Pizzen werden in einer Stadt mit ${nf(P, "de", 0)} Einwohnern in einem Jahr gegessen? Nimm an, jeder isst eine Pizza im Monat.`,
        ),
        steps: [{ math: (s) => `${s.m(P)} \\cdot 12 = ${s.m(v)}`, note: tx(`12 months: ${nf(v, "en", 0)} pizzas.`, `12 Monate: ${nf(v, "de", 0)} Pizzen.`) }],
        value: v,
        unit: tx("pizzas", "Pizzen"),
        forgot: [{ v: P, say: tx("That's one month. A year has 12.", "Das ist ein Monat. Ein Jahr hat 12.") }],
      };
    },
  },
  {
    question: (rng) => {
      const b = rng.pick([60, 70, 80]);
      const v = b * 60 * 24;
      return {
        text: tx(`How often does a heart beat in one day? Assume ${b} beats per minute.`, `Wie oft schlägt ein Herz an einem Tag? Nimm ${b} Schläge pro Minute an.`),
        steps: [
          { math: () => `${b} \\cdot 60 = ${b * 60}`, note: tx(`Per hour: ${b * 60}.`, `Pro Stunde: ${b * 60}.`) },
          { math: (s) => `${b * 60} \\cdot 24 = ${s.m(v)}`, note: tx(`Per day: ${nf(v, "en", 0)}.`, `Pro Tag: ${nf(v, "de", 0)}.`) },
        ],
        value: v,
        unit: tx("beats", "Schläge"),
        forgot: [{ v: b * 60, say: tx("That's one hour. A day has 24 of them.", "Das ist eine Stunde. Ein Tag hat 24 davon.") }],
      };
    },
  },
  {
    question: (rng) => {
      const T = rng.pick([20, 25, 30, 40]);
      const v = 2 * T * 190;
      return {
        text: tx(
          `How many kilometres does a school bus drive in a school year? Assume one round trip of ${T} km in the morning and one in the afternoon, on 190 school days.`,
          `Wie viele Kilometer fährt ein Schulbus in einem Schuljahr? Nimm morgens und nachmittags je eine Runde von ${T} km an, an 190 Schultagen.`,
        ),
        steps: [
          { math: () => `2 \\cdot ${T} = ${2 * T}`, note: tx(`Per day: ${2 * T} km.`, `Pro Tag: ${2 * T} km.`) },
          { math: (s) => `${2 * T} \\cdot 190 = ${s.m(v)}`, note: tx(`Per school year: ${nf(v, "en", 0)} km.`, `Pro Schuljahr: ${nf(v, "de", 0)} km.`) },
        ],
        value: v,
        unit: "km",
        forgot: [{ v: T * 190, say: tx("That's only the morning trips. The bus also drives in the afternoon.", "Das sind nur die Fahrten am Morgen. Der Bus fährt auch nachmittags.") }],
      };
    },
  },
  {
    question: (rng) => {
      const S = rng.pick([500, 600, 800, 1000]);
      const p = rng.pick([5, 8, 10]);
      const v = S * p * 190;
      return {
        text: tx(
          `How many sheets of paper does a school with ${S} students use in a school year? Assume ${p} sheets per student and school day, and 190 school days.`,
          `Wie viele Blatt Papier verbraucht eine Schule mit ${S} Schülerinnen und Schülern in einem Schuljahr? Nimm ${p} Blatt pro Person und Schultag und 190 Schultage an.`,
        ),
        steps: [
          { math: () => `${S} \\cdot ${p} = ${S * p}`, note: tx(`Per day: ${S * p} sheets.`, `Pro Tag: ${S * p} Blatt.`) },
          { math: (s) => `${S * p} \\cdot 190 = ${s.m(v)}`, note: tx(`Per school year: ${nf(v, "en", 0)} sheets.`, `Pro Schuljahr: ${nf(v, "de", 0)} Blatt.`) },
        ],
        value: v,
        unit: tx("sheets", "Blatt"),
        forgot: [{ v: S * p, say: tx("That's just one day. Multiply by the school days.", "Das ist nur ein Tag. Multipliziere noch mit den Schultagen.") }],
      };
    },
  },
];

/** One significant digit: 76 000 → 80 000. */
function sig1(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.round(v / p) * p;
}

const fermi: Tpl = (rng) => {
  const q = rng.pick(FERMI).question(rng);
  const right = sig1(q.value);
  const forgot = q.forgot[0];
  const cands: { v: number; title: Text; say: Text }[] = [
    { v: sig1(forgot.v), title: tx("A factor forgotten", "Einen Faktor vergessen"), say: forgot.say },
    { v: right / 10, title: tx("A power of ten too small", "Eine Zehnerpotenz zu klein"), say: tx("One power of ten too small: count the zeros in your chain again.", "Eine Zehnerpotenz zu klein: Zähl die Nullen in deiner Rechenkette noch mal.") },
    { v: right * 10, title: tx("A power of ten too big", "Eine Zehnerpotenz zu groß"), say: tx("One power of ten too big: count the zeros in your chain again.", "Eine Zehnerpotenz zu groß: Zähl die Nullen in deiner Rechenkette noch mal.") },
    { v: right * 100, title: tx("Two powers of ten too big", "Zwei Zehnerpotenzen zu groß"), say: tx("Far too much: estimate each step roughly and compare.", "Viel zu viel: Überschlag jeden Schritt grob und vergleiche.") },
    { v: right / 100, title: tx("Two powers of ten too small", "Zwei Zehnerpotenzen zu klein"), say: tx("Far too little: estimate each step roughly and compare.", "Viel zu wenig: Überschlag jeden Schritt grob und vergleiche.") },
  ];
  const picked: { v: number; title?: Text; say?: Text }[] = [{ v: right }];
  for (const c of cands) {
    if (picked.length >= 4) break;
    // Options at least a factor 3 apart, so they really are different orders of magnitude.
    if (c.v < 1 || picked.some((p) => Math.max(p.v, c.v) / Math.min(p.v, c.v) < 3)) continue;
    picked.push(c);
  }
  picked.sort((a, b) => a.v - b.v);
  const opts: Opt[] = picked.map((p) => ({ text: txs((s) => `about ${s.n(p.v, 0)} ${s.t(q.unit)}`, (s) => `etwa ${s.n(p.v, 0)} ${s.t(q.unit)}`), title: p.title, say: p.say }));
  const { answer, mistakes } = fixedChoice(opts, picked.findIndex((p) => p.v === right));
  return {
    instruction: FERMI_INSTR,
    text: q.text,
    answer,
    mistakes,
    hint: tx("Break it into steps you can calculate, one after the other. Then round.", "Zerleg es in Schritte, die du nacheinander ausrechnen kannst. Dann runden."),
    solution: [
      ...q.steps.map((st) => ({ math: mb(st.math), note: st.note })),
      { math: mb((s) => `\\approx ${s.m(right, "r", 0)}`), highlight: ["r"], note: txs((s) => `Rounded: **about ${s.n(right, 0)} ${s.t(q.unit)}**. That's the order of magnitude that counts.`, (s) => `Gerundet: **etwa ${s.n(right, 0)} ${s.t(q.unit)}**. Auf diese Größenordnung kommt es an.`) },
    ],
  };
};

const FERMI_ORDERS: { q: Text; steps: Text[]; first: Text }[] = [
  {
    q: tx("How many piano tuners work in a big city?", "Wie viele Klavierstimmer arbeiten in einer Großstadt?"),
    steps: [
      tx("Look up the number of inhabitants", "Einwohnerzahl nachschlagen"),
      tx("Households = inhabitants : people per household", "Haushalte = Einwohner : Personen pro Haushalt"),
      tx("Pianos = households : 20 (every 20th has one)", "Klaviere = Haushalte : 20 (jeder 20. hat eins)"),
      tx("Tunings per year = pianos · 1", "Stimmungen pro Jahr = Klaviere · 1"),
      tx("Divide by what one tuner manages in a year", "Durch das teilen, was ein Stimmer im Jahr schafft"),
    ],
    first: tx("pianos", "Klaviere"),
  },
  {
    q: tx("How many hairdressers work in a big city?", "Wie viele Friseure arbeiten in einer Großstadt?"),
    steps: [
      tx("Look up the number of inhabitants", "Einwohnerzahl nachschlagen"),
      tx("Haircuts per year = inhabitants · 6", "Haarschnitte pro Jahr = Einwohner · 6"),
      tx("One hairdresser: 8 a day · 220 days", "Ein Friseur: 8 pro Tag · 220 Tage"),
      tx("Divide the haircuts by what one hairdresser manages", "Die Haarschnitte durch die Leistung eines Friseurs teilen"),
    ],
    first: tx("haircuts", "Haarschnitte"),
  },
  {
    q: tx("How much water does a school drink in a school year?", "Wie viel Wasser trinkt eine Schule in einem Schuljahr?"),
    steps: [
      tx("Find the number of students", "Schülerzahl herausfinden"),
      tx("Estimate the litres per student and day", "Liter pro Person und Tag schätzen"),
      tx("Litres per day for the whole school", "Liter pro Tag für die ganze Schule"),
      tx("Multiply by the school days in a year", "Mit den Schultagen im Jahr multiplizieren"),
    ],
    first: tx("litres", "Liter"),
  },
  {
    q: tx("How many petrol stations are there in Germany?", "Wie viele Tankstellen gibt es in Deutschland?"),
    steps: [
      tx("Look up the number of cars (about 49 million)", "Zahl der Autos nachschlagen (etwa 49 Millionen)"),
      tx("Fill-ups per week = cars · 1", "Tankfüllungen pro Woche = Autos · 1"),
      tx("One station: about 500 fill-ups a day, 3500 a week", "Eine Tankstelle: etwa 500 Füllungen pro Tag, 3500 pro Woche"),
      tx("Divide the fill-ups by what one station manages", "Die Tankfüllungen durch die Leistung einer Tankstelle teilen"),
    ],
    first: tx("fill-ups", "Tankfüllungen"),
  },
];

const fermiOrder: Tpl = (rng) => {
  const c = rng.pick(FERMI_ORDERS);
  const n = c.steps.length;
  return {
    instruction: tx("Put the steps of the estimate in order", "Bring die Schritte der Schätzung in die richtige Reihenfolge"),
    text: txs((s) => `**${s.t(c.q)}** A Fermi estimate goes step by step, each step uses the one before.`, (s) => `**${s.t(c.q)}** Eine Fermi-Schätzung geht Schritt für Schritt, jeder Schritt baut auf dem vorigen auf.`),
    answer: { kind: "order", items: c.steps },
    mistakes: [
      {
        when: { kind: "order", items: [c.steps[n - 1], c.steps[n - 2]] },
        title: tx("Divided too early", "Zu früh geteilt"),
        say: tx("First work out the total demand, then divide it by what one person or station manages.", "Rechne zuerst den Gesamtbedarf aus und teile ihn dann durch die Leistung von einer Person oder Station."),
      },
    ],
    hint: tx("Start with what you can look up, and end with the number that was asked for.", "Fang mit dem an, was du nachschlagen kannst, und hör mit der gesuchten Zahl auf."),
    solution: c.steps.map((st, i) => ({
      math: tx(`"Step"#w ${i + 1}#n`, `"Schritt"#w ${i + 1}#n`),
      note: txs((s) => `${s.t(st)}.${i === n - 1 ? " Only now do you divide: the total comes first." : ""}`, (s) => `${s.t(st)}.${i === n - 1 ? " Erst jetzt wird geteilt: Der Gesamtbedarf kommt zuerst." : ""}`),
    })),
  };
};

// ---------------------------------------------------------------------------
// Checking a model: where does it make sense?

const CHECK_INSTR = tx("Check the model", "Prüfe das Modell");

const ballLand: Tpl = (rng) => {
  const withStart = rng.chance(0.4);
  if (!withStart) {
    const v = rng.pick([10, 15, 20, 25, 30, 35, 40]);
    const T = v / 5;
    const answer = numAns(T, "s");
    const mk = mistakesFor(answer);
    mk.add(v / 10, tx("The highest point, not the landing", "Der höchste Punkt statt der Landung"), tx("At that time the ball is at its highest. It lands when h(t) = 0 again.", "Da ist der Ball am höchsten. Er landet, wenn h(t) wieder 0 ist."));
    mk.add(v, tx("Read off the 20t", "Den Faktor vor t abgelesen"), tx(`Set h(t) = 0 and factor out t: t(${v} − 5t) = 0.`, `Setz h(t) = 0 und klammere t aus: t(${v} − 5t) = 0.`));
    return {
      instruction: CHECK_INSTR,
      text: tx(
        `A ball is thrown straight up from the ground: h(t) = ${v}t − 5t² (h in m, t in s). The model only makes sense while the ball is in the air. After how many seconds does it land?`,
        `Ein Ball wird vom Boden aus senkrecht hochgeworfen: h(t) = ${v}t − 5t² (h in m, t in s). Das Modell ist nur sinnvoll, solange der Ball in der Luft ist. Nach wie vielen Sekunden landet er?`,
      ),
      answer,
      mistakes: mk.list,
      hint: tx("Landing means h(t) = 0. Factor out t.", "Landen heißt h(t) = 0. Klammere t aus."),
      solution: [
        { math: `${v}t - 5t^2 =#eq 0`, note: tx("Landing: the height is 0 again.", "Landung: Die Höhe ist wieder 0.") },
        { math: `t#t (${v} - 5t)#b =#eq 0`, note: tx("Factor out t. A product is 0 when one factor is 0.", "t ausklammern. Ein Produkt ist 0, wenn ein Faktor 0 ist.") },
        { math: `t_1 =#e1 0 \\quad t_2 =#e2 ${T}#r`, highlight: ["r"], note: tx(`t = 0 is the throw, t = ${T} the landing. **Answer:** after ${T} s. The model makes sense for 0 ≤ t ≤ ${T}.`, `t = 0 ist der Abwurf, t = ${T} die Landung. **Antwort:** nach ${T} s. Das Modell ist sinnvoll für 0 ≤ t ≤ ${T}.`) },
      ],
    };
  }
  const r1 = rng.pick([-1, -2]);
  const r2 = rng.int(3, 6);
  const v = 5 * (r1 + r2);
  const h0 = -5 * r1 * r2;
  const p = -(r1 + r2);
  const q = r1 * r2;
  const answer = numAns(r2, "s");
  const mk = mistakesFor(answer);
  mk.add((r1 + r2) / 2, tx("The highest point, not the landing", "Der höchste Punkt statt der Landung"), tx("At that time the ball is at its highest. It lands when h(t) = 0.", "Da ist der Ball am höchsten. Er landet, wenn h(t) = 0 ist."));
  mk.add(Math.abs(r1), tx("The negative solution", "Die negative Lösung"), tx(`t = ${r1} is a solution of the equation, but negative times are before the throw: the model doesn't apply there.`, `t = ${r1} löst zwar die Gleichung, aber negative Zeiten liegen vor dem Abwurf: Dort gilt das Modell nicht.`));
  return {
    instruction: CHECK_INSTR,
    text: tx(
      `A ball is thrown up from a ${h0} m high tower: h(t) = −5t² + ${v}t + ${h0} (h in m, t in s). After how many seconds does it hit the ground?`,
      `Ein Ball wird von einem ${h0} m hohen Turm nach oben geworfen: h(t) = −5t² + ${v}t + ${h0} (h in m, t in s). Nach wie vielen Sekunden schlägt er auf dem Boden auf?`,
    ),
    answer,
    mistakes: mk.list,
    hint: tx("Set h(t) = 0, divide by −5 and use the pq formula. Then think: which solution makes sense?", "Setz h(t) = 0, teile durch −5 und nimm die pq-Formel. Dann überleg: Welche Lösung ist sinnvoll?"),
    solution: [
      { math: `-5t^2 + ${v}t + ${h0} =#eq 0`, note: tx("Hitting the ground: h(t) = 0.", "Aufschlag: h(t) = 0.") },
      { math: `t^2 ${p < 0 ? "-" : "+"} ${Math.abs(p)}t ${q < 0 ? "-" : "+"} ${Math.abs(q)} =#eq 0`, note: tx("Divide by −5: normal form.", "Durch −5 teilen: Normalform.") },
      { math: `t_1 =#e1 ${r1} \\quad t_2 =#e2 ${r2}#r`, note: tx("pq formula (or factorise): two solutions.", "pq-Formel (oder faktorisieren): zwei Lösungen.") },
      { math: `t =#e2 ${r2}#r "s"#u`, highlight: ["r", "u"], note: tx(`A negative time lies before the throw, so only t = ${r2} makes sense. **Answer:** after ${r2} s.`, `Eine negative Zeit liegt vor dem Abwurf, sinnvoll ist nur t = ${r2}. **Antwort:** nach ${r2} s.`) },
    ],
  };
};

const domainChoice: Tpl = (rng) => {
  for (;;) {
    const c = rng.pick(LIN_CTX);
    const S = rng.pick(c.start);
    const r = rng.pick(c.rate);
    if (S % r !== 0 || S / r === r || S / r > 60 || S === r) continue;
    const T = S / r;
    const opts: Opt[] = [
      { text: `$0 \\le t \\le ${T}$` },
      { text: `$t \\ge 0$`, title: tx("No end", "Kein Ende"), say: tx(`After ${T} ${E(c.time)} the model gives negative values. That can't happen: the model stops there.`, `Nach ${T} ${D(c.time)} liefert das Modell negative Werte. Das geht nicht: Dort endet das Modell.`) },
      { text: `$0 \\le t \\le ${S}$`, title: tx("Start value as time", "Anfangswert als Zeit"), say: tx(`${S} is the start value (${S} ${E(c.unitWord)}), not a time. When is f(t) = 0?`, `${S} ist der Anfangswert (${S} ${D(c.unitWord)}), keine Zeit. Wann ist f(t) = 0?`) },
      { text: `$0 \\le t \\le ${r}$`, title: tx("Rate as time", "Rate als Zeit"), say: tx(`${r} is the decrease per ${E(c.perWord)}. Solve f(t) = 0 to find the end.`, `${r} ist die Abnahme pro ${D(c.perWord)}. Löse f(t) = 0, dann hast du das Ende.`) },
    ];
    const { answer, mistakes } = choice(rng, opts);
    return {
      instruction: CHECK_INSTR,
      text: txs(
        (s) => `${s.t(c.intro(S, r))} Model: f(t) = ${S} − ${r}t (t in ${s.t(c.time)}). For which t does the model make sense?`,
        (s) => `${s.t(c.intro(S, r))} Modell: f(t) = ${S} − ${r}t (t in ${s.t(c.time)}). Für welche t ist das Modell sinnvoll?`,
      ),
      answer,
      mistakes,
      hint: tx("Time can't be negative, and the amount can't drop below 0.", "Die Zeit kann nicht negativ sein, und die Menge nicht unter 0 fallen."),
      solution: [
        { math: `t \\ge 0`, note: tx("The model starts at t = 0.", "Das Modell beginnt bei t = 0.") },
        { math: `${S} - ${r}t \\ge 0 \\quad \\Rightarrow \\quad t \\le ${T}`, note: tx(`And f(t) mustn't be negative: ${S} : ${r} = ${T}.`, `Und f(t) darf nicht negativ werden: ${S} : ${r} = ${T}.`) },
        { math: `0 \\le t \\le ${T}#r`, highlight: ["r"], note: tx(`**Answer:** the model makes sense for 0 ≤ t ≤ ${T}.`, `**Antwort:** Das Modell ist sinnvoll für 0 ≤ t ≤ ${T}.`) },
      ],
    };
  }
};

const lilyLimit: Tpl = (rng) => {
  for (;;) {
    const a = rng.pick([1, 2, 3, 5]);
    const P = rng.pick([100, 200, 300, 500, 1000]);
    let n = 0;
    while (a * 2 ** n < P) n++;
    if (a * 2 ** n === P || n < 4 || n > 10) continue;
    const name = rng.pick(NAMES);
    const answer = numAns(n, tx("weeks", "Wochen"));
    const mk = mistakesFor(answer);
    mk.add(n - 1, tx("Not quite covered yet", "Noch nicht ganz bedeckt"), tx(`After ${n - 1} weeks it's ${a * 2 ** (n - 1)} m², still less than ${P} m². One more week!`, `Nach ${n - 1} Wochen sind es ${a * 2 ** (n - 1)} m², noch weniger als ${P} m². Eine Woche noch!`), true);
    mk.add((P - a) / a, tx("Linear thinking", "Linear gedacht"), tx(`That's how long it would take if ${a} m² were added every week. But the area **doubles**.`, `So lange dauert es, wenn jede Woche ${a} m² dazukommen. Die Fläche **verdoppelt** sich aber.`));
    const values = Array.from({ length: n + 1 }, (_, i) => a * 2 ** i);
    return {
      instruction: CHECK_INSTR,
      text: tx(
        `${name} watches a pond of ${P} m². Water lilies cover ${a} m² and the area doubles every week: f(n) = ${a} · 2ⁿ. After how many weeks is the pond covered for the first time? From then on the model can't be true any more.`,
        `${name} beobachtet einen Teich mit ${P} m². Seerosen bedecken ${a} m², die Fläche verdoppelt sich jede Woche: f(n) = ${a} · 2ⁿ. Nach wie vielen Wochen ist der Teich zum ersten Mal ganz bedeckt? Ab dann kann das Modell nicht mehr stimmen.`,
      ),
      answer,
      mistakes: mk.list,
      hint: tx(`Double week by week until you reach ${P} m².`, `Verdopple Woche für Woche, bis du ${P} m² erreichst.`),
      solution: [
        { math: values.slice(0, 5).map((v, i) => `${v}#v${i}`).join(" \\to ") + " \\to …", note: tx("Week by week, always · 2.", "Woche für Woche, immer · 2.") },
        { math: `f(${n - 1})#a =#e1 ${values[n - 1]}#v1 < ${P} \\quad f(${n})#b =#e2 ${values[n]}#v2 \\ge ${P}`, highlight: ["v2"], note: tx(`After ${n - 1} weeks: ${values[n - 1]} m², still too little. After ${n} weeks: ${values[n]} m², that's more than the pond.`, `Nach ${n - 1} Wochen: ${values[n - 1]} m², noch zu wenig. Nach ${n} Wochen: ${values[n]} m², mehr als der Teich.`) },
        { math: `n =#eq ${n}#r`, highlight: ["r"], note: tx(`**Answer:** after ${n} weeks. The model then predicts more area than the pond has: there it ends.`, `**Antwort:** nach ${n} Wochen. Danach sagt das Modell mehr Fläche voraus, als der Teich hat: Dort endet es.`) },
      ],
    };
  }
};

/** Level 3 practice: models, optimisation, Fermi estimates and their limits. */
export function generate3(rng: Rng): Exercise {
  const shape = weighted<Tpl>(rng, [
    [18, modelChoice],
    [9, linModel],
    [10, expModel],
    [6, quadNext],
    [9, fenceWall],
    [5, fenceFree],
    [9, throwMax],
    [6, revenue],
    [9, fermi],
    [5, fermiOrder],
    [6, ballLand],
    [5, domainChoice],
    [5, lilyLimit],
  ]);
  return shape(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const cycleFrames: Frame[] = [
  {
    math: `A(t)#A =#eq 100#a -#m 8#b t#t`,
    note: tx(
      "**1. Mathematise:** the battery starts at 100 % and loses 8 percentage points every hour. The same amount each hour: a **linear** model. $A(t)$ is the charge after $t$ hours.",
      "**1. Mathematisieren:** Der Akku startet bei 100 % und verliert jede Stunde 8 Prozentpunkte. Jede Stunde gleich viel: ein **lineares** Modell. $A(t)$ ist der Ladestand nach $t$ Stunden.",
    ),
  },
  { math: `100#a -#m 8#b t#t =#eq 0#z`, note: tx("**2. Solve:** empty means $A(t) = 0$.", "**2. Lösen:** Leer heißt $A(t) = 0$.") },
  { math: mb((s) => `t#t =#eq ${s.m(12.5, "z")}`), note: tx("$100 : 8 = 12.5$.", "$100 : 8 = 12,5$.") },
  {
    math: mb((s) => `t#t =#eq ${s.m(12.5, "z")} "h"#u =#e2 12 "h"#u2 \\; 30 "min"#u3`),
    note: tx("**3. Interpret:** 0.5 h are 30 min. The battery is empty after 12 hours and 30 minutes.", "**3. Interpretieren:** 0,5 h sind 30 min. Nach 12 Stunden und 30 Minuten ist der Akku leer."),
  },
  {
    math: mb((s) => `0 \\le#l1 t#t \\le#l2 ${s.m(12.5, "z")}`),
    highlight: ["t", "z"],
    note: tx(
      "**4. Validate:** the model only works for $0 \\le t \\le 12.5$: there are no negative charges. And a real battery doesn't drain perfectly evenly. A model is always a simplification.",
      "**4. Validieren:** Das Modell gilt nur für $0 \\le t \\le 12,5$: Negative Ladestände gibt es nicht. Und ein echter Akku entlädt sich nicht ganz gleichmäßig. Ein Modell ist immer eine Vereinfachung.",
    ),
  },
];

const step = (k: string, v: string) => `\\blob{${v.startsWith("\\cdot") ? `\\cdot#${k}o ${v.slice(6)}#${k}n` : `${v[0]}#${k}o ${v.slice(1)}#${k}n`}}`;

const tableFrames: Frame[] = [
  { math: `2#a \\quad 5#b \\quad 8#c \\quad 11#d`, note: tx("Table 1: the values for x = 0, 1, 2, 3. Look at the steps.", "Tabelle 1: die Werte für x = 0, 1, 2, 3. Schau auf die Schritte.") },
  { math: `2#a \\; ${step("p", "+3")} \\; 5#b \\; ${step("q", "+3")} \\; 8#c \\; ${step("r", "+3")} \\; 11#d`, note: tx("Always **+3**: constant **differences**. That's **linear**: $f(x) = 3x + 2$.", "Immer **+3**: gleiche **Differenzen**. Das ist **linear**: $f(x) = 3x + 2$.") },
  { math: `3#a \\quad 6#b \\quad 12#c \\quad 24#d`, note: tx("Table 2: 3, 6, 12, 24.", "Tabelle 2: 3, 6, 12, 24.") },
  {
    math: `3#a \\; ${step("p", "\\cdot 2")} \\; 6#b \\; ${step("q", "\\cdot 2")} \\; 12#c \\; ${step("r", "\\cdot 2")} \\; 24#d`,
    note: tx("The differences grow (+3, +6, +12), but the **ratio** is always 2: **exponential**, $f(x) = 3 \\cdot 2^x$.", "Die Differenzen wachsen (+3, +6, +12), aber der **Quotient** ist immer 2: **exponentiell**, $f(x) = 3 \\cdot 2^x$."),
  },
  { math: `1#a \\quad 2#b \\quad 5#c \\quad 10#d`, note: tx("Table 3: 1, 2, 5, 10.", "Tabelle 3: 1, 2, 5, 10.") },
  { math: `1#a \\; ${step("p", "+1")} \\; 2#b \\; ${step("q", "+3")} \\; 5#c \\; ${step("r", "+5")} \\; 10#d`, note: tx("Differences +1, +3, +5: not constant. The ratios aren't either.", "Differenzen +1, +3, +5: nicht gleich. Die Quotienten auch nicht.") },
  {
    math: `+#po 1#pn \\; \\blob{+2} \\; +#qo 3#qn \\; \\blob{+2} \\; +#ro 5#rn`,
    note: tx("But the differences of the differences are constant: **+2**. Constant second differences: **quadratic**, $f(x) = x^2 + 1$.", "Aber die Differenzen der Differenzen sind gleich: **+2**. Gleiche 2. Differenzen: **quadratisch**, $f(x) = x^2 + 1$."),
  },
];

const fenceFrames: Frame[] = [
  { math: `A#A =#eq x#x \\cdot#d y#y`, note: tx("**Target:** the area $A$ = width · length. Two variables are one too many.", "**Ziel:** die Fläche $A$ = Breite · Länge. Zwei Variablen sind eine zu viel.") },
  { math: `2x#a +#p y#y =#eq 40#L`, note: tx("**Condition:** 40 m of fence for two sides $x$ and one side $y$; the house wall needs no fence.", "**Nebenbedingung:** 40 m Zaun für zwei Seiten $x$ und eine Seite $y$, die Hauswand braucht keinen Zaun.") },
  { math: `y#y =#eq 40#L -#m 2x#a`, note: tx("Solve the condition for $y$.", "Die Nebenbedingung nach $y$ umstellen.") },
  { math: `A(x)#A =#eq x#x \\cdot#d (40#L -#m 2x#a)#br`, note: tx("Insert: now the area depends on $x$ only. This is the **target function**.", "Einsetzen: Jetzt hängt die Fläche nur noch von $x$ ab. Das ist die **Zielfunktion**.") },
  { math: `A(x)#A =#eq -2x^2 + 40x`, note: tx("Multiplied out: a parabola that opens **downwards**. Its highest point is the vertex.", "Ausmultipliziert: eine nach **unten** geöffnete Parabel. Ihr höchster Punkt ist der Scheitelpunkt.") },
  { math: `x_1#z1 =#e1 0 , \\quad x_2#z2 =#e2 20`, note: tx("Zeros: $x = 0$ or $40 - 2x = 0$, so $x = 20$. (No area at all in both cases.)", "Nullstellen: $x = 0$ oder $40 - 2x = 0$, also $x = 20$. (Beide Male gar keine Fläche.)") },
  { math: `x_S#xs =#e3 \\frac{0 + 20}{2} =#e4 10`, note: tx("A parabola is symmetric: the vertex lies **exactly halfway** between the zeros.", "Eine Parabel ist symmetrisch: Der Scheitelpunkt liegt **genau in der Mitte** zwischen den Nullstellen.") },
  { math: `A(10) =#e5 10 \\cdot 20 =#e6 200#r "m²"#u`, highlight: ["r", "u"], note: tx("**Answer:** with $x = 10$ m and $y = 20$ m the area is largest: 200 m².", "**Antwort:** Mit $x = 10$ m und $y = 20$ m wird die Fläche am größten: 200 m².") },
];

const fermiFrames: Frame[] = [
  { math: mb((s) => `2 \\cdot 10^6#n "${s.de ? "Einwohner" : "inhabitants"}"#w`), note: tx("Hamburg has about 1.9 million inhabitants. Round boldly: $2 \\cdot 10^6$.", "Hamburg hat rund 1,9 Millionen Einwohner. Kräftig runden: $2 \\cdot 10^6$.") },
  { math: mb((s) => `2 \\cdot 10^6 : 2 =#eq 10^6#n "${s.de ? "Haushalte" : "households"}"#w`), note: tx("On average about 2 people live in a household.", "Im Schnitt leben etwa 2 Personen in einem Haushalt.") },
  { math: mb((s) => `10^6 : 20 =#eq ${s.m(50000, "n")} "${s.de ? "Klaviere" : "pianos"}"#w`), note: tx("Maybe every 20th household has a piano (plus schools, churches, music schools).", "Vielleicht hat jeder 20. Haushalt ein Klavier (dazu Schulen, Kirchen, Musikschulen).") },
  { math: mb((s) => `${s.m(50000, "n")} "${s.de ? "Stimmungen pro Jahr" : "tunings a year"}"#w`), note: tx("A piano is tuned about once a year.", "Ein Klavier wird etwa einmal im Jahr gestimmt.") },
  { math: mb((s) => `4 \\cdot 200 =#eq 800 "${s.de ? "pro Stimmer" : "per tuner"}"#w2`), note: tx("One tuner manages about 4 pianos a day, on about 200 working days: 800 a year.", "Ein Stimmer schafft etwa 4 Klaviere am Tag, an rund 200 Arbeitstagen: 800 im Jahr.") },
  { math: mb((s) => `${s.m(50000, "n")} : 800 \\approx#eq 60#r "${s.de ? "Klavierstimmer" : "piano tuners"}"#w`), highlight: ["r"], note: tx("**Estimate:** about 60 piano tuners. What counts is the order of magnitude: rather 60 than 6 or 600.", "**Schätzung:** etwa 60 Klavierstimmer. Wichtig ist die Größenordnung: eher 60 als 6 oder 600.") },
];

const TANK_OPTS: Opt[] = [
  { text: "$0 \\le t \\le 15$" },
  { text: "$t \\ge 0$", title: tx("No end", "Kein Ende"), say: tx("After 15 minutes the model gives negative litres. That can't happen: the model stops there.", "Nach 15 Minuten liefert das Modell negative Liter. Das geht nicht: Dort endet das Modell.") },
  { text: "$0 \\le t \\le 600$", title: tx("Start value as time", "Anfangswert als Zeit"), say: tx("600 is the start value in litres, not a time. When is V(t) = 0?", "600 ist der Anfangswert in Litern, keine Zeit. Wann ist V(t) = 0?") },
  { text: "$0 \\le t \\le 40$", title: tx("Rate as time", "Rate als Zeit"), say: tx("40 is the amount per minute. Solve V(t) = 0 to find the end.", "40 ist die Menge pro Minute. Löse V(t) = 0, dann hast du das Ende.") },
];
const tankChoice = fixedChoice([TANK_OPTS[1], TANK_OPTS[0], TANK_OPTS[3], TANK_OPTS[2]], 1);

const tableCheck = modelChoiceExercise(
  null,
  expo(5, 2),
  [
    { m: lin(5, 5), title: ONLY_FIRST, say: sayLin },
    { m: quad(5, 0, 5), title: ONLY_FIRST, say: sayQuad },
    { m: expo(2, 5), title: tx("Start value and factor swapped", "Anfangswert und Faktor vertauscht"), say: tx("Check x = 0: f(0) is the start value, here 5. The factor is what you multiply by in each step.", "Prüf x = 0: f(0) ist der Anfangswert, hier 5. Der Faktor ist das, womit du bei jedem Schritt multiplizierst.") },
  ],
  2,
);

const WATER_OPTS: Opt[] = [
  { text: tx("about 800 litres", "etwa 800 Liter"), title: tx("Only one or two days", "Nur ein, zwei Tage"), say: tx("That's what the whole school drinks in about two days. A school year has about 190 school days.", "So viel trinkt die ganze Schule in etwa zwei Tagen. Ein Schuljahr hat rund 190 Schultage.") },
  { text: tx("about 8000 litres", "etwa 8000 Liter"), title: tx("Much too little", "Viel zu wenig"), say: tx("That would be only about 10 school days, or 50 ml per day and student. Check each step of your chain.", "Das wären nur etwa 10 Schultage oder 50 ml pro Tag und Person. Prüf jeden Schritt deiner Kette.") },
  { text: tx("about 80 000 litres", "etwa 80.000 Liter") },
  { text: tx("about 800 000 litres", "etwa 800.000 Liter"), title: tx("Much too much", "Viel zu viel"), say: tx("Then every student would drink 5 litres during each school day. Check your assumptions.", "Dann müsste jede Person an jedem Schultag 5 Liter trinken. Prüf deine Annahmen.") },
];
const water = fixedChoice(WATER_OPTS, 2);

/** Level 3 (Klasse 10 and Oberstufe): modelling, optimising with parabolas and Fermi estimates. */
export const level3: LevelLesson = {
  summary: [
    {
      title: tx("Modelling in four steps", "Modellieren in vier Schritten"),
      body: tx(
        "**Mathematise** (choose variables and a model), **solve**, **interpret** (answer in the real situation), **validate** (does it make sense, where does the model hold?). If it doesn't fit, improve the model and go round again.",
        "**Mathematisieren** (Variablen und Modell wählen), **lösen**, **interpretieren** (Antwort in der Sachsituation), **validieren** (passt das, wo gilt das Modell?). Passt es nicht, verbesserst du das Modell und gehst noch eine Runde.",
      ),
      examples: [mb((s) => `A(t) = 100 - 8t \\quad 0 \\le t \\le ${s.m(12.5)}`)],
      tone: "rule",
    },
    {
      title: tx("Which model fits?", "Welches Modell passt?"),
      body: tx(
        "Look at a table with equal x-steps. Constant differences: linear. Constant second differences: quadratic. Constant ratios: exponential.",
        "Schau dir eine Tabelle mit gleichen x-Schritten an. Gleiche Differenzen: linear. Gleiche 2. Differenzen: quadratisch. Gleiche Quotienten: exponentiell.",
      ),
      examples: [
        "2, 5, 8, 11: \\; +3, +3, +3 \\Rightarrow f(x) = 3x + 2",
        "1, 2, 5, 10: \\; +1, +3, +5 \\Rightarrow f(x) = x^2 + 1",
        "3, 6, 12, 24: \\; \\cdot 2, \\cdot 2, \\cdot 2 \\Rightarrow f(x) = 3 \\cdot 2^x",
      ],
      tone: "rule",
    },
    {
      title: tx("Optimising with a parabola", "Optimieren mit der Parabel"),
      body: tx(
        "Set up the target function, insert the condition so only one variable is left. If the parabola opens downwards, the maximum is the vertex: halfway between the zeros (or read it from the vertex form).",
        "Zielfunktion aufstellen und die Nebenbedingung einsetzen, bis nur eine Variable übrig ist. Ist die Parabel nach unten geöffnet, liegt das Maximum im Scheitelpunkt: in der Mitte zwischen den Nullstellen (oder aus der Scheitelpunktform ablesen).",
      ),
      examples: ["A(x) = x(40 - 2x)", "x_S = \\frac{0 + 20}{2} = 10", "A(10) = 200"],
      tone: "rule",
    },
    {
      title: tx("Fermi estimates", "Fermi-Aufgaben"),
      body: tx(
        "Break the question into steps you can estimate, write each assumption down, round boldly and calculate with powers of ten. The result is an order of magnitude, not an exact number.",
        "Zerleg die Frage in Schritte, die du schätzen kannst, schreib jede Annahme auf, runde kräftig und rechne mit Zehnerpotenzen. Das Ergebnis ist eine Größenordnung, keine genaue Zahl.",
      ),
      examples: [mb((s) => `2 \\cdot 10^6 : 2 : 20 = ${s.m(50000)}`), mb((s) => `${s.m(50000)} : 800 \\approx 60`)],
      tone: "tip",
    },
    {
      title: tx("Limits and classic mistakes", "Grenzen und typische Fehler"),
      body: tx(
        "A model only holds in a sensible range: no negative times or lengths, and exponential growth always stops at some point. After finding the vertex, answer what was asked (the area, not x).",
        "Ein Modell gilt nur in einem sinnvollen Bereich: keine negativen Zeiten oder Längen, und exponentielles Wachstum stoppt immer irgendwann. Nach dem Scheitelpunkt die gefragte Größe angeben (die Fläche, nicht x).",
      ),
      examples: ["h(t) = 20t - 5t^2 , \\quad 0 \\le t \\le 4"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("The modelling cycle", "Der Modellierungskreislauf"),
      blob: tx("Real life doesn't come with equations. You build them yourself!", "Das echte Leben kommt ohne Gleichungen. Die baust du selbst!"),
      body: tx(
        "**A phone battery is at 100 % and loses 8 % every hour. When is it empty?** Modelling means: translate the situation into maths, solve, translate back and check whether it makes sense. Tap the steps in the picture.",
        "**Ein Handyakku ist bei 100 % und verliert jede Stunde 8 %. Wann ist er leer?** Modellieren heißt: Die Situation in Mathe übersetzen, lösen, zurückübersetzen und prüfen, ob es Sinn ergibt. Tipp im Bild auf die Schritte.",
      ),
      visual: { component: ModelCycle, props: {} },
      frames: cycleFrames,
    },
    {
      type: "check",
      blob: tx("Step 4: where does this model make sense?", "Schritt 4: Wo ist dieses Modell sinnvoll?"),
      exercise: {
        instruction: CHECK_INSTR,
        text: tx(
          "A water tank holds 600 litres. Every minute 40 litres flow out: V(t) = 600 − 40t (t in minutes). For which t does the model make sense?",
          "Ein Wassertank enthält 600 Liter. Pro Minute fließen 40 Liter ab: V(t) = 600 − 40t (t in Minuten). Für welche t ist das Modell sinnvoll?",
        ),
        answer: tankChoice.answer,
        mistakes: tankChoice.mistakes,
        hint: tx("Time can't be negative, and the tank can't hold less than 0 litres.", "Die Zeit kann nicht negativ sein, und im Tank können nicht weniger als 0 Liter sein."),
        solution: [
          { math: `t \\ge 0`, note: tx("The model starts at t = 0.", "Das Modell beginnt bei t = 0.") },
          { math: `600 - 40t \\ge 0 \\quad \\Rightarrow \\quad t \\le 15`, note: tx("And V(t) mustn't be negative: 600 : 40 = 15.", "Und V(t) darf nicht negativ werden: 600 : 40 = 15.") },
          { math: `0 \\le t \\le 15#r`, highlight: ["r"], note: tx("**Answer:** the model makes sense for 0 ≤ t ≤ 15. After 15 minutes the tank is empty.", "**Antwort:** Das Modell ist sinnvoll für 0 ≤ t ≤ 15. Nach 15 Minuten ist der Tank leer.") },
        ],
      },
    },
    {
      type: "explain",
      title: tx("Linear, quadratic or exponential?", "Linear, quadratisch oder exponentiell?"),
      blob: tx("Tables have fingerprints. Let's read them!", "Tabellen haben Fingerabdrücke. Lesen wir sie!"),
      body: tx(
        "Three tables with equal x-steps. Which model fits is shown by the steps between the values: equal **differences**, equal **second differences** or equal **ratios**.",
        "Drei Tabellen mit gleichen x-Schritten. Welches Modell passt, verraten die Schritte zwischen den Werten: gleiche **Differenzen**, gleiche **2. Differenzen** oder gleiche **Quotienten**.",
      ),
      frames: tableFrames,
    },
    {
      type: "widget",
      title: tx("The model lab", "Das Modell-Labor"),
      blob: tx("Try the wrong model on purpose. The red lines tell you why it fails!", "Probier ruhig das falsche Modell. Die roten Linien zeigen dir, warum es nicht passt!"),
      body: tx(
        "Five real data sets: bacteria, a candle, braking distance, a medicine and a throw. Choose a model and see whether it fits all points, then look at what it predicts far ahead.",
        "Fünf echte Messreihen: Bakterien, eine Kerze, der Bremsweg, ein Medikament und ein Wurf. Wähl ein Modell, prüf, ob es zu allen Punkten passt, und schau, was es weit in der Zukunft vorhersagt.",
      ),
      widget: ModelLab,
    },
    {
      type: "check",
      blob: tx("Differences or ratios? Check more than the first step!", "Differenzen oder Quotienten? Prüf mehr als den ersten Schritt!"),
      exercise: tableCheck,
    },
    {
      type: "explain",
      title: tx("Optimising: the maximum is at the vertex", "Optimieren: Das Maximum liegt im Scheitelpunkt"),
      blob: tx("Same fence, different shapes. One of them wins!", "Gleicher Zaun, verschiedene Formen. Eine davon gewinnt!"),
      body: tx(
        "**With 40 m of fence, a rectangular run is built against a house wall. How big can it be at most?** Set up the area as a function of one variable: a parabola. Its vertex is the best value.",
        "**Mit 40 m Zaun soll an einer Hauswand ein rechteckiges Gehege entstehen. Wie groß kann es höchstens werden?** Stell die Fläche als Funktion einer Variablen auf: eine Parabel. Ihr Scheitelpunkt ist der beste Wert.",
      ),
      frames: fenceFrames,
    },
    {
      type: "widget",
      title: tx("The biggest enclosure", "Das größte Gehege"),
      blob: tx("Slide x and watch the point run up the parabola and down again.", "Verschieb x und schau, wie der Punkt die Parabel hoch und wieder runter läuft."),
      body: tx(
        "Against a wall or free-standing, 24, 32 or 40 m of fence: the rectangle changes shape and the area follows a parabola. Find its highest point.",
        "An der Hauswand oder frei stehend, 24, 32 oder 40 m Zaun: Das Rechteck ändert seine Form, und die Fläche folgt einer Parabel. Finde ihren höchsten Punkt.",
      ),
      widget: FenceMax,
    },
    {
      type: "check",
      blob: tx("Highest point = vertex. And then: the height, please!", "Höchster Punkt = Scheitelpunkt. Und dann bitte die Höhe!"),
      exercise: {
        instruction: OPT_INSTR,
        text: tx(
          "A ball is thrown up from a height of 1.5 m. Its height in metres after t seconds is h(t) = −5t² + 20t + 1.5. How high does it fly at most?",
          "Ein Ball wird aus 1,5 m Höhe nach oben geworfen. Seine Höhe in Metern nach t Sekunden ist h(t) = −5t² + 20t + 1,5. Wie hoch fliegt er höchstens?",
        ),
        answer: numAns(21.5, "m"),
        mistakes: [
          { when: numAns(2, "m"), title: tx("The time, not the height", "Die Zeit statt der Höhe"), say: tx("Good start: the top is reached after 2 s. Now insert t = 2 to get the **height**.", "Guter Anfang: Der höchste Punkt ist nach 2 s erreicht. Jetzt t = 2 einsetzen, dann hast du die **Höhe**.") },
          { when: numAns(20, "m"), title: tx("Start height forgotten", "Abwurfhöhe vergessen"), say: tx("Nearly! The + 1.5 m (the height it starts from) still belongs to it.", "Fast! Die + 1,5 m (die Abwurfhöhe) gehören noch dazu."), close: true },
          { when: numAns(31.5, "m"), title: tx("t² forgotten", "t² vergessen"), say: tx("Careful with −5t²: at t = 2 that's −5 · 4 = −20, not −5 · 2.", "Vorsicht bei −5t²: Bei t = 2 ist das −5 · 4 = −20, nicht −5 · 2.") },
          { when: numAns(41.5, "m"), title: tx("Squared term left out", "Quadratterm weggelassen"), say: tx("The −5t² belongs to the height too: it's what pulls the ball back down.", "Das −5t² gehört auch zur Höhe: Es zieht den Ball wieder nach unten.") },
        ],
        hint: tx("Without the 1.5: −5t² + 20t = −5t(t − 4). The vertex lies halfway between the zeros.", "Ohne die 1,5: −5t² + 20t = −5t(t − 4). Der Scheitelpunkt liegt in der Mitte zwischen den Nullstellen."),
        solution: [
          { math: mb((s) => `h(t)#h =#eq -5t^2 + 20t + ${s.m(1.5)}`), note: tx("The parabola opens downwards: its vertex is the highest point.", "Die Parabel ist nach unten geöffnet: Ihr Scheitelpunkt ist der höchste Punkt.") },
          { math: `-5t^2 + 20t =#eq -5t(t - 4)`, note: tx("Without the 1.5: zeros at t = 0 and t = 4. The 1.5 only shifts the parabola up; the vertex stays at the same t.", "Ohne die 1,5: Nullstellen bei t = 0 und t = 4. Die 1,5 schiebt die Parabel nur nach oben, der Scheitel bleibt beim selben t.") },
          { math: `t_S#ts =#e2 \\frac{0 + 4}{2} =#e3 2#t`, note: tx("Halfway between: after 2 seconds.", "In der Mitte: nach 2 Sekunden.") },
          { math: mb((s) => `h(2) =#e4 -5 \\cdot 4 + 20 \\cdot 2 + ${s.m(1.5)} =#e5 ${s.m(21.5, "r")} "m"#u`), highlight: ["r", "u"], note: tx("**Answer:** the ball flies at most 21.5 m high (after 2 s).", "**Antwort:** Der Ball fliegt höchstens 21,5 m hoch (nach 2 s).") },
        ],
      },
    },
    {
      type: "explain",
      title: tx("Fermi problems: estimating with a plan", "Fermi-Aufgaben: Schätzen mit Plan"),
      blob: tx("Nobody knows the answer. And yet you can get surprisingly close!", "Niemand kennt die Antwort. Und trotzdem kommst du erstaunlich nah heran!"),
      body: tx(
        "**How many piano tuners work in Hamburg?** The physicist Enrico Fermi loved questions like this. Break it into small steps you can estimate, round boldly, and calculate with powers of ten.",
        "**Wie viele Klavierstimmer arbeiten in Hamburg?** Der Physiker Enrico Fermi liebte solche Fragen. Zerleg sie in kleine Schritte, die du schätzen kannst, runde kräftig und rechne mit Zehnerpotenzen.",
      ),
      frames: fermiFrames,
    },
    {
      type: "widget",
      title: tx("The Fermi estimator", "Der Fermi-Schätzer"),
      blob: tx("Push the assumptions around. Does the order of magnitude change much?", "Schieb die Annahmen hin und her. Ändert sich die Größenordnung stark?"),
      body: tx(
        "Three classic Fermi questions as chains of assumptions. Change each guess and watch the estimate and its order of magnitude.",
        "Drei klassische Fermi-Fragen als Ketten von Annahmen. Ändere jede Schätzung und beobachte das Ergebnis und seine Größenordnung.",
      ),
      widget: FermiLab,
    },
    {
      type: "check",
      blob: tx("Make your own assumptions, then pick the order of magnitude.", "Mach deine eigenen Annahmen und wähl dann die Größenordnung."),
      exercise: {
        instruction: FERMI_INSTR,
        text: tx(
          "About how many litres of water do the 800 students of a school drink during school hours in one school year?",
          "Etwa wie viele Liter Wasser trinken die 800 Schülerinnen und Schüler einer Schule während der Schulzeit in einem Schuljahr?",
        ),
        answer: water.answer,
        mistakes: water.mistakes,
        hint: tx("Litres per student and school day (maybe half a litre), times the students, times the school days (about 190).", "Liter pro Person und Schultag (vielleicht ein halber Liter), mal die Schülerzahl, mal die Schultage (etwa 190)."),
        solution: [
          { math: mb((s) => `800 \\cdot ${s.m(0.5)} =#eq 400 "${s.de ? "l pro Tag" : "l a day"}"#u`), note: tx("Assumption: half a litre per student and school day.", "Annahme: ein halber Liter pro Person und Schultag.") },
          { math: mb((s) => `400 \\cdot 190 =#eq ${s.m(76000, "r")} "l"#u`), note: tx("About 190 school days a year.", "Rund 190 Schultage im Jahr.") },
          { math: mb((s) => `\\approx ${s.m(80000, "r")} "l"#u`), highlight: ["r"], note: tx("**Answer:** about 80 000 litres. Even with 0.3 or 1 litre a day you stay at this order of magnitude.", "**Antwort:** etwa 80.000 Liter. Auch mit 0,3 oder 1 Liter pro Tag bleibst du in dieser Größenordnung.") },
        ],
      },
    },
  ],
};
