"use client";

// Level 2 (Klasse 7–8): the compound rule of three, scale and maps, averages, and
// comparing tariffs with a break-even point.

import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { clean, D, E, fixedChoice, lcm, mb, mistakesFor, NAMES, numAns, txs, weighted, type Say } from "./kit";
import { MapScale } from "./MapScale";
import { MeanLevel } from "./MeanLevel";
import { TariffLab } from "./TariffLab";

type Tpl = (rng: Rng) => Exercise;

// ---------------------------------------------------------------------------
// The compound rule of three (zusammengesetzter Dreisatz): change one quantity at a
// time, always via the unit (1 pump, 1 tank). Each frame shows the current row with the
// next operation written right next to the numbers it changes.

/** `dat`: German dative plural ("bei den Arbeitern"); `the`: with article ("die Fläche"), `sing`: German singular verb. */
type Qty = { name: Text; one: Text; many: Text; few: "fewer" | "less"; dat?: string; the?: Text; sing?: boolean };
type Compound = {
  inverse: boolean;
  p: Qty;
  q: Qty & { base: number };
  r: { what: Text; unit: Text };
  P1: number;
  Q1: number;
  R1: number;
  P2: number;
  Q2: number;
  given: Text;
  answer: Text;
};
type State = { P: number; Q: number; R: number };
type Op = { sym: ":" | "\\cdot"; n: number };
type Move = { which: "p" | "q"; op: Op; rOp: Op };

const opOf = (from: number, to: number): Op => (to < from ? { sym: ":", n: clean(from / to) } : { sym: "\\cdot", n: clean(to / from) });
const flip = (o: Op): Op => ({ sym: o.sym === ":" ? "\\cdot" : ":", n: o.n });
const apply = (v: number, o: Op) => clean(o.sym === ":" ? v / o.n : v * o.n, 6);

/** The path via the unit: P → 1, Q → base, Q → Q2, P → P2 (steps that change nothing are skipped). */
function compoundPath(c: Compound): { states: State[]; moves: Move[] } {
  const states: State[] = [{ P: c.P1, Q: c.Q1, R: c.R1 }];
  const moves: Move[] = [];
  const go = (which: "p" | "q", to: number) => {
    const s = states[states.length - 1];
    const from = which === "p" ? s.P : s.Q;
    if (from === to) return;
    const op = opOf(from, to);
    const rOp = which === "p" && c.inverse ? flip(op) : op;
    moves.push({ which, op, rOp });
    states.push({ P: which === "p" ? to : s.P, Q: which === "q" ? to : s.Q, R: apply(s.R, rOp) });
  };
  go("p", 1);
  go("q", c.q.base);
  go("q", c.Q2);
  go("p", c.P2);
  return { states, moves };
}

function compoundFrames(c: Compound): Frame[] {
  const { states, moves } = compoundPath(c);
  const row = (st: State, mv: Move | null, i: number) =>
    mb((s) => {
      const val = (v: number, key: string, op: Op | null) => (op ? `\\blob{${s.m(v, key)} ${op.sym}#${key}o${i} ${s.m(op.n, `${key}n${i}`)}}` : s.m(v, key));
      const pw = s.t(st.P === 1 ? c.p.one : c.p.many);
      const qw = s.t(st.Q === 1 ? c.q.one : c.q.many);
      return `${val(st.P, "p", mv?.which === "p" ? mv.op : null)} "${pw}"#up \\quad ${val(st.Q, "q", mv?.which === "q" ? mv.op : null)} "${qw}"#uq \\to#ar ${val(st.R, "r", mv ? mv.rOp : null)} "${s.t(c.r.unit)}"#ur`;
    });
  const note = (mv: Move, st: State): Text => {
    const qty = mv.which === "p" ? c.p : c.q;
    const from = mv.which === "p" ? st.P : st.Q;
    const to = apply(from, mv.op);
    const up = mv.op.sym === "\\cdot";
    const same = mv.which === "q" || !c.inverse;
    const sym = (o: Op, l: "en" | "de") => `${o.sym === ":" ? ":" : "·"} ${l === "de" ? String(o.n).replace(".", ",") : o.n}`;
    return txs(
      (s) =>
        `**${s.t(qty.name).replace(/^./, (x) => x.toUpperCase())}:** ${s.n(from)} → ${s.n(to)}. ${up ? "More" : qty.few === "fewer" ? "Fewer" : "Less"} ${s.t(qty.name)}, ${up === same ? "more" : "less"} ${s.t(c.r.what)} (${same ? "proportional" : "inverse"}): on the right ${same ? "the same" : "the opposite"}, so ${sym(mv.rOp, "en")}.`,
      (s) =>
        `**${s.t(qty.name)}:** ${s.n(from)} → ${s.n(to)}. ${up ? "Mehr" : "Weniger"} ${s.t(qty.name)}, ${up === same ? "mehr" : "weniger"} ${s.t(c.r.what)} (${same ? "proportional" : "antiproportional"}): rechts ${same ? "genauso" : "umgekehrt"}, also ${sym(mv.rOp, "de")}.`,
    );
  };
  const frames: Frame[] = [
    {
      math: row(states[0], null, 0),
      note: txs(
        (s) => `${s.t(c.given)} Change **one** quantity at a time and go via the unit.`,
        (s) => `${s.t(c.given)} Ändere immer nur **eine** Größe und rechne über die Einheit.`,
      ),
    },
  ];
  moves.forEach((mv, i) => frames.push({ math: row(states[i], mv, i + 1), note: note(mv, states[i]) }));
  frames.push({ math: row(states[states.length - 1], null, 99), highlight: ["r", "ur"], note: txs((s) => `**Answer:** ${s.t(c.answer)}`, (s) => `**Antwort:** ${s.t(c.answer)}`) });
  return frames;
}

function compoundMistakes(c: Compound, right: number, unit: Text): Mistake[] {
  const { states } = compoundPath(c);
  const unitState = states.find((s) => s.P === 1 && s.Q === c.q.base);
  const fP = c.inverse ? c.P1 / c.P2 : c.P2 / c.P1;
  const fQ = c.Q2 / c.Q1;
  const m = mistakesFor(numAns(right, unit));
  const pDat = c.p.dat ?? D(c.p.name);
  const qThe = c.q.the ?? tx(`the ${E(c.q.name)}`, `die ${D(c.q.name)}`);
  if (c.inverse) {
    m.add(
      c.R1 * (c.P2 / c.P1) * fQ,
      tx("Inverse treated as proportional", "Antiproportional wie proportional gerechnet"),
      txs(
        (s) => `I think you did the same on both sides for the ${s.t(c.p.name)}. But more ${s.t(c.p.name)} need **less** time: on the right you do the opposite.`,
        (s) => `Ich glaub, bei den ${pDat} hast du auf beiden Seiten gleich gerechnet. Mehr ${s.t(c.p.name)} brauchen aber **weniger** Zeit: Rechts rechnest du umgekehrt.`,
      ),
    );
  } else {
    m.add(
      c.R1 * (c.P1 / c.P2) * fQ,
      tx("Proportional treated as inverse", "Proportional wie antiproportional gerechnet"),
      txs(
        (s) => `Hmm, you did the opposite on the right for the ${s.t(c.p.name)}. But more ${s.t(c.p.name)} give **more** ${s.t(c.r.what)}: do the same on both sides.`,
        (s) => `Hm, bei den ${pDat} hast du rechts umgekehrt gerechnet. Mehr ${s.t(c.p.name)} ergeben aber **mehr** ${s.t(c.r.what)}: Rechne auf beiden Seiten gleich.`,
      ),
    );
  }
  m.add(
    c.R1 * fP,
    tx("Only one quantity changed", "Nur eine Größe geändert"),
    txs(
      (s) => `Nearly! You took care of the ${s.t(c.p.name)}, but ${s.t(qThe)} changed too: from ${s.n(c.Q1)} to ${s.n(c.Q2)}.`,
      (s) => `Fast! Die ${s.t(c.p.name)} hast du berücksichtigt, aber auch ${s.t(qThe)} ${c.q.sing ? "ändert" : "ändern"} sich: von ${s.n(c.Q1)} auf ${s.n(c.Q2)}.`,
    ),
  );
  m.add(
    c.R1 * fQ,
    tx("Only one quantity changed", "Nur eine Größe geändert"),
    txs(
      (s) => `Nearly! You took care of ${s.t(qThe)}, but the number of ${s.t(c.p.name)} changed too: from ${c.P1} to ${c.P2}.`,
      (s) => `Fast! ${s.t(qThe).replace(/^./, (x) => x.toUpperCase())} hast du berücksichtigt, aber auch die Zahl der ${s.t(c.p.name)} ändert sich: von ${c.P1} auf ${c.P2}.`,
    ),
  );
  if (unitState)
    m.add(
      unitState.R,
      tx("Stopped at the unit", "Bei der Einheit stehen geblieben"),
      txs(
        (s) => `Good, that's the value for **1** ${s.t(c.p.one)} and ${s.n(c.q.base)} ${s.t(c.q.one)}: ${s.n(unitState.R)} ${s.t(c.r.unit)}. Now go on to ${c.P2} ${s.t(c.p.many)} and ${s.n(c.Q2)} ${s.t(c.q.many)}.`,
        (s) => `Gut, das ist der Wert für **1** ${s.t(c.p.one)} und ${s.n(c.q.base)} ${s.t(c.q.one)}: ${s.n(unitState.R)} ${s.t(c.r.unit)}. Jetzt rechne weiter auf ${c.P2} ${s.t(c.p.many)} und ${s.n(c.Q2)} ${s.t(c.q.many)}.`,
      ),
    );
  return m.list;
}

type CompoundCase = {
  inverse: boolean;
  p: Qty;
  q: Qty & { base: number };
  r: { what: Text; unit: Text };
  P: [number, number];
  Q1: number[];
  Q2: number[];
  k: number[];
  rMax: number;
  story: (v: { P1: number; Q1: number; R1: number; P2: number; Q2: number }) => Text;
  given: (v: { P1: number; Q1: number; R1: number; P2: number; Q2: number }) => Text;
  answer: (v: { P2: number; Q2: number; R2: number }) => Text;
};

const PUMPS: Qty = { name: tx("pumps", "Pumpen"), one: tx("pump", "Pumpe"), many: tx("pumps", "Pumpen"), few: "fewer", dat: "Pumpen" };
const TANKS = { name: tx("tanks", "Becken"), one: tx("tank", "Becken"), many: tx("tanks", "Becken"), few: "fewer" as const, base: 1, the: tx("the number of tanks", "die Zahl der Becken"), sing: true };
const TIME = { what: tx("time", "Zeit"), unit: "h" };

const COMPOUND: CompoundCase[] = [
  {
    inverse: true,
    p: PUMPS,
    q: TANKS,
    r: TIME,
    P: [2, 6],
    Q1: [1, 2, 3],
    Q2: [2, 3, 4, 5],
    k: [1, 2, 3, 4],
    rMax: 60,
    story: ({ P1, Q1, R1, P2, Q2 }) =>
      tx(
        `${P1} pumps fill ${Q1 === 1 ? "one water tank" : `${Q1} water tanks`} in ${R1} hours. How many hours do ${P2} pumps need for ${Q2} tanks of the same size?`,
        `${P1} Pumpen füllen ${Q1 === 1 ? "ein Wasserbecken" : `${Q1} Wasserbecken`} in ${R1} Stunden. Wie viele Stunden brauchen ${P2} Pumpen für ${Q2} gleich große Becken?`,
      ),
    given: ({ P1, Q1, R1, P2, Q2 }) => tx(`**Given:** ${P1} pumps, ${Q1} tank${Q1 === 1 ? "" : "s"}: ${R1} h. **Wanted:** the time for ${P2} pumps and ${Q2} tanks.`, `**Gegeben:** ${P1} Pumpen, ${Q1} Becken: ${R1} h. **Gesucht:** die Zeit für ${P2} Pumpen und ${Q2} Becken.`),
    answer: ({ P2, Q2, R2 }) => txs((s) => `${P2} pumps need ${s.n(R2)} hours for ${Q2} tanks.`, (s) => `${P2} Pumpen brauchen für ${Q2} Becken ${s.n(R2)} Stunden.`),
  },
  {
    inverse: false,
    p: { name: tx("machines", "Maschinen"), one: tx("machine", "Maschine"), many: tx("machines", "Maschinen"), few: "fewer", dat: "Maschinen" },
    q: { name: tx("hours", "Stunden"), one: "h", many: "h", few: "fewer", base: 1, the: tx("the time", "die Zeit"), sing: true },
    r: { what: tx("parts", "Teile"), unit: tx("parts", "Teile") },
    P: [2, 8],
    Q1: [2, 3, 4, 5, 6],
    Q2: [3, 4, 5, 6, 7, 8],
    k: [5, 6, 8, 10, 12, 15, 20, 25],
    rMax: 2000,
    story: ({ P1, Q1, R1, P2, Q2 }) =>
      tx(
        `${P1} machines make ${R1} parts in ${Q1} hours. How many parts do ${P2} machines make in ${Q2} hours?`,
        `${P1} Maschinen stellen in ${Q1} Stunden ${R1} Teile her. Wie viele Teile stellen ${P2} Maschinen in ${Q2} Stunden her?`,
      ),
    given: ({ P1, Q1, R1, P2, Q2 }) => tx(`**Given:** ${P1} machines, ${Q1} h: ${R1} parts. **Wanted:** the parts from ${P2} machines in ${Q2} h.`, `**Gegeben:** ${P1} Maschinen, ${Q1} h: ${R1} Teile. **Gesucht:** die Teile von ${P2} Maschinen in ${Q2} h.`),
    answer: ({ P2, Q2, R2 }) => txs((s) => `${P2} machines make ${s.n(R2)} parts in ${Q2} hours.`, (s) => `${P2} Maschinen stellen in ${Q2} Stunden ${s.n(R2)} Teile her.`),
  },
  {
    inverse: true,
    p: { name: tx("workers", "Arbeiter"), one: tx("worker", "Arbeiter"), many: tx("workers", "Arbeiter"), few: "fewer", dat: "Arbeitern" },
    q: { name: tx("area", "Fläche"), one: "m²", many: "m²", few: "less", base: 100, the: tx("the area", "die Fläche"), sing: true },
    r: { what: tx("time", "Zeit"), unit: tx("days", "Tage") },
    P: [2, 8],
    Q1: [200, 300, 400, 500, 600],
    Q2: [200, 300, 400, 500, 600, 800],
    k: [1, 2],
    rMax: 40,
    story: ({ P1, Q1, R1, P2, Q2 }) =>
      tx(
        `${P1} workers pave ${Q1} m² of a schoolyard in ${R1} days. How many days do ${P2} workers need for ${Q2} m²?`,
        `${P1} Arbeiter pflastern ${Q1} m² Schulhof in ${R1} Tagen. Wie viele Tage brauchen ${P2} Arbeiter für ${Q2} m²?`,
      ),
    given: ({ P1, Q1, R1, P2, Q2 }) => tx(`**Given:** ${P1} workers, ${Q1} m²: ${R1} days. **Wanted:** the days for ${P2} workers and ${Q2} m².`, `**Gegeben:** ${P1} Arbeiter, ${Q1} m²: ${R1} Tage. **Gesucht:** die Tage für ${P2} Arbeiter und ${Q2} m².`),
    answer: ({ P2, Q2, R2 }) => txs((s) => `${P2} workers need ${s.n(R2)} days for ${Q2} m².`, (s) => `${P2} Arbeiter brauchen für ${Q2} m² ${s.n(R2)} Tage.`),
  },
  {
    inverse: false,
    p: { name: tx("cows", "Kühe"), one: tx("cow", "Kuh"), many: tx("cows", "Kühe"), few: "fewer", dat: "Kühen" },
    q: { name: tx("days", "Tage"), one: tx("day", "Tag"), many: tx("days", "Tage"), few: "fewer", base: 1, the: tx("the number of days", "die Zahl der Tage"), sing: true },
    r: { what: tx("hay", "Heu"), unit: "kg" },
    P: [3, 12],
    Q1: [2, 3, 4, 5, 6],
    Q2: [3, 4, 5, 7, 8, 10],
    k: [8, 10, 12, 15],
    rMax: 2000,
    story: ({ P1, Q1, R1, P2, Q2 }) =>
      tx(`${P1} cows eat ${R1} kg of hay in ${Q1} days. How much hay do ${P2} cows eat in ${Q2} days?`, `${P1} Kühe fressen in ${Q1} Tagen ${R1} kg Heu. Wie viel Heu fressen ${P2} Kühe in ${Q2} Tagen?`),
    given: ({ P1, Q1, R1, P2, Q2 }) => tx(`**Given:** ${P1} cows, ${Q1} days: ${R1} kg. **Wanted:** the hay for ${P2} cows and ${Q2} days.`, `**Gegeben:** ${P1} Kühe, ${Q1} Tage: ${R1} kg. **Gesucht:** das Heu für ${P2} Kühe und ${Q2} Tage.`),
    answer: ({ P2, Q2, R2 }) => txs((s) => `${P2} cows eat ${s.n(R2)} kg of hay in ${Q2} days.`, (s) => `${P2} Kühe fressen in ${Q2} Tagen ${s.n(R2)} kg Heu.`),
  },
  {
    inverse: true,
    p: { name: tx("printers", "Drucker"), one: tx("printer", "Drucker"), many: tx("printers", "Drucker"), few: "fewer", dat: "Druckern" },
    q: { name: tx("pages", "Seiten"), one: tx("pages", "Seiten"), many: tx("pages", "Seiten"), few: "fewer", base: 100, the: tx("the number of pages", "die Seitenzahl"), sing: true },
    r: { what: tx("time", "Zeit"), unit: "min" },
    P: [2, 6],
    Q1: [200, 300, 400, 500, 600],
    Q2: [200, 300, 400, 600, 800, 1000],
    k: [1, 2],
    rMax: 60,
    story: ({ P1, Q1, R1, P2, Q2 }) =>
      tx(
        `${P1} printers print ${Q1} pages of the school newspaper in ${R1} minutes. How many minutes do ${P2} printers need for ${Q2} pages?`,
        `${P1} Drucker drucken ${Q1} Seiten der Schülerzeitung in ${R1} Minuten. Wie viele Minuten brauchen ${P2} Drucker für ${Q2} Seiten?`,
      ),
    given: ({ P1, Q1, R1, P2, Q2 }) => tx(`**Given:** ${P1} printers, ${Q1} pages: ${R1} min. **Wanted:** the time for ${P2} printers and ${Q2} pages.`, `**Gegeben:** ${P1} Drucker, ${Q1} Seiten: ${R1} min. **Gesucht:** die Zeit für ${P2} Drucker und ${Q2} Seiten.`),
    answer: ({ P2, Q2, R2 }) => txs((s) => `${P2} printers need ${s.n(R2)} minutes for ${Q2} pages.`, (s) => `${P2} Drucker brauchen für ${Q2} Seiten ${s.n(R2)} Minuten.`),
  },
  {
    inverse: false,
    p: { name: tx("people", "Personen"), one: tx("person", "Person"), many: tx("people", "Personen"), few: "fewer", dat: "Personen" },
    q: { name: tx("days", "Tage"), one: tx("day", "Tag"), many: tx("days", "Tage"), few: "fewer", base: 1, the: tx("the number of days", "die Zahl der Tage"), sing: true },
    r: { what: tx("water", "Wasser"), unit: "l" },
    P: [2, 8],
    Q1: [2, 3, 4],
    Q2: [3, 5, 6, 7],
    k: [2, 3, 4],
    rMax: 300,
    story: ({ P1, Q1, R1, P2, Q2 }) =>
      tx(
        `On a hiking trip, ${P1} people drink ${R1} litres of water in ${Q1} days. How many litres do ${P2} people drink in ${Q2} days?`,
        `Auf einer Wandertour trinken ${P1} Personen in ${Q1} Tagen ${R1} Liter Wasser. Wie viele Liter trinken ${P2} Personen in ${Q2} Tagen?`,
      ),
    given: ({ P1, Q1, R1, P2, Q2 }) => tx(`**Given:** ${P1} people, ${Q1} days: ${R1} l. **Wanted:** the water for ${P2} people and ${Q2} days.`, `**Gegeben:** ${P1} Personen, ${Q1} Tage: ${R1} l. **Gesucht:** das Wasser für ${P2} Personen und ${Q2} Tage.`),
    answer: ({ P2, Q2, R2 }) => txs((s) => `${P2} people drink ${s.n(R2)} litres in ${Q2} days.`, (s) => `${P2} Personen trinken in ${Q2} Tagen ${s.n(R2)} Liter.`),
  },
];

const COMPOUND_INSTR = tx("Use the compound rule of three", "Löse mit dem zusammengesetzten Dreisatz");
const COMPOUND_HINT = tx(
  "Change one quantity at a time, via the unit. For each change ask: the more, the more (same operation) or the more, the less (opposite)?",
  "Ändere immer nur eine Größe, über die Einheit. Frag bei jeder Änderung: je mehr, desto mehr (gleich rechnen) oder je mehr, desto weniger (umgekehrt)?",
);

function compoundExercise(cc: CompoundCase, P1: number, Q1: number, P2: number, Q2: number, k: number): Exercise {
  const u = cc.q.base;
  const R1 = clean(cc.inverse ? (k * (Q1 / u)) / P1 : k * P1 * (Q1 / u));
  const R2 = clean(cc.inverse ? (k * (Q2 / u)) / P2 : k * P2 * (Q2 / u));
  const v = { P1, Q1, R1, P2, Q2 };
  const c: Compound = { inverse: cc.inverse, p: cc.p, q: cc.q, r: cc.r, P1, Q1, R1, P2, Q2, given: cc.given(v), answer: cc.answer({ P2, Q2, R2 }) };
  return {
    instruction: COMPOUND_INSTR,
    text: cc.story(v),
    answer: numAns(R2, cc.r.unit),
    mistakes: compoundMistakes(c, R2, cc.r.unit),
    hint: COMPOUND_HINT,
    solution: compoundFrames(c),
  };
}

const compound: Tpl = (rng) => {
  for (let tries = 0; tries < 40; tries++) {
    const cc = rng.pick(COMPOUND);
    const P1 = rng.int(cc.P[0], cc.P[1]);
    const P2 = rng.int(cc.P[0], cc.P[1]);
    const Q1 = rng.pick(cc.Q1);
    const Q2 = rng.pick(cc.Q2);
    if (P1 === P2 || Q1 === Q2) continue;
    const k = cc.inverse ? rng.pick(cc.k) * lcm(P1, P2) : rng.pick(cc.k);
    const u = cc.q.base;
    const R1 = cc.inverse ? (k * (Q1 / u)) / P1 : k * P1 * (Q1 / u);
    const R2 = cc.inverse ? (k * (Q2 / u)) / P2 : k * P2 * (Q2 / u);
    if (R1 > cc.rMax || R2 > cc.rMax || R1 === R2) continue;
    return compoundExercise(cc, P1, Q1, P2, Q2, k);
  }
  return compoundExercise(COMPOUND[0], 4, 1, 3, 2, 24);
};

// ---------------------------------------------------------------------------
// Scale (Maßstab)

const SCALE_INSTR = tx("Work with the scale", "Rechne mit dem Maßstab");

/** "1 : 25 000" in prose, both languages (thin no-break space between groups). */
const scaleProse = (n: number) => `1 : ${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;

/** `map`: "a hiking map" / "einer Wanderkarte" (dative after "auf"). */
const ROUTES: { en: string; de: string; map: Text }[] = [
  { en: "the path from the campsite to the lake", de: "der Weg vom Campingplatz zum See", map: tx("a hiking map", "einer Wanderkarte") },
  { en: "the path from the hut to the summit", de: "der Weg von der Hütte zum Gipfel", map: tx("a hiking map", "einer Wanderkarte") },
  { en: "the way from the station to the castle", de: "der Weg vom Bahnhof zur Burg", map: tx("a town map", "einem Stadtplan") },
  { en: "the way from the school to the swimming pool", de: "der Weg von der Schule zum Freibad", map: tx("a town map", "einem Stadtplan") },
  { en: "the cycle path along the river", de: "der Radweg am Fluss entlang", map: tx("a cycling map", "einer Radkarte") },
];

const CM_PER = { m: 100, km: 100000 } as const;

const mapToReal: Tpl = (rng) => {
  const n = rng.pick([10000, 20000, 25000, 50000, 100000]);
  const route = rng.pick(ROUTES);
  const d = rng.pick([2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 2.4, 3.6, 4.8, 6.4, 7.2]);
  const cm = clean(d * n);
  const m = cm / 100;
  const unit: "m" | "km" = m >= 1000 && m % 10 === 0 ? "km" : "m";
  const right = clean(cm / CM_PER[unit], 4);
  const answer = numAns(right, unit);
  const mk = mistakesFor(answer);
  mk.add(cm, tx("Still in centimetres", "Noch in Zentimetern"), txs((s) => `${s.n(cm)} is right, but in **cm**! Now convert into ${unit}: ${unit === "km" ? "100 000 cm = 1 km" : "100 cm = 1 m"}.`, (s) => `${s.n(cm)} stimmt, aber in **cm**! Jetzt noch in ${unit} umrechnen: ${unit === "km" ? "100.000 cm = 1 km" : "100 cm = 1 m"}.`));
  if (unit === "km") {
    mk.add(m, tx("Metres, not kilometres", "Meter statt Kilometer"), txs((s) => `${s.n(m)} is the distance in **metres**. The question asks for km: divide by 1000.`, (s) => `${s.n(m)} ist die Strecke in **Metern**. Gefragt ist in km: noch durch 1000 teilen.`));
    mk.add(cm / 1000, tx("1 km isn't 1000 cm", "1 km sind nicht 1000 cm"), txs(() => `Careful: 1 km = 1000 m = **100 000 cm**. You divided the centimetres by 1000 only.`, () => `Vorsicht: 1 km = 1000 m = **100.000 cm**. Du hast die Zentimeter nur durch 1000 geteilt.`));
  } else {
    mk.add(cm / 1000, tx("1 m isn't 1000 cm", "1 m sind nicht 1000 cm"), txs(() => `Careful: 1 m = **100 cm**, not 1000 cm.`, () => `Vorsicht: 1 m = **100 cm**, nicht 1000 cm.`));
    mk.add(m / 1000, tx("Kilometres, not metres", "Kilometer statt Meter"), txs((s) => `That's the distance in km. The question asks for metres: ${s.n(m / 1000, 3)} km = ${s.n(m)} m.`, () => `Das ist die Strecke in km. Gefragt ist in Metern.`));
  }
  return {
    instruction: SCALE_INSTR,
    text: txs(
      (s) => `On ${s.t(route.map)} with the scale ${scaleProse(n)}, ${route.en} is ${s.n(d)} cm long. How long is it in reality? Give the answer in ${unit}.`,
      (s) => `Auf ${s.t(route.map)} im Maßstab ${scaleProse(n)} ist ${route.de} ${s.n(d)} cm lang. Wie lang ist er in Wirklichkeit? Gib das Ergebnis in ${unit} an.`,
    ),
    answer,
    mistakes: mk.list,
    hint: txs((s) => `1 cm on the map is ${s.n(n)} cm in reality. Multiply, then convert into ${unit}.`, (s) => `1 cm auf der Karte sind ${s.n(n)} cm in Wirklichkeit. Multipliziere und rechne dann in ${unit} um.`),
    solution: [
      { math: mb((s) => `1#a "cm"#ua \\to#ar ${s.m(n, "n")} "cm"#un`), note: txs(() => `With the scale ${scaleProse(n)}, 1 cm on the map stands for ${scaleProse(n).slice(4)} cm in reality.`, () => `Beim Maßstab ${scaleProse(n)} steht 1 cm auf der Karte für ${scaleProse(n).slice(4)} cm in Wirklichkeit.`) },
      { math: mb((s) => `${s.m(d, "a")} "cm"#ua \\to#ar ${s.m(d, "d")} \\cdot#op ${s.m(n, "n")} "cm"#un`), note: txs((s) => `The path is ${s.n(d)} cm on the map: multiply by ${s.n(n)}.`, (s) => `Der Weg ist auf der Karte ${s.n(d)} cm lang: mal ${s.n(n)}.`) },
      { math: mb((s) => `${s.m(d, "a")} "cm"#ua \\to#ar ${s.m(cm, "n")} "cm"#un`), note: txs((s) => `${s.n(d)} · ${s.n(n)} = ${s.n(cm)} cm.`, (s) => `${s.n(d)} · ${s.n(n)} = ${s.n(cm)} cm.`) },
      {
        math: mb((s) => `${s.m(d, "a")} "cm"#ua \\to#ar ${s.m(right, "n", 3)} "${unit}"#un`),
        highlight: ["n", "un"],
        note: txs(
          (s) => `${unit === "km" ? "100 000 cm = 1 km" : "100 cm = 1 m"}: ${s.n(cm)} cm = ${s.n(right, 3)} ${unit}. **Answer:** In reality it is ${s.n(right, 3)} ${unit} long.`,
          (s) => `${unit === "km" ? "100.000 cm = 1 km" : "100 cm = 1 m"}: ${s.n(cm)} cm = ${s.n(right, 3)} ${unit}. **Antwort:** In Wirklichkeit ist er ${s.n(right, 3)} ${unit} lang.`,
        ),
      },
    ],
  };
};

const realToMap: Tpl = (rng) => {
  const n = rng.pick([10000, 20000, 25000, 50000, 100000]);
  const route = rng.pick(ROUTES);
  const d = rng.pick([2, 3, 4, 5, 6, 7, 8, 2.5, 3.5, 4.5, 5.5, 7.5]);
  const cm = clean(d * n);
  const m = cm / 100;
  const inKm = m >= 1000 && m % 100 === 0;
  const realText = (s: Say) => (inKm ? `${s.n(m / 1000)} km` : `${s.n(m)} m`);
  const answer = numAns(d, "cm");
  const mk = mistakesFor(answer);
  mk.add(m / n, tx("Converted into metres only", "Nur in Meter umgerechnet"), txs((s) => `You divided **metres** by ${s.n(n)}. The scale compares cm with cm: change the real length into **cm** first.`, (s) => `Du hast **Meter** durch ${s.n(n)} geteilt. Der Maßstab vergleicht cm mit cm: Rechne die echte Länge zuerst in **cm** um.`));
  if (inKm) mk.add((m / 1000) * 10000 / n, tx("1 km isn't 10 000 cm", "1 km sind nicht 10.000 cm"), txs(() => `Careful: 1 km = 1000 m = **100 000 cm**. Count the zeros again.`, () => `Vorsicht: 1 km = 1000 m = **100.000 cm**. Zähl die Nullen noch mal.`));
  mk.add(d * 10, tx("Millimetres, not centimetres", "Millimeter statt Zentimeter"), txs((s) => `That would be the length in mm. The question asks for cm: ${s.n(d * 10)} mm = ${s.n(d)} cm.`, () => `Das wäre die Länge in mm. Gefragt ist in cm.`));
  return {
    instruction: SCALE_INSTR,
    text: txs(
      (s) => `In reality, ${route.en} is ${realText(s)} long. How long is it on ${s.t(route.map)} with the scale ${scaleProse(n)}? Give the answer in cm.`,
      (s) => `In Wirklichkeit ist ${route.de} ${realText(s)} lang. Wie lang ist er auf ${s.t(route.map)} im Maßstab ${scaleProse(n)}? Gib das Ergebnis in cm an.`,
    ),
    answer,
    mistakes: mk.list,
    hint: txs((s) => `Change ${realText(s)} into cm first, then divide by ${s.n(n)}.`, (s) => `Rechne ${realText(s)} zuerst in cm um und teile dann durch ${s.n(n)}.`),
    solution: [
      { math: mb((s) => `${inKm ? `${s.m(m / 1000, "r")} "km"#ur` : `${s.m(m, "r")} "m"#ur`}`), note: txs((s) => `The real length: ${realText(s)}. The scale compares centimetres with centimetres.`, (s) => `Die echte Länge: ${realText(s)}. Der Maßstab vergleicht Zentimeter mit Zentimetern.`) },
      { math: mb((s) => `${s.m(cm, "r")} "cm"#ur`), note: txs(() => (inKm ? "1 km = 100 000 cm." : "1 m = 100 cm."), () => (inKm ? "1 km = 100.000 cm." : "1 m = 100 cm.")) },
      { math: mb((s) => `${s.m(cm, "r")} "cm"#ur :#op ${s.m(n, "n")}`), note: txs((s) => `On the map everything is ${s.n(n)} times smaller: **divide**.`, (s) => `Auf der Karte ist alles ${s.n(n)}-mal kleiner: **dividieren**.`) },
      { math: mb((s) => `${s.m(d, "r")} "cm"#ur`), highlight: ["r", "ur"], note: txs((s) => `**Answer:** On the map it is ${s.n(d)} cm long.`, (s) => `**Antwort:** Auf der Karte ist er ${s.n(d)} cm lang.`) },
    ],
  };
};

const findScale: Tpl = (rng) => {
  const n = rng.pick([10000, 20000, 25000, 50000, 100000, 200000]);
  const d = rng.int(2, 9);
  const cm = d * n;
  const m = cm / 100;
  const inKm = m >= 1000 && m % 100 === 0;
  const realText = (s: Say) => (inKm ? `${s.n(m / 1000)} km` : `${s.n(m)} m`);
  const answer = numAns(n, undefined, { label: "1 :" });
  const mk = mistakesFor(answer);
  mk.add(n / 100, tx("Metres instead of centimetres", "Meter statt Zentimeter"), txs(() => `Nearly! You compared cm on the map with **metres** in reality. A scale needs the same unit on both sides: cm.`, () => `Fast! Du hast cm auf der Karte mit **Metern** in Wirklichkeit verglichen. Ein Maßstab braucht auf beiden Seiten dieselbe Einheit: cm.`));
  if (inKm) mk.add(n / 10, tx("1 km isn't 10 000 cm", "1 km sind nicht 10.000 cm"), txs(() => `Careful: 1 km = 1000 m = **100 000 cm**. Count the zeros again.`, () => `Vorsicht: 1 km = 1000 m = **100.000 cm**. Zähl die Nullen noch mal.`));
  return {
    instruction: SCALE_INSTR,
    text: txs(
      (s) => `On a map, ${d} cm stand for ${realText(s)} in reality. What is the scale of the map?`,
      (s) => `Auf einer Karte entsprechen ${d} cm in Wirklichkeit ${realText(s)}. Welchen Maßstab hat die Karte?`,
    ),
    answer,
    mistakes: mk.list,
    hint: txs((s) => `Change ${realText(s)} into cm. Then: how many cm in reality for **1** cm on the map?`, (s) => `Rechne ${realText(s)} in cm um. Dann: Wie viele cm in Wirklichkeit gehören zu **1** cm auf der Karte?`),
    solution: [
      { math: mb((s) => `${d}#a "cm"#ua \\to#ar ${inKm ? `${s.m(m / 1000, "r")} "km"#ur` : `${s.m(m, "r")} "m"#ur`}`), note: txs(() => `**Given:** ${d} cm on the map. **Wanted:** the scale 1 : ?`, () => `**Gegeben:** ${d} cm auf der Karte. **Gesucht:** der Maßstab 1 : ?`) },
      { math: mb((s) => `${d}#a "cm"#ua \\to#ar ${s.m(cm, "r")} "cm"#ur`), note: txs(() => `Same unit on both sides: ${inKm ? "1 km = 100 000 cm" : "1 m = 100 cm"}.`, () => `Auf beiden Seiten dieselbe Einheit: ${inKm ? "1 km = 100.000 cm" : "1 m = 100 cm"}.`) },
      { math: mb((s) => `\\blob{${d}#a :#o1 ${d}#o1n} "cm"#ua \\to#ar \\blob{${s.m(cm, "r")} :#o2 ${d}#o2n} "cm"#ur`), note: txs(() => `Down to **1** cm on the map: divide both sides by ${d}.`, () => `Auf **1** cm Karte zurückrechnen: Teile beide Seiten durch ${d}.`) },
      { math: mb((s) => `1#a "cm"#ua \\to#ar ${s.m(n, "r")} "cm"#ur`), highlight: ["r"], note: txs(() => `**Answer:** The scale is ${scaleProse(n)}.`, () => `**Antwort:** Der Maßstab ist ${scaleProse(n)}.`) },
    ],
  };
};

/** Each scale with the plan lengths that give a sensible real size. */
const PLANS = [
  { en: "On a building plan", de: "Auf einem Bauplan", what: tx("the living room", "das Wohnzimmer"), model: false, sizes: [[50, [8, 9, 10, 11, 12, 13]], [100, [4, 4.5, 5, 5.5, 6, 7]]] as [number, number[]][] },
  { en: "On a garden plan", de: "Auf einem Gartenplan", what: tx("the vegetable patch", "das Gemüsebeet"), model: false, sizes: [[50, [4, 5, 6, 7]], [100, [2.5, 3, 3.5, 4.5]], [200, [1.5, 2, 2.5]]] as [number, number[]][] },
  { en: "", de: "", what: tx("the car", "das Auto"), model: true, sizes: [[18, [20, 22, 23, 24, 25]], [24, [16, 17, 18, 19, 20]]] as [number, number[]][] },
];

const planToReal: Tpl = (rng) => {
  const pl = rng.pick(PLANS);
  const [n, ps] = rng.pick(pl.sizes);
  const p = rng.pick(ps);
  const cm = clean(p * n);
  const right = clean(cm / 100, 4);
  const answer = numAns(right, "m");
  const mk = mistakesFor(answer);
  mk.add(cm, tx("Still in centimetres", "Noch in Zentimetern"), txs((s) => `${s.n(cm)} is right, but in **cm**. Convert into metres: 100 cm = 1 m.`, (s) => `${s.n(cm)} stimmt, aber in **cm**. Rechne in Meter um: 100 cm = 1 m.`));
  mk.add(cm / 1000, tx("1 m isn't 1000 cm", "1 m sind nicht 1000 cm"), txs(() => `Careful: 1 m = **100 cm**, not 1000 cm.`, () => `Vorsicht: 1 m = **100 cm**, nicht 1000 cm.`));
  mk.add(p / n, tx("Divided instead of multiplied", "Geteilt statt multipliziert"), txs(() => `In reality everything is **bigger** than on the plan: multiply by ${n}.`, () => `In Wirklichkeit ist alles **größer** als auf dem Plan: mal ${n}.`));
  const model = pl.model;
  return {
    instruction: SCALE_INSTR,
    text: model
      ? txs((s) => `A model car is built at the scale ${scaleProse(n)}. It is ${s.n(p)} cm long. How long is the real car in metres?`, (s) => `Ein Modellauto ist im Maßstab ${scaleProse(n)} gebaut. Es ist ${s.n(p)} cm lang. Wie lang ist das echte Auto in Metern?`)
      : txs(
          (s) => `${pl.en} with the scale ${scaleProse(n)}, ${s.t(pl.what)} is ${s.n(p)} cm long. How long is it in reality, in metres?`,
          (s) => `${pl.de} im Maßstab ${scaleProse(n)} ist ${s.t(pl.what)} ${s.n(p)} cm lang. Wie lang ist es in Wirklichkeit, in Metern?`,
        ),
    answer,
    mistakes: mk.list,
    hint: tx(`1 cm stands for ${n} cm. Multiply, then convert: 100 cm = 1 m.`, `1 cm steht für ${n} cm. Multipliziere und rechne dann um: 100 cm = 1 m.`),
    solution: [
      { math: mb((s) => `${s.m(p, "a")} "cm"#ua \\cdot#op ${n}#n`), note: txs((s) => `Scale ${scaleProse(n)}: reality is ${n} times as big. ${s.n(p)} cm times ${n}.`, (s) => `Maßstab ${scaleProse(n)}: In Wirklichkeit ist alles ${n}-mal so groß. ${s.n(p)} cm mal ${n}.`) },
      { math: mb((s) => `${s.m(cm, "a")} "cm"#ua`), note: txs((s) => `${s.n(p)} · ${n} = ${s.n(cm)} cm.`, (s) => `${s.n(p)} · ${n} = ${s.n(cm)} cm.`) },
      { math: mb((s) => `${s.m(right, "a", 3)} "m"#ua`), highlight: ["a", "ua"], note: txs((s) => `100 cm = 1 m. **Answer:** In reality it is ${s.n(right, 3)} m long.`, (s) => `100 cm = 1 m. **Antwort:** In Wirklichkeit ist es ${s.n(right, 3)} m lang.`) },
    ],
  };
};

const BUGS = [
  { en: "ladybird", enA: "a", de: "Marienkäfer", fem: false, mm: [5, 6, 7, 8], k: [4, 5, 10] },
  { en: "ant", enA: "an", de: "Ameise", fem: true, mm: [4, 5, 6, 8, 10, 12], k: [4, 5, 10] },
  { en: "flea", enA: "a", de: "Floh", fem: false, mm: [2, 3, 2.5], k: [10, 20] },
  { en: "honeybee", enA: "a", de: "Honigbiene", fem: true, mm: [12, 14, 15, 16], k: [2, 4, 5] },
];

const enlarged: Tpl = (rng) => {
  const b = rng.pick(BUGS);
  const mm = rng.pick(b.mm);
  const k = rng.pick(b.k);
  const pic = clean((mm * k) / 10, 4);
  const answer = numAns(mm, "mm");
  const mk = mistakesFor(answer);
  mk.add(pic * k * 10, tx("Enlarged again", "Noch mal vergrößert"), txs(() => `Scale ${k} : 1 means the **photo** is ${k} times bigger. Going back to reality, divide by ${k}.`, () => `Maßstab ${k} : 1 heißt: Das **Foto** ist ${k}-mal so groß. Zurück zur Wirklichkeit teilst du durch ${k}.`));
  mk.add(mm / 10, tx("Still in centimetres", "Noch in Zentimetern"), txs((s) => `${s.n(mm / 10, 3)} is right, but in **cm**. The question asks for mm: 1 cm = 10 mm.`, (s) => `${s.n(mm / 10, 3)} stimmt, aber in **cm**. Gefragt ist in mm: 1 cm = 10 mm.`));
  mk.add(pic * 10, tx("Photo size, not real size", "Fotogröße statt echter Größe"), txs(() => `That's the length on the photo in mm. The real ${b.en} is ${k} times smaller.`, () => `Das ist die Länge auf dem Foto in mm. ${b.fem ? "Die echte" : "Der echte"} ${b.de} ist ${k}-mal kleiner.`));
  return {
    instruction: SCALE_INSTR,
    text: txs(
      (s) => `A photo shows ${b.enA} ${b.en} at the scale ${k} : 1. On the photo it is ${s.n(pic)} cm long. How long is the real ${b.en} in mm?`,
      (s) => `${b.fem ? "Eine" : "Ein"} ${b.de} ist auf einem Foto im Maßstab ${k} : 1 abgebildet. Auf dem Foto ist ${b.fem ? "sie" : "er"} ${s.n(pic)} cm lang. Wie lang ist ${b.fem ? "die echte" : "der echte"} ${b.de} in mm?`,
    ),
    answer,
    mistakes: mk.list,
    hint: tx(`${k} : 1 is an **enlargement**: the photo is ${k} times as big as reality. Change cm into mm.`, `${k} : 1 ist eine **Vergrößerung**: Das Foto ist ${k}-mal so groß wie die Wirklichkeit. Rechne cm in mm um.`),
    solution: [
      { math: mb((s) => `${s.m(pic, "a")} "cm"#ua =#eq ${s.m(pic * 10, "b")} "mm"#ub`), note: txs((s) => `On the photo: ${s.n(pic)} cm = ${s.n(pic * 10)} mm (1 cm = 10 mm).`, (s) => `Auf dem Foto: ${s.n(pic)} cm = ${s.n(pic * 10)} mm (1 cm = 10 mm).`) },
      { math: mb((s) => `${s.m(pic * 10, "b")} "mm"#ub :#op ${k}#k`), note: txs(() => `Scale ${k} : 1: 1 mm in reality is ${k} mm on the photo. Back to reality: **divide** by ${k}.`, () => `Maßstab ${k} : 1: 1 mm in Wirklichkeit sind ${k} mm auf dem Foto. Zurück zur Wirklichkeit: durch ${k} **teilen**.`) },
      { math: mb((s) => `${s.m(mm, "b")} "mm"#ub`), highlight: ["b", "ub"], note: txs((s) => `**Answer:** The real ${b.en} is ${s.n(mm)} mm long.`, (s) => `**Antwort:** ${b.fem ? "Die echte" : "Der echte"} ${b.de} ist ${s.n(mm)} mm lang.`) },
    ],
  };
};

// ---------------------------------------------------------------------------
// Averages (Mittelwert)

const MEAN_INSTR = tx("Work out the average", "Rechne mit dem Durchschnitt");

type MeanCtx = { n: number[]; lo: number; hi: number; unit: Text; intro: (vals: string, n: number) => Text; ask: Text; div?: number };
const MEAN_CTX: MeanCtx[] = [
  {
    n: [7],
    lo: 12,
    hi: 27,
    unit: "°C",
    intro: (v) => tx(`At noon, a weather station measured these temperatures on seven days: ${v} (in °C).`, `Eine Wetterstation hat mittags an sieben Tagen diese Temperaturen gemessen: ${v} (in °C).`),
    ask: tx("What is the average temperature?", "Wie hoch ist die Durchschnittstemperatur?"),
  },
  {
    n: [5],
    lo: 6,
    hi: 20,
    unit: tx("points", "Punkte"),
    intro: (v) => tx(`Ida's scores in five vocabulary tests: ${v} points.`, `Ida hatte in fünf Vokabeltests diese Punktzahlen: ${v}.`),
    ask: tx("How many points did she score on average?", "Wie viele Punkte hatte sie im Durchschnitt?"),
  },
  {
    n: [4],
    lo: 15,
    hi: 60,
    unit: "min",
    intro: (v) => tx(`Leon read for ${v} minutes on four days.`, `Leon hat an vier Tagen ${v} Minuten gelesen.`),
    ask: tx("How many minutes did he read per day on average?", "Wie viele Minuten hat er im Schnitt pro Tag gelesen?"),
  },
  {
    n: [6],
    lo: 0,
    hi: 5,
    unit: tx("goals", "Tore"),
    intro: (v) => tx(`A football goalkeeper let in this many goals in six games: ${v}.`, `Eine Fußballtorhüterin hat in sechs Spielen so viele Gegentore kassiert: ${v}.`),
    ask: tx("How many goals did she let in per game on average?", "Wie viele Gegentore hat sie im Schnitt pro Spiel kassiert?"),
  },
  {
    n: [5],
    lo: 5,
    hi: 15,
    unit: "€",
    intro: (v) => tx(`Five friends get this much pocket money a week: ${v} (in €).`, `Fünf Freunde bekommen so viel Taschengeld pro Woche: ${v} (in €).`),
    ask: tx("How much pocket money do they get on average?", "Wie viel Taschengeld bekommen sie im Durchschnitt?"),
  },
];

const listText = (vals: number[], l: "en" | "de") => `${vals.slice(0, -1).join(", ")} ${l === "de" ? "und" : "and"} ${vals[vals.length - 1]}`;

const meanPlain: Tpl = (rng) => {
  for (let tries = 0; tries < 40; tries++) {
    const c = rng.pick(MEAN_CTX);
    const n = rng.pick(c.n);
    const vals = Array.from({ length: n }, () => rng.int(c.lo, c.hi));
    const sum = vals.reduce((s, v) => s + v, 0);
    const mean = sum / n;
    if (Math.abs(mean * 100 - Math.round(mean * 100)) > 1e-9) continue;
    if (new Set(vals).size < 3) continue;
    const sorted = [...vals].sort((a, b) => a - b);
    const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const answer = numAns(mean, c.unit);
    const mk = mistakesFor(answer);
    mk.add(sum, tx("Not divided yet", "Noch nicht geteilt"), txs(() => `Nearly! ${sum} is the **sum** of all values. Now share it fairly: divide by the number of values.`, () => `Fast! ${sum} ist die **Summe** aller Werte. Jetzt noch gerecht verteilen: durch die Anzahl der Werte teilen.`));
    mk.add(sum / (n - 1), tx("Counted one value too few", "Einen Wert zu wenig gezählt"), txs(() => `The sum is right, but there are **${n}** values, not ${n - 1}. Count them again.`, () => `Die Summe stimmt, aber es sind **${n}** Werte, nicht ${n - 1}. Zähl noch mal nach.`), true);
    mk.add(sum / (n + 1), tx("Counted one value too many", "Einen Wert zu viel gezählt"), txs(() => `The sum is right, but there are **${n}** values, not ${n + 1}. Count them again.`, () => `Die Summe stimmt, aber es sind **${n}** Werte, nicht ${n + 1}. Zähl noch mal nach.`), true);
    mk.add(median, tx("The middle value", "Der mittlere Wert"), txs(() => `That's the value in the **middle** when you sort them (the median). The average is the sum divided by the number of values.`, () => `Das ist der **mittlere** Wert, wenn du sortierst (der Median). Der Durchschnitt ist die Summe geteilt durch die Anzahl.`));
    const unit = (s: Say) => s.t(c.unit);
    return {
      instruction: MEAN_INSTR,
      text: tx(`${E(c.intro(listText(vals, "en"), n))} ${E(c.ask)}`, `${D(c.intro(listText(vals, "de"), n))} ${D(c.ask)}`),
      answer,
      mistakes: mk.list,
      hint: tx("Add all the values, then divide by how many there are.", "Addiere alle Werte und teile durch ihre Anzahl."),
      solution: [
        { math: `\\frac{${vals.map((v, i) => `${v}#v${i}`).join(" + ")}}{${n}#n}`, note: tx(`Average = sum of all values : number of values. Here there are ${n} values.`, `Durchschnitt = Summe aller Werte : Anzahl der Werte. Hier sind es ${n} Werte.`) },
        { math: `\\frac{${sum}#s}{${n}#n}`, note: tx(`The sum is ${sum}.`, `Die Summe ist ${sum}.`) },
        {
          math: mb((s) => `\\frac{${sum}#s}{${n}#n} =#eq ${s.m(mean, "m")} "${unit(s)}"#u`),
          highlight: ["m", "u"],
          note: txs((s) => `${sum} : ${n} = ${s.n(mean)}. **Answer:** On average ${s.n(mean)} ${unit(s)}.`, (s) => `${sum} : ${n} = ${s.n(mean)}. **Antwort:** Im Durchschnitt ${s.n(mean)} ${unit(s)}.`),
        },
      ],
    };
  }
  return meanNeeded(rng);
};

const meanNeeded: Tpl = (rng) => {
  for (let tries = 0; tries < 60; tries++) {
    const name = rng.pick(NAMES);
    const n = rng.int(3, 5);
    const max = rng.pick([20, 24, 30]);
    const vals = Array.from({ length: n }, () => rng.int(Math.round(max * 0.45), max - 2));
    const sum = vals.reduce((s, v) => s + v, 0);
    const target = rng.int(Math.ceil(sum / n) + 1, max - 1);
    const x = target * (n + 1) - sum;
    if (x < 1 || x > max || x === target) continue;
    const answer = numAns(x, tx("points", "Punkte"));
    const mk = mistakesFor(answer);
    mk.add(target * n - sum, tx("Counted the old number of tests", "Mit der alten Anzahl gerechnet"), txs(() => `With the next test there are **${n + 1}** tests. So the total must be ${target} · ${n + 1}, not ${target} · ${n}.`, () => `Mit dem nächsten Test sind es **${n + 1}** Tests. Die Summe muss also ${target} · ${n + 1} sein, nicht ${target} · ${n}.`));
    mk.add(target, tx("Just the target", "Nur der Zielwert"), txs(() => `If ${name} scores exactly ${target}, the average stays below ${target}: the old tests pull it down. Work with the total.`, () => `Mit genau ${target} Punkten bleibt der Schnitt unter ${target}: Die alten Tests ziehen ihn runter. Rechne mit der Summe.`));
    mk.add(2 * target - sum / n, tx("Only made up the gap once", "Den Abstand nur einmal ausgeglichen"), txs(() => `Nice idea, but the missing points add up over **all** ${n} old tests, not just one. Use the total.`, () => `Gute Idee, aber die fehlenden Punkte summieren sich über **alle** ${n} alten Tests, nicht nur einen. Rechne mit der Summe.`));
    const valsList = (l: "en" | "de") => listText(vals, l);
    return {
      instruction: MEAN_INSTR,
      text: tx(
        `${name} scored ${valsList("en")} points in the first ${n} tests (at most ${max} points each). How many points does ${name} need in the next test to get an average of exactly ${target} points?`,
        `${name} hatte in den ersten ${n} Tests ${valsList("de")} Punkte (je höchstens ${max} Punkte). Wie viele Punkte braucht ${name} im nächsten Test für einen Durchschnitt von genau ${target} Punkten?`,
      ),
      answer,
      mistakes: mk.list,
      hint: tx(`With ${n + 1} tests and an average of ${target}, the total must be ${target} · ${n + 1}.`, `Bei ${n + 1} Tests und einem Schnitt von ${target} muss die Summe ${target} · ${n + 1} sein.`),
      solution: [
        { math: `\\frac{${vals.map((v, i) => `${v}#v${i}`).join(" + ")} + x#x}{${n + 1}#n} =#eq ${target}#t`, note: tx(`The next test brings it to ${n + 1} tests. Call the missing score $x$.`, `Mit dem nächsten Test sind es ${n + 1} Tests. Nenn die fehlende Punktzahl $x$.`) },
        { math: `${vals.map((v, i) => `${v}#v${i}`).join(" + ")} + x#x =#eq ${target}#t \\cdot#op ${n + 1}#n`, note: tx(`An average of ${target} for ${n + 1} tests means a total of ${target} · ${n + 1} = ${target * (n + 1)}.`, `Ein Schnitt von ${target} bei ${n + 1} Tests heißt: Summe ${target} · ${n + 1} = ${target * (n + 1)}.`) },
        { math: `${sum}#s + x#x =#eq ${target * (n + 1)}#t`, note: tx(`The old tests add up to ${sum}.`, `Die alten Tests ergeben zusammen ${sum}.`) },
        { math: `x#x =#eq ${x}#t`, highlight: ["t"], note: tx(`${target * (n + 1)} − ${sum} = ${x}. **Answer:** ${name} needs ${x} points.`, `${target * (n + 1)} − ${sum} = ${x}. **Antwort:** ${name} braucht ${x} Punkte.`) },
      ],
    };
  }
  return meanPlain(rng);
};

const meanChanged: Tpl = (rng) => {
  for (let tries = 0; tries < 60; tries++) {
    const n = rng.pick([20, 24, 25, 28, 30]);
    const M = rng.int(14, 22);
    const d = rng.pick([5, 6, 8, 10, 12, 15]) * rng.sign();
    const shift = d / n;
    if (Math.abs(shift * 100 - Math.round(shift * 100)) > 1e-9) continue;
    const wrongV = rng.int(Math.max(4, -d + 4), Math.min(30, 30 - d));
    const rightV = wrongV + d;
    if (rightV < 0 || rightV > 30) continue;
    const M2 = clean(M + shift);
    const answer = numAns(M2, tx("points", "Punkte"));
    const mk = mistakesFor(answer);
    mk.add(M + d, tx("The whole difference added", "Den ganzen Unterschied verrechnet"), txs(() => `The ${Math.abs(d)} points belong to **one** test out of ${n}. They change the sum by ${Math.abs(d)}, but the average only by ${Math.abs(d)} : ${n}.`, () => `Die ${Math.abs(d)} Punkte gehören zu **einer** von ${n} Arbeiten. Die Summe ändert sich um ${Math.abs(d)}, der Durchschnitt nur um ${Math.abs(d)} : ${n}.`));
    mk.add(M - shift, tx("Wrong direction", "Falsche Richtung"), txs(() => `The size of the change is right, but the direction isn't: the correct score is ${d > 0 ? "higher" : "lower"}, so the average goes ${d > 0 ? "up" : "down"}.`, () => `Die Größe der Änderung stimmt, die Richtung nicht: Die richtige Punktzahl ist ${d > 0 ? "höher" : "niedriger"}, also ${d > 0 ? "steigt" : "sinkt"} der Durchschnitt.`));
    return {
      instruction: MEAN_INSTR,
      text: tx(
        `In a class test, the ${n} students scored ${M} points on average. Later the teacher notices a mistake: one test has ${rightV} points, not ${wrongV}. What is the correct average?`,
        `In einer Klassenarbeit hatten die ${n} Schülerinnen und Schüler im Schnitt ${M} Punkte. Später bemerkt die Lehrerin einen Fehler: Eine Arbeit hat ${rightV} statt ${wrongV} Punkte. Wie hoch ist der richtige Durchschnitt?`,
      ),
      answer,
      mistakes: mk.list,
      hint: tx(`The sum changes by ${rightV} − ${wrongV}. How does that spread over ${n} tests?`, `Die Summe ändert sich um ${rightV} − ${wrongV}. Wie verteilt sich das auf ${n} Arbeiten?`),
      solution: [
        { math: tx(`"sum"#w =#eq ${M}#m \\cdot#op ${n}#n =#e2 ${M * n}#s`, `"Summe"#w =#eq ${M}#m \\cdot#op ${n}#n =#e2 ${M * n}#s`), note: tx(`Sum of all points: average · number = ${M} · ${n} = ${M * n}.`, `Summe aller Punkte: Durchschnitt · Anzahl = ${M} · ${n} = ${M * n}.`) },
        { math: `${M * n}#s ${d > 0 ? "+" : "-"}#op ${Math.abs(d)}#d =#e2 ${M * n + d}#s2`, note: tx(`${rightV} instead of ${wrongV}: the sum ${d > 0 ? "grows" : "shrinks"} by ${Math.abs(d)}.`, `${rightV} statt ${wrongV}: Die Summe ${d > 0 ? "wächst" : "sinkt"} um ${Math.abs(d)}.`) },
        {
          math: mb((s) => `\\frac{${M * n + d}#s2}{${n}#n} =#eq ${s.m(M2, "r")}`),
          highlight: ["r"],
          note: txs(
            (s) => `New sum : ${n} = ${s.n(M2)}. The average changes by only ${Math.abs(d)} : ${n} = ${s.n(Math.abs(shift))}. **Answer:** ${s.n(M2)} points.`,
            (s) => `Neue Summe : ${n} = ${s.n(M2)}. Der Schnitt ändert sich nur um ${Math.abs(d)} : ${n} = ${s.n(Math.abs(shift))}. **Antwort:** ${s.n(M2)} Punkte.`,
          ),
        },
      ],
    };
  }
  return meanPlain(rng);
};

const meanAdded: Tpl = (rng) => {
  for (let tries = 0; tries < 60; tries++) {
    const n = rng.int(3, 7);
    const M = rng.int(11, 15);
    const v = rng.pick([30, 32, 35, 38, 40, 42, 45]);
    const M2 = (n * M + v) / (n + 1);
    if (Math.abs(M2 * 10 - Math.round(M2 * 10)) > 1e-9) continue;
    const answer = numAns(M2, tx("years", "Jahre"));
    const mk = mistakesFor(answer);
    mk.add((M + v) / 2, tx("Averaged the averages", "Durchschnitte gemittelt"), txs(() => `Careful: ${M} stands for **${n}** children, ${v} for just one person. You can't just take the middle of ${M} and ${v}: work with the total age.`, () => `Vorsicht: ${M} steht für **${n}** Kinder, ${v} nur für eine Person. Du kannst nicht einfach die Mitte von ${M} und ${v} nehmen: Rechne mit dem Gesamtalter.`));
    mk.add((n * M + v) / n, tx("Divided by the old number", "Durch die alte Anzahl geteilt"), txs(() => `The sum is right! But with the coach there are **${n + 1}** people now.`, () => `Die Summe stimmt! Aber mit dem Trainer sind es jetzt **${n + 1}** Personen.`), true);
    return {
      instruction: MEAN_INSTR,
      text: tx(
        `${n} children in a chess club are ${M} years old on average. Their ${v}-year-old coach joins the group photo. What is the average age of the people in the photo?`,
        `${n} Kinder eines Schachclubs sind im Durchschnitt ${M} Jahre alt. Ihr ${v}-jähriger Trainer kommt mit aufs Gruppenfoto. Wie alt sind die Personen auf dem Foto im Durchschnitt?`,
      ),
      answer,
      mistakes: mk.list,
      hint: tx(`Total age of the children: ${M} · ${n}. Add the coach and divide by the new number of people.`, `Gesamtalter der Kinder: ${M} · ${n}. Addiere den Trainer und teile durch die neue Anzahl.`),
      solution: [
        { math: `${M}#m \\cdot#op ${n}#n =#eq ${M * n}#s`, note: tx(`All children together: ${M} · ${n} = ${M * n} years.`, `Alle Kinder zusammen: ${M} · ${n} = ${M * n} Jahre.`) },
        { math: `\\frac{${M * n}#s + ${v}#v}{${n + 1}#n}`, note: tx(`Add the coach's ${v} years. Now there are ${n + 1} people.`, `Plus die ${v} Jahre des Trainers. Jetzt sind es ${n + 1} Personen.`) },
        {
          math: mb((s) => `\\frac{${M * n + v}#s}{${n + 1}#n} =#eq ${s.m(M2, "r")}`),
          highlight: ["r"],
          note: txs((s) => `${M * n + v} : ${n + 1} = ${s.n(M2)}. **Answer:** On average ${s.n(M2)} years.`, (s) => `${M * n + v} : ${n + 1} = ${s.n(M2)}. **Antwort:** Im Schnitt ${s.n(M2)} Jahre.`),
        },
      ],
    };
  }
  return meanPlain(rng);
};

// ---------------------------------------------------------------------------
// Tariffs

const TARIFF_INSTR = tx("Compare the tariffs", "Vergleiche die Tarife");

type TariffCase = {
  /** Units per x in prose: "km", "minutes", "visits". */
  per: Text;
  /** German dative plural after "bei" ("bei 9 Besuchen"), if it differs. */
  perDat?: string;
  /** The tariffs with an article inside a sentence ("the monthly plan" / "das Monatsabo"), if they need one. */
  aThe?: Text;
  bThe?: Text;
  unit: Text;
  a: Text;
  b: Text;
  intro: Text;
  /** a1, r1 (A), a2, r2 (B), break-even x */
  make: (rng: Rng) => { a1: number; r1: number; a2: number; r2: number; x: number };
  /** x values for "how much at x" (not the break-even). */
  xs: (x: number) => number[];
};

const TARIFFS: TariffCase[] = [
  {
    per: "km",
    unit: "km",
    a: tx("Taxi A", "Taxi A"),
    b: tx("Taxi B", "Taxi B"),
    intro: tx("Two taxi firms in a town:", "Zwei Taxiunternehmen in einer Stadt:"),
    make: (rng) => {
      const r2 = rng.pick([1.5, 1.6, 1.8, 2]);
      const d = rng.pick([0.2, 0.25, 0.5]);
      const x = rng.pick(d === 0.25 ? [4, 8, 12] : d === 0.2 ? [5, 10, 15] : [4, 5, 6, 7, 8, 9, 10]);
      const a1 = rng.pick([3, 3.5, 4]);
      return { a1, r1: clean(r2 + d), a2: clean(a1 + x * d), r2, x };
    },
    xs: (x) => [2, 3, x + 3, x + 5].filter((v) => v !== x),
  },
  {
    per: tx("minutes", "Minuten"),
    unit: "min",
    a: tx("Plan A", "Tarif A"),
    b: tx("Plan B", "Tarif B"),
    intro: tx("Two prepaid phone plans (per month):", "Zwei Prepaid-Handytarife (pro Monat):"),
    make: (rng) => {
      const pair = rng.pick([
        [3, 0.03],
        [4, 0.04],
        [5, 0.05],
        [6, 0.03],
        [3, 0.05],
        [6, 0.05],
        [4, 0.05],
        [6, 0.04],
      ]);
      const r1 = rng.pick([0.09, 0.1, 0.12]);
      const [a2, d] = pair;
      return { a1: 0, r1, a2, r2: clean(r1 - d), x: clean(a2 / d) };
    },
    xs: (x) => [20, 50, x + 40, x + 60].filter((v) => v !== x),
  },
  {
    per: tx("visits", "Besuche"),
    perDat: "Besuchen",
    unit: tx("visits", "Besuche"),
    a: tx("Single ticket", "Einzelkarte"),
    b: tx("Monthly plan", "Monatsabo"),
    aThe: tx("the single ticket", "die Einzelkarte"),
    bThe: tx("the monthly plan", "das Monatsabo"),
    intro: tx("A climbing gym offers two tariffs:", "Eine Kletterhalle bietet zwei Tarife an:"),
    make: (rng) => {
      for (;;) {
        const r1 = rng.pick([6, 7, 8, 9, 10, 12]);
        const r2 = rng.pick([2, 3, 4, 5]);
        const a2 = rng.pick([20, 24, 25, 28, 30, 35, 36, 40]);
        const d = r1 - r2;
        if (d > 0 && a2 % d === 0 && a2 / d >= 3 && a2 / d <= 12) return { a1: 0, r1, a2, r2, x: a2 / d };
      }
    },
    xs: (x) => [1, 2, x + 2, x + 4].filter((v) => v !== x),
  },
  {
    per: "kWh",
    unit: "kWh",
    a: tx("Supplier A", "Anbieter A"),
    b: tx("Supplier B", "Anbieter B"),
    intro: tx("Two electricity suppliers (per year):", "Zwei Stromanbieter (pro Jahr):"),
    make: (rng) => {
      const a1 = rng.pick([80, 100, 120]);
      const r2 = rng.pick([0.3, 0.32, 0.35]);
      const d = rng.pick([0.04, 0.05]);
      const x = rng.pick([1500, 2000, 2500, 3000]);
      return { a1, r1: clean(r2 + d), a2: clean(a1 + x * d), r2, x };
    },
    xs: (x) => [1000, x + 500, x + 1000].filter((v) => v !== x),
  },
  {
    per: "km",
    unit: "km",
    a: tx("Rental A", "Vermietung A"),
    b: tx("Rental B", "Vermietung B"),
    intro: tx("Renting a van for a day, two offers:", "Einen Transporter für einen Tag mieten, zwei Angebote:"),
    make: (rng) => {
      const a1 = rng.pick([0, 10, 20]);
      const r2 = rng.pick([0.2, 0.25, 0.3]);
      const d = rng.pick([0.1, 0.2, 0.25]);
      const x = rng.pick(d === 0.25 ? [100, 200, 240] : [100, 150, 200, 250, 300]);
      return { a1, r1: clean(r2 + d), a2: clean(a1 + x * d), r2, x };
    },
    xs: (x) => [50, x + 50, x + 100].filter((v) => v !== x),
  },
];

const tariffLine = (s: Say, name: Text, base: number, rate: number, per: Text) =>
  s.de
    ? `**${s.t(name)}:** ${base ? `${s.e(base)} € Grundgebühr plus ` : ""}${s.e(rate)} € pro ${s.t(per) === "Minuten" ? "Minute" : s.t(per) === "Besuche" ? "Besuch" : s.t(per)}${base ? "" : ", keine Grundgebühr"}.`
    : `**${s.t(name)}:** ${base ? `${s.e(base)} € basic fee plus ` : ""}${s.e(rate)} € per ${s.t(per) === "minutes" ? "minute" : s.t(per) === "visits" ? "visit" : s.t(per)}${base ? "" : ", no basic fee"}.`;

const termOf = (s: Say, base: number, rate: number, key: string) => `${base ? `${s.m(base, `b${key}`)} +#p${key} ` : ""}${s.m(rate, `r${key}`)} x#x${key}`;

function tariffSetup(rng: Rng) {
  const c = rng.pick(TARIFFS);
  const v = c.make(rng);
  const intro = txs(
    (s) => `${s.t(c.intro)} ${tariffLine(s, c.a, v.a1, v.r1, c.per)} ${tariffLine(s, c.b, v.a2, v.r2, c.per)}`,
    (s) => `${s.t(c.intro)} ${tariffLine(s, c.a, v.a1, v.r1, c.per)} ${tariffLine(s, c.b, v.a2, v.r2, c.per)}`,
  );
  return { c, v, intro };
}

const tariffEven: Tpl = (rng) => {
  const { c, v, intro } = tariffSetup(rng);
  const answer = numAns(v.x, c.unit);
  const mk = mistakesFor(answer);
  const cost = clean(v.a1 + v.r1 * v.x);
  const dr = clean(v.r1 - v.r2);
  mk.add(v.a2 / dr, tx("Basic fee of A forgotten", "Grundgebühr von A vergessen"), txs(() => `Careful, ${E(c.a)} has a basic fee too. You need the **difference** of the basic fees.`, () => `Vorsicht, auch ${D(c.a)} hat eine Grundgebühr. Du brauchst den **Unterschied** der Grundgebühren.`));
  mk.add((v.a2 - v.a1) / (v.r1 + v.r2), tx("Rates added", "Preise addiert"), txs(() => `When you bring the x-terms to one side, ${v.r2} x is **subtracted**: you divide by the difference of the prices.`, () => `Wenn du die x-Terme auf eine Seite bringst, wird ${String(v.r2).replace(".", ",")}x **abgezogen**: Du teilst durch den Unterschied der Preise.`));
  mk.add((v.a2 - v.a1) / v.r1, tx("Divided by one price only", "Nur durch einen Preis geteilt"), txs(() => `Both tariffs grow with x. What counts is how much faster ${E(c.a)} grows: the **difference** of the prices.`, () => `Beide Tarife wachsen mit x. Entscheidend ist, um wie viel schneller ${D(c.a)} wächst: der **Unterschied** der Preise.`));
  const dat = c.perDat ?? D(c.per);
  mk.add(cost, tx("The cost, not the amount", "Die Kosten statt der Menge"), txs((s) => `${s.e(cost)} € is the price at the break-even point. The question asks **how many** ${s.t(c.per)}.`, (s) => `${s.e(cost)} € ist der Preis beim Gleichstand. Gefragt ist, bei **wie vielen** ${dat}.`));
  return {
    instruction: TARIFF_INSTR,
    text: txs((s) => `${s.t(intro)} For how many ${s.t(c.per)} do both cost the same?`, (s) => `${s.t(intro)} Bei wie vielen ${dat} kosten beide gleich viel?`),
    answer,
    mistakes: mk.list,
    hint: tx("Write both costs as terms with x, then set them equal.", "Schreib beide Kosten als Terme mit x und setz sie gleich."),
    solution: [
      { math: mb((s) => `K_A =#e1 ${termOf(s, v.a1, v.r1, "1")} \\quad K_B =#e2 ${termOf(s, v.a2, v.r2, "2")}`), note: tx("Cost = basic fee + price per unit · amount $x$.", "Kosten = Grundgebühr + Preis pro Einheit · Menge $x$.") },
      { math: mb((s) => `${termOf(s, v.a1, v.r1, "1")} =#eq ${termOf(s, v.a2, v.r2, "2")}`), note: tx("Same cost: set the terms equal.", "Gleiche Kosten: Terme gleichsetzen.") },
      { math: mb((s) => `${s.m(dr, "d")} x#x1 =#eq ${s.m(v.a2 - v.a1, "b2")}`), note: txs((s) => `Subtract ${s.n(v.r2)}x${v.a1 ? ` and ${s.n(v.a1)}` : ""} on both sides.`, (s) => `Auf beiden Seiten ${s.n(v.r2)}x${v.a1 ? ` und ${s.n(v.a1)}` : ""} abziehen.`) },
      {
        math: mb((s) => `x#x1 =#eq ${s.m(v.x, "b2")}`),
        highlight: ["b2"],
        note: txs(
          (s) => `${s.n(v.a2 - v.a1)} : ${s.n(dr)} = ${s.n(v.x)}. **Answer:** At ${s.n(v.x)} ${s.t(c.per)} both cost ${s.e(cost)} €.`,
          (s) => `${s.n(v.a2 - v.a1)} : ${s.n(dr)} = ${s.n(v.x)}. **Antwort:** Bei ${s.n(v.x)} ${dat} kosten beide ${s.e(cost)} €.`,
        ),
      },
    ],
  };
};

const tariffCost: Tpl = (rng) => {
  const { c, v, intro } = tariffSetup(rng);
  const x = rng.pick(c.xs(v.x));
  const useB = rng.chance(0.6);
  const base = useB ? v.a2 : v.a1;
  const rate = useB ? v.r2 : v.r1;
  const name = useB ? (c.bThe ?? c.b) : (c.aThe ?? c.a);
  const cost = clean(base + rate * x);
  const answer = numAns(cost, "€");
  const mk = mistakesFor(answer);
  if (base) mk.add(rate * x, tx("Basic fee forgotten", "Grundgebühr vergessen"), txs((s) => `Nearly! ${s.e(rate * x)} € is only the price for the ${s.t(c.per)}. The basic fee of ${s.e(base)} € comes on top.`, (s) => `Fast! ${s.e(rate * x)} € ist nur der Preis für die ${s.t(c.per)}. Die Grundgebühr von ${s.e(base)} € kommt noch dazu.`));
  if (base) mk.add((base + rate) * x, tx("Basic fee counted every time", "Grundgebühr jedes Mal gezählt"), txs(() => `The basic fee is paid **once**, not for every unit. Only the price per unit is multiplied.`, () => `Die Grundgebühr zahlst du **einmal**, nicht für jede Einheit. Nur der Preis pro Einheit wird multipliziert.`));
  const other = useB ? clean(v.a1 + v.r1 * x) : clean(v.a2 + v.r2 * x);
  mk.add(other, tx("The other tariff", "Der andere Tarif"), txs(() => `That's the price of the **other** offer. Use the numbers of ${E(name)}.`, () => `Das ist der Preis des **anderen** Angebots. Nimm die Zahlen von ${D(useB ? c.b : c.a)}.`));
  return {
    instruction: TARIFF_INSTR,
    text: txs((s) => `${s.t(intro)} How much does ${s.t(name)} cost for ${s.n(x)} ${s.t(c.per)}?`, (s) => `${s.t(intro)} Wie viel kostet ${s.t(name)} bei ${s.n(x)} ${c.perDat ?? s.t(c.per)}?`),
    answer,
    mistakes: mk.list,
    hint: tx("Cost = basic fee + price per unit · amount.", "Kosten = Grundgebühr + Preis pro Einheit · Menge."),
    solution: [
      { math: mb((s) => `K =#e1 ${termOf(s, base, rate, "1")}`), note: txs((s) => `The cost term of ${s.t(name)}.`, (s) => `Der Kostenterm für ${s.t(name)}.`) },
      { math: mb((s) => `K =#e1 ${base ? `${s.m(base, "b1")} +#p1 ` : ""}${s.m(rate, "r1")} \\cdot#d ${s.m(x, "x1")}`), note: txs((s) => `Insert $x = ${s.m(x)}$.`, (s) => `Setz $x = ${s.m(x)}$ ein.`) },
      { math: mb((s) => `K =#e1 ${s.m(cost, "k")} "€"#u`), highlight: ["k", "u"], note: txs((s) => `**Answer:** ${s.t(name).replace(/^./, (x) => x.toUpperCase())} costs ${s.e(cost)} €.`, (s) => `**Antwort:** ${s.t(name).replace(/^./, (x) => x.toUpperCase())} kostet ${s.e(cost)} €.`) },
    ],
  };
};

const tariffCheaper: Tpl = (rng) => {
  const { c, v, intro } = tariffSetup(rng);
  const x = rng.chance(0.2) ? v.x : rng.pick(c.xs(v.x));
  const ka = clean(v.a1 + v.r1 * x);
  const kb = clean(v.a2 + v.r2 * x);
  const right = Math.abs(ka - kb) < 1e-9 ? 2 : ka < kb ? 0 : 1;
  const up = (t: string) => t.replace(/^./, (x) => x.toUpperCase());
  const opts = [
    { text: txs((s) => `${up(s.t(c.aThe ?? c.a))} is cheaper`, (s) => `${up(s.t(c.aThe ?? c.a))} ist günstiger`) },
    { text: txs((s) => `${up(s.t(c.bThe ?? c.b))} is cheaper`, (s) => `${up(s.t(c.bThe ?? c.b))} ist günstiger`) },
    { text: tx("Both cost the same", "Beide kosten gleich viel") },
  ].map((o, i) =>
    i === right
      ? o
      : {
          ...o,
          title: tx("Work out both prices", "Rechne beide Preise aus"),
          say:
            i === 2
              ? tx("They only cost the same at one point. Insert the amount into both terms and compare.", "Gleich teuer sind sie nur an einer Stelle. Setz die Menge in beide Terme ein und vergleiche.")
              : right === 2
                ? tx("Work out both prices: here they are exactly the same. This is the break-even point.", "Rechne beide Preise aus: Hier sind sie genau gleich. Das ist der Gleichstand.")
                : i === 0
                ? tx("A smaller basic fee doesn't win every time: for large amounts the price per unit counts more. Work out both prices.", "Die kleinere Grundgebühr gewinnt nicht immer: Bei großen Mengen zählt der Preis pro Einheit mehr. Rechne beide Preise aus.")
                : tx("A smaller price per unit doesn't win every time: for small amounts the basic fee counts more. Work out both prices.", "Der kleinere Preis pro Einheit gewinnt nicht immer: Bei kleinen Mengen zählt die Grundgebühr mehr. Rechne beide Preise aus."),
        },
  );
  const { answer, mistakes } = fixedChoice(opts, right);
  return {
    instruction: TARIFF_INSTR,
    text: txs((s) => `${s.t(intro)} Which offer is cheaper for ${s.n(x)} ${s.t(c.per)}?`, (s) => `${s.t(intro)} Welches Angebot ist bei ${s.n(x)} ${c.perDat ?? s.t(c.per)} günstiger?`),
    answer,
    mistakes,
    hint: tx("Insert the amount into both cost terms.", "Setz die Menge in beide Kostenterme ein."),
    solution: [
      { math: mb((s) => `K_A =#e1 ${v.a1 ? `${s.m(v.a1)} + ` : ""}${s.m(v.r1)} \\cdot ${s.m(x)} =#f1 ${s.m(ka, "ka")} "€"#ua`), note: txs((s) => `${s.t(c.a)}: insert $x = ${s.m(x)}$. That makes ${s.e(ka)} €.`, (s) => `${s.t(c.a)}: $x = ${s.m(x)}$ einsetzen. Das macht ${s.e(ka)} €.`) },
      { math: mb((s) => `K_B =#e1 ${v.a2 ? `${s.m(v.a2)} + ` : ""}${s.m(v.r2)} \\cdot ${s.m(x)} =#f1 ${s.m(kb, "kb")} "€"#ub`), note: txs((s) => `${s.t(c.b)}: ${s.e(kb)} €.`, (s) => `${s.t(c.b)}: ${s.e(kb)} €.`) },
      {
        math: mb((s) => `${s.m(ka, "ka")} "€"#ua ${right === 2 ? "=" : right === 0 ? "<" : ">"}#cmp ${s.m(kb, "kb")} "€"#ub`),
        highlight: right === 0 ? ["ka", "ua"] : right === 1 ? ["kb", "ub"] : ["ka", "kb"],
        note: txs(
          (s) => `**Answer:** ${right === 2 ? "Both cost the same: this is the break-even point." : `${up(s.t(right === 0 ? (c.aThe ?? c.a) : (c.bThe ?? c.b)))} is cheaper.`}`,
          (s) => `**Antwort:** ${right === 2 ? "Beide kosten gleich viel: Das ist der Gleichstand." : `${up(s.t(right === 0 ? (c.aThe ?? c.a) : (c.bThe ?? c.b)))} ist günstiger.`}`,
        ),
      },
    ],
  };
};

const tariffMatch: Tpl = (rng) => {
  for (;;) {
    const a = rng.int(2, 9);
    const r = rng.int(2, 9);
    const f = rng.int(2, 9);
    if (a === r || f === a || f === r) continue;
    const per = rng.pick([
      { en: "km", de: "km", xEn: "kilometres", xDe: "Kilometer" },
      { en: "hour", de: "Stunde", xEn: "hours", xDe: "Stunden" },
      { en: "visit", de: "Besuch", xEn: "visits", xDe: "Besuche" },
    ]);
    const desc = (base: number, rate: number) =>
      base ? tx(`${base} € basic fee, ${rate} € per ${per.en}`, `${base} € Grundgebühr, ${rate} € pro ${per.de}`) : tx(`No basic fee, ${rate} € per ${per.en}`, `Keine Grundgebühr, ${rate} € pro ${per.de}`);
    const T1 = desc(a, r);
    const T2 = desc(r, a);
    const T3 = desc(0, f);
    const k1 = `$K = ${a} + ${r}x$`;
    const k2 = `$K = ${r} + ${a}x$`;
    const k3 = `$K = ${f}x$`;
    const distractor = `$K = ${f} + x$`;
    const pairs: [Text, Text][] = rng.shuffle([
      [T1, k1],
      [T2, k2],
      [T3, k3],
    ] as [Text, Text][]);
    return {
      instruction: tx("Match each tariff with its cost term", "Ordne jedem Tarif seinen Kostenterm zu"),
      text: tx(`$K$ is the cost in €, $x$ the number of ${per.xEn}.`, `$K$ sind die Kosten in €, $x$ ist die Anzahl der ${per.xDe}.`),
      answer: { kind: "match", pairs, distractors: [distractor] },
      mistakes: [
        {
          when: { kind: "match", pairs: [[T1, k2], [T2, k1]] },
          title: tx("Basic fee and price swapped", "Grundgebühr und Preis vertauscht"),
          say: tx("The basic fee stands **alone**, the price per unit is the one **with** $x$.", "Die Grundgebühr steht **allein**, der Preis pro Einheit ist der **mit** $x$."),
        },
        {
          when: { kind: "match", pairs: [[T3, distractor]] },
          title: tx("Price per unit as basic fee", "Preis pro Einheit als Grundgebühr"),
          say: tx(`Without a basic fee, the ${f} € are paid for **every** unit: that's ${f}x, not ${f} + x.`, `Ohne Grundgebühr werden die ${f} € für **jede** Einheit bezahlt: Das ist ${f}x, nicht ${f} + x.`),
        },
      ],
      hint: tx("Basic fee: the number on its own. Price per unit: the number in front of $x$.", "Grundgebühr: die Zahl allein. Preis pro Einheit: die Zahl vor dem $x$."),
      solution: [
        { math: `K =#k ${a}#a +#p ${r}#r x#x`, note: txs(() => `${E(T1)}: basic fee alone, price per ${per.en} in front of $x$.`, () => `${D(T1)}: Grundgebühr allein, Preis pro ${per.de} vor dem $x$.`) },
        { math: `K =#k ${r}#a +#p ${a}#r x#x`, note: txs(() => `${E(T2)}: the same numbers, but swapped roles!`, () => `${D(T2)}: dieselben Zahlen, aber vertauschte Rollen!`) },
        { math: `K =#k ${f}#r x#x`, note: txs(() => `${E(T3)}: only the part with $x$.`, () => `${D(T3)}: nur der Teil mit $x$.`) },
      ],
    };
  }
};

/** Level 2 practice: a mix of the four topics of the lesson. */
export function generate2(rng: Rng): Exercise {
  const shape = weighted<Tpl>(rng, [
    [22, compound],
    [8, mapToReal],
    [6, realToMap],
    [4, findScale],
    [3, planToReal],
    [3, enlarged],
    [8, meanPlain],
    [6, meanNeeded],
    [4, meanChanged],
    [4, meanAdded],
    [9, tariffEven],
    [5, tariffCost],
    [6, tariffCheaper],
    [6, tariffMatch],
  ]);
  return shape(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const pumpsExample: Compound = {
  inverse: true,
  p: PUMPS,
  q: TANKS,
  r: TIME,
  P1: 4,
  Q1: 1,
  R1: 6,
  P2: 3,
  Q2: 2,
  given: tx("**Given:** 4 pumps fill 1 tank in 6 h. **Wanted:** the time for 3 pumps and 2 tanks.", "**Gegeben:** 4 Pumpen füllen 1 Becken in 6 h. **Gesucht:** die Zeit für 3 Pumpen und 2 Becken."),
  answer: tx("3 pumps need 16 hours for 2 tanks.", "3 Pumpen brauchen für 2 Becken 16 Stunden."),
};

const workers = COMPOUND[2];
const workersCheck = compoundExercise(workers, 6, 300, 5, 400, 10);

const scaleFrames: Frame[] = [
  { math: mb((s) => `1#a "cm"#ua \\to#ar ${s.m(25000, "b")} "cm"#ub`), note: tx("Scale **1 : 25 000**: 1 cm on the map stands for 25 000 cm in reality.", "Maßstab **1 : 25 000**: 1 cm auf der Karte steht für 25.000 cm in Wirklichkeit.") },
  { math: `1#a "cm"#ua \\to#ar 250#b "m"#ub`, note: tx("Cross out two zeros: 25 000 cm = 250 m (100 cm = 1 m).", "Zwei Nullen weg: 25.000 cm = 250 m (100 cm = 1 m).") },
  { math: mb((s) => `${s.m(7.4, "a")} "cm"#ua \\to#ar ${s.m(7.4, "f")} \\cdot#op 250#b "m"#ub`), note: tx("The path is 7.4 cm on the map. Every centimetre is 250 m: multiply.", "Der Weg ist auf der Karte 7,4 cm lang. Jeder Zentimeter sind 250 m: multiplizieren.") },
  { math: mb((s) => `${s.m(7.4, "a")} "cm"#ua \\to#ar 1850#b "m"#ub`), note: tx("$7.4 \\cdot 250 = 1850$.", "$7,4 \\cdot 250 = 1850$.") },
  { math: mb((s) => `${s.m(7.4, "a")} "cm"#ua \\to#ar ${s.m(1.85, "b")} "km"#ub`), highlight: ["b", "ub"], note: tx("1000 m = 1 km. **Answer:** In reality the path is 1.85 km long.", "1000 m = 1 km. **Antwort:** In Wirklichkeit ist der Weg 1,85 km lang.") },
];

const lapsFrames: Frame[] = [
  { math: `\\frac{64#v0 + 70#v1 + 66#v2 + 72#v3 + 68#v4}{5#n}`, note: tx("Tim's five laps: 64 s, 70 s, 66 s, 72 s and 68 s. Mean = sum of all values : number of values.", "Tims fünf Runden: 64 s, 70 s, 66 s, 72 s und 68 s. Mittelwert = Summe aller Werte : Anzahl der Werte.") },
  { math: `\\frac{340#s}{5#n}`, note: tx("Add them up: 340 s in total.", "Alles addiert: 340 s insgesamt.") },
  { math: `\\frac{340#s}{5#n} =#eq 68#m "s"#u`, highlight: ["m", "u"], note: tx("$340 : 5 = 68$. On average Tim needs **68 s** per lap.", "$340 : 5 = 68$. Im Durchschnitt braucht Tim **68 s** pro Runde.") },
  { math: `\\frac{340#s - 10#d}{5#n}`, note: tx("Oops: one lap was 62 s, not 72 s. The sum gets **10 smaller**.", "Hoppla: Eine Runde dauerte 62 s statt 72 s. Die Summe wird **um 10 kleiner**.") },
  { math: `\\frac{330#s}{5#n} =#eq 66#m "s"#u`, highlight: ["m"], note: tx("$330 : 5 = 66$. The mean only drops by **10 : 5 = 2** seconds: the change is shared by all five laps.", "$330 : 5 = 66$. Der Mittelwert sinkt nur um **10 : 5 = 2** Sekunden: Die Änderung verteilt sich auf alle fünf Runden.") },
];

const taxiFrames: Frame[] = [
  { math: `K_A#ka =#e1 4#a1 +#p1 2#r1 x#x1`, note: tx("**Taxi A:** 4 € basic fare plus 2 € per km. $x$ is the distance in km, $K$ the cost in €.", "**Taxi A:** 4 € Grundpreis plus 2 € pro km. $x$ ist die Strecke in km, $K$ die Kosten in €.") },
  { math: mb((s) => `K_A#ka =#e1 4#a1 +#p1 2#r1 x#x1 \\quad K_B#kb =#e2 7#a2 +#p2 ${s.m(1.5, "r2")} x#x2`), note: tx("**Taxi B:** 7 € basic fare, but only 1.50 € per km.", "**Taxi B:** 7 € Grundpreis, aber nur 1,50 € pro km.") },
  { math: mb((s) => `4#a1 +#p1 2#r1 x#x1 =#eq 7#a2 +#p2 ${s.m(1.5, "r2")} x#x2`), note: tx("When do both cost the same? Set the terms equal.", "Wann kosten beide gleich viel? Setz die Terme gleich.") },
  { math: mb((s) => `${s.m(0.5, "r1")} x#x1 =#eq 3#a2`), note: tx("Subtract $1.5x$ and 4 on both sides.", "Auf beiden Seiten $1,5x$ und 4 abziehen.") },
  { math: `x#x1 =#eq 6#a2`, highlight: ["a2"], note: tx("$3 : 0.5 = 6$. At **6 km** both cost $4 + 2 \\cdot 6 = 16$ €: the break-even point.", "$3 : 0,5 = 6$. Bei **6 km** kosten beide $4 + 2 \\cdot 6 = 16$ €: der Gleichstand.") },
  {
    math: tx(`x < 6 \\Rightarrow "A cheaper" \\quad x > 6 \\Rightarrow "B cheaper"`, `x < 6 \\Rightarrow "A günstiger" \\quad x > 6 \\Rightarrow "B günstiger"`),
    note: tx("Shorter rides: A wins (smaller basic fare). Longer rides: B wins (smaller price per km).", "Kürzere Fahrten: A gewinnt (kleinerer Grundpreis). Längere Fahrten: B gewinnt (kleinerer Preis pro km)."),
  },
];

/** Level 2 (Klasse 7–8): compound rule of three, scale, averages and tariffs. */
export const level2: LevelLesson = {
  summary: [
    {
      title: tx("Compound rule of three", "Zusammengesetzter Dreisatz"),
      body: tx(
        "Change **one** quantity at a time, via the unit. For each change ask: the more, the more (same operation on the right) or the more, the less (opposite operation)?",
        "Ändere immer nur **eine** Größe, über die Einheit. Frag bei jeder Änderung: je mehr, desto mehr (rechts gleich rechnen) oder je mehr, desto weniger (rechts umgekehrt)?",
      ),
      examples: [
        tx('4 "pumps", 1 "tank" \\to 6 "h"', '4 "Pumpen", 1 "Becken" \\to 6 "h"'),
        tx('1 "pump", 1 "tank" \\to 24 "h"', '1 "Pumpe", 1 "Becken" \\to 24 "h"'),
        tx('1 "pump", 2 "tanks" \\to 48 "h"', '1 "Pumpe", 2 "Becken" \\to 48 "h"'),
        tx('3 "pumps", 2 "tanks" \\to 16 "h"', '3 "Pumpen", 2 "Becken" \\to 16 "h"'),
      ],
      tone: "rule",
    },
    {
      title: tx("Scale 1 : n", "Maßstab 1 : n"),
      body: tx(
        "1 cm on the map is n cm in reality. Map → reality: multiply by n. Reality → map: divide by n. Always in **cm** first, then convert. Enlargements are written the other way round, like 5 : 1.",
        "1 cm auf der Karte sind n cm in Wirklichkeit. Karte → Wirklichkeit: mal n. Wirklichkeit → Karte: durch n. Immer zuerst in **cm**, dann umrechnen. Vergrößerungen schreibt man andersherum, z. B. 5 : 1.",
      ),
      examples: [mb((s) => `1 : ${s.m(25000)} \\quad 1 "cm" \\to 250 "m"`), mb((s) => `${s.m(100000)} "cm" = 1000 "m" = 1 "km"`)],
      tone: "rule",
    },
    {
      title: tx("The mean (average)", "Der Mittelwert (Durchschnitt)"),
      body: tx("Add all the values and divide by how many there are.", "Addiere alle Werte und teile durch ihre Anzahl."),
      examples: [tx('"mean" = \\frac{"sum"}{"number of values"}', '"Mittelwert" = \\frac{"Summe"}{"Anzahl"}'), "\\frac{64 + 70 + 66 + 72 + 68}{5} = 68"],
      tone: "rule",
    },
    {
      title: tx("Changing one value", "Ein Wert ändert sich"),
      body: tx(
        "If one of n values changes by d, the sum changes by d, but the mean only by d : n. For a target mean: target · new number of values − old sum = the value you need.",
        "Ändert sich einer von n Werten um d, ändert sich die Summe um d, der Mittelwert aber nur um d : n. Für einen Wunschschnitt: Wunschschnitt · neue Anzahl − alte Summe = der nötige Wert.",
      ),
      examples: ["340 - 10 = 330 , \\quad \\frac{10}{5} = 2", "14 \\cdot 5 - 54 = 16"],
      tone: "tip",
    },
    {
      title: tx("Comparing tariffs", "Tarife vergleichen"),
      body: tx(
        "Cost = basic fee + price per unit · amount. Set the two cost terms equal: that's the break-even point. Below it, the smaller basic fee wins; above it, the smaller price per unit.",
        "Kosten = Grundgebühr + Preis pro Einheit · Menge. Setz die beiden Kostenterme gleich: Dort liegt der Gleichstand. Darunter gewinnt die kleinere Grundgebühr, darüber der kleinere Preis pro Einheit.",
      ),
      examples: [mb((s) => `K_A = 4 + 2x , \\quad K_B = 7 + ${s.m(1.5)}x`), mb((s) => `4 + 2x = 7 + ${s.m(1.5)}x \\Rightarrow x = 6`)],
      tone: "rule",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Scale: forgetting to convert (1 km = 100 000 cm). Mean: dividing by the wrong number of values. Tariffs: forgetting the basic fee, or counting it for every unit.",
        "Maßstab: das Umrechnen vergessen (1 km = 100.000 cm). Mittelwert: durch die falsche Anzahl teilen. Tarife: die Grundgebühr vergessen oder für jede Einheit zählen.",
      ),
      examples: [mb((s) => `${s.m(150000)} "cm" = ${s.m(1.5)} "km"`)],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("The rule of three in several steps", "Der zusammengesetzte Dreisatz"),
      blob: tx("Now two things change at once. No problem: one after the other!", "Jetzt ändern sich gleich zwei Dinge. Kein Problem: eins nach dem anderen!"),
      body: tx(
        "**4 pumps fill a tank in 6 hours. How long do 3 pumps need for 2 tanks?** Change only **one** quantity at a time and go via the unit (1 pump, 1 tank). For each change ask: the more, the more? Or the more, the less?",
        "**4 Pumpen füllen ein Becken in 6 Stunden. Wie lange brauchen 3 Pumpen für 2 Becken?** Ändere immer nur **eine** Größe und rechne über die Einheit (1 Pumpe, 1 Becken). Frag dich bei jeder Änderung: je mehr, desto mehr? Oder je mehr, desto weniger?",
      ),
      frames: compoundFrames(pumpsExample),
    },
    {
      type: "check",
      blob: tx("Workers and area: which one is inverse?", "Arbeiter und Fläche: Was ist hier antiproportional?"),
      exercise: workersCheck,
    },
    {
      type: "explain",
      title: tx("Scale: 1 : 25 000", "Maßstab: 1 : 25 000"),
      blob: tx("Maps shrink the world. The scale tells you by how much!", "Karten machen die Welt klein. Der Maßstab sagt dir, wie sehr!"),
      body: tx(
        "On a hiking map with the scale **1 : 25 000**, every length is 25 000 times smaller than in reality. The path from the hut to the lake is **7.4 cm** long on the map. How long is it really?",
        "Auf einer Wanderkarte im Maßstab **1 : 25 000** ist jede Strecke 25.000-mal kleiner als in Wirklichkeit. Der Weg von der Hütte zum See ist auf der Karte **7,4 cm** lang. Wie lang ist er wirklich?",
      ),
      frames: scaleFrames,
    },
    {
      type: "widget",
      title: tx("Measure on the map", "Miss auf der Karte"),
      blob: tx("Drag the pins and switch the scale. Same map distance, different reality!", "Zieh die Nadeln und wechsle den Maßstab. Gleiche Strecke auf der Karte, andere Wirklichkeit!"),
      body: tx(
        "A small town map with a scale bar. Measure between two places and see how the scale turns map centimetres into metres and kilometres.",
        "Ein kleiner Stadtplan mit Maßstabsleiste. Miss zwischen zwei Orten und sieh, wie der Maßstab aus Kartenzentimetern Meter und Kilometer macht.",
      ),
      widget: MapScale,
    },
    {
      type: "check",
      blob: tx("This time the other way round: from reality to the map.", "Diesmal andersherum: von der Wirklichkeit auf die Karte."),
      exercise: {
        instruction: SCALE_INSTR,
        text: tx(
          "The path from the station to the castle is 3 km long in reality. How long is it on a map with the scale 1 : 50 000? Give the answer in cm.",
          "Der Weg vom Bahnhof zur Burg ist in Wirklichkeit 3 km lang. Wie lang ist er auf einer Karte im Maßstab 1 : 50 000? Gib das Ergebnis in cm an.",
        ),
        answer: numAns(6, "cm"),
        mistakes: [
          {
            when: numAns(0.06, "cm"),
            title: tx("Converted into metres only", "Nur in Meter umgerechnet"),
            say: tx("You divided **metres** by 50 000. The scale compares cm with cm: 3 km = 300 000 cm.", "Du hast **Meter** durch 50.000 geteilt. Der Maßstab vergleicht cm mit cm: 3 km = 300.000 cm."),
          },
          {
            when: numAns(0.6, "cm"),
            title: tx("1 km isn't 10 000 cm", "1 km sind nicht 10.000 cm"),
            say: tx("Careful: 1 km = 1000 m = **100 000 cm**. Count the zeros again.", "Vorsicht: 1 km = 1000 m = **100.000 cm**. Zähl die Nullen noch mal."),
          },
          {
            when: numAns(60, "cm"),
            title: tx("Millimetres, not centimetres", "Millimeter statt Zentimeter"),
            say: tx("That would be the length in mm. The question asks for cm.", "Das wäre die Länge in mm. Gefragt ist in cm."),
          },
        ],
        hint: tx("Change 3 km into cm first, then divide by 50 000.", "Rechne 3 km zuerst in cm um und teile dann durch 50.000."),
        solution: [
          { math: `3#r "km"#ur`, note: tx("The scale compares centimetres with centimetres.", "Der Maßstab vergleicht Zentimeter mit Zentimetern.") },
          { math: mb((s) => `${s.m(300000, "r")} "cm"#ur`), note: tx("1 km = 100 000 cm, so 3 km = 300 000 cm.", "1 km = 100.000 cm, also 3 km = 300.000 cm.") },
          { math: mb((s) => `${s.m(300000, "r")} "cm"#ur :#op ${s.m(50000, "n")}`), note: tx("On the map everything is 50 000 times smaller: **divide**.", "Auf der Karte ist alles 50.000-mal kleiner: **dividieren**.") },
          { math: `6#r "cm"#ur`, highlight: ["r", "ur"], note: tx("Cross out the same number of zeros: 30 : 5 = 6. **Answer:** On the map the path is 6 cm long.", "Gleich viele Nullen streichen: 30 : 5 = 6. **Antwort:** Auf der Karte ist der Weg 6 cm lang.") },
        ],
      },
    },
    {
      type: "explain",
      title: tx("The mean", "Der Mittelwert"),
      blob: tx("The mean is what everyone would get if you shared fairly.", "Der Mittelwert ist das, was jeder bekäme, wenn man gerecht teilt."),
      body: tx(
        "**Tim runs five laps: 64 s, 70 s, 66 s, 72 s and 68 s. What is his average time?** The mean (arithmetic average) is the sum of all values divided by their number. And if one value changes, the change is shared by all of them.",
        "**Tim läuft fünf Runden: 64 s, 70 s, 66 s, 72 s und 68 s. Wie lange braucht er im Durchschnitt?** Der Mittelwert (arithmetisches Mittel) ist die Summe aller Werte geteilt durch ihre Anzahl. Und ändert sich ein Wert, verteilt sich die Änderung auf alle.",
      ),
      frames: lapsFrames,
    },
    {
      type: "widget",
      title: tx("The mean as levelling out", "Der Mittelwert als Ausgleich"),
      blob: tx("Pull a bar up by 5 and watch: the line only moves by 1!", "Zieh einen Balken um 5 hoch und schau: Die Linie wandert nur um 1!"),
      body: tx(
        "Five test scores as bars, the dashed line is their mean. Level them out to see the mean as a fair share, and add or remove values.",
        "Fünf Testergebnisse als Balken, die gestrichelte Linie ist ihr Mittelwert. Gleich sie aus, um den Mittelwert als gerechten Anteil zu sehen, und füge Werte hinzu oder nimm welche weg.",
      ),
      widget: MeanLevel,
    },
    {
      type: "check",
      blob: tx("Think of the total, not the single test!", "Denk an die Summe, nicht an den einzelnen Test!"),
      exercise: {
        instruction: MEAN_INSTR,
        text: tx(
          "Mia scored 14, 11, 17 and 12 points in the first four vocabulary tests. How many points does she need in the fifth test to get an average of exactly 14 points?",
          "Mia hatte in den ersten vier Vokabeltests 14, 11, 17 und 12 Punkte. Wie viele Punkte braucht sie im fünften Test für einen Durchschnitt von genau 14 Punkten?",
        ),
        answer: numAns(16, tx("points", "Punkte")),
        mistakes: [
          {
            when: numAns(2, tx("points", "Punkte")),
            title: tx("Counted the old number of tests", "Mit der alten Anzahl gerechnet"),
            say: tx("With the fifth test there are **5** tests. So the total must be 14 · 5, not 14 · 4.", "Mit dem fünften Test sind es **5** Tests. Die Summe muss also 14 · 5 sein, nicht 14 · 4."),
          },
          {
            when: numAns(14, tx("points", "Punkte")),
            title: tx("Just the target", "Nur der Zielwert"),
            say: tx("With exactly 14 points the average stays below 14: the old tests pull it down. Work with the total.", "Mit genau 14 Punkten bleibt der Schnitt unter 14: Die alten Tests ziehen ihn runter. Rechne mit der Summe."),
          },
          {
            when: numAns(14.5, tx("points", "Punkte")),
            title: tx("Only made up the gap once", "Den Abstand nur einmal ausgeglichen"),
            say: tx("Nice idea, but the missing 0.5 points add up over **all four** old tests. Use the total.", "Gute Idee, aber die fehlenden 0,5 Punkte summieren sich über **alle vier** alten Tests. Rechne mit der Summe."),
          },
        ],
        hint: tx("With 5 tests and an average of 14, the total must be 14 · 5 = 70.", "Bei 5 Tests und einem Schnitt von 14 muss die Summe 14 · 5 = 70 sein."),
        solution: [
          { math: `\\frac{14#v0 + 11#v1 + 17#v2 + 12#v3 + x#x}{5#n} =#eq 14#t`, note: tx("Five tests, the missing score is $x$.", "Fünf Tests, die fehlende Punktzahl ist $x$.") },
          { math: `14#v0 + 11#v1 + 17#v2 + 12#v3 + x#x =#eq 70#t`, note: tx("An average of 14 for 5 tests means a total of $14 \\cdot 5 = 70$.", "Ein Schnitt von 14 bei 5 Tests heißt: Summe $14 \\cdot 5 = 70$.") },
          { math: `54#s + x#x =#eq 70#t`, note: tx("The first four tests add up to 54.", "Die ersten vier Tests ergeben zusammen 54.") },
          { math: `x#x =#eq 16#t`, highlight: ["t"], note: tx("$70 - 54 = 16$. **Answer:** Mia needs 16 points.", "$70 - 54 = 16$. **Antwort:** Mia braucht 16 Punkte.") },
        ],
      },
    },
    {
      type: "explain",
      title: tx("Comparing tariffs", "Tarife vergleichen"),
      blob: tx("Cheap or expensive? It depends on how far you go!", "Billig oder teuer? Kommt drauf an, wie weit du fährst!"),
      body: tx(
        "**Taxi A: 4 € basic fare plus 2 € per km. Taxi B: 7 € basic fare plus 1.50 € per km. Which one is cheaper?** Write each tariff as a cost term. Where both cost the same is the **break-even point**.",
        "**Taxi A: 4 € Grundpreis plus 2 € pro km. Taxi B: 7 € Grundpreis plus 1,50 € pro km. Welches ist günstiger?** Schreib jeden Tarif als Kostenterm. Wo beide gleich viel kosten, liegt der **Gleichstand**.",
      ),
      frames: taxiFrames,
    },
    {
      type: "widget",
      title: tx("Tariff calculator", "Der Tarifrechner"),
      blob: tx("Slide along the axis and watch which line is lower!", "Fahr an der Achse entlang und schau, welche Gerade unten liegt!"),
      body: tx(
        "Each tariff is a straight line: the basic fee is where it starts, the price per unit is how steep it is. Where the lines cross, both cost the same.",
        "Jeder Tarif ist eine Gerade: Die Grundgebühr ist ihr Startwert, der Preis pro Einheit ihre Steigung. Wo sich die Geraden schneiden, kosten beide gleich viel.",
      ),
      widget: TariffLab,
    },
    {
      type: "check",
      blob: tx("Set the two terms equal!", "Setz die beiden Terme gleich!"),
      exercise: {
        instruction: TARIFF_INSTR,
        text: tx(
          "A climbing gym: **single ticket** 8 € per visit. **Monthly plan:** 30 € a month plus 3 € per visit. For how many visits a month do both cost the same?",
          "Eine Kletterhalle: **Einzelkarte** 8 € pro Besuch. **Monatsabo:** 30 € im Monat plus 3 € pro Besuch. Bei wie vielen Besuchen im Monat kosten beide gleich viel?",
        ),
        answer: numAns(6, tx("visits", "Besuche")),
        mistakes: [
          {
            when: numAns(3.75, tx("visits", "Besuche"), { tolerance: 0.02 }),
            title: tx("Visits in the plan forgotten", "Besuche im Abo vergessen"),
            say: tx("With the monthly plan you also pay 3 € per visit. Set up both terms: $8x$ and $30 + 3x$.", "Auch mit dem Abo zahlst du 3 € pro Besuch. Stell beide Terme auf: $8x$ und $30 + 3x$."),
          },
          {
            when: numAns(10, tx("visits", "Besuche")),
            title: tx("Divided by one price only", "Nur durch einen Preis geteilt"),
            say: tx("Both tariffs grow with every visit. What counts is the **difference**: 8 € − 3 € = 5 € per visit.", "Beide Tarife wachsen mit jedem Besuch. Entscheidend ist der **Unterschied**: 8 € − 3 € = 5 € pro Besuch."),
          },
          {
            when: numAns(48, tx("visits", "Besuche")),
            title: tx("The cost, not the visits", "Die Kosten statt der Besuche"),
            say: tx("48 € is the price at the break-even point. The question asks for the number of visits.", "48 € ist der Preis beim Gleichstand. Gefragt ist nach der Zahl der Besuche."),
          },
        ],
        hint: tx("Single ticket: $8x$. Monthly plan: $30 + 3x$. Set them equal.", "Einzelkarte: $8x$. Monatsabo: $30 + 3x$. Setz sie gleich."),
        solution: [
          { math: `8#r1 x#x1 =#eq 30#a2 +#p2 3#r2 x#x2`, note: tx("$x$ = number of visits. Single ticket $8x$, monthly plan $30 + 3x$.", "$x$ = Anzahl der Besuche. Einzelkarte $8x$, Monatsabo $30 + 3x$.") },
          { math: `5#r1 x#x1 =#eq 30#a2`, note: tx("Subtract $3x$ on both sides.", "Auf beiden Seiten $3x$ abziehen.") },
          { math: `x#x1 =#eq 6#a2`, highlight: ["a2"], note: tx("$30 : 5 = 6$. **Answer:** At 6 visits both cost 48 €. From the 7th visit on, the monthly plan is cheaper.", "$30 : 5 = 6$. **Antwort:** Bei 6 Besuchen kosten beide 48 €. Ab dem 7. Besuch ist das Abo günstiger.") },
        ],
      },
    },
  ],
};
