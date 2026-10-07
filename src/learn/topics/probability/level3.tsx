"use client";

// Probability, level 3 (Oberstufe): two-way tables (Vierfeldertafel) and conditional probability,
// turning a tree around (Bayes, the medical test), independence, expected value and fair games,
// Bernoulli chains and the binomial distribution.

import { tx, type Text } from "@/i18n/text";
import { frac, type Frac } from "@/learn/engine/frac";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson } from "@/learn/types";
import { C, choiceMistakes, fr, frChain, fracAnswer, fracMistakes, numAnswer, numMistakes, round, say, shuffled, visual, type Fmt } from "./kit";
import { ProbabilityFourField, ProbabilityPaths, ProbabilitySpinner, ProbabilityTree, type Cell, type Sector, type TreeBranch } from "./pictures";
import { ProbabilityBayesLab, ProbabilityBinomialLab } from "./widgets3";

const I = {
  table: tx("Read the two-way table", "Lies die Vierfeldertafel ab"),
  fill: tx("Complete the two-way table", "Vervollständige die Vierfeldertafel"),
  bayes: tx("Turn the tree around (Bayes)", "Kehr den Baum um (Bayes)"),
  indep: tx("Dependent or independent?", "Abhängig oder unabhängig?"),
  indepCalc: tx("Independent events: find P(A ∩ B)", "Unabhängige Ereignisse: Berechne P(A ∩ B)"),
  expect: tx("Find the expected value", "Berechne den Erwartungswert"),
  binom: tx("Binomial distribution: exactly k hits", "Binomialverteilung: genau k Treffer"),
  cumul: tx("Binomial distribution: at least or at most", "Binomialverteilung: mindestens oder höchstens"),
  mu: tx("How many hits do you expect?", "Wie viele Treffer erwartest du?"),
  paths: tx("Count the paths", "Zähle die Pfade"),
};

const en = (t: Text) => (typeof t === "string" ? t : t.en);
const de = (t: Text) => (typeof t === "string" ? t : t.de);
const PCT = "%";
const EUR = "€";

const SWAPPED: { title: Text; say: Text } = {
  title: tx("Condition swapped", "Bedingung vertauscht"),
  say: tx(
    "You swapped the condition. In $P_A(B)$ the condition $A$ sits below: you only look at the cases where $A$ happened.",
    "Du hast die Bedingung vertauscht. Bei $P_A(B)$ steht die Bedingung $A$ unten: Du schaust nur auf die Fälle, in denen $A$ eingetreten ist.",
  ),
};
const NOT_CONDITIONAL: { title: Text; say: Text } = {
  title: tx("Divided by everyone", "Durch alle geteilt"),
  say: tx(
    "That's $P(A \\cap B)$: you divided by everyone. With a condition, divide only by the people who meet it (the row or column total).",
    "Das ist $P(A \\cap B)$: Du hast durch alle geteilt. Mit Bedingung teilst du nur durch die, die sie erfüllen (die Zeilen- oder Spaltensumme).",
  ),
};

// ---------------------------------------------------------------------------
// Two-way tables with counts

type Pair = { a: Text; aSub: Text; b: Text; bSub: Text; who: Text };
/** German dative plural after „unter“. */
const WHO_DAT: Record<string, string> = { Jugendliche: "Jugendlichen", Kinder: "Kindern", Personen: "Personen", Erwachsene: "Erwachsenen" };
const PAIRS: Pair[] = [
  { a: tx("lives less than 3 km from school", "wohnt weniger als 3 km von der Schule entfernt"), aSub: tx("lives less than 3 km from school", "weniger als 3 km von der Schule entfernt wohnt"), b: tx("cycles to school", "fährt mit dem Rad zur Schule"), bSub: tx("cycles to school", "mit dem Rad zur Schule fährt"), who: tx("students", "Jugendliche") },
  { a: tx("has a pet", "hat ein Haustier"), aSub: tx("has a pet", "ein Haustier hat"), b: tx("has siblings", "hat Geschwister"), bSub: tx("has siblings", "Geschwister hat"), who: tx("children", "Kinder") },
  { a: tx("is in a sports club", "ist in einem Sportverein"), aSub: tx("is in a sports club", "in einem Sportverein ist"), b: tx("plays an instrument", "spielt ein Instrument"), bSub: tx("plays an instrument", "ein Instrument spielt"), who: tx("students", "Jugendliche") },
  { a: tx("was vaccinated against flu", "ist gegen Grippe geimpft"), aSub: tx("was vaccinated against flu", "gegen Grippe geimpft ist"), b: tx("caught the flu this winter", "hatte diesen Winter Grippe"), bSub: tx("caught the flu this winter", "diesen Winter Grippe hatte"), who: tx("people", "Personen") },
  { a: tx("revised for the test", "hat für den Test gelernt"), aSub: tx("revised for the test", "für den Test gelernt hat"), b: tx("passed the test", "hat den Test bestanden"), bSub: tx("passed the test", "den Test bestanden hat"), who: tx("students", "Jugendliche") },
  { a: tx("wears glasses", "trägt eine Brille"), aSub: tx("wears glasses", "eine Brille trägt"), b: tx("reads at least one book a month", "liest mindestens ein Buch im Monat"), bSub: tx("reads at least one book a month", "mindestens ein Buch im Monat liest"), who: tx("adults", "Erwachsene") },
];

function counts(rng: Rng) {
  for (let i = 0; i < 100; i++) {
    const N = rng.pick([100, 200, 250, 400, 500]);
    const st = N === 100 ? 1 : 5;
    const lo = N / 10;
    const a = rng.int(lo / st, (N * 0.4) / st) * st;
    const b = rng.int(lo / st, (N * 0.3) / st) * st;
    const c = rng.int(lo / st, (N * 0.3) / st) * st;
    const d = N - a - b - c;
    if (d >= lo && a !== b && a !== c) return { N, a, b, c, d };
  }
  return { N: 200, a: 60, b: 20, c: 30, d: 90 };
}

const tableCells = (x: { N: number; a: number; b: number; c: number; d: number }): Cell[][] => [
  [x.a, x.b, x.a + x.b],
  [x.c, x.d, x.c + x.d],
  [x.a + x.c, x.b + x.d, x.N],
];

function tableTask(rng: Rng): Exercise {
  const pair = rng.pick(PAIRS);
  const x = counts(rng);
  const ask = rng.pick(["AB", "B|A", "A|B", "B|A", "A|B"] as const);
  const rowA = x.a + x.b;
  const colB = x.a + x.c;
  const right = ask === "AB" ? frac(x.a, x.N) : ask === "B|A" ? frac(x.a, rowA) : frac(x.a, colB);
  const questionEn =
    ask === "AB"
      ? `One of them is chosen at random. What is the probability that this person ${en(pair.a)} **and** ${en(pair.b)}?`
      : ask === "B|A"
        ? `Someone who ${en(pair.a)} is chosen at random. What is the probability that this person ${en(pair.b)}?`
        : `Someone who ${en(pair.b)} is chosen at random. What is the probability that this person ${en(pair.a)}?`;
  const questionDe =
    ask === "AB"
      ? `Eine Person wird zufällig ausgewählt. Wie groß ist die Wahrscheinlichkeit, dass sie ${de(pair.aSub)} **und** ${de(pair.bSub)}?`
      : ask === "B|A"
        ? `Eine Person, die ${de(pair.aSub)}, wird zufällig ausgewählt. Wie groß ist die Wahrscheinlichkeit, dass sie ${de(pair.bSub)}?`
        : `Eine Person, die ${de(pair.bSub)}, wird zufällig ausgewählt. Wie groß ist die Wahrscheinlichkeit, dass sie ${de(pair.aSub)}?`;
  const sym = ask === "AB" ? "P(A ∩ B)" : ask === "B|A" ? "P_A(B)" : "P_B(A)";
  const den = ask === "AB" ? x.N : ask === "B|A" ? rowA : colB;
  const cands: { v: Frac | null; title: Text; say: Text }[] =
    ask === "AB"
      ? [
          { v: frac(x.a, rowA), title: tx("Conditional, not “and”", "Bedingt statt „und“"), say: tx("You divided by a row total. For “A and B” nothing is given in advance: divide by **everyone**.", "Du hast durch eine Zeilensumme geteilt. Bei „A und B“ ist nichts vorausgesetzt: Teile durch **alle**.") },
          { v: frac(x.a, colB), title: tx("Conditional, not “and”", "Bedingt statt „und“"), say: tx("You divided by a column total. For “A and B” nothing is given in advance: divide by **everyone**.", "Du hast durch eine Spaltensumme geteilt. Bei „A und B“ ist nichts vorausgesetzt: Teile durch **alle**.") },
          { v: frac(rowA, x.N), title: tx("Only A", "Nur A"), say: tx("That's $P(A)$, the row total. Both have to apply: look at the inner field.", "Das ist $P(A)$, die Zeilensumme. Beides muss zutreffen: Schau ins innere Feld.") },
        ]
      : [
          { v: ask === "B|A" ? frac(x.a, colB) : frac(x.a, rowA), ...SWAPPED },
          { v: frac(x.a, x.N), ...NOT_CONDITIONAL },
          { v: ask === "B|A" ? frac(colB, x.N) : frac(rowA, x.N), title: tx("Condition ignored", "Bedingung ignoriert"), say: tx("That's the probability for everyone. The condition narrows it down: only look at that row or column.", "Das ist die Wahrscheinlichkeit für alle. Die Bedingung schränkt ein: Schau nur auf die eine Zeile oder Spalte.") },
        ];
  return {
    instruction: I.table,
    text: tx(`A survey of $${x.N}$ ${en(pair.who)}. ${questionEn}`, `Eine Umfrage unter $${x.N}$ ${WHO_DAT[de(pair.who)] ?? de(pair.who)}. ${questionDe}`),
    visual: visual(ProbabilityFourField, { cells: tableCells(x), legend: { a: pair.a, b: pair.b }, hl: [] }),
    math: sym,
    answer: fracAnswer(right),
    hint:
      ask === "AB"
        ? tx("Both at once: an inner field, divided by everyone.", "Beides zugleich: ein inneres Feld, geteilt durch alle.")
        : tx("With a condition you only look at one row or column: inner field divided by that total.", "Mit Bedingung schaust du nur auf eine Zeile oder Spalte: inneres Feld geteilt durch deren Summe."),
    solution: [
      {
        math:
          ask === "AB"
            ? tx(`P(A ∩ B) = \\frac{"in A and B"}{"all"}`, `P(A ∩ B) = \\frac{"in A und B"}{"alle"}`)
            : ask === "B|A"
              ? tx(`P_A(B) = \\frac{"in A and B"}{"in A"}`, `P_A(B) = \\frac{"in A und B"}{"in A"}`)
              : tx(`P_B(A) = \\frac{"in A and B"}{"in B"}`, `P_B(A) = \\frac{"in A und B"}{"in B"}`),
        note:
          ask === "AB"
            ? tx(`Both apply: the inner field $A ∩ B$ with $${x.a}$ people, out of all $${x.N}$.`, `Beides trifft zu: das innere Feld $A ∩ B$ mit $${x.a}$ Personen, von allen $${x.N}$.`)
            : ask === "B|A"
              ? tx(`Condition $A$: only the row $A$ counts, that's $${rowA}$ people. $${x.a}$ of them are also in $B$.`, `Bedingung $A$: Nur die Zeile $A$ zählt, das sind $${rowA}$ Personen. $${x.a}$ davon sind auch in $B$.`)
              : tx(`Condition $B$: only the column $B$ counts, that's $${colB}$ people. $${x.a}$ of them are also in $A$.`, `Bedingung $B$: Nur die Spalte $B$ zählt, das sind $${colB}$ Personen. $${x.a}$ davon sind auch in $A$.`),
      },
      { math: `${sym} = ${frChain(x.a, den)}`, note: tx("Simplify if you can.", "Kürzen, wenn es geht.") },
    ],
    mistakes: fracMistakes(right, cands),
  };
}

// ---------------------------------------------------------------------------
// Complete a table of probabilities

function fillTask(rng: Rng): Exercise {
  let pa = 0.5;
  let pb = 0.4;
  let pab = 0.2;
  for (let i = 0; i < 50; i++) {
    pa = rng.int(2, 7) / 10;
    pb = rng.int(2, 7) / 10;
    const lo = Math.max(0.05, round(pa + pb - 1 + 0.05, 2));
    const hi = round(Math.min(pa, pb) - 0.05, 2);
    if (hi < lo) continue;
    pab = round(rng.int(Math.round(lo * 20), Math.round(hi * 20)) / 20, 2);
    if (Math.abs(pab - pa * pb) > 0.004) break;
  }
  const ask = rng.pick(["ab", "AB", "aB"] as const); // lower case = complement
  const v = { AB: pab, Ab: round(pa - pab, 2), aB: round(pb - pab, 2), ab: round(1 - pa - pb + pab, 2) };
  const right = v[ask === "AB" ? "Ab" : ask];
  const cells: Cell[][] = [
    [pab, null, pa],
    [null, null, null],
    [pb, null, 1],
  ];
  if (ask === "AB") cells[0][1] = "?";
  if (ask === "aB") cells[1][0] = "?";
  if (ask === "ab") cells[1][1] = "?";
  const askText =
    ask === "AB"
      ? tx("$A$ happens, but $B$ doesn't", "$A$ eintritt, aber $B$ nicht")
      : ask === "aB"
        ? tx("$B$ happens, but $A$ doesn't", "$B$ eintritt, aber $A$ nicht")
        : tx("neither $A$ nor $B$ happens", "weder $A$ noch $B$ eintritt");
  const cands: { v: number | null; title: Text; say: Text }[] = [];
  if (ask === "ab") {
    cands.push(
      { v: 1 - pab, title: tx("Only one field subtracted", "Nur ein Feld abgezogen"), say: tx("$1 - P(A ∩ B)$ is “not both”. “Neither” is the bottom right inner field: fill the table step by step.", "$1 - P(A ∩ B)$ heißt „nicht beide“. „Keins von beiden“ ist das innere Feld unten rechts: Füll die Tafel Schritt für Schritt.") },
      { v: 1 - pa - pb, title: tx("Subtracted A ∩ B twice", "A ∩ B doppelt abgezogen"), say: tx("$P(A)$ and $P(B)$ both contain $A ∩ B$, so you subtracted it twice. Add it back once.", "In $P(A)$ und in $P(B)$ steckt jeweils $A ∩ B$: Du hast es doppelt abgezogen. Einmal wieder dazuzählen.") },
      { v: (1 - pa) * (1 - pb), title: tx("Assumed independence", "Unabhängigkeit angenommen"), say: tx("Multiplying the totals only works if $A$ and $B$ are independent. Here they aren't: use the sums in the table.", "Die Randsummen multiplizieren darfst du nur, wenn $A$ und $B$ unabhängig sind. Das sind sie hier nicht: Nutze die Summen in der Tafel.") },
    );
  } else {
    const [own, other] = ask === "AB" ? [pa, pb] : [pb, pa];
    cands.push(
      { v: other - pab, title: tx("Wrong total", "Falsche Summe"), say: tx("You used the other total. The field you need is in the row (or column) whose total you have to start from.", "Du hast die andere Randsumme benutzt. Das gesuchte Feld liegt in der Zeile (oder Spalte), von deren Summe du ausgehen musst.") },
      { v: own * (1 - other), title: tx("Assumed independence", "Unabhängigkeit angenommen"), say: tx("Multiplying only works if $A$ and $B$ are independent. Here they aren't: subtract inside the row or column.", "Multiplizieren darfst du nur bei Unabhängigkeit. Die liegt hier nicht vor: Subtrahiere in der Zeile oder Spalte.") },
      { v: 1 - pab, title: tx("Subtracted from 1", "Von 1 abgezogen"), say: tx("$1$ is the total of the whole table. For one inner field, start from its row or column total.", "$1$ ist die Summe der ganzen Tafel. Für ein inneres Feld gehst du von seiner Zeilen- oder Spaltensumme aus.") },
    );
  }
  const steps: Frame[] =
    ask === "ab"
      ? [
          { math: say((f) => `P(A ∩ \\frac{}{B}) = ${f.n(pa)} - ${f.n(pab)} = ${f.n(v.Ab)}`), note: tx("Row $A$: its two fields add up to $P(A)$.", "Zeile $A$: Ihre beiden Felder ergeben zusammen $P(A)$.") },
          { math: say((f) => `P(\\frac{}{B}) = 1 - ${f.n(pb)} = ${f.n(round(1 - pb, 2))}`), note: tx("The column totals add up to $1$.", "Die Spaltensummen ergeben zusammen $1$.") },
          { math: say((f) => `P(\\frac{}{A} ∩ \\frac{}{B}) = ${f.n(round(1 - pb, 2))} - ${f.n(v.Ab)} = ${f.n(v.ab)}`), note: tx("Column “not $B$”: subtract the field above.", "Spalte „nicht $B$“: das Feld darüber abziehen.") },
        ]
      : ask === "AB"
        ? [{ math: say((f) => `P(A ∩ \\frac{}{B}) = P(A) - P(A ∩ B) = ${f.n(pa)} - ${f.n(pab)} = ${f.n(v.Ab)}`), note: tx("Row $A$: its two inner fields add up to the row total $P(A)$.", "Zeile $A$: Ihre beiden inneren Felder ergeben die Zeilensumme $P(A)$.") }]
        : [{ math: say((f) => `P(\\frac{}{A} ∩ B) = P(B) - P(A ∩ B) = ${f.n(pb)} - ${f.n(pab)} = ${f.n(v.aB)}`), note: tx("Column $B$: its two inner fields add up to the column total $P(B)$.", "Spalte $B$: Ihre beiden inneren Felder ergeben die Spaltensumme $P(B)$.") }];
  return {
    instruction: I.fill,
    text: tx(`The two-way table shows probabilities. What is the probability that ${en(askText)}? Fill in the field marked “?”.`, `Die Vierfeldertafel zeigt Wahrscheinlichkeiten. Wie groß ist die Wahrscheinlichkeit, dass ${de(askText)}? Ergänze das Feld mit dem „?“.`),
    visual: visual(ProbabilityFourField, { cells }),
    answer: numAnswer(right),
    hint: tx("Inner fields add up to the totals at the edge. The whole table adds up to $1$.", "Die inneren Felder ergeben die Randsummen. Die ganze Tafel ergibt $1$."),
    solution: steps,
    mistakes: numMistakes(right, 1e-6, cands),
  };
}

// ---------------------------------------------------------------------------
// Bayes: the medical test

function bayesTask(rng: Rng): Exercise {
  let prev = 2;
  let sens = 90;
  let fpr = 5;
  for (let i = 0; i < 30; i++) {
    prev = rng.pick([1, 2, 5, 10, 20]);
    sens = rng.pick([80, 90, 95, 99]);
    fpr = rng.pick([2, 5, 10, 20]);
    const ppv = (prev * sens) / (prev * sens + (100 - prev) * fpr);
    // keep the classic trap (P_K(T) instead of P_T(K)) clearly wrong
    if (Math.abs(ppv * 100 - sens) > 3 && Math.abs(ppv * 100 - (100 - fpr)) > 3) break;
  }
  const N = 10000;
  const sick = (N * prev) / 100;
  const tp = (sick * sens) / 100;
  const healthy = N - sick;
  const fp = (healthy * fpr) / 100;
  const tn = healthy - fp;
  const fn = sick - tp;
  const ask = rng.pick(["ppv", "ppv", "ppv", "pt", "npv"] as const);
  const value = ask === "ppv" ? tp / (tp + fp) : ask === "pt" ? (tp + fp) / N : tn / (tn + fn);
  const right = round(value * 100, 1);
  const questionEn = ask === "ppv" ? "Someone tests positive. What is the probability that they are really ill?" : ask === "pt" ? "What is the probability that a randomly chosen person tests positive?" : "Someone tests negative. What is the probability that they are really healthy?";
  const questionDe = ask === "ppv" ? "Ein Test ist positiv. Wie groß ist die Wahrscheinlichkeit, dass die Person wirklich krank ist?" : ask === "pt" ? "Wie groß ist die Wahrscheinlichkeit, dass eine zufällig ausgewählte Person positiv getestet wird?" : "Ein Test ist negativ. Wie groß ist die Wahrscheinlichkeit, dass die Person wirklich gesund ist?";
  const sym = ask === "ppv" ? "P_T(K)" : ask === "pt" ? "P(T)" : "P_{\\frac{}{T}}(\\frac{}{K})";
  const cands: { v: number | null; title: Text; say: Text }[] =
    ask === "ppv"
      ? [
          { v: sens, title: tx("Condition swapped", "Bedingung vertauscht"), say: tx(`$\\group{${sens} \\, %}$ is $P_K(T)$: how often the test is positive **if** someone is ill. You need it the other way round: ill **if** the test is positive.`, `$\\group{${sens} \\, %}$ ist $P_K(T)$: wie oft der Test positiv ist, **wenn** jemand krank ist. Gesucht ist es umgekehrt: krank, **wenn** der Test positiv ist.`) },
          { v: (tp / N) * 100, title: tx("Path, not conditional", "Pfad statt bedingt"), say: tx("That's $P(K ∩ T)$, one path. Divide it by **all** positive tests, $P(T)$.", "Das ist $P(K ∩ T)$, ein Pfad. Teile ihn durch **alle** positiven Tests, also $P(T)$.") },
          { v: ((tp + fp) / N) * 100, title: tx("That's P(T)", "Das ist P(T)"), say: tx("That's the probability of a positive test. Now: which share of the positive tests are ill?", "Das ist die Wahrscheinlichkeit für einen positiven Test. Jetzt noch: Welcher Anteil der Positiven ist krank?") },
          { v: prev, title: tx("Test result ignored", "Testergebnis ignoriert"), say: tx("That's how common the illness is overall. The positive test changes the picture: divide among the positives only.", "So häufig ist die Krankheit insgesamt. Der positive Test ändert das Bild: Teile nur unter den Positiven auf.") },
        ]
      : ask === "pt"
        ? [
            { v: (tp / N) * 100, title: tx("Only the ill", "Nur die Kranken"), say: tx("Healthy people can test positive too (false positives). Add that path.", "Auch Gesunde können positiv getestet werden (falsch positiv). Addiere diesen Pfad.") },
            { v: sens, title: tx("That's P_K(T)", "Das ist P_K(T)"), say: tx("That's the share of ill people who test positive. You need everyone who tests positive.", "Das ist der Anteil der Kranken, die positiv getestet werden. Gesucht sind alle, die positiv getestet werden.") },
            { v: (fp / N) * 100, title: tx("Only the false positives", "Nur die falsch Positiven"), say: tx("You only counted the healthy people with a positive test. Add the ill ones who test positive.", "Du hast nur die Gesunden mit positivem Test gezählt. Addiere die Kranken mit positivem Test.") },
          ]
        : [
            { v: 100 - fpr, title: tx("Condition swapped", "Bedingung vertauscht"), say: tx(`$\\group{${100 - fpr} \\, %}$ is how often a healthy person tests negative. You need it the other way round: healthy **if** the test is negative.`, `$\\group{${100 - fpr} \\, %}$ ist, wie oft ein Gesunder negativ getestet wird. Gesucht ist es umgekehrt: gesund, **wenn** der Test negativ ist.`) },
            { v: (tn / N) * 100, title: tx("Path, not conditional", "Pfad statt bedingt"), say: tx("That's one path: healthy and negative. Divide by **all** negative tests.", "Das ist ein Pfad: gesund und negativ. Teile durch **alle** negativen Tests.") },
          ];
  const branches: TreeBranch[] = [
    { node: "K", p: prev / 100, kids: [{ node: "T", p: sens / 100 }, { node: "~T", p: round(1 - sens / 100, 2) }] },
    { node: "~K", p: round(1 - prev / 100, 2), kids: [{ node: "T", p: fpr / 100 }, { node: "~T", p: round(1 - fpr / 100, 2) }] },
  ];
  const fracLine = ask === "ppv" ? fr(tp, tp + fp) : ask === "pt" ? fr(tp + fp, N) : fr(tn, tn + fn);
  return {
    instruction: I.bayes,
    text: tx(
      `$\\group{${prev} \\, %}$ of the population have an illness ($K$). A test ($T$ = positive) is positive for $\\group{${sens} \\, %}$ of the ill and, by mistake, for $\\group{${fpr} \\, %}$ of the healthy. ${questionEn} Give it as a percentage to one decimal place.`,
      `$\\group{${prev} \\, %}$ der Bevölkerung haben eine Krankheit ($K$). Ein Test ($T$ = positiv) fällt bei $\\group{${sens} \\, %}$ der Kranken positiv aus, bei Gesunden fälschlich in $\\group{${fpr} \\, %}$ der Fälle. ${questionDe} Gib sie in Prozent auf eine Nachkommastelle an.`,
    ),
    visual: visual(ProbabilityTree, { branches }),
    math: sym,
    answer: numAnswer(right, 0.06, PCT),
    hint: tx("Imagine $10\\,000$ people: how many are ill, how many of them test positive, how many healthy people test positive?", "Stell dir $10\\,000$ Menschen vor: Wie viele sind krank, wie viele davon positiv, wie viele Gesunde positiv?"),
    solution: [
      {
        math: tx(`${sick} \\; "ill" \\quad ${healthy} \\; "healthy"`, `${sick} \\; "krank" \\quad ${healthy} \\; "gesund"`),
        note: tx(`Of $10\\,000$ people, $\\group{${prev} \\, %}$ are ill.`, `Von $10\\,000$ Menschen sind $\\group{${prev} \\, %}$ krank.`),
      },
      {
        math: tx(`${tp} \\; "ill and positive" \\quad ${fp} \\; "healthy and positive"`, `${tp} \\; "krank und positiv" \\quad ${fp} \\; "gesund und positiv"`),
        note: tx(`$\\group{${sens} \\, %}$ of the ill and $\\group{${fpr} \\, %}$ of the healthy test positive.`, `$\\group{${sens} \\, %}$ der Kranken und $\\group{${fpr} \\, %}$ der Gesunden werden positiv getestet.`),
      },
      ...(ask === "npv"
        ? [{ math: tx(`${fn} \\; "ill and negative" \\quad ${tn} \\; "healthy and negative"`, `${fn} \\; "krank und negativ" \\quad ${tn} \\; "gesund und negativ"`), note: tx("The rest test negative.", "Der Rest ist negativ.") }]
        : []),
      {
        math: say((f) => `${sym} = ${fracLine} \\approx ${f.n(right / 100, 3)} = \\group{${f.n(right, 1)} \\, %}`),
        note:
          ask === "ppv"
            ? tx("Ill and positive, divided by **all** positives. That's Bayes' theorem with natural frequencies.", "Krank und positiv, geteilt durch **alle** Positiven. Das ist der Satz von Bayes mit natürlichen Häufigkeiten.")
            : ask === "pt"
              ? tx("Both positive paths together, out of everyone (path rule 2).", "Beide positiven Pfade zusammen, von allen (2. Pfadregel).")
              : tx("Healthy and negative, divided by **all** negatives.", "Gesund und negativ, geteilt durch **alle** Negativen."),
      },
    ],
    mistakes: numMistakes(right, 0.06, cands, PCT),
  };
}

// ---------------------------------------------------------------------------
// Independence

const INDEP: Text[] = [
  tx("independent, because $P(A ∩ B) = P(A) \\cdot P(B)$", "unabhängig, weil $P(A ∩ B) = P(A) \\cdot P(B)$"),
  tx("dependent, because $P(A ∩ B) \\ne P(A) \\cdot P(B)$", "abhängig, weil $P(A ∩ B) \\ne P(A) \\cdot P(B)$"),
  tx("dependent, because $A$ and $B$ can happen at the same time", "abhängig, weil $A$ und $B$ gleichzeitig eintreten können"),
  tx("independent, because $P(A) + P(B) \\ne 1$", "unabhängig, weil $P(A) + P(B) \\ne 1$"),
];

function indepTask(rng: Rng): Exercise {
  const pa = rng.int(2, 8) / 10;
  const pb = rng.int(2, 8) / 10;
  const prod = round(pa * pb, 2);
  if (rng.chance(0.35)) {
    return {
      instruction: I.indepCalc,
      math: say((f) => `P(A) = ${f.n(pa)} \\quad P(B) = ${f.n(pb)}`),
      text: tx("$A$ and $B$ are independent. What is $P(A ∩ B)$?", "$A$ und $B$ sind unabhängig. Wie groß ist $P(A ∩ B)$?"),
      answer: numAnswer(prod),
      hint: tx("For independent events you may multiply.", "Bei unabhängigen Ereignissen darfst du multiplizieren."),
      solution: [{ math: say((f) => `P(A ∩ B) = P(A) \\cdot P(B) = ${f.n(pa)} \\cdot ${f.n(pb)} = ${f.n(prod)}`), note: tx("Independent: the probability of both is the product.", "Unabhängig: Die Wahrscheinlichkeit für beides ist das Produkt.") }],
      mistakes: numMistakes(prod, 1e-6, [
        { v: round(pa + pb, 2), title: tx("Added", "Addiert"), say: tx("“Both” means multiply, not add. $A$ and $B$ together are rarer than each alone.", "„Beides“ heißt multiplizieren, nicht addieren. $A$ und $B$ zusammen sind seltener als jedes allein.") },
        { v: round(pa + pb - prod, 2), title: tx("That's “A or B”", "Das ist „A oder B“"), say: tx("You worked out $P(A \\text{ or } B)$. For “and” the product is enough.", "Du hast $P(A \\text{ oder } B)$ berechnet. Für „und“ reicht das Produkt.") },
      ]),
    };
  }
  const independent = rng.chance(0.45);
  let pab = prod;
  if (!independent) {
    const shift = rng.pick([-0.1, -0.06, -0.04, 0.04, 0.06, 0.1]);
    // P(A ∩ B) must stay possible: at least P(A) + P(B) − 1, at most min(P(A), P(B)).
    pab = round(Math.min(Math.min(pa, pb) - 0.01, Math.max(0.01, pa + pb - 1 + 0.01, prod + shift)), 2);
    if (Math.abs(pab - prod) < 0.01) pab = round(prod + 0.05, 2);
  }
  const s = shuffled(rng.shuffle, INDEP, independent ? 0 : 1);
  return {
    instruction: I.indep,
    math: say((f) => `P(A) = ${f.n(pa)} \\quad P(B) = ${f.n(pb)} \\quad P(A ∩ B) = ${f.n(pab)}`),
    answer: { kind: "choice", options: s.options, correct: s.correct },
    hint: tx("Compare $P(A ∩ B)$ with the product $P(A) \\cdot P(B)$.", "Vergleiche $P(A ∩ B)$ mit dem Produkt $P(A) \\cdot P(B)$."),
    solution: [
      { math: say((f) => `P(A) \\cdot P(B) = ${f.n(pa)} \\cdot ${f.n(pb)} = ${f.n(prod)}`), note: tx("Work out the product.", "Das Produkt ausrechnen.") },
      {
        math: say((f) => `P(A ∩ B) = ${f.n(pab)} ${independent ? "=" : "\\ne"} ${f.n(prod)}`),
        note: independent ? tx("Equal: $A$ and $B$ are **independent**.", "Gleich: $A$ und $B$ sind **unabhängig**.") : tx("Not equal: $A$ and $B$ are **dependent**.", "Nicht gleich: $A$ und $B$ sind **abhängig**."),
      },
    ],
    mistakes: choiceMistakes(s.options, s.correct, [
      { i: s.at(independent ? 1 : 0), title: tx("Check the product", "Prüf das Produkt"), say: say((f) => f.t(`Work it out: $P(A) \\cdot P(B) = ${f.n(prod)}$. Compare it with $P(A ∩ B)$ again.`, `Rechne nach: $P(A) \\cdot P(B) = ${f.n(prod)}$. Vergleich das noch mal mit $P(A ∩ B)$.`)) },
      { i: s.at(2), title: tx("Independent ≠ disjoint", "Unabhängig ≠ unvereinbar"), say: tx("Classic mix-up! Events that can't happen together are **disjoint**. Independent means: one doesn't change the probability of the other.", "Klassische Verwechslung! Ereignisse, die nicht zusammen eintreten können, heißen **unvereinbar**. Unabhängig heißt: Das eine ändert die Wahrscheinlichkeit des anderen nicht.") },
      { i: s.at(3), title: tx("Not a criterion", "Kein Kriterium"), say: tx("The sum $P(A) + P(B)$ says nothing about independence. The test is the product rule.", "Die Summe $P(A) + P(B)$ sagt nichts über Unabhängigkeit. Das Kriterium ist die Produktregel.") },
    ]),
  };
}

// ---------------------------------------------------------------------------
// Expected value and fair games

const euro = (f: Fmt, v: number) => (f.l === "de" ? `${f.eur(v)} \\, "€"` : `"€" ${f.eur(v)}`);
const euroText = (f: Fmt, v: number) => (f.l === "de" ? `${f.eur(v)} €` : `€${f.eur(v)}`);

const SPIN_GAMES: { w: number[]; pay: number[] }[] = [
  { w: [180, 120, 60], pay: [0, 2, 5] },
  { w: [180, 90, 90], pay: [0, 2, 4] },
  { w: [240, 90, 30], pay: [0, 3, 12] },
  { w: [216, 108, 36], pay: [0, 2, 10] },
  { w: [270, 72, 18], pay: [0, 5, 20] },
  { w: [180, 144, 36], pay: [1, 2, 10] },
];

function expectTask(rng: Rng): Exercise {
  const askFair = rng.chance(0.35);
  let outcomes: { p: Frac; pay: number; en: string; de: string }[];
  let stake: number;
  let introEn: string;
  let introDe: string;
  let vis: ReturnType<typeof visual> | undefined;
  if (rng.chance(0.5)) {
    let x = 6;
    let y = 2;
    let m = 2;
    for (let i = 0; i < 40; i++) {
      x = rng.pick([4, 5, 6, 8, 10, 12]);
      y = rng.pick([1, 2, 3]);
      m = rng.pick([1, 2]);
      if ((x + m * y) % 3 === 0) break;
    }
    stake = rng.pick([1, 2, 3]);
    outcomes = [
      { p: frac(1, 6), pay: x, en: "a six", de: "einer Sechs" },
      { p: frac(m, 6), pay: y, en: m === 1 ? "a five" : "a four or a five", de: m === 1 ? "einer Fünf" : "einer Vier oder Fünf" },
      { p: frac(5 - m, 6), pay: 0, en: "anything else", de: "allem anderen" },
    ];
    introEn = `A dice game costs a stake of ${"€"}${stake}. You roll once. You are paid ${euroText(fmt0("en"), x)} for a six, ${euroText(fmt0("en"), y)} for ${outcomes[1].en}, and nothing otherwise.`;
    introDe = `Ein Würfelspiel kostet ${euroText(fmt0("de"), stake)} Einsatz. Du würfelst einmal. Bei einer Sechs bekommst du ${euroText(fmt0("de"), x)} ausgezahlt, bei ${outcomes[1].de} ${euroText(fmt0("de"), y)}, sonst nichts.`;
  } else {
    const g = rng.pick(SPIN_GAMES);
    stake = rng.pick([1, 2]);
    outcomes = g.w.map((w, i) => ({ p: frac(w, 360), pay: g.pay[i], en: "", de: "" }));
    const colours = rng.shuffle(["purple", "green", "red"] as const);
    const sectors: Sector[] = g.w.map((w, i) => ({ w, color: colours[i], label: tx(`€${g.pay[i]}`, `${g.pay[i]} €`) }));
    vis = visual(ProbabilitySpinner, { sectors });
    introDe = `Eine Drehung kostet ${stake} € Einsatz. Das Glücksrad zahlt den Betrag aus, auf dem es stehen bleibt. Die Mittelpunktswinkel der Felder sind ${g.w.join("°, ")}°.`;
    introEn = `One spin costs a stake of €${stake}. The spinner pays out the amount in the field where it stops. The angles of the fields are ${g.w.join("°, ")}°.`;
  }
  const ev = outcomes.reduce((s, o) => s + (o.p.n / o.p.d) * o.pay, 0);
  const right = round(askFair ? ev : ev - stake, 2);
  const unweighted = outcomes.reduce((s, o) => s + o.pay, 0) / outcomes.length;
  const terms = () => outcomes.map((o) => `${o.pay} \\cdot ${fr(o.p.n, o.p.d)}`).join(" + ");
  return {
    instruction: I.expect,
    text: tx(
      `${introEn} ${askFair ? "Which stake would make the game fair? Give it in euros (to the cent)." : "What profit can you expect per game? Give it in euros (to the cent, negative for a loss)."}`,
      `${introDe} ${askFair ? "Bei welchem Einsatz wäre das Spiel fair? Gib ihn in Euro an (auf Cent genau)." : "Welchen Gewinn kannst du pro Spiel erwarten? Gib ihn in Euro an (auf Cent genau, negativ bei Verlust)."}`,
    ),
    ...(vis ? { visual: vis } : {}),
    answer: numAnswer(right, 0.006, EUR),
    hint: askFair
      ? tx("Fair means: the expected payout equals the stake. Work out $E(\\text{payout})$.", "Fair heißt: Die erwartete Auszahlung ist so groß wie der Einsatz. Berechne $E(\\text{Auszahlung})$.")
      : tx("Each payout times its probability, add them up, then subtract the stake.", "Jede Auszahlung mal ihre Wahrscheinlichkeit, alles addieren, dann den Einsatz abziehen."),
    solution: [
      { math: tx(`E("payout") = ${terms()}`, `E("Auszahlung") = ${terms()}`), note: tx("Each payout weighted with its probability.", "Jede Auszahlung mit ihrer Wahrscheinlichkeit gewichtet.") },
      { math: say((f) => `${f.t(`E("payout")`, `E("Auszahlung")`)} = ${euro(f, ev)}`), note: tx("On average the game pays out this much per round.", "So viel zahlt das Spiel im Mittel pro Runde aus.") },
      askFair
        ? { math: say((f) => `${f.t(`"fair stake"`, `"fairer Einsatz"`)} = ${euro(f, right)}`), note: tx("Fair: expected profit $0$, so the stake equals the expected payout.", "Fair: erwarteter Gewinn $0$, also Einsatz = erwartete Auszahlung.") }
        : { math: say((f) => `E(G) = ${f.eur(ev)} - ${stake} = ${euro(f, right)}`), note: right < 0 ? tx("Profit = payout − stake. Negative: in the long run you lose.", "Gewinn = Auszahlung − Einsatz. Negativ: Auf Dauer verlierst du.") : tx("Profit = payout − stake.", "Gewinn = Auszahlung − Einsatz.") },
    ],
    mistakes: numMistakes(
      right,
      0.006,
      [
        askFair
          ? { v: ev - stake, title: tx("Profit, not stake", "Gewinn statt Einsatz"), say: tx("That's the expected profit at the current stake. A fair stake is the expected **payout**.", "Das ist der erwartete Gewinn beim jetzigen Einsatz. Der faire Einsatz ist die erwartete **Auszahlung**.") }
          : { v: ev, title: tx("Stake forgotten", "Einsatz vergessen"), say: tx("That's the expected payout. Profit = payout − stake.", "Das ist die erwartete Auszahlung. Gewinn = Auszahlung − Einsatz.") },
        { v: askFair ? unweighted : unweighted - stake, title: tx("Not weighted", "Nicht gewichtet"), say: tx("You took the plain average of the payouts. But they're not equally likely: weight each with its probability.", "Du hast einfach den Mittelwert der Auszahlungen genommen. Die sind aber nicht gleich wahrscheinlich: Gewichte jede mit ihrer Wahrscheinlichkeit.") },
      ],
      EUR,
    ),
  };
}

/** A formatter without the bilingual pick, for strings built in one language. */
function fmt0(l: "en" | "de"): Fmt {
  const comma = (s: string) => (l === "de" ? s.replace(".", ",") : s);
  return {
    t: (a, b) => (l === "de" ? b : a),
    l,
    n: (v, d = 6) => comma(String(round(v, d))),
    pc: (v, d = 1) => comma(String(round(v * 100, d))),
    eur: (v) => {
      const r = round(v, 2);
      return comma(Number.isInteger(r) ? String(r) : r.toFixed(2));
    },
  };
}

// ---------------------------------------------------------------------------
// Binomial distribution

/** `hit`: English plural noun and German with article („die richtigen Antworten“); `dat`: German dative („mit wie vielen richtigen Antworten“). */
type BCtx = { p: number; en: (n: number) => string; de: (n: number) => string; hit: Text; dat: string };
const BCTX: BCtx[] = [
  { p: 0.7, en: (n) => `A basketball player scores a free throw with probability $0.7$. She takes $${n}$ free throws.`, de: (n) => `Eine Basketballspielerin trifft beim Freiwurf mit der Wahrscheinlichkeit $0,7$. Sie wirft $${n}$ Freiwürfe.`, hit: tx("baskets", "die Treffer"), dat: "Treffern" },
  { p: 0.8, en: (n) => `A basketball player scores a free throw with probability $0.8$. He takes $${n}$ free throws.`, de: (n) => `Ein Basketballspieler trifft beim Freiwurf mit der Wahrscheinlichkeit $0,8$. Er wirft $${n}$ Freiwürfe.`, hit: tx("baskets", "die Treffer"), dat: "Treffern" },
  { p: 0.25, en: (n) => `A quiz has $${n}$ questions with $4$ answers each, one of them right. You guess every answer.`, de: (n) => `Ein Quiz hat $${n}$ Fragen mit je $4$ Antworten, von denen eine richtig ist. Du rätst bei jeder Frage.`, hit: tx("right answers", "die richtigen Antworten"), dat: "richtigen Antworten" },
  { p: 0.9, en: (n) => `A seed germinates with probability $0.9$. You sow $${n}$ seeds.`, de: (n) => `Ein Samenkorn keimt mit der Wahrscheinlichkeit $0,9$. Du säst $${n}$ Körner.`, hit: tx("seeds that germinate", "die keimenden Körner"), dat: "keimenden Körnern" },
  { p: 0.1, en: (n) => `A machine makes faulty parts with probability $0.1$. You check $${n}$ parts.`, de: (n) => `Eine Maschine produziert mit der Wahrscheinlichkeit $0,1$ ein fehlerhaftes Teil. Du prüfst $${n}$ Teile.`, hit: tx("faulty parts", "die fehlerhaften Teile"), dat: "fehlerhaften Teilen" },
  { p: 0.5, en: (n) => `You toss a fair coin $${n}$ times.`, de: (n) => `Du wirfst eine faire Münze $${n}$-mal.`, hit: tx("heads", "die Wappen"), dat: "Wappen" },
  { p: 0.2, en: (n) => `A spinner shows a prize with probability $0.2$. You spin it $${n}$ times.`, de: (n) => `Ein Glücksrad zeigt mit der Wahrscheinlichkeit $0,2$ einen Gewinn. Du drehst $${n}$-mal.`, hit: tx("prizes", "die Gewinne"), dat: "Gewinnen" },
  { p: 0.3, en: (n) => `In a town $\\group{30 \\, %}$ of households have a dog. You ask $${n}$ random households.`, de: (n) => `In einer Stadt haben $\\group{30 \\, %}$ der Haushalte einen Hund. Du fragst $${n}$ zufällige Haushalte.`, hit: tx("households with a dog", "die Haushalte mit Hund"), dat: "Haushalten mit Hund" },
];

const bin = (n: number, k: number, p: number) => C(n, k) * p ** k * (1 - p) ** (n - k);
const binSrc = (f: Fmt, n: number, k: number, p: number) => `${C(n, k)} \\cdot ${f.n(p)}^{${k}} \\cdot ${f.n(round(1 - p, 2))}^{${n - k}}`;
const choose = (f: Fmt, n: number, k: number) => f.t(`("${n} choose ${k}")`, `("${n} über ${k}")`);

function binomTask(rng: Rng): Exercise {
  const c = rng.pick(BCTX);
  const n = rng.int(4, 10);
  let k = Math.round(n * c.p) + rng.int(-2, 1);
  k = Math.max(0, Math.min(n, k));
  const p = c.p;
  const exact = bin(n, k, p);
  const right = round(exact, 4);
  const cum = Array.from({ length: k + 1 }, (_, i) => bin(n, i, p)).reduce((a, b) => a + b, 0);
  return {
    instruction: I.binom,
    text: tx(
      `${c.en(n)} $X$ counts the ${en(c.hit)}. What is $P(X = ${k})$? Round to four decimal places.`,
      `${c.de(n)} $X$ zählt ${de(c.hit)}. Wie groß ist $P(X = ${k})$? Runde auf vier Nachkommastellen.`,
    ),
    answer: numAnswer(right, 0.00006),
    hint: tx("Bernoulli formula: number of paths · $p^k$ · $(1 - p)^{n - k}$.", "Bernoulli-Formel: Anzahl der Pfade · $p^k$ · $(1 - p)^{n - k}$."),
    solution: [
      { math: say((f) => `n = ${n}, \\; p = ${f.n(p)}, \\; k = ${k}`), note: tx(`A Bernoulli chain of length $${n}$ with hit probability $p$.`, `Eine Bernoulli-Kette der Länge $${n}$ mit der Trefferwahrscheinlichkeit $p$.`) },
      { math: say((f) => `P(X = ${k}) = ${choose(f, n, k)} \\cdot ${f.n(p)}^{${k}} \\cdot ${f.n(round(1 - p, 2))}^{${n - k}}`), note: say((f) => f.t(`There ${C(n, k) === 1 ? "is 1 path" : `are ${C(n, k)} paths`} with exactly $${k}$ ${k === 1 ? "hit" : "hits"} ($${n}$ choose $${k}$, nCr on the calculator).`, `Es gibt ${C(n, k) === 1 ? "einen Pfad" : `${C(n, k)} Pfade`} mit genau ${k === 1 ? "einem Treffer" : `$${k}$ Treffern`} („${n} über ${k}“, nCr auf dem Taschenrechner).`)) },
      { math: say((f) => `P(X = ${k}) = ${binSrc(f, n, k, p)} \\approx ${f.n(right, 4)}`), note: tx("Type it into the calculator and round.", "In den Taschenrechner eingeben und runden.") },
    ],
    mistakes: numMistakes(right, 0.00006, [
      { v: C(n, k) > 1 ? round(exact / C(n, k), 4) : null, title: tx("Only one path", "Nur ein Pfad"), say: tx(`That's the probability of **one** path. There are ${C(n, k)} paths with exactly ${k} hits: multiply by the binomial coefficient.`, `Das ist die Wahrscheinlichkeit für **einen** Pfad. Es gibt ${C(n, k)} Pfade mit genau ${k} Treffern: Multipliziere mit dem Binomialkoeffizienten.`) },
      { v: k !== n - k && p !== 0.5 ? round(C(n, k) * p ** (n - k) * (1 - p) ** k, 4) : null, title: tx("Exponents swapped", "Exponenten vertauscht"), say: tx("$p$ goes with the hits: $p^k$. The misses get $(1 - p)^{n - k}$.", "$p$ gehört zu den Treffern: $p^k$. Die Nieten bekommen $(1 - p)^{n - k}$.") },
      { v: C(n, k) !== n && k > 0 ? round((exact / C(n, k)) * n, 4) : null, title: tx("Wrong number of paths", "Falsche Anzahl der Pfade"), say: tx(`You multiplied by $${n}$. The number of paths is the binomial coefficient, here ${C(n, k)}.`, `Du hast mit $${n}$ multipliziert. Die Anzahl der Pfade ist der Binomialkoeffizient, hier ${C(n, k)}.`) },
      { v: k > 0 && k < n ? round(cum, 4) : null, title: tx("At most, not exactly", "Höchstens statt genau"), say: tx(`That's $P(X \\le ${k})$. Exactly ${k} hits is just one bar of the distribution.`, `Das ist $P(X \\le ${k})$. Genau ${k} Treffer ist nur eine Säule der Verteilung.`) },
    ]),
  };
}

function cumulTask(rng: Rng): Exercise {
  const ask = rng.pick(["ge1", "ge1", "le1"] as const);
  const c = rng.pick(BCTX.filter((x) => (ask === "ge1" ? x.p <= 0.5 : x.p <= 0.3)));
  const n = rng.int(3, 8);
  const p = c.p;
  const p0 = bin(n, 0, p);
  const p1 = bin(n, 1, p);
  const exact = ask === "ge1" ? 1 - p0 : p0 + p1;
  const right = round(exact, 4);
  const sym = ask === "ge1" ? "P(X \\ge 1)" : "P(X \\le 1)";
  return {
    instruction: I.cumul,
    text: tx(
      `${c.en(n)} $X$ counts the ${en(c.hit)}. What is $${sym}$? Round to four decimal places.`,
      `${c.de(n)} $X$ zählt ${de(c.hit)}. Wie groß ist $${sym}$? Runde auf vier Nachkommastellen.`,
    ),
    answer: numAnswer(right, 0.00006),
    hint: ask === "ge1" ? tx("At least one hit: use the complement $1 - P(X = 0)$.", "Mindestens ein Treffer: Nimm das Gegenereignis $1 - P(X = 0)$.") : tx("At most one hit: $P(X = 0) + P(X = 1)$.", "Höchstens ein Treffer: $P(X = 0) + P(X = 1)$."),
    solution:
      ask === "ge1"
        ? [
            { math: "P(X \\ge 1) = 1 - P(X = 0)", note: tx("The complement of “at least one” is “none”.", "Das Gegenereignis von „mindestens einer“ ist „keiner“.") },
            { math: say((f) => `P(X \\ge 1) = 1 - ${f.n(round(1 - p, 2))}^{${n}} \\approx ${f.n(right, 4)}`), note: tx("No hit at all: one path, only misses.", "Gar kein Treffer: ein Pfad, nur Nieten.") },
          ]
        : [
            { math: "P(X \\le 1) = P(X = 0) + P(X = 1)", note: tx("At most one: zero hits or one hit.", "Höchstens einer: null Treffer oder ein Treffer.") },
            { math: say((f) => `P(X \\le 1) = ${f.n(round(1 - p, 2))}^{${n}} + ${n} \\cdot ${f.n(p)} \\cdot ${f.n(round(1 - p, 2))}^{${n - 1}}`), note: tx(`One hit has $${n}$ paths: the hit can be in any of the $${n}$ places.`, `Ein Treffer hat $${n}$ Pfade: Der Treffer kann an jeder der $${n}$ Stellen liegen.`) },
            { math: say((f) => `P(X \\le 1) \\approx ${f.n(round(p0, 4), 4)} + ${f.n(round(p1, 4), 4)} \\approx ${f.n(right, 4)}`), note: tx("Add and round.", "Addieren und runden.") },
          ],
    mistakes: numMistakes(right, 0.00006, [
      ...(ask === "ge1"
        ? [
            { v: n * p <= 1.5 ? round(n * p, 4) : null, title: tx("n · p", "n · p"), say: tx("$n \\cdot p$ is the expected number of hits, not a probability. Use $1 - P(X = 0)$.", "$n \\cdot p$ ist die erwartete Trefferzahl, keine Wahrscheinlichkeit. Nimm $1 - P(X = 0)$.") },
            { v: round(p1, 4), title: tx("Exactly one", "Genau einer"), say: tx("That's exactly one hit. At least one also includes two, three, … hits.", "Das ist genau ein Treffer. Mindestens einer schließt auch zwei, drei, … Treffer mit ein.") },
            { v: p ** n > 0.0002 ? round(1 - p ** n, 4) : null, title: tx("Wrong complement", "Falsches Gegenereignis"), say: tx("The complement of “at least one hit” is “no hit”, so $(1 - p)^n$, not $p^n$.", "Das Gegenereignis von „mindestens ein Treffer“ ist „kein Treffer“, also $(1 - p)^n$, nicht $p^n$.") },
            { v: round(p0, 4), title: tx("Forgot the 1 −", "Das „1 −“ vergessen"), say: tx("That's $P(X = 0)$. You still need $1$ minus that.", "Das ist $P(X = 0)$. Du brauchst noch $1$ minus das.") },
          ]
        : [
            { v: round(p1, 4), title: tx("Zero hits forgotten", "Null Treffer vergessen"), say: tx("At most one also includes **no** hit: add $P(X = 0)$.", "Höchstens einer schließt auch **keinen** Treffer ein: Addiere $P(X = 0)$.") },
            { v: round(p0 + p1 / n, 4), title: tx("Only one path for one hit", "Nur ein Pfad für einen Treffer"), say: tx(`One hit has $${n}$ paths, not just one.`, `Für einen Treffer gibt es $${n}$ Pfade, nicht nur einen.`) },
            { v: round(1 - p1, 4), title: tx("Wrong complement", "Falsches Gegenereignis"), say: tx("$1 - P(X = 1)$ is “not exactly one”. You need zero **or** one hit.", "$1 - P(X = 1)$ heißt „nicht genau einer“. Gesucht sind null **oder** ein Treffer.") },
          ]),
    ]),
  };
}

function muTask(rng: Rng): Exercise {
  for (let i = 0; i < 50; i++) {
    const c = rng.pick(BCTX);
    const n = rng.pick([20, 30, 40, 50, 60, 80, 100, 200]);
    const mu = round(n * c.p, 6);
    if (!Number.isInteger(mu)) continue;
    return {
      instruction: I.mu,
      text: tx(`${c.en(n)} $X$ counts the ${en(c.hit)}. How many ${en(c.hit)} do you expect, that is, what is $E(X)$?`, `${c.de(n)} $X$ zählt ${de(c.hit)}. Mit wie vielen ${c.dat} rechnest du, wie groß ist also $E(X)$?`),
      answer: numAnswer(mu),
      hint: tx("For a binomial distribution: $E(X) = n \\cdot p$.", "Bei einer Binomialverteilung gilt: $E(X) = n \\cdot p$."),
      solution: [{ math: say((f) => `E(X) = n \\cdot p = ${n} \\cdot ${f.n(c.p)} = ${mu}`), note: tx("On average, the share $p$ of the $n$ trials are hits.", "Im Mittel ist der Anteil $p$ der $n$ Versuche ein Treffer.") }],
      mistakes: numMistakes(mu, 1e-6, [
        { v: round(n * (1 - c.p), 6), title: tx("Misses counted", "Nieten gezählt"), say: tx("That's the expected number of misses: $n \\cdot (1 - p)$. Hits use $p$.", "Das ist die erwartete Anzahl der Nieten: $n \\cdot (1 - p)$. Für Treffer nimmst du $p$.") },
        { v: Number.isInteger(n / c.p) ? n / c.p : null, title: tx("Divided", "Geteilt"), say: tx("Divide? Multiply: $E(X) = n \\cdot p$.", "Teilen? Multiplizieren: $E(X) = n \\cdot p$.") },
      ]),
    };
  }
  return binomTask(rng);
}

function pathsTask(rng: Rng): Exercise {
  const n = rng.int(4, 8);
  const k = rng.int(2, n - 2);
  const right = C(n, k);
  const fact = (m: number): number => (m <= 1 ? 1 : m * fact(m - 1));
  return {
    instruction: I.paths,
    text: tx(
      `A Bernoulli chain has length $${n}$. How many paths of the tree have exactly $${k}$ ${k === 1 ? "hit" : "hits"}? (That's the binomial coefficient $${n}$ choose $${k}$.)`,
      `Eine Bernoulli-Kette hat die Länge $${n}$. Wie viele Pfade im Baum haben genau $${k}$ Treffer? (Das ist der Binomialkoeffizient „${n} über ${k}“.)`,
    ),
    answer: numAnswer(right),
    hint: tx(`Choose the $${k}$ places of the hits among $${n}$ places. Calculator: nCr.`, `Wähle die $${k}$ Stellen der Treffer unter $${n}$ Stellen aus. Taschenrechner: nCr.`),
    solution: [
      { math: tx(`("${n} choose ${k}") = \\frac{${n}!}{${k}! \\cdot ${n - k}!}`, `("${n} über ${k}") = \\frac{${n}!}{${k}! \\cdot ${n - k}!}`), note: tx("The binomial coefficient counts the ways to pick the places of the hits.", "Der Binomialkoeffizient zählt, wie viele Möglichkeiten es gibt, die Stellen der Treffer auszuwählen.") },
      { math: tx(`("${n} choose ${k}") = \\frac{${fact(n)}}{${fact(k)} \\cdot ${fact(n - k)}} = ${right}`, `("${n} über ${k}") = \\frac{${fact(n)}}{${fact(k)} \\cdot ${fact(n - k)}} = ${right}`), note: tx(`So $${right}$ paths have exactly $${k}$ ${k === 1 ? "hit" : "hits"}.`, `Also haben $${right}$ Pfade genau $${k}$ Treffer.`) },
    ],
    mistakes: numMistakes(right, 1e-6, [
      { v: n * k, title: tx("Multiplied n and k", "n mal k gerechnet"), say: tx("$n \\cdot k$ isn't the number of paths. Count the ways to place the hits: that's $n$ choose $k$.", "$n \\cdot k$ ist nicht die Anzahl der Pfade. Zähl, wie viele Möglichkeiten es gibt, die Treffer zu verteilen: „n über k“.") },
      { v: 2 ** n, title: tx("All paths", "Alle Pfade"), say: tx(`$2^${n}$ is the number of **all** paths. You need only those with exactly $${k}$ ${k === 1 ? "hit" : "hits"}.`, `$2^${n}$ ist die Anzahl **aller** Pfade. Gesucht sind nur die mit genau ${k === 1 ? "einem Treffer" : `$${k}$ Treffern`}.`) },
      { v: fact(n) / fact(n - k) !== right ? fact(n) / fact(n - k) : null, title: tx("Order counted", "Reihenfolge mitgezählt"), say: tx(`You forgot to divide by $${k}!$: the hits are all the same, their order doesn't matter.`, `Du hast vergessen, durch $${k}!$ zu teilen: Die Treffer sind alle gleich, ihre Reihenfolge spielt keine Rolle.`) },
    ]),
  };
}

// ---------------------------------------------------------------------------

export function generate3(rng: Rng): Exercise {
  const shape = rng.pick(["table", "table", "fill", "bayes", "bayes", "indep", "expect", "expect", "binom", "binom", "cumul", "mu", "paths"] as const);
  switch (shape) {
    case "table":
      return tableTask(rng);
    case "fill":
      return fillTask(rng);
    case "bayes":
      return bayesTask(rng);
    case "indep":
      return indepTask(rng);
    case "expect":
      return expectTask(rng);
    case "binom":
      return binomTask(rng);
    case "cumul":
      return cumulTask(rng);
    case "mu":
      return muTask(rng);
    case "paths":
      return pathsTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

const SCHOOL = { N: 200, a: 60, b: 20, c: 30, d: 90 };
const schoolLegend = { a: tx("lives less than 3 km from school", "wohnt weniger als 3 km von der Schule entfernt"), b: tx("cycles to school", "fährt mit dem Rad zur Schule") };

const tableFrames: Frame[] = [
  { math: say((f) => `P(A ∩ B) =#eq \\frac{60}{200}#f =#e2 ${f.n(0.3)}#v`), note: tx("An inner field: both apply. $60$ out of all $200$. Read $A ∩ B$ as “$A$ and $B$”.", "Ein inneres Feld: Beides trifft zu. $60$ von allen $200$. $A ∩ B$ liest du „$A$ und $B$“.") },
  { math: say((f) => `P(A) =#eq \\frac{80}{200}#f =#e2 ${f.n(0.4)}#v`), note: tx("The totals are at the edge: $80$ live nearby.", "Am Rand stehen die Summen: $80$ wohnen in der Nähe.") },
  {
    math: say((f) => `P(\\frac{}{A} ∩ \\frac{}{B}) =#eq \\frac{90}{200}#f =#e2 ${f.n(0.45)}#v`),
    note: tx("The bar means “not”: neither nearby nor by bike. That's the bottom right inner field.", "Der Strich heißt „nicht“: weder in der Nähe noch mit dem Rad. Das ist das innere Feld unten rechts."),
  },
  { math: say((f) => `P_A(B) =#eq \\frac{60}{80}#f =#e2 ${f.n(0.75)}#v`), note: tx("**Conditional probability**: we only look at the $80$ people in $A$. $60$ of them cycle. Say: “P of $B$ given $A$”.", "**Bedingte Wahrscheinlichkeit**: Wir schauen nur auf die $80$ Personen aus $A$. $60$ davon fahren Rad. Sprich: „P von $B$ unter der Bedingung $A$“.") },
  { math: say((f) => `P_A(B) =#eq \\frac{P(A ∩ B)}{P(A)}#f =#e2 \\frac{${f.n(0.3)}}{${f.n(0.4)}} =#e3 ${f.n(0.75)}#v`), note: tx("The same with probabilities: “and” divided by the condition.", "Dasselbe mit Wahrscheinlichkeiten: „und“ geteilt durch die Bedingung.") },
];

const bayesFrames: Frame[] = [
  { math: say((f) => `P(T) =#eq ${f.n(0.02)} \\cdot ${f.n(0.9)} +#p ${f.n(0.98)} \\cdot ${f.n(0.05)}`), note: tx("Two paths lead to a positive test: ill and positive, healthy and positive.", "Zwei Pfade führen zu einem positiven Test: krank und positiv, gesund und positiv.") },
  { math: say((f) => `P(T) =#eq ${f.n(0.018)}#a +#p ${f.n(0.049)}#b =#e2 ${f.n(0.067)}#c`), note: tx("Path rules: multiply along, then add.", "Pfadregeln: entlang multiplizieren, dann addieren.") },
  { math: say((f) => `P_T(K) =#eq \\frac{P(K ∩ T)}{P(T)}#q =#e2 \\frac{${f.n(0.018)}}{${f.n(0.067)}}#r`), note: tx("Now the other way round: ill **given** a positive test. The path “ill and positive” divided by **all** positive tests. That's **Bayes' theorem**.", "Jetzt umgekehrt: krank **unter der Bedingung** positiver Test. Der Pfad „krank und positiv“ geteilt durch **alle** positiven Tests. Das ist der **Satz von Bayes**.") },
  { math: say((f) => `P_T(K) \\approx#e2 ${f.n(0.269)} =#e3 \\group{${f.n(26.9)} \\, %}`), note: tx("Only about one in four people with a positive test is really ill! There are many more healthy people, and $\\group{5 \\, %}$ of many is a lot.", "Nur etwa jeder Vierte mit positivem Test ist wirklich krank! Es gibt viel mehr Gesunde, und $\\group{5 \\, %}$ von vielen sind viele.") },
];

const indepFrames: Frame[] = [
  { math: say((f) => `P(A) \\cdot P(B) =#eq ${f.n(0.4)} \\cdot ${f.n(0.45)} =#e2 ${f.n(0.18)}#v`), note: tx("If $A$ and $B$ were independent, $P(A ∩ B)$ would have to be exactly this product.", "Wären $A$ und $B$ unabhängig, müsste $P(A ∩ B)$ genau dieses Produkt sein.") },
  { math: say((f) => `P(A ∩ B) =#eq ${f.n(0.3)} \\ne#e2 ${f.n(0.18)}#v`), note: tx("It isn't: $A$ and $B$ are **dependent**. People who live nearby cycle more often.", "Ist es aber nicht: $A$ und $B$ sind **abhängig**. Wer in der Nähe wohnt, fährt öfter mit dem Rad.") },
  { math: say((f) => `P_A(B) = ${f.n(0.75)} \\ne P(B) = ${f.n(0.45)}`), note: tx("The same from another side: the condition $A$ changes the probability of $B$.", "Dasselbe von der anderen Seite: Die Bedingung $A$ ändert die Wahrscheinlichkeit von $B$.") },
  { math: tx(`P("6" ∩ "heads") = \\frac{1}{6} \\cdot \\frac{1}{2} = \\frac{1}{12}`, `P("6" ∩ "Wappen") = \\frac{1}{6} \\cdot \\frac{1}{2} = \\frac{1}{12}`), note: tx("A die and a coin don't affect each other: independent. Then you may simply multiply.", "Würfel und Münze beeinflussen sich nicht: unabhängig. Dann darfst du einfach multiplizieren.") },
];

const expectFrames: Frame[] = [
  { math: "E(X) =#eq x_1 \\cdot P(X = x_1) + x_2 \\cdot P(X = x_2) + …", note: tx("Each value times its probability, then add everything up.", "Jeder Wert mal seine Wahrscheinlichkeit, dann alles addieren.") },
  { math: "E(X) =#eq 0 \\cdot \\frac{1}{2} + 3 \\cdot \\frac{1}{3} + 6 \\cdot \\frac{1}{6}", note: say((f) => f.t(`Half the wheel pays ${euroText(f, 0)}, a third pays ${euroText(f, 3)}, a sixth pays ${euroText(f, 6)}.`, `Die halbe Scheibe zahlt ${euroText(f, 0)}, ein Drittel ${euroText(f, 3)}, ein Sechstel ${euroText(f, 6)}.`)) },
  { math: say((f) => `E(X) =#eq 0 + 1 + 1 =#e2 ${euro(f, 2)}`), note: say((f) => f.t(`On average the wheel pays out ${euroText(f, 2)} per game.`, `Im Mittel zahlt das Rad ${euroText(f, 2)} pro Spiel aus.`)) },
  { math: say((f) => `E(G) =#eq ${euro(f, 2)} - ${euro(f, 2)} =#e2 0`), note: tx("Profit = payout − stake. Expected profit $0$: the game is **fair**. If it were negative, the bank would win in the long run.", "Gewinn = Auszahlung − Einsatz. Erwarteter Gewinn $0$: Das Spiel ist **fair**. Wäre er negativ, gewinnt auf Dauer die Bank.") },
];

const binomFrames: Frame[] = [
  { math: say((f) => `P(110) =#eq ${f.n(0.2)} \\cdot ${f.n(0.2)} \\cdot ${f.n(0.8)} =#e2 ${f.n(0.032)}`), note: tx("One path with two hits: hit, hit, miss.", "Ein Pfad mit zwei Treffern: Treffer, Treffer, Niete.") },
  { math: "110, \\; 101, \\; 011", note: tx("The two hits can sit in different places: $3$ paths, all with the same probability.", "Die zwei Treffer können an verschiedenen Stellen liegen: $3$ Pfade, alle mit derselben Wahrscheinlichkeit.") },
  { math: say((f) => `P(X = 2) =#eq 3 \\cdot ${f.n(0.2)}^2 \\cdot ${f.n(0.8)}^1 =#e2 ${f.n(0.096)}`), note: tx("Number of paths times the probability of one path.", "Anzahl der Pfade mal Wahrscheinlichkeit eines Pfades.") },
  {
    math: tx(`P(X = k) =#eq \\hl{("n choose k")} \\cdot p^k \\cdot (1 - p)^{n - k}`, `P(X = k) =#eq \\hl{("n über k")} \\cdot p^k \\cdot (1 - p)^{n - k}`),
    note: tx(
      "The number of paths with exactly $k$ hits is the **binomial coefficient** “n choose k” (nCr on the calculator; the picture shows how it's written). This is the **Bernoulli formula**: $X$ is **binomially distributed**.",
      "Die Anzahl der Pfade mit genau $k$ Treffern ist der **Binomialkoeffizient** „n über k“ (Taschenrechner: nCr; das Bild zeigt die Schreibweise). Das ist die **Bernoulli-Formel**: $X$ ist **binomialverteilt**.",
    ),
  },
  { math: say((f) => `E(X) =#eq n \\cdot p = 3 \\cdot ${f.n(0.2)} =#e2 ${f.n(0.6)}`), note: tx("The expected value of a binomial distribution: $\\mu = n \\cdot p$.", "Der Erwartungswert einer Binomialverteilung: $\\mu = n \\cdot p$.") },
];

const tableCheck: Exercise = {
  instruction: I.table,
  text: tx("Same survey of $200$ students. Someone who cycles to school is chosen at random. What is the probability that this person lives less than 3 km away?", "Dieselbe Umfrage unter $200$ Jugendlichen. Eine Person, die mit dem Rad zur Schule fährt, wird zufällig ausgewählt. Wie groß ist die Wahrscheinlichkeit, dass sie weniger als 3 km entfernt wohnt?"),
  visual: visual(ProbabilityFourField, { cells: tableCells(SCHOOL), legend: schoolLegend }),
  math: "P_B(A)",
  answer: fracAnswer(frac(2, 3)),
  hint: tx("The condition is $B$: only look at the column $B$.", "Die Bedingung ist $B$: Schau nur auf die Spalte $B$."),
  solution: [
    { math: "P_B(A) =#eq \\frac{60}{90}#f", note: tx("Column $B$: $90$ cyclists. $60$ of them live nearby.", "Spalte $B$: $90$ Radfahrer. $60$ davon wohnen in der Nähe.") },
    { math: "P_B(A) =#eq \\frac{60}{90}#f =#e2 \\frac{2}{3}#g", note: tx("Simplify by $30$.", "Mit $30$ kürzen.") },
  ],
  mistakes: fracMistakes(frac(2, 3), [
    { v: frac(3, 4), ...SWAPPED },
    { v: frac(3, 10), ...NOT_CONDITIONAL },
    { v: frac(2, 5), title: tx("Condition ignored", "Bedingung ignoriert"), say: tx("$\\frac{80}{200}$ is $P(A)$ for everyone. Only the cyclists count here.", "$\\frac{80}{200}$ ist $P(A)$ für alle. Hier zählen nur die Radfahrer.") },
  ]),
};

const bayesCheck: Exercise = {
  instruction: I.bayes,
  text: say((f) =>
    f.t(
      "$\\group{10 \\, %}$ of people have an illness. A test is positive for $\\group{90 \\, %}$ of the ill and, by mistake, for $\\group{10 \\, %}$ of the healthy. Your test is positive. What is the probability that you're ill? Give it as a percentage.",
      "$\\group{10 \\, %}$ der Menschen haben eine Krankheit. Ein Test fällt bei $\\group{90 \\, %}$ der Kranken positiv aus, bei Gesunden fälschlich in $\\group{10 \\, %}$ der Fälle. Dein Test ist positiv. Wie groß ist die Wahrscheinlichkeit, dass du krank bist? Gib sie in Prozent an.",
    ),
  ),
  visual: visual(ProbabilityTree, {
    branches: [
      { node: "K", p: 0.1, kids: [{ node: "T", p: 0.9 }, { node: "~T", p: 0.1 }] },
      { node: "~K", p: 0.9, kids: [{ node: "T", p: 0.1 }, { node: "~T", p: 0.9 }] },
    ],
  }),
  math: "P_T(K)",
  answer: numAnswer(50, 0.06, PCT),
  hint: tx("Imagine $1000$ people. How many are ill and positive? How many are healthy and positive?", "Stell dir $1000$ Menschen vor. Wie viele sind krank und positiv? Wie viele gesund und positiv?"),
  solution: [
    { math: tx(`100 \\; "ill" \\quad 900 \\; "healthy"`, `100 \\; "krank" \\quad 900 \\; "gesund"`), note: tx("Of $1000$ people, $\\group{10 \\, %}$ are ill.", "Von $1000$ Menschen sind $\\group{10 \\, %}$ krank.") },
    { math: tx(`90 \\; "ill and positive" \\quad 90 \\; "healthy and positive"`, `90 \\; "krank und positiv" \\quad 90 \\; "gesund und positiv"`), note: tx("$\\group{90 \\, %}$ of $100$ and $\\group{10 \\, %}$ of $900$: both are $90$!", "$\\group{90 \\, %}$ von $100$ und $\\group{10 \\, %}$ von $900$: beides $90$!") },
    { math: "P_T(K) = \\frac{90}{90 + 90} = \\frac{1}{2} = \\group{50 \\, %}", note: tx("Half of the positive tests are false alarms.", "Die Hälfte der positiven Tests ist ein Fehlalarm.") },
  ],
  mistakes: numMistakes(
    50,
    0.06,
    [
      { v: 90, title: tx("Condition swapped", "Bedingung vertauscht"), say: tx("$\\group{90 \\, %}$ is $P_K(T)$: positive **if** ill. You need ill **if** positive. That's the classic Bayes trap!", "$\\group{90 \\, %}$ ist $P_K(T)$: positiv, **wenn** krank. Gesucht ist krank, **wenn** positiv. Die klassische Bayes-Falle!") },
      { v: 9, title: tx("Path, not conditional", "Pfad statt bedingt"), say: tx("$\\group{9 \\, %}$ is the path “ill and positive”. Divide it by all positives, $P(T)$.", "$\\group{9 \\, %}$ ist der Pfad „krank und positiv“. Teile ihn durch alle Positiven, also $P(T)$.") },
      { v: 18, title: tx("That's P(T)", "Das ist P(T)"), say: tx("$\\group{18 \\, %}$ of all people test positive. Which share of them is ill?", "$\\group{18 \\, %}$ aller Menschen sind positiv. Welcher Anteil davon ist krank?") },
      { v: 10, title: tx("Test result ignored", "Testergebnis ignoriert"), say: tx("$\\group{10 \\, %}$ is how common the illness is overall. The positive test changes that.", "$\\group{10 \\, %}$ ist, wie häufig die Krankheit insgesamt ist. Der positive Test ändert das.") },
    ],
    PCT,
  ),
};

const gameCheck: Exercise = {
  instruction: I.expect,
  text: say((f) =>
    f.t(
      `A dice game costs a stake of ${euroText(f, 2)}. You roll once: a six pays ${euroText(f, 5)}, a four or a five pays ${euroText(f, 2)}, anything else pays nothing. What profit can you expect per game?`,
      `Ein Würfelspiel kostet ${euroText(f, 2)} Einsatz. Du würfelst einmal: Eine Sechs bringt ${euroText(f, 5)}, eine Vier oder Fünf bringt ${euroText(f, 2)}, alles andere nichts. Welchen Gewinn kannst du pro Spiel erwarten?`,
    ),
  ),
  answer: numAnswer(-0.5, 0.006, EUR),
  hint: tx("Expected payout first (weight each payout), then subtract the stake.", "Erst die erwartete Auszahlung (jede Auszahlung gewichten), dann den Einsatz abziehen."),
  solution: [
    { math: tx(`E("payout") =#eq 5 \\cdot \\frac{1}{6} + 2 \\cdot \\frac{2}{6} + 0 \\cdot \\frac{3}{6}`, `E("Auszahlung") =#eq 5 \\cdot \\frac{1}{6} + 2 \\cdot \\frac{2}{6} + 0 \\cdot \\frac{3}{6}`), note: tx("Four or five: two of six numbers, so $\\frac{2}{6}$.", "Vier oder Fünf: zwei von sechs Augenzahlen, also $\\frac{2}{6}$.") },
    { math: say((f) => `${f.t(`E("payout")`, `E("Auszahlung")`)} =#eq \\frac{9}{6} =#e2 ${euro(f, 1.5)}`), note: tx("On average, the game pays out this much.", "So viel zahlt das Spiel im Mittel aus.") },
    { math: say((f) => `E(G) =#eq ${f.eur(1.5)} - 2 =#e2 ${euro(f, -0.5)}`), note: tx("Profit = payout − stake. You lose $50$ cents per game on average: not fair.", "Gewinn = Auszahlung − Einsatz. Im Mittel verlierst du $50$ Cent pro Spiel: nicht fair.") },
  ],
  mistakes: numMistakes(
    -0.5,
    0.006,
    [
      { v: 1.5, title: tx("Stake forgotten", "Einsatz vergessen"), say: tx("That's the expected payout. Profit = payout − stake.", "Das ist die erwartete Auszahlung. Gewinn = Auszahlung − Einsatz.") },
      { v: 7 / 3 - 2, title: tx("Not weighted", "Nicht gewichtet"), say: tx("You took the plain average of the payouts. But they're not equally likely: weight each with its probability.", "Du hast einfach den Mittelwert der Auszahlungen genommen. Die sind aber nicht gleich wahrscheinlich: Gewichte jede mit ihrer Wahrscheinlichkeit.") },
      { v: 7 / 6 - 2, title: tx("Four or five", "Vier oder Fünf"), say: tx("“Four or five” has two of six numbers: its probability is $\\frac{2}{6}$, not $\\frac{1}{6}$.", "„Vier oder Fünf“ sind zwei von sechs Augenzahlen: Die Wahrscheinlichkeit ist $\\frac{2}{6}$, nicht $\\frac{1}{6}$.") },
    ],
    EUR,
  ),
};

const binomCheck: Exercise = {
  instruction: I.binom,
  text: say((f) =>
    f.t(
      `A spinner shows a prize with probability $${f.n(0.2)}$. You spin it $5$ times. What is the probability of exactly $2$ prizes? Round to four decimal places.`,
      `Ein Glücksrad zeigt mit der Wahrscheinlichkeit $${f.n(0.2)}$ einen Gewinn. Du drehst $5$-mal. Wie groß ist die Wahrscheinlichkeit für genau $2$ Gewinne? Runde auf vier Nachkommastellen.`,
    ),
  ),
  answer: numAnswer(0.2048, 0.00006),
  hint: tx("$n = 5$, $p = 0.2$, $k = 2$. The number of paths is “5 choose 2”.", "$n = 5$, $p = 0,2$, $k = 2$. Die Anzahl der Pfade ist „5 über 2“."),
  solution: [
    { math: say((f) => `P(X = 2) =#eq ${choose(f, 5, 2)} \\cdot ${f.n(0.2)}^2 \\cdot ${f.n(0.8)}^3`), note: tx("Two hits, three misses.", "Zwei Treffer, drei Nieten.") },
    { math: say((f) => `P(X = 2) =#eq 10 \\cdot ${f.n(0.04)} \\cdot ${f.n(0.512)}`), note: tx("There are $10$ paths with two hits among five spins.", "Es gibt $10$ Pfade mit zwei Treffern bei fünf Drehungen.") },
    { math: say((f) => `P(X = 2) =#eq ${f.n(0.2048)}`), note: tx("About $\\group{20 \\, %}$.", "Etwa $\\group{20 \\, %}$.") },
  ],
  mistakes: numMistakes(0.2048, 0.00006, [
    { v: 0.02048, title: tx("Only one path", "Nur ein Pfad"), say: tx("That's the probability of **one** path. There are $10$ paths with two hits: multiply by the binomial coefficient.", "Das ist die Wahrscheinlichkeit für **einen** Pfad. Es gibt $10$ Pfade mit zwei Treffern: Multipliziere mit dem Binomialkoeffizienten.") },
    { v: 0.0512, title: tx("Exponents swapped", "Exponenten vertauscht"), say: tx("$p = 0.2$ belongs to the $2$ hits, $0.8$ to the $3$ misses.", "$p = 0,2$ gehört zu den $2$ Treffern, $0,8$ zu den $3$ Nieten.") },
    { v: 0.1024, title: tx("Wrong number of paths", "Falsche Anzahl der Pfade"), say: tx("You multiplied by $5$. The number of paths is “5 choose 2” $= 10$.", "Du hast mit $5$ multipliziert. Die Anzahl der Pfade ist „5 über 2“ $= 10$.") },
  ]),
};

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Two-way tables and conditional probability", "Vierfeldertafel und bedingte Wahrscheinlichkeit"),
      blob: tx("Two features at once? Put them in a table!", "Zwei Merkmale auf einmal? Ab in die Tafel!"),
      body: tx(
        "A survey of $200$ students asks about two features at once: $A$ and $B$. The **two-way table** (Vierfeldertafel) has an inner field for each combination and the totals at the edge. $\\frac{}{A}$ (with a bar) means “not $A$”.",
        "Eine Umfrage unter $200$ Jugendlichen fragt zwei Merkmale gleichzeitig ab: $A$ und $B$. Die **Vierfeldertafel** hat für jede Kombination ein inneres Feld und am Rand die Summen. $\\frac{}{A}$ (mit Strich) heißt „nicht $A$“.",
      ),
      visual: visual(ProbabilityFourField, { cells: tableCells(SCHOOL), legend: schoolLegend }),
      frames: tableFrames,
    },
    { type: "check", blob: tx("Now the condition is B. Which column?", "Jetzt ist B die Bedingung. Welche Spalte?"), exercise: tableCheck },
    {
      type: "explain",
      title: tx("Turning the tree around: the medical test", "Den Baum umkehren: der medizinische Test"),
      blob: tx("A positive test means you're ill? Not so fast!", "Test positiv, also krank? Nicht so schnell!"),
      body: say((f) =>
        f.t(
          `$\\group{2 \\, %}$ of people have an illness ($K$). The test is positive ($T$) for $\\group{90 \\, %}$ of the ill and, by mistake, for $\\group{5 \\, %}$ of the healthy. The tree starts with “ill or healthy”. But the question goes the other way: how likely are you ill **if** your test is positive?`,
          `$\\group{2 \\, %}$ der Menschen haben eine Krankheit ($K$). Der Test ist bei $\\group{90 \\, %}$ der Kranken positiv ($T$), bei Gesunden fälschlich in $\\group{5 \\, %}$ der Fälle. Der Baum beginnt mit „krank oder gesund“. Die Frage geht aber umgekehrt: Wie wahrscheinlich bist du krank, **wenn** dein Test positiv ist?`,
        ),
      ),
      visual: visual(ProbabilityTree, {
        branches: [
          { node: "K", p: 0.02, kids: [{ node: "T", p: 0.9 }, { node: "~T", p: 0.1 }] },
          { node: "~K", p: 0.98, kids: [{ node: "T", p: 0.05 }, { node: "~T", p: 0.95 }] },
        ],
        hl: [0, 2],
        ends: [0.018, null, 0.049, null],
      }),
      frames: bayesFrames,
    },
    {
      type: "widget",
      title: tx("The test, fact-checked with 1000 people", "Der Test im Faktencheck: 1000 Menschen"),
      blob: tx("Make the illness rare and watch the purple dots!", "Mach die Krankheit selten und schau auf die lila Punkte!"),
      body: tx(
        "Set how common the illness is and how good the test is. Blob shows $1000$ people as dots, with the two-way table next to it. How many of the positive tests are really ill? Try a rare illness ($\\group{1 \\, %}$) with a good test ($\\group{95 \\, %}$).",
        "Stell ein, wie häufig die Krankheit ist und wie gut der Test ist. Blob zeigt $1000$ Menschen als Punkte, daneben die Vierfeldertafel. Wie viele der positiv Getesteten sind wirklich krank? Probier eine seltene Krankheit ($\\group{1 \\, %}$) mit einem guten Test ($\\group{95 \\, %}$).",
      ),
      widget: ProbabilityBayesLab,
    },
    { type: "check", blob: tx("Natural frequencies make it easy. Imagine 1000 people!", "Mit natürlichen Häufigkeiten wird's leicht. Stell dir 1000 Menschen vor!"), exercise: bayesCheck },
    {
      type: "explain",
      title: tx("Independence", "Stochastische Unabhängigkeit"),
      blob: tx("Does one event care about the other?", "Kümmert sich ein Ereignis um das andere?"),
      body: tx(
        "Two events are **independent** if one doesn't change the probability of the other: $P_A(B) = P(B)$. That's the same as $P(A ∩ B) = P(A) \\cdot P(B)$. Back to the survey: $P(A) = 0.4$, $P(B) = 0.45$.",
        "Zwei Ereignisse heißen **stochastisch unabhängig**, wenn das eine die Wahrscheinlichkeit des anderen nicht ändert: $P_A(B) = P(B)$. Das ist gleichbedeutend mit $P(A ∩ B) = P(A) \\cdot P(B)$. Zurück zur Umfrage: $P(A) = 0,4$, $P(B) = 0,45$.",
      ),
      frames: indepFrames,
    },
    {
      type: "explain",
      title: tx("Expected value and fair games", "Erwartungswert und faires Spiel"),
      blob: tx("Who wins in the long run: you or the bank?", "Wer gewinnt auf Dauer: du oder die Bank?"),
      body: say((f) =>
        f.t(
          `One spin costs a stake of ${euroText(f, 2)}. The random variable $X$ is the payout. The **expected value** $E(X)$ is what you get per game on average in the long run: each value is weighted with its probability.`,
          `Eine Drehung kostet ${euroText(f, 2)} Einsatz. Die Zufallsgröße $X$ ist die Auszahlung. Der **Erwartungswert** $E(X)$ ist das, was du auf lange Sicht im Mittel pro Spiel bekommst: Jeder Wert wird mit seiner Wahrscheinlichkeit gewichtet.`,
        ),
      ),
      visual: visual(ProbabilitySpinner, {
        sectors: [
          { w: 180, color: "none", label: tx("€0", "0 €") },
          { w: 120, color: "purple", label: tx("€3", "3 €") },
          { w: 60, color: "green", label: tx("€6", "6 €") },
        ],
      }),
      frames: expectFrames,
    },
    { type: "check", blob: tx("Weight each payout, then think of the stake.", "Jede Auszahlung gewichten, dann an den Einsatz denken."), exercise: gameCheck },
    {
      type: "explain",
      title: tx("Bernoulli chains and the binomial distribution", "Bernoulli-Ketten und die Binomialverteilung"),
      blob: tx("Hit or miss, over and over: that's a Bernoulli chain!", "Treffer oder Niete, immer wieder: Das ist eine Bernoulli-Kette!"),
      body: tx(
        "An experiment with just two outcomes, **hit** ($1$, probability $p$) or **miss** ($0$, probability $1 - p$), is a **Bernoulli experiment**. Repeat it $n$ times independently and you get a **Bernoulli chain** of length $n$. The random variable $X$ counts the hits. Here: $n = 3$, $p = 0.2$.",
        "Ein Experiment mit nur zwei Ausgängen, **Treffer** ($1$, Wahrscheinlichkeit $p$) oder **Niete** ($0$, Wahrscheinlichkeit $1 - p$), heißt **Bernoulli-Experiment**. Wiederholst du es $n$-mal unabhängig, entsteht eine **Bernoulli-Kette** der Länge $n$. Die Zufallsgröße $X$ zählt die Treffer. Hier: $n = 3$, $p = 0,2$.",
      ),
      visual: visual(ProbabilityPaths, { n: 3, k: 2, p: 0.2 }),
      frames: binomFrames,
    },
    {
      type: "widget",
      title: tx("Explore the binomial distribution", "Die Binomialverteilung erkunden"),
      blob: tx("Push n up and watch the bars line up around μ!", "Dreh n hoch und schau, wie sich die Säulen um μ sammeln!"),
      body: tx(
        "Choose the number of trials $n$ and the hit probability $p$. The histogram shows $P(X = k)$ for every $k$. Tap a bar to see the Bernoulli formula with its numbers, or switch to “at most” and “at least”.",
        "Wähle die Anzahl der Versuche $n$ und die Trefferwahrscheinlichkeit $p$. Das Histogramm zeigt $P(X = k)$ für jedes $k$. Tippe auf eine Säule, um die Bernoulli-Formel mit Zahlen zu sehen, oder wechsle zu „höchstens“ und „mindestens“.",
      ),
      widget: ProbabilityBinomialLab,
    },
    { type: "check", blob: tx("Last one: paths times path probability!", "Die letzte: Pfade mal Pfadwahrscheinlichkeit!"), exercise: binomCheck },
  ],
  summary: [
    {
      title: tx("Conditional probability", "Bedingte Wahrscheinlichkeit"),
      body: tx("$P_A(B)$: probability of $B$ if $A$ has happened. In the two-way table: inner field divided by the total of the condition.", "$P_A(B)$: Wahrscheinlichkeit von $B$ unter der Bedingung $A$. In der Vierfeldertafel: inneres Feld geteilt durch die Summe der Bedingung."),
      examples: ["P_A(B) = \\frac{P(A ∩ B)}{P(A)}", say((f) => `P_A(B) = \\frac{60}{80} = ${f.n(0.75)}`)],
      tone: "rule",
    },
    {
      title: tx("Bayes: turning the tree around", "Bayes: den Baum umkehren"),
      body: tx("The path you want divided by **all** paths that fit the condition. Natural frequencies (imagine 1000 people) make it easy.", "Der gesuchte Pfad geteilt durch **alle** Pfade, die zur Bedingung passen. Mit natürlichen Häufigkeiten (stell dir 1000 Menschen vor) geht's leicht."),
      examples: ["P_T(K) = \\frac{P(K) \\cdot P_K(T)}{P(T)}"],
      tone: "rule",
    },
    {
      title: tx("Independence", "Unabhängigkeit"),
      body: tx("Independent: the condition changes nothing. Check with the product rule.", "Unabhängig: Die Bedingung ändert nichts. Prüfen mit der Produktregel."),
      examples: ["P(A ∩ B) = P(A) \\cdot P(B)", "P_A(B) = P(B)"],
      tone: "rule",
    },
    {
      title: tx("Expected value", "Erwartungswert"),
      body: tx("Each value times its probability, all added up. A game is fair if the expected profit is $0$.", "Jeder Wert mal seine Wahrscheinlichkeit, alles addiert. Ein Spiel ist fair, wenn der erwartete Gewinn $0$ ist."),
      examples: ["E(X) = x_1 \\cdot P(X = x_1) + … + x_n \\cdot P(X = x_n)"],
      tone: "rule",
    },
    {
      title: tx("Binomial distribution", "Binomialverteilung"),
      body: tx("$n$ independent trials, hit probability $p$, $X$ counts the hits. The binomial coefficient “n choose k” (nCr) counts the paths.", "$n$ unabhängige Versuche, Trefferwahrscheinlichkeit $p$, $X$ zählt die Treffer. Der Binomialkoeffizient „n über k“ (nCr) zählt die Pfade."),
      examples: [
        tx(`P(X = k) = ("n choose k") \\cdot p^k \\cdot (1 - p)^{n - k}`, `P(X = k) = ("n über k") \\cdot p^k \\cdot (1 - p)^{n - k}`),
        say((f) => `P(X = 2) = 10 \\cdot ${f.n(0.2)}^2 \\cdot ${f.n(0.8)}^3 = ${f.n(0.2048)}`),
        "E(X) = n \\cdot p",
      ],
      tone: "rule",
    },
    {
      title: tx("The Bayes trap", "Die Bayes-Falle"),
      body: tx("Don't swap the condition: “positive if ill” is not “ill if positive”.", "Vertausch nicht die Bedingung: „positiv, wenn krank“ ist nicht „krank, wenn positiv“."),
      examples: ["P_T(K) \\ne P_K(T)"],
      tone: "warning",
    },
  ],
};
