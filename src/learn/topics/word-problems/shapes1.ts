// Level 1, extra task shapes: which calculation fits the story, proportional or inverse,
// and which number in a story isn't needed. They practise steps 2 and 3 of the plan
// (given and wanted, the operation) without the arithmetic getting in the way.

import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame } from "@/learn/types";
import { both, choice, D, E, fixedChoice, mn, NAMES, visual, type Opt } from "./kit";
import { ValueTable } from "./ValueTable";

// ---------------------------------------------------------------------------
// Which calculation fits?

type Calc = { a: number; op: "·" | ":" | "+" | "−"; b: number };
type Wrong = { c: Calc; title: Text; say: Text };
type CalcCase = { text: Text; given: Text; why: Text; right: Calc; result: number; unit: Text; answer: Text; wrongs: Wrong[] };

const OPS = { "·": "\\cdot", ":": ":", "+": "+", "−": "-" } as const;
const calcMath = (c: Calc, keys = false) => (keys ? `${c.a}#a ${OPS[c.op]}#op ${c.b}#b` : `${c.a} ${OPS[c.op]} ${c.b}`);
const calcOpt = (c: Calc): Text => `$${calcMath(c)}$`;

const BUY_ITEMS = [
  { one: "comic", many: "comics", deA: "Ein", deOne: "Comic", deMany: "Comics", p: [3, 6] },
  { one: "cinema ticket", many: "cinema tickets", deA: "Eine", deOne: "Kinokarte", deMany: "Kinokarten", p: [7, 9] },
  { one: "pool ticket", many: "pool tickets", deA: "Eine", deOne: "Karte fürs Freibad", deMany: "Karten fürs Freibad", p: [3, 5] },
  { one: "football shirt", many: "football shirts", deA: "Ein", deOne: "Trikot", deMany: "Trikots", p: [25, 39] },
  { one: "pack of pens", many: "packs of pens", deA: "Eine", deOne: "Packung Stifte", deMany: "Packungen Stifte", p: [2, 6] },
];

const CALC_CASES: ((rng: Rng) => CalcCase)[] = [
  (rng) => {
    const name = rng.pick(NAMES);
    const it = rng.pick(BUY_ITEMS);
    const p = rng.int(it.p[0], it.p[1]);
    const n = rng.pick([3, 4, 5, 6, 7, 8].filter((k) => k !== p));
    return {
      text: tx(
        `${name} buys ${n} ${it.many}. One ${it.one} costs ${p} €. How much does ${name} pay altogether?`,
        `${name} kauft ${n} ${it.deMany}. ${it.deA} ${it.deOne} kostet ${p} €. Wie viel bezahlt ${name} insgesamt?`,
      ),
      given: tx(`**Given:** ${n} ${it.many} at ${p} € each. **Wanted:** the total price.`, `**Gegeben:** ${n} ${it.deMany} zu je ${p} €. **Gesucht:** der Gesamtpreis.`),
      why: tx(`The same price ${n} times: **multiply**.`, `${n}-mal derselbe Preis: **multiplizieren**.`),
      right: { a: n, op: "·", b: p },
      result: n * p,
      unit: "€",
      answer: tx(`${name} pays ${n * p} € altogether.`, `${name} bezahlt insgesamt ${n * p} €.`),
      wrongs: [
        { c: { a: p, op: ":", b: n }, title: tx("Divided instead of multiplied", "Geteilt statt multipliziert"), say: tx(`Dividing makes it cheaper than **one** ${it.one}! ${name} pays the same price ${n} times.`, `Geteilt wird es billiger als **ein** ${it.deOne}! ${name} bezahlt ${n}-mal denselben Preis.`) },
        { c: { a: n, op: "+", b: p }, title: tx("Added instead of multiplied", "Addiert statt multipliziert"), say: tx(`${n} ${it.many} plus ${p} € mixes up things and euros. The same price ${n} times means **multiply**.`, `${n} ${it.deMany} plus ${p} € wirft Dinge und Euro durcheinander. ${n}-mal derselbe Preis heißt **multiplizieren**.`) },
        { c: { a: p, op: "−", b: n }, title: tx("Subtracted", "Subtrahiert"), say: tx(`Nothing is taken away here: ${name} buys ${n} ${it.many}, each for ${p} €.`, `Hier wird nichts weggenommen: ${name} kauft ${n} ${it.deMany} zu je ${p} €.`) },
      ],
    };
  },
  (rng) => {
    const n = rng.int(3, 8);
    const each = rng.int(4, 15);
    const T = n * each;
    const what = rng.pick([
      tx("a pizza order", "eine Pizzabestellung"),
      tx("a present for their coach", "ein Geschenk für ihre Trainerin"),
      tx("a trip to the climbing hall", "einen Ausflug in die Kletterhalle"),
      tx("a new football", "einen neuen Fußball"),
    ]);
    return {
      text: tx(`${n} friends share the cost of ${E(what)} equally. It costs ${T} € altogether. How much does each friend pay?`, `${n} Freunde teilen sich die Kosten für ${D(what)} gleichmäßig. Das kostet insgesamt ${T} €. Wie viel bezahlt jeder?`),
      given: tx(`**Given:** ${T} € altogether, ${n} friends. **Wanted:** the share of each friend.`, `**Gegeben:** ${T} € insgesamt, ${n} Freunde. **Gesucht:** der Anteil pro Person.`),
      why: tx(`Shared equally between ${n}: **divide**.`, `Gleichmäßig auf ${n} verteilt: **dividieren**.`),
      right: { a: T, op: ":", b: n },
      result: each,
      unit: "€",
      answer: tx(`Each friend pays ${each} €.`, `Jeder bezahlt ${each} €.`),
      wrongs: [
        { c: { a: T, op: "·", b: n }, title: tx("Multiplied instead of divided", "Multipliziert statt geteilt"), say: tx(`Then each of them would pay much more than the whole thing costs! Sharing means **dividing**.`, `Dann würde jeder viel mehr bezahlen, als alles zusammen kostet! Aufteilen heißt **dividieren**.`) },
        { c: { a: T, op: "−", b: n }, title: tx("Subtracted instead of divided", "Subtrahiert statt geteilt"), say: tx(`Taking ${n} away from ${T} doesn't share anything. ${T} € are split into ${n} equal parts.`, `${n} von ${T} abziehen verteilt nichts. Die ${T} € werden in ${n} gleiche Teile zerlegt.`) },
        { c: { a: n, op: ":", b: T }, title: tx("Divided the wrong way round", "Falsch herum geteilt"), say: tx(`Right idea, wrong order! The money is shared, so the money comes first: euros divided by people.`, `Richtige Idee, falsche Reihenfolge! Das Geld wird verteilt, also steht das Geld vorn: Euro geteilt durch Personen.`) },
      ],
    };
  },
  (rng) => {
    const name = rng.pick(NAMES);
    const N = rng.pick([20, 50]);
    const P = rng.int(N === 20 ? 6 : 13, N === 20 ? 17 : 38);
    const what = rng.pick([tx("a book", "ein Buch"), tx("a board game", "ein Brettspiel"), tx("a T-shirt", "ein T-Shirt"), tx("a puzzle", "ein Puzzle")]);
    return {
      text: tx(`${name} buys ${E(what)} for ${P} € and pays with a ${N} € note. How much change does ${name} get?`, `${name} kauft ${D(what)} für ${P} € und bezahlt mit einem ${N}-€-Schein. Wie viel Wechselgeld bekommt ${name}?`),
      given: tx(`**Given:** price ${P} €, paid ${N} €. **Wanted:** the change.`, `**Gegeben:** Preis ${P} €, bezahlt ${N} €. **Gesucht:** das Wechselgeld.`),
      why: tx(`The change is what's left of the ${N} €: **subtract** the price.`, `Wechselgeld ist, was von den ${N} € übrig bleibt: Preis **abziehen**.`),
      right: { a: N, op: "−", b: P },
      result: N - P,
      unit: "€",
      answer: tx(`${name} gets ${N - P} € change.`, `${name} bekommt ${N - P} € zurück.`),
      wrongs: [
        { c: { a: N, op: "+", b: P }, title: tx("Added instead of subtracted", "Addiert statt subtrahiert"), say: tx(`Then ${name} would get back more than the ${N} € note! The price has to come **off**.`, `Dann bekäme ${name} mehr zurück als den ${N}-€-Schein! Der Preis muss **abgezogen** werden.`) },
        { c: { a: P, op: "−", b: N }, title: tx("Wrong order", "Falsche Reihenfolge"), say: tx(`Careful with the order: ${P} − ${N} is below zero. Start with the money ${name} hands over.`, `Achtung, Reihenfolge: ${P} − ${N} ist kleiner als null. Fang mit dem Geld an, das ${name} hingibt.`) },
        { c: { a: N, op: ":", b: P }, title: tx("Divided", "Geteilt"), say: tx(`Nothing is shared here. Change is the difference between the note and the price.`, `Hier wird nichts verteilt. Das Wechselgeld ist der Unterschied zwischen Schein und Preis.`) },
      ],
    };
  },
  (rng) => {
    const t = rng.int(2, 5);
    const v = rng.pick([4, 5, 6, 12, 14, 15, 16, 18, 20]);
    const s = v * t;
    const who = v <= 6 ? tx("A hiking group", "Eine Wandergruppe") : tx("A cycling club", "Ein Radsportverein");
    return {
      text: tx(`${E(who)} covers ${s} km in ${t} hours. What is its average speed?`, `${D(who)} legt in ${t} Stunden ${s} km zurück. Wie hoch ist die Durchschnittsgeschwindigkeit?`),
      given: tx(`**Given:** ${s} km in ${t} h. **Wanted:** the speed in km/h.`, `**Gegeben:** ${s} km in ${t} h. **Gesucht:** die Geschwindigkeit in km/h.`),
      why: tx(`Speed = distance : time. km/h means: km **per** hour.`, `Geschwindigkeit = Strecke : Zeit. km/h heißt: km **pro** Stunde.`),
      right: { a: s, op: ":", b: t },
      result: v,
      unit: "km/h",
      answer: tx(`The average speed is ${v} km/h.`, `Die Durchschnittsgeschwindigkeit beträgt ${v} km/h.`),
      wrongs: [
        { c: { a: s, op: "·", b: t }, title: tx("Multiplied instead of divided", "Multipliziert statt geteilt"), say: tx(`km/h asks how far you get in **one** hour. Share the ${s} km between the ${t} hours: divide.`, `km/h fragt, wie weit man in **einer** Stunde kommt. Verteil die ${s} km auf ${t} Stunden: teilen.`) },
        { c: { a: t, op: ":", b: s }, title: tx("Divided the wrong way round", "Falsch herum geteilt"), say: tx(`That would be hours per kilometre. For km/h, the kilometres come first: distance : time.`, `Das wären Stunden pro Kilometer. Für km/h stehen die Kilometer vorn: Strecke : Zeit.`) },
        { c: { a: s, op: "−", b: t }, title: tx("Subtracted", "Subtrahiert"), say: tx(`Kilometres minus hours doesn't make sense. Speed is distance **divided** by time.`, `Kilometer minus Stunden ergibt keinen Sinn. Geschwindigkeit ist Strecke **geteilt** durch Zeit.`) },
      ],
    };
  },
  (rng) => {
    const t = rng.int(2, 6);
    const v = rng.pick([60, 70, 80, 90, 100, 120]);
    const what = rng.pick([tx("A coach", "Ein Reisebus"), tx("A train", "Ein Zug"), tx("A lorry", "Ein Lkw")]);
    return {
      text: tx(`${E(what)} travels at ${v} km/h for ${t} hours. How far does it get?`, `${D(what)} fährt ${t} Stunden lang mit ${v} km/h. Wie weit kommt er?`),
      given: tx(`**Given:** ${v} km/h for ${t} h. **Wanted:** the distance.`, `**Gegeben:** ${v} km/h, ${t} h lang. **Gesucht:** die Strecke.`),
      why: tx(`${v} km in **every** hour, for ${t} hours: **multiply**.`, `In **jeder** Stunde ${v} km, und das ${t} Stunden lang: **multiplizieren**.`),
      right: { a: v, op: "·", b: t },
      result: v * t,
      unit: "km",
      answer: tx(`It travels ${v * t} km.`, `Er fährt ${v * t} km weit.`),
      wrongs: [
        { c: { a: v, op: ":", b: t }, title: tx("Divided instead of multiplied", "Geteilt statt multipliziert"), say: tx(`In ${t} hours it gets **further** than in one hour, not less far. Multiply.`, `In ${t} Stunden kommt er **weiter** als in einer Stunde, nicht weniger weit. Multiplizieren.`) },
        { c: { a: v, op: "+", b: t }, title: tx("Added", "Addiert"), say: tx(`km/h plus hours doesn't fit together. It's ${v} km **for each** of the ${t} hours.`, `km/h plus Stunden passt nicht zusammen. Es sind ${v} km **in jeder** der ${t} Stunden.`) },
        { c: { a: t, op: ":", b: v }, title: tx("Divided the wrong way round", "Falsch herum geteilt"), say: tx(`That's a tiny number of kilometres! Distance = speed · time.`, `Das wären winzig wenige Kilometer! Strecke = Geschwindigkeit · Zeit.`) },
      ],
    };
  },
  (rng) => {
    const name = rng.pick(NAMES);
    const n = rng.pick([12, 15, 20, 25, 30, 40]);
    const d = rng.int(6, 14);
    const P = n * d;
    return {
      text: tx(`A book has ${P} pages. ${name} reads ${n} pages every day. How many days does ${name} need for the whole book?`, `Ein Buch hat ${P} Seiten. ${name} liest jeden Tag ${n} Seiten. Wie viele Tage braucht ${name} für das ganze Buch?`),
      given: tx(`**Given:** ${P} pages, ${n} pages a day. **Wanted:** the number of days.`, `**Gegeben:** ${P} Seiten, ${n} Seiten pro Tag. **Gesucht:** die Anzahl der Tage.`),
      why: tx(`How many times do ${n} pages fit into ${P} pages? **Divide**.`, `Wie oft passen ${n} Seiten in ${P} Seiten? **Dividieren**.`),
      right: { a: P, op: ":", b: n },
      result: d,
      unit: tx("days", "Tage"),
      answer: tx(`${name} needs ${d} days.`, `${name} braucht ${d} Tage.`),
      wrongs: [
        { c: { a: P, op: "·", b: n }, title: tx("Multiplied instead of divided", "Multipliziert statt geteilt"), say: tx(`That gives thousands of days! ${name} reads ${n} pages **each** day: how many times do they fit into ${P}?`, `Das ergibt Tausende Tage! ${name} liest **jeden** Tag ${n} Seiten: Wie oft passen die in ${P}?`) },
        { c: { a: P, op: "−", b: n }, title: tx("Only one day counted", "Nur ein Tag gerechnet"), say: tx(`${P} − ${n} is how many pages are left after **one** day. Keep going: divide to find all the days.`, `${P} − ${n} sind die Seiten, die nach **einem** Tag übrig sind. Teile, dann hast du alle Tage.`) },
        { c: { a: n, op: ":", b: P }, title: tx("Divided the wrong way round", "Falsch herum geteilt"), say: tx(`The whole book is shared into daily portions: pages of the book : pages per day.`, `Das ganze Buch wird in Tagesportionen zerlegt: Seiten des Buchs : Seiten pro Tag.`) },
      ],
    };
  },
  (rng) => {
    const a = rng.int(6, 25);
    return {
      text: tx(`A square sandpit has sides of ${a} m. It gets a wooden edge all the way round. How long is the edge?`, `Ein quadratischer Sandkasten hat ${a} m lange Seiten. Er bekommt ringsherum eine Holzkante. Wie lang ist die Kante?`),
      given: tx(`**Given:** a square, side ${a} m. **Wanted:** the length all the way round (the perimeter).`, `**Gegeben:** ein Quadrat mit ${a} m Seitenlänge. **Gesucht:** die Länge ringsherum (der Umfang).`),
      why: tx(`A square has **four** equal sides.`, `Ein Quadrat hat **vier** gleich lange Seiten.`),
      right: { a: 4, op: "·", b: a },
      result: 4 * a,
      unit: "m",
      answer: tx(`The edge is ${4 * a} m long.`, `Die Kante ist ${4 * a} m lang.`),
      wrongs: [
        { c: { a, op: "·", b: a }, title: tx("Area instead of perimeter", "Fläche statt Umfang"), say: tx(`${a} · ${a} is the **area** of the sandpit. The edge goes **around** it: four sides.`, `${a} · ${a} ist der **Flächeninhalt**. Die Kante geht **außen herum**: vier Seiten.`) },
        { c: { a: 2, op: "·", b: a }, title: tx("Only two sides", "Nur zwei Seiten"), say: tx(`That's only two sides. All the way round means all **four** sides.`, `Das sind nur zwei Seiten. Ringsherum heißt: alle **vier** Seiten.`) },
        { c: { a, op: "+", b: 4 }, title: tx("Added the 4", "Die 4 addiert"), say: tx(`Four sides, each ${a} m long: that's ${a} m **four times**, not ${a} m plus 4.`, `Vier Seiten, jede ${a} m lang: Das sind **viermal** ${a} m, nicht ${a} m plus 4.`) },
      ],
    };
  },
  (rng) => {
    const name = rng.pick(NAMES);
    const s = rng.pick([4, 5, 6, 8, 10, 12, 15]);
    const w = rng.int(5, 12);
    const W = s * w;
    const what = rng.pick([tx("a skateboard", "ein Skateboard"), tx("headphones", "Kopfhörer"), tx("a video game", "ein Videospiel"), tx("football boots", "Fußballschuhe")]);
    return {
      text: tx(`${name} wants to buy ${E(what)} for ${W} € and saves ${s} € every week. How many weeks does ${name} have to save?`, `${name} möchte sich ${D(what)} für ${W} € kaufen und spart jede Woche ${s} €. Wie viele Wochen muss ${name} sparen?`),
      given: tx(`**Given:** ${W} € needed, ${s} € a week. **Wanted:** the number of weeks.`, `**Gegeben:** ${W} € gebraucht, ${s} € pro Woche. **Gesucht:** die Anzahl der Wochen.`),
      why: tx(`How many times do ${s} € fit into ${W} €? **Divide**.`, `Wie oft passen ${s} € in ${W} €? **Dividieren**.`),
      right: { a: W, op: ":", b: s },
      result: w,
      unit: tx("weeks", "Wochen"),
      answer: tx(`${name} has to save for ${w} weeks.`, `${name} muss ${w} Wochen sparen.`),
      wrongs: [
        { c: { a: W, op: "·", b: s }, title: tx("Multiplied instead of divided", "Multipliziert statt geteilt"), say: tx(`That would be hundreds of weeks! Find out how many times ${s} € fit into ${W} €.`, `Das wären Hunderte Wochen! Finde heraus, wie oft ${s} € in ${W} € passen.`) },
        { c: { a: W, op: "−", b: s }, title: tx("Only one week", "Nur eine Woche"), say: tx(`${W} − ${s} is what's still missing after **one** week. Divide to count all the weeks at once.`, `${W} − ${s} ist, was nach **einer** Woche noch fehlt. Teile, dann zählst du alle Wochen auf einmal.`) },
        { c: { a: s, op: ":", b: W }, title: tx("Divided the wrong way round", "Falsch herum geteilt"), say: tx(`The price is split into weekly amounts: price : savings per week.`, `Der Preis wird in Wochenbeträge zerlegt: Preis : Sparbetrag pro Woche.`) },
      ],
    };
  },
];

export function whichCalc(rng: Rng): Exercise {
  const c = rng.pick(CALC_CASES)(rng);
  const opts: Opt[] = [{ text: calcOpt(c.right) }, ...c.wrongs.map((w) => ({ text: calcOpt(w.c), title: w.title, say: w.say }))];
  const { answer, mistakes } = choice(rng, opts);
  const res = both((l) => `${calcMath(c.right, true)} =#eq ${mn(c.result, l, "r")} "${l === "de" ? D(c.unit) : E(c.unit)}"#u`);
  const solution: Frame[] = [
    { math: calcMath(c.right, true), note: both((l) => `${l === "de" ? D(c.given) : E(c.given)} ${l === "de" ? D(c.why) : E(c.why)}`) },
    { math: res, highlight: ["r", "u"], note: both((l) => `${l === "de" ? "**Antwort:**" : "**Answer:**"} ${l === "de" ? D(c.answer) : E(c.answer)}`) },
  ];
  return {
    instruction: tx("Which calculation fits?", "Welche Rechnung passt?"),
    text: c.text,
    answer,
    mistakes,
    hint: tx("First find what's given and what's wanted. Then ask: same amount several times, shared, taken away or added?", "Finde zuerst Gegebenes und Gesuchtes. Dann frag dich: mehrmals dasselbe, verteilt, weggenommen oder dazu?"),
    solution,
  };
}

// ---------------------------------------------------------------------------
// Proportional, inverse or neither?

type Kind = 0 | 1 | 2;
const KIND_OPTS: Text[] = [
  tx("proportional (double → double)", "proportional (doppelt → doppelt)"),
  tx("inverse (double → half)", "antiproportional (doppelt → halb)"),
  tx("neither of them", "keins von beiden"),
];

const PAIRS: { a: Text; b: Text; kind: Kind; why: Text }[] = [
  { a: tx("kilograms of apples", "Kilogramm Äpfel"), b: tx("their price", "ihr Preis"), kind: 0, why: tx("Twice the apples cost twice as much.", "Doppelt so viele Äpfel kosten doppelt so viel.") },
  { a: tx("litres of petrol you fill up", "getankte Liter Benzin"), b: tx("the price at the pump", "der Preis an der Zapfsäule"), kind: 0, why: tx("Every litre costs the same, so twice the litres cost twice as much.", "Jeder Liter kostet gleich viel, also kosten doppelt so viele Liter doppelt so viel.") },
  { a: tx("hours worked (fixed hourly wage)", "Arbeitsstunden (fester Stundenlohn)"), b: tx("the pay", "der Lohn"), kind: 0, why: tx("Twice the hours, twice the pay.", "Doppelt so viele Stunden, doppelter Lohn.") },
  { a: tx("cakes baked from one recipe", "gebackene Kuchen nach einem Rezept"), b: tx("the flour needed", "das benötigte Mehl"), kind: 0, why: tx("Two cakes need twice the flour.", "Zwei Kuchen brauchen doppelt so viel Mehl.") },
  { a: tx("minutes cycling at a steady speed", "Minuten Radfahren bei gleichem Tempo"), b: tx("the distance covered", "die zurückgelegte Strecke"), kind: 0, why: tx("At the same speed, twice the time takes you twice as far.", "Bei gleichem Tempo kommst du in doppelter Zeit doppelt so weit.") },
  { a: tx("cinema tickets bought", "gekaufte Kinokarten"), b: tx("the total price", "der Gesamtpreis"), kind: 0, why: tx("Each ticket costs the same: twice the tickets, twice the price.", "Jede Karte kostet gleich viel: doppelt so viele Karten, doppelter Preis.") },
  { a: tx("painters working on the same hall", "Maler, die dieselbe Halle streichen"), b: tx("the time they need", "die Zeit, die sie brauchen"), kind: 1, why: tx("Twice the painters need half the time.", "Doppelt so viele Maler brauchen die halbe Zeit.") },
  { a: tx("friends sharing one pizza bill", "Freunde, die sich eine Pizzarechnung teilen"), b: tx("what each of them pays", "der Betrag pro Person"), kind: 1, why: tx("Twice the friends, each pays half.", "Doppelt so viele Freunde, jeder zahlt die Hälfte.") },
  { a: tx("the speed on the same route", "das Tempo auf derselben Strecke"), b: tx("the travel time", "die Fahrzeit"), kind: 1, why: tx("Twice as fast means half the time.", "Doppelt so schnell heißt: halbe Zeit.") },
  { a: tx("pumps emptying the same pool", "Pumpen, die dasselbe Becken leeren"), b: tx("the time it takes", "die Dauer"), kind: 1, why: tx("Twice the pumps, half the time.", "Doppelt so viele Pumpen, halbe Zeit.") },
  { a: tx("horses eating from the same hay stock", "Pferde, die vom selben Heuvorrat fressen"), b: tx("how many days the hay lasts", "wie viele Tage das Heu reicht"), kind: 1, why: tx("Twice the horses eat it up in half the time.", "Doppelt so viele Pferde fressen es in der halben Zeit auf.") },
  { a: tx("the width of rectangles with the same area", "die Breite von Rechtecken mit gleichem Flächeninhalt"), b: tx("their length", "ihre Länge"), kind: 1, why: tx("Width times length stays the same: double the width, half the length.", "Breite mal Länge bleibt gleich: doppelte Breite, halbe Länge.") },
  { a: tx("a child's age", "das Alter eines Kindes"), b: tx("its height", "seine Körpergröße"), kind: 2, why: tx("A 10-year-old isn't twice as tall as a 5-year-old.", "Ein Zehnjähriges ist nicht doppelt so groß wie ein Fünfjähriges.") },
  { a: tx("kilometres in a taxi (with a base fare)", "Kilometer im Taxi (mit Grundpreis)"), b: tx("the fare", "der Fahrpreis"), kind: 2, why: tx("It goes up, but the base fare is paid only once: twice the distance costs **less** than twice as much.", "Es wird zwar mehr, aber den Grundpreis zahlst du nur einmal: Doppelte Strecke kostet **weniger** als das Doppelte.") },
  { a: tx("minutes a candle burns", "Minuten, die eine Kerze brennt"), b: tx("the height of the candle", "die Höhe der Kerze"), kind: 2, why: tx("It gets shorter, but not to half when the time doubles: it shrinks by the same amount each minute.", "Sie wird kürzer, aber bei doppelter Zeit nicht halb so hoch: Sie schrumpft jede Minute um gleich viel.") },
  { a: tx("a pizza's diameter", "der Durchmesser einer Pizza"), b: tx("its price at the pizzeria", "ihr Preis in der Pizzeria"), kind: 2, why: tx("A pizza twice as wide has four times the area, and prices don't simply double either.", "Eine doppelt so breite Pizza hat die vierfache Fläche, und der Preis verdoppelt sich auch nicht einfach.") },
  { a: tx("the goals a team scores", "die Tore einer Mannschaft"), b: tx("the minutes played", "die gespielten Minuten"), kind: 2, why: tx("Twice the playing time doesn't mean twice the goals.", "Doppelte Spielzeit heißt nicht doppelt so viele Tore.") },
  { a: tx("a phone plan's minutes (with a monthly fee)", "Minuten im Handytarif (mit Grundgebühr)"), b: tx("the bill", "die Rechnung"), kind: 2, why: tx("The monthly fee is always there, so twice the minutes don't cost twice as much.", "Die Grundgebühr kommt immer dazu, also kosten doppelt so viele Minuten nicht das Doppelte.") },
];

function kindMistakes(right: Kind, table: boolean): Opt[] {
  const say: Record<Kind, Record<Kind, [Text, Text] | null>> = {
    0: {
      0: null,
      1: [tx("It goes up, not down", "Das steigt, statt zu fallen"), table ? tx("Look again: when the top value grows, the bottom one grows too. That can't be inverse.", "Schau noch mal: Wenn der obere Wert wächst, wächst der untere mit. Das kann nicht antiproportional sein.") : tx("Think it through: if the first one doubles, does the second one really get **smaller**?", "Denk es durch: Wenn sich das Erste verdoppelt, wird das Zweite dann wirklich **kleiner**?")],
      2: [tx("Check the doubling", "Prüf das Verdoppeln"), table ? tx("Divide each bottom value by the top value: you always get the same number. That's proportional.", "Teile jeden unteren Wert durch den oberen: Es kommt immer dieselbe Zahl heraus. Das ist proportional.") : tx("Try doubling: does the second one double too? Then it **is** proportional.", "Probier das Verdoppeln: Verdoppelt sich das Zweite auch? Dann **ist** es proportional.")],
    },
    1: {
      0: [tx("Inverse, not proportional", "Antiproportional, nicht proportional"), table ? tx("When the top value grows, the bottom one **shrinks**. Multiply the pairs: the product stays the same.", "Wenn der obere Wert wächst, **schrumpft** der untere. Multipliziere die Paare: Das Produkt bleibt gleich.") : tx("Careful: more here means **less** there. Twice as many, half as much: that's inverse.", "Vorsicht: Mehr hier heißt **weniger** dort. Doppelt so viele, halb so viel: Das ist antiproportional.")],
      1: null,
      2: [tx("Check the halving", "Prüf das Halbieren"), table ? tx("Multiply top and bottom in each column: always the same product. That's inverse.", "Multipliziere oben und unten in jeder Spalte: immer dasselbe Produkt. Das ist antiproportional.") : tx("Try doubling: does the second one become exactly half? Then it **is** inverse.", "Probier das Verdoppeln: Wird das Zweite genau halb so groß? Dann **ist** es antiproportional.")],
    },
    2: {
      0: [tx("Growing isn't enough", "Wachsen reicht nicht"), table ? tx("It grows, but the quotients aren't all the same. Proportional needs double → double exactly.", "Es wächst, aber die Quotienten sind nicht alle gleich. Proportional heißt genau: doppelt → doppelt.") : tx("It grows, yes. But does it **exactly** double when the first one doubles? Not here.", "Es wird mehr, ja. Aber verdoppelt es sich **genau**, wenn sich das Erste verdoppelt? Hier nicht.")],
      1: [tx("Shrinking isn't enough", "Kleiner werden reicht nicht"), table ? tx("It gets smaller, but the products aren't all the same. Inverse needs double → half exactly.", "Es wird kleiner, aber die Produkte sind nicht alle gleich. Antiproportional heißt genau: doppelt → halb.") : tx("Something changes, but not double → half exactly. Check with a doubling.", "Da ändert sich etwas, aber nicht genau doppelt → halb. Prüf es mit einer Verdopplung.")],
      2: null,
    },
  };
  return KIND_OPTS.map((text, i) => {
    const m = say[right][i as Kind];
    return m ? { text, title: m[0], say: m[1] } : { text };
  });
}

type TableCase = { top: Text; bottom: Text; x: number[]; y: number[]; kind: Kind };

function tableCase(rng: Rng): TableCase {
  const kind = rng.int(0, 2) as Kind;
  if (kind === 0) {
    const c = rng.pick([
      { top: tx("notebooks", "Hefte"), bottom: tx("price in €", "Preis in €"), k: [2, 3, 4] },
      { top: tx("hours", "Stunden"), bottom: tx("distance in km", "Strecke in km"), k: [4, 5, 12, 15] },
      { top: tx("people", "Personen"), bottom: tx("pasta in g", "Nudeln in g"), k: [100, 125, 150] },
    ]);
    const k = rng.pick(c.k);
    const start = rng.int(1, 3);
    const x = [start, start + 1, 2 * start + 2, rng.int(2 * start + 3, 2 * start + 6)];
    return { top: c.top, bottom: c.bottom, x, y: x.map((v) => v * k), kind };
  }
  if (kind === 1) {
    const c = rng.pick([
      { top: tx("pumps", "Pumpen"), bottom: tx("time in h", "Zeit in h"), p: [12, 24, 36] },
      { top: tx("painters", "Maler"), bottom: tx("days", "Tage"), p: [24, 36, 48] },
      { top: tx("friends", "Freunde"), bottom: tx("€ per person", "€ pro Person"), p: [24, 36, 60] },
    ]);
    const P = rng.pick(c.p);
    const divs = Array.from({ length: P }, (_, i) => i + 1).filter((d) => P % d === 0 && d >= 2 && d <= 12);
    const x = rng.shuffle(divs).slice(0, 4).sort((a, b) => a - b);
    return { top: c.top, bottom: c.bottom, x, y: x.map((v) => P / v), kind };
  }
  const c = rng.pick([
    { top: tx("taxi km", "Taxi-km"), bottom: tx("fare in €", "Preis in €"), up: true },
    { top: tx("minutes", "Minuten"), bottom: tx("candle in cm", "Kerze in cm"), up: false },
    { top: tx("months", "Monate"), bottom: tx("phone bill in €", "Handyrechnung in €"), up: true },
  ]);
  const m = rng.int(2, c.up ? 4 : 3);
  const b = c.up ? rng.int(3, 9) : rng.int(25, 32);
  const xs = rng.pick([
    [1, 2, 3, 4],
    [1, 2, 4, 5],
    [2, 3, 4, 6],
    [1, 3, 4, 6],
  ]);
  return { top: c.top, bottom: c.bottom, x: xs, y: xs.map((v) => (c.up ? b + m * v : b - m * v)), kind };
}

export function propOrInverse(rng: Rng): Exercise {
  const instruction = tx("Proportional, inverse or neither?", "Proportional, antiproportional oder keins von beiden?");
  const hint = tx(
    "Double the first quantity. Does the second one double (proportional), halve (inverse), or neither?",
    "Verdopple die erste Größe. Verdoppelt sich die zweite (proportional), halbiert sie sich (antiproportional) oder keins von beiden?",
  );
  if (rng.chance(0.5)) {
    const p = rng.pick(PAIRS);
    const { answer, mistakes } = fixedChoice(kindMistakes(p.kind, false), p.kind);
    const verdict = [tx("**proportional**", "**proportional**"), tx("**inverse**", "**antiproportional**"), tx("**neither** proportional nor inverse", "**weder** proportional **noch** antiproportional")][p.kind];
    return {
      instruction,
      text: tx(`How are these two quantities related? **${E(p.a)}** and **${E(p.b)}**`, `Wie hängen diese beiden Größen zusammen? **${D(p.a)}** und **${D(p.b)}**`),
      answer,
      mistakes,
      hint,
      solution: [
        { math: tx(`2 \\cdot "first"#a \\to#ar ?#q`, `2 \\cdot "Erstes"#a \\to#ar ?#q`), note: tx("The doubling test: what happens to the second quantity when the first one doubles?", "Der Verdopplungstest: Was passiert mit der zweiten Größe, wenn sich die erste verdoppelt?") },
        {
          math: [tx(`2 \\cdot "first"#a \\to#ar 2 \\cdot "second"#q`, `2 \\cdot "Erstes"#a \\to#ar 2 \\cdot "Zweites"#q`), tx(`2 \\cdot "first"#a \\to#ar \\frac{1}{2} \\cdot "second"#q`, `2 \\cdot "Erstes"#a \\to#ar \\frac{1}{2} \\cdot "Zweites"#q`), tx(`2 \\cdot "first"#a \\to#ar "neither"#q`, `2 \\cdot "Erstes"#a \\to#ar "weder noch"#q`)][p.kind],
          highlight: ["q"],
          note: both((l) => `${l === "de" ? D(p.why) : E(p.why)} ${l === "de" ? "Also" : "So it's"} ${l === "de" ? D(verdict) : E(verdict)}.`),
        },
      ],
    };
  }
  const c = tableCase(rng);
  const { answer, mistakes } = fixedChoice(kindMistakes(c.kind, true), c.kind);
  const q = c.y.map((v, i) => v / c.x[i]);
  const p = c.y.map((v, i) => v * c.x[i]);
  const [x0, x1] = c.x;
  const [y0, y1] = c.y;
  const solution: Frame[] =
    c.kind === 0
      ? [
          { math: both((l) => `\\frac{${mn(y0, l)}}{${mn(x0, l)}} =#e1 \\frac{${mn(y1, l)}}{${mn(x1, l)}} =#e2 ${mn(q[0], l)}#k`), note: tx("Divide each bottom value by its top value (the quotient).", "Teile jeden unteren Wert durch seinen oberen (Quotient).") },
          { math: both((l) => `"${l === "de" ? "Quotient" : "quotient"}"#w =#e2 ${mn(q[0], l)}#k`), highlight: ["k"], note: tx(`Every column gives ${q[0]}: the quotient is constant, so it's **proportional**.`, `Jede Spalte ergibt ${String(q[0]).replace(".", ",")}: Der Quotient ist immer gleich, also **proportional**.`) },
        ]
      : c.kind === 1
        ? [
            { math: both((l) => `${mn(x0, l)} \\cdot ${mn(y0, l)} =#e1 ${mn(x1, l)} \\cdot ${mn(y1, l)} =#e2 ${mn(p[0], l)}#k`), note: tx("Multiply top and bottom in each column (the product).", "Multipliziere oben und unten in jeder Spalte (Produkt).") },
            { math: both((l) => `"${l === "de" ? "Produkt" : "product"}"#w =#e2 ${mn(p[0], l)}#k`), highlight: ["k"], note: tx(`Every column gives ${p[0]}: the product is constant, so it's **inverse**.`, `Jede Spalte ergibt ${p[0]}: Das Produkt ist immer gleich, also **antiproportional**.`) },
          ]
        : [
            {
              math: both((l) => `\\frac{${mn(y0, l)}}{${mn(x0, l)}} =#e1 ${mn(q[0], l)} \\quad \\frac{${mn(y1, l)}}{${mn(x1, l)}} =#e3 ${mn(q[1], l)}`),
              note: tx("The quotients are different: not proportional.", "Die Quotienten sind verschieden: nicht proportional."),
            },
            {
              math: both((l) => `${mn(x0, l)} \\cdot ${mn(y0, l)} =#e1 ${mn(p[0], l)} \\quad ${mn(x1, l)} \\cdot ${mn(y1, l)} =#e3 ${mn(p[1], l)}`),
              note: tx("The products are different too: not inverse. So it's **neither** of them.", "Die Produkte sind auch verschieden: nicht antiproportional. Also **keins von beiden**."),
            },
          ];
  return {
    instruction,
    text: tx("Look at the table. How are the two quantities related?", "Schau dir die Tabelle an. Wie hängen die beiden Größen zusammen?"),
    visual: visual(ValueTable, { rows: [{ label: c.top, values: c.x }, { label: c.bottom, values: c.y }] }),
    answer,
    mistakes,
    hint: tx(
      "Proportional: the quotient bottom : top is always the same. Inverse: the product top · bottom is always the same.",
      "Proportional: Der Quotient unten : oben ist immer gleich. Antiproportional: Das Produkt oben · unten ist immer gleich.",
    ),
    solution,
  };
}

// ---------------------------------------------------------------------------
// Which number isn't needed?

type Part = { text: Text; need: boolean; role: Text };
type Spot = { parts: Part[]; story: (p: Text[]) => Text; calc: string; answer: Text };

const SPOTS: ((rng: Rng) => Spot)[] = [
  (rng) => {
    const name = rng.pick(NAMES);
    const n = rng.int(3, 6);
    const p = rng.int(7, 14);
    const k = rng.int(120, 480);
    return {
      parts: [
        { text: tx(`${n} tickets`, `${n} Eintrittskarten`), need: true, role: tx(`You need the ${n}: ${name} pays for ${n} tickets.`, `Die ${n} brauchst du: ${name} bezahlt ${n} Karten.`) },
        { text: tx(`${k} kinds of animals`, `${k} Tierarten`), need: false, role: tx("", "") },
        { text: `${p} €`, need: true, role: tx(`You need the ${p} €: that's the price of one ticket.`, `Die ${p} € brauchst du: Das ist der Preis für eine Karte.`) },
      ],
      story: ([a, b, c]) => tx(`${name} buys ${E(a)} for the zoo. The zoo has ${E(b)}. One ticket costs ${E(c)}. How much does ${name} pay?`, `${name} kauft ${D(a)} für den Zoo. Der Zoo hat ${D(b)}. Eine Karte kostet ${D(c)}. Wie viel bezahlt ${name}?`),
      calc: `${n} \\cdot ${p} "€" = ${n * p} "€"`,
      answer: tx(`${name} pays ${n * p} €.`, `${name} bezahlt ${n * p} €.`),
    };
  },
  (rng) => {
    const t = rng.int(2, 5);
    const v = rng.pick([60, 70, 80, 90]);
    const seats = rng.int(40, 60);
    return {
      parts: [
        { text: tx(`${seats} seats`, `${seats} Sitzplätze`), need: false, role: tx("", "") },
        { text: `${v * t} km`, need: true, role: tx(`You need the ${v * t} km: that's the distance.`, `Die ${v * t} km brauchst du: Das ist die Strecke.`) },
        { text: tx(`${t} hours`, `${t} Stunden`), need: true, role: tx(`You need the ${t} hours: that's the time for the distance.`, `Die ${t} Stunden brauchst du: Das ist die Zeit für die Strecke.`) },
      ],
      story: ([a, b, c]) => tx(`A coach has ${E(a)}. It drives ${E(b)} in ${E(c)}. What is its average speed?`, `Ein Reisebus hat ${D(a)}. Er fährt ${D(b)} in ${D(c)}. Wie hoch ist seine Durchschnittsgeschwindigkeit?`),
      calc: `${v * t} "km" : ${t} "h" = ${v} "km/h"`,
      answer: tx(`The coach travels at ${v} km/h on average.`, `Der Bus fährt im Schnitt ${v} km/h.`),
    };
  },
  (rng) => {
    const a = rng.pick([4, 5, 6, 8]);
    const g = a * rng.pick([25, 50]);
    const b = a * rng.int(2, 3);
    const d = rng.pick([24, 26, 28]);
    return {
      parts: [
        { text: tx(`${a} pancakes`, `${a} Pfannkuchen`), need: true, role: tx(`You need the ${a}: the recipe is for ${a} pancakes.`, `Die ${a} brauchst du: Das Rezept ist für ${a} Pfannkuchen.`) },
        { text: `${g} g`, need: true, role: tx(`You need the ${g} g: that's the flour for ${a} pancakes.`, `Die ${g} g brauchst du: So viel Mehl braucht man für ${a} Pfannkuchen.`) },
        { text: `${d} cm`, need: false, role: tx("", "") },
        { text: tx(`${b} pancakes`, `${b} Pfannkuchen`), need: true, role: tx(`You need the ${b}: that's how many pancakes are wanted.`, `Die ${b} brauchst du: So viele Pfannkuchen sollen es werden.`) },
      ],
      story: ([p, q, r, s]) => tx(`For ${E(p)} you need ${E(q)} of flour. The pan is ${E(r)} wide. How much flour do you need for ${E(s)}?`, `Für ${D(p)} braucht man ${D(q)} Mehl. Die Pfanne ist ${D(r)} breit. Wie viel Mehl braucht man für ${D(s)}?`),
      calc: `${g} "g" : ${a} \\cdot ${b} = ${(g / a) * b} "g"`,
      answer: tx(`You need ${(g / a) * b} g of flour.`, `Man braucht ${(g / a) * b} g Mehl.`),
    };
  },
  (rng) => {
    const l = rng.int(10, 25);
    const w = rng.int(5, 9);
    const k = rng.int(3, 7);
    return {
      parts: [
        { text: `${l} m`, need: true, role: tx(`You need the ${l} m: that's the length.`, `Die ${l} m brauchst du: Das ist die Länge.`) },
        { text: `${w} m`, need: true, role: tx(`You need the ${w} m: that's the width.`, `Die ${w} m brauchst du: Das ist die Breite.`) },
        { text: tx(`${k} apple trees`, `${k} Apfelbäume`), need: false, role: tx("", "") },
      ],
      story: ([a, b, c]) => tx(`A rectangular garden is ${E(a)} long and ${E(b)} wide. ${E(c).replace(/^./, (s) => s.toUpperCase())} grow in it. How long is a fence all the way round?`, `Ein rechteckiger Garten ist ${D(a)} lang und ${D(b)} breit. Darin wachsen ${D(c)}. Wie lang ist ein Zaun einmal ringsherum?`),
      calc: `2 \\cdot ${l} "m" + 2 \\cdot ${w} "m" = ${2 * l + 2 * w} "m"`,
      answer: tx(`The fence is ${2 * l + 2 * w} m long.`, `Der Zaun ist ${2 * l + 2 * w} m lang.`),
    };
  },
  (rng) => {
    const name = rng.pick(NAMES);
    const P = rng.pick([12, 15, 20, 25]);
    const d = rng.int(6, 12);
    const c = rng.pick([9, 11, 13, 15]);
    return {
      parts: [
        { text: tx(`${P * d} pages`, `${P * d} Seiten`), need: true, role: tx(`You need the ${P * d} pages: that's the whole book.`, `Die ${P * d} Seiten brauchst du: Das ist das ganze Buch.`) },
        { text: `${c} €`, need: false, role: tx("", "") },
        { text: tx(`${P} pages`, `${P} Seiten`), need: true, role: tx(`You need the ${P} pages: that's how much ${name} reads each day.`, `Die ${P} Seiten brauchst du: So viel liest ${name} jeden Tag.`) },
      ],
      story: ([a, b, e]) => tx(`A book has ${E(a)} and costs ${E(b)}. ${name} reads ${E(e)} every day. How many days does ${name} need?`, `Ein Buch hat ${D(a)} und kostet ${D(b)}. ${name} liest jeden Tag ${D(e)}. Wie viele Tage braucht ${name}?`),
      calc: `${P * d} : ${P} = ${d}`,
      answer: tx(`${name} needs ${d} days.`, `${name} braucht ${d} Tage.`),
    };
  },
  (rng) => {
    const h = rng.int(7, 11);
    const v = rng.pick([80, 90, 100, 120]);
    const t = rng.int(2, 4);
    return {
      parts: [
        { text: tx(`${h} o'clock`, `${h} Uhr`), need: false, role: tx("", "") },
        { text: `${v} km/h`, need: true, role: tx(`You need the ${v} km/h: that's how far the train gets in one hour.`, `Die ${v} km/h brauchst du: So weit kommt der Zug in einer Stunde.`) },
        { text: tx(`${t} hours`, `${t} Stunden`), need: true, role: tx(`You need the ${t} hours: that's how long it travels.`, `Die ${t} Stunden brauchst du: So lange fährt er.`) },
      ],
      story: ([a, b, c]) => tx(`A train leaves at ${E(a)} and travels at ${E(b)}. How far does it get in ${E(c)}?`, `Ein Zug fährt um ${D(a)} los und fährt mit ${D(b)}. Wie weit kommt er in ${D(c)}?`),
      calc: `${v} "km/h" \\cdot ${t} "h" = ${v * t} "km"`,
      answer: tx(`It gets ${v * t} km far.`, `Er kommt ${v * t} km weit.`),
    };
  },
  (rng) => {
    const name = rng.pick(NAMES);
    const s = rng.pick([5, 6, 8, 10]);
    const w = rng.int(4, 9);
    const age = rng.int(10, 13);
    return {
      parts: [
        { text: `${s} €`, need: true, role: tx(`You need the ${s} €: that's what ${name} saves each week.`, `Die ${s} € brauchst du: So viel spart ${name} jede Woche.`) },
        { text: tx(`${age} years`, `${age} Jahre`), need: false, role: tx("", "") },
        { text: `${s * w} €`, need: true, role: tx(`You need the ${s * w} €: that's the price of the game.`, `Die ${s * w} € brauchst du: Das ist der Preis des Spiels.`) },
      ],
      story: ([a, b, c]) => tx(`${name} saves ${E(a)} every week and is ${E(b)} old. How many weeks until ${name} can buy a game for ${E(c)}?`, `${name} spart jede Woche ${D(a)} und ist ${D(b)} alt. Nach wie vielen Wochen kann sich ${name} ein Spiel für ${D(c)} kaufen?`),
      calc: `${s * w} "€" : ${s} "€" = ${w}`,
      answer: tx(`After ${w} weeks.`, `Nach ${w} Wochen.`),
    };
  },
];

export function notNeeded(rng: Rng): Exercise {
  const s = rng.pick(SPOTS)(rng);
  const extra = s.parts.findIndex((p) => !p.need);
  const opts = s.parts.map((p) => (p.need ? { text: p.text, title: tx("You need that one", "Die brauchst du"), say: p.role } : { text: p.text }));
  const { answer, mistakes } = fixedChoice(opts, extra);
  const listMath = (strike: boolean) =>
    both((l) =>
      s.parts
        .map((p, i) => {
          const word = l === "de" ? D(p.text) : E(p.text);
          const m = `"${word}"#p${i}`;
          return strike && !p.need ? `\\strike{${m}}` : m;
        })
        .join(" \\quad "),
    );
  const extraText = s.parts[extra].text;
  return {
    instruction: tx("Which number isn't needed?", "Welche Angabe brauchst du nicht?"),
    text: s.story(s.parts.map((p) => p.text)),
    answer,
    mistakes,
    hint: tx("Read the question first. Which numbers does the calculation for it really use?", "Lies zuerst die Frage. Welche Zahlen braucht die Rechnung dafür wirklich?"),
    solution: [
      { math: listMath(false), note: tx("All the numbers in the story. Now look at the question.", "Alle Zahlen aus der Aufgabe. Jetzt schau auf die Frage.") },
      {
        math: listMath(true),
        highlight: [`p${extra}`],
        note: tx(`The number **${E(extraText)}** has nothing to do with the question. Cross it out!`, `Die Angabe **${D(extraText)}** hat mit der Frage nichts zu tun. Streich sie durch!`),
      },
      { math: s.calc, note: both((l) => `${l === "de" ? "Mit dem Rest rechnest du:" : "The rest gives the calculation:"} ${l === "de" ? D(s.answer) : E(s.answer)}`) },
    ],
  };
}
