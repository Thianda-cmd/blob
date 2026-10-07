"use client";

import { resolveText, tx, type Text } from "@/i18n/text";
import { frac, type Frac } from "@/learn/engine/frac";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { Graph, type GraphProps } from "@/learn/visuals/Graph";
import type { ComponentType } from "react";
import { numIn, r6, say } from "./kit";
import { lineSrc, mistakeList, plain, pt, q, type Msg } from "./level2";
import { QuadrantPicture, StoryGraph, ValueTable, WalkPicture } from "./visuals1";
import { PointHunt, ProportionalLab, TableBuilder } from "./widgets1";

// Level 1 (Klasse 6–7): the coordinate system, points in all four quadrants, tables of
// values from a rule, and proportional functions y = m · x with their graph through the origin.

const view = <P extends object>(component: ComponentType<P>, props: P): NonNullable<Exercise["visual"]> => ({
  component: component as unknown as ComponentType<Record<string, unknown>>,
  props: props as unknown as Record<string, unknown>,
});
const graph = (props: GraphProps) => view(Graph, props);

/** A point with keyed coordinates, so the numbers glide: P#P (−#sx 3#x \, |#bar 2#y)#br. */
function ptK(x: number | string, y: number | string, name: string): string {
  const part = (v: number | string, k: string) => (typeof v === "string" ? `${v}#${k}` : `${v < 0 ? `-#s${k} ` : ""}${Math.abs(v)}#${k}`);
  const gap = typeof y === "number" && y < 0 ? "" : " \\,";
  return `${name}#P (${part(x, "x")} \\, |#bar${gap} ${part(y, "y")})#br`;
}

/** "3 to the right" / "3 nach rechts" etc. */
function walk(v: number, axis: "x" | "y"): Text {
  const n = Math.abs(v);
  if (axis === "x") return v > 0 ? tx(`$${n}$ to the right`, `$${n}$ nach rechts`) : tx(`$${n}$ to the left`, `$${n}$ nach links`);
  return v > 0 ? tx(`$${n}$ up`, `$${n}$ nach oben`) : tx(`$${n}$ down`, `$${n}$ nach unten`);
}

const EN = (t: Text) => resolveText(t, "en");
const DE = (t: Text) => resolveText(t, "de");

const money = (v: number, l: "en" | "de") => {
  const s = Number.isInteger(r6(v)) ? String(r6(v)) : v.toFixed(2);
  return l === "de" ? s.replace(".", ",") : s;
};

// ---------------------------------------------------------------------------
// Reading a point off the grid

const XY: [string, string] = ["x", "y"];
const xyPair = (x: number, y: number): AnswerSpec => ({ kind: "pair", names: XY, values: [x, y] });

function readPointMistakes(x: number, y: number, name: string): Mistake[] {
  const mk = mistakeList(xyPair(x, y));
  mk.add(
    xyPair(y, x),
    tx("x and y swapped", "x und y vertauscht"),
    tx(
      `Ah, the right numbers in the wrong order! The **first** coordinate is always $x$ (right or left), the second is $y$ (up or down). First walk, then jump.`,
      `Ah, die richtigen Zahlen in der falschen Reihenfolge! Die **erste** Koordinate ist immer $x$ (nach rechts oder links), die zweite $y$ (nach oben oder unten). Erst laufen, dann springen.`,
    ),
  );
  if (x !== 0 && y !== 0) {
    mk.add(
      xyPair(-x, -y),
      tx("Both signs flipped", "Beide Vorzeichen falsch"),
      tx(
        `Nearly! Both directions are flipped. Is $${name}$ right or left of the $y$-axis? Above or below the $x$-axis?`,
        `Fast! Beide Richtungen sind andersrum. Liegt $${name}$ rechts oder links der $y$-Achse? Über oder unter der $x$-Achse?`,
      ),
    );
  }
  if (x !== 0) {
    mk.add(
      xyPair(-x, y),
      tx("Sign of x", "Vorzeichen von x"),
      x < 0
        ? tx(`Nearly! $${name}$ is **left** of the $y$-axis, so its $x$-coordinate is negative.`, `Fast! $${name}$ liegt **links** der $y$-Achse, also ist die $x$-Koordinate negativ.`)
        : tx(`Nearly! $${name}$ is **right** of the $y$-axis, so its $x$-coordinate is positive.`, `Fast! $${name}$ liegt **rechts** der $y$-Achse, also ist die $x$-Koordinate positiv.`),
    );
  }
  if (y !== 0) {
    mk.add(
      xyPair(x, -y),
      tx("Sign of y", "Vorzeichen von y"),
      y < 0
        ? tx(`Nearly! $${name}$ is **below** the $x$-axis, so its $y$-coordinate is negative.`, `Fast! $${name}$ liegt **unter** der $x$-Achse, also ist die $y$-Koordinate negativ.`)
        : tx(`Nearly! $${name}$ is **above** the $x$-axis, so its $y$-coordinate is positive.`, `Fast! $${name}$ liegt **über** der $x$-Achse, also ist die $y$-Koordinate positiv.`),
    );
  }
  return mk.list;
}

function readPointFrames(x: number, y: number, name: string): Frame[] {
  const xNote: Text =
    x === 0
      ? tx("Start at the origin. $" + name + "$ is straight above or below it: $x = 0$.", "Starte im Ursprung. $" + name + "$ liegt genau darüber oder darunter: $x = 0$.")
      : tx(`Start at the origin and walk along the $x$-axis: ${EN(walk(x, "x"))}. So $x = ${x}$.`, `Starte im Ursprung und lauf an der $x$-Achse entlang: ${DE(walk(x, "x"))}. Also ist $x = ${x}$.`);
  const yNote: Text =
    y === 0
      ? tx(`$${name}$ lies on the $x$-axis, so $y = 0$. Together: $${pt(x, y, name)}$.`, `$${name}$ liegt auf der $x$-Achse, also ist $y = 0$. Zusammen: $${pt(x, y, name)}$.`)
      : tx(`Then jump: ${EN(walk(y, "y"))}. So $y = ${y}$, and the point is $${pt(x, y, name)}$.`, `Dann springen: ${DE(walk(y, "y"))}. Also ist $y = ${y}$, und der Punkt heißt $${pt(x, y, name)}$.`);
  return [
    { math: ptK("?", "?", name), note: tx("A point is written as $(x | y)$: first $x$, then $y$.", "Ein Punkt wird als $(x | y)$ geschrieben: erst $x$, dann $y$.") },
    { math: ptK(x, "?", name), highlight: ["x", "sx"], note: xNote },
    { math: ptK(x, y, name), highlight: ["y", "sy"], note: yNote },
  ];
}

const I_READ = tx("Read the coordinates", "Lies die Koordinaten ab");

function readPointExercise(x: number, y: number, name: string): Exercise {
  return {
    instruction: I_READ,
    text: tx(`Read off the coordinates of the point $${name}$.`, `Lies die Koordinaten des Punktes $${name}$ ab.`),
    visual: graph({ xRange: [-6, 6], yRange: [-6, 6], points: [{ x, y, key: "p", label: name, color: "blob" }] }),
    answer: xyPair(x, y),
    hint: tx(
      "Start at the origin. How far right or left? That's $x$. Then how far up or down? That's $y$. Left and down are negative.",
      "Starte im Ursprung. Wie weit nach rechts oder links? Das ist $x$. Dann wie weit nach oben oder unten? Das ist $y$. Links und unten sind negativ.",
    ),
    solution: readPointFrames(x, y, name),
    mistakes: readPointMistakes(x, y, name),
  };
}

function readPointTask(rng: Rng): Exercise {
  const onAxis = rng.chance(0.15);
  let x = rng.nonZero(-5, 5);
  let y = rng.nonZero(-5, 5);
  if (onAxis) {
    if (rng.chance(0.5)) x = 0;
    else y = 0;
  }
  return readPointExercise(x, y, rng.pick(["A", "B", "C", "D", "P", "Q", "R"]));
}

// ---------------------------------------------------------------------------
// Quadrants

type QIndex = 0 | 1 | 2 | 3 | 4; // 0..3 = quadrant I..IV, 4 = on an axis
const quadrantIndex = (x: number, y: number): QIndex => (x === 0 || y === 0 ? 4 : x > 0 ? (y > 0 ? 0 : 3) : y > 0 ? 1 : 2);
const Q_OPTIONS: Text[] = [
  tx("Quadrant I", "I. Quadrant"),
  tx("Quadrant II", "II. Quadrant"),
  tx("Quadrant III", "III. Quadrant"),
  tx("Quadrant IV", "IV. Quadrant"),
  tx("On an axis (no quadrant)", "Auf einer Achse (kein Quadrant)"),
];
const Q_SIGNS = ["(+ \\; | \\; +)", "(- \\; | \\; +)", "(- \\; | \\; -)", "(+ \\; | \\; -)"];
const Q_WHERE: Text[] = [tx("top right", "oben rechts"), tx("top left", "oben links"), tx("bottom left", "unten links"), tx("bottom right", "unten rechts")];

/** Why choosing quadrant `wrong` instead of `right` is wrong. */
function quadrantMsg(right: QIndex, wrong: QIndex): Msg {
  if (right === 4) {
    return [
      tx("A coordinate is 0", "Eine Koordinate ist 0"),
      tx(
        "Look at the coordinates: one of them is $0$. Then the point lies **on an axis**, and points on the axes belong to no quadrant.",
        "Schau dir die Koordinaten an: Eine davon ist $0$. Dann liegt der Punkt **auf einer Achse**, und Punkte auf den Achsen gehören zu keinem Quadranten.",
      ),
    ];
  }
  if (wrong === 4) {
    return [
      tx("Not on an axis", "Nicht auf einer Achse"),
      tx("Neither coordinate is $0$, so the point isn't on an axis. Look at the two signs: which corner does that give?", "Keine Koordinate ist $0$, also liegt der Punkt nicht auf einer Achse. Schau auf die beiden Vorzeichen: Welche Ecke ergibt das?"),
    ];
  }
  if ((right === 1 && wrong === 3) || (right === 3 && wrong === 1)) {
    return [
      tx("Counterclockwise", "Gegen den Uhrzeigersinn"),
      tx(
        "Nearly! The quadrants are numbered **counterclockwise**: I top right, II top left, III bottom left, IV bottom right. And remember: the first number is $x$.",
        "Fast! Die Quadranten werden **gegen den Uhrzeigersinn** nummeriert: I oben rechts, II oben links, III unten links, IV unten rechts. Und denk dran: Die erste Zahl ist $x$.",
      ),
    ];
  }
  if ((right === 0 && wrong === 2) || (right === 2 && wrong === 0)) {
    return [
      tx("Both signs", "Beide Vorzeichen"),
      right === 0
        ? tx("Look at the signs again: both coordinates are **positive**, right and up. That's the top right corner.", "Schau noch mal auf die Vorzeichen: Beide Koordinaten sind **positiv**, nach rechts und nach oben. Das ist die Ecke oben rechts.")
        : tx("Look at the signs again: both coordinates are **negative**, left and down. That's the bottom left corner.", "Schau noch mal auf die Vorzeichen: Beide Koordinaten sind **negativ**, nach links und nach unten. Das ist die Ecke unten links."),
    ];
  }
  // One sign is off: which one?
  const xr = right === 0 || right === 3 ? 1 : -1;
  const xw = wrong === 0 || wrong === 3 ? 1 : -1;
  const xOff = xr !== xw;
  return [
    tx("One sign off", "Ein Vorzeichen daneben"),
    xOff
      ? xr > 0
        ? tx("Close! Check $x$: it's positive, so the point is **right** of the $y$-axis.", "Knapp! Prüf $x$: Es ist positiv, der Punkt liegt also **rechts** der $y$-Achse.")
        : tx("Close! Check $x$: it's negative, so the point is **left** of the $y$-axis.", "Knapp! Prüf $x$: Es ist negativ, der Punkt liegt also **links** der $y$-Achse.")
      : right === 0 || right === 1
        ? tx("Close! Check $y$: it's positive, so the point is **above** the $x$-axis.", "Knapp! Prüf $y$: Es ist positiv, der Punkt liegt also **über** der $x$-Achse.")
        : tx("Close! Check $y$: it's negative, so the point is **below** the $x$-axis.", "Knapp! Prüf $y$: Es ist negativ, der Punkt liegt also **unter** der $x$-Achse."),
  ];
}

/** Why the point picked (in quadrant `chosen`) is not the one in quadrant `target`. */
function pickMsg(target: 0 | 1 | 2 | 3, chosen: 0 | 1 | 2 | 3): Msg {
  if ((target === 1 && chosen === 3) || (target === 3 && chosen === 1)) return quadrantMsg(target, chosen);
  const R = ["I", "II", "III", "IV"];
  return [
    tx("Check the signs", "Prüf die Vorzeichen"),
    tx(
      `This point has the signs $${Q_SIGNS[chosen]}$, so it lies ${EN(Q_WHERE[chosen])}. Quadrant ${R[target]} needs $${Q_SIGNS[target]}$.`,
      `Dieser Punkt hat die Vorzeichen $${Q_SIGNS[chosen]}$, er liegt also ${DE(Q_WHERE[chosen])}. Der ${R[target]}. Quadrant braucht $${Q_SIGNS[target]}$.`,
    ),
  ];
}

function quadrantFrames(x: number, y: number, name: string): Frame[] {
  const qi = quadrantIndex(x, y);
  const frames: Frame[] = [{ math: ptK(x, y, name), highlight: ["x", "sx"], note: x === 0 ? tx("$x = 0$: the point lies on the $y$-axis.", "$x = 0$: Der Punkt liegt auf der $y$-Achse.") : tx(`$x = ${x}$ is ${x > 0 ? "positive: right" : "negative: left"}.`, `$x = ${x}$ ist ${x > 0 ? "positiv: rechts" : "negativ: links"}.`) }];
  if (x !== 0)
    frames.push({
      math: ptK(x, y, name),
      highlight: ["y", "sy"],
      note: y === 0 ? tx("$y = 0$: the point lies on the $x$-axis.", "$y = 0$: Der Punkt liegt auf der $x$-Achse.") : tx(`$y = ${y}$ is ${y > 0 ? "positive: up" : "negative: down"}.`, `$y = ${y}$ ist ${y > 0 ? "positiv: oben" : "negativ: unten"}.`),
    });
  frames.push(
    qi === 4
      ? { math: ptK(x, y, name), note: tx("Points on an axis belong to **no** quadrant.", "Punkte auf einer Achse gehören zu **keinem** Quadranten.") }
      : {
          math: `${ptK(x, y, name)} \\quad ${Q_SIGNS[qi]}`,
          note: tx(`Signs $${Q_SIGNS[qi]}$: ${EN(Q_WHERE[qi])}, that's **quadrant ${["I", "II", "III", "IV"][qi]}**.`, `Vorzeichen $${Q_SIGNS[qi]}$: ${DE(Q_WHERE[qi])}, das ist der **${["I", "II", "III", "IV"][qi]}. Quadrant**.`),
        },
  );
  return frames;
}

const HINT_Q = tx(
  "Quadrants go counterclockwise: I top right $(+ | +)$, II top left $(- | +)$, III bottom left $(- | -)$, IV bottom right $(+ | -)$.",
  "Die Quadranten gehen gegen den Uhrzeigersinn: I oben rechts $(+ | +)$, II oben links $(- | +)$, III unten links $(- | -)$, IV unten rechts $(+ | -)$.",
);

function quadrantTask(rng: Rng): Exercise {
  if (rng.chance(0.65)) {
    let x = rng.nonZero(-9, 9);
    let y = rng.nonZero(-9, 9);
    if (rng.chance(0.15)) {
      if (rng.chance(0.5)) x = 0;
      else y = 0;
    }
    const name = rng.pick(["A", "B", "P", "Q", "R", "S"]);
    const right = quadrantIndex(x, y);
    const answer = { kind: "choice" as const, options: Q_OPTIONS, correct: right };
    const mk = mistakeList(answer);
    for (let i = 0 as QIndex; i <= 4; i = (i + 1) as QIndex) if (i !== right) mk.add({ ...answer, correct: i }, ...quadrantMsg(right, i));
    return {
      instruction: tx("Which quadrant?", "Welcher Quadrant?"),
      text: tx(`Where does the point $${pt(x, y, name)}$ lie?`, `Wo liegt der Punkt $${pt(x, y, name)}$?`),
      answer,
      hint: HINT_Q,
      solution: quadrantFrames(x, y, name),
      mistakes: mk.list,
    };
  }
  // Which of four points lies in quadrant k?
  const k = rng.int(0, 3) as 0 | 1 | 2 | 3;
  const signs: [number, number][] = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ];
  const names = ["A", "B", "C", "D"];
  const pts = rng.shuffle(signs.map(([sx, sy]) => [sx * rng.int(1, 8), sy * rng.int(1, 8)] as [number, number]));
  const right = pts.findIndex(([x, y]) => quadrantIndex(x, y) === k);
  const answer = { kind: "choice" as const, options: pts.map(([x, y], i) => `$${pt(x, y, names[i])}$`), correct: right };
  const mk = mistakeList(answer);
  pts.forEach(([x, y], i) => i !== right && mk.add({ ...answer, correct: i }, ...pickMsg(k, quadrantIndex(x, y) as 0 | 1 | 2 | 3)));
  const [rx, ry] = pts[right];
  return {
    instruction: tx("Find the point", "Finde den Punkt"),
    text: tx(`Which point lies in **quadrant ${["I", "II", "III", "IV"][k]}**?`, `Welcher Punkt liegt im **${["I", "II", "III", "IV"][k]}. Quadranten**?`),
    answer,
    hint: HINT_Q,
    solution: [
      { math: Q_SIGNS[k], note: tx(`Quadrant ${["I", "II", "III", "IV"][k]} is ${EN(Q_WHERE[k])}: the signs are $${Q_SIGNS[k]}$.`, `Der ${["I", "II", "III", "IV"][k]}. Quadrant liegt ${DE(Q_WHERE[k])}: Die Vorzeichen sind $${Q_SIGNS[k]}$.`) },
      { math: `${ptK(rx, ry, names[right])} \\quad ${Q_SIGNS[k]}`, note: tx(`Only $${names[right]}$ has these signs: $${pt(rx, ry, names[right])}$.`, `Nur $${names[right]}$ hat diese Vorzeichen: $${pt(rx, ry, names[right])}$.`) },
    ],
    mistakes: mk.list,
  };
}

// ---------------------------------------------------------------------------
// Tables of values

/** The keyed computation of y = m·x + b at x, frame by frame. */
function valueFrames(m: number, b: number, x: number, done: (y: number) => Text): Frame[] {
  const M = q(m);
  const B = q(b);
  const prod = m * x;
  const y = prod + b;
  const xs = x < 0 ? `(-#sx ${-x}#x)#xp` : `${x}#x`;
  const mPart = m === 1 ? "" : m === -1 ? "-#sm " : `${m < 0 ? "-#sm " : ""}${Math.abs(m)}#cm \\cdot#dot `;
  const bPart = b === 0 ? "" : ` ${b < 0 ? "-" : "+"}#sb ${Math.abs(b)}#cb`;
  const prodSrc = `${prod < 0 ? "-#sp " : ""}${Math.abs(prod)}#cp`;
  const frames: Frame[] = [
    { math: lineSrc(M, B), highlight: ["vm"], note: tx(`Put $x = ${x}$ into the rule.`, `Setze $x = ${x}$ in die Vorschrift ein.`) },
    {
      math: `y#Y =#EQ ${mPart}${xs}${bPart}`,
      note: x < 0 ? tx("A negative number goes in brackets. Multiply first, then add.", "Eine negative Zahl kommt in Klammern. Erst multiplizieren, dann addieren.") : tx("Multiply first, then add.", "Erst multiplizieren, dann addieren."),
    },
  ];
  if (b !== 0 && !(m === 1 && x >= 0)) frames.push({ math: `y#Y =#EQ ${prodSrc}${bPart}`, note: `$${m === 1 ? "" : m === -1 ? "-" : `${m} \\cdot `}${x < 0 ? `(${x})` : x} = ${prod}$.` });
  frames.push({ math: `y#Y =#EQ ${y < 0 ? "-#sp " : ""}${Math.abs(y)}#cp`, note: done(y) });
  return frames;
}

function valueMistakes(m: number, b: number, x: number): Mistake[] {
  const prod = m * x;
  const mk = mistakeList({ kind: "number", value: prod + b });
  const times = `$${m} \\cdot ${x < 0 ? `(${x})` : x}$`;
  if (m < 0 || x < 0) {
    const neg = (v: number) => (v < 0 ? tx("minus", "Minus") : tx("plus", "Plus"));
    const res = prod < 0 ? tx("minus", "Minus") : tx("plus", "Plus");
    mk.add(
      { kind: "number", value: -prod + b },
      tx("Sign of the product", "Vorzeichen vom Produkt"),
      tx(
        `Careful with the signs: ${times} is ${EN(neg(m))} times ${EN(neg(x))}, and that gives **${EN(res)}**.`,
        `Achtung bei den Vorzeichen: ${times} ist ${DE(neg(m))} mal ${DE(neg(x))}, und das ergibt **${DE(res)}**.`,
      ),
    );
  }
  if (Math.abs(m) !== 1) {
    mk.add(
      { kind: "number", value: m + x + b },
      tx("Plus instead of times", "Plus statt mal"),
      tx(`Ah, I think you added $${m}$ and $${x}$. But $${m}x$ means $${m}$ **times** $x$.`, `Ah, ich glaub, du hast $${m}$ und $${x}$ addiert. Aber $${m}x$ heißt $${m}$ **mal** $x$.`),
    );
  }
  if (b !== 0) {
    mk.add(
      { kind: "number", value: prod },
      tx("Last step missing", "Letzter Schritt fehlt"),
      tx(`Good start with ${times}! But the rule goes on: the $${b > 0 ? `+ ${b}` : `- ${-b}`}$ still has to be included.`, `Guter Anfang mit ${times}! Aber die Vorschrift geht weiter: Das $${b > 0 ? `+ ${b}` : `- ${-b}`}$ gehört noch dazu.`),
    );
  }
  return mk.list;
}

const I_TABLE = tx("Complete the table", "Vervollständige die Wertetabelle");

function tableExercise(m: number, b: number, xs: number[], gap: number): Exercise {
  const rule = plain(lineSrc(q(m), q(b)));
  const x = xs[gap];
  const y = m * x + b;
  return {
    instruction: I_TABLE,
    text: tx(`The table belongs to the rule $${rule}$. Which number belongs in the gap?`, `Die Tabelle gehört zur Vorschrift $${rule}$. Welche Zahl gehört in die Lücke?`),
    visual: view(ValueTable, { xs, ys: xs.map((v, i) => (i === gap ? null : m * v + b)), mark: gap }),
    answer: { kind: "number", value: y, label: "y =" },
    hint: tx(`Put $x = ${x}$ into $${rule}$. Multiply before you add.`, `Setze $x = ${x}$ in $${rule}$ ein. Punkt vor Strich: erst multiplizieren.`),
    solution: valueFrames(m, b, x, (v) => tx(`So $y = ${v}$. The point $${pt(x, v)}$ belongs to the table.`, `Also ist $y = ${v}$. Der Punkt $${pt(x, v)}$ gehört zur Tabelle.`)),
    mistakes: valueMistakes(m, b, x),
  };
}

function tableTask(rng: Rng): Exercise {
  for (;;) {
    const m = rng.nonZero(-4, 4, [1, -1]);
    const b = rng.chance(0.2) ? 0 : rng.nonZero(-6, 6);
    const start = rng.int(-3, 0);
    const xs = [0, 1, 2, 3, 4].map((i) => start + i);
    const gap = rng.int(0, 4);
    const x = xs[gap];
    if (x === 0 && b === 0) continue;
    if (Math.abs(m * x + b) > 20) continue;
    return tableExercise(m, b, xs, gap);
  }
}

// ---------------------------------------------------------------------------
// Proportional or not?

type TableKind = "prop" | "affine" | "inverse";
const I_PROP = tx("Proportional or not?", "Proportional oder nicht?");
const NOT_PROP: Text = tx("not proportional", "nicht proportional");

/** A ratio as a decimal when it ends quickly ("2,5"), else as a fraction. */
const ratio = (f: Frac, n: (v: number) => string) => ([1, 2, 4, 5, 10, 20, 25].includes(f.d) ? n(f.n / f.d) : `\\frac{${f.n}}{${f.d}}`);

function proportionalTask(rng: Rng): Exercise {
  for (;;) {
    const kind: TableKind = rng.pick(["prop", "prop", "prop", "affine", "affine", "inverse"] as const);
    let xs: number[];
    let ys: number[];
    if (kind === "inverse") {
      const k = rng.pick([12, 24, 36, 48, 60]);
      xs = rng
        .shuffle([1, 2, 3, 4, 6, 12])
        .slice(0, 4)
        .sort((a, b) => a - b);
      ys = xs.map((x) => k / x);
    } else {
      const m = rng.pick([2, 3, 4, 5, 0.5, 1.5, 2.5]);
      const step = m % 1 === 0 ? rng.pick([1, 2, 3]) : 2;
      const x0 = step * rng.int(1, 2);
      xs = [0, 1, 2, 3].map((i) => x0 + i * step);
      const b = kind === "affine" ? rng.nonZero(-3, 5) : 0;
      ys = xs.map((x) => m * x + b);
    }
    if (ys.some((y) => y <= 0 || !Number.isInteger(y * 2))) continue;
    const first = frac(Math.round(ys[0] * 2), xs[0] * 2);
    const flip = frac(xs[0] * 2, Math.round(ys[0] * 2));
    const opt = (f: Frac): Text => say(({ t, n }) => t(`proportional with $y = ${ratio(f, n)}x$`, `proportional mit $y = ${ratio(f, n)}x$`));
    const options = rng.shuffle([opt(first), opt(flip), NOT_PROP]);
    const en = (o: Text) => (typeof o === "string" ? o : o.en);
    const idxFirst = options.findIndex((o) => en(o) === en(opt(first)));
    const idxFlip = options.findIndex((o) => en(o) === en(opt(flip)));
    const idxNot = options.indexOf(NOT_PROP);
    const isProp = kind === "prop";
    const answer = { kind: "choice" as const, options, correct: isProp ? idxFirst : idxNot };
    const mk = mistakeList(answer);
    if (isProp) {
      mk.add(
        { ...answer, correct: idxFlip },
        tx("Upside down", "Auf dem Kopf"),
        tx("Right idea, but the factor is upside down: $m = y : x$, the $y$-value goes on top.", "Richtige Idee, aber der Faktor steht auf dem Kopf: $m = y : x$, der $y$-Wert kommt nach oben."),
      );
      mk.add(
        { ...answer, correct: idxNot },
        tx("It is proportional", "Sie ist proportional"),
        tx("Check again: divide each $y$ by its $x$. You get the same number every time!", "Prüf noch mal: Teile jedes $y$ durch sein $x$. Es kommt jedes Mal dieselbe Zahl heraus!"),
      );
    } else {
      mk.add(
        { ...answer, correct: idxFirst },
        tx("Only one pair checked", "Nur ein Paar geprüft"),
        kind === "inverse"
          ? tx(
              "Ah, you only looked at the first pair. Here $y$ gets **smaller** when $x$ gets bigger. For proportional, $y : x$ must be the same for **every** pair.",
              "Ah, du hast nur das erste Paar angeschaut. Hier wird $y$ **kleiner**, wenn $x$ größer wird. Für proportional muss $y : x$ bei **jedem** Paar gleich sein.",
            )
          : tx(
              "Ah, you only looked at the first pair. Divide the other pairs too: the quotients are different. Equal steps alone don't make it proportional.",
              "Ah, du hast nur das erste Paar angeschaut. Teile auch die anderen Paare: Die Quotienten sind verschieden. Gleiche Schritte allein machen es noch nicht proportional.",
            ),
      );
      mk.add(
        { ...answer, correct: idxFlip },
        tx("Only one pair, upside down", "Ein Paar, dazu auf dem Kopf"),
        tx("Two slips: only the first pair, and upside down. Divide $y$ by $x$ for **every** pair and compare.", "Zwei Ausrutscher: nur das erste Paar und dazu auf dem Kopf. Teile bei **jedem** Paar $y$ durch $x$ und vergleiche."),
      );
    }
    const quotient = (i: number, n: (v: number) => string) => `\\frac{${n(ys[i])}}{${n(xs[i])}} = ${ratio(frac(Math.round(ys[i] * 2), xs[i] * 2), n)}`;
    const solution: Frame[] = [
      {
        math: say(({ n }) => quotient(0, n)),
        note: tx("Proportional means: $y : x$ is the same for every pair. Start with the first pair.", "Proportional heißt: $y : x$ ist bei jedem Paar gleich. Fang mit dem ersten Paar an."),
      },
      {
        math: say(({ n }) => xs.map((_, i) => quotient(i, n)).join(" \\quad ")),
        note: isProp
          ? say(({ t, n }) => t(`Every quotient is $${ratio(first, n)}$. The table is proportional with $y = ${ratio(first, n)}x$.`, `Jeder Quotient ist $${ratio(first, n)}$. Die Tabelle ist proportional mit $y = ${ratio(first, n)}x$.`))
          : tx("The quotients are **not** all equal. So the table is **not** proportional.", "Die Quotienten sind **nicht** alle gleich. Die Tabelle ist also **nicht** proportional."),
      },
    ];
    if (!isProp) {
      solution.push({
        math: kind === "inverse" ? say(({ n }) => xs.map((x, i) => `${x} \\cdot ${n(ys[i])}`).join(" = ") + ` = ${n(xs[0] * ys[0])}`) : say(({ n }) => `x = 0 \\Rightarrow y = ${n(ys[0] - (ys[1] - ys[0]) / (xs[1] - xs[0]) * xs[0])} \\ne 0`),
        note:
          kind === "inverse"
            ? tx("Here $x \\cdot y$ is always the same: when $x$ doubles, $y$ halves. That's **inversely** proportional, the opposite.", "Hier ist $x \\cdot y$ immer gleich: Verdoppelt sich $x$, halbiert sich $y$. Das ist **antiproportional**, also das Gegenteil.")
            : tx("The $y$-values grow in equal steps, but at $x = 0$ the value isn't $0$: the line misses the origin. Proportional needs equal **quotients**.", "Die $y$-Werte wachsen in gleichen Schritten, aber bei $x = 0$ ist der Wert nicht $0$: Die Gerade verfehlt den Ursprung. Proportional braucht gleiche **Quotienten**."),
      });
    }
    return {
      instruction: I_PROP,
      text: tx("Is the relationship in the table proportional?", "Ist die Zuordnung in der Tabelle proportional?"),
      visual: view(ValueTable, { xs, ys }),
      answer,
      hint: tx("Divide each $y$ by its $x$. Proportional means: always the same quotient.", "Teile jedes $y$ durch sein $x$. Proportional heißt: immer derselbe Quotient."),
      solution,
      mistakes: mk.list,
    };
  }
}

// ---------------------------------------------------------------------------
// The factor m of a line through the origin

const I_FACTOR = tx("Find the factor m", "Bestimme den Faktor m");

function factorExercise(x: number, y: number, withGraph: boolean): Exercise {
  const m = frac(y, x);
  const M = m.n / m.d;
  const mk = mistakeList({ kind: "number", value: M });
  if (y !== 0 && Math.abs(x) !== Math.abs(y)) {
    mk.add(
      { kind: "number", value: x / y },
      tx("Upside down", "Auf dem Kopf"),
      tx(`Ah, you divided $x$ by $y$. It's the other way round: $m = y : x$, so $${y}$ goes on top.`, `Ah, du hast $x$ durch $y$ geteilt. Es ist andersrum: $m = y : x$, also kommt $${y}$ nach oben.`),
    );
  }
  mk.add(
    { kind: "number", value: y - x },
    tx("Subtracted", "Subtrahiert"),
    tx("Ooh, you subtracted. For a line through the origin the factor is a **quotient**: $m = y : x$.", "Ooh, du hast subtrahiert. Bei einer Ursprungsgeraden ist der Faktor ein **Quotient**: $m = y : x$."),
  );
  if (x !== 1) {
    mk.add(
      { kind: "number", value: y },
      tx("Not divided", "Nicht geteilt"),
      tx(`That's just the $y$-coordinate. $m$ is how much $y$ grows **per step** in $x$: divide by $x = ${x}$.`, `Das ist nur die $y$-Koordinate. $m$ sagt, wie viel $y$ **pro Schritt** in $x$ wächst: Teile durch $x = ${x}$.`),
    );
  }
  const fracSrc = (top: number, bottom: number) => (bottom < 0 ? `\\frac{${top}#mt}{(-#sb ${-bottom}#mb)}#mf` : `\\frac{${top < 0 ? `-#st ${-top}` : top}#mt}{${bottom}#mb}#mf`);
  const simple = m.d === 1 ? String(m.n) : `${m.n < 0 ? "-" : ""}\\frac{${Math.abs(m.n)}}{${m.d}}`;
  const decimal = [2, 4, 5].includes(m.d);
  return {
    instruction: I_FACTOR,
    text: tx(
      `A line through the origin passes through $${pt(x, y, "P")}$. Find the factor $m$ in $y = m \\cdot x$.`,
      `Eine Ursprungsgerade geht durch $${pt(x, y, "P")}$. Bestimme den Faktor $m$ in $y = m \\cdot x$.`,
    ),
    ...(withGraph
      ? {
          visual: graph({
            xRange: [-7, 7],
            yRange: [-7, 7],
            functions: [{ f: (t: number) => M * t, key: "g", color: "blob" }],
            points: [{ x, y, key: "P", label: "P", color: "ink" }],
          }),
        }
      : {}),
    answer: { kind: "number", value: M, label: "m =" },
    hint: tx("On a line through the origin, $y : x$ is the same for every point. Divide the $y$-coordinate by the $x$-coordinate.", "Auf einer Ursprungsgeraden ist $y : x$ für jeden Punkt gleich. Teile die $y$-Koordinate durch die $x$-Koordinate."),
    solution: [
      { math: "m#M =#E \\frac{y#mt}{x#mb}#mf", note: tx("For $y = m \\cdot x$ you get $m = \\frac{y}{x}$: divide $y$ by $x$.", "Aus $y = m \\cdot x$ folgt $m = \\frac{y}{x}$: Teile $y$ durch $x$.") },
      { math: `m#M =#E ${fracSrc(y, x)}`, note: tx(`Put in $P$: $x = ${x}$ and $y = ${y}$.`, `Setze $P$ ein: $x = ${x}$ und $y = ${y}$.`) },
      {
        math: say(({ n }) => `m#M =#E ${m.d === 1 ? `${m.n < 0 ? "-#st " : ""}${Math.abs(m.n)}#mt` : decimal ? `${simple} = ${n(M)}` : simple}`),
        note: say(({ t, n }) => t(`So $m = ${decimal ? n(M) : simple}$ and the line is $y = ${decimal ? n(M) : simple}x$.`, `Also ist $m = ${decimal ? n(M) : simple}$, und die Gerade heißt $y = ${decimal ? n(M) : simple}x$.`)),
      },
    ],
    mistakes: mk.list,
  };
}

function factorTask(rng: Rng): Exercise {
  for (;;) {
    const m = rng.pick([q(1, 2), q(-1, 2), q(3, 2), q(-3, 2), q(2), q(-2), q(3), q(-3), q(5, 2), q(4), q(-1)]);
    const x = m.d * rng.nonZero(-6, 6);
    const y = (m.n * x) / m.d;
    if (Math.abs(x) > 6 || Math.abs(y) > 6 || x === 0) continue;
    if (Math.abs(x) === 1 && rng.chance(0.7)) continue;
    return factorExercise(x, y, rng.chance(0.5));
  }
}

// ---------------------------------------------------------------------------
// Stories: proportional values from everyday life

type Story = {
  ms: number[];
  xUnit: Text;
  yUnit: Text;
  money?: boolean;
  xAxis: Text;
  yAxis: Text;
  intro: Text;
  given: (x: string, y: string) => Text;
  askY: (x: string) => Text;
  askX: (y: string) => Text;
};

const STORIES: Story[] = [
  {
    ms: [1.5, 2, 2.5, 3, 4],
    xUnit: "kg",
    yUnit: "€",
    money: true,
    xAxis: tx("weight in kg", "Gewicht in kg"),
    yAxis: tx("price in €", "Preis in €"),
    intro: tx("The graph shows the price of apples.", "Der Graph zeigt den Preis für Äpfel."),
    given: (x, y) => tx(`$${x}$ kg of apples cost $${y}$ €.`, `$${x}$ kg Äpfel kosten $${y}$ €.`),
    askY: (x) => tx(`How much do $${x}$ kg cost?`, `Wie viel kosten $${x}$ kg?`),
    askX: (y) => tx(`How many kg do you get for $${y}$ €?`, `Wie viele kg bekommst du für $${y}$ €?`),
  },
  {
    ms: [3, 4, 5],
    xUnit: "h",
    yUnit: "km",
    xAxis: tx("time in h", "Zeit in h"),
    yAxis: tx("distance in km", "Strecke in km"),
    intro: tx("Lea hikes at a steady pace. The graph shows how far she gets.", "Lea wandert gleichmäßig. Der Graph zeigt, wie weit sie kommt."),
    given: (x, y) => tx(`Lea hikes at a steady pace and covers $${y}$ km in $${x}$ hours.`, `Lea wandert gleichmäßig und schafft in $${x}$ Stunden $${y}$ km.`),
    askY: (x) => tx(`How far does she get in $${x}$ hours?`, `Wie weit kommt sie in $${x}$ Stunden?`),
    askX: (y) => tx(`How long does she need for $${y}$ km?`, `Wie lange braucht sie für $${y}$ km?`),
  },
  {
    ms: [6, 8, 10, 12],
    xUnit: "min",
    yUnit: "L",
    xAxis: tx("time in min", "Zeit in min"),
    yAxis: tx("water in L", "Wasser in L"),
    intro: tx("The graph shows how much water flows from a tap.", "Der Graph zeigt, wie viel Wasser aus einem Hahn fließt."),
    given: (x, y) => tx(`A tap lets $${y}$ litres flow in $${x}$ minutes.`, `Aus einem Wasserhahn fließen in $${x}$ Minuten $${y}$ Liter.`),
    askY: (x) => tx(`How many litres flow in $${x}$ minutes?`, `Wie viele Liter fließen in $${x}$ Minuten?`),
    askX: (y) => tx(`How long does it take for $${y}$ litres?`, `Wie lange dauert es für $${y}$ Liter?`),
  },
  {
    ms: [12, 15, 20, 25],
    xUnit: "min",
    yUnit: tx("pages", "Seiten"),
    xAxis: tx("time in min", "Zeit in min"),
    yAxis: tx("pages", "Seiten"),
    intro: tx("The graph shows how many pages a printer prints.", "Der Graph zeigt, wie viele Seiten ein Drucker druckt."),
    given: (x, y) => tx(`A printer prints $${y}$ pages in $${x}$ minutes.`, `Ein Drucker druckt in $${x}$ Minuten $${y}$ Seiten.`),
    askY: (x) => tx(`How many pages does it print in $${x}$ minutes?`, `Wie viele Seiten druckt er in $${x}$ Minuten?`),
    askX: (y) => tx(`How long does it need for $${y}$ pages?`, `Wie lange braucht er für $${y}$ Seiten?`),
  },
];

/** Text in both languages from a story template with numbers formatted per language. */
const both = (make: (l: "en" | "de") => Text): Text => tx(resolveText(make("en"), "en"), resolveText(make("de"), "de"));
const amount = (s: Story, v: number, l: "en" | "de") => (s.money ? money(v, l) : numIn(v, l));
const unitSrc = (u: Text, l: "en" | "de") => `"${typeof u === "string" ? u : u[l]}"`;

/** Rule-of-three frames: x₁ → y₁, 1 → m, x₂ → y₂ (or backwards to x₂). */
function threeFrames(s: Story, m: number, x1: number, x2: number, askY: boolean): Frame[] {
  const y1 = m * x1;
  const y2 = m * x2;
  const row = (a: string, b: string) => both((l) => `${a}#xa ${unitSrc(s.xUnit, l)}#ux \\to#ar ${b}#yb ${unitSrc(s.yUnit, l)}#uy`);
  const f = (v: number, l: "en" | "de") => amount(s, v, l);
  const frames: Frame[] = [
    { math: txRow(row, (l) => [String(x1), f(y1, l)]), note: tx("Write down what belongs together.", "Schreib auf, was zusammengehört.") },
    {
      math: txRow(row, (l) => ["1", f(m, l)]),
      note: tx(`Divide both by $${x1}$: that's the value for $1$ unit.`, `Teile beide durch $${x1}$: Das ist der Wert für $1$ Einheit.`),
    },
  ];
  if (askY) {
    frames.push({
      math: txRow(row, (l) => [String(x2), f(y2, l)]),
      note: both((l) => tx(`Multiply both by $${x2}$: the answer is $${f(y2, l)}$ ${unitWord(s.yUnit, l)}.`, `Multipliziere beide mit $${x2}$: Die Antwort ist $${f(y2, l)}$ ${unitWord(s.yUnit, l)}.`)),
    });
  } else {
    frames.push({
      math: txRow(row, (l) => ["?", f(y2, l)]),
      note: both((l) => tx(`Now backwards: how many units give $${f(y2, l)}$? Divide by the value per unit.`, `Jetzt rückwärts: Wie viele Einheiten ergeben $${f(y2, l)}$? Teile durch den Wert pro Einheit.`)),
    });
    frames.push({
      math: txRow(row, (l) => [String(x2), f(y2, l)]),
      note: both((l) => tx(`$${f(y2, l)} : ${f(m, l)} = ${x2}$. The answer is $${x2}$ ${unitWord(s.xUnit, l)}.`, `$${f(y2, l)} : ${f(m, l)} = ${x2}$. Die Antwort ist $${x2}$ ${unitWord(s.xUnit, l)}.`)),
    });
  }
  return frames;
}

const unitWord = (u: Text, l: "en" | "de") => (typeof u === "string" ? u : u[l]);
function txRow(row: (a: string, b: string) => Text, vals: (l: "en" | "de") => [string, string]): Text {
  return tx(resolveText(row(...vals("en")), "en"), resolveText(row(...vals("de")), "de"));
}

function threeMistakes(s: Story, m: number, x1: number, x2: number, askY: boolean): Mistake[] {
  const y1 = m * x1;
  const y2 = m * x2;
  const per = s.money ? tx("per kg", "pro kg") : tx("per unit", "pro Einheit");
  if (askY) {
    const mk = mistakeList({ kind: "number", value: y2, unit: s.yUnit });
    mk.add(
      { kind: "number", value: y1 + (x2 - x1), unit: s.yUnit },
      tx("Added instead of multiplied", "Addiert statt multipliziert"),
      tx(
        `Ah, you added the difference of $${x2 - x1 > 0 ? x2 - x1 : x1 - x2}$. Proportional works with **times**: twice as much $x$, twice as much $y$.`,
        `Ah, du hast den Unterschied von $${x2 - x1 > 0 ? x2 - x1 : x1 - x2}$ addiert. Proportional geht mit **mal**: doppelt so viel $x$, doppelt so viel $y$.`,
      ),
    );
    mk.add(
      { kind: "number", value: m, unit: s.yUnit },
      tx("Halfway there", "Halb fertig"),
      tx(`Halfway! That's the value ${EN(per)}. Now multiply by $${x2}$.`, `Halb fertig! Das ist der Wert ${DE(per)}. Jetzt noch mit $${x2}$ multiplizieren.`),
    );
    if (x1 !== 1) {
      mk.add(
        { kind: "number", value: y1 * x2, unit: s.yUnit },
        tx("Step to 1 missing", "Schritt auf 1 fehlt"),
        tx(`Careful: $${amount(s, y1, "en")}$ belongs to $${x1}$, not to $1$. First divide by $${x1}$, then multiply.`, `Vorsicht: $${amount(s, y1, "de")}$ gehört zu $${x1}$, nicht zu $1$. Teile zuerst durch $${x1}$, dann multiplizieren.`),
      );
    }
    return mk.list;
  }
  const mk = mistakeList({ kind: "number", value: x2, unit: s.xUnit });
  mk.add(
    { kind: "number", value: y2 * m, unit: s.xUnit },
    tx("Multiplied instead of divided", "Mal statt geteilt"),
    tx("Hmm, that's far too much. You know the value per unit, so **divide** by it to find how many units you need.", "Hm, das ist viel zu viel. Du kennst den Wert pro Einheit, also **teilst** du dadurch, um die Anzahl der Einheiten zu bekommen."),
  );
  if (x1 !== 1) {
    mk.add(
      { kind: "number", value: y2 / x1, unit: s.xUnit },
      tx("Divided by the wrong number", "Durch die falsche Zahl geteilt"),
      tx(`Close! Divide by the value **per unit** (first work out $${amount(s, y1, "en")} : ${x1}$), not by $${x1}$.`, `Knapp! Teile durch den Wert **pro Einheit** (rechne zuerst $${amount(s, y1, "de")} : ${x1}$), nicht durch $${x1}$.`),
    );
  }
  return mk.list;
}

const I_THREE = tx("Use the rule of three", "Rechne mit dem Dreisatz");

function threeTask(rng: Rng): Exercise {
  for (;;) {
    const s = rng.pick(STORIES);
    const m = rng.pick(s.ms);
    const x1 = rng.int(2, 6);
    const x2 = rng.int(2, 9);
    if (x1 === x2) continue;
    const askY = rng.chance(0.7);
    const y1 = m * x1;
    const y2 = m * x2;
    const given = both((l) => s.given(String(x1), amount(s, y1, l)));
    const ask = both((l) => (askY ? s.askY(String(x2)) : s.askX(amount(s, y2, l))));
    return {
      instruction: I_THREE,
      text: txMapJoin(given, ask),
      answer: { kind: "number", value: askY ? y2 : x2, unit: askY ? s.yUnit : s.xUnit },
      hint: tx("Proportional: first work out the value for $1$ unit, then multiply (rule of three).", "Proportional: Rechne zuerst auf $1$ Einheit herunter, dann multiplizieren (Dreisatz)."),
      solution: threeFrames(s, m, x1, x2, askY),
      mistakes: threeMistakes(s, m, x1, x2, askY),
    };
  }
}

const txMapJoin = (a: Text, b: Text): Text => tx(`${resolveText(a, "en")} ${resolveText(b, "en")}`, `${resolveText(a, "de")} ${resolveText(b, "de")}`);

// ---------------------------------------------------------------------------
// Reading values off a graph

const I_GRAPH = tx("Read off the graph", "Lies am Graphen ab");

function readGraphExercise(s: Story, m: number, x2: number, askY: boolean, xMax: number): Exercise {
  const y2 = m * x2;
  const visual = view(StoryGraph, { m, xMax, yMax: m * xMax, yStep: m, xLabel: s.xAxis, yLabel: s.yAxis });
  const ask = both((l) => (askY ? s.askY(String(x2)) : s.askX(amount(s, y2, l))));
  const answer: AnswerSpec = { kind: "number", value: askY ? y2 : x2, unit: askY ? s.yUnit : s.xUnit };
  const mk = mistakeList(answer);
  const neighbour = tx("One grid line off", "Eine Linie daneben");
  const neighbourSay = tx("Close! You're one grid line off. Go straight up (or across) to the line and read exactly where you meet it.", "Knapp! Du bist eine Gitterlinie daneben. Geh genau senkrecht (oder waagerecht) bis zur Geraden und lies genau dort ab.");
  if (askY) {
    if (Number.isInteger((x2 / m) * 2) && x2 <= m * xMax)
      mk.add(
        { kind: "number", value: x2 / m, unit: s.yUnit },
        tx("Wrong axis", "Falsche Achse"),
        tx(`Ah, you started on the wrong axis! $${x2}$ is a value on the **horizontal** axis: start there and go up to the line.`, `Ah, du hast an der falschen Achse angefangen! $${x2}$ ist ein Wert auf der **waagerechten** Achse: Starte dort und geh nach oben bis zur Geraden.`),
      );
    mk.add({ kind: "number", value: m * (x2 + 1), unit: s.yUnit }, neighbour, neighbourSay);
    mk.add({ kind: "number", value: m * (x2 - 1), unit: s.yUnit }, neighbour, neighbourSay);
  } else {
    if (y2 <= xMax)
      mk.add(
        { kind: "number", value: m * y2, unit: s.xUnit },
        tx("Wrong axis", "Falsche Achse"),
        tx("Ah, you started on the wrong axis! The given value is on the **vertical** axis: start there, go across to the line, then down.", "Ah, du hast an der falschen Achse angefangen! Der gegebene Wert liegt auf der **senkrechten** Achse: Starte dort, geh waagerecht bis zur Geraden und dann nach unten."),
      );
    mk.add({ kind: "number", value: x2 + 1, unit: s.xUnit }, neighbour, neighbourSay);
    mk.add({ kind: "number", value: x2 - 1, unit: s.xUnit }, neighbour, neighbourSay);
  }
  const row = (a: string, b: string, l: "en" | "de") => `${a}#xa ${unitSrc(s.xUnit, l)}#ux \\to#ar ${b}#yb ${unitSrc(s.yUnit, l)}#uy`;
  const solution: Frame[] = askY
    ? [
        { math: both((l) => tx(row(String(x2), "?", l), row(String(x2), "?", l))), note: both((l) => tx(`Find $${x2}$ on the horizontal axis (${unitWord(s.xUnit, l)}).`, `Such $${x2}$ auf der waagerechten Achse (${unitWord(s.xUnit, l)}).`)) },
        {
          math: both((l) => tx(row(String(x2), amount(s, y2, l), l), row(String(x2), amount(s, y2, l), l))),
          note: both((l) => tx(`Go straight up to the line, then straight across to the vertical axis: $${amount(s, y2, l)}$.`, `Geh senkrecht nach oben bis zur Geraden, dann waagerecht zur senkrechten Achse: $${amount(s, y2, l)}$.`)),
        },
        {
          math: both((l) => tx(`${amount(s, y2, l)} : ${x2} = ${amount(s, m, l)}`, `${amount(s, y2, l)} : ${x2} = ${amount(s, m, l)}`)),
          note: both((l) => tx(`Check: $1$ unit gives $${amount(s, m, l)}$, and $${x2} \\cdot ${amount(s, m, l)} = ${amount(s, y2, l)}$. Fits!`, `Probe: $1$ Einheit ergibt $${amount(s, m, l)}$, und $${x2} \\cdot ${amount(s, m, l)} = ${amount(s, y2, l)}$. Passt!`)),
        },
      ]
    : [
        { math: both((l) => tx(row("?", amount(s, y2, l), l), row("?", amount(s, y2, l), l))), note: both((l) => tx(`Find $${amount(s, y2, l)}$ on the vertical axis (${unitWord(s.yUnit, l)}).`, `Such $${amount(s, y2, l)}$ auf der senkrechten Achse (${unitWord(s.yUnit, l)}).`)) },
        {
          math: both((l) => tx(row(String(x2), amount(s, y2, l), l), row(String(x2), amount(s, y2, l), l))),
          note: tx(`Go straight across to the line, then straight down to the horizontal axis: $${x2}$.`, `Geh waagerecht bis zur Geraden, dann senkrecht nach unten zur waagerechten Achse: $${x2}$.`),
        },
      ];
  return {
    instruction: I_GRAPH,
    text: txMapJoin(s.intro, ask),
    visual,
    answer,
    hint: askY
      ? tx("Start on the horizontal axis, go straight up to the line, then straight across to the vertical axis.", "Starte auf der waagerechten Achse, geh senkrecht nach oben bis zur Geraden, dann waagerecht zur senkrechten Achse.")
      : tx("Start on the vertical axis, go straight across to the line, then straight down to the horizontal axis.", "Starte auf der senkrechten Achse, geh waagerecht bis zur Geraden, dann senkrecht nach unten zur waagerechten Achse."),
    solution,
    mistakes: mk.list,
  };
}

function readGraphTask(rng: Rng): Exercise {
  const s = rng.pick(STORIES);
  const m = rng.pick(s.ms);
  const xMax = s.money ? 6 : 8;
  const askY = rng.chance(0.6);
  const x2 = rng.int(2, xMax - 1);
  return readGraphExercise(s, m, x2, askY, xMax);
}

// ---------------------------------------------------------------------------
// Practice

export function generate1(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.17) return readPointTask(rng);
  if (r < 0.31) return quadrantTask(rng);
  if (r < 0.48) return tableTask(rng);
  if (r < 0.6) return proportionalTask(rng);
  if (r < 0.72) return factorTask(rng);
  if (r < 0.86) return threeTask(rng);
  return readGraphTask(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const coordFrames: Frame[] = [
  {
    math: ptK(3, 2, "P"),
    note: tx("Every point has two **coordinates**. $P(3 | 2)$ means: $x = 3$ and $y = 2$.", "Jeder Punkt hat zwei **Koordinaten**. $P(3 | 2)$ heißt: $x = 3$ und $y = 2$."),
  },
  {
    math: ptK(3, 2, "P"),
    highlight: ["x"],
    note: tx("The **x-coordinate** comes first: start at the origin and walk $3$ to the **right**, along the $x$-axis.", "Die **x-Koordinate** steht vorne: Starte im Ursprung und lauf $3$ nach **rechts**, an der $x$-Achse entlang."),
  },
  {
    math: ptK(3, 2, "P"),
    highlight: ["y"],
    note: tx("The **y-coordinate** comes second: then jump $2$ **up**. There's $P$.", "Die **y-Koordinate** steht hinten: Dann spring $2$ nach **oben**. Da ist $P$."),
  },
  {
    math: ptK(-2, -4, "Q"),
    highlight: ["sx", "sy"],
    note: tx("A minus means the other way: $Q(-2 | -4)$ is $2$ to the **left** and $4$ **down**.", "Ein Minus heißt: in die Gegenrichtung. $Q(-2 | -4)$ liegt $2$ nach **links** und $4$ nach **unten**."),
  },
  {
    math: ptK(0, 0, "O"),
    note: tx("The axes meet at the **origin** $O(0 | 0)$. Remember: **first walk, then jump**. $x$ before $y$, like in the alphabet.", "Die Achsen treffen sich im **Ursprung** $O(0 | 0)$. Merk dir: **Erst laufen, dann springen.** $x$ vor $y$, wie im Alphabet."),
  },
];

const quadrantLessonFrames: Frame[] = [
  { math: `${ptK(3, 2, "A")} \\quad (+#qx \\; |#qb \\; +#qy)#qs`, note: tx("**Quadrant I**, top right: $x$ and $y$ are both positive.", "**I. Quadrant**, oben rechts: $x$ und $y$ sind beide positiv.") },
  { math: `${ptK(-2, 3, "B")} \\quad (-#qx \\; |#qb \\; +#qy)#qs`, note: tx("**Quadrant II**, top left: $x$ negative, $y$ positive.", "**II. Quadrant**, oben links: $x$ negativ, $y$ positiv.") },
  { math: `${ptK(-3, -2, "C")} \\quad (-#qx \\; |#qb \\; -#qy)#qs`, note: tx("**Quadrant III**, bottom left: both negative.", "**III. Quadrant**, unten links: beide negativ.") },
  { math: `${ptK(2, -3, "D")} \\quad (+#qx \\; |#qb \\; -#qy)#qs`, note: tx("**Quadrant IV**, bottom right: $x$ positive, $y$ negative.", "**IV. Quadrant**, unten rechts: $x$ positiv, $y$ negativ.") },
  {
    math: `${ptK(4, 0, "E")} \\quad ${ptK(0, -3, "F").replace(/#(P|x|y|sx|sy|bar|br)\b/g, "#f$1")}`,
    note: tx("A coordinate is $0$? Then the point lies **on an axis** and belongs to no quadrant.", "Ist eine Koordinate $0$, liegt der Punkt **auf einer Achse** und gehört zu keinem Quadranten."),
  },
];

const tableLessonFrames: Frame[] = [
  ...valueFrames(2, -1, -1, (y) => tx(`So $y = ${y}$. The pair $x = -1$, $y = ${y}$ is the point $${pt(-1, y)}$.`, `Also ist $y = ${y}$. Das Wertepaar $x = -1$, $y = ${y}$ ist der Punkt $${pt(-1, y)}$.`)),
  { math: "y#Y =#EQ 2#cm \\cdot#dot 3#x -#sb 1#cb", note: tx("Same for $x = 3$: multiply first ...", "Genauso für $x = 3$: erst multiplizieren …") },
  { math: "y#Y =#EQ 5#cp", note: tx("... then subtract: $6 - 1 = 5$. The point $(3 | 5)$. Do this for every $x$ and the table is complete.", "… dann subtrahieren: $6 - 1 = 5$. Der Punkt $(3 | 5)$. So machst du es mit jedem $x$, und die Tabelle ist fertig.") },
];

const propFrames: Frame[] = [
  {
    math: '1#x1 "kg"#u1 \\to#a1 3#y1 "€"#e1 \\quad 2#x2 "kg"#u2 \\to#a2 6#y2 "€"#e2 \\quad 3#x3 "kg"#u3 \\to#a3 9#y3 "€"#e3',
    note: tx("Twice the weight, twice the price. Three times the weight, three times the price.", "Doppeltes Gewicht, doppelter Preis. Dreifaches Gewicht, dreifacher Preis."),
  },
  {
    math: "\\frac{3#y1}{1#x1}#f1 =#q1 \\frac{6#y2}{2#x2}#f2 =#q2 \\frac{9#y3}{3#x3}#f3 =#q3 3#m",
    note: tx("Divide each price by its weight: always $3$. The **quotient** $y : x$ is the same for every pair.", "Teile jeden Preis durch sein Gewicht: immer $3$. Der **Quotient** $y : x$ ist bei jedem Paar gleich (quotientengleich)."),
  },
  {
    math: "y#Y =#EQ 3#m \\cdot#dot x#X",
    note: tx("So $y = 3 \\cdot x$. The constant $3$ is the **proportionality factor** $m$: the price of $1$ kg.", "Also gilt $y = 3 \\cdot x$. Die Konstante $3$ ist der **Proportionalitätsfaktor** $m$: der Preis für $1$ kg."),
  },
  {
    math: "y#Y =#EQ m#m \\cdot#dot x#X",
    note: tx("Every proportional function looks like this. Its graph is a straight line through the origin, since $x = 0$ gives $y = 0$.", "Jede proportionale Funktion sieht so aus. Ihr Graph ist eine Gerade durch den Ursprung (Ursprungsgerade), denn $x = 0$ ergibt $y = 0$."),
  },
  {
    math: "x#X =#E1 1#one \\Rightarrow#imp y#Y =#EQ m#m",
    note: tx("Handy: at $x = 1$ the line is exactly at height $m$. The bigger $m$, the steeper the line.", "Praktisch: Bei $x = 1$ ist die Gerade genau auf Höhe $m$. Je größer $m$, desto steiler die Gerade."),
  },
];

const APPLES = STORIES[0];

export const level1: LevelLesson = {
  summary: [
    {
      title: tx("Points in the coordinate system", "Punkte im Koordinatensystem"),
      body: tx(
        "First the $x$-coordinate (right or left), then the $y$-coordinate (up or down). The axes meet at the origin $O(0 | 0)$.",
        "Zuerst die $x$-Koordinate (nach rechts oder links), dann die $y$-Koordinate (nach oben oder unten). Die Achsen treffen sich im Ursprung $O(0 | 0)$.",
      ),
      examples: [pt(3, 2, "P"), pt(-2, -4, "Q")],
      tone: "rule",
    },
    {
      title: tx("The four quadrants", "Die vier Quadranten"),
      body: tx(
        "Counterclockwise from top right: I $(+ | +)$, II $(- | +)$, III $(- | -)$, IV $(+ | -)$. Points on an axis lie in no quadrant.",
        "Gegen den Uhrzeigersinn, oben rechts beginnend: I $(+ | +)$, II $(- | +)$, III $(- | -)$, IV $(+ | -)$. Punkte auf einer Achse liegen in keinem Quadranten.",
      ),
      tone: "rule",
    },
    {
      title: tx("Table of values", "Wertetabelle"),
      body: tx("Put each $x$ into the rule and work out $y$ (multiply before you add). Each pair is a point of the graph.", "Setze jedes $x$ in die Vorschrift ein und berechne $y$ (Punkt vor Strich). Jedes Wertepaar ist ein Punkt des Graphen."),
      examples: ["y = 2x - 1", "x = -1: \; y = 2 \\cdot (-1) - 1 = -3"],
      tone: "rule",
    },
    {
      title: tx("Proportional functions", "Proportionale Funktionen"),
      body: tx(
        "$y = m \\cdot x$: the quotient $y : x$ is the same for every pair, the factor $m$. The graph is a straight line through the origin.",
        "$y = m \\cdot x$: Der Quotient $y : x$ ist bei jedem Paar gleich, der Faktor $m$. Der Graph ist eine Gerade durch den Ursprung.",
      ),
      examples: ["\\frac{3}{1} = \\frac{6}{2} = \\frac{9}{3} = 3", "y = 3x"],
      tone: "rule",
    },
    {
      title: tx("Finding m and missing values", "m und fehlende Werte bestimmen"),
      body: tx(
        "$m = y : x$ for any point of the line. Missing values: work out the value for $1$ unit, then multiply (rule of three).",
        "$m = y : x$ für jeden Punkt der Geraden. Fehlende Werte: erst auf $1$ Einheit herunterrechnen, dann multiplizieren (Dreisatz).",
      ),
      examples: [tx("P(4 \\, | \\, 6) \\Rightarrow m = 6 : 4 = 1.5", "P(4 \\, | \\, 6) \\Rightarrow m = 6 : 4 = 1,5")],
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "$(3 | 2)$ and $(2 | 3)$ are different points: $x$ always comes first. And equal steps aren't enough: $y = x + 2$ is **not** proportional, its line misses the origin.",
        "$(3 | 2)$ und $(2 | 3)$ sind verschiedene Punkte: $x$ steht immer vorne. Und gleiche Schritte reichen nicht: $y = x + 2$ ist **nicht** proportional, die Gerade verfehlt den Ursprung.",
      ),
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("The coordinate system", "Das Koordinatensystem"),
      blob: tx("Every point gets an address: two numbers, and you'll find it anywhere!", "Jeder Punkt bekommt eine Adresse: zwei Zahlen, und du findest ihn überall!"),
      body: tx(
        "Two number lines cross at a right angle: the horizontal **x-axis** and the vertical **y-axis**. They meet at the **origin**.",
        "Zwei Zahlengeraden kreuzen sich im rechten Winkel: die waagerechte **x-Achse** und die senkrechte **y-Achse**. Sie treffen sich im **Ursprung**.",
      ),
      visual: view(WalkPicture, { x: 3, y: 2, name: "P" }),
      frames: coordFrames,
    },
    {
      type: "widget",
      title: tx("Point hunt", "Punktejagd"),
      blob: tx("Grab P and take it for a walk. Then try the targets!", "Schnapp dir P und geh mit ihm spazieren. Dann probier die Zielpunkte!"),
      body: tx(
        "Drag $P$ across the grid and watch its coordinates change. In **Targets**, put $P$ exactly on the point that's asked for.",
        "Zieh $P$ über das Gitter und beobachte, wie sich seine Koordinaten ändern. Bei **Zielpunkte** setzt du $P$ genau auf den gesuchten Punkt.",
      ),
      widget: PointHunt,
    },
    {
      type: "check",
      blob: tx("Your turn! First walk, then jump.", "Du bist dran! Erst laufen, dann springen."),
      exercise: readPointExercise(-4, 3, "A"),
    },
    {
      type: "explain",
      title: tx("The four quadrants", "Die vier Quadranten"),
      blob: tx("Four rooms, four sign patterns. Easy to tell apart!", "Vier Zimmer, vier Vorzeichenmuster. Leicht auseinanderzuhalten!"),
      body: tx(
        "The axes cut the plane into four parts, the **quadrants**. They're numbered I to IV **counterclockwise**, starting top right.",
        "Die Achsen teilen die Ebene in vier Felder, die **Quadranten**. Sie werden **gegen den Uhrzeigersinn** von I bis IV nummeriert, oben rechts geht es los.",
      ),
      visual: view(QuadrantPicture, {}),
      frames: quadrantLessonFrames,
    },
    {
      type: "explain",
      title: tx("Tables of values", "Wertetabellen"),
      blob: tx("A rule is like a machine: x goes in, y comes out.", "Eine Vorschrift ist wie eine Maschine: x rein, y raus."),
      body: tx(
        "A rule like $y = 2x - 1$ gives a $y$ for every $x$. Put each $x$ in, work out $y$, and write both into a **table of values**. Each pair is a point.",
        "Eine Vorschrift wie $y = 2x - 1$ liefert zu jedem $x$ ein $y$. Setz jedes $x$ ein, rechne $y$ aus und trag beides in eine **Wertetabelle** ein. Jedes Wertepaar ist ein Punkt.",
      ),
      visual: view(ValueTable, { rule: "y = 2x - 1", xs: [-1, 0, 1, 2, 3], ys: [-3, -1, 1, 3, 5] }),
      frames: tableLessonFrames,
    },
    {
      type: "widget",
      title: tx("From the table to the graph", "Von der Tabelle zum Graphen"),
      blob: tx("Fill the table and watch the points appear. Notice something?", "Füll die Tabelle und schau, wie die Punkte auftauchen. Fällt dir was auf?"),
      body: tx(
        "Pick a rule and fill in the table one value at a time. Every pair $(x | y)$ becomes a point. What do the points do once all five are there?",
        "Wähl eine Vorschrift und füll die Tabelle Wert für Wert aus. Jedes Wertepaar $(x | y)$ wird zu einem Punkt. Was machen die Punkte, wenn alle fünf da sind?",
      ),
      widget: TableBuilder,
    },
    {
      type: "check",
      blob: tx("Mind the minus sign in the bracket!", "Achte auf das Minus in der Klammer!"),
      exercise: tableExercise(3, -2, [-2, -1, 0, 1, 2], 1),
    },
    {
      type: "explain",
      title: tx("Proportional functions", "Proportionale Funktionen"),
      blob: tx("Twice as much, twice the price. That's proportional!", "Doppelt so viel, doppelter Preis. Das ist proportional!"),
      body: tx(
        "$1$ kg of apples costs $3$ €. Twice the weight costs twice as much: that's a **proportional** relationship.",
        "$1$ kg Äpfel kostet $3$ €. Das doppelte Gewicht kostet doppelt so viel: Das ist eine **proportionale Zuordnung**.",
      ),
      frames: propFrames,
    },
    {
      type: "widget",
      title: tx("Lines through the origin", "Ursprungsgeraden"),
      blob: tx("Change m and walk P along the line. Watch the bottom row of the table!", "Ändere m und lass P an der Geraden entlangwandern. Achte auf die unterste Zeile der Tabelle!"),
      body: tx(
        "Choose the factor $m$ and drag $P$ along the line $y = m \\cdot x$. The table collects your points: $y : x$ always gives $m$.",
        "Wähl den Faktor $m$ und zieh $P$ an der Geraden $y = m \\cdot x$ entlang. Die Tabelle sammelt deine Punkte: $y : x$ ergibt immer $m$.",
      ),
      widget: ProportionalLab,
    },
    {
      type: "check",
      blob: tx("One point is all you need to find m.", "Ein Punkt reicht, um m zu finden."),
      exercise: factorExercise(4, 6, true),
    },
    {
      type: "check",
      blob: tx("Last one! Up to the line, then across.", "Die letzte! Hoch zur Geraden, dann rüber."),
      exercise: readGraphExercise(APPLES, 2.5, 4, true, 6),
    },
  ],
};
