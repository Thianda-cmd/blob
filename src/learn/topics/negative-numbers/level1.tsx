"use client";

import type { ComponentType } from "react";
import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { choiceOf, distinct, dmath, gn, kn, kp, num, numberAnswer, numberMistakes, say, weighted, type Slip } from "./shared";
import { NegLineFigure, NegThermometer } from "./visuals";
import { NegCompare, NegWalker } from "./widgets1";

const asVisual = (c: unknown) => c as ComponentType<Record<string, unknown>>;
const DEG: Text = "°C";
const EURO: Text = "€";

// ---------------------------------------------------------------------------
// Sums and differences with signs: a model with keyed tokens for the solutions.

type Op = "+" | "-";
type Chain = { first: number; rest: { op: Op; v: number }[] };

const value = (c: Chain) => c.rest.reduce((s, t) => (t.op === "+" ? s + t.v : s - t.v), c.first);

/** "-4 + (-3) - 5" with keys: term i has `t<i>` (and `t<i>s`, `t<i>b`), its operation `o<i>`. */
function chainSrc(c: Chain): string {
  return [kn(c.first, "t0"), ...c.rest.map((t, i) => `${t.op}#o${i + 1} ${kp(t.v, `t${i + 1}`)}`)].join(" ");
}

/** Two signs meet: "+ (-3)" becomes "- 3", "- (-3)" becomes "+ 3". */
const merge = (op: Op, v: number): { op: Op; v: number } => (v < 0 ? { op: op === "+" ? "-" : "+", v: -v } : { op, v });

/** "from −4 go 9 steps to the right (4 to zero, then 5 more)" */
function walkNote(x: number, op: Op, v: number): Text {
  const r = op === "+" ? x + v : x - v;
  const cross = x !== 0 && r !== 0 && Math.sign(x) !== Math.sign(r);
  const toZero = Math.abs(x);
  return tx(
    `$${x} ${op} ${v} = ${r}$: from $${x}$ go ${v} steps to the **${op === "+" ? "right" : "left"}**${cross ? ` (${toZero} to zero, then ${v - toZero} more)` : ""}.`,
    `$${x} ${op} ${v} = ${r}$: Von $${x}$ aus gehst du ${v} Schritte nach **${op === "+" ? "rechts" : "links"}**${cross ? ` (${toZero} bis zur Null, dann noch ${v - toZero})` : ""}.`,
  );
}

/** Worked solution: merge double signs, then walk left to right. */
function chainFrames(c: Chain): Frame[] {
  const frames: Frame[] = [{ math: chainSrc(c), note: tx("Work from left to right.", "Rechne von links nach rechts.") }];
  const meets = c.rest.map((t, i) => ({ ...t, i: i + 1 })).filter((t) => t.v < 0);
  const flat = c.rest.map((t) => merge(t.op, t.v));
  const flatSrc = (from: number, total: number) =>
    [kn(total, "t0"), ...flat.slice(from).map((t, j) => {
      const i = from + j + 1;
      const wasNeg = c.rest[i - 1].v < 0;
      return wasNeg ? `${t.op}#t${i}s ${t.v}#t${i}` : `${t.op}#o${i} ${t.v}#t${i}`;
    })].join(" ");
  if (meets.length) {
    const parts = meets.map((t) => `$${t.op} (${t.v})$ → $${merge(t.op, t.v).op} ${-t.v}$`);
    frames[0] = { ...frames[0], highlight: meets.flatMap((t) => [`o${t.i}`, `t${t.i}s`]), note: tx("First look where two signs meet.", "Schau zuerst, wo zwei Zeichen aufeinandertreffen.") };
    frames.push({
      math: flatSrc(0, c.first),
      highlight: meets.map((t) => `t${t.i}s`),
      note: tx(
        `Equal signs give plus, different signs give minus: ${parts.join(", ")}.`,
        `Gleiche Zeichen ergeben plus, verschiedene ergeben minus: ${parts.join(", ")}.`,
      ),
    });
  }
  let total = c.first;
  flat.forEach((t, j) => {
    const note = walkNote(total, t.op, t.v);
    total = t.op === "+" ? total + t.v : total - t.v;
    frames.push({ math: flatSrc(j + 1, total), note });
  });
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = { ...last, note: tx(`${(last.note as { en: string }).en} Result: $${total}$.`, `${(last.note as { de: string }).de} Ergebnis: $${total}$.`) };
  return frames;
}

/** Typical slips with signs, simulated on the chain. */
function chainMistakes(c: Chain): Mistake[] {
  const right = value(c);
  const slips: Slip[] = [];
  const minusNeg = c.rest.filter((t) => t.op === "-" && t.v < 0);
  const plusNeg = c.rest.filter((t) => t.op === "+" && t.v < 0);
  if (minusNeg.length) {
    const t = minusNeg[0];
    slips.push({
      v: right - 2 * minusNeg.reduce((s, x) => s - x.v, 0),
      title: tx("Two minus signs", "Zwei Minuszeichen"),
      say: tx(
        `Careful with $- (${t.v})$: subtracting a negative number means **adding**. Two minus signs in a row make a plus.`,
        `Vorsicht bei $- (${t.v})$: Eine negative Zahl abziehen heißt **addieren**. Zwei Minuszeichen hintereinander ergeben plus.`,
      ),
    });
  }
  if (plusNeg.length) {
    const t = plusNeg[0];
    slips.push({
      v: right + 2 * plusNeg.reduce((s, x) => s - x.v, 0),
      title: tx("Plus a negative number", "Plus eine negative Zahl"),
      say: tx(
        `Adding a negative number means going **left**: $+ (${t.v})$ is the same as $- ${-t.v}$.`,
        `Eine negative Zahl addieren heißt nach **links** gehen: $+ (${t.v})$ ist dasselbe wie $- ${-t.v}$.`,
      ),
    });
  }
  if (c.rest.length === 1 && c.rest[0].v > 0) {
    const [a, { op, v: b }] = [c.first, c.rest[0]];
    if (a < 0 && op === "+")
      slips.push({
        v: a - b,
        title: tx("Went the wrong way", "In die falsche Richtung"),
        say: tx(
          `You added ${-a} and ${b} and kept the minus. But $+ ${b}$ means going ${b} steps to the **right** from $${a}$, towards zero.`,
          `Du hast ${-a} und ${b} addiert und das Minus behalten. Aber $+ ${b}$ heißt: von $${a}$ aus ${b} Schritte nach **rechts**, Richtung Null.`,
        ),
      });
    if (a < 0 && op === "-")
      slips.push({
        v: a + b,
        title: tx("Went the wrong way", "In die falsche Richtung"),
        say: tx(
          `From $${a}$ you go ${b} steps further **left**. The result gets even smaller, so it moves away from zero.`,
          `Von $${a}$ aus gehst du ${b} Schritte weiter nach **links**. Das Ergebnis wird noch kleiner und entfernt sich von der Null.`,
        ),
      });
    if (a >= 0 && op === "-" && b > a)
      slips.push({
        v: b - a,
        title: tx("Numbers swapped", "Zahlen vertauscht"),
        say: tx(
          `You worked out $${b} - ${a}$. But $${a} - ${b}$ starts at ${a} and goes ${b} steps left, past zero.`,
          `Du hast $${b} - ${a}$ gerechnet. Aber $${a} - ${b}$ startet bei ${a} und geht ${b} Schritte nach links, über die Null hinaus.`,
        ),
      });
  }
  if (c.first < 0)
    slips.push({
      v: right - 2 * c.first,
      title: tx("Lost the first minus", "Erstes Minus verloren"),
      say: tx(`The minus in front belongs to the first number: you start at $${c.first}$, left of zero.`, `Das Minus vorne gehört zur ersten Zahl: Du startest bei $${c.first}$, links von der Null.`),
    });
  return numberMistakes(right, slips);
}

const CALC = tx("Calculate", "Berechne");

function chainExercise(c: Chain, hint: Text): Exercise {
  return { instruction: CALC, math: chainSrc(c).replace(/#[A-Za-z0-9_-]+/g, "").replace(/(^|\()- /g, "$1-"), answer: numberAnswer(value(c)), hint, solution: chainFrames(c), mistakes: chainMistakes(c) };
}

// ---------------------------------------------------------------------------
// Practice

const n1 = (rng: Rng, lo = 1, hi = 15) => rng.int(lo, hi);

function calcTask(rng: Rng): Exercise {
  for (let i = 0; i < 40; i++) {
    const a = n1(rng, 1, 15);
    const b = n1(rng, 1, 15);
    const kind = rng.int(0, 7);
    let c: Chain;
    let hint: Text;
    const sum = tx("Plus means go right, minus means go left on the number line.", "Plus heißt nach rechts gehen, minus heißt nach links gehen auf der Zahlengeraden.");
    const meet = tx("Where two signs meet: equal signs give plus, different signs give minus.", "Wo zwei Zeichen aufeinandertreffen: Gleiche Zeichen ergeben plus, verschiedene ergeben minus.");
    if (kind === 0) [c, hint] = [{ first: -a, rest: [{ op: "+", v: b }] }, sum];
    else if (kind === 1) [c, hint] = [{ first: rng.int(0, 9), rest: [{ op: "-", v: rng.int(10, 20) }] }, sum];
    else if (kind === 2) [c, hint] = [{ first: -a, rest: [{ op: "-", v: b }] }, sum];
    else if (kind === 3) [c, hint] = [{ first: rng.sign() * a, rest: [{ op: "+", v: -b }] }, meet];
    else if (kind === 4) [c, hint] = [{ first: rng.sign() * a, rest: [{ op: "-", v: -b }] }, meet];
    else if (kind === 5) [c, hint] = [{ first: -a, rest: [{ op: "+", v: -b }] }, meet];
    else if (kind === 6) [c, hint] = [{ first: -a, rest: [{ op: "-", v: -b }] }, meet];
    else {
      const ops: Op[] = [rng.pick(["+", "-"] as const), rng.pick(["+", "-"] as const)];
      c = { first: rng.sign() * n1(rng, 1, 12), rest: ops.map((op) => ({ op, v: rng.chance(0.55) ? -n1(rng, 1, 12) : n1(rng, 1, 12) })) };
      hint = tx("First turn every pair of signs into one sign. Then work from left to right.", "Mach zuerst aus jedem Zeichenpaar ein Zeichen. Dann rechne von links nach rechts.");
    }
    const v = value(c);
    if (Math.abs(v) > 30 || (v === 0 && rng.chance(0.7))) continue;
    if (c.rest.some((t) => t.v === 0) || (c.rest.length === 1 && Math.abs(c.first) === Math.abs(c.rest[0].v))) continue;
    return chainExercise(c, hint);
  }
  return chainExercise({ first: -6, rest: [{ op: "+", v: 10 }] }, tx("Go 10 steps to the right from −6.", "Geh von −6 aus 10 Schritte nach rechts."));
}

function compareTask(rng: Rng): Exercise {
  const mode = rng.next();
  let [a, b] = [0, 0];
  if (mode < 0.5) [a, b] = distinct(rng, 2, () => -rng.int(1, 20)) as [number, number];
  else if (mode < 0.7) [a, b] = rng.shuffle([-rng.int(1, 15), rng.int(1, 15)]) as [number, number];
  else if (mode < 0.8) [a, b] = rng.shuffle([-rng.int(1, 12), 0]) as [number, number];
  else {
    const base = rng.int(1, 9);
    [a, b] = rng.shuffle([-(base + 0.5), rng.chance(0.5) ? -base : -(base + 1)]) as [number, number];
  }
  if (rng.int(0, 1) === 1) [a, b] = [b, a];
  const lt = a < b;
  const [lo, hi] = lt ? [a, b] : [b, a];
  const digitsSayLess = Math.abs(a) < Math.abs(b);
  const byDigits = digitsSayLess !== lt;
  const wrong = {
    text: lt ? "$>$" : "$<$",
    title: byDigits ? tx("Compared the digits", "Nur die Ziffern verglichen") : tx("Think of the number line", "Denk an die Zahlengerade"),
    say: byDigits
      ? say((t, l) =>
          t(
            `Ah, I see what happened! You compared the digits only. On the number line, $${num(lo, l)}$ lies further **left**, so it is the **smaller** number.`,
            `Ah, ich seh, was passiert ist! Du hast nur die Ziffern verglichen. Auf der Zahlengeraden liegt $${num(lo, l)}$ weiter **links**, also ist das die **kleinere** Zahl.`,
          ),
        )
      : say((t, l) =>
          t(
            `Picture the number line: numbers get bigger to the right. Which of the two lies further right, $${num(a, l)}$ or $${num(b, l)}$?`,
            `Stell dir die Zahlengerade vor: Nach rechts werden die Zahlen größer. Welche liegt weiter rechts, $${num(a, l)}$ oder $${num(b, l)}$?`,
          ),
        ),
  };
  const { answer, mistakes } = choiceOf([
    lt ? { text: "$<$", ok: true } : wrong,
    lt ? wrong : { text: "$>$", ok: true },
  ]);
  const rel = lt ? "<" : ">";
  return {
    instruction: tx("Fill in < or >", "Setze < oder > ein"),
    math: dmath((l) => `${num(a, l)} \\box{?} ${num(b, l)}`),
    answer,
    hint: tx("On the number line, the number further left is the smaller one.", "Auf der Zahlengeraden ist die Zahl weiter links die kleinere."),
    solution: [
      { math: dmath((l) => `${kn(a, "a", l)} \\box{?#q} ${kn(b, "b", l)}`), note: tx("Where do the two numbers lie on the number line?", "Wo liegen die beiden Zahlen auf der Zahlengeraden?") },
      {
        math: dmath((l) => `${kn(a, "a", l)} ${rel}#r ${kn(b, "b", l)}`),
        highlight: ["r"],
        note: say((t, l) =>
          t(
            `$${num(lo, l)}$ lies further left than $${num(hi, l)}$, so it is smaller: $${num(a, l)} ${rel} ${num(b, l)}$.`,
            `$${num(lo, l)}$ liegt weiter links als $${num(hi, l)}$, ist also kleiner: $${num(a, l)} ${rel} ${num(b, l)}$.`,
          ),
        ),
      },
    ],
    mistakes,
  };
}

function orderTask(rng: Rng, desc: boolean): Exercise {
  let pool: number[] = [];
  for (let i = 0; i < 50; i++) {
    const negs = distinct(rng, rng.int(3, 4), () => -rng.int(1, 25));
    const others = distinct(rng, 5 - negs.length, () => rng.int(0, 20));
    pool = [...negs, ...others];
    const digitsVaried = negs.some((v) => v <= -10) && negs.some((v) => v > -10);
    if (new Set(pool).size === 5 && digitsVaried) break;
  }
  const asc = [...pool].sort((x, y) => x - y);
  const sorted = desc ? [...asc].reverse() : asc;
  const item = (v: number) => `$${v}$`;
  const items = sorted.map(item);
  const negs = sorted.filter((v) => v < 0);
  const lo = Math.min(...negs);
  const hi = Math.max(...negs);
  const keyOf = (v: number) => `n${pool.indexOf(v)}`;
  const rel = desc ? ">" : "<";
  const mistakes: Mistake[] = [
    {
      when: { kind: "order", items: [...items].reverse() },
      title: tx("Wrong direction", "Falsche Richtung"),
      say: desc
        ? tx("You sorted from smallest to largest. Here the **largest** number goes at the top.", "Du hast von klein nach groß sortiert. Hier gehört die **größte** Zahl nach oben.")
        : tx("You sorted from largest to smallest. Here the **smallest** number goes at the top.", "Du hast von groß nach klein sortiert. Hier gehört die **kleinste** Zahl nach oben."),
    },
    {
      when: { kind: "order", items: [...negs].reverse().map(item) },
      title: tx("Sorted by the digits", "Nach den Ziffern sortiert"),
      say: tx(
        `Ah, I see! You sorted the negative numbers by their digits. But $${lo}$ lies further **left** than $${hi}$, so $${lo}$ is smaller.`,
        `Ah, ich seh's! Du hast die negativen Zahlen nach ihren Ziffern sortiert. Aber $${lo}$ liegt weiter **links** als $${hi}$, also ist $${lo}$ kleiner.`,
      ),
    },
  ];
  return {
    instruction: desc ? tx("Order from largest to smallest", "Ordne von der größten zur kleinsten Zahl") : tx("Order from smallest to largest", "Ordne von der kleinsten zur größten Zahl"),
    answer: { kind: "order", items, label: desc ? tx("Largest at the top", "Größte Zahl oben") : tx("Smallest at the top", "Kleinste Zahl oben") },
    hint: desc
      ? tx("Positive numbers first. Among the negative numbers, the one closest to zero is the largest.", "Zuerst die positiven Zahlen. Bei den negativen ist die Zahl am nächsten an der Null die größte.")
      : tx("Negative numbers first. Among them, the one with the biggest digits lies furthest left.", "Zuerst die negativen Zahlen. Die mit den größten Ziffern liegt am weitesten links."),
    solution: [
      { math: pool.map((v) => gn(v, keyOf(v))).join(" \\quad "), note: tx("Picture the numbers on the number line.", "Stell dir die Zahlen auf der Zahlengeraden vor.") },
      {
        math: sorted.map((v, i) => `${i ? `${rel}#r${i} ` : ""}${gn(v, keyOf(v))}`).join(" "),
        note: desc
          ? tx("From right to left: the positive numbers, then the negative ones (closest to zero first).", "Von rechts nach links: erst die positiven Zahlen, dann die negativen (die nächste an der Null zuerst).")
          : tx("From left to right: the negative numbers (biggest digits first), then the rest.", "Von links nach rechts: erst die negativen Zahlen (die mit den größten Ziffern zuerst), dann der Rest."),
      },
    ],
    mistakes,
  };
}

function gapTask(rng: Rng): Exercise {
  for (let i = 0; i < 40; i++) {
    const kind = rng.int(0, 2);
    let a = 0;
    let c = 0;
    let x = 0;
    let src = "";
    let solved = "";
    let wrong: Slip = null;
    let note: Text = "";
    if (kind === 0) {
      // a + ? = c
      a = rng.sign() * rng.int(1, 12);
      c = rng.sign() * rng.int(1, 12);
      x = c - a;
      if (a > 0 && c > 0 && x > 0) continue;
      src = `${kn(a, "a")} +#o \\box{?#q} =#e ${kn(c, "c")}`;
      solved = `${kn(a, "a")} +#o \\green{${kp(x, "x")}} =#e ${kn(c, "c")}`;
      note = tx(
        `From $${a}$ to $${c}$ are ${Math.abs(x)} steps to the ${x > 0 ? "right" : "left"}, so the missing number is $${x}$.`,
        `Von $${a}$ bis $${c}$ sind es ${Math.abs(x)} Schritte nach ${x > 0 ? "rechts" : "links"}, also fehlt $${x}$.`,
      );
      wrong = {
        v: c + a,
        title: tx("Calculated the wrong way", "Falsch herum gerechnet"),
        say: tx(`Check it: $${a} + (${c + a})$ is not $${c}$. Count the steps from $${a}$ to $${c}$ instead.`, `Mach die Probe: $${a} + (${c + a})$ ergibt nicht $${c}$. Zähl lieber die Schritte von $${a}$ bis $${c}$.`),
      };
    } else if (kind === 1) {
      // ? - b = c
      const b = rng.int(2, 12);
      c = -rng.int(1, 12);
      x = c + b;
      a = b;
      src = `\\box{?#q} -#o ${b}#a =#e ${kn(c, "c")}`;
      solved = `\\green{${kn(x, "x")}} -#o ${b}#a =#e ${kn(c, "c")}`;
      note = tx(`Undo "minus ${b}" by adding ${b}: $${c} + ${b} = ${x}$.`, `Mach „minus ${b}“ rückgängig, indem du ${b} addierst: $${c} + ${b} = ${x}$.`);
      wrong = {
        v: c - b,
        title: tx("Wrong inverse operation", "Falsche Umkehrung"),
        say: tx(`To undo "minus ${b}" you have to **add** ${b}, not subtract it again.`, `Um „minus ${b}“ rückgängig zu machen, musst du ${b} **addieren**, nicht noch mal abziehen.`),
      };
    } else {
      // a - ? = c with c > a: the gap is negative
      a = rng.int(-6, 8);
      c = a + rng.int(2, 10);
      x = a - c;
      src = `${kn(a, "a")} -#o \\box{?#q} =#e ${kn(c, "c")}`;
      solved = `${kn(a, "a")} -#o \\green{${kp(x, "x")}} =#e ${kn(c, "c")}`;
      note = tx(
        `The result $${c}$ is **bigger** than $${a}$. You only get more by subtracting a **negative** number: $${a} - (${x}) = ${a} + ${-x} = ${c}$.`,
        `Das Ergebnis $${c}$ ist **größer** als $${a}$. Mehr wird es nur, wenn du eine **negative** Zahl abziehst: $${a} - (${x}) = ${a} + ${-x} = ${c}$.`,
      );
      wrong = {
        v: c - a,
        title: tx("Missed the double minus", "Doppeltes Minus übersehen"),
        say: tx(
          `Check it: $${a} - ${c - a} = ${a - (c - a)}$, not $${c}$. To get **more** by subtracting, the number you subtract must be negative.`,
          `Mach die Probe: $${a} - ${c - a} = ${a - (c - a)}$, nicht $${c}$. Damit Abziehen **mehr** ergibt, muss die abgezogene Zahl negativ sein.`,
        ),
      };
    }
    if (x === 0 || Math.abs(x) > 20) continue;
    return {
      instruction: tx("Fill in the gap", "Ergänze die Lücke"),
      math: src.replace(/#[A-Za-z0-9_-]+/g, "").replace(/(^|\(|= )- /g, "$1-"),
      answer: numberAnswer(x),
      hint: tx("Think of the number line: how far, and in which direction?", "Denk an die Zahlengerade: Wie weit und in welche Richtung?"),
      solution: [
        { math: src, note: tx("Which number belongs in the box?", "Welche Zahl gehört in das Kästchen?") },
        { math: solved, note },
      ],
      mistakes: numberMistakes(x, [wrong]),
    };
  }
  return gapTask(rng);
}

/** The temperature after a change. */
function tempNewTask(rng: Rng): Exercise {
  const story = rng.int(0, 3);
  let t0 = 0;
  let d = 0;
  let up = true;
  for (let i = 0; i < 40; i++) {
    if (story === 2) {
      t0 = -rng.int(16, 22);
      d = rng.int(3, 12);
      up = true;
    } else {
      t0 = rng.int(-10, 10);
      d = rng.int(2, 14);
      up = story !== 1;
    }
    const t1 = up ? t0 + d : t0 - d;
    const crosses = Math.sign(t0) !== Math.sign(t1);
    if (t0 !== 0 && t1 !== 0 && Math.abs(t1) <= 20 && (story === 2 || crosses || rng.chance(0.3))) break;
  }
  const t1 = up ? t0 + d : t0 - d;
  const texts: Text[] = [
    tx(`In the morning it is $${t0}$ °C. By noon it gets ${d} degrees warmer. What is the temperature at noon?`, `Am Morgen sind es $${t0}$ °C. Bis zum Mittag wird es ${d} Grad wärmer. Wie warm ist es am Mittag?`),
    tx(`In the evening it is $${t0}$ °C. During the night the temperature falls by ${d} degrees. What is the temperature in the night?`, `Am Abend sind es $${t0}$ °C. In der Nacht sinkt die Temperatur um ${d} Grad. Wie kalt ist es in der Nacht?`),
    tx(`A freezer is set to $${t0}$ °C. During a power cut it warms up by ${d} degrees. What temperature does it have then?`, `Ein Gefrierschrank ist auf $${t0}$ °C eingestellt. Bei einem Stromausfall wird es darin um ${d} Grad wärmer. Welche Temperatur hat er dann?`),
    tx(`On a mountain top it is $${t0}$ °C. Down in the valley it is ${d} degrees warmer. What is the temperature in the valley?`, `Auf einem Berggipfel sind es $${t0}$ °C. Unten im Tal ist es ${d} Grad wärmer. Wie warm ist es im Tal?`),
  ];
  const op: Op = up ? "+" : "-";
  return {
    instruction: tx("Find the new temperature", "Bestimme die neue Temperatur"),
    text: texts[story],
    answer: numberAnswer(t1, DEG),
    hint: up ? tx("Warmer means plus: go to the right on the number line.", "Wärmer heißt plus: nach rechts auf der Zahlengeraden.") : tx("Colder means minus: go to the left on the number line.", "Kälter heißt minus: nach links auf der Zahlengeraden."),
    solution: [
      {
        math: `${kn(t0, "a")} ${op}#o ${d}#d`,
        note: up ? tx(`${d} degrees warmer: add ${d}.`, `${d} Grad wärmer: ${d} addieren.`) : tx(`${d} degrees colder: subtract ${d}.`, `${d} Grad kälter: ${d} subtrahieren.`),
      },
      { math: `${kn(t0, "a")} ${op}#o ${d}#d =#e ${kn(t1, "r")} "°C"#u`, note: walkNote(t0, op, d) },
    ],
    mistakes: numberMistakes(
      t1,
      [
        {
          v: up ? t0 - d : t0 + d,
          title: tx("Wrong direction", "Falsche Richtung"),
          say: up ? tx("It gets **warmer**, so the temperature goes **up**: add.", "Es wird **wärmer**, die Temperatur steigt also: addieren.") : tx("It gets **colder**, so the temperature goes **down**: subtract.", "Es wird **kälter**, die Temperatur sinkt also: subtrahieren."),
        },
        {
          v: Math.abs(t0) + d,
          title: tx("Ignored the minus", "Minus übersehen"),
          say: tx(`The start is $${t0}$ °C, ${t0 < 0 ? "below" : "above"} zero. Start your walk on the number line there.`, `Der Start ist $${t0}$ °C, also ${t0 < 0 ? "unter" : "über"} null. Beginn dort deinen Weg auf der Zahlengeraden.`),
        },
        {
          v: -t1,
          title: tx("Above or below zero?", "Über oder unter null?"),
          say: tx(`Nearly! Check whether you end up above or below zero.`, `Fast! Prüf, ob du über oder unter null landest.`),
          close: true,
        },
      ],
      DEG,
    ),
  };
}

/** How much did the temperature change? */
function tempChangeTask(rng: Rng): Exercise {
  let t0 = 0;
  let t1 = 0;
  for (let i = 0; i < 40; i++) {
    t0 = rng.int(-15, 12);
    t1 = rng.int(-15, 15);
    if (t0 !== t1 && t0 !== 0 && t1 !== 0 && Math.abs(t1 - t0) >= 4 && Math.abs(t1 - t0) <= 25 && (Math.sign(t0) !== Math.sign(t1) || rng.chance(0.25))) break;
  }
  const d = Math.abs(t1 - t0);
  const cities = rng.chance(0.35);
  const up = t1 > t0;
  let text: Text;
  let calc: string;
  if (cities) {
    const [warm, cold] = [Math.max(t0, t1), Math.min(t0, t1)];
    [t0, t1] = [cold, warm];
    const [w, c] = rng.pick([
      ["Rome", "Rom", "Oslo", "Oslo"],
      ["Madrid", "Madrid", "Helsinki", "Helsinki"],
      ["Lisbon", "Lissabon", "Moscow", "Moskau"],
    ].map((x) => [tx(x[0], x[1]), tx(x[2], x[3])]));
    text = tx(
      `At the same moment it is $${warm}$ °C in ${(w as { en: string }).en} and $${cold}$ °C in ${(c as { en: string }).en}. How many degrees colder is it in ${(c as { en: string }).en}?`,
      `Zur gleichen Zeit sind es in ${(w as { de: string }).de} $${warm}$ °C und in ${(c as { de: string }).de} $${cold}$ °C. Um wie viel Grad ist es in ${(c as { de: string }).de} kälter?`,
    );
    calc = `${kn(warm, "b")} -#m ${kp(cold, "a")}`;
  } else {
    text = up
      ? tx(`At 7 a.m. the thermometer shows $${t0}$ °C, at 3 p.m. $${t1}$ °C. By how many degrees did it get warmer?`, `Um 7 Uhr zeigt das Thermometer $${t0}$ °C, um 15 Uhr $${t1}$ °C. Um wie viel Grad ist es wärmer geworden?`)
      : tx(`At 4 p.m. it is $${t0}$ °C, at midnight $${t1}$ °C. By how many degrees did it get colder?`, `Um 16 Uhr sind es $${t0}$ °C, um Mitternacht $${t1}$ °C. Um wie viel Grad ist es kälter geworden?`);
    calc = up ? `${kn(t1, "b")} -#m ${kp(t0, "a")}` : `${kn(t0, "b")} -#m ${kp(t1, "a")}`;
  }
  const big = Math.max(t0, t1);
  const small = Math.min(t0, t1);
  const crosses = Math.sign(t0) !== Math.sign(t1);
  return {
    instruction: tx("Find the change", "Bestimme die Änderung"),
    text,
    answer: numberAnswer(d, DEG),
    hint: tx("Count the steps between the two temperatures. Across zero, count in two parts.", "Zähl die Schritte zwischen den beiden Temperaturen. Über die Null hinweg zählst du in zwei Teilen."),
    solution: [
      { math: `${calc}`, note: tx("Higher temperature minus lower temperature.", "Höhere Temperatur minus niedrigere Temperatur.") },
      {
        math: `${calc} =#e ${d}#r`,
        note: crosses
          ? tx(`From $${small}$ up to $0$ are ${-small} degrees, from $0$ to $${big}$ another ${big}: together ${d} degrees.`, `Von $${small}$ bis $0$ sind es ${-small} Grad, von $0$ bis $${big}$ noch einmal ${big}: zusammen ${d} Grad.`)
          : tx(`From $${small}$ to $${big}$ are ${d} steps on the number line.`, `Von $${small}$ bis $${big}$ sind es ${d} Schritte auf der Zahlengeraden.`),
      },
    ],
    mistakes: numberMistakes(
      d,
      [
        crosses && {
          v: Math.abs(Math.abs(t1) - Math.abs(t0)),
          title: tx("Counted only to one side", "Nur auf einer Seite gezählt"),
          say: tx(
            `You subtracted the digits. But the two temperatures lie on **different sides** of zero: count to $0$ first, then on.`,
            `Du hast die Ziffern voneinander abgezogen. Aber die beiden Temperaturen liegen auf **verschiedenen Seiten** der Null: Zähl erst bis $0$, dann weiter.`,
          ),
        },
        {
          v: -d,
          title: tx("A difference is positive", "Ein Unterschied ist positiv"),
          say: tx(`The question asks "by how many degrees": that's a positive amount. Warmer or colder is already in the question.`, `Gefragt ist „um wie viel Grad“: Die Antwort ist also eine positive Zahl. Ob wärmer oder kälter, steht schon in der Frage.`),
          close: true,
        },
      ],
      DEG,
    ),
  };
}

/** Sea level, lifts and bank balances. */
function storyTask(rng: Rng): Exercise {
  const kind = rng.pick(["dive", "height", "lift", "bank", "bank"] as const);
  const instruction = tx("Solve the word problem", "Löse die Textaufgabe");
  if (kind === "dive") {
    const d = rng.int(4, 30);
    const k = rng.int(3, 15);
    const deeper = rng.chance(0.5) || k >= d;
    const r = deeper ? -d - k : -d + k;
    return {
      instruction,
      text: deeper
        ? tx(`A diver is at $-${d}$ m, that is ${d} m below sea level. She dives ${k} m deeper. At what height is she now?`, `Eine Taucherin ist bei $-${d}$ m, also ${d} m unter dem Meeresspiegel. Sie taucht ${k} m tiefer. In welcher Höhe ist sie jetzt?`)
        : tx(`A diver is at $-${d}$ m, that is ${d} m below sea level. He rises ${k} m. At what height is he now?`, `Ein Taucher ist bei $-${d}$ m, also ${d} m unter dem Meeresspiegel. Er steigt ${k} m auf. In welcher Höhe ist er jetzt?`),
      answer: numberAnswer(r, "m"),
      hint: tx("Sea level is $0$ m. Deeper means further into the minus.", "Der Meeresspiegel ist $0$ m. Tiefer heißt weiter ins Minus."),
      solution: [
        { math: `-#as ${d}#a ${deeper ? "-" : "+"}#o ${k}#k`, note: deeper ? tx(`${k} m deeper: subtract ${k}.`, `${k} m tiefer: ${k} subtrahieren.`) : tx(`${k} m up: add ${k}.`, `${k} m nach oben: ${k} addieren.`) },
        { math: `-#as ${d}#a ${deeper ? "-" : "+"}#o ${k}#k =#e ${kn(r, "r")} "m"#u`, note: walkNote(-d, deeper ? "-" : "+", k) },
      ],
      mistakes: numberMistakes(
        r,
        [
          { v: deeper ? -d + k : -d - k, title: tx("Wrong direction", "Falsche Richtung"), say: deeper ? tx("Deeper means **further down**, so the number gets smaller.", "Tiefer heißt **weiter nach unten**, die Zahl wird also kleiner.") : tx("Rising means going **up**, so the number gets bigger (closer to zero).", "Aufsteigen heißt **nach oben**, die Zahl wird also größer (näher an der Null).") },
          { v: -r, title: tx("Above or below?", "Über oder unter?"), say: tx("Nearly! Is the diver above or below sea level now?", "Fast! Ist die Person jetzt über oder unter dem Meeresspiegel?"), close: true },
        ],
        "m",
      ),
    };
  }
  if (kind === "height") {
    const d = rng.int(3, 25);
    const h = rng.int(4, 40);
    const what = rng.pick([
      [tx("a seagull flies", "eine Möwe fliegt"), tx("the seagull", "der Möwe")],
      [tx("a lighthouse lamp shines", "die Lampe eines Leuchtturms leuchtet"), tx("the lamp", "der Lampe")],
      [tx("a helicopter hovers", "ein Hubschrauber schwebt"), tx("the helicopter", "dem Hubschrauber")],
    ]);
    const [w0, w1] = what as [{ en: string; de: string }, { en: string; de: string }];
    return {
      instruction,
      text: tx(
        `A diver is at $-${d}$ m. Right above, ${w0.en} at $${h}$ m above sea level. What is the height difference between the diver and ${w1.en}?`,
        `Ein Taucher ist bei $-${d}$ m. Genau darüber ${w0.de} in $${h}$ m Höhe über dem Meeresspiegel. Wie groß ist der Höhenunterschied zwischen dem Taucher und ${w1.de}?`,
      ),
      answer: numberAnswer(d + h, "m"),
      hint: tx("Count from the diver up to sea level, then on up to the top.", "Zähl vom Taucher bis zum Meeresspiegel und dann weiter nach oben."),
      solution: [
        { math: `${h}#b -#m (-#as ${d}#a)#ab`, note: tx("Higher position minus lower position.", "Obere Höhe minus untere Höhe.") },
        { math: `${h}#b +#as ${d}#a =#e ${d + h}#r "m"#u`, note: tx(`${d} m up to sea level and ${h} m more: ${d + h} m.`, `${d} m bis zum Meeresspiegel und noch ${h} m: ${d + h} m.`) },
      ],
      mistakes: numberMistakes(
        d + h,
        [
          { v: Math.abs(h - d), title: tx("Counted only to one side", "Nur auf einer Seite gezählt"), say: tx("You subtracted the numbers. But one is below sea level and one above: the distance goes **across** zero.", "Du hast die Zahlen voneinander abgezogen. Aber eine Höhe liegt unter und eine über dem Meeresspiegel: Der Abstand geht **über** die Null hinweg.") },
          { v: -(d + h), title: tx("A difference is positive", "Ein Unterschied ist positiv"), say: tx("A height difference is a distance, and distances are positive.", "Ein Höhenunterschied ist ein Abstand, und Abstände sind positiv."), close: true },
        ],
        "m",
      ),
    };
  }
  if (kind === "lift") {
    let f = 0;
    let k = 0;
    let down = true;
    for (let i = 0; i < 40; i++) {
      f = rng.int(-3, 7);
      k = rng.int(2, 8);
      down = rng.chance(0.6);
      const r = down ? f - k : f + k;
      if (r >= -3 && r <= 9 && f !== 0 && r !== 0 && Math.sign(f) !== Math.sign(r)) break;
    }
    const r = down ? f - k : f + k;
    const fl = (v: number) => `$${v}$`;
    return {
      instruction,
      text: tx(
        `In a tower block the ground floor is floor $0$, the basement floors are $-1$, $-2$ and $-3$. A lift starts on floor ${fl(f)} and goes ${k} floors ${down ? "down" : "up"}. On which floor does it stop?`,
        `In einem Hochhaus ist das Erdgeschoss das Stockwerk $0$, die Untergeschosse sind $-1$, $-2$ und $-3$. Ein Aufzug startet im Stockwerk ${fl(f)} und fährt ${k} Stockwerke nach ${down ? "unten" : "oben"}. In welchem Stockwerk hält er?`,
      ),
      answer: { kind: "number", value: r, label: tx('"floor" =', '"Stockwerk" =') },
      hint: tx("The ground floor $0$ counts as a floor too.", "Das Erdgeschoss $0$ zählt auch als Stockwerk."),
      solution: [
        { math: `${kn(f, "a")} ${down ? "-" : "+"}#o ${k}#k`, note: down ? tx(`${k} floors down: subtract ${k}.`, `${k} Stockwerke nach unten: ${k} subtrahieren.`) : tx(`${k} floors up: add ${k}.`, `${k} Stockwerke nach oben: ${k} addieren.`) },
        { math: `${kn(f, "a")} ${down ? "-" : "+"}#o ${k}#k =#e ${kn(r, "r")}`, note: walkNote(f, down ? "-" : "+", k) },
      ],
      mistakes: [
        ...numberMistakes(r, [
          { v: down ? r - 1 : r + 1, title: tx("Skipped the ground floor", "Erdgeschoss übersprungen"), say: tx("Don't forget the ground floor: it is floor $0$ and counts as one floor.", "Vergiss das Erdgeschoss nicht: Es ist Stockwerk $0$ und zählt als ein Stockwerk.") },
          { v: down ? f + k : f - k, title: tx("Wrong direction", "Falsche Richtung"), say: down ? tx("Going down means the floor number gets **smaller**.", "Nach unten heißt: Die Stockwerksnummer wird **kleiner**.") : tx("Going up means the floor number gets **bigger**.", "Nach oben heißt: Die Stockwerksnummer wird **größer**.") },
        ]),
      ],
    };
  }
  // bank
  let b0 = 0;
  let amt = 0;
  let pay = true;
  for (let i = 0; i < 40; i++) {
    b0 = 5 * rng.int(-12, 16);
    amt = 5 * rng.int(3, 20);
    pay = rng.chance(0.5);
    const r = pay ? b0 + amt : b0 - amt;
    if (b0 !== 0 && r !== 0 && Math.sign(b0) !== Math.sign(r) && Math.abs(r) <= 100) break;
  }
  const r = pay ? b0 + amt : b0 - amt;
  const name = rng.pick(["Lea", "Finn", "Elif", "Jonas", "Mia", "Can"]);
  const start =
    b0 < 0
      ? tx(`${name}'s account is overdrawn: the balance is $${b0}$ €.`, `${name}s Konto ist im Minus: Der Kontostand beträgt $${b0}$ €.`)
      : tx(`${name} has a balance of $${b0}$ € in the bank account.`, `${name} hat einen Kontostand von $${b0}$ €.`);
  const move = pay ? tx(`${name} pays in ${amt} €.`, `${name} zahlt ${amt} € ein.`) : tx(`${name} takes out ${amt} € from the cash machine.`, `${name} hebt ${amt} € am Geldautomaten ab.`);
  const s = start as { en: string; de: string };
  const m = move as { en: string; de: string };
  return {
    instruction,
    text: tx(`${s.en} ${m.en} What is the balance now?`, `${s.de} ${m.de} Wie hoch ist der Kontostand jetzt?`),
    answer: numberAnswer(r, EURO),
    hint: tx("Paying in means plus, taking money out means minus. A minus balance means debt.", "Einzahlen heißt plus, Abheben heißt minus. Ein Kontostand im Minus bedeutet Schulden."),
    solution: [
      { math: `${kn(b0, "a")} ${pay ? "+" : "-"}#o ${amt}#k`, note: pay ? tx(`Paying in: add ${amt} €.`, `Einzahlen: ${amt} € addieren.`) : tx(`Taking out: subtract ${amt} €.`, `Abheben: ${amt} € subtrahieren.`) },
      { math: `${kn(b0, "a")} ${pay ? "+" : "-"}#o ${amt}#k =#e ${kn(r, "r")} "€"#u`, note: walkNote(b0, pay ? "+" : "-", amt) },
    ],
    mistakes: numberMistakes(
      r,
      [
        { v: pay ? b0 - amt : b0 + amt, title: tx("Wrong direction", "Falsche Richtung"), say: pay ? tx("Paying in makes the balance **bigger**: add.", "Einzahlen macht den Kontostand **größer**: addieren.") : tx("Taking money out makes the balance **smaller**: subtract.", "Abheben macht den Kontostand **kleiner**: subtrahieren.") },
        { v: Math.abs(b0) + amt, title: tx("Ignored the minus", "Minus übersehen"), say: tx(`The balance starts at $${b0}$ €. Start there on the number line.`, `Der Kontostand startet bei $${b0}$ €. Beginn dort auf der Zahlengeraden.`) },
        { v: -r, title: tx("In debt or not?", "Schulden oder nicht?"), say: tx("Nearly! Check whether the account ends up above or below zero.", "Fast! Prüf, ob das Konto am Ende über oder unter null ist."), close: true },
      ],
      EURO,
    ),
  };
}

/** Read a marked point off a number line. */
function readLineTask(rng: Rng): Exercise {
  const scale = rng.pick([
    { from: -10, to: 10, step: 1, labels: [-10, -5, 0, 5, 10] },
    { from: -20, to: 20, step: 2, labels: [-20, -10, 0, 10, 20] },
    { from: -50, to: 50, step: 5, labels: [-50, 0, 50] },
    { from: -100, to: 100, step: 10, labels: [-100, -50, 0, 50, 100] },
  ]);
  let v = 0;
  for (let i = 0; i < 40; i++) {
    v = scale.step * rng.int(scale.from / scale.step + 1, scale.to / scale.step - 1);
    if (!scale.labels.includes(v) && (v < 0 || rng.chance(0.2))) break;
  }
  const ticks = Math.abs(v) / scale.step;
  return {
    instruction: tx("Which number is marked?", "Welche Zahl ist markiert?"),
    text: tx("Which number belongs to the point $A$?", "Welche Zahl gehört zum Punkt $A$?"),
    visual: { component: asVisual(NegLineFigure), props: { from: scale.from, to: scale.to, step: scale.step, labels: scale.labels, marks: [{ at: v, label: "A" }] } },
    answer: { kind: "number", value: v, label: "A =" },
    hint:
      scale.step === 1
        ? tx("Count the ticks from $0$. Left of zero the numbers are negative.", "Zähl die Striche ab $0$. Links von der Null sind die Zahlen negativ.")
        : tx(`First work out what one tick is worth: here it is not $1$.`, `Überleg zuerst, wie viel ein Strich wert ist: Hier ist es nicht $1$.`),
    solution: [
      {
        math: `A#A =#e ?#q`,
        note: tx(`Each tick is worth ${scale.step}. $A$ is ${ticks} ticks ${v < 0 ? "left" : "right"} of $0$.`, `Ein Strich ist ${scale.step} wert. $A$ liegt ${ticks} Striche ${v < 0 ? "links" : "rechts"} von $0$.`),
      },
      { math: `A#A =#e ${kn(v, "v")}`, note: tx(`${ticks} · ${scale.step} = ${Math.abs(v)}, and ${v < 0 ? "left of zero means negative" : "right of zero means positive"}.`, `${ticks} · ${scale.step} = ${Math.abs(v)}, und ${v < 0 ? "links von der Null heißt negativ" : "rechts von der Null heißt positiv"}.`) },
    ],
    mistakes: numberMistakes(v, [
      { v: -v, title: tx("Wrong side of zero", "Falsche Seite der Null"), say: v < 0 ? tx("Look again: $A$ lies **left** of zero, so the number is negative.", "Schau noch mal: $A$ liegt **links** von der Null, die Zahl ist also negativ.") : tx("Look again: $A$ lies **right** of zero, so the number is positive.", "Schau noch mal: $A$ liegt **rechts** von der Null, die Zahl ist also positiv."), close: true },
      scale.step !== 1 && { v: Math.sign(v) * ticks, title: tx("Counted the ticks only", "Nur Striche gezählt"), say: tx(`You counted ${ticks} ticks. But on this number line each tick is worth ${scale.step}.`, `Du hast ${ticks} Striche gezählt. Aber auf dieser Zahlengeraden ist jeder Strich ${scale.step} wert.`) },
    ]),
  };
}

/** Opposite numbers and their distance. */
function oppositeTask(rng: Rng): Exercise {
  if (rng.chance(0.5)) {
    const h = rng.int(2, 20);
    const d = 2 * h;
    return {
      instruction: tx("Find the two numbers", "Bestimme die beiden Zahlen"),
      text: tx(`Two opposite numbers lie ${d} apart on the number line. Which numbers are they?`, `Zwei Gegenzahlen liegen auf der Zahlengeraden ${d} auseinander. Welche Zahlen sind es?`),
      answer: { kind: "pair", names: [tx('"smaller number"', '"kleinere Zahl"'), tx('"larger number"', '"größere Zahl"')], values: [-h, h] },
      hint: tx("Opposite numbers are equally far from $0$, on both sides.", "Gegenzahlen liegen gleich weit von der $0$ entfernt, auf beiden Seiten."),
      solution: [
        { math: `?#a \\quad 0#z \\quad ?#b`, note: tx(`Zero lies exactly in the middle between the two numbers.`, `Die Null liegt genau in der Mitte zwischen den beiden Zahlen.`) },
        { math: `-#as ${h}#a \\quad 0#z \\quad ${h}#b`, note: tx(`Half of ${d} on each side: ${h}. So the numbers are $-${h}$ and $${h}$.`, `Die Hälfte von ${d} auf jeder Seite: ${h}. Die Zahlen sind also $-${h}$ und $${h}$.`) },
      ],
      mistakes: [
        { when: { kind: "pair", names: ["", ""], values: [-d, d] }, title: tx("The whole distance on each side", "Ganzer Abstand auf jeder Seite"), say: tx(`$-${d}$ and $${d}$ are ${2 * d} apart. Each number is only **half** the distance away from zero.`, `$-${d}$ und $${d}$ liegen ${2 * d} auseinander. Jede Zahl ist nur **halb** so weit von der Null entfernt.`) },
      ],
    };
  }
  const v = rng.sign() * rng.int(3, 25);
  return {
    instruction: tx("Find the opposite number and the distance", "Bestimme die Gegenzahl und den Abstand"),
    text: tx(`What is the opposite number of $${v}$? And how far apart are $${v}$ and its opposite number on the number line?`, `Wie heißt die Gegenzahl von $${v}$? Und wie weit liegen $${v}$ und ihre Gegenzahl auf der Zahlengeraden auseinander?`),
    answer: { kind: "pair", names: [tx('"opposite number"', '"Gegenzahl"'), tx('"distance"', '"Abstand"')], values: [-v, 2 * Math.abs(v)] },
    hint: tx("The opposite number is on the other side of $0$, just as far away.", "Die Gegenzahl liegt auf der anderen Seite der $0$, genauso weit weg."),
    solution: [
      { math: `${gn(v, "a")} \\quad 0#z \\quad ${gn(-v, "b")}`, note: tx(`The opposite number of $${v}$ is $${-v}$.`, `Die Gegenzahl von $${v}$ ist $${-v}$.`) },
      { math: `${Math.abs(v)}#c +#p ${Math.abs(v)}#d =#e ${2 * Math.abs(v)}#r`, note: tx(`${Math.abs(v)} steps to zero and ${Math.abs(v)} steps beyond: ${2 * Math.abs(v)}.`, `${Math.abs(v)} Schritte bis zur Null und ${Math.abs(v)} Schritte darüber hinaus: ${2 * Math.abs(v)}.`) },
    ],
    mistakes: [
      { when: { kind: "pair", names: ["", ""], values: [-v, Math.abs(v)] }, title: tx("Only up to zero", "Nur bis zur Null"), say: tx(`${Math.abs(v)} is the distance to zero. The opposite number lies ${Math.abs(v)} further on the other side.`, `${Math.abs(v)} ist der Abstand bis zur Null. Die Gegenzahl liegt noch einmal ${Math.abs(v)} weiter auf der anderen Seite.`) },
      { when: { kind: "pair", names: ["", ""], values: [v, 2 * Math.abs(v)] }, title: tx("Same number", "Dieselbe Zahl"), say: tx("The opposite number has the **other** sign.", "Die Gegenzahl hat das **andere** Vorzeichen.") },
    ],
  };
}

export function generate1(rng: Rng): Exercise {
  return weighted(rng, [
    [1.1, () => compareTask(rng)],
    [0.7, () => orderTask(rng, false)],
    [0.35, () => orderTask(rng, true)],
    [2.4, () => calcTask(rng)],
    [1.0, () => gapTask(rng)],
    [0.8, () => tempNewTask(rng)],
    [0.8, () => tempChangeTask(rng)],
    [1.4, () => storyTask(rng)],
    [0.8, () => readLineTask(rng)],
    [0.5, () => oppositeTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const ORDER_ITEMS = ["$-9$", "$-4$", "$-1$", "$2$", "$6$"];
const orderCheck: Exercise = {
  instruction: tx("Order from smallest to largest", "Ordne von der kleinsten zur größten Zahl"),
  answer: { kind: "order", items: ORDER_ITEMS, label: tx("Smallest at the top", "Kleinste Zahl oben") },
  hint: tx("Negative numbers first. Among them, the one with the biggest digits lies furthest left.", "Zuerst die negativen Zahlen. Die mit den größten Ziffern liegt am weitesten links."),
  solution: [
    { math: "\\group{-#as 4#a} \\quad 6#b \\quad \\group{-#cs 9#c} \\quad 2#d \\quad \\group{-#es 1#e}", note: tx("Picture the numbers on the number line.", "Stell dir die Zahlen auf der Zahlengeraden vor.") },
    { math: "\\group{-#cs 9#c} <#r1 \\group{-#as 4#a} <#r2 \\group{-#es 1#e} <#r3 2#d <#r4 6#b", note: tx("$-9$ lies furthest left, then $-4$ and $-1$. Then come the positive numbers.", "$-9$ liegt am weitesten links, dann $-4$ und $-1$. Danach kommen die positiven Zahlen.") },
  ],
  mistakes: [
    { when: { kind: "order", items: [...ORDER_ITEMS].reverse() }, title: tx("Wrong direction", "Falsche Richtung"), say: tx("You sorted from largest to smallest. Here the **smallest** number goes at the top.", "Du hast von groß nach klein sortiert. Hier gehört die **kleinste** Zahl nach oben.") },
    {
      when: { kind: "order", items: ["$-1$", "$-4$", "$-9$"] },
      title: tx("Sorted by the digits", "Nach den Ziffern sortiert"),
      say: tx("Ah, I see! You sorted the negative numbers by their digits. But $-9$ lies further **left** than $-1$, so $-9$ is smaller.", "Ah, ich seh's! Du hast die negativen Zahlen nach ihren Ziffern sortiert. Aber $-9$ liegt weiter **links** als $-1$, also ist $-9$ kleiner."),
    },
  ],
};

const bankCheck: Exercise = {
  instruction: tx("Solve the word problem", "Löse die Textaufgabe"),
  text: tx("Lea's account is overdrawn: her balance is $-15$ €. She pays in 40 €. What is her balance now?", "Leas Konto ist im Minus: Ihr Kontostand beträgt $-15$ €. Sie zahlt 40 € ein. Wie hoch ist ihr Kontostand jetzt?"),
  answer: numberAnswer(25, EURO),
  hint: tx("Paying in means going right from $-15$. How far is it to $0$? How much is left over?", "Einzahlen heißt: von $-15$ aus nach rechts. Wie weit ist es bis $0$? Wie viel bleibt übrig?"),
  solution: [
    { math: `-#as 15#a +#o 40#k`, note: tx("Paying in: add 40 €.", "Einzahlen: 40 € addieren.") },
    { math: `-#as 15#a +#o 40#k =#e 25#r "€"#u`, note: tx("15 € pay off the debt, the other 25 € stay in the account.", "15 € gleichen die Schulden aus, die übrigen 25 € bleiben auf dem Konto.") },
  ],
  mistakes: numberMistakes(
    25,
    [
      { v: -55, title: tx("Wrong direction", "Falsche Richtung"), say: tx("Paying in makes the balance **bigger**: add the 40 €.", "Einzahlen macht den Kontostand **größer**: 40 € addieren.") },
      { v: 55, title: tx("Ignored the minus", "Minus übersehen"), say: tx("The account was **in debt**: $-15$ €. First 15 € go to paying off the debt.", "Das Konto war **im Minus**: $-15$ €. Zuerst gehen 15 € für die Schulden drauf.") },
      { v: -25, title: tx("In debt or not?", "Schulden oder nicht?"), say: tx("Nearly! She paid in more than she owed, so the balance is above zero now.", "Fast! Sie hat mehr eingezahlt, als sie Schulden hatte. Der Kontostand ist jetzt über null."), close: true },
    ],
    EURO,
  ),
};

const doubleMinus: Chain = { first: -7, rest: [{ op: "-", v: -3 }] };
const doubleMinusCheck: Exercise = {
  ...chainExercise(doubleMinus, tx("First turn $- (-3)$ into $+ 3$.", "Mach zuerst aus $- (-3)$ ein $+ 3$.")),
  mistakes: numberMistakes(-4, [
    { v: -10, title: tx("Two minus signs", "Zwei Minuszeichen"), say: tx("Careful with $- (-3)$: subtracting a negative number means **adding**. Two minus signs in a row make a plus.", "Vorsicht bei $- (-3)$: Eine negative Zahl abziehen heißt **addieren**. Zwei Minuszeichen hintereinander ergeben plus.") },
    { v: 4, title: tx("Above or below zero?", "Über oder unter null?"), say: tx("Nearly! From $-7$ you go 3 steps right. Do you get past zero?", "Fast! Von $-7$ aus gehst du 3 Schritte nach rechts. Kommst du über die Null?"), close: true },
    { v: 10, title: tx("Both minus signs dropped", "Beide Minus weggelassen"), say: tx("The minus in front of the 7 stays! Start at $-7$ and then add 3.", "Das Minus vor der 7 bleibt! Start bei $-7$, dann 3 addieren.") },
  ]),
};

const changeCheck: Exercise = {
  instruction: tx("Find the change", "Bestimme die Änderung"),
  text: tx("At 6 a.m. the thermometer shows $-4$ °C, at 2 p.m. $7$ °C. By how many degrees did it get warmer?", "Um 6 Uhr zeigt das Thermometer $-4$ °C, um 14 Uhr $7$ °C. Um wie viel Grad ist es wärmer geworden?"),
  answer: numberAnswer(11, DEG),
  hint: tx("From $-4$ up to $0$, then on to $7$.", "Von $-4$ bis $0$, dann weiter bis $7$."),
  solution: [
    { math: `7#b -#m (-#as 4#a)#ab`, note: tx("New temperature minus old temperature.", "Neue Temperatur minus alte Temperatur.") },
    { math: `7#b +#as 4#a`, note: tx("Two minus signs make a plus.", "Zwei Minuszeichen ergeben plus."), highlight: ["as"] },
    { math: `7#b +#as 4#a =#e 11#r "°C"#u`, note: tx("4 degrees up to zero, 7 more above zero: it got 11 degrees warmer.", "4 Grad bis zur Null, 7 weitere über null: Es ist 11 Grad wärmer geworden.") },
  ],
  mistakes: numberMistakes(
    11,
    [
      { v: 3, title: tx("Counted only to one side", "Nur auf einer Seite gezählt"), say: tx("You worked out $7 - 4$. But $-4$ is **below** zero: count 4 up to zero, then 7 more.", "Du hast $7 - 4$ gerechnet. Aber $-4$ liegt **unter** null: Zähl 4 bis zur Null und dann noch 7.") },
      { v: -11, title: tx("A difference is positive", "Ein Unterschied ist positiv"), say: tx(`The question asks "by how many degrees": that's a positive amount.`, `Gefragt ist „um wie viel Grad“: Die Antwort ist also eine positive Zahl.`), close: true },
      { v: -3, title: tx("Counted only to one side", "Nur auf einer Seite gezählt"), say: tx("Count the steps from $-4$ to $7$ on the number line: across zero.", "Zähl die Schritte von $-4$ bis $7$ auf der Zahlengeraden: über die Null hinweg.") },
    ],
    DEG,
  ),
};

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Numbers below zero", "Zahlen unter null"),
      blob: tx("Brr, it's cold! Some numbers live below zero. Let's meet them.", "Brr, ist das kalt! Manche Zahlen wohnen unter null. Lernen wir sie kennen."),
      body: tx(
        "In winter the thermometer often shows temperatures **below zero**. We write them with a minus sign: $-5$ °C means five degrees below zero. Numbers with a minus sign are **negative numbers**. Numbers greater than zero are **positive numbers**. Zero itself is neither.",
        "Im Winter zeigt das Thermometer oft Temperaturen **unter null**. Wir schreiben sie mit einem Minuszeichen: $-5$ °C heißt fünf Grad unter null. Zahlen mit Minuszeichen sind **negative Zahlen**. Zahlen größer als null sind **positive Zahlen**. Die Null selbst ist weder positiv noch negativ.",
      ),
      visual: { component: asVisual(NegThermometer), props: { value: -5, caption: tx("$-5$ °C: five degrees below zero", "$-5$ °C: fünf Grad unter null") } },
      frames: [
        { math: `5#n "°C"#u`, note: tx("Five degrees **above** zero: a positive number. You could write $+5$, but the plus is usually left out.", "Fünf Grad **über** null: eine positive Zahl. Du könntest $+5$ schreiben, aber das Plus lässt man meistens weg.") },
        { math: `-#m 5#n "°C"#u`, highlight: ["m"], note: tx('Five degrees **below** zero: a minus goes in front. Read it as "minus five degrees".', "Fünf Grad **unter** null: Davor kommt ein Minus. Lies: „minus fünf Grad“.") },
        {
          math: `… \\quad \\group{-#m3 3#n3} \\quad \\group{-#m2 2#n2} \\quad \\group{-#m1 1#n1} \\quad 0#z \\quad 1#p1 \\quad 2#p2 \\quad 3#p3 \\quad …#e`,
          note: tx("Put all the numbers in a row: that's the **number line**. Negative numbers sit to the **left** of zero, positive numbers to the right.", "Leg alle Zahlen in eine Reihe: Das ist die **Zahlengerade**. Negative Zahlen stehen **links** von der Null, positive rechts."),
        },
        {
          math: `… \\quad \\group{-#m3 3#n3} \\quad \\group{-#m2 2#n2} \\quad \\group{-#m1 1#n1} \\quad 0#z \\quad 1#p1 \\quad 2#p2 \\quad 3#p3 \\quad …#e`,
          highlight: ["m3", "n3", "p3"],
          arrows: [["n3", "p3"]],
          note: tx("$-3$ and $3$ are the same distance from zero, on opposite sides. They are **opposite numbers**.", "$-3$ und $3$ sind gleich weit von der Null entfernt, auf verschiedenen Seiten. Sie sind **Gegenzahlen**."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Compare on the number line", "Vergleichen auf der Zahlengeraden"),
      blob: tx("Drag the points around. Which number is smaller?", "Zieh die Punkte hin und her. Welche Zahl ist kleiner?"),
      body: tx(
        "On the number line, numbers get bigger to the right. So the number further **left** is always the smaller one: $-8 < -2$, even though 8 looks bigger than 2.",
        "Auf der Zahlengeraden werden die Zahlen nach rechts größer. Die Zahl weiter **links** ist also immer die kleinere: $-8 < -2$, auch wenn 8 größer aussieht als 2.",
      ),
      widget: NegCompare,
    },
    {
      type: "explain",
      title: tx("Ordering numbers", "Zahlen ordnen"),
      blob: tx("Think of the thermometer: −7\u00a0°C is colder than −2\u00a0°C.", "Denk ans Thermometer: Bei −7\u00a0°C ist es kälter als bei −2\u00a0°C."),
      body: tx(
        "For negative numbers: the bigger the digits after the minus, the **smaller** the number. A debt of 50 € is worse than a debt of 10 €.",
        "Bei negativen Zahlen gilt: Je größer die Ziffern hinter dem Minus, desto **kleiner** die Zahl. 50 € Schulden sind schlimmer als 10 € Schulden.",
      ),
      frames: [
        { math: "\\group{-#as 7#a} \\quad ?#q \\quad \\group{-#bs 2#b}", note: tx("Which one is smaller, $-7$ or $-2$?", "Welche Zahl ist kleiner, $-7$ oder $-2$?") },
        { math: "\\group{-#as 7#a} <#q2 \\group{-#bs 2#b}", highlight: ["q2"], note: tx('$-7$ lies further left, so $-7 < -2$. Read: "minus 7 is less than minus 2".', "$-7$ liegt weiter links, also gilt $-7 < -2$. Lies: „minus 7 ist kleiner als minus 2“.") },
        { math: "3#c \\quad \\group{-#ds 5#d} \\quad 0#e \\quad \\group{-#fs 1#f} \\quad \\group{-#gs 8#g} \\quad 2#h", note: tx("Now a whole row. Let's sort it from smallest to largest.", "Jetzt eine ganze Reihe. Wir sortieren sie von der kleinsten zur größten Zahl.") },
        {
          math: "\\group{-#gs 8#g} <#l1 \\group{-#ds 5#d} <#l2 \\group{-#fs 1#f} <#l3 0#e <#l4 2#h <#l5 3#c",
          note: tx("First the negative numbers (furthest left first), then $0$, then the positive numbers.", "Zuerst die negativen Zahlen (die am weitesten links zuerst), dann die $0$, dann die positiven Zahlen."),
        },
      ],
    },
    { type: "check", blob: tx("Your turn: sort these from smallest to largest.", "Du bist dran: Sortier die Zahlen von klein nach groß."), exercise: orderCheck },
    {
      type: "explain",
      title: tx("Warmer and colder", "Wärmer und kälter"),
      blob: tx("Temperatures go up and down. On the number line that's walking right or left.", "Temperaturen steigen und fallen. Auf der Zahlengeraden heißt das: nach rechts oder links gehen."),
      body: tx(
        "If it gets **warmer**, you go **right** on the number line: you add. If it gets **colder**, you go **left**: you subtract. This works across zero too.",
        "Wird es **wärmer**, gehst du auf der Zahlengeraden nach **rechts**: Du addierst. Wird es **kälter**, gehst du nach **links**: Du subtrahierst. Das klappt auch über die Null hinweg.",
      ),
      visual: { component: asVisual(NegThermometer), props: { from: -3, value: 2, caption: tx("From $-3$ °C, 5 degrees warmer", "Von $-3$ °C aus 5 Grad wärmer") } },
      frames: [
        { math: `-#as 3#a "°C"#u`, note: tx("In the morning it's $-3$ °C.", "Am Morgen sind es $-3$ °C.") },
        { math: `-#as 3#a +#p 5#b`, note: tx("By noon it gets 5 degrees warmer: go 5 steps to the right.", "Bis zum Mittag wird es 5 Grad wärmer: 5 Schritte nach rechts.") },
        { math: `-#as 3#a +#p 5#b =#e 2#r`, note: tx("3 steps take you to $0$, 2 more to $2$. So $-3 + 5 = 2$.", "Mit 3 Schritten bist du bei $0$, mit 2 weiteren bei $2$. Also ist $-3 + 5 = 2$.") },
        { math: `4#c -#m 6#d`, note: tx("At $4$ °C it gets 6 degrees colder: go 6 steps to the left.", "Bei $4$ °C wird es 6 Grad kälter: 6 Schritte nach links.") },
        { math: `4#c -#m 6#d =#e -#rs 2#r`, note: tx("4 steps down to $0$, 2 more below zero: $4 - 6 = -2$.", "4 Schritte bis zur $0$, 2 weitere unter null: $4 - 6 = -2$.") },
      ],
    },
    { type: "check", blob: tx("Money works the same way. A minus on the account means debt.", "Mit Geld funktioniert das genauso. Ein Minus auf dem Konto bedeutet Schulden."), exercise: bankCheck },
    {
      type: "widget",
      title: tx("Blob walks the number line", "Blob läuft auf der Zahlengeraden"),
      blob: tx("Help me walk! The operation sign tells me where to look, the sign of the number whether I walk forwards or backwards.", "Hilf mir beim Laufen! Das Rechenzeichen sagt mir, wohin ich schaue, das Vorzeichen, ob ich vorwärts oder rückwärts laufe."),
      body: tx(
        "The **operation sign** ($+$ or $-$) decides which way Blob looks: plus means right, minus means left. The **sign of the number** decides how Blob walks: positive means forwards, negative means backwards. Try $3 - (-4)$!",
        "Das **Rechenzeichen** ($+$ oder $-$) bestimmt, wohin Blob schaut: Plus heißt nach rechts, Minus heißt nach links. Das **Vorzeichen** der Zahl bestimmt, wie Blob läuft: positiv heißt vorwärts, negativ heißt rückwärts. Probier mal $3 - (-4)$!",
      ),
      widget: NegWalker,
    },
    {
      type: "explain",
      title: tx("When two signs meet", "Wenn zwei Zeichen aufeinandertreffen"),
      blob: tx("Here's the shortcut, so you don't need to walk every time.", "Hier kommt die Abkürzung, damit du nicht jedes Mal laufen musst."),
      body: tx(
        "Adding a negative number is the same as subtracting. Subtracting a negative number is the same as adding. Think of debts: if someone takes away 3 € of your debts, you are 3 € richer!",
        "Eine negative Zahl addieren ist dasselbe wie subtrahieren. Eine negative Zahl subtrahieren ist dasselbe wie addieren. Denk an Schulden: Nimmt dir jemand 3 € Schulden weg, bist du 3 € reicher!",
      ),
      frames: [
        { math: "5#a +#o (-#s 3#b)#k", highlight: ["o", "s"], note: tx("Plus a negative number: Blob looks right, but walks backwards.", "Plus eine negative Zahl: Blob schaut nach rechts, läuft aber rückwärts.") },
        { math: "5#a -#s 3#b", highlight: ["s"], note: tx("That's the same as minus: $5 + (-3) = 5 - 3$.", "Das ist dasselbe wie minus: $5 + (-3) = 5 - 3$.") },
        { math: "5#a -#s 3#b =#e 2#r", note: tx("$= 2$.", "$= 2$.") },
        { math: "5#a -#o (-#s 3#b)#k", highlight: ["o", "s"], note: tx("Minus a negative number: Blob looks left and walks backwards, so to the right!", "Minus eine negative Zahl: Blob schaut nach links und läuft rückwärts, also nach rechts!") },
        { math: "5#a +#s 3#b =#e 8#r", highlight: ["s"], note: tx("Two minus signs become a plus: $5 - (-3) = 5 + 3 = 8$.", "Aus zwei Minuszeichen wird ein Plus: $5 - (-3) = 5 + 3 = 8$.") },
        {
          math: "\\group{+(-3) = -3} \\quad \\group{-(-3) = +3}",
          note: tx("In short: **equal signs** next to each other give plus, **different signs** give minus.", "Kurz gesagt: **Gleiche Zeichen** nebeneinander ergeben plus, **verschiedene Zeichen** ergeben minus."),
        },
      ],
    },
    { type: "check", blob: tx("Two minus signs in a row. What do they become?", "Zwei Minuszeichen hintereinander. Was wird daraus?"), exercise: doubleMinusCheck },
    {
      type: "explain",
      title: tx("How big is the change?", "Wie groß ist die Änderung?"),
      blob: tx("From −3\u00a0°C to 5\u00a0°C: how many degrees warmer is that?", "Von −3\u00a0°C auf 5\u00a0°C: Wie viel Grad wärmer ist das?"),
      body: tx(
        "To find a change, count the steps between the two numbers, or calculate **new value minus old value**. If the result is positive, it went up. If it's negative, it went down.",
        "Für eine Änderung zählst du die Schritte zwischen den beiden Zahlen oder rechnest **neuer Wert minus alter Wert**. Ist das Ergebnis positiv, ging es nach oben. Ist es negativ, ging es nach unten.",
      ),
      visual: { component: asVisual(NegThermometer), props: { from: -3, value: 5, caption: tx("From $-3$ °C to $5$ °C: 8 degrees warmer", "Von $-3$ °C auf $5$ °C: 8 Grad wärmer") } },
      frames: [
        { math: `-#as 3#a "°C"#u1 \\to#ar 5#b "°C"#u2`, note: tx("From $-3$ °C to $5$ °C.", "Von $-3$ °C auf $5$ °C.") },
        { math: `3#a +#p 5#b`, note: tx("From $-3$ up to $0$: 3 degrees. From $0$ to $5$: another 5 degrees.", "Von $-3$ bis $0$: 3 Grad. Von $0$ bis $5$: noch einmal 5 Grad.") },
        { math: `3#a +#p 5#b =#e 8#r`, note: tx("Together it got 8 degrees warmer.", "Zusammen ist es 8 Grad wärmer geworden.") },
        { math: `5#b -#m (-#as 3#a)#k =#e 8#r`, note: tx("As a calculation: new minus old, $5 - (-3) = 5 + 3 = 8$.", "Als Rechnung: neu minus alt, $5 - (-3) = 5 + 3 = 8$.") },
        { math: `-#cs 2#c -#m 6#d =#e -#rs 8#r`, note: tx("And from $6$ °C to $-2$ °C? New minus old: $-2 - 6 = -8$. The temperature **fell** by 8 degrees.", "Und von $6$ °C auf $-2$ °C? Neu minus alt: $-2 - 6 = -8$. Die Temperatur ist um 8 Grad **gefallen**.") },
      ],
    },
    { type: "check", blob: tx("Last one! Count across zero.", "Die letzte! Zähl über die Null hinweg."), exercise: changeCheck },
  ],
  summary: [
    {
      title: tx("Number line and order", "Zahlengerade und Anordnung"),
      body: tx("Numbers get bigger from left to right. Negative numbers lie left of $0$. The further left, the smaller.", "Nach rechts werden die Zahlen größer. Negative Zahlen liegen links von der $0$. Je weiter links, desto kleiner."),
      examples: ["-8 < -5 < -1 < 0 < 3", "-7 < -2"],
      tone: "rule",
    },
    {
      title: tx("Opposite numbers", "Gegenzahlen"),
      body: tx("$-4$ and $4$ are opposite numbers: the same distance from $0$, on opposite sides. Below zero means negative: temperatures, depths below sea level, debts.", "$-4$ und $4$ sind Gegenzahlen: gleich weit von der $0$ entfernt, auf verschiedenen Seiten. Unter null heißt negativ: bei Temperaturen, Tiefen unter dem Meeresspiegel und Schulden."),
      tone: "tip",
    },
    {
      title: tx("Adding and subtracting", "Addieren und Subtrahieren"),
      body: tx("Plus means go right, minus means go left. Across zero, count in two steps.", "Plus heißt nach rechts gehen, minus heißt nach links gehen. Über die Null hinweg zählst du in zwei Schritten."),
      examples: ["-3 + 5 = 2", "4 - 6 = -2", "-2 - 5 = -7"],
      tone: "rule",
    },
    {
      title: tx("Two signs meet", "Zwei Zeichen treffen aufeinander"),
      body: tx("Equal signs give plus, different signs give minus.", "Gleiche Zeichen ergeben plus, verschiedene Zeichen ergeben minus."),
      examples: ["5 + (-3) = 5 - 3 = 2", "5 - (-3) = 5 + 3 = 8"],
      tone: "rule",
    },
    {
      title: tx("Changes", "Änderungen"),
      body: tx("Change = new value minus old value. Positive: it went up. Negative: it went down.", "Änderung = neuer Wert minus alter Wert. Positiv: Es ging nach oben. Negativ: Es ging nach unten."),
      examples: ["5 - (-3) = 8", "-2 - 6 = -8"],
      tone: "tip",
    },
    {
      title: tx("Classic traps", "Typische Fallen"),
      body: tx("$-7$ is **not** bigger than $-2$. And $- (-3)$ is **plus** 3, not minus 3.", "$-7$ ist **nicht** größer als $-2$. Und $- (-3)$ ist **plus** 3, nicht minus 3."),
      examples: ["-7 < -2", "1 - (-3) = 4"],
      tone: "warning",
    },
  ],
};

