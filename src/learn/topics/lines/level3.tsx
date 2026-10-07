"use client";

import { resolveText, tx, type Text } from "@/i18n/text";
import { add, div, mul, neg, sub, type Frac } from "@/learn/engine/frac";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { atanDeg, DEG, rounded, say } from "./kit";
import { divideText, graphVisual, joinT, lineFn, lineSrc, mistakeList, num, opDivide, opRemove, plain, pt, q, qv, side, term, val, valWrap, type Msg } from "./level2";
import { AngleLab, DistanceLab, IntersectionLab } from "./widgets3";

// Level 3 (Klasse 10 / Oberstufe): the intersection point of two lines, the slope angle
// tan α = m and the angle between two lines, distance and midpoint, and the distance from a
// point to a line via the perpendicular and its foot.

const ONE = q(1);
const isOne = (f: Frac) => f.n === 1 && f.d === 1;
const isUnit = (f: Frac) => f.d === 1 && Math.abs(f.n) === 1;
const absF = (f: Frac) => (f.n < 0 ? neg(f) : f);
/** "3x", "-x", "\frac{1}{2}x" for notes. */
const mx = (m: Frac) => plain(term(m, "x", "m", true));
const XY: [string, string] = ["x", "y"];
const pairOf = (x: Frac | number, y: Frac | number): AnswerSpec => ({ kind: "pair", names: XY, values: [typeof x === "number" ? x : qv(x), typeof y === "number" ? y : qv(y)] });
const eqLine = (m: Frac, b: Frac) => plain(lineSrc(m, b));
/** A Frac in a note: short decimals as decimals in each language, else a fraction. */
const fx = (f: Frac, n: (v: number, d?: number) => string) => ([1, 2, 4, 5, 10].includes(f.d) ? n(f.n / f.d) : num(f));
const ptF = (x: Frac, y: Frac, name: string, n: (v: number, d?: number) => string) => pt(fx(x, n), fx(y, n), name);
/** One decimal place, but 45 stays 45. */
const one = (v: number, n: (v: number, d?: number) => string) => (Math.abs(v - Math.round(v)) < 1e-9 ? n(Math.round(v)) : n(v, 1));
const deg = (v: number, n: (v: number, d?: number) => string) => `${one(v, n)} \\deg`;
/** "g:" in front of an equation (a label, not a division sign). */
const lab = (name: string) => `${name}\\text{:} \\;`;
const RAD_MODE: Msg = [
  tx("Calculator in RAD mode", "Taschenrechner im RAD-Modus"),
  tx(
    "Ooh, that's the angle in **radians**! Your calculator is in RAD mode. Switch it to **DEG** and work it out again.",
    "Ooh, das ist der Winkel im **Bogenmaß**! Dein Taschenrechner steht auf RAD. Stell ihn auf **DEG** um und rechne noch mal.",
  ),
];

// ---------------------------------------------------------------------------
// Intersection point

/** Equalise m_g·x + b_g = m_h·x + b_h step by step, then put x into g. */
function intersectFrames(mg: Frac, bg: Frac, mh: Frac, bh: Frac, lead?: Text): Frame[] {
  const dm = sub(mg, mh);
  const db = sub(bh, bg);
  const X = div(db, dm);
  const Y = add(mul(mg, X), bg);
  const eqs: { src: string; op: string; note: Text }[] = [];
  const first = lead ?? tx("At $S$ both lines have the same $y$: set the right-hand sides equal.", "Im Schnittpunkt $S$ haben beide Geraden dasselbe $y$: Setz die rechten Seiten gleich.");
  let src = `${side([
    [mg, "x", "a"],
    [bg, "", "b"],
  ])} =#EQ ${side([
    [mh, "x", "c"],
    [bh, "", "d"],
  ])}`;
  let pending: Text = first;
  if (mh.n !== 0) {
    eqs.push({
      src,
      op: opRemove(mh, "x"),
      note: joinT(pending, tx(`Bring the $x$-terms to the left: ${mh.n > 0 ? "subtract" : "add"} $${mx(absF(mh))}$.`, `Bring die $x$-Terme nach links: ${mh.n > 0 ? "Subtrahiere" : "Addiere"} $${mx(absF(mh))}$.`)),
    });
    pending = "";
    src = `${side([
      [dm, "x", "a"],
      [bg, "", "b"],
    ])} =#EQ ${val(bh, "d")}`;
  }
  if (bg.n !== 0) {
    eqs.push({
      src,
      op: opRemove(bg),
      note: joinT(pending, tx(`Now the numbers to the right: ${bg.n > 0 ? "subtract" : "add"} $${num(absF(bg))}$.`, `Jetzt die Zahlen nach rechts: ${bg.n > 0 ? "Subtrahiere" : "Addiere"} $${num(absF(bg))}$.`)),
    });
    pending = "";
    src = `${term(dm, "x", "a", true)} =#EQ ${val(db, "d")}`;
  }
  if (!isOne(dm)) {
    eqs.push({ src, op: opDivide(dm), note: joinT(pending, divideText(dm)) });
    pending = "";
  }
  const frames: Frame[] = eqs.map((e) => ({ math: `${e.src}${e.op}`, note: e.note }));
  frames.push({ math: `x#va =#EQ ${val(X, "d")}`, note: joinT(pending, say(({ t, n }) => t(`That's the $x$-coordinate of $S$: $x = ${fx(X, n)}$.`, `Das ist die $x$-Koordinate von $S$: $x = ${fx(X, n)}$.`))) });
  if (mg.n !== 0) {
    const times = isOne(mg) ? "" : mg.n === -1 && mg.d === 1 ? "-#sm " : `${val(mg, "m")} \\cdot#dot `;
    frames.push({
      math: `y#Y =#EQ ${times}${isUnit(mg) ? val(X, "vx") : valWrap(X, "vx")} ${term(bg, "", "b", false)}`.trim(),
      note: tx(`Put $x = ${num(X)}$ into $g$ to get $y$.`, `Setze $x = ${num(X)}$ in $g$ ein, um $y$ zu bekommen.`),
    });
  }
  frames.push({
    math: say(({ n }) => `S#S ${pt(fx(X, n), fx(Y, n))}`),
    note: say(({ t, n }) =>
      t(
        `So $y = ${fx(Y, n)}$ and the intersection point is $S${pt(fx(X, n), fx(Y, n))}$. Check with $h$: it gives the same $y$.`,
        `Also ist $y = ${fx(Y, n)}$, und der Schnittpunkt ist $S${pt(fx(X, n), fx(Y, n))}$. Probe mit $h$: Dort kommt dasselbe $y$ heraus.`,
      ),
    ),
  });
  return frames;
}

/** h written as A·x + B·y = C: bring it into the form y = m·x + b first. */
function rearrangeFrames(A: number, B: number, C: number, name = "h"): Frame[] {
  const mh = q(-A, B);
  const bh = q(C, B);
  const frames: Frame[] = [
    {
      math: `${side([
        [A, "x", "p"],
        [B, "y", "q"],
      ])} =#EQ ${val(C, "r")}${opRemove(A, "x")}`,
      note: tx(`First write $${name}$ in the form $y = mx + b$: get the $y$-term alone.`, `Bring $${name}$ zuerst in die Form $y = mx + b$: Stell den $y$-Term allein.`),
    },
  ];
  const ySide = `${term(B, "y", "q", true)} =#EQ ${side([
    [-A, "x", "p"],
    [C, "", "r"],
  ])}`;
  if (B !== 1) {
    frames.push({ math: `${ySide}${opDivide(B)}`, note: divideText(q(B), "then") });
    frames.push({ math: `y#vq =#EQ ${side([
      [mh, "x", "p"],
      [bh, "", "r"],
    ])}`, note: tx(`So $${name}$: $${eqLine(mh, bh)}$.`, `Also $${name}$: $${eqLine(mh, bh)}$.`) });
  } else {
    frames.push({ math: ySide, note: tx(`So $${name}$: $${eqLine(mh, bh)}$.`, `Also $${name}$: $${eqLine(mh, bh)}$.`) });
  }
  return frames;
}

/** "2x + y = 7" for the task text. */
const generalSrc = (A: number, B: number, C: number) =>
  plain(
    `${side([
      [A, "x", "p"],
      [B, "y", "q"],
    ])} = ${C}`,
  );

function intersectMistakes(mg: Frac, bg: Frac, mh: Frac, bh: Frac): Mistake[] {
  const X = div(sub(bh, bg), sub(mg, mh));
  const Y = add(mul(mg, X), bg);
  const mk = mistakeList(pairOf(X, Y));
  const at = (x: Frac) => pairOf(x, add(mul(mg, x), bg));
  if (bg.n !== 0) {
    mk.add(
      at(div(add(bh, bg), sub(mg, mh))),
      tx("Sign slip moving b", "Vorzeichenfehler beim Rüberbringen"),
      tx(
        `Nearly! When $${num(bg)}$ moves to the other side, it changes its sign. Check that step: it's $${num(bh)} ${bg.n > 0 ? "-" : "+"} ${num(absF(bg))}$ on the right.`,
        `Fast! Wenn $${num(bg)}$ auf die andere Seite wechselt, ändert sich das Vorzeichen. Prüf diesen Schritt: Rechts steht $${num(bh)} ${bg.n > 0 ? "-" : "+"} ${num(absF(bg))}$.`,
      ),
    );
  }
  const sum = add(mg, mh);
  if (sum.n !== 0 && mh.n !== 0) {
    mk.add(
      at(div(sub(bh, bg), sum)),
      tx("x-terms added", "x-Terme addiert"),
      tx(
        `Ah, I think you added the $x$-terms. To bring $${mx(mh)}$ to the left you subtract it: on the left you get $(${num(mg)} - ${num(mh, true)})x$.`,
        `Ah, ich glaub, du hast die $x$-Terme addiert. Um $${mx(mh)}$ nach links zu bringen, ziehst du es ab: Links steht dann $(${num(mg)} - ${num(mh, true)})x$.`,
      ),
    );
  }
  mk.add(
    pairOf(X, add(mul(mg, X), neg(bg))),
    tx("y: sign of b", "y: Vorzeichen von b"),
    tx(`$x$ is right! For $y$, put $x$ into $g$ again and keep the sign of $${num(bg)}$.`, `$x$ stimmt! Für $y$ setz $x$ noch mal in $g$ ein und behalte das Vorzeichen von $${num(bg)}$.`),
  );
  return mk.list;
}

const I_MEET = tx("Find the intersection point", "Berechne den Schnittpunkt");
const HINT_MEET = tx(
  "Set the right-hand sides equal, solve for $x$, then put $x$ into one of the equations to get $y$.",
  "Setz die rechten Seiten gleich, löse nach $x$ auf und setz $x$ dann in eine der Gleichungen ein, um $y$ zu bekommen.",
);

function intersectExercise(mg: Frac, bg: Frac, mh: Frac, bh: Frac, general?: [number, number, number]): Exercise {
  const X = div(sub(bh, bg), sub(mg, mh));
  const Y = add(mul(mg, X), bg);
  const hText = general ? generalSrc(...general) : eqLine(mh, bh);
  const show = Math.abs(qv(X)) <= 7 && Math.abs(qv(Y)) <= 7;
  return {
    instruction: I_MEET,
    text: tx(`Where do the lines $g$ and $h$ intersect?`, `Wo schneiden sich die Geraden $g$ und $h$?`),
    math: `${lab("g")} ${eqLine(mg, bg)} \\quad ${lab("h")} ${hText}`,
    ...(show && !general
      ? {
          visual: graphVisual({
            xRange: [-8, 8],
            yRange: [-8, 8],
            functions: [
              { f: lineFn(mg, bg), key: "g", color: "blob", label: "g" },
              { f: lineFn(mh, bh), key: "h", color: "ink", label: "h" },
            ],
          }),
        }
      : {}),
    answer: pairOf(X, Y),
    hint: general ? joinT(tx("First solve $h$ for $y$.", "Löse $h$ zuerst nach $y$ auf."), HINT_MEET) : HINT_MEET,
    solution: general ? [...rearrangeFrames(...general), ...intersectFrames(mg, bg, mh, bh, tx("Now set both right-hand sides equal.", "Jetzt beide rechten Seiten gleichsetzen."))] : intersectFrames(mg, bg, mh, bh),
    mistakes: intersectMistakes(mg, bg, mh, bh),
  };
}

const SLOPES: Frac[] = [q(1), q(-1), q(2), q(-2), q(3), q(-3), q(1, 2), q(-1, 2), q(3, 2), q(-3, 2), q(4), q(-4)];

function intersectTask(rng: Rng): Exercise {
  for (;;) {
    const mg = rng.pick(SLOPES);
    const mh = rng.pick(SLOPES);
    if (mg.n * mh.d === mh.n * mg.d) continue;
    const X = rng.int(-5, 5);
    const Y = rng.int(-6, 6);
    const bg = sub(q(Y), mul(mg, q(X)));
    const bh = sub(q(Y), mul(mh, q(X)));
    if (bg.d !== 1 || bh.d !== 1 || Math.abs(bg.n) > 10 || Math.abs(bh.n) > 10 || (bg.n === 0 && bh.n === 0)) continue;
    // Sometimes h comes as A·x + B·y = C.
    if (rng.chance(0.3)) {
      const B = mh.d === 2 ? 2 : rng.pick([1, 2]);
      const A = -(mh.n * B) / mh.d;
      const C = bh.n * B;
      if (A === 0 || Math.abs(C) > 20) continue;
      return intersectExercise(mg, bg, mh, bh, [A, B, C]);
    }
    return intersectExercise(mg, bg, mh, bh);
  }
}

// ---------------------------------------------------------------------------
// How do two lines lie? (Lagebeziehung)

type Position = 0 | 1 | 2 | 3; // perpendicular, intersect, parallel, identical
const POSITIONS: Text[] = [
  tx("They intersect at a right angle.", "Sie schneiden sich im rechten Winkel."),
  tx("They intersect, but not at a right angle.", "Sie schneiden sich, aber nicht im rechten Winkel."),
  tx("They are parallel, with no common point.", "Sie sind parallel und haben keinen gemeinsamen Punkt."),
  tx("They are identical.", "Sie sind identisch."),
];

function positionMsg(right: Position, wrong: Position, mg: Frac, mh: Frac, read: Frac | null): Msg {
  const prod = mul(mg, mh);
  if (read && (wrong === 2 || wrong === 3) && right < 2) {
    return [
      tx("Rearrange first", "Erst umformen"),
      tx(
        `Careful: in $h$ the number in front of $x$ isn't the slope yet. Solve $h$ for $y$ first: its slope is $${num(mh)}$, not the same as $g$'s.`,
        `Vorsicht: In $h$ ist die Zahl vor dem $x$ noch nicht die Steigung. Löse $h$ zuerst nach $y$ auf: Die Steigung ist $${num(mh)}$, nicht dieselbe wie bei $g$.`,
      ),
    ];
  }
  if (right === 0 && wrong === 1)
    return [
      tx("Check the product", "Prüf das Produkt"),
      tx(`Multiply the slopes: $${num(mg)} \\cdot ${num(mh, true)} = -1$. What does that tell you about the angle?`, `Multiplizier die Steigungen: $${num(mg)} \\cdot ${num(mh, true)} = -1$. Was sagt dir das über den Winkel?`),
    ];
  if (right === 1 && wrong === 0)
    return [
      tx("Not perpendicular", "Nicht orthogonal"),
      tx(`For a right angle, $m_g \\cdot m_h$ must be $-1$. Here it's $${num(prod)}$.`, `Für einen rechten Winkel muss $m_g \\cdot m_h = -1$ sein. Hier ist es $${num(prod)}$.`),
    ];
  if (right === 3 && wrong === 2)
    return [
      tx("Check b too", "Prüf auch b"),
      tx("Same slope, right! But compare the $y$-intercepts too: after rearranging, $h$ has the same $b$ as $g$.", "Gleiche Steigung, richtig! Aber vergleich auch die y-Achsenabschnitte: Nach dem Umformen hat $h$ dasselbe $b$ wie $g$."),
    ];
  if (right === 2 && wrong === 3)
    return [
      tx("Different b", "Verschiedenes b"),
      tx("Same slope, yes. But the $y$-intercepts differ, so the lines run side by side and never meet.", "Gleiche Steigung, ja. Aber die y-Achsenabschnitte sind verschieden, die Geraden laufen also nebeneinander her und treffen sich nie."),
    ];
  if (right >= 2)
    return [
      tx("Same slope", "Gleiche Steigung"),
      tx(`Bring $h$ into the form $y = mx + b$: its slope is $${num(mh)}$, exactly the slope of $g$. Lines with the same slope never cross in exactly one point.`, `Bring $h$ in die Form $y = mx + b$: Die Steigung ist $${num(mh)}$, genau die Steigung von $g$. Geraden mit gleicher Steigung schneiden sich nicht in einem Punkt.`),
    ];
  return [
    tx("Different slopes", "Verschiedene Steigungen"),
    tx(`The slopes are $${num(mg)}$ and $${num(mh)}$: different, so the lines must cross somewhere.`, `Die Steigungen sind $${num(mg)}$ und $${num(mh)}$: verschieden, also schneiden sich die Geraden irgendwo.`),
  ];
}

function positionTask(rng: Rng): Exercise {
  for (;;) {
    const right = rng.pick([0, 1, 1, 2, 3] as const) as Position;
    const mg = rng.pick(SLOPES);
    const bg = q(rng.int(-5, 5));
    let mh: Frac;
    let bh: Frac;
    if (right === 0) mh = neg(div(ONE, mg));
    else if (right === 1) mh = rng.pick(SLOPES);
    else mh = mg;
    if (right === 1 && (eqF(mh, mg) || eqF(mul(mh, mg), q(-1)))) continue;
    if (right === 3) bh = bg;
    else if (right === 2) bh = q(rng.nonZero(-5, 5, [bg.n]));
    else bh = q(rng.int(-5, 5));
    if (right !== 3 && right !== 2 && eqF(bh, bg) && rng.chance(0.5)) continue;
    // h as A·x + B·y = C, with a common factor so it doesn't look like g at once.
    const B = mh.d === 2 ? rng.pick([2, 4]) : mh.d === 3 ? 3 : mh.d === 4 ? 4 : rng.pick([2, 3, -1, -2]);
    const A = -(mh.n * B) / mh.d;
    const C = (bh.n * B) / bh.d;
    if (!Number.isInteger(A) || !Number.isInteger(C) || A === 0 || Math.abs(C) > 24) continue;
    const read = q(A); // the tempting "slope" if h isn't rearranged
    const answer = { kind: "choice" as const, options: POSITIONS, correct: right };
    const mk = mistakeList(answer);
    for (const w of [0, 1, 2, 3] as Position[]) if (w !== right) mk.add({ ...answer, correct: w }, ...positionMsg(right, w, mg, mh, read));
    const verdict: Frame =
      right === 0
        ? { math: `m_g \\cdot m_h = ${num(mg)} \\cdot ${num(mh, true)} = -1`, note: tx("The slopes multiply to $-1$: the lines are **perpendicular**.", "Das Produkt der Steigungen ist $-1$: Die Geraden sind **orthogonal**.") }
        : right === 1
          ? { math: `m_g = ${num(mg)} \\ne ${num(mh)} = m_h`, note: tx(`Different slopes, so they intersect. And $${num(mg)} \\cdot ${num(mh, true)} = ${num(mul(mg, mh))} \\ne -1$: not at a right angle.`, `Verschiedene Steigungen, also schneiden sie sich. Und $${num(mg)} \\cdot ${num(mh, true)} = ${num(mul(mg, mh))} \\ne -1$: nicht im rechten Winkel.`) }
          : right === 2
            ? { math: `m_g = m_h = ${num(mg)} \\quad b_g = ${num(bg)} \\ne ${num(bh)} = b_h`, note: tx("Same slope, different $b$: **parallel**, no common point.", "Gleiche Steigung, verschiedenes $b$: **parallel**, kein gemeinsamer Punkt.") }
            : { math: `m_g = m_h = ${num(mg)} \\quad b_g = b_h = ${num(bg)}`, note: tx("Same slope and same $b$: it's the same line twice, **identical**.", "Gleiche Steigung und gleiches $b$: Das ist zweimal dieselbe Gerade, **identisch**.") };
    return {
      instruction: tx("How do the lines lie?", "Wie liegen die Geraden zueinander?"),
      text: tx("How do the lines $g$ and $h$ lie relative to each other?", "Wie liegen die Geraden $g$ und $h$ zueinander?"),
      math: `${lab("g")} ${eqLine(mg, bg)} \\quad ${lab("h")} ${generalSrc(A, B, C)}`,
      answer,
      hint: tx(
        "Solve $h$ for $y$. Then compare: same slope? Same $b$? Do the slopes multiply to $-1$?",
        "Löse $h$ nach $y$ auf. Dann vergleiche: gleiche Steigung? Gleiches $b$? Ist das Produkt der Steigungen $-1$?",
      ),
      solution: [...rearrangeFrames(A, B, C), verdict],
      mistakes: mk.list,
    };
  }
}

const eqF = (a: Frac, b: Frac) => a.n === b.n && a.d === b.d;

// ---------------------------------------------------------------------------
// Slope angle

const I_ANGLE = tx("Find the slope angle", "Berechne den Steigungswinkel");
const I_XANGLE = tx("Angle with the x-axis", "Winkel mit der x-Achse");

function angleFrames(m: number, acute: boolean): Frame[] {
  const a = atanDeg(m);
  const frames: Frame[] = [
    {
      math: say(({ n }) => `\\tan#t \\alpha#al =#E m#m =#E2 ${n(m)}#mv`),
      note: tx("In the slope triangle (run $1$, rise $m$): $\\tan \\alpha = \\frac{m}{1} = m$.", "Im Steigungsdreieck ($1$ nach rechts, $m$ nach oben) gilt: $\\tan \\alpha = \\frac{m}{1} = m$."),
    },
    {
      math: say(({ n }) => `\\alpha#al =#E \\tan^{-1}(${n(m)}#mv)`),
      note: tx("Undo the tangent with $\\tan^{-1}$ on the calculator (often SHIFT + tan), in **DEG** mode.", "Die Umkehrung ist $\\tan^{-1}$ auf dem Taschenrechner (meist SHIFT + tan), im **DEG**-Modus."),
    },
    {
      math: say(({ n }) => `\\alpha#al ${Math.abs(a - Math.round(a)) < 1e-9 ? "=" : "\\approx"}#E ${one(a, n)}#res \\deg#dg`),
      note:
        m > 0
          ? say(({ t, n }) => {
              const rel = Math.abs(a - Math.round(a)) < 1e-9 ? "=" : "\\approx";
              return t(`So the line rises at $\\alpha ${rel} ${deg(a, n)}$.`, `Die Gerade steigt also unter $\\alpha ${rel} ${deg(a, n)}$.`);
            })
          : say(({ t, n }) => t(`A negative angle: the line **falls**. It crosses the $x$-axis at $${deg(-a, n)}$.`, `Ein negativer Winkel: Die Gerade **fällt**. Sie schneidet die $x$-Achse unter $${deg(-a, n)}$.`)),
    },
  ];
  if (acute && m < 0) frames.push({ math: say(({ n }) => `\\alpha#al ${Math.abs(a - Math.round(a)) < 1e-9 ? "=" : "\\approx"}#E ${one(-a, n)}#res \\deg#dg`), note: say(({ t, n }) => t(`The angle with the $x$-axis is $${deg(-a, n)}$.`, `Der Winkel mit der $x$-Achse beträgt $${deg(-a, n)}$.`)) });
  return frames;
}

function angleMistakes(m: number, acute: boolean): Mistake[] {
  const a = atanDeg(m);
  const target = acute ? Math.abs(a) : a;
  const ans = rounded(target, 1, { unit: "°" });
  const mk = mistakeList(ans);
  mk.add(rounded(Math.atan(Math.abs(m)) * (acute ? 1 : Math.sign(m)), 2), ...RAD_MODE);
  if (Math.abs(m) !== 1)
    mk.add(rounded(90 - Math.abs(a), 1, { unit: "°" }), tx("Run over rise", "Rechts durch hoch"), tx("Ah, you took $\\tan^{-1}(\\frac{\\Delta x}{\\Delta y})$, that's the angle with the **y**-axis. $\\tan \\alpha = m = \\frac{\\Delta y}{\\Delta x}$.", "Ah, du hast $\\tan^{-1}(\\frac{\\Delta x}{\\Delta y})$ gerechnet, das ist der Winkel zur **y**-Achse. $\\tan \\alpha = m = \\frac{\\Delta y}{\\Delta x}$."));
  mk.add(
    rounded(Math.tan((Math.abs(m) * Math.PI) / 180), 2),
    tx("tan instead of tan⁻¹", "tan statt tan⁻¹"),
    tx("Hmm, that looks like $\\tan(m)$. You need the **inverse**: $\\alpha = \\tan^{-1}(m)$ (SHIFT + tan).", "Hm, das sieht nach $\\tan(m)$ aus. Du brauchst die **Umkehrung**: $\\alpha = \\tan^{-1}(m)$ (SHIFT + tan)."),
  );
  if (acute && m < 0) {
    mk.add(
      rounded(a, 1, { unit: "°" }),
      tx("Negative angle", "Negativer Winkel"),
      tx("The calculator's minus just says the line falls. The angle with the $x$-axis is the size of that angle, without the minus.", "Das Minus vom Taschenrechner sagt nur, dass die Gerade fällt. Der Winkel mit der $x$-Achse ist die Größe dieses Winkels, ohne Minus."),
    );
    mk.add(
      rounded(180 + a, 1, { unit: "°" }),
      tx("The obtuse angle", "Der stumpfe Winkel"),
      tx("That's the angle measured from the positive $x$-axis all the way round. The angle with the $x$-axis is the **acute** one.", "Das ist der Winkel, gemessen von der positiven $x$-Achse ganz herum. Der Winkel mit der $x$-Achse ist der **spitze**."),
    );
  }
  return mk.list;
}

const ANGLE_SLOPES = [0.5, 1, 1.5, 2, 3, 0.25, 0.75, 2.5, 4, 1.25];

function slopeAngleTask(rng: Rng): Exercise {
  const variant = rng.pick(["eq", "eq", "points", "falls"] as const);
  const m0 = rng.pick(ANGLE_SLOPES);
  const m = variant === "falls" || (variant === "points" && rng.chance(0.4)) ? -m0 : m0;
  const acute = m < 0;
  const b = rng.int(-4, 4);
  const answer = rounded(acute ? Math.abs(atanDeg(m)) : atanDeg(m), 1, { unit: "°" });
  const lineText = say(({ n }) => `y = ${n(m) === "1" ? "" : n(m) === "-1" ? "-" : n(m)}x${b ? (b > 0 ? ` + ${b}` : ` - ${-b}`) : ""}`);
  if (variant === "points") {
    const run = Math.abs(m) % 1 === 0 ? rng.pick([1, 2, 3]) : Math.abs(m) * 2 % 1 === 0 ? 2 : 4;
    const ax = rng.int(-4, 2);
    const ay = rng.int(-4, 4);
    const A: [number, number] = [ax, ay];
    const B: [number, number] = [ax + run, ay + m * run];
    const dyS = B[1] - A[1];
    return {
      instruction: acute ? I_XANGLE : I_ANGLE,
      text: acute
        ? tx(`The line runs through $${pt(A[0], A[1], "A")}$ and $${pt(B[0], B[1], "B")}$. At what angle does it cross the $x$-axis? Round to one decimal place.`, `Die Gerade geht durch $${pt(A[0], A[1], "A")}$ und $${pt(B[0], B[1], "B")}$. Unter welchem Winkel schneidet sie die $x$-Achse? Runde auf eine Nachkommastelle.`)
        : tx(`The line runs through $${pt(A[0], A[1], "A")}$ and $${pt(B[0], B[1], "B")}$. Find its slope angle $\\alpha$, rounded to one decimal place.`, `Die Gerade geht durch $${pt(A[0], A[1], "A")}$ und $${pt(B[0], B[1], "B")}$. Berechne ihren Steigungswinkel $\\alpha$, gerundet auf eine Nachkommastelle.`),
      answer,
      hint: tx("First the slope $m = \\frac{y_2 - y_1}{x_2 - x_1}$, then $\\alpha = \\tan^{-1}(m)$ in DEG mode.", "Zuerst die Steigung $m = \\frac{y_2 - y_1}{x_2 - x_1}$, dann $\\alpha = \\tan^{-1}(m)$ im DEG-Modus."),
      solution: [
        {
          math: say(({ n }) => `m#m =#E \\frac{${B[1]} - ${A[1] < 0 ? `(${A[1]})` : A[1]}}{${B[0]} - ${A[0] < 0 ? `(${A[0]})` : A[0]}} = \\frac{${dyS}}{${run}} = ${n(m)}#mv`),
          note: tx("First the slope from the two points.", "Zuerst die Steigung aus den beiden Punkten."),
        },
        ...angleFrames(m, acute),
      ],
      mistakes: angleMistakes(m, acute),
    };
  }
  return {
    instruction: acute ? I_XANGLE : I_ANGLE,
    text: acute
      ? tx("At what angle does the line cross the $x$-axis? Round to one decimal place.", "Unter welchem Winkel schneidet die Gerade die $x$-Achse? Runde auf eine Nachkommastelle.")
      : tx("Find the slope angle $\\alpha$ of the line, rounded to one decimal place.", "Berechne den Steigungswinkel $\\alpha$ der Geraden, gerundet auf eine Nachkommastelle."),
    math: lineText,
    answer,
    hint: tx("$\\tan \\alpha = m$, so $\\alpha = \\tan^{-1}(m)$. Calculator in DEG mode.", "$\\tan \\alpha = m$, also $\\alpha = \\tan^{-1}(m)$. Taschenrechner im DEG-Modus."),
    solution: angleFrames(m, acute),
    mistakes: angleMistakes(m, acute),
  };
}

/** The other way round: from the angle to the slope. */
function slopeFromAngleTask(rng: Rng): Exercise {
  const a = rng.pick([15, 20, 25, 30, 35, 40, 50, 55, 60, 65, 70, 75]);
  const m = Math.tan(a / DEG);
  const b = rng.int(-4, 4);
  const answer = rounded(m, 2, { label: "m =" });
  const mk = mistakeList(answer);
  mk.add(rounded(Math.tan(a), 2), ...RAD_MODE);
  mk.add(
    rounded(Math.atan(a) * DEG, 2),
    tx("tan⁻¹ instead of tan", "tan⁻¹ statt tan"),
    tx("Hmm, you used $\\tan^{-1}$. Here the angle is given and you want $m$: $m = \\tan \\alpha$, the plain tangent.", "Hm, du hast $\\tan^{-1}$ genommen. Hier ist der Winkel gegeben, und du suchst $m$: $m = \\tan \\alpha$, der normale Tangens."),
  );
  mk.add(
    rounded(1 / m, 2),
    tx("Upside down", "Auf dem Kopf"),
    tx("Close, but upside down: $\\tan \\alpha = \\frac{\\Delta y}{\\Delta x} = m$, not $\\frac{\\Delta x}{\\Delta y}$.", "Knapp, aber auf dem Kopf: $\\tan \\alpha = \\frac{\\Delta y}{\\Delta x} = m$, nicht $\\frac{\\Delta x}{\\Delta y}$."),
  );
  mk.add(
    rounded(Math.sin(a / DEG), 2),
    tx("sin instead of tan", "sin statt tan"),
    tx("That's the sine. The slope is rise over run, opposite over adjacent: the **tangent**.", "Das ist der Sinus. Die Steigung ist hoch durch rechts, Gegenkathete durch Ankathete: der **Tangens**."),
  );
  return {
    instruction: tx("Slope from the angle", "Steigung aus dem Winkel"),
    text: say(({ t }) =>
      t(
        `A line rises at an angle of $${a} \\deg$ to the $x$-axis and crosses the $y$-axis at $${pt(0, b)}$. Find its slope $m$, rounded to two decimal places.`,
        `Eine Gerade steigt unter einem Winkel von $${a} \\deg$ gegen die $x$-Achse und schneidet die $y$-Achse in $${pt(0, b)}$. Berechne ihre Steigung $m$, gerundet auf zwei Nachkommastellen.`,
      ),
    ),
    answer,
    hint: tx("$m = \\tan \\alpha$. Calculator in DEG mode. The $y$-intercept doesn't change the angle.", "$m = \\tan \\alpha$. Taschenrechner im DEG-Modus. Der y-Achsenabschnitt ändert den Winkel nicht."),
    solution: [
      { math: `m#m =#E \\tan#t \\alpha#al`, note: tx("The slope is the tangent of the slope angle. Where the line crosses the $y$-axis doesn't matter.", "Die Steigung ist der Tangens des Steigungswinkels. Wo die Gerade die $y$-Achse schneidet, spielt keine Rolle.") },
      { math: `m#m =#E \\tan#t (${a}#a \\deg#dg)#br`, note: tx(`Put in $\\alpha = ${a} \\deg$ (calculator in DEG mode).`, `Setze $\\alpha = ${a} \\deg$ ein (Taschenrechner im DEG-Modus).`) },
      { math: say(({ n }) => `m#m \\approx#E ${n(m, 2)}#v`), note: say(({ t, n }) => t(`So $m \\approx ${n(m, 2)}$ and the line is $y \\approx ${n(m, 2)}x ${b < 0 ? "-" : "+"} ${Math.abs(b)}$.`, `Also ist $m \\approx ${n(m, 2)}$, und die Gerade heißt $y \\approx ${n(m, 2)}x ${b < 0 ? "-" : "+"} ${Math.abs(b)}$.`)) },
    ],
    mistakes: mk.list,
  };
}

// ---------------------------------------------------------------------------
// Angle between two lines

function lineAngleFrames(m1: number, m2: number): Frame[] {
  const a1 = atanDeg(m1);
  const a2 = atanDeg(m2);
  const d = Math.abs(a1 - a2);
  const r = (v: number) => Math.round(v * 10) / 10;
  const frames: Frame[] = [
    {
      math: say(({ n }) => `\\alpha_g#ag =#E1 \\tan^{-1}(${n(m1)}) \\approx#A1 ${one(a1, n)}#v1 \\deg#d1`),
      note: tx("First the slope angle of each line: $\\alpha = \\tan^{-1}(m)$.", "Zuerst der Steigungswinkel jeder Geraden: $\\alpha = \\tan^{-1}(m)$."),
    },
    {
      math: say(({ n }) => `\\alpha_g#ag \\approx#A1 ${one(a1, n)}#v1 \\deg#d1 \\quad \\alpha_h#ah \\approx#A2 ${one(a2, n)}#v2 \\deg#d2`),
      note: say(({ t, n }) => t(`And for $h$: $\\tan^{-1}(${n(m2)}) \\approx ${deg(a2, n)}$.`, `Und für $h$: $\\tan^{-1}(${n(m2)}) \\approx ${deg(a2, n)}$.`)),
    },
    {
      math: say(({ n }) => `|${one(a1, n)}#v1 \\deg#d1 - ${a2 < 0 ? `(${one(a2, n)}#v2 \\deg#d2)` : `${one(a2, n)}#v2 \\deg#d2`}| =#E ${n(r(a1) - r(a2) < 0 ? -(r(a1) - r(a2)) : r(a1) - r(a2), 1)}#dv \\deg#dd`),
      note: tx("The angle between the lines is the difference of the slope angles.", "Der Winkel zwischen den Geraden ist die Differenz der Steigungswinkel."),
    },
  ];
  if (d > 90) {
    frames.push({
      math: say(({ n }) => `\\varphi#dl =#E 180 \\deg - ${n(Math.abs(r(a1) - r(a2)), 1)}#dv \\deg#dd =#E2 ${n(180 - Math.abs(r(a1) - r(a2)), 1)}#res \\deg`),
      note: tx("That's more than $90 \\deg$. The angle of intersection is the **acute** one: $180 \\deg$ minus it.", "Das ist mehr als $90 \\deg$. Der Schnittwinkel ist der **spitze** Winkel: $180 \\deg$ minus die Differenz."),
    });
  } else {
    frames.push({
      math: say(({ n }) => `\\varphi#dl \\approx#E ${n(Math.abs(r(a1) - r(a2)), 1)}#dv \\deg#dd`),
      note: tx("It's at most $90 \\deg$, so this is the angle of intersection $\\varphi$.", "Sie ist höchstens $90 \\deg$, also ist das der Schnittwinkel $\\varphi$."),
    });
  }
  return frames;
}

function lineAngleExercise(m1: number, b1: number, m2: number, b2: number): Exercise {
  const a1 = atanDeg(m1);
  const a2 = atanDeg(m2);
  const r = (v: number) => Math.round(v * 10) / 10;
  const diff = Math.abs(r(a1) - r(a2));
  const delta = diff > 90 ? 180 - diff : diff;
  const answer = rounded(delta, 1, { unit: "°" });
  answer.tolerance = 0.11 / Math.max(1, delta);
  const mk = mistakeList(answer);
  if (diff > 90) mk.add({ ...rounded(diff, 1, { unit: "°" }), tolerance: 0.11 / diff }, tx("Not the acute angle", "Nicht der spitze Winkel"), tx(`That's the obtuse angle, more than $90 \\deg$. The angle of intersection is the acute one: $180 \\deg$ minus your result.`, `Das ist der stumpfe Winkel, über $90 \\deg$. Der Schnittwinkel ist der spitze: $180 \\deg$ minus dein Ergebnis.`));
  const plus = Math.abs(r(a1) + r(a2));
  const plusA = plus > 90 ? 180 - plus : plus;
  if (Math.abs(plusA - delta) > 0.5)
    mk.add({ ...rounded(plusA, 1, { unit: "°" }), tolerance: 0.11 / Math.max(1, plusA) }, tx("Angles added", "Winkel addiert"), tx("Careful with the signs: the angle between the lines is the **difference** $|\\alpha_g - \\alpha_h|$, and a negative angle stays negative in it.", "Vorsicht mit den Vorzeichen: Der Winkel zwischen den Geraden ist die **Differenz** $|\\alpha_g - \\alpha_h|$, und ein negativer Winkel bleibt darin negativ."));
  const short = atanDeg(Math.abs(m1 - m2));
  if (Math.abs(short - delta) > 0.5)
    mk.add({ ...rounded(short, 1, { unit: "°" }), tolerance: 0.11 / Math.max(1, short) }, tx("Slopes subtracted", "Steigungen subtrahiert"), tx("Ah, you took $\\tan^{-1}$ of the difference of the slopes. That doesn't work: find **each** slope angle first, then subtract the angles.", "Ah, du hast $\\tan^{-1}$ von der Differenz der Steigungen genommen. Das klappt nicht: Bestimm erst **jeden** Steigungswinkel, dann ziehst du die Winkel voneinander ab."));
  mk.add(rounded(Math.abs(Math.atan(m1) - Math.atan(m2)) > Math.PI / 2 ? Math.PI - Math.abs(Math.atan(m1) - Math.atan(m2)) : Math.abs(Math.atan(m1) - Math.atan(m2)), 2), ...RAD_MODE);
  const line = (m: number, b: number) => say(({ n }) => (m === 0 ? `y = ${b}` : `y = ${m === 1 ? "" : m === -1 ? "-" : n(m)}x${b ? (b > 0 ? ` + ${b}` : ` - ${-b}`) : ""}`));
  return {
    instruction: tx("Angle between two lines", "Schnittwinkel zweier Geraden"),
    text: tx("At what angle do the lines $g$ and $h$ intersect? Round to one decimal place.", "Unter welchem Winkel schneiden sich die Geraden $g$ und $h$? Runde auf eine Nachkommastelle."),
    math: txJoin([`${lab("g")} `, line(m1, b1), ` \\quad ${lab("h")} `, line(m2, b2)]),
    answer,
    hint: tx(
      "Find both slope angles with $\\tan^{-1}$, then $\\varphi = |\\alpha_g - \\alpha_h|$. If that's more than $90 \\deg$, take $180 \\deg$ minus it.",
      "Bestimm beide Steigungswinkel mit $\\tan^{-1}$, dann $\\varphi = |\\alpha_g - \\alpha_h|$. Ist das mehr als $90 \\deg$, nimm $180 \\deg$ minus die Differenz.",
    ),
    solution: lineAngleFrames(m1, m2),
    mistakes: mk.list,
  };
}

const txJoin = (parts: Text[]): Text => tx(parts.map((p) => resolveText(p, "en")).join(""), parts.map((p) => resolveText(p, "de")).join(""));

const PAIR_SLOPES = [0.5, 1, 2, 3, -0.5, -1, -2, -3, 1.5, -1.5, 0.25, 4, 0];

function lineAngleTask(rng: Rng): Exercise {
  for (;;) {
    const m1 = rng.pick(PAIR_SLOPES);
    const m2 = rng.pick(PAIR_SLOPES);
    if (m1 === m2 || Math.abs(m1 * m2 + 1) < 1e-9) continue;
    return lineAngleExercise(m1, rng.int(-4, 4), m2, rng.int(-4, 4));
  }
}

// ---------------------------------------------------------------------------
// Distance and midpoint

const TRIPLES: [number, number][] = [
  [3, 4],
  [4, 3],
  [6, 8],
  [8, 6],
  [5, 12],
  [12, 5],
  [8, 15],
  [9, 12],
  [12, 9],
];

const sq = (v: number) => (v < 0 ? `(${v})^2` : `${v}^2`);
const minus = (a: number, b: number) => `${a} - ${b < 0 ? `(${b})` : b}`;

function distanceFrames(A: [number, number], B: [number, number]): Frame[] {
  const dx = B[0] - A[0];
  const dy = B[1] - A[1];
  const s = dx * dx + dy * dy;
  const d = Math.sqrt(s);
  const exact = Number.isInteger(d);
  return [
    {
      math: "d#d =#E \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}#r",
      note: tx("$\\Delta x$ and $\\Delta y$ are the legs of a right-angled triangle, $d$ is its hypotenuse. Pythagoras: $d^2 = \\Delta x^2 + \\Delta y^2$.", "$\\Delta x$ und $\\Delta y$ sind die Katheten eines rechtwinkligen Dreiecks, $d$ ist die Hypotenuse. Pythagoras: $d^2 = \\Delta x^2 + \\Delta y^2$."),
    },
    {
      math: `d#d =#E \\sqrt{(${minus(B[0], A[0])})^2 + (${minus(B[1], A[1])})^2}#r`,
      note: tx(`Put in $${pt(A[0], A[1], "A")}$ and $${pt(B[0], B[1], "B")}$. Brackets around negative numbers!`, `Setze $${pt(A[0], A[1], "A")}$ und $${pt(B[0], B[1], "B")}$ ein. Negative Zahlen in Klammern!`),
    },
    { math: `d#d =#E \\sqrt{${sq(dx)} + ${sq(dy)}}#r`, note: tx(`$\\Delta x = ${dx}$ and $\\Delta y = ${dy}$.`, `$\\Delta x = ${dx}$ und $\\Delta y = ${dy}$.`) },
    { math: `d#d =#E \\sqrt{${dx * dx} + ${dy * dy}}#r =#E2 \\sqrt{${s}}`, note: tx("Squares are never negative.", "Quadrate sind nie negativ.") },
    {
      math: say(({ n }) => `d#d ${exact ? "=" : "\\approx"}#E ${exact ? d : n(d, 2)}`),
      note: exact ? tx(`$\\sqrt{${s}} = ${d}$. The distance is $${d}$ units.`, `$\\sqrt{${s}} = ${d}$. Der Abstand beträgt $${d}$ Längeneinheiten.`) : say(({ t, n }) => t(`Rounded: $d \\approx ${n(d, 2)}$ units.`, `Gerundet: $d \\approx ${n(d, 2)}$ Längeneinheiten.`)),
    },
  ];
}

function distanceMistakes(A: [number, number], B: [number, number]): Mistake[] {
  const dx = B[0] - A[0];
  const dy = B[1] - A[1];
  const s = dx * dx + dy * dy;
  const d = Math.sqrt(s);
  const ans: AnswerSpec = Number.isInteger(d) ? { kind: "number", value: d } : rounded(d, 2);
  const mk = mistakeList(ans);
  mk.add({ kind: "number", value: s }, tx("Root missing", "Wurzel vergessen"), tx(`Nearly! $${s}$ is $d^2$. One last step: take the square root.`, `Fast! $${s}$ ist $d^2$. Ein letzter Schritt: Zieh die Wurzel.`));
  mk.add(
    { kind: "number", value: Math.abs(dx) + Math.abs(dy) },
    tx("Legs added", "Katheten addiert"),
    tx(
      "Ah, you added the legs. That's the way along the grid, not the straight line. $\\sqrt{a^2 + b^2}$ is **not** $a + b$.",
      "Ah, du hast die Katheten addiert. Das ist der Weg entlang der Kästchen, nicht die gerade Strecke. $\\sqrt{a^2 + b^2}$ ist **nicht** $a + b$.",
    ),
  );
  const slipX = A[0] < 0 ? B[0] + A[0] : dx;
  const slipY = A[1] < 0 ? B[1] + A[1] : dy;
  if (slipX !== dx || slipY !== dy) {
    const ds = Math.sqrt(slipX * slipX + slipY * slipY);
    mk.add(
      Number.isInteger(ds) ? { kind: "number", value: ds } : rounded(ds, 2),
      tx("Minus a negative number", "Minus eine negative Zahl"),
      tx("Careful: subtracting a negative coordinate means **adding**. Put negative numbers in brackets.", "Vorsicht: Eine negative Koordinate abziehen heißt **addieren**. Setz negative Zahlen in Klammern."),
    );
  }
  return mk.list;
}

const I_DIST = tx("Distance between two points", "Abstand zweier Punkte");

function distanceExercise(A: [number, number], B: [number, number]): Exercise {
  const d = Math.sqrt((B[0] - A[0]) ** 2 + (B[1] - A[1]) ** 2);
  const exact = Number.isInteger(d);
  return {
    instruction: I_DIST,
    text: exact
      ? tx(`How long is the segment between $${pt(A[0], A[1], "A")}$ and $${pt(B[0], B[1], "B")}$?`, `Wie lang ist die Strecke zwischen $${pt(A[0], A[1], "A")}$ und $${pt(B[0], B[1], "B")}$?`)
      : tx(`How long is the segment between $${pt(A[0], A[1], "A")}$ and $${pt(B[0], B[1], "B")}$? Round to two decimal places.`, `Wie lang ist die Strecke zwischen $${pt(A[0], A[1], "A")}$ und $${pt(B[0], B[1], "B")}$? Runde auf zwei Nachkommastellen.`),
    answer: exact ? { kind: "number", value: d, label: "d =" } : rounded(d, 2, { label: "d =" }),
    hint: tx("$d = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$: Pythagoras in the slope triangle.", "$d = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$: Pythagoras im Steigungsdreieck."),
    solution: distanceFrames(A, B),
    mistakes: distanceMistakes(A, B),
  };
}

function distanceTask(rng: Rng): Exercise {
  for (;;) {
    const A: [number, number] = [rng.int(-6, 6), rng.int(-6, 6)];
    let dx: number;
    let dy: number;
    if (rng.chance(0.55)) [dx, dy] = rng.pick(TRIPLES);
    else {
      dx = rng.int(1, 7);
      dy = rng.int(1, 7);
      if (Number.isInteger(Math.sqrt(dx * dx + dy * dy))) continue;
    }
    dx *= rng.sign();
    dy *= rng.sign();
    const B: [number, number] = [A[0] + dx, A[1] + dy];
    if (Math.abs(B[0]) > 12 || Math.abs(B[1]) > 12) continue;
    if (!(A[0] < 0 || A[1] < 0) && rng.chance(0.5)) continue;
    return distanceExercise(A, B);
  }
}

const I_MID = tx("Midpoint of a segment", "Mittelpunkt einer Strecke");

function midpointTask(rng: Rng): Exercise {
  const A: [number, number] = [rng.int(-7, 7), rng.int(-7, 7)];
  let B: [number, number] = [rng.int(-7, 7), rng.int(-7, 7)];
  if (B[0] === A[0] && B[1] === A[1]) B = [A[0] + 4, A[1] - 2];
  const M: [number, number] = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  const reverse = rng.chance(0.35);
  if (!reverse) {
    const mk = mistakeList(pairOf(M[0], M[1]));
    mk.add(pairOf((B[0] - A[0]) / 2, (B[1] - A[1]) / 2), tx("Half the difference", "Halbe Differenz"), tx("Ah, you halved the **difference**. For the midpoint you **add** the coordinates and then halve: the average.", "Ah, du hast die **Differenz** halbiert. Für den Mittelpunkt **addierst** du die Koordinaten und halbierst dann: der Mittelwert."));
    mk.add(pairOf(A[0] + B[0], A[1] + B[1]), tx("Not halved", "Nicht halbiert"), tx("Good start, you added! Now halve both sums.", "Guter Anfang, du hast addiert! Jetzt noch beide Summen halbieren."));
    return {
      instruction: I_MID,
      text: tx(`Find the midpoint $M$ of the segment from $${pt(A[0], A[1], "A")}$ to $${pt(B[0], B[1], "B")}$.`, `Bestimme den Mittelpunkt $M$ der Strecke von $${pt(A[0], A[1], "A")}$ nach $${pt(B[0], B[1], "B")}$.`),
      answer: pairOf(M[0], M[1]),
      hint: tx("The midpoint is the average: add the $x$-coordinates and halve, the same for $y$. A decimal like 2,5 is fine.", "Der Mittelpunkt ist der Mittelwert: $x$-Koordinaten addieren und halbieren, genauso bei $y$. Eine Kommazahl wie 2,5 ist okay."),
      solution: [
        { math: "M#M (\\frac{x_1 + x_2}{2}#fx \\, |#bar \\, \\frac{y_1 + y_2}{2}#fy)#br", note: tx("Midpoint: the average of the $x$-coordinates and of the $y$-coordinates.", "Mittelpunkt: der Mittelwert der $x$-Koordinaten und der $y$-Koordinaten.") },
        { math: `M#M (\\frac{${A[0]} + ${B[0] < 0 ? `(${B[0]})` : B[0]}}{2}#fx \\, |#bar \\, \\frac{${A[1]} + ${B[1] < 0 ? `(${B[1]})` : B[1]}}{2}#fy)#br`, note: tx("Put in the coordinates of $A$ and $B$.", "Setze die Koordinaten von $A$ und $B$ ein.") },
        { math: say(({ n }) => `M#M ${pt(n(M[0]), n(M[1]))}`), note: say(({ t, n }) => t(`So $M${pt(n(M[0]), n(M[1]))}$.`, `Also $M${pt(n(M[0]), n(M[1]))}$.`)) },
      ],
      mistakes: mk.list,
    };
  }
  // B from A and M
  const mk = mistakeList(pairOf(B[0], B[1]));
  mk.add(pairOf((A[0] + M[0]) / 2, (A[1] + M[1]) / 2), tx("Midpoint of AM", "Mittelpunkt von AM"), tx("That's the midpoint between $A$ and $M$. But $M$ is the middle of $AB$: $B$ lies just as far beyond $M$ as $A$ lies before it.", "Das ist der Mittelpunkt zwischen $A$ und $M$. Aber $M$ ist die Mitte von $AB$: $B$ liegt genauso weit hinter $M$ wie $A$ davor."));
  mk.add(pairOf(M[0] - A[0], M[1] - A[1]), tx("Only the step", "Nur der Schritt"), tx("That's the step from $A$ to $M$. Now take the same step once more, starting at $M$.", "Das ist der Schritt von $A$ nach $M$. Jetzt geh denselben Schritt noch einmal, ab $M$."));
  return {
    instruction: tx("Find the endpoint", "Bestimme den Endpunkt"),
    text: say(({ t, n }) => t(`$M${pt(n(M[0]), n(M[1]))}$ is the midpoint of the segment $AB$ with $${pt(A[0], A[1], "A")}$. Find $B$.`, `$M${pt(n(M[0]), n(M[1]))}$ ist der Mittelpunkt der Strecke $AB$ mit $${pt(A[0], A[1], "A")}$. Bestimme $B$.`)),
    answer: pairOf(B[0], B[1]),
    hint: tx("From $A$ to $M$ is one step. From $M$ to $B$ is the same step again: $B = M + (M - A)$, for $x$ and $y$.", "Von $A$ nach $M$ ist ein Schritt. Von $M$ nach $B$ ist derselbe Schritt noch einmal: $B = M + (M - A)$, für $x$ und $y$."),
    solution: [
      { math: say(({ n }) => `x_B = 2 \\cdot ${M[0] < 0 ? `(${n(M[0])})` : n(M[0])} - ${A[0] < 0 ? `(${A[0]})` : A[0]} = ${B[0]}`), note: tx("$M$ is the average, so $x_B = 2 \\cdot x_M - x_A$.", "$M$ ist der Mittelwert, also $x_B = 2 \\cdot x_M - x_A$.") },
      { math: say(({ n }) => `y_B = 2 \\cdot ${M[1] < 0 ? `(${n(M[1])})` : n(M[1])} - ${A[1] < 0 ? `(${A[1]})` : A[1]} = ${B[1]}`), note: tx("The same for $y$.", "Genauso für $y$.") },
      { math: `B#B ${pt(B[0], B[1])}`, note: tx(`So $${pt(B[0], B[1], "B")}$. Check: the average of $A$ and $B$ gives $M$ again.`, `Also $${pt(B[0], B[1], "B")}$. Probe: Der Mittelwert von $A$ und $B$ ergibt wieder $M$.`) },
    ],
    mistakes: mk.list,
  };
}

// ---------------------------------------------------------------------------
// The perpendicular through P: foot F and distance from P to g

type Setup = { mg: Frac; bg: Frac; P: [number, number]; F: [number, number]; mh: Frac; bh: Frac };

function footFrames({ mg, bg, P, mh, bh }: Setup, withDistance: boolean): Frame[] {
  const prod = mul(mh, q(P[0]));
  const [Fx, Fy] = footOf(mg, bg, mh, bh);
  const meet = intersectFrames(mg, bg, mh, bh, tx("Step 2, the foot $F$: where $h$ meets $g$. Set equal.", "Schritt 2, der Lotfußpunkt $F$: Dort trifft $h$ auf $g$. Gleichsetzen."));
  meet[meet.length - 1] = {
    math: say(({ n }) => `F#S ${ptF(Fx, Fy, "", n)}`),
    note: say(({ t, n }) => t(`So the foot of the perpendicular is $F${ptF(Fx, Fy, "", n)}$.`, `Der Lotfußpunkt ist also $F${ptF(Fx, Fy, "", n)}$.`)),
  };
  const frames: Frame[] = [
    {
      math: `m_h#mh =#E -\\frac{1}{m_g}#r =#E2 ${val(mh, "m")}`,
      note: tx(`Step 1, the perpendicular $h$ through $P$: its slope is the negative reciprocal of $m_g = ${num(mg)}$.`, `Schritt 1, die Lotgerade $h$ durch $P$: Ihre Steigung ist der negative Kehrwert von $m_g = ${num(mg)}$.`),
    },
    {
      math: `${val(P[1], "L")} =#EQ ${val(mh, "m")} \\cdot#dot ${valWrap(P[0], "vm")} +#sb b#vb`,
      note: tx(`Put $${pt(P[0], P[1], "P")}$ into $y = ${mx(mh)} + b$.`, `Setze $${pt(P[0], P[1], "P")}$ in $y = ${mx(mh)} + b$ ein.`),
    },
    {
      math: `${val(P[1], "L")} =#EQ ${val(prod, "m")} +#sb b#vb${opRemove(prod)}`,
      note: tx("Solve for $b$.", "Löse nach $b$ auf."),
    },
    { math: lineSrc(mh, bh), note: tx(`So $h$: $${eqLine(mh, bh)}$.`, `Also $h$: $${eqLine(mh, bh)}$.`) },
    ...meet,
  ];
  if (withDistance) frames.push(...pfFrames(P, [Fx, Fy]));
  return frames;
}

/** The foot of the perpendicular as exact numbers. */
function footOf(mg: Frac, bg: Frac, mh: Frac, bh: Frac): [Frac, Frac] {
  const X = div(sub(bh, bg), sub(mg, mh));
  return [X, add(mul(mg, X), bg)];
}

function pfFrames(P: [number, number], [Fx, Fy]: [Frac, Frac]): Frame[] {
  const dx = sub(q(P[0]), Fx);
  const dy = sub(q(P[1]), Fy);
  const s = add(mul(dx, dx), mul(dy, dy));
  const d = Math.sqrt(qv(s));
  const exact = Number.isInteger(d);
  const sqF = (f: Frac) => (f.n < 0 ? `(${num(f)})^2` : `${num(f)}^2`);
  return [
    {
      math: `d#d =#E \\sqrt{${sqF(dx)} + ${sqF(dy)}}#r`,
      note: tx(`Step 3, the distance $d = |PF|$ with Pythagoras: $\\Delta x = ${num(dx)}$, $\\Delta y = ${num(dy)}$.`, `Schritt 3, der Abstand $d = |PF|$ mit dem Satz des Pythagoras: $\\Delta x = ${num(dx)}$, $\\Delta y = ${num(dy)}$.`),
    },
    {
      math: say(({ n }) => `d#d =#E \\sqrt{${num(s)}}#r ${exact ? "=" : "\\approx"} ${exact ? d : n(d, 2)}`),
      note: say(({ t, n }) => t(`The distance from $P$ to $g$ is ${exact ? "" : "about "}$${exact ? d : n(d, 2)}$ units.`, `Der Abstand von $P$ zu $g$ beträgt ${exact ? "" : "etwa "}$${exact ? d : n(d, 2)}$ Längeneinheiten.`)),
    },
  ];
}

function setupFrom(mg: Frac, bg: Frac, P: [number, number]): Setup {
  const mh = neg(div(ONE, mg));
  const bh = sub(q(P[1]), mul(mh, q(P[0])));
  const [Fx, Fy] = footOf(mg, bg, mh, bh);
  return { mg, bg, P, F: [qv(Fx), qv(Fy)], mh, bh };
}

const FOOT_SLOPES: Frac[] = [q(1), q(-1), q(2), q(-2), q(1, 2), q(-1, 2), q(3), q(-3), q(1, 3), q(-1, 3)];

function randomSetup(rng: Rng): Setup {
  for (;;) {
    const mg = rng.pick(FOOT_SLOPES);
    const bg = q(rng.int(-4, 4));
    const Fx = mg.d * rng.int(-3, 3);
    const Fy = qv(add(mul(mg, q(Fx)), bg));
    const k = rng.pick([-2, -1, 1, 2]);
    const P: [number, number] = [Fx - k * mg.n, Fy + k * mg.d];
    if (!Number.isInteger(Fy) || Math.abs(Fy) > 8 || Math.abs(P[0]) > 8 || Math.abs(P[1]) > 8) continue;
    const s = setupFrom(mg, bg, P);
    if (s.bh.d !== 1 || Math.abs(s.bh.n) > 15) continue;
    return s;
  }
}

function footMistakes(s: Setup): Mistake[] {
  const { mg, bg, P } = s;
  const mk = mistakeList(pairOf(s.F[0], s.F[1]));
  const via = (m: Frac) => {
    if (eqF(m, mg)) return null;
    const b = sub(q(P[1]), mul(m, q(P[0])));
    const [x, y] = footOf(mg, bg, m, b);
    return pairOf(x, y);
  };
  const wrong1 = via(neg(mg));
  if (wrong1) mk.add(wrong1, tx("Only the sign flipped", "Nur das Vorzeichen gedreht"), tx("Half of it! For the perpendicular you flip the sign **and** take the reciprocal: $m_h = -\\frac{1}{m_g}$.", "Die Hälfte hast du! Für die Lotgerade drehst du das Vorzeichen um **und** bildest den Kehrwert: $m_h = -\\frac{1}{m_g}$."));
  const wrong2 = via(div(ONE, mg));
  if (wrong2) mk.add(wrong2, tx("Sign not flipped", "Vorzeichen nicht gedreht"), tx("Half of it! You took the reciprocal, but the sign has to flip too: $m_h = -\\frac{1}{m_g}$.", "Die Hälfte hast du! Den Kehrwert hast du, aber das Vorzeichen muss sich auch umdrehen: $m_h = -\\frac{1}{m_g}$."));
  mk.add(
    pairOf(P[0], qv(add(mul(mg, q(P[0])), bg))),
    tx("Straight up or down, not perpendicular", "Parallel zur y-Achse statt im Lot"),
    tx("Ah, you went straight up or down from $P$ to $g$. But the foot $F$ is where the **perpendicular** meets $g$, at a right angle to $g$.", "Ah, du bist von $P$ parallel zur $y$-Achse bis $g$ gegangen. Der Lotfußpunkt $F$ liegt aber dort, wo die **Lotgerade** $g$ im rechten Winkel trifft."),
  );
  return mk.list;
}

function footTask(rng: Rng): Exercise {
  const s = randomSetup(rng);
  return {
    instruction: tx("Foot of the perpendicular", "Lotfußpunkt"),
    text: tx(
      `The line $g$ has the equation $${eqLine(s.mg, s.bg)}$. Find the foot $F$ of the perpendicular from $${pt(s.P[0], s.P[1], "P")}$ to $g$.`,
      `Die Gerade $g$ hat die Gleichung $${eqLine(s.mg, s.bg)}$. Bestimme den Lotfußpunkt $F$ des Lots von $${pt(s.P[0], s.P[1], "P")}$ auf $g$.`,
    ),
    answer: pairOf(s.F[0], s.F[1]),
    hint: tx("The perpendicular $h$ through $P$ has the slope $m_h = -\\frac{1}{m_g}$. Find $h$, then set $g$ and $h$ equal.", "Die Lotgerade $h$ durch $P$ hat die Steigung $m_h = -\\frac{1}{m_g}$. Bestimm $h$ und setz dann $g$ und $h$ gleich."),
    solution: footFrames(s, false),
    mistakes: footMistakes(s),
  };
}

function pointLineMistakes(s: Setup): Mistake[] {
  const { mg, bg, P } = s;
  const d = Math.hypot(P[0] - s.F[0], P[1] - s.F[1]);
  const mk = mistakeList(rounded(d, 2, { label: "d =" }));
  const vertical = Math.abs(P[1] - qv(add(mul(mg, q(P[0])), bg)));
  mk.add(
    Number.isInteger(vertical) ? { kind: "number", value: vertical } : rounded(vertical, 2),
    tx("Straight up or down, not perpendicular", "Parallel zur y-Achse statt im Lot"),
    tx("Ah, that's the distance straight up or down to $g$. The real distance is the **shortest** one: along the perpendicular, at a right angle to $g$. It's shorter!", "Ah, das ist der Abstand parallel zur $y$-Achse bis $g$. Der echte Abstand ist der **kürzeste**: entlang der Lotgeraden, im rechten Winkel zu $g$. Er ist kürzer!"),
  );
  const s2 = (P[0] - s.F[0]) ** 2 + (P[1] - s.F[1]) ** 2;
  mk.add(Number.isInteger(r2(s2)) ? { kind: "number", value: r2(s2) } : rounded(s2, 2), tx("Root missing", "Wurzel vergessen"), tx("Nearly! That's $d^2$. Take the square root at the end.", "Fast! Das ist $d^2$. Zieh am Ende noch die Wurzel."));
  return mk.list;
}
const r2 = (v: number) => Math.round(v * 100) / 100;

function pointLineExercise(s: Setup): Exercise {
  const d = Math.hypot(s.P[0] - s.F[0], s.P[1] - s.F[1]);
  return {
    instruction: tx("Distance from a point to a line", "Abstand Punkt–Gerade"),
    text: tx(
      `How far is the point $${pt(s.P[0], s.P[1], "P")}$ from the line $g$: $${eqLine(s.mg, s.bg)}$? Round to two decimal places.`,
      `Wie weit ist der Punkt $${pt(s.P[0], s.P[1], "P")}$ von der Geraden $g$: $${eqLine(s.mg, s.bg)}$ entfernt? Runde auf zwei Nachkommastellen.`,
    ),
    answer: Number.isInteger(r2(d)) && Math.abs(d - Math.round(d)) < 1e-9 ? { kind: "number", value: Math.round(d), label: "d =" } : rounded(d, 2, { label: "d =" }),
    hint: tx(
      "Three steps: the perpendicular $h$ through $P$ ($m_h = -\\frac{1}{m_g}$), the foot $F$ where $h$ meets $g$, then $d = |PF|$ with Pythagoras.",
      "Drei Schritte: die Lotgerade $h$ durch $P$ ($m_h = -\\frac{1}{m_g}$), der Lotfußpunkt $F$ als Schnittpunkt von $h$ und $g$, dann $d = |PF|$ mit Pythagoras.",
    ),
    solution: footFrames(s, true),
    mistakes: pointLineMistakes(s),
  };
}

function pointLineTask(rng: Rng): Exercise {
  return pointLineExercise(randomSetup(rng));
}

// ---------------------------------------------------------------------------
// Practice

export function generate3(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.16) return intersectTask(rng);
  if (r < 0.26) return positionTask(rng);
  if (r < 0.38) return slopeAngleTask(rng);
  if (r < 0.44) return slopeFromAngleTask(rng);
  if (r < 0.54) return lineAngleTask(rng);
  if (r < 0.66) return distanceTask(rng);
  if (r < 0.77) return midpointTask(rng);
  if (r < 0.88) return footTask(rng);
  return pointLineTask(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const angleLessonFrames: Frame[] = [
  {
    math: tx('\\tan#t \\alpha#al =#E \\frac{"opposite"#op}{"adjacent"#ad}#fr', '\\tan#t \\alpha#al =#E \\frac{"Gegenkathete"#op}{"Ankathete"#ad}#fr'),
    note: tx("In a right-angled triangle, the tangent of an angle is opposite over adjacent.", "Im rechtwinkligen Dreieck ist der Tangens eines Winkels Gegenkathete durch Ankathete."),
  },
  {
    math: "\\tan#t \\alpha#al =#E \\frac{m#op}{1#ad}#fr =#E2 m#m2",
    note: tx("In the slope triangle the opposite side is the rise $m$, the adjacent side the run $1$. So $\\tan \\alpha = m$.", "Im Steigungsdreieck ist die Gegenkathete der Anstieg $m$, die Ankathete die $1$ nach rechts. Also gilt $\\tan \\alpha = m$."),
  },
  {
    math: tx("\\tan#t \\alpha#al =#E 1.5#m2", "\\tan#t \\alpha#al =#E 1,5#m2"),
    note: tx("Example: $y = 1.5x - 2$ has $m = 1.5$. The $-2$ only shifts the line, the angle stays the same.", "Beispiel: $y = 1,5x - 2$ hat $m = 1,5$. Die $-2$ verschiebt die Gerade nur, der Winkel bleibt gleich."),
  },
  {
    math: tx("\\alpha#al =#E \\tan^{-1}(1.5#m2)", "\\alpha#al =#E \\tan^{-1}(1,5#m2)"),
    note: tx("The calculator undoes the tangent with $\\tan^{-1}$ (often SHIFT + tan). Set it to **DEG**!", "Der Taschenrechner macht den Tangens mit $\\tan^{-1}$ rückgängig (meist SHIFT + tan). Stell ihn auf **DEG**!"),
  },
  { math: tx("\\alpha#al \\approx#E 56.3#m2 \\deg#dg", "\\alpha#al \\approx#E 56,3#m2 \\deg#dg"), note: tx("So the line rises at about $56.3 \\deg$.", "Die Gerade steigt also unter etwa $56,3 \\deg$.") },
  {
    math: tx("\\tan^{-1}(-0.5) \\approx#E -26.6#m2 \\deg#dg", "\\tan^{-1}(-0,5) \\approx#E -26,6#m2 \\deg#dg"),
    note: tx(
      "A falling line gives a negative angle: it falls at $26.6 \\deg$. Measured from the positive $x$-axis, that's $180 \\deg - 26.6 \\deg = 153.4 \\deg$.",
      "Eine fallende Gerade liefert einen negativen Winkel: Sie fällt unter $26,6 \\deg$. Von der positiven $x$-Achse aus gemessen sind das $180 \\deg - 26,6 \\deg = 153,4 \\deg$.",
    ),
  },
  {
    math: "\\varphi#dl =#E |\\alpha_g - \\alpha_h|#ab",
    note: tx("Two lines: their **angle of intersection** $\\varphi$ is the difference of their slope angles.", "Zwei Geraden: Ihr **Schnittwinkel** $\\varphi$ ist die Differenz ihrer Steigungswinkel."),
  },
  {
    math: "\\varphi#dl =#E 180 \\deg - |\\alpha_g - \\alpha_h|#ab",
    note: tx("The angle of intersection is always the acute one, at most $90 \\deg$. If the difference is bigger, take $180 \\deg$ minus it.", "Der Schnittwinkel ist immer der spitze Winkel, höchstens $90 \\deg$. Ist die Differenz größer, nimm $180 \\deg$ minus die Differenz."),
  },
];

const midLessonFrames: Frame[] = [
  { math: "M#M (\\frac{x_1 + x_2}{2}#fx \\, |#bar \\, \\frac{y_1 + y_2}{2}#fy)#br", note: tx("The midpoint $M$: add the coordinates and halve them, for $x$ and for $y$.", "Der Mittelpunkt $M$: Koordinaten addieren und halbieren, für $x$ und für $y$.") },
  { math: "M#M (\\frac{1 + 7}{2}#fx \\, |#bar \\, \\frac{2 + 10}{2}#fy)#br", note: tx("With $A(1 | 2)$ and $B(7 | 10)$ ...", "Mit $A(1 | 2)$ und $B(7 | 10)$ …") },
  { math: "M#M (4#fx \\, |#bar \\, 6#fy)#br", note: tx("... you get $M(4 | 6)$, exactly halfway from $A$ to $B$.", "… bekommst du $M(4 | 6)$, genau auf halbem Weg von $A$ nach $B$.") },
];

const EXAMPLE_FOOT = setupFrom(q(1, 2), q(1), [6, -1]);

export const level3: LevelLesson = {
  summary: [
    {
      title: tx("Intersection point", "Schnittpunkt"),
      body: tx(
        "Set the right-hand sides equal, solve for $x$, put $x$ into one equation for $y$. Same slope: parallel (no point) or identical (every point).",
        "Rechte Seiten gleichsetzen, nach $x$ auflösen, $x$ in eine Gleichung einsetzen für $y$. Gleiche Steigung: parallel (kein Punkt) oder identisch (alle Punkte).",
      ),
      examples: ["2x - 1 = -x + 5", "x = 2, \; y = 3 \; \\Rightarrow \; S(2 \\, | \\, 3)"],
      tone: "rule",
    },
    {
      title: tx("Slope angle", "Steigungswinkel"),
      body: tx(
        "$\\tan \\alpha = m$, so $\\alpha = \\tan^{-1}(m)$, calculator in DEG mode. A negative result means the line falls at that angle.",
        "$\\tan \\alpha = m$, also $\\alpha = \\tan^{-1}(m)$, Taschenrechner im DEG-Modus. Ein negatives Ergebnis heißt: Die Gerade fällt unter diesem Winkel.",
      ),
      examples: ["m = 1 \\Rightarrow \\alpha = 45 \\deg", tx("m = 1.5 \\Rightarrow \\alpha \\approx 56.3 \\deg", "m = 1,5 \\Rightarrow \\alpha \\approx 56,3 \\deg")],
      tone: "rule",
    },
    {
      title: tx("Angle between two lines", "Schnittwinkel zweier Geraden"),
      body: tx(
        "$\\varphi = |\\alpha_g - \\alpha_h|$. If that's more than $90 \\deg$, take $180 \\deg - \\varphi$. Perpendicular lines: $m_g \\cdot m_h = -1$ and $\\varphi = 90 \\deg$.",
        "$\\varphi = |\\alpha_g - \\alpha_h|$. Ist das mehr als $90 \\deg$, nimm $180 \\deg - \\varphi$. Orthogonale Geraden: $m_g \\cdot m_h = -1$ und $\\varphi = 90 \\deg$.",
      ),
      tone: "rule",
    },
    {
      title: tx("Distance and midpoint", "Abstand und Mittelpunkt"),
      body: tx("Pythagoras in the slope triangle, and the average of the coordinates.", "Pythagoras im Steigungsdreieck und der Mittelwert der Koordinaten."),
      examples: ["d = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}", "M(\\frac{x_1 + x_2}{2} \\, | \\, \\frac{y_1 + y_2}{2})"],
      tone: "rule",
    },
    {
      title: tx("Distance from a point to a line", "Abstand Punkt–Gerade"),
      body: tx(
        "1. Perpendicular $h$ through $P$ with $m_h = -\\frac{1}{m_g}$. 2. Foot $F$: set $g$ and $h$ equal. 3. $d = |PF|$.",
        "1. Lotgerade $h$ durch $P$ mit $m_h = -\\frac{1}{m_g}$. 2. Lotfußpunkt $F$: $g$ und $h$ gleichsetzen. 3. $d = |PF|$.",
      ),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Calculator in RAD mode: $\\tan^{-1}(1) = 0.785$ instead of $45 \\deg$. And the distance from $P$ to $g$ is measured along the **perpendicular**, not straight up or down.",
        "Taschenrechner im RAD-Modus: $\\tan^{-1}(1) = 0,785$ statt $45 \\deg$. Und der Abstand von $P$ zu $g$ wird **im Lot** gemessen, nicht parallel zur $y$-Achse.",
      ),
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Where two lines meet", "Der Schnittpunkt zweier Geraden"),
      blob: tx("Two lines, one point they share. Let's hunt it down!", "Zwei Geraden, ein gemeinsamer Punkt. Den spüren wir auf!"),
      body: tx(
        "At the intersection point $S$ both equations give the same $y$ for the same $x$. So you set the right-hand sides equal, solve for $x$ and then find $y$. Here: $g$: $y = 2x - 1$ and $h$: $y = -x + 5$.",
        "Im Schnittpunkt $S$ liefern beide Gleichungen beim selben $x$ dasselbe $y$. Also setzt du die rechten Seiten gleich (**Gleichsetzen**), löst nach $x$ auf und bestimmst dann $y$. Hier: $g$: $y = 2x - 1$ und $h$: $y = -x + 5$.",
      ),
      visual: graphVisual({
        xRange: [-3, 6],
        yRange: [-3, 7],
        functions: [
          { f: lineFn(q(2), q(-1)), key: "g", color: "blob", label: "g" },
          { f: lineFn(q(-1), q(5)), key: "h", color: "ink", label: "h" },
        ],
        points: [{ x: 2, y: 3, key: "S", label: "S", color: "blob" }],
      }),
      frames: intersectFrames(q(2), q(-1), q(-1), q(5)),
    },
    {
      type: "widget",
      title: tx("Intersection lab", "Schnittpunkt-Labor"),
      blob: tx("Turn and slide both lines. Can you make them miss each other?", "Dreh und verschieb beide Geraden. Schaffst du es, dass sie sich verfehlen?"),
      body: tx(
        "Change the slope and the $y$-intercept of $g$ and $h$. The intersection point $S$ and the equating follow live. Give both lines the same slope and see what happens.",
        "Ändere Steigung und y-Achsenabschnitt von $g$ und $h$. Der Schnittpunkt $S$ und das Gleichsetzen laufen live mit. Gib beiden Geraden dieselbe Steigung und schau, was passiert.",
      ),
      widget: IntersectionLab,
    },
    {
      type: "check",
      blob: tx("Your turn! Equate, solve, put back in.", "Du bist dran! Gleichsetzen, lösen, einsetzen."),
      exercise: intersectExercise(q(1, 2), q(1), q(-1), q(7)),
    },
    {
      type: "explain",
      title: tx("The slope angle", "Der Steigungswinkel"),
      blob: tx("How steep is steep? Let's measure it in degrees!", "Wie steil ist steil? Das messen wir jetzt in Grad!"),
      body: tx(
        "The **slope angle** $\\alpha$ is the angle between the positive $x$-axis and the line. The slope triangle with run $1$ and rise $m$ has a right angle, so trigonometry works.",
        "Der **Steigungswinkel** $\\alpha$ ist der Winkel zwischen der positiven $x$-Achse und der Geraden. Das Steigungsdreieck mit $1$ nach rechts und $m$ nach oben ist rechtwinklig, also hilft die Trigonometrie.",
      ),
      frames: angleLessonFrames,
    },
    {
      type: "widget",
      title: tx("Angle lab", "Winkel-Labor"),
      blob: tx("Make the line steeper. When does α pass 45°?", "Mach die Gerade steiler. Wann knackt α die 45°?"),
      body: tx(
        "Change the slope and watch $\\alpha = \\tan^{-1}(m)$. Switch to **Two lines** to see the angle of intersection $\\varphi$ between $g$ and $h$.",
        "Ändere die Steigung und beobachte $\\alpha = \\tan^{-1}(m)$. Unter **Zwei Geraden** siehst du den Schnittwinkel $\\varphi$ zwischen $g$ und $h$.",
      ),
      widget: AngleLab,
    },
    {
      type: "check",
      blob: tx("Two slope angles, then subtract. Calculator on DEG!", "Zwei Steigungswinkel, dann subtrahieren. Taschenrechner auf DEG!"),
      exercise: lineAngleExercise(3, -1, 1, 2),
    },
    {
      type: "explain",
      title: tx("Distance and midpoint", "Abstand und Mittelpunkt"),
      blob: tx("Pythagoras is hiding in every slope triangle!", "In jedem Steigungsdreieck versteckt sich Pythagoras!"),
      body: tx(
        "The segment $AB$ is the hypotenuse of a slope triangle with the legs $\\Delta x$ and $\\Delta y$. The midpoint $M$ is the average of the two points.",
        "Die Strecke $AB$ ist die Hypotenuse eines Steigungsdreiecks mit den Katheten $\\Delta x$ und $\\Delta y$. Der Mittelpunkt $M$ ist der Mittelwert der beiden Punkte.",
      ),
      visual: graphVisual({
        xRange: [-1, 9],
        yRange: [-1, 11],
        segments: [
          { from: [1, 2], to: [7, 2], color: "ink", dashed: true, label: "Δx = 6", key: "dx" },
          { from: [7, 2], to: [7, 10], color: "ink", dashed: true, label: "Δy = 8", key: "dy" },
          { from: [1, 2], to: [7, 10], color: "blob", key: "ab" },
        ],
        points: [
          { x: 1, y: 2, key: "A", label: "A", color: "ink" },
          { x: 7, y: 10, key: "B", label: "B", color: "ink" },
          { x: 4, y: 6, key: "M", label: "M", color: "blob" },
        ],
      }),
      frames: [...distanceFrames([1, 2], [7, 10]), ...midLessonFrames],
    },
    {
      type: "check",
      blob: tx("Careful with the minus in front of the 2!", "Achte auf das Minus vor der 2!"),
      exercise: distanceExercise([-2, 1], [4, 9]),
    },
    {
      type: "explain",
      title: tx("The shortest way to a line", "Der kürzeste Weg zur Geraden"),
      blob: tx("The shortest way always meets the line at a right angle.", "Der kürzeste Weg trifft die Gerade immer im rechten Winkel."),
      body: tx(
        "The distance from $P$ to the line $g$ is measured at a right angle. Three steps: 1. the perpendicular $h$ through $P$, 2. its foot $F$ on $g$, 3. $d = |PF|$. Example: $g$: $y = \\frac{1}{2}x + 1$ and $P(6 | -1)$.",
        "Der Abstand von $P$ zur Geraden $g$ wird im rechten Winkel gemessen. Drei Schritte: 1. die Lotgerade $h$ durch $P$, 2. ihr Lotfußpunkt $F$ auf $g$, 3. $d = |PF|$. Beispiel: $g$: $y = \\frac{1}{2}x + 1$ und $P(6 | -1)$.",
      ),
      visual: graphVisual({
        xRange: [-2, 8],
        yRange: [-3, 7],
        functions: [
          { f: lineFn(q(1, 2), q(1)), key: "g", color: "blob", label: "g" },
          { f: lineFn(q(-2), q(11)), key: "h", color: "ink", dashed: true, label: "h" },
        ],
        segments: [{ from: [6, -1], to: [4, 3], color: "ok", key: "pf", label: "d" }],
        points: [
          { x: 6, y: -1, key: "P", label: "P", color: "ink" },
          { x: 4, y: 3, key: "F", label: "F", color: "blob" },
        ],
      }),
      frames: footFrames(EXAMPLE_FOOT, true),
    },
    {
      type: "widget",
      title: tx("Distance from a point to a line", "Abstand Punkt–Gerade"),
      blob: tx("Drag P around. The right angle always stays!", "Zieh P herum. Der rechte Winkel bleibt immer!"),
      body: tx(
        "Drag $P$ and pick a line $g$. Go through the method step by step: the perpendicular $h$, the foot $F$, the distance $d$.",
        "Zieh $P$ und wähl eine Gerade $g$. Geh das Verfahren Schritt für Schritt durch: Lotgerade $h$, Lotfußpunkt $F$, Abstand $d$.",
      ),
      widget: DistanceLab,
    },
    {
      type: "check",
      blob: tx("The grand finale: all three steps!", "Das große Finale: alle drei Schritte!"),
      exercise: pointLineExercise(setupFrom(q(-1), q(1), [5, 4])),
    },
  ],
};

